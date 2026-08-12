import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Clock, Phone, CheckCircle2, XCircle } from "lucide-react";
import { format, differenceInHours, isPast } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BUSINESS } from "@/lib/siteContent";
import JobAddonsList from "@/components/jobs/JobAddonsList";
import type { Job } from "@/types/database";

const TIME_SLOTS = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"];

const statusStyle: Record<string, string> = {
  pending: "bg-[#F5F3EE] text-[#6B7280]",
  confirmed: "bg-[#A68966]/15 text-[#A68966]",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
};

const PortalBookings = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobNotes, setJobNotes] = useState<Record<string, string[]>>({});
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [rescheduleJob, setRescheduleJob] = useState<Job | null>(null);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newTime, setNewTime] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cust } = await api.from("customers").select("id").eq("user_id", user.id).single();
      if (!cust) return;
      const { data } = await api.from("jobs")
        .select("*, service_catalog:service_catalog_id(name, base_price, duration_minutes)")
        .eq("customer_id", cust.id)
        .order("scheduled_at", { ascending: false });
      setJobs((data as unknown as Job[]) ?? []);

      // Fetch stylist notes visible to client
      const jobIds = (data ?? []).map((j: any) => j.id);
      if (jobIds.length > 0) {
        const { data: notes } = await api.from("job_notes").select("job_id, content").in("job_id", jobIds).order("created_at", { ascending: false });
        const grouped: Record<string, string[]> = {};
        (notes ?? []).forEach((n: any) => {
          if (!grouped[n.job_id]) grouped[n.job_id] = [];
          grouped[n.job_id].push(n.content);
        });
        setJobNotes(grouped);
      }
    };
    load();
  }, [user]);

  const now = new Date();
  const upcoming = jobs.filter(j => j.scheduled_at && !isPast(new Date(j.scheduled_at)) && j.status !== "completed" && j.status !== "paid");
  const history = jobs.filter(j => j.status === "completed" || j.status === "paid" || (j.scheduled_at && isPast(new Date(j.scheduled_at))));

  const canReschedule = (j: Job) => {
    if (!j.scheduled_at) return false;
    return differenceInHours(new Date(j.scheduled_at), now) > 24;
  };

  const handleReschedule = async () => {
    if (!rescheduleJob || !newDate || !newTime) return;
    setSaving(true);
    const [h, m] = newTime.split(":").map(Number);
    const dt = new Date(newDate);
    dt.setHours(h, m, 0, 0);
    await api.from("jobs").update({ scheduled_at: dt.toISOString() }).eq("id", rescheduleJob.id);
    toast.success(`Appointment moved to ${format(dt, "PPP 'at' h:mm a")}`);
    setRescheduleJob(null);
    setNewDate(undefined);
    setNewTime("");
    setSaving(false);
    // Reload
    const { data: cust } = await api.from("customers").select("id").eq("user_id", user!.id).single();
    if (cust) {
      const { data } = await api.from("jobs").select("*").eq("customer_id", cust.id).order("scheduled_at", { ascending: false });
      setJobs((data as unknown as Job[]) ?? []);
    }
  };

  const handleCancel = async (job: Job) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    await api.from("jobs").update({ status: "completed", notes: (job.notes || "") + " [Cancelled by client]" }).eq("id", job.id);
    toast.success("Appointment cancelled");
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "completed" as any } : j));
  };

  const display = tab === "upcoming" ? upcoming : history;

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-2xl font-serif text-[#1A2B42]">My Bookings</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F5F3EE] rounded-xl p-1">
        <button onClick={() => setTab("upcoming")} className={cn("flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors", tab === "upcoming" ? "bg-white text-[#1A2B42] shadow-sm" : "text-[#6B7280]")}>
          Upcoming ({upcoming.length})
        </button>
        <button onClick={() => setTab("history")} className={cn("flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors", tab === "history" ? "bg-white text-[#1A2B42] shadow-sm" : "text-[#6B7280]")}>
          History ({history.length})
        </button>
      </div>

      {display.length === 0 ? (
        <div className="bg-white border border-[#E8E4DD] rounded-2xl p-12 text-center text-[#6B7280]">
          {tab === "upcoming" ? "No upcoming appointments" : "No past visits yet"}
        </div>
      ) : (
        <div className="space-y-3">
          {display.map(job => {
            const canChange = canReschedule(job) && tab === "upcoming";
            const notes = jobNotes[job.id];
            return (
              <div key={job.id} className="bg-white border border-[#E8E4DD] rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-[#1A2B42]">{job.notes || job.service_type}</p>
                    <p className="text-sm text-[#6B7280] flex items-center gap-1 mt-1">
                      <CalendarIcon className="h-3 w-3" />
                      {job.scheduled_at ? format(new Date(job.scheduled_at), "EEEE, MMM do 'at' h:mm a") : "TBC"}
                    </p>
                  </div>
                  <Badge className={statusStyle[job.status] ?? "bg-gray-100 text-gray-600"}>
                    {job.status.replace("_", " ")}
                  </Badge>
                </div>

                {/* Add-ons & price breakdown */}
                <JobAddonsList
                  jobId={job.id}
                  basePrice={Number((job as any).service_catalog?.base_price ?? 0) || undefined}
                  baseDuration={Number((job as any).service_catalog?.duration_minutes ?? 0) || undefined}
                  baseName={(job as any).service_catalog?.name}
                  variant="portal"
                />

                {/* Stylist Note */}
                {notes && notes.length > 0 && (
                  <div className="bg-[#F5F3EE] rounded-xl p-3">
                    <p className="text-xs uppercase tracking-wider text-[#A68966] mb-1">Stylist Note</p>
                    <p className="text-sm text-[#1A2B42]">{notes[0]}</p>
                  </div>
                )}

                {/* Actions */}
                {tab === "upcoming" && (
                  <div className="flex gap-2">
                    {canChange ? (
                      <>
                        <Button size="sm" variant="outline" className="border-[#A68966] text-[#A68966] hover:bg-[#A68966]/10" onClick={() => setRescheduleJob(job)}>
                          Reschedule
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleCancel(job)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <a href={`tel:${BUSINESS.phone}`}>
                        <Button size="sm" variant="outline" className="gap-1">
                          <Phone className="h-3 w-3" /> Call to Reschedule
                        </Button>
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      <Dialog open={!!rescheduleJob} onOpenChange={o => !o && setRescheduleJob(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#1A2B42]">Reschedule Appointment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6B7280]">Select a new date and time for your appointment.</p>
          <Calendar
            mode="single"
            selected={newDate}
            onSelect={setNewDate}
            disabled={d => d < new Date()}
            className="p-3 pointer-events-auto mx-auto"
          />
          {newDate && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#1A2B42]">Select Time</p>
              <div className="grid grid-cols-4 gap-2">
                {TIME_SLOTS.map(t => (
                  <button
                    key={t}
                    onClick={() => setNewTime(t)}
                    className={cn(
                      "py-2 px-3 text-sm rounded-lg border transition-colors",
                      newTime === t ? "bg-[#A68966] text-white border-[#A68966]" : "border-[#E8E4DD] text-[#6B7280] hover:border-[#A68966]"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button onClick={handleReschedule} disabled={!newDate || !newTime || saving} className="w-full bg-[#A68966] hover:bg-[#8B7355]">
            {saving ? "Updating..." : "Confirm New Time"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalBookings;
