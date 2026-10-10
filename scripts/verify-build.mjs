// Build step 4: check the BUILT output, not the source. Fails the build if a page
// lost its SEO tags, if the services shown drift from the WubSync snapshot, or if
// anything that looks like a second booking/checkout system reappears.
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const distributionDirectory = path.join(projectRoot, 'dist');
const BOOKING_URL = 'https://booking.eandbhair.co.uk/book/eandb';
const MANAGE_BOOKING_URL = 'https://booking.eandbhair.co.uk/book/lookup';
const catalogue = JSON.parse(await fs.readFile(path.join(projectRoot, 'src', 'data', 'catalogue.json'), 'utf8'));
const serviceSlugs = new Set(catalogue.services.map((service) => service.slug));
const money = (amount) => `£${Number.isInteger(amount) ? amount : Number(amount).toFixed(2)}`;
// Same wording as src/lib/catalogue.ts priceLabel().
const priceLabel = (service) => (service.priceType === 'varies' ? 'Price varies' : service.priceType === 'fixed' ? money(service.basePrice) : `From ${money(service.basePrice)}`);
// The booking start, the lookup page, or WubSync's own route for a real E & B service.
const allowedBookingHref = (href) => href === BOOKING_URL || href === MANAGE_BOOKING_URL
  || (href.startsWith(`${BOOKING_URL}/service/`) && serviceSlugs.has(href.slice(`${BOOKING_URL}/service/`.length)));
const sitemap = await fs.readFile(path.join(projectRoot, 'public', 'sitemap.xml'), 'utf8');
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname || '/');
const failures = [];

function pageFile(route) {
  return route === '/' ? path.join(distributionDirectory, 'index.html') : path.join(distributionDirectory, route.slice(1), 'index.html');
}

function decode(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&#39;', "'").replaceAll('&quot;', '"');
}

function visibleText(html) {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
}

// Customer-facing wording that would mean a local booking/checkout flow or a
// public stylist picker. Checked against every page's visible text.
const FORBIDDEN_TEXT = [
  /\bcheckout\b/i, /\bcheck out\b/i, /\bshopping (?:cart|bag)\b/i, /\bbasket\b/i, /\badd to (?:cart|bag|basket)\b/i,
  /\bpay now\b/i, /\bcomplete purchase\b/i, /\bdeposit\b/i, /\bchoose (?:your|a) stylist\b/i, /\bbook with\b/i,
  /\bbook a chair\b/i, /\bI want to book\b/i, /\bI'd like to book\b/i,
];
// Links to retired local booking/shop routes or other booking providers.
const FORBIDDEN_HREF = /href="(?:\/book(?:[/?"])|\/cart|\/checkout|\/shop|\/portal|\/auth|[^"]*(?:fresha|booksy|treatwell|setmore|vagaro|square\.site|calendly|stripe)[^"]*)/i;

const pages = [];
for (const route of routes) {
  let html;
  try {
    html = await fs.readFile(pageFile(route), 'utf8');
  } catch {
    failures.push(`${route}: not prerendered`);
    continue;
  }
  pages.push({ route, html, text: visibleText(html) });
}

