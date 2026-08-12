import React, { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

import { toast } from "sonner";
import { DollarSign, Download, Plus, ChevronDown, ChevronRight, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { format, startOfWeek, endOfWeek, differenceInSeconds, parseISO } from "date-fns";
import type { Profile, TimeEntry, Job } from "@/types/database";

function toTimestampTz(localDatetime: string): string {
  const d = new Date(localDatetime);
  if (isNaN(d.getTime())) return localDatetime;
  return d.toISOString();
}

const Payroll = () => {
  const [mechanics, setMechanics] = useState<Profile[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [jobs, setJobs] = useState<(Job & { pay_type?: string; pay_amount?: number | null })[]>([]);
  const [from, setFrom] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [expandedMechanic, setExpandedMechanic] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ mechanic_id: "", job_id: "none", start_time: "", end_time: "", notes: "" });
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editForm, setEditForm] = useState({ start_time: "", end_time: "", notes: "" });
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const fetchData = async () => {
    const [mechRes, entryRes, jobRes] = await Promise.all([
      api.from("profiles").select("*").eq("is_active", true).order("full_name"),
      api.from("time_entries").select("*").gte("start_time", `${from}T00:00:00`).lte("start_time", `${to}T23:59:59`),
      api.from("jobs").select("*, customer:customers(name)").order("created_at", { ascending: false }).limit(100),
    ]);
    if (mechRes.error) console.error("profiles fetch error:", mechRes.error);
    if (entryRes.error) console.error("time_entries fetch error:", entryRes.error);
    if (jobRes.error) console.error("jobs fetch error:", jobRes.error);
    setMechanics((mechRes.data as unknown as Profile[]) ?? []);
    setEntries((entryRes.data as unknown as TimeEntry[]) ?? []);
    setJobs((jobRes.data as any[]) ?? []);
  };

  useEffect(() => { fetchData(); }, [from, to]);

  const filteredEntries = entries.filter(e => showArchived ? e.archived : !e.archived);

  const getSummary = (mechanicId: string) => {
    const mechEntries = filteredEntries.filter(e => e.mechanic_id === mechanicId);
    const totalSeconds = mechEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0);
    return { entries: mechEntries.length, hours: totalSeconds / 3600, totalSeconds };
  };

  const getMechPay = (mechanic: Profile) => {
    const mechEntries = filteredEntries.filter(e => e.mechanic_id === mechanic.user_id);
    let total = 0;
    const timeByJob: Record<string, number> = {};
    mechEntries.forEach(e => {
      const key = e.job_id || "_manual_";
      timeByJob[key] = (timeByJob[key] || 0) + (e.duration_seconds || 0);
    });
    for (const [jobId, seconds] of Object.entries(timeByJob)) {
      const job = jobId !== "_manual_" ? jobs.find(j => j.id === jobId) : null;
      const hours = seconds / 3600;
      if (job?.pay_type === "fixed" && job?.pay_amount != null) {
        total += Number(job.pay_amount);
      } else if (job?.pay_type === "hourly" && job?.pay_amount != null) {
        total += hours * Number(job.pay_amount);
      } else {
        total += hours * Number(mechanic.pay_rate ?? 0);
      }
    }
    return total;
  };

  const getMechEntries = (mechanicId: string) => filteredEntries.filter(e => e.mechanic_id === mechanicId);

  const handleAddEntry = async () => {
    if (!addForm.mechanic_id || !addForm.start_time || !addForm.end_time) return;
    const start = parseISO(addForm.start_time);
    const end = parseISO(addForm.end_time);
    const duration = differenceInSeconds(end, start);
    if (duration <= 0) { toast.error("End time must be after start time"); return; }

    const jobId = addForm.job_id === "none" || addForm.job_id === "" ? null : addForm.job_id;

    const { data, error } = await api.from("time_entries").insert({
      mechanic_id: addForm.mechanic_id,
      job_id: jobId,
      start_time: toTimestampTz(addForm.start_time),
      end_time: toTimestampTz(addForm.end_time),
      duration_seconds: duration,
      notes: addForm.notes || null,
    }).select();

    if (error) { console.error("Insert error:", error); toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("Failed to add entry — check permissions"); return; }
    toast.success("Time entry added");
    setAddOpen(false);
    setAddForm({ mechanic_id: "", job_id: "none", start_time: "", end_time: "", notes: "" });
    fetchData();
  };

  const handleEditEntry = async () => {
    if (!editEntry || !editForm.start_time || !editForm.end_time) return;
    const start = parseISO(editForm.start_time);
    const end = parseISO(editForm.end_time);
    const duration = differenceInSeconds(end, start);
    if (duration <= 0) { toast.error("End time must be after start time"); return; }

    const { data, error } = await api.from("time_entries").update({
      start_time: toTimestampTz(editForm.start_time),
      end_time: toTimestampTz(editForm.end_time),
      duration_seconds: duration,
      notes: editForm.notes || null,
    }).eq("id", editEntry.id).select();

    if (error) { console.error("Update error:", error); toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("Failed to update — check permissions"); return; }
    toast.success("Time entry updated");
    setEditEntry(null);
    fetchData();
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryId) return;
    const { error } = await api.from("time_entries").delete().eq("id", deleteEntryId);
    if (error) { console.error("Delete error:", error); toast.error(error.message); return; }
    setEntries(prev => prev.filter(e => e.id !== deleteEntryId));
    toast.success("Time entry deleted"); setDeleteEntryId(null); fetchData();
  };

  const handleArchiveEntry = async (entryId: string, archive: boolean) => {
    const { error } = await api.from("time_entries").update({ archived: archive }).eq("id", entryId);
    if (error) { console.error("Archive error:", error); toast.error(error.message); return; }
    toast.success(archive ? "Entry archived" : "Entry restored");
    fetchData();
  };

  const openEditEntry = (entry: TimeEntry) => {
    setEditForm({
      start_time: entry.start_time.slice(0, 16), end_time: entry.end_time?.slice(0, 16) ?? "",
      notes: entry.notes ?? "",
    });
    setEditEntry(entry);
  };

  const exportCSV = () => {
    const rows = [["Name", "Email", "Hours", "Rate", "Total Pay"]];
    mechanics.forEach(m => {
      const s = getSummary(m.user_id);
      const pay = getMechPay(m);
      rows.push([m.full_name, m.email, s.hours.toFixed(2), String(m.pay_rate ?? 0), pay.toFixed(2)]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payroll-${from}-to-${to}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6" /> Payroll</h1>
          <p className="text-muted-foreground">Time tracking & manual entries</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Entry</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Time Entry</DialogTitle>
                <DialogDescription>Add a manual time entry for an employee. Job is optional.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={addForm.mechanic_id} onValueChange={(v) => setAddForm(p => ({ ...p, mechanic_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{mechanics.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Job (optional)</Label>
                  <Select value={addForm.job_id} onValueChange={(v) => setAddForm(p => ({ ...p, job_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No job (manual entry)</SelectItem>
                      {jobs.map(j => <SelectItem key={j.id} value={j.id}>{(j.customer as any)?.name} — {j.service_type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Start</Label><Input type="datetime-local" value={addForm.start_time} onChange={(e) => setAddForm(p => ({ ...p, start_time: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>End</Label><Input type="datetime-local" value={addForm.end_time} onChange={(e) => setAddForm(p => ({ ...p, end_time: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={addForm.notes} onChange={(e) => setAddForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
                <Button onClick={handleAddEntry} className="w-full" disabled={!addForm.mechanic_id || !addForm.start_time || !addForm.end_time}>Add Entry</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      <div className="flex gap-4 items-end">
        <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex items-center gap-2 pb-1">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" />
          <Label htmlFor="show-archived" className="text-sm">Show archived</Label>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Total Pay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mechanics.map(m => {
              const s = getSummary(m.user_id);
              const pay = getMechPay(m);
              const isExpanded = expandedMechanic === m.user_id;
              const mechEntries = getMechEntries(m.user_id);
              return (
                <React.Fragment key={m.id}>
                  <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedMechanic(isExpanded ? null : m.user_id)}>
                    <TableCell className="w-8">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                    <TableCell className="font-medium">{m.full_name || m.email}</TableCell>
                    <TableCell>{s.entries}</TableCell>
                    <TableCell>{s.hours.toFixed(2)}</TableCell>
                    <TableCell>£{Number(m.pay_rate ?? 0).toFixed(2)}/hr</TableCell>
                    <TableCell className="font-bold">£{pay.toFixed(2)}</TableCell>
                  </TableRow>
                  {isExpanded && (
                    <>
                      {mechEntries.map(entry => (
                        <TableRow key={entry.id} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{entry.notes || "—"}</TableCell>
                          <TableCell className="text-sm">{format(new Date(entry.start_time), "dd MMM HH:mm")}</TableCell>
                          <TableCell className="text-sm">{entry.end_time ? format(new Date(entry.end_time), "HH:mm") : "—"}</TableCell>
                          <TableCell className="text-sm">{((entry.duration_seconds || 0) / 3600).toFixed(2)}h</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditEntry(entry); }} title="Edit"><Pencil className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleArchiveEntry(entry.id, !entry.archived); }} title={entry.archived ? "Restore" : "Archive"}>
                                {entry.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleteEntryId(entry.id); }} title="Delete"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {mechEntries.length === 0 && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No entries for this period</TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </React.Fragment>
              );
            })}
            {mechanics.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No employees found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>Modify the start/end times and notes for this entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start</Label><Input type="datetime-local" value={editForm.start_time} onChange={(e) => setEditForm(p => ({ ...p, start_time: e.target.value }))} /></div>
              <div className="space-y-2"><Label>End</Label><Input type="datetime-local" value={editForm.end_time} onChange={(e) => setEditForm(p => ({ ...p, end_time: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={editForm.notes} onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={handleEditEntry} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Entry Confirmation */}
      <AlertDialog open={!!deleteEntryId} onOpenChange={(o) => !o && setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this time entry.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Payroll;
