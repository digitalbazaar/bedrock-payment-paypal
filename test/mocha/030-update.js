/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config, util} = require('bedrock');
const {api} = require('bedrock-payment-paypal');
const {Errors} = require('bedrock-payment');
const nock = require('nock');
const {mockPaypal, stubs} = require('../mock-paypal');

const {api: baseURL} = config.paypal;
const {BedrockError} = util;

const minute = 60000;
const twoMinutes = minute * 2;

describe('updateGatewayPaymentAmount', function() {
  beforeEach(function() {
    if(!nock.isActive()) {
      nock.activate();
    }
    stubs.auth();
  });

  afterEach(function() {
    nock.restore();
  });

  it('should update a valid payment.', async function() {
    const paypalId = `urn:uuid:${util.uuid()}`;
    const initialPayment = {
      id: `urn:uuid:${util.uuid()}`,
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
    stubs.create({id: paypalId, referenceId: initialPayment.id});
    const createResult = await api.createGatewayPayment(
      {payment: initialPayment});
    should.exist(createResult);
    const {payment: pendingPayment} = createResult;
    const updatedPayment = {
      id: pendingPayment.id,
      currency: 'USD',
      amount: '100.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
    stubs.get(
      {id: paypalId, referenceId: initialPayment.id, status: 'CREATED'});
    const updateResult = await api.updateGatewayPaymentAmount(
      {updatedPayment, pendingPayment});
    should.exist(updateResult);
  }).timeout(twoMinutes);

  it('should reject an invalid amount.', async function() {
    const paypalId = `urn:uuid:${util.uuid()}`;
    const initialPayment = {
      id: `urn:uuid:${util.uuid()}`,
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
    stubs.create({id: paypalId, referenceId: initialPayment.id});
    const createResult = await api.createGatewayPayment(
      {payment: initialPayment});
    should.exist(createResult);
    const {payment: pendingPayment} = createResult;
    const updatedPayment = {
      id: pendingPayment.id,
      currency: 'USD',
      amount: null,
      orderService: 'test-order',
      orderId: 'test-1'
    };
    let result, error = null;
    stubs.get(
      {id: paypalId, referenceId: initialPayment.id, status: 'CREATED'});
    try {
      result = await api.updateGatewayPaymentAmount(
        {updatedPayment, pendingPayment});
    } catch(e) {
      error = e;
    }
    should.exist(error);
    should.not.exist(result);
    const expectedError = new BedrockError(
      `Invalid amount ${updatedPayment.amount} ${updatedPayment.currency}.`,
      Errors.Data, {public: true}
    );
    error.should.deep.equal(expectedError);
  });

});
