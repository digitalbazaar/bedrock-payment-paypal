const {config} = require('bedrock');

const cfg = config.paypal = config.paypal || {};
cfg.api = 'https://api.sandbox.paypal.com';
cfg.clientId = process.env.paypal_client_id;
cfg.secret = process.env.paypal_secret;
cfg.brandName = 'test-project';
