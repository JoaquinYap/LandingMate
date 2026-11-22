import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { fakeUrl, flush, loadPage } from '../helpers/dom.js';
import { mountCheckout } from '../../src/ui/checkout-view.js';
import { createCart } from '../../src/store/cart.js';
import { createCheckoutFlow } from '../../src/checkout/flow.js';
import { PaymentError, processPayment } from '../../src/checkout/payment.js';
import { createMemoryStorage } from '../../src/lib/storage.js';
import { findProduct } from '../../src/data/products.js';
import { bootCheckout, LAST_ORDER_KEY } from '../../src/pages/checkout.js';

const NOW = () => new Date(2026, 10, 22, 10, 0);

function setup({ items = [['mate-imperial-negro']], search = '', payment, savedOrder = null } = {}) {
  loadPage('checkout.html');
  const storage = createMemoryStorage();
  const cart = createCart({ storage });
  items.forEach(([id, opts]) => cart.add(findProduct(id), opts));
  const flow = createCheckoutFlow({ storage: createMemoryStorage(), now: NOW });
  const url = fakeUrl(search, '/checkout.html');
  const deps = {
    cart,
    flow,
    processPayment: payment ?? vi.fn((p) => processPayment(p, { delay: 0, random: () => 0.5 })),
    saveOrder: vi.fn(),
    loadOrder: vi.fn(() => savedOrder),
    announce: vi.fn(),
    now: NOW,
    random: () => 0,
    ...url
  };
  const view = mountCheckout(deps);
  return { user: userEvent.setup(), view, ...deps };
}

const step = (name) => screen.getByRole('form', { name });
const total = () => screen.getByTestId('order-total').textContent.replace(/\u00a0/g, ' ');
const summaryRow = (label) => within(document.getElementById('summaryTotals')).getByText(label).closest('.summary-row').textContent.replace(/\u00a0/g, ' ');

async function fillContact(user) {
  const form = step('Datos de contacto');
  await user.type(within(form).getByLabelText('Email'), 'ana@correo.com');
  await user.type(within(form).getByLabelText('Nombre y apellido'), 'Ana Pérez');
  await user.type(within(form).getByLabelText('Teléfono'), '11 2345 6789');
  await user.type(within(form).getByLabelText('DNI'), '30123456');
  await user.click(within(form).getByRole('button', { name: 'Continuar al envío' }));
}

async function fillShipping(user, method = 'andreani') {
  const form = step('Envío');
  await user.click(within(form).getByRole('radio', { name: new RegExp(method === 'retiro' ? 'showroom' : method, 'i') }));
  if (method !== 'retiro') {
    await user.type(within(form).getByLabelText('Calle'), 'Honduras');
    await user.type(within(form).getByLabelText('Altura'), '4800');
    await user.type(within(form).getByLabelText('Localidad'), 'CABA');
    await user.selectOptions(within(form).getByLabelText('Provincia'), 'CABA');
    await user.type(within(form).getByLabelText('Código postal'), 'C1414BMJ');
  }
  await user.click(within(form).getByRole('button', { name: 'Continuar al pago' }));
}

async function fillCard(user, { number = '4242424242424242', installments = '1' } = {}) {
  const form = step('Pago');
  await user.type(within(form).getByLabelText('Número de tarjeta'), number);
  await user.type(within(form).getByLabelText('Nombre del titular'), 'ANA PEREZ');
  await user.type(within(form).getByLabelText('Vencimiento'), '1228');
  await user.type(within(form).getByLabelText('Código de seguridad'), '123');
  await user.selectOptions(within(form).getByLabelText('Cuotas'), installments);
  await user.click(within(form).getByRole('button', { name: 'Revisar pedido' }));
}

async function confirm(user) {
  const form = step('Revisá y confirmá');
  await user.click(within(form).getByLabelText(/Acepto los términos/));
  await user.click(within(form).getByRole('button', { name: /Confirmar y pagar/ }));
  await flush();
}

