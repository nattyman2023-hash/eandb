import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, Scissors, Clock, Eye, EyeOff, Snowflake, Percent, CheckSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ServiceAddonsManager from "@/components/admin/ServiceAddonsManager";

interface ServiceItem {
  id: string; name: string; base_price: number; duration_minutes: number; estimated_hours: number;
  category: string; is_active: boolean; is_seasonal: boolean; description: string | null; icon: string | null;
  target_audience: string; featured_style: boolean; image_url: string | null;
  deposit_required: boolean; deposit_amount: number; upsell_product_id: string | null;
}

const AUDIENCE_OPTIONS = ["Unisex", "Men", "Women", "Kids"];

const ServiceManager = () => {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState({
    name: "", base_price: "", duration_minutes: "", category: "", description: "",
    is_seasonal: false, target_audience: "Unisex", featured_style: false, image_url: "",
    deposit_required: false, deposit_amount: "", upsell_product_id: "",
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"enable" | "disable" | "delete">("disable");

  const [multiplierOpen, setMultiplierOpen] = useState(false);
  const [multiplierCat, setMultiplierCat] = useState("");
  const [multiplierPercent, setMultiplierPercent] = useState("5");

  const fetchItems = async () => {
    const [svcRes, invRes] = await Promise.all([
      api.from("service_catalog").select("*").order("category, name"),
      api.from("inventory").select("id, name, category").order("name"),
    ]);
    setItems((svcRes.data as ServiceItem[]) ?? []);
    setInventory(invRes.data ?? []);
  };
  useEffect(() => { fetchItems(); }, []);

  const categories = [...new Set(items.map(i => i.category))].sort();

  const filtered = items.filter(i => {
    if (filter === "active" && !i.is_active) return false;
    if (filter === "hidden" && i.is_active) return false;
    if (filter === "seasonal" && !i.is_seasonal) return false;
    if (catFilter !== "all" && i.category !== catFilter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: items.length,
    active: items.filter(i => i.is_active).length,
    hidden: items.filter(i => !i.is_active).length,
    seasonal: items.filter(i => i.is_seasonal).length,
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload: any = {
      name: form.name, base_price: Number(form.base_price) || 0,
      duration_minutes: Number(form.duration_minutes) || 45,
      estimated_hours: (Number(form.duration_minutes) || 45) / 60,
      category: form.category || "general",
      description: form.description || null,
      is_seasonal: form.is_seasonal,
      target_audience: form.target_audience || "Unisex",
      featured_style: form.featured_style,
      image_url: form.image_url || null,
      deposit_required: form.deposit_required,
      deposit_amount: form.deposit_required ? (Number(form.deposit_amount) || 0) : 0,
      upsell_product_id: form.upsell_product_id || null,
    };
    if (editItem) {
      await api.from("service_catalog").update(payload).eq("id", editItem.id);
    } else {
      await api.from("service_catalog").insert(payload);
    }
    setOpen(false); setEditItem(null); resetForm(); fetchItems();
    toast.success(editItem ? "Service updated" : "Service added");
  };

  const resetForm = () => setForm({
    name: "", base_price: "", duration_minutes: "", category: "", description: "",
    is_seasonal: false, target_audience: "Unisex", featured_style: false, image_url: "",
    deposit_required: false, deposit_amount: "", upsell_product_id: "",
  });

  const toggleActive = async (id: string, active: boolean) => {
    await api.from("service_catalog").update({ is_active: active }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_active: active } : i));
  };

  const handleDelete = async (id: string) => {
    await api.from("service_catalog").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Service removed");
  };

  const openEdit = (item: ServiceItem) => {
    setEditItem(item);
    setForm({
      name: item.name, base_price: String(item.base_price),
      duration_minutes: String(item.duration_minutes), category: item.category,
      description: item.description || "", is_seasonal: item.is_seasonal,
      target_audience: item.target_audience || "Unisex",
      featured_style: item.featured_style || false,
      image_url: item.image_url || "",
      deposit_required: item.deposit_required || false,
      deposit_amount: item.deposit_amount ? String(item.deposit_amount) : "",
      upsell_product_id: item.upsell_product_id || "",
    });
    setOpen(true);
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
  };

  const toggleSelected = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };

  const handleBulk = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (bulkAction === "enable") {
      for (const id of ids) await api.from("service_catalog").update({ is_active: true }).eq("id", id);
      toast.success(`${ids.length} services enabled`);
    } else if (bulkAction === "disable") {
      for (const id of ids) await api.from("service_catalog").update({ is_active: false }).eq("id", id);
      toast.success(`${ids.length} services disabled`);
    } else {
      for (const id of ids) await api.from("service_catalog").delete().eq("id", id);
      toast.success(`${ids.length} services deleted`);
    }
    setSelected(new Set()); setBulkOpen(false); fetchItems();
  };

  const handleMultiplier = async () => {
    if (!multiplierCat) return;
    const pct = Number(multiplierPercent) / 100;
    const catItems = items.filter(i => i.category === multiplierCat);
    for (const item of catItems) {
      const newPrice = Math.round(item.base_price * (1 + pct));
      await api.from("service_catalog").update({ base_price: newPrice }).eq("id", item.id);
    }
    toast.success(`Updated ${catItems.length} services in "${multiplierCat}" by ${multiplierPercent}%`);
    setMultiplierOpen(false); fetchItems();
  };

  const grouped = categories.reduce((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, ServiceItem[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">Services</h1>
          <p className="text-muted-foreground mt-1">Manage your service catalog</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={multiplierOpen} onOpenChange={setMultiplierOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Percent className="mr-2 h-4 w-4" />Price Adjust</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Price Multiplier</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Category</Label>
                  <Select value={multiplierCat} onValueChange={setMultiplierCat}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Percentage Change (%)</Label>
                  <Input type="number" value={multiplierPercent} onChange={e => setMultiplierPercent(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Use negative numbers to decrease prices</p>
                </div>
                <Button onClick={handleMultiplier} disabled={!multiplierCat} className="w-full">Apply to All in Category</Button>
              </div>
            </DialogContent>
          </Dialog>

          {selected.size > 0 && (
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><CheckSquare className="mr-2 h-4 w-4" />{selected.size} Selected</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Bulk Action ({selected.size} services)</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Select value={bulkAction} onValueChange={v => setBulkAction(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enable">Enable All</SelectItem>
                      <SelectItem value="disable">Disable All</SelectItem>
                      <SelectItem value="delete">Delete All</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleBulk} variant={bulkAction === "delete" ? "destructive" : "default"} className="w-full">
                    {bulkAction === "delete" ? `Delete ${selected.size} Services` : `${bulkAction === "enable" ? "Enable" : "Disable"} ${selected.size} Services`}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditItem(null); resetForm(); } }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Service</Button></DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editItem ? "Edit Service" : "New Service"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Price (£)</Label><Input type="number" value={form.base_price} onChange={e => setForm({ ...form, base_price: e.target.value })} /></div>
                  <div><Label>Duration (mins)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} /></div>
                </div>
                <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Braiding Lounge" /></div>
                <div><Label>Target Audience</Label>
                  <Select value={form.target_audience} onValueChange={v => setForm({ ...form, target_audience: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AUDIENCE_OPTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Service image</Label>
                  <div className="flex items-center gap-3">
                    {form.image_url ? (
                      <img src={form.image_url} alt="" className="h-20 w-20 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="h-20 w-20 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const slug = (form.name || "service").toLowerCase().replace(/[^a-z0-9]+/g, "-");
                          const path = `services/${slug}/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
                          const { error: upErr } = await api.storage.from("site-images").upload(path, file, { upsert: true });
                          if (upErr) { toast.error(upErr.message); return; }
                          const { data: urlData } = api.storage.from("site-images").getPublicUrl(path);
                          setForm({ ...form, image_url: urlData?.publicUrl || "" });
                          toast.success("Image uploaded");
                        }}
                        className="block text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
                      />
                      <Input
                        placeholder="…or paste an image URL"
                        value={form.image_url}
                        onChange={e => setForm({ ...form, image_url: e.target.value })}
                        className="text-xs h-8"
                      />
                      {form.image_url && (
                        <button type="button" onClick={() => setForm({ ...form, image_url: "" })} className="text-xs text-destructive hover:underline">Remove image</button>
                      )}
                    </div>
                  </div>
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                {/* Deposit Toggle */}
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.deposit_required} onCheckedChange={v => setForm({ ...form, deposit_required: v })} />
                    <Label>Require Deposit</Label>
                  </div>
                  {form.deposit_required && (
                    <div>
                      <Label className="text-xs">Deposit Amount (£)</Label>
                      <Input type="number" step="0.01" placeholder="e.g. 20" value={form.deposit_amount} onChange={e => setForm({ ...form, deposit_amount: e.target.value })} />
                    </div>
                  )}
                </div>
                {/* AI Upsell Mapping */}
                <div>
                  <Label>AI Upsell Suggestion</Label>
                  <Select value={form.upsell_product_id || "none"} onValueChange={v => setForm({ ...form, upsell_product_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select a product to upsell" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {inventory.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.category})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">This product will be suggested when a client books this service</p>
                </div>
                {editItem && (
                  <ServiceAddonsManager serviceId={editItem.id} serviceName={editItem.name} />
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_seasonal} onCheckedChange={v => setForm({ ...form, is_seasonal: v })} />
                    <Label>Seasonal</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.featured_style} onCheckedChange={v => setForm({ ...form, featured_style: v })} />
                    <Label className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> Featured</Label>
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full">{editItem ? "Update" : "Add Service"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Services", value: stats.total, icon: Scissors },
          { label: "Active", value: stats.active, icon: Eye },
          { label: "Hidden", value: stats.hidden, icon: EyeOff },
          { label: "Seasonal", value: stats.seasonal, icon: Snowflake },
        ].map(s => (
          <div key={s.label} className="gilded-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="gilded-label">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-primary">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..." className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="hidden">Hidden</TabsTrigger>
            <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
          {selected.size === filtered.length ? "Deselect All" : "Select All"}
        </Button>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="gilded-card p-12 text-center">
          <Scissors className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No services match your filters</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, services]) => (
            <div key={cat} className="space-y-2">
              <h3 className="gilded-label text-sm">{cat}</h3>
              <div className="space-y-2">
                {services.map(item => (
                  <div key={item.id} className="gilded-card p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelected(item.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{item.name}</span>
                          {item.featured_style && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs"><Sparkles className="h-3 w-3 mr-0.5" />Featured</Badge>}
                          {item.is_seasonal && <Badge variant="outline" className="text-xs"><Snowflake className="h-3 w-3 mr-1" />Seasonal</Badge>}
                          {!item.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Hidden</Badge>}
                          <Badge variant="outline" className="text-[10px]">{item.target_audience}</Badge>
                        </div>
                        {item.description && <p className="text-sm text-muted-foreground truncate">{item.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3 w-3" />{formatDuration(item.duration_minutes)}</span>
                      <span className="font-bold text-primary">£{item.base_price}</span>
                      <Switch checked={item.is_active} onCheckedChange={v => toggleActive(item.id, v)} />
                      <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServiceManager;
