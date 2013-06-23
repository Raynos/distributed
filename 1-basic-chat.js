var MessageStream = require('message-stream')
var net = require('net')
var argv = require('optimist').argv
var EventEmitter = require('events').EventEmitter

// port needed for connection
var seedPort = argv.port || 2503
var myIp = require('my-local-ip')() || "localhost"
var seedHost = argv.host || myIp
var serverPort = argv.server || 2503

// id needed for per client identity
var id = myIp + ':' + serverPort

// name purely for pretty-ness
var name = argv.name || 'Anonymous'

function Chat(id, name) {
    // Each node needs a messages thing
    var chat = new EventEmitter()
    chat.setMaxListeners(Infinity)

    // keep track of history
    var history = chat.history = []
    var clock = chat.clock = {}

    // We should be able to send messages locally
    chat.send = function (text) {
        chat.emit('message', {
            text: text,
            name: name,
            id: id,
            time: Date.now()
        })
    }

    function seen (clock, message) {
      return clock[message.id] && clock[message.id] >= message.time
    }

    // Create a stream for sending and receiving messages
    // When we receieve a message from the stream we should
    // call .receive
    // When we have a message emmitted we should queue it
    // unless we emitted it ourselves to avoid an infinite loop
    // This means we should always pass along the stream to
    // receive
    chat.createStream = function () {
        var stream = MessageStream(function (message) {
            // Handle history messages
            if (message.clock) {
                history.forEach(function (e) {
                    if(!seen(message.clock, e)) {
                        stream.queue(e)
                    }
                })
            // otherwise receive the message
            } else {
                chat.receive(message, stream)
            }
        })

        // on message send down stream
        chat.on('message', function (message, source) {
            if (source !== stream) {
                stream.queue(message)
            }
        })

        // send the history receival handshake
        stream.queue({ clock: chat.clock, id: id })

        return stream
    }

    // we should be able to receive messages from a network
    chat.receive = function (message, source) {
        chat.emit('message', message, source)
    }

    // on message store in history & print
    chat.on('message', function (message) {
        // check to see whether message already handled
        if (!seen(clock, message)) {
            // update clock
            clock[message.id] = message.time

            chat.history.push(message)
            console.log(message.name + ' > ' + message.text)
        }
    })

    //get the lastest message we know.
    chat.latest = function () {
        return history.reduce(function (max, e) {
            return max.time > e.time ? max : e
        }, {time: 0}).time
    }

    return chat
}

var chat = Chat(id, name)
process.stdin.on('data', function (text) {
    chat.send(String(text))
})

//if (argv.server) {
    var server = net.createServer(function (stream) {
        stream.pipe(chat.createStream()).pipe(stream)
    })

    server.listen(serverPort)
    console.log('Started server on port', serverPort)
//} else {
    // connection logic in function for retries
    ;(function connect () {
        var hosts = Object.keys(chat.clock).map(function (e) {
          var p = e.split(':')
          return {host: p[0], port: p[1]}
        }).filter(function (e) {
          return serverPort != e.port || myIp != e.host
        })

        var random = hosts[~~(Math.random() * hosts.length)]
            || {host: seedHost, port: seedPort}

        console.log('Attempt connection to:', random)

        if(random.host == myIp && random.port == serverPort) {
           console.log('do not connect to self')
           return reconnect()
        }

        var client = net.connect(random.port, random.host, function () {
            client.pipe(chat.createStream()).pipe(client)
            console.log('Connected to server on port', random.port)
            setTimeout(function() {
              client.end()
            }, 5000)
        })

        // retry on end or error
        client.on('error', reconnect)
        client.on('close', reconnect)

        function reconnect () {
            if(client) client.removeAllListeners()
            setTimeout(function () {
                connect()
            }, 1000)
        }
    })()
//}
