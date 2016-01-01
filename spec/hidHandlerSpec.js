'use strict';

var chai = require('chai')
  , expect = chai.expect
//, util = require('util')
  , hidHandler = require('../lib/hid-handler');
//, logger = require('hw-logger')
//, log = logger.log;

describe('hid-handler', function () {

  it('should be ok', function () {
    expect(hidHandler).to.be.ok;
  });

  it('should provide error classes', function () {
    expect(hidHandler).to.have.property('HidHandlerError');
    expect(hidHandler).to.have.property('HidAlreadyRegisteredError');
    expect(hidHandler).to.have.property('HidEventHandlerNameError');
    expect(new hidHandler.HidHandlerError()).to.be.an.instanceof(hidHandler.HidHandlerError).and.is.an.instanceof(Error);
    expect(new hidHandler.HidAlreadyRegisteredError()).to.be.an.instanceof(hidHandler.HidAlreadyRegisteredError).and.is.an.instanceof(hidHandler.HidHandlerError).and.is.an.instanceof(Error);
    expect(new hidHandler.HidEventHandlerNameError()).to.be.an.instanceof(hidHandler.HidEventHandlerNameError).and.is.an.instanceof(hidHandler.HidHandlerError).and.is.an.instanceof(Error);
  });

  it('should provide event classes', function () {
    expect(hidHandler).to.have.property('GenericEvent');
    expect(hidHandler).to.have.property('KeyboardEvent');
    expect(hidHandler).to.have.property('MouseEvent');
    expect(hidHandler).to.have.property('TouchpadEvent');
    expect(new hidHandler.KeyboardEvent()).to.be.an.instanceof(hidHandler.KeyboardEvent).and.is.an.instanceof(hidHandler.GenericEvent);
    expect(new hidHandler.MouseEvent()).to.be.an.instanceof(hidHandler.MouseEvent).and.is.an.instanceof(hidHandler.GenericEvent);
    expect(new hidHandler.TouchpadEvent()).to.be.an.instanceof(hidHandler.TouchpadEvent).and.is.an.instanceof(hidHandler.GenericEvent);
  });

  it('should provide methods', function () {
    [
      'getRegisteredHid',
      'getSupportedDevice',
      'registerEventHandler',
      'init',
      'start',
      'stop'
    ].forEach(function (key) {
      expect(hidHandler).to.respondTo(key);
    });
  });

  it('should try to get registered hid', function () {
    expect(hidHandler.getRegisteredHid(1, 1)).to.be.undefined;
    expect(hidHandler.getRegisteredHid('1:1')).to.be.undefined;
  });

  it('should try to get supported hid', function () {
    var supportedDevice = {name: 'fake device', vendorId: 1, productId: 1};
    hidHandler.init({supportedDevices: supportedDevice});
    expect(hidHandler.getSupportedDevice(1, 1)).to.be.equal(supportedDevice);
  });

  it('should start and stop', function () {
    hidHandler.init({supportedDevices: []});
    return hidHandler.start()
      .then(function () {
        expect(hidHandler.isStarted()).to.be.true;
      })
      .then(hidHandler.stop.bind(hidHandler))
      .then(function () {
        expect(hidHandler.isStarted()).to.be.false;
      });
  });

});