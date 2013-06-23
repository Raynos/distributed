var MessageStream = require("message-stream")
var net = require("net")
var argv = require("optimist").argv
var EventEmitter = require("events").EventEmitter

// port needed for connection
var port = argv.port || 2503
var myIp = require("my-local-ip")()
// id needed for per client identity
var id = id + ":" + port
var host = argv.host || myIp

// name purely for pretty-ness
var name = argv.name || "Anonymous"

function Chat() {
    // Each node needs a messages thing
    var chat = new EventEmitter()

    chat.history = []

    // We should be able to send messages locally
    chat.send = function (text) {
        chat.emit("message", {
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
            messages.receive(message, stream)
        })

        chat.on("message", function (message, source) {
            if (source !== stream) {
                stream.queue(message)
            }
        })

        return stream
    }

    // we should be able to receive messages from a network
    chat.receive = function (message, source) {
        messages.emit("message", message, source)
    }

    // print each message
    chat.on("message", function (message) {
        chat.history.push(message)
        console.log(message.name + " > " + message.text)
    })

    //get the lastest message we know.

    return chat
}

var chat = Chat()
process.stdin.on("data", function (text) {
    chat.send(String(text))
})

if (argv.server) {
    var server = net.createServer(function (stream) {
        stream.pipe(chat.createStream()).pipe(stream)
    })

    server.listen(port)
    console.log("Started server on port", port)
} else {
    (function connect () {
        console.log('Attempt connection to:', host+':'+port)
        var client = net.connect(port, host, function () {
            client.pipe(chat.createStream()).pipe(client)
            console.log("Connected to server on port", port)
        })

        client.once('error', reconnect)
        client.once('end', reconnect) 

        function reconnect () {
          setTimeout(function () {
            connect()
          }, 1000)
        }
    })()
}
