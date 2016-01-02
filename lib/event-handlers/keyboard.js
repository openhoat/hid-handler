'use strict';

var util = require('../util')
//, log = require('hw-logger').log
  , _ = require('lodash');

function KeyboardEvent() {
  if (this.constructor.super_) {
    this.constructor.super_.apply(this, arguments);
  }
}

KeyboardEvent.emptyDataBuffer = new Buffer(8).fill(0);

KeyboardEvent.prototype.isEmpty = function () {
  return !this.data.compare(KeyboardEvent.emptyDataBuffer);
};

KeyboardEvent.prototype.toString = function () {
  return [
    'modifiers: ' + this.modifiers.toString(2),
    'padding: ' + this.padding.toString(2),
    util.format('scancodes: [%s]', this.scancodes.map(function (scancode) {
      return scancode.toString(16);
    }).join(','))
  ].join(', ');
};

KeyboardEvent.prototype.parseData = function () {
  var that = this;
  that.modifiers = that.data.readInt8(0);
  that.padding = that.data.readInt8(1);
  that.scancodes = _.compact(_.map(Array(6), function (item, index) {
    return that.data.readInt8(index + 2);
  }));
};

KeyboardEvent.prototype.emit = function (sources) {
  var that = this;
  that.constructor.super_.prototype.emit.apply(that, arguments);
  sources.forEach(function (source) {
    source.emit('key', that);
  });
};

exports = module.exports = KeyboardEvent;