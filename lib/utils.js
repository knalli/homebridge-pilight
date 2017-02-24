'use strict';

/**
 * Internal helper
 */
class Utils {

  /**
   * Returns promise asserting the input message contains UTF8.
   * @param message
   * @returns {Promise}
   */
  assertUtf8Message(message) {
    return new Promise((resolve, reject) => {
      if (message.type === 'utf8') {
        resolve(message);
      } else {
        reject(message);
      }
    });
  }

  /**
   * Convert a percentile brightness level of 1 - 100 to a dim level of 0 - 15
   * @param brightness
   * @returns {number}
   */
  brightnessToDimlevel(brightness) {
    return brightness === 0 ? 0 : Math.ceil(brightness / (100 / 16)) - 1;
  }

  /**
   * Convert a dim level of 0 - 15 to a percentage of 1 - 100
   * @param brightness
   * @returns {number}
   */
  dimlevelToBrightness(dimlevel) {
    // Levels range from 0 - 15, but should be 1 - 16 (0 isn't off, so percentage shouldn't be 0 either)
    return Math.round((dimlevel + 1) / 16 * 100);
  }

  /**
   * Returns promise providing JSON of the message.
   * @param message
   * @returns {Promise}
   */
  convertToJson(message) {
    return new Promise((resolve, reject) => {
      try {
        if (message.utf8Data) {
          resolve(JSON.parse(message.utf8Data));
        } else {
          reject({message: 'Payload must contain data'});
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Returns true only if the json looks a message of arrays of type values (duck check).
   * @param json
   * @returns {boolean}
   */
  isMessageOfTypeValues(json) {
    let result = false;
    if (Array.isArray(json)) {
      if (json.length === 0) {
        result = true;
      } else if (typeof json[0].type !== 'undefined' && typeof json[0].devices !== 'undefined' && typeof json[0].values !== 'undefined') {
        result = true;
      }
    }
    return result;
  }

  /**
   * Returns true only if the json looks like a message of type values (duck check).
   * @param json
   * @returns {boolean}
   */
  isMessageOfTypeUpdate(json) {
    return (json.origin === 'update' && typeof json.type !== 'undefined' && typeof json.devices !== 'undefined' && typeof json.values !== 'undefined');
  }
}

module.exports = new Utils();
