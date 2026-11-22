/**
 * Validaciones del checkout. Cada `validateX` devuelve un objeto `{ campo: mensaje }`;
 * vacío significa que el paso es válido.
 */
import { SHIPPING_METHODS, PAYMENT_METHODS } from './pricing.js';

export const PROVINCES = Object.freeze([
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
  'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán'
]);

export const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');
const clean = (value) => String(value ?? '').trim();

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean(value));
}

export function isValidFullName(value) {
  const v = clean(value);
  return v.length >= 3 && /^[\p{L}' .-]+$/u.test(v) && v.split(/\s+/).length >= 2;
}

/** Teléfono argentino: 10 dígitos de área + número, con o sin 54 / 9 / 0 / 15. */
export function isValidPhone(value) {
  const digits = onlyDigits(value);
  return digits.length >= 10 && digits.length <= 13;
}

export function isValidDni(value) {
  const digits = onlyDigits(value);
  return digits.length >= 7 && digits.length <= 8 && clean(value).replace(/[.\s]/g, '') === digits;
}

/** Código postal: 4 dígitos (1425) o CPA (C1425ABC). */
export function isValidPostalCode(value) {
  const v = clean(value).toUpperCase();
  return /^\d{4}$/.test(v) || /^[A-HJ-NP-Z]\d{4}[A-Z]{3}$/.test(v);
}

/** Algoritmo de Luhn (dígito verificador de tarjetas). */
export function luhnCheck(value) {
  const digits = onlyDigits(value);
  if (!digits.length) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function detectCardBrand(value) {
  const d = onlyDigits(value);
  if (/^3[47]/.test(d)) return 'amex';
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'mastercard';
  if (/^(589657|6042)/.test(d)) return 'cabal';
  return null;
}

export const CARD_BRAND_LABELS = Object.freeze({ visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', cabal: 'Cabal' });

/** "4242424242424242" -> "4242 4242 4242 4242" (Amex: 4-6-5). */
export function formatCardNumber(value) {
  const d = onlyDigits(value);
  if (detectCardBrand(d) === 'amex') {
    const a = d.slice(0, 15);
    return [a.slice(0, 4), a.slice(4, 10), a.slice(10)].filter(Boolean).join(' ');
  }
  return d.slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "1228" -> "12/28" mientras el usuario escribe. */
export function formatExpiry(value) {
  const d = onlyDigits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function parseExpiry(value) {
  const match = clean(value).match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  return { month, year: 2000 + Number(match[2]) };
}

/** Una tarjeta vence el último día de su mes de vencimiento. */
export function isExpiryValid(value, now = new Date()) {
  const parsed = parseExpiry(value);
  if (!parsed) return false;
  const endOfMonth = new Date(parsed.year, parsed.month, 1);
  const maxYear = now.getFullYear() + 20;
  return endOfMonth > now && parsed.year <= maxYear;
}

export function validateContact(data = {}) {
  const errors = {};
  if (!clean(data.email)) errors.email = 'Ingresá tu email.';
  else if (!isValidEmail(data.email)) errors.email = 'El email no parece válido (ej: nombre@correo.com).';
  if (!clean(data.fullName)) errors.fullName = 'Ingresá tu nombre y apellido.';
  else if (!isValidFullName(data.fullName)) errors.fullName = 'Ingresá nombre y apellido, solo con letras.';
  if (!clean(data.phone)) errors.phone = 'Ingresá un teléfono de contacto.';
  else if (!isValidPhone(data.phone)) errors.phone = 'Ingresá el código de área y el número (ej: 11 2345 6789).';
  if (!clean(data.dni)) errors.dni = 'Ingresá tu DNI para la factura.';
  else if (!isValidDni(data.dni)) errors.dni = 'El DNI debe tener 7 u 8 números.';
  return errors;
}

export function validateShipping(data = {}) {
  const errors = {};
  const method = SHIPPING_METHODS[data.method];
  if (!method) {
    errors.method = 'Elegí un método de envío.';
    return errors;
  }
  if (!method.needsAddress) return errors;
  if (!clean(data.street)) errors.street = 'Ingresá la calle.';
  if (!clean(data.number)) errors.number = 'Ingresá la altura.';
  else if (!/^\d{1,5}$/.test(clean(data.number)) && clean(data.number).toUpperCase() !== 'S/N') {
    errors.number = 'Usá solo números o "S/N".';
  }
  if (!clean(data.city)) errors.city = 'Ingresá la localidad.';
  if (!PROVINCES.includes(data.province)) errors.province = 'Elegí una provincia.';
  if (!clean(data.postalCode)) errors.postalCode = 'Ingresá el código postal.';
  else if (!isValidPostalCode(data.postalCode)) errors.postalCode = 'Usá 4 números (1425) o el CPA (C1425ABC).';
  return errors;
}

export function validatePayment(data = {}, now = new Date()) {
  const errors = {};
  const method = PAYMENT_METHODS[data.method];
  if (!method) {
    errors.method = 'Elegí un medio de pago.';
    return errors;
  }
  if (method.id !== 'tarjeta') return errors;

  const digits = onlyDigits(data.cardNumber);
  const brand = detectCardBrand(digits);
  if (!digits) errors.cardNumber = 'Ingresá el número de la tarjeta.';
  else if (digits.length < 13 || digits.length > 19 || !luhnCheck(digits)) errors.cardNumber = 'El número de tarjeta no es válido.';
  else if (!brand) errors.cardNumber = 'Aceptamos Visa, Mastercard, American Express y Cabal.';

  if (!clean(data.cardName)) errors.cardName = 'Ingresá el nombre tal como figura en la tarjeta.';
  else if (!/^[\p{L}' .-]{3,}$/u.test(clean(data.cardName))) errors.cardName = 'Usá solo letras.';

  if (!clean(data.expiry)) errors.expiry = 'Ingresá el vencimiento.';
  else if (!parseExpiry(data.expiry)) errors.expiry = 'Usá el formato MM/AA.';
  else if (!isExpiryValid(data.expiry, now)) errors.expiry = 'La tarjeta está vencida.';

  const cvvLength = brand === 'amex' ? 4 : 3;
  if (!clean(data.cvv)) errors.cvv = 'Ingresá el código de seguridad.';
  else if (!new RegExp(`^\\d{${cvvLength}}$`).test(clean(data.cvv))) errors.cvv = `El código tiene ${cvvLength} números.`;

  if (!method.installments.includes(Number(data.installments ?? 1))) errors.installments = 'Elegí una opción de cuotas.';
  return errors;
}

export function validateReview(data = {}) {
  return data.acceptTerms ? {} : { acceptTerms: 'Necesitamos que aceptes los términos y condiciones.' };
}
