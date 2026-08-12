import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Phone, MessageCircle, ArrowRight, Plus, GripVertical, Clock, Trash2, Save } from "lucide-react";
import { format } from "date-fns";
import type { Lead, LeadStatus, LeadInteraction, Quote } from "@/types/database";

const COLUMNS: { status: LeadStatus; label: string; color: string }[] = [
  { status: "New", label: "New", color: "bg-primary/10 border-primary/30" },
  { status: "Attempted Contact", label: "Attempted", color: "bg-secondary/10 border-secondary/30" },
  { status: "Quoted", label: "Quoted", color: "bg-accent/10 border-accent/30" },
  { status: "Nurturing", label: "Nurturing", color: "bg-muted border-border" },
  { status: "Lost", label: "Lost", color: "bg-destructive/10 border-destructive/30" },
  { status: "Converted", label: "Converted", color: "bg-accent/20 border-accent/40" },
];

const SOURCES = ["Web", "Google Ads", "Facebook", "Phone"] as const;
const PRIORITIES = ["High", "Medium", "Low"] as const;
const URGENT_KEYWORDS = ["urgent", "asap", "today", "wedding", "event"];

const VAT_RATE = 0.2;

function scoreLead(serviceRequested: string, source: string, email: string, phone: string) {
  let score = 30;
  let priority: "High" | "Medium" | "Low" = "Medium";
  const lower = serviceRequested.toLowerCase();
  const isUrgent = URGENT_KEYWORDS.some((k) => lower.includes(k));
  if (isUrgent) { score += 40; priority = "High"; }
  if (email) score += 10;
  if (phone) score += 10;
  if (source === "Phone") score += 10;
  else if (source === "Web") score += 5;
  return { ai_score: Math.min(score, 100), priority };
}

function notifyUrgent(name: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("🚨 Urgent Lead", { body: `${name} needs emergency help!` });
  } else if ("Notification" in window && Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") new Notification("🚨 Urgent Lead", { body: `${name} needs emergency help!` });
    });
  }
}

interface QuoteLineItem {
  description: string;
  category: "labor" | "parts";
  price: number;
}

