import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { productPrice, productOriginal, servicePrice, serviceOriginal, discountPercent } from "@/lib/pricing";
import { Sparkles } from "lucide-react";

interface PromoItem {
  kind: "service" | "product";
  id: string;
  name: string;
  current: number;
  original: number;
  percent: number;
  href: string;
}

const PromoBar = () => {
  const [items, setItems] = useState<PromoItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const [svcRes, prodRes] = await Promise.all([
        api.from("service_catalog").select("id,name,base_price,sale_price,is_on_promo").eq("is_on_promo", true).eq("is_active", true).limit(20),
        api.from("products").select("id,name,price,compare_at_price,sale_price,is_on_promo").or("is_on_promo.eq.true,and(compare_at_price.gt.0)").eq("is_active", true).limit(20),
      ]);
      const svcs: PromoItem[] = (svcRes.data ?? []).map((s: any) => {
        const current = servicePrice(s);
        const original = serviceOriginal(s) ?? s.base_price;
        return {
          kind: "service",
          id: s.id,
          name: s.name,
          current, original,
          percent: discountPercent(original, current),
          href: "/services",
        };
      });
      const prods: PromoItem[] = (prodRes.data ?? []).filter((p: any) => {
        const orig = productOriginal(p);
        return orig != null && orig > productPrice(p);
      }).map((p: any) => {
        const current = productPrice(p);
        const original = productOriginal(p) ?? p.price;
        return {
          kind: "product",
          id: p.id,
          name: p.name,
          current, original,
          percent: discountPercent(original, current),
          href: `/shop/${p.id}`,
        };
      });
      setItems([...svcs, ...prods]);
    };
    load();
  }, []);

  if (items.length === 0) return null;

  // Repeat for marquee continuity
  const loop = [...items, ...items];

  return (
    <div className="bg-foreground text-background overflow-hidden border-b border-foreground/20">
      <div className="container py-2 flex items-center gap-3">
        <span className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-semibold shrink-0">
          <Sparkles className="h-3 w-3" /> On Promotion
        </span>
        <div className="flex-1 overflow-hidden relative">
          <div className="flex gap-8 animate-[marquee_40s_linear_infinite] whitespace-nowrap">
            {loop.map((it, i) => (
              <Link
                key={`${it.kind}-${it.id}-${i}`}
                to={it.href}
                className="text-[11px] uppercase tracking-[0.18em] hover:text-primary transition-colors flex items-center gap-2 shrink-0"
              >
                <span>{it.name}</span>
                <span className="text-primary font-semibold">£{it.current.toFixed(2)}</span>
                <span className="line-through opacity-50">£{it.original.toFixed(2)}</span>
                {it.percent > 0 && <span className="text-primary">−{it.percent}%</span>}
                <span className="opacity-30">·</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoBar;
