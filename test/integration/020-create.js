/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {api} = require('bedrock-payment-paypal');
const {util} = require('bedrock');
const {Errors} = require('bedrock-payment');

const {BedrockError} = util;
const minute = 60000;
const twoMinutes = minute * 2;

describe('createGatewayPayment', function() {

  it('should create a payment.', async function() {
    const payment = {
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
    const testResult = await api.createGatewayPayment({payment});
    should.exist(testResult);
    testResult.should.be.an('object');
  }).timeout(twoMinutes);

  it('should reject a payment without an amount.', async function() {
    const amount = null;
    const payment = {
      currency: 'USD',
      amount,
      orderService: 'test-order',
      orderId: 'test-1'
    };
    const expectedError = new BedrockError(
      'Invalid amount.',
      Errors.Data, {public: true, amount: {
        currency_code: payment.currency, value: payment.amount}}
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
      'Unsupported PayPal currency.',
      Errors.Data, {public: true, currencyCode: currency}
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
