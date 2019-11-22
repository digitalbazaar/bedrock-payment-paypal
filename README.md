# bedrock-payment-paypal

[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> A paypal plugin for bedrock-payment.

Provides the ability to securely create orders in paypal's system, process orders, and validate orders.

## Table of Contents

- [Security](#security)
- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Security

  All errors thrown need to be checked to make sure they do not return
  PayPal clientIds or secrets to the logger or the user.

## Background

## Install

```
npm i --save bedrock-payment bedrock-payment-http bedrock-web-payment
npm i --save bedrock-payment-paypal
```

## Usage

In your project you will need add the following in `/configs/bedrock-payment.js`.
```
const {config} = require('bedrock');
const bedrockPayment = require('bedrock-payment');

// this is used by the validator to ensure you
// can not post a service not supported by the current project.
config.bedrock_payment.services = ['paypal'];
config.bedrock_payment.orderProcessor = 'your-order-processor-name';

bedrockPayment.use('paypal', require('bedrock-payment-paypal'));
bedrockPayment.use('plans', require('../lib/your-order-processor.js'));
```

You will also need a config file for PayPal itself.
This file should be secret as it will need to contain your PayPal secret.

```
const {config} = require('bedrock');

const cfg = config.paypal;
cfg.api = 'https://api.sandbox.paypal.com';
cfg.clientId = 'your-paypal-clientId';
cfg.secret = 'your-paypal-secret';
cfg.brandName = 'veres-accelerator';
```

## API

    getGatewayCredentials

      Used by bedrock-payment to get the credentials for the paypal
      smart button.

    updateGatewayPaymentAmount

      Updates a paypal order's amount.

    createGatewayPayment

      Creates a new order in paypal's system.

    processGatewayPayment

      the last part of the process. This takes a Payment, finds it's PayPal
      order, and then processes the whole thing.

## Maintainers

[@digitalbazaar](https://github.com/digitalbazaar)

## Contributing

PRs accepted.

Small note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

Bedrock License © 2019 digitalbazaar
