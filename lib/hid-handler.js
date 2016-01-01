'use strict';

var _ = require('lodash')
  , usb = require(process.env['TRAVIS'] ? './fake/usb' : 'usb')
  , p = require('hw-promise')
  , logger = require('hw-logger')
  , hwError = require('hw-error')
  , events = require('events')
  , eventHandlers = require('./event-handlers')
  , util = require('./util')
  , log = logger.log
  , that;

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

that = _.extend(new events.EventEmitter(), {
  registeredHids: {},
  getRegisteredHid: function (vendorId, productId) {
    var deviceKey;
    if (typeof productId === 'undefined' && typeof vendorId === 'string') {
      deviceKey = vendorId;
    } else {
      deviceKey = util.getDevicekey(vendorId, productId);
    }
    return that.registeredHids[deviceKey];
  },
  getSupportedDevice: function (vendorId, productId) {
    return _.first(_.filter(that.supportedDevices, function (supportedDevice) {
      return supportedDevice.vendorId === vendorId && supportedDevice.productId === productId;
    }));
  },
  handleEndpointData: function (data) {
    var hid = this
      , eventClassName, eventClass, event;
    logger.enabledLevels.trace && log.trace('data :', data);
    eventClassName = util.format('%sEvent', _.capitalize(_.camelCase(hid.device.type)));
    eventClass = that[eventClassName] || that.GenericEvent;
    event = new eventClass(hid, data);
    logger.enabledLevels.trace && log.trace('created event :', event);
    event.emit([that, hid.ee]);
  },
  handleEndpointError: function (err) {
    var hid = this;
    if (err.errno === usb.LIBUSB_ERROR_NO_DEVICE) {
      log.warn(err);
      that.unregisterHid(hid);
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
    hid.endpoint.removeListener('data', that.handleEndpointData);
    hid.endpoint.removeListener('error', that.handleEndpointError);
    hid.endpoint.removeListener('end', that.handleEndpointEnd);
  },
  handleUsbAttach: function (device) {
    var deviceKey, supportedDevice, deviceType;
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
    that.registerHid(deviceType, device);
  },
  handleUsbDetach: function (device) {
    var deviceKey, hid;
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
    that.unregisterHid(hid);
  },
  registerEventHandler: function (eventHandlerClass, eventHandlerClassName) {
    eventHandlerClassName = eventHandlerClassName || eventHandlerClass.name;
    if (that.hasOwnProperty(eventHandlerClassName)) {
      throw new that.HidEventHandlerNameError(eventHandlerClassName);
    }
    if (!eventHandlerClass.super_ && eventHandlerClassName !== 'GenericEvent') {
      (function () {
        var proto = eventHandlerClass.prototype;
        util.inherits(eventHandlerClass, that.GenericEvent);
        _.forIn(proto, function (fn, name) {
          eventHandlerClass.prototype[name] = fn;
        });
      })();
    }
    logger.enabledLevels.debug && log.debug('register event handler class "%s"', eventHandlerClassName);
    that[eventHandlerClassName] = eventHandlerClass;
  },
  registerHid: function (deviceType, device, cb) {
    var deviceKey, hid;
    deviceKey = util.getDevicekey(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct);
    logger.enabledLevels.debug && log.debug('register hid device "%s"', deviceKey);
    logger.enabledLevels.trace && log.trace('device :', util.logObject(device));
    return p.do(
      function checkAlreadyRegistered() {
        if (that.getRegisteredHid(deviceKey)) {
          throw new that.HidAlreadyRegisteredError(deviceKey);
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
        logger.enabledLevels.debug && log.debug('get interface of device "%s"', hid.deviceKey);
        logger.enabledLevels.trace && log.trace('device has %s interfaces :', hid.device.interfaces.length, util.logObject(hid.device.interfaces));
        interfaceIndex = hid.device.interfaces.length - 1;
        hid.interface = hid.device.interface(interfaceIndex);
        if (!hid.interface) {
          logger.enabledLevels.warn && log.warn('no interface for device "%s"', hid.deviceKey);
          throw new that.HidHandlerError({code: 'NO_INTERFACE'});
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
          throw new that.HidHandlerError({code: 'NO_IN_ENDPOINT'});
        }
        logger.enabledLevels.trace && log.trace('registered endpoint :', util.logObject(hid.endpoint));
        logger.enabledLevels.debug && log.debug('register endpoint listeners');
        hid.endpoint.on('data', that.handleEndpointData.bind(hid));
        hid.endpoint.on('error', that.handleEndpointError.bind(hid));
        hid.endpoint.on('end', that.handleEndpointEnd.bind(hid));
        logger.enabledLevels.debug && log.debug('start endpoint polling');
        hid.endpoint.startPoll();
      },
      function registerNewHid() {
        hid.ee = new events.EventEmitter();
        that.registeredHids[hid.deviceKey] = hid;
      })
      .catch(that.HidAlreadyRegisteredError, function (err) {
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
        delete that.registeredHids[hid.deviceKey];
      })
      .nodeify(cb);
  },
  init: function (opt) {
    opt = opt || {};
    that.supportedDevices = Array.isArray(opt.supportedDevices) ? opt.supportedDevices : (opt.supportedDevices ? [opt.supportedDevices] : []);
    that.initialized = true;
  },
  isStarted: function () {
    return that.started;
  },
  start: function (opt, cb) {
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
        usb.on('attach', that.handleUsbAttach);
        usb.on('detach', that.handleUsbDetach);
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
            return that.registerHid(deviceType, device);
          });
      })
      .then(function setStartedState() {
        that.started = true;
      })
      .nodeify(cb);
  },
  stop: function (cb) {
    logger.enabledLevels.debug && log.debug('stop hid handler');
    return p.do(
      function () {
        logger.enabledLevels.debug && log.debug('stop hid handler');
        return p.map(_.values(that.registeredHids), function (hid) {
          log.debug('hid :', hid);
          return that.unregisterHid(hid);
        });
      },
      function removeListeners() {
        logger.enabledLevels.debug && log.debug('remove listeners');
        usb.removeListener('attach', that.handleUsbAttach);
        usb.removeListener('detach', that.handleUsbDetach);
        that.removeAllListeners();
      })
      .then(function setStartedState() {
        that.started = false;
      })
      .nodeify(cb);
  }
});

(function registerErrors() {
  _.forIn(hwError, function (value, key) {
    if (key.match(/^Hid.*Error$/)) {
      exports[key] = that[key] = value;
    }
  });
})();

(function registerEventHandlers() {
  that.registerEventHandler(eventHandlers.GenericEvent);
  _.forIn(_.omit(eventHandlers, 'GenericEvent'), function (eventHandler) {
    that.registerEventHandler(eventHandler);
  });
  _.extend(exports, eventHandlers);
})();

['getSupportedDevice', 'init', 'isStarted', 'start', 'stop', 'getRegisteredHid', 'registerEventHandler', 'on'].forEach(function (key) {
  exports[key] = that[key].bind(that);
});

exports.util = util;