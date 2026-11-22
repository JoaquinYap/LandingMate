/**
 * Efectos visuales de la landing (portados del app.js original).
 * Son decorativos: se validan con los tests e2e y se excluyen del umbral de cobertura unitaria.
 */
import { easeOutExpo, hasFinePointer, prefersReducedMotion, splitWords } from './motion.js';

// ---------- Reveal on scroll: un único observer, escalonado automático por posición ----------
let revealObserver;
export function observeReveals(root = document) {
  const pending = root.querySelectorAll('.reveal:not(.active), .reveal-seq:not(.active)');
  if (typeof IntersectionObserver !== 'function') {
    pending.forEach((el) => el.classList.add('active'));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      visible.forEach((entry, i) => {
        const el = entry.target;
        el.style.setProperty('--reveal-delay', `${Math.min(i, 5) * 85}ms`);
        el.classList.add('active');
        revealObserver.unobserve(el);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  }
  pending.forEach((el) => revealObserver.observe(el));
}

/** Titulares por palabra y cabeceras con coreografía (etiqueta -> título -> texto). */
export function initSectionChoreography(root = document) {
  root.querySelectorAll('.section-title').forEach(splitWords);
  root.querySelectorAll('.section-header.reveal, .story-content.reveal').forEach((el) => {
    el.classList.remove('reveal');
    el.classList.add('reveal-seq');
    Array.from(el.children).forEach((child, i) => child.style.setProperty('--n', i));
  });
  root.querySelector('.story-image-wrap')?.classList.add('reveal-mask');
  root.querySelectorAll('.review-card, .step-card').forEach((el) => el.classList.add('spot'));
}

// ---------- Hero: titular por palabras, contadores y destello final ----------
export function initHero() {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const reduced = prefersReducedMotion();
  splitWords(hero.querySelector('.hero-title'));

  const counters = Array.from(hero.querySelectorAll('[data-count]')).map((el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
    const fmt = decimals > 0 ? (v) => v.toFixed(decimals) : (v) => nf.format(Math.round(v));
    return { el, target, format: (v) => `${prefix}${fmt(v)}${suffix}` };
  });
  if (!reduced) counters.forEach((c) => { c.el.textContent = c.format(0); });

  const runCounters = () => {
    counters.forEach((c, i) => {
      if (reduced) { c.el.textContent = c.format(c.target); return; }
      const t0 = performance.now() + 850 + i * 130;
      const duration = 1700;
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
    if (!reduced) setTimeout(() => hero.classList.add('is-shimmer'), 2300);
  };

  if (reduced) { start(); return; }
  // Esperamos las tipografías para que el corte de líneas no cambie en plena animación
  const fontsReady = document.fonts?.ready
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))])
    : Promise.resolve();
  fontsReady.then(() => requestAnimationFrame(() => requestAnimationFrame(start)));
}

// ---------- Parallax suave con el cursor sobre el hero ----------
export function initHeroParallax() {
  const hero = document.getElementById('hero');
  if (!hero || prefersReducedMotion() || !hasFinePointer()) return;
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

// ---------- Scroll: navbar compacta, barra de progreso y parallax del hero ----------
export function initScrollEffects() {
  const navbar = document.querySelector('.navbar');
  const bar = document.getElementById('scrollProgress');
  const hero = document.getElementById('hero');
  const reduced = prefersReducedMotion();
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    navbar?.classList.toggle('scrolled', y > 50);
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (hero && !reduced) hero.style.setProperty('--sy', Math.min(1, Math.max(0, y / hero.offsetHeight)).toFixed(3));
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
}

// ---------- Resalta en la navegación la sección que se está viendo ----------
export function initScrollSpy() {
  if (typeof IntersectionObserver !== 'function') return;
  const links = Array.from(document.querySelectorAll('.nav-links .nav-link'));
  const map = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
  const targets = [...map.keys(), 'hero'].map((id) => document.getElementById(id)).filter(Boolean);
  if (!targets.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((l) => { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
      const link = map.get(e.target.id);
      if (link) { link.classList.add('is-active'); link.setAttribute('aria-current', 'true'); }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  targets.forEach((t) => io.observe(t));
}

// ---------- Spotlight: el borde dorado de las cards sigue al cursor ----------
export function initSpotlight() {
  if (!hasFinePointer()) return;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest ? e.target.closest('.spot') : null;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
    card.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
  }, { passive: true });
}

// ---------- Botones principales con leve atracción magnética ----------
export function initMagnetic() {
  if (!hasFinePointer() || prefersReducedMotion()) return;
  document.querySelectorAll('.hero-buttons .btn-primary, .hero-buttons .btn-secondary, .cta-banner .btn-primary').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.translate = `${(e.clientX - (r.left + r.width / 2)) * 0.18}px ${(e.clientY - (r.top + r.height / 2)) * 0.28}px`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
  });
}

