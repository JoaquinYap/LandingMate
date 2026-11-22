/**
 * Pasarela de pago SIMULADA. No hay backend: se imita la latencia y las respuestas de
 * un procesador real con tarjetas de prueba documentadas en la UI.
 *
 * El objeto de pedido que se guarda NUNCA contiene el número completo ni el CVV:
 * solo marca y últimos 4 dígitos, como exige cualquier integración PCI.
 */
import { CARD_BRAND_LABELS, detectCardBrand, onlyDigits } from './validation.js';
import { PAYMENT_METHODS, SHIPPING_METHODS } from './pricing.js';

export const TEST_CARDS = Object.freeze({
  approved: '4242 4242 4242 4242',
  declined: '4000 0000 0000 0002',
  insufficientFunds: '4000 0000 0000 9995'
});

const DECLINES = {
  [onlyDigits(TEST_CARDS.declined)]: { code: 'card_declined', message: 'La tarjeta fue rechazada por el banco emisor. Probá con otra tarjeta o medio de pago.' },
  [onlyDigits(TEST_CARDS.insufficientFunds)]: { code: 'insufficient_funds', message: 'La tarjeta no tiene fondos suficientes. Probá con otra tarjeta o medio de pago.' }
};

export const BANK_TRANSFER_DETAILS = Object.freeze({
  holder: 'Lavaditos Mates S.R.L.',
  alias: 'LAVADITOS.MATE.ARS',
  cbu: '0000003100012345678901',
  expiresInHours: 48
});

export class PaymentError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Procesa el pago. Resuelve `{ status: 'approved' | 'pending', authorizationCode }`
 * o rechaza con `PaymentError`.
 */
export async function processPayment(payment, { delay = 1400, wait = sleep, random = Math.random } = {}) {
  if (delay > 0) await wait(delay);
  const method = PAYMENT_METHODS[payment?.method];
  if (!method) throw new PaymentError('Medio de pago no soportado.', 'invalid_method');

  const authorizationCode = Math.floor(random() * 1e6).toString().padStart(6, '0');
  if (method.id === 'transferencia') return { status: 'pending', authorizationCode };
  if (method.id === 'mercadopago') return { status: 'approved', authorizationCode };

  const decline = DECLINES[onlyDigits(payment.cardNumber)];
  if (decline) throw new PaymentError(decline.message, decline.code);
  return { status: 'approved', authorizationCode };
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** "LAV-261122-7KQ4": fecha + sufijo aleatorio sin caracteres ambiguos (0/O, 1/I). */
export function generateOrderId(now = new Date(), random = Math.random) {
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const suffix = Array.from({ length: 4 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
  return `LAV-${date}-${suffix}`;
}

/** Datos de pago aptos para guardar/mostrar (sin datos sensibles). */
export function maskPayment(payment) {
  const base = { method: payment.method, label: PAYMENT_METHODS[payment.method]?.label ?? payment.method };
  if (payment.method !== 'tarjeta') return base;
  const digits = onlyDigits(payment.cardNumber);
  const brand = detectCardBrand(digits);
  return {
    ...base,
    brand,
    brandLabel: CARD_BRAND_LABELS[brand] ?? 'Tarjeta',
    last4: digits.slice(-4),
    installments: Number(payment.installments ?? 1)
  };
}

export function createOrder({ items, contact, shipping, payment, totals, result, now = new Date(), random = Math.random }) {
  return {
    id: generateOrderId(now, random),
    createdAt: now.toISOString(),
    status: result.status,
    authorizationCode: result.authorizationCode,
    items: items.map(({ id, name, price, quantity, engraving, details, image }) => ({ id, name, price, quantity, engraving, details, image })),
    contact: { email: contact.email, fullName: contact.fullName, phone: contact.phone },
    shipping: {
      method: shipping.method,
      label: SHIPPING_METHODS[shipping.method]?.label ?? shipping.method,
      eta: SHIPPING_METHODS[shipping.method]?.eta ?? '',
      address: SHIPPING_METHODS[shipping.method]?.needsAddress
        ? {
            street: shipping.street,
            number: shipping.number,
            apartment: shipping.apartment ?? '',
            city: shipping.city,
            province: shipping.province,
            postalCode: shipping.postalCode
          }
        : null
    },
    payment: maskPayment(payment),
    totals: {
      subtotal: totals.subtotal,
      couponCode: totals.coupon?.code ?? null,
      couponDiscount: totals.couponDiscount,
      paymentDiscount: totals.paymentDiscount,
      shipping: totals.shipping ?? 0,
      total: totals.total,
      installments: totals.installments
    }
  };
}
