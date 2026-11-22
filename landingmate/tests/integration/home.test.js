import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flush, loadPage } from '../helpers/dom.js';
import { bootHome } from '../../src/pages/home.js';
import { createMemoryStorage } from '../../src/lib/storage.js';
import { CART_STORAGE_KEY } from '../../src/store/cart.js';
import { initCuringGuide, initFaq } from '../../src/ui/effects.js';

function setup({ storage = createMemoryStorage() } = {}) {
  loadPage('index.html');
  window.history.replaceState(null, '', '/');
  const app = bootHome({ storage, effects: false });
  return { user: userEvent.setup(), storage, ...app };
}

const cartDialog = () => screen.getByRole('dialog', { name: /Tu Carrito Matero/ });
const card = (name) => within(document.getElementById('productCatalogGrid')).getByRole('article', { name });
const cartLines = () => within(document.getElementById('cartItemsContainer')).queryAllByRole('listitem');

describe('Home: agregar al carrito', () => {
  it('agregar desde una card abre el carrito como diálogo accesible y anuncia el cambio', async () => {
    const { user } = setup();
    expect(screen.getByRole('button', { name: 'Abrir carrito, vacío' })).toBeTruthy();

    await user.click(within(card('Mate Imperial Premium Negro Azabache')).getByRole('button', { name: /Agregar al Carrito/ }));

    const dialog = cartDialog();
    expect(dialog.closest('.cart-overlay').classList.contains('open')).toBe(true);
    expect(dialog.closest('.cart-overlay').hasAttribute('inert')).toBe(false);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(cartLines()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Abrir carrito (1 producto)' })).toBeTruthy();
    expect(document.body.classList.contains('no-scroll')).toBe(true);
    await flush();
    await new Promise((r) => setTimeout(r, 40));
    expect(document.getElementById('srAnnouncer').textContent).toMatch(/agregado al carrito/);
  });

  it('Escape cierra el carrito y devuelve el foco al botón que lo abrió', async () => {
    const { user } = setup();
    const add = within(card('Termo Driven Inox Black Edition 1 Litro')).getByRole('button', { name: /Agregar al Carrito/ });
    await user.click(add);
    await user.keyboard('{Escape}');
    expect(document.getElementById('cartOverlay').classList.contains('open')).toBe(false);
    expect(document.getElementById('cartOverlay').hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(add);
    expect(document.body.classList.contains('no-scroll')).toBe(false);
  });

  it('el foco queda atrapado dentro del carrito al tabular', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Abrir carrito/ }));
    const dialog = cartDialog();
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('clic en el fondo cierra el carrito', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Abrir carrito/ }));
    await user.click(document.getElementById('cartOverlay'));
    expect(document.getElementById('cartOverlay').classList.contains('open')).toBe(false);
  });

  it('muestra un aviso si se supera el stock', async () => {
    const { user } = setup();
    const add = within(card('Termo 3 Estrellas Campeones del Mundo 10 AFA')).getByRole('button', { name: /Agregar al Carrito/ });
    for (let i = 0; i < 4; i += 1) {
      await user.click(add);
      await user.keyboard('{Escape}');
    }
    expect(document.getElementById('uiToast').textContent).toMatch(/No hay más unidades/);
    expect(document.querySelector('#cartItemsContainer [data-testid="qty"]').textContent).toBe('3');
  });

  it('el carrito persiste: al volver a cargar la página sigue ahí', async () => {
    const storage = createMemoryStorage();
    const first = setup({ storage });
    await first.user.click(within(card('Mate Camionero Algarrobo Cincelado')).getByRole('button', { name: /Agregar al Carrito/ }));
    setup({ storage });
    expect(screen.getByRole('button', { name: 'Abrir carrito (1 producto)' })).toBeTruthy();
  });

  it('se sincroniza cuando otra pestaña modifica el carrito', () => {
    const storage = createMemoryStorage();
    setup({ storage });
    storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ id: 'mate-imperial-negro', quantity: 2 }]));
    window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY }));
    expect(screen.getByRole('button', { name: 'Abrir carrito (2 productos)' })).toBeTruthy();
  });
});

describe('Home: modal de producto', () => {
  it('abre el detalle como diálogo, permite grabado y agrega al carrito', async () => {
    const { user } = setup();
    const trigger = within(card('Mate Imperial Cuero Crudo Textura Carpincho')).getByRole('button', { name: /Ver Detalle/ });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Mate Imperial Cuero Crudo Textura Carpincho' });
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toMatch(/Cuero Crudo/);
    expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThan(2);
    const engraving = within(dialog).getByLabelText(/Grabado Láser/);
    expect(document.activeElement).toBe(engraving);

    await user.type(engraving, 'Para papá');
    await user.click(within(dialog).getByRole('button', { name: 'Agregar al Carrito' }));

    expect(document.getElementById('productModal').classList.contains('open')).toBe(false);
    expect(within(cartDialog()).getByText('Grabado: "Para papá"')).toBeTruthy();
  });

  it('un producto sin stock no se puede agregar desde el detalle', async () => {
    const { user, modal } = setup();
    modal.open('mate-imperial-dorado-duo', document.body);
    const dialog = screen.getByRole('dialog', { name: /Virola Dorada/ });
    expect(within(dialog).getByRole('button', { name: 'Sin stock' }).disabled).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: /Cerrar detalle/ }));
    expect(document.getElementById('productModal').classList.contains('open')).toBe(false);
  });

  it('ignora ids inexistentes', () => {
    const { modal } = setup();
    expect(modal.open('no-existe')).toBe(false);
  });
});

