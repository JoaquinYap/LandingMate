/**
 * LAVADITOS · "Tus costumbres preferidas"
 * Main Application Logic & Interactive Features
 */

// Format price to Argentine Pesos (ARS)
const formatPrice = (amount) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount);
};


// ---------------------------------------------------------------
// MOTION UTILITIES
// ---------------------------------------------------------------
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Anima un número hacia su nuevo valor (la primera vez se asigna sin animar)
function tweenNumber(el, to, format, duration = 750) {
  if (!el) return;
  if (el.dataset.value === undefined || REDUCED_MOTION) {
    el.dataset.value = to;
    el.textContent = format(to);
    return;
  }
  const from = Number(el.dataset.value);
  el.dataset.value = to;
  if (from === to) { el.textContent = format(to); return; }
  cancelAnimationFrame(el._raf);
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    el.textContent = format(from + (to - from) * easeOutExpo(p));
    if (p < 1) el._raf = requestAnimationFrame(step);
    else el.textContent = format(to);
  };
  el._raf = requestAnimationFrame(step);
}

// Cambia el texto y marca el cambio con un destello breve
function setText(el, text) {
  if (!el || el.textContent === text) return;
  const hadValue = el.dataset.ready === '1';
  el.textContent = text;
  el.dataset.ready = '1';
  if (hadValue && !REDUCED_MOTION) {
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
}

// Parte un texto en palabras enmascaradas (conserva elementos internos como .gold-text)
function splitWords(el) {
  if (!el || el.classList.contains('is-split')) return;
  let index = 0;
  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const outer = document.createElement('span');
          outer.className = 'w';
          const inner = document.createElement('span');
          inner.className = 'w-in';
          inner.style.setProperty('--i', index++);
          inner.textContent = part;
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  walk(el);
  el.classList.add('is-split');
}

// Bloquea el scroll del fondo cuando hay carrito, modal o menú abierto
function syncScrollLock() {
  const open = ['cartOverlay', 'productModal', 'mobileNavDrawer']
    .some((id) => document.getElementById(id)?.classList.contains('open'));
  document.body.classList.toggle('no-scroll', open);
}

// Rebote del icono/contador del carrito
function bumpCart() {
  [document.getElementById('navCartCount'), document.getElementById('btnNavCart')].forEach((el) => {
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  });
}

// El producto "vuela" hasta el carrito antes de sumarse
function flyToCart(sourceImg, onDone) {
  const cartBtn = document.getElementById('btnNavCart');
  if (REDUCED_MOTION || !sourceImg || !cartBtn || !sourceImg.getBoundingClientRect().width) {
    onDone();
    return;
  }
  const a = sourceImg.getBoundingClientRect();
  const b = cartBtn.getBoundingClientRect();
  const size = 96;
  const clone = document.createElement('img');
  clone.className = 'fly-clone';
  clone.alt = '';
  clone.src = sourceImg.currentSrc || sourceImg.src;
  clone.style.width = `${size}px`;
  clone.style.height = `${size}px`;
  clone.style.left = `${a.left + a.width / 2 - size / 2}px`;
  clone.style.top = `${a.top + a.height / 2 - size / 2}px`;
  document.body.appendChild(clone);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = clone.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
    { transform: `translate(${dx * 0.5}px, ${Math.min(dy * 0.5, 0) - 70}px) scale(0.72)`, opacity: 1, offset: 0.45, easing: 'cubic-bezier(0.55, 0, 0.9, 0.6)' },
    { transform: `translate(${dx}px, ${dy}px) scale(0.18)`, opacity: 0.35 }
  ], { duration: 750 });

  let finished = false;
  const finish = () => { if (finished) return; finished = true; clone.remove(); onDone(); };
  anim.addEventListener('finish', finish);
  anim.addEventListener('cancel', finish);
  setTimeout(finish, 1200);
}

