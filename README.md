[![NPM version](https://badge.fury.io/js/hid-handler.svg)](http://badge.fury.io/js/hid-handler)
[![Build Status](https://travis-ci.org/openhoat/hid-handler.png?branch=master)](https://travis-ci.org/openhoat/hid-handler)
[![Coverage Status](https://coveralls.io/repos/openhoat/hid-handler/badge.svg?branch=master&service=github)](https://coveralls.io/github/openhoat/hid-handler?branch=master)

# USB HID Handler

This nodejs module provides an event handler for USB HID devices.

It is based on libusb, thx to the wonderful [node-usb](https://github.com/nonolith/node-usb) nodejs module.

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
  supportedDevices: {
    name: 'Microsoft comfort curve keyboard',   // optional
    type: 'keyboard',                           // required
    vendorId: 0x045e,                           // required
    productId: 0x00dd                           // required
  }
});

process.on('SIGINT', function () { // properly stop the handler in a simple main app
  hidHandler.stop();
});
```

## Usage

hid-handler first registers the devices you want, or all the detected ones.

After starting, every registered devices are mapped to an event handler class (see [event-handlers](tree/master/lib/event-handlers)).

Each event handler class is matching a type of device (keyboard, mouse, ...).

hid-handler exposes an event emitter to manage all type of events.

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
    type: 'mouse',          // required
    vendorId: 0x1532,       // required
    productId: 0x0003       // required
  }]
});

process.on('SIGINT', function () { // properly stop the handler in a simple main app
  hidHandler.stop();
});

hidHandler.start(function() {
  console.log('started');
}); // starts the handler
```

The 'type' property of a supported device should match an available event handler class name to lower case and without the word 'Event'. (example : 'KeyboardEvent' class matches type 'keyboard')

Available default values for 'type' are : keyboard, mouse, touchpad, generic (defaults). 

Event handler classes are extendable with [registerEventHandler](#registereventhandlereventhandlerclass). 

## API

### getSupportedDevice(vendorId, productId)

Find and return the matching device from supported devices list.

### init(opt)

Initialize hid-handler with optional opt.supportedDevices to specify devices to handle (by default all connected devices are handled).

supportedDevices should be an array of objects containing vendorId and productId properties.

To find vendorId and productId of your existing devices, check bin/scandevices :-)

### start(opt, cb)

Starts hid-handler and return a [promise](https://promisesaplus.com/) (or call the cb callback).

First call init(opt) if it was not done before.

If opt is provided and init was not called before, then start will call.

Warning : all handled devices will be detached from the kernel and reattached to it when stop() is called

### stop

Stops hid-handler, and free all resources :-)

### getRegisteredHid(vendorId, productId)

Returns the registered hid matching vendorId and productId, or null if not found.

### getSupportedDevice(vendorId, productId)

Returns supported device matching vendorId and productId, or null if not found.

The supported devices are specified at init() invocation, by default all connected devices are supported.

### registerEventHandler(eventHandlerClass)

Registers an event handler class.
Useful to add a custom event handler for a device that's not supported.

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