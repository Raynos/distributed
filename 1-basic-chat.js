var MessageStream = require("message-stream")
var net = require("net")
var argv = require("optimist").argv
var EventEmitter = require("events").EventEmitter

var port = argv.port || 2503
var myIp = require("my-local-ip")()
var id = id + ":" + port
var host = argv.host || myIp

var name = argv.name || "Anonymous"

function Messages() {
    var messages = new EventEmitter()
    messages.send = function (text) {
        messages.emit("message", {
            text: text,
            name: name,
            id: id,
            time: Date.now()
        })
    }
    messages.receive = function (message, source) {
        console.log(message.name + " > " + message.text)

        messages.emit("message", message, source)
    }
    messages.createStream = function () {
        var stream = MessageStream(function (message) {
            messages.receive(message, stream)
        })

        messages.on("message", function (message, source) {
            if (source !== stream) {
                stream.queue(message)
            }
        })

        return stream
    }

    return messages
}

var messages = Messages()
process.stdin.on("data", function (text) {
    messages.send(String(text))
})

if (argv.server) {
    var server = net.createServer(function (stream) {
        stream.pipe(messages.createStream()).pipe(stream)
    })

    server.listen(port)
    console.log("Started server on port", port)
} else {
    var client = net.connect(port, host)

    client.pipe(messages.createStream()).pipe(client)
    console.log("Connected to server on port", port)
}
