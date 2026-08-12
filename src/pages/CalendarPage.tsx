import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight, Plus, Users, Clock, Filter } from "lucide-react";
import { format, addDays, isSameDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Job } from "@/types/database";
import NewAppointmentDialog from "@/components/booking/NewAppointmentDialog";
import BookingEditPanel from "@/components/booking/BookingEditPanel";
import { reschedule } from "@/lib/bookings";

// ── Timeline configuration ────────────────────────────────
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 19;
const SLOT_MIN = 30; // each row = 30 min
const SLOT_PX = 36;  // height per 30-min slot
const TOTAL_SLOTS = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MIN;

const TIME_SLOTS: string[] = [];
for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

interface Stylist { user_id: string; full_name: string }
interface JobWithJoin extends Job { customer?: any; service_catalog?: { duration_minutes: number | null; name: string } | null }

const STATUS_STYLE: Record<string, { bar: string; bg: string; text: string }> = {
  pending:     { bar: "bg-muted-foreground", bg: "bg-muted/60",              text: "text-foreground" },
  confirmed:   { bar: "bg-primary",          bg: "bg-primary/15",            text: "text-foreground" },
  in_progress: { bar: "bg-warning",          bg: "bg-warning/20",            text: "text-foreground" },
  completed:   { bar: "bg-success",          bg: "bg-success/15",            text: "text-foreground" },
  paid:        { bar: "bg-success",          bg: "bg-success/15",            text: "text-foreground" },
};

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));
  const [jobs, setJobs] = useState<JobWithJoin[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookDefaults, setBookDefaults] = useState<{ date?: Date; time?: string; stylistId?: string | null }>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Filters
  const [filterStylist, setFilterStylist] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const load = useCallback(async () => {
    const start = new Date(currentDate); start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate); end.setHours(23, 59, 59, 999);

    const [jobsRes, staffRes] = await Promise.all([
      api.from("jobs")
        .select("*, customer:customers(name)")
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString())
        .order("scheduled_at"),
      api.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name"),
    ]);
    setJobs((jobsRes.data as unknown as JobWithJoin[]) ?? []);
    setStylists((staffRes.data as Stylist[]) ?? []);
  }, [currentDate]);

  useEffect(() => { load(); }, [load]);

  // Realtime — listen for job changes
  useEffect(() => {
    const ch = api
      .channel("calendar-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => load())
      .subscribe();
    return () => { api.removeChannel(ch); };
  }, [load]);

  // Build columns (stylists with bookings today + every active stylist + Unassigned)
  const columns = useMemo(() => {
    const usedIds = new Set(jobs.map(j => j.assigned_to).filter(Boolean) as string[]);
    const cols: { id: string | null; name: string }[] = stylists
      .filter(s => usedIds.has(s.user_id) || stylists.length <= 6)
      .map(s => ({ id: s.user_id, name: s.full_name || "Stylist" }));
    if (jobs.some(j => !j.assigned_to) || cols.length === 0) {
      cols.push({ id: null, name: "Unassigned" });
    }
    return cols;
  }, [stylists, jobs]);

  // Filtered jobs (status + stylist)
  const visibleJobs = useMemo(() => jobs.filter(j => {
    if (filterStatus !== "all" && j.status !== filterStatus) return false;
    if (filterStylist !== "all") {
      if (filterStylist === "unassigned" && j.assigned_to) return false;
      if (filterStylist !== "unassigned" && j.assigned_to !== filterStylist) return false;
    }
    return true;
  }), [jobs, filterStatus, filterStylist]);

  const jobPosition = (job: JobWithJoin) => {
    if (!job.scheduled_at) return null;
    const d = new Date(job.scheduled_at);
    const minsFromStart = (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
    const slots = minsFromStart / SLOT_MIN;
    if (slots < 0 || slots >= TOTAL_SLOTS) return null;
    // duration from service_catalog if available, fallback 45 min
    const dur = (job as any).service_catalog?.duration_minutes ?? 45;
    const height = Math.max(SLOT_PX - 4, (dur / SLOT_MIN) * SLOT_PX - 4);
    return { top: slots * SLOT_PX + 2, height };
  };

  const onCellClick = (colId: string | null, slotIdx: number) => {
    const h = DAY_START_HOUR + Math.floor((slotIdx * SLOT_MIN) / 60);
    const m = (slotIdx * SLOT_MIN) % 60;
    setBookDefaults({
      date: new Date(currentDate),
      time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      stylistId: colId,
    });
    setBookOpen(true);
  };

  const openNewBooking = () => {
    setBookDefaults({ date: currentDate });
    setBookOpen(true);
  };

  const onDragStart = (id: string) => setDraggingId(id);
  const onDrop = async (colId: string | null, slotIdx: number) => {
    if (!draggingId) return;
    const h = DAY_START_HOUR + Math.floor((slotIdx * SLOT_MIN) / 60);
    const m = (slotIdx * SLOT_MIN) % 60;
    const newDate = new Date(currentDate);
    newDate.setHours(h, m, 0, 0);
    try {
      await reschedule(draggingId, newDate, colId);
      toast.success(`Moved to ${format(newDate, "HH:mm")}`);
    } catch {
      toast.error("Could not move appointment");
    }
    setDraggingId(null);
    load();
  };

  const isToday = isSameDay(currentDate, new Date());
  const totalToday = jobs.length;
  const bookedHours = jobs.reduce((sum, j) => {
    const dur = (j as any).service_catalog?.duration_minutes ?? 45;
    return sum + dur / 60;
  }, 0);

  return (
    <div className="space-y-6">
      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appointment Board</h1>
          <p className="text-muted-foreground mt-1">
            {format(currentDate, "EEEE, d MMMM yyyy")} · {totalToday} bookings · {bookedHours.toFixed(1)}h
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setCurrentDate(addDays(currentDate, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" /> {isToday ? "Today" : format(currentDate, "d MMM")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={currentDate}
                onSelect={d => d && setCurrentDate(startOfDay(d))}
                className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Button size="icon" variant="outline" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(startOfDay(new Date()))}>
            Today
          </Button>
          <Button onClick={openNewBooking}>
            <Plus className="mr-2 h-4 w-4" /> New Booking
          </Button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filter
        </span>
        <Select value={filterStylist} onValueChange={setFilterStylist}>
          <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stylists</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {stylists.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="no_show">No-show</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {(filterStylist !== "all" || filterStatus !== "all") && (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setFilterStylist("all"); setFilterStatus("all"); }}>
            Clear
          </Button>
        )}
        <span className="ml-auto text-muted-foreground">
          {visibleJobs.length} of {jobs.length}
        </span>
      </div>

      {/* ── Desktop timeline grid ── */}
      <div className="hidden md:block atelier-card overflow-hidden">
        <div className="overflow-x-auto">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `72px repeat(${columns.length}, minmax(180px, 1fr))`,
              minWidth: 72 + columns.length * 180,
            }}
          >
            {/* Header row */}
            <div className="bg-secondary/50 border-b border-border h-14 flex items-end justify-end pr-3 pb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            {columns.map(col => (
              <div key={col.id ?? "unassigned"} className="bg-secondary/50 border-b border-l border-border h-14 px-3 flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-ember flex items-center justify-center text-xs font-semibold text-primary-foreground">
                  {col.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{col.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {jobs.filter(j => (j.assigned_to ?? null) === col.id).length} appts
                  </p>
                </div>
              </div>
            ))}

            {/* Body — time column */}
            <div className="bg-card relative" style={{ height: TOTAL_SLOTS * SLOT_PX }}>
              {TIME_SLOTS.map((t, i) => (
                <div
                  key={t}
                  className="absolute left-0 right-0 text-[11px] text-muted-foreground pr-2 text-right"
                  style={{ top: i * SLOT_PX, height: SLOT_PX, lineHeight: `${SLOT_PX}px` }}
                >
                  {t.endsWith(":00") && t}
                </div>
              ))}
            </div>

            {/* Body — stylist columns */}
            {columns.map(col => {
              const colJobs = visibleJobs.filter(j => (j.assigned_to ?? null) === col.id);
              return (
                <div
                  key={col.id ?? "unassigned"}
                  className="relative border-l border-border bg-background"
                  style={{ height: TOTAL_SLOTS * SLOT_PX }}
                >
                  {/* slot lines + drop targets */}
                  {TIME_SLOTS.map((t, i) => (
                    <div
                      key={t}
                      onClick={() => onCellClick(col.id, i)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => onDrop(col.id, i)}
                      className={cn(
                        "absolute left-0 right-0 cursor-pointer transition-colors hover:bg-primary/5",
                        t.endsWith(":00") ? "border-t border-border" : "border-t border-border/30"
                      )}
                      style={{ top: i * SLOT_PX, height: SLOT_PX }}
                    />
                  ))}
                  {/* Now indicator */}
                  {isToday && (() => {
                    const now = new Date();
                    const mins = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes();
                    if (mins < 0 || mins > (DAY_END_HOUR - DAY_START_HOUR) * 60) return null;
                    return (
                      <div className="absolute left-0 right-0 z-20 pointer-events-none"
                        style={{ top: (mins / SLOT_MIN) * SLOT_PX }}>
                        <div className="h-[2px] bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                      </div>
                    );
                  })()}
                  {/* Job cards */}
                  {colJobs.map(job => {
                    const pos = jobPosition(job);
                    if (!pos) return null;
                    const style = STATUS_STYLE[job.status] ?? STATUS_STYLE.pending;
                    return (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={() => onDragStart(job.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={(e) => { e.stopPropagation(); setEditingId(job.id); }}
                        className={cn(
                          "absolute left-1 right-1 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing",
                          "border border-border/50 shadow-sm hover:shadow-md transition-shadow z-10",
                          style.bg, style.text,
                          draggingId === job.id && "opacity-50"
                        )}
                        style={{ top: pos.top, height: pos.height }}
                        title={`${(job.customer as any)?.name ?? "Client"} · ${job.notes || job.service_type}`}
                      >
                        <div className="relative h-full pl-3 pr-2 py-1">
                          <span className={cn("absolute left-0 top-0 bottom-0 w-1", style.bar)} />
                          <p className="text-xs font-semibold truncate">
                            {format(new Date(job.scheduled_at!), "HH:mm")} · {(job.customer as any)?.name ?? "Client"}
                          </p>
                          {pos.height > 40 && (
                            <p className="text-[11px] opacity-80 truncate">{job.notes || job.service_type}</p>
                          )}
                          {pos.height > 60 && (
                            <Badge variant="outline" className="mt-1 text-[9px] py-0 px-1 h-4">
                              {job.status.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Mobile single-column list ── */}
      <div className="md:hidden space-y-2">
        {jobs.length === 0 && (
          <div className="atelier-card p-8 text-center text-muted-foreground">No appointments today</div>
        )}
        {visibleJobs.map(j => {
          const style = STATUS_STYLE[j.status] ?? STATUS_STYLE.pending;
          const stylistName = stylists.find(s => s.user_id === j.assigned_to)?.full_name ?? "Unassigned";
          return (
            <div key={j.id} onClick={() => setEditingId(j.id)} className={cn("atelier-card p-3 flex items-center gap-3 cursor-pointer", style.bg)}>
              <div className={cn("w-1 self-stretch rounded-full", style.bar)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {j.scheduled_at && format(new Date(j.scheduled_at), "HH:mm")} · {(j.customer as any)?.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{j.notes || j.service_type}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Users className="h-3 w-3" /> {stylistName}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">{j.status.replace("_", " ")}</Badge>
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {Object.entries(STATUS_STYLE).filter(([k]) => k !== "paid").map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={cn("h-3 w-3 rounded-sm", v.bar)} />
            {k.replace("_", " ")}
          </span>
        ))}
        <span className="ml-auto italic">Click an empty slot to book · drag a card to reschedule</span>
      </div>

      {/* ── New appointment wizard ── */}
      <NewAppointmentDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        onCreated={load}
        defaultDate={bookDefaults.date}
        defaultTime={bookDefaults.time}
        defaultStylistId={bookDefaults.stylistId ?? null}
      />

      {/* ── Edit panel ── */}
      <BookingEditPanel
        jobId={editingId}
        open={!!editingId}
        onOpenChange={(v) => { if (!v) setEditingId(null); }}
        onChanged={load}
        stylists={stylists}
      />
    </div>
  );
};

export default CalendarPage;
