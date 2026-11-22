import { test, expect } from '@playwright/test';
import { card, cartDialog, grid } from './helpers.js';

test.describe('Catálogo', () => {
  test('buscar y ordenar se refleja en la URL y sobrevive a una recarga', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('termo');
    await expect(page.locator('#catalogResultsCount')).toHaveText('Mostrando 5 productos');
    await page.getByLabel('Ordenar por').selectOption('precio-asc');
    await expect(page).toHaveURL(/\?q=termo&orden=precio-asc/);
    await expect(grid(page).getByRole('article').first()).toHaveAccessibleName('Termo Hudson Expedition Vintage 1L');

    await page.reload();
    await expect(page.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('termo');
    await expect(grid(page).getByRole('article')).toHaveCount(5);
    await expect(grid(page).getByRole('article').first()).toHaveAccessibleName('Termo Hudson Expedition Vintage 1L');
  });

  test('categorías, estado vacío y limpiar filtros', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Mates de Madera/ }).click();
    await expect(grid(page).getByRole('article')).toHaveCount(2);
    await expect(page.getByRole('button', { name: /Mates de Madera/ })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('searchbox', { name: 'Buscar' }).fill('yerba orgánica');
    await expect(page.getByText('No encontramos productos con esos filtros.')).toBeVisible();
    await page.locator('#catalogEmptyState').getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(grid(page).getByRole('article')).toHaveCount(10);
    await expect(page).toHaveURL(/\/(index\.html)?$/);
  });

  test('un producto sin stock no se puede agregar', async ({ page }) => {
    await page.goto('/');
    const agotado = card(page, 'Mate Imperial Criollo con Virola Dorada');
    await expect(agotado.getByRole('button', { name: /Sin stock/ })).toBeDisabled();
  });
});

test.describe('Carrito', () => {
  test('agregar, cambiar cantidades, persistir y vaciar', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Mate Camionero Algarrobo Cincelado').getByRole('button', { name: /Agregar al Carrito/ }).click();

    const drawer = cartDialog(page);
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('#shippingStatusText')).toContainText(/Agregá \$\s15\.500 más/);

    await drawer.getByRole('button', { name: 'Sumar una unidad' }).click();
    await expect(drawer.getByTestId('qty')).toHaveText('2');
    // El total se anima hasta el valor final
    await expect(drawer.locator('#cartSubtotalAmount')).toHaveText(/^\$\s69\.000$/);
    await expect(drawer.locator('#shippingStatusText')).toContainText('ENVÍO GRATIS');

    await page.reload();
    await page.getByRole('button', { name: 'Abrir carrito (2 productos)' }).click();
    await expect(cartDialog(page).getByRole('listitem')).toHaveCount(1);

    await cartDialog(page).getByRole('button', { name: /Eliminar Mate Camionero/ }).click();
    await expect(cartDialog(page).getByText('Tu carrito está vacío.')).toBeVisible();
  });

  test('detalle de producto con grabado personalizado', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Termo Driven Desert Sand 1 Litro').getByRole('button', { name: 'Termo Driven Desert Sand 1 Litro' }).click();
    const modal = page.getByRole('dialog', { name: 'Termo Driven Desert Sand 1 Litro' });
    await expect(modal).toBeVisible();
    await modal.getByLabel(/Grabado Láser/).fill('Para Juli');
    await modal.getByRole('button', { name: 'Agregar al Carrito' }).click();
    await expect(cartDialog(page).getByText('Grabado: "Para Juli"')).toBeVisible();
  });

  test('armá tu set: el set personalizado llega al carrito con su detalle', async ({ page }) => {
    await page.goto('/#customizer');
    await page.getByRole('group', { name: 'Elegí tu Mate' }).getByRole('button', { name: /Algarrobo Noble/ }).click();
    await page.getByRole('group', { name: 'Elegí tu Termo Inox 1L (28hs)' }).getByRole('button', { name: /Hudson Vintage/ }).click();
    await page.getByRole('button', { name: /Agregar Set al Carrito/ }).click();
    await expect(cartDialog(page).getByRole('heading', { name: /Set Personalizado/ })).toBeVisible();
    await expect(cartDialog(page).getByText(/Mate: Mate Camionero Algarrobo Cincelado/)).toBeVisible();
  });

  test('"Iniciar compra segura" lleva al checkout con el mismo carrito', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Mate Imperial Premium Negro Azabache').getByRole('button', { name: /Agregar al Carrito/ }).click();
    await cartDialog(page).getByRole('link', { name: /Iniciar compra segura/ }).click();
    await expect(page).toHaveURL(/checkout\.html/);
    await expect(page.locator('#summaryItems')).toContainText('Mate Imperial Premium Negro Azabache');
    await expect(page.locator('#summaryToggleTotal')).toHaveText(/44\.900/);
  });
});
