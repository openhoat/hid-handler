'use strict';

var requireDirectory = require('require-directory');

requireDirectory(module, {
  rename: function (name, file) {
    var mod, key;
    mod = require(file);
    key = mod.name;
    exports[key] = mod;
  }
});