// ---------- Barra de anuncios como ticker continuo ----------
export function initMarquee() {
  const track = document.querySelector('.top-bar .marquee-track');
  if (!track || prefersReducedMotion()) return;
  const group = document.createElement('div');
  group.className = 'marquee-group';
  Array.from(track.children).forEach((child) => group.appendChild(child));
  const clone = group.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.append(group, clone);
  track.classList.add('is-marquee');
  const setSpeed = () => track.style.setProperty('--marquee-duration', `${Math.max(14, group.offsetWidth / 48)}s`);
  setSpeed();
  window.addEventListener('resize', setSpeed);
}

// ---------- Indicador deslizante para pestañas ----------
export function attachIndicator(container, buttonSelector) {
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
  document.fonts?.ready?.then(() => move(false));
  return { move };
}

// ---------- Guía de curado: tabs ARIA con flechas del teclado ----------
export function initCuringGuide() {
  const tabs = Array.from(document.querySelectorAll('.guide-tabs [role="tab"]'));
  if (tabs.length < 2) return;
  const indicator = attachIndicator(document.querySelector('.guide-tabs'), '.guide-tab-btn');

  const select = (tab, { focus = false } = {}) => {
    tabs.forEach((t) => {
      const on = t === tab;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (panel) {
        panel.classList.toggle('active', on);
        panel.hidden = !on;
        panel.classList.remove('panel-enter');
        if (on) { void panel.offsetWidth; panel.classList.add('panel-enter'); }
      }
    });
    if (focus) tab.focus();
    indicator?.move();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => { if (!tab.classList.contains('active')) select(tab); });
    tab.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (dir) { e.preventDefault(); select(tabs[(i + dir + tabs.length) % tabs.length], { focus: true }); }
      if (e.key === 'Home') { e.preventDefault(); select(tabs[0], { focus: true }); }
      if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], { focus: true }); }
    });
  });
  select(tabs.find((t) => t.classList.contains('active')) ?? tabs[0]);
}

// ---------- FAQ: acordeón con botones reales ----------
export function initFaq() {
  const items = Array.from(document.querySelectorAll('.faq-item'));
  const setExpanded = (item, expanded) => {
    item.classList.toggle('open', expanded);
    item.querySelector('.faq-trigger')?.setAttribute('aria-expanded', String(expanded));
  };
  items.forEach((item, idx) => {
    const trigger = item.querySelector('.faq-trigger');
    const content = item.querySelector('.faq-content');
    if (!trigger || !content) return;
    content.id ||= `faq-panel-${idx}`;
    trigger.setAttribute('aria-controls', content.id);
    trigger.setAttribute('aria-expanded', String(item.classList.contains('open')));
    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach((i) => setExpanded(i, false));
      if (!isOpen) setExpanded(item, true);
    });
  });
}

// ---------- Prueba social (decorativa: oculta para lectores de pantalla) ----------
const RECENT_SALES = [
  { name: 'Lucas G.', city: 'Rosario, Santa Fe', product: 'Mate Imperial Negro Azabache', image: 'assets/images/mate-imperial-negro.jpg', time: 'Hace 4 minutos' },
  { name: 'Florencia M.', city: 'Córdoba Capital', product: 'Termo 3 Estrellas Campeones', image: 'assets/images/termo-campeones-del-mundo-afa.jpg', time: 'Hace 8 minutos' },
  { name: 'Martín B.', city: 'Palermo, CABA', product: 'Mate Camionero Algarrobo', image: 'assets/images/mate-camionero-algarrobo.jpg', time: 'Hace 12 minutos' },
  { name: 'Camila R.', city: 'Mendoza', product: 'Termo Driven Desert Sand 1L', image: 'assets/images/termo-driven-desert-sand.jpg', time: 'Hace 19 minutos' },
  { name: 'Gonzalo P.', city: 'Salta', product: 'Combo Ritual Lavaditos Completo', image: 'assets/images/experiencia-cebado-ritual.jpg', time: 'Hace 23 minutos' }
];

export function initSocialProof() {
  const toast = document.getElementById('socialProofToast');
  if (!toast) return;
  let index = 0;
  const show = () => {
    // No interrumpir mientras el usuario está en un diálogo o en el carrito
    if (!document.body.classList.contains('no-scroll')) {
      const sale = RECENT_SALES[index];
      toast.innerHTML = `
        <img src="${sale.image}" alt="" class="toast-img" />
        <div class="toast-text">
          <strong>${sale.name}</strong> (${sale.city})<br>
          compró <em>${sale.product}</em>
          <div class="toast-time">${sale.time}</div>
        </div>`;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 4500);
      index = (index + 1) % RECENT_SALES.length;
    }
  };
  setTimeout(() => { show(); setInterval(show, 14000); }, 4000);
}
