/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';
const {config} = require('bedrock');
const path = require('path');
const axios = require('axios');
const nodeAdapter = require('axios/lib/adapters/http');
axios.defaults.adapter = nodeAdapter;
require('bedrock-payment-paypal');

const runUnitTests = true;

if(runUnitTests) {
  config.mocha.tests.push(path.join(__dirname, 'mocha'));
} else {
  // these tests make real real calls on the PayPal API
  config.mocha.tests.push(path.join(__dirname, 'integration'));
}

const cfg = config.paypal;
cfg.api = 'https://api.sandbox.paypal.com';
// you will need to set these env variables before integration testing
cfg.clientId = process.env.paypal_client_id || 'testId';
cfg.secret = process.env.paypal_secret || 'testSecret';
cfg.brandName = 'test-project';
