# Homebridge pilight Plugin

This is an accessory plugin for [Homebridge](https://github.com/nfarina/homebridge) allowing to manage and control
pilight devices.

## What does this plugin do?

This plugin only communications to the pilight daemon via the WebSocket API exposed by pilight itself. You should be sure
to enable this api and the configured port is not blocked by any firewall.


## Install

**Important: This plugin is using ES6/ES2015. Please use an appropriate environment like NodeJS v4 or higher.**

If you have already installed homebridge globally, just install 

```npm install -g homebridge-pilight```

Alternativly, add the dependency into your local project with
 
```npm install -S homebridge-pilight```

## Configuration

The plugin registers itself as `pilight`. You have the following options:

| Option | Default   |
| ------ | --------- |
| host   | localhost |
| port   | 5001      |
| device | lamp      |

If you are running a pilight daemon on the same machine, you will probably skip both `host` and `port`.

Additionally you have the Homebridge options `accessory` (for the actual plugin) and `name` (for representation later).

### Example config.json


```json
{
  "bridge": {
    "name": "Homebridge",
    "username": "CC:22:3D:E3:CE:30",
    "port": 51826,
    "pin": "031-45-154"
  },
  "description": "This is an example configuration file with pilight plugin.",
  "accessories": [
    {
      "accessory": "pilight",
      "name": "My lamp",
      "device": "lamp"
    }
  ],
  "platforms": [
  ]
}
```

## License

Copyright 2015 by Jan Philipp. Licensed under MIT.
