var net = require("net")
var EventEmitter = require("events").EventEmitter
var opts = require("optimist").argv
var MessageStream = require("message-stream")

// for client mode call me like
// node chat.js --name=MY_CLIENT_NAME --port=9000 --host=10.0.1.30

// for server mode call me like
// node chat.js --name=MY_SERVER_NAME --server=MY_PORT

// host to listen on for local server
var myIp = require("my-local-ip")()
// port to connect to as a client
var clientPort = opts.port || 9000
// port ot listen on for local server
var serverPort = opts.server || 9000
// host to connect to as a client
var clientHost = opts.host || myIp

// Chat object. Maintains and shares chats with other peers
function Chat(ipPort, name) {
    var chat = new EventEmitter()
    chat.setMaxListeners(Infinity)

    // method to send local chats used from process.stdin
    chat.send = function (text) {
        chat.emit("message", {
            ts: Date.now(),
            id: myIp + ':' + process.pid,
            name: name,
            text: text
        })
    }

    // render each chat message to console
    chat.on("message", function (message) {
        console.log(message.name, "[", message.id, "]>", message.text)
    })

    // create a stream to share chat messages
    chat.createStream = function () {
        var stream = MessageStream(function (message) {
            // incoming messages
            // IMPLEMENT ME
        })

        chat.on('message', function (message, source) {
          // send messages like this
          // stream.send(message)
        })

        return stream
    }

    return chat
}

var chat = Chat(myIp + ":" + serverPort, opts.name || "Anonymous")
console.log("my program id is", myIp + ":" + serverPort)

// handle user input from terminal
process.stdin.on("data", function (buffer) {
    chat.send(buffer.toString())
})

//you need this if you are using node 0.8
process.stdin.resume()

// share chats over TCP server
var server = net.createServer(function (stream) {
    stream.pipe(chat.createStream()).pipe(stream)
}).listen(serverPort)

function createClient() {
  var client = net.connect(clientPort, clientHost)
  client.pipe(chat.createStream()).pipe(client)
  console.log("trying to connect to", clientPort, clientHost)
}

// connect to server and share chats
server.on('listening', function () {
  console.log("started server on", serverPort, myIp)
  if(clientHost !== myIp)
    createClient()
}).on('error', function (error) {
  if(error.code === 'EADDRINUSE') {
    console.log('connecting to main server '+myIp+':'+serverPort)
    createClient()
  } else
    throw error
})
