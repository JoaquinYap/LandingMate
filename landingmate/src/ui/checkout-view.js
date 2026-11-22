/**
 * Vista del checkout: stepper, formularios por paso con errores accesibles,
 * resumen con cupones/envío/descuentos y confirmación del pedido.
 */
import { STEPS } from '../checkout/flow.js';
import { PAYMENT_METHODS, SHIPPING_METHODS, computeTotals, validateCoupon } from '../checkout/pricing.js';
import { CARD_BRAND_LABELS, detectCardBrand, formatCardNumber, formatExpiry } from '../checkout/validation.js';
import { BANK_TRANSFER_DETAILS, PaymentError, createOrder } from '../checkout/payment.js';
import { escapeHtml, formatPrice, plural } from '../lib/format.js';

export function mountCheckout({
  root = document,
  cart,
  flow,
  processPayment,
  saveOrder = () => {},
  loadOrder = () => null,
  announce = () => {},
  now = () => new Date(),
  random = Math.random,
  location = window.location,
  history = window.history
}) {
  const $ = (id) => root.getElementById(id);
  const app = $('checkoutApp');
  const empty = $('checkoutEmpty');
  const confirmation = $('checkoutConfirmation');
  const stepsNav = $('checkoutSteps');
  const forms = Object.fromEntries(STEPS.map((s) => [s.id, $(`step-${s.id}`)]));
  const placeOrderBtn = $('btnPlaceOrder');
  const paymentError = $('paymentError');
  let processing = false;

  // ---------------------------------------------------------------- helpers
  const subtotal = () => cart.subtotal();
  const shippingKnown = () => flow.stepIndex >= 1 || flow.isComplete('envio');

  function totals() {
    const pago = flow.getData('pago');
    return computeTotals({
      subtotal: subtotal(),
      shippingMethod: shippingKnown() ? flow.getData('envio').method : null,
      paymentMethod: flow.isComplete('pago') || flow.step === 'pago' ? pago.method : 'tarjeta',
      couponCode: flow.couponCode,
      installments: pago.installments
    });
  }

  function readForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (form.dataset.step === 'pago' && 'installments' in data) data.installments = Number(data.installments);
    if (form.dataset.step === 'revision') data.acceptTerms = form.elements.acceptTerms.checked;
    return data;
  }

  function fillForm(stepId) {
    const form = forms[stepId];
    const data = flow.getData(stepId);
    Object.entries(data).forEach(([name, value]) => {
      const field = form.elements[name];
      if (!field) return;
      if (field instanceof RadioNodeList) {
        Array.from(field).forEach((r) => { r.checked = r.value === value; });
      } else if (field.type === 'checkbox') {
        field.checked = Boolean(value);
      } else if (!field.value || stepId !== 'pago') {
        field.value = value ?? '';
      }
    });
  }

  // --------------------------------------------------------------- errores
  function clearErrors(form) {
    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
    form.querySelectorAll('.field-error').forEach((el) => { el.hidden = true; el.textContent = ''; });
  }

  function showErrors(form, errors) {
    clearErrors(form);
    const stepId = form.dataset.step;
    let first = null;
    Object.entries(errors).forEach(([name, message]) => {
      const errorId = name === 'method' ? `method-${stepId}-error` : `${name}-error`;
      const errorEl = root.getElementById(errorId);
      if (errorEl) { errorEl.textContent = message; errorEl.hidden = false; }
      const field = form.elements[name];
      const input = field instanceof RadioNodeList ? field[0] : field;
      if (input) {
        if (!(field instanceof RadioNodeList)) input.setAttribute('aria-invalid', 'true');
        first ??= input;
      }
    });
    const count = Object.keys(errors).length;
    announce(`Revisá ${plural(count, 'campo', 'campos')} con errores.`);
    first?.focus();
  }

  // Al corregir un campo se limpia su error
  Object.values(forms).forEach((form) => {
    form?.addEventListener('input', (e) => {
      const el = e.target;
      if (el.getAttribute('aria-invalid') !== 'true') return;
      el.removeAttribute('aria-invalid');
      const err = root.getElementById(`${el.name}-error`);
      if (err) { err.hidden = true; err.textContent = ''; }
    });
  });

  // ---------------------------------------------------------------- stepper
  function renderSteps() {
    stepsNav.innerHTML = STEPS.map((step, i) => {
      const current = step.id === flow.step;
      const done = flow.isComplete(step.id) && !current;
      const reachable = flow.canGoTo(step.id) && !current;
      const label = `<span class="step-index" aria-hidden="true">${done ? '✓' : i + 1}</span><span class="step-name">${step.label}</span>`;
      const status = current ? '(paso actual)' : done ? '(completado)' : '';
      const inner = reachable
        ? `<button type="button" class="step-link" data-goto="${step.id}">${label} <span class="sr-only">${status}</span></button>`
        : `<span class="step-link"${current ? ' aria-current="step"' : ''}>${label} <span class="sr-only">${status}</span></span>`;
      return `<li class="checkout-step-item${current ? ' is-current' : ''}${done ? ' is-done' : ''}">${inner}</li>`;
    }).join('');
  }

  stepsNav?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (btn && flow.goTo(btn.dataset.goto)) showStep({ focus: true });
  });

  function showStep({ focus = false } = {}) {
    STEPS.forEach(({ id }) => { if (forms[id]) forms[id].hidden = id !== flow.step; });
    fillForm(flow.step);
    if (flow.step === 'envio') syncShippingUi();
    if (flow.step === 'pago') syncPaymentUi();
    if (flow.step === 'revision') renderReview();
    renderSteps();
    renderSummary();
    if (focus) root.getElementById(`step-${flow.step}-title`)?.focus();
  }

  // ------------------------------------------------------------------ envío
  function syncShippingUi() {
    const form = forms.envio;
    const method = form.elements.method.value || 'andreani';
    const fieldset = $('addressFields');
    const needsAddress = SHIPPING_METHODS[method]?.needsAddress;
    fieldset.disabled = !needsAddress;
    fieldset.hidden = !needsAddress;
    form.querySelectorAll('[data-shipping-price]').forEach((el) => {
      const t = computeTotals({ subtotal: subtotal(), shippingMethod: el.dataset.shippingPrice });
      el.textContent = t.shipping === 0 ? 'Gratis' : formatPrice(t.shipping);
      el.classList.toggle('is-free', t.shipping === 0);
    });
  }

  forms.envio?.addEventListener('change', (e) => {
    if (e.target.name !== 'method') return;
    flow.update('envio', { method: e.target.value });
    syncShippingUi();
    renderSummary();
  });

  // ------------------------------------------------------------------- pago
  function renderInstallments() {
    const select = $('installments');
    if (!select) return;
    const selected = Number(select.value || flow.getData('pago').installments || 1);
    const base = computeTotals({ ...totalsInput(), paymentMethod: 'tarjeta', installments: 1 }).total;
    select.innerHTML = PAYMENT_METHODS.tarjeta.installments.map((n) => {
      const text = n === 1 ? `1 pago de ${formatPrice(base)}` : `${n} cuotas sin interés de ${formatPrice(Math.round(base / n))}`;
      return `<option value="${n}"${n === selected ? ' selected' : ''}>${text}</option>`;
    }).join('');
  }

  const totalsInput = () => ({
    subtotal: subtotal(),
    shippingMethod: shippingKnown() ? flow.getData('envio').method : null,
    couponCode: flow.couponCode
  });

  function syncPaymentUi() {
    const form = forms.pago;
    const method = form.elements.method.value || 'tarjeta';
    const card = $('cardFields');
    card.disabled = method !== 'tarjeta';
    card.hidden = method !== 'tarjeta';
    $('transferInfo').hidden = method !== 'transferencia';
    $('mercadopagoInfo').hidden = method !== 'mercadopago';
    renderInstallments();
    updateCardBrand();
  }

  function updateCardBrand() {
    const input = $('cardNumber');
    const badge = $('cardBrand');
    if (!input || !badge) return;
    const brand = detectCardBrand(input.value);
    badge.textContent = brand ? CARD_BRAND_LABELS[brand] : '';
    badge.dataset.brand = brand ?? '';
  }

  forms.pago?.addEventListener('change', (e) => {
    if (e.target.name === 'method') {
      flow.update('pago', { method: e.target.value });
      syncPaymentUi();
      renderSummary();
    } else if (e.target.name === 'installments') {
      flow.update('pago', { installments: Number(e.target.value) });
      renderSummary();
    }
  });

  $('cardNumber')?.addEventListener('input', (e) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted !== e.target.value) e.target.value = formatted;
    updateCardBrand();
  });
  $('expiry')?.addEventListener('input', (e) => {
    // Solo se formatea al escribir (no al borrar) para no trabar el backspace en la barra
    if (e.inputType && e.inputType.startsWith('delete')) return;
    const formatted = formatExpiry(e.target.value);
    if (formatted !== e.target.value) e.target.value = formatted;
  });

  // ---------------------------------------------------------------- revisión
  function renderReview() {
    const contacto = flow.getData('contacto');
    const envio = flow.getData('envio');
    const pago = flow.getData('pago');
    const t = totals();
    const ship = SHIPPING_METHODS[envio.method];
    const address = ship?.needsAddress
      ? `${escapeHtml(envio.street)} ${escapeHtml(envio.number)}${envio.apartment ? `, ${escapeHtml(envio.apartment)}` : ''} · ${escapeHtml(envio.city)}, ${escapeHtml(envio.province)} (${escapeHtml(envio.postalCode)})`
      : 'Palermo Soho, CABA · Te avisamos por email cuando esté listo';
    let payText = escapeHtml(PAYMENT_METHODS[pago.method]?.label ?? '');
    if (pago.method === 'tarjeta') {
      const digits = String(pago.cardNumber).replace(/\D/g, '');
      const brand = CARD_BRAND_LABELS[detectCardBrand(digits)] ?? 'Tarjeta';
      payText = `${brand} terminada en ${digits.slice(-4)} · ${t.installments.count === 1 ? '1 pago' : `${t.installments.count} cuotas de ${formatPrice(t.installments.amount)}`}`;
    }
    const row = (step, title, body) => `
      <div class="review-row">
        <dt>${title}</dt>
        <dd>${body}</dd>
        <dd class="review-edit"><button type="button" class="btn-link" data-edit="${step}">Editar <span class="sr-only">${title.toLowerCase()}</span></button></dd>
      </div>`;
    $('reviewSummary').innerHTML = [
      row('contacto', 'Contacto', `${escapeHtml(contacto.fullName)}<br>${escapeHtml(contacto.email)} · ${escapeHtml(contacto.phone)}`),
      row('envio', 'Envío', `${escapeHtml(ship?.label ?? '')}<br>${address}`),
      row('pago', 'Pago', payText)
    ].join('');
    const label = placeOrderBtn?.querySelector('.btn-label');
    if (label && !processing) label.textContent = `Confirmar y pagar ${formatPrice(t.total)}`;
  }

  $('reviewSummary')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit]');
    if (btn && flow.goTo(btn.dataset.edit)) showStep({ focus: true });
  });

  // ---------------------------------------------------------------- resumen
  function renderSummary() {
    const items = cart.getItems();
    const t = totals();
    $('summaryItems').innerHTML = items.map((item) => `
      <li class="summary-line">
        <span class="summary-thumb"><img src="${escapeHtml(item.image)}" alt="" width="56" height="56"><span class="summary-qty" aria-hidden="true">${item.quantity}</span></span>
        <span class="summary-line-info">
          <span class="summary-line-name">${escapeHtml(item.name)}</span>
          <span class="summary-line-meta">${plural(item.quantity, 'unidad', 'unidades')}${item.engraving ? ` · Grabado: "${escapeHtml(item.engraving)}"` : ''}</span>
        </span>
        <span class="summary-line-price">${formatPrice(item.price * item.quantity)}</span>
      </li>`).join('');

    const rows = [`<div class="summary-row"><dt>Subtotal</dt><dd>${formatPrice(t.subtotal)}</dd></div>`];
    if (t.coupon) {
      rows.push(`<div class="summary-row is-discount"><dt>Cupón ${escapeHtml(t.coupon.code)} <button type="button" class="btn-link btn-remove-coupon" data-remove-coupon>Quitar <span class="sr-only">cupón</span></button></dt><dd>−${formatPrice(t.couponDiscount)}</dd></div>`);
    }
    if (t.paymentDiscount) rows.push(`<div class="summary-row is-discount"><dt>10% OFF transferencia</dt><dd>−${formatPrice(t.paymentDiscount)}</dd></div>`);
    rows.push(`<div class="summary-row"><dt>Envío</dt><dd>${t.shipping === null ? 'Se calcula en el paso 2' : t.shipping === 0 ? '<span class="is-free">Gratis</span>' : formatPrice(t.shipping)}</dd></div>`);
    rows.push(`<div class="summary-row summary-row--total"><dt>Total</dt><dd data-testid="order-total">${formatPrice(t.total)}</dd></div>`);
    if (t.installments.count > 1) rows.push(`<div class="summary-row summary-row--note"><dt class="sr-only">Cuotas</dt><dd>${t.installments.count} cuotas sin interés de ${formatPrice(t.installments.amount)}</dd></div>`);
    $('summaryTotals').innerHTML = rows.join('');
    $('summaryToggleTotal').textContent = formatPrice(t.total);
    if (flow.step === 'revision') renderReview();
    if (flow.step === 'pago') renderInstallments();
  }

  // ----------------------------------------------------------------- cupones
  const couponInput = $('couponInput');
  const couponMessage = $('couponMessage');
  function setCouponMessage(text, kind) {
    couponMessage.textContent = text;
    couponMessage.className = `coupon-message${kind ? ` is-${kind}` : ''}`;
    if (kind === 'error') couponInput.setAttribute('aria-invalid', 'true');
    else couponInput.removeAttribute('aria-invalid');
  }

  $('couponForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = validateCoupon(couponInput.value, subtotal());
    if (!result.ok) { setCouponMessage(result.error, 'error'); couponInput.focus(); return; }
    flow.setCoupon(result.coupon.code);
    couponInput.value = '';
    renderSummary();
    setCouponMessage(`Cupón ${result.coupon.code} aplicado: ${result.coupon.label}.`, 'success');
  });

  $('summaryTotals')?.addEventListener('click', (e) => {
    if (!e.target.closest('[data-remove-coupon]')) return;
    flow.setCoupon('');
    renderSummary();
    setCouponMessage('Quitamos el cupón.', null);
    couponInput.focus();
  });

  // ------------------------------------------------------------ navegación
  root.querySelectorAll('[data-back]').forEach((btn) => btn.addEventListener('click', () => {
    if (flow.back()) showStep({ focus: true });
  }));

  Object.values(forms).forEach((form) => {
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (processing) return;
      const stepId = form.dataset.step;
      flow.update(stepId, readForm(form));
      if (stepId === 'revision') { await placeOrder(); return; }
      const result = flow.submit();
      if (!result.ok) { showErrors(form, result.errors); return; }
      clearErrors(form);
      showStep({ focus: true });
    });
  });

  // ------------------------------------------------------------------ pedido
  function setProcessing(on) {
    processing = on;
    if (!placeOrderBtn) return;
    placeOrderBtn.disabled = on;
    placeOrderBtn.setAttribute('aria-busy', String(on));
    const label = placeOrderBtn.querySelector('.btn-label');
    if (on && label) label.textContent = 'Procesando pago…';
  }

  async function placeOrder() {
    const result = flow.submit();
    if (!result.ok) { showErrors(forms.revision, result.errors); return; }

    // Defensa: si algún paso anterior quedó inválido (p. ej. tras recargar), se vuelve a él
    const broken = STEPS.slice(0, 3).find(({ id }) => Object.keys(flow.validate(id)).length);
    if (broken) {
      flow.goTo(broken.id);
      showStep({ focus: true });
      showErrors(forms[broken.id], flow.validate(broken.id));
      return;
    }

    paymentError.hidden = true;
    setProcessing(true);
    announce('Procesando el pago, aguardá un momento.');
    const t = totals();
    const pago = flow.getData('pago');
    try {
      const payment = await processPayment({ ...pago, amount: t.total });
      const order = createOrder({
        items: cart.getItems(),
        contact: flow.getData('contacto'),
        shipping: flow.getData('envio'),
        payment: pago,
        totals: t,
        result: payment,
        now: now(),
        random
      });
      saveOrder(order);
      cart.clear();
      flow.reset();
      history.replaceState(history.state, '', `${location.pathname}?pedido=${encodeURIComponent(order.id)}`);
      renderConfirmation(order, { focus: true });
    } catch (err) {
      const message = err instanceof PaymentError ? err.message : 'No pudimos procesar el pago. Probá de nuevo en unos minutos.';
      paymentError.innerHTML = `<p>${escapeHtml(message)}</p><button type="button" class="btn-link" data-edit-payment>Cambiar medio de pago</button>`;
      paymentError.hidden = false;
      setProcessing(false);
      renderReview();
    }
  }

  paymentError?.addEventListener('click', (e) => {
    if (!e.target.closest('[data-edit-payment]')) return;
    paymentError.hidden = true;
    flow.goTo('pago');
    showStep({ focus: true });
  });

  // ------------------------------------------------------------ confirmación
  function renderConfirmation(order, { focus = false } = {}) {
    app.hidden = true;
    empty.hidden = true;
    root.querySelector('.demo-banner')?.setAttribute('hidden', '');
    const firstName = order.contact.fullName.split(' ')[0];
    const pending = order.status === 'pending';
    const t = order.totals;
    confirmation.innerHTML = `
      <div class="confirmation-icon" aria-hidden="true">${pending ? '⏳' : '✓'}</div>
      <h2 class="confirmation-title" id="confirmationTitle" tabindex="-1">¡Gracias por tu compra, ${escapeHtml(firstName)}!</h2>
      <p class="confirmation-lead">
        ${pending ? 'Reservamos tu pedido. Lo despachamos apenas se acredite la transferencia.' : 'Tu pago fue aprobado y ya estamos preparando tu pedido.'}
        Te enviamos el detalle a <strong>${escapeHtml(order.contact.email)}</strong>.
      </p>
      <p class="confirmation-order">Número de pedido: <strong data-testid="order-id">${escapeHtml(order.id)}</strong></p>
      ${pending ? `
      <div class="info-box confirmation-transfer">
        <h3>Datos para la transferencia</h3>
        <dl>
          <div><dt>Titular</dt><dd>${BANK_TRANSFER_DETAILS.holder}</dd></div>
          <div><dt>Alias</dt><dd>${BANK_TRANSFER_DETAILS.alias}</dd></div>
          <div><dt>CBU</dt><dd>${BANK_TRANSFER_DETAILS.cbu}</dd></div>
          <div><dt>Importe</dt><dd>${formatPrice(t.total)}</dd></div>
        </dl>
        <p>Tenés ${BANK_TRANSFER_DETAILS.expiresInHours} hs para transferir. Indicá el número de pedido en el concepto.</p>
      </div>` : ''}
      <div class="confirmation-grid">
        <section aria-labelledby="confItemsTitle">
          <h3 id="confItemsTitle">Tu pedido</h3>
          <ul class="summary-items">
            ${order.items.map((i) => `<li class="summary-line"><span class="summary-line-info"><span class="summary-line-name">${escapeHtml(i.name)}</span><span class="summary-line-meta">${plural(i.quantity, 'unidad', 'unidades')}${i.engraving ? ` · Grabado: "${escapeHtml(i.engraving)}"` : ''}</span></span><span class="summary-line-price">${formatPrice(i.price * i.quantity)}</span></li>`).join('')}
          </ul>
          <dl class="summary-totals">
            <div class="summary-row"><dt>Subtotal</dt><dd>${formatPrice(t.subtotal)}</dd></div>
            ${t.couponDiscount ? `<div class="summary-row is-discount"><dt>Cupón ${escapeHtml(t.couponCode)}</dt><dd>−${formatPrice(t.couponDiscount)}</dd></div>` : ''}
            ${t.paymentDiscount ? `<div class="summary-row is-discount"><dt>10% OFF transferencia</dt><dd>−${formatPrice(t.paymentDiscount)}</dd></div>` : ''}
            <div class="summary-row"><dt>Envío</dt><dd>${t.shipping ? formatPrice(t.shipping) : 'Gratis'}</dd></div>
            <div class="summary-row summary-row--total"><dt>Total</dt><dd>${formatPrice(t.total)}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="confShippingTitle">
          <h3 id="confShippingTitle">Entrega</h3>
          <p>${escapeHtml(order.shipping.label)}<br><span class="muted">${escapeHtml(order.shipping.eta)}</span></p>
          ${order.shipping.address ? `<p>${escapeHtml(order.shipping.address.street)} ${escapeHtml(order.shipping.address.number)}, ${escapeHtml(order.shipping.address.city)}, ${escapeHtml(order.shipping.address.province)}</p>` : ''}
          <h3>Pago</h3>
          <p>${order.payment.method === 'tarjeta' ? `${escapeHtml(order.payment.brandLabel)} terminada en ${escapeHtml(order.payment.last4)}` : escapeHtml(order.payment.label)}</p>
        </section>
      </div>
      <a href="index.html" class="btn-primary">Volver a la tienda</a>`;
    confirmation.hidden = false;
    document.title = `Pedido ${order.id} · Lavaditos`;
    if (focus) $('confirmationTitle').focus();
    announce(`Compra confirmada. Número de pedido ${order.id}.`);
  }

  // ----------------------------------------------------------------- inicio
  function start() {
    const orderParam = new URLSearchParams(location.search).get('pedido');
    const lastOrder = orderParam ? loadOrder() : null;
    if (lastOrder && lastOrder.id === orderParam) {
      renderConfirmation(lastOrder);
      return;
    }
    if (cart.isEmpty()) {
      app.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    app.hidden = false;
    // El código del cupón guardado se vuelve a validar contra el carrito actual
    if (flow.couponCode && !validateCoupon(flow.couponCode, subtotal()).ok) flow.setCoupon('');
    showStep();
  }

  // Si el carrito cambia en otra pestaña, se recalcula (o se muestra vacío)
  cart.subscribe(() => {
    if (!confirmation.hidden) return;
    if (cart.isEmpty()) { app.hidden = true; empty.hidden = false; return; }
    renderSummary();
  });

  start();
  return {
    showStep,
    renderSummary,
    get processing() { return processing; }
  };
}
