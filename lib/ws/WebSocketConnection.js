'use strict';

const EventEmitter = require('eventemitter3');
const WebSocketClient = require('websocket').client;

const utils = require('./../utils');
const logDecorator = require('./../logDecorator');

const RECONNECT_RETRY = 10000;

class WebSocketConnection {

  /**
   * Creates a WebSocket connection holder
   *
   * This is actually simple single WS connection holder object.
   * The following events have been rewritten:
   * * connectFailed => connection::error
   * * error => connection::error
   * * message => message::receive (if json)
   * * message => message::error (unless json)
   *
   * @param log
   * @param options
   * @param options.retryInterval
   * @param SocketClient only for internal purpose
   * @param SocketClientSettings only for internal purpose
   */
  constructor(log, options, SocketClient, SocketClientSettings) {
    this.log = logDecorator(log, {prefix: `[WebSocket] `});
    this.address = options.address;
    this.retryInterval = options.retryInterval || RECONNECT_RETRY;
    this.emitter = new EventEmitter();
    this.client = this.buildClient(this.address, SocketClient, SocketClientSettings);
  }

  buildClient(address, SocketClient, SocketClientSettings) {
    const client = SocketClient ? new SocketClient(SocketClientSettings) : new WebSocketClient();

    // handle connect failure
    client.on('connectFailed', (err) => {
      this.log(`Connection failed: ${err.message}, will retry in ${RECONNECT_RETRY}ms...`);
      this.emitter.emit('connection::error', err, this);
      setTimeout(() => {
        this.connect();
      }, this.retryInterval);
    });

    // handle ws error
    client.on('error', (err) => {
      this.log(`Connection error: ${err.toString()}`);
      this.emitter.emit('connection::error', err, this);
    });

    return client;
  }

  connect() {
    this.log(`Connecting to "${this.address}"...`);

    this.client.on('connect', (connection) => {
      this.log('Connection established successfully');
      this.connection = connection; // hold reference to current connection
      this._onConnect();
    });

    this.client.connect(this.address);
  }

  _onConnect() {
    // install callback for incoming messages
    this.connection.on('message', (message) => this.handleMessage(message));

    // Emit connection is created
    this.emitter.emit('connection::create', {}, this);
  }

  sendNow(body) {
    this.connection.sendUTF(JSON.stringify(body));
  }

  send(body) {
    this.sendNow(body);
  }

  handleMessage(rawMessage) {
    return Promise.resolve(rawMessage)
      .then(utils.assertUtf8Message)
      .then(utils.convertToJson)
      .then((json) => {
        this.emitter.emit('message::receive', json, this);
      })
      .catch((err) => {
        this.log(`Something went wrong, cannot parse message. Error: ${err.message}`);
        this.emitter.emit('message::error', err, this);
      });
  }

  getEmitter() {
    return this.emitter;
  }

}

module.exports = WebSocketConnection;
