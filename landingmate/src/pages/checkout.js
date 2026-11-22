/**
 * Entry point del checkout (checkout.html).
 */
import { PRODUCTS } from '../data/products.js';
import { createCart } from '../store/cart.js';
import { createCheckoutFlow } from '../checkout/flow.js';
import { processPayment as simulatePayment } from '../checkout/payment.js';
import { readJSON, resolveStorage, writeJSON } from '../lib/storage.js';
import { createAnnouncer } from '../ui/a11y.js';
import { mountCheckout } from '../ui/checkout-view.js';

export const LAST_ORDER_KEY = 'lavaditos_last_order';

export function bootCheckout({
  storage = resolveStorage('localStorage'),
  session = resolveStorage('sessionStorage'),
  products = PRODUCTS,
  paymentDelay = 1400
} = {}) {
  const cart = createCart({ storage, catalog: products });
  const flow = createCheckoutFlow({ storage: session });

  const view = mountCheckout({
    cart,
    flow,
    processPayment: (payment) => simulatePayment(payment, { delay: paymentDelay }),
    saveOrder: (order) => writeJSON(storage, LAST_ORDER_KEY, order),
    loadOrder: () => readJSON(storage, LAST_ORDER_KEY, null),
    announce: createAnnouncer(document.getElementById('srAnnouncer'))
  });

  window.addEventListener('storage', (e) => { if (e.key === cart.storageKey) cart.reload(); });

  // En pantallas chicas el resumen arranca colapsado
  const details = document.getElementById('summaryDetails');
  if (details && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 959px)').matches) details.open = false;

  window.__lavReady = true;
  return { cart, flow, view };
}
