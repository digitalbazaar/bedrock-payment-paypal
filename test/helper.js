/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const puppeteer = require('puppeteer');
const {test} = require('bedrock-payment-paypal');

const setInputValue = async ({selector, value, page}) => {
  await page.focus(selector);
  await page.keyboard.type(value, {delay: 200});
};

const selectors = {
  form: 'form#singlePagePaymentForm',
  accountBtn: 'a#createAccount',
  card: {
    number: 'input[name="cardNumber"]',
    expires: 'input[name="expiry_value"]',
    securityCode: 'input[name="cvv"]',
    firstName: 'input#firstName',
    lastName: 'input#lastName'
  },
  address: {
    lineOne: 'input#billingLine1',
    lineTwo: 'input#billingLine2',
    city: 'input#billingCity',
    state: 'select[name="billingState"]',
    zipCode: 'input#billingPostalCode'
  },
  contact: {
    phone: 'input#telephone',
    email: 'input#email'
  },
  noSignUp: 'input#guestSignup2 + label',
  continueBtn: 'button[type="submit"]'
};

const fillInCard = async ({card, order}) => {
  const {href: approvalLink} = order.links.find(l => l.rel === 'approve');
  if(!approvalLink) {
    throw new Error('approvalLink required');
  }
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(approvalLink);
  const creditCardButton = await page.$(selectors.accountBtn);
  await creditCardButton.click();
  await page.waitForSelector(selectors.form);
  await setInputValue({
    selector: selectors.card.number,
    page,
    value: card.number
  });
  await setInputValue({
    selector: selectors.card.expires,
    page,
    value: card.expiry
  });
  await setInputValue({
    selector: selectors.card.securityCode,
    page,
    value: card.securityCode
  });
  await setInputValue({
    selector: selectors.card.firstName,
    page,
    value: 'FirstName'
  });
  await setInputValue({
    selector: selectors.card.lastName,
    page,
    value: 'LastName'
  });
  await setInputValue({
    selector: selectors.address.lineOne,
    page,
    value: card.address.lineOne
  });
  await setInputValue({
    selector: selectors.address.lineTwo,
    page,
    value: card.address.lineTwo
  });
  await setInputValue({
    selector: selectors.address.city,
    page,
    value: card.address.adminAreaTwo
  });
  await setInputValue({
    selector: selectors.address.state,
    page,
    value: card.address.adminAreaOne
  });
  await setInputValue({
    selector: selectors.address.zipCode,
    page,
    value: card.address.postalCode
  });
  await setInputValue({
    selector: selectors.contact.phone,
    page,
    value: '5409230456'
  });
  await setInputValue({
    selector: selectors.contact.email,
    page,
    value: 'tester@digitalbazaar.com'
  });
  await page.focus(selectors.noSignUp);
  const noSignUp = await page.$(selectors.noSignUp);
  await noSignUp.click();
  const ctnBtn = await page.$(selectors.continueBtn);
  await ctnBtn.click();
  await page.waitForSelector(
    selectors.continueBtn, {hidden: true, timeout: 65000});
  await browser.close();
  await test.capturePaymentOrder({order});
};

module.exports = {
  fillInCard
};
