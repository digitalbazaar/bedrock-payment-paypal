/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */

const axios = require('axios');
const bedrock = require('bedrock');
const BigNumber = require('bignumber.js');

const logger = require('./logger.js');
const paymentService = require('bedrock-payment');

const {PaymentStatus, Errors} = paymentService;

const {config} = bedrock;
const {BedrockError} = bedrock.util;


// allow paypal secret to be an env variable.
const getConfig = () => {
  const {api, clientId, secret = process.env.paypal_secret} = config.paypal;
  return {api, clientId, secret};
}

// credentials needs on the front end to make payments.
const getGatewayCredentials = () => {
  const {clientId} = getConfig();
  return {paypal_client_id: clientId};
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
const getAuthToken = async (
  {clientId, secret, api}) => {
  if(!clientId || !secret) {
    throw new BedrockError(
      'Missing PayPal clientId and/or secret', Errors.Data);
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
  const {data} = await axios.post(authUrl, body, options);
  return data;
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
  const {access_token, token_type} = await getAuthToken({clientId, secret});
  const Authorization = `${token_type} ${access_token}`;
  const headers = {
    Authorization,
    Accept: 'application/json'
  };
  return {api, headers};
};

/**
 * Gets transactions made via PayPal from start_date to end_date.
 * This is used to check if an incomplete Payment
 * has been completed, rejected, or is in process in PayPal.
 *
 * @param {object} options - Options to use.
 * @param {string|Date} options.start_date - An RFC3339 DateTime.
 * @param {string|Date} options.end_date - An RFC3339 DateTime.
 * @param {number} [options.page = 1] -The page to start on.
 *
 * @returns {Promise<Array<object>>} The transactions from PayPal.
 */
const getTransactions = async ({start_date, end_date, page = 1}) => {
  const {headers, api} = await getOptions();
  const params = {start_date, end_date, page};
  const dates = ['start_date', 'end_date'];
  dates.forEach(dateKey => {
    const value = params[dateKey];
    // if the date is a string make sure it's a valid
    // date and format to RFC3339.
    if(typeof(value) === 'string') {
      params[dateKey] = new Date(value).toISOString();
    }
    // if the dateKey is a Date convert to a string.
    if(value instanceof Date) {
      params[dateKey] = params[dateKey].toISOString();
    }
    // if it's not there use today's date.
    if(!value) {
      params[dateKey] = new Date().toISOString();
    }
  });
  const options = {headers, params};
  const url = `${api}/v1/reporting/transactions`;
  let transactions = [];
  // paypal defaults to 100 transactions per page.
  // if there have been more than 100 transactions since the start
  // and end dates we might have to make multiple calls;
  let totalTransactions = 100;
  while(transactions.length < totalTransactions) {
    try {
      const {data} = await axios.get(url, options);
      totalTransactions = data.total_items;
      transactions = transactions.concat(data.transaction_details || []);
      options.params.page++;
    } catch(e) {
      logger.error('PayPal get transactions error', {error: e});
      totalTransactions = transactions.length;
    }
  }
  // Our local payment id should be the custom_field on a transaction.
  return transactions;
};

/**
 * Gets an order from PayPal to ensure the order was made.
 *
 * @param {object} options - Options to use.
 * @param {object} options.order - The order from the client.
 *
 * @returns {object} The order data from PayPal.
 */
const getOrder = async ({id}) => {
  try {
    const {headers, api} = await getOptions();
    const options = {headers};
    const url = `${api}/v2/checkout/orders/${id}`;
    const {data} = await axios.get(url, options);
    return data;
  } catch(e) {
    logger.error('getOrder not found', {error: e});
    return null;
  }
};

/**
 * Takes in a payment object and uses the service id
 * to find it in the payment gateway.
 *
 * @param {object} options - Options to use.
 * @param {Payment} options.payment - A payment object.
 *
 * @throws {BedrockError} - Throws not NotFound.
 *
 * @returns {Promise<object>} The order from the payment gateway.
 */
const getOrderFromPayment = async ({payment}) => {
  const order = await getOrder({id: payment.serviceId});
  if(!order) {
    const message = 'PayPal order not found.';
    payment.status = PaymentStatus.FAILED;
    payment.error = message;
    paymentService.db.save({payment});
    throw new BedrockError(
      message, Errors.NotFound);
  }
  return order;
};

/**
 * Void payment.
 *
 * @param {object} options - Options to use.
 * @param {object} options.id - Makes sure a payment can not be completed.
 *
 * @returns {object} Removes authorization for a payment.
 */
const voidPayment = async ({id}) => {
  const {headers, api} = await getOptions();
  const options = {headers};
  const url = `${api}/v2/payments/authorizations/` +
    `${encodeURIComponent(id)}/void`;
  const {data} = await axios.get(url, options);
  return data;
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
  const {headers, api} = await getOptions();
  const options = {headers};
  const url = `${api}/v1/checkout/orders/${encodeURIComponent(order.id)}`;
  const {data} = await axios.delete(url, options);
  return data;
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
};

const getTotalCost = ({order}) => {
  const {purchase_units} = order;
  // get the total for the purchase_units.
  const total = purchase_units.reduce((accumulator, current) => accumulator.
    plus(current.amount.value), BigNumber(0));
  return total;
};

const compareAmount = ({order, expectedAmount}) => {
  // get the total for the purchase_units.
  const total = getTotalCost({order});
  const sameAmount = total.isEqualTo(expectedAmount);
  if(!sameAmount) {
    throw new BedrockError(
      `Expected ${expectedAmount} amount got ${total.toString()}`, Errors.Data);
  }
};

const compareAndSwapAmount = async ({payment, amount, expectedAmount}) => {
  // ensure the order is still there.
  const order = await getOrderFromPayment({payment});
  compareAmount({order, expectedAmount});
  const patch = [{
    op: 'replace',
    path: `/purchase_units/@reference_id=='${payment.id}'/amount`,
    value: amount
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
  // FIXME Add a json schema validator here.
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
 *
 * @returns {Promise<object>} Returns the verified PayPal order and purchase.
 */
const verifyOrder = async ({order}) => {
  // An order should never be CREATED
  // at this stage so let's just cancel it.
  if(order.status === 'CREATED') {
    await deleteOrder({order});
    return {};
  }
  if(order.status !== 'COMPLETED') {
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
    // This does keep duplicate charges using the same PayPal order id.
    throw new BedrockError(
      `More than one Payment found for PayPal order ${order.id}`,
      Errors.Duplicate
    );
  }
  verifiedPurchase.totalCost = getTotalCost({order});
  return verifiedPurchase;
};

/**
 * Creates an order server side with no payment
 * information filled out.
 *
 * @param {object} options - Options to use.
 * @param {Array<object>} options.purchase_units - A purchase_unit.
 * @param {string} [options.intent = 'CAPTURE'] - The order intent.
 *
 * @returns {Promise<object>} The order object.
 */
const createOrder = async ({payment, intent = 'CAPTURE'}) => {
  const {id, amount, currency = 'USD'} = payment;
  const purchase_units = [{
    reference_id: id,
    amount: {currency_code: currency, value: amount}
  }];
  const {headers, api} = await getOptions();
  const url = `${api}/v2/checkout/orders`;
  headers['Content-Type'] = 'application/json';
  const options = {headers};
  const body = {
    intent,
    purchase_units
  };
  const {data} = await axios.post(url, body, options);
  return data;
};

const processPayment = async ({payment}) => {
  const order = await getOrderFromPayment({payment});
  const verifiedPurchase = verifyOrder({order});
  return verifiedPurchase;
};

module.exports = {
  type: 'paymentsPayPalPlugin',
  api: {
    getGatewayCredentials,
    compareAndSwapAmount,
    getOrderFromPayment,
    updateOrder,
    deleteOrder,
    voidPayment,
    createOrder,
    verifyOrder,
    getOrder,
    getAuthToken,
    getTransactions,
    process: processPayment
  }
};
