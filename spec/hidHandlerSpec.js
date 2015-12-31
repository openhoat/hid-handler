'use strict';

var chai = require('chai')
  , expect = chai.expect
//, util = require('util')
  , hidHandler = require('../lib/hid-handler');
//, logger = require('hw-logger')
//, log = logger.log;

describe('hid-handler', function () {

  it('should provide error classes', function () {
    expect(hidHandler).to.be.ok;
    expect(hidHandler).to.have.property('HidHandlerError');
    expect(hidHandler).to.have.property('HidAlreadyRegisteredError');
    expect(hidHandler).to.have.property('HidEventHandlerNameError');
    expect(new hidHandler.HidHandlerError()).to.be.an.instanceof(hidHandler.HidHandlerError).and.is.an.instanceof(Error);
    expect(new hidHandler.HidAlreadyRegisteredError()).to.be.an.instanceof(hidHandler.HidAlreadyRegisteredError).and.is.an.instanceof(hidHandler.HidHandlerError).and.is.an.instanceof(Error);
  });

});