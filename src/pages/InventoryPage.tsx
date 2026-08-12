import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Package, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";

interface InventoryItem {
  id: string; name: string; category: string; quantity: number; price: number;
  low_stock_threshold: number; image_path: string | null; created_at: string;
}

const InventoryPage = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ name: "", category: "", quantity: "", price: "", low_stock_threshold: "5" });
  const [addStockId, setAddStockId] = useState<string | null>(null);
  const [addQty, setAddQty] = useState("");

  const fetchItems = async () => {
    const { data } = await api.from("inventory").select("*").order("category, name");
    setItems((data as InventoryItem[]) ?? []);
  };
  useEffect(() => { fetchItems(); }, []);

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const lowStockCount = items.filter(i => i.quantity <= i.low_stock_threshold).length;

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const payload = {
      name: form.name, category: form.category || "general",
      quantity: Number(form.quantity) || 0, price: Number(form.price) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 5,
    };
    if (editItem) {
      await api.from("inventory").update(payload).eq("id", editItem.id);
    } else {
      await api.from("inventory").insert(payload);
    }
    setOpen(false); setEditItem(null); resetForm(); fetchItems();
    toast.success(editItem ? "Updated" : "Product added");
  };

  const resetForm = () => setForm({ name: "", category: "", quantity: "", price: "", low_stock_threshold: "5" });

  const handleAddStock = async () => {
    if (!addStockId || !addQty) return;
    const item = items.find(i => i.id === addStockId);
    if (!item) return;
    await api.from("inventory").update({ quantity: item.quantity + Number(addQty) }).eq("id", addStockId);
    setAddStockId(null); setAddQty("");
    fetchItems(); toast.success("Stock updated");
  };

  const handleDelete = async (id: string) => {
    await api.from("inventory").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Product removed");
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setForm({ name: item.name, category: item.category, quantity: String(item.quantity), price: String(item.price), low_stock_threshold: String(item.low_stock_threshold) });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground mt-1">{items.length} products{lowStockCount > 0 && ` · ${lowStockCount} low stock`}</p>
        </div>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditItem(null); resetForm(); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Product</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItem ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Hair Products" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
                <div><Label>Price (£)</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                <div><Label>Low Threshold</Label><Input type="number" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} className="w-full">{editItem ? "Update" : "Add Product"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="atelier-card p-16 text-center">
          <Package className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No products</h2>
          <p className="text-muted-foreground">Add products to track your inventory</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(item => {
            const isLow = item.quantity <= item.low_stock_threshold;
            return (
              <div key={item.id} className="atelier-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  {isLow && <Badge className="bg-destructive/10 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />Low Stock</Badge>}
                </div>
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.category}</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={`font-bold text-lg ${isLow ? "text-destructive" : "text-foreground"}`}>{item.quantity} units</span>
                  <span className="text-primary font-medium">£{item.price}</span>
                </div>
                <div className="flex gap-2">
                  {addStockId === item.id ? (
                    <div className="flex gap-1 flex-1">
                      <Input type="number" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="Qty" className="h-8" />
                      <Button size="sm" onClick={handleAddStock}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddStockId(null)}>✕</Button>
                    </div>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => { setAddStockId(item.id); setAddQty(""); }}>+ Add Stock</Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}>✕</Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
