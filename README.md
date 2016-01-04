[![NPM version](https://badge.fury.io/js/hid-handler.svg)](http://badge.fury.io/js/hid-handler)
[![Build Status](https://travis-ci.org/openhoat/hid-handler.png?branch=master)](https://travis-ci.org/openhoat/hid-handler)
[![Coverage Status](https://coveralls.io/repos/openhoat/hid-handler/badge.svg?branch=master&service=github)](https://coveralls.io/github/openhoat/hid-handler?branch=master)

[![NPM](https://nodei.co/npm/hid-handler.png)](https://nodei.co/npm/hid-handler/)

# USB HID Handler

This nodejs module provides an event handler for USB HID devices.

[![NodeJS](http://swatinfosystem.com/wp-content/uploads/2014/11/node-js.png?37e999)](https://nodejs.org/)
![Mouse](http://www.materiel.net/live/198995.100.100.jpg)
![Keyboard](http://screenshots.en.sftcdn.net/en/scrn/69706000/69706904/thumbnail_1430424066-100x100.png)
![Numpad](http://www.mytrendyphone.co.uk/images/Genius-Numpad-i110-USB-Slim-Numeric-Keypad-Black-07012013-2-t.jpg)
![Touchpad](https://regmedia.co.uk/2011/11/02/logi_1.jpg?x=100&y=100&crop=1)

Based on libusb, thx to the wonderful [node-usb](https://github.com/nonolith/node-usb) nodejs module.

The purpose of this module is to provide a higher level of USB devices handling, and just use it in your app without having to deal with all technical details of libusb.

## Installation

```bash
$ npm install hid-handler
```

## Quick start

Suppose you want to handle an USB keyboard :

```javascript
var hidHandler = require('hid-handler');

hidHandler.on('key', function (event) {
  console.log('keycodes :', event.keycodes); // raw keycodes array emitted by the keyboard
});

hidHandler.start({
  supportedDevices: {                           // object or array of devices
    name: 'Microsoft comfort curve keyboard',   // optional (not used decoration)
    type: 'keyboard',                           // if not specified, only generic events are emitted
    vendorId: 0x045e,                           // required
    productId: 0x00dd                           // required
  }
});

process.on('SIGINT', function () { // properly stop the handler in a simple main app
  hidHandler.stop();
});
```

## Usage

Hid handler first registers the devices you want, or all the detected ones.

After starting, every registered devices are mapped to an event handler class (see [event-handlers](tree/master/lib/event-handlers)).

Each event handler class is matching a type of device (keyboard, mouse, ...).

Hid handler exposes an event emitter to manage all type of events.

Types of event :

- 'event' : any event of any device (fallback)
- 'key' : a key is pressed and released
- 'move' : mouse (or pad) move (left, right, up, down)
- 'click' : mouse (or pad) click (left, right, ...)
- 'wheel' : mouse wheel click (up, down)

Example of usage :

```javascript
var hidHandler = require('hid-handler');

hidHandler.on('event', function (event) { // catch all events for all devices
  console.log('event :', event.toString()); // event class toString to display nice events status
  console.log('device :', event.hid.deviceKey.toString()); // hid device key concerned
});

hidHandler.on('key', function (event) { // catch key events (emitted by keyboard devices)
  console.log('key event :', event.toString());
});

hidHandler.on('click', function (event) { // catch click events (emitted by mouse or pad devices)
  console.log('click event :', event.toString());
});

hidHandler.on('wheel', function (event) { // catch wheel events (emitted by mouse devices)
  console.log('wheel event :', event.toString());
});

hidHandler.on('move', function (event) { // catch move events (emitted by mouse devices)
  console.log('move event :', event.toString());
});

hidHandler.init({
  supportedDevices: [{
    name: 'Razer mouse',    // optional
    type: { 0: 'mouse' },  // optional, types of interfaces (defaults : {0:generic})
    vendorId: 0x1532,       // required
    productId: 0x0003,      // required
  }]
});

process.on('SIGINT', function () { // properly stop the handler in a simple main app
  hidHandler.stop();
});

hidHandler.start(function() {
  console.log('started');
}); // starts the handler
```

## Device types

Currently supported device types are :

- generic   : used for base class or unknown devices
- keyboard  : generates key pressed events
- numpad    : generates key pressed events
- mouse     : generates clicks, wheel clicks and move events
- touchpad  : generates clicks and move events

The 'type' property of a supported device should match available event handler class names to lower case and without the word 'Event'. (example : 'KeyboardEvent' class matches type 'keyboard')

If type is an object each key should be an interface index (0, 1, ...) else if type is a string it defines only the type of the first interface (0).

Available default values for 'type' are : keyboard, numpad, mouse, touchpad, generic (defaults). 

Event handler classes are extendable with [registerEventHandler](#registereventhandlereventhandlerclass). 

Feel free to extend to map your needs !

## API

### init(opt)

Initialize hid handler with optional opt.supportedDevices to specify devices to handle (by default all connected devices are handled).

supportedDevices should be an array of objects containing vendorId and productId properties.

To find vendorId and productId of your existing devices, check bin/scandevices :-)

Options :

```javascript
{
  supportedDevices,     // array of objects containing vendorId and productId properties to support
  keyLayouts: {
    baseDir,            // custom base dir to scan for keyboard layouts
    layouts             // extra custom keyboard layouts
  }
}
```

### isStarted()

Returns true if hid handler is started, false else.

### start(opt, cb)

Starts hid handler and return a [promise](https://promisesaplus.com/) (or call the cb callback).

First call init(opt) if it was not done before.

If opt is provided and init was not called before, then start will call.

Warning : all handled devices will be detached from the kernel and reattached to it when stop() is called

### stop

Stops hid handler, and free all resources :-)

### getSupportedDevice(vendorId, productId)

Find and return the matching device from supported devices list.

### getRegisteredDevices

Returns list of registered devices.

Each device is an object containing :

- deviceKey: vendorId:productId key
- product: id of the product
- manufacturer : id of the manufacturer

### getRegisteredHid(vendorId, productId)

Returns the registered hid matching vendorId and productId, or null if not found.

### getRegisteredHids

Returns the registered hids.

### getRegisteredHidKeys

Returns the registered hid keys (vendorId:productId).

### getSupportedDevice(vendorId, productId)

Returns supported device matching vendorId and productId, or null if not found.

The supported devices are specified at init() invocation, by default all connected devices are supported.

### registerEventHandler(eventHandlerClass)

Registers an event handler class.
Useful to add a custom event handler for a device that's not supported.

### keyLayouts

Provides keyboard layouts to convert scan codes to keycodes.
 
If a layout matches the registered device, events are populated with the associated keycode in addition to scan codes. 

Layouts are provided as properties, json or yaml files.

Hid handler includes some [default layouts](tree/master/lib/key-layouts) (generic qwerty, azerty-fr).

Feel free to add some custom layouts with :

- registerLayout(layout) : register an extra layout
- registerLayoutFile(file) : register a layout file
- registerLayoutDir(dir) : scan layout files from specific directory

#### Layout format

- name : name of the layout (for a file this is the basename of the file)
- value : an object containing scancodes as keys, and keycodes as values

Keycodes values can be arrays to manage modifiers (shift, alt, ctrl)

Keycodes with spaces are considered as arrays

Extra layouts values always inherit from generic layout.

Example of layout file [generic.properties](blob/master/lib/key-layouts/generic.properties)

### util

Helper that overrides NodesJS util.

## Event handler class

The GenericEvent class is the base class used as a super class by the others. 

An event handler class should :

- have a name matching [A-Z].*Event
- provide a constructor that calls super constructor
- optionally provide toString() method
- provide parseData() method to parse data emitted by the matching device
- provide emit(sources) method to emit high level events to the world

Example of event handler class implementation : [KeyboardEvent](tree/master/lib/event-handlers/keyboard.js)

Enjoy!