'use strict';
const WebSocketClient = require('websocket').client;
const utils = require('./lib/utils');

const pluginName = 'homebridge-pilight';
const accessoryName = 'pilight';

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

      this.deviceStates = {};

      this.config = {
        host : config.host || 'localhost',
        port : config.port || 5001,
        deviceId : config.device || 'lamp'
      };

      this.id = `name=${this.config.deviceId},ws://${this.config.host}:${this.config.port}/`;

      this.client = new WebSocketClient();
      this.connect();

      // handle connect failure
      this.client.on('connectFailed', (err) => {
        this.log(`${this.id}: Connection failed: ${err.message}`);
        this.log(`${this.id}: Connection failed, will retry in 10s...`);
        setTimeout(() => {
          this.connect();
        }, 10000);
      });
    }

    connect() {
      this.client.connect('ws://' + this.config.host + ':' + this.config.port + '/');
      this.log(`${this.id}: Connecting...`);

      // FIXME: Should cache/multiplex identical connections?
      this.client.on('connect', (connection) => {
        this.log(`${this.id}: Connection established!`);
        this._connection = connection; // hold reference to current connection

        this._connection.on('message', (message) => this.handleMessage(message));

        // initial request all available values
        this._connection.sendUTF(JSON.stringify({action : 'request values'}));
      });
    }

    handleMessage(rawMessage) {
      return Promise.resolve(rawMessage)
        .then(utils.assertUtf8Message)
        .then(utils.convertToJson)
        .then((json) => {
          if (utils.isMessageOfTypeValues(json)) {
            // bulk update ("request values")
            this.deviceStates = {};
            for (let item of json) {
              for (let device of item.devices) {
                this.deviceStates[device] = item.values.state === 'on';
              }
              this.log(`${this.id}: Updated internal states of devices: ${item.devices}`);
            }
          } else if (utils.isMessageOfTypeUpdate(json)) {
            // item update (after "control")
            for (let device of json.devices) {
              this.deviceStates[device] = json.values.state === 'on';
            }
            this.log(`${this.id}: Updated internal states of devices: ${json.devices}`);
          }
        })
        .catch(() => {
          this.log(`${this.id}: Something went wrong, cannot parse message`);
        });
    }

    setPowerState(powerOn, callback) {
      if (!this._connection) {
        callback(new Error('No connection'));
      } else {
        this._connection.sendUTF(JSON.stringify({
          action : 'control',
          code : {device : this.config.deviceId, state : (powerOn ? 'on' : 'off')}
        }));
        callback(null);
      }
    }

    getPowerState(callback) {
      if (!this.deviceStates || typeof this.deviceStates[this.config.deviceId] === 'undefined') {
        this.log(`${this.id}: No power state found for device ${this.config.deviceId}`);
        callback(new Error('Not found'));
      } else {
        callback(null, this.deviceStates[this.config.deviceId]);
      }
    }

    identify(callback) {
      this.log('Identify requested!');
      callback(); // success
    }

    getServices() {

      // TODO
      let informationService = new homebridge.hap.Service.AccessoryInformation()
        .setCharacteristic(homebridge.hap.Characteristic.Manufacturer, 'Pilight Manufacturer')
        .setCharacteristic(homebridge.hap.Characteristic.Model, 'Pilight Model')
        .setCharacteristic(homebridge.hap.Characteristic.SerialNumber, 'Pilight Serial Number');

      let lightbulbService = new homebridge.hap.Service.Lightbulb();

      lightbulbService
        .getCharacteristic(homebridge.hap.Characteristic.On)
        .on('set', this.setPowerState.bind(this));

      lightbulbService
        .getCharacteristic(homebridge.hap.Characteristic.On)
        .on('get', this.getPowerState.bind(this));

      return [informationService, lightbulbService];
    }

  }

  homebridge.registerAccessory(pluginName, accessoryName, PilightWebsocketAccessory);
};
