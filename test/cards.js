const billing_address = {
  address_line_1: '173 Drury Lane',
  address_line_2: 'Apt 5',
  admin_area_2: 'Blacksburg',
  admin_area_1: 'Virginia',
  postal_code: '24060',
  country_code: 'US'
};

const cards = {
  visa: {
    name: 'Test User',
    number: '4111111111111111',
    expiry: '2023-08',
    security_code: '768',
    billing_address
  }
};

module.exports = {
  cards
};
