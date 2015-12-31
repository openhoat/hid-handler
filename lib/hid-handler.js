'use strict';

var _ = require('lodash')
  , usb = require(process.env.TRAVIS ? './fake/usb' : 'usb')
  , p = require('hw-promise')
  , logger = require('hw-logger')
  , hwError = require('hw-error')
  , events = require('events')
  , eventHandlers = require('./event-handlers')
  , util = require('./util')
  , log = logger.log
  , hidHandler;

hwError.initErrors([
  {
    constructor: function HidHandlerError(code) {
      this.code = code;
    }
  }, {
    constructor: function HidAlreadyRegisteredError(deviceKey) {
      this.deviceKey = deviceKey;
    },
    parent: 'HidHandlerError'
  }, {
    constructor: function HidEventHandlerNameError(eventHandlerName) {
      this.eventHandlerName = eventHandlerName;
    },
    parent: 'HidHandlerError'
  }
]);

hidHandler = _.extend(new events.EventEmitter(), {
  registeredHids: {},
  getRegisteredHid: function (vendorId, productId) {
    var deviceKey;
    if (typeof productId === 'undefined' && typeof vendorId === 'string') {
      deviceKey = vendorId;
    } else {
      deviceKey = util.getDevicekey(vendorId, productId);
    }
    return hidHandler.registeredHids[deviceKey];
  },
  getSupportedDevice: function (vendorId, productId) {
    var that = hidHandler;
    return _.first(_.filter(that.supportedDevices, function (supportedDevice) {
      return supportedDevice.vendorId === vendorId && supportedDevice.productId === productId;
    }));
  },
  handleEndpointData: function (data) {
    var hid = this
      , eventClassName, eventClass, event;
    eventClassName = util.format('%sEvent', _.capitalize(_.camelCase(hid.device.type)));
    eventClass = hidHandler[eventClassName] || hidHandler.GenericEvent;
    event = new eventClass(hid, data);
    event.emit([hidHandler, hid.ee]);
  },
  handleEndpointError: function (err) {
    var hid = this;
    if (err.errno === usb.LIBUSB_ERROR_NO_DEVICE) {
      log.warn(err);
      hidHandler.unregisterHid(hid);
      hid.device.reset();
      return;
    }
    logger.enabledLevels.warn && log.warn('error received :', err);
    if (hid.device) {
      hid.device.reset();
    }
  },
  handleEndpointEnd: function () {
    var hid = this;
    logger.enabledLevels.debug && log.debug('endpoint end.');
    hid.endpoint.removeListener('data', hidHandler.handleEndpointData);
    hid.endpoint.removeListener('error', hidHandler.handleEndpointError);
    hid.endpoint.removeListener('end', hidHandler.handleEndpointEnd);
  },
  handleUsbAttach: function (device) {
    var that = hidHandler
      , deviceKey, supportedDevice, deviceType;
    deviceKey = util.getDevicekey(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct);
    logger.enabledLevels.debug && log.debug('detected new attached device "%s"', deviceKey);
    if (that.supportedDevices && that.supportedDevices.length) {
      supportedDevice = that.getSupportedDevice(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct);
    }
    if (!supportedDevice) {
      logger.enabledLevels.debug && log.debug('attached device "%s" is not supported : ignore', deviceKey);
      return;
    }
    logger.enabledLevels.debug && log.debug('register attached device "%s"', deviceKey);
    deviceType = supportedDevice.type || 'generic';
    hidHandler.registerHid(deviceType, device);
  },
  handleUsbDetach: function (device) {
    var that = hidHandler
      , deviceKey, hid;
    deviceKey = util.getDevicekey(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct);
    logger.enabledLevels.debug && log.debug('detected new detached device "%s"', deviceKey);
    if (that.supportedDevices && that.supportedDevices.length && !that.getSupportedDevice(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct)) {
      logger.enabledLevels.debug && log.debug('detached device "%s" is not supported : ignore', deviceKey);
      return;
    }
    hid = that.getRegisteredHid(deviceKey);
    if (!hid) {
      logger.enabledLevels.debug && log.debug('detached device "%s" is not registered : ignore', deviceKey);
      return;
    }
    logger.enabledLevels.debug && log.debug('unregister detached device "%s"', deviceKey);
    hidHandler.unregisterHid(hid);
  },
  registerEventHandler: function (eventHandler) {
    var key = eventHandler.name;
    if (hidHandler.hasOwnProperty(key)) {
      throw new hidHandler.HidEventHandlerNameError(key);
    }
    hidHandler[key] = eventHandler;
  },
  registerHid: function (deviceType, device, cb) {
    var that = hidHandler
      , deviceKey, hid;
    deviceKey = util.getDevicekey(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct);
    logger.enabledLevels.debug && log.debug('register hid device "%s"', deviceKey);
    logger.enabledLevels.trace && log.trace('device :', util.logObject(device));
    return p.do(
      function checkAlreadyRegistered() {
        if (that.getRegisteredHid(deviceKey)) {
          throw new hidHandler.HidAlreadyRegisteredError(deviceKey);
        }
      },
      function initHid() {
        hid = {
          deviceKey: deviceKey,
          device: device
        };
        hid.device.type = deviceType;
      },
      function openDevice() {
        logger.enabledLevels.debug && log.debug('open device "%s"', hid.deviceKey);
        device.open();
      },
      function claimInterface() {
        var interfaceIndex;
        logger.enabledLevels.debug && log.debug('get first interface of device "%s"', hid.deviceKey);
        logger.enabledLevels.trace && log.trace('device has %s interfaces :', hid.device.interfaces.length, util.logObject(hid.device.interfaces));
        //fs.writeFileSync(path.join(__dirname, '..', 'tmp', '0.log'), util.inspect(hid.device.interface(0)));
        //fs.writeFileSync(path.join(__dirname, '..', 'tmp', '1.log'), util.inspect(hid.device.interface(1)));
        interfaceIndex = hid.device.interfaces.length - 1;
        hid.interface = hid.device.interface(interfaceIndex);
        if (!hid.interface) {
          logger.enabledLevels.warn && log.warn('no interface for device "%s"', hid.deviceKey);
          throw new hidHandler.HidHandlerError({code: 'NO_INTERFACE'});
        }
        logger.enabledLevels.trace && log.trace('registered device interface :', util.logObject(hid.interface));
        if (hid.interface.isKernelDriverActive()) {
          logger.enabledLevels.debug && log.debug('detach interface of device "%s" from kernel', hid.deviceKey);
          hid.interface.detachKernelDriver();
        }
        logger.enabledLevels.debug && log.debug('claim interface of device "%s"', hid.deviceKey);
        hid.interface.claim();
      },
      function handleEndpoint() {
        logger.enabledLevels.debug && log.debug('searching "in" endpoint of device "%s"', hid.deviceKey);
        logger.enabledLevels.trace && log.trace('device interface has %s endpoints :', hid.interface.endpoints.length, util.logObject(hid.interface.endpoints));
        hid.endpoint = _.first(_.filter(hid.interface.endpoints, function (endpoint) {
          return endpoint.direction === 'in';
        }));
        if (!hid.endpoint) {
          logger.enabledLevels.warn && log.warn('no "in" endpoint for device "%s"', hid.deviceKey);
          throw new hidHandler.HidHandlerError({code: 'NO_IN_ENDPOINT'});
        }
        logger.enabledLevels.trace && log.trace('registered endpoint :', util.logObject(hid.endpoint));
        logger.enabledLevels.debug && log.debug('register endpoint listeners');
        hid.endpoint.on('data', hidHandler.handleEndpointData.bind(hid));
        hid.endpoint.on('error', hidHandler.handleEndpointError.bind(hid));
        hid.endpoint.on('end', hidHandler.handleEndpointEnd.bind(hid));
        logger.enabledLevels.debug && log.debug('start endpoint polling');
        hid.endpoint.startPoll();
      },
      function registerNewHid() {
        hid.ee = new events.EventEmitter();
        hidHandler.registeredHids[hid.deviceKey] = hid;
      })
      .catch(hidHandler.HidAlreadyRegisteredError, function (err) {
        logger.enabledLevels.debug && log.debug('device "%s" already registered : ignore', err.deviceKey);
      })
      .nodeify(cb);
  },
  unregisterHid: function (hid, cb) {
    logger.enabledLevels.debug && log.debug('unregister hid device "%s"', hid.deviceKey);
    return p.do(
      function emitHidEnd() {
        hid.ee.emit('end');
        hid.ee.removeAllListeners();
      },
      function stopEndpoint() {
        if (!hid.endpoint || !hid.endpoint.pollActive) {
          return;
        }
        logger.enabledLevels.debug && log.debug('stopping endpoint polling of device "%s"', hid.deviceKey);
        return p.fromNode(hid.endpoint.stopPoll.bind(hid.endpoint))
          .then(function () {
            logger.enabledLevels.debug && log.debug('endpoint polling stopped for device "%s"', hid.deviceKey);
          });
      },
      function releaseInterface() {
        if (!hid.interface) {
          return;
        }
        logger.enabledLevels.debug && log.debug('release interface of device "%s"', hid.deviceKey);
        return p.fromNode(hid.interface.release.bind(hid.interface))
          .then(function () {
            logger.enabledLevels.debug && log.debug('interface released for device "%s"', hid.deviceKey);
            if (!hid.interface.isKernelDriverActive()) {
              logger.enabledLevels.debug && log.debug('reattach interface of device "%s" from kernel', hid.deviceKey);
              hid.interface.attachKernelDriver();
            }
          })
          .catch(function (err) {
            if (err.errno !== usb.LIBUSB_ERROR_NO_DEVICE) {
              throw err;
            }
          });
      })
      .finally(function () {
        if (hid.device) {
          logger.enabledLevels.debug && log.debug('close device "%s"', hid.deviceKey);
          hid.device.close();
        }
        logger.enabledLevels.debug && log.debug('remove device "%s" from registered', hid.deviceKey);
        delete hidHandler.registeredHids[hid.deviceKey];
      })
      .nodeify(cb);
  },
  init: function (opt) {
    var that = hidHandler;
    opt = opt || {};
    that.supportedDevices = opt.supportedDevices;
    that.initialized = true;
  },
  start: function (opt, cb) {
    var that = hidHandler;
    if (typeof cb === 'undefined' && typeof opt === 'function') {
      cb = opt;
      opt = null;
    }
    logger.enabledLevels.debug && log.debug('start hid handler');
    return p.do(
      function init() {
        if (!that.initialized) {
          that.init(opt);
        }
        logger.enabledLevels.debug && log.debug('register usb listeners');
        usb.on('attach', hidHandler.handleUsbAttach);
        usb.on('detach', hidHandler.handleUsbDetach);
      },
      function registerDevices() {
        var supportedDevices;
        logger.enabledLevels.debug && log.debug('check supported devices');
        supportedDevices = that.supportedDevices || _.map(usb.getDeviceList(), function (value) {
            return {
              vendorId: value.deviceDescriptor.idVendor,
              productId: value.deviceDescriptor.idProduct,
              type: 'generic'
            };
          });
        logger.enabledLevels.debug && log.debug('init devices');
        return p.each(_.values(supportedDevices),
          function (supportedDevice) {
            var deviceKey, device, deviceType;
            deviceKey = util.getDevicekey(supportedDevice.vendorId, supportedDevice.productId);
            logger.enabledLevels.debug && log.debug('searching usb device from "%s"', deviceKey);
            device = usb.findByIds(supportedDevice.vendorId, supportedDevice.productId);
            if (!device) {
              logger.enabledLevels.warn && log.warn('no usb device matching "%s"', deviceKey);
              return;
            }
            deviceType = supportedDevice.type || 'generic';
            logger.enabledLevels.debug && log.debug('found %s usb device matching "%s"', deviceType, deviceKey);
            return hidHandler.registerHid(deviceType, device);
          });
      })
      .nodeify(cb);
  },
  stop: function (cb) {
    logger.enabledLevels.debug && log.debug('stop hid handler');
    return p.do(
      function () {
        logger.enabledLevels.debug && log.debug('stop hid handler');
        return p.map(_.values(hidHandler.registeredHids), function (hid) {
          log.debug('hid :', hid);
          return hidHandler.unregisterHid(hid);
        });
      },
      function removeListeners() {
        logger.enabledLevels.debug && log.debug('remove listeners');
        usb.removeListener('attach', hidHandler.handleUsbAttach);
        usb.removeListener('detach', hidHandler.handleUsbDetach);
        hidHandler.removeAllListeners();
      })
      .nodeify(cb);
  }
});

(function registerErrors() {
  _.forIn(hwError, function (value, key) {
    if (key.match(/^Hid.*Error$/)) {
      hidHandler[key] = value;
    }
  });
})();

(function registerEventHandlers() {
  _.forIn(eventHandlers, function (eventHandler) {
    hidHandler.registerEventHandler(eventHandler);
    //[_.capitalize(_.camelCase(key + '-event'))] = eventHandler;
  });
})();

exports = module.exports = hidHandler;