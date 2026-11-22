import { describe, expect, it } from 'vitest';
import { PRODUCTS, findProduct } from '../../src/data/products.js';
import {
  DEFAULT_FILTERS, applyCatalog, categoryCounts, discountPercent, filterProducts, filtersFromQuery,
  filtersToQuery, hasActiveFilters, matchesQuery, normalizeFilters, sortProducts
} from '../../src/store/catalog.js';

const ids = (list) => list.map((p) => p.id);

describe('datos del catálogo', () => {
  it('cada producto tiene id único y campos obligatorios', () => {
    expect(new Set(ids(PRODUCTS)).size).toBe(PRODUCTS.length);
    PRODUCTS.forEach((p) => {
      expect(p.price).toBeGreaterThan(0);
      expect(p.stock).toBeGreaterThanOrEqual(0);
      expect(p.image).toMatch(/^assets\/images\//);
      expect(p.specs.length).toBeGreaterThan(0);
    });
  });

  it('el catálogo es inmutable', () => {
    expect(Object.isFrozen(PRODUCTS)).toBe(true);
    expect(Object.isFrozen(PRODUCTS[0])).toBe(true);
  });

  it('findProduct devuelve null si no existe', () => {
    expect(findProduct('no-existe')).toBeNull();
    expect(findProduct('termo-driven-negro').name).toMatch(/Driven/);
  });
});

describe('discountPercent', () => {
  it('calcula el porcentaje redondeado', () => {
    expect(discountPercent({ price: 80, oldPrice: 100 })).toBe(20);
  });
  it('es 0 sin precio anterior o si el anterior no es mayor', () => {
    expect(discountPercent({ price: 80 })).toBe(0);
    expect(discountPercent({ price: 100, oldPrice: 90 })).toBe(0);
  });
});

describe('matchesQuery', () => {
  const mate = findProduct('mate-camionero-algarrobo');
  it('ignora mayúsculas y tildes', () => {
    expect(matchesQuery(mate, 'ALGARRÓBO')).toBe(true);
  });
  it('exige que coincidan todas las palabras', () => {
    expect(matchesQuery(mate, 'camionero algarrobo')).toBe(true);
    expect(matchesQuery(mate, 'camionero termo')).toBe(false);
  });
  it('una búsqueda vacía coincide con todo', () => {
    expect(matchesQuery(mate, '   ')).toBe(true);
  });
});

describe('normalizeFilters', () => {
  it('completa con los valores por defecto', () => {
    expect(normalizeFilters()).toEqual({ ...DEFAULT_FILTERS });
  });
  it('descarta categorías y órdenes desconocidos', () => {
    const f = normalizeFilters({ category: 'hackeada', sort: 'random' });
    expect(f.category).toBe('todos');
    expect(f.sort).toBe('destacados');
  });
  it('convierte precios, ignora negativos y corrige un rango invertido', () => {
    expect(normalizeFilters({ minPrice: '60000', maxPrice: '30000' })).toMatchObject({ minPrice: 30000, maxPrice: 60000 });
    expect(normalizeFilters({ minPrice: '-5', maxPrice: 'abc' })).toMatchObject({ minPrice: null, maxPrice: null });
  });
});

describe('filterProducts', () => {
  it('filtra por categoría', () => {
    const termos = filterProducts(PRODUCTS, { category: 'termos' });
    expect(termos.length).toBe(3);
    expect(termos.every((p) => p.category === 'termos')).toBe(true);
  });

  it('filtra por rango de precio inclusivo', () => {
    const list = filterProducts(PRODUCTS, { minPrice: 44900, maxPrice: 52000 });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.price >= 44900 && p.price <= 52000)).toBe(true);
    expect(ids(list)).toContain('mate-imperial-negro');
  });

  it('"solo con stock" excluye productos agotados', () => {
    const list = filterProducts(PRODUCTS, { inStock: true });
    expect(ids(list)).not.toContain('mate-imperial-dorado-duo');
    expect(list.length).toBe(PRODUCTS.length - 1);
  });

  it('"en oferta" excluye productos sin descuento', () => {
    const catalog = [...PRODUCTS, { ...PRODUCTS[0], id: 'sin-oferta', oldPrice: null }];
    expect(ids(filterProducts(catalog, { onSale: true }))).not.toContain('sin-oferta');
  });

  it('combina búsqueda + categoría', () => {
    expect(ids(filterProducts(PRODUCTS, { category: 'madera', query: 'guarda' }))).toEqual(['mate-madera-guarda-pampa']);
  });
});

