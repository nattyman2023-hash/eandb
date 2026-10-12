import { BUSINESS, SITE_ORIGIN } from "@/lib/siteContent";
import { CATALOGUE_SNAPSHOT, isoDuration, openingHoursSpecification, type CatalogueService } from "@/lib/catalogue";

export const BUSINESS_ID = `${SITE_ORIGIN}/#business`;
export const DEFAULT_SHARE_IMAGE = `${SITE_ORIGIN}/eandb-logo.svg`;

export function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, SITE_ORIGIN).href;
}

// Opening hours come from WubSync's catalogue snapshot (the hours online booking
// enforces), so visible hours, structured data and the booking engine agree.
// schema.org price that matches how the price is shown: an exact price for
// "fixed", a minimum for "from", min-max for "range", and none for "varies"
// (no invented figure).
export function offerPrice(service: CatalogueService) {
  const type = service.priceType || "from";
  if (type === "varies") return {};
  if (type === "fixed") return { price: service.basePrice, priceCurrency: "GBP" };
  return {
    priceCurrency: "GBP",
    priceSpecification: {
      "@type": "PriceSpecification",
      minPrice: service.basePrice,
      ...(type === "range" && service.priceMax != null ? { maxPrice: service.priceMax } : {}),
      priceCurrency: "GBP",
    },
  };
}

export function hairSalonJsonLd() {
  const catalogue = CATALOGUE_SNAPSHOT;
  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": BUSINESS_ID,
    name: BUSINESS.name,
    url: `${SITE_ORIGIN}/`,
    image: DEFAULT_SHARE_IMAGE,
    logo: DEFAULT_SHARE_IMAGE,
    telephone: BUSINESS.phoneE164,
    email: BUSINESS.email,
    priceRange: "££",
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS.streetAddress,
      addressLocality: BUSINESS.city,
      postalCode: BUSINESS.postcode,
      addressCountry: "GB",
    },
    hasMap: BUSINESS.mapsUrl,
    ...(openingHoursSpecification(catalogue.openingHours) ? { openingHoursSpecification: openingHoursSpecification(catalogue.openingHours) } : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "E & B Hair services",
      itemListElement: catalogue.categories.map((category) => ({
        "@type": "OfferCatalog",
        name: category.name,
        itemListElement: catalogue.services
          .filter((service) => service.category === category.slug)
          .map((service) => ({
            "@type": "Offer",
            url: absoluteUrl(`/services/${service.slug}`),
            ...offerPrice(service),
            itemOffered: { "@type": "Service", name: service.name },
          })),
      })),
    },
  };
}

export function serviceJsonLd(service: CatalogueService) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description || undefined,
    serviceType: service.categoryName || undefined,
    url: absoluteUrl(`/services/${service.slug}`),
    image: service.cover?.image,
    provider: { "@id": BUSINESS_ID, "@type": "HairSalon", name: BUSINESS.name, url: `${SITE_ORIGIN}/` },
    areaServed: { "@type": "City", name: BUSINESS.city },
    offers: { "@type": "Offer", url: absoluteUrl(`/services/${service.slug}`), ...offerPrice(service) },
    ...(service.durationMinutes ? { timeRequired: isoDuration(service.durationMinutes) } : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
