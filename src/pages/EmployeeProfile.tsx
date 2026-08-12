import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Briefcase, Clock, DollarSign, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { Profile, Job, Customer, Vehicle } from "@/types/database";

interface TimeEntry {
  id: string;
  job_id: string;
  mechanic_id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  notes: string;
  created_at: string;
}

const EmployeeProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [jobs, setJobs] = useState<(Job & { customer?: Customer; hair_profile?: any; pay_type?: string; pay_amount?: number | null })[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: prof } = await api.from("profiles").select("*").eq("id", id).single();
      if (!prof) { setLoading(false); return; }
      setProfile(prof as unknown as Profile);

      const [rolesRes, jobsRes, timeRes] = await Promise.all([
        api.from("user_roles").select("role").eq("user_id", prof.user_id),
        api.from("jobs").select("*, customer:customers(name, phone, email), hair_profile:hair_profiles(preference, texture, goal)").eq("assigned_to", prof.user_id).order("created_at", { ascending: false }),
        api.from("time_entries").select("*").eq("mechanic_id", prof.user_id).order("start_time", { ascending: false }),
      ]);

      setRoles((rolesRes.data ?? []).map((r: any) => r.role));
      setJobs((jobsRes.data as any[]) ?? []);
      setTimeEntries((timeRes.data as unknown as TimeEntry[]) ?? []);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!profile) return <div className="p-8 text-muted-foreground">Employee not found.</div>;

  const completedJobs = jobs.filter(j => j.status === "completed" || j.status === "paid");
  const inProgressJobs = jobs.filter(j => j.status === "in_progress");
  const totalSeconds = timeEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0);
  const totalHours = totalSeconds / 3600;
  const hasTimeData = timeEntries.length > 0;

  // Calculate earnings respecting per-job pay overrides
  const calcEarnings = () => {
    let total = 0;
    // Group time entries by job
    const timeByJob: Record<string, number> = {};
    timeEntries.forEach(e => {
      timeByJob[e.job_id] = (timeByJob[e.job_id] || 0) + (e.duration_seconds || 0);
    });
    // For each job with time entries, use job-level pay if set
    for (const [jobId, seconds] of Object.entries(timeByJob)) {
      const job = jobs.find(j => j.id === jobId);
      const hours = seconds / 3600;
      if (job?.pay_type === "fixed" && job?.pay_amount != null) {
        // Fixed fee: add once (proportional if multiple jobs)
        total += Number(job.pay_amount);
      } else if (job?.pay_type === "hourly" && job?.pay_amount != null) {
        total += hours * Number(job.pay_amount);
      } else {
        total += hours * Number(profile.pay_rate || 0);
      }
    }
    return total;
  };

  const earnings = hasTimeData ? calcEarnings() : 0;

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-muted text-muted-foreground",
      confirmed: "bg-primary/20 text-primary",
      in_progress: "bg-accent/20 text-accent",
      completed: "bg-secondary/20 text-secondary-foreground",
      paid: "bg-accent/20 text-accent",
    };
    return map[status] ?? "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/employees")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{profile.full_name || "Unnamed"}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span>{profile.email}</span>
            {profile.phone && <span>· {profile.phone}</span>}
            <span>· £{Number(profile.pay_rate ?? 0).toFixed(2)}/hr</span>
            {(profile as any).postcode && <span>· 📍 {(profile as any).postcode}</span>}
          </div>
          {(profile as any).skills?.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {(profile as any).skills.map((skill: string) => (
                <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {roles.map(r => (
            <Badge key={r} variant="outline" className="capitalize">{r}</Badge>
          ))}
          <Badge className={profile.is_active ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}>
            {profile.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><Briefcase className="h-8 w-8 text-primary opacity-60" /><div><p className="text-2xl font-bold">{jobs.length}</p><p className="text-xs text-muted-foreground">Jobs Assigned</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-yellow-500 opacity-60" /><div><p className="text-2xl font-bold">{inProgressJobs.length}</p><p className="text-xs text-muted-foreground">In Progress</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><CheckCircle className="h-8 w-8 text-accent opacity-60" /><div><p className="text-2xl font-bold">{completedJobs.length}</p><p className="text-xs text-muted-foreground">Completed</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Clock className="h-8 w-8 text-secondary opacity-60" /><div><p className="text-2xl font-bold">{hasTimeData ? totalHours.toFixed(1) : "—"}</p><p className="text-xs text-muted-foreground">Hours Tracked</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><DollarSign className="h-8 w-8 text-primary opacity-60" /><div><p className="text-2xl font-bold">{hasTimeData ? `£${earnings.toFixed(2)}` : "—"}</p><p className="text-xs text-muted-foreground">Total Earnings</p></div></CardContent></Card>
      </div>

      {!hasTimeData && completedJobs.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Clock className="h-4 w-4" />
          <span>This employee has {completedJobs.length} completed job(s) but no time tracking data. Hours and earnings will appear once they use the timer.</span>
        </div>
      )}

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Job History ({jobs.length})</TabsTrigger>
          <TabsTrigger value="time">Time & Payments ({timeEntries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pay</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No jobs assigned</TableCell></TableRow>
                ) : jobs.map(job => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{(job.customer as any)?.name ?? "—"}</TableCell>
                    <TableCell>{job.hair_profile ? `${(job.hair_profile as any).preference} ${(job.hair_profile as any).texture} ${(job.hair_profile as any).goal}` : "—"}</TableCell>
                    <TableCell className="capitalize">{job.service_type}</TableCell>
                    <TableCell className="capitalize">{job.type}</TableCell>
                    <TableCell><Badge className={statusColor(job.status)}>{job.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {job.pay_amount != null
                        ? job.pay_type === "fixed" ? `£${Number(job.pay_amount).toFixed(2)} fixed` : `£${Number(job.pay_amount).toFixed(2)}/hr`
                        : "Default"}
                    </TableCell>
                    <TableCell>{job.scheduled_at ? format(new Date(job.scheduled_at), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell>{job.completed_at ? format(new Date(job.completed_at), "dd MMM yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="time">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Pay</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No time entries</TableCell></TableRow>
                ) : timeEntries.map(entry => {
                  const hours = (entry.duration_seconds || 0) / 3600;
                  const job = jobs.find(j => j.id === entry.job_id);
                  let pay: number;
                  if (job?.pay_type === "fixed" && job?.pay_amount != null) {
                    pay = Number(job.pay_amount); // show fixed amount
                  } else if (job?.pay_type === "hourly" && job?.pay_amount != null) {
                    pay = hours * Number(job.pay_amount);
                  } else {
                    pay = hours * Number(profile.pay_rate || 0);
                  }
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{format(new Date(entry.start_time), "dd MMM yyyy")}</TableCell>
                      <TableCell>{format(new Date(entry.start_time), "HH:mm")}</TableCell>
                      <TableCell>{entry.end_time ? format(new Date(entry.end_time), "HH:mm") : "Running"}</TableCell>
                      <TableCell>{hours.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">£{pay.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{entry.notes || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeProfile;
