import { describe, expect, it } from 'vitest';
import { KIT_DISCOUNT_RATE, computeCustomKit } from '../../src/store/customizer.js';
import { buildWhatsAppOrderMessage, buildWhatsAppOrderUrl } from '../../src/store/whatsapp.js';
import { PRODUCTS } from '../../src/data/products.js';

describe('computeCustomKit', () => {
  const selection = { mateId: 'mate-imperial-negro', termoId: 'termo-driven-negro', bombillaId: 'pico-loro' };

  it('suma los componentes y aplica 15% de descuento', () => {
    const kit = computeCustomKit(selection, PRODUCTS);
    const full = 44900 + 62500 + 9500;
    expect(kit.fullPrice).toBe(full);
    expect(kit.savings).toBe(Math.round(full * KIT_DISCOUNT_RATE));
    expect(kit.finalPrice).toBe(full - kit.savings);
    expect(kit.product).toMatchObject({ price: kit.finalPrice, name: 'Set Personalizado (Imperial + Driven)' });
    expect(kit.details).toMatch(/Bombilla: Pico de Loro/);
  });

  it('el mismo set genera el mismo id (se agrupa en el carrito)', () => {
    expect(computeCustomKit(selection, PRODUCTS).product.id).toBe(computeCustomKit(selection, PRODUCTS).product.id);
    expect(computeCustomKit({ ...selection, bombillaId: 'acero-inox' }, PRODUCTS).product.id)
      .not.toBe(computeCustomKit(selection, PRODUCTS).product.id);
  });

  it('limpia y recorta el grabado', () => {
    expect(computeCustomKit({ ...selection, engraving: `  ${'x'.repeat(50)} ` }, PRODUCTS).engraving).toHaveLength(35);
  });

  it('devuelve null ante una selección inválida', () => {
    expect(computeCustomKit({ ...selection, bombillaId: 'plastico' }, PRODUCTS)).toBeNull();
    expect(computeCustomKit({ ...selection, mateId: 'nada' }, PRODUCTS)).toBeNull();
  });
});

describe('pedido por WhatsApp', () => {
  const items = [
    { name: 'Mate Imperial', price: 44900, quantity: 1, engraving: 'J.G.', details: '' },
    { name: 'Set Personalizado', price: 10000, quantity: 2, engraving: '', details: 'Mate: X · Termo: Y' }
  ];

  it('detalla productos, grabados y total', () => {
    const msg = buildWhatsAppOrderMessage(items);
    expect(msg).toContain('1. *Mate Imperial* (x1)');
    expect(msg).toContain('✍️ *Grabado:* "J.G."');
    expect(msg).toContain('↳ Mate: X · Termo: Y');
    expect(msg).toMatch(/TOTAL:\* \$\s64\.900/);
    expect(msg).toContain('¡GRATIS a mi domicilio!');
  });

  it('indica envío a coordinar debajo del umbral', () => {
    expect(buildWhatsAppOrderMessage([items[1]])).toContain('A coordinar');
  });

  it('arma la URL codificada o null si el carrito está vacío', () => {
    expect(buildWhatsAppOrderUrl([])).toBeNull();
    const url = buildWhatsAppOrderUrl(items, '5490000000000');
    expect(url.startsWith('https://wa.me/5490000000000?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toBe(buildWhatsAppOrderMessage(items));
  });
});
