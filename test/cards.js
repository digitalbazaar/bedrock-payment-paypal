/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const address = {
  lineOne: '173 Drury Lane',
  lineTwo: 'Apt 5',
  adminAreaTwo: 'Blacksburg',
  adminAreaOne: 'Virginia',
  postalCode: '24060',
  countryCode: 'US'
};

const cards = {
  visa: {
    name: 'Test User',
    number: '4111111111111111',
    expiry: '12/21',
    securityCode: '317',
    address
  }
};

module.exports = {
  cards
};
