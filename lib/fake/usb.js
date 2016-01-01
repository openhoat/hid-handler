'use strict';

var _ = require('lodash')
  , usb;

usb = {
  on: _.noop,
  findByIds: _.noop,
  removeListener: _.noop
};

exports = module.exports = usb;