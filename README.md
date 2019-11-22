# bedrock-payment-paypal
> This Plugin provides PayPal functionality to bedrock-payment.

### 🏠 [Homepage](https://github.com/digitalbazaar/bedrock-payment-paypal#readme)

## Install

```sh
npm install --save bedrock-payment-paypal
```

## Configure

```js
const {config} = require('bedrock');

config.paypal = config.paypal || {};
config.paypal.api = 'https://api.sandbox.paypal.com';
config.paypal.clientId = 'your-client-id';
config.paypal.secret = 'your-secret';
// this will be the name that shows up in the papypal order.
config.paypal.brandName = 'your-company-name';
// this can be GET_FROM_FILE, NO_SHIPPING, & SET_PROVIDED_ADDRESS
// it defaults to NO_SHIPPING.
// You shouldn't have to set it at all.
config.paypal.shippingPreference = 'NO_SHIPPING';
```
If you are concerned about your PayPal secret being exposed on github you can use
an environment variable to store it:

```sh
export paypal_secret=your-secret-key
export paypal_client_id=your_client_id
```
then use it in the config file

```js
config.paypal.clientId = process.env.paypal_client_id;
config.paypal.secret = process.env.paypal_secret; 
```

## Author

👤 **Digital Bazaar, Inc.**

* GitHub: [@digitalbazaar](https://github.com/digitalbazaar)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/digitalbazaar/bedrock-payment-paypal/issues).

## Show your support

Give a ⭐️ if this project helped you!

***
_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)_
