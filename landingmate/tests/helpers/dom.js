import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Carga el HTML real de una página (index.html / checkout.html) en el documento de jsdom. */
export function loadPage(file) {
  // Vitest corre con la raíz del proyecto como cwd
  const html = readFileSync(resolve(process.cwd(), file), 'utf8');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  // Se conservan los mismos <head>/<body>: `screen` de Testing Library queda ligado a document.body
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.body.className = parsed.body.className;
  // Los scripts no se ejecutan en jsdom: cada test monta lo que necesita
}

/** location/history falsos para probar la sincronización con la URL sin navegar. */
export function fakeUrl(search = '', pathname = '/index.html', hash = '') {
  const location = { search, pathname, hash };
  const history = {
    state: null,
    entries: [],
    replaceState(state, _title, url) {
      this.entries.push(url);
      const parsed = new URL(url, 'http://localhost');
      location.search = parsed.search;
      location.pathname = parsed.pathname;
    }
  };
  return { location, history };
}

/** Espera a que se vacíe la cola de microtareas y timers de 0 ms. */
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