describe('Checkout', () => {
  it('con el carrito vacío invita a volver a la tienda', () => {
    setup({ items: [] });
    expect(screen.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver productos' }).getAttribute('href')).toBe('index.html#catalogo');
    expect(document.getElementById('checkoutApp').hidden).toBe(true);
  });

  it('arranca en "Contacto" con el resumen del pedido', () => {
    setup({ items: [['mate-imperial-negro', { engraving: 'J.G.' }], ['termo-driven-negro']] });
    expect(step('Datos de contacto').hidden).toBe(false);
    const nav = screen.getByRole('navigation', { name: 'Pasos de la compra' });
    expect(within(nav).getByText('Contacto').closest('[aria-current="step"]')).toBeTruthy();
    expect(within(nav).queryAllByRole('button')).toHaveLength(0); // aún no hay pasos completados
    const summary = within(screen.getByRole('list', { name: 'Productos' }));
    expect(summary.getAllByRole('listitem')).toHaveLength(2);
    expect(summary.getByText(/Grabado: "J.G."/)).toBeTruthy();
    expect(summaryRow('Envío')).toMatch(/Se calcula en el paso 2/);
    expect(total()).toBe('$ 107.400');
  });

  it('valida en línea: marca los campos inválidos, los asocia al error y enfoca el primero', async () => {
    const { user, announce } = setup();
    const form = step('Datos de contacto');
    await user.type(within(form).getByLabelText('Email'), 'ana@');
    await user.click(within(form).getByRole('button', { name: 'Continuar al envío' }));

    const email = within(form).getByLabelText('Email');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email).toHaveProperty('validationMessage'); // input nativo
    expect(document.activeElement).toBe(email);
    expect(within(form).getByText(/no parece válido/).id).toBe('email-error');
    expect(email.getAttribute('aria-describedby')).toContain('email-error');
    expect(within(form).getByLabelText('DNI').getAttribute('aria-invalid')).toBe('true');
    expect(announce).toHaveBeenCalledWith('Revisá 4 campos con errores.');

    // Al corregir, el error del campo desaparece
    await user.type(email, 'correo.com');
    expect(email.hasAttribute('aria-invalid')).toBe(false);
    expect(document.getElementById('email-error').hidden).toBe(true);
  });

  it('flujo completo con tarjeta en 3 cuotas: pedido confirmado y carrito vacío', async () => {
    const { user, cart, saveOrder, processPayment: pay, history } = setup({ items: [['termo-driven-negro']] });
    await fillContact(user);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Envío' }));

    // 62.500 supera el umbral: envío gratis
    expect(within(step('Envío')).getByRole('radio', { name: /Andreani/ }).closest('label').textContent).toMatch(/Gratis/);
    await fillShipping(user);
    expect(summaryRow('Envío')).toMatch(/Gratis/);

    await fillCard(user, { installments: '3' });
    expect(summaryRow('Total')).toMatch(/62\.500/);
    expect(document.getElementById('summaryTotals').textContent).toMatch(/3 cuotas sin interés de \$\s20\.833/);

    const review = step('Revisá y confirmá');
    expect(within(review).getByText(/Visa terminada en 4242 · 3 cuotas/)).toBeTruthy();
    expect(within(review).getByText(/Honduras 4800/)).toBeTruthy();

    await confirm(user);

    expect(pay).toHaveBeenCalledWith(expect.objectContaining({ method: 'tarjeta', amount: 62500, installments: 3 }));
    const heading = screen.getByRole('heading', { name: '¡Gracias por tu compra, Ana!' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByTestId('order-id').textContent).toBe('LAV-261122-AAAA');
    expect(cart.isEmpty()).toBe(true);
    expect(history.entries.at(-1)).toBe('/checkout.html?pedido=LAV-261122-AAAA');
    expect(document.title).toBe('Pedido LAV-261122-AAAA · Lavaditos');

    const order = saveOrder.mock.calls[0][0];
    expect(order.payment).toMatchObject({ brand: 'visa', last4: '4242', installments: 3 });
    expect(JSON.stringify(order)).not.toContain('4242424242424242');
  });

  it('transferencia + cupón: descuentos acumulables y datos bancarios en la confirmación', async () => {
    const { user } = setup({ items: [['mate-imperial-negro']] });
    await user.type(screen.getByLabelText('Cupón de descuento'), 'matero10');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByText(/Cupón MATERO10 aplicado/)).toBeTruthy();
    expect(summaryRow('Subtotal')).toMatch(/44\.900/);
    expect(total()).toBe('$ 40.410');

    await fillContact(user);
    await fillShipping(user, 'correo');
    expect(summaryRow('Envío')).toMatch(/4\.500/);

    const pago = step('Pago');
    await user.click(within(pago).getByRole('radio', { name: /Transferencia/ }));
    expect(document.getElementById('cardFields').hidden).toBe(true);
    expect(document.getElementById('transferInfo').hidden).toBe(false);
    // 44.900 - 4.490 (cupón) - 4.041 (10% transferencia) + 4.500 (envío)
    expect(total()).toBe('$ 40.869');
    await user.click(within(pago).getByRole('button', { name: 'Revisar pedido' }));
    expect(within(step('Revisá y confirmá')).getByRole('button', { name: /Confirmar y pagar \$\s40\.869/ })).toBeTruthy();

    await confirm(user);
    expect(screen.getByRole('heading', { name: 'Datos para la transferencia' })).toBeTruthy();
    expect(screen.getByText('LAVADITOS.MATE.ARS')).toBeTruthy();
    expect(within(document.getElementById('checkoutConfirmation')).getByText(/Cupón MATERO10/)).toBeTruthy();
  });

  it('el cupón se puede quitar y los inválidos muestran el motivo', async () => {
    const { user } = setup({ items: [['mate-madera-guarda-pampa']] });
    const input = screen.getByLabelText('Cupón de descuento');
    await user.type(input, 'BIENVENIDA');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByText(/compra mínima/)).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);

    await user.clear(input);
    await user.type(input, 'MATERO10');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(total()).toBe('$ 28.710');
    await user.click(screen.getByRole('button', { name: 'Quitar cupón' }));
    expect(total()).toBe('$ 31.900');
    expect(screen.getByText('Quitamos el cupón.')).toBeTruthy();
  });

  it('retiro en showroom no pide dirección', async () => {
    const { user } = setup();
    await fillContact(user);
    await user.click(within(step('Envío')).getByRole('radio', { name: /showroom/ }));
    expect(document.getElementById('addressFields').hidden).toBe(true);
    await user.click(within(step('Envío')).getByRole('button', { name: 'Continuar al pago' }));
    expect(step('Pago').hidden).toBe(false);
  });

  it('valida la dirección y los datos de la tarjeta', async () => {
    const { user } = setup();
    await fillContact(user);
    await user.click(within(step('Envío')).getByRole('button', { name: 'Continuar al pago' }));
    expect(within(step('Envío')).getByLabelText('Calle').getAttribute('aria-invalid')).toBe('true');
    expect(within(step('Envío')).getByLabelText('Provincia').getAttribute('aria-invalid')).toBe('true');
    await fillShipping(user);

    await fillCard(user, { number: '4242424242424241' });
    expect(within(step('Pago')).getByText('El número de tarjeta no es válido.')).toBeTruthy();
  });

  it('formatea la tarjeta, detecta la marca y el vencimiento mientras se escribe', async () => {
    const { user } = setup();
    await fillContact(user);
    await fillShipping(user);
    const number = screen.getByLabelText('Número de tarjeta');
    await user.type(number, '5555555555554444');
    expect(number.value).toBe('5555 5555 5555 4444');
    expect(document.getElementById('cardBrand').textContent).toBe('Mastercard');
    const expiry = screen.getByLabelText('Vencimiento');
    await user.type(expiry, '0929');
    expect(expiry.value).toBe('09/29');
    await user.type(expiry, '{Backspace}{Backspace}{Backspace}');
    expect(expiry.value).toBe('09');
  });

  it('las cuotas muestran el monto de cada opción', async () => {
    const { user } = setup({ items: [['termo-driven-negro']] });
    await fillContact(user);
    await fillShipping(user);
    const options = within(screen.getByLabelText('Cuotas')).getAllByRole('option').map((o) => o.textContent.replace(/\u00a0/g, ' '));
    expect(options).toEqual(['1 pago de $ 62.500', '3 cuotas sin interés de $ 20.833', '6 cuotas sin interés de $ 10.417']);
  });

  it('un pago rechazado muestra el motivo y permite cambiar el medio de pago', async () => {
    const { user, cart } = setup();
    await fillContact(user);
    await fillShipping(user);
    await fillCard(user, { number: '4000000000000002' });
    await confirm(user);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/rechazada por el banco/);
    expect(cart.isEmpty()).toBe(false);
    const button = within(step('Revisá y confirmá')).getByRole('button', { name: /Confirmar y pagar/ });
    expect(button.disabled).toBe(false);

    await user.click(within(alert).getByRole('button', { name: 'Cambiar medio de pago' }));
    expect(step('Pago').hidden).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Pago' }));
  });

  it('un error inesperado del procesador muestra un mensaje genérico', async () => {
    const { user } = setup({ payment: vi.fn().mockRejectedValue(new Error('timeout')) });
    await fillContact(user);
    await fillShipping(user, 'retiro');
    await user.click(within(step('Pago')).getByRole('radio', { name: /Mercado Pago/ }));
    expect(document.getElementById('mercadopagoInfo').hidden).toBe(false);
    await user.click(within(step('Pago')).getByRole('button', { name: 'Revisar pedido' }));
    await confirm(user);
    expect(screen.getByRole('alert').textContent).toMatch(/No pudimos procesar el pago/);
  });

  it('mientras se procesa el pago el botón queda deshabilitado (sin doble cobro)', async () => {
    let resolvePayment;
    const payment = vi.fn(() => new Promise((resolve) => { resolvePayment = resolve; }));
    const { user } = setup({ payment });
    await fillContact(user);
    await fillShipping(user, 'retiro');
    await user.click(within(step('Pago')).getByRole('radio', { name: /Mercado Pago/ }));
    await user.click(within(step('Pago')).getByRole('button', { name: 'Revisar pedido' }));
    await confirm(user);

    const button = within(step('Revisá y confirmá')).getByRole('button', { name: /Procesando pago/ });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    step('Revisá y confirmá').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(payment).toHaveBeenCalledOnce();

    resolvePayment({ status: 'approved', authorizationCode: '1' });
    await flush();
    expect(screen.getByRole('heading', { name: /Gracias por tu compra/ })).toBeTruthy();
  });

  it('sin aceptar los términos no se confirma', async () => {
    const { user, processPayment: pay } = setup();
    await fillContact(user);
    await fillShipping(user, 'retiro');
    await fillCard(user);
    await user.click(within(step('Revisá y confirmá')).getByRole('button', { name: /Confirmar y pagar/ }));
    expect(screen.getByText(/aceptes los términos/)).toBeTruthy();
    expect(pay).not.toHaveBeenCalled();
  });

  it('el stepper y los botones "Editar" / "Volver" permiten navegar', async () => {
    const { user } = setup();
    await fillContact(user);
    await fillShipping(user, 'retiro');
    await fillCard(user);

    const review = step('Revisá y confirmá');
    await user.click(within(review).getByRole('button', { name: 'Editar contacto' }));
    expect(step('Datos de contacto').hidden).toBe(false);
    expect(within(step('Datos de contacto')).getByLabelText('Email').value).toBe('ana@correo.com');

    const nav = screen.getByRole('navigation', { name: 'Pasos de la compra' });
    await user.click(within(nav).getByRole('button', { name: /Pago/ }));
    expect(step('Pago').hidden).toBe(false);
    await user.click(within(step('Pago')).getByRole('button', { name: '← Volver' }));
    expect(step('Envío').hidden).toBe(false);
  });

  it('si un paso previo quedó inválido, al confirmar se vuelve a ese paso', async () => {
    const { user, flow } = setup();
    await fillContact(user);
    await fillShipping(user, 'retiro');
    await fillCard(user);
    flow.update('contacto', { email: 'roto' });
    await confirm(user);
    expect(step('Datos de contacto').hidden).toBe(false);
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
  });

  it('muestra la confirmación al recargar con ?pedido= (y no la de otro pedido)', () => {
    const order = {
      id: 'LAV-261122-ZZZZ',
      status: 'approved',
      items: [{ name: 'Mate', price: 1000, quantity: 1, engraving: '' }],
      contact: { fullName: 'Ana Pérez', email: 'ana@correo.com' },
      shipping: { label: 'Retiro', eta: 'Listo en 24 hs', address: null },
      payment: { method: 'mercadopago', label: 'Mercado Pago' },
      totals: { subtotal: 1000, couponDiscount: 0, paymentDiscount: 0, shipping: 0, total: 1000 }
    };
    setup({ items: [], search: '?pedido=LAV-261122-ZZZZ', savedOrder: order });
    expect(screen.getByRole('heading', { name: '¡Gracias por tu compra, Ana!' })).toBeTruthy();
    expect(within(document.getElementById('checkoutConfirmation')).getByText('Mercado Pago')).toBeTruthy();

    setup({ items: [], search: '?pedido=OTRO', savedOrder: order });
    expect(screen.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeTruthy();
  });

  it('si el carrito se vacía en otra pestaña, muestra el estado vacío', () => {
    const { cart } = setup();
    cart.clear();
    expect(document.getElementById('checkoutEmpty').hidden).toBe(false);
  });

  it('descarta un cupón guardado que ya no aplica al carrito actual', () => {
    loadPage('checkout.html');
    const cart = createCart({ storage: createMemoryStorage() });
    cart.add(findProduct('mate-madera-guarda-pampa'));
    const flow = createCheckoutFlow();
    flow.setCoupon('BIENVENIDA');
    mountCheckout({ cart, flow, processPayment: vi.fn(), ...fakeUrl('', '/checkout.html') });
    expect(flow.couponCode).toBe('');
  });

  it('PaymentError conserva el código de error', () => {
    expect(new PaymentError('x', 'card_declined')).toMatchObject({ name: 'PaymentError', code: 'card_declined' });
  });
});

describe('bootCheckout', () => {
  it('conecta storage real, pago simulado y guarda el último pedido', async () => {
    loadPage('checkout.html');
    localStorage.setItem('lavaditos_cart', JSON.stringify([{ id: 'mate-imperial-negro', quantity: 1 }]));
    const user = userEvent.setup();
    const { cart } = bootCheckout({ paymentDelay: 0 });
    expect(cart.count()).toBe(1);
    expect(window.__lavReady).toBe(true);
    await fillContact(user);
    await fillShipping(user, 'retiro');
    await user.click(within(step('Pago')).getByRole('radio', { name: /Mercado Pago/ }));
    await user.click(within(step('Pago')).getByRole('button', { name: 'Revisar pedido' }));
    await confirm(user);
    await flush();
    expect(JSON.parse(localStorage.getItem(LAST_ORDER_KEY)).status).toBe('approved');
    expect(JSON.parse(localStorage.getItem('lavaditos_cart'))).toEqual([]);
  });
});
