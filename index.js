/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const axios = require('axios');
const bedrock = require('bedrock');
const BigNumber = require('bignumber.js');
const NodeCache = require('node-cache');
const paymentService = require('bedrock-payment');

const logger = require('./logger');
// list of all PayPal Supported currency codes.
const currencies = require('./currencies');
require('./config');

const {PaymentStatus, Errors} = paymentService;

const paypalCache = new NodeCache();

const {config} = bedrock;
const {BedrockError} = bedrock.util;

const codes = {
  notAllowed: new Set([403, 401]),
  constraint: new Set([411, 412, 413, 414, 415, 405]),
  paymentIncomplete: new Set([402]),
  notFound: new Set([404]),
  network: new Set([408]),
  duplicate: new Set([409]),
  missing: new Set([410])
};

const getConfig = () => {
  const {api, clientId, secret} = config.paypal;
  if(!clientId) {
    throw new BedrockError(
      'Missing PayPal clientId in bedrock config.', Errors.Data);
  }

  if(!secret) {
    throw new BedrockError(
      'Missing PayPal secret in bedrock config.', Errors.Data);
  }

  if(!api) {
    throw new BedrockError(
      'Missing PayPal API in bedrock config.', Errors.Data);
  }

  return {api, clientId, secret};
};

// credentials needed on the front end to make payments.
const getGatewayCredentials = () => {
  const {clientId} = getConfig();
  return {paymentService: 'paypal', paypalClientId: clientId};
};

// used to lop off sensitive information from an axios error
const formatAxiosError = ({error}) => {
  const axiosError = error.response || error.request;
  if(axiosError) {
    const {status = 500} = axiosError;
    const {name, message} = error;
    const details = {httpStatusCode: status, name, message};

    if(codes.notAllowed.has(status)) {
      return {details, errorType: Errors.NotAllowed};
    }

    if(codes.constraint.has(status)) {
      return {details, errorType: Errors.Constraint};
    }

    if(codes.paymentIncomplete.has(status)) {
      return {details, errorType: 'PaymentIncomplete'};
    }

    if(codes.notFound.has(status)) {
      return {details, errorType: Errors.NotFound};
    }

    if(codes.network.has(status)) {
      return {details, errorType: Errors.Network};
    }

    if(codes.duplicate.has(status)) {
      return {details, errorType: Errors.Duplicate};
    }

    if(codes.missing.has(status)) {
      return {details, errorType: 'EndpointMissing'};
    }

    if(status >= 500) {
      return {details, errorType: Errors.Network};
    }

    return {details, errorType: Errors.Data};
  }
  // if it's already formatted then just throw.
  if(error instanceof BedrockError) {
    throw error;
  }
  return {details: error, errorType: Errors.Constraint};
};

/**
 * Format Amount - Takes in an amount and formats it.
 *
 * @param {object} options - Options to use.
 * @param {object} options.amount - An amount.
 *
 * @throws DataError - If the currency is not supported by PayPal.
 * @throws DataError - If the amount's value is not a number.
 *
 * @returns {object} A formatted amount.
 */
const formatAmount = ({amount}) => {
  const supported = currencies.supported.has(amount.currency_code);
  if(!supported) {
    throw new BedrockError(
      'Unsupported PayPal currency.',
      Errors.Data, {public: true, currencyCode: amount.currency_code}
    );
  }
  const bigAmount = BigNumber(amount.value);
  const notNumber = bigAmount.toString() === 'NaN';
  if(notNumber) {
    throw new BedrockError(
      'Invalid amount.',
      Errors.Data, {public: true, amount}
    );
  }
  if(currencies.noDecimal.has(amount.currency_code)) {
    amount.value = bigAmount.toFixed(0).toString();
    return amount;
  }
  amount.value = bigAmount.toFixed(2).toString();
  return amount;
};

/**
 * Gets a PayPal auth token so we can call on the api.
 *
 * @param {object} options - Options to use.
 * @param {string} [options.clientId = paypal_client_id] - PayPal Client Id.
 * @param {string} [options.secret = paypal_secret] - PayPal Secret.
 *
 * @returns {Promise<object>} The data returned with an `access_token`.
 */
