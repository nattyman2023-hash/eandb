import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Search, Clock, ChevronRight, ChevronLeft, Image as ImageIcon, Sparkles, Star, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import SEOHead from "@/components/SEOHead";

import { servicePrice, serviceOriginal, serviceOnSale, discountPercent } from "@/lib/pricing";

interface CatalogItem {
  id: string; name: string; base_price: number; duration_minutes: number;
  category: string; description: string | null; is_active: boolean;
  target_audience: string; featured_style: boolean; image_url: string | null;
  is_on_promo?: boolean; sale_price?: number | null;
}

const VARIANT_CONFIG: Record<string, { sizes?: string[]; lengths?: string[]; extras?: { name: string; price: number }[] }> = {
  "knotless": { sizes: ["Jumbo", "Medium", "Small"], lengths: ["Mid-back", "Waist", "Butt-length"], extras: [{ name: "Add Curls", price: 10 }, { name: "Add Beads", price: 8 }] },
  "box braids": { sizes: ["Jumbo", "Medium", "Small"], lengths: ["Mid-back", "Waist", "Butt-length"], extras: [{ name: "Add Curls", price: 10 }, { name: "Add Beads", price: 8 }] },
  "cornrows": { extras: [{ name: "Custom Design", price: 15 }, { name: "Add Beads", price: 8 }] },
  "twists": { sizes: ["Jumbo", "Medium", "Small"], lengths: ["Mid-back", "Waist"], extras: [{ name: "Add Beads", price: 8 }] },
  "locs": { lengths: ["Mid-back", "Waist", "Butt-length"], extras: [{ name: "Add Curls", price: 10 }] },
  "fade": { extras: [{ name: "Hot Towel", price: 5 }, { name: "Beard Oil", price: 4 }] },
  "taper": { extras: [{ name: "Hot Towel", price: 5 }, { name: "Beard Oil", price: 4 }] },
  "beard": { extras: [{ name: "Hot Towel", price: 5 }, { name: "Beard Oil", price: 4 }] },
};

const getVariants = (name: string) => {
  const lower = name.toLowerCase();
  for (const key of Object.keys(VARIANT_CONFIG)) {
    if (lower.includes(key)) return VARIANT_CONFIG[key];
  }
  return null;
};

const SIZE_PRICE: Record<string, number> = { "Jumbo": 0, "Medium": 10, "Small": 20 };
const LENGTH_PRICE: Record<string, number> = { "Mid-back": 0, "Waist": 15, "Butt-length": 30 };

const AUDIENCE_FILTERS = ["All", "Men", "Women", "Kids", "Unisex"] as const;

