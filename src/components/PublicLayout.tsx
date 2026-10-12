import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import BookNow from "@/components/BookNow";
import { BOOKING_URL, MANAGE_BOOKING_URL, OTHER_BRANCH } from "@/lib/booking";
import OpeningHours from "@/components/OpeningHours";
import { BUSINESS, whatsappLink } from "@/lib/siteContent";
import { useCatalogue } from "@/lib/catalogue";

const NAV_LINKS = [
  { to: "/services", label: "Services" },
  { to: "/gallery", label: "Gallery" },
  { to: "/areas/manchester", label: "Areas", match: "/areas" },
  { to: "/contact", label: "Contact" },
];

const PublicLayout = ({ children }: { children: React.ReactNode }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { catalogue } = useCatalogue();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Masthead bar */}
      <div className="hidden md:block border-b border-border">
        <div className="container flex items-center justify-between py-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>{BUSINESS.name} · {BUSINESS.address}</span>
          <a href={BUSINESS.phoneHref} className="hover:text-foreground transition-colors">{BUSINESS.phone}</a>
        </div>
      </div>

      <header className={`sticky top-0 z-50 bg-background/95 backdrop-blur-sm transition-all duration-300 ${scrolled ? "border-b border-border" : "border-b border-transparent"}`}>
        <div className="container flex h-16 lg:h-20 items-center justify-between gap-3 lg:gap-6">
          <nav className="hidden lg:flex items-center gap-8 flex-1" aria-label="Main">
            {NAV_LINKS.map((l) => {
              const active = location.pathname.startsWith(l.match || l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`text-[11px] uppercase tracking-[0.22em] font-medium transition-colors hover:text-primary ${active ? "text-primary" : "text-foreground"}`}
                >
                  {l.label}
                </Link>
              );
            })}
            {/* WubSync's own booking lookup (reference + mobile): view, reschedule or cancel. */}
            <a href={MANAGE_BOOKING_URL} className="whitespace-nowrap text-[11px] uppercase tracking-[0.22em] font-medium transition-colors hover:text-primary text-foreground">My Bookings</a>
          </nav>

          <Link to="/" className="flex items-center select-none min-w-0 shrink" aria-label={`${BUSINESS.name} home`}>
            <img src="/eandb-logo.svg" alt={BUSINESS.name} className="h-8 sm:h-12 lg:h-16 w-auto" width="240" height="64" />
          </Link>

          <div className="flex items-center justify-end gap-2 lg:flex-1">
            <BookNow size="sm" className="px-3 sm:px-5" />
            <button
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && createPortal(
        <div className="fixed inset-0 z-[120] lg:hidden bg-background overflow-y-auto" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="container flex h-16 items-center justify-between">
            <img src="/eandb-logo.svg" alt={BUSINESS.name} className="h-10 w-auto" width="240" height="64" />
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="inline-flex h-10 w-10 items-center justify-center">
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="container flex flex-col gap-8 pt-4 pb-10" aria-label="Mobile">
            <BookNow size="lg" className="w-full" />
            <div>
              {[{ to: "/", label: "Home" }, ...NAV_LINKS].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMenuOpen(false)}
                  className="block py-4 font-display text-3xl border-b border-border hover:text-primary transition-colors"
                >
                  {l.label}
                </Link>
              ))}
              <a href={MANAGE_BOOKING_URL} className="block py-4 font-display text-3xl border-b border-border hover:text-primary transition-colors">My Bookings</a>
            </div>
            <div className="flex flex-wrap justify-between gap-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              <a href={BUSINESS.phoneHref}>{BUSINESS.phone}</a>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">WhatsApp enquiries</a>
            </div>
          </nav>
        </div>,
        document.body
      )}

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border mt-20">
        <div className="container py-16">
          <div className="grid gap-10 md:grid-cols-12 pb-12">
            <div className="md:col-span-4">
              <img src="/eandb-logo.svg" alt={BUSINESS.name} className="h-16 md:h-20 w-auto" width="240" height="64" loading="lazy" />
              <p className="image-caption max-w-md mt-6 not-italic">
                Braids, cornrows, twists, loc grooming and treatments in Manchester.
              </p>
              <BookNow label="Book Online" className="mt-6" />
            </div>

            <div className="md:col-span-3">
              <p className="eyebrow mb-4">Services</p>
              <ul className="space-y-2 text-sm">
                {catalogue.categories.map((category) => (
                  <li key={category.slug}>
                    <Link to={`/services?category=${category.slug}`} className="hover:text-primary transition-colors">{category.name}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-2">
              <p className="eyebrow mb-4">Explore</p>
              <ul className="space-y-2 text-sm">
                <li><Link to="/services" className="hover:text-primary transition-colors">Services &amp; prices</Link></li>
                <li><Link to="/gallery" className="hover:text-primary transition-colors">Gallery</Link></li>
                <li><Link to="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
                <li><Link to="/areas/manchester" className="hover:text-primary transition-colors">Areas we serve</Link></li>
                <li><a href={BOOKING_URL} className="hover:text-primary transition-colors">Book Online</a></li>
                <li><a href={OTHER_BRANCH.bookingUrl} className="hover:text-primary transition-colors">Book at {OTHER_BRANCH.name}</a></li>
                <li><a href={MANAGE_BOOKING_URL} className="hover:text-primary transition-colors">My Bookings</a></li>
              </ul>
            </div>

            <div className="md:col-span-3">
              <p className="eyebrow mb-4">Visit</p>
              <address className="not-italic text-sm space-y-1.5">
                <div>{BUSINESS.name}</div>
                <div>{BUSINESS.streetAddress}</div>
                <div>{BUSINESS.city} {BUSINESS.postcode}</div>
                <div className="pt-2"><a href={BUSINESS.phoneHref} className="hover:text-primary">{BUSINESS.phone}</a></div>
                <div><a href={`mailto:${BUSINESS.email}`} className="hover:text-primary break-all">{BUSINESS.email}</a></div>
                <div><a href={BUSINESS.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary">Open in Google Maps</a></div>
                <OpeningHours className="pt-3" />
              </address>
            </div>
          </div>

          <div className="editorial-rule pt-6 flex flex-wrap items-center justify-between gap-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <span>© {new Date().getFullYear()} {BUSINESS.name}</span>
            <span>Online booking by WubSync</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
