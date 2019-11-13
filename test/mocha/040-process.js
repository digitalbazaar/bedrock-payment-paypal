/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';
const bedrock = require('bedrock');
const {api, test} = require('bedrock-payment-paypal');
const {cards} = require('../cards');
const {fillInCard} = require('../helper');

const minute = 60000;
const threeMinutes = 3 * minute;

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
      await test.capturePaymentOrder({order});
      const processed = await api.processGatewayPayment({payment});
      console.log('processed', processed);
    } catch(e) {
      console.error(e);
    }
  }).timeout(threeMinutes);

  it('should process an updated payment', async function() {

  });

});