// Toast genérico (reemplaza a los alert())
let uiToastTimer;
function showToast(message) {
  const el = document.getElementById('uiToast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(uiToastTimer);
  uiToastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

// 1. PRODUCTS DATABASE
const PRODUCTS = [
  {
    id: 'mate-imperial-negro',
    name: 'Mate Imperial Premium Negro Azabache',
    category: 'imperiales',
    categoryLabel: 'Mates Imperiales',
    price: 44900,
    oldPrice: 52000,
    badge: 'Más Vendido',
    image: 'assets/images/mate-imperial-negro.jpg',
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
    description: 'El kit matero definitivo: Mate Imperial de cuero con virola labrada, Termo Inox 1L de alta conservación, Yerbero de cuero con cierre dosificador y Bombilla Pico de Loro.',
    specs: [
      'Mate Imperial con virola personalizada',
      'Termo Inox 1 Litro a elección',
      'Yerbero artesanal de cuero legítimo con pico vertedor',
      'Bombilla cincelada y cepillo limpiador de regalo'
    ]
  }
];

// 2. SHOPPING CART STATE
class CartState {
  constructor() {
    this.items = this.loadCart();
    this.freeShippingThreshold = 50000;
  }

  loadCart() {
    try {
      const saved = localStorage.getItem('lavaditos_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  saveCart() {
    try {
      localStorage.setItem('lavaditos_cart', JSON.stringify(this.items));
    } catch (e) {}
    this.updateUI();
  }

  addItem(product, engraving = '', customType = null) {
    const itemKey = customType ? `${product.id}_${customType}_${engraving}` : `${product.id}_${engraving}`;
    const existing = this.items.find(i => i.key === itemKey);

    if (existing) {
      existing.quantity += 1;
    } else {
      this.items.push({
        key: itemKey,
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        engraving: engraving,
        quantity: 1
      });
    }

    this.saveCart();
    this.openDrawer();
  }

  updateQuantity(key, delta) {
    const item = this.items.find(i => i.key === key);
    if (!item) return;

    if (item.quantity + delta <= 0) {
      this.removeItem(key);
      return;
    }
    item.quantity += delta;
    this.saveCart();
  }

  removeItem(key) {
    const commit = () => {
      this.items = this.items.filter(i => i.key !== key);
      this.saveCart();
    };
    const node = REDUCED_MOTION
      ? null
      : Array.from(document.querySelectorAll('.cart-item')).find(n => n.dataset.key === key);
    if (!node || node.classList.contains('is-leaving')) {
      if (!node) commit();
      return;
    }
    // Colapsa la fila (altura real -> 0) y recién después actualiza el estado
    node.style.height = `${node.offsetHeight}px`;
    void node.offsetHeight;
    node.classList.add('is-leaving');
    setTimeout(commit, 340);
  }

  getTotalCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  openDrawer() {
    const overlay = document.getElementById('cartOverlay');
    if (overlay) overlay.classList.add('open');
    syncScrollLock();
  }

  closeDrawer() {
    const overlay = document.getElementById('cartOverlay');
    if (overlay) overlay.classList.remove('open');
    syncScrollLock();
  }

  updateUI() {
    // Count badges
    const totalCount = this.getTotalCount();
    const countBadge = document.getElementById('navCartCount');
    if (countBadge) {
      countBadge.textContent = totalCount;
      countBadge.style.display = totalCount > 0 ? 'inline-block' : 'none';
      if (this._lastCount !== undefined && totalCount > this._lastCount) bumpCart();
    }
    this._lastCount = totalCount;

    // Shipping progress
    const subtotal = this.getSubtotal();
    const remaining = Math.max(0, this.freeShippingThreshold - subtotal);
    const progressPercent = Math.min(100, (subtotal / this.freeShippingThreshold) * 100);

    const progressFill = document.getElementById('shippingProgressFill');
    const shippingText = document.getElementById('shippingStatusText');

    if (progressFill && shippingText) {
      progressFill.style.width = `${progressPercent}%`;
      if (remaining === 0) {
        shippingText.innerHTML = `🎉 <strong>¡Felicitaciones! Tenés ENVÍO GRATIS</strong> en tu pedido.`;
      } else {
        shippingText.innerHTML = `🚚 Agregá <strong>${formatPrice(remaining)}</strong> más para tener <strong>ENVÍO GRATIS</strong>.`;
      }
    }

    // Cart items container
    const container = document.getElementById('cartItemsContainer');
    const emptyState = document.getElementById('cartEmptyState');
    const footer = document.getElementById('cartFooter');
    const subtotalEl = document.getElementById('cartSubtotalAmount');
    const totalEl = document.getElementById('cartTotalAmount');

    if (!container) return;

    if (this.items.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (footer) footer.style.display = 'none';
      [subtotalEl, totalEl].forEach(el => { if (el) { el.dataset.value = 0; el.textContent = formatPrice(0); } });
      this._renderedKeys = new Set();
      this._renderedQty = {};
      this._hasRendered = true;
    } else {
      if (emptyState) emptyState.style.display = 'none';
      if (footer) footer.style.display = 'block';

      const prevKeys = this._renderedKeys || new Set();
      const prevQty = this._renderedQty || {};
      const animateNew = this._hasRendered === true;

      container.innerHTML = this.items.map(item => {
        const isNew = animateNew && !prevKeys.has(item.key);
        const qtyChanged = prevQty[item.key] !== undefined && prevQty[item.key] !== item.quantity;
        return `
        <div class="cart-item${isNew ? ' is-new' : ''}" data-key="${escapeHtml(item.key)}">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="cart-item-img" />
          <div class="cart-item-info">
            <div>
              <h4 class="cart-item-title">${escapeHtml(item.name)}</h4>
              ${item.engraving ? `<div class="cart-item-engraving">Grabado: "${escapeHtml(item.engraving)}"</div>` : ''}
            </div>
            <div class="cart-item-row">
              <span class="cart-item-price">${formatPrice(item.price)}</span>
              <div class="cart-qty-ctrl">
                <button class="btn-qty" data-action="dec" aria-label="Quitar una unidad">-</button>
                <span class="qty-val${qtyChanged ? ' pop' : ''}">${item.quantity}</span>
                <button class="btn-qty" data-action="inc" aria-label="Agregar una unidad">+</button>
                <button class="btn-remove-item" data-action="remove" title="Eliminar" aria-label="Eliminar del carrito">✕</button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');

      this._renderedKeys = new Set(this.items.map(i => i.key));
      this._renderedQty = Object.fromEntries(this.items.map(i => [i.key, i.quantity]));
      this._hasRendered = true;

      const money = (v) => formatPrice(Math.round(v));
      tweenNumber(subtotalEl, subtotal, money);
      tweenNumber(totalEl, subtotal, money);
    }
  }

  generateWhatsAppOrderUrl() {
    if (this.items.length === 0) return '#';
    const subtotal = this.getSubtotal();
    const hasFreeShipping = subtotal >= this.freeShippingThreshold;

    let text = `👋 *¡Hola Lavaditos! Quiero realizar un pedido desde la tienda web:*\n\n`;
    text += `🌿 *DETALLE DEL PEDIDO:*\n`;

    this.items.forEach((item, idx) => {
      text += `${idx + 1}. *${item.name}* (x${item.quantity}) - ${formatPrice(item.price * item.quantity)}\n`;
      if (item.engraving) {
        text += `   ↳ ✍️ *Grabado solicitado:* "${item.engraving}"\n`;
      }
    });

    text += `\n💰 *TOTAL:* ${formatPrice(subtotal)}\n`;
    text += `🚚 *ENVÍO:* ${hasFreeShipping ? '¡GRATIS a mi domicilio!' : 'A coordinar por Andreani / Correo Arg.'}\n\n`;
    text += `📍 *Mis datos para la entrega:* \n`;
    text += `- Nombre completo: \n`;
    text += `- Localidad y Provincia: \n`;
    text += `- Método de pago preferido (Transferencia 10% OFF / Cuotas): `;

    const encoded = encodeURIComponent(text);
    return `https://wa.me/5491123456789?text=${encoded}`;
  }
}

const cart = new CartState();

// 3. CATALOG RENDERING & FILTERING
function renderCatalog(filter = 'todos') {
  const grid = document.getElementById('productCatalogGrid');
  if (!grid) return;

  const filtered = filter === 'todos' 
    ? PRODUCTS 
    : PRODUCTS.filter(p => p.category === filter);

  grid.innerHTML = filtered.map(product => {
    const installmentPrice = Math.round(product.price / 6);
    return `
      <article class="product-card spot reveal" data-category="${product.category}">
        ${product.badge ? `<span class="card-badge">${product.badge}</span>` : ''}
        <div class="card-image-box" onclick="openProductModal('${product.id}')">
          <img src="${product.image}" alt="${product.name}" loading="lazy" decoding="async"
               onload="this.closest('.card-image-box').classList.add('is-loaded')"
               onerror="this.closest('.card-image-box').classList.add('is-loaded')" />
          <div class="card-quick-actions">
            <button class="btn-quick-view" onclick="event.stopPropagation(); openProductModal('${product.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Ver Detalle
            </button>
          </div>
        </div>
        <div class="card-content">
          <span class="card-category">${product.categoryLabel}</span>
          <h3 class="card-title" onclick="openProductModal('${product.id}')">${product.name}</h3>
          <p class="card-desc">${product.description}</p>
          <div class="card-pricing">
            <div class="price-box">
              ${product.oldPrice ? `<span class="price-original">${formatPrice(product.oldPrice)}</span>` : ''}
              <span class="price-current">${formatPrice(product.price)}</span>
              <span class="installments-text">6 cuotas sin interés de ${formatPrice(installmentPrice)}</span>
            </div>
          </div>
          <button class="btn-add-cart" onclick="addProductFromCard(this, '${product.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            Agregar al Carrito
          </button>
        </div>
      </article>
    `;
  }).join('');

  // Imágenes ya en caché: sacar el esqueleto de inmediato
  grid.querySelectorAll('.card-image-box img').forEach(img => {
    if (img.complete) img.closest('.card-image-box').classList.add('is-loaded');
  });

  // Re-observe animations on new elements
  initScrollAnimations();
}

// Cambio de filtro: fade-out, intercambio y altura que se acomoda sin saltos
let catalogSwitchToken = 0;
function switchCatalog(filter) {
  const grid = document.getElementById('productCatalogGrid');
  if (!grid) return;
  if (REDUCED_MOTION) { renderCatalog(filter); return; }

  const token = ++catalogSwitchToken;
  const startHeight = grid.offsetHeight;
  grid.style.height = `${startHeight}px`;
  grid.classList.add('is-switching', 'is-resizing');

  setTimeout(() => {
    if (token !== catalogSwitchToken) return;
    grid.style.transition = 'none';
    grid.style.height = 'auto';
    renderCatalog(filter);
    const endHeight = grid.offsetHeight;
    grid.style.height = `${startHeight}px`;
    void grid.offsetHeight;
    grid.style.transition = '';
    grid.classList.remove('is-switching');
    grid.style.height = `${endHeight}px`;
    setTimeout(() => {
      if (token !== catalogSwitchToken) return;
      grid.style.height = '';
      grid.classList.remove('is-resizing');
    }, 620);
  }, 230);
}

// Agregar desde la card: la imagen vuela al carrito y luego se suma
function addProductFromCard(btn, productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  const img = btn.closest('.product-card')?.querySelector('.card-image-box img');
  btn.classList.add('is-added');
  setTimeout(() => btn.classList.remove('is-added'), 900);
  flyToCart(img, () => cart.addItem(product));
}

// 4. QUICK VIEW MODAL
function openProductModal(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const modal = document.getElementById('productModal');
  const modalImg = document.getElementById('modalProductImg');
  const modalCategory = document.getElementById('modalProductCategory');
  const modalTitle = document.getElementById('modalProductTitle');
  const modalPrice = document.getElementById('modalProductPrice');
  const modalPriceOld = document.getElementById('modalProductPriceOld');
  const modalDesc = document.getElementById('modalProductDesc');
  const modalSpecs = document.getElementById('modalProductSpecs');
  const modalAddBtn = document.getElementById('modalAddCartBtn');
  const modalEngraving = document.getElementById('modalEngravingInput');

  if (modalImg) modalImg.src = product.image;
  if (modalCategory) modalCategory.textContent = product.categoryLabel;
  if (modalTitle) modalTitle.textContent = product.name;
  if (modalPrice) modalPrice.textContent = formatPrice(product.price);
  if (modalPriceOld) modalPriceOld.textContent = product.oldPrice ? formatPrice(product.oldPrice) : '';
  if (modalDesc) modalDesc.textContent = product.description;
  if (modalEngraving) modalEngraving.value = '';

  if (modalSpecs) {
    modalSpecs.innerHTML = product.specs.map(spec => `
      <li>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ${spec}
      </li>
    `).join('');
  }

  if (modalAddBtn) {
    modalAddBtn.onclick = () => {
      const engravingText = modalEngraving ? modalEngraving.value.trim() : '';
      closeProductModal();
      flyToCart(modalImg, () => cart.addItem(product, engravingText));
    };
  }

  if (modal) modal.classList.add('open');
  syncScrollLock();
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (modal) modal.classList.remove('open');
  syncScrollLock();
}

// 5. INTERACTIVE SET CUSTOMIZER (ARMÁ TU SET)
const customizerState = {
  mateId: 'mate-imperial-negro',
  termoId: 'termo-driven-negro',
  bombillaType: 'pico-loro',
  engraving: ''
};

const BOMBILLA_OPTIONS = {
  'pico-loro': { name: 'Pico de Loro Alpaca Cincelada', price: 9500 },
  'acero-inox': { name: 'Acero Quirúrgico Inoxidable', price: 6800 },
  'dorada-lujo': { name: 'Bombilla Baño Dorado Edición Oro', price: 12500 }
};

function updateCustomizerUI() {
  const selectedMate = PRODUCTS.find(p => p.id === customizerState.mateId);
  const selectedTermo = PRODUCTS.find(p => p.id === customizerState.termoId);
  const selectedBombilla = BOMBILLA_OPTIONS[customizerState.bombillaType];

  let total = (selectedMate ? selectedMate.price : 0) +
              (selectedTermo ? selectedTermo.price : 0) +
              (selectedBombilla ? selectedBombilla.price : 0);

  // Set discount of 15% when assembling a full kit
  const discountRate = 0.15;
  const savings = Math.round(total * discountRate);
  const finalPrice = total - savings;

  const $ = (id) => document.getElementById(id);

  if (selectedMate) {
    setText($('custSummaryMate'), selectedMate.name);
    setText($('custSummaryMatePrice'), formatPrice(selectedMate.price));
  }
  if (selectedTermo) {
    setText($('custSummaryTermo'), selectedTermo.name);
    setText($('custSummaryTermoPrice'), formatPrice(selectedTermo.price));
  }
  if (selectedBombilla) {
    setText($('custSummaryBombilla'), selectedBombilla.name);
    setText($('custSummaryBombillaPrice'), formatPrice(selectedBombilla.price));
  }
  setText($('custSummaryEngraving'),
    customizerState.engraving ? `"${customizerState.engraving}" (¡Sin cargo!)` : 'Sin grabado adicional');

  // El precio final "corre" hasta el nuevo valor
  tweenNumber($('custSummaryTotal'), finalPrice, (v) => formatPrice(Math.round(v)), 650);
  setText($('custSummarySavings'), `Ahorro del 15% aplicado: -${formatPrice(savings)}`);
}

function initCustomizer() {
  const bindGroup = (selector, onPick) => {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(selector).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        onPick(btn.getAttribute('data-id'));
        updateCustomizerUI();
      });
    });
  };

  bindGroup('.cust-mate-opt', (id) => { customizerState.mateId = id; });
  bindGroup('.cust-termo-opt', (id) => { customizerState.termoId = id; });
  bindGroup('.cust-bombilla-opt', (id) => { customizerState.bombillaType = id; });

  // Engraving text input
  const engravingInput = document.getElementById('customizerEngravingInput');
  if (engravingInput) {
    engravingInput.addEventListener('input', (e) => {
      customizerState.engraving = e.target.value.trim();
      updateCustomizerUI();
    });
  }

  // Add custom kit to cart
  const addKitBtn = document.getElementById('btnAddCustomKit');
  if (addKitBtn) {
    addKitBtn.addEventListener('click', () => {
      const selectedMate = PRODUCTS.find(p => p.id === customizerState.mateId);
      const selectedTermo = PRODUCTS.find(p => p.id === customizerState.termoId);
      const selectedBombilla = BOMBILLA_OPTIONS[customizerState.bombillaType];

      const rawTotal = selectedMate.price + selectedTermo.price + selectedBombilla.price;
      const finalPrice = Math.round(rawTotal * 0.85);

      const customKitItem = {
        id: `custom-kit-${Date.now()}`,
        name: `Set Personalizado (${selectedMate.name.split(' ')[1]} + ${selectedTermo.name.split(' ')[1]})`,
        price: finalPrice,
        image: selectedMate.image
      };

      const note = `Mate: ${selectedMate.name} | Termo: ${selectedTermo.name} | Bombilla: ${selectedBombilla.name}${customizerState.engraving ? ` | Grabado: "${customizerState.engraving}"` : ''}`;

      const thumb = document.querySelector('.cust-mate-opt.selected .option-thumb');
      flyToCart(thumb, () => cart.addItem(customKitItem, note, 'custom-kit'));
    });
  }

  updateCustomizerUI();
}

// 6. SCROLL REVEAL, HERO SEQUENCE & PAGE EFFECTS

// Un único observer: entra por lotes, con escalonado automático por posición
let revealObserver;
function initScrollAnimations() {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top ||
                        a.boundingClientRect.left - b.boundingClientRect.left);
      visible.forEach((entry, i) => {
        const el = entry.target;
        el.style.setProperty('--reveal-delay', `${Math.min(i, 5) * 85}ms`);
        el.classList.add('active');
        revealObserver.unobserve(el);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  }
  document.querySelectorAll('.reveal:not(.active), .reveal-seq:not(.active)')
    .forEach(el => revealObserver.observe(el));
}

// Hero: titular por palabras, contadores, parallax y destello final
function initHero() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  splitWords(hero.querySelector('.hero-title'));

  const counters = Array.from(hero.querySelectorAll('[data-count]')).map((el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
    // Con decimales se mantiene el punto del diseño original (4.9); sin decimales, miles a la argentina
    const fmt = decimals > 0 ? (v) => v.toFixed(decimals) : (v) => nf.format(Math.round(v));
    return { el, target, format: (v) => `${prefix}${fmt(v)}${suffix}` };
  });
  if (!REDUCED_MOTION) counters.forEach(c => { c.el.textContent = c.format(0); });

  const runCounters = () => {
    counters.forEach((c, i) => {
      if (REDUCED_MOTION) { c.el.textContent = c.format(c.target); return; }
      const delay = 850 + i * 130;
      const duration = 1700;
      const t0 = performance.now() + delay;
      const step = (now) => {
        const p = Math.min(1, Math.max(0, (now - t0) / duration));
        c.el.textContent = c.format(c.target * easeOutExpo(p));
        if (p < 1) requestAnimationFrame(step);
        else c.el.textContent = c.format(c.target);
      };
      requestAnimationFrame(step);
    });
  };

  const start = () => {
    hero.classList.add('is-ready');
    runCounters();
    if (!REDUCED_MOTION) setTimeout(() => hero.classList.add('is-shimmer'), 2300);
  };

  if (REDUCED_MOTION) { start(); return; }
  // Esperamos las tipografías para que el corte de líneas no cambie en plena animación
  const fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))])
    : Promise.resolve();
  fontsReady.then(() => requestAnimationFrame(() => requestAnimationFrame(start)));
}

