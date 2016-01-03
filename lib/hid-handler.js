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
  config: {
    defaultDeviceType: 'generic',
    supportedDevices: []
  },
  registeredHids: {},
  getRegisteredDevices: function () {
    var scannedDevices, devices;
    scannedDevices = util.scanDevices();
    devices = _.filter(scannedDevices, function (device) {
      return !!that.getRegisteredHid(device);
    });
    devices = _.unique(_.map(devices, function (device) {
      return {
        deviceKey: util.getDeviceKey(device),
        product: device.product.trim(),
        manufacturer: device.manufacturer.trim()
      };
    }), function (device) {
      return device.deviceKey.toString();
    });
    return devices;
  },
  getRegisteredHid: function (vendorId, productId) {
    var deviceKey;
    if (typeof productId === 'undefined' && typeof vendorId === 'string') {
      deviceKey = vendorId;
    } else {
      deviceKey = util.getDeviceKey(vendorId, productId);
    }
    return that.registeredHids[deviceKey];
  },
  getRegisteredHids: function () {
    return _.values(that.registeredHids);
  },
  getRegisteredHidKeys: function () {
    return _.keys(that.registeredHids);
  },
  getSupportedDevice: function (vendorId, productId) {
    return _.first(_.filter(that.config.supportedDevices, function (supportedDevice) {
      return supportedDevice.vendorId === vendorId && supportedDevice.productId === productId;
    }));
  },
  handleEndpointData: function (hid, ifaceIndex, inEndpointIndex, data) {
    var eventClassName, eventClass, event;
    logger.enabledLevels.trace && log.trace('data :', data);
    eventClassName = util.format('%sEvent', _.capitalize(_.camelCase(hid.device.type[ifaceIndex])));
    eventClass = that[eventClassName] || that.GenericEvent;
    event = new eventClass(hid, data);
    logger.enabledLevels.trace && log.trace('created event :', event);
    event.emit([that, hid.ee]);
  },
  handleEndpointError: function (hid, ifaceIndex, inEndpointIndex, err) {
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
  handleEndpointEnd: function (hid, ifaceIndex, inEndpointIndex) {
    var inEndpoint;
    inEndpoint = hid.device.interfaces[ifaceIndex].endpoints[inEndpointIndex];
    logger.enabledLevels.debug && log.debug('endpoint end.');
    inEndpoint.removeListener('data', that.handleEndpointData);
    inEndpoint.removeListener('error', that.handleEndpointError);
    inEndpoint.removeListener('end', that.handleEndpointEnd);
  },
  handleUsbAttach: function (device) {
    var deviceKey, supportedDevice, deviceType;
    deviceKey = util.getDeviceKey(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct);
    logger.enabledLevels.debug && log.debug('detected new attached device "%s"', deviceKey);
    if (that.config.supportedDevices.length) {
      supportedDevice = that.getSupportedDevice(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct);
    }
    if (!supportedDevice) {
      logger.enabledLevels.debug && log.debug('attached device "%s" is not supported : ignore', deviceKey);
      return;
    }
    logger.enabledLevels.debug && log.debug('register attached device "%s"', deviceKey);
    deviceType = supportedDevice.type || that.config.defaultDeviceType;
    deviceType = typeof deviceType === 'string' ? {0: deviceType} : deviceType;
    that.registerHid({type: deviceType, device: device}).then(function () {
      that.emit('usb', {action: 'attach', device: device});
    });
  },
  handleUsbDetach: function (device) {
    var deviceKey, hid;
    deviceKey = util.getDeviceKey(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct);
    logger.enabledLevels.debug && log.debug('detected new detached device "%s"', deviceKey);
    if (that.config.supportedDevices.length && !that.getSupportedDevice(device.deviceDescriptor.idVendor, device.deviceDescriptor.idProduct)) {
      logger.enabledLevels.debug && log.debug('detached device "%s" is not supported : ignore', deviceKey);
      return;
    }
    hid = that.getRegisteredHid(deviceKey);
    if (!hid) {
      logger.enabledLevels.debug && log.debug('detached device "%s" is not registered : ignore', deviceKey);
      return;
    }
    logger.enabledLevels.debug && log.debug('unregister detached device "%s"', deviceKey);
    that.unregisterHid(hid).then(function () {
      that.emit('usb', {action: 'detach', device: device});
    });
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
  registerHid: function (opt, cb) {
    var deviceKey, hid;
    deviceKey = util.getDeviceKey(opt.device.deviceDescriptor.idVendor, opt.device.deviceDescriptor.idProduct);
    logger.enabledLevels.debug && log.debug('register hid device "%s"', deviceKey);
    logger.enabledLevels.trace && log.trace('device :', util.logObject(opt.device));
    return p.do(
      function checkAlreadyRegistered() {
        if (that.getRegisteredHid(deviceKey)) {
          throw new that.HidAlreadyRegisteredError(deviceKey);
        }
      },
      function initHid() {
        hid = {
          deviceKey: deviceKey,
          device: opt.device
        };
        hid.device.type = opt.type || that.config.defaultDeviceType;
        hid.device.type = typeof hid.device.type === 'string' ? {0: hid.device.type} : hid.device.type;
      },
      function openDevice() {
        logger.enabledLevels.debug && log.debug('open device "%s"', hid.deviceKey);
        opt.device.open();
      },
      function claimInterfaces() {
        logger.enabledLevels.debug && log.debug('get interfaces of device "%s"', hid.deviceKey);
        logger.enabledLevels.trace && log.trace('device has %s interfaces :', hid.device.interfaces.length, util.logObject(hid.device.interfaces));
        if (!hid.device.interfaces.length) {
          logger.enabledLevels.warn && log.warn('no interface for device "%s"', hid.deviceKey);
          throw new that.HidHandlerError({code: 'NO_INTERFACE'});
        }
        hid.device.interfaces.forEach(function (iface, ifaceIndex) {
          if (typeof opt.device.type[ifaceIndex] === 'undefined') {
            logger.enabledLevels.debug && log.debug('no type found for interface #%s of device "%s" : ignore', ifaceIndex, hid.deviceKey);
            return;
          }
          logger.enabledLevels.trace && log.trace('found device interface #%s of type %s :', ifaceIndex, opt.device.type[ifaceIndex], util.logObject(iface));
          if (iface.isKernelDriverActive()) {
            logger.enabledLevels.debug && log.debug('detach interface #%s of device "%s" from kernel', ifaceIndex, hid.deviceKey);
            iface.detachKernelDriver();
          }
          logger.enabledLevels.debug && log.debug('claim interface #%s of device "%s"', ifaceIndex, hid.deviceKey);
          iface.claim();
          logger.enabledLevels.debug && log.debug('searching "in" endpoints of interface #%s for device "%s"', ifaceIndex, hid.deviceKey);
          logger.enabledLevels.trace && log.trace('device interface #%s has %s endpoints :', ifaceIndex, iface.endpoints.length, util.logObject(iface.endpoints));
          (function handleEndpoints(inEndpoints) {
            if (!inEndpoints.length) {
              logger.enabledLevels.warn && log.warn('no "in" endpoint in interface #%s for device "%s"', ifaceIndex, hid.deviceKey);
              return;
            }
            inEndpoints.forEach(function (inEndpoint, inEndpointIndex) {
              logger.enabledLevels.trace && log.trace('registered endpoint :', util.logObject(inEndpoint));
              logger.enabledLevels.debug && log.debug('register endpoint listeners');
              inEndpoint.on('data', that.handleEndpointData.bind(that, hid, ifaceIndex, inEndpointIndex));
              inEndpoint.on('error', that.handleEndpointError.bind(that, hid, ifaceIndex, inEndpointIndex));
              inEndpoint.on('end', that.handleEndpointEnd.bind(that, hid, ifaceIndex, inEndpointIndex));
              logger.enabledLevels.debug && log.debug('start endpoint polling');
              inEndpoint.startPoll();
            });
          })(_.filter(iface.endpoints, function (endpoint) {
            return endpoint.direction === 'in';
          }));
        });
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
      function stopEndpoints() {
        if (!hid.device.interfaces || !hid.device.interfaces.length) {
          logger.enabledLevels.warn && log.warn('no interface for device "%s" : ignore', hid.deviceKey);
          return;
        }
        return p.map(hid.device.interfaces, function (iface, ifaceIndex) {
          var inEndpoints;
          if (typeof hid.device.type[ifaceIndex] === 'undefined') {
            logger.enabledLevels.debug && log.debug('no type found for interface #%s of device "%s" : ignore', ifaceIndex, hid.deviceKey);
            return;
          }
          inEndpoints = _.filter(iface.endpoints, function (endpoint) {
            return endpoint.direction === 'in';
          });
          return p.do(
            function closeEndpoints() {
              if (!inEndpoints.length) {
                logger.enabledLevels.warn && log.warn('no "in" endpoint in interface #%s for device "%s"', ifaceIndex, hid.deviceKey);
                return;
              }
              return p.map(inEndpoints, function (inEndpoint, inEndpointIndex) {
                if (!inEndpoint.pollActive) {
                  return;
                }
                logger.enabledLevels.debug && log.debug('stopping endpoint #%s polling of interface #%s for device "%s"', inEndpointIndex, ifaceIndex, hid.deviceKey);
                return p.fromNode(inEndpoint.stopPoll.bind(inEndpoint))
                  .then(function () {
                    logger.enabledLevels.debug && log.debug('endpoint #%s polling of interface #%s stopped for device "%s"', inEndpointIndex, ifaceIndex, hid.deviceKey);
                  });
              });
            },
            function releaseInterface() {
              logger.enabledLevels.debug && log.debug('release interface #%s of device "%s"', ifaceIndex, hid.deviceKey);
              return p.fromNode(iface.release.bind(iface, true))
                .then(function () {
                  logger.enabledLevels.debug && log.debug('interface #%s released for device "%s"', ifaceIndex, hid.deviceKey);
                  if (!iface.isKernelDriverActive()) {
                    logger.enabledLevels.debug && log.debug('reattach interface #%s of device "%s" from kernel', ifaceIndex, hid.deviceKey);
                    iface.attachKernelDriver();
                  }
                })
                .catch(function (err) {
                  if (err.errno !== usb.LIBUSB_ERROR_NO_DEVICE) {
                    throw err;
                  }
                });

            });
        });
      })
      .finally(function () {
        return p.do(
          function closeDevice() {
            if (!hid.device) {
              return;
            }
            logger.enabledLevels.debug && log.debug('close device "%s"', hid.deviceKey);
            //return p.fromNode(hid.device.reset.bind(hid.device)).then(function () {
            hid.device.close();
            //});
          },
          function removeDevice() {
            logger.enabledLevels.debug && log.debug('remove device "%s" from registered', hid.deviceKey);
            delete that.registeredHids[hid.deviceKey];
          });
      })
      .nodeify(cb);
  },
  init: function (opt) {
    opt = opt || {};
    _.extend(that.config, {
      defaultDeviceType: opt.defaultDeviceType,
      supportedDevices: Array.isArray(opt.supportedDevices) ? opt.supportedDevices : (opt.supportedDevices ? [opt.supportedDevices] : [])
    });
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
        supportedDevices = that.config.supportedDevices || _.map(usb.getDeviceList(), function (value) {
            return {
              vendorId: value.deviceDescriptor.idVendor,
              productId: value.deviceDescriptor.idProduct,
              type: that.config.defaultDeviceType
            };
          });
        logger.enabledLevels.trace && log.trace('supported devices :', supportedDevices);
        logger.enabledLevels.debug && log.debug('init devices');
        return p.each(_.values(supportedDevices),
          function (supportedDevice) {
            var deviceKey, device, deviceType;
            deviceKey = util.getDeviceKey(supportedDevice.vendorId, supportedDevice.productId);
            logger.enabledLevels.debug && log.debug('searching usb device from "%s"', deviceKey);
            device = usb.findByIds(supportedDevice.vendorId, supportedDevice.productId);
            if (!device) {
              logger.enabledLevels.warn && log.warn('no usb device matching "%s"', deviceKey);
              return;
            }
            deviceType = supportedDevice.type || that.config.defaultDeviceType;
            logger.enabledLevels.debug && log.debug('found %s usb device matching "%s"', deviceType, deviceKey);
            return that.registerHid({type: deviceType, device: device});
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

(function exposeFuncs(moduleFuncs) {
  var eventEmittersKeys = Object.keys(events.EventEmitter.prototype);
  moduleFuncs.concat(eventEmittersKeys).forEach(function (key) {
    if (typeof that[key] === 'function') {
      logger.enabledLevels.trace && log.trace('exports function "%s"', key);
      exports[key] = that[key].bind(that);
    }
  });
})([
  'getSupportedDevice',
  'init',
  'isStarted',
  'start',
  'stop',
  'getRegisteredDevices',
  'getRegisteredHid',
  'getRegisteredHids',
  'getRegisteredHidKeys',
  'registerEventHandler'
]);

exports.util = util;