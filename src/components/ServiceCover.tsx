import { Scissors } from "lucide-react";
import type { CatalogueCover } from "@/lib/catalogue";
import { cn } from "@/lib/utils";

// Consistent 4:5 service imagery. A service without its own photo gets a quiet
// branded tile (never a blank box, never another salon's photograph).
const ServiceCover = ({ cover, name, className, eager = false }: { cover: CatalogueCover | null; name: string; className?: string; eager?: boolean }) => (
  <div className={cn("aspect-[4/5] w-full overflow-hidden bg-muted", className)}>
    {cover ? (
      <img
        src={cover.image}
        alt={cover.alt || name}
        className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={800}
        height={1000}
      />
    ) : (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/15 via-muted to-primary/5 text-primary" role="img" aria-label={name}>
        <Scissors className="h-8 w-8 opacity-60" aria-hidden="true" />
        <span className="eyebrow text-foreground/60">E &amp; B Hair</span>
      </div>
    )}
  </div>
);

export default ServiceCover;
