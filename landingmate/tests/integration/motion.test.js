import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/dom';
import { fakeUrl, loadPage } from '../helpers/dom.js';
import {
  bumpCart, collapse, easeOutExpo, flyToCart, hasFinePointer, prefersReducedMotion, setText, splitWords, tweenNumber
} from '../../src/ui/motion.js';
import { mountCatalog } from '../../src/ui/catalog-view.js';
import { PRODUCTS } from '../../src/data/products.js';

/** Simula un usuario SIN "reducir movimiento" y con mouse. */
function enableMotion() {
  const original = window.matchMedia;
  window.matchMedia = (query) => ({ ...original(query), matches: !query.includes('prefers-reduced-motion') });
  return () => { window.matchMedia = original; };
}

describe('Micro-interacciones (con animaciones habilitadas)', () => {
  let restore;
  let frames;
  beforeEach(() => {
    restore = enableMotion();
    vi.useFakeTimers();
    // requestAnimationFrame controlado: cada tick avanza 100 ms
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    restore();
    vi.unstubAllGlobals();
  });
  const runFrames = (times, start = performance.now()) => {
    for (let i = 1; i <= times; i += 1) {
      const pending = frames.splice(0);
      pending.forEach((cb) => cb(start + i * 100));
    }
  };

  it('detecta preferencias del usuario', () => {
    expect(prefersReducedMotion()).toBe(false);
    expect(hasFinePointer()).toBe(true);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeOutExpo(0)).toBe(0);
  });

  it('tweenNumber asigna el primer valor y anima los siguientes hasta el final', () => {
    const el = document.createElement('span');
    const fmt = (v) => String(Math.round(v));
    tweenNumber(el, 100, fmt);
    expect(el.textContent).toBe('100');
    tweenNumber(el, 100, fmt);
    expect(el.textContent).toBe('100');
    tweenNumber(el, 200, fmt, 500);
    runFrames(2);
    const mid = Number(el.textContent);
    expect(mid).toBeGreaterThan(100);
    expect(mid).toBeLessThan(200);
    runFrames(10);
    expect(el.textContent).toBe('200');
    expect(() => tweenNumber(null, 1, fmt)).not.toThrow();
  });

  it('setText solo destella cuando el texto cambia después del primer render', () => {
    const el = document.createElement('span');
    setText(el, 'A');
    expect(el.classList.contains('flash')).toBe(false);
    setText(el, 'A');
    setText(el, 'B');
    expect(el.classList.contains('flash')).toBe(true);
    expect(() => setText(null, 'x')).not.toThrow();
  });

  it('splitWords parte el título en palabras pero conserva un nombre accesible legible', () => {
    document.body.innerHTML = '<h2 id="t">Obras de Arte <span class="gold-text">Día a Día</span></h2>';
    const h = document.getElementById('t');
    splitWords(h);
    expect(h.querySelectorAll('.w')).toHaveLength(6);
    expect(screen.getByRole('heading', { name: 'Obras de Arte Día a Día' })).toBe(h);
    splitWords(h); // idempotente
    expect(h.querySelectorAll('.w')).toHaveLength(6);
  });

  it('bumpCart reinicia la animación del icono', () => {
    document.body.innerHTML = '<button id="btnNavCart"><span id="navCartCount"></span></button>';
    bumpCart();
    expect(document.getElementById('btnNavCart').classList.contains('bump')).toBe(true);
    expect(document.getElementById('navCartCount').classList.contains('bump')).toBe(true);
  });

  it('flyToCart anima un clon y luego ejecuta el callback una sola vez', () => {
    document.body.innerHTML = '<button id="btnNavCart"></button><img id="src" src="a.jpg">';
    const img = document.getElementById('src');
    img.getBoundingClientRect = () => ({ left: 10, top: 10, width: 100, height: 100 });
    const listeners = {};
    img.animate = vi.fn();
    HTMLElement.prototype.animate = vi.fn(() => ({ addEventListener: (type, fn) => { listeners[type] = fn; } }));
    const done = vi.fn();
    flyToCart(img, done);
    expect(document.querySelector('.fly-clone')).not.toBeNull();
    listeners.finish();
    listeners.cancel();
    vi.advanceTimersByTime(1500);
    expect(done).toHaveBeenCalledOnce();
    expect(document.querySelector('.fly-clone')).toBeNull();
    delete HTMLElement.prototype.animate;
  });

  it('flyToCart sin imagen visible ejecuta el callback directamente', () => {
    const done = vi.fn();
    flyToCart(null, done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('collapse marca el elemento y espera la transición', () => {
    const el = document.createElement('div');
    const done = vi.fn();
    collapse(el, done, 300);
    expect(el.classList.contains('is-leaving')).toBe(true);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(done).toHaveBeenCalledOnce();
  });

  it('el cambio de categoría anima la grilla y descarta cambios superados', () => {
    loadPage('index.html');
    mountCatalog({ products: PRODUCTS, searchDelay: 0, ...fakeUrl() });
    const grid = document.getElementById('productCatalogGrid');
    const cards = () => within(grid).queryAllByRole('article');

    screen.getByRole('button', { name: /Mates Imperiales/ }).click();
    expect(grid.classList.contains('is-switching')).toBe(true);
    // Un segundo clic antes de terminar invalida el primero
    screen.getByRole('button', { name: /Termos de Precisión/ }).click();
    vi.advanceTimersByTime(230);
    expect(cards().every((c) => PRODUCTS.find((p) => p.id === c.dataset.productId).category === 'termos')).toBe(true);
    expect(grid.classList.contains('is-switching')).toBe(false);
    vi.advanceTimersByTime(620);
    expect(grid.classList.contains('is-resizing')).toBe(false);
    expect(grid.style.height).toBe('');
  });
});
