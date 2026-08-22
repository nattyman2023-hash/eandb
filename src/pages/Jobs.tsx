import { useEffect, useState, useRef, useMemo } from "react";
import { api } from "@/lib/apiClient";
import BoardHeader from "@/components/jobs/BoardHeader";
import AppointmentCard from "@/components/jobs/AppointmentCard";
import ColumnHeader from "@/components/jobs/ColumnHeader";
import NewRequestsStrip from "@/components/jobs/NewRequestsStrip";
import JobsFilterBar from "@/components/jobs/JobsFilterBar";
import JobAddonsList from "@/components/jobs/JobAddonsList";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Plus, MoreVertical, User, StickyNote, Trash2, Camera, Image, CalendarDays, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, isToday } from "date-fns";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useAuth } from "@/contexts/AuthContext";
import type { Job, JobStatus, Customer, Vehicle, Profile, JobNote, JobPhoto } from "@/types/database";

const COLUMNS: { status: JobStatus; label: string; color: string; accent: string }[] = [
  { status: "pending", label: "Booked", color: "border-t-orange-500", accent: "bg-orange-500" },
  { status: "confirmed", label: "Confirmed", color: "border-t-blue-500", accent: "bg-primary" },
  { status: "in_progress", label: "In-Chair", color: "border-t-green-500", accent: "bg-accent" },
  { status: "completed", label: "Checked Out", color: "border-t-gray-400", accent: "bg-muted-foreground" },
  { status: "paid", label: "Paid", color: "border-t-emerald-600", accent: "bg-success" },
];

const BOARD_COLUMNS = COLUMNS.filter(c => c.status !== "pending");

const SALON_ZONES = [
  { value: "garage", label: "Barbershop" },
  { value: "mobile", label: "Braiding Lounge" },
];

function DroppableColumn({ status, children }: { status: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`min-h-[200px] space-y-2 transition-colors rounded-lg p-1 ${isOver ? "bg-accent/30" : ""}`}>
      {children}
    </div>
  );
}

const Jobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mechanics, setMechanics] = useState<Profile[]>([]);
  const [chairs, setChairs] = useState<any[]>([]);
  const [serviceItems, setServiceItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [assignJob, setAssignJob] = useState<Job | null>(null);
  const [assignForm, setAssignForm] = useState({ mechanic_id: "", pay_type: "hourly", pay_amount: "" });
  const [jobNotes, setJobNotes] = useState<JobNote[]>([]);
  const [jobPhotos, setJobPhotos] = useState<JobPhoto[]>([]);
  const [newNote, setNewNote] = useState("");
  const [form, setForm] = useState({
    customer_id: "", hair_profile_id: "", type: "garage" as string, service_type: "service" as string,
    scheduled_at: "", notes: "", assigned_to: "", pay_type: "hourly", pay_amount: "",
    chair_id: "", service_catalog_id: "", allow_overlap: false,
  });

  // Smart customer search state
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [showNewClientFields, setShowNewClientFields] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", phone: "", email: "" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [viewTab, setViewTab] = useState<string>("board");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [stylistFilter, setStylistFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");

  const fetchJobs = async () => {
    const { data } = await api.from("jobs")
      .select("*, customer:customers(name, email, phone), hair_profile:hair_profiles(preference, texture, goal), service_catalog:service_catalog_id(name, duration_minutes, base_price)")
      .order("scheduled_at", { ascending: true });
    setJobs((data as unknown as Job[]) ?? []);
  };

  const fetchLookups = async () => {
    const [c, v, profilesRes, rolesRes, chairRes, svcRes] = await Promise.all([
      api.from("customers").select("*").order("name"),
      api.from("hair_profiles").select("*").order("texture"),
      api.from("profiles").select("*").eq("is_active", true).eq("bookable", true).order("full_name"),
      api.from("user_roles").select("user_id, role"),
      api.from("chairs").select("*").eq("is_active", true).order("name"),
      api.from("service_catalog").select("*").eq("is_active", true).order("name"),
    ]);
    setCustomers((c.data as unknown as Customer[]) ?? []);
    setVehicles((v.data as unknown as Vehicle[]) ?? []);
    const allProfiles = (profilesRes.data as unknown as Profile[]) ?? [];
    const allRoles = (rolesRes.data as any[]) ?? [];
    setMechanics(allProfiles.filter(p =>
      allRoles.some(r => r.user_id === p.user_id && (r.role === "mechanic" || r.role === "admin")) &&
      !allRoles.some(r => r.user_id === p.user_id && r.role === "super_admin")
    ));
    setChairs(chairRes.data ?? []);
    setServiceItems(svcRes.data ?? []);
  };

  useEffect(() => { fetchJobs(); fetchLookups(); }, []);

  // Realtime: keep board in sync when stylists move cards on other devices
  useEffect(() => {
    const ch = api
      .channel("jobs-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => fetchJobs())
      .subscribe();
    return () => { api.removeChannel(ch); };
  }, []);

  // KPIs for today
  const todayKpis = useMemo(() => {
    const today = new Date();
    const isToday = (iso: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d.toDateString() === today.toDateString();
    };
    const todays = jobs.filter(j => isToday(j.scheduled_at));
    const inChair = todays.filter(j => j.status === "in_progress").length;
    const unassigned = todays.filter(j => !j.assigned_to && j.status !== "paid" && j.status !== "completed").length;
    const takings = todays
      .filter(j => j.status === "paid")
      .reduce((sum, j: any) => sum + Number(j.service_catalog?.base_price ?? j.pay_amount ?? 0), 0);
    return { totalBooked: todays.length, inChair, unassigned, takings };
  }, [jobs]);

  const handleCreate = async () => {
    let custId = form.customer_id;

    // If new client, create first
    if (!custId && showNewClientFields && newClient.name.trim()) {
      const { data: newCust, error: custErr } = await api.from("customers").insert({
        name: newClient.name, phone: newClient.phone, email: newClient.email,
      }).select("id").single();
      if (custErr) { toast.error(custErr.message); return; }
      custId = newCust.id;
      fetchLookups();
    }

    if (!custId) { toast.error("Please select or add a client"); return; }

    const { error } = await api.from("jobs").insert({
      customer_id: custId, hair_profile_id: form.hair_profile_id || null, type: form.type,
      service_type: form.service_type, scheduled_at: form.scheduled_at || null, notes: form.notes,
      assigned_to: form.assigned_to || null, pay_type: form.pay_type,
      pay_amount: form.pay_amount ? parseFloat(form.pay_amount) : null,
      chair_id: form.chair_id || null,
      service_catalog_id: form.service_catalog_id || null,
      allow_overlap: form.allow_overlap,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Appointment booked"); setOpen(false);
    resetForm();
    fetchJobs();
  };

  const resetForm = () => {
    setForm({ customer_id: "", hair_profile_id: "", type: "garage", service_type: "service", scheduled_at: "", notes: "", assigned_to: "", pay_type: "hourly", pay_amount: "", chair_id: "", service_catalog_id: "", allow_overlap: false });
    setCustomerSearch(""); setShowNewClientFields(false); setNewClient({ name: "", phone: "", email: "" });
  };

  const handleEdit = async () => {
    if (!editJob) return;
    const { error } = await api.from("jobs").update({
      customer_id: form.customer_id, hair_profile_id: form.hair_profile_id || null, type: form.type,
      service_type: form.service_type, scheduled_at: form.scheduled_at || null, notes: form.notes,
      assigned_to: form.assigned_to || null, pay_type: form.pay_type,
      pay_amount: form.pay_amount ? parseFloat(form.pay_amount) : null,
      chair_id: form.chair_id || null,
    }).eq("id", editJob.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Appointment updated"); setEditJob(null); fetchJobs();
  };

  const handleDelete = async () => {
    if (!deleteJobId) return;
    const { error } = await api.from("jobs").delete().eq("id", deleteJobId);
    if (error) { toast.error(error.message); return; }
    setJobs(prev => prev.filter(j => j.id !== deleteJobId));
    toast.success("Appointment deleted"); setDeleteJobId(null); fetchJobs();
  };

  const updateStatus = async (id: string, status: JobStatus) => {
    const updates: any = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await api.from("jobs").update(updates).eq("id", id);
    if (error) { toast.error(error.message); return; }
    fetchJobs();
  };

  const openAssignDialog = (job: Job) => {
    setAssignForm({ mechanic_id: job.assigned_to || "", pay_type: (job as any).pay_type || "hourly", pay_amount: (job as any).pay_amount != null ? String((job as any).pay_amount) : "" });
    setAssignJob(job);
  };

  const handleAssignSave = async () => {
    if (!assignJob) return;
    const isUnassign = assignForm.mechanic_id === "none" || assignForm.mechanic_id === "";
    const { error } = await api.from("jobs").update({
      assigned_to: isUnassign ? null : assignForm.mechanic_id,
      pay_type: isUnassign ? "hourly" : assignForm.pay_type,
      pay_amount: isUnassign ? null : (assignForm.pay_amount ? parseFloat(assignForm.pay_amount) : null),
    }).eq("id", assignJob.id);
    if (error) { toast.error(error.message); return; }
    toast.success(isUnassign ? "Stylist unassigned" : "Assignment updated"); setAssignJob(null); fetchJobs();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const jobId = active.id as string;
    const newStatus = over.id as JobStatus;
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.status === newStatus) return;

    // Optimistic update
    const prev = jobs;
    setJobs(p => p.map(j => j.id === jobId ? { ...j, status: newStatus } : j));

    const updates: any = { status: newStatus };
    if (newStatus === "in_progress") updates.started_at = new Date().toISOString();
    if (newStatus === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await api.from("jobs").update(updates).eq("id", jobId);
    if (error) {
      setJobs(prev);
      toast.error(error.message);
    } else {
      toast.success(`Moved to ${newStatus.replace("_", " ")}`);
    }
  };

  const openDetail = async (job: Job) => {
    setDetailJob(job);
    const [notesRes, photosRes] = await Promise.all([
      api.from("job_notes").select("*").eq("job_id", job.id).order("created_at", { ascending: false }),
      api.from("job_photos").select("*").eq("job_id", job.id).order("created_at", { ascending: false }),
    ]);
    setJobNotes((notesRes.data as unknown as JobNote[]) ?? []);
    setJobPhotos((photosRes.data as unknown as JobPhoto[]) ?? []);
  };

  const addNote = async () => {
    if (!detailJob || !newNote.trim()) return;
    const { error } = await api.from("job_notes").insert({ job_id: detailJob.id, content: newNote });
    if (error) { toast.error(error.message); return; }
    setNewNote("");
    const { data } = await api.from("job_notes").select("*").eq("job_id", detailJob.id).order("created_at", { ascending: false });
    setJobNotes((data as unknown as JobNote[]) ?? []);
  };

  const uploadPhoto = async (file: File, photoType: string) => {
    if (!detailJob) return;
    const path = `${detailJob.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await api.storage.from("job-photos").upload(path, file);
    if (upErr) { toast.error(upErr.message); return; }
    await api.from("job_photos").insert({ job_id: detailJob.id, storage_path: path, photo_type: photoType, uploaded_by: user?.id });
    toast.success("Photo uploaded");
    const { data } = await api.from("job_photos").select("*").eq("job_id", detailJob.id).order("created_at", { ascending: false });
    setJobPhotos((data as unknown as JobPhoto[]) ?? []);
  };

  const togglePhotoVisibility = async (photo: JobPhoto) => {
    await api.from("job_photos").update({ visible_to_customer: !photo.visible_to_customer }).eq("id", photo.id);
    setJobPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, visible_to_customer: !p.visible_to_customer } : p));
  };

  const getPhotoUrl = (path: string) => {
    const { data } = api.storage.from("job-photos").getPublicUrl(path);
    return data?.publicUrl ?? "";
  };

  const openEditDialog = (job: Job) => {
    setForm({
      customer_id: job.customer_id, hair_profile_id: job.hair_profile_id || "", type: job.type, service_type: job.service_type,
      scheduled_at: job.scheduled_at ? job.scheduled_at.slice(0, 16) : "", notes: job.notes || "",
      assigned_to: job.assigned_to || "", pay_type: (job as any).pay_type || "hourly",
      pay_amount: (job as any).pay_amount != null ? String((job as any).pay_amount) : "",
      chair_id: (job as any).chair_id || "", service_catalog_id: (job as any).service_catalog_id || "", allow_overlap: !!(job as any).allow_overlap,
    });
    setCustomerSearch((job.customer as any)?.name || "");
    setEditJob(job);
  };

  const customerVehicles = vehicles.filter((v) => v.customer_id === form.customer_id);

  const getMechanicName = (userId: string | null) => {
    if (!userId) return null;
    const m = mechanics.find(p => p.user_id === userId);
    return m ? m.full_name || m.email : null;
  };

  const getSelectedMechanicRate = () => {
    if (!form.assigned_to) return null;
    const m = mechanics.find(p => p.user_id === form.assigned_to);
    return m ? Number(m.pay_rate ?? 0) : null;
  };

  const selectedService = serviceItems.find(s => s.id === form.service_catalog_id);
  const totalPrice = selectedService ? Number(selectedService.base_price) : 0;

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || "").includes(customerSearch)
  );

  const getZoneLabel = (type: string) => SALON_ZONES.find(z => z.value === type)?.label || type;

  const renderJobForm = (onSubmit: () => void, submitLabel: string) => {
    const mechRate = getSelectedMechanicRate();
    return (
      <div className="space-y-4">
        {/* Smart Customer Search */}
        <div className="space-y-2">
          <Label>Client</Label>
          <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                {form.customer_id ? customers.find(c => c.id === form.customer_id)?.name || "Select client" : "Search clients..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search by name or phone..." value={customerSearch} onValueChange={setCustomerSearch} />
                <CommandList>
                  <CommandEmpty>
                    <div className="p-2 text-center">
                      <p className="text-sm text-muted-foreground mb-2">No client found</p>
                      <Button size="sm" variant="outline" onClick={() => {
                        setNewClient({ ...newClient, name: customerSearch });
                        setShowNewClientFields(true);
                        setCustomerPopoverOpen(false);
                      }}>
                        <UserPlus className="mr-1 h-3 w-3" /> Add "{customerSearch}" as New Client
                      </Button>
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredCustomers.slice(0, 10).map(c => (
                      <CommandItem key={c.id} value={c.name} onSelect={() => {
                        setForm(prev => ({ ...prev, customer_id: c.id }));
                        setCustomerSearch(c.name);
                        setShowNewClientFields(false);
                        setCustomerPopoverOpen(false);
                      }}>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.phone || "No phone"}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Inline New Client Fields */}
        {showNewClientFields && (
          <div className="space-y-2 rounded-lg border border-dashed border-primary/30 p-3 bg-primary/5">
            <p className="text-xs font-semibold text-primary">New Client Details</p>
            <Input placeholder="Full Name" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} />
              <Input placeholder="Email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} />
            </div>
          </div>
        )}

        {customerVehicles.length > 0 && (
          <div className="space-y-2">
            <Label>Hair Profile</Label>
            <Select value={form.hair_profile_id} onValueChange={(v) => setForm(prev => ({ ...prev, hair_profile_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select hair profile" /></SelectTrigger>
              <SelectContent>{customerVehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.preference} — {v.texture} {v.goal}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Salon Zone</Label>
            <Select value={form.type} onValueChange={(v: any) => setForm(prev => ({ ...prev, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SALON_ZONES.map(z => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Service Type</Label>
            <Select value={form.service_type} onValueChange={(v: any) => setForm(prev => ({ ...prev, service_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Styling</SelectItem>
                <SelectItem value="repair">Treatment</SelectItem>
                <SelectItem value="diagnostics">Consultation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Service selection with duration and price */}
        <div className="space-y-2">
          <Label>Service</Label>
          <Select value={form.service_catalog_id} onValueChange={(v) => setForm(prev => ({ ...prev, service_catalog_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
            <SelectContent>
              {serviceItems.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name} — £{s.base_price}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedService && (
            <p className="text-xs text-muted-foreground">Duration: {selectedService.duration_minutes} mins · £{Number(selectedService.base_price).toFixed(2)}</p>
          )}
        </div>

        {/* Chair/Station */}
        {chairs.length > 0 && (
          <div className="space-y-2">
            <Label>Chair / Station</Label>
            <Select value={form.chair_id} onValueChange={(v) => setForm(prev => ({ ...prev, chair_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select station" /></SelectTrigger>
              <SelectContent>
                {chairs.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.zone})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Date & Time</Label>
          <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm(prev => ({ ...prev, scheduled_at: e.target.value }))} />
        </div>

        <div className="space-y-2">
          <Label>Assign Stylist</Label>
          <Select value={form.assigned_to} onValueChange={(v) => setForm(prev => ({ ...prev, assigned_to: v }))}>
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              {mechanics.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {form.assigned_to && (
          <div className="space-y-3 rounded-lg border p-3">
            <Label className="font-semibold">Pay for this appointment</Label>
            {mechRate !== null && <p className="text-xs text-muted-foreground">Default rate: £{mechRate.toFixed(2)}/hr</p>}
            <RadioGroup value={form.pay_type} onValueChange={(v) => setForm(prev => ({ ...prev, pay_type: v }))} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="hourly" id="pay-hourly" /><Label htmlFor="pay-hourly" className="text-sm">Hourly override</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="fixed" id="pay-fixed" /><Label htmlFor="pay-fixed" className="text-sm">Fixed fee</Label></div>
            </RadioGroup>
            <Input type="number" step="0.01" placeholder={form.pay_type === "hourly" ? "Custom £/hr (leave blank for default)" : "Fixed amount £"} value={form.pay_amount} onChange={(e) => setForm(prev => ({ ...prev, pay_amount: e.target.value }))} />
          </div>
        )}

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={3} />
        </div>

        {/* Admin: allow overlapping the same chair (squeeze-in) */}
        <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
          <div>
            <Label className="text-sm font-semibold">Allow overlapping booking</Label>
            <p className="text-[11px] text-muted-foreground">Use to squeeze-in a quick service that can run alongside or shortly after another on the same chair.</p>
          </div>
          <Switch checked={form.allow_overlap} onCheckedChange={(v) => setForm(prev => ({ ...prev, allow_overlap: v }))} />
        </div>

        {/* Total Price Preview */}
        {totalPrice > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-right">
            <p className="text-xs text-muted-foreground">Estimated Total</p>
            <p className="text-xl font-bold text-primary">£{totalPrice.toFixed(2)}</p>
          </div>
        )}

        <Button onClick={onSubmit} className="w-full" disabled={!form.customer_id && !showNewClientFields}>{submitLabel}</Button>
      </div>
    );
  };

  const weekStart = startOfWeek(calendarDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Apply search + filters. Today/Week ranges use local-day boundaries so timezone
  // drift around midnight UTC doesn't hide real bookings from the board.
  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const endWeek = new Date(startToday); endWeek.setDate(endWeek.getDate() + 7);
    return jobs.filter(j => {
      if (q) {
        const name = ((j.customer as any)?.name || "").toLowerCase();
        const preference = ((j.hair_profile as any)?.preference || "").toLowerCase();
        const notes = (j.notes || "").toLowerCase();
        if (!name.includes(q) && !preference.includes(q) && !notes.includes(q)) return false;
      }
      if (stylistFilter === "unassigned" && j.assigned_to) return false;
      if (stylistFilter !== "all" && stylistFilter !== "unassigned" && j.assigned_to !== stylistFilter) return false;
      // Date filter: skip pending (always shown via NewRequestsStrip) and never hide deposit-paid jobs from today
      if (dateFilter !== "all" && j.status !== "pending") {
        if (!j.scheduled_at) return false;
        const d = new Date(j.scheduled_at);
        if (dateFilter === "today") {
          if (d < startToday || d > endToday) return false;
        }
        if (dateFilter === "week") {
          if (d < startToday || d > endWeek) return false;
        }
      }
      return true;
    });
  }, [jobs, searchQuery, stylistFilter, dateFilter]);

  const unscheduledJobs = filteredJobs.filter(j => !j.scheduled_at);
  // Always show pending so newly-created public bookings are visible regardless of date filter
  const pendingJobs = jobs.filter(j => j.status === "pending");
  const getChairName = (id: string | null | undefined) =>
    id ? ((chairs.find((c: any) => c.id === id) as any)?.name ?? null) : null;

  return (
    <div className="space-y-6">
      <BoardHeader
        date={new Date()}
        totalBooked={todayKpis.totalBooked}
        inChair={todayKpis.inChair}
        takings={todayKpis.takings}
        unassigned={todayKpis.unassigned}
        onNew={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>New Appointment</DialogTitle></DialogHeader>{renderJobForm(handleCreate, "Confirm Booking")}</DialogContent>
      </Dialog>

      <Tabs value={viewTab} onValueChange={setViewTab}>
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="mr-1.5 h-4 w-4" /> Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="space-y-5">
          <JobsFilterBar
            query={searchQuery}
            setQuery={setSearchQuery}
            stylistFilter={stylistFilter}
            setStylistFilter={setStylistFilter}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            stylists={mechanics}
          />

          <NewRequestsStrip
            pending={pendingJobs as any}
            onConfirm={async (id) => {
              const { error } = await api.from("jobs").update({ status: "confirmed" }).eq("id", id);
              if (error) toast.error(error.message);
              else { toast.success("Booking confirmed"); fetchJobs(); }
            }}
            onAssign={(j) => openAssignDialog(j)}
            onOpen={(j) => openDetail(j)}
          />

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {BOARD_COLUMNS.map((col) => {
                const colJobs = filteredJobs.filter((j) => j.status === col.status);
                const revenue = colJobs.reduce(
                  (sum, j: any) => sum + Number(j.service_catalog?.base_price ?? 0),
                  0
                );
                return (
                  <div key={col.status} className="space-y-2.5">
                    <ColumnHeader
                      label={col.label}
                      count={colJobs.length}
                      revenue={revenue}
                      accentClass={col.accent}
                    />
                    <DroppableColumn status={col.status}>
                      {colJobs.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
                          <p className="text-xs text-muted-foreground">
                            {col.status === "in_progress" && "No clients in chair yet"}
                            {col.status === "confirmed" && "No upcoming bookings"}
                            {col.status === "completed" && "Nobody checked out"}
                            {col.status === "paid" && "No takings yet today"}
                          </p>
                        </div>
                      )}
                      {colJobs.map((job) => (
                        <AppointmentCard
                          key={job.id}
                          job={job as any}
                          status={col.status}
                          stylistName={getMechanicName(job.assigned_to)}
                          chairName={getChairName((job as any).chair_id)}
                          onRescheduled={fetchJobs}
                          onOpenDetail={() => openDetail(job)}
                          onAssign={() => openAssignDialog(job)}
                          onEdit={() => openEditDialog(job)}
                          onDelete={() => setDeleteJobId(job.id)}
                          onMove={(s) => updateStatus(job.id, s)}
                          statuses={COLUMNS.map(c => ({ status: c.status, label: c.label }))}
                          accentClass={col.accent}
                        />
                      ))}
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>
          </DndContext>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setCalendarDate(d => addDays(d, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date())}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => setCalendarDate(d => addDays(d, 7))}><ChevronRight className="h-4 w-4" /></Button>
            <span className="text-sm font-medium">{format(weekDays[0], "dd MMM")} — {format(weekDays[6], "dd MMM yyyy")}</span>
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
            {weekDays.map(day => {
              const dayJobs = jobs.filter(j => j.scheduled_at && isSameDay(new Date(j.scheduled_at), day));
              const today = isToday(day);
              return (
                <div key={day.toISOString()} className={`bg-card min-h-[160px] ${today ? "ring-2 ring-inset ring-primary/30" : ""}`}>
                  <div className={`px-2 py-1.5 text-center border-b ${today ? "bg-primary/10 font-semibold" : "bg-muted/30"}`}>
                    <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                    <p className={`text-sm ${today ? "text-primary" : ""}`}>{format(day, "d")}</p>
                  </div>
                  <div className="p-1 space-y-1">
                    {dayJobs.map(job => {
                      const colDef = COLUMNS.find(c => c.status === job.status);
                      return (
                        <div key={job.id} onClick={() => openDetail(job)}
                          className={`rounded p-1.5 text-xs cursor-pointer hover:opacity-80 transition-opacity border-l-2 bg-card shadow-sm ${colDef?.color.replace("border-t-", "border-l-") ?? ""}`}>
                          <p className="font-medium truncate">{(job.customer as any)?.name ?? "Unknown"}</p>
                          <p className="text-muted-foreground truncate">{job.scheduled_at ? format(new Date(job.scheduled_at), "HH:mm") : ""} · {job.service_type}</p>
                          {getMechanicName(job.assigned_to) && <p className="text-muted-foreground truncate">✂️ {getMechanicName(job.assigned_to)}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {unscheduledJobs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Unscheduled ({unscheduledJobs.length})</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {unscheduledJobs.map(job => (
                  <Card key={job.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(job)}>
                    <CardContent className="p-3 space-y-1">
                      <p className="font-medium text-sm">{(job.customer as any)?.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{job.service_type}</p>
                      <Badge variant="outline" className="text-xs capitalize">{job.status.replace("_", " ")}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editJob} onOpenChange={(o) => { if (!o) setEditJob(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Appointment</DialogTitle></DialogHeader>{renderJobForm(handleEdit, "Update Appointment")}</DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteJobId} onOpenChange={(o) => { if (!o) setDeleteJobId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Appointment</AlertDialogTitle><AlertDialogDescription>This will permanently delete this appointment and all associated notes.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!assignJob} onOpenChange={(o) => { if (!o) setAssignJob(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Stylist & Set Pay</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stylist</Label>
              <Select value={assignForm.mechanic_id} onValueChange={(v) => setAssignForm(p => ({ ...p, mechanic_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select stylist" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {mechanics.map(m => (<SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email} {m.pay_rate ? `(£${Number(m.pay_rate).toFixed(2)}/hr default)` : ""}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pay Type</Label>
              <RadioGroup value={assignForm.pay_type} onValueChange={(v) => setAssignForm(p => ({ ...p, pay_type: v }))} className="flex gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="hourly" id="assign-hourly" /><Label htmlFor="assign-hourly">Hourly override</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="fixed" id="assign-fixed" /><Label htmlFor="assign-fixed">Fixed fee</Label></div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>{assignForm.pay_type === "fixed" ? "Fixed Amount (£)" : "Hourly Rate Override (£)"}</Label>
              <Input type="number" step="0.01" placeholder={assignForm.pay_type === "fixed" ? "e.g. 150.00" : "Leave blank for default rate"} value={assignForm.pay_amount} onChange={(e) => setAssignForm(p => ({ ...p, pay_amount: e.target.value }))} />
            </div>
            <Button onClick={handleAssignSave} className="w-full">Save Assignment</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailJob} onOpenChange={(o) => { if (!o) setDetailJob(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailJob && (
            <>
              <DialogHeader><DialogTitle>Appointment Details</DialogTitle></DialogHeader>
              <Tabs defaultValue="details">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="notes">Notes ({jobNotes.length})</TabsTrigger>
                  <TabsTrigger value="photos">Photos ({jobPhotos.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Client:</span> {(detailJob.customer as any)?.name}</div>
                    <div><span className="text-muted-foreground">Hair Profile:</span> {detailJob.hair_profile ? `${(detailJob.hair_profile as any).preference}` : "—"}</div>
                    <div><span className="text-muted-foreground">Salon Zone:</span> {getZoneLabel(detailJob.type)}</div>
                    <div><span className="text-muted-foreground">Service:</span> <span className="capitalize">{detailJob.service_type}</span></div>
                    <div><span className="text-muted-foreground">Status:</span> <span className="capitalize">{COLUMNS.find(c => c.status === detailJob.status)?.label ?? detailJob.status}</span></div>
                    <div><span className="text-muted-foreground">Stylist:</span> {getMechanicName(detailJob.assigned_to) || "Unassigned"}</div>
                    {(detailJob as any).pay_amount != null && (
                      <div className="col-span-2"><span className="text-muted-foreground">Pay:</span> {(detailJob as any).pay_type === "fixed" ? `£${Number((detailJob as any).pay_amount).toFixed(2)} (fixed)` : `£${Number((detailJob as any).pay_amount).toFixed(2)}/hr (override)`}</div>
                    )}
                    {detailJob.scheduled_at && <div className="col-span-2"><span className="text-muted-foreground">Scheduled:</span> {format(new Date(detailJob.scheduled_at), "dd MMM yyyy HH:mm")}</div>}
                  </div>
                  {detailJob.notes && <div className="rounded-lg border p-3"><p className="text-sm">{detailJob.notes}</p></div>}
                  <JobAddonsList
                    jobId={detailJob.id}
                    basePrice={Number((detailJob as any).service_catalog?.base_price ?? 0) || undefined}
                    baseDuration={Number((detailJob as any).service_catalog?.duration_minutes ?? 0) || undefined}
                    baseName={(detailJob as any).service_catalog?.name}
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Label className="w-full text-sm font-semibold">Quick Status</Label>
                    {COLUMNS.map(c => (
                      <Button key={c.status} variant={detailJob.status === c.status ? "default" : "outline"} size="sm"
                        onClick={() => { updateStatus(detailJob.id, c.status); setDetailJob({ ...detailJob, status: c.status }); }}>
                        {c.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap pt-2 border-t">
                    <Label className="w-full text-sm font-semibold">Client communication</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const cust: any = detailJob.customer;
                        const email = cust?.email;
                        if (!email) { toast.error("No email on file for this client"); return; }
                        if (!detailJob.scheduled_at) { toast.error("Set a scheduled time first"); return; }
                        const reason = window.prompt("Optional note to include in the email:") ?? "";
                        const { error } = await api.functions.invoke("send-transactional-email", {
                          body: {
                            templateName: "booking-rescheduled",
                            recipientEmail: email,
                            idempotencyKey: `reschedule-${detailJob.id}-${Date.now()}`,
                            templateData: {
                              name: cust?.name,
                              serviceName: (detailJob as any).service_catalog?.name,
                              scheduledAt: new Date(detailJob.scheduled_at).toLocaleString("en-GB", {
                                weekday: "short", day: "numeric", month: "short",
                                hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
                              }),
                              reason,
                              manageUrl: `https://eandbhair.co.uk/portal/appointments`,
                            },
                          },
                        });
                        if (error) toast.error(error.message);
                        else toast.success("Reschedule email sent");
                      }}
                    >Send reschedule email</Button>
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(detailJob)}>
                      <StickyNote className="mr-1 h-3.5 w-3.5" /> Edit appointment
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAssignDialog(detailJob)}>
                      <User className="mr-1 h-3.5 w-3.5" /> Reassign stylist
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="space-y-4">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {jobNotes.map(n => (<div key={n.id} className="rounded border p-2 text-sm"><p>{n.content}</p><p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), "dd MMM yyyy HH:mm")}</p></div>))}
                    {jobNotes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet</p>}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Add a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
                    <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>Add</Button>
                  </div>
                </TabsContent>

                <TabsContent value="photos" className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    {["before", "after", "documentation"].map(type => (
                      <label key={type} className="inline-flex cursor-pointer">
                        <Button variant="outline" size="sm" asChild><span><Camera className="mr-1 h-4 w-4" /> {type}</span></Button>
                        <Input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], type)} />
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {jobPhotos.map(photo => (
                      <div key={photo.id} className="rounded-lg border overflow-hidden">
                        <img src={getPhotoUrl(photo.storage_path)} alt={photo.caption || "Photo"} className="w-full h-32 object-cover" />
                        <div className="p-2 space-y-1">
                          <Badge variant="outline" className="text-xs capitalize">{photo.photo_type}</Badge>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{format(new Date(photo.created_at), "dd MMM HH:mm")}</span>
                            <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">Visible</span><Switch checked={photo.visible_to_customer} onCheckedChange={() => togglePhotoVisibility(photo)} /></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {jobPhotos.length === 0 && <p className="text-sm text-muted-foreground">No photos yet</p>}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Jobs;