const Leads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<LeadInteraction[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", email: "", service_requested: "", source: "Web" as string });

  // Editable lead fields
  const [editLead, setEditLead] = useState({ name: "", phone: "", email: "", service_requested: "", source: "" });
  const [leadDirty, setLeadDirty] = useState(false);

  // Quick Quote form state
  const [quoteItems, setQuoteItems] = useState<QuoteLineItem[]>([{ description: "", category: "labor", price: 0 }]);
  const [quoteValidDays, setQuoteValidDays] = useState(14);
  const [quoteLocationType, setQuoteLocationType] = useState<"mobile" | "garage">("garage");
  const [quoteEstimatedDate, setQuoteEstimatedDate] = useState("");
  const [quoteIncludeVat, setQuoteIncludeVat] = useState(false);

  const fetchLeads = async () => {
    const { data } = await api.from("leads").select("*").order("created_at", { ascending: false });
    setLeads((data as Lead[]) ?? []);
  };

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeadDetails = async (lead: Lead) => {
    setSelectedLead(lead);
    setEditLead({ name: lead.name, phone: lead.phone || "", email: lead.email || "", service_requested: lead.service_requested || "", source: lead.source });
    setLeadDirty(false);
    const [intRes, qRes] = await Promise.all([
      api.from("lead_interactions").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }),
      api.from("quotes").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }),
    ]);
    setInteractions((intRes.data as LeadInteraction[]) ?? []);
    setQuotes((qRes.data as Quote[]) ?? []);
  };

  const handleCreate = async () => {
    const { ai_score, priority } = scoreLead(form.service_requested, form.source, form.email, form.phone);
    const { error } = await api.from("leads").insert({ ...form, ai_score, priority });
    if (error) { toast.error("Failed to create lead"); return; }
    toast.success("Lead created!");
    if (priority === "High") notifyUrgent(form.name);
    setDialogOpen(false);
    setForm({ name: "", phone: "", email: "", service_requested: "", source: "Web" });
    fetchLeads();
  };

  const updateStatus = async (id: string, status: LeadStatus) => {
    await api.from("leads").update({ status }).eq("id", id);
    fetchLeads();
    if (selectedLead?.id === id) setSelectedLead({ ...selectedLead, status });
  };

  const addInteraction = async (type: string = "Note") => {
    if (!selectedLead || !newNote.trim()) return;
    await api.from("lead_interactions").insert({ lead_id: selectedLead.id, type, content: newNote });
    setNewNote("");
    fetchLeadDetails(selectedLead);
  };

  const saveLeadChanges = async () => {
    if (!selectedLead) return;
    const { error } = await api.from("leads").update({
      name: editLead.name,
      phone: editLead.phone,
      email: editLead.email,
      service_requested: editLead.service_requested,
      source: editLead.source,
    }).eq("id", selectedLead.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead updated");
    setLeadDirty(false);
    setSelectedLead({ ...selectedLead, ...editLead } as Lead);
    fetchLeads();
  };

  const updateEditLead = (field: string, value: string) => {
    setEditLead(prev => ({ ...prev, [field]: value }));
    setLeadDirty(true);
  };

  const convertToJob = async () => {
    if (!selectedLead) return;
    const { data: customer, error: custErr } = await api
      .from("customers")
      .insert({ name: selectedLead.name, phone: selectedLead.phone, email: selectedLead.email })
      .select("id").single();
    if (custErr) { toast.error("Failed to create customer"); return; }

    await api.from("jobs").insert({
      customer_id: customer.id,
      notes: selectedLead.service_requested,
      source: `Lead - ${selectedLead.source}`,
    });

    await updateStatus(selectedLead.id, "Converted");
    toast.success("Lead converted to job!");
    setSelectedLead(null);
  };

  const handleDeleteQuote = async () => {
    if (!deleteQuoteId) return;
    await api.from("quote_items").delete().eq("quote_id", deleteQuoteId);
    const { error } = await api.from("quotes").delete().eq("id", deleteQuoteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Quote deleted");
    setDeleteQuoteId(null);
    if (selectedLead) fetchLeadDetails(selectedLead);
  };

  // Quick Quote
  const addQuoteRow = () => setQuoteItems([...quoteItems, { description: "", category: "labor", price: 0 }]);
  const removeQuoteRow = (idx: number) => setQuoteItems(quoteItems.filter((_, i) => i !== idx));
  const updateQuoteRow = (idx: number, field: keyof QuoteLineItem, value: any) => {
    const updated = [...quoteItems];
    (updated[idx] as any)[field] = value;
    setQuoteItems(updated);
  };

  const quoteSubtotal = quoteItems.reduce((sum, item) => sum + item.price, 0);
  const quoteVat = quoteIncludeVat ? quoteSubtotal * VAT_RATE : 0;
  const quoteTotal = quoteSubtotal + quoteVat;
  const quoteLaborTotal = quoteItems.filter(i => i.category === "labor").reduce((s, i) => s + i.price, 0);
  const quotePartsTotal = quoteItems.filter(i => i.category === "parts").reduce((s, i) => s + i.price, 0);

  const generateQuote = async () => {
    if (!selectedLead) return;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + quoteValidDays);

    const { data: quoteData, error } = await api.from("quotes").insert({
      lead_id: selectedLead.id,
      estimated_price: quoteTotal,
      parts_cost_estimate: quotePartsTotal,
      labor_estimate: quoteLaborTotal,
      valid_until: validUntil.toISOString().split("T")[0],
      location_type: quoteLocationType,
      estimated_date: quoteEstimatedDate || null,
    }).select("id").single();

    if (error || !quoteData) { toast.error("Failed to create quote"); return; }

    const itemInserts = quoteItems
      .filter(i => i.description.trim() && i.price > 0)
      .map(i => ({ quote_id: quoteData.id, description: i.description, category: i.category, price: i.price }));

    if (itemInserts.length > 0) {
      await api.from("quote_items").insert(itemInserts);
    }

    await updateStatus(selectedLead.id, "Quoted");
    toast.success("Quote created!");
    setQuoteDialogOpen(false);
    setQuoteItems([{ description: "", category: "labor", price: 0 }]);
    setQuoteIncludeVat(false);
    setQuoteEstimatedDate("");
    setQuoteLocationType("garage");
    fetchLeadDetails(selectedLead);
  };

  const filteredLeads = leads.filter((l) => {
    if (filterSource !== "all" && l.source !== filterSource) return false;
    if (filterPriority !== "all" && l.priority !== filterPriority) return false;
    return true;
  });

  const priorityColor = (p: string) => {
    if (p === "High") return "bg-destructive/20 text-slate-900 dark:text-white";
    if (p === "Medium") return "bg-secondary/20 text-slate-900 dark:text-white";
    return "bg-muted text-slate-700 dark:text-gray-300";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead Pipeline</h1>
          <p className="text-muted-foreground">{leads.length} total leads</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><Label>Service Requested</Label><Textarea value={form.service_requested} onChange={(e) => setForm({ ...form, service_requested: e.target.value })} /></div>
              <div>
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={!form.name.trim()} className="w-full">Create Lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {COLUMNS.map((col) => {
          const colLeads = filteredLeads.filter((l) => l.status === col.status);
          return (
            <div
              key={col.status}
              className={`rounded-lg border-2 p-3 min-h-[300px] ${col.color} transition-colors`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (draggedId) updateStatus(draggedId, col.status); setDraggedId(null); }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <Badge variant="secondary" className="text-xs">{colLeads.length}</Badge>
              </div>
              <div className="space-y-2">
                {colLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    draggable
                    onDragStart={() => setDraggedId(lead.id)}
                    onClick={() => fetchLeadDetails(lead)}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{lead.name}</p>
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </div>
                      
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge className={`text-[10px] ${priorityColor(lead.priority)}`}>{lead.priority}</Badge>
                        <Badge variant="outline" className="text-[10px]">{lead.source}</Badge>
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-slate-900 dark:text-white">Score: {lead.ai_score}</Badge>
                      </div>
                      {lead.service_requested && <p className="text-xs text-muted-foreground line-clamp-2">{lead.service_requested}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lead Detail Sidebar — now editable */}
      <Sheet open={!!selectedLead} onOpenChange={(open) => { if (!open) setSelectedLead(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedLead.name}</SheetTitle>
              </SheetHeader>

              <div className="space-y-4 mt-4">
                {/* Editable Lead Fields */}
                <div className="space-y-3">
                  <div><Label className="font-bold">Name</Label><Input value={editLead.name} onChange={(e) => updateEditLead("name", e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="font-bold">Phone</Label><Input value={editLead.phone} onChange={(e) => updateEditLead("phone", e.target.value)} /></div>
                    <div><Label className="font-bold">Email</Label><Input value={editLead.email} onChange={(e) => updateEditLead("email", e.target.value)} /></div>
                  </div>
                  
                  <div><Label className="font-bold">Service Requested</Label><Textarea value={editLead.service_requested} onChange={(e) => updateEditLead("service_requested", e.target.value)} rows={2} /></div>
                  <div>
                    <Label className="font-bold">Source</Label>
                    <Select value={editLead.source} onValueChange={(v) => updateEditLead("source", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {leadDirty && (
                    <Button onClick={saveLeadChanges} className="w-full gap-2">
                      <Save className="h-4 w-4" /> Save Changes
                    </Button>
                  )}
                </div>

                <div className="flex gap-2 text-sm">
                  <div><span className="text-muted-foreground">Priority:</span> <Badge className={priorityColor(selectedLead.priority)}>{selectedLead.priority}</Badge></div>
                  <div><span className="text-muted-foreground">Score:</span> {selectedLead.ai_score}/100</div>
                </div>

                <Separator />

                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-2">
                  {selectedLead.phone && (
                    <a href={`tel:${selectedLead.phone}`}>
                      <Button variant="outline" size="sm" className="w-full gap-1"><Phone className="h-3.5 w-3.5" /> Call</Button>
                    </a>
                  )}
                  {selectedLead.phone && (
                    <a href={`https://wa.me/${selectedLead.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="w-full gap-1"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button>
                    </a>
                  )}
                  <Button variant="default" size="sm" className="gap-1" onClick={convertToJob}>
                    <ArrowRight className="h-3.5 w-3.5" /> Convert
                  </Button>
                </div>

                <Button variant="secondary" size="sm" className="w-full" onClick={() => setQuoteDialogOpen(true)}>
                  Quick Quote
                </Button>

                <Separator />

                {/* Quotes with delete */}
                {quotes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Quotes</h4>
                    {quotes.map((q) => (
                      <Card key={q.id}>
                        <CardContent className="p-3 text-sm space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">£{Number(q.estimated_price).toFixed(2)}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline">{q.status}</Badge>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteQuoteId(q.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Parts: £{Number(q.parts_cost_estimate).toFixed(2)} · Labour: £{Number(q.labor_estimate).toFixed(2)}
                          </div>
                          {q.valid_until && <div className="text-xs text-muted-foreground">Valid until: {q.valid_until}</div>}
                          <div className="text-xs text-muted-foreground">
                            Share: <code className="bg-muted px-1 rounded">{window.location.origin}/quote/{q.id}</code>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Add Note */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Add Note</h4>
                  <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} placeholder="Type a note..." />
                  <Button size="sm" onClick={() => addInteraction("Note")} disabled={!newNote.trim()}>Add Note</Button>
                </div>

                {/* Timeline */}
                {interactions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">History</h4>
                    {interactions.map((i) => (
                      <div key={i.id} className="flex gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <span className="font-medium">{i.type}</span>
                          <span className="text-muted-foreground"> · {format(new Date(i.created_at), "dd MMM HH:mm")}</span>
                          <p className="text-muted-foreground">{i.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Quote Confirmation */}
      <AlertDialog open={!!deleteQuoteId} onOpenChange={(o) => !o && setDeleteQuoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this quote and its line items.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuote} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Quote Dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Quick Quote</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Customer</h4>
              <div>
                <Label>Customer Name</Label>
                <Input value={selectedLead?.name || ""} readOnly className="bg-muted" />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Work Items</h4>
              {quoteItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    {idx === 0 && <Label className="text-xs">Description</Label>}
                    <Input
                      placeholder="e.g. Front Brake Pads"
                      value={item.description}
                      onChange={(e) => updateQuoteRow(idx, "description", e.target.value)}
                    />
                  </div>
                  <div className="w-24">
                    {idx === 0 && <Label className="text-xs">Category</Label>}
                    <Select value={item.category} onValueChange={(v) => updateQuoteRow(idx, "category", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="labor">Labour</SelectItem>
                        <SelectItem value="parts">Parts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    {idx === 0 && <Label className="text-xs">Total Price (£)</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      value={item.price || ""}
                      onChange={(e) => updateQuoteRow(idx, "price", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {quoteItems.length > 1 && (
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeQuoteRow(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addQuoteRow} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Row
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Logistics</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Estimated Date</Label>
                  <Input type="date" value={quoteEstimatedDate} onChange={(e) => setQuoteEstimatedDate(e.target.value)} />
                </div>
                <div>
                  <Label>Location Type</Label>
                  <Select value={quoteLocationType} onValueChange={(v: any) => setQuoteLocationType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile">Mobile</SelectItem>
                      <SelectItem value="garage">Garage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Valid for (days)</Label>
                <Input type="number" value={quoteValidDays} onChange={(e) => setQuoteValidDays(+e.target.value)} className="w-24" />
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={quoteIncludeVat} onCheckedChange={setQuoteIncludeVat} />
                  <Label className="text-sm">Include VAT (20%)</Label>
                </div>
              </div>
              <div className="text-sm space-y-1 text-right">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>£{quoteSubtotal.toFixed(2)}</span></div>
                {quoteIncludeVat && <div className="flex justify-between"><span className="text-muted-foreground">VAT (20%)</span><span>£{quoteVat.toFixed(2)}</span></div>}
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span>£{quoteTotal.toFixed(2)}</span></div>
              </div>
            </div>

            <Button onClick={generateQuote} className="w-full" disabled={quoteSubtotal === 0}>
              Create & Send Quote
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
