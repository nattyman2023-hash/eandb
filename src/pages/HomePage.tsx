import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { BUSINESS, BOROUGHS, SERVICES, IMAGES } from "@/lib/siteContent";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useSiteImages } from "@/hooks/useSiteImages";
import SEOHead from "@/components/SEOHead";

import editorialCover from "@/assets/home-cover-cornrows.png";
import editorialClosing from "@/assets/editorial-closing.jpg";
import editorialCraft from "@/assets/home-braiding-chair.png";

const REVIEWS = [
  {
    name: "Amara K.",
    persona: "Knotless braids",
    location: "Fallowfield",
    text: "Best braiding in Manchester. They took their time and made sure every braid was perfect — mine lasted weeks looking immaculate.",
  },
  {
    name: "Marcus J.",
    persona: "Skin fade",
    location: "Rusholme",
    text: "Sharp, considered, never rushed. I have not had a bad cut here in eight months.",
  },
  {
    name: "Sophie L.",
    persona: "Colour & cut",
    location: "Didsbury",
    text: "The stylist actually listened. I left with the exact tone I asked for and have been back every six weeks since.",
  },
];

const HomePage = () => {
  const { getImage } = useSiteImages();
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const { addProductToCart } = useCart();

  useEffect(() => {
    api.from("products").select("*").eq("is_active", true).eq("is_featured", true).limit(4)
      .then(({ data }: any) => setFeaturedProducts(data || []));
  }, []);

  const issueNumber = String(new Date().getFullYear() - 2023).padStart(2, "0");

  return (
    <>
      <SEOHead
        title={`${BUSINESS.name} · Hair Salon, Manchester`}
        description={`A salon for considered hair at ${BUSINESS.address}. Hairdressing and protective styling.`}
        canonical="/"
        image={IMAGES.heroHome}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HairSalon",
            name: BUSINESS.name,
            image: IMAGES.heroHome,
            telephone: BUSINESS.phone,
            email: BUSINESS.email,
            priceRange: "££",
            openingHoursSpecification: [
              { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"], opens: "09:00", closes: "19:00" },
              { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "18:00" },
            ],
            address: {
              "@type": "PostalAddress",
              streetAddress: "174 Claremont Road",
              addressLocality: "Manchester",
              addressRegion: "Greater Manchester",
              postalCode: "M14 4TT",
              addressCountry: "GB",
            },
            areaServed: BOROUGHS.map((b) => ({ "@type": "Place", name: b.name })),
          }),
        }}
      />

      {/* ─────────── COVER ─────────── */}
      <section className="border-t border-border">
        <div className="container">
          {/* Masthead bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 py-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground border-b border-border">
            <span>Issue № {issueNumber}</span>
            <span className="hidden sm:inline">A salon journal · Manchester Edition</span>
            <span>{new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
          </div>

          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 py-12 lg:py-20 items-center">
            {/* Headline */}
            <div className="lg:col-span-6 space-y-8 animate-rise">
              <p className="eyebrow">№ 01 — On craft</p>
              <h1 className="display-xl">
                A salon for<br/>
                <span className="italic" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 60' }}>considered</span><br/>
                hair.
              </h1>
              <p className="text-base md:text-lg leading-relaxed max-w-md text-muted-foreground">
                Hairdressing and protective styling at 174 Claremont Road. Walk in for the morning, or reserve a chair below.
              </p>
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <Link to="/book">
                  <Button size="lg" className="rounded-none h-12 px-8 text-[11px] uppercase tracking-[0.22em]">
                    Book a chair
                  </Button>
                </Link>
                <Link to="/services" className="marker-link">
                  See the index
                </Link>
              </div>
            </div>

            {/* Cover image — cropped to the portrait half */}
            <div className="lg:col-span-6 relative">
              <div className="aspect-[3/4] lg:aspect-[4/5] w-full overflow-hidden bg-muted">
                <img
                  src={editorialCover}
                  alt={`A morning at ${BUSINESS.name}`}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: "75% center" }}
                  width={1200}
                  height={1500}
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
              <p className="image-caption mt-3">
                Fig. 01 — A quiet morning at 174 Claremont Road. Photographed in available light.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── THE INDEX ─────────── */}
      <section className="border-t border-border section-y">
        <div className="container">
          <div className="grid lg:grid-cols-12 gap-10 mb-12">
            <div className="lg:col-span-4">
              <p className="eyebrow mb-3">The Index</p>
              <h2 className="display-lg">Services, plainly listed.</h2>
            </div>
            <div className="lg:col-span-7 lg:col-start-6 self-end">
              <p className="text-muted-foreground max-w-lg">
                Every service is priced in plain numbers. No surprises, no add-ons hidden in a quote. Choose what you need; we'll take the time it takes.
              </p>
            </div>
          </div>

          <ol className="border-t border-foreground/80">
            {SERVICES.map((s, i) => (
              <li key={s.slug} className="border-b border-border group">
                <Link
                  to={`/services/${s.slug}`}
                  className="grid grid-cols-12 items-center gap-4 py-6 md:py-8 hover:bg-muted/40 transition-colors px-2 -mx-2"
                >
                  <span className="col-span-1 eyebrow text-foreground/60">№ {String(i + 1).padStart(2, "0")}</span>
                  <h3 className="col-span-11 md:col-span-5 font-display text-2xl md:text-4xl leading-none group-hover:text-primary transition-colors" style={{ fontVariationSettings: '"opsz" 96' }}>
                    {s.name}
                  </h3>
                  <p className="col-span-12 md:col-span-4 text-sm text-muted-foreground hidden md:block">
                    {s.shortDesc}
                  </p>
                  <span className="col-span-12 md:col-span-2 text-right flex items-center justify-end gap-2 eyebrow text-foreground">
                    {s.durationMinutes ? `${s.durationMinutes < 60 ? s.durationMinutes + 'm' : Math.floor(s.durationMinutes/60) + 'h' + (s.durationMinutes % 60 ? ' ' + (s.durationMinutes % 60) + 'm' : '')}` : '—'}
                    <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─────────── FEATURED STORY ─────────── */}
      <section className="bg-muted/40 section-y">
        <div className="container">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            <div className="lg:col-span-7">
              <img
                src={editorialCraft}
                alt="The braiding chair"
                className="w-full aspect-[4/5] object-cover"
                loading="lazy"
              />
              <p className="image-caption mt-3">Fig. 02 — Studied repetition. Twelve hands, four hours.</p>
            </div>
            <div className="lg:col-span-5 space-y-8">
              <p className="eyebrow">Feature · The braiding chair</p>
              <blockquote className="pull-quote">
                <span className="text-primary">"</span>Braiding is patience<br/>made visible.<span className="text-primary">"</span>
              </blockquote>
              <p className="text-muted-foreground leading-relaxed">
                A box-braid session runs four to six hours, sometimes more. Our specialists trained on textured hair from the start and treat protective styling as the careful craft it is — not an upsell, not a side service.
              </p>
              <Link to="/services/braiding" className="marker-link">Read about braiding</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── REVIEW ─────────── */}
      <section className="border-t border-border section-y">
        <div className="container max-w-4xl text-center space-y-10">
          <p className="eyebrow">Letters to the editor</p>
          <blockquote className="pull-quote">
            <span className="text-primary">"</span>{REVIEWS[0].text}<span className="text-primary">"</span>
          </blockquote>
          <div className="flex flex-col items-center gap-1 text-sm">
            <span className="font-medium">{REVIEWS[0].name}</span>
            <span className="text-muted-foreground">{REVIEWS[0].persona} · {REVIEWS[0].location}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-8 text-left pt-12 border-t border-border">
            {REVIEWS.slice(1).map(r => (
              <div key={r.name} className="space-y-3">
                <p className="font-display italic text-xl leading-snug">"{r.text}"</p>
                <p className="text-xs text-muted-foreground">— {r.name}, {r.persona} · {r.location}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── SHOP THE SHELF ─────────── */}
      {featuredProducts.length > 0 && (
        <section className="border-t border-border section-y">
          <div className="container">
            <div className="grid lg:grid-cols-12 gap-10 mb-12">
              <div className="lg:col-span-4">
                <p className="eyebrow mb-3">The Shelf</p>
                <h2 className="display-lg">From the studio.</h2>
              </div>
              <div className="lg:col-span-7 lg:col-start-6 self-end flex justify-between items-end gap-4">
                <p className="text-muted-foreground max-w-md">A small, edited selection of the products we actually use on clients. Nothing here we wouldn't put in our own hair.</p>
                <Link to="/shop" className="marker-link shrink-0">Visit the shop</Link>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
              {featuredProducts.map((p: any) => (
                <article key={p.id} className="group">
                  <Link to={`/shop/${p.id}`} className="block">
                    <div className="aspect-square bg-muted overflow-hidden mb-4">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                        : <div className="w-full h-full" />}
                    </div>
                    <p className="eyebrow text-foreground/60 mb-1">{p.category || "Product"}</p>
                    <h3 className="font-display text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">{p.name}</h3>
                    <p className="font-display text-base mt-1">£{p.price?.toFixed(2)}</p>
                  </Link>
                  <button
                    onClick={() => { addProductToCart({ id: p.id, name: p.name, price: p.price, category: p.category, image_url: p.image_url }); toast({ title: "Added", description: p.name }); }}
                    className="mt-3 text-[11px] uppercase tracking-[0.22em] text-foreground hover:text-primary transition-colors"
                  >
                    Add to bag →
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─────────── VISIT ─────────── */}
      <section className="border-t border-border section-y">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            <div className="space-y-6 lg:border-r lg:border-border lg:pr-20">
              <p className="eyebrow">Visit</p>
              <h2 className="display-lg">174 Claremont Road,<br/>Manchester M14 4TT.</h2>
              <p className="text-muted-foreground max-w-md">
                A short walk from Fallowfield and Rusholme. Walk in for the morning, or reserve below.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <a href={BUSINESS.phoneHref} className="marker-link">{BUSINESS.phone}</a>
                <a href={BUSINESS.whatsapp} target="_blank" rel="noopener noreferrer" className="marker-link">WhatsApp</a>
              </div>
            </div>

            <div className="space-y-6">
              <p className="eyebrow">Hours</p>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ["Mon–Fri", "09:00 — 19:00"],
                    ["Saturday", "09:00 — 18:00"],
                    ["Sunday", "Closed"],
                  ].map(([d, h]) => (
                    <tr key={d} className="border-b border-border">
                      <td className="py-3 font-display text-lg">{d}</td>
                      <td className="py-3 text-right text-muted-foreground">{h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="eyebrow pt-6">Areas served</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {BOROUGHS.map(b => (
                  <Link key={b.slug} to={`/areas/${b.slug}`} className="hover:text-primary transition-colors flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-primary" /> {b.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── CLOSING CTA ─────────── */}
      <section className="relative border-t border-border">
        <div className="relative h-[60vh] min-h-[420px] overflow-hidden">
          <img
            src={editorialClosing}
            alt="Inside the studio"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-foreground/30" />
          <div className="container relative h-full flex flex-col justify-end pb-12 md:pb-20 text-background">
            <p className="eyebrow text-background/80 mb-6">Reservations</p>
            <h2 className="display-lg max-w-3xl">
              Book your chair.<br/>
              <Link to="/book" className="inline-flex items-center gap-3 underline decoration-2 underline-offset-8 decoration-primary hover:text-primary transition-colors">
                Begin now <ArrowUpRight className="h-7 w-7" />
              </Link>
            </h2>
            <p className="image-caption text-background/70 mt-6 max-w-md">
              Fig. 03 — Reservations are confirmed within minutes. Walk-ins welcome subject to availability.
            </p>
          </div>
        </div>
      </section>
    </>
  );
};

export default HomePage;
