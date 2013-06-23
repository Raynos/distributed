var MessageStream = require('message-stream')
var net = require('net')
var argv = require('optimist').argv
var EventEmitter = require('events').EventEmitter

var seedPort = argv.port || 2503
var myIp = require('my-local-ip')() || 'localhost'
var seedHost = argv.host || myIp
var serverPort = argv.server || 2503
var id = myIp + ':' + serverPort
var name = argv.name || 'Anonymous'

function Chat(id, name) {
    var chat = new EventEmitter()
    chat.setMaxListeners(Infinity)

    var history = chat.history = []
    var clock = chat.clock = {}

    chat.send = function (text) {
        chat.emit('message', {
            text: text,
            name: name,
            id: id,
            time: Date.now()
        })
    }

    function seen(clock, message) {
        return clock[message.id] && clock[message.id] >= message.time
    }

    chat.createStream = function () {
        var stream = MessageStream(function (message) {
            if (message.clock) {
                history.forEach(function (e) {
                    if (!seen(message.clock, e)) stream.queue(e)
                })
            } else {
                chat.receive(message, stream)
            }
        })

        chat.on('message', function (message, source) {
            if (source !== stream) stream.queue(message)
        })

        stream.queue({ clock: chat.clock, id: id })

        return stream
    }

    chat.receive = function (message, source) {
        chat.emit('message', message, source)
    }

    chat.on('message', function (message) {
        if (!seen(clock, message)) {
            clock[message.id] = message.time

            chat.history.push(message)
            if (message.text) {
                console.log(message.name + ' > ' + message.text)
            }
        }
    })

    return chat
}

var chat = Chat(id, name)
process.stdin.on('data', function (text) {
    chat.send(String(text))
})

var server = net.createServer(function (stream) {
    stream.pipe(chat.createStream()).pipe(stream)
})

server.listen(serverPort)
console.log('Started server on port', serverPort)

function randomPeer(clock, defaults) {
    var hosts = Object.keys(clock).map(function (peer) {
        var parts = peer.split(':')
        return { host: parts[0], port: parts[1] }
    }).filter(function (peer) {
        return serverPort !== peer.port || myIp !== peer.host
    })

    return hosts[~~(Math.random() * hosts.length)] || defaults
}

;(function connect () {
    var peer = randomPeer(chat.clock, { host: seedHost, port: seedPort })

    console.log('Attempt connection to:', peer)

    if (peer.host === myIp && peer.port === serverPort) {
        console.log('do not connect to self')
        return setTimeout(connect, 1000)
    }

    var client = net.connect(random.port, random.host, function () {
        client.pipe(chat.createStream()).pipe(client)
        console.log('Connected to server on port', random.port)
        setTimeout(function() {
            client.end()
        }, 5000)
    })

    client.on('error', reconnect)
    client.on('close', reconnect)

    function reconnect () {
        client.removeAllListeners()

        connect()
    }
})()
