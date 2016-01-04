'use strict';

var path = require('path')
  , fs = require('fs')
  , p = require('hw-promise')
  , _ = require('lodash')
  , jsonic = require('jsonic')
  , YAML = require('yamljs')
  , util = require('../util')
  , properties = require('properties')
  , logger = require('hw-logger')
  , log = logger.log
  , parseProperties = p.promisify(properties.parse, {context: properties})
  , that;

p.promisifyAll(fs);

that = {
  config: {
    baseDir: __dirname
  },
  layouts: {},
  init: function (opt, cb) {
    var defaultLayoutFile = path.join(__dirname, 'generic.properties');
    opt = opt || {};
    logger.enabledLevels.debug && log.debug('init key layouts');
    _.extend(that.config, opt);
    return p.do(
      function registerGenericDefault() {
        return that.registerLayoutFile(defaultLayoutFile);
      },
      function scanLayouts() {
        var selfBasename;
        selfBasename = path.basename(__filename);
        return that.registerLayoutDir({
          filter: function excludeSelf(file) {
            return file !== selfBasename && file !== defaultLayoutFile;
          }
        });
      },
      function registerExtraLayouts() {
        if (!that.config.layouts || !that.config.layouts.length) {
          return;
        }
        return p.map(that.config.layouts, that.registerLayout);
      })
      .nodeify(cb);
  },
  getLayoutKeycode: function (layoutName, scancode, modifiers) {
    var that = this
      , layout, keycode;
    scancode = typeof scancode === 'number' ? util.decToHex(scancode) : _.padLeft(scancode, 2, '0');
    layout = that.getLayout(layoutName);
    keycode = _.get(layout, scancode);
    if (typeof keycode === 'undefined') {
      logger.enabledLevels.warn && log.warn('scancode "%s" not found for layout "%s"', scancode, layout.name);
    }
    if (Array.isArray(keycode)) {
      keycode = keycode[modifiers && (modifiers.indexOf('left-shift') > -1 || modifiers.indexOf('right-shift')) > -1 ? 1 : 0];
    }
    return keycode;
  },
  getLayout: function (layout) {
    var layoutName, variant;
    if (typeof layout === 'object') {
      layoutName = layout.layout;
      variant = layout.variant;
    } else if (typeof layout === 'string') {
      (function (parts) {
        layoutName = parts[0];
        variant = parts[1];
      })(layout.split('-'));
    }
    return _.get(that.layouts, [layoutName, variant].join('-')) || _.get(that.layouts, layoutName) || _.get(that.layouts, 'generic');
  },
  getLayouts: function () {
    return that.layouts;
  },
  registerLayout: function (layout) {
    var nameParts;
    if (typeof layout.name !== 'string') {
      logger.enabledLevels.warn && log.warn('cannot register unnamed layout : ignore');
      return;
    }
    logger.enabledLevels.debug && log.debug('register layout "%s"', layout.name);
    nameParts = layout.name.split('-');
    _.forIn(layout.value, function (v, k) {
      var parts;
      (function (upK) {
        if (k === upK) {
          return;
        }
        layout.value[upK] = layout.value[k];
        delete layout.value[k];
        k = upK;
      })(k.toUpperCase());
      parts = typeof v === 'string' && v.split(' ');
      if (parts && parts.length > 1) {
        layout.value[k] = parts;
      }
      if (parts) {
        parts.forEach(function (part) {
          if (part.length > 1) {
            logger.enabledLevels.debug && log.debug('found special key in "%s" :', v, part);
          }
        });
      }
    });
    that.layouts[layout.name] = layout.value;
    that.layouts[layout.name].name = layout.name;
    if (that.layouts.generic) {
      _.defaults(that.layouts[layout.name], that.layouts.generic);
    }
    if (nameParts.length > 1 && typeof that.layouts[nameParts[0]] === 'undefined') {
      that.layouts[nameParts[0]] = that.layouts[nameParts[0]] || {};
      that.layouts[nameParts[0]].name = that.layouts[nameParts[0]].name || layout.name;
      _.defaults(that.layouts[nameParts[0]], layout.value);
    }
  },
  registerLayoutFile: function (file, cb) {
    return p.do(
      function loadLayoutFile() {
        var ext = path.extname(file)
          , result = {
          name: path.basename(file, ext)
        };
        switch (ext) {
          case '.json':
            return fs.readFileAsync(file, 'utf8')
              .then(function (content) {
                result.value = jsonic(content);
              })
              .return(result);
          case '.yaml':
          case '.yml':
            result.value = YAML.load(file);
            return result;
          case '.properties':
            return parseProperties(file, {path: true})
              .then(function (value) {
                result.value = value;
              })
              .catch(function (err) {
                log.warn(err);
              })
              .return(result);
        }
      },
      function (layout) {
        if (layout) {
          that.registerLayout(layout);
        }
      })
      .nodeify(cb);
  },
  registerLayoutDir: function (opt, cb) {
    opt = _.defaults({
      dir: that.config.baseDir
    }, opt);
    return p.do(
      function scanLayouts() {
        return fs.readdirAsync(opt.dir).then(function (files) {
          var selfBasename;
          selfBasename = path.basename(__filename);
          if (opt.filter) {
            files = files.filter(opt.filter);
          }
          return files
            .map(function (file) {
              return path.join(opt.dir, file);
            });
        });
      },
      function registerLayouts(files) {
        if (!files.length) {
          return;
        }
        return p.map(files, that.registerLayoutFile);
      })
      .nodeify(cb);
  }
};

exports = module.exports = that;