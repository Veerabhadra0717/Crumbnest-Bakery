const express = require('express');
const compression = require('compression');
const path = require('path');
const crypto = require('crypto');

const db = require('./src/db');
const pages = require('./src/pages');
const { products, findProduct } = require('./src/products');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'crumbnest-admin';
const FREE_DELIVERY_OVER = 1500;
const DELIVERY_FEE = 60;
const STATUSES = ['Received', 'Baking', 'Out for delivery', 'Delivered', 'Cancelled'];

if (ADMIN_KEY === 'crumbnest-admin') {
  console.warn('⚠  Using the default admin key. Set ADMIN_KEY before going live.');
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '20kb' }));

// Basic security headers
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy':
      "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self' 'unsafe-inline'"
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

// ---------- Helpers ----------

const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + req.baseUrl + req.path;
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v) => /^[0-9+\s-]{8,15}$/.test(v);
const digits = (v) => String(v).replace(/\D/g, '').slice(-10);
const newId = (prefix) => prefix + crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();

function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function requireAdmin(req, res, next) {
  const given = Buffer.from(String(req.get('x-admin-key') || ''));
  const real = Buffer.from(ADMIN_KEY);
  if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
    return res.status(401).json({ error: 'Wrong admin key.' });
  }
  next();
}

const publicOrder = (o) => ({
  id: o.id,
  status: o.status,
  items: o.items,
  subtotal: o.subtotal,
  deliveryFee: o.deliveryFee,
  total: o.total,
  deliveryDate: o.deliveryDate,
  createdAt: o.createdAt,
  history: o.history
});

// ---------- Public API ----------

const api = express.Router();

api.get('/health', (req, res) => res.json({ ok: true }));

api.get('/products', (req, res) => res.json(products));

