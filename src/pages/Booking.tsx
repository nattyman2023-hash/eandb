import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, apiRequest } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { BUSINESS, IMAGES } from "@/lib/siteContent";
import {
  CheckCircle, ArrowLeft, ArrowRight, Phone, MessageCircle, Clock,
  Scissors, Sun, Sunrise, Sunset, Sparkles, CalendarDays, User,
} from "lucide-react";
import { useSiteImages } from "@/hooks/useSiteImages";
import { format, addDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import SEOHead from "@/components/SEOHead";
import BookingUpsell from "@/components/booking/BookingUpsell";
import ServiceAddonsPicker, { type AddonOption } from "@/components/booking/ServiceAddonsPicker";

interface CatalogItem {
  id: string; name: string; base_price: number; duration_minutes: number;
  category: string; description: string | null; is_active: boolean;
  target_audience: string; icon: string | null;
}

interface BookedRange { start: Date; end: Date; }

/* Salon hours: 09:00 → 19:00 — 30-min chips by default, any minute via custom input */
const DAY_OPEN = 9 * 60;
const DAY_CLOSE = 19 * 60;
const STEP = 30;
const FINE_STEP = 5;

const STEPS = [
  { id: 1, label: "Service", icon: Scissors },
  { id: 2, label: "Date & Time", icon: CalendarDays },
  { id: 3, label: "Your Details", icon: User },
];

const Booking = () => {
  const [searchParams] = useSearchParams();
  const { getImage } = useSiteImages();
  const source = searchParams.get("source") || "Website - Booking Page";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<CatalogItem | null>(null);

  // Step 2
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("");
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const [customTimeError, setCustomTimeError] = useState<string | null>(null);

  // Step 3
  const [customerForm, setCustomerForm] = useState({
    name: searchParams.get("name") || "",
    phone: searchParams.get("phone") || "",
    email: "",
  });
  const [draftId, setDraftId] = useState<string | null>(null);
  const [referencePhotos, setReferencePhotos] = useState<File[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [addonOptions, setAddonOptions] = useState<AddonOption[]>([]);

  // Reset add-ons when service changes
  useEffect(() => { setSelectedAddonIds([]); setAddonOptions([]); }, [selectedService?.id]);

  const selectedAddons = addonOptions.filter(a => selectedAddonIds.includes(a.id));
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + Math.round(a.base_price * (1 - a.discount_pct / 100) * 100) / 100, 0);
  const addonsDuration = selectedAddons.reduce((sum, a) => sum + a.duration_minutes, 0);

  // Persist a booking draft so we can email gentle reminders if the user drops off
  useEffect(() => {
    const email = customerForm.email.trim();
    if (!email || !email.includes("@")) return;
    const t = setTimeout(async () => {
      const payload = {
        email,
        name: customerForm.name || null,
        service_catalog_id: selectedService?.id ?? null,
        scheduled_at: selectedDate && selectedTime
          ? new Date(`${format(selectedDate, "yyyy-MM-dd")}T${selectedTime}:00`).toISOString()
          : null,
        step,
        last_seen_at: new Date().toISOString(),
      };
      if (draftId) {
        await api.from("booking_drafts").update(payload).eq("id", draftId);
      } else {
        const { data } = await api.from("booking_drafts").insert(payload).select("id").single();
        if (data?.id) setDraftId(data.id);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [customerForm.email, customerForm.name, selectedService?.id, selectedDate, selectedTime, step, draftId]);

  useEffect(() => {
    api.from("service_catalog")
      .select("*").eq("is_active", true).order("category, name")
      .then(({ data }) => {
        const list = (data as CatalogItem[]) ?? [];
        setServices(list);
        const preId = searchParams.get("service");
        if (preId) {
          const match = list.find(s => s.id === preId);
          if (match) { setSelectedService(match); setStep(2); }
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();
    api.from("jobs")
      .select("scheduled_at, service_catalog(duration_minutes)")
      .gte("scheduled_at", dayStart).lt("scheduled_at", dayEnd)
      .neq("status", "cancelled")
      .then(({ data }) => {
        const ranges: BookedRange[] = (data ?? []).map((j: any) => {
          const start = new Date(j.scheduled_at);
          const dur = j.service_catalog?.duration_minutes ?? 60;
          return { start, end: new Date(start.getTime() + dur * 60_000) };
        });
        setBookedRanges(ranges);
        setSlotsLoading(false);
      });
  }, [selectedDate]);

  const categories = useMemo(
    () => [...new Set(services.map(s => s.category))].sort(),
    [services]
  );
  const filtered = activeCategory ? services.filter(s => s.category === activeCategory) : services;

  /* ---------- helpers ---------- */
  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60); const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
  };

  const disabledDays = [{ before: addDays(new Date(), 1) }, { dayOfWeek: [0] }];

  /* Build candidate slot starts for the day so a job won't run past closing.
     Services longer than 2 hours (120 min) must finish at least 2 hours before closing. */
  const candidateSlots = useMemo(() => {
    if (!selectedService) return [] as string[];
    const dur = selectedService.duration_minutes;
    const out: string[] = [];
    const step = showAllSlots ? FINE_STEP : STEP;
    // If service takes >2h, block the last 2 hours of the day
    const effectiveClose = dur > 120 ? DAY_CLOSE - 120 : DAY_CLOSE;
    for (let m = DAY_OPEN; m + dur <= effectiveClose; m += step) {
      const h = Math.floor(m / 60).toString().padStart(2, "0");
      const mm = (m % 60).toString().padStart(2, "0");
      out.push(`${h}:${mm}`);
    }
    return out;
  }, [selectedService, showAllSlots]);

  const slotOverlaps = (slot: string): boolean => {
    if (!selectedDate || !selectedService) return false;
    const [h, m] = slot.split(":").map(Number);
    const start = new Date(selectedDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + selectedService.duration_minutes * 60_000);
    return bookedRanges.some(r => start < r.end && end > r.start);
  };

  const grouped = useMemo(() => {
    const morning: string[] = [], afternoon: string[] = [], evening: string[] = [];
    candidateSlots.forEach(s => {
      const h = parseInt(s.slice(0, 2), 10);
      if (h < 12) morning.push(s);
      else if (h < 17) afternoon.push(s);
      else evening.push(s);
    });
    return { morning, afternoon, evening };
  }, [candidateSlots]);

  const firstAvailable = candidateSlots.find(s => !slotOverlaps(s));

  /* ---------- submit ---------- */
  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !customerForm.name || !customerForm.phone) return;
    setLoading(true);
    try {
      const scheduledAt = new Date(`${format(selectedDate, "yyyy-MM-dd")}T${selectedTime}:00`).toISOString();
      const grandTotal = selectedService.base_price + addonsTotal;
      const addonNames = selectedAddons.map(a => a.name).join(", ");
      const payload = {
        customer: {
          name: customerForm.name, phone: customerForm.phone, email: customerForm.email,
          address: BUSINESS.address, postcode: "",
        },
        hair_profile: { preference: "", texture: "", goal: "" },
        deposit: { required: false, amount: 0 },
        job: {
          type: "garage", service_type: "service", scheduled_at: scheduledAt,
          service_catalog_id: selectedService.id,
          notes: `Online booking — ${selectedService.name} (~${formatDuration(selectedService.duration_minutes + addonsDuration)}) — £${grandTotal}${addonNames ? ` (incl. add-ons: ${addonNames})` : ""}`,
          urgency: "flexible", source,
        },
        addons: selectedAddons.map(a => ({
          addon_service_id: a.id,
          price_snapshot: Math.round(a.base_price * (1 - a.discount_pct / 100) * 100) / 100,
          duration_minutes_snapshot: a.duration_minutes,
        })),
        fulfillment: { method: "garage" },
      };
      const { data } = await apiRequest<{ data: { customer_id: string; hair_profile_id?: string; job_id: string } }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const jobId = data?.job_id;

      // Upload reference photos (if any) to job-photos bucket and link to the job
      if (jobId && referencePhotos.length > 0) {
        for (const file of referencePhotos) {
          try {
            const path = `bookings/${jobId}/reference/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
            const { error: upErr } = await api.storage.from("job-photos").upload(path, file, { upsert: false });
            if (upErr) { console.error("ref upload", upErr); continue; }
            await api.from("job_photos").insert({
              job_id: jobId,
              storage_path: path,
              photo_type: "reference",
              visible_to_customer: true,
              caption: "Booking reference",
            } as any);
          } catch (e) { console.error("ref photo error", e); }
        }
      }


      setDone(true);
      if (draftId) await api.from("booking_drafts").update({ completed: true }).eq("id", draftId);
      toast.success("Booking confirmed!");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- confirmation ---------- */
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl text-center space-y-6 bg-card rounded-2xl border border-border shadow-[var(--shadow-soft)] p-8 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15">
            <CheckCircle className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-2xl font-bold">You're booked in!</h2>
          <p className="text-muted-foreground">We'll send a confirmation shortly. See you soon.</p>
          <div className="rounded-xl bg-muted/60 p-4 text-left text-sm space-y-1.5 border border-border">
            <p><span className="text-muted-foreground">Service:</span> <strong>{selectedService?.name}</strong></p>
            <p><span className="text-muted-foreground">When:</span> <strong>{selectedDate ? format(selectedDate, "EEE dd MMM yyyy") : ""} · {selectedTime}</strong></p>
            <p><span className="text-muted-foreground">Name:</span> <strong>{customerForm.name}</strong></p>
          </div>
          <div className="flex gap-2 justify-center">
            <a href={BUSINESS.phoneHref}>
              <Button variant="outline" size="sm" className="gap-1.5"><Phone className="h-3.5 w-3.5" /> Call</Button>
            </a>
            <a href={BUSINESS.whatsapp} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button>
            </a>
          </div>
          {selectedService && (
            <BookingUpsell serviceId={selectedService.id} serviceName={selectedService.name} />
          )}
        </div>
      </div>
    );
  }

  /* ---------- ui pieces ---------- */
  const ProgressBar = () => (
    <ol className="border-t border-foreground/80 mb-12">
      {STEPS.map((s) => {
        const active = step === s.id;
        const completed = step > s.id;
        return (
          <li key={s.id} className="border-b border-border">
            <button
              type="button"
              onClick={() => { if (completed) setStep(s.id); }}
              disabled={!completed}
              className={cn(
                "w-full grid grid-cols-12 items-center gap-4 py-4 text-left transition-colors",
                completed && "hover:bg-muted/40 cursor-pointer",
              )}
            >
              <span className={cn(
                "col-span-2 sm:col-span-1 eyebrow",
                active ? "text-primary" : completed ? "text-foreground" : "text-foreground/40"
              )}>№ 0{s.id}</span>
              <span className={cn(
                "col-span-8 sm:col-span-9 font-display text-xl md:text-2xl",
                active ? "text-foreground" : completed ? "text-foreground" : "text-foreground/40"
              )} style={{ fontVariationSettings: '"opsz" 72' }}>{s.label}</span>
              <span className={cn(
                "col-span-2 text-right eyebrow",
                active && "text-primary",
                completed && "text-accent"
              )}>{completed ? "Done" : active ? "Now" : ""}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  const SummaryCard = () => (
    <aside className="lg:sticky lg:top-28 lg:self-start space-y-4 border-t-2 border-foreground/80 pt-6">
      <p className="eyebrow">Your booking</p>
      {selectedService ? (
        <>
          <h3 className="font-display text-2xl leading-tight" style={{ fontVariationSettings: '"opsz" 96' }}>{selectedService.name}</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">{selectedService.category}</p>
          <dl className="text-sm space-y-2 pt-4 border-t border-border">
            <div className="flex justify-between"><dt className="text-muted-foreground">Approx. duration</dt><dd>~{formatDuration(selectedService.duration_minutes + addonsDuration)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Date</dt><dd>{selectedDate ? format(selectedDate, "EEE dd MMM") : <span className="text-muted-foreground/50">—</span>}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Time</dt><dd>{selectedTime || <span className="text-muted-foreground/50">—</span>}</dd></div>
          </dl>
          {selectedAddons.length > 0 && (
            <div className="text-xs space-y-1 pt-3 border-t border-border">
              <p className="eyebrow text-[10px]">Add-ons</p>
              {selectedAddons.map(a => {
                const p = Math.round(a.base_price * (1 - a.discount_pct / 100) * 100) / 100;
                return (
                  <div key={a.id} className="flex justify-between text-muted-foreground">
                    <span className="truncate pr-2">+ {a.name}</span>
                    <span>£{p}</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground italic pt-2">Times shown are approximate — your appointment may run a little shorter or longer depending on your hair and service.</p>
          <div className="flex justify-between items-baseline pt-4 border-t border-border">
            <span className="eyebrow">Total</span>
            <span className="font-display text-3xl">£{selectedService.base_price + addonsTotal}</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Select a service to begin.</p>
      )}
    </aside>
  );

  const SlotButton = ({ slot }: { slot: string }) => {
    const taken = slotOverlaps(slot);
    const active = selectedTime === slot;
    return (
      <button
        key={slot}
        type="button"
        disabled={taken}
        onClick={() => setSelectedTime(slot)}
        title={taken ? "Already booked" : undefined}
        className={cn(
          "border px-3 py-3 text-sm font-display transition-all rounded-none",
          taken && "bg-muted/40 border-border/60 text-muted-foreground/40 line-through cursor-not-allowed",
          !taken && !active && "bg-card border-border hover:border-foreground hover:bg-muted/40",
          active && "bg-foreground text-background border-foreground"
        )}
      >{slot}</button>
    );
  };

  const SlotGroup = ({ title, icon: Icon, slots }: { title: string; icon: any; slots: string[] }) => {
    if (slots.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 eyebrow">
          <Icon className="h-3 w-3 text-primary" /> {title}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {slots.map(s => <SlotButton key={s} slot={s} />)}
        </div>
      </div>
    );
  };

  return (
    <>
      <SEOHead
        title="Reservations | Wub Hair"
        description="Reserve a chair at Wub Hair in Manchester. Hairdressing and protective styling."
        canonical="/book"
        image={IMAGES.heroBooking}
      />

      {/* Quiet typographic header */}
      <section className="border-t border-border">
        <div className="container py-12 md:py-20">
          <p className="eyebrow mb-6">Reservations</p>
          <h1 className="display-lg max-w-3xl">Book a chair.</h1>
          <p className="text-muted-foreground mt-4 max-w-md">Three brief steps. Confirmation arrives within the minute.</p>
        </div>
      </section>

      <div className="bg-background pb-20">
        <div className="mx-auto max-w-6xl px-4 pt-8">
          <ProgressBar />

          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              {/* Step 1 */}
              {step === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-2xl font-bold font-serif">Choose your service</h2>
                    <p className="text-sm text-muted-foreground">Pick what you'd like done today.</p>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                      onClick={() => setActiveCategory(null)}
                      className={cn(
                        "shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors",
                        !activeCategory ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >All</button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={cn(
                          "shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors",
                          activeCategory === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40"
                        )}
                      >{cat}</button>
                    ))}
                  </div>

                  <ol className="border-t border-foreground/80">
                    {filtered.map((service, i) => (
                      <li key={service.id} className="border-b border-border">
                        <button
                          onClick={() => { setSelectedService(service); setSelectedTime(""); setStep(2); }}
                          className={cn(
                            "w-full grid grid-cols-12 items-center gap-3 py-5 text-left transition-colors hover:bg-muted/40 px-2 -mx-2",
                            selectedService?.id === service.id && "bg-muted/40"
                          )}
                        >
                          <span className="col-span-1 eyebrow text-foreground/60">№ {String(i + 1).padStart(2, "0")}</span>
                          <span className="col-span-7 md:col-span-6">
                            <span className="font-display text-xl md:text-2xl block leading-tight" style={{ fontVariationSettings: '"opsz" 72' }}>{service.name}</span>
                            {service.description && (
                              <span className="text-xs text-muted-foreground line-clamp-1 mt-1 block">{service.description}</span>
                            )}
                          </span>
                          <span className="hidden md:block col-span-2 text-xs text-muted-foreground uppercase tracking-widest">{formatDuration(service.duration_minutes)}</span>
                          <span className="col-span-4 md:col-span-3 text-right font-display text-xl">£{service.base_price}</span>
                        </button>
                      </li>
                    ))}
                  </ol>

                  {filtered.length === 0 && (
                    <div className="text-center py-12 border-y border-border">
                      <p className="text-muted-foreground">No services in this category yet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && selectedService && (
                <div className="space-y-6 animate-fade-in">
                  <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> Change service
                  </button>

                  <div>
                    <h2 className="text-2xl font-bold font-serif">Pick a date & time</h2>
                    <p className="text-sm text-muted-foreground">Greyed slots are already taken. Times shown are approximate — your appointment may run a little shorter or longer.</p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-[auto_1fr]">
                    <div className="rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-soft)]">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => { setSelectedDate(d); setSelectedTime(""); }}
                        disabled={disabledDays}
                        className={cn("p-2 pointer-events-auto")}
                      />
                    </div>

                    <div className="space-y-5">
                      {!selectedDate && (
                        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                          Choose a date on the left to see available times.
                        </div>
                      )}

                      {selectedDate && (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              {format(selectedDate, "EEEE, dd MMM")}
                              {isSameDay(selectedDate, new Date()) && <span className="ml-2 text-xs text-primary">Today</span>}
                            </p>
                            {firstAvailable && (
                              <button
                                type="button"
                                onClick={() => setSelectedTime(firstAvailable)}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                Use next available · {firstAvailable}
                              </button>
                            )}
                          </div>

                          {slotsLoading ? (
                            <div className="text-sm text-muted-foreground py-8 text-center">Loading availability…</div>
                          ) : candidateSlots.every(slotOverlaps) ? (
                            <div className="rounded-xl border border-dashed border-border p-6 text-center">
                              <p className="text-sm font-medium">Fully booked on this day</p>
                              <p className="text-xs text-muted-foreground mt-1">Please choose another date.</p>
                            </div>
                          ) : (
                            <div className="space-y-5">
                              <SlotGroup title="Morning" icon={Sunrise} slots={grouped.morning} />
                              <SlotGroup title="Afternoon" icon={Sun} slots={grouped.afternoon} />
                              <SlotGroup title="Evening" icon={Sunset} slots={grouped.evening} />

                              {/* Custom time + show all */}
                              <div className="border-t border-border pt-5 space-y-3">
                                <div className="flex flex-wrap items-end gap-3">
                                  <div className="flex-1 min-w-[180px]">
                                    <label className="eyebrow block mb-1.5">Prefer a specific time?</label>
                                    <div className="flex gap-2">
                                      <input
                                        type="time"
                                        step={60}
                                        min="09:00"
                                        max={selectedService.duration_minutes > 120 ? "17:00" : "19:00"}
                                        value={customTime}
                                        onChange={(e) => { setCustomTime(e.target.value); setCustomTimeError(null); }}
                                        className="flex-1 border border-border bg-card px-3 py-2 text-sm rounded-none focus:outline-none focus:border-foreground"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!customTime || !selectedService) return;
                                          const [h, m] = customTime.split(":").map(Number);
                                          const mins = h * 60 + m;
                                          // Services longer than 2h must finish at least 2h before closing
                                          const effectiveClose = selectedService.duration_minutes > 120 ? DAY_CLOSE - 120 : DAY_CLOSE;
                                          if (mins < DAY_OPEN || mins + selectedService.duration_minutes > effectiveClose) {
                                            setCustomTimeError("Outside salon hours");
                                            return;
                                          }
                                          if (slotOverlaps(customTime)) {
                                            setCustomTimeError("That time is already taken");
                                            return;
                                          }
                                          setSelectedTime(customTime);
                                          setCustomTimeError(null);
                                        }}
                                        className="border border-foreground bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition"
                                      >Use this time</button>
                                    </div>
                                    {customTimeError && (
                                      <p className="text-xs text-destructive mt-1.5">{customTimeError}</p>
                                    )}
                                    {!customTimeError && customTime && selectedTime === customTime && (
                                      <p className="text-xs text-accent mt-1.5">✓ {customTime} selected</p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setShowAllSlots(s => !s)}
                                    className="text-xs font-medium text-primary hover:underline whitespace-nowrap pb-2"
                                  >
                                    {showAllSlots ? "Show 30-min slots only" : "Show every 5-min slot"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="w-full md:w-auto md:px-10"
                    onClick={() => setStep(3)}
                    disabled={!selectedDate || !selectedTime}
                  >
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Step 3 */}
              {step === 3 && selectedService && (
                <div className="space-y-6 animate-fade-in">
                  <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> Change date & time
                  </button>

                  <div>
                    <h2 className="text-2xl font-bold font-serif">Your details</h2>
                    <p className="text-sm text-muted-foreground">Almost there — just your contact info.</p>
                  </div>

                  {selectedService && (
                    <ServiceAddonsPicker
                      serviceId={selectedService.id}
                      selectedIds={selectedAddonIds}
                      onChange={setSelectedAddonIds}
                      onLoaded={setAddonOptions}
                    />
                  )}

                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Full name *</Label><Input value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Phone number *</Label><Input value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} type="tel" /></div>
                    <div className="space-y-2"><Label>Email (optional)</Label><Input value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} type="email" /></div>

                    {/* Reference photos — optional */}
                    <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/30 p-4">
                      <Label className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Inspiration photos (optional)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Upload up to 4 photos showing the look you want — your stylist will see them before your visit.
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []).slice(0, 4);
                          setReferencePhotos(files);
                        }}
                        className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
                      />
                      {referencePhotos.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 pt-2">
                          {referencePhotos.map((f, i) => (
                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setReferencePhotos(prev => prev.filter((_, idx) => idx !== i))}
                                className="absolute top-1 right-1 rounded-full bg-background/90 text-foreground text-[10px] px-1.5 py-0.5 border border-border"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={loading || !customerForm.name || !customerForm.phone}
                  >
                    {loading ? "Confirming…" : "Confirm booking"}
                  </Button>
                </div>
              )}
            </div>

            <SummaryCard />
          </div>
        </div>
      </div>
    </>
  );
};

export default Booking;
