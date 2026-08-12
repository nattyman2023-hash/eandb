import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Search, Trash2, Pencil, Sparkles } from "lucide-react";
import type { HairProfile, Customer } from "@/types/database";

const empty = { customer_id: "", preference: "", texture: "", goal: "" };

export default function HairProfiles() {
  const [rows, setRows] = useState<(HairProfile & { customer?: Customer })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HairProfile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [r, c] = await Promise.all([
      api.from("hair_profiles").select("*, customer:customers(name, phone, email)").order("created_at", { ascending: false }),
      api.from("customers").select("*").order("name"),
    ]);
    setRows((r.data as any) ?? []);
    setCustomers((c.data as Customer[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (editing) {
      const { error } = await api.from("hair_profiles").update(form).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Profile updated");
    } else {
      const { error } = await api.from("hair_profiles").insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success("Profile added");
    }
    setOpen(false); setEditing(null); setForm(empty); load();
  };

  const onEdit = (r: HairProfile) => {
    setEditing(r);
    setForm({ customer_id: r.customer_id, preference: r.preference || "", texture: r.texture || "", goal: r.goal || "" });
    setOpen(true);
  };
  const onDelete = async () => {
    if (!deleteId) return;
    const { error } = await api.from("hair_profiles").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); setDeleteId(null); load();
  };

  const filtered = rows.filter(r =>
    (r.preference || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.texture || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.goal || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.customer?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /> Hair Profiles</h1>
          <p className="text-muted-foreground text-sm">{rows.length} profile{rows.length === 1 ? "" : "s"} on file</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Profile</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Hair Profile</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm(p => ({ ...p, customer_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Preference</Label><Input placeholder="e.g. Natural, Relaxed" value={form.preference} onChange={(e) => setForm(p => ({ ...p, preference: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Texture</Label><Input placeholder="e.g. 4C, Wavy" value={form.texture} onChange={(e) => setForm(p => ({ ...p, texture: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Goal</Label><Input placeholder="e.g. Growth, Colour" value={form.goal} onChange={(e) => setForm(p => ({ ...p, goal: e.target.value }))} /></div>
              </div>
              <Button onClick={submit} className="w-full" disabled={!form.customer_id || !form.preference}>{editing ? "Save" : "Add"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by preference, texture, goal, or client…" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="atelier-card overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Client</TableHead><TableHead>Preference</TableHead><TableHead>Texture</TableHead><TableHead>Goal</TableHead><TableHead className="w-24" />
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.customer?.name ?? "—"}</TableCell>
                <TableCell className="font-medium">{r.preference || "—"}</TableCell>
                <TableCell>{r.texture || "—"}</TableCell>
                <TableCell>{r.goal || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hair profiles yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete profile?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
