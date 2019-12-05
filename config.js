/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {util} = require('bedrock');

const c = util.config.main;
const cc = c.computer();

cc('bedrock-payment-paypal', {
  api: null,
  clientId: null,
  secret: null,
  brandName: null
});
