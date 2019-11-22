/**!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const nock = require('nock');
const {api} = require('bedrock-payment-paypal');
const {util} = require('bedrock');
const {Errors} = require('bedrock-payment');
const {stubs} = require('../mock-paypal');

const {BedrockError} = util;

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
    stubs.get({id: paypalId, referenceId: payment.id, status: 'COMPLETED'});
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
    const {order} = stubs.get(
      {id: paypalId, referenceId: payment.id, status: 'VOIDED'});
    const expectedError = new BedrockError(
      'Expected PayPal Status COMPLETED.',
      Errors.Data, {payPalStatus: order.status}
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
    const {stub} = stubs.get(
      {id: paypalId, referenceId: payment.id, status: 'CREATED'});
    stub.delete(() => true).reply(204);
    const expectedError = new BedrockError(
      'PayPal order Canceled.', Errors.Data,
      {public: true, payPalId: paypalId});
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

});
