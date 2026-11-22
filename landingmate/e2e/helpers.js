import { expect } from '@playwright/test';

export const grid = (page) => page.locator('#productCatalogGrid');
export const card = (page, name) => grid(page).getByRole('article', { name });
export const cartDialog = (page) => page.getByRole('dialog', { name: /Tu Carrito Matero/ });
export const money = (text) => text.replace(/\u00a0/g, ' ');

/** Carga un carrito directo en localStorage (más rápido que pasar por la UI). */
export async function seedCart(page, items) {
  await page.goto('/');
  await page.evaluate((lines) => localStorage.setItem('lavaditos_cart', JSON.stringify(lines)), items);
}

export async function fillContact(page) {
  const form = page.getByRole('form', { name: 'Datos de contacto' });
  await form.getByLabel('Email').fill('ana@correo.com');
  await form.getByLabel('Nombre y apellido').fill('Ana Pérez');
  await form.getByLabel('Teléfono').fill('11 2345 6789');
  await form.getByLabel('DNI').fill('30123456');
  await form.getByRole('button', { name: 'Continuar al envío' }).click();
  await expect(page.getByRole('heading', { name: 'Envío' })).toBeFocused();
}

export async function fillAddress(page) {
  const form = page.getByRole('form', { name: 'Envío' });
  await form.getByLabel('Calle').fill('Honduras');
  await form.getByLabel('Altura').fill('4800');
  await form.getByLabel('Localidad').fill('Palermo');
  await form.getByLabel('Provincia').selectOption('CABA');
  await form.getByLabel('Código postal').fill('C1414BMJ');
  await form.getByRole('button', { name: 'Continuar al pago' }).click();
}

export async function fillCard(page, { number = '4242 4242 4242 4242', installments } = {}) {
  const form = page.getByRole('form', { name: 'Pago' });
  await form.getByLabel('Número de tarjeta').fill(number);
  await form.getByLabel('Nombre del titular').fill('ANA PEREZ');
  await form.getByLabel('Vencimiento').fill('12/30');
  await form.getByLabel('Código de seguridad').fill('123');
  if (installments) await form.getByLabel('Cuotas', { exact: true }).selectOption(String(installments));
  await form.getByRole('button', { name: 'Revisar pedido' }).click();
}

export async function acceptAndPay(page) {
  const form = page.getByRole('form', { name: 'Revisá y confirmá' });
  await form.getByLabel(/Acepto los términos/).check();
  await form.getByRole('button', { name: /Confirmar y pagar/ }).click();
}