describe('Home: armá tu set', () => {
  it('las opciones son botones con estado y el total se recalcula', async () => {
    const { user } = setup();
    const group = screen.getByRole('group', { name: 'Elegí tu Bombilla' });
    const dorada = within(group).getByRole('button', { name: /Edición Baño Dorado/ });
    await user.click(dorada);
    expect(dorada.getAttribute('aria-pressed')).toBe('true');
    expect(within(group).getByRole('button', { name: /Pico de Loro/ }).getAttribute('aria-pressed')).toBe('false');
    // 44.900 + 62.500 + 12.500 = 119.900 → -15% = 101.915
    expect(document.getElementById('custSummaryTotal').textContent).toMatch(/101\.915/);
  });

  it('agregar el mismo set dos veces suma cantidad en una sola línea', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Texto del grabado para tu set'), 'M.B.');
    expect(document.getElementById('custSummaryEngraving').textContent).toBe('"M.B." (¡Sin cargo!)');
    const add = screen.getByRole('button', { name: /Agregar Set al Carrito/ });
    await user.click(add);
    await user.keyboard('{Escape}');
    await user.click(add);
    expect(cartLines()).toHaveLength(1);
    expect(within(cartLines()[0]).getByTestId('qty').textContent).toBe('2');
    expect(within(cartLines()[0]).getByText(/Mate: Mate Imperial/)).toBeTruthy();
  });
});

describe('Home: menú móvil, newsletter, guía y FAQ', () => {
  it('el menú móvil es un diálogo con aria-expanded', async () => {
    const { user } = setup();
    const toggle = screen.getByRole('button', { name: 'Abrir menú' });
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const nav = screen.getByRole('dialog', { name: 'Menú de navegación' });
    await user.click(within(nav).getByRole('link', { name: 'Colección' }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    await user.click(within(nav).getByRole('button', { name: 'Cerrar menú' }));
    expect(document.activeElement).toBe(toggle);
  });

  it('la newsletter confirma y sugiere el cupón', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = setup();
    await user.type(screen.getByLabelText('Tu email'), 'ana@correo.com');
    await user.click(screen.getByRole('button', { name: 'Quiero mi Cupón' }));
    expect(document.getElementById('uiToast').textContent).toMatch(/MATERO10/);
    expect(screen.getByRole('button', { name: '¡Cupón enviado!' }).disabled).toBe(true);
    vi.advanceTimersByTime(3300);
    expect(screen.getByRole('button', { name: 'Quiero mi Cupón' }).disabled).toBe(false);
  });

  it('la guía de curado es un tablist navegable con flechas', async () => {
    const { user } = setup();
    initCuringGuide();
    const [calabaza, madera] = screen.getAllByRole('tab');
    calabaza.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(madera);
    expect(madera.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: /Madera/ }).hidden).toBe(false);
    expect(document.getElementById('panelCalabaza').hidden).toBe(true);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(calabaza);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(madera);
    await user.click(calabaza);
    expect(calabaza.getAttribute('aria-selected')).toBe('true');
  });

  it('las preguntas frecuentes son botones con aria-expanded', async () => {
    const { user } = setup();
    initFaq();
    const question = screen.getByRole('button', { name: /medios de pago/ });
    expect(question.getAttribute('aria-expanded')).toBe('false');
    await user.click(question);
    expect(question.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /grabado láser personalizado gratuito/ }).getAttribute('aria-expanded')).toBe('false');
    await user.click(question);
    expect(question.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Home: efectos y degradación progresiva', () => {
  it('sin IntersectionObserver el contenido animado queda visible igual', () => {
    vi.useFakeTimers();
    loadPage('index.html');
    expect(window.IntersectionObserver).toBeUndefined();
    bootHome({ storage: createMemoryStorage(), effects: true });
    const pending = document.querySelectorAll('.reveal:not(.active), .reveal-seq:not(.active)');
    expect(pending).toHaveLength(0);
    expect(document.getElementById('hero').classList.contains('is-ready')).toBe(true);
    // Los títulos partidos en palabras conservan su nombre accesible
    expect(screen.getByRole('heading', { level: 1, name: 'El verdadero ritual argentino, hecho para perdurar.' })).toBeTruthy();
    // La prueba social es decorativa: no se anuncia
    vi.advanceTimersByTime(4100);
    expect(document.getElementById('socialProofToast').getAttribute('aria-hidden')).toBe('true');
    expect(document.getElementById('socialProofToast').classList.contains('show')).toBe(true);
  });
});
