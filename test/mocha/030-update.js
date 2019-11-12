const bedrock = require('bedrock');
const chai = require('chai');
const {api} = require('bedrock-payment-paypal');
const {Errors} = require('bedrock-payment');

const {BedrockError} = bedrock.util;

const should = chai.should();

describe('updateGatewayPaymentAmount', function() {
  it('should update a valid payment.', async function() {
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
  });
  it('should reject an invalid amount.', async function() {
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
      amount: null,
      orderService: 'test-order',
      orderId: 'test-1'
    };
    let result, error = null;
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
