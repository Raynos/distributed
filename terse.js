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
            } else if (message.text) {
                chat.emit('message', message, stream)
            }
        })

        chat.on('message', function (message, source) {
            if (source !== stream) stream.queue(message)
        })

        stream.queue({ clock: chat.clock, id: id })

        return stream
    }

    chat.on('message', function (message) {
        if (!seen(clock, message)) {
            clock[message.id] = message.time

            chat.history.push(message)
            console.log(message.name + ' > ' + message.text)
        }
    })

    return chat
}

var chat = Chat(id, name)
process.stdin.on('data', function (text) {
    chat.send(String(text))
})

net.createServer(function (stream) {
    stream.pipe(chat.createStream()).pipe(stream)
}).listen(serverPort)

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

    if (peer.host === myIp && peer.port === serverPort) {
        return setTimeout(connect, 1000)
    }

    var client = net.connect(peer.port, peer.host, function () {
        client.pipe(chat.createStream()).pipe(client)
        setTimeout(client.end.bind(client), 5000)
    })

    client.on('error', reconnect)
    client.on('close', reconnect)

    function reconnect () {
        client.removeAllListeners()

        connect()
    }
})()
