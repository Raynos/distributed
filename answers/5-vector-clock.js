var opts = require("optimist").argv
var MessageStream = require("message-stream")
var net = require("net")
var EventEmitter = require("events").EventEmitter

var myIp = require("my-local-ip")() || "localhost"
var serverPort = opts.server
var seedPort = opts.port
var seedHost = opts.host || myIp

function Chat(id, name) {
    var chat = new EventEmitter()
    chat.setMaxListeners(Infinity)
    var history = chat.history = []
    var clock = chat.clock = {}

    chat.send = function send(text) {
        chat.emit("message", { text: text, id: id, name: name, ts: Date.now() })
    }

    function seen(clock, message) {
        return clock[message.id] && clock[message.id] >= message.ts
    }

    chat.createStream = function () {
        var stream = MessageStream(function (message) {
            if (typeof message.since === "number") {
                history.forEach(function (e) {
                    if (e.ts > message.since) stream.queue(e)
                })
            } else if(message.clock) {
                history.forEach(function (e) {
                    if (!seen(message.clock, e)) stream.queue(e)
                })
            } else if (!seen(clock, message)) {
                chat.emit("message", message, stream)
            }
        })

        chat.on("message", function (message, source) {
            if (source !== stream) stream.queue(message)
        })

        stream.queue({ clock: clock, id: id })

        return stream
    }

    chat.on("message", function (message) {
        clock[message.id] = message.ts

        if (message.text) {
            history.push(message)
            console.log(message.name, ">", message.text)
        }
    })

    return chat
}

var chat = Chat(myIp + ":" + serverPort, opts.name || "Anon")
process.stdin.on("data", function (buf) {
    chat.send(buf.toString())
})

net.createServer(function (stream) {
    stream.pipe(chat.createStream()).pipe(stream)
}).listen(serverPort, myIp)
console.log("server listening on " + myIp + ":" + serverPort)

function randomPeer(clock) {
    var peers = Object.keys(clock).map(function (id) {
        var parts = id.split(":")
        return { host: parts[0], port: parts[1] }
    })

    return peers[~~(Math.random() * peers.length)]
}

;(function connect() {
    var peer = randomPeer(chat.clock)

    if (!peer || (peer.host === myIp && +peer.port === serverPort)) {
        peer = { port: seedPort, host: seedHost }
    }

    console.log("client trying to connect to " + peer.host + ":" + peer.port)
    var client = net.connect(peer.port, peer.host, function () {
        client.pipe(chat.createStream()).pipe(client)

        setTimeout(client.end.bind(client), 5000)
    })

    client.on("error", reconnect)
    client.on("end", reconnect)

    function reconnect() {
        client.removeAllListeners()

        setTimeout(connect, 1000)
    }
})()
