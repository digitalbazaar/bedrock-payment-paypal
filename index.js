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

const {PaymentStatus, Errors} = paymentService;

const paypalCache = new NodeCache();

const {config} = bedrock;
const {BedrockError} = bedrock.util;

const getConfig = () => {
  const {api, clientId, secret} = config.paypal;
  if(!clientId) {
    throw new BedrockError(
      'Missing PayPal clientId', Errors.Data);
  }

  if(!secret) {
    throw new BedrockError(
      'Missing PayPal secret', Errors.Data);
  }

  if(!api) {
    throw new BedrockError(
      'Missing PayPal API.', Errors.Data);
  }

  return {api, clientId, secret};
};

// credentials needed on the front end to make payments.
const getGatewayCredentials = () => {
  const {clientId} = getConfig();
  return {service: 'paypal', paypalClientId: clientId};
};

// used to lop off sensitive information from an axios error
const formatAxiosError = ({error, cause, type = Errors.Data}) => {
  if(error.response || error.request) {
    const {status = 500} = error.response || error.request || {};
    const {name, message} = error;
    const errorType = status === 401 ? 'NotAllowedError' : type;
    return new BedrockError(
      cause, errorType, {httpStatusCode: status, name, message});
  }
  return error;
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
      `Unsupported PayPal currency ${amount.currency_code}`,
      Errors.Data, {public: true}
    );
  }
  const bigAmount = BigNumber(amount.value);
  const notNumber = bigAmount.toString() === 'NaN';
  if(notNumber) {
    throw new BedrockError(
      `Invalid amount ${amount.value} ${amount.currency_code}`,
      Errors.Data, {public: true}
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
    throw formatAxiosError({error, cause: 'PayPal Authentication failed.'});
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
  const Authorization = `${token_type} ${access_token}`;
  const headers = {
    Authorization,
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
    const url = `${api}/v2/checkout/orders/${id}`;
    const {data} = await axios.get(url, options);
    return data;
  } catch(e) {
    if(e.response && e.response.status === 404) {
      throw new BedrockError(
        `PayPal order ${id} not found.`,
        Errors.NotFound, {httpStatusCode: 404, public: true});
    }
    throw formatAxiosError({error: e, cause: 'getOrder failed'});
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
    const order = await getOrder({id: payment.serviceId});
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
    throw formatAxiosError({error, cause: 'deleteOrder failed'});
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
    throw formatAxiosError({error, cause: 'updateOrder'});
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
  return total;
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
  const total = getTotalCost({order});
  const sameAmount = total.isEqualTo(expectedAmount);
  if(!sameAmount) {
    throw new BedrockError(
      `Expected ${expectedAmount} amount got ${total.toString()}`, Errors.Data);
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
  {payment, amount, expectedAmount}) => {
  // ensure the order is still there.
  const order = await getOrderFromPayment({payment});
  const value = formatAmount({amount});
  compareAmount({order, expectedAmount});
  const patch = [{
    op: 'replace',
    path: `/purchase_units/@reference_id=='${payment.id}'/amount`,
    value
  }];
  const updatedOrder = await updateOrder({order, patch});
  // make sure the swap occurred.
  compareAmount({order: updatedOrder, expectedAmount: amount.value});
  return updatedOrder;
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
    throw new BedrockError('Missing PayPal purchases', Errors.Data);
  }
  const [paypalPurchase] = paypalPurchases;
  if(!paypalPurchase) {
    throw new BedrockError('Missing PayPal purchase', Errors.Data);
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
      'PayPal order Cancelled', Errors.Data, {public: true});
  }
  // If the status is not COMPLETED then
  // something went wrong with the user's payment.
  if(order.status !== 'COMPLETED') {
    payment.status = PaymentStatus.FAILED;
    await paymentService.db.save({payment});
    throw new BedrockError(
      `Expected PayPal Status COMPLETED got ${order.status}`,
      Errors.Data);
  }
  const {purchase_units: paypalPurchases} = order;
  const verifiedPurchase = verifyPurchase({paypalPurchases});
  // Guards against the user re-using a previous order from PayPal.
  const existingPayments = await paymentService.db.findAll(
    {query: {service: 'paypal', serviceId: order.id}});
  // there should be at most 1 existingPayments.
  if(existingPayments.length > 1) {
    // This could be problematic as the user whose card was
    // charged might not get their product.
    // This does prevent duplicate charges using the same PayPal order id.
    throw new BedrockError(
      `More than one Payment found for PayPal order ${order.id}`,
      Errors.Duplicate
    );
  }
  verifiedPurchase.totalCost = getTotalCost({order});
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
    return data;
  } catch(error) {
    throw formatAxiosError({error, cause: 'createGatewayPayment'});
  }
};

const processGatewayPayment = async ({payment}) => {
  const order = await getOrderFromPayment({payment});
  const verifiedPurchase = verifyOrder({order, payment});
  return verifiedPurchase;
};

module.exports = {
  id: 'PayPal',
  type: 'paymentPlugin',
  api: {
    getGatewayCredentials,
    updateGatewayPaymentAmount,
    createGatewayPayment,
    processGatewayPayment
  }
};
