/**
 * Setup de los tests de integración (jsdom).
 * - matchMedia: jsdom no lo implementa. Se simula "prefers-reduced-motion: reduce"
 *   para que las animaciones se resuelvan al instante y los tests sean deterministas.
 * - Se limpian el DOM y los storages entre tests.
 */
import { afterEach, vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })
});

window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.body.className = '';
  document.title = '';
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
