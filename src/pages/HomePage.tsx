import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, MessageCircle } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import BookNow from "@/components/BookNow";
import ServiceCard from "@/components/ServiceCard";
import PriceNotice from "@/components/PriceNotice";
import { BUSINESS, whatsappLink } from "@/lib/siteContent";
import { featuredServices, useCatalogue } from "@/lib/catalogue";
import { hairSalonJsonLd } from "@/lib/seo";

import heroCornrows from "@/assets/home-cover-cornrows.jpg";
import braidingChair from "@/assets/home-braiding-chair.jpg";

const REASONS = [
  { title: "Protective styling specialists", text: "Knotless and box braids, cornrows, twists and loc grooming are the heart of what we do." },
  { title: "Clear starting prices", text: "Every service shows a starting price and an estimated duration before you book." },
  { title: "Book in a few taps", text: "Pick your service, options, date and time online. Your price is confirmed as you choose." },
  { title: "Care for your hair", text: "Moisture treatments, wash and condition, and careful take-downs keep your hair healthy between styles." },
];

const HomePage = () => {
  const { catalogue, status } = useCatalogue();
  const featured = featuredServices(catalogue, 4);

  return (
    <>
      <SEOHead
        title="E & B Hair | Braiding Salon in Manchester"
        description={`E & B Hair at ${BUSINESS.address}: knotless braids, box braids, cornrows, twists, loc grooming and treatments. See prices and book online.`}
        canonical="/"
        image={heroCornrows}
        jsonLd={[hairSalonJsonLd()]}
      />

      {/* Hero */}
      <section className="border-t border-border">
        <div className="container">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 py-10 lg:py-20 items-center">
            <div className="lg:col-span-6 space-y-8 animate-rise">
              <p className="eyebrow">E & B Hair · Manchester</p>
              <h1 className="display-xl">
                Braids, done<br />
                <span className="italic">with care.</span>
              </h1>
              <p className="text-base md:text-lg leading-relaxed max-w-md text-muted-foreground">
                Knotless and box braids, cornrows, twists, loc grooming and treatments at {BUSINESS.address}.
              </p>
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <BookNow size="lg" />
                <Link to="/services" className="marker-link">View services &amp; prices</Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="aspect-[4/5] w-full overflow-hidden bg-muted">
                <img
                  src={heroCornrows}
                  alt="Neat cornrows braided back into long braids"
                  className="w-full h-full object-cover"
                  width={1000}
                  height={1250}
                  {...{ fetchpriority: "high" }}
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured services */}
      <section className="border-t border-border section-y">
        <div className="container">
          <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 mb-10">
            <div className="lg:col-span-5">
              <p className="eyebrow mb-3">Popular services</p>
              <h2 className="display-lg">Our most-booked styles.</h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 self-end space-y-4">
              <p className="text-muted-foreground">Starting prices and estimated durations. Choose your size, length and extras when you book.</p>
              <Link to="/services" className="marker-link">All {catalogue.services.length} services</Link>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((service) => <ServiceCard key={service.slug} service={service} />)}
          </div>
          <PriceNotice status={status} className="mt-8 max-w-2xl" />
        </div>
      </section>

      {/* Why choose us */}
      <section className="bg-muted/40 section-y">
        <div className="container">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            <div className="lg:col-span-6">
              <img
                src={braidingChair}
                alt="A stylist braiding a client's hair"
                className="w-full aspect-[4/5] object-cover"
                loading="lazy"
                decoding="async"
                width={1000}
                height={1250}
              />
            </div>
            <div className="lg:col-span-6 space-y-8">
              <p className="eyebrow">Why E & B Hair</p>
              <h2 className="display-lg">Patient, precise protective styling.</h2>
              <ul className="space-y-6">
                {REASONS.map((reason) => (
                  <li key={reason.title} className="border-b border-border pb-5">
                    <h3 className="font-display text-xl mb-1">{reason.title}</h3>
                    <p className="text-sm text-muted-foreground">{reason.text}</p>
                  </li>
                ))}
              </ul>
              <BookNow />
            </div>
          </div>
        </div>
      </section>

      {/* Gallery teaser */}
      <section className="border-t border-border section-y">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="eyebrow mb-3">Gallery</p>
              <h2 className="display-lg">Find your next style.</h2>
            </div>
            <Link to="/gallery" className="marker-link">Open the gallery</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            {catalogue.categories.filter((category) => category.cover).slice(0, 4).map((category) => (
              <Link key={category.slug} to={`/services#${category.slug}`} className="group block">
                <div className="aspect-square bg-muted overflow-hidden">
                  <img
                    src={category.cover!.image}
                    alt={category.cover!.alt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <p className="mt-2 text-sm group-hover:text-primary transition-colors">{category.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Visit + enquiries */}
      <section className="border-t border-border section-y">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            <div className="space-y-6">
              <p className="eyebrow">Visit</p>
              <h2 className="display-lg">{BUSINESS.streetAddress},<br />{BUSINESS.city} {BUSINESS.postcode}.</h2>
              <p className="text-muted-foreground max-w-md">
                Our nearby branch, WUB Hair Studio, is just a 1-minute walk away.
              </p>
              <div className="flex flex-wrap gap-4">
                <BookNow />
                <a href={BUSINESS.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 border border-foreground px-6 text-[11px] uppercase tracking-[0.22em] font-medium hover:bg-foreground hover:text-background transition-colors">
                  <MapPin className="h-4 w-4" aria-hidden="true" /> Directions
                </a>
              </div>
            </div>

            <div className="space-y-6">
              <p className="eyebrow">Questions &amp; enquiries</p>
              <p className="text-muted-foreground max-w-md">
                Not sure which style or size to choose? Get in touch and we'll help before you book.
              </p>
              <ul className="space-y-3 text-sm">
                <li><a href={BUSINESS.phoneHref} className="inline-flex items-center gap-3 hover:text-primary"><Phone className="h-4 w-4 text-primary" aria-hidden="true" /> {BUSINESS.phone}</a></li>
                <li><a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 hover:text-primary"><MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" /> WhatsApp a question</a></li>
                <li><a href={`mailto:${BUSINESS.email}`} className="inline-flex items-center gap-3 hover:text-primary break-all"><Mail className="h-4 w-4 text-primary shrink-0" aria-hidden="true" /> {BUSINESS.email}</a></li>
              </ul>
              <Link to="/contact" className="marker-link">Send us a message</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-border bg-foreground text-background">
        <div className="container py-16 md:py-24 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <p className="eyebrow text-background/70 mb-4">Online booking</p>
            <h2 className="display-lg max-w-2xl">Choose your service, date and time.</h2>
          </div>
          <BookNow variant="light" size="lg" />
        </div>
      </section>
    </>
  );
};

export default HomePage;
