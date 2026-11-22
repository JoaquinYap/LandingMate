import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { loadPage, fakeUrl } from '../helpers/dom.js';
import { mountCatalog } from '../../src/ui/catalog-view.js';
import { PRODUCTS } from '../../src/data/products.js';
import { SORT_OPTIONS } from '../../src/store/catalog.js';

const grid = () => within(document.getElementById('productCatalogGrid'));
const cards = () => grid().queryAllByRole('article');
const cardTitles = () => cards().map((card) => within(card).getByRole('heading').textContent.trim());
const results = () => document.getElementById('catalogResultsCount').textContent;

function setup(search = '') {
  loadPage('index.html');
  const url = fakeUrl(search);
  const onView = vi.fn();
  const onAdd = vi.fn();
  const view = mountCatalog({ products: PRODUCTS, onView, onAdd, searchDelay: 0, ...url });
  return { user: userEvent.setup(), onView, onAdd, view, ...url };
}

describe('Catálogo', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('muestra todos los productos con precio, stock y valoración accesibles', () => {
    setup();
    expect(cards()).toHaveLength(PRODUCTS.length);
    expect(results()).toBe(`Mostrando ${PRODUCTS.length} productos`);
    const card = grid().getByRole('article', { name: 'Mate Imperial Premium Negro Azabache' });
    expect(within(card).getByText('Precio:', { exact: false }).parentElement.textContent).toMatch(/44\.900/);
    expect(within(card).getByRole('img', { name: /Valoración 4,9 de 5, 312 opiniones/ })).toBeTruthy();
    expect(within(card).getByText('En stock')).toBeTruthy();
  });

  it('carga las opciones de orden desde una sola fuente', () => {
    setup();
    const options = within(screen.getByLabelText('Ordenar por')).getAllByRole('option');
    expect(options.map((o) => o.value)).toEqual(SORT_OPTIONS.map((o) => o.id));
  });

  it('un producto sin stock se muestra al final con el botón deshabilitado', () => {
    setup();
    const last = cards().at(-1);
    expect(last.getAttribute('data-product-id')).toBe('mate-imperial-dorado-duo');
    expect(within(last).getByRole('button', { name: /Sin stock/ }).disabled).toBe(true);
  });

  it('avisa las últimas unidades', () => {
    setup();
    const card = grid().getByRole('article', { name: /Termo 3 Estrellas/ });
    expect(within(card).getByText('¡Últimas 3 unidades!')).toBeTruthy();
  });

  it('busca sin importar tildes y actualiza contador, contadores por categoría y URL', async () => {
    const { user, history } = setup();
    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'algarróbo');
    expect(cardTitles()).toEqual(['Mate Camionero Algarrobo Cincelado', 'Mate Torpedo Algarrobo Guarda Pampa']);
    expect(results()).toBe('Mostrando 2 productos');
    expect(screen.getByRole('button', { name: /Termos de Precisión/ }).textContent).toMatch(/\(0\)/);
    expect(history.entries.at(-1)).toBe('/index.html?q=algarr%C3%B3bo');
  });

  it('filtra por categoría con botones que informan su estado (aria-pressed)', async () => {
    const { user, location } = setup();
    const termos = screen.getByRole('button', { name: /Termos de Precisión/ });
    await user.click(termos);
    expect(termos.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Todos los Productos/ }).getAttribute('aria-pressed')).toBe('false');
    expect(cards()).toHaveLength(3);
    expect(location.search).toBe('?cat=termos');
    await user.click(termos); // volver a tocar la misma categoría no hace nada
    expect(cards()).toHaveLength(3);
  });

  it('ordena por precio', async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'precio-asc');
    const prices = cards()
      .filter((c) => !c.classList.contains('is-out-of-stock'))
      .map((c) => PRODUCTS.find((p) => p.id === c.dataset.productId).price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('filtra por rango de precio, stock y ofertas', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Precio mínimo'), '60000');
    expect(cards().every((c) => PRODUCTS.find((p) => p.id === c.dataset.productId).price >= 60000)).toBe(true);
    await user.clear(screen.getByLabelText('Precio mínimo'));
    await user.type(screen.getByLabelText('Precio máximo'), '52000');
    expect(cardTitles()).toContain('Mate Imperial Criollo con Virola Dorada');
    await user.click(screen.getByLabelText('Solo con stock'));
    expect(cardTitles()).not.toContain('Mate Imperial Criollo con Virola Dorada');
    await user.click(screen.getByLabelText('En oferta'));
    expect(cards().length).toBeGreaterThan(0);
  });

  it('muestra un estado vacío y "Limpiar filtros" restablece todo', async () => {
    const { user, location } = setup();
    await user.type(screen.getByRole('searchbox'), 'yerba orgánica');
    expect(cards()).toHaveLength(0);
    expect(document.getElementById('catalogEmptyState').hidden).toBe(false);
    expect(results()).toMatch(/No encontramos/);

    const [toolbarClear, emptyClear] = screen.getAllByRole('button', { name: 'Limpiar filtros' });
    expect(toolbarClear.hidden).toBe(false);
    await user.click(emptyClear);
    expect(cards()).toHaveLength(PRODUCTS.length);
    expect(screen.getByRole('searchbox').value).toBe('');
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    expect(location.search).toBe('');
    expect(toolbarClear.hidden).toBe(true);
  });

  it('enviar el formulario de búsqueda (Enter) no recarga la página y aplica la búsqueda', () => {
    setup();
    const search = screen.getByRole('searchbox');
    search.value = 'driven';
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    search.form.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    expect(cards()).toHaveLength(2);
  });

  it('restaura los filtros desde la URL (link compartible)', () => {
    setup('?cat=madera&orden=precio-desc&q=mate');
    expect(screen.getByRole('button', { name: /Mates de Madera/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Ordenar por').value).toBe('precio-desc');
    expect(screen.getByRole('searchbox').value).toBe('mate');
    expect(cardTitles()).toEqual(['Mate Camionero Algarrobo Cincelado', 'Mate Torpedo Algarrobo Guarda Pampa']);
  });

  it('delegación de eventos: "Agregar" y "Ver Detalle" reciben el producto', async () => {
    const { user, onAdd, onView } = setup();
    const card = grid().getByRole('article', { name: 'Termo Driven Inox Black Edition 1 Litro' });
    const addButton = within(card).getByRole('button', { name: /Agregar al Carrito/ });
    expect(addButton.getAttribute('aria-describedby')).toBe('card-title-termo-driven-negro');

    await user.click(addButton);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'termo-driven-negro' }), expect.objectContaining({ button: addButton }));

    await user.click(within(card).getByRole('button', { name: 'Termo Driven Inox Black Edition 1 Litro' }));
    await user.click(card.querySelector('.card-image-box img'));
    const quickView = within(card).getByRole('button', { name: /Ver Detalle/ });
    expect(onView).toHaveBeenNthCalledWith(2, 'termo-driven-negro', quickView);
    expect(onView).toHaveBeenCalledTimes(2);
  });

  it('escapa contenido del catálogo (sin inyección de HTML)', () => {
    loadPage('index.html');
    const evil = { ...PRODUCTS[0], id: 'evil', name: '<img src=x onerror=alert(1)>', badge: '<b>x</b>' };
    mountCatalog({ products: [evil], searchDelay: 0, ...fakeUrl() });
    expect(document.querySelector('.product-card img[src="x"]')).toBeNull();
    expect(screen.getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeTruthy();
  });

  it('no falla si la página no tiene grilla', () => {
    document.body.innerHTML = '<p>sin catálogo</p>';
    expect(mountCatalog({ products: PRODUCTS, ...fakeUrl() })).toBeNull();
  });
});
