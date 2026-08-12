import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, ShoppingBag, ArrowLeft } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { toast } from "@/hooks/use-toast";

interface Product {
  id: string; name: string; description: string | null; price: number;
  compare_at_price: number | null; category: string; tags: string[];
  image_url: string | null; stock_quantity: number; is_featured: boolean;
}

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const { addProductToCart } = useCart();

  useEffect(() => {
    if (!id) return;
    api.from("products").select("*").eq("id", id).single().then(({ data }: any) => {
      setProduct(data);
      setLoading(false);
      if (data?.category) {
        api.from("products").select("*").eq("is_active", true).eq("category", data.category).neq("id", id).limit(4)
          .then(({ data: r }: any) => setRelated(r || []));
      }
    });
  }, [id]);

  const handleAdd = () => {
    if (!product) return;
    for (let i = 0; i < qty; i++) {
      addProductToCart({ id: product.id, name: product.name, price: product.price, category: product.category, image_url: product.image_url || undefined });
    }
    toast({ title: "Added to cart", description: `${qty}x ${product.name}` });
    setQty(1);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Product not found</div>;

  return (
    <>
      <SEOHead title={`${product.name} — Wub Hair`} description={product.description || product.name} />
      <div className="min-h-screen bg-background">
        <div className="container py-8">
          <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to Shop
          </Link>

          <div className="grid md:grid-cols-2 gap-10">
            {/* Image */}
            <div className="aspect-square rounded-2xl bg-muted overflow-hidden">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-20 w-20 text-muted-foreground/20" /></div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col justify-center">
              <div className="flex flex-wrap gap-2 mb-3">
                {product.tags?.map(t => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
              <h1 className="text-3xl font-serif text-foreground mb-2">{product.name}</h1>
              <p className="text-sm text-muted-foreground mb-1">{product.category}</p>

              <div className="flex items-center gap-3 my-4">
                <span className="text-3xl font-bold text-primary">£{product.price.toFixed(2)}</span>
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <span className="text-lg text-muted-foreground line-through">£{product.compare_at_price.toFixed(2)}</span>
                )}
              </div>

              {product.description && (
                <p className="text-muted-foreground mb-6 leading-relaxed">{product.description}</p>
              )}

              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center border border-border rounded-lg">
                  <Button size="icon" variant="ghost" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-4 w-4" /></Button>
                  <span className="w-10 text-center font-medium">{qty}</span>
                  <Button size="icon" variant="ghost" onClick={() => setQty(qty + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
                <Button className="flex-1 gap-2" size="lg" disabled={product.stock_quantity <= 0} onClick={handleAdd}>
                  <ShoppingBag className="h-4 w-4" />
                  {product.stock_quantity <= 0 ? "Out of Stock" : "Add to Cart"}
                </Button>
              </div>

              {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                <p className="text-sm text-destructive">Only {product.stock_quantity} left in stock</p>
              )}
            </div>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-serif text-foreground mb-6">You May Also Like</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {related.map(p => (
                  <Link key={p.id} to={`/shop/${p.id}`} className="group">
                    <div className="aspect-square rounded-xl bg-muted overflow-hidden mb-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-10 w-10 text-muted-foreground/20" /></div>
                      )}
                    </div>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{p.name}</h3>
                    <span className="font-bold text-primary">£{p.price.toFixed(2)}</span>
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

export default ProductDetail;
