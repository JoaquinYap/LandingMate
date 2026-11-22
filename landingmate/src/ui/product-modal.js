/**
 * Modal de detalle ("Ver Detalle"): ficha, stock, grabado opcional y agregar al carrito.
 */
import { escapeHtml, formatPrice } from '../lib/format.js';
import { stockInfo } from './catalog-view.js';

export function mountProductModal({ root = document, products, dialog, onAdd = () => {} }) {
  const $ = (id) => root.getElementById(id);
  const img = $('modalProductImg');
  const category = $('modalProductCategory');
  const title = $('modalProductTitle');
  const price = $('modalProductPrice');
  const priceOld = $('modalProductPriceOld');
  const desc = $('modalProductDesc');
  const specs = $('modalProductSpecs');
  const stock = $('modalProductStock');
  const engraving = $('modalEngravingInput');
  const addBtn = $('modalAddCartBtn');
  let current = null;

  function open(productId, trigger) {
    const product = products.find((p) => p.id === productId);
    if (!product) return false;
    current = product;
    const info = stockInfo(product);

    if (img) { img.src = product.image; img.alt = product.name; }
    if (category) category.textContent = product.categoryLabel;
    if (title) title.textContent = product.name;
    if (price) price.textContent = formatPrice(product.price);
    if (priceOld) priceOld.textContent = product.oldPrice ? formatPrice(product.oldPrice) : '';
    if (desc) desc.textContent = product.description;
    if (engraving) engraving.value = '';
    if (stock) {
      stock.textContent = info.text;
      stock.className = `card-stock is-${info.level}`;
    }
    if (specs) {
      specs.innerHTML = product.specs.map((spec) => `
        <li>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ${escapeHtml(spec)}
        </li>`).join('');
    }
    if (addBtn) {
      addBtn.disabled = info.level === 'out';
      const label = addBtn.querySelector('.btn-label');
      if (label) label.textContent = info.level === 'out' ? 'Sin stock' : 'Agregar al Carrito';
    }
    dialog.open(trigger);
    return true;
  }

  addBtn?.addEventListener('click', () => {
    if (!current) return;
    const text = engraving ? engraving.value.trim() : '';
    const product = current;
    dialog.close({ restoreFocus: false });
    onAdd(product, { engraving: text, image: img });
  });

  $('btnCloseModal')?.addEventListener('click', () => dialog.close());

  return { open, close: () => dialog.close(), get current() { return current; } };
}
