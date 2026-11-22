/**
 * Utilidades de formato y saneamiento. Sin dependencias del DOM.
 */

const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
});

/** Formatea un importe entero en pesos argentinos: 44900 -> "$ 44.900". */
export function formatPrice(amount) {
  const value = Number.isFinite(amount) ? amount : 0;
  return ARS.format(Math.round(value));
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para interpolarlo en HTML sin riesgo de inyección. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Minúsculas y sin tildes, para búsquedas tolerantes ("algarróbo" == "algarrobo"). */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Pluraliza de forma simple: plural(2, 'producto') -> "2 productos". */
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Devuelve una versión con retardo de `fn` (útil para el buscador). */
export function debounce(fn, wait = 200) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    if (wait <= 0) return fn(...args);
    timer = setTimeout(() => fn(...args), wait);
    return undefined;
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