// Parallax suave con el cursor sobre el hero (variables CSS --mx / --my)
function initHeroParallax() {
  const hero = document.getElementById('hero');
  if (!hero || REDUCED_MOTION || !FINE_POINTER) return;
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

  const tick = () => {
    cx += (tx - cx) * 0.07;
    cy += (ty - cy) * 0.07;
    hero.style.setProperty('--mx', cx.toFixed(3));
    hero.style.setProperty('--my', cy.toFixed(3));
    const moving = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001;
    raf = moving ? requestAnimationFrame(tick) : null;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    kick();
  });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
}

// Scroll: navbar compacta, barra de progreso y parallax del hero (un solo listener)
function initScrollEffects() {
  const navbar = document.querySelector('.navbar');
  const bar = document.getElementById('scrollProgress');
  const hero = document.getElementById('hero');
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (navbar) navbar.classList.toggle('scrolled', y > 50);
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (hero && !REDUCED_MOTION) {
      const p = Math.min(1, Math.max(0, y / hero.offsetHeight));
      hero.style.setProperty('--sy', p.toFixed(3));
    }
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
}

// Resalta en la navegación la sección que se está viendo
function initScrollSpy() {
  const links = Array.from(document.querySelectorAll('.nav-links .nav-link'));
  const map = new Map(links.map(l => [l.getAttribute('href').slice(1), l]));
  const targets = [...map.keys(), 'hero'].map(id => document.getElementById(id)).filter(Boolean);
  if (!targets.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach(l => l.classList.remove('is-active'));
      const link = map.get(e.target.id);
      if (link) link.classList.add('is-active');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  targets.forEach(t => io.observe(t));
}

// Spotlight: el borde dorado de las cards sigue al cursor
function initSpotlight() {
  if (!FINE_POINTER) return;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest ? e.target.closest('.spot') : null;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
    card.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
  }, { passive: true });
}

