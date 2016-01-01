'use strict';

var util = require('../util')
  , _ = require('lodash');

function TouchpadEvent() {
  if (this.constructor.super_) {
    this.constructor.super_.apply(this, arguments);
  }
}

TouchpadEvent.prototype.toString = function () {
  var that = this;
  return [
    util.format('button: [%s]', that.button && _.compact(['left', 'right'].map(function (key) {
        return _.get(that.button, key) && key;
      })).join(', ')
    ),
    util.format('move: [%s]', that.move && _.compact(['left', 'right', 'up', 'down'].map(function (key) {
        return _.get(that.move, key) && key;
      })).join(', ')
    )]
    .join(', ');
};

TouchpadEvent.prototype.parseData = function () {
  var that = this
    , data, moveX, moveY, events = {};
  that.button = {};
  that.move = {};
  data = that.data.toJSON().data;
  moveX = that.data.readInt8(2);
  moveY = that.data.readInt8(3);
  (function (buttonData) {
    events = {
      button: {
        left: util.hasBit(buttonData, 0),
        right: util.hasBit(buttonData, 1)
      },
      move: {
        left: moveX < -3,
        right: moveX > 3,
        up: moveY < -3,
        down: moveY > 3
      }
    };
  })(data[1]);
  if (that.hid.lastEvents) {
    ['left', 'right'].forEach(function (key) {
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
  that.hid.lastEvents = events;
};

TouchpadEvent.prototype.emit = function (sources) {
  var that = this;
  this.constructor.super_.prototype.emit.apply(this, arguments);
  sources.forEach(function (source) {
    if (!util.isEmpty(that.button)) {
      source.emit('click', that);
    }
    if (!util.isEmpty(that.move)) {
      source.emit('move', that);
    }
  });
};

exports = module.exports = TouchpadEvent;