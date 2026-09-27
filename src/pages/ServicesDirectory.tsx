import SEOHead from "@/components/SEOHead";
import BookNow from "@/components/BookNow";
import ServiceCard from "@/components/ServiceCard";
import PriceNotice from "@/components/PriceNotice";
import { servicesByCategory, useCatalogue } from "@/lib/catalogue";
import { breadcrumbJsonLd, hairSalonJsonLd } from "@/lib/seo";

const ServicesDirectory = () => {
  const { catalogue, status } = useCatalogue();
  const groups = servicesByCategory(catalogue);

  return (
    <>
      <SEOHead
        title="Services & Prices | E & B Hair, Manchester"
        description="Every E & B Hair service with its starting price and estimated duration: knotless braids, box braids, cornrows, twists, locs, children's hair and treatments."
        canonical="/services"
        image={groups[0]?.category.cover?.image}
        jsonLd={[
          hairSalonJsonLd(),
          breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }]),
        ]}
      />

      <section className="border-t border-border">
        <div className="container py-12 lg:py-16">
          <div className="max-w-3xl">
            <p className="eyebrow mb-4">Services &amp; prices</p>
            <h1 className="display-lg mb-6">Every style, every starting price.</h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mb-8">
              Prices shown are starting prices. Choose your size, length and any extras when you book, and your final price is shown before you confirm.
            </p>
            <BookNow size="lg" />
          </div>

          {groups.length > 0 && (
            <nav className="mt-10 flex flex-wrap gap-2" aria-label="Service categories">
              {groups.map(({ category, services }) => (
                <a
                  key={category.slug}
                  href={`#${category.slug}`}
                  className="px-4 py-2 border border-border text-[11px] uppercase tracking-[0.18em] font-medium hover:border-foreground transition-colors"
                >
                  {category.name} <span className="text-muted-foreground">({services.length})</span>
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      <div className="container space-y-16 pb-8">
        {groups.length === 0 && (
          <div className="border border-border p-8 text-center space-y-4">
            <p className="font-display text-2xl">Our service list is temporarily unavailable.</p>
            <p className="text-muted-foreground">You can still see every service and price on our booking page.</p>
            <BookNow />
          </div>
        )}

        {groups.map(({ category, services }) => (
          <section key={category.slug} id={category.slug} className="scroll-mt-24" aria-labelledby={`${category.slug}-heading`}>
            <div className="border-t border-foreground/80 pt-6 mb-8 grid lg:grid-cols-12 gap-4">
              <h2 id={`${category.slug}-heading`} className="lg:col-span-4 display-md">{category.name}</h2>
              {category.description && <p className="lg:col-span-7 lg:col-start-6 text-muted-foreground">{category.description}</p>}
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-service-list>
              {services.map((service) => <ServiceCard key={service.slug} service={service} />)}
            </div>
          </section>
        ))}

        <PriceNotice status={status} className="max-w-2xl" />
      </div>
    </>
  );
};

export default ServicesDirectory;