for (const page of pages) {
  const title = page.html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || '';
  const canonical = page.html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] || '';
  if (!title) failures.push(`${page.route}: missing <title>`);
  if (canonical !== `https://eandbhair.co.uk${page.route === '/' ? '/' : page.route}`) failures.push(`${page.route}: canonical is "${canonical}"`);
  if (!page.html.includes('application/ld+json')) failures.push(`${page.route}: missing JSON-LD`);
  if (!/property="og:image"/.test(page.html)) failures.push(`${page.route}: missing og:image`);
  if (!page.html.includes(`href="${BOOKING_URL}"`)) failures.push(`${page.route}: no Book Now link to ${BOOKING_URL}`);
  if (/target="_blank"[^>]*href="https:\/\/booking\.eandbhair|href="https:\/\/booking\.eandbhair[^"]*"[^>]*target="_blank"/.test(page.html)) failures.push(`${page.route}: booking link opens a new tab`);
  const badHref = page.html.match(FORBIDDEN_HREF);
  if (badHref) failures.push(`${page.route}: forbidden link ${badHref[0]}`);
  for (const pattern of FORBIDDEN_TEXT) {
    if (pattern.test(page.text)) failures.push(`${page.route}: forbidden wording ${pattern}`);
  }
  if (/Claremont/i.test(page.html)) failures.push(`${page.route}: shows WUB's Claremont Road address`);
  // The site has nothing to receive a form submission; enquiries go by email/WhatsApp/phone.
  if (/<form[\s>]/i.test(page.html)) failures.push(`${page.route}: contains a <form> with no working backend`);
  const bookingHrefs = [...page.html.matchAll(/href="(https:\/\/booking\.eandbhair\.co\.uk[^"]*)"/g)].map((match) => match[1]);
  const wrong = bookingHrefs.filter((href) => !allowedBookingHref(href));
  if (wrong.length) failures.push(`${page.route}: booking links outside WubSync's E & B routes: ${[...new Set(wrong)].join(', ')}`);
  if (page.html.includes('booking.wubhairstudio.co.uk')) failures.push(`${page.route}: links to the WUB booking site`);
}

// Services page must list exactly the CRM services, with CRM names and prices.
const servicesPage = pages.find((page) => page.route === '/services');
if (servicesPage) {
  const listed = [...servicesPage.html.matchAll(/<h3 class="font-display[^"]*"><a[^>]+href="\/services\/([a-z0-9-]+)"/g)].map((match) => match[1]);
  const expected = catalogue.services.map((service) => service.slug);
  const missing = expected.filter((slug) => !listed.includes(slug));
  const extra = listed.filter((slug) => !expected.includes(slug));
  if (listed.length !== expected.length || missing.length || extra.length) {
    failures.push(`/services lists ${listed.length} services, CRM has ${expected.length} (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`);
  }
  for (const service of catalogue.services) {
    const price = priceLabel(service);
    if (!servicesPage.text.includes(service.name)) failures.push(`/services: missing name "${service.name}"`);
    if (!servicesPage.text.includes(price)) failures.push(`/services: missing price "${price}" for ${service.name}`);
  }
}

for (const service of catalogue.services) {
  const route = `/services/${service.slug}`;
  const page = pages.find((item) => item.route === route);
  if (!page) continue;
  if (!page.text.includes(service.name)) failures.push(`${route}: missing service name`);
  if (!page.text.includes(priceLabel(service))) failures.push(`${route}: missing price "${priceLabel(service)}"`);
  if (!page.html.includes(`href="${BOOKING_URL}/service/${service.slug}"`)) failures.push(`${route}: no service-specific Book link`);
  for (const group of service.optionGroups || []) {
    if (!page.html.includes(`data-option-group="${group.slug}"`)) failures.push(`${route}: configured option group "${group.slug}" not shown`);
    for (const value of group.values) if (!page.text.includes(value.label)) failures.push(`${route}: option "${value.label}" not shown`);
  }
  for (const addon of service.addons || []) if (!page.text.includes(addon.name)) failures.push(`${route}: add-on "${addon.name}" not shown`);
  if (!(service.addons || []).length && page.html.includes('data-addons')) failures.push(`${route}: shows an add-ons list the service does not offer`);
}

// The JS bundle must not contain the retired local booking/payment/CRM code.
const assetDirectory = path.join(distributionDirectory, 'assets');
const bundles = (await fs.readdir(assetDirectory)).filter((name) => name.endsWith('.js'));
for (const name of bundles) {
  const code = await fs.readFile(path.join(assetDirectory, name), 'utf8');
  for (const marker of ['/api/bookings', '/api/payments', '/api/contact', 'create-booking', '/api/query', 'service_catalog', 'addProductToCart', 'stripe']) {
    if (code.includes(marker)) failures.push(`assets/${name}: contains retired "${marker}"`);
  }
}

console.log(`Pages checked: ${pages.length}; CRM services: ${catalogue.services.length}; JS bundles checked: ${bundles.length}`);
if (failures.length) {
  console.error(`Build verification failed:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('Build verification passed: SEO tags, CRM service list and prices, WubSync booking links, no checkout/cart/local booking/stylist chooser.');