const getAuthToken = async ({clientId, secret, api}) => {
  const authDataKey = 'authData';
  const authCache = paypalCache.get(authDataKey);
  if(authCache) {
    return authCache;
  }
  const authUrl = `${api}/v1/oauth2/token`;
  const options = {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Language': 'en_US'
    },
    auth: {
      username: clientId,
      password: secret
    }
  };
  const body = 'grant_type=client_credentials';
  try {
    const {data} = await axios.post(authUrl, body, options);
    // cache expires when PayPal says it will expire.
    const {expires_in} = data;
    // expire the cache 5 seconds before PayPal's timeout.
    // or just don't have a time out.
    const expires = expires_in > 5 ? expires_in - 5 : 0;
    paypalCache.set(authDataKey, data, expires);
    return data;
  } catch(error) {
    const {errorType, details} = formatAxiosError({error});
    throw new BedrockError('PayPal Authentication failed.', errorType, details);
  }
};

/**
 * Gets the options needed to make a secure paypal request.
 *
 * @param {object} options - Options to use.
 * @param {string} [options.clientId = paypal_client_id] - PayPal Client Id.
 * @param {string} [options.secret = paypal_secret] - PayPal Secret.
 *
 * @returns {Promise<object>} Settings for paypal.
 */
const getOptions = async ({clientId, secret, api} = getConfig()) => {
  const {access_token, token_type} = await getAuthToken(
    {clientId, secret, api});
  const headers = {
    Authorization: `${token_type} ${access_token}`,
    Accept: 'application/json'
  };
  return {api, headers};
};

/**
 * Gets an order from PayPal to ensure the order was made.
 *
 * @param {object} options - Options to use.
 * @param {object} options.order - The order from the client.
 *
 * @returns {Promise<object|null>} The order data from PayPal.
 */
const getOrder = async ({id}) => {
  try {
    const {headers, api} = await getOptions();
    const options = {headers};
    const url = `${api}/v2/checkout/orders/${encodeURIComponent(id)}`;
    const {data} = await axios.get(url, options);
    return data;
  } catch(e) {
    if(e.response && e.response.status === 404) {
      throw new BedrockError(
        'PayPal order not found.',
        Errors.NotFound, {httpStatusCode: 404, public: true, payPalId: id});
    }
    const {details, errorType} = formatAxiosError({error: e});
    throw new BedrockError('Get Order Failed.', errorType, details);
  }
};

/**
 * Takes in a payment object and uses the service id
 * to find it in the payment gateway.
 *
 * @param {object} options - Options to use.
 * @param {object} options.payment - A payment object.
 *
 * @throws {BedrockError} - Throws not NotFound.
 *
 * @returns {Promise<object>} The order from the payment gateway.
 */
const getOrderFromPayment = async ({payment}) => {
  try {
    const order = await getOrder({id: payment.paymentServiceId});
    return order;
  } catch(e) {
    const message = 'PayPal order not found.';
    payment.status = PaymentStatus.FAILED;
    payment.error = message;
    await paymentService.db.save({payment});
    throw e;
  }
};

/**
 * Delete order only works on orders where no money has been exchanged.
 * That means status is either CREATED or APPROVED.
 *
 * @param {object} options - Options to use.
 * @param {object} options.order - Order being canceled.
 *
 * @returns {Promise<object>} Cancels and Deletes an order.
 */
const deleteOrder = async ({order}) => {
  try {
    const {headers, api} = await getOptions();
    const options = {headers};
    const url = `${api}/v1/checkout/orders/${encodeURIComponent(order.id)}`;
    const {data} = await axios.delete(url, options);
    return data;
  } catch(error) {
    const {errorType, details} = formatAxiosError({error});
    throw new BedrockError('Delete Order Failed.', errorType, details);
  }
};

/**
 * Updates an order's purchase_units amount by reference_id.
 * This can only run on orders that are CREATED or APPROVED.
 *
 * @param {object} options - Options to use.
 * @param {object} options.order - Order being modified.
 * @param {Array<object>} options.patch - A JSON patch with a purchase_unit
 *   reference_id in it's path.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_patch
 *
 * @returns {Promise<object|null>} Updated order.
 */
