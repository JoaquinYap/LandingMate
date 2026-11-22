import { test, expect } from '@playwright/test';
import { acceptAndPay, fillAddress, fillCard, fillContact, money, seedCart } from './helpers.js';

const total = async (page) => money(await page.getByTestId('order-total').textContent());

test.describe('Checkout simulado', () => {
  test('compra completa con tarjeta en 6 cuotas', async ({ page }) => {
    await seedCart(page, [{ id: 'termo-driven-negro', quantity: 1 }, { id: 'mate-imperial-negro', quantity: 1 }]);
    await page.goto('/checkout.html');
    expect(await total(page)).toBe('$ 107.400');

    await fillContact(page);
    await expect(page.getByRole('radio', { name: /Andreani/ }).locator('xpath=ancestor::label')).toContainText('Gratis');
    await fillAddress(page);
    await fillCard(page, { installments: 6 });

    const review = page.getByRole('form', { name: 'Revisá y confirmá' });
    await expect(review).toContainText('Visa terminada en 4242 · 6 cuotas');
    await expect(review).toContainText('Honduras 4800');
    await acceptAndPay(page);

    await expect(page.getByRole('button', { name: /Procesando pago/ })).toBeDisabled();
    const heading = page.getByRole('heading', { name: '¡Gracias por tu compra, Ana!' });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByTestId('order-id')).toHaveText(/^LAV-\d{6}-[A-Z2-9]{4}$/);
    await expect(page).toHaveURL(/\?pedido=LAV-/);

    // Recargar la confirmación no pierde el pedido; el carrito quedó vacío
    await page.reload();
    await expect(page.getByRole('heading', { name: '¡Gracias por tu compra, Ana!' })).toBeVisible();
    await page.getByRole('link', { name: 'Volver a la tienda', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Abrir carrito, vacío' })).toBeAttached();
  });

  test('transferencia + cupón MATERO10 + retiro en showroom', async ({ page }) => {
    await seedCart(page, [{ id: 'mate-imperial-negro', quantity: 1 }]);
    await page.goto('/checkout.html');
    // En mobile el resumen arranca colapsado
    const summary = page.locator('#summaryDetails');
    if (!(await summary.evaluate((d) => d.open))) await summary.locator('summary').click();

    await page.getByLabel('Cupón de descuento').fill('matero10');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByText(/Cupón MATERO10 aplicado/)).toBeVisible();

    await fillContact(page);
    await page.getByRole('radio', { name: /showroom/ }).check();
    await expect(page.getByLabel('Calle')).toBeHidden();
    await page.getByRole('button', { name: 'Continuar al pago' }).click();

    await page.getByRole('radio', { name: /Transferencia/ }).check();
    await expect(page.getByText(/10% OFF pagando por transferencia/)).toBeVisible();
    // 44.900 − 4.490 (cupón) − 4.041 (10% transferencia) + 0 (retiro)
    expect(await total(page)).toBe('$ 36.369');
    await page.getByRole('button', { name: 'Revisar pedido' }).click();
    await acceptAndPay(page);

    await expect(page.getByRole('heading', { name: 'Datos para la transferencia' })).toBeVisible();
    await expect(page.getByText('LAVADITOS.MATE.ARS')).toBeVisible();
  });

  test('tarjeta rechazada: se informa el error y se puede reintentar con otra', async ({ page }) => {
    await seedCart(page, [{ id: 'termo-hudson-aventura', quantity: 1 }]);
    await page.goto('/checkout.html');
    await fillContact(page);
    await fillAddress(page);
    await fillCard(page, { number: '4000 0000 0000 0002' });
    await acceptAndPay(page);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('rechazada por el banco');
    await alert.getByRole('button', { name: 'Cambiar medio de pago' }).click();
    await expect(page.getByRole('heading', { name: 'Pago' })).toBeFocused();

    await page.getByLabel('Número de tarjeta').fill('5555 5555 5555 4444');
    await expect(page.locator('#cardBrand')).toHaveText('Mastercard');
    await page.getByRole('button', { name: 'Revisar pedido' }).click();
    await page.getByRole('button', { name: /Confirmar y pagar/ }).click();
    await expect(page.getByRole('heading', { name: /Gracias por tu compra/ })).toBeVisible();
  });

  test('los errores de validación se muestran junto a cada campo', async ({ page }) => {
    await seedCart(page, [{ id: 'mate-imperial-negro', quantity: 1 }]);
    await page.goto('/checkout.html');
    await page.getByRole('button', { name: 'Continuar al envío' }).click();
    const email = page.getByLabel('Email');
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAccessibleDescription('Ingresá tu email.');
    await expect(page.getByLabel('DNI')).toHaveAccessibleDescription(/Sin puntos.*Ingresá tu DNI/);
  });

  test('el progreso se conserva al recargar', async ({ page }) => {
    await seedCart(page, [{ id: 'mate-imperial-negro', quantity: 1 }]);
    await page.goto('/checkout.html');
    await fillContact(page);
    await page.reload();
    await expect(page.getByRole('form', { name: 'Envío' })).toBeVisible();
    await page.getByRole('button', { name: /Contacto/ }).click();
    await expect(page.getByLabel('Email')).toHaveValue('ana@correo.com');
  });

  test('sin productos, el checkout invita a volver a la tienda', async ({ page }) => {
    await page.goto('/checkout.html');
    await expect(page.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeVisible();
    await page.getByRole('link', { name: 'Ver productos' }).click();
    await expect(page).toHaveURL(/index\.html#catalogo/);
  });
});
