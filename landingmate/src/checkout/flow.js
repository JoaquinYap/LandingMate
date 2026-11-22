/**
 * Máquina de estados del checkout: pasos, validación por paso, navegación permitida
 * y persistencia en sessionStorage (para no perder lo cargado si se recarga la página).
 *
 * Los datos sensibles de la tarjeta (número y CVV) se mantienen solo en memoria.
 */
import { readJSON, writeJSON, removeKey } from '../lib/storage.js';
import { validateContact, validateShipping, validatePayment, validateReview } from './validation.js';

export const STEPS = Object.freeze([
  { id: 'contacto', label: 'Contacto' },
  { id: 'envio', label: 'Envío' },
  { id: 'pago', label: 'Pago' },
  { id: 'revision', label: 'Confirmación' }
]);

export const CHECKOUT_STORAGE_KEY = 'lavaditos_checkout';
const SENSITIVE_FIELDS = ['cardNumber', 'cvv'];

const initialData = () => ({
  contacto: { email: '', fullName: '', phone: '', dni: '' },
  envio: { method: 'andreani', street: '', number: '', apartment: '', city: '', province: '', postalCode: '' },
  pago: { method: 'tarjeta', cardNumber: '', cardName: '', expiry: '', cvv: '', installments: 1 },
  revision: { acceptTerms: false }
});

export function createCheckoutFlow({ storage = null, now = () => new Date() } = {}) {
  const validators = {
    contacto: validateContact,
    envio: validateShipping,
    pago: (data) => validatePayment(data, now()),
    revision: validateReview
  };
  const stepIds = STEPS.map((s) => s.id);
  let state = { step: 'contacto', completed: [], data: initialData(), couponCode: '' };

  if (storage) {
    const saved = readJSON(storage, CHECKOUT_STORAGE_KEY, null);
    if (saved && typeof saved === 'object' && saved.data) {
      const base = initialData();
      const data = Object.fromEntries(stepIds.map((id) => [id, { ...base[id], ...(saved.data[id] ?? {}) }]));
      const completed = Array.isArray(saved.completed) ? saved.completed.filter((id) => stepIds.includes(id) && id !== 'pago' && id !== 'revision') : [];
      state = {
        data,
        completed,
        couponCode: typeof saved.couponCode === 'string' ? saved.couponCode : '',
        // El pago nunca se restaura completo: si estaba en "revisión", vuelve a "pago"
        step: 'contacto'
      };
      state.step = firstIncomplete();
    }
  }

  function firstIncomplete() {
    return stepIds.find((id) => !state.completed.includes(id)) ?? 'revision';
  }

  function persist() {
    if (!storage) return;
    const safePago = { ...state.data.pago };
    SENSITIVE_FIELDS.forEach((f) => { safePago[f] = ''; });
    writeJSON(storage, CHECKOUT_STORAGE_KEY, {
      data: { ...state.data, pago: safePago },
      completed: state.completed,
      couponCode: state.couponCode
    });
  }

  function update(stepId, partial) {
    if (!stepIds.includes(stepId)) return;
    state.data[stepId] = { ...state.data[stepId], ...partial };
    persist();
  }

  function validate(stepId = state.step) {
    return validators[stepId](state.data[stepId]);
  }

  /** Valida el paso actual; si está ok lo marca completo y avanza. */
  function submit() {
    const errors = validate();
    if (Object.keys(errors).length) return { ok: false, errors };
    if (!state.completed.includes(state.step)) state.completed.push(state.step);
    const idx = stepIds.indexOf(state.step);
    if (idx < stepIds.length - 1) state.step = stepIds[idx + 1];
    persist();
    return { ok: true, errors: {}, step: state.step };
  }

  /** Se puede ir a cualquier paso ya completado o al primero pendiente. */
  function canGoTo(stepId) {
    const target = stepIds.indexOf(stepId);
    if (target === -1) return false;
    return target <= stepIds.indexOf(firstIncomplete());
  }

  function goTo(stepId) {
    if (!canGoTo(stepId)) return false;
    state.step = stepId;
    persist();
    return true;
  }

  function back() {
    const idx = stepIds.indexOf(state.step);
    if (idx === 0) return false;
    state.step = stepIds[idx - 1];
    persist();
    return true;
  }

  /** Invalida un paso (p. ej. cuando el pago es rechazado) para obligar a revisarlo. */
  function invalidate(stepId) {
    state.completed = state.completed.filter((id) => stepIds.indexOf(id) < stepIds.indexOf(stepId));
    persist();
  }

  function setCoupon(code) {
    state.couponCode = code;
    persist();
  }

  function reset() {
    state = { step: 'contacto', completed: [], data: initialData(), couponCode: '' };
    if (storage) removeKey(storage, CHECKOUT_STORAGE_KEY);
  }

  return {
    update,
    validate,
    submit,
    canGoTo,
    goTo,
    back,
    invalidate,
    setCoupon,
    reset,
    get step() { return state.step; },
    get stepIndex() { return stepIds.indexOf(state.step); },
    get completed() { return [...state.completed]; },
    get couponCode() { return state.couponCode; },
    getData: (stepId) => ({ ...state.data[stepId] }),
    isComplete: (stepId) => state.completed.includes(stepId)
  };
}
