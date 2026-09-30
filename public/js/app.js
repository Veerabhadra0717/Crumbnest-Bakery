(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
  const FREE_DELIVERY_OVER = 1500;
  const DELIVERY_FEE = 60;

  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* empty body */ }
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  function setMsg(form, text, type) {
    const el = $('[data-msg]', form);
    if (!el) return;
    el.textContent = text;
    el.className = 'form-msg' + (type ? ' ' + type : '');
  }

  let toastTimer;
  function toast(html) {
    const t = $('.toast');
    t.innerHTML = html;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3500);
  }

  // ---------- Mobile menu ----------
  const toggle = $('.menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      $('#site-nav').classList.toggle('open', open);
    });
  }

  // ---------- Cart storage ----------
  const CART_KEY = 'crumbnest-cart';
  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (_) { return []; }
  }
  function setCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (_) { /* storage full or blocked */ }
    updateCount(true);
  }
  function updateCount(bump) {
    const n = getCart().reduce((a, i) => a + i.qty, 0);
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = n;
      if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
  }
  updateCount(false);

  // ---------- Quantity steppers ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-qty]');
    if (!b || b.closest('[data-cart-items]')) return;
    const input = $('input', b.parentElement);
    input.value = Math.min(10, Math.max(1, Number(input.value || 1) + Number(b.dataset.qty)));
  });

  // ---------- Add to cart ----------
  const buy = $('[data-buy]');
  if (buy) {
    buy.addEventListener('submit', (e) => {
      e.preventDefault();
      const size = $('input[name="size"]:checked', buy);
      const qty = Math.min(10, Math.max(1, parseInt($('input[name="qty"]', buy).value, 10) || 1));
      const cart = getCart();
      const existing = cart.find((i) => i.slug === buy.dataset.slug && i.size === size.value);
      if (existing) existing.qty = Math.min(10, existing.qty + qty);
      else cart.push({ slug: buy.dataset.slug, name: buy.dataset.name, size: size.value, price: Number(size.dataset.price), qty });
      setCart(cart);
      toast(`Added ${esc(buy.dataset.name)} (${esc(size.value)}) <a href="/cart">View cart</a>`);
    });
  }

  // ---------- Menu filters ----------
  $$('[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('[data-filter]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      const f = chip.dataset.filter;
      $$('[data-grid] .card').forEach((card) => (card.hidden = f !== 'All' && card.dataset.category !== f));
    });
  });

  // ---------- Reviews ----------
  const reviewForm = $('[data-review-form]');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', reviewForm);
      const fd = new FormData(reviewForm);
      btn.disabled = true;
      setMsg(reviewForm, 'Posting…');
      try {
        const r = await api('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({ product: reviewForm.dataset.slug, name: fd.get('name'), rating: Number(fd.get('rating')), text: fd.get('text') })
        });
        const list = $('[data-review-list]');
        const empty = $('[data-empty]', list);
        if (empty) empty.remove();
        const el = document.createElement('article');
        el.className = 'review new';
        el.innerHTML = `<span class="stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}<span class="stars-off">${'★'.repeat(5 - r.rating)}</span></span><p>${esc(r.text)}</p><p class="muted">${esc(r.name)}, just now</p>`;
        list.prepend(el);
        reviewForm.reset();
        setMsg(reviewForm, 'Thanks! Your review is live.', 'ok');
      } catch (err) {
        setMsg(reviewForm, err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------- Contact ----------
  const contactForm = $('[data-contact-form]');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', contactForm);
      btn.disabled = true;
      setMsg(contactForm, 'Sending…');
      try {
        await api('/api/contact', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(contactForm))) });
        contactForm.reset();
        setMsg(contactForm, 'Message sent. We\'ll reply within a few hours.', 'ok');
      } catch (err) {
        setMsg(contactForm, err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------- Cart page ----------
  const cartBox = $('[data-cart-items]');
  if (cartBox) {
    const orderForm = $('[data-order-form]');
    const totalsBox = $('[data-totals]');
    let catalogue = [];

    const dateInput = $('input[name="deliveryDate"]', orderForm);
    const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const now = new Date();
    dateInput.min = iso(now);
    dateInput.max = iso(new Date(now.getTime() + 30 * 86400000));
    dateInput.value = now.getHours() < 12 ? iso(now) : iso(new Date(now.getTime() + 86400000));

    const thumb = (c) => `<svg viewBox="30 80 330 220" aria-hidden="true"><path d="M60 150 L340 110 L340 270 L60 285 Z" fill="${c.sponge}"/><path d="M60 197 L340 165 L340 181 L60 213 Z" fill="${c.cream}"/><path d="M60 243 L340 213 L340 229 L60 259 Z" fill="${c.cream}"/><path d="M60 150 L340 110 L318 90 L38 130 Z" fill="${c.top}"/></svg>`;

    function render() {
      // Keep only items that still exist on the menu, with current prices.
      const cart = getCart()
        .map((i) => {
          const p = catalogue.find((x) => x.slug === i.slug);
          const s = p && p.sizes.find((x) => x.label === i.size);
          return p && s ? { ...i, name: p.name, price: s.price, colors: p.colors } : null;
        })
        .filter(Boolean);

      if (!cart.length) {
        cartBox.innerHTML = '<div class="empty"><h2>Your cart is empty</h2><p class="muted">Add a cake and it will show up here.</p><a class="btn" href="/cakes">Browse cakes</a></div>';
        totalsBox.innerHTML = '';
        orderForm.hidden = true;
        return;
      }
      orderForm.hidden = false;
      cartBox.innerHTML = cart
        .map(
          (i, idx) => `<div class="cart-row">
          <div class="thumb" style="background:color-mix(in srgb, ${i.colors.sponge} 16%, var(--page))">${thumb(i.colors)}</div>
          <div><h3><a href="/cakes/${esc(i.slug)}">${esc(i.name)}</a></h3><p class="muted small" style="margin:0">${esc(i.size)}, ${money(i.price)} each</p>
            <div class="qty"><button type="button" data-step="-1" data-i="${idx}" aria-label="Decrease">−</button><input value="${i.qty}" readonly aria-label="Quantity"><button type="button" data-step="1" data-i="${idx}" aria-label="Increase">+</button></div></div>
          <div class="cart-side"><strong>${money(i.price * i.qty)}</strong><button class="link-btn" type="button" data-remove="${idx}">Remove</button></div>
        </div>`
        )
        .join('');
      const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
      const fee = subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
      totalsBox.innerHTML = `<div><span>Subtotal</span><span>${money(subtotal)}</span></div>
        <div><span>Delivery</span><span>${fee ? money(fee) : 'Free'}</span></div>
        ${fee ? `<p class="muted small" style="margin:0">Add ${money(FREE_DELIVERY_OVER - subtotal)} more for free delivery.</p>` : ''}
        <div class="grand"><span>Total</span><span>${money(subtotal + fee)}</span></div>`;
      try { localStorage.setItem(CART_KEY, JSON.stringify(cart.map(({ colors, ...rest }) => rest))); } catch (_) {}
      updateCount(false);
    }

    cartBox.addEventListener('click', (e) => {
      const cart = getCart();
      const step = e.target.closest('[data-step]');
      const rm = e.target.closest('[data-remove]');
      if (step) {
        const item = cart[Number(step.dataset.i)];
        item.qty = Math.min(10, Math.max(1, item.qty + Number(step.dataset.step)));
      } else if (rm) {
        cart.splice(Number(rm.dataset.remove), 1);
      } else return;
      setCart(cart);
      render();
    });

    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', orderForm);
      btn.disabled = true;
      setMsg(orderForm, 'Placing your order…');
      try {
        const body = { ...Object.fromEntries(new FormData(orderForm)), items: getCart().map(({ slug, size, qty }) => ({ slug, size, qty })) };
        const order = await api('/api/orders', { method: 'POST', body: JSON.stringify(body) });
        setCart([]);
        $('[data-checkout]').hidden = true;
        const c = $('[data-confirm]');
        c.hidden = false;
        c.innerHTML = `<h2>Order placed. Thank you!</h2><p class="muted">Your order ID</p><p class="order-id">${esc(order.id)}</p>
          <p>Total ${money(order.total)}, delivering on ${new Date(order.deliveryDate + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}. Save your order ID to track it.</p>
          <a class="btn" href="/track?id=${encodeURIComponent(order.id)}">Track this order</a>`;
        window.scrollTo({ top: 0 });
      } catch (err) {
        setMsg(orderForm, err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    api('/api/products')
      .then((p) => { catalogue = p; render(); })
      .catch(() => (cartBox.innerHTML = '<p class="form-msg error">Couldn\'t load the menu. Refresh the page to try again.</p>'));
  }

  // ---------- Order tracking ----------
  const trackForm = $('[data-track-form]');
  if (trackForm) {
    const STEPS = ['Received', 'Baking', 'Out for delivery', 'Delivered'];
    const out = $('[data-track-result]');
    const q = new URLSearchParams(location.search);
    if (q.get('id')) trackForm.id.value = q.get('id');

    trackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', trackForm);
      btn.disabled = true;
      try {
        const o = await api(`/api/orders/${encodeURIComponent(trackForm.id.value.trim())}?phone=${encodeURIComponent(trackForm.phone.value)}`);
        const at = (s) => o.history.find((h) => h.status === s);
        const timeline =
          o.status === 'Cancelled'
            ? '<p class="form-msg error">This order was cancelled. Contact us if you have questions.</p>'
            : `<ol class="timeline">${STEPS.map((s, i) => {
                const h = at(s);
                const done = i <= STEPS.indexOf(o.status);
                return `<li class="${done ? 'done' : ''}${s === o.status ? ' current' : ''}"><div><strong>${s}</strong>${h ? `<br><span class="small">${new Date(h.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>` : ''}</div></li>`;
              }).join('')}</ol>`;
        out.innerHTML = `<div class="panel result"><h2>Order ${esc(o.id)}</h2>
          <p class="muted">Delivery on ${new Date(o.deliveryDate + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          ${timeline}
          <p>${o.items.map((i) => `${i.qty} × ${esc(i.name)} (${esc(i.size)})`).join('<br>')}</p>
          <p><strong>Total ${money(o.total)}</strong></p></div>`;
      } catch (err) {
        out.innerHTML = `<p class="form-msg error">${esc(err.message)}</p>`;
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------- Admin ----------
  const login = $('[data-admin-login]');
  if (login) {
    const STATUSES = ['Received', 'Baking', 'Out for delivery', 'Delivered', 'Cancelled'];
    let key = sessionStorage.getItem('crumbnest-admin') || '';
    const adm = (url, opt = {}) => api(url, { ...opt, headers: { 'x-admin-key': key } });
    const when = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    async function loadAll() {
      const [sum, orders, messages, reviews] = await Promise.all([
        adm('/api/admin/summary'), adm('/api/admin/orders'), adm('/api/admin/messages'), api('/api/reviews')
      ]);
      login.hidden = true;
      $('[data-admin]').hidden = false;
      $('[data-stats]').innerHTML = [
        ['Active orders', sum.activeOrders], ['Total orders', sum.totalOrders], ['Revenue', money(sum.revenue)], ['Unread messages', sum.unreadMessages]
      ].map(([l, v]) => `<div class="stat"><span class="muted small">${l}</span><strong>${v}</strong></div>`).join('');

      $('[data-panel="orders"]').innerHTML = orders.length
        ? `<div class="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Delivery</th><th>Total</th><th>Status</th></tr></thead><tbody>${orders
            .map((o) => `<tr><td><strong>${esc(o.id)}</strong><br><span class="muted small">${when(o.createdAt)}</span></td>
              <td>${esc(o.customer.name)}<br><span class="small">${esc(o.customer.phone)}</span><br><span class="muted small">${esc(o.customer.address)}</span></td>
              <td>${o.items.map((i) => `${i.qty} × ${esc(i.name)} (${esc(i.size)})`).join('<br>')}${o.cakeMessage ? `<br><em class="small">Message: “${esc(o.cakeMessage)}”</em>` : ''}</td>
              <td>${esc(o.deliveryDate)}</td><td>${money(o.total)}</td>
              <td><select data-status="${esc(o.id)}" aria-label="Status for ${esc(o.id)}">${STATUSES.map((s) => `<option${s === o.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td></tr>`)
            .join('')}</tbody></table></div>`
        : '<p class="muted">No orders yet. They\'ll appear here as soon as someone checks out.</p>';

      $('[data-panel="messages"]').innerHTML = messages.length
        ? `<div class="table-scroll"><table><thead><tr><th>From</th><th>Message</th><th>Received</th><th></th></tr></thead><tbody>${messages
            .map((m) => `<tr class="${m.read ? '' : 'unread'}"><td>${esc(m.name)}<br><a class="small" href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.phone ? `<br><span class="small">${esc(m.phone)}</span>` : ''}</td><td>${esc(m.message)}</td><td class="small">${when(m.createdAt)}</td>
              <td><button class="btn btn-line btn-small" data-read="${esc(m.id)}" data-val="${!m.read}">${m.read ? 'Mark unread' : 'Mark read'}</button></td></tr>`)
            .join('')}</tbody></table></div>`
        : '<p class="muted">No messages yet.</p>';

      $('[data-panel="reviews"]').innerHTML = reviews.length
        ? `<div class="table-scroll"><table><thead><tr><th>Cake</th><th>Review</th><th>Rating</th><th></th></tr></thead><tbody>${reviews
            .map((r) => `<tr><td>${esc(r.product)}</td><td>${esc(r.text)}<br><span class="muted small">${esc(r.name)}, ${when(r.createdAt)}</span></td><td>${r.rating} ★</td>
              <td><button class="btn btn-line btn-small" data-del="${esc(r.id)}">Delete</button></td></tr>`)
            .join('')}</tbody></table></div>`
        : '<p class="muted">No reviews yet.</p>';
    }

    login.addEventListener('submit', async (e) => {
      e.preventDefault();
      key = login.key.value;
      try {
        await loadAll();
        sessionStorage.setItem('crumbnest-admin', key);
      } catch (err) {
        setMsg(login, err.message, 'error');
      }
    });
    if (key) loadAll().catch(() => sessionStorage.removeItem('crumbnest-admin'));

    $$('[data-tab]').forEach((t) =>
      t.addEventListener('click', () => {
        $$('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
        $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== t.dataset.tab));
      })
    );

    document.addEventListener('change', async (e) => {
      const sel = e.target.closest('[data-status]');
      if (!sel) return;
      try {
        await adm(`/api/admin/orders/${encodeURIComponent(sel.dataset.status)}`, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
        toast(`Order ${esc(sel.dataset.status)} is now “${esc(sel.value)}”`);
        loadAll();
      } catch (err) { toast(esc(err.message)); }
    });

    document.addEventListener('click', async (e) => {
      const read = e.target.closest('[data-read]');
      const del = e.target.closest('[data-del]');
      try {
        if (read) {
          await adm(`/api/admin/messages/${encodeURIComponent(read.dataset.read)}`, { method: 'PATCH', body: JSON.stringify({ read: read.dataset.val === 'true' }) });
          loadAll();
        } else if (del && confirm('Delete this review? This can\'t be undone.')) {
          await adm(`/api/admin/reviews/${encodeURIComponent(del.dataset.del)}`, { method: 'DELETE' });
          toast('Review deleted');
          loadAll();
        }
      } catch (err) { toast(esc(err.message)); }
    });
  }
})();
