'use strict';

var util = require('../util')
  , keyLayouts = require('../key-layouts')
  , _ = require('lodash');
//, log = require('hw-logger').log;

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
  var that = this;
  return _.compact([
    util.format('scancodes: [%s]', that.scancodes ? that.scancodes.map(function (scancode) {
      return scancode.toString(16);
    }) : [].join(',')),
    that.keycodes && util.format('keycodes: [%s]', that.keycodes.join(','))
  ]).join(', ');
};

NumpadEvent.prototype.parseData = function () {
  var that = this
    , scancodes, diff, layout;
  scancodes = _.compact(_.map(Array(6), function (item, index) {
    return that.data.readInt8(index + 2);
  }));
  if (that.hid.lastScancodes && that.hid.lastScancodes.length) {
    diff = _.difference(scancodes, that.hid.lastScancodes);
    if (diff.length) {
      that.scancodes = diff;
    }
  } else {
    that.scancodes = scancodes;
  }
  that.hid.lastScancodes = scancodes;
  if (that.scancodes && that.scancodes.length) {
    layout = that.hid.device.type[that.ifaceIndex] || 'numpad';
    that.keycodes = that.scancodes.map(function (scancode) {
      return keyLayouts.getLayoutKeycode(layout, scancode);
    });
  }
};

NumpadEvent.prototype.emit = function (sources) {
  var that = this;
  that.constructor.super_.prototype.emit.apply(this, arguments);
  sources.forEach(function (source) {
    source.emit('key', that);
  });
};

exports = module.exports = NumpadEvent;