import { test, expect } from '@playwright/test';
import { fillContact, seedCart } from './helpers.js';

const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe('Diseño responsivo', () => {
  test('home y checkout no generan scroll horizontal', async ({ page }) => {
    await page.goto('/');
    expect(await noHorizontalScroll(page)).toBe(true);
    await seedCart(page, [{ id: 'mate-imperial-negro', quantity: 1 }]);
    await page.goto('/checkout.html');
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test('mobile: menú hamburguesa accesible', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'El menú hamburguesa solo existe en pantallas chicas');
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Abrir menú' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('dialog', { name: 'Menú de navegación' });
    await menu.getByRole('link', { name: 'Armá tu Set' }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/#customizer/);
  });

  test('mobile: el resumen del checkout arranca colapsado y muestra el total', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Comportamiento específico de mobile');
    await seedCart(page, [{ id: 'mate-imperial-negro', quantity: 1 }]);
    await page.goto('/checkout.html');
    const summary = page.locator('#summaryDetails');
    await expect(summary).not.toHaveAttribute('open', '');
    await expect(page.locator('#summaryToggleTotal')).toHaveText(/44\.900/);
    await summary.locator('summary').click();
    await expect(page.getByRole('list', { name: 'Productos' })).toBeVisible();
  });

  test('desktop: el catálogo muestra varias columnas', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Escenario de escritorio');
    await page.goto('/');
    const columns = await page.locator('#productCatalogGrid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBeGreaterThanOrEqual(3);
  });

  test('el foco no queda tapado por el header sticky del checkout (WCAG 2.4.11)', async ({ page }) => {
    await seedCart(page, [{ id: 'mate-imperial-negro', quantity: 1 }, { id: 'termo-driven-negro', quantity: 1 }]);
    await page.goto('/checkout.html');
    const headerBottom = () => page.locator('.checkout-header').evaluate((el) => el.getBoundingClientRect().bottom);
    const topOf = (locator) => locator.evaluate((el) => el.getBoundingClientRect().top);

    await fillContact(page);
    // El scroll es suave (scroll-behavior: smooth): se espera a que se asiente
    const bottom = await headerBottom();
    await expect.poll(() => topOf(page.getByRole('heading', { name: 'Envío' }))).toBeGreaterThanOrEqual(bottom);

    await page.getByRole('button', { name: 'Continuar al pago' }).click(); // errores: foco en "Calle"
    await expect(page.getByLabel('Calle')).toBeFocused();
    await expect.poll(() => topOf(page.getByLabel('Calle'))).toBeGreaterThanOrEqual(bottom);
  });
});
