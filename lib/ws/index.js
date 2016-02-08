'use strict';

const WebSocketConnection = require('./WebSocketConnection');
const SharedWebSocketConnection = require('./SharedWebSocketConnection');

module.exports = {
  simple : (log, options, SocketClient, SocketClientSettings) => {
    return new WebSocketConnection(log, options, SocketClient, SocketClientSettings);
  },
  shared : (log, options, SocketClient, SocketClientSettings) => {
    return new SharedWebSocketConnection(log, options, SocketClient, SocketClientSettings);
  }
};