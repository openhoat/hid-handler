'use strict';

var _ = require('lodash')
  , util = require('../util');
//, log = require('hw-logger').log;

function GenericEvent(hid, ifaceIndex, inEndpointIndex, data) {
  var match;
  match = this.constructor.name.match(/(.*)Event$/);
  Object.defineProperties(this, {
    ifaceIndex: {
      value: ifaceIndex,
      enumerable: true
    },
    inEndpointIndex: {
      value: inEndpointIndex,
      enumerable: true
    },
    deviceType: {
      value: _.get(hid, util.format('device.type[%s]', ifaceIndex)),
      enumerable: true
    },
    hid: {
      value: hid,
      enumerable: true
    },
    data: {
      value: data,
      enumerable: true
    }
  });
  if (data && typeof this.parseData === 'function') {
    this.parseData(data);
  }
}

GenericEvent.prototype.toString = function () {
  return [
    'device type: ' + this.deviceType,
    'data: ' + util.inspect(this.data)
  ].join(', ');
};

GenericEvent.prototype.emit = function (sources) {
  var that = this;
  sources.forEach(function (source) {
    source.emit('event', that);
  });
};

exports = module.exports = GenericEvent;