// Centralised content for the public marketing pages. Services and prices are NOT
// here: they come from the WubSync catalogue (see src/lib/catalogue.ts).

import heroCharcoal from "@/assets/hero-charcoal.jpg";
import bookingCharcoal from "@/assets/booking-charcoal.jpg";
import trustLifestyleImg from "@/assets/trust-lifestyle.jpg";
import ctaEmber from "@/assets/cta-ember.jpg";
import { CATALOGUE_SNAPSHOT } from "@/lib/catalogue";

export const SITE_ORIGIN = "https://eandbhair.co.uk";

const crm = CATALOGUE_SNAPSHOT;
const streetAddress = [crm.location.addressLine1, crm.location.addressLine2].filter(Boolean).join(", ");
const city = crm.location.city || "Manchester";
const postcode = crm.location.postcode || "";

// Address and email come from the E & B business/location records in WubSync. The
// CRM has no phone number for E & B; the number below was confirmed by the owner as
// E & B's own phone and WhatsApp number (it is not WUB's).
const phoneDisplay = "07472 397993";
const phoneE164 = "+447472397993";

export const BUSINESS = {
  name: "E & B Hair",
  phone: phoneDisplay,
  phoneE164,
  phoneHref: `tel:${phoneE164}`,
  whatsappNumber: "447472397993",
  email: crm.location.email || crm.business.email || "contact@eandbhair.co.uk",
  streetAddress,
  city,
  postcode,
  address: [streetAddress, `${city} ${postcode}`.trim()].filter(Boolean).join(", "),
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`E & B Hair, ${streetAddress}, ${city} ${postcode}`)}`,
  mapsEmbedUrl: `https://www.google.com/maps?q=${encodeURIComponent(`${streetAddress}, ${city} ${postcode}`)}&output=embed`,
};

// WhatsApp is for questions and enquiries only. Booking happens in WubSync.
export function whatsappLink(message = "Hello E & B Hair, I have a question.") {
  return `https://wa.me/${BUSINESS.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

// ─── Images ──────────────────────────────────────────────

export const IMAGES = {
  heroHome: heroCharcoal,
  heroBooking: bookingCharcoal,
  trustLifestyle: trustLifestyleImg,
  ctaBg: ctaEmber,
};

// ─── Areas ────────────────────────────────────────────

export interface Borough {
  slug: string;
  name: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  faqs: { q: string; a: string }[];
  image: string;
}

const where = `${BUSINESS.streetAddress}, ${BUSINESS.city} ${BUSINESS.postcode}`;
const bookingFaq = {
  q: "How do I book?",
  a: "Choose your service, date and time on our online booking page. The final price is confirmed there once you pick your options.",
};

export const BOROUGHS: Borough[] = [
  {
    slug: "manchester",
    name: "Manchester",
    intro: `Looking for braids in Manchester? E & B Hair offers knotless braids, box braids, cornrows, twists, loc grooming and treatments from our salon at ${where}.`,
    metaTitle: "Braiding Salon Manchester | Knotless, Box Braids & Cornrows | E & B Hair",
    metaDescription: "E & B Hair, Manchester: knotless braids, box braids, cornrows, twists, locs and hair treatments. Book online.",
    image: "https://images.unsplash.com/photo-1515586838455-8f8f940d6853?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      { q: "Where is the salon?", a: `We're at ${where}.` },
      bookingFaq,
      { q: "What are your opening hours?", a: "Available times are shown when you book online. For anything else, call or message us." },
    ],
  },
  {
    slug: "fallowfield",
    name: "Fallowfield",
    intro: `Serving Fallowfield from ${where}. Protective styles, cornrows and treatments, booked online in a few taps.`,
    metaTitle: "Braids Fallowfield | Knotless & Box Braids | E & B Hair",
    metaDescription: "Braiding salon serving Fallowfield: knotless braids, box braids, cornrows and twists. Book online with E & B Hair.",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      { q: "Where are you in relation to Fallowfield?", a: `We're at ${where}, a short trip from Fallowfield.` },
      bookingFaq,
    ],
  },
  {
    slug: "rusholme",
    name: "Rusholme",
    intro: `Rusholme clients visit E & B Hair for braids, cornrows and loc grooming. Find us at ${where}.`,
    metaTitle: "Braids Rusholme | Cornrows & Knotless Braids | E & B Hair",
    metaDescription: "Braiding salon serving Rusholme: cornrows, knotless and box braids, twists and loc grooming. Book online.",
    image: "https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      { q: "Do you do cornrows?", a: "Yes. Our current cornrow styles, with prices, are listed on the services page." },
      bookingFaq,
    ],
  },
  {
    slug: "longsight",
    name: "Longsight",
    intro: `Serving Longsight and Levenshulme from ${where}. Clear starting prices for every style, confirmed when you book.`,
    metaTitle: "Braids Longsight | Box Braids & Twists | E & B Hair",
    metaDescription: "Braiding salon serving Longsight: box braids, knotless braids, twists and cornrows. See prices and book online.",
    image: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      { q: "Do you braid children's hair?", a: "Yes. Children's styles are listed on our services page with their starting prices." },
      bookingFaq,
    ],
  },
  {
    slug: "moss-side",
    name: "Moss Side",
    intro: `Moss Side clients trust E & B Hair for neat braids and restorative treatments, a short trip away at ${where}.`,
    metaTitle: "Braids Moss Side | Protective Styles | E & B Hair",
    metaDescription: "Braiding salon serving Moss Side: knotless braids, box braids, cornrows and treatments. Book online.",
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      bookingFaq,
      { q: "Can I ask a question before booking?", a: "Of course. Call, email or message us on WhatsApp." },
    ],
  },
  {
    slug: "didsbury",
    name: "Didsbury",
    intro: `Didsbury clients visit E & B Hair at ${where} for detailed braids, twists and moisture treatments.`,
    metaTitle: "Braids Didsbury | Knotless Braids & Twists | E & B Hair",
    metaDescription: "Braiding salon serving Didsbury: knotless braids, box braids, Senegalese twists and treatments. Book online.",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      bookingFaq,
      { q: "How long does a braiding appointment take?", a: "Each service lists an estimated duration. It can vary with hair length, thickness and the options you choose." },
    ],
  },
];
