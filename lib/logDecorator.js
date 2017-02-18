// FIXME internal doc
const logDecorator = (log, {prefix = '', suffix = '', handler = null}) => {
  return (message) => {
    if (handler) {
      message = handler(message);
    }
    return log(`${prefix}${message}${suffix}`);
  };
};

module.exports = logDecorator;