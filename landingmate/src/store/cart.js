/**
 * Estado del carrito: lógica pura + persistencia inyectable.
 *
 * - Una "línea" se identifica por producto + grabado + variante (dos mates iguales
 *   con grabados distintos son dos líneas).
 * - El stock se controla por producto, sumando todas sus líneas.
 * - Lo que se lee del storage se sanea y los precios se vuelven a tomar del catálogo:
 *   un `localStorage` manipulado no puede abaratar un producto.
 */
import { PRODUCTS } from '../data/products.js';
import { readJSON, writeJSON } from '../lib/storage.js';

export const CART_STORAGE_KEY = 'lavaditos_cart';
export const MAX_QTY_PER_LINE = 10;

export function lineKey(productId, engraving = '', variant = '') {
  return [productId, variant, engraving.trim()].filter(Boolean).join('__');
}

const toPositiveInt = (value) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function sanitizeLine(raw, catalog) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const quantity = Math.min(toPositiveInt(raw.quantity), MAX_QTY_PER_LINE);
  if (!quantity) return null;
  const product = catalog.find((p) => p.id === raw.id);
  const price = product ? product.price : Number(raw.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const engraving = typeof raw.engraving === 'string' ? raw.engraving.slice(0, 40) : '';
  return {
    key: typeof raw.key === 'string' && raw.key ? raw.key : lineKey(raw.id, engraving),
    id: raw.id,
    name: product ? product.name : String(raw.name ?? 'Producto'),
    price,
    image: product ? product.image : String(raw.image ?? ''),
    engraving,
    details: typeof raw.details === 'string' ? raw.details : '',
    quantity
  };
}

export function createCart({ storage, catalog = PRODUCTS, storageKey = CART_STORAGE_KEY } = {}) {
  let items = [];
  const listeners = new Set();

  const stockOf = (id) => {
    const product = catalog.find((p) => p.id === id);
    return product && Number.isFinite(product.stock) ? product.stock : Infinity;
  };
  const quantityOfProduct = (id, exceptKey) =>
    items.filter((i) => i.id === id && i.key !== exceptKey).reduce((sum, i) => sum + i.quantity, 0);

  const snapshot = () => items.map((i) => ({ ...i }));

  function load() {
    const stored = storage ? readJSON(storage, storageKey, []) : [];
    const lines = Array.isArray(stored) ? stored.map((l) => sanitizeLine(l, catalog)).filter(Boolean) : [];
    // Si el storage traía claves repetidas, se fusionan
    const merged = new Map();
    lines.forEach((line) => {
      const prev = merged.get(line.key);
      if (prev) prev.quantity = Math.min(prev.quantity + line.quantity, MAX_QTY_PER_LINE);
      else merged.set(line.key, line);
    });
    items = [...merged.values()];
  }

  function commit() {
    if (storage) writeJSON(storage, storageKey, items);
    const state = snapshot();
    listeners.forEach((fn) => fn(state));
  }

  /** Verifica si se puede sumar sin modificar el carrito. */
  function canAdd(product, { engraving = '', variant = '', quantity = 1 } = {}) {
    const qty = toPositiveInt(quantity);
    if (!product || !product.id || !Number.isFinite(product.price) || !qty) return { ok: false, reason: 'invalid' };
    const stock = stockOf(product.id);
    if (stock <= 0) return { ok: false, reason: 'out-of-stock' };
    const key = lineKey(product.id, engraving, variant);
    const current = items.find((i) => i.key === key)?.quantity ?? 0;
    if (current + qty > MAX_QTY_PER_LINE) return { ok: false, reason: 'max-qty', quantity: current };
    if (quantityOfProduct(product.id, key) + current + qty > stock) return { ok: false, reason: 'stock-limit', quantity: current };
    return { ok: true, key, quantity: current + qty };
  }

  /**
   * Suma un producto. Devuelve `{ ok, reason?, quantity? }`:
   * reason = 'invalid' | 'out-of-stock' | 'stock-limit' | 'max-qty'
   */
  function add(product, { engraving = '', variant = '', details = '', quantity = 1 } = {}) {
    const check = canAdd(product, { engraving, variant, quantity });
    if (!check.ok) return check;
    const qty = toPositiveInt(quantity);
    const key = check.key;
    const existing = items.find((i) => i.key === key);

    if (existing) {
      existing.quantity += qty;
    } else {
      items.push({
        key,
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image ?? '',
        engraving: engraving.trim(),
        details,
        quantity: qty
      });
    }
    commit();
    return check;
  }

  /** Fija la cantidad de una línea (0 la elimina). Respeta stock y máximo por línea. */
  function setQuantity(key, quantity) {
    const item = items.find((i) => i.key === key);
    if (!item) return { ok: false, reason: 'not-found' };
    const requested = Math.floor(Number(quantity));
    if (!Number.isFinite(requested)) return { ok: false, reason: 'invalid' };
    if (requested <= 0) return remove(key);

    const available = stockOf(item.id) - quantityOfProduct(item.id, key);
    const max = Math.min(MAX_QTY_PER_LINE, available);
    // Bajar siempre se permite; subir, solo hasta el stock disponible
    const next = requested <= item.quantity ? requested : Math.max(item.quantity, Math.min(requested, max));
    const changed = next !== item.quantity;
    item.quantity = next;
    if (changed) commit();
    if (next < requested) return { ok: false, reason: next === MAX_QTY_PER_LINE ? 'max-qty' : 'stock-limit', quantity: next };
    return { ok: true, quantity: next };
  }

  function increment(key, delta = 1) {
    const item = items.find((i) => i.key === key);
    if (!item) return { ok: false, reason: 'not-found' };
    return setQuantity(key, item.quantity + delta);
  }

  function remove(key) {
    const before = items.length;
    items = items.filter((i) => i.key !== key);
    if (items.length === before) return { ok: false, reason: 'not-found' };
    commit();
    return { ok: true, quantity: 0 };
  }

  function clear() {
    items = [];
    commit();
  }

  /** Cuántas unidades más se pueden sumar a una línea existente. */
  function remainingFor(key) {
    const item = items.find((i) => i.key === key);
    if (!item) return 0;
    const available = stockOf(item.id) - quantityOfProduct(item.id, key);
    return Math.max(0, Math.min(MAX_QTY_PER_LINE, available) - item.quantity);
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /** Vuelve a leer el storage (p. ej. cuando otra pestaña modificó el carrito). */
  function reload() {
    load();
    const state = snapshot();
    listeners.forEach((fn) => fn(state));
  }

  load();

  return {
    add,
    canAdd,
    setQuantity,
    increment,
    remove,
    clear,
    reload,
    subscribe,
    remainingFor,
    getItems: snapshot,
    getItem: (key) => {
      const item = items.find((i) => i.key === key);
      return item ? { ...item } : null;
    },
    count: () => items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    isEmpty: () => items.length === 0,
    storageKey
  };
}

/** Mensaje legible para cada motivo de rechazo del carrito. */
export function cartErrorMessage(reason, productName = 'este producto') {
  switch (reason) {
    case 'out-of-stock':
      return `${productName} está sin stock por el momento.`;
    case 'stock-limit':
      return `No hay más unidades disponibles de ${productName}.`;
    case 'max-qty':
      return `Podés llevar hasta ${MAX_QTY_PER_LINE} unidades por producto.`;
    default:
      return 'No pudimos agregar el producto. Probá de nuevo.';
  }
}
