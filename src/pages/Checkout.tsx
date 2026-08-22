import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, ArrowLeft, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";
import SEOHead from "@/components/SEOHead";

const Checkout = () => {
  const { productItems, productTotal, productItemCount, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: user?.user_metadata?.full_name || "",
    email: user?.email || "",
    phone: "",
    address: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (productItems.length === 0 && !confirmed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 text-center">
        <div>
          <ShoppingBag className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-serif text-foreground mb-2">Your bag is empty</h1>
          <p className="text-muted-foreground mb-6">Add products before checking out.</p>
          <Button asChild><Link to="/shop">Browse Shop</Link></Button>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-serif text-foreground mb-3">Order Placed</h1>
          <p className="text-muted-foreground mb-6">
            Thanks {form.name.split(" ")[0]}. We'll email you when it ships.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Home</Link></Button>
            <Button asChild><Link to="/shop">Keep Shopping</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.address) {
      toast.error("Name, phone and address are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data: order, error } = await api.from("orders").insert({
        user_id: user?.id ?? null,
        total: productTotal,
        status: "pending",
        shipping_name: form.name,
        shipping_phone: form.phone,
        shipping_address: form.address,
        notes: form.notes || null,
      }).select().single();
      if (error || !order) throw error || new Error("Order failed");

      const items = productItems.map(i => ({
        order_id: order.id,
        product_id: i.productId!,
        quantity: i.quantity,
        unit_price: i.price,
      }));
      const { error: itemErr } = await api.from("order_items").insert(items);
      if (itemErr) throw itemErr;

      clearCart();
      setConfirmed(true);
      toast.success("Order placed");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead title="Checkout — E and B" description="Complete your product order" />
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <h1 className="text-3xl font-serif text-foreground mb-6">Checkout</h1>

          <div className="grid lg:grid-cols-[1fr_320px] gap-8">
            {/* Form */}
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <h2 className="font-serif text-lg text-foreground">Shipping Details</h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Shipping Address *</Label><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street, city, postcode" /></div>
                <div><Label>Order Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anything we should know?" /></div>
              </div>
            </div>

            {/* Summary */}
            <div>
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4 sticky top-24">
                <h2 className="font-serif text-lg text-foreground">Order Summary</h2>
                <div className="space-y-2">
                  {productItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-foreground line-clamp-1">{item.name} × {item.quantity}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">£{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 text-sm flex justify-between">
                  <span className="text-muted-foreground">Items</span>
                  <span>{productItemCount}</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between text-xl font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">£{productTotal.toFixed(2)}</span>
                </div>
                <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
                  {submitting ? "Placing order…" : "Place Order"}
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link to="/cart"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Bag</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Checkout;
