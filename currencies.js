// https://developer.paypal.com/docs/api/reference/currency-codes/
const supported = [
  "AUD",
  "BRL",
  "CAD",
  "CZK",
  "DKK",
  "EUR",
  "HKD",
  "HUF",
  "INR",
  "ILS",
  "JPY",
  "MYR",
  "MXN",
  "TWD",
  "NZD",
  "NOK",
  "PHP",
  "PLN",
  "GBP",
  "RUB",
  "SGD",
  "SEK",
  "CHF",
  "THB",
  "USD"
];

// these currencies do not support decimal places
const noDecimal = ['HUF', 'JPY', 'TWD'];


module.exports = {supported, noDecimal};
