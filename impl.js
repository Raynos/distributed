var net = require("net")
var EventEmitter = require("events").EventEmitter
var opts = require("optimist").argv
var MessageStream = require("message-stream")

var myIp = require("my-local-ip")()
var clientPort = opts.port
var serverPort = opts.server
var clientHost = opts.clientHost || myIp

function Chat(id, name) {
    var chat = new EventEmitter()
    chat.setMaxListeners(Infinity)

    var lastMessageTimestamp = 0
    var clock = {}
    var history = []

    chat.send = function (text) {
        chat.emit("message", {
            ts: Date.now(),
            id: id,
            name: name,
            text: text
        })
    }

    var seen = function (clock, message) {
        return message.ts <= clock[message.id]
    }

    chat.createStream = function () {
        var stream = MessageStream(function (message) {
            if (typeof message.clock) {
                history.forEach(function (mes) {
                    if (!seen(message.clock, mes)) {
                        stream.queue(mes)
                    }
                })
            } else if (!seen(clock,  message)) {
                chat.emit("message", message, stream)
            }
        })

        chat.on("message", function (message, source) {
            if (stream !== source) stream.queue(message)
        })

        stream.queue({ clock: clock })
        // stream.queue({ since: lastMessageTimestamp })

        return stream
    }

    chat.on("message", function (message) {
        lastMessageTimestamp = message.ts
        clock[message.id] = message.ts

        if (message.text) {
            history.push(message)
            console.log(message.name, "[", message.id,
                "]>", message.text)
        }
    })

    return chat
}

var chat = Chat(myIp + ":" + serverPort, opts.name || "Anonymous")

process.stdin.on("data", function (buffer) {
    chat.send(buffer.toString())
})
process.stdin.resume()

net.createServer(function (stream) {
    stream.pipe(chat.createStream()).pipe(stream)
}).listen(serverPort, myIp)
console.log("started server on", serverPort, myIp)

var connect = function () {
    var client = net.connect(clientPort, clientHost)
    client.pipe(chat.createStream()).pipe(client)
    console.log("trying to connect to", clientPort, clientHost)

    var reconnect = function () {
        client.removeAllListeners()
        setTimeout(connect, 1000)
    }

    client.on("error", reconnect)
    client.on("end", reconnect)
}

connect()





