'use strict';
const utils = require('./lib/utils');
const pgk = require('./package.json');
const logDecorator = require('./lib/logDecorator');

const pluginName = pgk.name;
const accessoryName = 'pilight';

const TRACE_ENABLED = process.env.HOMEBRIDGE_PILIGHT_TRACE === '1';

// TODO extract actual WebsocketClient usage into a dedicated stage
// => Observables API maybe?
// => Allowing multiplexing connections
const WebSocketConnectionFactory = require('./lib/ws');

module.exports = function (homebridge) {

  /**
   * pilight accessory via websocket
   */
  class PilightWebsocketAccessory {

    /**
     * Required config
     *
     * Default config is: host=localhost, port=5001, device=lamp
     *
     * @param log
     * @param config
     */
    constructor(log, config) {
      this.log = logDecorator(log, {prefix : `[${pluginName}] `});
      this.services = [];

      this.deviceState = undefined;
      this.dimLevel = undefined;

      this.config = {
        host : config.host || 'localhost',
        port : config.port || 5001,
        deviceId : config.device || 'lamp',
        name : config.name || config.device || 'Lamp',
        sharedWS : config.sharedWS || false,
        type : config.type || 'Switch'
      };

      this.id = `name=${this.config.deviceId},ws://${this.config.host}:${this.config.port}/`;
      this.name = config.name || this.config.device;

      this.stateCallback = null;
      this.dimLevelCallback = null;

      this.log(`Plugin '${pluginName} ${pgk.version}' registered as: plugin='${pluginName}', accessory='${accessoryName}', name='${this.name}'`);

      this.connect();
    }

    connect() {
      const pilightSocketAddress = `ws://${this.config.host}:${this.config.port}/`;
      const connection = this.config.sharedWS
        ? WebSocketConnectionFactory.shared(this.log, {address : pilightSocketAddress})
        : WebSocketConnectionFactory.simple(this.log, {address : pilightSocketAddress});

      if (this.config.sharedWS) {
        this.log('Multiplexing WebSocket connections enabled (option sharedWS=true)');
      }

      this.connection = connection;
      connection.connect();

      // handle error
      connection.emitter.on('connection::error', (error) => {
        this.log(`Connection error: ${error.message}`);
      });

      connection.emitter.on('connection::create', () => {
        // initial request all available values
        this.log('Requesting initial states...');
        connection.send({action : 'request values'});
      });

      connection.emitter.on('message::receive', (body) => {
        this.handleMessage(body);
      });

      connection.emitter.on('message::error', (error) => {
        this.log(`Something went wrong, cannot parse message. Error: ${error.toString()}`);
      });
    }

    handleMessage(json) {
      let item = null;

      if (utils.isMessageOfTypeValues(json)) {
        // bulk update ("request values")
        if (json.message === 'values') {
          // $.message & $.values is available pilight 8+
          item = json.values.find((item) => {
            return item.devices.indexOf(this.config.deviceId) !== -1;
          });
        } else {
          item = json.find((item) => {
            return item.devices.indexOf(this.config.deviceId) !== -1;
          });
        }
      } else if (utils.isMessageOfTypeUpdate(json)) {
        // item update (after "control")
        if (json.devices.indexOf(this.config.deviceId) !== -1) {
          item = json;
        }
      }

      if (item === null) {
        return;
      }

      if (TRACE_ENABLED) {
        this.log('TRACE: handleMessage: item=' + (item && JSON.stringify(item)));
      }

      let service = this.getServiceForDevice(this.config.name);

      if (item.values.state !== undefined && service.testCharacteristic(homebridge.hap.Characteristic.On)) {
        this.deviceState = item.values.state === 'on';
        this.log(`Updated internal state to "${item.values.state}"`);

        if (this.stateCallback !== null) {
          this.stateCallback(null);
          this.stateCallback = null;
        } else {
          service
            .getCharacteristic(homebridge.hap.Characteristic.On)
            .setValue(this.deviceState);
        }
      }

      if (item.values.dimlevel !== undefined && service.testCharacteristic(homebridge.hap.Characteristic.Brightness)) {
        this.dimLevel = item.values.dimlevel;
        this.log(`Updated internal dim level to ${item.values.dimlevel}`);

        if (this.dimLevelCallback !== null) {
          this.dimLevelCallback(null);
          this.dimLevelCallback = null;
        } else if (this.deviceState !== undefined && this.deviceState === true) {
          // Only set the dim level if the device is on
          service
            .getCharacteristic(homebridge.hap.Characteristic.Brightness)
            .setValue(utils.dimlevelToBrightness(this.dimLevel));
        }
      }

      if (item.values.temperature !== undefined && service.testCharacteristic(homebridge.hap.Characteristic.CurrentTemperature)) {
        this.deviceState = item.values.temperature;
        this.log(`Updated internal temperature to ${item.values.temperature}`);

        service
          .getCharacteristic(homebridge.hap.Characteristic.CurrentTemperature)
          .setValue(this.deviceState);
      }

      if (item.values.state !== undefined && service.testCharacteristic(homebridge.hap.Characteristic.MotionDetected)) {
        this.deviceState = item.values.state === 'on' || item.values.state === 'open';
        this.log(`Updated internal state to "${item.values.state}"`);

        service
          .getCharacteristic(homebridge.hap.Characteristic.MotionDetected)
          .setValue(this.deviceState);
        
      }

      if (item.values.state !== undefined && service.testCharacteristic(homebridge.hap.Characteristic.ContactSensorState)) {
        this.deviceState = item.values.state === 'on' || item.values.state === 'open';
        this.log(`Updated internal state to "${item.values.state}"`);

        service
          .getCharacteristic(homebridge.hap.Characteristic.ContactSensorState)
          .setValue(this.deviceState);
        
      }

      if (item.values.state !== undefined && service.testCharacteristic(homebridge.hap.Characteristic.StatelessProgrammableSwitch)) {
        this.deviceState = item.values.state === 'on';
        this.log(`Updated internal state to "${item.values.state}"`);

        if (this.deviceState === true) {
          service
            .getCharacteristic(homebridge.hap.Characteristic.ContactSensorState)
            setValue(this.deviceState);
        }
      }
    }

    getServiceForDevice(device) {
      return this.services.find(function (device, service) {
        return (service.displayName == device);
      }.bind(this, device));
    }

    getDimLevel(callback) {
      if (this.deviceState === undefined || this.dimLevel === undefined) {
        this.log('No dim level found');
        callback(new Error('Not found'));
      } else if (this.deviceState === false) {
        this.log(`Current brightness is 0% because device is off`);
        callback(null, 0);
      } else {
        const brightness = utils.dimlevelToBrightness(this.dimLevel);
        this.log(`Current dim level ${this.dimLevel} with brightness ${brightness}%`);
        callback(null, brightness);
      }
    }

    setDimLevel(brightness, callback) {
      let dimlevel = this.dimLevel;

      if (!this.connection) {
        callback(new Error('No connection'));
        return;
      }

      if (brightness === false || brightness === 0) {
        callback(null);
        return;
      }

      if (typeof(brightness) === 'number') {
        dimlevel = utils.brightnessToDimlevel(brightness);
      }

      this.log(`Try to set dim level to ${dimlevel} for value ${brightness}`);
      this.dimLevelCallback = callback;
      this.connection.send({
        action : 'control',
        code : {
          device : this.config.deviceId,
          values : {dimlevel}
        }
      });
    }

    getPowerState(callback) {
      if (this.deviceState === undefined) {
        this.log('No power state found');
        callback(new Error('Not found'));
      } else {
        callback(null, this.deviceState);
      }
    }

    setPowerState(powerOn, callback) {
      if (!this.connection) {
        callback(new Error('No connection'));
      } else if (powerOn == this.deviceState) {
        callback(null);
      } else {
        const state = powerOn ? 'on' : 'off';

        this.log(`Try to set powerstate to "${state}"`);
        this.stateCallback = callback;
        this.connection.send({
          action : 'control',
          code : {device : this.config.deviceId, state}
        });
      }
    }

    getTemperature(callback) {
      if (this.deviceState === undefined) {
        this.log('No temperature found');
        callback(new Error('Not found'));
      } else {
        callback(null, this.deviceState);
      }
    }

    identify(callback) {
      this.log('Identify requested!');
      callback(); // success
    }

    getServices() {
      // TODO
      const informationService = new homebridge.hap.Service.AccessoryInformation()
        .setCharacteristic(homebridge.hap.Characteristic.Manufacturer, 'Pilight Manufacturer')
        .setCharacteristic(homebridge.hap.Characteristic.Model, 'Pilight Model')
        .setCharacteristic(homebridge.hap.Characteristic.SerialNumber, 'Pilight Serial Number');

      this.services.push(informationService);

      switch (this.config.type) {
        case 'Dimmer':
          let dimmerService = new homebridge.hap.Service.Lightbulb(this.config.name);
          dimmerService
            .getCharacteristic(homebridge.hap.Characteristic.On)
            .on('get', this.getPowerState.bind(this))
            .on('set', this.setPowerState.bind(this));
          dimmerService
            .getCharacteristic(homebridge.hap.Characteristic.Brightness)
            .on('get', this.getDimLevel.bind(this))
            .on('set', this.setDimLevel.bind(this));
          this.services.push(dimmerService);
          break;

        case 'TemperatureSensor':
          let temperatureSensorService = new homebridge.hap.Service.TemperatureSensor(this.config.name);
          temperatureSensorService
            .getCharacteristic(homebridge.hap.Characteristic.CurrentTemperature)
            .on('get', this.getTemperature.bind(this));
          this.services.push(temperatureSensorService);
          break;

        case 'MotionSensor':
          let motionSensorService = new homebridge.hap.Service.MotionSensor(this.config.name);
          motionSensorService
            .getCharacteristic(homebridge.hap.Characteristic.MotionDetected)
            .on('get', this.getPowerState.bind(this));
          this.services.push(motionSensorService);
          break;
          
        case 'ContactSensor':
          let contactSensorService = new homebridge.hap.Service.ContactSensor(this.config.name);
          contactSensorService
            .getCharacteristic(homebridge.hap.Characteristic.ContactSensorState)
            .on('get', this.getPowerState.bind(this));
          this.services.push(contactSensorService);
          break;

        case 'Outlet':
          let outletService = new homebridge.hap.Service.Outlet(this.config.name);
          outletService
            .getCharacteristic(homebridge.hap.Characteristic.On)
            .on('get', this.getPowerState.bind(this))
            .on('set', this.setPowerState.bind(this));
          this.services.push(outletService);
          break;

        case 'ProgrammableSwitch':
          let statelessProgrammableSwitchService = new homebridge.hap.Service.StatelessProgrammableSwitch(this.config.name);
          statelessProgrammableSwitchService
            .getCharacteristic(homebridge.hap.Characteristic.On)
            .setProps({
              maxValue: 0
            });
          this.services.push(statelessProgrammableSwitchService);
          break;  

        default: // or Switch
          let switchService = new homebridge.hap.Service.Switch(this.config.name);
          switchService
            .getCharacteristic(homebridge.hap.Characteristic.ProgrammableSwitchEvent)
            .on('get', this.getPowerState.bind(this))
            .on('set', this.setPowerState.bind(this));
          this.services.push(switchService);
          break;
      }
      return this.services;
    }
  }

  homebridge.registerAccessory(pluginName, accessoryName, PilightWebsocketAccessory);
};
