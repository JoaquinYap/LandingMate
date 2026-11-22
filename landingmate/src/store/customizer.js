/**
 * "Armá tu set": cálculo del precio con descuento y armado del ítem de carrito.
 */
import { BOMBILLA_OPTIONS, findProduct } from '../data/products.js';

export const KIT_DISCOUNT_RATE = 0.15;
export const ENGRAVING_MAX_LENGTH = 35;

export function computeCustomKit({ mateId, termoId, bombillaId, engraving = '' }, products) {
  const mate = findProduct(mateId, products);
  const termo = findProduct(termoId, products);
  const bombilla = BOMBILLA_OPTIONS[bombillaId] ?? null;
  if (!mate || !termo || !bombilla) return null;

  const cleanEngraving = String(engraving).trim().slice(0, ENGRAVING_MAX_LENGTH);
  const fullPrice = mate.price + termo.price + bombilla.price;
  const savings = Math.round(fullPrice * KIT_DISCOUNT_RATE);
  const finalPrice = fullPrice - savings;
  const shortName = (name) => name.split(' ').slice(1, 2).join(' ');

  return {
    mate,
    termo,
    bombilla,
    engraving: cleanEngraving,
    fullPrice,
    savings,
    finalPrice,
    // Id determinístico: el mismo set agregado dos veces suma cantidad en lugar de duplicar la línea
    product: {
      id: `set-${mate.id}--${termo.id}--${bombilla.id}`,
      name: `Set Personalizado (${shortName(mate.name)} + ${shortName(termo.name)})`,
      price: finalPrice,
      image: mate.image
    },
    details: `Mate: ${mate.name} · Termo: ${termo.name} · Bombilla: ${bombilla.name}`
  };
}