// Botones principales con leve atracción magnética
function initMagnetic() {
  if (!FINE_POINTER || REDUCED_MOTION) return;
  document.querySelectorAll('.hero-buttons .btn-primary, .hero-buttons .btn-secondary, .cta-banner .btn-primary')
    .forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * 0.18;
        const y = (e.clientY - (r.top + r.height / 2)) * 0.28;
        btn.style.translate = `${x}px ${y}px`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
    });
}

// Barra de anuncios como ticker continuo (pausa al pasar el mouse)
function initMarquee() {
  const track = document.querySelector('.top-bar .marquee-track');
  if (!track || REDUCED_MOTION) return;
  const group = document.createElement('div');
  group.className = 'marquee-group';
  Array.from(track.children).forEach(child => group.appendChild(child));
  const clone = group.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.append(group, clone);
  track.classList.add('is-marquee');
  const speed = 48; // px por segundo
  const setSpeed = () => track.style.setProperty('--marquee-duration', `${Math.max(14, group.offsetWidth / speed)}s`);
  setSpeed();
  window.addEventListener('resize', setSpeed);
}

// Indicador deslizante para pestañas (filtros y guía de curado)
function attachIndicator(container, buttonSelector) {
  if (!container) return null;
  const indicator = document.createElement('span');
  indicator.className = 'tab-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  container.classList.add('has-indicator');
  container.prepend(indicator);

  const move = (animate = true) => {
    const active = container.querySelector(`${buttonSelector}.active`);
    if (!active) return;
    if (!animate) indicator.style.transition = 'none';
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.height = `${active.offsetHeight}px`;
    indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    if (!animate) { void indicator.offsetWidth; indicator.style.transition = ''; }
  };
  move(false);
  window.addEventListener('resize', () => move(false));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => move(false));
  return { move };
}

