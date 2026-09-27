import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import BookNow from "@/components/BookNow";
import { formatDuration, formatPrice, type CatalogueService } from "@/lib/catalogue";

const ServiceCard = ({ service }: { service: CatalogueService }) => {
  const duration = formatDuration(service.durationMinutes);

  return (
    <article className="flex flex-col border border-border bg-background">
      <Link to={`/services/${service.slug}`} className="block aspect-[4/3] bg-muted overflow-hidden">
        {service.cover && (
          <img
            src={service.cover.image}
            alt={service.cover.alt}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
            loading="lazy"
            decoding="async"
            width={800}
            height={600}
          />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-display text-xl leading-tight">
          <Link to={`/services/${service.slug}`} className="hover:text-primary transition-colors">
            {service.name}
          </Link>
        </h3>
        {service.description && <p className="text-sm text-muted-foreground line-clamp-3">{service.description}</p>}
        <div className="mt-auto space-y-1 pt-2">
          <p className="font-display text-lg">From {formatPrice(service.basePrice)}</p>
          {duration && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Estimated duration: {duration}
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
          <BookNow size="sm" className="px-3 tracking-[0.18em]" />
        </div>
      </div>
    </article>
  );
};

export default ServiceCard;
