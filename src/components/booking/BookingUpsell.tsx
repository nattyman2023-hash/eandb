import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Plus, Sparkles, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { productPrice, productOriginal } from "@/lib/pricing";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  is_on_promo: boolean;
  category: string;
  tags: string[] | null;
  image_url: string | null;
  stock_quantity: number;
}

const KEYWORD_MAP: Record<string, string[]> = {
  braid: ["edge", "satin", "oil", "mousse"],
  knotless: ["edge", "satin", "oil"],
  cornrow: ["edge", "gel"],
  twist: ["cream", "satin", "oil"],
  loc: ["spray", "oil", "satin"],
  fade: ["aftershave", "beard", "balm"],
  cut: ["balm", "gel", "pomade"],
  weave: ["wig", "serum", "satin"],
  wig: ["wig", "serum"],
  colour: ["color", "conditioner"],
  color: ["color", "conditioner"],
  wash: ["shampoo", "conditioner"],
  treatment: ["conditioner", "mask", "oil"],
};

interface Props {
  serviceId: string;
  serviceName: string;
}

export default function BookingUpsell({ serviceId, serviceName }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const { addProductToCart, productItemCount } = useCart();

  useEffect(() => {
    const load = async () => {
      // 1. Curated upsell from service_catalog.upsell_product_id
      const { data: svc } = await api
        .from("service_catalog")
        .select("upsell_product_id")
        .eq("id", serviceId)
        .single();

      const curatedId = (svc as any)?.upsell_product_id as string | null;
      let curated: Product | null = null;
      if (curatedId) {
        const { data } = await api.from("products").select("*").eq("id", curatedId).maybeSingle();
        if (data) curated = data as any;
      }

      // 2. Keyword-matched products
      const lower = serviceName.toLowerCase();
      const keywords = new Set<string>();
      Object.keys(KEYWORD_MAP).forEach(k => {
        if (lower.includes(k)) KEYWORD_MAP[k].forEach(w => keywords.add(w));
      });

      let matched: Product[] = [];
      if (keywords.size > 0) {
        const { data: all } = await api
          .from("products")
          .select("*")
          .eq("is_active", true)
          .gt("stock_quantity", 0);
        matched = ((all as any[]) || []).filter(p =>
          Array.from(keywords).some(k => p.name.toLowerCase().includes(k) || (p.tags || []).some((t: string) => t.toLowerCase().includes(k)))
        );
      }

      const seen = new Set<string>();
      const final: Product[] = [];
      if (curated && !seen.has(curated.id)) { final.push(curated); seen.add(curated.id); }
      for (const p of matched) {
        if (final.length >= 4) break;
        if (!seen.has(p.id)) { final.push(p); seen.add(p.id); }
      }
      // Fill with featured if still too few
      if (final.length < 3) {
        const { data: featured } = await api
          .from("products")
          .select("*")
          .eq("is_active", true)
          .eq("is_featured", true)
          .gt("stock_quantity", 0)
          .limit(4);
        for (const p of (featured as any[] || [])) {
          if (final.length >= 4) break;
          if (!seen.has(p.id)) { final.push(p as any); seen.add(p.id); }
        }
      }

      setProducts(final);
      setLoading(false);
    };
    load();
  }, [serviceId, serviceName]);

  const handleAdd = (p: Product) => {
    const price = productPrice(p);
    addProductToCart({ id: p.id, name: p.name, price, category: p.category, image_url: p.image_url || undefined });
    setAdded(prev => new Set(prev).add(p.id));
    toast.success(`${p.name} added to bag`, {
      action: { label: "View bag", onClick: () => window.location.assign("/cart") },
    });
  };

  if (loading || products.length === 0) return null;

  return (
    <div className="border-t border-border pt-8 mt-2">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="eyebrow">Complete your look</p>
      </div>
      <h3 className="font-display text-2xl mb-1">Pair your treatment with the right product.</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Hand-picked for {serviceName}. Add to your bag now and check out separately.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map(p => {
          const price = productPrice(p);
          const original = productOriginal(p);
          const isAdded = added.has(p.id);
          return (
            <div key={p.id} className="border border-border bg-card rounded-sm p-3 flex flex-col">
              <Link to={`/shop/${p.id}`} className="block aspect-square rounded-sm overflow-hidden bg-muted mb-3">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-8 w-8 text-muted-foreground/30" /></div>
                )}
              </Link>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{p.category}</p>
              <h4 className="font-medium text-foreground text-sm leading-tight line-clamp-2 flex-1">{p.name}</h4>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-bold text-primary">£{price.toFixed(2)}</span>
                {original != null && <span className="text-xs text-muted-foreground line-through">£{original.toFixed(2)}</span>}
              </div>
              <Button
                size="sm"
                variant={isAdded ? "outline" : "default"}
                className="w-full mt-2 gap-1.5"
                onClick={() => handleAdd(p)}
                disabled={isAdded}
              >
                {isAdded ? <><Check className="h-3.5 w-3.5" /> Added</> : <><Plus className="h-3.5 w-3.5" /> Add to bag</>}
              </Button>
            </div>
          );
        })}
      </div>

      {productItemCount > 0 && (
        <div className="mt-6 flex items-center justify-between bg-muted/50 border border-border rounded-sm p-4">
          <div>
            <p className="text-sm font-medium text-foreground">{productItemCount} item{productItemCount > 1 ? "s" : ""} in your bag</p>
            <p className="text-xs text-muted-foreground">Your booking is confirmed — products check out separately.</p>
          </div>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/cart">Go to Bag <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      )}
    </div>
  );
}
