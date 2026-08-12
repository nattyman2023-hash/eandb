import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ChevronLeft, ChevronRight, UserPlus, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { findOrCreateCustomer, searchCustomers } from "@/lib/bookings";

type Step = 1 | 2 | 3;

interface Service { id: string; name: string; base_price: number; duration_minutes: number | null; category: string | null; }
interface Stylist { user_id: string; full_name: string; }
interface Customer { id: string; name: string; phone?: string; email?: string; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  defaultDate?: Date;
  defaultTime?: string;
  defaultStylistId?: string | null;
  /** prefill customer (e.g. converting from waitlist) */
  prefillCustomer?: Customer | null;
  prefillServiceId?: string | null;
}

const HOURS = Array.from({ length: 21 }, (_, i) => {
  const h = 9 + Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export default function NewAppointmentDialog({
  open, onOpenChange, onCreated,
  defaultDate, defaultTime, defaultStylistId,
  prefillCustomer, prefillServiceId,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [services, setServices] = useState<Service[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);

  // Step 1 state
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newClient, setNewClient] = useState({ name: "", phone: "", email: "", postcode: "" });
  const [creatingNew, setCreatingNew] = useState(false);

  // Step 2 state
  const [serviceId, setServiceId] = useState<string>("");
  const [stylistId, setStylistId] = useState<string>("");

  // Step 3 state
  const [date, setDate] = useState<Date | undefined>(defaultDate);
  const [time, setTime] = useState<string>(defaultTime ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Load lookups + reset on open
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSearch(""); setSearchResults([]);
    setCustomer(prefillCustomer ?? null);
    setNewClient({ name: "", phone: "", email: "", postcode: "" });
    setCreatingNew(false);
    setServiceId(prefillServiceId ?? "");
    setStylistId(defaultStylistId ?? "");
    setDate(defaultDate);
    setTime(defaultTime ?? "");

    (async () => {
      const [s, p] = await Promise.all([
        api.from("service_catalog").select("id, name, base_price, duration_minutes, category").eq("is_active", true).order("name"),
        api.from("profiles").select("user_id, full_name").eq("is_active", true).eq("bookable", true).order("full_name"),
      ]);
      setServices((s.data as Service[]) ?? []);
      setStylists((p.data as Stylist[]) ?? []);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Live customer search
  useEffect(() => {
    if (creatingNew || customer) return;
    const t = setTimeout(async () => {
      setSearchResults((await searchCustomers(search)) as Customer[]);
    }, 200);
    return () => clearTimeout(t);
  }, [search, creatingNew, customer]);

  const selectedService = services.find(s => s.id === serviceId);

  const canNextFromStep1 = !!customer || (creatingNew && newClient.name.trim().length > 1);
  const canNextFromStep2 = !!serviceId;
  const canSubmit = !!date && !!time;

  const handleNext = async () => {
    if (step === 1 && creatingNew && !customer) {
      try {
        const created = await findOrCreateCustomer(newClient);
        setCustomer(created as Customer);
      } catch {
        toast.error("Could not save client"); return;
      }
    }
    setStep(s => Math.min(3, s + 1) as Step);
  };

  const handleSubmit = async () => {
    if (!customer || !date || !time || !serviceId) return;
    setSubmitting(true);
    try {
      const scheduled = new Date(date);
      const [h, m] = time.split(":").map(Number);
      scheduled.setHours(h, m, 0, 0);

      const svc = services.find(s => s.id === serviceId);
      await api.from("jobs").insert({
        customer_id: customer.id,
        scheduled_at: scheduled.toISOString(),
        type: "garage",
        service_type: "service",
        status: "confirmed",
        notes: svc?.name ?? "",
        assigned_to: stylistId || null,
        source: "admin",
      });
      toast.success("Appointment booked");
      onCreated?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to book");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">New Appointment</DialogTitle>
          <Stepper current={step} />
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 pt-2">
            {customer ? (
              <div className="atelier-card p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">{customer.phone || customer.email || "No contact"}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setCustomer(null); setCreatingNew(false); }}>Change</Button>
              </div>
            ) : creatingNew ? (
              <>
                <div><Label>Name *</Label><Input value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} /></div>
                </div>
                <div><Label>Postcode</Label><Input value={newClient.postcode} onChange={e => setNewClient({ ...newClient, postcode: e.target.value })} /></div>
                <Button variant="ghost" size="sm" onClick={() => setCreatingNew(false)}>← Back to search</Button>
              </>
            ) : (
              <>
                <Label>Search existing client</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Name, phone or email" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                </div>
                <div className="max-h-48 overflow-auto space-y-1">
                  {searchResults.map(c => (
                    <button key={c.id} onClick={() => setCustomer(c)} className="w-full text-left p-3 rounded-md border border-border hover:bg-accent/40 transition">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone || c.email || "—"}</p>
                    </button>
                  ))}
                  {search.length > 1 && searchResults.length === 0 && (
                    <p className="text-xs text-muted-foreground p-3">No matches found.</p>
                  )}
                </div>
                <Button variant="outline" className="w-full gap-2" onClick={() => setCreatingNew(true)}>
                  <UserPlus className="h-4 w-4" /> Create new client
                </Button>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 pt-2">
            <div>
              <Label>Service *</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.duration_minutes ? `· ${s.duration_minutes}m` : ""} · £{Number(s.base_price).toFixed(0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedService && (
                <div className="mt-2 flex gap-2">
                  {selectedService.category && <Badge variant="outline" className="text-[10px]">{selectedService.category}</Badge>}
                  {selectedService.duration_minutes && <Badge variant="outline" className="text-[10px]">{selectedService.duration_minutes} min</Badge>}
                </div>
              )}
            </div>
            <div>
              <Label>Stylist (optional)</Label>
              <Select value={stylistId || "any"} onValueChange={v => setStylistId(v === "any" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any available</SelectItem>
                  {stylists.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 pt-2">
            <div>
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={setDate} className="p-3 pointer-events-auto" disabled={d => d < new Date(new Date().setHours(0,0,0,0))} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Time *</Label>
              <div className="space-y-2">
                <input
                  type="time"
                  step={60}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full border border-border bg-background px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">Type any minute, or pick a quick slot below.</p>
                <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-auto">
                  {HOURS.map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setTime(h)}
                      className={cn(
                        "px-1.5 py-1.5 text-[11px] rounded-md border transition",
                        time === h
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-accent/40"
                      )}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {customer && selectedService && date && time && (
              <div className="atelier-card p-3 text-sm space-y-0.5">
                <p className="font-semibold">{customer.name}</p>
                <p className="text-muted-foreground text-xs">{selectedService.name} · {format(date, "EEE d MMM")} at {time}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" onClick={() => setStep(s => Math.max(1, s - 1) as Step)} disabled={step === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < 3 ? (
            <Button onClick={handleNext} disabled={(step === 1 && !canNextFromStep1) || (step === 2 && !canNextFromStep2)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
              <Check className="h-4 w-4 mr-1" /> {submitting ? "Booking…" : "Confirm booking"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps = ["Client", "Service", "Date & time"];
  return (
    <div className="flex items-center gap-2 pt-2">
      {steps.map((label, i) => {
        const idx = (i + 1) as Step;
        const active = idx === current;
        const done = idx < current;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <span className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition",
              done ? "bg-primary text-primary-foreground" : active ? "bg-primary/15 text-primary border border-primary/40" : "bg-muted text-muted-foreground"
            )}>
              {done ? <Check className="h-3 w-3" /> : idx}
            </span>
            <span className={cn("text-[11px] uppercase tracking-wider", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
