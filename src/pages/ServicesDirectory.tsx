import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import BookNow from "@/components/BookNow";
import ServiceCard from "@/components/ServiceCard";
import PriceNotice from "@/components/PriceNotice";
import { searchServices, servicesByCategory, useCatalogue } from "@/lib/catalogue";
import { breadcrumbJsonLd, hairSalonJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

// Services & prices. Everything comes from WubSync. The view is driven by the
// URL so links, Back and a refresh land on the same list:
//   /services                  every service, grouped by category
//   /services?category=<slug>  one category (active chip)
//   /services?q=<words>        search across every service
// The prerendered page is the full list, so search engines see every service.
const ServicesDirectory = () => {
  const { catalogue, status } = useCatalogue();
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") || "").trim();
  const filter = params.get("category") || "";
  const activeCategory = catalogue.categories.find((category) => category.slug === filter);
  const allGroups = servicesByCategory(catalogue);
  const groups = servicesByCategory(catalogue, activeCategory ? filter : "");
  const results = useMemo(() => (query ? searchServices(catalogue, query) : []), [catalogue, query]);
  const total = catalogue.services.length;

  const setQuery = (value: string) => {
    const next = new URLSearchParams();
    if (value) next.set("q", value);
    setParams(next, { replace: true });
  };

  const chip = (active: boolean) =>
    cn(
      "px-4 py-2 border text-[11px] uppercase tracking-[0.18em] font-medium transition-colors whitespace-nowrap",
      active ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground",
    );

  return (
    <>
      <SEOHead
        title="Services & Prices | E & B Hair, Manchester"
        description="Every E & B Hair service with its price, estimated duration, options and add-ons: knotless braids, box braids, cornrows, twists, locs, children's hair and treatments."
        canonical="/services"
        image={allGroups[0]?.category.cover?.image}
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
              “From” prices are starting prices. Choose your size, length and any extras when you book, and your final price is shown before you confirm.
            </p>
            <BookNow size="lg" />
          </div>

          <div className="mt-10 max-w-xl relative" role="search">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <label htmlFor="service-search" className="sr-only">Search services</label>
            <input
              id="service-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search services, e.g. knotless, cornrows, kids"
              autoComplete="off"
              className="w-full h-12 pl-11 pr-12 border border-border bg-background text-base focus:outline-none focus:border-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center hover:text-primary">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {allGroups.length > 0 && (
            <nav className="mt-6 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto sm:flex-wrap pb-1" aria-label="Service categories">
              <Link to="/services" className={chip(!activeCategory && !query)} aria-current={!activeCategory && !query ? "page" : undefined}>
                View all <span className="opacity-70">({total})</span>
              </Link>
              {allGroups.map(({ category }) => {
                const count = catalogue.services.filter((service) => (service.categories?.length ? service.categories : [service.category]).includes(category.slug)).length;
                const active = activeCategory?.slug === category.slug && !query;
                return (
                  <Link key={category.slug} to={`/services?category=${encodeURIComponent(category.slug)}`} className={chip(active)} aria-current={active ? "page" : undefined}>
                    {category.name} <span className="opacity-70">({count})</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </section>

      <div className="container space-y-16 pb-8" aria-live="polite">
        {allGroups.length === 0 && (
          <div className="border border-border p-8 text-center space-y-4">
            <p className="font-display text-2xl">Our service list is temporarily unavailable.</p>
            <p className="text-muted-foreground">You can still see every service and price on our booking page.</p>
            <BookNow />
          </div>
        )}

        {query ? (
          <section aria-labelledby="search-heading">
            <div className="border-t border-foreground/80 pt-6 mb-8 flex flex-wrap items-end justify-between gap-4">
              <h2 id="search-heading" className="display-md">
                {results.length ? `${results.length} ${results.length === 1 ? "service" : "services"} for “${query}”` : `No services match “${query}”`}
              </h2>
              <Link to="/services" className="marker-link">View all services</Link>
            </div>
            {results.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-search-results>
                {results.map((service) => <ServiceCard key={service.slug} service={service} />)}
              </div>
            ) : (
              <p className="text-muted-foreground">Try another style name, or browse every service with View all.</p>
            )}
          </section>
        ) : (
          groups.map(({ category, services }) => (
            <section key={category.slug} id={category.slug} className="scroll-mt-24" aria-labelledby={`${category.slug}-heading`}>
              <div className="border-t border-foreground/80 pt-6 mb-8 grid lg:grid-cols-12 gap-4">
                <h2 id={`${category.slug}-heading`} className="lg:col-span-4 display-md">{category.name}</h2>
                {category.description && <p className="lg:col-span-7 lg:col-start-6 text-muted-foreground">{category.description}</p>}
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-service-list>
                {services.map((service) => <ServiceCard key={service.slug} service={service} />)}
              </div>
            </section>
          ))
        )}

        <PriceNotice status={status} className="max-w-2xl" />
      </div>
    </>
  );
};

export default ServicesDirectory;
