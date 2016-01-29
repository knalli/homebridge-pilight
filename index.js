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

      this.deviceState = undefined;

      this.config = {
        host: config.host || 'localhost',
        port: config.port || 5001,
        deviceId: config.device || 'lamp'
      };

      this.id = `name=${this.config.deviceId},ws://${this.config.host}:${this.config.port}/`;

      this.client = new WebSocketClient();
      this.connect();

      // handle connect failure
      this.client.on('connectFailed', (err) => {
        this.log(`Websocket connection failed: ${err.message}`);
        this.log(`Websocket connection failed, will retry in 10s...`);
        setTimeout(() => {
          this.connect();
        }, 10000);
      });

      //handle ws error
      this.client.on('error', function (error) {
        this.log(`Websocket connection Error: ${error.toString()}`);
      });
    }

    connect() {
      var pilightSocket = 'ws://' + this.config.host + ':' + this.config.port + '/';
      this.client.connect(pilightSocket);
      this.log(`Connecting to "${pilightSocket}"`);

      // FIXME: Should cache/multiplex identical connections?
      this.client.on('connect', (connection) => {
        this.log(`Connection established!`);
        this._connection = connection; // hold reference to current connection

        this._connection.on('message', (message) => this.handleMessage(message));

        // initial request all available values
        this._connection.sendUTF(JSON.stringify({action: 'request values'}));
      });
    }

    handleMessage(rawMessage) {
      return Promise.resolve(rawMessage)
        .then(utils.assertUtf8Message)
        .then(utils.convertToJson)
        .then((json) => {
          if (utils.isMessageOfTypeValues(json)) {
            // bulk update ("request values")
            var item = json.find((item) => {
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
        })
        .catch((e) => {
          this.log(`Something went wrong, cannot parse message. Error: ${e}`);
        });
    }

    setPowerState(powerOn, callback) {
      if (!this._connection) {
        callback(new Error('No connection'));
      } else {
        const state = powerOn ? 'on' : 'off';
        this.log(`Try to set powerstate to "${state}"`);
        this._connection.sendUTF(JSON.stringify({
          action: 'control',
          code: {device: this.config.deviceId, state}
        }));
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
      let informationService = new homebridge.hap.Service.AccessoryInformation()
        .setCharacteristic(homebridge.hap.Characteristic.Manufacturer, 'Pilight Manufacturer')
        .setCharacteristic(homebridge.hap.Characteristic.Model, 'Pilight Model')
        .setCharacteristic(homebridge.hap.Characteristic.SerialNumber, 'Pilight Serial Number');

      let switchService = new homebridge.hap.Service.Switch();

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
