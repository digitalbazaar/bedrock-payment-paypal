const {config} = require('bedrock');
const nock = require('nock');

const urls = {
  create: '/v2/checkout/orders',
  auth: '/v1/oauth2/token',
  base: config.paypal.api,
  byId(id) {
    return `/v2/checkout/orders/${encodeURIComponent(id)}`;
  }
};

const defaultAmount = {
  currency_code: 'USD',
  value: '10.00'
};

/**
 * Returns a mock paypal object suitable for sinon stubs.
 *
 * @param {object} options - Options to use.
 * @param {string} options.id - A mock PayPal Id.
 * @param {string} options.referenceId - Usually the payment id.
 * @param {string} options.status - One of paypal' order status enums.
 * @param {object} options.amount - The amount paid.
 *
 * @returns {object} A fake paypal object.
 */
const mockPaypal = ({id, referenceId, status, amount = defaultAmount}) => ({
  id,
  intent: 'CAPTURE',
  purchase_units: [
    {
      reference_id: referenceId,
      amount,
      payee: {
        email_address: 'test-user@business.example.com',
        merchant_id: '4GT7TC6JUVBN4',
        display_data: {
          brand_name: 'test-project'
        }
      },
      soft_descriptor: 'PAYPAL *JOHNDOESTES',
      payments: {
        captures: [
          {
            id: '3KL06921D8866534V',
            status,
            amount: {
              currency_code: 'USD',
              value: '10.00'
            },
            final_capture: true,
            seller_protection: {
              status: 'ELIGIBLE',
              dispute_categories: [
                'ITEM_NOT_RECEIVED',
                'UNAUTHORIZED_TRANSACTION'
              ]
            },
            seller_receivable_breakdown: {
              gross_amount: {
                currency_code: 'USD',
                value: '10.00'
              },
              paypal_fee: {
                currency_code: 'USD',
                value: '0.59'
              },
              net_amount: {
                currency_code: 'USD',
                value: '9.41'
              }
            },
            links: [
              {
                href: `https://api.sandbox.paypal.com/v2/payments/captures/${id}`,
                rel: 'self',
                method: 'GET'
              },
              {
                href: `https://api.sandbox.paypal.com/v2/payments/captures/${id}/refund`,
                rel: 'refund',
                method: 'POST'
              },
              {
                href: `https://api.sandbox.paypal.com/v2/checkout/orders/${id}`,
                rel: 'up',
                method: 'GET'
              }
            ],
            create_time: '2019-11-14T15:30:43Z',
            update_time: '2019-11-14T15:30:43Z'
          }
        ]
      }
    }
  ],
  payer: {
    name: {
      given_name: 'FirstName',
      surname: 'LastName'
    },
    email_address: 'tester@digitalbazaar.com',
    payer_id: 'CMMFJH385HWXE',
    address: {
      country_code: 'US'
    }
  },
  create_time: new Date().toISOString(),
  update_time: new Date().toISOString(),
  links: [
    {
      href: `https://api.sandbox.paypal.com/v2/checkout/orders/${id}`,
      rel: 'self',
      method: 'GET'
    }
  ],
  status
});

const create = ({id, referenceId, amount = defaultAmount}) => {
  const order = mockPaypal({id, referenceId, status: 'CREATED', amount});
  const stub = nock(urls.base).post(urls.create).reply(200, order);
  return {order, stub};
};

const auth = (credentials = {}) =>
  nock(urls.base).post(urls.auth).reply(200, credentials);

const get = ({id, referenceId, amount = defaultAmount, status}) => {
  const order = mockPaypal({id, referenceId, status, amount});
  const mockUrl = urls.byId(id);
  const stub = nock(urls.base).get(mockUrl).reply(200, order);
  return {order, stub, mockUrl};
};

const stubs = {
  create, auth, get
};

module.exports = {
  mockPaypal, stubs
};
