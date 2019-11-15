/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {api} = require('bedrock-payment-paypal');
const {util} = require('bedrock');
const nock = require('nock');
const {Errors} = require('bedrock-payment');
const {stubs} = require('../mock-paypal');

const {BedrockError} = util;

describe('createGatewayPayment', function() {
  beforeEach(function() {
    if(!nock.isActive()) {
      nock.activate();
    }
    stubs.auth();
  });

  afterEach(function() {
    nock.restore();
  });

  it('should create a payment.', async function() {
    const paypalId = `urn:uuid:${util.uuid()}`;
    const payment = {
      id: `urn:uuid:${util.uuid()}`,
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
    stubs.create({id: paypalId, referenceId: payment.id});
    const testResult = await api.createGatewayPayment({payment});
    should.exist(testResult);
    testResult.should.be.an('object');
  });

  it('should reject a payment without an amount.', async function() {
    const amount = null;
    const payment = {
      currency: 'USD',
      amount,
      orderService: 'test-order',
      orderId: 'test-1'
    };
    const expectedError = new BedrockError(
      `Invalid amount ${payment.amount} ${payment.currency}.`,
      Errors.Data, {public: true}
    );
    let result, error = null;
    try {
      result = await api.createGatewayPayment({payment});
    } catch(e) {
      error = e;
    }
    should.not.exist(result);
    should.exist(error);
    error.should.deep.equal(expectedError);
  });

  it('should reject an unsupported currency.', async function() {
    const currency = 'AWG';
    const payment = {
      // Aruban florin is not currently supported.
      currency,
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
    const expectedError = new BedrockError(
      `Unsupported PayPal currency ${currency}.`,
      Errors.Data, {public: true}
    );

    let result, error = null;
    try {
      result = await api.createGatewayPayment({payment});
    } catch(e) {
      error = e;
    }
    should.not.exist(result);
    should.exist(error);
    error.should.deep.equal(expectedError);
  });

});
