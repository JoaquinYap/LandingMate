/**
 * Accesibilidad: diálogos modales con foco atrapado y anuncios para lectores de pantalla.
 */

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

export function focusableIn(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden], [inert]') && el.getAttribute('aria-hidden') !== 'true'
  );
}

const openDialogs = [];

/** Descarta diálogos cuyo overlay ya no está en el documento. */
function pruneDialogs() {
  for (let i = openDialogs.length - 1; i >= 0; i -= 1) {
    if (!openDialogs[i].isConnected()) openDialogs.splice(i, 1);
  }
}

/** Sincroniza el bloqueo de scroll del fondo con los diálogos abiertos. */
function syncScrollLock() {
  pruneDialogs();
  document.body.classList.toggle('no-scroll', openDialogs.length > 0);
}

/**
 * Convierte un overlay en diálogo modal accesible:
 * - `inert` cuando está cerrado (sus botones no reciben foco con Tab)
 * - foco inicial dentro, Tab circular, Escape cierra, el foco vuelve al disparador.
 */
export function createDialog(overlay, { panel = overlay, initialFocus = null, onOpen, onClose } = {}) {
  let returnFocus = null;

  const setClosedState = () => {
    overlay.setAttribute('inert', '');
    overlay.setAttribute('aria-hidden', 'true');
  };
  setClosedState();

  const isOpen = () => overlay.classList.contains('open');

  function onKeydown(event) {
    pruneDialogs();
    if (!overlay.isConnected) { document.removeEventListener('keydown', onKeydown); return; }
    if (openDialogs[openDialogs.length - 1] !== api) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusableIn(panel);
    if (!items.length) { event.preventDefault(); panel.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open(trigger = document.activeElement) {
    if (isOpen()) return;
    returnFocus = trigger instanceof HTMLElement ? trigger : null;
    overlay.removeAttribute('inert');
    overlay.removeAttribute('aria-hidden');
    overlay.classList.add('open');
    openDialogs.push(api);
    syncScrollLock();
    document.addEventListener('keydown', onKeydown);
    onOpen?.();
    const target = (typeof initialFocus === 'function' ? initialFocus() : initialFocus) || focusableIn(panel)[0] || panel;
    target.focus({ preventScroll: true });
    // Si el overlay todavía no era visible para el navegador, se reintenta en el próximo frame
    if (document.activeElement !== target && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => { if (isOpen() && !panel.contains(document.activeElement)) target.focus({ preventScroll: true }); });
    }
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    overlay.classList.remove('open');
    setClosedState();
    const idx = openDialogs.indexOf(api);
    if (idx !== -1) openDialogs.splice(idx, 1);
    syncScrollLock();
    document.removeEventListener('keydown', onKeydown);
    onClose?.();
    if (restoreFocus && returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  // Click en el fondo (fuera del panel) cierra
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  const api = { open, close, isOpen, isConnected: () => overlay.isConnected, toggle: (t) => (isOpen() ? close() : open(t)) };
  return api;
}

/** Región `aria-live` para anunciar cambios que no son visibles como foco. */
export function createAnnouncer(el) {
  let timer;
  return (message) => {
    if (!el) return;
    // Se vacía primero para que el mismo mensaje repetido vuelva a anunciarse
    el.textContent = '';
    clearTimeout(timer);
    timer = setTimeout(() => { el.textContent = message; }, 30);
  };
}

/** Toast visible + anuncio (role="status"). */
export function createToast(el, { duration = 3600 } = {}) {
  let timer;
  return (message) => {
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), duration);
  };
}
