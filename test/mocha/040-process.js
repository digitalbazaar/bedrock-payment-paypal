/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';
const bedrock = require('bedrock');
const nock = require('nock');
const {api} = require('bedrock-payment-paypal');
const {util, config} = require('bedrock');
const {Errors} = require('bedrock-payment');
const {mockPaypal} = require('../mock-paypal');

const {BedrockError} = util;
const minute = 60000;
const fiveMinutes = 5 * minute;
const {api: baseURL} = config.paypal;

describe('processGatewayPayment', function() {
  beforeEach(function() {
    if(!nock.isActive()) {
      nock.activate();
    }
  });

  afterEach(function() {
    nock.restore();
  });

  it('should process a COMPLETED paypal payment', async function() {
    const paypalId = `urn:uuid:${bedrock.util.uuid()}`;
    const payment = {
      id: `urn:uuid:${bedrock.util.uuid()}`,
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1',
      paymentService: 'paypal',
      paymentServiceId: paypalId
    };
    const order = mockPaypal(
      {id: paypalId, referenceId: payment.id, status: 'COMPLETED'});
    const mockUrl = `/v2/checkout/orders/${encodeURIComponent(paypalId)}`;
    nock(baseURL).get(mockUrl).reply(200, order);
    const processed = await api.processGatewayPayment({payment});
    should.exist(processed);
    processed.should.be.an('object');
    should.exist(processed.totalCost);
  });

  it('should not process a VOIDED paypal payment', async function() {
    const paypalId = `urn:uuid:${bedrock.util.uuid()}`;
    const payment = {
      id: `urn:uuid:${bedrock.util.uuid()}`,
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1',
      paymentService: 'paypal',
      paymentServiceId: paypalId
    };
    const order = mockPaypal(
      {id: paypalId, referenceId: payment.id, status: 'VOIDED'});
    const mockUrl = `/v2/checkout/orders/${encodeURIComponent(paypalId)}`;
    nock(baseURL).get(mockUrl).reply(200, order);
    const expectedError = new BedrockError(
      `Expected PayPal Status COMPLETED got ${order.status}.`,
      Errors.Data
    );
    let result, error = null;
    try {
      result = await api.processGatewayPayment({payment});
    } catch(e) {
      error = e;
    }
    should.exist(error);
    error.should.be.an('object');
    error.should.deep.equal(expectedError);
    should.not.exist(result);
  });

  it('should not process a CREATED paypal payment', async function() {
    const paypalId = `urn:uuid:${bedrock.util.uuid()}`;
    const payment = {
      id: `urn:uuid:${bedrock.util.uuid()}`,
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1',
      paymentService: 'paypal',
      paymentServiceId: paypalId
    };
    const order = mockPaypal(
      {id: paypalId, referenceId: payment.id, status: 'CREATED'});
    const mockUrl = `/v2/checkout/orders/${encodeURIComponent(paypalId)}`;
    nock(baseURL).
      get(mockUrl).reply(200, order).
      delete(() => true).reply(204);
    const expectedError = new BedrockError(
      'PayPal order Canceled.', Errors.Data, {public: true});
    let result, error = null;
    try {
      result = await api.processGatewayPayment({payment});
    } catch(e) {
      error = e;
    }
    should.exist(error);
    error.should.be.an('object');
    error.should.deep.equal(expectedError);
    should.not.exist(result);
  }).timeout(fiveMinutes);

});