describe('sortProducts', () => {
  it('no muta el array original', () => {
    const copy = [...PRODUCTS];
    sortProducts(PRODUCTS, 'precio-asc');
    expect(PRODUCTS).toEqual(copy);
  });

  it('ordena por precio ascendente y descendente', () => {
    const inStock = PRODUCTS.filter((p) => p.stock > 0);
    const asc = sortProducts(inStock, 'precio-asc').map((p) => p.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = sortProducts(inStock, 'precio-desc').map((p) => p.price);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it('manda los productos sin stock al final, en cualquier orden', () => {
    ['destacados', 'precio-asc', 'precio-desc', 'nombre'].forEach((sort) => {
      expect(sortProducts(PRODUCTS, sort).at(-1).id).toBe('mate-imperial-dorado-duo');
    });
  });

  it('ordena por mayor descuento', () => {
    const d = sortProducts(PRODUCTS.filter((p) => p.stock > 0), 'descuento').map(discountPercent);
    expect(d).toEqual([...d].sort((a, b) => b - a));
  });

  it('ordena por valoración (desempata por cantidad de opiniones)', () => {
    const list = sortProducts(PRODUCTS, 'valoracion');
    expect(list[0].id).toBe('termo-campeones-del-mundo-afa');
    expect(list[1].rating).toBe(4.9);
    expect(list[1].reviews).toBeGreaterThanOrEqual(list[2].reviews);
  });

  it('ordena alfabéticamente en español', () => {
    const names = sortProducts(PRODUCTS.filter((p) => p.stock > 0), 'nombre').map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
  });

  it('un orden desconocido usa "destacados"', () => {
    expect(ids(sortProducts(PRODUCTS, 'xyz'))).toEqual(ids(sortProducts(PRODUCTS, 'destacados')));
  });
});

describe('applyCatalog y categoryCounts', () => {
  it('filtra y ordena en un paso', () => {
    const list = applyCatalog(PRODUCTS, { category: 'termos', sort: 'precio-asc' });
    expect(ids(list)).toEqual(['termo-hudson-aventura', 'termo-driven-negro', 'termo-driven-desert-sand']);
  });

  it('cuenta resultados por categoría respetando los demás filtros', () => {
    const counts = categoryCounts(PRODUCTS, { category: 'termos', query: 'algarrobo' });
    expect(counts).toMatchObject({ todos: 2, madera: 2, termos: 0, imperiales: 0 });
  });
});

describe('hasActiveFilters', () => {
  it('es falso solo con los defaults', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ query: '  ' })).toBe(false);
    expect(hasActiveFilters({ onSale: true })).toBe(true);
    expect(hasActiveFilters({ sort: 'nombre' })).toBe(true);
    expect(hasActiveFilters({ maxPrice: 1 })).toBe(true);
  });
});

describe('filtros <-> URL', () => {
  it('serializa solo lo que difiere del default', () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe('');
    expect(filtersToQuery({ category: 'termos', query: ' driven ', sort: 'precio-asc', inStock: true, onSale: true, minPrice: 1000, maxPrice: 70000 }))
      .toBe('cat=termos&q=driven&min=1000&max=70000&stock=1&oferta=1&orden=precio-asc');
  });

  it('ida y vuelta conserva los filtros', () => {
    const filters = normalizeFilters({ category: 'madera', query: 'guarda pampa', minPrice: 30000, sort: 'nombre', onSale: true });
    expect(filtersFromQuery(filtersToQuery(filters))).toEqual(filters);
  });

  it('valores manipulados en la URL vuelven al default', () => {
    expect(filtersFromQuery('?cat=<script>&orden=drop&min=abc&stock=yes')).toEqual({ ...DEFAULT_FILTERS });
  });
});
