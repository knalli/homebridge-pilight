'use strict';
const utils = require('./lib/utils');

const pluginName = 'homebridge-pilight';
const accessoryName = 'pilight';

// TODO extract actual WebsocketClient usage into a dedicated stage
// => Observables API maybe?
// => Allowing multiplexing connections
const WebSocketConnection = require('./lib/ws/WebSocketConnection');

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

      this.deviceState = undefined;

      this.config = {
        host : config.host || 'localhost',
        port : config.port || 5001,
        deviceId : config.device || 'lamp'
      };

      this.id = `name=${this.config.deviceId},ws://${this.config.host}:${this.config.port}/`;
      this.connect();
    }

    connect() {
      const pilightSocketAddress = `ws://${this.config.host}:${this.config.port}/`;
      const connection = new WebSocketConnection(this.log, {address : pilightSocketAddress});
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
          this.deviceState = item.values.state === 'on';
          this.log(`Initialized device with state "${item.values.state}"`);
        } else {
          this.log(`Could not find device with id "${this.config.deviceId}"`);
        }
      } else if (utils.isMessageOfTypeUpdate(json)) {
        // item update (after "control")
        if (json.devices.indexOf(this.config.deviceId) !== -1) {
          this.deviceState = json.values.state === 'on';
          this.log(`Updated internal state to "${json.values.state}"`);
        }
      }
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

      const switchService = new homebridge.hap.Service.Switch();

      switchService
        .getCharacteristic(homebridge.hap.Characteristic.On)
        .on('set', this.setPowerState.bind(this));

      switchService
        .getCharacteristic(homebridge.hap.Characteristic.On)
        .on('get', this.getPowerState.bind(this));

      return [informationService, switchService];
    }

  }

  homebridge.registerAccessory(pluginName, accessoryName, PilightWebsocketAccessory);
};
