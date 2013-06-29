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
    var lastMessage = 0

    chat.send = function send(text) {
        chat.emit("message", { text: text, id: id, name: name, ts: Date.now() })
    }

    chat.createStream = function () {
        var stream = MessageStream(function (message) {
            if (message.ts > lastMessage) {
                chat.emit("message", message, stream)
            }
        })

        chat.on("message", function (message, source) {
            if (source !== stream) stream.queue(message)
        })

        return stream
    }

    chat.on("message", function (message) {
        lastMessage = message.ts

        console.log(message.name, ">", message.text)
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

;(function connect() {
    console.log("client trying to connect to " + clientHost + ":" + clientPort)
    var client = net.connect(clientPort, clientHost, function () {
        client.pipe(chat.createStream()).pipe(client)
    })

    client.on("error", reconnect)
    client.on("end", reconnect)

    function reconnect() {
        client.removeAllListeners()

        setTimeout(connect, 1000)
    }
})()
