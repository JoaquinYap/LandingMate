import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { card, cartDialog, fillAddress, fillCard, fillContact, seedCart, acceptAndPay } from './helpers.js';

// Animaciones instantáneas: axe analiza el estado final, no un fotograma intermedio
test.use({ reducedMotion: 'reduce' });

async function expectNoViolations(page, include) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  const summary = violations.map((v) => `${v.impact} · ${v.id}: ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`);
  expect(summary, summary.join('\n')).toEqual([]);
}

async function revealAll(page) {
  await page.evaluate(() => document.querySelectorAll('.reveal, .reveal-seq, .reveal-mask').forEach((el) => el.classList.add('active')));
}

test.describe('Accesibilidad (axe-core, WCAG 2.2 AA)', () => {
  test('home', async ({ page }) => {
    await page.goto('/');
    await revealAll(page);
    await expectNoViolations(page);
  });

  test('carrito abierto con productos', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Mate Imperial Premium Negro Azabache').getByRole('button', { name: /Agregar al Carrito/ }).click();
    await expect(cartDialog(page)).toBeVisible();
    await expectNoViolations(page, '#cartOverlay');
  });

  test('detalle de producto', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Termo Driven Inox Black Edition 1 Litro').getByRole('button', { name: 'Termo Driven Inox Black Edition 1 Litro' }).click();
    await expect(page.getByRole('dialog', { name: /Termo Driven/ })).toBeVisible();
    await expectNoViolations(page, '#productModal');
  });

  test('cada paso del checkout y la confirmación', async ({ page }) => {
    await seedCart(page, [{ id: 'mate-imperial-negro', quantity: 1 }]);
    await page.goto('/checkout.html');
    await expectNoViolations(page);
    await page.getByRole('button', { name: 'Continuar al envío' }).click(); // con errores visibles
    await expectNoViolations(page);
    await fillContact(page);
    await expectNoViolations(page);
    await fillAddress(page);
    await expectNoViolations(page);
    await fillCard(page);
    await expectNoViolations(page);
    await acceptAndPay(page);
    await expect(page.getByRole('heading', { name: /Gracias por tu compra/ })).toBeVisible();
    await expectNoViolations(page);
  });
});

test.describe('Navegación por teclado', () => {
  test('el primer Tab enfoca "Saltar al contenido" y lleva al main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Saltar al contenido principal' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('carrito: se abre con teclado, Escape lo cierra y el foco vuelve', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Teclado físico: escenario de escritorio');
    await page.goto('/');
    const cartButton = page.getByRole('button', { name: /Abrir carrito/ });
    await cartButton.focus();
    await page.keyboard.press('Enter');
    await expect(cartDialog(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar carrito' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(cartDialog(page)).toBeHidden();
    await expect(cartButton).toBeFocused();
  });

  test('con el carrito cerrado, sus controles no reciben foco', async ({ page }) => {
    await page.goto('/');
    const focusables = await page.locator('#cartOverlay').evaluate((el) => el.hasAttribute('inert'));
    expect(focusables).toBe(true);
  });
});
