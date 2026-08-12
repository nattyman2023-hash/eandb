import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Receipt, Plus, Pencil, Trash2, Download, ExternalLink } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { Profile } from "@/types/database";

interface Expense {
  id: string;
  employee_id: string;
  description: string;
  amount: number;
  category: string;
  receipt_path: string | null;
  date: string;
  created_at: string;
}

const CATEGORIES = ["fuel", "parts", "tools", "equipment", "travel", "other"];

const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ employee_id: "", description: "", amount: "", category: "other", date: format(new Date(), "yyyy-MM-dd") });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({ description: "", amount: "", category: "other", date: "" });

  const fetchData = async () => {
    const [expRes, empRes] = await Promise.all([
      api.from("expenses").select("*").gte("date", from).lte("date", to).order("date", { ascending: false }),
      api.from("profiles").select("*").eq("is_active", true).order("full_name"),
    ]);
    setExpenses((expRes.data as unknown as Expense[]) ?? []);
    setEmployees((empRes.data as unknown as Profile[]) ?? []);
  };

  useEffect(() => { fetchData(); }, [from, to]);

  const filteredExpenses = expenses.filter(e => {
    if (filterEmployee !== "all" && e.employee_id !== filterEmployee) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    return true;
  });

  const totalAmount = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.user_id === id);
    return emp?.full_name || emp?.email || "Unknown";
  };

  const openReceipt = async (path: string) => {
    const { data, error } = await api.storage.from("expense-receipts").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Could not open receipt"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleAdd = async () => {
    const amount = parseFloat(addForm.amount);
    if (!addForm.employee_id || !addForm.description || !amount || amount <= 0) return;
    setAddLoading(true);

    let receiptPath: string | null = null;
    if (receiptFile) {
      const path = `${addForm.employee_id}/${Date.now()}-${receiptFile.name}`;
      const { error: upErr } = await api.storage.from("expense-receipts").upload(path, receiptFile);
      if (upErr) { toast.error("Receipt upload failed: " + upErr.message); setAddLoading(false); return; }
      receiptPath = path;
    }

    const { error } = await api.from("expenses").insert({
      employee_id: addForm.employee_id,
      description: addForm.description,
      amount,
      category: addForm.category,
      date: addForm.date,
      receipt_path: receiptPath,
    });
    setAddLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Expense recorded");
    setAddOpen(false);
    setAddForm({ employee_id: "", description: "", amount: "", category: "other", date: format(new Date(), "yyyy-MM-dd") });
    setReceiptFile(null);
    fetchData();
  };

  const handleEdit = async () => {
    if (!editExpense) return;
    const amount = parseFloat(editForm.amount);
    const { error } = await api.from("expenses").update({
      description: editForm.description, amount,
      category: editForm.category, date: editForm.date,
    }).eq("id", editExpense.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Expense updated"); setEditExpense(null); fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await api.from("expenses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast.success("Expense deleted"); fetchData();
  };

  const exportCSV = () => {
    const rows = [["Date", "Employee", "Category", "Description", "Amount"]];
    filteredExpenses.forEach(e => {
      rows.push([e.date, getEmployeeName(e.employee_id), e.category, e.description, Number(e.amount).toFixed(2)]);
    });
    rows.push(["", "", "", "TOTAL", totalAmount.toFixed(2)]);
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `expenses-${from}-to-${to}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6" /> Expenses</h1>
          <p className="text-muted-foreground">{filteredExpenses.length} entries · Total: £{totalAmount.toFixed(2)}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Record Expense</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={addForm.employee_id} onValueChange={(v) => setAddForm(p => ({ ...p, employee_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{employees.map(e => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name || e.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={addForm.description} onChange={(e) => setAddForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Amount (£)</Label><Input type="number" step="0.01" min="0" value={addForm.amount} onChange={(e) => setAddForm(p => ({ ...p, amount: e.target.value }))} /></div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={addForm.category} onValueChange={(v) => setAddForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Date</Label><Input type="date" value={addForm.date} onChange={(e) => setAddForm(p => ({ ...p, date: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>Receipt (optional)</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                </div>
                <Button onClick={handleAdd} className="w-full" disabled={!addForm.employee_id || !addForm.description || !addForm.amount || addLoading}>
                  {addLoading ? "Saving…" : "Record Expense"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="space-y-1">
          <Label>Employee</Label>
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(e => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name || e.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.map(exp => (
              <TableRow key={exp.id}>
                <TableCell>{format(new Date(exp.date), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-medium">{getEmployeeName(exp.employee_id)}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{exp.category}</Badge></TableCell>
                <TableCell>{exp.description}</TableCell>
                <TableCell className="font-bold">£{Number(exp.amount).toFixed(2)}</TableCell>
                <TableCell>
                  {exp.receipt_path ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openReceipt(exp.receipt_path)}>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      setEditForm({ description: exp.description, amount: String(exp.amount), category: exp.category, date: exp.date });
                      setEditExpense(exp);
                    }}><Pencil className="h-3 w-3" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove this expense record.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(exp.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredExpenses.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No expenses found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editExpense} onOpenChange={(o) => !o && setEditExpense(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Description</Label><Textarea value={editForm.description} onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Amount (£)</Label><Input type="number" step="0.01" min="0" value={editForm.amount} onChange={(e) => setEditForm(p => ({ ...p, amount: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={editForm.date} onChange={(e) => setEditForm(p => ({ ...p, date: e.target.value }))} /></div>
            <Button onClick={handleEdit} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
