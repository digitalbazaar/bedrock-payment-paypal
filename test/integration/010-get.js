/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {api} = require('bedrock-payment-paypal');

describe('getGatewayCredentials', function() {
  it('should return the client Id.', function() {
    const credentials = api.getGatewayCredentials();
    should.exist(credentials);
    credentials.should.be.an('object');
    should.exist(credentials.paymentService);
    credentials.paymentService.should.be.a('string');
    credentials.paymentService.should.equal('paypal');
    should.exist(credentials.paypalClientId);
    credentials.paypalClientId.should.be.a('string');
  });
});

