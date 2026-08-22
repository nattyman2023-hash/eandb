import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, DollarSign, Users, TrendingUp, BarChart3, CalendarDays } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, startOfMonth, startOfWeek, isWithinInterval, subMonths, parseISO } from "date-fns";

type DateRange = "today" | "week" | "month" | "custom";

const Reports = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    const load = async () => {
      const [invRes, jobRes, profRes, svcRes, custRes] = await Promise.all([
        api.from("invoices").select("*, job:jobs(*, customer:customers(name), hair_profile:hair_profiles(preference))").order("created_at", { ascending: false }),
        api.from("jobs").select("*, customer:customers(name, id, created_at), hair_profile:hair_profiles(preference)").order("created_at", { ascending: false }),
        api.from("profiles").select("*").eq("is_active", true),
        api.from("service_catalog").select("*"),
        api.from("customers").select("*").order("created_at", { ascending: false }),
      ]);
      setInvoices(invRes.data ?? []);
      setJobs(jobRes.data ?? []);
      setProfiles(profRes.data ?? []);
      setServices(svcRes.data ?? []);
      setCustomers(custRes.data ?? []);
    };
    load();
  }, []);

  const getDateInterval = () => {
    const now = new Date();
    if (dateRange === "today") return { start: startOfDay(now), end: endOfDay(now) };
    if (dateRange === "week") return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
    if (dateRange === "month") return { start: startOfMonth(now), end: endOfDay(now) };
    if (dateRange === "custom" && customFrom && customTo) return { start: startOfDay(parseISO(customFrom)), end: endOfDay(parseISO(customTo)) };
    return { start: startOfMonth(now), end: endOfDay(now) };
  };

  const interval = getDateInterval();

  const filteredInvoices = invoices.filter(inv => {
    const d = new Date(inv.created_at);
    return isWithinInterval(d, interval);
  });

  const filteredJobs = jobs.filter(j => {
    const d = new Date(j.created_at);
    return isWithinInterval(d, interval);
  });

  const completedJobs = filteredJobs.filter(j => j.status === "completed" || j.status === "paid");

  // Financial metrics
  const grossRevenue = filteredInvoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const serviceRevenue = grossRevenue; // simplified
  const avgTicket = filteredInvoices.filter(i => i.status === "paid").length > 0
    ? grossRevenue / filteredInvoices.filter(i => i.status === "paid").length : 0;

  // Staff performance
  const staffMetrics = profiles.map(p => {
    const staffJobs = completedJobs.filter(j => j.assigned_to === p.user_id);
    const staffRevenue = filteredInvoices
      .filter(inv => inv.status === "paid" && staffJobs.some(j => j.id === inv.job_id))
      .reduce((s, i) => s + Number(i.total), 0);
    const commission = Number(p.pay_rate || 0) > 0 ? staffRevenue * (Number(p.pay_rate) / 100) : 0;
    return {
      name: p.full_name || p.email,
      servicesCompleted: staffJobs.length,
      revenue: staffRevenue,
      commission,
    };
  }).filter(s => s.servicesCompleted > 0).sort((a, b) => b.revenue - a.revenue);

  // Service trends
  const serviceTrends = useMemo(() => {
    const cats: Record<string, { count: number; revenue: number }> = {};
    completedJobs.forEach(j => {
      const cat = j.service_type || "Other";
      if (!cats[cat]) cats[cat] = { count: 0, revenue: 0 };
      cats[cat].count++;
    });
    // Map revenue from invoices
    filteredInvoices.filter(i => i.status === "paid").forEach(inv => {
      const job = completedJobs.find(j => j.id === inv.job_id);
      if (job) {
        const cat = job.service_type || "Other";
        if (cats[cat]) cats[cat].revenue += Number(inv.total);
      }
    });
    const totalRev = Object.values(cats).reduce((s, c) => s + c.revenue, 0);
    return Object.entries(cats).map(([name, data]) => ({
      name,
      volume: data.count,
      revenue: data.revenue,
      percentage: totalRev > 0 ? (data.revenue / totalRev * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [completedJobs, filteredInvoices]);

  // Client retention
  const clientRetention = useMemo(() => {
    const uniqueClients = new Set(filteredJobs.map(j => j.customer_id));
    const returningClients = new Set<string>();
    const prevInterval = {
      start: subMonths(interval.start, 1),
      end: subDays(interval.start, 1),
    };
    const prevJobs = jobs.filter(j => {
      const d = new Date(j.created_at);
      return d >= prevInterval.start && d <= prevInterval.end;
    });
    const prevClientIds = new Set(prevJobs.map(j => j.customer_id));
    uniqueClients.forEach(id => { if (prevClientIds.has(id)) returningClients.add(id); });
    const retentionRate = prevClientIds.size > 0 ? (returningClients.size / prevClientIds.size * 100) : 0;
    const newClients = customers.filter(c => {
      const d = new Date(c.created_at);
      return isWithinInterval(d, interval);
    }).length;

    return {
      totalClients: uniqueClients.size,
      returningClients: returningClients.size,
      newClients,
      retentionRate,
    };
  }, [filteredJobs, jobs, customers, interval]);

  const searchFilter = (list: any[], keys: string[]) =>
    list.filter(item => {
      if (!search) return true;
      const s = search.toLowerCase();
      return keys.some(k => {
        const val = k.split(".").reduce((o, p) => o?.[p], item);
        return typeof val === "string" && val.toLowerCase().includes(s);
      });
    });

  const exportCSV = (rows: string[][], filename: string) => {
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analysis</h1>
          <p className="text-muted-foreground">Business performance insights for E and B</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={dateRange} onValueChange={(v: DateRange) => setDateRange(v)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {dateRange === "custom" && (
            <div className="flex gap-2">
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-[140px]" />
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-[140px]" />
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by client, stylist, or service type..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Tabs defaultValue="financial">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="financial"><DollarSign className="mr-1 h-4 w-4" />Financial</TabsTrigger>
          <TabsTrigger value="staff"><Users className="mr-1 h-4 w-4" />Staff</TabsTrigger>
          <TabsTrigger value="trends"><TrendingUp className="mr-1 h-4 w-4" />Service Trends</TabsTrigger>
          <TabsTrigger value="retention"><BarChart3 className="mr-1 h-4 w-4" />Client Retention</TabsTrigger>
        </TabsList>

        {/* Financial Summary */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Gross Revenue", value: `£${grossRevenue.toFixed(2)}`, icon: DollarSign },
              { label: "Service Revenue", value: `£${serviceRevenue.toFixed(2)}`, icon: BarChart3 },
              { label: "Avg Ticket Size", value: `£${avgTicket.toFixed(2)}`, icon: TrendingUp },
              { label: "Paid Invoices", value: String(filteredInvoices.filter(i => i.status === "paid").length), icon: CalendarDays },
            ].map(m => (
              <Card key={m.label} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">{m.label}</span>
                  <m.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold text-primary">{m.value}</div>
              </Card>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => {
              const rows = [["Date", "Client", "Service", "Stylist", "Payment Method", "Total (£)"]];
              searchFilter(filteredInvoices.filter(i => i.status === "paid"), ["job.customer.name"]).forEach(inv => {
                const job = jobs.find(j => j.id === inv.job_id);
                const stylist = profiles.find(p => p.user_id === job?.assigned_to);
                rows.push([
                  format(new Date(inv.created_at), "yyyy-MM-dd"),
                  inv.job?.customer?.name ?? "—",
                  job?.service_type ?? "—",
                  stylist?.full_name ?? "—",
                  inv.payment_method ?? "—",
                  Number(inv.total).toFixed(2),
                ]);
              });
              exportCSV(rows, "financial-summary.csv");
            }}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Stylist</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total (£)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchFilter(filteredInvoices.filter(i => i.status === "paid"), ["job.customer.name"]).map(inv => {
                  const job = jobs.find(j => j.id === inv.job_id);
                  const stylist = profiles.find(p => p.user_id === job?.assigned_to);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>{format(new Date(inv.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell className="font-medium">{inv.job?.customer?.name ?? "—"}</TableCell>
                      <TableCell className="capitalize">{job?.service_type ?? "—"}</TableCell>
                      <TableCell>{stylist?.full_name ?? "—"}</TableCell>
                      <TableCell className="capitalize">{inv.payment_method?.replace("_", " ") ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">£{Number(inv.total).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
                {filteredInvoices.filter(i => i.status === "paid").length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No report data available for the selected period.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Staff Performance */}
        <TabsContent value="staff" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => {
              const rows = [["Stylist", "Services Completed", "Revenue (£)", "Commission (£)"]];
              staffMetrics.forEach(s => rows.push([s.name, String(s.servicesCompleted), s.revenue.toFixed(2), s.commission.toFixed(2)]));
              exportCSV(rows, "staff-performance.csv");
            }}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stylist</TableHead>
                  <TableHead className="text-right">Services Completed</TableHead>
                  <TableHead className="text-right">Revenue (£)</TableHead>
                  <TableHead className="text-right">Commission (£)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffMetrics.map(s => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">{s.servicesCompleted}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">£{s.revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">£{s.commission.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {staffMetrics.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No report data available for the selected period.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Service Trends */}
        <TabsContent value="trends" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => {
              const rows = [["Service Category", "Volume", "Revenue (£)", "% of Total"]];
              serviceTrends.forEach(s => rows.push([s.name, String(s.volume), s.revenue.toFixed(2), s.percentage.toFixed(1)]));
              exportCSV(rows, "service-trends.csv");
            }}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service Category</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Revenue (£)</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceTrends.map(s => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium capitalize">{s.name}</TableCell>
                    <TableCell className="text-right">{s.volume}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">£{s.revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{s.percentage.toFixed(1)}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {serviceTrends.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No report data available for the selected period.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Client Retention */}
        <TabsContent value="retention" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <span className="text-sm text-muted-foreground">Active Clients</span>
              <div className="text-2xl font-bold text-primary">{clientRetention.totalClients}</div>
            </Card>
            <Card className="p-4">
              <span className="text-sm text-muted-foreground">Returning Clients</span>
              <div className="text-2xl font-bold text-primary">{clientRetention.returningClients}</div>
            </Card>
            <Card className="p-4">
              <span className="text-sm text-muted-foreground">New Clients</span>
              <div className="text-2xl font-bold text-primary">{clientRetention.newClients}</div>
            </Card>
            <Card className="p-4">
              <span className="text-sm text-muted-foreground">Retention Rate</span>
              <div className="text-2xl font-bold text-primary">{clientRetention.retentionRate.toFixed(1)}%</div>
            </Card>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => {
              const rows = [["Metric", "Value"]];
              rows.push(["Active Clients", String(clientRetention.totalClients)]);
              rows.push(["Returning Clients", String(clientRetention.returningClients)]);
              rows.push(["New Clients", String(clientRetention.newClients)]);
              rows.push(["Retention Rate", clientRetention.retentionRate.toFixed(1) + "%"]);
              exportCSV(rows, "client-retention.csv");
            }}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
