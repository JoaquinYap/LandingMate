import { describe, expect, it } from 'vitest';
import {
  detectCardBrand, formatCardNumber, formatExpiry, isExpiryValid, isValidDni, isValidEmail, isValidFullName,
  isValidPhone, isValidPostalCode, luhnCheck, parseExpiry, validateContact, validatePayment, validateReview,
  validateShipping
} from '../../src/checkout/validation.js';

const NOW = new Date(2026, 10, 22); // 22/11/2026

describe('validadores de campos', () => {
  it.each(['ana@correo.com', 'ana.perez+mate@mail.com.ar'])('email válido: %s', (v) => expect(isValidEmail(v)).toBe(true));
  it.each(['', 'ana', 'ana@', 'ana@correo', 'ana @correo.com', 'ana@correo.c'])('email inválido: "%s"', (v) => expect(isValidEmail(v)).toBe(false));

  it.each(['Ana Pérez', "María José O'Neill", 'Joaquín  Gómez-Ruiz'])('nombre válido: %s', (v) => expect(isValidFullName(v)).toBe(true));
  it.each(['Ana', 'Ana   ', 'Ana P3rez', ''])('nombre inválido: "%s"', (v) => expect(isValidFullName(v)).toBe(false));

  it.each(['11 2345-6789', '+54 9 11 2345 6789', '(0351) 15 555-1234'])('teléfono válido: %s', (v) => expect(isValidPhone(v)).toBe(true));
  it.each(['1234', '12345678901234'])('teléfono inválido: %s', (v) => expect(isValidPhone(v)).toBe(false));

  it.each(['30123456', '30.123.456', '9876543'])('DNI válido: %s', (v) => expect(isValidDni(v)).toBe(true));
  it.each(['123456', '123456789', '30-123-456', 'abc'])('DNI inválido: %s', (v) => expect(isValidDni(v)).toBe(false));

  it.each(['1425', 'C1425ABC', 'c1425abc', 'X5000AAA'])('CP válido: %s', (v) => expect(isValidPostalCode(v)).toBe(true));
  it.each(['142', '14250', 'I1425ABC', 'C1425AB'])('CP inválido: %s', (v) => expect(isValidPostalCode(v)).toBe(false));
});

describe('tarjetas', () => {
  it.each(['4242 4242 4242 4242', '5555555555554444', '378282246310005', '4000000000000002'])('Luhn válido: %s', (v) => {
    expect(luhnCheck(v)).toBe(true);
  });
  it.each(['4242 4242 4242 4241', '', '1234567812345678'])('Luhn inválido: "%s"', (v) => expect(luhnCheck(v)).toBe(false));

  it.each([
    ['4242424242424242', 'visa'],
    ['5555555555554444', 'mastercard'],
    ['2223003122003222', 'mastercard'],
    ['378282246310005', 'amex'],
    ['5896570000000008', 'cabal'],
    ['6011111111111117', null]
  ])('marca de %s = %s', (number, brand) => expect(detectCardBrand(number)).toBe(brand));

  it('formatea en grupos de 4 (Amex 4-6-5)', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('4242-42')).toBe('4242 42');
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
  });

  it('formatea y parsea el vencimiento', () => {
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('128')).toBe('12/8');
    expect(formatExpiry('12/289')).toBe('12/28');
    expect(parseExpiry('09/27')).toEqual({ month: 9, year: 2027 });
    expect(parseExpiry('13/27')).toBeNull();
    expect(parseExpiry('0927')).toBeNull();
  });

  it('una tarjeta vence al final de su mes', () => {
    expect(isExpiryValid('11/26', NOW)).toBe(true);
    expect(isExpiryValid('10/26', NOW)).toBe(false);
    expect(isExpiryValid('12/60', NOW)).toBe(false); // más de 20 años: dato erróneo
    expect(isExpiryValid('xx', NOW)).toBe(false);
  });
});

