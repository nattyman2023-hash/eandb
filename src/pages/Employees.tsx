import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Users, Edit, Plus, Trash2, Eye, CalendarOff, Check, X, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import type { Profile, LeaveRequest } from "@/types/database";

interface EmployeeProfile extends Profile {
  roles?: { role: string }[];
  jobCount?: number;
  completedJobCount?: number;
  totalHours?: number;
  totalEarnings?: number;
}

const Employees = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [editEmployee, setEditEmployee] = useState<EmployeeProfile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "", pay_rate: 0, is_active: true, skills: "" as string, postcode: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: "", email: "", phone: "", pay_rate: 0, role: "mechanic", skills: "", postcode: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  // Leave requests
  const [leaveRequests, setLeaveRequests] = useState<(LeaveRequest & { profile?: Profile })[]>([]);
  const [declineOpen, setDeclineOpen] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const fetchEmployees = async () => {
    let profilesQuery = api.from("profiles").select("*").order("full_name");
    if (!showInactive) profilesQuery = profilesQuery.eq("is_active", true);

    const [profilesRes, rolesRes, jobsRes, timeRes] = await Promise.all([
      profilesQuery,
      api.from("user_roles").select("*"),
      api.from("jobs").select("assigned_to, status"),
      api.from("time_entries").select("mechanic_id, duration_seconds"),
    ]);
    const profiles = (profilesRes.data as unknown as Profile[]) ?? [];
    const allRoles = (rolesRes.data as any[]) ?? [];
    const allJobs = (jobsRes.data ?? []) as any[];
    const allTime = (timeRes.data ?? []) as any[];

    const jobCounts: Record<string, number> = {};
    const completedCounts: Record<string, number> = {};
    allJobs.forEach((j: any) => {
      if (j.assigned_to) {
        jobCounts[j.assigned_to] = (jobCounts[j.assigned_to] || 0) + 1;
        if (j.status === "completed" || j.status === "paid") completedCounts[j.assigned_to] = (completedCounts[j.assigned_to] || 0) + 1;
      }
    });

    const hoursByUser: Record<string, number> = {};
    allTime.forEach((t: any) => {
      if (t.mechanic_id) hoursByUser[t.mechanic_id] = (hoursByUser[t.mechanic_id] || 0) + (t.duration_seconds || 0);
    });

    setEmployees(profiles.map(p => {
      const totalSeconds = hoursByUser[p.user_id] || 0;
      const totalHours = totalSeconds / 3600;
      return {
        ...p,
        roles: allRoles.filter(r => r.user_id === p.user_id).map(r => ({ role: r.role })),
        jobCount: jobCounts[p.user_id] || 0,
        completedJobCount: completedCounts[p.user_id] || 0,
        totalHours,
        totalEarnings: totalHours * Number(p.pay_rate || 0),
      };
    }));
  };

  const fetchLeaveRequests = async () => {
    const { data } = await api.from("leave_requests").select("*").order("created_at", { ascending: false });
    if (!data) return;
    // Enrich with profile names
    const staffIds = [...new Set((data as any[]).map(lr => lr.staff_id))];
    const { data: profiles } = await api.from("profiles").select("user_id, full_name, email").in("user_id", staffIds);
    const profileMap: Record<string, any> = {};
    (profiles ?? []).forEach((p: any) => { profileMap[p.user_id] = p; });
    setLeaveRequests((data as any[]).map(lr => ({ ...lr, profile: profileMap[lr.staff_id] })));
  };

  useEffect(() => { fetchEmployees(); fetchLeaveRequests(); }, [showInactive]);

  const openEdit = (emp: EmployeeProfile) => {
    setEditForm({ full_name: emp.full_name, email: emp.email, phone: emp.phone ?? "", pay_rate: emp.pay_rate ?? 0, is_active: emp.is_active ?? true, skills: ((emp as any).skills ?? []).join(", "), postcode: (emp as any).postcode ?? "" });
    setEditEmployee(emp);
  };

  const handleSave = async () => {
    if (!editEmployee) return;
    const { error } = await api.from("profiles").update({
      full_name: editForm.full_name, pay_rate: editForm.pay_rate, is_active: editForm.is_active, phone: editForm.phone,
      skills: editForm.skills.split(",").map((s: string) => s.trim()).filter(Boolean),
      postcode: editForm.postcode,
    }).eq("id", editEmployee.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Employee updated"); setEditEmployee(null); fetchEmployees();
  };

  const handleCreate = async () => {
    if (!createForm.full_name || !createForm.email) return;
    setCreateLoading(true);
    const { data, error } = await api.functions.invoke("invite-employee", {
      body: { email: createForm.email, full_name: createForm.full_name, phone: createForm.phone, pay_rate: createForm.pay_rate, role: createForm.role },
    });
    setCreateLoading(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Failed"); return; }
    toast.success("Employee created"); setCreateOpen(false);
    setCreateForm({ full_name: "", email: "", phone: "", pay_rate: 0, role: "mechanic", skills: "", postcode: "" });
    fetchEmployees();
  };

  const handleDelete = async () => {
    if (!deleteEmployeeId) return;
    const emp = employees.find(e => e.id === deleteEmployeeId);
    if (!emp) return;
    await api.from("profiles").update({ is_active: false }).eq("id", emp.id);
    await api.from("user_roles").delete().eq("user_id", emp.user_id);
    toast.success("Employee deactivated"); setDeleteEmployeeId(null); fetchEmployees();
  };

  const toggleRole = async (emp: EmployeeProfile, role: string) => {
    const hasRole = emp.roles?.some(r => r.role === role);
    if (hasRole) {
      await api.from("user_roles").delete().eq("user_id", emp.user_id).eq("role", role);
    } else {
      await api.from("user_roles").insert({ user_id: emp.user_id, role });
    }
    toast.success(`Role ${hasRole ? "removed" : "added"}`); fetchEmployees();
  };

  const viewPortal = (emp: EmployeeProfile) => {
    const isStaff = emp.roles?.some(r => r.role === "mechanic");
    if (isStaff) {
      // Open staff portal in new tab (ghost view not implemented for staff yet)
      toast.info("Staff portal preview coming soon");
    } else {
      // Find customer record by user_id
      api.from("customers").select("id").eq("user_id", emp.user_id).single().then(({ data }) => {
        if (data) {
          navigate(`/portal?preview=${data.id}`);
        } else {
          toast.error("No customer record linked");
        }
      });
    }
  };

  const handleLeaveAction = async (id: string, status: "approved" | "declined", reason?: string) => {
    const update: any = { status };
    if (reason) update.decline_reason = reason;
    const { error } = await api.from("leave_requests").update(update).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Request ${status}`);
    setDeclineOpen(null);
    setDeclineReason("");
    fetchLeaveRequests();
  };

  const pendingCount = leaveRequests.filter(lr => lr.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Staff Management</h1>
          <p className="text-muted-foreground">{employees.length} team members</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            <Label className="text-sm">Show inactive</Label>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New User</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Full Name</Label><Input value={createForm.full_name} onChange={(e) => setCreateForm(p => ({ ...p, full_name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={createForm.email} onChange={(e) => setCreateForm(p => ({ ...p, email: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={createForm.phone} onChange={(e) => setCreateForm(p => ({ ...p, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Pay Rate (£/hr)</Label><Input type="number" step="0.01" value={createForm.pay_rate} onChange={(e) => setCreateForm(p => ({ ...p, pay_rate: parseFloat(e.target.value) || 0 }))} /></div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={createForm.role} onValueChange={(v) => setCreateForm(p => ({ ...p, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="mechanic">Staff / Stylist</SelectItem>
                      <SelectItem value="customer">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!createForm.full_name || !createForm.email || createLoading}>
                  {createLoading ? "Creating…" : "Create User"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="leave" className="relative">
            Leave Requests
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Pay Rate</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Earnings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.full_name || "—"}</TableCell>
                    <TableCell className="text-sm">{emp.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {emp.roles?.map(r => (
                          <Badge key={r.role} variant="outline" className="text-xs capitalize">
                            {r.role === "mechanic" ? "Staff" : r.role === "super_admin" ? "Super Admin" : r.role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>£{Number(emp.pay_rate ?? 0).toFixed(2)}/hr</TableCell>
                    <TableCell>{emp.completedJobCount ?? 0}/{emp.jobCount ?? 0}</TableCell>
                    <TableCell>{(emp.totalHours ?? 0).toFixed(1)}</TableCell>
                    <TableCell className="font-semibold">£{(emp.totalEarnings ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={emp.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}>
                        {emp.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="View Portal" onClick={() => viewPortal(emp)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title="Send Staff Portal Invite" onClick={async () => {
                          if (!emp.email) { toast.error("No email on file"); return; }
                          const { data, error } = await api.functions.invoke("send-portal-invite", {
                            body: { email: emp.email, name: emp.full_name, portalKind: "staff", redirectTo: `${window.location.origin}/reset-password` },
                          });
                          if (error || data?.error) toast.error(data?.error || error?.message || "Failed");
                          else toast.success(`Staff portal invite sent to ${emp.email}`);
                        }}><Send className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/employees/${emp.id}`)}><Users className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteEmployeeId(emp.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          {leaveRequests.length === 0 ? (
            <Card><div className="p-8 text-center text-muted-foreground">No leave requests</div></Card>
          ) : (
            <div className="space-y-3">
              {leaveRequests.map(lr => (
                <Card key={lr.id}>
                  <div className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{lr.profile?.full_name ?? "Staff"}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(lr.start_date), "d MMM yyyy")} — {format(parseISO(lr.end_date), "d MMM yyyy")}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{lr.type}</Badge>
                        {lr.status === "approved" && <Badge className="bg-success/20 text-success text-xs">Approved</Badge>}
                        {lr.status === "declined" && <Badge className="bg-destructive/20 text-destructive text-xs">Declined</Badge>}
                        {lr.status === "pending" && <Badge variant="outline" className="text-xs">Pending</Badge>}
                      </div>
                      {lr.reason && <p className="text-sm mt-1">{lr.reason}</p>}
                      {lr.decline_reason && <p className="text-sm text-destructive">{lr.decline_reason}</p>}
                    </div>
                    {lr.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleLeaveAction(lr.id, "approved")}>
                          <Check className="mr-1 h-4 w-4" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeclineOpen(lr.id)}>
                          <X className="mr-1 h-4 w-4" /> Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editEmployee} onOpenChange={(o) => !o && setEditEmployee(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
          {editEmployee && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Full Name</Label><Input value={editForm.full_name} onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Pay Rate (£/hr)</Label><Input type="number" step="0.01" value={editForm.pay_rate} onChange={(e) => setEditForm(prev => ({ ...prev, pay_rate: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="space-y-2"><Label>Skills (comma-separated)</Label><Input value={editForm.skills} onChange={(e) => setEditForm(prev => ({ ...prev, skills: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Postcode</Label><Input value={editForm.postcode} onChange={(e) => setEditForm(prev => ({ ...prev, postcode: e.target.value }))} /></div>
              <div className="flex items-center gap-3">
                <Switch checked={editForm.is_active} onCheckedChange={(v) => setEditForm(prev => ({ ...prev, is_active: v }))} />
                <Label>Active</Label>
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="flex gap-2 flex-wrap">
                  {["super_admin", "admin", "mechanic", "customer"].map(role => (
                    <Button key={role} variant={editEmployee.roles?.some(r => r.role === role) ? "default" : "outline"} size="sm"
                      onClick={() => toggleRole(editEmployee, role)} className="capitalize text-xs">
                      {role === "mechanic" ? "Staff" : role === "super_admin" ? "Super Admin" : role}
                    </Button>
                  ))}
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEmployeeId} onOpenChange={(o) => !o && setDeleteEmployeeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Employee</AlertDialogTitle>
            <AlertDialogDescription>This will deactivate the employee and remove all their roles.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline Reason Dialog */}
      <Dialog open={!!declineOpen} onOpenChange={(o) => { if (!o) { setDeclineOpen(null); setDeclineReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Decline Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Reason for declining..." value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3} />
            <Button variant="destructive" onClick={() => declineOpen && handleLeaveAction(declineOpen, "declined", declineReason)} disabled={!declineReason.trim()} className="w-full">
              Confirm Decline
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
