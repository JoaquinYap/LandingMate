/**
 * Entry point de la home (index.html): crea los stores y monta cada vista.
 */
import { PRODUCTS } from '../data/products.js';
import { createCart, cartErrorMessage } from '../store/cart.js';
import { resolveStorage } from '../lib/storage.js';
import { plural } from '../lib/format.js';
import { createAnnouncer, createDialog, createToast } from '../ui/a11y.js';
import { flyToCart } from '../ui/motion.js';
import { mountCatalog } from '../ui/catalog-view.js';
import { mountCartDrawer } from '../ui/cart-view.js';
import { mountProductModal } from '../ui/product-modal.js';
import { mountCustomizer } from '../ui/customizer-view.js';
import {
  attachIndicator, initCuringGuide, initFaq, initHero, initHeroParallax, initMagnetic, initMarquee,
  initScrollEffects, initScrollSpy, initSectionChoreography, initSocialProof, initSpotlight, observeReveals
} from '../ui/effects.js';

export function bootHome({ storage = resolveStorage('localStorage'), products = PRODUCTS, effects = true } = {}) {
  const $ = (id) => document.getElementById(id);
  const cart = createCart({ storage, catalog: products });
  const toast = createToast($('uiToast'));
  const announce = createAnnouncer($('srAnnouncer'));

  const cartDialog = createDialog($('cartOverlay'), { panel: document.querySelector('.cart-drawer') });
  const productDialog = createDialog($('productModal'), {
    panel: document.querySelector('#productModal .modal-card'),
    initialFocus: () => $('modalEngravingInput')
  });
  const mobileNav = createDialog($('mobileNavDrawer'), {
    onOpen: () => $('mobileToggle')?.setAttribute('aria-expanded', 'true'),
    onClose: () => $('mobileToggle')?.setAttribute('aria-expanded', 'false')
  });

  /** Valida stock, anima el producto hacia el carrito y abre el drawer. */
  function addToCart(product, { engraving = '', details = '', image = null, button = null } = {}) {
    const check = cart.canAdd(product, { engraving });
    if (!check.ok) {
      toast(cartErrorMessage(check.reason, product.name));
      return check;
    }
    if (button) {
      button.classList.add('is-added');
      setTimeout(() => button.classList.remove('is-added'), 900);
    }
    flyToCart(image, () => {
      const result = cart.add(product, { engraving, details });
      if (!result.ok) { toast(cartErrorMessage(result.reason, product.name)); return; }
      announce(`${product.name} agregado al carrito. Total: ${plural(cart.count(), 'producto')}.`);
      cartDialog.open(button ?? $('btnNavCart'));
    });
    return check;
  }

  const modal = mountProductModal({
    products,
    dialog: productDialog,
    onAdd: (product, { engraving, image }) => addToCart(product, { engraving, image })
  });

  const catalog = mountCatalog({
    products,
    onView: (id, trigger) => modal.open(id, trigger),
    onAdd: (product, { button, image }) => addToCart(product, { button, image }),
    onRendered: () => { if (effects) observeReveals(); }
  });

  mountCartDrawer({ cart, dialog: cartDialog, announce, toast });

  mountCustomizer({
    products,
    onAddKit: (kit, { image, button }) => addToCart(kit.product, { engraving: kit.engraving, details: kit.details, image, button })
  });

  // Menú móvil
  $('mobileToggle')?.addEventListener('click', (e) => mobileNav.open(e.currentTarget));
  $('btnCloseMobileNav')?.addEventListener('click', () => mobileNav.close());
  document.querySelectorAll('.mobile-nav-link').forEach((link) => link.addEventListener('click', () => mobileNav.close({ restoreFocus: false })));

  // Newsletter (simulado)
  const newsletterForm = $('newsletterForm');
  newsletterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('newsletterEmail').value.trim();
    if (!email) return;
    const submitBtn = newsletterForm.querySelector('button[type="submit"]');
    const label = submitBtn.textContent;
    submitBtn.textContent = '¡Cupón enviado!';
    submitBtn.classList.add('is-done');
    submitBtn.disabled = true;
    toast(`Te enviamos tu cupón a ${email}. Usá el código MATERO10 en el checkout.`);
    newsletterForm.reset();
    setTimeout(() => {
      submitBtn.textContent = label;
      submitBtn.classList.remove('is-done');
      submitBtn.disabled = false;
    }, 3200);
  });

  // Otra pestaña (p. ej. el checkout) modificó el carrito
  window.addEventListener('storage', (e) => { if (e.key === cart.storageKey) cart.reload(); });

  if (effects) {
    initSectionChoreography();
    initMarquee();
    initHero();
    attachIndicator(document.querySelector('.catalog-filters'), '.filter-btn');
    initScrollEffects();
    initScrollSpy();
    initHeroParallax();
    initSpotlight();
    initMagnetic();
    initCuringGuide();
    initFaq();
    initSocialProof();
    observeReveals();
  }

  window.__lavReady = true;
  return { cart, catalog, modal, dialogs: { cart: cartDialog, product: productDialog, mobileNav } };
}
