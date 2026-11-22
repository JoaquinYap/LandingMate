/**
 * "Armá tu set": grupos de opciones (botones con aria-pressed) + resumen con precio animado.
 */
import { computeCustomKit } from '../store/customizer.js';
import { formatPrice } from '../lib/format.js';
import { setText, tweenNumber } from './motion.js';

export function mountCustomizer({ root = document, products, onAddKit = () => {} }) {
  const $ = (id) => root.getElementById(id);
  const state = { mateId: 'mate-imperial-negro', termoId: 'termo-driven-negro', bombillaId: 'pico-loro', engraving: '' };
  const groups = [
    { selector: '.cust-mate-opt', key: 'mateId' },
    { selector: '.cust-termo-opt', key: 'termoId' },
    { selector: '.cust-bombilla-opt', key: 'bombillaId' }
  ];

  function update() {
    const kit = computeCustomKit(state, products);
    if (!kit) return null;
    setText($('custSummaryMate'), kit.mate.name);
    setText($('custSummaryMatePrice'), formatPrice(kit.mate.price));
    setText($('custSummaryTermo'), kit.termo.name);
    setText($('custSummaryTermoPrice'), formatPrice(kit.termo.price));
    setText($('custSummaryBombilla'), kit.bombilla.name);
    setText($('custSummaryBombillaPrice'), formatPrice(kit.bombilla.price));
    setText($('custSummaryEngraving'), kit.engraving ? `"${kit.engraving}" (¡Sin cargo!)` : 'Sin grabado adicional');
    tweenNumber($('custSummaryTotal'), kit.finalPrice, (v) => formatPrice(Math.round(v)), 650);
    setText($('custSummarySavings'), `Ahorro del 15% aplicado: -${formatPrice(kit.savings)}`);
    return kit;
  }

  groups.forEach(({ selector, key }) => {
    const options = Array.from(root.querySelectorAll(selector));
    options.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.id === state[key]));
      btn.classList.toggle('selected', btn.dataset.id === state[key]);
      btn.addEventListener('click', () => {
        state[key] = btn.dataset.id;
        options.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('selected', on);
          b.setAttribute('aria-pressed', String(on));
        });
        update();
      });
    });
  });

  $('customizerEngravingInput')?.addEventListener('input', (e) => {
    state.engraving = e.target.value;
    update();
  });

  $('btnAddCustomKit')?.addEventListener('click', (event) => {
    const kit = computeCustomKit(state, products);
    if (!kit) return;
    const thumb = root.querySelector('.cust-mate-opt.selected .option-thumb');
    onAddKit(kit, { image: thumb, button: event.currentTarget });
  });

  update();
  return { getState: () => ({ ...state }), update };
}
