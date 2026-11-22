import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, readJSON, removeKey, resolveStorage, writeJSON } from '../../src/lib/storage.js';

const throwingStorage = () => ({
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); }
});

describe('storage seguro', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lee y escribe JSON', () => {
    const storage = createMemoryStorage();
    expect(writeJSON(storage, 'k', { a: 1 })).toBe(true);
    expect(readJSON(storage, 'k', null)).toEqual({ a: 1 });
    removeKey(storage, 'k');
    expect(readJSON(storage, 'k', 'fallback')).toBe('fallback');
  });

  it('devuelve el fallback ante JSON corrupto', () => {
    const storage = createMemoryStorage({ k: '{no es json' });
    expect(readJSON(storage, 'k', [])).toEqual([]);
  });

  it('nunca lanza aunque el storage falle (modo privado, cuota excedida)', () => {
    const storage = throwingStorage();
    expect(readJSON(storage, 'k', 'fb')).toBe('fb');
    expect(writeJSON(storage, 'k', 1)).toBe(false);
    expect(() => removeKey(storage, 'k')).not.toThrow();
  });

  it('resolveStorage usa el storage global si funciona', () => {
    const global = createMemoryStorage();
    vi.stubGlobal('localStorage', global);
    expect(resolveStorage('localStorage')).toBe(global);
  });

  it('resolveStorage cae a memoria si el storage global no está disponible', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    const storage = resolveStorage('localStorage');
    storage.setItem('x', 1);
    expect(storage.getItem('x')).toBe('1');
    storage.clear();
    expect(storage.getItem('x')).toBeNull();
  });
});
