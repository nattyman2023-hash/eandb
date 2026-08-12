import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Edit } from "lucide-react";
import type { ServiceCatalogItem } from "@/types/database";

const ServiceCatalog = () => {
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<ServiceCatalogItem | null>(null);
  const [form, setForm] = useState({ name: "", base_price: 0, estimated_hours: 1, category: "general" });

  const fetch = async () => {
    const { data } = await api.from("service_catalog").select("*").order("category").order("name");
    setItems((data as unknown as ServiceCatalogItem[]) ?? []);
  };

  useEffect(() => { fetch(); }, []);

  const handleSave = async () => {
    if (editItem) {
      const { error } = await api.from("service_catalog").update(form).eq("id", editItem.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Service updated");
    } else {
      const { error } = await api.from("service_catalog").insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success("Service added");
    }
    setOpen(false);
    setEditItem(null);
    setForm({ name: "", base_price: 0, estimated_hours: 1, category: "general" });
    fetch();
  };

  const handleDelete = async (id: string) => {
    const { error } = await api.from("service_catalog").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Service deleted");
    fetch();
  };

  const openEdit = (item: ServiceCatalogItem) => {
    setForm({ name: item.name, base_price: Number(item.base_price), estimated_hours: Number(item.estimated_hours), category: item.category });
    setEditItem(item);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Service Catalog</h1>
          <p className="text-muted-foreground">{items.length} services</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditItem(null); setForm({ name: "", base_price: 0, estimated_hours: 1, category: "general" }); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Service</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItem ? "Edit" : "Add"} Service</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Price (£)</Label>
                  <Input type="number" step="0.01" value={form.base_price} onChange={(e) => setForm(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Est. Hours</Label>
                  <Input type="number" step="0.5" value={form.estimated_hours} onChange={(e) => setForm(prev => ({ ...prev, estimated_hours: parseFloat(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Input value={form.category} onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))} />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full" disabled={!form.name}>{editItem ? "Update" : "Add"} Service</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Est. Hours</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="capitalize">{item.category}</TableCell>
                <TableCell>£{Number(item.base_price).toFixed(2)}</TableCell>
                <TableCell>{Number(item.estimated_hours).toFixed(1)}h</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default ServiceCatalog;
