import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_STORAGE_KEY, MAX_QTY_PER_LINE, cartErrorMessage, createCart, lineKey } from '../../src/store/cart.js';
import { createMemoryStorage } from '../../src/lib/storage.js';
import { PRODUCTS, findProduct } from '../../src/data/products.js';

const mate = findProduct('mate-imperial-negro'); // stock 14
const termoAfa = findProduct('termo-campeones-del-mundo-afa'); // stock 3
const agotado = findProduct('mate-imperial-dorado-duo'); // stock 0
const stored = (storage) => JSON.parse(storage.getItem(CART_STORAGE_KEY));

describe('lineKey', () => {
  it('combina producto, variante y grabado', () => {
    expect(lineKey('mate')).toBe('mate');
    expect(lineKey('mate', ' J.G. ')).toBe('mate__J.G.');
    expect(lineKey('set', 'Ana', 'kit')).toBe('set__kit__Ana');
  });
});

describe('createCart', () => {
  let storage;
  let cart;
  beforeEach(() => {
    storage = createMemoryStorage();
    cart = createCart({ storage });
  });

  it('arranca vacío', () => {
    expect(cart.isEmpty()).toBe(true);
    expect(cart.count()).toBe(0);
    expect(cart.subtotal()).toBe(0);
  });

  it('agrega productos y suma cantidades de la misma línea', () => {
    expect(cart.add(mate)).toMatchObject({ ok: true, quantity: 1 });
    expect(cart.add(mate, { quantity: 2 })).toMatchObject({ ok: true, quantity: 3 });
    expect(cart.getItems()).toHaveLength(1);
    expect(cart.count()).toBe(3);
    expect(cart.subtotal()).toBe(mate.price * 3);
  });

  it('un grabado distinto genera otra línea', () => {
    cart.add(mate, { engraving: 'J.G.' });
    cart.add(mate, { engraving: 'M.R.' });
    cart.add(mate);
    expect(cart.getItems().map((i) => i.engraving)).toEqual(['J.G.', 'M.R.', '']);
  });

  it('persiste en el storage en cada cambio', () => {
    cart.add(mate, { engraving: 'Abuelo' });
    expect(stored(storage)).toEqual([expect.objectContaining({ id: mate.id, quantity: 1, engraving: 'Abuelo' })]);
    cart.clear();
    expect(stored(storage)).toEqual([]);
  });

  it('rechaza productos sin stock', () => {
    expect(cart.add(agotado)).toEqual({ ok: false, reason: 'out-of-stock' });
    expect(cart.isEmpty()).toBe(true);
  });

  it('no permite superar el stock sumando todas las líneas del producto', () => {
    cart.add(termoAfa, { quantity: 2 });
    expect(cart.add(termoAfa, { engraving: 'Leo' })).toMatchObject({ ok: true });
    expect(cart.add(termoAfa, { engraving: 'Dibu' })).toMatchObject({ ok: false, reason: 'stock-limit' });
    expect(cart.count()).toBe(3);
  });

  it('limita la cantidad por línea', () => {
    const custom = { id: 'set-x', name: 'Set', price: 1000 }; // fuera del catálogo: sin límite de stock
    expect(cart.add(custom, { quantity: MAX_QTY_PER_LINE })).toMatchObject({ ok: true });
    expect(cart.add(custom)).toMatchObject({ ok: false, reason: 'max-qty' });
  });

  it.each([null, {}, { id: 'x' }, { id: 'x', price: 'gratis' }])('rechaza un producto inválido (%o)', (product) => {
    expect(cart.add(product)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rechaza cantidades no positivas', () => {
    expect(cart.add(mate, { quantity: 0 })).toEqual({ ok: false, reason: 'invalid' });
    expect(cart.add(mate, { quantity: -2 })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('canAdd no modifica el carrito', () => {
    expect(cart.canAdd(mate)).toMatchObject({ ok: true, quantity: 1 });
    expect(cart.isEmpty()).toBe(true);
  });

  describe('setQuantity / increment', () => {
    it('cambia la cantidad de una línea', () => {
      const { key } = cart.add(mate);
      expect(cart.setQuantity(key, 4)).toEqual({ ok: true, quantity: 4 });
      expect(cart.increment(key, -1)).toEqual({ ok: true, quantity: 3 });
      expect(cart.getItem(key).quantity).toBe(3);
    });

    it('recorta al stock disponible e informa el motivo', () => {
      const { key } = cart.add(termoAfa);
      expect(cart.setQuantity(key, 9)).toEqual({ ok: false, reason: 'stock-limit', quantity: 3 });
      expect(cart.getItem(key).quantity).toBe(3);
      expect(cart.remainingFor(key)).toBe(0);
    });

    it('recorta al máximo por línea', () => {
      const { key } = cart.add({ id: 'set-y', name: 'Set', price: 10 });
      expect(cart.setQuantity(key, 50)).toEqual({ ok: false, reason: 'max-qty', quantity: MAX_QTY_PER_LINE });
    });

    it('bajar la cantidad siempre está permitido aunque otra línea consuma el stock', () => {
      const a = cart.add(termoAfa, { quantity: 2 });
      cart.add(termoAfa, { engraving: 'Leo' });
      expect(cart.setQuantity(a.key, 1)).toEqual({ ok: true, quantity: 1 });
      expect(cart.setQuantity(a.key, 3)).toMatchObject({ ok: false, reason: 'stock-limit', quantity: 2 });
    });

    it('cantidad 0 elimina la línea', () => {
      const { key } = cart.add(mate);
      expect(cart.setQuantity(key, 0)).toEqual({ ok: true, quantity: 0 });
      expect(cart.isEmpty()).toBe(true);
    });

    it('informa líneas inexistentes y valores inválidos', () => {
      const { key } = cart.add(mate);
      expect(cart.setQuantity('nada', 1)).toEqual({ ok: false, reason: 'not-found' });
      expect(cart.increment('nada')).toEqual({ ok: false, reason: 'not-found' });
      expect(cart.setQuantity(key, 'muchos')).toEqual({ ok: false, reason: 'invalid' });
      expect(cart.remove('nada')).toEqual({ ok: false, reason: 'not-found' });
      expect(cart.remainingFor('nada')).toBe(0);
      expect(cart.getItem('nada')).toBeNull();
    });
  });

  it('notifica a los suscriptores con una copia del estado', () => {
    const listener = vi.fn();
    const unsubscribe = cart.subscribe(listener);
    cart.add(mate);
    expect(listener).toHaveBeenCalledWith([expect.objectContaining({ id: mate.id, quantity: 1 })]);
    listener.mock.calls[0][0][0].quantity = 99; // mutar la copia no afecta al carrito
    expect(cart.count()).toBe(1);
    unsubscribe();
    cart.add(mate);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('no notifica si setQuantity no cambia nada', () => {
    const { key } = cart.add(mate, { quantity: 2 });
    const listener = vi.fn();
    cart.subscribe(listener);
    cart.setQuantity(key, 2);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('carga desde el storage', () => {
  it('restaura el carrito guardado', () => {
    const storage = createMemoryStorage();
    createCart({ storage }).add(mate, { quantity: 2 });
    const reopened = createCart({ storage });
    expect(reopened.count()).toBe(2);
  });

  it('toma el precio del catálogo aunque el storage haya sido manipulado', () => {
    const storage = createMemoryStorage({
      [CART_STORAGE_KEY]: JSON.stringify([{ key: mate.id, id: mate.id, name: 'X', price: 1, image: '', quantity: 1 }])
    });
    const cart = createCart({ storage });
    expect(cart.getItems()[0]).toMatchObject({ price: mate.price, name: mate.name });
  });

  it('descarta entradas inválidas, recorta cantidades y fusiona claves repetidas', () => {
    const storage = createMemoryStorage({
      [CART_STORAGE_KEY]: JSON.stringify([
        null,
        'texto',
        { id: 42 },
        { id: mate.id, quantity: 0 },
        { id: 'fuera-de-catalogo', price: -10, quantity: 1 },
        { id: 'set-z', name: 'Set Z', price: 5000, quantity: 3 },
        { id: mate.id, quantity: 999 },
        { id: mate.id, quantity: 2 }
      ])
    });
    const items = createCart({ storage }).getItems();
    expect(items.map((i) => [i.id, i.quantity])).toEqual([['set-z', 3], [mate.id, MAX_QTY_PER_LINE]]);
  });

  it('ignora un storage con un valor que no es lista', () => {
    const storage = createMemoryStorage({ [CART_STORAGE_KEY]: '{"a":1}' });
    expect(createCart({ storage }).isEmpty()).toBe(true);
  });

  it('funciona sin storage (en memoria)', () => {
    const cart = createCart({ catalog: PRODUCTS });
    cart.add(mate);
    expect(cart.count()).toBe(1);
  });

  it('reload relee el storage y notifica (sincronización entre pestañas)', () => {
    const storage = createMemoryStorage();
    const tabA = createCart({ storage });
    const tabB = createCart({ storage });
    const listener = vi.fn();
    tabB.subscribe(listener);
    tabA.add(mate);
    tabB.reload();
    expect(tabB.count()).toBe(1);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('cartErrorMessage', () => {
  it.each([
    ['out-of-stock', /sin stock/],
    ['stock-limit', /No hay más unidades/],
    ['max-qty', /hasta 10 unidades/],
    ['otra-cosa', /No pudimos agregar/]
  ])('%s', (reason, expected) => {
    expect(cartErrorMessage(reason, 'El Mate')).toMatch(expected);
  });
});
