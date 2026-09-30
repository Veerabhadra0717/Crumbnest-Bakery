// The single source of truth for the menu.
// Prices here are what the server charges — the browser can never change them.

const products = [
  {
    slug: 'eggless-chocolate-truffle-cake',
    name: 'Eggless Chocolate Truffle Cake',
    category: 'Chocolate',
    bestseller: true,
    short: 'Moist cocoa sponge layered with dark chocolate ganache.',
    description:
      'Our bestseller. A deep, moist cocoa sponge layered and covered with silky dark chocolate ganache. Yogurt and baking soda give it the same soft, springy crumb as a classic sponge, with no eggs at all.',
    ingredients: 'Wheat flour, cocoa powder, sugar, yogurt, milk, vegetable oil, baking soda, vanilla, dark chocolate, fresh cream.',
    sizes: [
      { label: '500 g', serves: '4 to 6', price: 650 },
      { label: '1 kg', serves: '8 to 10', price: 1200 },
      { label: '2 kg', serves: '16 to 20', price: 2300 }
    ],
    colors: { sponge: '#4A2A1E', cream: '#7A4E3A', top: '#2E1A12', garnish: '#F2B8C6' }
  },
  {
    slug: 'pistachio-rose-cake',
    name: 'Pistachio Rose Cake',
    category: 'Nutty',
    short: 'Light pistachio sponge with rose-scented cream.',
    description:
      'A delicate pistachio sponge layered with rose-scented whipped cream and finished with crushed pistachios. Floral, nutty and not too sweet.',
    ingredients: 'Wheat flour, pistachios, sugar, yogurt, milk, vegetable oil, rose water, fresh cream, cardamom.',
    sizes: [
      { label: '500 g', serves: '4 to 6', price: 750 },
      { label: '1 kg', serves: '8 to 10', price: 1400 }
    ],
    colors: { sponge: '#CFE0B4', cream: '#F6D3DC', top: '#B7D3A8', garnish: '#4E7A45' }
  },
  {
    slug: 'mango-cream-cake',
    name: 'Mango Cream Cake',
    category: 'Fruit',
    short: 'Vanilla sponge with fresh Alphonso mango cream.',
    description:
      'Soft vanilla sponge soaked lightly in mango syrup, layered with fresh Alphonso mango cream and topped with mango cubes. Available while mangoes are in season.',
    ingredients: 'Wheat flour, sugar, yogurt, milk, vegetable oil, Alphonso mango pulp, fresh cream, vanilla.',
    sizes: [
      { label: '500 g', serves: '4 to 6', price: 700 },
      { label: '1 kg', serves: '8 to 10', price: 1300 }
    ],
    colors: { sponge: '#F7E3A1', cream: '#FFF4D6', top: '#F4B942', garnish: '#4E7A45' }
  },
  {
    slug: 'red-velvet-cake',
    name: 'Red Velvet Cake',
    category: 'Classic',
    short: 'Velvety cocoa-buttermilk sponge with cream cheese frosting.',
    description:
      'The classic, made eggless. A tender, lightly chocolatey red sponge with tangy cream cheese frosting between every layer.',
    ingredients: 'Wheat flour, sugar, buttermilk, cocoa powder, vegetable oil, beetroot colour, cream cheese, butter, vanilla.',
    sizes: [
      { label: '500 g', serves: '4 to 6', price: 700 },
      { label: '1 kg', serves: '8 to 10', price: 1300 },
      { label: '2 kg', serves: '16 to 20', price: 2500 }
    ],
    colors: { sponge: '#A3263A', cream: '#FFF6EE', top: '#FFF6EE', garnish: '#A3263A' }
  },
  {
    slug: 'black-forest-cake',
    name: 'Black Forest Cake',
    category: 'Chocolate',
    short: 'Chocolate sponge, whipped cream and dark cherries.',
    description:
      'Layers of light chocolate sponge, whipped cream and dark cherries, finished with chocolate shavings. A birthday favourite for all ages.',
    ingredients: 'Wheat flour, cocoa powder, sugar, yogurt, milk, vegetable oil, fresh cream, dark cherries, chocolate.',
    sizes: [
      { label: '500 g', serves: '4 to 6', price: 600 },
      { label: '1 kg', serves: '8 to 10', price: 1100 }
    ],
    colors: { sponge: '#4A2A1E', cream: '#FFF6EE', top: '#FFF6EE', garnish: '#B0182E' }
  },
  {
    slug: 'fudgy-brownie-box',
    name: 'Fudgy Brownie Box',
    category: 'Brownies',
    short: 'Dense, gooey eggless brownies with a crackly top.',
    description:
      'Dense and gooey in the middle with a crackly top. Made with dark chocolate and a pinch of sea salt. Great for gifting.',
    ingredients: 'Dark chocolate, wheat flour, sugar, condensed milk, butter, cocoa powder, sea salt.',
    sizes: [
      { label: 'Box of 6', serves: '6 pieces', price: 420 },
      { label: 'Box of 12', serves: '12 pieces', price: 800 }
    ],
    colors: { sponge: '#3B2218', cream: '#3B2218', top: '#5A3526', garnish: '#F7E3A1' }
  }
];

const categories = ['All', ...new Set(products.map((p) => p.category))];

function findProduct(slug) {
  return products.find((p) => p.slug === slug);
}

module.exports = { products, categories, findProduct };
