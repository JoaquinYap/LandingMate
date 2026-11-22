/**
 * Catálogo de productos de Lavaditos.
 * `stock` alimenta los límites del carrito y los filtros; `featuredRank` define el orden "Destacados".
 */

export const CATEGORIES = Object.freeze([
  { id: 'todos', label: 'Todos los Productos' },
  { id: 'imperiales', label: 'Mates Imperiales' },
  { id: 'madera', label: 'Mates de Madera' },
  { id: 'termos', label: 'Termos de Precisión' },
  { id: 'campeones', label: 'Edición Campeones ★★★' },
  { id: 'kits', label: 'Combos & Kits' }
]);

/** Umbral de stock a partir del cual se muestra "¡Últimas unidades!". */
export const LOW_STOCK_THRESHOLD = 3;

export const PRODUCTS = Object.freeze([
  {
    id: 'mate-imperial-negro',
    name: 'Mate Imperial Premium Negro Azabache',
    category: 'imperiales',
    categoryLabel: 'Mates Imperiales',
    price: 44900,
    oldPrice: 52000,
    badge: 'Más Vendido',
    image: 'assets/images/mate-imperial-negro.jpg',
    stock: 14,
    rating: 4.9,
    reviews: 312,
    material: 'calabaza',
    description: 'Calabaza misionera seleccionada de paredes gruesas, forrada en cuero vacuno vaqueta legítimo teñido a mano. Virola de alpaca cincelada artesanalmente con 4 patas de apoyo reforzadas.',
    specs: [
      'Calabaza de alto grosor de excelente calidad de curado',
      'Cuero vaqueta 100% vacuno con costura uruguaya a mano',
      'Virola maciza de alpaca pulida a espejo con cincelado criollo',
      'Incluye Bombilla Pico de Loro de alpaca de regalo'
    ]
  },
  {
    id: 'mate-camionero-algarrobo',
    name: 'Mate Camionero Algarrobo Cincelado',
    category: 'madera',
    categoryLabel: 'Mates de Madera',
    price: 34500,
    oldPrice: 39900,
    badge: 'Tradición Pampa',
    image: 'assets/images/mate-camionero-algarrobo.jpg',
    stock: 22,
    rating: 4.8,
    reviews: 198,
    material: 'algarrobo',
    description: 'Torneado a mano en madera estacionada de algarrobo macizo. Boca ancha tipo camionero para que la yerba rinda mucho más sin lavarse. Virola de alpaca con relieve orfebre.',
    specs: [
      'Madera de algarrobo macizo chaqueño de alta densidad',
      'Virola con relieve floral criollo en alpaca orfebre',
      'No necesita curado complejo: listo para sellar y cebar',
      'Incluye Bombilla resorte de alpaca'
    ]
  },
  {
    id: 'mate-imperial-cuero-crudo',
    name: 'Mate Imperial Cuero Crudo Textura Carpincho',
    category: 'imperiales',
    categoryLabel: 'Mates Imperiales',
    price: 48900,
    oldPrice: 56000,
    badge: 'Pieza Exclusiva',
    image: 'assets/images/mate-imperial-cuero-crudo.jpg',
    stock: 6,
    rating: 4.9,
    reviews: 87,
    material: 'calabaza',
    description: 'Una pieza de distinción única forrada en cuero curtido artesanal con grano natural. Virola cincelada con detalles orfebres en relieve profundo. El mate de los grandes cebadores.',
    specs: [
      'Cuero curtido vegetal de textura rústica y tacto suave',
      'Calabaza de boca amplia y base cuádruple de máxima estabilidad',
      'Virola con diseño floral de autor cincelada a mano',
      'Incluye Bombilla pico de loro y caja premium de presentación'
    ]
  },
  {
    id: 'mate-imperial-dorado-duo',
    name: 'Mate Imperial Criollo con Virola Dorada',
    category: 'imperiales',
    categoryLabel: 'Mates Imperiales',
    price: 52000,
    oldPrice: 59500,
    badge: 'Edición de Lujo',
    image: 'assets/images/mate-imperial-dorado-duo.jpg',
    stock: 0,
    rating: 4.7,
    reviews: 64,
    material: 'calabaza',
    description: 'Imponente terminación con virola dorada labrada en bronce orfebre de alto brillo. Cuero negro azabache con costuras firmes al tono y base de cuatro patas rígidas.',
    specs: [
      'Virola en bronce orfebre dorado con grabado rústico labrado',
      'Calabaza de interior parejo para una cebada constante',
      'Tratamiento hidrófugo en el cuero para máxima durabilidad',
      'Incluye Bombilla dorada de acero quirúrgico inoxidable'
    ]
  },
  {
    id: 'mate-madera-guarda-pampa',
    name: 'Mate Torpedo Algarrobo Guarda Pampa',
    category: 'madera',
    categoryLabel: 'Mates de Madera',
    price: 31900,
    oldPrice: 36000,
    badge: 'Clásico Argentino',
    image: 'assets/images/mate-madera-guarda-pampa.jpg',
    stock: 18,
    rating: 4.6,
    reviews: 141,
    material: 'algarrobo',
    description: 'Diseño armónico y ergonómico torneado en algarrobo noble. Pulido artesanal con cera de abejas y virola con el clásico motivo de la guarda pampa en alpaca.',
    specs: [
      'Guarda pampa tradicional grabada sobre virola de alpaca',
      'Madera curada térmicamente libre de barnices tóxicos',
      'Muy liviano y cómodo para sostener en mano',
      'Incluye Bombilla de acero inoxidable con filtro desmontable'
    ]
  },
  {
    id: 'termo-driven-negro',
    name: 'Termo Driven Inox Black Edition 1 Litro',
    category: 'termos',
    categoryLabel: 'Termos de Precisión',
    price: 62500,
    oldPrice: 71000,
    badge: '28 Horas Frío / Calor',
    image: 'assets/images/termo-driven-negro.webp',
    stock: 25,
    rating: 4.8,
    reviews: 276,
    material: 'acero',
    description: 'Construido en acero inoxidable 18/8 bicapa con cámara de vacío térmico. Conserva la temperatura del agua perfecta para mate (75°-80°C) todo el día sin pérdida de calor.',
    specs: [
      'Doble pared de acero quirúrgico 18/8 libre de BPA',
      'Pico cebador de flujo continuo antigoteo para un cebado preciso',
      'Acabado engomado mate negro antideslizante y antirayaduras',
      'Tapa térmica que funciona como vaso térmico complementario'
    ]
  },
  {
    id: 'termo-driven-desert-sand',
    name: 'Termo Driven Desert Sand 1 Litro',
    category: 'termos',
    categoryLabel: 'Termos de Precisión',
    price: 64000,
    oldPrice: 73000,
    badge: 'Color Arena Exclusivo',
    image: 'assets/images/termo-driven-desert-sand.jpg',
    stock: 9,
    rating: 4.7,
    reviews: 119,
    material: 'acero',
    description: 'Tonalidad arena patagónica en pintura electrostática de alta resistencia outdoor. Incluye dos tapas térmicas encastrables ideales para compartir en viajes y travesías.',
    specs: [
      'Aislamiento al vacío que no transpira ni calienta el exterior',
      'Doble tapa/vaso para compartir con compañeros de ruta',
      'Tapón matero a rosca con vertido dosificado en 360°',
      'Garantía térmica oficial por 5 años'
    ]
  },
  {
    id: 'termo-campeones-del-mundo-afa',
    name: 'Termo 3 Estrellas Campeones del Mundo 10 AFA',
    category: 'campeones',
    categoryLabel: 'Edición Especial',
    price: 68900,
    oldPrice: 79000,
    badge: 'Gloria Eterna ★★★',
    image: 'assets/images/termo-campeones-del-mundo-afa.jpg',
    stock: 3,
    rating: 5.0,
    reviews: 402,
    material: 'acero',
    description: 'Homenaje a la Scaloneta y al capitán. Grabado láser de precisión con las 3 estrellas, el escudo de la AFA, el número 10 de Messi y la Copa del Mundo. Con manija ergonómica abatible.',
    specs: [
      'Grabado láser permanente indeleble sobre acero negro satinado',
      'Pico cebador con boquilla roja deportiva dosificadora de precisión',
      'Manija rígida reforzada para transporte ágil en auto o mateadas al aire libre',
      'Capacidad 1000 ml con conservación térmica 24hs'
    ]
  },
  {
    id: 'termo-hudson-aventura',
    name: 'Termo Hudson Expedition Vintage 1L',
    category: 'termos',
    categoryLabel: 'Termos de Precisión',
    price: 58000,
    oldPrice: 65000,
    badge: 'Espíritu Aventurero',
    image: 'assets/images/termo-hudson-aventura.jpg',
    stock: 11,
    rating: 4.6,
    reviews: 73,
    material: 'acero',
    description: 'Para quienes llevan el mate a la montaña, río o trabajo de campo. Diseño sobrio en verde bosque oscuro con anillo central de refuerzo estructural ante golpes.',
    specs: [
      'Pintura rugosa anticorrosiva y a prueba de impactos',
      'Vaso de acero inoxidable esmerilado con boca ancha',
      'Mantiene hielo por 36hs y agua caliente por 24hs continuas',
      'Base reforzada de acero antideslizante'
    ]
  },
  {
    id: 'kit-ritual-completo',
    name: 'Combo Ritual Lavaditos (Mate + Termo + Yerbero)',
    category: 'kits',
    categoryLabel: 'Combos & Kits',
    price: 98500,
    oldPrice: 119000,
    badge: 'Ahorro 18% OFF',
    image: 'assets/images/experiencia-cebado-ritual.jpg',
    stock: 5,
    rating: 4.9,
    reviews: 158,
    material: 'combo',
    description: 'El kit matero definitivo: Mate Imperial de cuero con virola labrada, Termo Inox 1L de alta conservación, Yerbero de cuero con cierre dosificador y Bombilla Pico de Loro.',
    specs: [
      'Mate Imperial con virola personalizada',
      'Termo Inox 1 Litro a elección',
      'Yerbero artesanal de cuero legítimo con pico vertedor',
      'Bombilla cincelada y cepillo limpiador de regalo'
    ]
  }
].map((p, index) => Object.freeze({ ...p, specs: Object.freeze([...p.specs]), featuredRank: index })));

export const BOMBILLA_OPTIONS = Object.freeze({
  'pico-loro': { id: 'pico-loro', name: 'Pico de Loro Alpaca Cincelada', price: 9500 },
  'acero-inox': { id: 'acero-inox', name: 'Acero Quirúrgico Inoxidable', price: 6800 },
  'dorada-lujo': { id: 'dorada-lujo', name: 'Bombilla Baño Dorado Edición Oro', price: 12500 }
});

export function findProduct(id, products = PRODUCTS) {
  return products.find((p) => p.id === id) ?? null;
}
