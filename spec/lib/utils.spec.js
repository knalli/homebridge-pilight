const utils = require('../../lib/utils');

describe('lib/utils', () => {

  'use strict';

  describe('assertUtf8Message()', () => {

    it('should return a resolving promise for utf8 type', (done) => {
      utils.assertUtf8Message({type : 'utf8'})
        .then((message) => {
          expect(message).toEqual({type : 'utf8'});
          done();
        }, () => {
          fail('Promise should not be rejected');
          done();
        });
    });

    it('should return a resolving promise for utf8 type (with data)', (done) => {
      utils.assertUtf8Message({type : 'utf8', utf8Data : '123'})
        .then((message) => {
          expect(message).toEqual({type : 'utf8', utf8Data : '123'});
          done();
        }, () => {
          fail('Promise should not be rejected');
          done();
        });
    });

    it('should return a rejecting promise for empty type', (done) => {
      utils.assertUtf8Message({})
        .then(() => {
          fail('Promise should not be resolved');
          done();
        }, (message) => {
          expect(message).toEqual({});
          done();
        });
    });

    it('should return a rejecting promise for non-utf8 type', (done) => {
      utils.assertUtf8Message({type : 'anything-else'})
        .then(() => {
          fail('Promise should not be resolved');
          done();
        }, (message) => {
          expect(message).toEqual({type : 'anything-else'});
          done();
        });
    });

  });

  describe('convertToJson()', () => {

    it('should return a resolving promise for serialized json', (done) => {
      utils.convertToJson({utf8Data : '{"key": 1}'})
        .then((payload) => {
          expect(payload).toEqual({key : 1});
          done();
        }, () => {
          fail('Promise should not be rejected');
          done();
        });
    });

    it('should return a rejecting promise for undefined serialized json', (done) => {
      utils.convertToJson({})
        .then(() => {
          fail('Promise should not resolved');
          done();
        }, (err) => {
          expect(err.message).toMatch(/^Payload\smust\scontain\sdata/);
          done();
        });
    });

    it('should return a rejecting promise for null serialized json', (done) => {
      utils.convertToJson({utf8Data : null})
        .then(() => {
          fail('Promise should not resolved');
          done();
        }, (err) => {
          expect(err.message).toMatch(/^Payload\smust\scontain\sdata/);
          done();
        });
    });

    it('should return a rejecting promise for non-serialized json', (done) => {
      utils.convertToJson({utf8Data : {key : 1}})
        .then(() => {
          fail('Promise should not resolved');
          done();
        }, (err) => {
          expect(err.message).toMatch(/^Unexpected\stoken/);
          done();
        });
    });

  });

  describe('isMessageOfTypeValues()', () => {

    describe('should return true for a values message', () => {
      it('', () => {
        let messages = [{
          type : 'anything',
          devices : [],
          values : {}
        }];
        expect(utils.isMessageOfTypeValues(messages)).toBe(true);
      });
    });

    it('should return true for a values message even when a second value would not fit', () => {
      let messages = [{
        type : 'anything',
        devices : [],
        values : {}
      }, {}];
      expect(utils.isMessageOfTypeValues(messages)).toBe(true);
    });

    describe('should return false for a non values message', () => {
      it('(empty object in array)', () => {
        let messages = [{}];
        expect(utils.isMessageOfTypeValues(messages)).toBe(false);
      });

      it('(string in array)', () => {
        let messages = [''];
        expect(utils.isMessageOfTypeValues(messages)).toBe(false);
      });

      it('(number in array)', () => {
        let messages = [0];
        expect(utils.isMessageOfTypeValues(messages)).toBe(false);
      });

      it('(object)', () => {
        let messages = {};
        expect(utils.isMessageOfTypeValues(messages)).toBe(false);
      });

      it('(string)', () => {
        let messages = '';
        expect(utils.isMessageOfTypeValues(messages)).toBe(false);
      });

      it('(null)', () => {
        let messages = null;
        expect(utils.isMessageOfTypeValues(messages)).toBe(false);
      });

      it('(undefined)', () => {
        let messages = undefined;
        expect(utils.isMessageOfTypeValues(messages)).toBe(false);
      });
    });

  });

  describe('isMessageOfTypeUpdate()', () => {

    describe('should return true', () => {
      it('', () => {
        let json = {
          origin : 'update',
          type : 'anything',
          devices : [],
          values : {}
        };
        expect(utils.isMessageOfTypeUpdate(json)).toEqual(true);
      });
    });

    describe('should return false', () => {
      it('for a non update message', () => {
        let json = {
          origin : 'anything else',
          type : 'anything',
          devices : [],
          values : {}
        };
        expect(utils.isMessageOfTypeUpdate(json)).toEqual(false);
      });
      it('for an empty object', () => {
        let json = {};
        expect(utils.isMessageOfTypeUpdate(json)).toEqual(false);
      });
    });

  });

});