import { describe, expect, it, vi } from 'vitest';
import { debounce, escapeHtml, formatPrice, normalizeText, plural } from '../../src/lib/format.js';

// Intl usa un espacio duro entre "$" y el número
const ars = (s) => s.replace(/\u00a0/g, ' ');

describe('formatPrice', () => {
  it('formatea pesos argentinos con separador de miles y sin decimales', () => {
    expect(ars(formatPrice(44900))).toBe('$ 44.900');
    expect(ars(formatPrice(1234567))).toBe('$ 1.234.567');
  });

  it('redondea importes con decimales', () => {
    expect(ars(formatPrice(999.6))).toBe('$ 1.000');
  });

  it.each([NaN, undefined, null, Infinity])('trata %s como $ 0', (value) => {
    expect(ars(formatPrice(value))).toBe('$ 0');
  });
});

describe('escapeHtml', () => {
  it('neutraliza caracteres peligrosos', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml("Mate 'Pampa' & Co")).toBe('Mate &#39;Pampa&#39; &amp; Co');
  });

  it('convierte null/undefined en string vacío', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('normalizeText', () => {
  it('pasa a minúsculas, quita tildes y espacios extremos', () => {
    expect(normalizeText('  Algarróbo CHAQUEÑO ')).toBe('algarrobo chaqueno');
  });
});

describe('plural', () => {
  it('usa singular solo para 1', () => {
    expect(plural(1, 'producto')).toBe('1 producto');
    expect(plural(0, 'producto')).toBe('0 productos');
    expect(plural(3, 'unidad', 'unidades')).toBe('3 unidades');
  });
});

describe('debounce', () => {
  it('ejecuta una sola vez con los últimos argumentos', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 200);
    d('a');
    d('b');
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('b');
    vi.useRealTimers();
  });

  it('se puede cancelar', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    vi.runAllTimers();
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('con espera 0 ejecuta en forma sincrónica', () => {
    const fn = vi.fn(() => 'ok');
    expect(debounce(fn, 0)('x')).toBe('ok');
  });
});
