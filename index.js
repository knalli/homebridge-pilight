'use strict';
const utils = require('./lib/utils');

const pck = require('./package.json');
const pluginName = 'homebridge-pilight';
const accessoryName = 'pilight';

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
      this.log = log;
      this.services = [];

      this.deviceState = undefined;

      this.config = {
        host : config.host || 'localhost',
        port : config.port || 5001,
        deviceId : config.device || 'lamp',
        sharedWS : config.sharedWS || false,
        type : config.type || 'Switch'
      };

      this.id = `name=${this.config.deviceId},ws://${this.config.host}:${this.config.port}/`;

      this.log(`Running ${pck.name}@${pck.version}`);
      this.connect();
    }

    connect() {
      const pilightSocketAddress = `ws://${this.config.host}:${this.config.port}/`;
      const connection = this.config.sharedWS
        ? WebSocketConnectionFactory.shared(this.log, {address : pilightSocketAddress})
        : WebSocketConnectionFactory.simple(this.log, {address : pilightSocketAddress});

      this.log(`Option sharedWS = ${this.config.sharedWS}`)

      this.connection = connection;
      connection.connect();

      // handle error
      connection.emitter.on('connection::error', (error) => {
        this.log(`Connection error: ${error.message}`);
      });

      connection.emitter.on('connection::create', () => {
        // initial request all available values
        this.log(`Requesting initial states...`);
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
      if (utils.isMessageOfTypeValues(json)) {
        // bulk update ("request values")
        const item = json.find((item) => {
          return item.devices.indexOf(this.config.deviceId) !== -1;
        });
        if (item) {
          switch (this.config.type) {
            case "TemperatureSensor":
              this.deviceState = item.values.temperature;
              this.log(`Initialized device with temperature "${item.values.temperature}"`);
              break;
            default:
              // or Switch
              this.deviceState = item.values.state === 'on';
              this.log(`Initialized device with state "${item.values.state}"`);
              break;
          }
        } else {
          this.log(`Could not find device with id "${this.config.deviceId}"`);
        }
      } else if (utils.isMessageOfTypeUpdate(json)) {
        // item update (after "control")
        if (json.devices.indexOf(this.config.deviceId) !== -1) {
          let characteristic = "";
          switch (this.config.type) {
            case "TemperatureSensor":
              characteristic = homebridge.hap.Characteristic.CurrentTemperature;
              this.deviceState = json.values.temperature;
              this.log(`Updated internal state to "${json.values.temperature}"`);
              break;
            default:
              // or Switch
              characteristic = homebridge.hap.Characteristic.On;
              this.deviceState = json.values.state === 'on';
              this.log(`Updated internal state to "${json.values.state}"`);
              break;
          }

          //Trigger an update to Homekit
          var service = this.getServiceForDevice(this.config.deviceId);
          service.getCharacteristic(characteristic).setValue(this.deviceState);
        }
      }
    }

    getServiceForDevice(device) {
      return this.services.find(function (device, service) {
        return (service.displayName == device);
      }.bind(this, device));
    }

    setPowerState(powerOn, callback) {
      if (!this.connection) {
        callback(new Error('No connection'));
      } else {
        const state = powerOn ? 'on' : 'off';
        this.log(`Try to set powerstate to "${state}"`);
        this.connection.send({
          action : 'control',
          code : {device : this.config.deviceId, state}
        });
        callback(null);
      }
    }

    getPowerState(callback) {
      if (this.deviceState === undefined) {
        this.log(`No power state found`);
        callback(new Error('Not found'));
      } else {
        callback(null, this.deviceState);
      }
    }

    getTemperature(callback) {
      if (this.deviceState === undefined) {
        this.log(`No temperature found`);
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
        case 'TemperatureSensor':
          let temperatureSensorService = new homebridge.hap.Service.TemperatureSensor(this.config.deviceId);
          temperatureSensorService
            .getCharacteristic(homebridge.hap.Characteristic.CurrentTemperature)
            .on('get', this.getTemperature.bind(this));
          this.services.push(temperatureSensorService);
          break;
        default:
          // or Switch
          let switchService = new homebridge.hap.Service.Switch(this.config.deviceId);
          switchService
            .getCharacteristic(homebridge.hap.Characteristic.On)
            .on('set', this.setPowerState.bind(this));
          switchService
            .getCharacteristic(homebridge.hap.Characteristic.On)
            .on('get', this.getPowerState.bind(this));
          this.services.push(switchService);
          break;
      }
      return this.services;

    }

  }

  homebridge.registerAccessory(pluginName, accessoryName, PilightWebsocketAccessory);
};
