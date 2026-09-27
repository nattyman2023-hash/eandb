import { useParams, Link } from "react-router-dom";
import { Phone, MapPin } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import SEOHead from "@/components/SEOHead";
import BookNow from "@/components/BookNow";
import ServiceCard from "@/components/ServiceCard";
import PriceNotice from "@/components/PriceNotice";
import NotFound from "@/pages/NotFound";
import { BOROUGHS, BUSINESS } from "@/lib/siteContent";
import { featuredServices, useCatalogue } from "@/lib/catalogue";
import { breadcrumbJsonLd, BUSINESS_ID } from "@/lib/seo";

const LocationPage = () => {
  const { borough: slug } = useParams<{ borough: string }>();
  const borough = BOROUGHS.find((b) => b.slug === slug);
  const { catalogue, status } = useCatalogue();

  if (!borough) return <NotFound />;

  const services = featuredServices(catalogue, 6);

  return (
    <>
      <SEOHead
        title={borough.metaTitle}
        description={borough.metaDescription}
        canonical={`/areas/${borough.slug}`}
        image={borough.image}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: borough.metaTitle,
            url: `https://eandbhair.co.uk/areas/${borough.slug}`,
            about: { "@id": BUSINESS_ID },
            spatialCoverage: { "@type": "Place", name: borough.name },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: borough.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          },
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: borough.name, path: `/areas/${borough.slug}` },
          ]),
        ]}
      />

      <section className="border-t border-border">
        <div className="container grid lg:grid-cols-12 gap-10 lg:gap-16 py-10 lg:py-16 items-center">
          <div className="lg:col-span-6 space-y-6">
            <p className="eyebrow">Serving {borough.name}</p>
            <h1 className="display-lg">Braids and protective styles for {borough.name}.</h1>
            <p className="text-base md:text-lg text-muted-foreground">{borough.intro}</p>
            <div className="flex flex-wrap items-center gap-6">
              <BookNow size="lg" />
              <a href={BUSINESS.phoneHref} className="marker-link inline-flex items-center gap-2"><Phone className="h-4 w-4" aria-hidden="true" /> {BUSINESS.phone}</a>
            </div>
          </div>
          <div className="lg:col-span-6">
            <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
              <img src={borough.image} alt={`Hair styling for clients from ${borough.name}`} className="w-full h-full object-cover" decoding="async" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border section-y">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="eyebrow mb-3">Popular with {borough.name} clients</p>
              <h2 className="display-md">Services &amp; starting prices.</h2>
            </div>
            <Link to="/services" className="marker-link">All services</Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => <ServiceCard key={service.slug} service={service} />)}
          </div>
          <PriceNotice status={status} className="mt-8 max-w-2xl" />
        </div>
      </section>

      <section className="border-t border-border section-y">
        <div className="container grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-4">
            <p className="eyebrow">Getting here</p>
            <h2 className="display-md">{BUSINESS.streetAddress}, {BUSINESS.city} {BUSINESS.postcode}</h2>
            <a href={BUSINESS.mapsUrl} target="_blank" rel="noopener noreferrer" className="marker-link inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" aria-hidden="true" /> Directions
            </a>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <p className="eyebrow mb-3">{borough.name} FAQs</p>
            <Accordion type="single" collapsible className="w-full">
              {borough.faqs.map((faq, index) => (
                <AccordionItem key={faq.q} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                  <AccordionContent>{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-foreground text-background">
        <div className="container py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <h2 className="display-md max-w-xl">Book your next style online.</h2>
          <BookNow variant="light" size="lg" />
        </div>
      </section>
    </>
  );
};

export default LocationPage;
