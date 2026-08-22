// Centralised content config for public-facing SEO pages (areas + services)

import heroCharcoal from "@/assets/hero-charcoal.jpg";
import bookingCharcoal from "@/assets/booking-charcoal.jpg";
import trustLifestyleImg from "@/assets/trust-lifestyle.jpg";
import ctaEmber from "@/assets/cta-ember.jpg";

export const BUSINESS = {
  name: "E and B",
  phone: "07472 397993",
  phoneHref: "tel:+447472397993",
  whatsapp: "https://wa.me/447472397993",
  email: "hello@eandbhair.co.uk",
  address: "174 Claremont Road, Manchester M14 4TT",
  tagline: "Bold Cuts. Sharp Style. Manchester's Charcoal-and-Ember Salon.",
};

// ─── Images ──────────────────────────────────────────────

export const IMAGES = {
  heroHome: heroCharcoal,
  heroBooking: bookingCharcoal,
  trustLifestyle: trustLifestyleImg,
  ctaBg: ctaEmber,
  manchesterCity: trustLifestyleImg,
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

export const BOROUGHS: Borough[] = [
  {
    slug: "manchester",
    name: "Manchester",
    intro:
      "Looking for a professional hair salon in Manchester? E and B offers hairdressing and braiding services from our salon at 174 Claremont Road, M14 4TT.",
    metaTitle: "Hair Salon Manchester | Hairdressing & Braiding | E and B",
    metaDescription:
      "Professional hair salon in Manchester. Hairdressing, braiding & hair treatments. Book online now.",
    image: "https://images.unsplash.com/photo-1515586838455-8f8f940d6853?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      { q: "Where is your salon located?", a: "We're at 174 Claremont Road, Manchester M14 4TT — easy to reach from all Manchester postcodes." },
      { q: "Do I need to book in advance?", a: "We recommend booking online, but walk-ins are welcome subject to availability." },
      { q: "What are your opening hours?", a: "We're open Monday to Saturday. Book online for the latest availability." },
    ],
  },
  {
    slug: "fallowfield",
    name: "Fallowfield",
    intro:
      "Serving Fallowfield and surrounding areas from our Claremont Road salon. All hair services — braids, cuts, colour and treatments — available with easy walk-in or online booking.",
    metaTitle: "Hair Salon Fallowfield | Braiding & Hairdressing | E and B",
    metaDescription:
      "Professional hair salon serving Fallowfield. Braiding, fades, cuts & colour. Book online today.",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      { q: "How far are you from Fallowfield?", a: "We're right on Claremont Road — just minutes away from Fallowfield centre." },
      { q: "Can I book online?", a: "Yes, use our online booking form and select your preferred date and time." },
    ],
  },
  {
    slug: "rusholme",
    name: "Rusholme",
    intro:
      "Rusholme residents love E and B for expert braiding, fades and hair treatments. Visit our salon on Claremont Road — just a short walk away.",
    metaTitle: "Hair Salon Rusholme | Braids & Fades | E and B",
    metaDescription:
      "Expert hair salon serving Rusholme. Braiding & hairdressing. Walk-ins welcome. Book now.",
    image: "https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      { q: "Do you do cornrows?", a: "Yes! We specialise in all braiding styles including cornrows, box braids, twists and more." },
      { q: "What are your opening hours?", a: "We're open Monday to Saturday. Book online for the latest availability." },
    ],
  },
  {
    slug: "longsight",
    name: "Longsight",
    intro:
      "Serving Longsight and Levenshulme from our Manchester salon. Professional hairdressing and braiding at affordable prices.",
    metaTitle: "Hair Salon Longsight | Affordable Styling | E and B",
    metaDescription:
      "Affordable hair salon serving Longsight. Fades, braids, cuts & colour. Book your appointment now.",
    image: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      { q: "Do you offer student discounts?", a: "Get in touch — we run regular promotions for local students." },
      { q: "Do you do children's haircuts?", a: "Yes, we welcome clients of all ages at our salon." },
    ],
  },
  {
    slug: "moss-side",
    name: "Moss Side",
    intro:
      "Moss Side clients trust E and B for expert braiding and hair treatments. Just a short trip to our Claremont Road location.",
    metaTitle: "Hair Salon Moss Side | Braiding & Hairdressing | E and B",
    metaDescription:
      "Trusted hair salon serving Moss Side. Expert braiding, fades & styling. Book today.",
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      { q: "How do I book?", a: "Simply fill in our online booking form or call us directly." },
      { q: "Do you work on weekends?", a: "Yes, we offer Saturday appointments — book early as slots fill fast." },
    ],
  },
  {
    slug: "didsbury",
    name: "Didsbury",
    intro:
      "Didsbury residents — experience premium hair services at E and B. From precision fades to intricate braids, we've got you covered.",
    metaTitle: "Hair Salon Didsbury | Premium Styling | E and B",
    metaDescription:
      "Premium hair salon serving Didsbury. Braiding, colour & treatments. Book online.",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80",
    faqs: [
      { q: "Do you do balayage and highlights?", a: "Yes — our hairdressing services include all colour techniques." },
      { q: "Can I book online?", a: "Absolutely — use our online form and we'll confirm your slot." },
    ],
  },
];

