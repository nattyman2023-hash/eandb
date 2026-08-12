import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Sparkles, Plus, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AddonOption {
  id: string; // service_catalog id (the addon)
  name: string;
  base_price: number;
  duration_minutes: number;
  category: string;
  description: string | null;
  discount_pct: number;
}

interface Props {
  serviceId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onLoaded?: (addons: AddonOption[]) => void;
}

export default function ServiceAddonsPicker({ serviceId, selectedIds, onChange, onLoaded }: Props) {
  const [addons, setAddons] = useState<AddonOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await api
        .from("service_addons")
        .select("addon_id, sort_order, discount_pct, service_catalog!service_addons_addon_id_fkey:service_catalog!inner(id,name,base_price,duration_minutes,category,description,is_active)")
        .eq("service_id", serviceId)
        .order("sort_order");

      // Fallback to manual join if PostgREST hint fails
      let rows = (data as any[]) || [];
      if (!rows.length) {
        const { data: links } = await api
          .from("service_addons")
          .select("addon_id, sort_order, discount_pct")
          .eq("service_id", serviceId)
          .order("sort_order");
        const ids = (links || []).map((l: any) => l.addon_id);
        if (ids.length) {
          const { data: services } = await api
            .from("service_catalog")
            .select("id,name,base_price,duration_minutes,category,description,is_active")
            .in("id", ids);
          const byId = new Map((services || []).map((s: any) => [s.id, s]));
          rows = (links || []).map((l: any) => ({
            ...l,
            service_catalog: byId.get(l.addon_id),
          }));
        }
      }

      const mapped: AddonOption[] = rows
        .map((r: any) => {
          const s = r.service_catalog;
          if (!s || s.is_active === false) return null;
          return {
            id: s.id,
            name: s.name,
            base_price: Number(s.base_price) || 0,
            duration_minutes: Number(s.duration_minutes) || 0,
            category: s.category,
            description: s.description,
            discount_pct: Number(r.discount_pct) || 0,
          };
        })
        .filter(Boolean) as AddonOption[];

      if (!cancelled) {
        setAddons(mapped);
        setLoading(false);
        onLoaded?.(mapped);
      }
    })();
    return () => { cancelled = true; };
  }, [serviceId]);

  if (loading || addons.length === 0) return null;

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className="rounded-xl border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-base">Make it a complete visit</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add a related treatment to your booking — your stylist will fit it in the same session.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {addons.map(a => {
          const selected = selectedIds.includes(a.id);
          const finalPrice = Math.round(a.base_price * (1 - a.discount_pct / 100) * 100) / 100;
          const showDiscount = a.discount_pct > 0;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              className={cn(
                "w-full text-left rounded-lg border-2 p-3 transition-all flex items-center gap-3",
                selected ? "border-accent bg-accent/10 shadow-sm" : "border-border hover:border-accent/40 bg-card",
              )}
            >
              <div className={cn(
                "h-8 w-8 shrink-0 rounded-full flex items-center justify-center border-2",
                selected ? "bg-accent text-accent-foreground border-accent" : "border-border",
              )}>
                {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-sm truncate">{a.name}</p>
                  <div className="flex items-baseline gap-1.5 shrink-0">
                    {showDiscount && (
                      <span className="text-xs text-muted-foreground line-through">£{a.base_price}</span>
                    )}
                    <span className="font-bold text-primary text-sm">+£{finalPrice}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3" /> +{a.duration_minutes} min
                  {a.description && <span className="truncate">· {a.description}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
