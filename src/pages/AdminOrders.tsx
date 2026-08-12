import { useState, useEffect } from "react";
import { api } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Order {
  id: string; status: string; total: number; shipping_name: string | null;
  shipping_address: string | null; shipping_phone: string | null;
  created_at: string; notes: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800", paid: "bg-green-100 text-green-800",
  shipped: "bg-blue-100 text-blue-800", delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);

  const load = () => {
    api.from("orders").select("*").order("created_at", { ascending: false }).then(({ data }: any) => setOrders(data || []));
  };
  useEffect(load, []);

  const updateStatus = async (id: string, status: string) => {
    await api.from("orders").update({ status }).eq("id", id);
    toast({ title: `Order marked ${status}` });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6" /> Orders</h1>
        <p className="text-sm text-muted-foreground">{orders.length} orders</p>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3 w-40">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="p-3">
                  <p className="font-medium">{o.shipping_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{o.shipping_phone}</p>
                </td>
                <td className="p-3 font-bold">£{o.total.toFixed(2)}</td>
                <td className="p-3"><Badge className={STATUS_COLORS[o.status] || ""}>{o.status}</Badge></td>
                <td className="p-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <Select value={o.status} onValueChange={v => updateStatus(o.id, v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pending", "paid", "shipped", "delivered", "cancelled"].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminOrders;
