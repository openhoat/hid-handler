'use strict';

var util = require('../util')
//, log = require('hw-logger').log
  , keyLayouts = require('../key-layouts')
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
  var that = this;
  return _.compact([
    util.format('modifiers: [%s]', that.modifiers.join('+')),
    'padding: ' + that.padding.toString(2),
    util.format('scancodes: [%s]', that.scancodes.map(function (scancode) {
      return scancode.toString(16);
    }).join(',')),
    that.keycodes && util.format('keycodes: [%s]', that.keycodes.join(','))
  ]).join(', ');
};

KeyboardEvent.prototype.parseData = function () {
  var that = this
    , modifiers, layout;
  that.modifiers = [];
  modifiers = that.data.readInt8(0);
  ['left-ctrl', 'left-shift', 'left-alt', 'left-super', 'right-ctrl', 'right-shift', 'right-alt', 'right-super', 'e'].forEach(function (modifierLabel, index) {
    /* jshint -W016: true */
    if (modifiers & Math.pow(2, index)) {
      that.modifiers.push(modifierLabel);
    }
  });
  that.padding = that.data.readInt8(1);
  if (that.data.length > 2) {
    that.scancodes = _.compact(_.map(Array(that.data.length - 2), function (item, index) {
      return that.data.readInt8(index + 2);
    }));
    layout = that.hid.device.type[that.ifaceIndex];
    that.keycodes = that.scancodes.map(function (scancode) {
      return keyLayouts.getLayoutKeycode(layout, scancode, that.modifiers);
    });
  }
};

KeyboardEvent.prototype.emit = function (sources) {
  var that = this;
  that.constructor.super_.prototype.emit.apply(that, arguments);
  sources.forEach(function (source) {
    source.emit('key', that);
  });
};

exports = module.exports = KeyboardEvent;