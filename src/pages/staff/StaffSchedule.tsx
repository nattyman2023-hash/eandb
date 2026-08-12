import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, addDays, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, User } from "lucide-react";
import BookingEditPanel from "@/components/booking/BookingEditPanel";

interface Stylist { user_id: string; full_name: string; }

const DAY_START = 9, DAY_END = 19, SLOT_MIN = 30;
const SLOT_PX = 32;
const TOTAL_SLOTS = ((DAY_END - DAY_START) * 60) / SLOT_MIN;

const STATUS_BG: Record<string, string> = {
  confirmed: "bg-primary/15 border-primary/40",
  in_progress: "bg-warning/20 border-warning/50",
  completed: "bg-success/15 border-success/40",
  pending: "bg-muted border-border",
  cancelled: "bg-destructive/15 border-destructive/40",
  no_show: "bg-destructive/10 border-destructive/30",
};

export default function StaffSchedule() {
  const [day, setDay] = useState(startOfDay(new Date()));
  const [jobs, setJobs] = useState<any[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    const start = new Date(day); start.setHours(0,0,0,0);
    const end = new Date(day); end.setHours(23,59,59,999);
    const [j, s] = await Promise.all([
      api.from("jobs").select("*, customer:customers(name)").gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString()).order("scheduled_at"),
      api.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name"),
    ]);
    setJobs(j.data ?? []); setStylists((s.data as Stylist[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [day]);
  useEffect(() => {
    const ch = api.channel("staff-sched")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, load)
      .subscribe();
    return () => { api.removeChannel(ch); };
  // eslint-disable-next-line
  }, []);

  const cols = stylists.length ? stylists : [{ user_id: "_un", full_name: "Salon" }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl">Salon schedule</h2>
          <p className="text-xs text-muted-foreground">{format(day, "EEEE, d MMMM")} · {jobs.length} bookings</p>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" onClick={() => setDay(addDays(day, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setDay(startOfDay(new Date()))}>Today</Button>
          <Button size="icon" variant="outline" onClick={() => setDay(addDays(day, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="atelier-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `48px repeat(${cols.length}, minmax(120px, 1fr))`, minWidth: 48 + cols.length * 120 }}>
            <div className="bg-muted/40 border-b border-border h-10" />
            {cols.map(c => (
              <div key={c.user_id} className="bg-muted/40 border-b border-l border-border h-10 px-2 flex items-center text-xs font-medium truncate">
                {c.full_name}
              </div>
            ))}
            <div className="relative bg-card" style={{ height: TOTAL_SLOTS * SLOT_PX }}>
              {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
                const h = DAY_START + Math.floor(i * SLOT_MIN / 60);
                const m = (i * SLOT_MIN) % 60;
                const label = m === 0 ? `${String(h).padStart(2,"0")}:00` : "";
                return <div key={i} className="absolute left-0 right-0 text-[9px] text-muted-foreground text-right pr-1.5"
                  style={{ top: i * SLOT_PX, height: SLOT_PX, lineHeight: `${SLOT_PX}px` }}>{label}</div>;
              })}
            </div>
            {cols.map(col => {
              const colJobs = jobs.filter(j => (j.assigned_to ?? "_un") === col.user_id);
              return (
                <div key={col.user_id} className="relative border-l border-border bg-background" style={{ height: TOTAL_SLOTS * SLOT_PX }}>
                  {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-border/30" style={{ top: i * SLOT_PX, height: SLOT_PX }} />
                  ))}
                  {colJobs.map(j => {
                    const d = new Date(j.scheduled_at);
                    const mins = (d.getHours() - DAY_START) * 60 + d.getMinutes();
                    if (mins < 0 || mins > (DAY_END - DAY_START) * 60) return null;
                    const top = (mins / SLOT_MIN) * SLOT_PX + 1;
                    const dur = j.service_catalog?.duration_minutes ?? 45;
                    const height = Math.max(SLOT_PX - 2, (dur / SLOT_MIN) * SLOT_PX - 2);
                    return (
                      <button key={j.id} onClick={() => setEditId(j.id)}
                        className={`absolute left-1 right-1 text-left rounded-md px-1.5 py-1 border ${STATUS_BG[j.status] ?? "bg-card"}`}
                        style={{ top, height }}>
                        <p className="text-[10px] font-semibold truncate">{format(d, "HH:mm")} · {j.customer?.name ?? "Client"}</p>
                        {height > 32 && <p className="text-[9px] truncate opacity-80">{j.notes}</p>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <BookingEditPanel
        jobId={editId}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        onChanged={load}
        stylists={stylists}
      />
    </div>
  );
}
