import { useState, useEffect } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ShoppingBag, Package } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Product {
  id: string; name: string; description: string | null; price: number;
  compare_at_price: number | null; category: string; tags: string[];
  image_url: string | null; is_active: boolean; is_featured: boolean;
  stock_quantity: number; sku: string | null;
}

const CATEGORIES = ["Hair Care", "Wigs", "Tools", "Accessories"];

const empty = (): Partial<Product> => ({
  name: "", description: "", price: 0, compare_at_price: null, category: "Hair Care",
  tags: [], image_url: "", is_active: true, is_featured: false, stock_quantity: 0, sku: "",
});

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = () => {
    api.from("products").select("*").order("created_at", { ascending: false }).then(({ data }: any) => setProducts(data || []));
  };

  useEffect(load, []);

  const openNew = () => { setEditing(empty()); setTagsInput(""); };
  const openEdit = (p: Product) => { setEditing({ ...p }); setTagsInput(p.tags?.join(", ") || ""); };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    const path = `products/${Date.now()}-${file.name}`;
    const { error } = await api.storage.from("site-images").upload(path, file);
    if (error) { toast({ title: "Upload failed", variant: "destructive" }); setUploading(false); return; }
    const { data: { publicUrl } } = api.storage.from("site-images").getPublicUrl(path);
    setEditing({ ...editing, image_url: publicUrl });
    setUploading(false);
  };

  const save = async () => {
    if (!editing?.name) return;
    const payload = {
      name: editing.name, description: editing.description || null,
      price: Number(editing.price) || 0, compare_at_price: editing.compare_at_price ? Number(editing.compare_at_price) : null,
      category: editing.category || "Hair Care",
      tags: tagsInput.split(",").map(t => t.trim()).filter(Boolean),
      image_url: editing.image_url || null, is_active: editing.is_active ?? true,
      is_featured: editing.is_featured ?? false, stock_quantity: Number(editing.stock_quantity) || 0,
      sku: editing.sku || null,
    };

    if (editing.id) {
      await api.from("products").update(payload).eq("id", editing.id);
      toast({ title: "Product updated" });
    } else {
      await api.from("products").insert(payload);
      toast({ title: "Product created" });
    }
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await api.from("products").delete().eq("id", id);
    toast({ title: "Product deleted" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6" /> Products</h1>
          <p className="text-sm text-muted-foreground">{products.length} products</p>
        </div>
        <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> Add Product</Button>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Image</th>
              <th className="p-3">Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Status</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="p-3">
                  <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-full w-full p-2 text-muted-foreground/30" />}
                  </div>
                </td>
                <td className="p-3 font-medium">{p.name}{p.is_featured && <Badge className="ml-2 text-[10px]">Featured</Badge>}</td>
                <td className="p-3 text-muted-foreground">{p.category}</td>
                <td className="p-3">
                  £{p.price.toFixed(2)}
                  {p.compare_at_price && <span className="ml-1 text-xs text-muted-foreground line-through">£{p.compare_at_price.toFixed(2)}</span>}
                </td>
                <td className="p-3">{p.stock_quantity}</td>
                <td className="p-3"><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Draft"}</Badge></td>
                <td className="p-3 flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No products yet. Click "Add Product" to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Price (£)</Label><Input type="number" value={editing.price || ""} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div><Label>Compare-at Price</Label><Input type="number" value={editing.compare_at_price || ""} onChange={e => setEditing({ ...editing, compare_at_price: Number(e.target.value) || null })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={editing.category || "Hair Care"} onValueChange={v => setEditing({ ...editing, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>SKU</Label><Input value={editing.sku || ""} onChange={e => setEditing({ ...editing, sku: e.target.value })} /></div>
              </div>
              <div><Label>Stock Quantity</Label><Input type="number" value={editing.stock_quantity || 0} onChange={e => setEditing({ ...editing, stock_quantity: Number(e.target.value) })} /></div>
              <div><Label>Tags (comma-separated)</Label><Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="argan oil, biotin, shine" /></div>
              <div>
                <Label>Product Image</Label>
                {editing.image_url && <img src={editing.image_url} alt="" className="h-24 w-24 rounded-lg object-cover mb-2" />}
                <Input type="file" accept="image/*" onChange={handleImage} disabled={uploading} />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={v => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editing.is_featured ?? false} onCheckedChange={v => setEditing({ ...editing, is_featured: v })} /><Label>Featured</Label></div>
              </div>
              <Button className="w-full" onClick={save}>{editing.id ? "Save Changes" : "Create Product"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;
