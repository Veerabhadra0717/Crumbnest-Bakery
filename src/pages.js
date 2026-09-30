// Server-side rendering: every page arrives as complete HTML, so Google can read
// all the content without running JavaScript. This is a big technical-SEO win.

const { products, categories, findProduct } = require('./products');

const SITE = 'Crumbnest Bakery';
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
const fromPrice = (p) => Math.min(...p.sizes.map((s) => s.price));

function cakeSvg(c, label, big = false) {
  const id = Math.random().toString(36).slice(2, 7);
  return `<svg class="cake${big ? ' cake-big' : ''}" viewBox="0 0 400 320" role="img" aria-label="${esc(label)}">
  <defs><clipPath id="c${id}"><path d="M60 150 L340 110 L340 270 L60 285 Z"/></clipPath></defs>
  <ellipse cx="200" cy="292" rx="175" ry="16" fill="var(--plate)"/>
  <path d="M60 150 L340 110 L340 270 L60 285 Z" fill="${c.sponge}"/>
  <g clip-path="url(#c${id})">
    <path d="M40 197 L360 160 L360 176 L40 213 Z" fill="${c.cream}"/>
    <path d="M40 243 L360 210 L360 226 L40 259 Z" fill="${c.cream}"/>
  </g>
  <path d="M60 150 L340 110 L318 90 L38 130 Z" fill="${c.top}"/>
  <path d="M38 130 L60 150 L60 285 L38 270 Z" fill="${c.sponge}" opacity=".75"/>
  <circle cx="160" cy="112" r="15" fill="${c.garnish}"/>
  <circle cx="215" cy="104" r="15" fill="${c.garnish}"/>
  <circle cx="270" cy="96" r="15" fill="${c.garnish}"/>
</svg>`;
}

function stars(rating) {
  const r = Math.round(rating);
  return `<span class="stars" aria-label="${rating.toFixed(1)} out of 5 stars">${'★'.repeat(r)}<span class="stars-off">${'★'.repeat(5 - r)}</span></span>`;
}

function ratingFor(slug, reviews) {
  const list = reviews.filter((r) => r.product === slug);
  if (!list.length) return null;
  return { count: list.length, avg: list.reduce((a, r) => a + r.rating, 0) / list.length };
}

