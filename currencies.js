/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

// https://developer.paypal.com/docs/api/reference/currency-codes/
const supported = new Set([
  'AUD',
  'BRL',
  'CAD',
  'CZK',
  'DKK',
  'EUR',
  'HKD',
  'HUF',
  'INR',
  'ILS',
  'JPY',
  'MYR',
  'MXN',
  'TWD',
  'NZD',
  'NOK',
  'PHP',
  'PLN',
  'GBP',
  'RUB',
  'SGD',
  'SEK',
  'CHF',
  'THB',
  'USD'
]);

// these currencies do not support decimal places
const noDecimal = new Set(['HUF', 'JPY', 'TWD']);

module.exports = {supported, noDecimal};
