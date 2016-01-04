'use strict';

var util = require('../util')
  , log = require('hw-logger').log
  , _ = require('lodash');

function MouseEvent() {
  if (this.constructor.super_) {
    this.constructor.super_.apply(this, arguments);
  }
}

MouseEvent.prototype.toString = function () {
  var that = this;
  return [
    util.format('button: [%s]', that.button && _.compact([
        'left', 'right', 'middle', 'side', 'extra'
      ].map(function (key) {
        return _.get(that.button, key) && key;
      })).join(', ')
    ),
    util.format('wheel: [%s]', that.wheel && _.compact(['up', 'down'].map(function (key) {
        return _.get(that.wheel, key) && key;
      })).join(', ')
    ),
    util.format('move: [%s]', that.move && _.compact(['left', 'right', 'up', 'down'].map(function (key) {
        return _.get(that.move, key) && key;
      })).join(', ')
    )]
    .join(', ');
};

MouseEvent.prototype.parseData = function () {
  var that = this
    , data, moveX, moveY, events = {};
  log.warn('that.data :', that.data);
  that.button = {};
  that.wheel = {};
  that.move = {};
  data = that.data.toJSON().data;
  moveX = that.data.readInt8(1);
  moveY = that.data.readInt8(2);
  (function (buttonData) {
    events = {
      button: {
        left: util.hasBit(buttonData, 0),
        right: util.hasBit(buttonData, 1),
        middle: util.hasBit(buttonData, 2),
        side: util.hasBit(buttonData, 3),
        extra: util.hasBit(buttonData, 4)
      },
      wheel: {},
      move: {
        left: moveX < -10,
        right: moveX > 10,
        up: moveY < -10,
        down: moveY > 10
      }
    };
  })(data[0]);
  if (data[4] !== 0) {
    events.wheel[data[4] === 255 ? 'down' : 'up'] = true;
  }
  if (that.hid.lastEvents) {
    ['left', 'right', 'middle', 'side', 'extra'].forEach(function (key) {
      if (that.hid.lastEvents.button[key] && !events.button[key]) {
        that.button[key] = true;
      }
    });
    ['left', 'right', 'up', 'down'].forEach(function (key) {
      if (that.hid.lastEvents.move[key] !== events.move[key]) {
        that.move[key] = events.move[key];
      }
    });
  }
  ['down', 'up'].forEach(function (key) {
    if (events.wheel[key]) {
      that.wheel[key] = true;
    }
  });
  that.hid.lastEvents = events;
};

MouseEvent.prototype.emit = function (sources) {
  var that = this;
  this.constructor.super_.prototype.emit.apply(this, arguments);
  sources.forEach(function (source) {
    if (!util.isEmpty(that.button)) {
      source.emit('click', that);
    }
    if (!util.isEmpty(that.wheel)) {
      source.emit('wheel', that);
    }
    if (!util.isEmpty(that.move)) {
      source.emit('move', that);
    }
  });
};

exports = module.exports = MouseEvent;