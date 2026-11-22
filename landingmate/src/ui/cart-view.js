/**
 * Drawer del carrito + contador del navbar. Se suscribe al store y re-renderiza
 * en cada cambio, preservando el foco del teclado sobre el control que se usó.
 */
import { freeShippingProgress } from '../checkout/pricing.js';
import { buildWhatsAppOrderUrl } from '../store/whatsapp.js';
import { cartErrorMessage } from '../store/cart.js';
import { escapeHtml, formatPrice, plural } from '../lib/format.js';
import { bumpCart, collapse, prefersReducedMotion, tweenNumber } from './motion.js';

export function cartItemHtml(item, { isNew = false, qtyChanged = false, canIncrement = true } = {}) {
  const name = escapeHtml(item.name);
  return `
    <li class="cart-item${isNew ? ' is-new' : ''}" data-key="${escapeHtml(item.key)}">
      <img src="${escapeHtml(item.image)}" alt="" class="cart-item-img" width="80" height="80" />
      <div class="cart-item-info">
        <div>
          <h4 class="cart-item-title">${name}</h4>
          ${item.details ? `<div class="cart-item-details">${escapeHtml(item.details)}</div>` : ''}
          ${item.engraving ? `<div class="cart-item-engraving">Grabado: "${escapeHtml(item.engraving)}"</div>` : ''}
        </div>
        <div class="cart-item-row">
          <span class="cart-item-price">
            ${formatPrice(item.price * item.quantity)}
            ${item.quantity > 1 ? `<small class="cart-item-unit">${item.quantity} × ${formatPrice(item.price)}</small>` : ''}
          </span>
          <div class="cart-qty-ctrl" role="group" aria-label="Cantidad de ${name}">
            <button type="button" class="btn-qty" data-action="dec" aria-label="Quitar una unidad">−</button>
            <span class="qty-val${qtyChanged ? ' pop' : ''}" data-testid="qty">${item.quantity}</span>
            <button type="button" class="btn-qty" data-action="inc" aria-label="Sumar una unidad"${canIncrement ? '' : ' disabled'}>+</button>
            <button type="button" class="btn-remove-item" data-action="remove" aria-label="Eliminar ${name} del carrito">✕</button>
          </div>
        </div>
      </div>
    </li>`;
}

export function mountCartDrawer({
  root = document,
  cart,
  dialog = null,
  announce = () => {},
  toast = () => {},
  openWindow = (url) => window.open(url, '_blank', 'noopener')
}) {
  const $ = (id) => root.getElementById(id);
  const container = $('cartItemsContainer');
  const emptyState = $('cartEmptyState');
  const footer = $('cartFooter');
  const subtotalEl = $('cartSubtotalAmount');
  const totalEl = $('cartTotalAmount');
  const countBadge = $('navCartCount');
  const cartButton = $('btnNavCart');
  const shippingText = $('shippingStatusText');
  const progressTrack = $('shippingProgressTrack');
  const progressFill = $('shippingProgressFill');
  const whatsappBtn = $('btnCheckoutWhatsApp');
  const drawerCount = $('cartDrawerCount');

  let renderedQty = null;
  let lastCount = cart.count();

  function captureFocus() {
    const active = root.activeElement;
    const row = active?.closest?.('.cart-item');
    if (!row || !container?.contains(row)) return null;
    return { key: row.dataset.key, action: active.dataset.action };
  }

  function restoreFocus(saved, items) {
    if (!saved) return;
    const row = Array.from(container.querySelectorAll('.cart-item')).find((r) => r.dataset.key === saved.key);
    const target = row?.querySelector(`[data-action="${saved.action}"]:not([disabled])`) ?? row?.querySelector('[data-action]:not([disabled])');
    if (target) { target.focus(); return; }
    // La línea desapareció: el foco va a la siguiente línea o al cierre del drawer
    const next = container.querySelector('.cart-item [data-action="remove"]');
    (next ?? (items.length ? null : $('btnCloseCart')))?.focus();
  }

  function render(items = cart.getItems()) {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

    if (countBadge) {
      countBadge.textContent = String(count);
      countBadge.hidden = count === 0;
    }
    if (cartButton) cartButton.setAttribute('aria-label', count ? `Abrir carrito (${plural(count, 'producto')})` : 'Abrir carrito, vacío');
    if (drawerCount) drawerCount.textContent = count ? `(${count})` : '';
    if (count > lastCount && !prefersReducedMotion()) bumpCart(root);
    lastCount = count;

    const progress = freeShippingProgress(subtotal);
    if (progressFill) progressFill.style.width = `${progress.percent}%`;
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(progress.percent));
    if (shippingText) {
      shippingText.innerHTML = progress.qualifies
        ? '<span aria-hidden="true">🎉</span> <strong>¡Felicitaciones! Tenés ENVÍO GRATIS</strong> en tu pedido.'
        : `<span aria-hidden="true">🚚</span> Agregá <strong>${formatPrice(progress.remaining)}</strong> más para tener <strong>ENVÍO GRATIS</strong>.`;
    }

    if (!container) return;
    const focus = captureFocus();
    const isEmpty = items.length === 0;
    if (emptyState) emptyState.hidden = !isEmpty;
    if (footer) footer.hidden = isEmpty;

    const prev = renderedQty;
    container.innerHTML = items.map((item) => cartItemHtml(item, {
      isNew: prev !== null && !(item.key in prev),
      qtyChanged: prev !== null && item.key in prev && prev[item.key] !== item.quantity,
      canIncrement: cart.remainingFor(item.key) > 0
    })).join('');
    renderedQty = Object.fromEntries(items.map((i) => [i.key, i.quantity]));

    const money = (v) => formatPrice(Math.round(v));
    tweenNumber(subtotalEl, subtotal, money);
    tweenNumber(totalEl, subtotal, money);
    restoreFocus(focus, items);
  }

  container?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    const row = btn?.closest('.cart-item');
    if (!btn || !row || row.classList.contains('is-leaving')) return;
    const key = row.dataset.key;
    const item = cart.getItem(key);
    if (!item) return;
    const action = btn.dataset.action;

    if (action === 'remove' || (action === 'dec' && item.quantity === 1)) {
      collapse(row, () => {
        cart.remove(key);
        announce(`${item.name} se eliminó del carrito.`);
      });
      return;
    }
    const result = cart.increment(key, action === 'inc' ? 1 : -1);
    if (result.ok) announce(`${item.name}: ${plural(result.quantity, 'unidad', 'unidades')}.`);
    else toast(cartErrorMessage(result.reason, item.name));
  });

  emptyState?.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-cart]')) dialog?.close({ restoreFocus: false });
  });

  whatsappBtn?.addEventListener('click', () => {
    const url = buildWhatsAppOrderUrl(cart.getItems());
    if (!url) { toast('Tu carrito está vacío. Agregá algún producto antes de finalizar.'); return; }
    openWindow(url);
  });

  cartButton?.addEventListener('click', () => dialog?.open(cartButton));
  $('btnCloseCart')?.addEventListener('click', () => dialog?.close());

  cart.subscribe(render);
  render();
  return { render };
}
