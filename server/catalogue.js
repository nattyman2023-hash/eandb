// E & B's service catalogue lives in WubSync. This site never keeps its own copy of
// services or prices: it reads the same unauthenticated catalogue the WubSync
// booking flow uses, keeps only public marketing fields, and shows that.
//
// Used by the server (/api/catalogue, cached) and by scripts/fetch-catalogue.mjs
// (the build-time snapshot the prerendered pages are generated from).

const BOOKING_ORIGIN = 'https://booking.eandbhair.co.uk';
const CATALOGUE_URL = `${BOOKING_ORIGIN}/api/v1/book/eandb/catalogue`;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function text(value, maximumLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function nullableText(value, maximumLength) {
  return text(value, maximumLength) || null;
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

function minutes(value) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : null;
}

// WubSync returns cover paths relative to the booking host.
function cover(value, fallbackAlt) {
  const image = text(value?.image, 500);
  if (!image) return null;
  let url;
  try {
    url = new URL(image, BOOKING_ORIGIN);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  return { image: url.href, alt: text(value?.alt, 200) || fallbackAlt };
}

// Only fields the public marketing site needs. Deposits, buffers, internal ids,
// timestamps and anything staff-related are deliberately dropped.
function sanitiseCatalogue(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.services)) {
    throw new Error('WubSync catalogue response is missing services');
  }
  if (raw.business?.slug && raw.business.slug !== 'eandb') {
    throw new Error(`WubSync returned the ${raw.business.slug} catalogue instead of eandb`);
  }

  const services = raw.services
    .filter((service) => service && service.active !== false && service.bookable !== false)
    .filter((service) => SLUG_PATTERN.test(service.slug) && SLUG_PATTERN.test(service.category || ''))
    .map((service) => ({
      slug: service.slug,
      name: text(service.name, 200),
      category: service.category,
      categoryName: text(service.category_name, 200),
      description: text(service.description),
      whatsIncluded: Array.isArray(service.whats_included)
        ? service.whats_included.map((item) => text(item, 300)).filter(Boolean)
        : [],
      cover: cover(service.cover, text(service.name, 200)),
      basePrice: money(service.base_price),
      durationMinutes: minutes(service.duration_minutes),
      isAddOn: service.is_add_on === true,
    }))
    .filter((service) => service.name && service.basePrice !== null);

  const usedCategories = new Set(services.map((service) => service.category));
  const categories = (Array.isArray(raw.categories) ? raw.categories : [])
    .filter((category) => category && SLUG_PATTERN.test(category.slug) && usedCategories.has(category.slug))
    .map((category) => ({
      slug: category.slug,
      name: text(category.name, 200),
      description: text(category.desc ?? category.description),
      cover: cover(category.cover, text(category.name, 200)),
      sortOrder: Number.isFinite(Number(category.sort_order)) ? Number(category.sort_order) : 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // A service whose category is not in the category list still has to be shown.
  for (const service of services) {
    if (!categories.some((category) => category.slug === service.category)) {
      categories.push({
        slug: service.category,
        name: service.categoryName || service.category,
        description: '',
        cover: null,
        sortOrder: Number.MAX_SAFE_INTEGER,
      });
    }
  }

  const location = raw.location || {};
  const business = raw.business || {};
  const serviceSlugs = new Set(services.map((service) => service.slug));

  return {
    source: CATALOGUE_URL,
    fetchedAt: new Date().toISOString(),
    business: {
      name: text(business.public_display_name || business.name, 200) || 'E & B Hair',
      email: nullableText(business.general_email, 320),
      website: nullableText(business.website, 300),
    },
    location: {
      addressLine1: nullableText(location.address_line1, 200),
      addressLine2: nullableText(location.address_line2, 200),
      city: nullableText(location.city, 100),
      region: nullableText(location.region, 100),
      postcode: nullableText(location.postcode, 20),
      phone: nullableText(location.phone, 40),
      email: nullableText(location.email, 320),
    },
    categories,
    services,
    popular: (Array.isArray(raw.popular) ? raw.popular : [])
      .map((service) => service?.slug)
      .filter((slug) => serviceSlugs.has(slug)),
  };
}

async function fetchCatalogue({ timeoutMs = 8000 } = {}) {
  const response = await fetch(CATALOGUE_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`WubSync catalogue responded ${response.status}`);
  return sanitiseCatalogue(await response.json());
}

module.exports = { BOOKING_ORIGIN, CATALOGUE_URL, sanitiseCatalogue, fetchCatalogue };
