import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Scissors, Camera, CheckCircle, Play, LogOut, Clock, ArrowLeftRight, DollarSign, CalendarIcon, Armchair, CalendarOff } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { Job, TimeEntry, LeaveRequest } from "@/types/database";

const StaffPortal = () => {
  const { user, profile, signOut } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTimers, setActiveTimers] = useState<Record<string, TimeEntry>>({});
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [swapOpen, setSwapOpen] = useState<string | null>(null);
  const [swapReason, setSwapReason] = useState("");
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ startDate: undefined as Date | undefined, endDate: undefined as Date | undefined, type: "Holiday", reason: "" });
  const [chairStatus, setChairStatus] = useState<string>("Available");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTodayJobs = async () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
    const { data } = await api.from("jobs").select("*, customer:customers(*), hair_profile:hair_profiles(preference, texture, goal)").gte("scheduled_at", start).lte("scheduled_at", end).order("scheduled_at");
    setJobs((data as unknown as Job[]) ?? []);
  };

  const fetchActiveTimers = async () => {
    if (!user) return;
    const { data } = await api.from("time_entries").select("*").eq("mechanic_id", user.id).is("end_time", null);
    const timers: Record<string, TimeEntry> = {};
    (data ?? []).forEach((e: any) => { timers[e.job_id] = e as TimeEntry; });
    setActiveTimers(timers);
  };

  const fetchEarnings = async () => {
    if (!user) return;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
    const [entriesRes, profileRes] = await Promise.all([
      api.from("time_entries").select("duration_seconds").eq("mechanic_id", user.id).gte("start_time", weekStart).not("end_time", "is", null),
      api.from("profiles").select("pay_rate").eq("user_id", user.id).single(),
    ]);
    const totalSecs = (entriesRes.data ?? []).reduce((s: number, e: any) => s + (e.duration_seconds || 0), 0);
    const rate = profileRes.data?.pay_rate ?? 0;
    setWeekEarnings((totalSecs / 3600) * Number(rate));
  };

  const fetchLeaveRequests = async () => {
    if (!user) return;
    const { data } = await api.from("leave_requests").select("*").eq("staff_id", user.id).order("created_at", { ascending: false });
    setLeaveRequests((data as unknown as LeaveRequest[]) ?? []);
  };

  useEffect(() => { fetchTodayJobs(); fetchActiveTimers(); fetchEarnings(); fetchLeaveRequests(); }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const e: Record<string, number> = {};
      Object.entries(activeTimers).forEach(([jobId, entry]) => {
        e[jobId] = Math.floor((now - new Date(entry.start_time).getTime()) / 1000);
      });
      setElapsed(e);
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTimers]);

  const startTimer = async (jobId: string) => {
    if (!user) return;
    const { data, error } = await api.from("time_entries").insert({ job_id: jobId, mechanic_id: user.id }).select().single();
    if (error) { toast.error(error.message); return; }
    setActiveTimers(prev => ({ ...prev, [jobId]: data as TimeEntry }));
    toast.success("Timer started");
  };

  const stopTimer = async (jobId: string) => {
    const entry = activeTimers[jobId];
    if (!entry) return;
    const duration = Math.floor((Date.now() - new Date(entry.start_time).getTime()) / 1000);
    await api.from("time_entries").update({ end_time: new Date().toISOString(), duration_seconds: duration }).eq("id", entry.id);
    setActiveTimers(prev => { const n = { ...prev }; delete n[jobId]; return n; });
    toast.success(`Timer stopped — ${Math.floor(duration / 60)} minutes logged`);
    fetchEarnings();
  };

  const startJob = async (job: Job) => {
    await api.from("jobs").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", job.id);
    toast.success("Service started"); fetchTodayJobs();
  };

  const completeJob = async (job: Job) => {
    if (activeTimers[job.id]) await stopTimer(job.id);
    await api.from("jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
    toast.success("Service completed"); fetchTodayJobs();
  };

  const uploadPhoto = async (jobId: string, file: File) => {
    const path = `${jobId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await api.storage.from("job-photos").upload(path, file);
    if (uploadError) { toast.error(uploadError.message); return; }
    await api.from("job_photos").insert({ job_id: jobId, storage_path: path, uploaded_by: user?.id });
    toast.success("Photo uploaded");
  };

  const requestSwap = async (jobId: string) => {
    if (!user || !swapReason.trim()) return;
    await api.from("swap_requests").insert({ job_id: jobId, from_mechanic_id: user.id, reason: swapReason });
    toast.success("Swap request sent"); setSwapOpen(null); setSwapReason("");
  };

  const submitLeaveRequest = async () => {
    if (!user || !leaveForm.startDate || !leaveForm.endDate) return;
    const { error } = await api.from("leave_requests").insert({
      staff_id: user.id,
      start_date: format(leaveForm.startDate, "yyyy-MM-dd"),
      end_date: format(leaveForm.endDate, "yyyy-MM-dd"),
      type: leaveForm.type,
      reason: leaveForm.reason || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Time off request submitted");
    setLeaveOpen(false);
    setLeaveForm({ startDate: undefined, endDate: undefined, type: "Holiday", reason: "" });
    fetchLeaveRequests();
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const statusColors: Record<string, string> = {
    pending: "border-l-muted-foreground", confirmed: "border-l-primary",
    in_progress: "border-l-accent", completed: "border-l-success",
  };

  const leaveStatusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-success/20 text-success">Approved</Badge>;
    if (status === "declined") return <Badge className="bg-destructive/20 text-destructive">Declined</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  // Weekly shift overview
  const weekDays = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });

  const isOnLeave = (day: Date) => {
    return leaveRequests.some(lr =>
      lr.status === "approved" &&
      isWithinInterval(day, { start: parseISO(lr.start_date), end: parseISO(lr.end_date) })
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto pwa-safe-area">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
          <img src="/eandb-mark.svg" alt="" className="h-10 w-10" width="64" height="64" />
          <div>
            <h1 className="text-lg font-bold">E and B</h1>
            <p className="text-xs text-muted-foreground">Staff Portal — {profile?.full_name}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
      </div>

      <Tabs defaultValue="agenda" className="space-y-4">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="agenda">Today</TabsTrigger>
          <TabsTrigger value="chair">Chair</TabsTrigger>
          <TabsTrigger value="timeoff">Time Off</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
        </TabsList>

        {/* TODAY'S AGENDA */}
        <TabsContent value="agenda" className="space-y-4">
          <h2 className="text-lg font-semibold">Today's Appointments ({jobs.length})</h2>
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Scissors className="h-12 w-12 mb-3 opacity-40" />
              <p>No appointments scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const cust = job.customer as any;
                const veh = job.hair_profile as any;
                const isTimerRunning = !!activeTimers[job.id];
                return (
                  <Card key={job.id} className={`border-l-4 ${statusColors[job.status] ?? ""}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{cust?.name ?? "Walk-in"}</CardTitle>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {job.scheduled_at ? format(new Date(job.scheduled_at), "HH:mm") : "TBC"}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {veh && <p className="text-sm text-muted-foreground">{veh.texture} {veh.goal}</p>}
                      <p className="text-sm">{job.service_type} · In-Salon</p>
                      {job.notes && <p className="text-sm text-muted-foreground">{job.notes}</p>}
                      {isTimerRunning && (
                        <div className="flex items-center gap-2 bg-accent/10 rounded-lg p-2">
                          <Clock className="h-4 w-4 text-accent animate-pulse" />
                          <span className="font-mono font-bold text-accent">{formatTime(elapsed[job.id] || 0)}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {(job.status === "pending" || job.status === "confirmed") && (
                          <Button size="sm" onClick={() => startJob(job)}><Play className="mr-1 h-4 w-4" /> Start</Button>
                        )}
                        {job.status === "in_progress" && (
                          <Button size="sm" variant="secondary" onClick={() => completeJob(job)}><CheckCircle className="mr-1 h-4 w-4" /> Complete</Button>
                        )}
                        {job.status === "in_progress" && !isTimerRunning && (
                          <Button size="sm" variant="outline" onClick={() => startTimer(job.id)}><Clock className="mr-1 h-4 w-4" /> Timer</Button>
                        )}
                        {isTimerRunning && (
                          <Button size="sm" variant="destructive" onClick={() => stopTimer(job.id)}><Clock className="mr-1 h-4 w-4" /> Stop</Button>
                        )}
                        <label className="inline-flex">
                          <Button size="sm" variant="outline" asChild><span><Camera className="mr-1 h-4 w-4" /> Photo</span></Button>
                          <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(job.id, e.target.files[0])} />
                        </label>
                        <Button size="sm" variant="outline" onClick={() => setSwapOpen(job.id)}><ArrowLeftRight className="mr-1 h-4 w-4" /> Swap</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* MY CHAIR */}
        <TabsContent value="chair" className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Armchair className="h-5 w-5" /> My Chair Status</h2>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Status</span>
                <Badge className={cn(
                  chairStatus === "Available" && "bg-success/20 text-success",
                  chairStatus === "Occupied" && "bg-primary/20 text-primary",
                  chairStatus === "Cleaning" && "bg-warning/20 text-warning-foreground",
                )}>{chairStatus}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["Available", "Occupied", "Cleaning"].map(s => (
                  <Button key={s} variant={chairStatus === s ? "default" : "outline"} size="sm" onClick={() => setChairStatus(s)} className="text-xs">{s}</Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shift Overview */}
          <h3 className="text-sm font-semibold gilded-label">This Week's Shifts</h3>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(day => {
              const onLeave = isOnLeave(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={cn(
                  "atelier-card p-2 text-center text-xs",
                  isToday && "ring-2 ring-primary",
                  onLeave && "bg-destructive/10"
                )}>
                  <p className="font-medium">{format(day, "EEE")}</p>
                  <p className={cn("text-lg font-bold", isToday && "text-primary")}>{format(day, "d")}</p>
                  {onLeave ? (
                    <p className="text-destructive text-[10px]">Leave</p>
                  ) : (
                    <p className="text-muted-foreground text-[10px]">9-18</p>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* TIME OFF */}
        <TabsContent value="timeoff" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarOff className="h-5 w-5" /> Time Off</h2>
            <Button variant="outline" onClick={() => setLeaveOpen(true)} className="border-primary text-primary">
              <CalendarOff className="mr-2 h-4 w-4" /> Request Time Off
            </Button>
          </div>

          {leaveRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No time off requests yet</p>
          ) : (
            <div className="space-y-3">
              {leaveRequests.map(lr => (
                <Card key={lr.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{lr.type}</span>
                      {leaveStatusBadge(lr.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(lr.start_date), "d MMM yyyy")} — {format(parseISO(lr.end_date), "d MMM yyyy")}
                    </p>
                    {lr.reason && <p className="text-sm mt-1">{lr.reason}</p>}
                    {lr.status === "declined" && lr.decline_reason && (
                      <p className="text-sm text-destructive mt-2 p-2 bg-destructive/5 rounded">
                        Reason: {lr.decline_reason}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* EARNINGS */}
        <TabsContent value="earnings" className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="h-5 w-5" /> Commission Tracker</h2>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="gilded-label mb-2">This Week's Earnings</p>
              <p className="text-4xl font-bold text-primary">£{weekEarnings.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground mt-2">Based on logged hours × pay rate</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Swap Dialog */}
      <Dialog open={!!swapOpen} onOpenChange={(o) => { if (!o) { setSwapOpen(null); setSwapReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Appointment Swap</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Reason for swap request..." value={swapReason} onChange={(e) => setSwapReason(e.target.value)} rows={3} />
            <Button onClick={() => swapOpen && requestSwap(swapOpen)} disabled={!swapReason.trim()} className="w-full">Submit Request</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Request Dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Time Off</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-sm", !leaveForm.startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {leaveForm.startDate ? format(leaveForm.startDate, "PPP") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={leaveForm.startDate} onSelect={d => setLeaveForm(f => ({ ...f, startDate: d }))} className="pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-sm", !leaveForm.endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {leaveForm.endDate ? format(leaveForm.endDate, "PPP") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={leaveForm.endDate} onSelect={d => setLeaveForm(f => ({ ...f, endDate: d }))} className="pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={leaveForm.type} onValueChange={v => setLeaveForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Holiday">Holiday</SelectItem>
                  <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Brief note..." />
            </div>
            <Button onClick={submitLeaveRequest} disabled={!leaveForm.startDate || !leaveForm.endDate} className="w-full">
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffPortal;
