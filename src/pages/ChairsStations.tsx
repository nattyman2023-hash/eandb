import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Armchair, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Chair {
  id: string; name: string; zone: string; zones: string[]; is_active: boolean; notes: string | null; created_at: string;
}

const ZONES = ["Barbershop", "Hair Studio", "Braiding Lounge", "Wash", "Treatment", "Kids Zone"];

const zoneColor: Record<string, string> = {
  "Barbershop": "bg-primary/20 text-primary",
  "Hair Studio": "bg-accent/20 text-accent",
  "Braiding Lounge": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Wash": "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  "Treatment": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Kids Zone": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const ChairsStations = () => {
  const [chairs, setChairs] = useState<Chair[]>([]);
  const [zone, setZone] = useState("all");
  const [open, setOpen] = useState(false);
  const [editChair, setEditChair] = useState<Chair | null>(null);
  const emptyForm = { name: "", zones: ["Barbershop"] as string[], notes: "" };
  const [form, setForm] = useState(emptyForm);

  const fetchChairs = async () => {
    const { data } = await api.from("chairs").select("*").order("created_at");
    setChairs(((data as any[]) ?? []).map(c => ({ ...c, zones: c.zones?.length ? c.zones : [c.zone].filter(Boolean) })));
  };
  useEffect(() => { fetchChairs(); }, []);

  const filtered = zone === "all" ? chairs : chairs.filter(c => c.zones?.includes(zone));

  const toggleZone = (z: string) => {
    setForm(f => ({
      ...f,
      zones: f.zones.includes(z) ? f.zones.filter(x => x !== z) : [...f.zones, z],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (form.zones.length === 0) { toast.error("Pick at least one zone"); return; }
    const payload = { name: form.name, zone: form.zones[0], zones: form.zones, notes: form.notes || null };
    if (editChair) {
      await api.from("chairs").update(payload).eq("id", editChair.id);
    } else {
      await api.from("chairs").insert(payload);
    }
    setOpen(false); setEditChair(null); setForm(emptyForm);
    fetchChairs(); toast.success(editChair ? "Chair updated" : "Chair added");
  };

  const toggleActive = async (id: string, active: boolean) => {
    await api.from("chairs").update({ is_active: active }).eq("id", id);
    setChairs(prev => prev.map(c => c.id === id ? { ...c, is_active: active } : c));
  };

  const handleDelete = async (id: string) => {
    await api.from("chairs").delete().eq("id", id);
    setChairs(prev => prev.filter(c => c.id !== id));
    toast.success("Chair removed");
  };

  const openEdit = (c: Chair) => {
    setEditChair(c);
    setForm({ name: c.name, zones: c.zones?.length ? c.zones : [c.zone], notes: c.notes || "" });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">Chairs & Stations</h1>
          <p className="text-muted-foreground mt-1">{chairs.length} stations · {chairs.filter(c => c.is_active).length} active</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditChair(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Chair</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editChair ? "Edit Chair" : "Add Chair"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Station 1" /></div>
              <div>
                <Label>Zones (chair can serve more than one)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {ZONES.map(z => {
                    const active = form.zones.includes(z);
                    return (
                      <button
                        key={z}
                        type="button"
                        onClick={() => toggleZone(z)}
                        className={cn(
                          "inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition",
                          active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                        {z}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" /></div>
              <Button onClick={handleSave} className="w-full">{editChair ? "Update" : "Add Chair"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={zone} onValueChange={setZone}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All Zones</TabsTrigger>
          {ZONES.map(z => <TabsTrigger key={z} value={z}>{z}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="gilded-card p-12 text-center">
          <Armchair className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No chairs in this zone yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <div key={c.id} className="gilded-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{c.name}</h3>
                <Switch checked={c.is_active} onCheckedChange={v => toggleActive(c.id, v)} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(c.zones ?? [c.zone]).map(z => (
                  <Badge key={z} className={zoneColor[z] ?? ""}>{z}</Badge>
                ))}
              </div>
              {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChairsStations;