const ServicesDirectory = () => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<string>("All");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navigate = useNavigate();

  const [servicePhotos, setServicePhotos] = useState<Record<string, string[]>>({});
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryTitle, setGalleryTitle] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await api.from("service_catalog").select("*").eq("is_active", true).order("category, name");
      setItems((data as CatalogItem[]) ?? []);

      const { data: files } = await api.storage.from("site-images").list("services", { limit: 500 });
      if (files) {
        const photoMap: Record<string, string[]> = {};
        for (const file of files) {
          const slug = file.name.split("_")[0]?.toLowerCase();
          if (!slug) continue;
          const { data: urlData } = api.storage.from("site-images").getPublicUrl(`services/${file.name}`);
          if (!photoMap[slug]) photoMap[slug] = [];
          photoMap[slug].push(urlData.publicUrl);
        }
        setServicePhotos(photoMap);
      }
    };
    load();
  }, []);

  const getServicePhotos = (item: CatalogItem): string[] => {
    if (item.image_url) return [item.image_url];
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    return servicePhotos[slug] || [];
  };

  const openGallery = (e: React.MouseEvent, item: CatalogItem) => {
    e.stopPropagation();
    const photos = getServicePhotos(item);
    if (photos.length === 0) return;
    setGalleryImages(photos);
    setGalleryIndex(0);
    setGalleryTitle(item.name);
    setGalleryOpen(true);
  };

  // Filter by search + audience
  const filtered = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.category.toLowerCase().includes(search.toLowerCase()) && !(i.description || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (audienceFilter !== "All") {
      const audience = i.target_audience || "Unisex";
      if (audienceFilter === "Men" && audience !== "Men" && audience !== "Unisex") return false;
      if (audienceFilter === "Women" && audience !== "Women" && audience !== "Unisex") return false;
      if (audienceFilter === "Kids" && audience !== "Kids") return false;
      if (audienceFilter === "Unisex" && audience !== "Unisex") return false;
    }
    return true;
  });

  // Featured items
  const featured = filtered.filter(i => i.featured_style);

  const categories = [...new Set(filtered.map(i => i.category))].sort();
  const grouped = categories.reduce((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, CatalogItem[]>);

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    sectionRefs.current[cat]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleServiceClick = (item: CatalogItem) => {
    navigate(`/book?service=${item.id}`);
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
  };

  const isBraidingCategory = (cat: string) => cat.toLowerCase().includes("braid") || cat.toLowerCase().includes("lounge");

  const renderServiceCard = (item: CatalogItem, large = false) => {
    const photos = getServicePhotos(item);
    const hasPhotos = photos.length > 0;
    const current = servicePrice(item);
    const original = serviceOriginal(item);
    const onSale = serviceOnSale(item);

    return (
      <div
        key={item.id}
        className={cn(
          "bg-white border border-border rounded-sm overflow-hidden hover:shadow-md hover:border-[hsl(var(--primary))]/30 transition-all group",
          large && "sm:col-span-2"
        )}
      >
        {hasPhotos && (
          <button onClick={(e) => openGallery(e, item)} className="w-full relative">
            <AspectRatio ratio={4 / 5}>
              <img src={photos[0]} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
            </AspectRatio>
            <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />{photos.length}
            </div>
            {onSale && (
              <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.18em] px-2 py-1 font-semibold">
                Sale −{discountPercent(original!, current)}%
              </div>
            )}
            {item.featured_style && (
              <div className="absolute top-2 left-2 bg-foreground text-background text-xs px-2.5 py-1 rounded-none flex items-center gap-1 shadow-lg">
                <Sparkles className="h-3 w-3" /> Trending
              </div>
            )}
          </button>
        )}

        <button onClick={() => handleServiceClick(item)} className="w-full p-4 text-left">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-foreground group-hover:text-[hsl(var(--primary))] transition-colors">{item.name}</p>
                {!hasPhotos && onSale && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Sale −{discountPercent(original!, current)}%</Badge>
                )}
                {!hasPhotos && item.featured_style && (
                  <Badge className="bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/20 text-[10px]">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />Trending
                  </Badge>
                )}
              </div>
              {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-bold text-[hsl(var(--primary))] text-sm">From £{current}</span>
              {original != null && <span className="line-through opacity-70">£{original}</span>}
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(item.duration_minutes)}</span>
            </div>
            <div className="h-7 w-7 rounded-none bg-[hsl(var(--primary))]/10 flex items-center justify-center group-hover:bg-[hsl(var(--primary))] transition-colors">
              <ArrowRight className="h-4 w-4 text-[hsl(var(--primary))] group-hover:text-white transition-colors" />
            </div>
          </div>
          {hasPhotos && (
            <p className="text-xs text-[hsl(var(--primary))] mt-2 flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> View Style Gallery
            </p>
          )}
        </button>
      </div>
    );
  };

  return (
    <>
      <SEOHead title="Services — E and B" description="Browse our full catalog of hair services, braiding and more." />

      <div className="min-h-screen bg-background text-foreground">
        {/* Editorial Hero */}
        <section className="border-t border-border">
          <div className="container">
            <div className="flex flex-wrap items-center justify-between gap-2 py-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground border-b border-border">
              <span>The Index</span>
              <span className="hidden sm:inline">A complete catalogue</span>
              <Link to="/book" className="hover:text-primary transition-colors">Reserve →</Link>
            </div>
            <div className="py-12 lg:py-16 max-w-3xl">
              <p className="eyebrow mb-4">All Services</p>
              <h1 className="display-lg mb-6">Services, plainly listed.</h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-xl mb-8">
                Every style we offer, every price, every duration. Browse, choose, and add to your basket — or book a chair to discuss in person.
              </p>
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder='Search styles (e.g. "Knotless", "Fade")…'
                  className="w-full bg-background border border-border rounded-none pl-11 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
                />
              </div>
              <div className="mt-6 flex gap-2 flex-wrap">
                {AUDIENCE_FILTERS.map(a => (
                  <button
                    key={a}
                    onClick={() => setAudienceFilter(a)}
                    className={cn(
                      "px-4 py-1.5 rounded-none text-[11px] uppercase tracking-[0.18em] font-medium border transition-colors",
                      audienceFilter === a
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Category Pills */}
        <div className="sm:hidden sticky top-0 z-30 bg-background border-b border-border px-4 py-3 overflow-x-auto flex gap-2 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => scrollToCategory(cat)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-none text-sm font-medium transition-colors shrink-0",
                activeCategory === cat ? "bg-[hsl(var(--primary))] text-white" : "bg-white border border-border text-muted-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="max-w-6xl mx-auto flex gap-8 px-4 py-8">
          {/* Desktop Sidebar */}
          <aside className="hidden sm:block w-56 shrink-0">
            <div className="sticky top-8 space-y-1">
              <p className="text-xs uppercase tracking-widest text-[hsl(var(--primary))] mb-3">Categories</p>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-sm text-sm transition-colors",
                    activeCategory === cat
                      ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {cat}
                  <Badge variant="outline" className="ml-2 text-xs">{grouped[cat]?.length ?? 0}</Badge>
                </button>
              ))}
            </div>
          </aside>

          {/* Service Grid */}
          <div className="flex-1 space-y-10">
            {/* Featured Section */}
            {featured.length > 0 && !search && (
              <div>
                <h2 className="text-lg font-display text-foreground mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[hsl(var(--primary))]" />
                  Trending Styles
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {featured.slice(0, 6).map(item => renderServiceCard(item))}
                </div>
              </div>
            )}

            {/* No results */}
            {Object.keys(grouped).length === 0 && (
              <div className="text-center py-20">
                <p className="text-muted-foreground mb-2">No services found matching "{search}"</p>
                <p className="text-sm text-[hsl(var(--primary))]">Style not found? <Link to="/contact" className="underline">Contact us</Link> for a custom booking.</p>
              </div>
            )}

            {/* Category Sections */}
            {Object.entries(grouped).map(([cat, services]) => {
              const isBraiding = isBraidingCategory(cat);
              const isKids = cat.toLowerCase().includes("kids");
              return (
                <div key={cat} ref={el => { sectionRefs.current[cat] = el; }}>
                  <h2 className="text-lg font-display text-foreground mb-4 flex items-center gap-2">
                    {isKids && <Star className="h-4 w-4 text-[hsl(var(--primary))]" />}
                    {cat}
                    <span className="text-xs text-[hsl(var(--primary))] font-normal">({services.length})</span>
                  </h2>
                  <div className={cn(
                    "gap-3",
                    isBraiding
                      ? "columns-1 sm:columns-2 lg:columns-3 space-y-3"
                      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  )}>
                    {services.map(item => isBraiding
                      ? <div key={item.id} className="break-inside-avoid">{renderServiceCard(item)}</div>
                      : renderServiceCard(item)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Book CTA */}
        <Link to="/book" className="fixed bottom-6 right-6 z-50">
          <Button className="bg-[hsl(var(--primary))] hover:bg-primary/90 text-white rounded-none px-6 py-3 h-auto shadow-xl gap-2">
            Book a chair
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>

        {/* Gallery Modal */}
        <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
          <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-black border-none">
            <div className="relative">
              <div className="absolute top-4 left-4 z-10">
                <p className="text-white font-display text-lg drop-shadow-lg">{galleryTitle}</p>
                <p className="text-white/60 text-xs">{galleryIndex + 1} / {galleryImages.length}</p>
              </div>
              <AspectRatio ratio={4 / 5}>
                <img src={galleryImages[galleryIndex]} alt={`${galleryTitle} style ${galleryIndex + 1}`} className="w-full h-full object-cover" />
              </AspectRatio>
              {galleryImages.length > 1 && (
                <>
                  <button onClick={() => setGalleryIndex(i => (i - 1 + galleryImages.length) % galleryImages.length)} className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-none bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button onClick={() => setGalleryIndex(i => (i + 1) % galleryImages.length)} className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-none bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            {galleryImages.length > 1 && (
              <div className="flex gap-2 p-3 bg-black overflow-x-auto">
                {galleryImages.map((img, i) => (
                  <button key={i} onClick={() => setGalleryIndex(i)} className={cn("shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors", i === galleryIndex ? "border-[hsl(var(--primary))]" : "border-transparent opacity-60 hover:opacity-100")}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </>
  );
};

export default ServicesDirectory;
