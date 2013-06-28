var opts = require("optimist").argv
var MessageStream = require("message-stream")
var net = require("net")
var EventEmitter = require("events").EventEmitter

var myIp = require("my-local-ip")() || "localhost"
var serverPort = opts.server
var clientPort = opts.port
var clientHost = opts.host || myIp

function Chat(id, name) {
    var chat = new EventEmitter()
    var timestamp = 0
    var history = []
    var clock = chat.clock = {}

    chat.send = function send(text) {
        chat.emit("message", {
            text: text,
            id: id,
            name: name,
            ts: Date.now()
        })
    }

    var old_seen = function (timestamp, message) {
        return message.ts <= timestamp
    }

    var seen = function (clock, message) {
        return message.ts <= clock[message.id]
    }

    chat.createStream = function () {
        var stream = MessageStream(function (message) {
            if (message.clock) {
                history.forEach(function (msg) {
                    if (!seen(message.clock, msg)) {
                        stream.queue(msg)
                    }
                })
            } else if (typeof message.since === "number") {
                history.forEach(function (msg) {
                    if (!old_seen(message.since, msg)) {
                        stream.queue(msg)
                    }
                })
            } else if (!seen(clock, message)) {
                chat.emit("message", message, stream)
            }
        })

        chat.on("message", function (message, source) {
            if (source !== stream) stream.queue(message)
        })

        stream.queue({ clock: clock })

        return stream
    }

    chat.on("message", function (message) {
        timestamp = message.ts
        clock[message.id] = message.ts
        history.push(message)

        console.log(message.name, "[", message.id, "]>", message.text)
    })

    return chat
}

// node impl2.js --name=YOUR_NAME --port=8000 --host=10.0.1.30

var chat = Chat(myIp + ":" + serverPort, opts.name || "Anon")
process.stdin.on("data", function (buf) {
    chat.send(buf.toString())
})
process.stdin.resume()

if (opts.server) {
    net.createServer(function (stream) {
        stream.pipe(chat.createStream()).pipe(stream)
    }).listen(serverPort)
    console.log("server listening on " + myIp + ":" + serverPort)
}

function randomPeer(clock) {
    var peers = Object.keys(clock).map(function (id) {
        var parts = id.split(":")
        return { host: parts[0], port: parts[1] }
    })

    return peers[~~(Math.random() * peers.length)]
}

;(function connect() {
    var peer = randomPeer(chat.clock) || { host: clientHost, port: clientPort }

    console.log("client trying to connect to " + peer.host + ":" + peer.port)
    var client = net.connect(peer.port, peer.host, function () {
        client.pipe(chat.createStream()).pipe(client)
    })

    client.on("error", reconnect)
    client.on("end", reconnect)

    function reconnect() {
        client.removeAllListeners()

        setTimeout(connect, 1000)
    }
})()
