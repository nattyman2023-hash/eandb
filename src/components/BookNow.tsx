import { cn } from "@/lib/utils";
import { BOOKING_URL, serviceBookingUrl } from "@/lib/booking";

interface BookNowProps {
  label?: string;
  className?: string;
  variant?: "solid" | "outline" | "light";
  size?: "sm" | "md" | "lg";
  /** Start the WubSync booking with this service already chosen. */
  serviceSlug?: string;
  ariaLabel?: string;
}

const VARIANTS = {
  solid: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-foreground text-foreground hover:bg-foreground hover:text-background",
  light: "bg-background text-foreground hover:bg-background/90",
};

const SIZES = {
  sm: "h-10 px-4",
  md: "h-11 px-6",
  lg: "h-12 px-8",
};

// A plain same-tab link to WubSync. Every booking CTA on the site uses this.
const BookNow = ({ label = "Book Now", className, variant = "solid", size = "md", serviceSlug, ariaLabel }: BookNowProps) => (
  <a
    href={serviceSlug ? serviceBookingUrl(serviceSlug) : BOOKING_URL}
    aria-label={ariaLabel}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap text-[11px] uppercase tracking-[0.22em] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      VARIANTS[variant],
      SIZES[size],
      className,
    )}
  >
    {label}
  </a>
);

export default BookNow;
