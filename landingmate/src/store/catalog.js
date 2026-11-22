/**
 * Búsqueda, filtros y orden del catálogo. Funciones puras: reciben productos y
 * filtros, devuelven productos. El estado de los filtros se serializa en la URL
 * para que cada búsqueda sea compartible ("?cat=termos&orden=precio-asc").
 */
import { CATEGORIES } from '../data/products.js';
import { normalizeText } from '../lib/format.js';

export const SORT_OPTIONS = Object.freeze([
  { id: 'destacados', label: 'Destacados' },
  { id: 'precio-asc', label: 'Precio: menor a mayor' },
  { id: 'precio-desc', label: 'Precio: mayor a menor' },
  { id: 'descuento', label: 'Mayor descuento' },
  { id: 'valoracion', label: 'Mejor valorados' },
  { id: 'nombre', label: 'Nombre (A-Z)' }
]);

export const DEFAULT_FILTERS = Object.freeze({
  category: 'todos',
  query: '',
  minPrice: null,
  maxPrice: null,
  inStock: false,
  onSale: false,
  sort: 'destacados'
});

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));
const SORT_IDS = new Set(SORT_OPTIONS.map((s) => s.id));

export function discountPercent(product) {
  if (!product.oldPrice || product.oldPrice <= product.price) return 0;
  return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
}

export function matchesQuery(product, query) {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizeText(
    [product.name, product.categoryLabel, product.material, product.badge, product.description].join(' ')
  );
  return tokens.every((token) => haystack.includes(token));
}

const toPrice = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

/** Completa y valida un objeto de filtros parcial. */
export function normalizeFilters(partial = {}) {
  const f = { ...DEFAULT_FILTERS, ...partial };
  let minPrice = toPrice(f.minPrice);
  let maxPrice = toPrice(f.maxPrice);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  return {
    category: CATEGORY_IDS.has(f.category) ? f.category : DEFAULT_FILTERS.category,
    query: String(f.query ?? '').slice(0, 80),
    minPrice,
    maxPrice,
    inStock: Boolean(f.inStock),
    onSale: Boolean(f.onSale),
    sort: SORT_IDS.has(f.sort) ? f.sort : DEFAULT_FILTERS.sort
  };
}

/** Aplica todos los filtros salvo los que se indiquen en `skip` (para contar facetas). */
export function filterProducts(products, filters, { skip = [] } = {}) {
  const f = normalizeFilters(filters);
  return products.filter((p) => {
    if (!skip.includes('category') && f.category !== 'todos' && p.category !== f.category) return false;
    if (f.minPrice !== null && p.price < f.minPrice) return false;
    if (f.maxPrice !== null && p.price > f.maxPrice) return false;
    if (f.inStock && !(p.stock > 0)) return false;
    if (f.onSale && discountPercent(p) === 0) return false;
    return matchesQuery(p, f.query);
  });
}

const collator = new Intl.Collator('es', { sensitivity: 'base' });
const SORTERS = {
  destacados: (a, b) => (a.featuredRank ?? 0) - (b.featuredRank ?? 0),
  'precio-asc': (a, b) => a.price - b.price,
  'precio-desc': (a, b) => b.price - a.price,
  descuento: (a, b) => discountPercent(b) - discountPercent(a),
  valoracion: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviews ?? 0) - (a.reviews ?? 0),
  nombre: (a, b) => collator.compare(a.name, b.name)
};

/** Ordena sin mutar; los productos sin stock van siempre al final. */
export function sortProducts(products, sort = 'destacados') {
  const compare = SORTERS[sort] ?? SORTERS.destacados;
  return [...products].sort((a, b) => {
    const stockDiff = Number(!(a.stock > 0)) - Number(!(b.stock > 0));
    return stockDiff || compare(a, b) || SORTERS.destacados(a, b);
  });
}

export function applyCatalog(products, filters) {
  const f = normalizeFilters(filters);
  return sortProducts(filterProducts(products, f), f.sort);
}

/** Cantidad de resultados por categoría respetando el resto de los filtros. */
export function categoryCounts(products, filters) {
  const base = filterProducts(products, filters, { skip: ['category'] });
  return Object.fromEntries(
    CATEGORIES.map((c) => [c.id, c.id === 'todos' ? base.length : base.filter((p) => p.category === c.id).length])
  );
}

export function hasActiveFilters(filters) {
  const f = normalizeFilters(filters);
  return (
    f.category !== DEFAULT_FILTERS.category ||
    f.query.trim() !== '' ||
    f.minPrice !== null ||
    f.maxPrice !== null ||
    f.inStock ||
    f.onSale ||
    f.sort !== DEFAULT_FILTERS.sort
  );
}

const PARAMS = { category: 'cat', query: 'q', minPrice: 'min', maxPrice: 'max', inStock: 'stock', onSale: 'oferta', sort: 'orden' };

/** Filtros -> query string (solo los valores distintos al default). */
export function filtersToQuery(filters) {
  const f = normalizeFilters(filters);
  const params = new URLSearchParams();
  if (f.category !== DEFAULT_FILTERS.category) params.set(PARAMS.category, f.category);
  if (f.query.trim()) params.set(PARAMS.query, f.query.trim());
  if (f.minPrice !== null) params.set(PARAMS.minPrice, String(f.minPrice));
  if (f.maxPrice !== null) params.set(PARAMS.maxPrice, String(f.maxPrice));
  if (f.inStock) params.set(PARAMS.inStock, '1');
  if (f.onSale) params.set(PARAMS.onSale, '1');
  if (f.sort !== DEFAULT_FILTERS.sort) params.set(PARAMS.sort, f.sort);
  return params.toString();
}

/** Query string -> filtros validados (valores inválidos vuelven al default). */
export function filtersFromQuery(search = '') {
  const params = new URLSearchParams(search);
  return normalizeFilters({
    category: params.get(PARAMS.category) ?? undefined,
    query: params.get(PARAMS.query) ?? '',
    minPrice: params.get(PARAMS.minPrice),
    maxPrice: params.get(PARAMS.maxPrice),
    inStock: params.get(PARAMS.inStock) === '1',
    onSale: params.get(PARAMS.onSale) === '1',
    sort: params.get(PARAMS.sort) ?? undefined
  });
}
