import { describe, expect, it, vi } from 'vitest';
import { PaymentError, TEST_CARDS, createOrder, generateOrderId, maskPayment, processPayment } from '../../src/checkout/payment.js';
import { computeTotals } from '../../src/checkout/pricing.js';

const instant = { delay: 0, random: () => 0.123456 };

describe('processPayment (simulado)', () => {
  it('aprueba una tarjeta válida', async () => {
    await expect(processPayment({ method: 'tarjeta', cardNumber: TEST_CARDS.approved }, instant))
      .resolves.toEqual({ status: 'approved', authorizationCode: '123456' });
  });

  it.each([
    [TEST_CARDS.declined, 'card_declined', /rechazada/],
    [TEST_CARDS.insufficientFunds, 'insufficient_funds', /fondos suficientes/]
  ])('rechaza la tarjeta de prueba %s', async (cardNumber, code, message) => {
    const promise = processPayment({ method: 'tarjeta', cardNumber }, instant);
    await expect(promise).rejects.toBeInstanceOf(PaymentError);
    await expect(promise).rejects.toMatchObject({ code, message: expect.stringMatching(message) });
  });

  it('la transferencia queda pendiente y Mercado Pago se aprueba', async () => {
    await expect(processPayment({ method: 'transferencia' }, instant)).resolves.toMatchObject({ status: 'pending' });
    await expect(processPayment({ method: 'mercadopago' }, instant)).resolves.toMatchObject({ status: 'approved' });
  });

  it('rechaza medios de pago desconocidos', async () => {
    await expect(processPayment({ method: 'trueque' }, instant)).rejects.toMatchObject({ code: 'invalid_method' });
    await expect(processPayment(undefined, instant)).rejects.toMatchObject({ code: 'invalid_method' });
  });

  it('simula la latencia con la función de espera inyectada', async () => {
    const wait = vi.fn(() => Promise.resolve());
    await processPayment({ method: 'mercadopago' }, { delay: 1400, wait });
    expect(wait).toHaveBeenCalledWith(1400);
  });

  it('por defecto espera con un timer real', async () => {
    vi.useFakeTimers();
    const promise = processPayment({ method: 'mercadopago' }, { delay: 500 });
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toMatchObject({ status: 'approved' });
    vi.useRealTimers();
  });
});

describe('generateOrderId', () => {
  it('incluye la fecha y un sufijo sin caracteres ambiguos', () => {
    const id = generateOrderId(new Date(2026, 10, 5), () => 0);
    expect(id).toBe('LAV-261105-AAAA');
    expect(generateOrderId(new Date(), Math.random)).toMatch(/^LAV-\d{6}-[A-HJ-NP-Z2-9]{4}$/);
  });
});

describe('maskPayment', () => {
  it('guarda solo marca y últimos 4 dígitos', () => {
    const masked = maskPayment({ method: 'tarjeta', cardNumber: '4242 4242 4242 4242', cvv: '123', installments: '3' });
    expect(masked).toEqual({ method: 'tarjeta', label: 'Tarjeta de crédito', brand: 'visa', brandLabel: 'Visa', last4: '4242', installments: 3 });
  });

  it('usa una etiqueta genérica para marcas desconocidas y otros medios', () => {
    expect(maskPayment({ method: 'tarjeta', cardNumber: '6011111111111117' }).brandLabel).toBe('Tarjeta');
    expect(maskPayment({ method: 'transferencia' })).toEqual({ method: 'transferencia', label: 'Transferencia bancaria' });
    expect(maskPayment({ method: 'otro' }).label).toBe('otro');
  });
});

describe('createOrder', () => {
  const base = {
    items: [{ id: 'm', name: 'Mate', price: 1000, quantity: 2, engraving: 'J', details: '', image: 'x.jpg', key: 'm__J' }],
    contact: { email: 'ana@correo.com', fullName: 'Ana Pérez', phone: '11 2345 6789', dni: '30123456' },
    payment: { method: 'tarjeta', cardNumber: '4242424242424242', cvv: '999', installments: 1 },
    result: { status: 'approved', authorizationCode: '000001' },
    now: new Date('2026-11-22T12:00:00Z'),
    random: () => 0
  };

  it('arma un pedido con dirección y totales', () => {
    const shipping = { method: 'andreani', street: 'Honduras', number: '4800', city: 'CABA', province: 'CABA', postalCode: '1414' };
    const order = createOrder({ ...base, shipping, totals: computeTotals({ subtotal: 2000, shippingMethod: 'andreani', couponCode: 'MATERO10' }) });
    expect(order).toMatchObject({
      id: expect.stringMatching(/^LAV-/),
      createdAt: '2026-11-22T12:00:00.000Z',
      status: 'approved',
      shipping: { label: expect.stringMatching(/Andreani/), address: { street: 'Honduras', apartment: '' } },
      totals: { subtotal: 2000, couponCode: 'MATERO10', couponDiscount: 200, shipping: 6900, total: 8700 }
    });
    expect(order.items[0]).not.toHaveProperty('key');
  });

  it('nunca incluye el número completo de la tarjeta, el CVV ni el DNI', () => {
    const order = createOrder({ ...base, shipping: { method: 'retiro' }, totals: computeTotals({ subtotal: 2000 }) });
    const json = JSON.stringify(order);
    expect(json).not.toContain('4242424242424242');
    expect(json).not.toContain('999');
    expect(json).not.toContain('30123456');
    expect(order.payment.last4).toBe('4242');
    expect(order.shipping.address).toBeNull();
    expect(order.totals.shipping).toBe(0);
  });

  it('tolera un método de envío desconocido', () => {
    const order = createOrder({ ...base, shipping: { method: 'dron' }, totals: computeTotals({ subtotal: 1 }) });
    expect(order.shipping).toMatchObject({ label: 'dron', eta: '', address: null });
  });
});
