import { BUSINESS, SITE_ORIGIN } from "@/lib/siteContent";
import { CATALOGUE_SNAPSHOT, isoDuration, type CatalogueService } from "@/lib/catalogue";

export const BUSINESS_ID = `${SITE_ORIGIN}/#business`;
export const DEFAULT_SHARE_IMAGE = `${SITE_ORIGIN}/eandb-logo.svg`;

export function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, SITE_ORIGIN).href;
}

// Opening hours are intentionally absent: WubSync holds no public E & B hours and the
// hours previously on this site were WUB's. Add openingHoursSpecification once E & B
// confirms its own.
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
            priceCurrency: "GBP",
            priceSpecification: {
              "@type": "PriceSpecification",
              minPrice: service.basePrice,
              priceCurrency: "GBP",
            },
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
    offers: {
      "@type": "Offer",
      priceCurrency: "GBP",
      priceSpecification: { "@type": "PriceSpecification", minPrice: service.basePrice, priceCurrency: "GBP" },
    },
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
