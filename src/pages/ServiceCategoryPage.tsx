import { useEffect, useState } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Clock, Scissors } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { BUSINESS } from "@/lib/siteContent";

interface CatalogItem {
  id: string; name: string; base_price: number; duration_minutes: number;
  category: string; description: string | null; is_active: boolean;
  target_audience: string;
}

const CATEGORY_MAP: Record<string, { title: string; description: string; dbCategory: string }> = {
  barbering: {
    title: "Barbering Price List",
    description: "Precision fades, tapers, beard sculpting and classic cuts from our expert barbers.",
    dbCategory: "Barbering",
  },
  hairdressing: {
    title: "Hairdressing Price List",
    description: "Cuts, colour, blowdry, styling and treatments for all hair types.",
    dbCategory: "Hairdressing",
  },
  braiding: {
    title: "Braiding Price List",
    description: "Box braids, cornrows, knotless braids, twists and all protective styles.",
    dbCategory: "Braiding",
  },
  "hair-treatments": {
    title: "Hair Treatments Price List",
    description: "Deep conditioning, keratin smoothing, scalp therapy and more.",
    dbCategory: "Hair Treatments",
  },
};

const ServiceCategoryPage = () => {
  const { category } = useParams<{ category: string }>();
  const config = category ? CATEGORY_MAP[category] : undefined;
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    if (!config) return;
    const fetch = async () => {
      const { data } = await api.from("service_catalog").select("*").eq("is_active", true).ilike("category", `%${config.dbCategory}%`).order("base_price");
      setItems((data as CatalogItem[]) ?? []);
    };
    fetch();
  }, [config?.dbCategory]);

  if (!config) return <Navigate to="/services" replace />;

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
  };

  const handleBook = (item: CatalogItem) => {
    navigate(`/book?service=${item.id}`);
  };

  return (
    <>
      <SEOHead
        title={`${config.title} | ${BUSINESS.name}`}
        description={config.description}
        canonical={`/${category}`}
      />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <section className="bg-card border-b border-border">
          <div className="container py-12 md:py-16 text-center space-y-3">
            <p className="font-industrial text-xs uppercase tracking-widest text-primary">Our Menu</p>
            <h1 className="font-heading text-3xl md:text-4xl font-extrabold">{config.title}</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">{config.description}</p>
          </div>
        </section>

        {/* Service list */}
        <div className="container py-8 max-w-2xl space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <Scissors className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No services in this category yet. Check back soon!</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{item.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(item.duration_minutes)}</span>
                    {item.description && <span className="text-xs text-muted-foreground hidden sm:inline">· {item.description}</span>}
                  </div>
                </div>
                <Button
                  onClick={() => handleBook(item)}
                  className="shrink-0 gap-1"
                  size="sm"
                >
                  Book £{item.base_price}
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Book FAB */}
        <Link to="/book" className="fixed bottom-6 right-6 z-50">
          <Button size="lg" className="rounded-full shadow-lg gap-2">
            Book a chair
          </Button>
        </Link>
      </div>
    </>
  );
};

export default ServiceCategoryPage;
