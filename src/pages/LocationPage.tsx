import { useParams, Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { BOROUGHS, SERVICES, BUSINESS } from "@/lib/siteContent";
import { ArrowRight, Phone, CheckCircle, MapPin, Shield, Clock, PoundSterling, Scissors } from "lucide-react";
import { useSiteImages } from "@/hooks/useSiteImages";
import SEOHead from "@/components/SEOHead";

const LocationPage = () => {
  const { borough: slug } = useParams<{ borough: string }>();
  const borough = BOROUGHS.find((b) => b.slug === slug);
  const { getImage } = useSiteImages();

  if (!borough) return <Navigate to="/" replace />;

  const boroughImage = getImage(`borough.${borough.slug}`, borough.image);

  return (
    <>
      <SEOHead
        title={borough.metaTitle}
        description={borough.metaDescription}
        canonical={`/areas/${borough.slug}`}
        image={borough.image}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HairSalon",
            name: `${BUSINESS.name} — ${borough.name}`,
            telephone: BUSINESS.phone,
            image: borough.image,
            url: `https://eandb.co.uk/areas/${borough.slug}`,
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
            areaServed: { "@type": "Place", name: borough.name },
          }),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://eandb.co.uk/" },
              { "@type": "ListItem", position: 2, name: "Areas We Serve", item: "https://eandb.co.uk/" },
              { "@type": "ListItem", position: 3, name: borough.name, item: `https://eandb.co.uk/areas/${borough.slug}` },
            ],
          }),
        }}
      />

      <div className="container pt-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink href="/">Areas</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{borough.name}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Hero */}
      <section className="relative min-h-[450px] flex items-center blueprint-bg overflow-hidden">
        <div className="absolute inset-0">
          <img src={boroughImage} alt={`Hair salon serving ${borough.name}`} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/30" />
        </div>
        <div className="container relative z-10 py-16 md:py-24">
          <div className="max-w-2xl space-y-4">
            <p className="font-industrial text-xs uppercase tracking-widest text-primary">Premier Unisex Salon</p>
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight">
              Premium Hair Styling &amp; Braiding Serving <span className="text-primary">{borough.name}</span>
            </h1>
            <p className="text-lg text-muted-foreground">{borough.intro}</p>
            <div className="flex flex-wrap gap-3">
              <Link to={`/book?source=${encodeURIComponent(`Website - ${borough.name}`)}`}>
                <Button size="lg" className="gap-2 font-semibold shadow-lg shadow-primary/25">
                  Book Now <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href={BUSINESS.phoneHref}>
                <Button size="lg" variant="outline" className="gap-2 border-primary/30 bg-transparent hover:bg-primary/10">
                  <Phone className="h-4 w-4" /> Call Us
                </Button>
              </a>
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Scissors className="h-3.5 w-3.5 text-primary" /> Master Braiders</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5 text-primary" /> Walk-ins Welcome</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><PoundSterling className="h-3.5 w-3.5 text-primary" /> No Hidden Fees</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services in this area */}
      <section className="container py-16 space-y-8">
        <div className="text-center space-y-2">
          <p className="font-industrial text-xs uppercase tracking-widest text-primary">Available Services</p>
          <h2 className="font-heading text-2xl font-bold">Exquisite Services for {borough.name} Clients</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <Link key={s.slug} to={`/services/${s.slug}`} className="group">
              <Card className="h-full overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group-hover:-translate-y-1 border-border hover:border-primary/30">
                <div className="aspect-video overflow-hidden relative">
                  <img src={getImage(`service.${s.slug}`, s.image)} alt={s.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
                </div>
                <CardContent className="p-5 space-y-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="text-sm text-muted-foreground">{s.shortDesc}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                    Learn more <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Why choose us */}
      <section className="bg-card border-y border-border blueprint-bg">
        <div className="container relative z-10 py-20">
          <div className="grid md:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">
            <div className="space-y-6">
              <p className="font-industrial text-xs uppercase tracking-widest text-primary">Why Us</p>
              <h2 className="font-heading text-2xl font-bold">Why Choose Us for {borough.name}?</h2>
              <ul className="space-y-3">
                {[
                  "Expertly trained stylists with years of experience",
                  "No hidden fees — transparent pricing on every service",
                  "Premium professional-grade products used on every client",
                  "Walk-in and same-day appointments available",
                  "Relaxing, welcoming in-studio atmosphere",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link to={`/book?source=${encodeURIComponent(`Website - ${borough.name}`)}`}>
                <Button className="gap-2 font-semibold mt-2 shadow-lg shadow-primary/20">
                  Book an Appointment <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="rounded-2xl overflow-hidden aspect-[4/3] relative">
              <img src={boroughImage} alt={`Salon serving ${borough.name}`} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Local SEO text */}
      <section className="container py-12 max-w-3xl">
        <p className="text-muted-foreground leading-relaxed text-center">
          Residents of {borough.name} trust {BUSINESS.name} for world-class braiding, precision hairdressing, and luxury hair treatments.
          Experience the Atelier standard just a short trip away at our {BUSINESS.address} location.
          Whether you need a fresh fade, intricate braids, or a complete colour transformation,
          our master stylists use professional-grade products to deliver stunning results every time.
        </p>
      </section>

      {/* FAQs */}
      {borough.faqs.length > 0 && (
        <section className="container py-16 max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <p className="font-industrial text-xs uppercase tracking-widest text-primary">FAQ</p>
            <h2 className="font-heading text-2xl font-bold">{borough.name} FAQs</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {borough.faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                <AccordionContent>{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {/* CTA */}
      <section className="relative">
        <img src={boroughImage} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-primary/90" />
        <div className="container relative py-14 text-center space-y-4 max-w-xl text-primary-foreground">
          <h2 className="font-heading text-xl md:text-2xl font-bold">Ready for a Fresh Look in {borough.name}?</h2>
          <p className="opacity-90">Book your appointment today — professional styling at affordable prices.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={`/book?source=${encodeURIComponent(`Website - ${borough.name}`)}`}>
              <Button size="lg" variant="secondary" className="gap-2 font-semibold">
                Book Your Appointment <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href={BUSINESS.phoneHref}>
              <Button size="lg" variant="outline" className="gap-2 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Phone className="h-4 w-4" /> {BUSINESS.phone}
              </Button>
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

export default LocationPage;
