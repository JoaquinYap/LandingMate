/**
 * Pedido alternativo por WhatsApp (canal que la marca ya usaba antes del checkout web).
 */
import { formatPrice } from '../lib/format.js';
import { FREE_SHIPPING_THRESHOLD } from '../checkout/pricing.js';

export const WHATSAPP_NUMBER = '5491123456789';

export function buildWhatsAppOrderMessage(items) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const lines = items.map((item, idx) => {
    let line = `${idx + 1}. *${item.name}* (x${item.quantity}) - ${formatPrice(item.price * item.quantity)}`;
    if (item.details) line += `\n   ↳ ${item.details}`;
    if (item.engraving) line += `\n   ↳ ✍️ *Grabado:* "${item.engraving}"`;
    return line;
  });
  return [
    '👋 *¡Hola Lavaditos! Quiero realizar un pedido desde la tienda web:*',
    '',
    '🌿 *DETALLE DEL PEDIDO:*',
    ...lines,
    '',
    `💰 *TOTAL:* ${formatPrice(subtotal)}`,
    `🚚 *ENVÍO:* ${subtotal >= FREE_SHIPPING_THRESHOLD ? '¡GRATIS a mi domicilio!' : 'A coordinar por Andreani / Correo Arg.'}`,
    '',
    '📍 *Mis datos para la entrega:*',
    '- Nombre completo: ',
    '- Localidad y Provincia: ',
    '- Método de pago preferido (Transferencia 10% OFF / Cuotas): '
  ].join('\n');
}

export function buildWhatsAppOrderUrl(items, number = WHATSAPP_NUMBER) {
  if (!items.length) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(buildWhatsAppOrderMessage(items))}`;
}
