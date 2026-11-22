/**
 * Vista del catálogo: conecta la toolbar de filtros con las funciones puras de
 * `store/catalog.js`, renderiza las cards y mantiene la URL sincronizada.
 */
import {
  SORT_OPTIONS, DEFAULT_FILTERS, applyCatalog, categoryCounts, discountPercent,
  filtersFromQuery, filtersToQuery, hasActiveFilters, normalizeFilters
} from '../store/catalog.js';
import { LOW_STOCK_THRESHOLD } from '../data/products.js';
import { debounce, escapeHtml, formatPrice, plural } from '../lib/format.js';
import { prefersReducedMotion } from './motion.js';

const ICON_EYE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const ICON_CART = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';

const ratingLabel = (p) => `Valoración ${String(p.rating).replace('.', ',')} de 5, ${p.reviews} opiniones`;

export function stockInfo(product) {
  if (!(product.stock > 0)) return { level: 'out', text: 'Sin stock' };
  if (product.stock <= LOW_STOCK_THRESHOLD) return { level: 'low', text: `¡Últimas ${plural(product.stock, 'unidad', 'unidades')}!` };
  return { level: 'ok', text: 'En stock' };
}

export function productCardHtml(product) {
  const id = escapeHtml(product.id);
  const name = escapeHtml(product.name);
  const titleId = `card-title-${id}`;
  const stock = stockInfo(product);
  const discount = discountPercent(product);
  const out = stock.level === 'out';
  const stars = '★★★★★'.slice(0, Math.round(product.rating ?? 0)).padEnd(5, '☆');

  return `
    <article class="product-card spot reveal${out ? ' is-out-of-stock' : ''}" data-product-id="${id}" aria-labelledby="${titleId}">
      ${product.badge ? `<span class="card-badge">${escapeHtml(product.badge)}</span>` : ''}
      <div class="card-image-box" data-action="view">
        <img src="${escapeHtml(product.image)}" alt="${name}" loading="lazy" decoding="async" width="600" height="600" />
        <div class="card-quick-actions">
          <button type="button" class="btn-quick-view" data-action="view" aria-describedby="${titleId}">${ICON_EYE} Ver Detalle</button>
        </div>
      </div>
      <div class="card-content">
        <span class="card-category">${escapeHtml(product.categoryLabel)}</span>
        <h3 class="card-title" id="${titleId}"><button type="button" class="card-title-btn" data-action="view">${name}</button></h3>
        ${product.rating ? `<div class="card-rating" role="img" aria-label="${ratingLabel(product)}"><span aria-hidden="true">${stars}</span> <span class="card-rating-num" aria-hidden="true">${String(product.rating).replace('.', ',')} (${product.reviews})</span></div>` : ''}
        <p class="card-desc">${escapeHtml(product.description)}</p>
        <div class="card-pricing">
          <div class="price-box">
            ${product.oldPrice ? `<span class="price-original"><span class="sr-only">Precio anterior: </span>${formatPrice(product.oldPrice)}</span>` : ''}
            <span class="price-current"><span class="sr-only">Precio: </span>${formatPrice(product.price)}</span>
            <span class="installments-text">6 cuotas sin interés de ${formatPrice(Math.round(product.price / 6))}</span>
          </div>
          ${discount ? `<span class="card-discount">-${discount}%</span>` : ''}
        </div>
        <p class="card-stock is-${stock.level}">${stock.text}</p>
        <button type="button" class="btn-add-cart" data-action="add" aria-describedby="${titleId}"${out ? ' disabled' : ''}>
          ${ICON_CART} ${out ? 'Sin stock' : 'Agregar al Carrito'}
        </button>
      </div>
    </article>`;
}

