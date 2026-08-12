import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, CheckCircle, Play, XCircle, MessageSquarePlus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setStatus, updateBooking, updateCustomer, addNote } from "@/lib/bookings";

interface Stylist { user_id: string; full_name: string; }
interface Service { id: string; name: string; duration_minutes: number | null; }

interface Props {
  jobId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
  stylists: Stylist[];
}

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

const TIME_SLOTS = Array.from({ length: 21 }, (_, i) => {
  const h = 9 + Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export default function BookingEditPanel({ jobId, open, onOpenChange, onChanged, stylists }: Props) {
  const [job, setJob] = useState<any>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("");
  const [stylistId, setStylistId] = useState("");
  const [serviceLabel, setServiceLabel] = useState("");
  const [cust, setCust] = useState({ name: "", phone: "", email: "" });
  const [history, setHistory] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    if (!open || !jobId) return;
    (async () => {
      const [{ data: j }, { data: svc }, { data: notes }] = await Promise.all([
        api.from("jobs").select("*, customer:customers(*)").eq("id", jobId).single(),
        api.from("service_catalog").select("id, name, duration_minutes").eq("is_active", true).order("name"),
        api.from("job_notes").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(10),
      ]);
      setJob(j);
      setServices((svc as Service[]) ?? []);
      setHistory(notes ?? []);
      if (j?.scheduled_at) {
        const d = new Date(j.scheduled_at);
        setDate(d);
        setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      }
      setStylistId(j?.assigned_to ?? "");
      setServiceLabel(j?.notes ?? "");
      setCust({ name: j?.customer?.name ?? "", phone: j?.customer?.phone ?? "", email: j?.customer?.email ?? "" });
      setNotes("");
    })();
  }, [jobId, open]);

  const reload = async () => {
    if (!jobId) return;
    const { data } = await api.from("job_notes").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(10);
    setHistory(data ?? []);
    onChanged?.();
  };

  const saveBooking = async () => {
    if (!jobId || !date || !time) return;
    const scheduled = new Date(date);
    const [h, m] = time.split(":").map(Number);
    scheduled.setHours(h, m, 0, 0);
    try {
      await updateBooking(jobId, {
        scheduled_at: scheduled.toISOString(),
        assigned_to: stylistId || null,
        notes: serviceLabel,
      }, "Updated booking details");
      toast.success("Booking updated");
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const saveCustomer = async () => {
    if (!job?.customer?.id) return;
    try {
      await updateCustomer(job.customer.id, cust);
      toast.success("Client updated");
    } catch (e: any) { toast.error(e.message); }
  };

  const quickAction = async (status: any, label: string) => {
    if (!jobId) return;
    try { await setStatus(jobId, status); toast.success(label); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const submitNote = async () => {
    if (!jobId || !newNote.trim()) return;
    await addNote(jobId, newNote.trim());
    setNewNote("");
    reload();
    toast.success("Note added");
  };

  const deleteBooking = async () => {
    if (!jobId || !confirm("Delete this booking?")) return;
    await api.from("jobs").delete().eq("id", jobId);
    toast.success("Booking deleted");
    onOpenChange(false);
    onChanged?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif">Edit appointment</SheetTitle>
          <SheetDescription>Reschedule, edit client details, or change status.</SheetDescription>
        </SheetHeader>

        {!job ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="justify-start" onClick={() => quickAction("in_progress", "Checked in")}>
                <Play className="h-3.5 w-3.5 mr-2" /> Check-in
              </Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => quickAction("completed", "Marked complete")}>
                <CheckCircle className="h-3.5 w-3.5 mr-2" /> Complete
              </Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => quickAction("no_show", "Marked no-show")}>
                <XCircle className="h-3.5 w-3.5 mr-2" /> No-show
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-destructive" onClick={deleteBooking}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </Button>
            </div>

            <Section title="Status">
              <Select value={job.status} onValueChange={v => quickAction(v, `Status → ${v}`)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Section>

            <Section title="Client" action={<Button size="sm" variant="ghost" onClick={saveCustomer}>Save client</Button>}>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={cust.name} onChange={e => setCust({ ...cust, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Phone</Label><Input value={cust.phone} onChange={e => setCust({ ...cust, phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input value={cust.email} onChange={e => setCust({ ...cust, email: e.target.value })} /></div>
                </div>
              </div>
            </Section>

            <Section title="Booking" action={<Button size="sm" variant="ghost" onClick={saveBooking}>Save booking</Button>}>
              <div className="space-y-3">
                <div>
                  <Label>Service</Label>
                  <Input value={serviceLabel} onChange={e => setServiceLabel(e.target.value)} placeholder="Service description" />
                </div>
                <div>
                  <Label>Stylist</Label>
                  <Select value={stylistId || "any"} onValueChange={v => setStylistId(v === "any" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Unassigned</SelectItem>
                      {stylists.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start", !date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "d MMM") : "Pick"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={date} onSelect={setDate} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Select value={time} onValueChange={setTime}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Add note">
              <div className="flex gap-2">
                <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Internal note about this appointment…" rows={2} />
                <Button size="icon" onClick={submitNote}><MessageSquarePlus className="h-4 w-4" /></Button>
              </div>
              {history.length > 0 && (
                <div className="mt-3 space-y-2">
                  {history.map(n => (
                    <div key={n.id} className="text-xs p-2 rounded-md bg-muted/40 border border-border/60">
                      <p className="text-foreground">{n.content}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{format(new Date(n.created_at), "d MMM HH:mm")}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Badge variant="outline" className="text-[10px]">ID {job.id.slice(0, 8)}</Badge>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
