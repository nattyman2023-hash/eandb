import { useParams, Link } from "react-router-dom";
import { Check, Clock } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import BookNow from "@/components/BookNow";
import ServiceCard from "@/components/ServiceCard";
import PriceNotice from "@/components/PriceNotice";
import NotFound from "@/pages/NotFound";
import { BUSINESS, whatsappLink } from "@/lib/siteContent";
import { formatDuration, formatPrice, useCatalogue } from "@/lib/catalogue";
import { breadcrumbJsonLd, serviceJsonLd } from "@/lib/seo";

const ServicePage = () => {
  const { service: slug } = useParams<{ service: string }>();
  const { catalogue, status } = useCatalogue();
  const service = catalogue.services.find((item) => item.slug === slug);

  if (!service) return <NotFound />;

  const category = catalogue.categories.find((item) => item.slug === service.category);
  const categoryName = category?.name || service.categoryName;
  const duration = formatDuration(service.durationMinutes);
  const related = catalogue.services
    .filter((item) => item.category === service.category && item.slug !== service.slug)
    .concat(catalogue.services.filter((item) => item.category !== service.category && !item.isAddOn))
    .slice(0, 3);

  return (
    <>
      <SEOHead
        title={`${service.name} in Manchester | From ${formatPrice(service.basePrice)} | E & B Hair`}
        description={`${service.name} at E & B Hair, ${BUSINESS.address}. From ${formatPrice(service.basePrice)}${duration ? `, estimated duration ${duration}` : ""}. ${service.description}`.slice(0, 300)}
        canonical={`/services/${service.slug}`}
        image={service.cover?.image}
        jsonLd={[
          serviceJsonLd(service),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
            { name: service.name, path: `/services/${service.slug}` },
          ]),
        ]}
      />

      <section className="border-t border-border">
        <div className="container">
          <nav className="flex flex-wrap items-center gap-2 py-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground border-b border-border" aria-label="Breadcrumb">
            <Link to="/services" className="hover:text-primary transition-colors">Services</Link>
            <span aria-hidden="true">/</span>
            <Link to={`/services#${service.category}`} className="hover:text-primary transition-colors">{categoryName}</Link>
          </nav>

          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 py-10 lg:py-16 items-center">
            <div className="lg:col-span-6 space-y-6 animate-rise">
              <p className="eyebrow">{categoryName}</p>
              <h1 className="display-xl break-words">{service.name}</h1>
              {service.description && <p className="text-base md:text-lg leading-relaxed text-muted-foreground max-w-xl">{service.description}</p>}
              <dl className="grid grid-cols-2 gap-6 border-y border-border py-5 max-w-md">
                <div>
                  <dt className="eyebrow mb-1">Starting price</dt>
                  <dd className="font-display text-3xl">From {formatPrice(service.basePrice)}</dd>
                </div>
                {duration && (
                  <div>
                    <dt className="eyebrow mb-1">Estimated duration</dt>
                    <dd className="font-display text-xl flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" aria-hidden="true" /> {duration}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap items-center gap-6">
                <BookNow size="lg" />
                <a href={whatsappLink(`Hello E & B Hair, I have a question about ${service.name}.`)} target="_blank" rel="noopener noreferrer" className="marker-link">
                  Ask a question
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="aspect-[4/5] w-full overflow-hidden bg-muted">
                {service.cover && (
                  <img src={service.cover.image} alt={service.cover.alt} className="w-full h-full object-cover" width={1000} height={1250} decoding="async" />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {service.whatsIncluded.length > 0 && (
        <section className="border-t border-border section-y">
          <div className="container grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4">
              <p className="eyebrow mb-3">What's included</p>
              <h2 className="display-md">Part of every {service.name.toLowerCase()} appointment.</h2>
            </div>
            <ul className="lg:col-span-7 lg:col-start-6 border-t border-foreground/80">
              {service.whatsIncluded.map((item) => (
                <li key={item} className="border-b border-border flex items-start gap-4 py-5">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-1" aria-hidden="true" />
                  <span className="text-lg">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="border-t border-border section-y">
        <div className="container grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <p className="eyebrow mb-3">Pricing</p>
            <h2 className="display-md">How your price is set.</h2>
          </div>
          <div className="lg:col-span-7 lg:col-start-6 space-y-4 text-muted-foreground">
            <p>
              {service.name} starts from {formatPrice(service.basePrice)}. When you book, you can choose options such as size, length and extras where they apply, and the booking page shows your price before you confirm.
            </p>
            <PriceNotice status={status} />
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="border-t border-border section-y bg-muted/40">
          <div className="container">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
              <div>
                <p className="eyebrow mb-3">Related services</p>
                <h2 className="display-md">You might also like.</h2>
              </div>
              <Link to="/services" className="marker-link">All services</Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => <ServiceCard key={item.slug} service={item} />)}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-border section-y">
        <div className="container max-w-3xl text-center space-y-6">
          <p className="eyebrow">Online booking</p>
          <h2 className="display-lg">Ready to book {service.name}?</h2>
          <BookNow size="lg" />
        </div>
      </section>
    </>
  );
};

export default ServicePage;
