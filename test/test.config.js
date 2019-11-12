const {config} = require('bedrock');
const path = require('path');
require('bedrock-payment-paypal');

config.mocha.tests.push(path.join(__dirname, 'mocha'));

const cfg = config.paypal;
cfg.api = 'https://api.sandbox.paypal.com';
cfg.clientId = process.env.paypal_client_id;
cfg.secret = process.env.paypal_secret;
cfg.brandName = 'test-project';
