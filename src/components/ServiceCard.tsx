import { Link } from "react-router-dom";
import { Clock, SlidersHorizontal } from "lucide-react";
import BookNow from "@/components/BookNow";
import ServiceCover from "@/components/ServiceCover";
import { choosableGroups, formatDuration, priceLabel, priceRangeNote, type CatalogueService } from "@/lib/catalogue";

// What the customer can tailor, in a few words: "3 lengths · 6 add-ons".
function optionsSummary(service: CatalogueService) {
  const parts = choosableGroups(service).map((group) => `${group.values.length} ${group.name.toLowerCase()} options`);
  const addons = service.addons?.length || 0;
  if (addons) parts.push(`${addons} add-on${addons === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

const ServiceCard = ({ service }: { service: CatalogueService }) => {
  const duration = formatDuration(service.durationMinutes);
  const summary = optionsSummary(service);
  const note = priceRangeNote(service);

  return (
    <article className="flex flex-col border border-border bg-background" data-service-card={service.slug}>
      <Link to={`/services/${service.slug}`} className="block" tabIndex={-1} aria-hidden="true">
        <ServiceCover cover={service.cover} name={service.name} />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="eyebrow text-muted-foreground">{service.categoryName}</p>
        <h3 className="font-display text-xl leading-tight">
          <Link to={`/services/${service.slug}`} className="hover:text-primary transition-colors">
            {service.name}
          </Link>
        </h3>
        {(service.shortDescription || service.description) && (
          <p className="text-sm text-muted-foreground line-clamp-3">{service.shortDescription || service.description}</p>
        )}
        <div className="mt-auto space-y-1 pt-2">
          <p className="font-display text-lg" data-price>{priceLabel(service)}</p>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
          {duration && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Estimated duration: {duration}
            </p>
          )}
          {summary && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {summary}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Link
            to={`/services/${service.slug}`}
            className="inline-flex h-10 items-center justify-center border border-foreground px-3 text-[11px] uppercase tracking-[0.18em] font-medium hover:bg-foreground hover:text-background transition-colors"
          >
            View Details
          </Link>
          <BookNow size="sm" className="px-3 tracking-[0.18em]" serviceSlug={service.slug} ariaLabel={`Book ${service.name}`} />
        </div>
      </div>
    </article>
  );
};

export default ServiceCard;
