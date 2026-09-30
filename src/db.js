// A tiny JSON-file database. No setup needed — data lives in data/db.json.
// Good for learning and small shops. For heavy traffic, switch to PostgreSQL or MongoDB.

const fs = require('fs');
const path = require('path');

const FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');

let state = { orders: [], reviews: [], messages: [] };

const seedReviews = [
  { product: 'eggless-chocolate-truffle-cake', name: 'Ananya R.', rating: 5, text: 'Ordered for my dad\'s birthday. Nobody could tell it was eggless. Super soft.' },
  { product: 'eggless-chocolate-truffle-cake', name: 'Karthik M.', rating: 5, text: 'Rich ganache, not overly sweet. Arrived right on time.' },
  { product: 'pistachio-rose-cake', name: 'Meera S.', rating: 4, text: 'Lovely flavour. The rose is subtle, which I liked.' },
  { product: 'red-velvet-cake', name: 'Rahul D.', rating: 5, text: 'Best red velvet I have had. The cream cheese frosting is perfect.' },
  { product: 'fudgy-brownie-box', name: 'Divya P.', rating: 5, text: 'Gooey, chocolatey and gone in ten minutes.' }
];

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE); // atomic replace, so a crash never leaves a half-written file
}

function load() {
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Could not read the database file, starting fresh:', err.message);
    }
    state.reviews = seedReviews.map((r, i) => ({
      id: 'r' + (i + 1),
      ...r,
      createdAt: new Date(Date.now() - (i + 1) * 86400000 * 3).toISOString()
    }));
    save();
  }
}

load();

module.exports = {
  get: () => state,
  save
};