const updateOrder = async ({order, patch}) => {
  try {
    const {headers, api} = await getOptions();
    headers['Content-Type'] = 'application/json';
    const options = {headers};
    logger.debug(`updating order ${order.id}`);
    const url = `${api}/v2/checkout/orders/${encodeURIComponent(order.id)}`;
    logger.debug(`UPDATING ORDER ${order.id}`, {url, patch});
    // patch method returns nothing
    await axios.patch(url, patch, options);
    const updatedOrder = await getOrder({id: order.id});
    logger.debug('ORDER PATCHED', {updatedOrder, patch});
    return updatedOrder;
  } catch(error) {
    const {errorType, details} = formatAxiosError({error});
    throw new BedrockError('Update Order Failed.', errorType, details);
  }
};

/**
 * Gets the total cost of a PayPal order.
 *
 * @param {object} options - Options to use.
 * @param {object} options.order - A PayPal order.
 *
 * @returns {BigNumber} The total of the PayPal order.
 */
const getTotalCost = ({order}) => {
  const {purchase_units} = order;
  // get the total for the purchase_units.
  const total = purchase_units.reduce((accumulator, current) => accumulator.
    plus(current.amount.value), BigNumber(0));
  // there should only be one currency
  const currencies = new Set(purchase_units.map(pu => pu.amount.currency_code));
  return {total, currencies};
};

/**
 * Compares the amount of a PayPal order and an amount.
 *
 * @param {object} options - Options to use.
 * @param {object} options.order - A PayPal order.
 * @param {BigNumber|number|string} options.expectedAmount - The
 *   expected amount.
 *
 * @returns {boolean} True is the amounts equal.
 */
const compareAmount = ({order, expectedAmount}) => {
  // get the total for the purchase_units.
  const {total, currencies} = getTotalCost({order});
  const sameAmount = total.isEqualTo(expectedAmount.value);
  if(!sameAmount) {
    throw new BedrockError(
      `Expected ${expectedAmount.value} amount got ${total.toString()}.`,
      Errors.Data
    );
  }
  const sameCurrency = currencies.has(expectedAmount.currency_code);
  if(!sameCurrency) {
    throw new BedrockError(
      'Unexpected currency.',
      Errors.Data, {public: true, currencyCode: expectedAmount.currency_code}
    );
  }
  return true;
};

/**
 * Checks that the existing PayPal order is there
 * and match the expectedAmount.
 *
 * @param {object} options - Options to use.
 * @param {object} options.payment - A Bedrock payment.
 * @param {object} options.amount - A Paypal amount object.
 * @param {BigNumber|number|string} options.expectedAmount - How is expected.
 *
 * @returns {object} The updated paypal order.
 */
const updateGatewayPaymentAmount = async (
  {pendingPayment, updatedPayment}) => {
  const expectedAmount = {
    currency_code: pendingPayment.currency,
    value: pendingPayment.amount
  };
  const amount = {
    currency_code: updatedPayment.currency,
    value: updatedPayment.amount
  };
  // ensure the order is still there.
  const order = await getOrderFromPayment({payment: pendingPayment});
  const value = formatAmount({amount});
  compareAmount({order, expectedAmount});
  const patch = [{
    op: 'replace',
    path: `/purchase_units/@reference_id=='${pendingPayment.id}'/amount`,
    value
  }];
  const updatedOrder = await updateOrder({order, patch});
  // make sure the swap occurred.
  compareAmount({order: updatedOrder, expectedAmount: amount});
  const payment = Object.assign(pendingPayment, updatedPayment);
  return {updatedOrder, payment};
};

/**
 * This first checks to ensure the client's order matches
 * a valid PayPal Order.
 *
 * @param {object} options - Options to use.
 * @param {Array<object>} options.clientPurchases - Client purchases.
 * @param {Array<object>} options.paypalPurchases - PayPal purchases.
 *
 * @returns {object} A verified purchase.
 */
const verifyPurchase = ({paypalPurchases}) => {
  // PayPal currently only supports one purchase_item at a time.
  // Hence we use the first purchase_item.
  // This will need to be refactored if we allow a user
  // to purchase more than one product in an order or PayPal allows
  // more than one purchase_unit per order.
  //
  if(!paypalPurchases) {
    throw new BedrockError('Missing PayPal purchases.', Errors.Data);
  }
  const [paypalPurchase] = paypalPurchases;
  if(!paypalPurchase) {
    throw new BedrockError('Missing PayPal purchase.', Errors.Data);
  }
  // throw an error if the client altered their purchase amount
  // after the transaction succeeded.
  return paypalPurchase;
};

