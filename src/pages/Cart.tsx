import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, ArrowRight, Scissors, Mail, Check } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { toast } from "sonner";

function getSessionId() {
  let id = localStorage.getItem("cart_session_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("cart_session_id", id); }
  return id;
}

const Cart = () => {
  const { removeFromCart, updateQuantity, productItems, productItemCount, productTotal, serviceItems } = useCart();
  const [recommended, setRecommended] = useState<any[]>([]);
  const [saveEmail, setSaveEmail] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.from("products").select("*").eq("is_active", true).eq("is_featured", true).limit(4)
      .then(({ data }: any) => setRecommended(data || []));
  }, []);

  const saveBag = async () => {
    const email = saveEmail.trim();
    if (!email.includes("@")) { toast.error("Enter a valid email"); return; }
    const sessionId = getSessionId();
    // mirror current service items into cart_items so the scheduler can find them
    await api.from("cart_items").delete().eq("session_id", sessionId);
    if (serviceItems.length) {
      await api.from("cart_items").insert(
        serviceItems.map((s: any) => ({ session_id: sessionId, service_catalog_id: s.id, quantity: s.quantity ?? 1 }))
      );
    }
    await api.from("cart_sessions").upsert(
      { session_id: sessionId, email, updated_at: new Date().toISOString(), reminder_sent_at: null },
      { onConflict: "session_id" }
    );
    setSaved(true);
    toast.success("We'll send you a reminder if you don't finish");
  };


  return (
    <>
      <SEOHead title="Your Bag — E and B" description="Review the products in your bag" />
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex items-baseline justify-between mb-8">
            <h1 className="text-3xl font-serif text-foreground">Your Bag</h1>
            <Link to="/book" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <Scissors className="h-3.5 w-3.5" /> Book a service instead
            </Link>
          </div>

          {productItems.length === 0 ? (
            <div className="text-center py-20">
              <ShoppingBag className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-serif text-foreground mb-2">Your bag is empty</h2>
              <p className="text-muted-foreground mb-6">Browse our hair care, wigs, tools and accessories</p>
              <div className="flex gap-3 justify-center">
                <Button asChild><Link to="/shop"><ShoppingBag className="mr-2 h-4 w-4" /> Shop Products</Link></Button>
                <Button asChild variant="outline"><Link to="/book"><Scissors className="mr-2 h-4 w-4" /> Book a Service</Link></Button>
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-3">
                {productItems.map(item => (
                  <div key={item.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden shrink-0">
                      {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-full w-full p-3 text-muted-foreground/20" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.category}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                      <span className="font-bold text-primary w-16 text-right">£{(item.price * item.quantity).toFixed(2)}</span>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeFromCart(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div>
                <div className="bg-card border border-border rounded-xl p-6 space-y-4 sticky top-24">
                  <h2 className="font-serif text-lg text-foreground">Order Summary</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">{productItemCount} item{productItemCount > 1 ? "s" : ""}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="text-emerald-600 font-medium">Calculated at checkout</span></div>
                  </div>
                  <div className="border-t border-border pt-4 flex justify-between text-xl font-bold">
                    <span className="text-foreground">Subtotal</span>
                    <span className="text-primary">£{productTotal.toFixed(2)}</span>
                  </div>
                  <Button asChild className="w-full" size="lg">
                    <Link to="/checkout">Checkout <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                  <Button variant="outline" asChild className="w-full">
                    <Link to="/shop"><ArrowLeft className="mr-2 h-4 w-4" /> Continue Shopping</Link>
                  </Button>
                  <div className="border-t border-border pt-4 space-y-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" /> Save your bag — we'll remind you</p>
                    {saved ? (
                      <p className="text-sm text-emerald-600 inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Saved</p>
                    ) : (
                      <div className="flex gap-2">
                        <Input type="email" placeholder="you@email.com" value={saveEmail} onChange={e => setSaveEmail(e.target.value)} className="h-9" />
                        <Button size="sm" variant="secondary" onClick={saveBag}>Save</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recommended */}
          {recommended.length > 0 && productItems.length === 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-serif text-foreground mb-6">You May Also Like</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {recommended.map((p: any) => (
                  <Link key={p.id} to={`/shop/${p.id}`} className="group">
                    <div className="aspect-square rounded-xl bg-muted overflow-hidden mb-3">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-10 w-10 text-muted-foreground/20" /></div>}
                    </div>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{p.name}</h3>
                    <span className="font-bold text-primary">£{p.price?.toFixed(2)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
};

export default Cart;
