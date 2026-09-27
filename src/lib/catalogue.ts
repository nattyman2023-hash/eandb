import { useEffect, useState } from "react";
import snapshot from "@/data/catalogue.json";

// The catalogue is WubSync's, not this site's. Pages render from the build-time
// snapshot (so prerendered HTML is complete), then swap in the live copy from
// /api/catalogue, which the server caches from WubSync. One request per page load,
// shared by every component that asks.

export interface CatalogueCover {
  image: string;
  alt: string;
}

export interface CatalogueService {
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  description: string;
  whatsIncluded: string[];
  cover: CatalogueCover | null;
  basePrice: number;
  durationMinutes: number | null;
  isAddOn: boolean;
}

export interface CatalogueCategory {
  slug: string;
  name: string;
  description: string;
  cover: CatalogueCover | null;
  sortOrder: number;
}

export interface Catalogue {
  source: string;
  fetchedAt: string;
  business: { name: string; email: string | null; website: string | null };
  location: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    postcode: string | null;
    phone: string | null;
    email: string | null;
  };
  categories: CatalogueCategory[];
  services: CatalogueService[];
  popular: string[];
}

export type CatalogueStatus = "snapshot" | "live" | "stale";

export const CATALOGUE_SNAPSHOT = snapshot as Catalogue;

let livePromise: Promise<{ catalogue: Catalogue; status: CatalogueStatus }> | null = null;

function loadLiveCatalogue() {
  if (!livePromise) {
    livePromise = fetch("/api/catalogue", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Catalogue responded ${response.status}`);
        const body = await response.json();
        if (!body?.catalogue || !Array.isArray(body.catalogue.services)) throw new Error("Malformed catalogue");
        return { catalogue: body.catalogue as Catalogue, status: (body.stale ? "stale" : "live") as CatalogueStatus };
      })
      .catch(() => ({ catalogue: CATALOGUE_SNAPSHOT, status: "stale" as CatalogueStatus }));
  }
  return livePromise;
}

export function useCatalogue() {
  const [state, setState] = useState<{ catalogue: Catalogue; status: CatalogueStatus }>({
    catalogue: CATALOGUE_SNAPSHOT,
    status: "snapshot",
  });

  useEffect(() => {
    let active = true;
    loadLiveCatalogue().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function servicesByCategory(catalogue: Catalogue) {
  return catalogue.categories
    .map((category) => ({
      category,
      services: catalogue.services.filter((service) => service.category === category.slug),
    }))
    .filter((group) => group.services.length > 0);
}

export function featuredServices(catalogue: Catalogue, count = 4) {
  const popular = catalogue.popular
    .map((slug) => catalogue.services.find((service) => service.slug === slug))
    .filter((service): service is CatalogueService => Boolean(service));
  const rest = catalogue.services.filter((service) => !service.isAddOn && !popular.includes(service));
  return [...popular, ...rest].slice(0, count);
}

export function formatPrice(amount: number) {
  return `£${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function formatDuration(totalMinutes: number | null) {
  if (!totalMinutes) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? "hr" : "hrs"}`);
  if (minutes) parts.push(`${minutes} mins`);
  return parts.join(" ");
}

// ISO 8601 duration for schema.org, e.g. PT3H or PT1H50M.
export function isoDuration(totalMinutes: number | null) {
  if (!totalMinutes) return undefined;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}`;
}

export const PRICE_DISCLAIMER =
  "Prices and estimated durations may vary depending on hair length, thickness, condition, style requirements and any additional options selected.";
