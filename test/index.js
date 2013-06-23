var test = require("tape")

var distributed = require("../index")

test("distributed is a function", function (assert) {
    assert.equal(typeof distributed, "function")
    assert.end()
})