// ─── Services ────────────────────────────────────────────

export interface ServiceInfo {
  slug: string;
  name: string;
  shortDesc: string;
  longDesc: string;
  included: string[];
  metaTitle: string;
  metaDescription: string;
  image: string;
  durationMinutes?: number;
}

export const SERVICES: ServiceInfo[] = [
  {
    slug: "hairdressing",
    name: "Hairdressing",
    shortDesc: "Cuts, colour, blowdry and styling for all hair types.",
    longDesc:
      "From precision cuts and vibrant colour to blowouts and special occasion styling, our hairdressers work with all hair types and textures. We use premium products to keep your hair healthy and looking its best.",
    included: ["Cut & style", "Full colour / highlights", "Blowdry & finish", "Deep conditioning treatment"],
    metaTitle: "Hairdresser Manchester | Cuts & Colour | E and B",
    metaDescription:
      "Professional hairdressing in Manchester. Cuts, colour, blowdry & styling for all hair types. Book online.",
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
    durationMinutes: 60,
  },
  {
    slug: "braiding",
    name: "Braiding",
    shortDesc: "Box braids, cornrows, twists and protective styles.",
    longDesc:
      "Our braiding specialists create stunning protective styles including box braids, cornrows, Senegalese twists, knotless braids and more. We take the time to ensure every braid is neat, comfortable and long-lasting. Please note braiding appointments typically take 4–6 hours.",
    included: ["Box braids", "Cornrows", "Senegalese twists", "Knotless braids", "Feed-in braids"],
    metaTitle: "Braiding Manchester | Box Braids & Cornrows | E and B",
    metaDescription:
      "Expert braiding in Manchester. Box braids, cornrows, twists & protective styles. Book your session.",
    image: "https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=1200&q=80",
    durationMinutes: 300,
  },
  {
    slug: "hair-treatments",
    name: "Hair Treatments",
    shortDesc: "Deep conditioning, keratin and scalp treatments.",
    longDesc:
      "Restore, repair and rejuvenate your hair with our professional treatment menu. From deep conditioning masks and protein treatments to keratin smoothing, we'll create a tailored treatment plan for your hair's needs.",
    included: ["Deep conditioning mask", "Protein treatment", "Keratin smoothing", "Scalp treatment", "Hot oil therapy"],
    metaTitle: "Hair Treatments Manchester | Deep Conditioning & Keratin | E and B",
    metaDescription:
      "Professional hair treatments in Manchester. Deep conditioning, keratin, scalp treatments & more. Book today.",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80",
    durationMinutes: 90,
  },
];
