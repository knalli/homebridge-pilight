'use strict';

const WebSocketConnection = require('./WebSocketConnection');
const MESSAGE_QUEUE_INTERVAL= 300;

let clientContexts = {};
let messageQueue = {};
let messageQueueTimers = {};

/**
 * Extension of WebSocketConnection
 *
 * This will cache client connections for the same address.
 */
class MultiplexWebSocketConnection extends WebSocketConnection {

  static flush() {
    this.log('Flush client map');
    clientContexts = {};
    messageQueue = {};
  }

  buildClient(address, SocketClient, SocketClientSettings) {
    if (!clientContexts[address]) {
      this.log('Registering client');
      clientContexts[address] = {
        client : super.buildClient(address, SocketClient, SocketClientSettings),
        error : false,
        connection : null
      };
      messageQueue[address] = [];

      this.websocketConnectionInitiator = true;
    }

    return clientContexts[address].client;
  }

  startMessageQueueTimer() {
    this.log('Starting message queue timer');
    messageQueueTimers[this.address] = setInterval( () => {
      this._processMessageQueue();
    }, MESSAGE_QUEUE_INTERVAL);
  }

  stopMessageQueueTimer() {
    this.log('Stopping message queue timer');
    messageQueueTimers[this.address].clearInterval();
    messageQueue[this.address] = [];
  }

  connect() {
    const context = clientContexts[this.address];

    if (context.error) {
      this.emitter.emit('connection::error', context.error, this);

    } else if (context.connectFailed) {
      //this.emitter.emit('connection::error', context.error, this);

    } else if (!context.connection) {
      if (this.websocketConnectionInitiator) {
        // this is the original initiator and first one to wait..
        this.client.on('connect', (connection) => {
          context.connection = connection;
          context.error = null;
          this.startMessageQueueTimer();
        });
        this.client.on('disconnect', () => {
          this.stopMessageQueueTimer();
        });
        this.client.on('error', (err) => {
          context.connection = null;
          context.error = err;
        });
        this.client.on('connectFailed', (err) => {
          context.connection = null;
          context.connectFailed = err;
        });
        super.connect(); // actual connect

      } else {
        // try again later
        setTimeout(() => this.connect(), 500);
      }

    } else {
      // connection is already available
      this.log(`Re-using already established connection to "${this.address}"`);
      this.connection = context.connection;
      this._onConnect();
    }
  }

  send(body) {
    messageQueue[this.address].push(body);
  }

  _processMessageQueue() {
    let body = messageQueue[this.address].shift();

    if (body !== undefined) {
      this.sendNow(body);
    }
  }

}

module.exports = MultiplexWebSocketConnection;
