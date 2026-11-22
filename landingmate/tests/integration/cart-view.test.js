import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { loadPage } from '../helpers/dom.js';
import { mountCartDrawer } from '../../src/ui/cart-view.js';
import { createCart } from '../../src/store/cart.js';
import { createDialog } from '../../src/ui/a11y.js';
import { createMemoryStorage } from '../../src/lib/storage.js';
import { findProduct } from '../../src/data/products.js';

function setup(seed = []) {
  loadPage('index.html');
  const cart = createCart({ storage: createMemoryStorage() });
  seed.forEach(([id, opts]) => cart.add(findProduct(id), opts));
  const dialog = createDialog(document.getElementById('cartOverlay'), { panel: document.querySelector('.cart-drawer') });
  const announce = vi.fn();
  const toast = vi.fn();
  const openWindow = vi.fn();
  mountCartDrawer({ cart, dialog, announce, toast, openWindow });
  dialog.open(document.getElementById('btnNavCart'));
  return { user: userEvent.setup(), cart, dialog, announce, toast, openWindow };
}

const drawer = () => screen.getByRole('dialog', { name: /Tu Carrito Matero/ });
const lines = () => within(drawer()).queryAllByRole('listitem');
const line = (name) => lines().find((li) => within(li).queryByRole('heading', { name }));
const text = (id) => document.getElementById(id).textContent.replace(/\u00a0/g, ' ');

describe('Drawer del carrito', () => {
  it('muestra el estado vacío y oculta los totales', () => {
    setup();
    expect(within(drawer()).getByText('Tu carrito está vacío.')).toBeTruthy();
    expect(document.getElementById('cartFooter').hidden).toBe(true);
    expect(document.getElementById('navCartCount').hidden).toBe(true);
    expect(screen.getByRole('progressbar', { name: /envío gratis/ }).getAttribute('aria-valuenow')).toBe('0');
  });

  it('lista productos con subtotal y cuánto falta para el envío gratis', () => {
    setup([['mate-imperial-negro', { engraving: 'J.G.' }]]);
    expect(lines()).toHaveLength(1);
    expect(within(line('Mate Imperial Premium Negro Azabache')).getByText('Grabado: "J.G."')).toBeTruthy();
    expect(text('cartSubtotalAmount')).toBe('$ 44.900');
    expect(text('shippingStatusText')).toMatch(/Agregá \$ 5\.100 más/);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('90');
    expect(within(drawer()).getByRole('link', { name: /Iniciar compra segura/ }).getAttribute('href')).toBe('checkout.html');
  });

  it('sumar y restar unidades actualiza totales, anuncia y conserva el foco', async () => {
    const { user, announce } = setup([['mate-imperial-negro']]);
    const plus = within(line(/Negro Azabache/)).getByRole('button', { name: 'Sumar una unidad' });
    await user.click(plus);
    expect(within(line(/Negro Azabache/)).getByTestId('qty').textContent).toBe('2');
    expect(text('cartSubtotalAmount')).toBe('$ 89.800');
    expect(text('shippingStatusText')).toMatch(/ENVÍO GRATIS/);
    expect(announce).toHaveBeenLastCalledWith('Mate Imperial Premium Negro Azabache: 2 unidades.');
    // La fila se re-renderizó pero el foco vuelve al mismo botón
    expect(document.activeElement.getAttribute('aria-label')).toBe('Sumar una unidad');
    expect(line(/Negro Azabache/).contains(document.activeElement)).toBe(true);

    await user.click(within(line(/Negro Azabache/)).getByRole('button', { name: 'Quitar una unidad' }));
    expect(within(line(/Negro Azabache/)).getByTestId('qty').textContent).toBe('1');
    expect(screen.getByRole('button', { name: 'Abrir carrito (1 producto)' })).toBeTruthy();
  });

  it('deshabilita "+" al llegar al stock disponible', async () => {
    const { user } = setup([['termo-campeones-del-mundo-afa', { quantity: 2 }]]);
    const plus = () => within(line(/Termo 3 Estrellas/)).getByRole('button', { name: 'Sumar una unidad' });
    expect(plus().disabled).toBe(false);
    await user.click(plus());
    expect(plus().disabled).toBe(true);
  });

  it('informa con un toast si no se puede sumar', () => {
    const { cart, toast } = setup([['termo-campeones-del-mundo-afa', { quantity: 3 }]]);
    const plus = within(line(/Termo 3 Estrellas/)).getByRole('button', { name: 'Sumar una unidad' });
    plus.disabled = false; // forzamos el clic para cubrir la respuesta del store
    plus.click();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/No hay más unidades/));
    expect(cart.count()).toBe(3);
  });

  it('eliminar una línea mueve el foco a la siguiente', async () => {
    const { user, announce } = setup([['mate-imperial-negro'], ['termo-driven-negro']]);
    await user.click(screen.getByRole('button', { name: 'Eliminar Mate Imperial Premium Negro Azabache del carrito' }));
    expect(lines()).toHaveLength(1);
    expect(announce).toHaveBeenCalledWith('Mate Imperial Premium Negro Azabache se eliminó del carrito.');
    expect(document.activeElement.getAttribute('aria-label')).toBe('Eliminar Termo Driven Inox Black Edition 1 Litro del carrito');
  });

  it('restar la última unidad elimina la línea y el foco va al botón de cerrar', async () => {
    const { user } = setup([['mate-imperial-negro']]);
    await user.click(screen.getByRole('button', { name: 'Quitar una unidad' }));
    expect(lines()).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar carrito' }));
    expect(document.getElementById('cartEmptyState').hidden).toBe(false);
  });

  it('"Ver Productos" desde el carrito vacío cierra el drawer', async () => {
    const { user, dialog } = setup();
    await user.click(within(drawer()).getByRole('link', { name: 'Ver Productos' }));
    expect(dialog.isOpen()).toBe(false);
  });

  it('el botón de cerrar cierra el diálogo', async () => {
    const { user, dialog } = setup();
    await user.click(screen.getByRole('button', { name: 'Cerrar carrito' }));
    expect(dialog.isOpen()).toBe(false);
    await user.click(screen.getByRole('button', { name: /Abrir carrito/ }));
    expect(dialog.isOpen()).toBe(true);
  });

  it('pedido alternativo por WhatsApp con el detalle del carrito', async () => {
    const { user, openWindow } = setup([['termo-hudson-aventura', { quantity: 2 }]]);
    await user.click(screen.getByRole('button', { name: /Prefiero pedir por WhatsApp/ }));
    const url = openWindow.mock.calls[0][0];
    expect(url).toMatch(/^https:\/\/wa\.me\//);
    expect(decodeURIComponent(url)).toContain('*Termo Hudson Expedition Vintage 1L* (x2)');
  });

  it('WhatsApp con carrito vacío avisa en lugar de abrir', () => {
    const { cart, toast, openWindow } = setup([['termo-hudson-aventura']]);
    const button = screen.getByRole('button', { name: /Prefiero pedir por WhatsApp/ });
    cart.clear();
    button.click();
    expect(openWindow).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/vacío/));
  });

  it('escapa nombres y grabados ingresados por el usuario', () => {
    setup([['mate-imperial-negro', { engraving: '<img src=x onerror=alert(1)>' }]]);
    expect(document.querySelector('#cartItemsContainer img[src="x"]')).toBeNull();
    expect(within(drawer()).getByText('Grabado: "<img src=x onerror=alert(1)>"')).toBeTruthy();
  });
});
