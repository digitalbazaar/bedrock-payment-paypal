/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';
const {config} = require('bedrock');
const path = require('path');
require('bedrock-payment-paypal');

config.mocha.tests.push(path.join(__dirname, 'mocha'));

const cfg = config.paypal;
cfg.api = 'https://api.sandbox.paypal.com';
// you will need to set these env variables before testing
cfg.clientId = process.env.paypal_client_id;
cfg.secret = process.env.paypal_secret;
cfg.brandName = 'test-project';
