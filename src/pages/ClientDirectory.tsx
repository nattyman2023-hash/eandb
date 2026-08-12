import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, Mail, Phone, CalendarDays, Scissors, Plus, LayoutGrid, List } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Client {
  id: string; name: string; email: string | null; phone: string | null;
  postcode: string | null; created_at: string; updated_at: string;
}

interface ClientJob {
  id: string; service_type: string; notes: string | null; status: string;
  scheduled_at: string | null; created_at: string;
}

const ClientDirectory = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientJobs, setClientJobs] = useState<ClientJob[]>([]);
  const [newThisMonth, setNewThisMonth] = useState(0);

  // Add Client dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phone: "", email: "", postcode: "" });

  const load = async () => {
    const { data } = await api.from("customers").select("*").order("name");
    const all = (data as Client[]) ?? [];
    setClients(all);
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    setNewThisMonth(all.filter(c => new Date(c.created_at) >= monthStart).length);
  };

  useEffect(() => { load(); }, []);

  const openProfile = async (client: Client) => {
    setSelectedClient(client);
    const { data } = await api.from("jobs").select("id, service_type, notes, status, scheduled_at, created_at").eq("customer_id", client.id).order("created_at", { ascending: false }).limit(20);
    setClientJobs((data as ClientJob[]) ?? []);
  };

  const handleAddClient = async () => {
    if (!addForm.name.trim()) { toast.error("Name is required"); return; }
    const { error } = await api.from("customers").insert({
      name: addForm.name, phone: addForm.phone || null, email: addForm.email || null, postcode: addForm.postcode || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Client added");
    setAddOpen(false);
    setAddForm({ name: "", phone: "", email: "", postcode: "" });
    load();
  };

  // Filter
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const filtered = clients.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.email?.toLowerCase().includes(search.toLowerCase())) return false;
    if (tab === "recent") return new Date(c.updated_at) >= weekAgo;
    return true;
  });

  const statusColors: Record<string, string> = {
    pending: "bg-accent/20 text-accent",
    confirmed: "bg-primary/20 text-primary",
    in_progress: "bg-primary/20 text-primary",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Clients</h1>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setAddForm({ name: "", phone: "", email: "", postcode: "" }); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Client</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="Full name" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="07..." /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Postcode</Label><Input value={addForm.postcode} onChange={e => setAddForm({ ...addForm, postcode: e.target.value })} placeholder="M14 4EP" /></div>
              <Button onClick={handleAddClient} className="w-full" disabled={!addForm.name.trim()}>Add Client</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
        <div className="atelier-card p-5">
          <span className="gilded-label">Total Members</span>
          <p className="text-3xl font-bold text-primary mt-2">{clients.length}</p>
        </div>
        <div className="atelier-card p-5">
          <span className="gilded-label">New This Month</span>
          <p className="text-3xl font-bold text-accent mt-2">{newThisMonth}</p>
        </div>
      </div>

      {/* Search + Filter + View toggle */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="pl-9" />
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All Clients</TabsTrigger>
            <TabsTrigger value="recent">Recently Active</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto inline-flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setView("cards")}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition ${view === "cards" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          ><LayoutGrid className="h-3.5 w-3.5" /> Cards</button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition ${view === "list" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          ><List className="h-3.5 w-3.5" /> List</button>
        </div>
      </div>

      {/* Client view */}
      {filtered.length === 0 ? (
        <div className="atelier-card p-16 text-center">
          <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No clients found</p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(client => (
            <div key={client.id} className="atelier-card p-5 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openProfile(client)}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{client.name}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {client.email && <p className="flex items-center gap-2 truncate"><Mail className="h-3 w-3 shrink-0" />{client.email}</p>}
                {client.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3 shrink-0" />{client.phone}</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Joined {format(new Date(client.created_at), "MMM yyyy")}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="atelier-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Postcode</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(client => (
                <TableRow key={client.id} className="cursor-pointer" onClick={() => openProfile(client)}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-muted-foreground">{client.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{client.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{client.postcode || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{format(new Date(client.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openProfile(client); }}>Open</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Client Profile Drawer */}
      <Sheet open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedClient && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                    {selectedClient.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <SheetTitle className="text-2xl">{selectedClient.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground">Member since {format(new Date(selectedClient.created_at), "MMMM yyyy")}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-6 mt-4">
                <div className="space-y-2">
                  <h4 className="gilded-label">Contact Details</h4>
                  {selectedClient.email && <p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-primary" />{selectedClient.email}</p>}
                  {selectedClient.phone && <p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-primary" />{selectedClient.phone}</p>}
                  {selectedClient.postcode && <p className="text-sm text-muted-foreground">{selectedClient.postcode}</p>}
                </div>

                <div className="space-y-3">
                  <h4 className="gilded-label">Service History ({clientJobs.length})</h4>
                  {clientJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No service history yet</p>
                  ) : (
                    clientJobs.map(job => (
                      <div key={job.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                        <div>
                          <p className="text-sm font-medium flex items-center gap-1"><Scissors className="h-3 w-3 text-primary" /> {job.notes || job.service_type}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(job.created_at), "dd MMM yyyy")}</p>
                        </div>
                        <Badge className={statusColors[job.status] ?? ""}>{job.status}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ClientDirectory;
