var MessageStream = require('message-stream')
var net = require('net')
var argv = require('optimist').argv
var EventEmitter = require('events').EventEmitter

// port needed for connection
var port = argv.port || 2503
var myIp = require('my-local-ip')()
var host = argv.host || myIp
// id needed for per client identity
var id = myIp + ':' + port

// name purely for pretty-ness
var name = argv.name || 'Anonymous'

function Chat(id, name) {
    // Each node needs a messages thing
    var chat = new EventEmitter()

    // keep track of history
    var history = chat.history = []

    // We should be able to send messages locally
    chat.send = function (text) {
        chat.emit('message', {
            text: text,
            name: name,
            id: id,
            time: Date.now()
        })
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
            if (typeof message.since === "number") {
                console.log(message.id + ' requests messages since:', message.since)
                history.forEach(function (e) {
                    if(e.time > message.since) {
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
        stream.queue({ since: chat.latest(), id: id })

        return stream
    }

    // we should be able to receive messages from a network
    chat.receive = function (message, source) {
        chat.emit('message', message, source)
    }

    // on message store in history & print
    chat.on('message', function (message) {
        chat.history.push(message)
        console.log(message.name + ' > ' + message.text)
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

if (argv.server) {
    var server = net.createServer(function (stream) {
        stream.pipe(chat.createStream()).pipe(stream)
    })

    server.listen(port)
    console.log('Started server on port', port)
} else {
    // connection logic in function for retries
    (function connect () {
        console.log('Attempt connection to:', host+':'+port)
        var client = net.connect(port, host, function () {
            client.pipe(chat.createStream()).pipe(client)
            console.log('Connected to server on port', port)
        })

        // retry on end or error
        client.once('error', reconnect)
        client.once('end', reconnect)

        function reconnect () {
            setTimeout(function () {
                connect()
            }, 1000)
        }
    })()
}
