// FIXME internal doc
// {prefix = '', suffix = '', handler = null}
const logDecorator = (log, options) => {
  options = options || {};
  const prefix = options.prefix || '';
  const suffix = options.suffix || '';
  const handler = options.handler;
  return (message) => {
    if (handler) {
      message = handler(message);
    }
    return log(`${prefix}${message}${suffix}`);
  };
};

module.exports = logDecorator;