describe('validateContact', () => {
  const valid = { email: 'ana@correo.com', fullName: 'Ana Pérez', phone: '11 2345 6789', dni: '30123456' };

  it('acepta datos completos', () => {
    expect(validateContact(valid)).toEqual({});
  });

  it('distingue campo vacío de formato inválido', () => {
    expect(validateContact({})).toEqual({
      email: 'Ingresá tu email.',
      fullName: 'Ingresá tu nombre y apellido.',
      phone: 'Ingresá un teléfono de contacto.',
      dni: 'Ingresá tu DNI para la factura.'
    });
    const errors = validateContact({ email: 'x', fullName: 'Ana', phone: '12', dni: '1' });
    expect(Object.keys(errors)).toEqual(['email', 'fullName', 'phone', 'dni']);
    expect(errors.email).toMatch(/no parece válido/);
  });
});

describe('validateShipping', () => {
  const address = { method: 'andreani', street: 'Honduras', number: '4800', city: 'CABA', province: 'CABA', postalCode: 'C1414BMJ' };

  it('acepta una dirección completa', () => {
    expect(validateShipping(address)).toEqual({});
    expect(validateShipping({ ...address, number: 's/n' })).toEqual({});
  });

  it('el retiro en showroom no pide dirección', () => {
    expect(validateShipping({ method: 'retiro' })).toEqual({});
  });

  it('pide método de envío', () => {
    expect(validateShipping({})).toEqual({ method: 'Elegí un método de envío.' });
  });

  it('marca cada campo de dirección faltante o inválido', () => {
    expect(Object.keys(validateShipping({ method: 'correo' }))).toEqual(['street', 'number', 'city', 'province', 'postalCode']);
    const errors = validateShipping({ ...address, number: '12a', province: 'Narnia', postalCode: '99' });
    expect(Object.keys(errors)).toEqual(['number', 'province', 'postalCode']);
  });
});

describe('validatePayment', () => {
  const card = { method: 'tarjeta', cardNumber: '4242 4242 4242 4242', cardName: 'ANA PEREZ', expiry: '12/28', cvv: '123', installments: 3 };

  it('acepta una tarjeta válida', () => {
    expect(validatePayment(card, NOW)).toEqual({});
  });

  it('transferencia y Mercado Pago no piden datos de tarjeta', () => {
    expect(validatePayment({ method: 'transferencia' }, NOW)).toEqual({});
    expect(validatePayment({ method: 'mercadopago' }, NOW)).toEqual({});
  });

  it('pide un medio de pago', () => {
    expect(validatePayment({}, NOW)).toEqual({ method: 'Elegí un medio de pago.' });
  });

  it('reporta todos los campos vacíos', () => {
    expect(Object.keys(validatePayment({ method: 'tarjeta' }, NOW))).toEqual(['cardNumber', 'cardName', 'expiry', 'cvv']);
  });

  it.each([
    [{ cardNumber: '4242 4242 4242 4241' }, 'cardNumber', /no es válido/],
    [{ cardNumber: '6011111111111117' }, 'cardNumber', /Aceptamos/],
    [{ cardName: 'Ana 123' }, 'cardName', /solo letras/],
    [{ expiry: '1228' }, 'expiry', /MM\/AA/],
    [{ expiry: '01/20' }, 'expiry', /vencida/],
    [{ cvv: '12' }, 'cvv', /3 números/],
    [{ installments: 12 }, 'installments', /cuotas/]
  ])('detecta %o', (override, field, message) => {
    expect(validatePayment({ ...card, ...override }, NOW)[field]).toMatch(message);
  });

  it('American Express exige CVV de 4 dígitos', () => {
    const amex = { ...card, cardNumber: '378282246310005' };
    expect(validatePayment({ ...amex, cvv: '123' }, NOW).cvv).toMatch(/4 números/);
    expect(validatePayment({ ...amex, cvv: '1234' }, NOW)).toEqual({});
  });
});

describe('validateReview', () => {
  it('exige aceptar los términos', () => {
    expect(validateReview({ acceptTerms: true })).toEqual({});
    expect(validateReview({}).acceptTerms).toMatch(/términos/);
  });
});
