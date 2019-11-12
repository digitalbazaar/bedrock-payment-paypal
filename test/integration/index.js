const chai = require('chai');
const {api} = require('../../index');

const should = chai.should();

describe('getGatewayCredentials', function() {
  it('should return the client id', function() {
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

describe('createGatewayPayment', function() {

  it('should create a payment', async function() {
    const payment = {
      currency: 'USD',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
    const testResult = await api.createGatewayPayment({payment});
    should.exist(testResult);
    testResult.should.be.an('object');
  });

  it('should reject an unsupported currency', async function() {
    const payment = {
      // Aruban florin is not currently supported.
      currency: 'AWG',
      amount: '10.00',
      orderService: 'test-order',
      orderId: 'test-1'
    };
    should.Throw(async () => api.createGatewayPayment({payment}), Error);
  });

});

describe('updateGatewayPaymentAmount', function() {

});

describe('processGatewayPayment', function() {

});
