'use strict';

var util = require('../util')
  , _ = require('lodash');

function NumpadEvent() {
  if (this.constructor.super_) {
    this.constructor.super_.apply(this, arguments);
  }
}

NumpadEvent.emptyDataBuffer = new Buffer(8).fill(0);

NumpadEvent.prototype.isEmpty = function () {
  return !this.data.compare(NumpadEvent.emptyDataBuffer);
};

NumpadEvent.prototype.toString = function () {
  return [
    util.format('keycodes: [%s]', this.keycodes.map(function (keycode) {
      return keycode.toString(16);
    }).join(','))
  ].join(', ');
};

NumpadEvent.prototype.parseData = function () {
  var that = this
    , keycodes, diff;
  keycodes = _.compact(_.map(Array(6), function (item, index) {
    return that.data.readInt8(index + 2);
  }));
  if (that.hid.lastKeycodes && that.hid.lastKeycodes.length) {
    diff = _.difference(keycodes, that.hid.lastKeycodes);
    if (diff.length) {
      that.keycodes = diff;
    }
  } else {
    that.keycodes = keycodes;
  }
  that.hid.lastKeycodes = keycodes;
};

NumpadEvent.prototype.emit = function (sources) {
  var that = this;
  that.constructor.super_.prototype.emit.apply(this, arguments);
  sources.forEach(function (source) {
    source.emit('key', that);
  });
};

exports = module.exports = NumpadEvent;