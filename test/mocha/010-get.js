const chai = require('chai');
const {api} = require('bedrock-payment-paypal');

const should = chai.should();

describe('getGatewayCredentials', function() {
  it('should return the client Id.', function() {
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

