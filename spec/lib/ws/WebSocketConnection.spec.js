'use strict';

const WebSocketConnection = require('../../../lib/ws/WebSocketConnection');
const EventEmitter = require('eventemitter3');

class FakeWebSocketConnection extends EventEmitter {

  send(body) {
    console.log('FakeWebSocketConnection.send() called');
  }

}

class FakeWebSocketClient extends EventEmitter {

  constructor(settings) {
    super();
    FakeWebSocketClient.instances.push(this);
    this.settings = settings;
  }

  connect(address) {
    this.address = address;

    if (this.settings.shouldFail) {
      //console.log('Handle "shouldFail"');
      this.emit('connectFailed', new Error('Connection failed'));
    } else if (this.settings.shouldError) {
      //console.log('Handle "error"');
      this.emit('error', new Error('Connection error'));
    } else if (this.settings.shouldSuccess) {
      //console.log('Handle "success"');
      this.connection = new FakeWebSocketConnection(this.settings);
      this.emit('connect', this.connection);
    }
  }

}

describe('lib/ws/WebSocketConnection', () => {

  'use strict';

  FakeWebSocketClient.instances = [];

  describe('connect()', () => {

    const log = console.log;

    it('should handle "connectFailed"', (done) => {
      const connection = new WebSocketConnection(log, {
        address : 'ws://localhost:1234',
        retryInterval : 1
      }, FakeWebSocketClient, {shouldFail : true});

      connection.emitter.on('connection::error', (err) => {
        expect(err.message).toEqual('Connection failed');
        done();
      });

      connection.connect();
      expect(connection.client.address).toEqual('ws://localhost:1234');
    });

    it('should handle "error"', (done) => {
      const connection = new WebSocketConnection(log, {
        address : 'ws://localhost:1234',
        retryInterval : 1
      }, FakeWebSocketClient, {shouldError : true});

      connection.emitter.on('connection::error', (err) => {
        expect(err.message).toEqual('Connection error');
        done();
      });

      connection.connect();
      expect(connection.client.address).toEqual('ws://localhost:1234');
    });

    it('should handle "connect"', (done) => {
      const connection = new WebSocketConnection(log, {
        address : 'ws://localhost:1234',
        retryInterval : 1
      }, FakeWebSocketClient, {shouldSuccess : true});

      connection.emitter.on('connection::create', done);

      connection.connect();
      expect(connection.client.address).toEqual('ws://localhost:1234');
    });

    describe('should handle "message"', () => {

      it('successful', (done) => {
        const connection = new WebSocketConnection(log, {
          address : 'ws://localhost:1234',
          retryInterval : 1
        }, FakeWebSocketClient, {shouldSuccess : true});

        connection.emitter.on('message::receive', (message) => {
          expect(message.key).toEqual('Hans Wurst');
          done();
        });

        connection.emitter.on('message::error', (err) => {
          console.log('Message has failed: ', err);
          fail();
        });

        connection.connect();
        expect(connection.client.address).toEqual('ws://localhost:1234');

        const rawMessage = {
          type : 'utf8',
          utf8Data : '{"key": "Hans Wurst"}'
        };
        connection.client.connection.emit('message', rawMessage);
      });

      it('with error (no type)', (done) => {
        const connection = new WebSocketConnection(log, {
          address : 'ws://localhost:1234',
          retryInterval : 1
        }, FakeWebSocketClient, {shouldSuccess : true});

        connection.emitter.on('message::receive', (message) => {
          fail();
        });

        connection.emitter.on('message::error', (err) => {
          done();
        });

        connection.connect();
        expect(connection.client.address).toEqual('ws://localhost:1234');

        const rawMessage = {
          utf8Data : '{"key": "Hans Wurst"}'
        };
        connection.client.connection.emit('message', rawMessage);
      });

      it('with error (no valid json)', (done) => {
        const connection = new WebSocketConnection(log, {
          address : 'ws://localhost:1234',
          retryInterval : 1
        }, FakeWebSocketClient, {shouldSuccess : true});

        connection.emitter.on('message::receive', (message) => {
          fail();
        });

        connection.emitter.on('message::error', (err) => {
          done();
        });

        connection.connect();
        expect(connection.client.address).toEqual('ws://localhost:1234');

        const rawMessage = {
          type : 'utf8',
          utf8Data : '{key": "Hans Wurst"}'
        };
        connection.client.connection.emit('message', rawMessage);
      });

    });

  });

});