import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import snapshot from "@/data/catalogue.json";
import {
  priceLabel, priceRangeNote, modifierLabel, searchServices, servicesByCategory, inCategory,
  type Catalogue,
} from "@/lib/catalogue";
import { BOOKING_URL, serviceBookingUrl, MANAGE_BOOKING_URL } from "@/lib/booking";

// E & B catalogue parity: the same catalogue capabilities the WUB booking flow has
// (price wording, options, add-ons, search, categories, View all, booking
// handoff) working on E & B's OWN WubSync data — never WUB's.
const require = createRequire(import.meta.url);
const { sanitiseCatalogue, CATALOGUE_URL } = require("../../server/catalogue.js");
const catalogue = snapshot as Catalogue;

describe("E & B catalogue parity", () => {
  it("A. lists every E & B service from WubSync (same menu as WUB), flagging any this branch cannot staff yet", () => {
    const raw = {
      business: { slug: "eandb", name: "E & B Hair" },
      categories: [{ slug: "cornrows", name: "Cornrows", sort_order: 1 }],
      services: [
        { slug: "two-cornrows", name: "2 Cornrows", category: "cornrows", base_price: 10, duration_minutes: 30, bookable: true, price_type: "from", option_groups: [], addons: [] },
        { slug: "nobody-qualified", name: "At WUB for now", category: "cornrows", base_price: 20, duration_minutes: 30, bookable: false },
        { slug: "retired", name: "Retired", category: "cornrows", base_price: 20, duration_minutes: 30, active: false },
      ],
      opening_hours: { mon: { open: "09:00", close: "20:00" }, sun: { open: "10:30", close: "18:00" } },
    };
    const clean = sanitiseCatalogue(raw);
    expect(clean.services.map((s: { slug: string }) => s.slug)).toEqual(["two-cornrows", "nobody-qualified"]);
    expect(clean.services.map((s: { bookableHere: boolean }) => s.bookableHere)).toEqual([true, false]);
    expect(clean.openingHours.mon).toEqual({ open: "09:00", close: "20:00" });
    expect(clean.openingHours.tue).toBeNull();
    expect(CATALOGUE_URL).toBe("https://booking.eandbhair.co.uk/api/v1/book/eandb/catalogue?include=options");
    expect(catalogue.services.length).toBeGreaterThan(0);
  });

  it("B/C. every service has a price (or explicit Price varies) and a duration", () => {
    for (const s of catalogue.services) {
      if (s.priceType !== "varies") expect(s.basePrice).toBeGreaterThan(0);
      expect(s.durationMinutes).toBeGreaterThan(0);
    }
  });

  it("price wording follows the WubSync price type, never a false fixed price", () => {
    expect(priceLabel({ basePrice: 20, priceType: "fixed" })).toBe("£20");
    expect(priceLabel({ basePrice: 45, priceType: "from" })).toBe("From £45");
    expect(priceLabel({ basePrice: 45 })).toBe("From £45");
    expect(priceLabel({ basePrice: 100, priceType: "varies" })).toBe("Price varies");
    expect(priceRangeNote({ basePrice: 85, priceType: "range", priceMax: 180 })).toBe("Typically £85–£180");
    expect(modifierLabel(15, 30)).toBe("+£15 · +30 mins");
    expect(modifierLabel(0, 0)).toBe("Included");
  });

  it("D/E. options and add-ons are E & B's own configuration, per service", () => {
    const withOptions = catalogue.services.filter((s) => (s.optionGroups || []).length);
    expect(withOptions.length).toBeGreaterThan(0);
    for (const s of catalogue.services) for (const g of s.optionGroups || []) expect(g.values.length).toBeGreaterThan(0);
  });

  it("F. every service renders an image (own photo or E & B category cover), served by the E & B booking host", () => {
    for (const s of catalogue.services) {
      if (s.cover) expect(s.cover.image.startsWith("https://booking.eandbhair.co.uk/")).toBe(true);
    }
  });

  it("G. search matches word starts across name, category and tags", () => {
    const fixture: Catalogue = {
      ...catalogue,
      categories: [{ slug: "mens", name: "Men's", description: "", cover: null, sortOrder: 1 }, { slug: "womens", name: "Women's", description: "", cover: null, sortOrder: 2 }],
      services: [
        { slug: "a", name: "Men's Twists", category: "mens", categoryName: "Men's", description: "", whatsIncluded: [], cover: null, basePrice: 30, durationMinutes: 60, isAddOn: false },
        { slug: "b", name: "Women's Cornrows", category: "womens", categoryName: "Women's", description: "", whatsIncluded: [], cover: null, basePrice: 30, durationMinutes: 60, isAddOn: false, tags: ["kids"] },
      ],
    };
    expect(searchServices(fixture, "men").map((s) => s.slug)).toEqual(["a"]);
    expect(searchServices(fixture, "cornrow").map((s) => s.slug)).toEqual(["b"]);
    expect(searchServices(fixture, "kids").map((s) => s.slug)).toEqual(["b"]);
    expect(searchServices(fixture, "").length).toBe(2);
    expect(searchServices(catalogue, "knotless").length).toBeGreaterThan(0);
  });

  it("H/I. View all groups every service exactly once; a category filter shows only that category", () => {
    const all = servicesByCategory(catalogue).flatMap((g) => g.services.map((s) => s.slug));
    expect(new Set(all).size).toBe(catalogue.services.length);
    for (const category of catalogue.categories) {
      const filtered = servicesByCategory(catalogue, category.slug);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].services.every((s) => inCategory(s, category.slug))).toBe(true);
    }
  });

  it("J. booking links use WubSync's E & B routes only", () => {
    expect(BOOKING_URL).toBe("https://booking.eandbhair.co.uk/book/eandb");
    expect(serviceBookingUrl("medium-knotless")).toBe("https://booking.eandbhair.co.uk/book/eandb/service/medium-knotless");
    expect(serviceBookingUrl("../evil")).toBe(BOOKING_URL);
    expect(MANAGE_BOOKING_URL).toBe("https://booking.eandbhair.co.uk/book/lookup");
  });

  it("K. no WUB catalogue, prices or contact can leak in", () => {
    expect(() => sanitiseCatalogue({ business: { slug: "wub" }, services: [] })).toThrow(/wub catalogue instead of eandb/);
    const text = JSON.stringify(catalogue);
    expect(text).not.toMatch(/wubhairstudio|Claremont/i);
    expect(catalogue.location.addressLine1).toBe("171 Princess Rd");
  });
});
