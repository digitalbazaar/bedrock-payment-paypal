/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';
const bedrock = require('bedrock');
const {api} = require('bedrock-payment-paypal');
const {cards} = require('../cards');
const {fillInCard} = require('../helper');

const minute = 60000;
const fiveMinutes = 5 * minute;

describe('processGatewayPayment', function() {

  it('should process a created payment', async function() {
    const paymentData = {
      id: `urn:uuid:${bedrock.util.uuid()}`,
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
    const {order, payment} = await api.createGatewayPayment(
      {payment: paymentData});
    should.exist(order);
    order.should.be.an('object');
    const card = cards.visa;
    try {
      await fillInCard({card, order});
    } catch(e) {
      console.error(e);
      throw e;
    }
    const processed = await api.processGatewayPayment({payment});
    should.exist(processed);
    processed.should.be.an('object');
    should.exist(processed.totalCost);
  }).timeout(fiveMinutes);

  it('should process an updated payment', async function() {
    const initialPayment = {
      id: `urn:uuid:${bedrock.util.uuid()}`,
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
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
    const updateResult = await api.updateGatewayPaymentAmount(
      {updatedPayment, pendingPayment});
    should.exist(updateResult);
    const {updatedOrder: order, payment} = updateResult;
    const card = cards.visa;
    try {
      await fillInCard({card, order});
    } catch(e) {
      console.error(e);
      throw e;
    }
    const processed = await api.processGatewayPayment({payment});
    should.exist(processed);
    processed.should.be.an('object');
    should.exist(processed.totalCost);
  }).timeout(fiveMinutes);

});
