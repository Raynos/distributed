
var ms = require('..')
var through = require('through')
var en


function rechunk () {
  var soFar = ''
  return through(function (data) {
    var l = ~~(Math.random()*data.length)
    var _data = soFar + data.substring(0, l)
    soFar = data.substring(l)
    this.emit('data', _data)
  }, function () {
    if(soFar.length)
      this.emit('data', soFar)
    this.emit('end')
  })
}

;(en = ms.encode())
  .pipe(rechunk())
  .pipe(ms.decode())
  .on('data', function (d) {
    console.log('>>', d)
  })

en.write('hello')
en.write('world')
en.write('with')
en.write('descrete')
en.write('messages')
en.end()
