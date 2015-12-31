'use strict';

var legacyUtil = require('util')
  , fs = require('fs')
  , childProcess = require('child_process')
  , p = require('hw-promise')
  , assert = require('assert')
  , HID = require(process.env.TRAVIS ? './fake/node-hid' : 'node-hid')
  , logger = require('hw-logger')
  , log = logger.log
  , _ = require('lodash')
  , util;

p.promisifyAll(fs);

util = {
  getDevicekey: function (vendorId, productId) {
    var deviceKey;
    if (typeof productId === 'undefined' && typeof vendorId === 'object') {
      (function (device) {
        vendorId = device.vendorId;
        productId = device.productId;
      })(vendorId);
    }
    assert.ok(vendorId, 'vendorId is not ok');
    assert.ok(productId, 'productId is not ok');
    deviceKey = {
      vendorId: _.padLeft(vendorId.toString(16), 4, '0'),
      productId: _.padLeft(productId.toString(16), 4, '0')
    };
    deviceKey.toString = function () {
      return [this.vendorId, this.productId].join(':');
    };
    return deviceKey;
  },
  getDeviceInfos: function (vendorId, productId, cb) {
    var deviceKey, lsusb, out, err, deviceInfos;
    return new p(
      function (resolve, reject) {
        deviceKey = util.getDevicekey(vendorId, productId);
        deviceInfos = {};
        lsusb = childProcess.spawn('lsusb', ['-d', deviceKey]);
        lsusb.stdout.on('data', function (data) {
          out = (out || '') + data.toString();
        });
        lsusb.stderr.on('data', function (data) {
          err = (err || '') + data.toString();
        });
        lsusb.on('close', function (code) {
          var match, error;
          if (code !== 0 || err) {
            error = new Error(util.format('device "%s" not found', deviceKey));
            error.code = code;
            if (err) {
              error.error = err;
            }
            return reject(error);
          }
          match = _.first(out.split('\n')).match(new RegExp(util.format('^Bus ([\\S]+) Device ([\\S]+): ID %s (.*)$', deviceKey)));
          if (match) {
            deviceInfos = {
              bus: match[1],
              device: match[2],
              manufacturer: match[3]
            };
            deviceInfos.devPath = util.format('/dev/bus/usb/%s/%s', deviceInfos.bus, deviceInfos.device);
          } else {
            deviceInfos = null;
          }
          resolve(deviceInfos);
        });
      })
      .nodeify(cb);
  },
  getUserHome: function () {
    return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
  },
  hasBit: function (value, bit) {
    /* jshint -W016: true */
    return !!(value & Math.pow(2, bit));
  },
  isEmpty: function (o) {
    if (Array.isArray(o) || typeof o === 'string') {
      return o.length === 0;
    } else if (typeof o === 'object') {
      return Object.keys(o).length === 0 || _.compact(_.values(o)).length === 0;
    } else {
      return !o;
    }
  },
  logArgs: function () {
    log.debug('args :', arguments);
  },
  logObject: function (o) {
    return util.inspect(o, {depth: null});
  },
  scanDevices: function () {
    return HID.devices();
  }
};

Object.keys(legacyUtil).forEach(function (key) {
  if (typeof legacyUtil[key] === 'function' && typeof util[key] === 'undefined') {
    util[key] = legacyUtil[key].bind(legacyUtil);
  }
});

exports = module.exports = util;