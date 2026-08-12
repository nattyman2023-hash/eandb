import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { DollarSign, CalendarDays, Armchair, Users, Clock, CheckCircle, Target, PenLine, ArrowRight, Bell, TrendingUp, Play } from "lucide-react";
import { format } from "date-fns";
import type { Job, Lead } from "@/types/database";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";

interface ApprovalItem {
  id: string; type: "quote" | "invoice"; customerName: string;
  serviceInfo: string; status: string; date: string; hasSig: boolean;
}

const Dashboard = () => {
  const [stats, setStats] = useState({ jobs: 0, customers: 0, pendingInvoices: 0, todayRevenue: 0, newClientsWeek: 0 });
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [chairs, setChairs] = useState<{ id: string; name: string; zone: string; is_active: boolean }[]>([]);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [revenueData, setRevenueData] = useState<{ day: string; revenue: number }[]>([]);

  const fetchApprovals = useCallback(async () => {
    const [quotesRes, invoicesRes] = await Promise.all([
      api.from("quotes").select("*, lead:leads(name)").eq("status", "Accepted").order("created_at", { ascending: false }).limit(5),
      api.from("invoices").select("*, job:jobs(*, customer:customers(name), hair_profile:hair_profiles(preference))").not("signature", "is", null).order("updated_at", { ascending: false }).limit(5),
    ]);
    const items: ApprovalItem[] = [];
    ((quotesRes.data as any[]) ?? []).forEach((q: any) => {
      items.push({ id: q.id, type: "quote", customerName: q.lead?.name ?? "Unknown", serviceInfo: "", status: q.signature ? "Signed" : "Accepted", date: q.created_at, hasSig: !!q.signature });
    });
    ((invoicesRes.data as any[]) ?? []).forEach((inv: any) => {
      items.push({ id: inv.id, type: "invoice", customerName: inv.job?.customer?.name ?? "Unknown", serviceInfo: inv.job?.hair_profile?.preference ?? "", status: "Signed", date: inv.updated_at, hasSig: true });
    });
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setApprovals(items.slice(0, 5));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
      const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString();

      const [custCount, invCount, todayRes, recentRes, chairRes, waitRes, newClients, paidInvoices] = await Promise.all([
        api.from("customers").select("id", { count: "exact", head: true }),
        api.from("invoices").select("id", { count: "exact", head: true }).in("status", ["draft", "sent"]),
        api.from("jobs").select("*, customer:customers(name), hair_profile:hair_profiles(preference, texture, goal)").gte("scheduled_at", startOfDay).lte("scheduled_at", endOfDay).order("scheduled_at"),
        api.from("jobs").select("*, customer:customers(name)").order("created_at", { ascending: false }).limit(5),
        api.from("chairs").select("id, name, zone, is_active").order("created_at"),
        api.from("waitlist").select("*").eq("status", "waiting").order("created_at"),
        api.from("customers").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        api.from("invoices").select("total").eq("status", "paid").gte("created_at", startOfDay),
      ]);

      const todayRevenue = ((paidInvoices.data as any[]) ?? []).reduce((sum: number, i: any) => sum + (Number(i.total) || 0), 0);

      setStats({
        jobs: (todayRes.data as any[])?.length ?? 0,
        customers: custCount.count ?? 0,
        pendingInvoices: invCount.count ?? 0,
        todayRevenue,
        newClientsWeek: newClients.count ?? 0,
      });
      setTodayJobs((todayRes.data as unknown as Job[]) ?? []);
      setRecentJobs((recentRes.data as unknown as Job[]) ?? []);
      setChairs((chairRes.data as any[]) ?? []);
      setWaitlist((waitRes.data as any[]) ?? []);

      // Weekly revenue chart data
      const days: { day: string; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
        const { data: dayInv } = await api.from("invoices").select("total").eq("status", "paid").gte("created_at", dayStart).lte("created_at", dayEnd);
        const rev = ((dayInv as any[]) ?? []).reduce((s: number, inv: any) => s + (Number(inv.total) || 0), 0);
        days.push({ day: format(d, "EEE"), revenue: rev });
      }
      setRevenueData(days);
    };
    fetchData();
    fetchApprovals();
  }, [fetchApprovals]);

  useEffect(() => {
    const channel = api
      .channel("dashboard-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, () => fetchApprovals())
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => fetchApprovals())
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [fetchApprovals]);

  const handleConvertQuote = async (quoteId: string) => {
    try {
      const { error } = await api.functions.invoke("accept-quote", { body: { quote_id: quoteId } });
      if (error) throw error;
      toast.success("Quote converted to job & customer created");
      fetchApprovals();
    } catch (err: any) { toast.error(err.message || "Failed to convert quote"); }
  };

  const activeChairs = chairs.filter(c => c.is_active).length;
  const chairOccupancy = chairs.length > 0 ? Math.round((activeChairs / chairs.length) * 100) : 0;

  const statusColors: Record<string, string> = {
    pending: "bg-accent/20 text-accent border border-accent/30",
    confirmed: "bg-primary/20 text-primary border border-primary/30",
    in_progress: "bg-primary/20 text-primary border border-primary/30",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
  const statusLabels: Record<string, string> = {
    pending: "Booked", confirmed: "Confirmed", in_progress: "In-Chair", completed: "Checked Out", paid: "Paid",
  };

  const metricCards = [
    { label: "Today's Revenue", value: `£${stats.todayRevenue.toFixed(0)}`, icon: DollarSign, color: "text-primary" },
    { label: "Active Appointments", value: stats.jobs, icon: CalendarDays, color: "text-accent" },
    { label: "Chair Occupancy", value: `${chairOccupancy}%`, icon: Armchair, color: "text-primary" },
    { label: "New Clients This Week", value: stats.newClientsWeek, icon: Users, color: "text-accent" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Command Centre</h1>
        <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map(m => (
          <div key={m.label} className="atelier-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="gilded-label">{m.label}</span>
              <m.icon className={`h-5 w-5 ${m.color}`} />
            </div>
            <div className={`text-3xl font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Live Feed + Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Live Check-In Feed */}
        <div className="atelier-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-primary" /> Today's Schedule
            </h3>
            <Badge className="bg-primary/10 text-primary">{todayJobs.length} booked</Badge>
          </div>
          {todayJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No appointments today</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {todayJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between rounded-xl border border-border p-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {((job.customer as any)?.name ?? "?")[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{(job.customer as any)?.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.scheduled_at && format(new Date(job.scheduled_at), "HH:mm")}
                        {job.notes && ` · ${job.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[job.status] ?? ""}>{statusLabels[job.status] ?? job.status}</Badge>
                    {job.status === "confirmed" && (
                      <Button size="sm" variant="ghost" className="text-primary h-7"><Play className="h-3 w-3 mr-1" /> Start</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue Chart */}
        <div className="atelier-card p-5 space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" /> Weekly Revenue
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `£${v}`} />
              <Tooltip formatter={(v: number) => [`£${v}`, "Revenue"]} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Waitlist + Chair Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Live Waitlist */}
        <div className="atelier-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-accent" /> Walk-In Queue
            </h3>
            <Link to="/waitlist"><Button size="sm" variant="outline">Open Kiosk</Button></Link>
          </div>
          {waitlist.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No one in queue</p>
          ) : (
            <div className="space-y-2">
              {waitlist.slice(0, 5).map((w: any, i: number) => (
                <div key={w.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">{i + 1}</span>
                    <div>
                      <p className="font-medium text-sm">{w.client_name}</p>
                      <p className="text-xs text-muted-foreground">~{w.estimated_wait_minutes}m wait</p>
                    </div>
                  </div>
                  <Badge className="bg-accent/20 text-accent">Waiting</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chair Status */}
        <div className="atelier-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Armchair className="h-5 w-5 text-primary" /> Chair Status
            </h3>
            <Link to="/chairs" className="text-sm text-primary hover:underline">Manage →</Link>
          </div>
          {chairs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No chairs configured</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {chairs.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border border-border p-3">
                  <div className={`h-3 w-3 rounded-full shrink-0 ${c.is_active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.zone}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity + Approvals */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="atelier-card p-5 space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle className="h-5 w-5 text-accent" /> Recent Activity
          </h3>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {recentJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="font-medium text-sm">{(job.customer as any)?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{job.service_type} · {format(new Date(job.created_at), "dd MMM yyyy")}</p>
                  </div>
                  <Badge className={statusColors[job.status] ?? ""}>{statusLabels[job.status] ?? job.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approvals */}
        {approvals.length > 0 && (
          <div className="atelier-card p-5 space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Bell className="h-5 w-5 text-primary" /> Customer Approvals
            </h3>
            <div className="space-y-2">
              {approvals.map(item => (
                <div key={`${item.type}-${item.id}`} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="font-medium text-sm">{item.customerName}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(item.date), "dd MMM HH:mm")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={item.hasSig ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-primary/20 text-primary"}>
                      {item.hasSig && <PenLine className="mr-1 h-3 w-3" />}
                      {item.type === "quote" ? (item.hasSig ? "Signed" : "Accepted") : "Invoice Signed"}
                    </Badge>
                    {item.type === "quote" && !item.hasSig && (
                      <Button size="sm" variant="outline" onClick={() => handleConvertQuote(item.id)}>
                        <ArrowRight className="mr-1 h-3 w-3" /> Convert
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
