var net = require("net")
var EventEmitter = require("events").EventEmitter
var opts = require("optimist").argv
var MessageStream = require("message-stream")

// for client mode call me like
// node chat.js --port=8000 --host=10.0.1.30

// for server mode call me like
// node chat.js --server=MY_PORT

// host to listen on for local server
var myIp = require("my-local-ip")()
// port to connect to as a client
var clientPort = opts.port
// port ot listen on for local server
var serverPort = opts.server || 8000
// host to connect to as a client
var clientHost = opts.clientHost || myIp

// Chat object. Maintains and shares chats with other peers
function Chat(id, name) {
    var chat = new EventEmitter()
    chat.setMaxListeners(Infinity)

    // method to send local chats used from process.stdin
    chat.send = function (text) {
        chat.emit("message", {
            ts: Date.now(),
            id: id,
            name: name,
            text: text
        })
    }

    // create a stream to share chat messages
    chat.createStream = function () {
        var stream = MessageStream(function () {
            // IMPLEMENT ME
        })

        return stream
    }

    // render each chat message to console
    chat.on("message", function (message) {
        if (message.text) {
            console.log(message.name, "[", message.id, "]>", message.text)
        }
    })

    return chat
}

var chat = Chat(myIp + ":" + serverPort, opts.name || "Anonymous")
console.log("my program id is", myIp + ":" + serverPort)

// handle user input
process.stdin.on("data", function (buffer) {
    chat.send(buffer.toString())
})
process.stdin.resume()

if (opts.server) {
    // share chats over TCP server
    net.createServer(function (stream) {
        stream.pipe(chat.createStream()).pipe(stream)
    }).listen(serverPort, myIp)
    console.log("started server on", serverPort, myIp)
} else {
    // connect to server and share chats
    var client = net.connect(clientPort, clientHost)
    client.pipe(chat.createStream()).pipe(client)
    console.log("trying to connect to", clientPort, clientHost)
}
