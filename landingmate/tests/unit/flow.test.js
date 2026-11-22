import { beforeEach, describe, expect, it } from 'vitest';
import { CHECKOUT_STORAGE_KEY, STEPS, createCheckoutFlow } from '../../src/checkout/flow.js';
import { createMemoryStorage } from '../../src/lib/storage.js';

const NOW = () => new Date(2026, 10, 22);
const CONTACT = { email: 'ana@correo.com', fullName: 'Ana Pérez', phone: '11 2345 6789', dni: '30123456' };
const SHIPPING = { method: 'andreani', street: 'Honduras', number: '4800', city: 'CABA', province: 'CABA', postalCode: '1414' };
const CARD = { method: 'tarjeta', cardNumber: '4242 4242 4242 4242', cardName: 'ANA PEREZ', expiry: '12/28', cvv: '123', installments: 1 };

function completeUntilReview(flow) {
  flow.update('contacto', CONTACT);
  flow.submit();
  flow.update('envio', SHIPPING);
  flow.submit();
  flow.update('pago', CARD);
  flow.submit();
}

describe('createCheckoutFlow', () => {
  let storage;
  let flow;
  beforeEach(() => {
    storage = createMemoryStorage();
    flow = createCheckoutFlow({ storage, now: NOW });
  });

  it('define 4 pasos y arranca en contacto', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['contacto', 'envio', 'pago', 'revision']);
    expect(flow.step).toBe('contacto');
    expect(flow.stepIndex).toBe(0);
    expect(flow.getData('envio').method).toBe('andreani');
  });

  it('no avanza si el paso tiene errores', () => {
    const result = flow.submit();
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveProperty('email');
    expect(flow.step).toBe('contacto');
    expect(flow.completed).toEqual([]);
  });

  it('avanza paso a paso cuando los datos son válidos', () => {
    flow.update('contacto', CONTACT);
    expect(flow.submit()).toEqual({ ok: true, errors: {}, step: 'envio' });
    completeUntilReview(flow);
    expect(flow.step).toBe('revision');
    expect(flow.completed).toEqual(['contacto', 'envio', 'pago']);
  });

  it('el último paso valida los términos y queda en revisión', () => {
    completeUntilReview(flow);
    expect(flow.submit().ok).toBe(false);
    flow.update('revision', { acceptTerms: true });
    expect(flow.submit()).toMatchObject({ ok: true, step: 'revision' });
    expect(flow.isComplete('revision')).toBe(true);
  });

  it('solo permite saltar a pasos completados o al primero pendiente', () => {
    expect(flow.canGoTo('envio')).toBe(false);
    expect(flow.goTo('pago')).toBe(false);
    flow.update('contacto', CONTACT);
    flow.submit();
    expect(flow.canGoTo('envio')).toBe(true);
    expect(flow.canGoTo('pago')).toBe(false);
    expect(flow.goTo('contacto')).toBe(true);
    expect(flow.step).toBe('contacto');
    expect(flow.canGoTo('inexistente')).toBe(false);
  });

  it('back retrocede y no pasa del primer paso', () => {
    expect(flow.back()).toBe(false);
    flow.update('contacto', CONTACT);
    flow.submit();
    expect(flow.back()).toBe(true);
    expect(flow.step).toBe('contacto');
  });

  it('update ignora pasos inexistentes', () => {
    flow.update('hackeo', { x: 1 });
    expect(flow.getData('hackeo')).toEqual({});
  });

  it('invalidate obliga a repetir un paso y los siguientes', () => {
    completeUntilReview(flow);
    flow.invalidate('envio');
    expect(flow.completed).toEqual(['contacto']);
    expect(flow.canGoTo('revision')).toBe(false);
  });

  it('guarda el cupón', () => {
    flow.setCoupon('MATERO10');
    expect(flow.couponCode).toBe('MATERO10');
  });

  describe('persistencia en sessionStorage', () => {
    it('no guarda número de tarjeta ni CVV', () => {
      completeUntilReview(flow);
      const raw = storage.getItem(CHECKOUT_STORAGE_KEY);
      expect(raw).not.toContain('4242');
      expect(raw).not.toContain('"cvv":"123"');
      expect(JSON.parse(raw).data.pago.cardName).toBe('ANA PEREZ');
    });

    it('al recargar restaura datos y vuelve al paso de pago (los datos de tarjeta no se guardaron)', () => {
      completeUntilReview(flow);
      flow.update('revision', { acceptTerms: true });
      flow.submit();
      flow.setCoupon('MATERO10');
      const restored = createCheckoutFlow({ storage, now: NOW });
      expect(restored.step).toBe('pago');
      expect(restored.completed).toEqual(['contacto', 'envio']);
      expect(restored.getData('contacto')).toEqual(CONTACT);
      expect(restored.getData('pago').cardNumber).toBe('');
      expect(restored.couponCode).toBe('MATERO10');
    });

    it('ignora datos guardados corruptos', () => {
      storage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({ data: { contacto: null }, completed: 'x', couponCode: 5 }));
      const restored = createCheckoutFlow({ storage, now: NOW });
      expect(restored.step).toBe('contacto');
      expect(restored.couponCode).toBe('');
      expect(restored.getData('contacto').email).toBe('');
    });

    it('reset borra el estado guardado', () => {
      completeUntilReview(flow);
      flow.reset();
      expect(storage.getItem(CHECKOUT_STORAGE_KEY)).toBeNull();
      expect(flow.step).toBe('contacto');
      expect(flow.completed).toEqual([]);
    });

    it('funciona sin storage', () => {
      const memoryFlow = createCheckoutFlow();
      memoryFlow.update('contacto', CONTACT);
      expect(memoryFlow.submit().ok).toBe(true);
      memoryFlow.reset();
      expect(memoryFlow.step).toBe('contacto');
    });
  });
});
