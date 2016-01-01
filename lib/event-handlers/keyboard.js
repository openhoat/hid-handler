'use strict';

var util = require('../util')
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
    util.format('keycodes: [%s]', this.keycodes.map(function (keycode) {
      return keycode.toString(16);
    }).join(','))
  ].join(', ');
};

KeyboardEvent.prototype.parseData = function () {
  var that = this;
  that.modifiers = that.data.readInt8(0);
  that.padding = that.data.readInt8(1),
    this.keycodes = _.compact(_.map(Array(6), function (item, index) {
      return that.data.readInt8(index + 2);
    }));
};

KeyboardEvent.prototype.emit = function (sources) {
  var that = this;
  this.constructor.super_.prototype.emit.apply(this, arguments);
  sources.forEach(function (source) {
    source.emit('key', that);
  });
};

exports = module.exports = KeyboardEvent;