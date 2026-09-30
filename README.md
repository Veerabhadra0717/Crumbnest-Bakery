# Crumbnest Bakery v2 — full website with backend and API

## Run it on your computer
1. Install Node.js 18 or newer (nodejs.org).
2. Unzip this folder, open a terminal inside it, and run:
   ```
   npm start
   ```
   (node_modules is already included, so no `npm install` needed.)
3. Open http://localhost:3000
4. Admin dashboard: http://localhost:3000/admin — default key `crumbnest-admin`

## Features
- 6 cake pages, each with its own SEO title, description and structured data
- Menu filters, size picker, quantity, cart, checkout
- Orders saved on the server with an order ID; prices are always checked by the server
- Order tracking with a timeline (order ID + phone number)
- Customer reviews with star ratings (shown on Google as rating stars via structured data)
- Contact form
- Admin dashboard: update order status, read messages, delete reviews, revenue stats
- Auto-generated sitemap.xml and robots.txt, 301 redirect from the old v1 URL
- Mobile-friendly, dark mode, keyboard accessible

## Folder structure
```
server.js            Express server: pages + API
src/products.js      Menu, sizes and prices (edit this to change cakes)
src/pages.js         Server-rendered HTML pages (SEO-friendly)
src/db.js            Tiny JSON database -> data/db.json
public/css/style.css Design
public/js/app.js     Cart, forms, tracking, admin
```

## API
| Method | Route | What it does |
|---|---|---|
| GET | /api/products | All cakes |
| GET | /api/products/:slug | One cake |
| GET | /api/reviews?product=slug | Reviews |
| POST | /api/reviews | Add review `{product,name,rating,text}` |
| POST | /api/orders | Place order `{name,phone,email,address,deliveryDate,cakeMessage,items:[{slug,size,qty}]}` |
| GET | /api/orders/:id?phone= | Track an order |
| POST | /api/contact | Send message `{name,email,phone,message}` |
| GET | /api/admin/summary, /api/admin/orders, /api/admin/messages | Admin (header `x-admin-key`) |
| PATCH | /api/admin/orders/:id | `{status}` |
| PATCH | /api/admin/messages/:id | `{read}` |
| DELETE | /api/admin/reviews/:id | Remove a review |

## Put it live (free) and on Google
GitHub Pages can't run a backend, so use Render.com (free):
1. Upload this folder to a GitHub repository (node_modules and data/db.json are ignored by .gitignore).
2. On render.com: New > Web Service > pick your repo. Build command `npm install`, start command `npm start`.
3. Add environment variables: `ADMIN_KEY` (a long secret) and `BASE_URL` (your Render URL, e.g. https://crumbnest.onrender.com).
4. In Google Search Console, add your URL, verify (paste the meta tag in src/pages.js where it says GOOGLE_SITE_VERIFICATION), submit `/sitemap.xml`, and request indexing.
5. In a few days to 2 weeks, search "Crumbnest Bakery" on Google.

Note: on Render's free plan the file storage resets when the app restarts. For real orders, move to a database such as PostgreSQL (Render offers one) or MongoDB Atlas.
