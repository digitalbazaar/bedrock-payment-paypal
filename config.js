const {util} = require('bedrock');

const c = util.config.main;
const cc = c.computer();

cc('paypal', {
  api: null,
  clientId: null,
  secret: null,
  brandName: null
});
