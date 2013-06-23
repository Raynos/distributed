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
    chat.send = function send(text) {
        chat.emit("message", { text: text, id: id, name: name, ts: Date.now() })
    }

    chat.createStream = function () {
        var stream = MessageStream(function (message) {
            chat.emit("message", message, stream)
        })

        chat.on("message", function (message, source) {
            if (source !== stream) stream.queue(message)
        })

        return stream
    }

    chat.on("message", function (message) {
        console.log(message.name, ">", message.text)
    })

    return chat
}

var chat = Chat(myIp + ":" + serverPort, opts.name || "Anon")
process.stdin.on("data", function (buf) {
    chat.send(buf.toString())
})

if (opts.server) {
    net.createServer(function (stream) {
        stream.pipe(chat.createStream()).pipe(stream)
    }).listen(serverPort, myIp)
    console.log("server listening on " + myIp + ":" + serverPort)
} else {
    var client = net.connect(clientPort, clientHost)
    client.pipe(chat.createStream()).pipe(client)
    console.log("client connecting to " + clientHost + ":" + clientPort)
}
