import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Sparkles, Clock } from "lucide-react";

interface AddonRow {
  id: string;
  addon_service_id: string;
  price_snapshot: number;
  duration_minutes_snapshot: number;
  name?: string;
}

interface Props {
  jobId: string;
  basePrice?: number;
  baseDuration?: number;
  baseName?: string;
  variant?: "admin" | "portal";
}

export default function JobAddonsList({ jobId, basePrice, baseDuration, baseName, variant = "admin" }: Props) {
  const [rows, setRows] = useState<AddonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await api
        .from("job_addons")
        .select("id, addon_service_id, price_snapshot, duration_minutes_snapshot")
        .eq("job_id", jobId);
      const addonRows = (data as AddonRow[]) || [];
      if (addonRows.length) {
        const ids = addonRows.map(r => r.addon_service_id);
        const { data: services } = await api.from("service_catalog").select("id, name").in("id", ids);
        const byId = new Map<string, string>((services || []).map((s: any) => [s.id, s.name]));
        addonRows.forEach(r => { r.name = byId.get(r.addon_service_id) || "Add-on"; });
      }
      if (!cancelled) {
        setRows(addonRows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  if (loading) return null;
  if (rows.length === 0 && basePrice == null) return null;

  const addonsTotal = rows.reduce((s, r) => s + Number(r.price_snapshot || 0), 0);
  const addonsDuration = rows.reduce((s, r) => s + Number(r.duration_minutes_snapshot || 0), 0);
  const total = (basePrice ?? 0) + addonsTotal;
  const totalDuration = (baseDuration ?? 0) + addonsDuration;

  const isPortal = variant === "portal";

  return (
    <div className={isPortal ? "bg-[#F5F3EE] rounded-xl p-3 space-y-2" : "rounded-lg border p-3 space-y-2 bg-accent/5"}>
      <div className="flex items-center gap-2">
        <Sparkles className={isPortal ? "h-3.5 w-3.5 text-[#A68966]" : "h-3.5 w-3.5 text-accent"} />
        <p className={isPortal ? "text-xs uppercase tracking-wider text-[#A68966]" : "text-xs font-semibold uppercase tracking-wider text-muted-foreground"}>
          Service breakdown
        </p>
      </div>
      <div className="space-y-1 text-sm">
        {baseName && (
          <div className="flex items-center justify-between">
            <span className="truncate">{baseName}</span>
            <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
              {baseDuration != null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{baseDuration}m</span>}
              {basePrice != null && <span className="font-medium text-foreground">£{basePrice.toFixed(2)}</span>}
            </div>
          </div>
        )}
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between pl-3">
            <span className="truncate text-muted-foreground">+ {r.name}</span>
            <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.duration_minutes_snapshot}m</span>
              <span className="font-medium text-foreground">£{Number(r.price_snapshot).toFixed(2)}</span>
            </div>
          </div>
        ))}
        {(rows.length > 0 || basePrice != null) && (
          <div className="flex items-center justify-between pt-1.5 border-t border-border/60 font-semibold">
            <span>Total</span>
            <div className="flex items-baseline gap-2 text-xs">
              <span className="text-muted-foreground">{totalDuration}m</span>
              <span className="text-base text-primary">£{total.toFixed(2)}</span>
            </div>
          </div>
        )}
        {rows.length === 0 && basePrice != null && (
          <p className="text-xs text-muted-foreground italic">No add-ons selected</p>
        )}
      </div>
    </div>
  );
}
