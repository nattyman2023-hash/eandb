import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { BUSINESS, BOROUGHS, SERVICES } from "@/lib/siteContent";
import {
  Phone, Menu, X, ChevronDown,
  Settings, UserCircle, ShoppingBag, ArrowUpRight,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import ExitIntentPopup from "@/components/ExitIntentPopup";
import LiveChat from "@/components/LiveChat";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import PromoBar from "@/components/PromoBar";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_LINKS = [
  { to: "/services", label: "Services", match: "/services" },
  { to: "/shop", label: "Shop", match: "/shop" },
  { to: "/areas/manchester", label: "Areas", match: "/areas" },
  { to: "/contact", label: "Contact", match: "/contact" },
];

const CartButton = () => {
  const { productItemCount } = useCart();
  return (
    <Link to="/cart" aria-label="Bag" className="relative inline-flex items-center p-2 hover:text-primary transition-colors">
      <ShoppingBag className="h-4 w-4" />
      {productItemCount > 0 && (
        <span className="absolute -top-0 -right-0 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">{productItemCount}</span>
      )}
    </Link>
  );
};

const PublicLayout = ({ children }: { children: React.ReactNode }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user, hasRole, signOut } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("super_admin");

  // Force light theme
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const issueNumber = String(new Date().getFullYear() - 2023).padStart(2, "0");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PromoBar />
      {/* Masthead bar — quiet, two thin lines */}
      <div className="hidden md:block border-b border-border">
        <div className="container flex items-center justify-between py-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>{BUSINESS.name} · 174 Claremont Rd · Manchester M14 4TT</span>
          <div className="flex items-center gap-5">
            <Link to="/auth?role=staff" className="hover:text-foreground transition-colors">Staff</Link>
            <a href={BUSINESS.phoneHref} className="hover:text-foreground transition-colors">
              Reservations · {BUSINESS.phone}
            </a>
          </div>
        </div>
      </div>

      {/* Navbar */}
      <header className={`sticky top-0 z-50 bg-background/95 backdrop-blur-sm transition-all duration-300 ${scrolled ? "border-b border-border" : "border-b border-transparent"}`}>
        <div className="container flex h-20 items-center justify-between gap-6">
          {/* Left nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-8 flex-1">
            {NAV_LINKS.map((l) => {
              const active = location.pathname.startsWith(l.match);
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
          </nav>

          {/* Centered logo */}
          <Link to="/" className="flex items-center justify-center select-none flex-shrink-0" aria-label={BUSINESS.name}>
            <img src="/eandb-logo.svg" alt={BUSINESS.name} className="h-14 md:h-16 w-auto" width="240" height="64" />
          </Link>

          {/* Right utilities */}
          <div className="hidden lg:flex items-center gap-2 flex-1 justify-end">
            <CartButton />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 hover:text-primary transition-colors" aria-label="Account">
                    <UserCircle className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild><Link to="/portal" className="w-full">My Portal</Link></DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild><Link to="/dashboard" className="w-full font-semibold text-primary">Admin CRM</Link></DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive">Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/auth?role=customer"
                className="text-[11px] uppercase tracking-[0.22em] font-medium hover:text-primary transition-colors px-2"
              >
                Sign in
              </Link>
            )}
            <Link to="/book" className="ml-3">
              <Button size="sm" className="rounded-none px-5 h-9 text-[11px] uppercase tracking-[0.22em] font-medium">
                Book a chair
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && createPortal(
        <div className="fixed inset-0 z-[120] lg:hidden bg-background">
          <div className="absolute top-5 right-5">
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-2">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="absolute top-5 left-5 eyebrow">№ {issueNumber} · Menu</div>

          <nav className="h-full flex flex-col justify-between pt-24 pb-10 px-6">
            <div className="space-y-1">
              {[{ to: "/", label: "Home" }, ...NAV_LINKS].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMenuOpen(false)}
                  className="block py-4 font-display text-4xl border-b border-border hover:text-primary transition-colors"
                  style={{ fontVariationSettings: '"opsz" 144' }}
                >
                  {l.label}
                </Link>
              ))}
              <div className="pt-4 pl-2 space-y-2">
                {SERVICES.map(s => (
                  <Link
                    key={s.slug}
                    to={`/services/${s.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                  >— {s.name}</Link>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Link to="/book" onClick={() => setMenuOpen(false)}>
                <Button className="w-full rounded-none h-12 text-[11px] uppercase tracking-[0.22em]">Book a chair</Button>
              </Link>
              <div className="flex justify-between text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <a href={BUSINESS.phoneHref}>{BUSINESS.phone}</a>
                <a href={BUSINESS.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                {user ? (
                  <Link to="/portal">Portal</Link>
                ) : (
                  <Link to="/auth?role=customer">Sign in</Link>
                )}
              </div>
            </div>
          </nav>
        </div>,
        document.body
      )}

      <main className="flex-1">{children}</main>

      {/* Footer — editorial colophon */}
      <footer className="border-t border-border mt-20">
        <div className="container py-16">
          {/* Brand + statement */}
          <div className="grid gap-10 md:grid-cols-12 pb-12">
            <div className="md:col-span-5">
              <img src="/eandb-logo.svg" alt={BUSINESS.name} className="h-20 md:h-24 w-auto" width="240" height="64" loading="lazy" />
              <p className="image-caption max-w-md mt-6 not-italic">
                A salon for considered hair, in the heart of Manchester. Hairdressing and protective styling, by appointment or walk-in.
              </p>
            </div>

            <div className="md:col-span-2">
              <p className="eyebrow mb-4">Services</p>
              <ul className="space-y-2 text-sm">
                {SERVICES.map(s => (
                  <li key={s.slug}>
                    <Link to={`/services/${s.slug}`} className="hover:text-primary transition-colors">{s.name}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-2">
              <p className="eyebrow mb-4">Areas</p>
              <ul className="space-y-2 text-sm">
                {BOROUGHS.slice(0, 5).map(b => (
                  <li key={b.slug}>
                    <Link to={`/areas/${b.slug}`} className="hover:text-primary transition-colors">{b.name}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-3">
              <p className="eyebrow mb-4">Visit</p>
              <address className="not-italic text-sm space-y-1.5">
                <div>174 Claremont Road</div>
                <div>Manchester M14 4TT</div>
                <div className="pt-2"><a href={BUSINESS.phoneHref} className="hover:text-primary">{BUSINESS.phone}</a></div>
                <div><a href={`mailto:${BUSINESS.email}`} className="hover:text-primary">{BUSINESS.email}</a></div>
              </address>
              <p className="eyebrow mt-6 mb-2">Hours</p>
              <p className="text-sm text-muted-foreground">Mon–Fri · 9–19<br/>Sat · 9–18</p>
            </div>
          </div>

          {/* Colophon line */}
          <div className="editorial-rule pt-6 pb-20 md:pb-0 flex flex-wrap items-center justify-between gap-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <span>© {new Date().getFullYear()} {BUSINESS.name} · All rights reserved</span>
            <span>Issue № {issueNumber} · Manchester Edition</span>
            <div className="flex items-center gap-5">
              <Link to="/auth?role=customer" className="hover:text-foreground transition-colors">Client sign in</Link>
              <Link to="/auth?role=staff" className="hover:text-foreground transition-colors">Staff</Link>
            </div>
          </div>
        </div>
      </footer>

      <ExitIntentPopup />
      {!menuOpen && <LiveChat />}
      {!menuOpen && <PwaInstallBanner />}
    </div>
  );
};

export default PublicLayout;
