import { test, expect } from '@playwright/test';
import { fillContact, seedCart } from './helpers.js';

// En mobile, si algo desborda, Chrome agranda el layout viewport (innerWidth crece junto con el
// contenido), así que se compara contra el ancho real del dispositivo y no contra innerWidth.
const layoutWidth = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth));

test.describe('Diseño responsivo', () => {
  test('home, carrito y checkout entran en el ancho del dispositivo', async ({ page }) => {
    const { width } = page.viewportSize();
    await page.goto('/');
    expect(await layoutWidth(page)).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: /Abrir carrito/ }).click();
    expect(await layoutWidth(page)).toBeLessThanOrEqual(width);
    await seedCart(page, [{ id: 'mate-imperial-negro', quantity: 1 }]);
    await page.goto('/checkout.html');
    expect(await layoutWidth(page)).toBeLessThanOrEqual(width);
  });

  test('teléfono chico (360 px): nada desborda', async ({ browser, isMobile }) => {
    test.skip(!isMobile, 'Escenario mobile');
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    for (const url of ['/', '/checkout.html']) {
      await page.goto(url);
      expect(await layoutWidth(page), url).toBeLessThanOrEqual(360);
    }
    await context.close();
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
