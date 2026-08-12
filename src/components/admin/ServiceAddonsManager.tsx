import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Link2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  serviceId: string;
  serviceName: string;
}

interface Row {
  id: string;
  addon_id: string;
  discount_pct: number;
  sort_order: number;
}

interface ServiceLite { id: string; name: string; category: string; base_price: number; }

export default function ServiceAddonsManager({ serviceId, serviceName }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [pickId, setPickId] = useState<string>("");
  const [pickDiscount, setPickDiscount] = useState<string>("0");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: addonRows }, { data: svcRows }] = await Promise.all([
      api.from("service_addons")
        .select("id, addon_id, discount_pct, sort_order")
        .eq("service_id", serviceId)
        .order("sort_order"),
      api.from("service_catalog")
        .select("id, name, category, base_price")
        .eq("is_active", true)
        .order("category, name"),
    ]);
    setRows((addonRows as Row[]) || []);
    setServices((svcRows as ServiceLite[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [serviceId]);

  const addRow = async () => {
    if (!pickId) return;
    if (pickId === serviceId) { toast.error("Can't add a service as its own add-on"); return; }
    if (rows.some(r => r.addon_id === pickId)) { toast.error("Already added"); return; }
    const sortOrder = rows.length;
    const { error } = await api.from("service_addons").insert({
      service_id: serviceId,
      addon_id: pickId,
      discount_pct: Number(pickDiscount) || 0,
      sort_order: sortOrder,
    } as any);
    if (error) { toast.error(error.message); return; }
    setPickId(""); setPickDiscount("0");
    load();
  };

  const removeRow = async (id: string) => {
    await api.from("service_addons").delete().eq("id", id);
    load();
  };

  const updateDiscount = async (id: string, value: string) => {
    const v = Number(value) || 0;
    setRows(prev => prev.map(r => r.id === id ? { ...r, discount_pct: v } : r));
    await api.from("service_addons").update({ discount_pct: v } as any).eq("id", id);
  };

  const byId = new Map(services.map(s => [s.id, s]));
  const available = services.filter(s => s.id !== serviceId && !rows.some(r => r.addon_id === s.id));

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <Label className="text-sm">Related services / Add-ons</Label>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Suggested to clients booking <strong>{serviceName}</strong>. Optional bundle discount per add-on.
      </p>

      {!loading && rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map(r => {
            const svc = byId.get(r.addon_id);
            return (
              <div key={r.id} className="flex items-center gap-2 bg-card rounded-md border p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{svc?.name || "(deleted)"}</p>
                  <p className="text-[11px] text-muted-foreground">{svc?.category} · £{svc?.base_price}</p>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Input
                    type="number"
                    min="0" max="100"
                    value={r.discount_pct}
                    onChange={e => updateDiscount(r.id, e.target.value)}
                    className="w-16 h-8 text-xs"
                  />
                  <span className="text-muted-foreground">% off</span>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeRow(r.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {available.length > 0 ? (
        <div className="flex items-end gap-2 pt-1">
          <div className="flex-1 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Add a related service</Label>
            <Select value={pickId} onValueChange={setPickId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choose a service…" /></SelectTrigger>
              <SelectContent>
                {available.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — £{s.base_price} ({s.category})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20">
            <Label className="text-[11px] text-muted-foreground">Discount %</Label>
            <Input type="number" min="0" max="100" value={pickDiscount} onChange={e => setPickDiscount(e.target.value)} className="h-9 text-xs" />
          </div>
          <Button size="sm" onClick={addRow} disabled={!pickId} className="h-9 gap-1">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      ) : (
        !loading && rows.length === 0 && <p className="text-xs text-muted-foreground italic">No other active services to link.</p>
      )}
    </div>
  );
}