api.get('/products/:slug', (req, res) => {
  const p = findProduct(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  res.json(p);
});

api.get('/reviews', (req, res) => {
  const { product } = req.query;
  const list = db.get().reviews.filter((r) => !product || r.product === product);
  res.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

api.post('/reviews', rateLimit(3, 60000), (req, res) => {
  const product = clean(req.body.product, 80);
  const name = clean(req.body.name, 40);
  const text = clean(req.body.text, 500);
  const rating = Number(req.body.rating);
  if (!findProduct(product)) return res.status(400).json({ error: 'Unknown cake.' });
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (text.length < 10) return res.status(400).json({ error: 'Reviews need at least 10 characters.' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1 to 5 stars.' });

  const review = { id: newId('r'), product, name, rating, text, createdAt: new Date().toISOString() };
  db.get().reviews.push(review);
  db.save();
  res.status(201).json(review);
});

api.post('/orders', rateLimit(5, 60000), (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 60);
  const phone = clean(b.phone, 15);
  const email = clean(b.email, 100);
  const address = clean(b.address, 300);
  const cakeMessage = clean(b.cakeMessage, 40);
  const deliveryDate = clean(b.deliveryDate, 10);

  if (name.length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
  if (!isPhone(phone)) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (email && !isEmail(email)) return res.status(400).json({ error: 'That email address doesn\'t look right.' });
  if (address.length < 10) return res.status(400).json({ error: 'Please enter your full delivery address.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || deliveryDate < todayISO() || deliveryDate > todayISO(30)) {
    return res.status(400).json({ error: 'Pick a delivery date between today and 30 days from now.' });
  }
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 20) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  // Prices always come from the server's menu, never from the browser.
  const items = [];
  for (const it of b.items) {
    const p = findProduct(clean(it.slug, 80));
    const size = p && p.sizes.find((s) => s.label === it.size);
    const qty = Number(it.qty);
    if (!p || !size || !Number.isInteger(qty) || qty < 1 || qty > 10) {
      return res.status(400).json({ error: 'One of the items in your cart is no longer available. Please refresh your cart.' });
    }
    items.push({ slug: p.slug, name: p.name, size: size.label, qty, price: size.price, lineTotal: size.price * qty });
  }

  const subtotal = items.reduce((a, i) => a + i.lineTotal, 0);
  const deliveryFee = subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
  const now = new Date().toISOString();
  const order = {
    id: newId('CN-'),
    status: 'Received',
    customer: { name, phone, email, address },
    cakeMessage,
    items,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    deliveryDate,
    createdAt: now,
    history: [{ status: 'Received', at: now }]
  };
  db.get().orders.push(order);
  db.save();
  console.log(`New order ${order.id} from ${name} — ${order.total}`);
  res.status(201).json(publicOrder(order));
});

api.get('/orders/:id', rateLimit(20, 60000), (req, res) => {
  const id = clean(req.params.id, 12).toUpperCase();
  const order = db.get().orders.find((o) => o.id === id);
  // Phone must match, so strangers can't look up other people's orders.
  if (!order || digits(order.customer.phone) !== digits(req.query.phone || '')) {
    return res.status(404).json({ error: 'No order found with that ID and phone number.' });
  }
  res.json(publicOrder(order));
});

api.post('/contact', rateLimit(3, 60000), (req, res) => {
  const name = clean(req.body.name, 60);
  const email = clean(req.body.email, 100);
  const phone = clean(req.body.phone, 15);
  const message = clean(req.body.message, 1000);
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (phone && !isPhone(phone)) return res.status(400).json({ error: 'That phone number doesn\'t look right.' });
  if (message.length < 10) return res.status(400).json({ error: 'Messages need at least 10 characters.' });

  db.get().messages.push({ id: newId('m'), name, email, phone, message, read: false, createdAt: new Date().toISOString() });
  db.save();
  res.status(201).json({ ok: true });
});

// ---------- Admin API ----------

const adminApi = express.Router();
adminApi.use(rateLimit(60, 60000), requireAdmin);

adminApi.get('/summary', (req, res) => {
  const { orders, messages, reviews } = db.get();
  const active = orders.filter((o) => !['Delivered', 'Cancelled'].includes(o.status));
  res.json({
    totalOrders: orders.length,
    activeOrders: active.length,
    revenue: orders.filter((o) => o.status !== 'Cancelled').reduce((a, o) => a + o.total, 0),
    unreadMessages: messages.filter((m) => !m.read).length,
    reviews: reviews.length
  });
});

adminApi.get('/orders', (req, res) => {
  res.json([...db.get().orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

adminApi.patch('/orders/:id', (req, res) => {
  const order = db.get().orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Unknown status.' });
  order.status = req.body.status;
  order.history.push({ status: order.status, at: new Date().toISOString() });
  db.save();
  res.json(order);
});

adminApi.get('/messages', (req, res) => {
  res.json([...db.get().messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

adminApi.patch('/messages/:id', (req, res) => {
  const m = db.get().messages.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Message not found.' });
  m.read = Boolean(req.body.read);
  db.save();
  res.json(m);
});

adminApi.delete('/reviews/:id', (req, res) => {
  const list = db.get().reviews;
  const i = list.findIndex((r) => r.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Review not found.' });
  list.splice(i, 1);
  db.save();
  res.json({ ok: true });
});

app.use('/api/admin', adminApi);
app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

// ---------- Pages ----------

const send = (res, html, status = 200) => res.status(status).type('html').set('Cache-Control', 'no-cache').send(html);

app.get('/', (req, res) => send(res, pages.home(db.get().reviews)));
app.get('/cakes', (req, res) => send(res, pages.menu(db.get().reviews)));
app.get('/cakes/:slug', (req, res) => {
  const p = findProduct(req.params.slug);
  if (!p) return send(res, pages.notFound(), 404);
  send(res, pages.product(p, db.get().reviews));
});
app.get('/about', (req, res) => send(res, pages.about()));
app.get('/contact', (req, res) => send(res, pages.contact()));
app.get('/cart', (req, res) => send(res, pages.cart()));
app.get('/track', (req, res) => send(res, pages.track()));
app.get('/admin', (req, res) => send(res, pages.admin()));

// Old URL from version 1 → permanent redirect keeps any SEO value it earned
app.get('/eggless-chocolate-cake.html', (req, res) => res.redirect(301, '/cakes/eggless-chocolate-truffle-cake'));
app.get('/index.html', (req, res) => res.redirect(301, '/'));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /api/\n\nSitemap: ${pages.BASE_URL}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/cakes', ...products.map((p) => `/cakes/${p.slug}`), '/about', '/contact', '/track'];
  const today = todayISO();
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${pages.BASE_URL}${u}</loc><lastmod>${today}</lastmod></url>`)
      .join('\n')}\n</urlset>\n`
  );
});

app.use((req, res) => send(res, pages.notFound(), 404));

app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api')) return res.status(err.status || 500).json({ error: err.type === 'entity.parse.failed' ? 'Invalid request data.' : 'Something went wrong on our side. Please try again.' });
  res.status(500).send('Something went wrong. Please refresh the page.');
});

app.listen(PORT, () => {
  console.log(`🎂 Crumbnest Bakery running at http://localhost:${PORT}`);
  console.log(`   Admin dashboard:  http://localhost:${PORT}/admin`);
});
