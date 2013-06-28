# message-stream

duplex stream of messages (with minimal edgecases!).

<img src=https://secure.travis-ci.org/'Dominic Tarr'/message-stream.png?branch=master>

## example

chat example that broadcasts messages, but does not echo them!

``` js
var net = require('net')
var MessageStream = require('message-stream')
var chat = new (require('events').EventEmitter)()

chat.createStream = function () {
  var ms = MessageStream(function (data) {
    chat.emit('message', data, ms)
  })
  chat.on('message', function (data, source) {
    if(source != ms)
      ms.queue(data)
  })
}

if(opts.server) {
  net.createServer(function (stream) {
    stream.pipe(chat.createStream()).pipe(stream)
  })
  .listen(opts.port)
}
else {
  var stream = net.connect(opts.port)
  stream.pipe(chat.createServer()).pipe(stream)
}
```

## License

MIT
