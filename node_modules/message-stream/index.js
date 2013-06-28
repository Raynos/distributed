var duplex = require('duplex')
var serializer = require('stream-serializer')()

module.exports = function (onMessage, onEnd) {

  var d = duplex()
    .on('_data', function (data) {
      d.emit('message', data)
    })
    .on('_end', function () {
      this._end()
    })

  if(onMessage)
    d.on('message', onMessage)

  d.send = d.queue = function (data) {
    return this._data(data)
  }

  return serializer(d)
}