// 7. CURING GUIDE TABS
function initCuringGuide() {
  const tabs = [
    { btn: document.getElementById('tabCalabaza'), panel: document.getElementById('panelCalabaza') },
    { btn: document.getElementById('tabMadera'), panel: document.getElementById('panelMadera') }
  ].filter(t => t.btn && t.panel);
  if (tabs.length < 2) return;

  const indicator = attachIndicator(document.querySelector('.guide-tabs'), '.guide-tab-btn');

  tabs.forEach(({ btn }) => { btn.setAttribute('aria-selected', btn.classList.contains('active')); });

  tabs.forEach(({ btn, panel }) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      tabs.forEach(t => {
        const on = t.btn === btn;
        t.btn.classList.toggle('active', on);
        t.btn.setAttribute('aria-selected', on);
        t.panel.classList.toggle('active', on);
        t.panel.classList.remove('panel-enter');
      });
      void panel.offsetWidth;
      panel.classList.add('panel-enter');
      if (indicator) indicator.move();
    });
  });
}

// 8. FAQ ACCORDION
function initFaq() {
  const items = Array.from(document.querySelectorAll('.faq-item'));
  const setExpanded = (item, expanded) => {
    item.classList.toggle('open', expanded);
    item.querySelector('.faq-header').setAttribute('aria-expanded', expanded);
  };

  items.forEach((item, idx) => {
    const header = item.querySelector('.faq-header');
    const content = item.querySelector('.faq-content');
    content.id = `faq-panel-${idx}`;
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-controls', content.id);
    header.setAttribute('aria-expanded', item.classList.contains('open'));

    const toggle = () => {
      const isOpen = item.classList.contains('open');
      items.forEach(i => setExpanded(i, false));
      if (!isOpen) setExpanded(item, true);
    };
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

// 9. RECENT SALES SOCIAL PROOF TOASTER
const RECENT_SALES = [
  { name: 'Lucas G.', city: 'Rosario, Santa Fe', product: 'Mate Imperial Negro Azabache', image: 'assets/images/mate-imperial-negro.jpg', time: 'Hace 4 minutos' },
  { name: 'Florencia M.', city: 'Córdoba Capital', product: 'Termo 3 Estrellas Campeones', image: 'assets/images/termo-campeones-del-mundo-afa.jpg', time: 'Hace 8 minutos' },
  { name: 'Martín B.', city: 'Palermo, CABA', product: 'Mate Camionero Algarrobo', image: 'assets/images/mate-camionero-algarrobo.jpg', time: 'Hace 12 minutos' },
  { name: 'Camila R.', city: 'Mendoza', product: 'Termo Driven Desert Sand 1L', image: 'assets/images/termo-driven-desert-sand.jpg', time: 'Hace 19 minutos' },
  { name: 'Gonzalo P.', city: 'Salta', product: 'Combo Ritual Lavaditos Completo', image: 'assets/images/experiencia-cebado-ritual.jpg', time: 'Hace 23 minutos' }
];

function initSocialProof() {
  const toast = document.getElementById('socialProofToast');
  if (!toast) return;

  let currentIndex = 0;

  function showToast() {
    const sale = RECENT_SALES[currentIndex];
    toast.innerHTML = `
      <img src="${sale.image}" alt="${sale.product}" class="toast-img" />
      <div class="toast-text">
        <strong>${sale.name}</strong> (${sale.city})<br>
        compró <em>${sale.product}</em>
        <div class="toast-time">${sale.time}</div>
      </div>
    `;

    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 4500);

    currentIndex = (currentIndex + 1) % RECENT_SALES.length;
  }

  // Trigger first after 4 seconds, then repeat every 14 seconds
  setTimeout(() => {
    showToast();
    setInterval(showToast, 14000);
  }, 4000);
}

// 10. SETUP EVENT LISTENERS ON DOM READY
document.addEventListener('DOMContentLoaded', () => {
  window.__lavReady = true;

  // Titulares por palabra y cabeceras con coreografía (etiqueta -> título -> texto)
  document.querySelectorAll('.section-title').forEach(splitWords);
  document.querySelectorAll('.section-header.reveal, .story-content.reveal').forEach((el) => {
    el.classList.remove('reveal');
    el.classList.add('reveal-seq');
    Array.from(el.children).forEach((child, i) => child.style.setProperty('--n', i));
  });
  const storyImage = document.querySelector('.story-image-wrap');
  if (storyImage) storyImage.classList.add('reveal-mask');
  document.querySelectorAll('.review-card, .step-card').forEach(el => el.classList.add('spot'));

  initMarquee();
  initHero();

  // Render catalog
  renderCatalog('todos');

  // Filter clicks
  const filterIndicator = attachIndicator(document.querySelector('.catalog-filters'), '.filter-btn');
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.classList.contains('active'));
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      if (filterIndicator) filterIndicator.move();
      switchCatalog(btn.getAttribute('data-filter'));
    });
  });

  // Cart open/close triggers
  const btnCartOpen = document.getElementById('btnNavCart');
  const btnCartClose = document.getElementById('btnCloseCart');
  const cartOverlay = document.getElementById('cartOverlay');
  const btnCheckoutWA = document.getElementById('btnCheckoutWhatsApp');

  if (btnCartOpen) btnCartOpen.addEventListener('click', () => cart.openDrawer());
  if (btnCartClose) btnCartClose.addEventListener('click', () => cart.closeDrawer());
  if (cartOverlay) {
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) cart.closeDrawer();
    });
  }

  // Controles de cantidad / eliminar (delegación: sin onclick inline)
  const cartItemsContainer = document.getElementById('cartItemsContainer');
  if (cartItemsContainer) {
    cartItemsContainer.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      const row = actionBtn.closest('.cart-item');
      if (!row) return;
      const key = row.dataset.key;
      const action = actionBtn.dataset.action;
      if (action === 'inc') cart.updateQuantity(key, 1);
      else if (action === 'dec') cart.updateQuantity(key, -1);
      else if (action === 'remove') cart.removeItem(key);
    });
  }

  if (btnCheckoutWA) {
    btnCheckoutWA.addEventListener('click', () => {
      const url = cart.generateWhatsAppOrderUrl();
      if (url === '#') {
        showToast('Tu carrito está vacío. Agregá algún mate o producto antes de finalizar.');
        return;
      }
      window.open(url, '_blank');
    });
  }

  // Modal close triggers
  const modalOverlay = document.getElementById('productModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeProductModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeProductModal();
    });
  }

  // Mobile menu
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileDrawer = document.getElementById('mobileNavDrawer');
  const btnCloseMobile = document.getElementById('btnCloseMobileNav');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');
  const setMobileNav = (open) => {
    if (!mobileDrawer) return;
    mobileDrawer.classList.toggle('open', open);
    syncScrollLock();
  };

  if (mobileToggle && mobileDrawer) mobileToggle.addEventListener('click', () => setMobileNav(true));
  if (btnCloseMobile && mobileDrawer) btnCloseMobile.addEventListener('click', () => setMobileNav(false));
  mobileLinks.forEach(link => link.addEventListener('click', () => setMobileNav(false)));

  // Escape cierra lo que esté abierto
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    cart.closeDrawer();
    closeProductModal();
    setMobileNav(false);
  });

  // Newsletter form
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('newsletterEmail').value;
      if (!email) return;
      const submitBtn = newsletterForm.querySelector('button[type="submit"]');
      const label = submitBtn.textContent;
      submitBtn.textContent = '¡Cupón enviado!';
      submitBtn.classList.add('is-done');
      submitBtn.disabled = true;
      showToast(`Te enviamos tu cupón de 10% OFF a ${email}`);
      newsletterForm.reset();
      setTimeout(() => {
        submitBtn.textContent = label;
        submitBtn.classList.remove('is-done');
        submitBtn.disabled = false;
      }, 3200);
    });
  }

  // Initialize features
  initScrollEffects();
  initScrollSpy();
  initHeroParallax();
  initSpotlight();
  initMagnetic();
  initCustomizer();
  initCuringGuide();
  initFaq();
  initSocialProof();
  initScrollAnimations();
  cart.updateUI();
});
