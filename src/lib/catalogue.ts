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

export type PriceType = "fixed" | "from" | "varies" | "range";

export interface CatalogueOptionValue {
  slug: string;
  label: string;
  priceDelta: number;
  durationDelta: number;
}

export interface CatalogueOptionGroup {
  slug: string;
  name: string;
  helpText: string | null;
  values: CatalogueOptionValue[];
}

export interface CatalogueAddon {
  slug: string;
  name: string;
  description: string | null;
  priceDelta: number;
  durationDelta: number;
}

export interface CatalogueService {
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  description: string;
  shortDescription?: string;
  whatsIncluded: string[];
  cover: CatalogueCover | null;
  basePrice: number;
  priceType?: PriceType;
  priceMax?: number | null;
  durationMinutes: number | null;
  isAddOn: boolean;
  family?: string | null;
  optionLabel?: string | null;
  categories?: string[];
  tags?: string[];
  optionGroups?: CatalogueOptionGroup[];
  addons?: CatalogueAddon[];
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

// One section per category, each listing the services whose PRIMARY category it
// is, so nothing repeats in the full list. A category filter instead shows
// every service listed under it (primary or secondary).
export function servicesByCategory(catalogue: Catalogue, filterSlug = "") {
  return catalogue.categories
    .filter((category) => !filterSlug || category.slug === filterSlug)
    .map((category) => ({
      category,
      services: catalogue.services.filter((service) =>
        filterSlug ? inCategory(service, category.slug) : service.category === category.slug,
      ),
    }))
    .filter((group) => group.services.length > 0);
}

export function inCategory(service: CatalogueService, slug: string) {
  return !slug || (service.categories?.length ? service.categories : [service.category]).includes(slug);
}

// Search: every query word must match the START of a word in the service's
// name, category, family/option, tags or description — so "men" never matches
// "women", "cornrow" finds "Cornrows" and "loc" finds "Locs".
function normaliseText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/['’]s\b/g, "s")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function searchServices(catalogue: Catalogue, query: string) {
  const tokens = normaliseText(query).split(" ").filter(Boolean);
  if (!tokens.length) return catalogue.services;
  const categoryNames = new Map(catalogue.categories.map((category) => [category.slug, category.name]));
  return catalogue.services.filter((service) => {
    const words = new Set(normaliseText([
      service.name, service.family, service.optionLabel, service.shortDescription, service.description,
      service.categoryName, ...(service.categories || [service.category]).map((slug) => categoryNames.get(slug) || slug),
      ...(service.tags || []),
    ].filter(Boolean).join(" ")).split(" ").filter(Boolean));
    return tokens.every((token) => {
      const variants = [token, token.replace(/s$/, ""), `${token}s`].filter(Boolean);
      for (const word of words) if (variants.some((variant) => word.startsWith(variant))) return true;
      return false;
    });
  });
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

// How the salon presents a price (WubSync price_type). "From" whenever the final
// amount can change, "Price varies" with no invented figure, and a range's upper
// figure only ever as context — never as the advertised price.
export function priceLabel(service: Pick<CatalogueService, "basePrice" | "priceType">) {
  const type = service.priceType || "from";
  if (type === "varies") return "Price varies";
  if (type === "fixed") return formatPrice(service.basePrice);
  return `From ${formatPrice(service.basePrice)}`;
}

export function priceRangeNote(service: Pick<CatalogueService, "basePrice" | "priceType" | "priceMax">) {
  if (service.priceType !== "range" || service.priceMax == null) return null;
  return `Typically ${formatPrice(service.basePrice)}–${formatPrice(service.priceMax)}`;
}

// "+£15 · +30 mins", "Included" for a zero modifier.
export function modifierLabel(priceDelta: number, durationDelta: number) {
  const parts: string[] = [];
  if (priceDelta) parts.push(`${priceDelta > 0 ? "+" : "−"}${formatPrice(Math.abs(priceDelta))}`);
  if (durationDelta) parts.push(`${durationDelta > 0 ? "+" : "−"}${formatDuration(Math.abs(durationDelta))}`);
  return parts.length ? parts.join(" · ") : "Included";
}

// A group the customer can actually choose from (2+ values), vs a single fixed value.
export function choosableGroups(service: CatalogueService) {
  return (service.optionGroups || []).filter((group) => group.values.length > 1);
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
