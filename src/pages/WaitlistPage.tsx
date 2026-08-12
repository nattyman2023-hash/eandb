import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClipboardCheck, Plus, Clock, Armchair, Phone, Pencil, ArrowUp, ArrowDown, CalendarPlus, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import NewAppointmentDialog from "@/components/booking/NewAppointmentDialog";
import { reorderWaitlist, updateWaitlist } from "@/lib/waitlist";

interface WaitlistItem {
  id: string; client_name: string; phone: string | null; status: string;
  estimated_wait_minutes: number; assigned_chair_id: string | null; notes: string | null;
  customer_id: string | null; service_catalog_id: string | null; position: number;
  created_at: string;
}

interface Chair { id: string; name: string; zone: string; is_active: boolean; }
interface Service { id: string; name: string; duration_minutes: number | null; }

const blankForm = { name: "", phone: "", notes: "", service_catalog_id: "", estimated_wait_minutes: 15 };

const WaitlistPage = () => {
  const [items, setItems] = useState<WaitlistItem[]>([]);
  const [chairs, setChairs] = useState<Chair[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [kioskMode, setKioskMode] = useState(false);
  const [form, setForm] = useState({ ...blankForm });
  const [editing, setEditing] = useState<WaitlistItem | null>(null);
  const [editForm, setEditForm] = useState({ ...blankForm });
  // Convert-to-booking
  const [convertItem, setConvertItem] = useState<WaitlistItem | null>(null);

  const fetchAll = async () => {
    const [wRes, cRes, sRes] = await Promise.all([
      api.from("waitlist").select("*").in("status", ["waiting", "assigned"]).order("position").order("created_at"),
      api.from("chairs").select("*").eq("is_active", true).order("created_at"),
      api.from("service_catalog").select("id, name, duration_minutes").eq("is_active", true).order("name"),
    ]);
    setItems((wRes.data as WaitlistItem[]) ?? []);
    setChairs((cRes.data as Chair[]) ?? []);
    setServices((sRes.data as Service[]) ?? []);
  };
  useEffect(() => { fetchAll(); }, []);

  // Realtime
  useEffect(() => {
    const ch = api.channel("waitlist-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, () => fetchAll())
      .subscribe();
    return () => { api.removeChannel(ch); };
  }, []);

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    let customerId: string | null = null;
    if (form.phone) {
      const { data: existing } = await api.from("customers").select("id").eq("phone", form.phone).limit(1).maybeSingle();
      if (existing) customerId = existing.id;
      else {
        const { data: c } = await api.from("customers").insert({ name: form.name, phone: form.phone }).select("id").single();
        customerId = c?.id ?? null;
      }
    }
    const nextPos = items.length;
    await api.from("waitlist").insert({
      client_name: form.name, phone: form.phone || null, notes: form.notes || null,
      customer_id: customerId, service_catalog_id: form.service_catalog_id || null,
      estimated_wait_minutes: Number(form.estimated_wait_minutes) || 15,
      position: nextPos,
    });
    setForm({ ...blankForm }); setAddOpen(false);
    toast.success("Added to waitlist");
    fetchAll();
  };

  const openEdit = (item: WaitlistItem) => {
    setEditing(item);
    setEditForm({
      name: item.client_name, phone: item.phone ?? "", notes: item.notes ?? "",
      service_catalog_id: item.service_catalog_id ?? "",
      estimated_wait_minutes: item.estimated_wait_minutes ?? 15,
    });
  };
  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateWaitlist(editing.id, {
        client_name: editForm.name,
        phone: editForm.phone || null,
        notes: editForm.notes || null,
        service_catalog_id: editForm.service_catalog_id || null,
        estimated_wait_minutes: Number(editForm.estimated_wait_minutes) || 15,
      });
      toast.success("Walk-in updated");
      setEditing(null); fetchAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const reordered = [...items];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setItems(reordered);
    await reorderWaitlist(reordered.map(x => x.id));
  };

  const assignChair = async (waitlistId: string, chairId: string) => {
    await api.from("waitlist").update({ assigned_chair_id: chairId, status: "assigned" }).eq("id", waitlistId);
    toast.success("Assigned to chair"); fetchAll();
  };

  const markDone = async (id: string) => {
    await api.from("waitlist").update({ status: "completed" }).eq("id", id);
    toast.success("Removed from queue"); fetchAll();
  };

  const startConvert = (item: WaitlistItem) => setConvertItem(item);
  const onConverted = async () => {
    if (convertItem) await api.from("waitlist").update({ status: "completed" }).eq("id", convertItem.id);
    setConvertItem(null);
    fetchAll();
  };

  if (kioskMode) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold font-serif text-primary mb-2">Welcome</h1>
            <p className="text-lg text-muted-foreground">Join the queue</p>
          </div>
          <div className="atelier-card p-6 space-y-4">
            <div><Label className="text-base">Your Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-12 text-lg" placeholder="Enter your name" /></div>
            <div><Label className="text-base">Phone Number</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-12 text-lg" placeholder="Your phone number" /></div>
            <Button onClick={handleAdd} className="w-full h-12 text-lg">Join Queue</Button>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">{items.length} {items.length === 1 ? "person" : "people"} ahead</p>
            <Button variant="ghost" size="sm" onClick={() => setKioskMode(false)}>Exit Kiosk</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Waitlist</h1>
          <p className="text-muted-foreground mt-1">{items.length} in queue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setKioskMode(true)}>Open Kiosk</Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Walk-In</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add to Waitlist</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Est. wait (min)</Label><Input type="number" value={form.estimated_wait_minutes} onChange={e => setForm({ ...form, estimated_wait_minutes: Number(e.target.value) })} /></div>
                </div>
                <div>
                  <Label>Service requested</Label>
                  <Select value={form.service_catalog_id || "none"} onValueChange={v => setForm({ ...form, service_catalog_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Pick a service" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific service</SelectItem>
                      {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.duration_minutes ? ` · ${s.duration_minutes}m` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={handleAdd} className="w-full">Add to Queue</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="atelier-card p-16 text-center">
          <ClipboardCheck className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Queue is empty</h2>
          <p className="text-muted-foreground">No walk-ins waiting right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const svc = services.find(s => s.id === item.service_catalog_id);
            return (
              <div key={item.id} className="atelier-card p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex flex-col">
                    <span className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{i + 1}</span>
                    <div className="flex flex-col mt-1">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{item.client_name}</p>
                      {!item.customer_id && <Badge variant="outline" className="text-[10px]">New</Badge>}
                      {svc && <Badge className="text-[10px] bg-accent/30 text-foreground">{svc.name}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {item.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.phone}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~{item.estimated_wait_minutes}m</span>
                      <span>Joined {format(new Date(item.created_at), "HH:mm")}</span>
                    </div>
                    {item.notes && <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {item.status === "waiting" ? (
                    <Select onValueChange={v => assignChair(item.id, v)}>
                      <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Assign chair" /></SelectTrigger>
                      <SelectContent>
                        {chairs.map(c => <SelectItem key={c.id} value={c.id}><Armchair className="inline h-3 w-3 mr-1" />{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className="bg-primary/20 text-primary">Assigned</Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => startConvert(item)}>
                    <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Book
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => markDone(item.id)}>Done</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit walk-in */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit walk-in</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
              <div><Label>Est. wait (min)</Label><Input type="number" value={editForm.estimated_wait_minutes} onChange={e => setEditForm({ ...editForm, estimated_wait_minutes: Number(e.target.value) })} /></div>
            </div>
            <div>
              <Label>Service requested</Label>
              <Select value={editForm.service_catalog_id || "none"} onValueChange={v => setEditForm({ ...editForm, service_catalog_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific service</SelectItem>
                  {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}><X className="h-4 w-4 mr-1" />Cancel</Button>
              <Button className="flex-1" onClick={saveEdit}>Save changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to booking */}
      <NewAppointmentDialog
        open={!!convertItem}
        onOpenChange={(v) => !v && setConvertItem(null)}
        onCreated={onConverted}
        defaultDate={new Date()}
        prefillCustomer={convertItem?.customer_id ? { id: convertItem.customer_id, name: convertItem.client_name, phone: convertItem.phone ?? undefined } : null}
        prefillServiceId={convertItem?.service_catalog_id ?? null}
      />
    </div>
  );
};

export default WaitlistPage;