/**
 * Gets the order from PayPal then ensures the client's order
 * matches the order from PayPal.
 *
 * @param {object} options - Options to use.
 * @param {object} options.order - Client's PayPal order.
 * @param {object} options.payment - Bedrock Payment class.
 *
 * @returns {Promise<object>} Returns the verified PayPal order and purchase.
 */
const verifyOrder = async ({order, payment}) => {
  // An order should never be CREATED
  // at this stage so let's just cancel it.
  if(order.status === 'CREATED') {
    await deleteOrder({order});
    payment.status = PaymentStatus.VOIDED;
    await paymentService.db.save({payment});
    throw new BedrockError(
      'PayPal order Canceled.',
      Errors.Data,
      {public: true, payPalId: order.id}
    );
  }
  // If the status is not COMPLETED then
  // something went wrong with the user's payment.
  if(order.status !== 'COMPLETED') {
    payment.status = PaymentStatus.FAILED;
    await paymentService.db.save({payment});
    throw new BedrockError(
      'Expected PayPal Status COMPLETED.',
      Errors.Data, {payPalStatus: order.status}
    );
  }
  const {purchase_units: paypalPurchases} = order;
  const verifiedPurchase = verifyPurchase({paypalPurchases});
  // Guards against the user re-using a previous order from PayPal.
  const existingPayments = await paymentService.db.findAll(
    {query: {paymentService: 'paypal', paymentServiceId: order.id}});
  // there should be at most 1 existingPayments.
  if(existingPayments.length > 1) {
    // This could be problematic as the user whose card was
    // charged might not get their product.
    // This does prevent duplicate charges using the same PayPal order id.
    throw new BedrockError(
      'More than one Payment found for PayPal order.',
      Errors.Duplicate, {payPalId: order.id}
    );
  }
  const {total} = getTotalCost({order});
  verifiedPurchase.totalCost = total;
  return verifiedPurchase;
};

/**
 * Creates a PayPal order server side with no payment
 * information filled out.
 *
 * @param {object} options - Options to use.
 * @param {Array<object>} options.purchase_units - A purchase_unit.
 * @param {string} [options.intent = 'CAPTURE'] - The order intent.
 *
 * @returns {Promise<object>} The order object.
 */
const createGatewayPayment = async ({payment, intent = 'CAPTURE'}) => {
  try {
    const {id, amount: value, currency = 'USD'} = payment;
    const amount = formatAmount({amount: {currency_code: currency, value}});
    const purchase_units = [{
      reference_id: id,
      amount
    }];
    const {brandName, shippingPreference} = config.paypal;
    const application_context = {
      brand_name: brandName || 'bedrock-order',
      shipping_preference: shippingPreference || 'NO_SHIPPING'
    };
    logger.debug('ORDER APPLICATION CONTEXT', {application_context});
    const {headers, api} = await getOptions();
    const url = `${api}/v2/checkout/orders`;
    headers['Content-Type'] = 'application/json';
    const options = {headers};
    const body = {
      intent,
      purchase_units,
      application_context
    };
    const {data} = await axios.post(url, body, options);
    payment.paymentServiceId = data.id;
    return {order: data, payment};
  } catch(error) {
    const {errorType, details} = formatAxiosError({error});
    throw new BedrockError(
      'Create Gateway Payment Failed.', errorType, details);
  }
};

const processGatewayPayment = async ({payment}) => {
  const order = await getOrderFromPayment({payment});
  const verifiedPurchase = verifyOrder({order, payment});
  return verifiedPurchase;
};

/**
 * This is only used in the tests to simulate
 * credit card failures.
 *
 * @param {object} options - Options to use.
 * @param {object} options.order - A PayPal order object.
 * @param {object} options.card - The payee's card.
 *
 * @returns {object} The result of the payment capture.
 */
const capturePaymentOrder = async ({order, body = {}}) => {
  const {headers, api} = await getOptions();
  const url = `${api}/v2/checkout/orders/` +
    `${encodeURIComponent(order.id)}/capture`;
  headers['Content-Type'] = 'application/json';
  const options = {headers};
  const {data} = await axios.post(url, body, options);
  return data;
};

module.exports = {
  id: 'PayPal',
  type: 'paymentPlugin',
  api: {
    getGatewayCredentials,
    updateGatewayPaymentAmount,
    createGatewayPayment,
    processGatewayPayment
  },
  test: {
    capturePaymentOrder
  }
};
