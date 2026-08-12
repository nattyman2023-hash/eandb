import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import SEOHead from "@/components/SEOHead";
import { toast } from "@/hooks/use-toast";
import { productPrice, productOriginal, productOnSale, discountPercent } from "@/lib/pricing";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  sale_price: number | null;
  is_on_promo: boolean;
  category: string;
  tags: string[];
  image_url: string | null;
  is_featured: boolean;
  stock_quantity: number;
}

const CATEGORIES = ["All", "Hair Care", "Wigs", "Tools", "Accessories"];

const Shop = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const { addProductToCart } = useCart();

  useEffect(() => {
    api.from("products").select("*").eq("is_active", true).order("is_featured", { ascending: false }).then(({ data }: any) => {
      setProducts(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = products.filter(p => {
    if (category !== "All" && p.category !== category) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleAdd = (p: Product) => {
    addProductToCart({ id: p.id, name: p.name, price: productPrice(p), category: p.category, image_url: p.image_url || undefined });
    toast({ title: "Added to cart", description: p.name });
  };

  return (
    <>
      <SEOHead title="Shop Hair Products — Wub Hair" description="Premium wigs, hair care products, tools and accessories." />
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="bg-secondary py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-3">Shop the Collection</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">Premium hair products, wigs and accessories curated by our stylists</p>
        </section>

        <div className="container py-10">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${category === c ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-muted rounded-xl mb-3" />
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <ShoppingBag className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-serif text-foreground mb-2">No products found</h2>
              <p className="text-muted-foreground">Try a different category or search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filtered.map(p => {
                const current = productPrice(p);
                const original = productOriginal(p);
                const onSale = productOnSale(p);
                return (
                <div key={p.id} className="group">
                  <Link to={`/shop/${p.id}`} className="block">
                    <div className="aspect-square rounded-xl bg-muted overflow-hidden mb-3 relative">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}
                      {onSale && (
                        <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                          Sale −{discountPercent(original!, current)}%
                        </Badge>
                      )}
                      {p.stock_quantity <= 0 && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Badge variant="secondary">Out of Stock</Badge>
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {p.tags?.slice(0, 2).map(t => (
                      <span key={t} className="text-[10px] uppercase tracking-wider text-muted-foreground">{t}</span>
                    ))}
                  </div>
                  <Link to={`/shop/${p.id}`}>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{p.name}</h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-primary">£{current.toFixed(2)}</span>
                    {original != null && (
                      <span className="text-sm text-muted-foreground line-through">£{original.toFixed(2)}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-3 gap-1.5"
                    disabled={p.stock_quantity <= 0}
                    onClick={() => handleAdd(p)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add to Cart
                  </Button>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Shop;
