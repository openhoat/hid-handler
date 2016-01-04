'use strict';

var util = require('../util')
//, log = require('hw-logger').log
  , _ = require('lodash');

function PresenterEvent() {
  if (this.constructor.super_) {
    this.constructor.super_.apply(this, arguments);
  }
}

PresenterEvent.prototype.toString = function () {
  var that = this;
  return [
    util.format('button: [%s]', that.button && _.compact([
        'left', 'right', 'volToggle', 'volUp', 'volDown'
      ].map(function (key) {
        return _.get(that.button, key) && key;
      })).join(', ')
    ),
    util.format('move: [%s]', that.move && _.compact(['left', 'right', 'up', 'down'].map(function (key) {
        return _.get(that.move, key) && key;
      })).join(', ')
    )]
    .join(', ');
};

PresenterEvent.prototype.parseData = function () {
  var that = this
    , mode;
  that.button = {};
  that.move = {};
  mode = that.data[0];
  switch (mode) {
    case 4:
      (function (buttonData) {
        _.extend(that.button, {
          left: util.hasBit(buttonData, 0),
          right: util.hasBit(buttonData, 1)
        });
      })(that.data[1]);
      (function (moveX, moveY) {
        _.extend(that.move, {
          left: moveX === 0xFF,
          right: moveX === 0x01,
          up: moveY === 0xFF,
          down: moveY === 0x01
        });
      })(that.data[2], that.data[3]);
      break;
    case 2:
      (function (buttonData) {
        _.extend(that.button, {
          volToggle: util.hasBit(buttonData, 2),
          volUp: util.hasBit(buttonData, 3),
          volDown: util.hasBit(buttonData, 4)
        });
      })(that.data[2]);
      break;
  }
};

PresenterEvent.prototype.emit = function (sources) {
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

exports = module.exports = PresenterEvent;