export function mountCatalog({
  root = document,
  products,
  onView = () => {},
  onAdd = () => {},
  onRendered = () => {},
  location = window.location,
  history = window.history,
  searchDelay = 250
}) {
  const $ = (id) => root.getElementById(id);
  const grid = $('productCatalogGrid');
  const search = $('catalogSearch');
  const sort = $('catalogSort');
  const minPrice = $('catalogMinPrice');
  const maxPrice = $('catalogMaxPrice');
  const inStock = $('catalogInStock');
  const onSale = $('catalogOnSale');
  const results = $('catalogResultsCount');
  const clearBtn = $('catalogClearFilters');
  const empty = $('catalogEmptyState');
  const categoryButtons = Array.from(root.querySelectorAll('.filter-btn[data-filter]'));
  if (!grid) return null;

  if (sort) sort.innerHTML = SORT_OPTIONS.map((o) => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join('');

  let filters = filtersFromQuery(location.search);
  let switchToken = 0;

  function syncControls() {
    if (search) search.value = filters.query;
    if (sort) sort.value = filters.sort;
    if (minPrice) minPrice.value = filters.minPrice ?? '';
    if (maxPrice) maxPrice.value = filters.maxPrice ?? '';
    if (inStock) inStock.checked = filters.inStock;
    if (onSale) onSale.checked = filters.onSale;
    categoryButtons.forEach((btn) => {
      const active = btn.dataset.filter === filters.category;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function syncUrl() {
    const qs = filtersToQuery(filters);
    const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
    history.replaceState(history.state, '', url);
  }

  function renderGrid() {
    const list = applyCatalog(products, filters);
    grid.innerHTML = list.map(productCardHtml).join('');
    grid.querySelectorAll('.card-image-box img').forEach((img) => {
      const box = img.closest('.card-image-box');
      const done = () => box.classList.add('is-loaded');
      if (img.complete) done();
      else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    });

    const counts = categoryCounts(products, filters);
    categoryButtons.forEach((btn) => {
      let badge = btn.querySelector('.filter-count');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'filter-count';
        btn.append(' ', badge);
      }
      const n = counts[btn.dataset.filter] ?? 0;
      badge.textContent = `(${n})`;
      badge.setAttribute('aria-label', plural(n, 'producto'));
    });

    if (results) results.textContent = list.length ? `Mostrando ${plural(list.length, 'producto')}` : 'No encontramos productos con esos filtros';
    if (empty) empty.hidden = list.length > 0;
    grid.hidden = list.length === 0;
    if (clearBtn) clearBtn.hidden = !hasActiveFilters(filters);
    onRendered(list);
    return list;
  }

  // Cambio de categoría: fade-out, intercambio y altura que se acomoda sin saltos
  function renderAnimated() {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') { renderGrid(); return; }
    const token = ++switchToken;
    const startHeight = grid.offsetHeight;
    grid.style.height = `${startHeight}px`;
    grid.classList.add('is-switching', 'is-resizing');
    setTimeout(() => {
      if (token !== switchToken) return;
      grid.style.transition = 'none';
      grid.style.height = 'auto';
      renderGrid();
      const endHeight = grid.offsetHeight;
      grid.style.height = `${startHeight}px`;
      void grid.offsetHeight;
      grid.style.transition = '';
      grid.classList.remove('is-switching');
      grid.style.height = `${endHeight}px`;
      setTimeout(() => {
        if (token !== switchToken) return;
        grid.style.height = '';
        grid.classList.remove('is-resizing');
      }, 620);
    }, 230);
  }

  function setFilters(partial, { animate = false } = {}) {
    filters = normalizeFilters({ ...filters, ...partial });
    syncControls();
    syncUrl();
    if (animate) renderAnimated();
    else renderGrid();
  }

  const onSearch = debounce(() => setFilters({ query: search.value }), searchDelay);
  const onPrice = debounce(() => setFilters({ minPrice: minPrice?.value, maxPrice: maxPrice?.value }), searchDelay);

  // Enter en el buscador no recarga la página: aplica la búsqueda al instante
  search?.form?.addEventListener('submit', (e) => {
    e.preventDefault();
    onSearch.cancel();
    setFilters({ query: search.value });
  });
  search?.addEventListener('input', onSearch);
  search?.addEventListener('search', () => { onSearch.cancel(); setFilters({ query: search.value }); });
  sort?.addEventListener('change', () => setFilters({ sort: sort.value }));
  minPrice?.addEventListener('input', onPrice);
  maxPrice?.addEventListener('input', onPrice);
  inStock?.addEventListener('change', () => setFilters({ inStock: inStock.checked }));
  onSale?.addEventListener('change', () => setFilters({ onSale: onSale.checked }));

  categoryButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.filter === filters.category) return;
      setFilters({ category: btn.dataset.filter }, { animate: true });
    });
  });

  const clearAll = () => {
    onSearch.cancel();
    onPrice.cancel();
    setFilters({ ...DEFAULT_FILTERS });
    search?.focus();
  };
  clearBtn?.addEventListener('click', clearAll);
  empty?.addEventListener('click', (e) => { if (e.target.closest('[data-clear-filters]')) clearAll(); });

  grid.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    const card = event.target.closest('.product-card');
    if (!actionEl || !card) return;
    const product = products.find((p) => p.id === card.dataset.productId);
    if (!product) return;
    if (actionEl.dataset.action === 'add') {
      onAdd(product, { button: actionEl, image: card.querySelector('.card-image-box img') });
    } else if (actionEl.dataset.action === 'view') {
      // El contenedor de imagen no es enfocable: el foco vuelve al botón de la card
      const trigger = actionEl.matches('button') ? actionEl : card.querySelector('.btn-quick-view');
      onView(product.id, trigger);
    }
  });

  syncControls();
  renderGrid();

  return {
    getFilters: () => ({ ...filters }),
    setFilters,
    render: renderGrid
  };
}
