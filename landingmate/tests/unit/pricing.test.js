import { describe, expect, it } from 'vitest';
import {
  FREE_SHIPPING_THRESHOLD, computeTotals, freeShippingProgress, normalizeCouponCode, shippingCost, validateCoupon
} from '../../src/checkout/pricing.js';

describe('freeShippingProgress', () => {
  it('calcula lo que falta y el porcentaje', () => {
    expect(freeShippingProgress(44900)).toEqual({ qualifies: false, remaining: 5100, percent: 90 });
  });
  it('alcanza el envío gratis justo en el umbral', () => {
    expect(freeShippingProgress(FREE_SHIPPING_THRESHOLD)).toEqual({ qualifies: true, remaining: 0, percent: 100 });
    expect(freeShippingProgress(200000).percent).toBe(100);
  });
  it('tolera subtotales negativos', () => {
    expect(freeShippingProgress(-10)).toMatchObject({ remaining: FREE_SHIPPING_THRESHOLD, percent: 0 });
  });
});

describe('shippingCost', () => {
  it('cobra según el método debajo del umbral', () => {
    expect(shippingCost('andreani', 30000)).toBe(6900);
    expect(shippingCost('correo', 30000)).toBe(4500);
  });
  it('envío gratis desde el umbral', () => {
    expect(shippingCost('andreani', 50000)).toBe(0);
    expect(shippingCost('correo', 99000)).toBe(0);
  });
  it('el retiro en showroom siempre es gratis', () => {
    expect(shippingCost('retiro', 1)).toBe(0);
  });
  it('devuelve null para un método desconocido', () => {
    expect(shippingCost('dron', 1000)).toBeNull();
  });
});

describe('cupones', () => {
  it('normaliza el código', () => {
    expect(normalizeCouponCode('  mate ro10 ')).toBe('MATERO10');
    expect(normalizeCouponCode(undefined)).toBe('');
  });

  it('acepta un cupón válido sin importar mayúsculas', () => {
    expect(validateCoupon('matero10', 1000)).toMatchObject({ ok: true, coupon: { code: 'MATERO10' } });
  });

  it.each([
    ['', 1000, /Ingresá un código/],
    ['NOEXISTE', 1000, /no existe/],
    ['BIENVENIDA', 39999, /compra mínima/]
  ])('rechaza "%s" con subtotal %i', (code, subtotal, error) => {
    expect(validateCoupon(code, subtotal)).toEqual({ ok: false, error: expect.stringMatching(error) });
  });
});

describe('computeTotals', () => {
  it('sin envío elegido no suma envío', () => {
    expect(computeTotals({ subtotal: 44900 })).toMatchObject({ subtotal: 44900, shipping: null, total: 44900, couponDiscount: 0, paymentDiscount: 0 });
  });

  it('suma el envío por debajo del umbral', () => {
    expect(computeTotals({ subtotal: 44900, shippingMethod: 'andreani' })).toMatchObject({ shipping: 6900, total: 51800 });
  });

  it('aplica 10% OFF por transferencia sobre el subtotal (no sobre el envío)', () => {
    const t = computeTotals({ subtotal: 44900, shippingMethod: 'correo', paymentMethod: 'transferencia' });
    expect(t.paymentDiscount).toBe(4490);
    expect(t.total).toBe(44900 - 4490 + 4500);
  });

  it('combina cupón y transferencia: el 10% se calcula después del cupón', () => {
    const t = computeTotals({ subtotal: 100000, shippingMethod: 'andreani', paymentMethod: 'transferencia', couponCode: 'MATERO10' });
    expect(t).toMatchObject({ couponDiscount: 10000, paymentDiscount: 9000, shipping: 0, total: 81000 });
    expect(t.coupon.code).toBe('MATERO10');
  });

  it('cupón de monto fijo', () => {
    expect(computeTotals({ subtotal: 40000, couponCode: 'BIENVENIDA' })).toMatchObject({ couponDiscount: 5000, total: 35000 });
  });

  it('el envío gratis se evalúa sobre el subtotal antes de descuentos', () => {
    const t = computeTotals({ subtotal: 52000, shippingMethod: 'andreani', couponCode: 'MATERO10' });
    expect(t.shipping).toBe(0);
    expect(t.total).toBe(46800);
  });

  it('un cupón inválido no descuenta y explica el motivo', () => {
    const t = computeTotals({ subtotal: 30000, couponCode: 'BIENVENIDA' });
    expect(t.couponDiscount).toBe(0);
    expect(t.coupon).toBeNull();
    expect(t.couponError).toMatch(/compra mínima/);
  });

  it('calcula cuotas solo para tarjeta y con opciones válidas', () => {
    expect(computeTotals({ subtotal: 60000, installments: 6 }).installments).toEqual({ count: 6, amount: 10000 });
    expect(computeTotals({ subtotal: 60000, installments: 12 }).installments.count).toBe(1);
    expect(computeTotals({ subtotal: 60000, paymentMethod: 'transferencia', installments: 6 }).installments.count).toBe(1);
  });

  it('un medio de pago desconocido se trata como tarjeta (sin descuento)', () => {
    expect(computeTotals({ subtotal: 1000, paymentMethod: 'bitcoin' }).paymentDiscount).toBe(0);
  });

  it('nunca devuelve un total negativo por descuentos', () => {
    const t = computeTotals({ subtotal: 40000, couponCode: 'BIENVENIDA', paymentMethod: 'transferencia' });
    expect(t.total).toBeGreaterThan(0);
    expect(Number.isInteger(t.total)).toBe(true);
  });
});
