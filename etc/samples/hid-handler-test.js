'use strict';

var _ = require('lodash')
  , logger = require('hw-logger')
  , hidHandler = require('../../lib/hid-handler')
  , log = logger.log
  , supportedDevices;

supportedDevices = [{
  name: 'Digiposte mouse',
  enabled: true,
  type: 'mouse',
  vendorId: 0x192f,
  productId: 0x0416
}, {
  name: 'Simply touch pad',
  enabled: true,
  type: {1: 'touchpad'},
  vendorId: 0x04f3,
  productId: 0x0711
}, {
  name: 'Essentiel num pad',
  enabled: true,
  type: 'numpad',
  vendorId: 0x05a4,
  productId: 0x8001
}, {
  name: 'Apple aluminum keyboard',
  enabled: false,
  type: 'keyboard',
  vendorId: 0x05ac,
  productId: 0x0221
}, {
  name: 'Microsoft comfort curve keyboard',
  enabled: true,
  type: 'keyboard',
  vendorId: 0x045e,
  productId: 0x00dd
}];

hidHandler.on('event', function (event) {
  log.info('event :', event.toString());
});

hidHandler.on('key', function (event) {
  log.info('key event :', event.toString());
});

hidHandler.on('click', function (event) {
  log.info('click event :', event.toString());
});

hidHandler.on('wheel', function (event) {
  log.info('wheel event :', event.toString());
});

hidHandler.on('move', function (event) {
  log.info('move event :', event.toString());
});

hidHandler.init({
  supportedDevices: _.filter(supportedDevices, function (device) {
    return typeof device.enabled === 'undefined' || !!device.enabled;
  })
});

process.on('SIGINT', function () {
  hidHandler.stop();
});

hidHandler.start();