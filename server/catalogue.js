// E & B's service catalogue lives in WubSync. This site never keeps its own copy of
// services or prices: it reads the same unauthenticated catalogue the WubSync
// booking flow uses, keeps only public marketing fields, and shows that.
//
// Used by the server (/api/catalogue, cached) and by scripts/fetch-catalogue.mjs
// (the build-time snapshot the prerendered pages are generated from).

const BOOKING_ORIGIN = 'https://booking.eandbhair.co.uk';
// include=options: every service's offered option groups and add-ons with E & B's
// own price/duration modifiers, in the same single request.
const CATALOGUE_URL = `${BOOKING_ORIGIN}/api/v1/book/eandb/catalogue?include=options`;
const PRICE_TYPES = new Set(['fixed', 'from', 'varies', 'range']);
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

// Signed modifier (an option/add-on may add or, in principle, remove time/money).
function delta(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function optionGroups(value) {
  return (Array.isArray(value) ? value : [])
    .filter((group) => group && SLUG_PATTERN.test(group.slug || '') && Array.isArray(group.values))
    .map((group) => ({
      slug: group.slug,
      name: text(group.name, 120),
      helpText: nullableText(group.help_text, 255),
      values: group.values
        .filter((v) => v && SLUG_PATTERN.test(v.slug || ''))
        .map((v) => ({ slug: v.slug, label: text(v.label, 120), priceDelta: delta(v.price_delta), durationDelta: Math.round(delta(v.duration_delta_minutes)) })),
    }))
    .filter((group) => group.name && group.values.length);
}

function addons(value) {
  return (Array.isArray(value) ? value : [])
    .filter((addon) => addon && SLUG_PATTERN.test(addon.slug || ''))
    .map((addon) => ({
      slug: addon.slug,
      name: text(addon.name, 120),
      description: nullableText(addon.description, 255),
      priceDelta: delta(addon.price_delta),
      durationDelta: Math.round(delta(addon.duration_delta_minutes)),
    }))
    .filter((addon) => addon.name);
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
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
function openingHours(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const day of DAY_KEYS) {
    const v = raw[day];
    out[day] = v && CLOCK.test(String(v.open || '').slice(0, 5)) && CLOCK.test(String(v.close || '').slice(0, 5))
      ? { open: String(v.open).slice(0, 5), close: String(v.close).slice(0, 5) }
      : null;
  }
  return DAY_KEYS.some((day) => out[day]) ? out : null;
}
function sanitiseCatalogue(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.services)) {
    throw new Error('WubSync catalogue response is missing services');
  }
  if (raw.business?.slug && raw.business.slug !== 'eandb') {
    throw new Error(`WubSync returned the ${raw.business.slug} catalogue instead of eandb`);
  }

  const services = raw.services
    // Both branches offer the same menu: every active service is listed, even one
    // this branch cannot staff yet (WubSync offers the other branch for it).
    .filter((service) => service && service.active !== false)
    .filter((service) => SLUG_PATTERN.test(service.slug) && SLUG_PATTERN.test(service.category || ''))
    .map((service) => ({
      slug: service.slug,
      bookableHere: service.bookable !== false,
      name: text(service.name, 200),
      category: service.category,
      categoryName: text(service.category_name, 200),
      description: text(service.description),
      whatsIncluded: Array.isArray(service.whats_included)
        ? service.whats_included.map((item) => text(item, 300)).filter(Boolean)
        : [],
      shortDescription: text(service.short_description, 255),
      cover: cover(service.cover, text(service.name, 200)),
      basePrice: money(service.base_price),
      priceType: PRICE_TYPES.has(service.price_type) ? service.price_type : 'from',
      priceMax: service.price_max == null ? null : money(service.price_max),
      durationMinutes: minutes(service.duration_minutes),
      isAddOn: service.is_add_on === true,
      family: nullableText(service.family, 120),
      optionLabel: nullableText(service.option_label, 80),
      // Extra category slugs (secondary listings) + search words, from WubSync.
      categories: [service.category, ...(Array.isArray(service.categories) ? service.categories : [])]
        .filter((slug, index, all) => SLUG_PATTERN.test(slug || '') && all.indexOf(slug) === index),
      tags: (Array.isArray(service.tags) ? service.tags : []).map((tag) => text(tag, 60).toLowerCase()).filter(Boolean).slice(0, 30),
      optionGroups: optionGroups(service.option_groups),
      addons: addons(service.addons),
    }))
    .filter((service) => service.name && (service.basePrice !== null || service.priceType === 'varies'));

  const usedCategories = new Set(services.flatMap((service) => service.categories));
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
    // The salon's authoritative weekly hours from WubSync (Business Settings →
    // Opening hours); null when WubSync has none — never typed into this site.
    openingHours: openingHours(raw.opening_hours),
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
