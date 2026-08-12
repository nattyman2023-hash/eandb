import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Job } from "@/types/database";

const BuyerAccount = () => {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cust } = await api.from("customers").select("id, name, phone").eq("user_id", user.id).limit(1).single();
      if (cust) {
        setCustomerId(cust.id);
        setForm({ name: cust.name, phone: cust.phone || "" });
        const { data: j } = await api.from("jobs").select("*, customer:customers(name)").eq("customer_id", cust.id).order("created_at", { ascending: false });
        setJobs((j as unknown as Job[]) ?? []);
      }
    };
    load();
  }, [user]);

  const updateProfile = async () => {
    if (!customerId) return;
    await api.from("customers").update({ name: form.name, phone: form.phone }).eq("id", customerId);
    toast.success("Profile updated");
  };

  const statusColors: Record<string, string> = {
    pending: "bg-accent/20 text-accent",
    confirmed: "bg-accent/20 text-accent",
    in_progress: "bg-primary/20 text-primary",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    paid: "bg-accent/20 text-accent",
  };

  const upcoming = jobs.filter(j => j.scheduled_at && new Date(j.scheduled_at) >= new Date() && j.status !== "completed" && j.status !== "paid");
  const past = jobs.filter(j => j.status === "completed" || j.status === "paid" || (j.scheduled_at && new Date(j.scheduled_at) < new Date()));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-serif">My Account</h1>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past Bookings ({past.length})</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-3 pt-4">
          {upcoming.length === 0 ? (
            <div className="gilded-card p-8 text-center text-muted-foreground">No upcoming appointments</div>
          ) : (
            upcoming.map(job => (
              <div key={job.id} className="gilded-card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{job.notes || job.service_type}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {job.scheduled_at ? format(new Date(job.scheduled_at), "PPP 'at' HH:mm") : "TBC"}
                  </p>
                </div>
                <Badge className={statusColors[job.status] ?? ""}>{job.status}</Badge>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-3 pt-4">
          {past.length === 0 ? (
            <div className="gilded-card p-8 text-center text-muted-foreground">No past bookings</div>
          ) : (
            past.map(job => (
              <div key={job.id} className="gilded-card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{job.notes || job.service_type}</p>
                  <p className="text-sm text-muted-foreground">{job.created_at ? format(new Date(job.created_at), "dd MMM yyyy") : ""}</p>
                </div>
                <Badge className={statusColors[job.status] ?? ""}>{job.status}</Badge>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="profile" className="pt-4">
          <div className="gilded-card p-5 space-y-4 max-w-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">{user?.email}</p>
                <p className="text-sm text-muted-foreground">Customer</p>
              </div>
            </div>
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <Button onClick={updateProfile}>Save Changes</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BuyerAccount;
