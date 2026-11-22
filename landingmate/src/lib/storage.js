/**
 * Envoltorio seguro sobre Web Storage. En modo privado, con cookies bloqueadas
 * o cuando se supera la cuota, `localStorage` puede lanzar: acá nunca se rompe la app.
 */

export function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    clear: () => data.clear()
  };
}

/** Devuelve el storage del navegador si está disponible, o uno en memoria. */
export function resolveStorage(kind = 'localStorage') {
  try {
    const storage = globalThis[kind];
    const probe = '__lav_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return createMemoryStorage();
  }
}

export function readJSON(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    /* sin acceso al storage: no hay nada que borrar */
  }
}
