/**
 * Reglas de precio del checkout: envío, cupones, descuento por transferencia y cuotas.
 * Todos los importes son pesos enteros.
 *
 * Orden de aplicación:
 *   subtotal  →  − cupón  →  − 10% transferencia (sobre lo que queda)  →  + envío
 * El envío gratis se evalúa sobre el subtotal (antes de descuentos), como promete la landing.
 */
import { formatPrice } from '../lib/format.js';

export const FREE_SHIPPING_THRESHOLD = 50000;

export const SHIPPING_METHODS = Object.freeze({
  andreani: { id: 'andreani', label: 'Andreani · Envío a domicilio', eta: '24 a 72 hs hábiles', cost: 6900, freeEligible: true, needsAddress: true },
  correo: { id: 'correo', label: 'Correo Argentino · Retiro en sucursal', eta: '3 a 6 días hábiles', cost: 4500, freeEligible: true, needsAddress: true },
  retiro: { id: 'retiro', label: 'Retiro en showroom · Palermo Soho', eta: 'Listo en 24 hs hábiles', cost: 0, freeEligible: false, needsAddress: false }
});

export const PAYMENT_METHODS = Object.freeze({
  tarjeta: { id: 'tarjeta', label: 'Tarjeta de crédito', installments: [1, 3, 6], discountRate: 0 },
  transferencia: { id: 'transferencia', label: 'Transferencia bancaria', installments: [1], discountRate: 0.1 },
  mercadopago: { id: 'mercadopago', label: 'Mercado Pago', installments: [1], discountRate: 0 }
});

export const COUPONS = Object.freeze({
  MATERO10: { code: 'MATERO10', type: 'percent', value: 0.1, label: 'Club Matero · 10% OFF', minSubtotal: 0 },
  BIENVENIDA: { code: 'BIENVENIDA', type: 'fixed', value: 5000, label: 'Bienvenida · $5.000 OFF', minSubtotal: 40000 }
});

export function freeShippingProgress(subtotal, threshold = FREE_SHIPPING_THRESHOLD) {
  const safe = Math.max(0, subtotal);
  return {
    qualifies: safe >= threshold,
    remaining: Math.max(0, threshold - safe),
    percent: Math.min(100, Math.round((safe / threshold) * 100))
  };
}

export function shippingCost(methodId, subtotal) {
  const method = SHIPPING_METHODS[methodId];
  if (!method) return null;
  if (method.freeEligible && subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return method.cost;
}

export function normalizeCouponCode(code) {
  return String(code ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Valida un cupón contra el subtotal. Devuelve `{ ok, coupon }` o `{ ok: false, error }`. */
export function validateCoupon(code, subtotal) {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return { ok: false, error: 'Ingresá un código de cupón.' };
  const coupon = COUPONS[normalized];
  if (!coupon) return { ok: false, error: 'El cupón no existe o ya venció.' };
  if (subtotal < coupon.minSubtotal) {
    return { ok: false, error: `Este cupón requiere una compra mínima de ${formatPrice(coupon.minSubtotal)}.` };
  }
  return { ok: true, coupon };
}

function couponDiscountFor(coupon, subtotal) {
  if (!coupon) return 0;
  const raw = coupon.type === 'percent' ? subtotal * coupon.value : coupon.value;
  return Math.min(subtotal, Math.round(raw));
}

export function computeTotals({ subtotal, shippingMethod = null, paymentMethod = 'tarjeta', couponCode = '', installments = 1 }) {
  const base = Math.max(0, Math.round(subtotal));
  const couponResult = couponCode ? validateCoupon(couponCode, base) : null;
  const coupon = couponResult?.ok ? couponResult.coupon : null;
  const couponDiscount = couponDiscountFor(coupon, base);

  const payment = PAYMENT_METHODS[paymentMethod] ?? PAYMENT_METHODS.tarjeta;
  const afterCoupon = base - couponDiscount;
  const paymentDiscount = Math.round(afterCoupon * payment.discountRate);

  const shipping = shippingMethod ? shippingCost(shippingMethod, base) : null;
  const total = afterCoupon - paymentDiscount + (shipping ?? 0);

  const count = payment.installments.includes(Number(installments)) ? Number(installments) : 1;

  return {
    subtotal: base,
    coupon,
    couponError: couponResult && !couponResult.ok ? couponResult.error : null,
    couponDiscount,
    paymentDiscount,
    shipping,
    total,
    installments: { count, amount: Math.round(total / count) }
  };
}
