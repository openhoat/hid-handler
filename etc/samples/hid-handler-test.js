'use strict';

var _ = require('lodash')
  , logger = require('hw-logger')
  , hidHandler = require('../../lib/hid-handler')
  , log = logger.log
  , supportedDevices;

supportedDevices = [{
  id: '192f_USB_Optical_Mouse',
  enabled: true,
  name: 'Digiposte mouse',
  type: 'mouse',
  vendorId: 0x192f,
  productId: 0x0416,
  actions: {
    buttonLeft: 'gnome-terminal --full-screen -t "Gulp" --window-with-profile=Hid --working-directory=/home/openhoat/Documents/LaPoste/PocOpenApi/projets/lp-apim -e "gulp lint"',
    buttonRight: 'gnome-terminal --full-screen -t "Gulp" --window-with-profile=Hid --working-directory=/home/openhoat/Documents/LaPoste/PocOpenApi/projets/lp-apim -e "gulp dredd/names"',
    wheelUp: 'pwd',
    wheelDown: 'exit'
  }
}, {
  id: '04f3_2.4G_Wireless_Touch_Pad',
  enabled: true,
  name: 'Simply touch pad',
  type: 'touchpad',
  vendorId: 0x04f3,
  productId: 0x0711,
  actions: {
    buttonLeft: 'ps',
    buttonRight: 'jobs'
  }
}, {
  id: 'Razer_Razer_1600dpi_3_button_optical_mouse',
  enabled: false,
  name: 'Razer mouse',
  vendorId: 0x1532,
  productId: 0x0003,
  actions: {
    buttonLeft: 'ps',
    buttonRight: 'jobs'
  }
}, {
  name: 'iSight mouse',
  enabled: false,
  vendorId: 0x0603,
  productId: 0x0002,
  actions: {
    buttonLeft: 'ps',
    buttonRight: 'jobs'
  }
}, {
  name: 'Microsoft Nano Transceiver',
  enabled: false,
  vendorId: 0x045e,
  productId: 0x0745,
  actions: {
    buttonLeft: 'ls -l',
    buttonRight: 'pwd'
  }
}, {
  id: 'Keypad_USB_Keypad',
  enabled: false,
  name: 'Essentiel num pad',
  type: 'keyboard',
  vendorId: 0x05a4,
  productId: 0x8001
}, {
  id: 'Apple__Inc_Apple_Keyboard',
  enabled: false,
  name: 'Apple aluminum keyboard',
  vendorId: 0x05ac,
  productId: 0x0221
}, {
  id: 'Microsoft_Comfort_Curve_Keyboard_2000',
  enabled: false,
  name: 'Microsoft comfort curve keyboard',
  type: 'keyboard',
  vendorId: 0x045e,
  productId: 0x00dd
}];

/*
 hidHandler.on('event', function (event) {
 log.info('event :', event.toString());
 });
 */

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