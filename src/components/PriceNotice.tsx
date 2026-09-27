import { PRICE_DISCLAIMER, type CatalogueStatus } from "@/lib/catalogue";
import { cn } from "@/lib/utils";

// The standard price/duration disclaimer. When the live catalogue could not be
// reached, it also says the listed prices come from the last saved copy.
const PriceNotice = ({ status, className }: { status?: CatalogueStatus; className?: string }) => (
  <div className={cn("text-xs text-muted-foreground space-y-1", className)}>
    <p>{PRICE_DISCLAIMER} Your final price is confirmed when you book online.</p>
    {status === "stale" && (
      <p role="status">
        We couldn't load the very latest prices just now, so these are from our most recent update. The booking page always shows current prices.
      </p>
    )}
  </div>
);

export default PriceNotice;
