/**
 * Micro-interacciones compartidas. Todas respetan `prefers-reduced-motion`
 * y degradan a un cambio instantáneo cuando la animación no es posible.
 */

export const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const hasFinePointer = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Anima un número hacia su nuevo valor (la primera vez se asigna sin animar). */
export function tweenNumber(el, to, format, duration = 750) {
  if (!el) return;
  if (el.dataset.value === undefined || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
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

/** Cambia el texto y marca el cambio con un destello breve. */
export function setText(el, text) {
  if (!el || el.textContent === text) return;
  const hadValue = el.dataset.ready === '1';
  el.textContent = text;
  el.dataset.ready = '1';
  if (hadValue && !prefersReducedMotion()) restartClass(el, 'flash');
}

export function restartClass(el, className) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

/** Parte un texto en palabras enmascaradas (conserva elementos internos como .gold-text). */
export function splitWords(el) {
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
  // El texto partido se lee palabra por palabra en algunos lectores: se conserva el original
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  Array.from(el.children).forEach((c) => c.setAttribute('aria-hidden', 'true'));
  walk(el);
  el.querySelectorAll('.w').forEach((w) => w.setAttribute('aria-hidden', 'true'));
  el.classList.add('is-split');
}

/** Rebote del icono/contador del carrito. */
export function bumpCart(root = document) {
  [root.getElementById('navCartCount'), root.getElementById('btnNavCart')].forEach((el) => restartClass(el, 'bump'));
}

/** El producto "vuela" hasta el carrito antes de sumarse. */
export function flyToCart(sourceImg, onDone) {
  const cartBtn = document.getElementById('btnNavCart');
  if (prefersReducedMotion() || !sourceImg || !cartBtn || !sourceImg.getBoundingClientRect().width || typeof sourceImg.animate !== 'function') {
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

/** Colapsa un elemento (altura real -> 0) y luego ejecuta `done`. */
export function collapse(el, done, duration = 340) {
  if (!el || prefersReducedMotion()) { done(); return; }
  el.style.height = `${el.offsetHeight}px`;
  void el.offsetHeight;
  el.classList.add('is-leaving');
  setTimeout(done, duration);
}
