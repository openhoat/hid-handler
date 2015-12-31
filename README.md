# USB HID Handler

This nodejs module provides an event handler for USB HID devices.

## Installation

```
npm install hid-handler
```

## Usage

```
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
    name: 'Razer mouse', // optional
    vendorId: 0x1532, // required
    productId: 0x0003 // required
  }]
});

process.on('SIGINT', function () { // properly stop the handler in a simple main app
  hidHandler.stop();
});

hidHandler.start(); // starts the handler
```

## API

@TODO : to complete

Enjoy!