function layout({ title, description, path, body, current = '', jsonLd = null, noindex = false }) {
  const url = BASE_URL + path;
  const nav = [
    ['/', 'Home', 'home'],
    ['/cakes', 'Our cakes', 'cakes'],
    ['/about', 'About', 'about'],
    ['/track', 'Track order', 'track'],
    ['/contact', 'Contact', 'contact']
  ]
    .map(([href, label, key]) => `<li><a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a></li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${esc(url)}">`}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="${SITE}">
<meta name="theme-color" content="#3B2218">
<!-- GOOGLE_SITE_VERIFICATION: paste your Search Console meta tag here -->
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Gluten:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <div class="wrap bar">
    <a class="logo" href="/" aria-label="${SITE} home">
      <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 40 L56 40 L50 56 L14 56 Z" fill="currentColor"/><rect x="8" y="28" width="48" height="12" rx="3" fill="var(--frosting)"/><circle cx="32" cy="20" r="7" fill="var(--pistachio)"/></svg>
      <span>Crumbnest</span>
    </a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" aria-label="Main"><ul>${nav}</ul></nav>
    <a class="cart-link" href="/cart">Cart <span class="cart-count" data-cart-count>0</span></a>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site">
  <div class="wrap footer-grid">
    <div>
      <p class="footer-logo">Crumbnest Bakery</p>
      <p>100% eggless cakes, baked fresh after you order.</p>
    </div>
    <div>
      <p class="footer-head">Cakes</p>
      <ul>${products.slice(0, 4).map((p) => `<li><a href="/cakes/${p.slug}">${esc(p.name)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <p class="footer-head">Help</p>
      <ul><li><a href="/track">Track your order</a></li><li><a href="/contact">Contact us</a></li><li><a href="/about">Our story</a></li></ul>
    </div>
  </div>
  <div class="wrap copyright">© ${new Date().getFullYear()} Crumbnest Bakery</div>
</footer>
<div class="toast" role="status" aria-live="polite" hidden></div>
<script src="/js/app.js" defer></script>
</body>
</html>`;
}

function productCard(p, reviews) {
  const r = ratingFor(p.slug, reviews);
  return `<article class="card" data-category="${esc(p.category)}" style="--tint:${p.colors.sponge}">
  <a class="card-art" href="/cakes/${p.slug}" tabindex="-1" aria-hidden="true">${cakeSvg(p.colors, p.name)}</a>
  <div class="card-body">
    ${p.bestseller ? '<p class="badge">Bestseller</p>' : ''}
    <h3><a href="/cakes/${p.slug}">${esc(p.name)}</a></h3>
    <p>${esc(p.short)}</p>
    <div class="card-foot">
      <span class="price">From ${money(fromPrice(p))}</span>
      ${r ? `<span class="card-rating">${stars(r.avg)} <span class="muted">(${r.count})</span></span>` : ''}
    </div>
  </div>
</article>`;
}

// ---------- Pages ----------

function home(reviews) {
  const star = products.find((p) => p.bestseller);
  const latest = [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  return layout({
    title: 'Crumbnest Bakery | Eggless Cakes Baked Fresh to Order',
    description: 'Crumbnest Bakery bakes 100% eggless cakes, brownies and celebration cakes fresh to order, with same-day delivery. Order online in minutes.',
    path: '/',
    current: 'home',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Bakery',
      name: SITE,
      url: BASE_URL + '/',
      description: 'Home bakery making 100% eggless cakes and brownies, baked fresh to order.',
      servesCuisine: 'Eggless baked goods',
      priceRange: '₹₹',
      telephone: '+91-00000-00000'
    },
    body: `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <h1 class="display">Crumbnest<br>Bakery</h1>
      <p class="lead">Every cake is 100% eggless, baked in small batches, and only after you order it.</p>
      <div class="actions">
        <a class="btn" href="/cakes">Browse cakes</a>
        <a class="btn btn-line" href="/cakes/${star.slug}">Try our bestseller</a>
      </div>
      <ul class="facts">
        <li><strong>Same-day</strong> delivery before noon</li>
        <li><strong>Free delivery</strong> over ₹1,500</li>
        <li><strong>Free</strong> cake message</li>
      </ul>
    </div>
    <div class="hero-art">${cakeSvg(star.colors, 'Slice of eggless chocolate truffle cake', true)}</div>
  </div>
</section>

<section class="wrap section">
  <div class="section-head">
    <h2>Fresh from our oven</h2>
    <a href="/cakes">See all cakes</a>
  </div>
  <div class="grid">${products.slice(0, 3).map((p) => productCard(p, reviews)).join('')}</div>
</section>

<section class="band">
  <div class="wrap section">
    <h2>How ordering works</h2>
    <ol class="steps">
      <li><h3>Pick your cake</h3><p>Choose a flavour, a size, and add a message if you like.</p></li>
      <li><h3>Choose a date</h3><p>Order before noon for today, or schedule up to 30 days ahead.</p></li>
      <li><h3>We bake and deliver</h3><p>Your cake is baked fresh that morning. Track it with your order ID.</p></li>
    </ol>
  </div>
</section>

<section class="wrap section">
  <h2>What people say</h2>
  <div class="quotes">
    ${latest
      .map((r) => {
        const p = findProduct(r.product);
        return `<figure class="quote">${stars(r.rating)}<blockquote>${esc(r.text)}</blockquote><figcaption>${esc(r.name)}, on <a href="/cakes/${r.product}">${esc(p ? p.name : 'a cake')}</a></figcaption></figure>`;
      })
      .join('')}
  </div>
</section>`
  });
}

function menu(reviews) {
  return layout({
    title: 'Eggless Cakes Menu | Order Online | Crumbnest Bakery',
    description: 'Browse our full menu of eggless cakes: chocolate truffle, black forest, red velvet, pistachio rose, mango cream and fudgy brownies. Prices from ₹420.',
    path: '/cakes',
    current: 'cakes',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE_URL}/cakes/${p.slug}`, name: p.name }))
    },
    body: `
<section class="wrap section page-top">
  <h1>Our eggless cakes</h1>
  <p class="lead">Every item is made without eggs and baked fresh on your delivery date.</p>
  <div class="filters" role="group" aria-label="Filter by type">
    ${categories.map((c, i) => `<button class="chip" data-filter="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`).join('')}
  </div>
  <div class="grid" data-grid>${products.map((p) => productCard(p, reviews)).join('')}</div>
</section>`
  });
}

function product(p, reviews) {
  const list = reviews.filter((r) => r.product === p.slug).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const r = ratingFor(p.slug, reviews);
  const url = `${BASE_URL}/cakes/${p.slug}`;
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    brand: { '@type': 'Brand', name: SITE },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: fromPrice(p),
      highPrice: Math.max(...p.sizes.map((s) => s.price)),
      availability: 'https://schema.org/InStock'
    }
  };
  if (r) productLd.aggregateRating = { '@type': 'AggregateRating', ratingValue: r.avg.toFixed(1), reviewCount: r.count };
  const others = products.filter((x) => x.slug !== p.slug).slice(0, 3);

  return layout({
    title: `${p.name} Online | ${SITE}`,
    description: `Order ${p.name} online from ${SITE}. ${p.short} Freshly baked, ${p.sizes.length} sizes, from ${money(fromPrice(p))}.`,
    path: `/cakes/${p.slug}`,
    current: 'cakes',
    jsonLd: [
      productLd,
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL + '/' },
          { '@type': 'ListItem', position: 2, name: 'Cakes', item: BASE_URL + '/cakes' },
          { '@type': 'ListItem', position: 3, name: p.name, item: url }
        ]
      }
    ],
    body: `
<div class="wrap page-top">
  <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/cakes">Cakes</a></li><li aria-current="page">${esc(p.name)}</li></ol></nav>
  <div class="product">
    <div class="product-art" style="--tint:${p.colors.sponge}">${cakeSvg(p.colors, p.name, true)}</div>
    <div class="product-info">
      <h1>${esc(p.name)}</h1>
      ${r ? `<p class="rating-line">${stars(r.avg)} <a href="#reviews">${r.avg.toFixed(1)} from ${r.count} review${r.count > 1 ? 's' : ''}</a></p>` : ''}
      <p class="lead">${esc(p.description)}</p>
      <form class="buy" data-buy data-slug="${p.slug}" data-name="${esc(p.name)}">
        <fieldset>
          <legend>Choose a size</legend>
          <div class="sizes">
            ${p.sizes
              .map(
                (s, i) => `<label class="size"><input type="radio" name="size" value="${esc(s.label)}" data-price="${s.price}"${i === 0 ? ' checked' : ''}>
              <span><strong>${esc(s.label)}</strong><small>Serves ${esc(s.serves)}</small><em>${money(s.price)}</em></span></label>`
              )
              .join('')}
          </div>
        </fieldset>
        <div class="buy-row">
          <div class="qty" aria-label="Quantity">
            <button type="button" data-qty="-1" aria-label="Decrease quantity">−</button>
            <input type="number" name="qty" value="1" min="1" max="10" aria-label="Quantity">
            <button type="button" data-qty="1" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-wide" type="submit">Add to cart</button>
        </div>
      </form>
      <details open><summary>Ingredients</summary><p>${esc(p.ingredients)}</p></details>
      <details><summary>Delivery and storage</summary><p>Order before 12 noon for same-day delivery. Keep refrigerated and enjoy within 2 days. Bring to room temperature for 20 minutes before serving.</p></details>
    </div>
  </div>

  <section class="section" id="reviews">
    <h2>Reviews</h2>
    <div class="reviews-layout">
      <div class="review-list" data-review-list>
        ${
          list.length
            ? list.map((x) => `<article class="review">${stars(x.rating)}<p>${esc(x.text)}</p><p class="muted">${esc(x.name)}, ${new Date(x.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></article>`).join('')
            : '<p class="muted" data-empty>No reviews yet. Tried this cake? Be the first to review it.</p>'
        }
      </div>
      <form class="panel" data-review-form data-slug="${p.slug}">
        <h3>Write a review</h3>
        <label>Your name<input name="name" required maxlength="40" autocomplete="name"></label>
        <fieldset class="star-input"><legend>Rating</legend><div class="star-row">
          ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="s${n}" name="rating" value="${n}"${n === 5 ? ' checked' : ''}><label for="s${n}" title="${n} stars">★</label>`).join('')}
        </div></fieldset>
        <label>Your review<textarea name="text" required minlength="10" maxlength="500" rows="4"></textarea></label>
        <button class="btn" type="submit">Post review</button>
        <p class="form-msg" data-msg></p>
      </form>
    </div>
  </section>

  <section class="section">
    <h2>You might also like</h2>
    <div class="grid">${others.map((x) => productCard(x, reviews)).join('')}</div>
  </section>
</div>`
  });
}

function about() {
  return layout({
    title: 'About Crumbnest Bakery | Our Eggless Baking Story',
    description: 'Meet the home baker behind Crumbnest Bakery and learn how every cake is made 100% eggless, fresh and in small batches.',
    path: '/about',
    current: 'about',
    body: `
<section class="wrap section page-top narrow">
  <h1>About Crumbnest Bakery</h1>
  <p class="lead">Crumbnest began in a home kitchen in 2024 with one chocolate cake for a friend's birthday. Word spread from there.</p>
  <h2>Why eggless</h2>
  <p>Friends who don't eat eggs kept asking for cakes that didn't taste like a compromise. So every recipe here was tested again and again until it was as soft and rich as a classic sponge.</p>
  <h2>How we bake</h2>
  <p>We bake in small batches, only after an order comes in, so nothing sits on a shelf. We use good dark chocolate, fresh cream, real fruit, and no artificial preservatives.</p>
  <h2>Order from us</h2>
  <p>Browse <a href="/cakes">the full menu</a>, try our <a href="/cakes/eggless-chocolate-truffle-cake">eggless chocolate truffle cake</a>, or <a href="/contact">send us a message</a> for custom orders.</p>
</section>`
  });
}

function contact() {
  return layout({
    title: 'Contact and Custom Orders | Crumbnest Bakery',
    description: 'Contact Crumbnest Bakery for custom cakes, bulk orders or questions. Call, WhatsApp or send us a message and we reply within a few hours.',
    path: '/contact',
    current: 'contact',
    body: `
<section class="wrap section page-top">
  <div class="two-col">
    <div>
      <h1>Contact us</h1>
      <p class="lead">Custom designs, bulk orders or a quick question. We reply within a few hours.</p>
      <dl class="contact-list">
        <dt>Phone and WhatsApp</dt><dd>+91 00000 00000</dd>
        <dt>Email</dt><dd><a href="mailto:hello@example.com">hello@example.com</a></dd>
        <dt>Order hours</dt><dd>Every day, 9 am to 8 pm</dd>
      </dl>
    </div>
    <form class="panel" data-contact-form>
      <h2>Send a message</h2>
      <label>Name<input name="name" required maxlength="60" autocomplete="name"></label>
      <label>Email<input name="email" type="email" required maxlength="100" autocomplete="email"></label>
      <label>Phone (optional)<input name="phone" type="tel" maxlength="15" autocomplete="tel"></label>
      <label>Message<textarea name="message" required minlength="10" maxlength="1000" rows="5"></textarea></label>
      <button class="btn" type="submit">Send message</button>
      <p class="form-msg" data-msg></p>
    </form>
  </div>
</section>`
  });
}

function cart() {
  return layout({
    title: 'Your Cart | Crumbnest Bakery',
    description: 'Review your cart and place your order with Crumbnest Bakery.',
    path: '/cart',
    noindex: true,
    body: `
<section class="wrap section page-top">
  <h1>Your cart</h1>
  <div class="checkout" data-checkout>
    <div>
      <div class="cart-items" data-cart-items><p class="muted">Loading your cart…</p></div>
      <div class="totals" data-totals></div>
    </div>
    <form class="panel" data-order-form hidden>
      <h2>Delivery details</h2>
      <label>Full name<input name="name" required maxlength="60" autocomplete="name"></label>
      <label>Phone<input name="phone" type="tel" required pattern="[0-9+ -]{8,15}" autocomplete="tel"></label>
      <label>Email (optional)<input name="email" type="email" maxlength="100" autocomplete="email"></label>
      <label>Delivery address<textarea name="address" required minlength="10" maxlength="300" rows="3" autocomplete="street-address"></textarea></label>
      <label>Delivery date<input name="deliveryDate" type="date" required></label>
      <label>Message on cake (optional)<input name="cakeMessage" maxlength="40" placeholder="Happy birthday, Amma!"></label>
      <p class="muted small">Payment: cash or UPI on delivery.</p>
      <button class="btn btn-wide" type="submit">Place order</button>
      <p class="form-msg" data-msg></p>
    </form>
  </div>
  <div class="panel confirm" data-confirm hidden></div>
</section>`
  });
}

function track() {
  return layout({
    title: 'Track Your Order | Crumbnest Bakery',
    description: 'Track your Crumbnest Bakery order status with your order ID and phone number.',
    path: '/track',
    current: 'track',
    body: `
<section class="wrap section page-top narrow">
  <h1>Track your order</h1>
  <p class="lead">Enter the order ID from your confirmation and the phone number you used.</p>
  <form class="panel inline-form" data-track-form>
    <label>Order ID<input name="id" required placeholder="CN-XXXXXX" autocapitalize="characters"></label>
    <label>Phone<input name="phone" type="tel" required></label>
    <button class="btn" type="submit">Track order</button>
  </form>
  <div data-track-result></div>
</section>`
  });
}

function admin() {
  return layout({
    title: 'Admin | Crumbnest Bakery',
    description: 'Admin dashboard',
    path: '/admin',
    noindex: true,
    body: `
<section class="wrap section page-top">
  <h1>Admin dashboard</h1>
  <form class="panel inline-form" data-admin-login>
    <label>Admin key<input name="key" type="password" required autocomplete="current-password"></label>
    <button class="btn" type="submit">Open dashboard</button>
    <p class="form-msg" data-msg></p>
  </form>
  <div data-admin hidden>
    <div class="stats" data-stats></div>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected="true" data-tab="orders">Orders</button>
      <button role="tab" aria-selected="false" data-tab="messages">Messages</button>
      <button role="tab" aria-selected="false" data-tab="reviews">Reviews</button>
    </div>
    <div data-panel="orders"></div>
    <div data-panel="messages" hidden></div>
    <div data-panel="reviews" hidden></div>
  </div>
</section>`
  });
}

function notFound() {
  return layout({
    title: 'Page not found | Crumbnest Bakery',
    description: 'This page does not exist.',
    path: '/404',
    noindex: true,
    body: `
<section class="wrap section page-top narrow center">
  <h1 class="display small-display">404</h1>
  <p class="lead">This page doesn't exist. It may have moved, or the link has a typo.</p>
  <a class="btn" href="/cakes">Browse our cakes</a>
</section>`
  });
}

module.exports = { home, menu, product, about, contact, cart, track, admin, notFound, BASE_URL };
