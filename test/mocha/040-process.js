/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {api, test} = require('bedrock-payment-paypal');
const {cards} = require('../cards');

describe('processGatewayPayment', function() {

  it('should process a created payment', async function() {
    const payment = {
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
    const {order} = await api.createGatewayPayment({payment});
    should.exist(order);
    order.should.be.an('object');
    const card = cards.visa;
    try {
      const paid = await test.capturePaymentOrder({order, card});
      console.log('paid', paid);
    } catch(e) {
      console.error(e.response.data);
    }
  });

  it('should process an updated payment', async function() {

  });

});
