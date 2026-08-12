import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, User, Pencil, Trash2, Scissors, MessageSquare, Eye, KeyRound, EyeIcon, EyeOff, Mail, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import type { Customer, Vehicle, Job, Message } from "@/types/database";

const emptyForm = { name: "", phone: "", email: "", address: "", postcode: "" };
const emptyHairProfileForm = { preference: "", texture: "", goal: "" };

const Customers = () => {
  const { hasRole } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  // Separate state for create and edit forms to prevent conflicts
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [custVehicles, setCustVehicles] = useState<Vehicle[]>([]);
  const [custJobs, setCustJobs] = useState<Job[]>([]);
  const [custMessages, setCustMessages] = useState<Message[]>([]);

  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(emptyHairProfileForm);
  // Password reset
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [inviteCooldownEnd, setInviteCooldownEnd] = useState(0);
  const [resetCooldownEnd, setResetCooldownEnd] = useState(0);
  const [, setTick] = useState(0);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const fetchCustomers = async () => {
    const { data } = await api.from("customers").select("*").order("name");
    setCustomers((data as unknown as Customer[]) ?? []);
  };

  useEffect(() => { fetchCustomers(); }, []);

  // Cooldown ticker
  useEffect(() => {
    const now = Date.now();
    if (inviteCooldownEnd > now || resetCooldownEnd > now) {
      const interval = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [inviteCooldownEnd, resetCooldownEnd]);

  const inviteSecondsLeft = Math.max(0, Math.ceil((inviteCooldownEnd - Date.now()) / 1000));
  const resetSecondsLeft = Math.max(0, Math.ceil((resetCooldownEnd - Date.now()) / 1000));

  const handleCreate = async () => {
    const { error } = await api.from("customers").insert(createForm);
    if (error) { toast.error(error.message); return; }
    toast.success("Customer created");
    setCreateOpen(false);
    setCreateForm(emptyForm);
    fetchCustomers();
  };

  const handleEdit = async () => {
    if (!editCustomer) return;
    const { error } = await api.from("customers").update(editForm).eq("id", editCustomer.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Customer updated");
    setEditCustomer(null);
    setEditForm(emptyForm);
    fetchCustomers();
    if (selected?.id === editCustomer.id) setSelected({ ...selected, ...editForm } as Customer);
  };

  const handleDelete = async () => {
    if (!deleteCustomerId) return;
    const { error } = await api.from("customers").delete().eq("id", deleteCustomerId);
    if (error) { toast.error(error.message); return; }
    setCustomers(prev => prev.filter(c => c.id !== deleteCustomerId));
    toast.success("Customer deleted");
    if (selected?.id === deleteCustomerId) setSelected(null);
    setDeleteCustomerId(null);
    fetchCustomers();
  };

  const openEdit = (c: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Close the sheet first to avoid focus conflicts
    setSelected(null);
    setEditForm({ name: c.name, phone: c.phone || "", email: c.email || "", address: c.address || "", postcode: c.postcode || "" });
    // Small delay to let sheet close before opening dialog
    setTimeout(() => setEditCustomer(c), 100);
  };

  const openCustomer360 = async (c: Customer) => {
    setSelected(c);
    const [v, j, m] = await Promise.all([
      api.from("hair_profiles").select("*").eq("customer_id", c.id),
      api.from("jobs").select("*, hair_profile:hair_profiles(preference, texture, goal)").eq("customer_id", c.id).order("created_at", { ascending: false }),
      api.from("messages").select("*").eq("customer_id", c.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setCustVehicles((v.data as unknown as Vehicle[]) ?? []);
    setCustJobs((j.data as unknown as Job[]) ?? []);
    setCustMessages((m.data as unknown as Message[]) ?? []);
  };

  const handleAddVehicle = async () => {
    if (!selected) return;
    const { error } = await api.from("hair_profiles").insert({
      customer_id: selected.id,
      preference: vehicleForm.preference,
      texture: vehicleForm.texture,
      goal: vehicleForm.goal,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Hair profile added");
    setAddVehicleOpen(false);
    setVehicleForm(emptyHairProfileForm);
    const { data } = await api.from("hair_profiles").select("*").eq("customer_id", selected.id);
    setCustVehicles((data as unknown as Vehicle[]) ?? []);
  };

  const handleResetPassword = async () => {
    if (!selected?.user_id || !newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters"); return;
    }
    setResettingPassword(true);
    try {
      const session = (await api.auth.getSession()).data.session;
      const res = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: selected.user_id, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Password updated. You can now tell the customer their new login manually.");
      setResetPasswordOpen(false); setNewPassword(""); setShowPassword(false);
    } catch (err: any) { toast.error(err.message || "Failed to reset password"); }
    finally { setResettingPassword(false); }
  };

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">{customers.length} customers</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreateForm(emptyForm); }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={createForm.name} onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={createForm.phone} onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={createForm.email} onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Input value={createForm.address} onChange={(e) => setCreateForm(prev => ({ ...prev, address: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Postcode</Label><Input value={createForm.postcode} onChange={(e) => setCreateForm(prev => ({ ...prev, postcode: e.target.value }))} /></div>
              <Button onClick={handleCreate} className="w-full" disabled={!createForm.name}>Create Customer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => openCustomer360(c)}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.postcode}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={(e) => openEdit(c, e)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteCustomerId(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openCustomer360(c); }}><User className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Customer Dialog — uses separate editForm state */}
      <Dialog open={!!editCustomer} onOpenChange={(o) => { if (!o) { setEditCustomer(null); setEditForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Input value={editForm.address} onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Postcode</Label><Input value={editForm.postcode} onChange={(e) => setEditForm(prev => ({ ...prev, postcode: e.target.value }))} /></div>
            <Button onClick={handleEdit} className="w-full" disabled={!editForm.name}>Update Customer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCustomerId} onOpenChange={(o) => { if (!o) setDeleteCustomerId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this customer. Jobs and hair profiles linked to this customer may also be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer 360 Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  <span>{selected.name}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => window.open(`/portal?preview=${selected.id}`, "_blank")} title="View portal as this customer">
                      <Eye className="mr-1 h-3 w-3" /> Ghost View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(selected)}>
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Phone:</span> {selected.phone}</p>
                  <p><span className="text-muted-foreground">Email:</span> {selected.email}</p>
                  <p><span className="text-muted-foreground">Address:</span> {selected.address}{selected.postcode ? `, ${selected.postcode}` : ""}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Hair Profiles ({custVehicles.length})</h3>
                    <Dialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm"><Scissors className="mr-1 h-3 w-3" /> Add Profile</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Add Hair Profile for {selected.name}</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2"><Label>Preference</Label><Input value={vehicleForm.preference} onChange={(e) => setVehicleForm(prev => ({ ...prev, preference: e.target.value }))} placeholder="e.g. Natural, Relaxed" /></div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Texture</Label><Input value={vehicleForm.texture} onChange={(e) => setVehicleForm(prev => ({ ...prev, texture: e.target.value }))} placeholder="e.g. 4C, Wavy" /></div>
                            <div className="space-y-2"><Label>Goal</Label><Input value={vehicleForm.goal} onChange={(e) => setVehicleForm(prev => ({ ...prev, goal: e.target.value }))} placeholder="e.g. Growth, Colour" /></div>
                          </div>
                          <Button onClick={handleAddVehicle} className="w-full" disabled={!vehicleForm.preference}>Add Profile</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {custVehicles.map((v) => (
                    <div key={v.id} className="rounded-lg border p-3 mb-2">
                      <p className="font-medium">{v.preference}</p>
                      <p className="text-sm text-muted-foreground">{v.texture} {v.goal}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Appointment History ({custJobs.length})</h3>
                  {custJobs.map((j) => (
                    <div key={j.id} className="rounded-lg border p-3 mb-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{j.service_type}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{j.status.replace("_", " ")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(j.created_at), "dd MMM yyyy")}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Messages section */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Messages ({custMessages.length})
                  </h3>
                  {custMessages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet</p>}
                  {custMessages.map((m) => (
                    <div key={m.id} className={`rounded-lg border p-3 mb-2 ${m.direction === "outbound" ? "border-l-4 border-l-primary/50" : "border-l-4 border-l-accent/50"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">{m.direction === "inbound" ? "From customer" : "To customer"}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "dd MMM yyyy HH:mm")}</span>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))}

                  {/* Email composer */}
                  {selected.email ? (
                    <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Send email to {selected.name}</p>
                      <Input placeholder="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                      <Textarea placeholder="Write a message — it will be emailed and saved to this thread." rows={4} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
                      <Button
                        size="sm"
                        disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                        onClick={async () => {
                          if (!selected) return;
                          setSendingEmail(true);
                          try {
                            const { error: emailErr } = await api.functions.invoke("send-transactional-email", {
                              body: {
                                templateName: "admin-message",
                                recipientEmail: selected.email,
                                idempotencyKey: `admin-msg-${selected.id}-${Date.now()}`,
                                templateData: { name: selected.name, subject: emailSubject, body: emailBody },
                              },
                            });
                            if (emailErr) throw emailErr;
                            await api.from("messages").insert({
                              customer_id: selected.id,
                              direction: "outbound",
                              content: `Subject: ${emailSubject}\n\n${emailBody}`,
                            });
                            toast.success(`Email sent to ${selected.email}`);
                            setEmailSubject("");
                            setEmailBody("");
                            const { data } = await api.from("messages").select("*").eq("customer_id", selected.id).order("created_at", { ascending: false });
                            setCustMessages((data as Message[]) ?? []);
                          } catch (err: any) {
                            toast.error(err.message || "Failed to send email");
                          } finally {
                            setSendingEmail(false);
                          }
                        }}
                      >
                        <Send className="mr-1 h-3 w-3" /> {sendingEmail ? "Sending…" : "Send email"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Add an email to this customer to send messages.</p>
                  )}
                </div>

                {/* Account Security */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <KeyRound className="h-4 w-4" /> Account Security
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.email && (
                      <Button variant="outline" size="sm" disabled={sendingInvite || inviteSecondsLeft > 0} onClick={async () => {
                        setSendingInvite(true);
                        try {
                          const { data, error } = await api.functions.invoke("send-portal-invite", {
                            body: { email: selected.email, name: selected.name, portalKind: "client", redirectTo: `${window.location.origin}/reset-password` },
                          });
                          if (error || data?.error) throw new Error(data?.error || error?.message);
                          toast.success(`Portal invite sent to ${selected.email}`);
                          setInviteCooldownEnd(Date.now() + 60000);
                        } catch (err: any) { toast.error(err.message || "Failed to send invite"); }
                        finally { setSendingInvite(false); }
                      }}>
                        <Send className="mr-1 h-3 w-3" /> {sendingInvite ? "Sending…" : inviteSecondsLeft > 0 ? `Resend in ${inviteSecondsLeft}s` : "Send Portal Invite"}
                      </Button>
                    )}
                    {selected.email && (
                      <Button variant="outline" size="sm" disabled={sendingReset || resetSecondsLeft > 0} onClick={async () => {
                        setSendingReset(true);
                        try {
                          const { error } = await api.auth.resetPasswordForEmail(selected.email!, {
                            redirectTo: `${window.location.origin}/reset-password`,
                          });
                          if (error) throw error;
                          toast.success(`Reset link sent to ${selected.email}`);
                          setResetCooldownEnd(Date.now() + 60000);
                        } catch (err: any) { toast.error(err.message || "Failed to send reset"); }
                        finally { setSendingReset(false); }
                      }}>
                        <Mail className="mr-1 h-3 w-3" /> {sendingReset ? "Sending…" : resetSecondsLeft > 0 ? `Resend in ${resetSecondsLeft}s` : "Send Password Reset"}
                      </Button>
                    )}
                    {selected.user_id && hasRole('admin') && (
                      <Button variant="outline" size="sm" onClick={() => { setResetPasswordOpen(true); setNewPassword(""); setShowPassword(false); }}>
                        <KeyRound className="mr-1 h-3 w-3" /> Manual Password Override
                      </Button>
                    )}
                    {selected.email && !selected.user_id && (
                      <p className="text-xs text-muted-foreground">This customer has no portal account yet. Use "Send Portal Invite" to create one, then you can override their password.</p>
                    )}
                    {!selected.email && (
                      <p className="text-xs text-muted-foreground">Add an email to this customer to enable invite/reset features.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Password Reset Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={(o) => { if (!o) { setResetPasswordOpen(false); setNewPassword(""); setShowPassword(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password for {selected?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
                <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button onClick={handleResetPassword} className="w-full" disabled={!newPassword || newPassword.length < 6 || resettingPassword}>
              {resettingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
