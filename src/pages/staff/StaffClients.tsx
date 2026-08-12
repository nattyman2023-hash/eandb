import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Phone, Mail, Sparkles } from "lucide-react";
import { format } from "date-fns";

interface Customer { id: string; name: string; phone?: string; email?: string; postcode?: string; }

export default function StaffClients() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Customer[]>([]);
  const [active, setActive] = useState<Customer | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      let req = api.from("customers").select("id, name, phone, email, postcode").order("created_at", { ascending: false }).limit(40);
      if (q.trim()) req = api.from("customers").select("id, name, phone, email, postcode").or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`).limit(40);
      const { data } = await req;
      setList(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const openClient = async (c: Customer) => {
    setActive(c);
    const [j, v] = await Promise.all([
      api.from("jobs").select("id, scheduled_at, status, notes").eq("customer_id", c.id).order("scheduled_at", { ascending: false }).limit(20),
      api.from("hair_profiles").select("preference, texture, goal").eq("customer_id", c.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setHistory(j.data ?? []);
    setProfile(v.data ?? null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl">Clients</h2>
        <p className="text-xs text-muted-foreground">Search the salon's hair history.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, phone, email" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="space-y-2">
        {list.map(c => (
          <button key={c.id} onClick={() => openClient(c)} className="w-full atelier-card p-3 text-left hover:bg-accent/30 transition">
            <p className="font-semibold text-sm">{c.name}</p>
            <p className="text-xs text-muted-foreground truncate">{c.phone || c.email || "—"}</p>
          </button>
        ))}
        {list.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No clients found.</p>}
      </div>

      <Sheet open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle className="font-serif">{active?.name}</SheetTitle></SheetHeader>
          {active && (
            <div className="space-y-5 pt-4">
              <div className="space-y-1 text-sm">
                {active.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" />{active.phone}</p>}
                {active.email && <p className="flex items-center gap-2"><Mail className="h-3 w-3" />{active.email}</p>}
                {active.postcode && <p className="text-muted-foreground text-xs">{active.postcode}</p>}
              </div>
              {profile && (
                <div className="atelier-card p-3 text-xs space-y-1">
                  <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-3 w-3 text-primary" /> Hair profile</p>
                  <p>Preference: <span className="text-muted-foreground">{profile.preference || "—"}</span></p>
                  <p>Texture: <span className="text-muted-foreground">{profile.texture || "—"}</span></p>
                  <p>Goal: <span className="text-muted-foreground">{profile.goal || "—"}</span></p>
                </div>
              )}
              <div>
                <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Recent visits</h3>
                <div className="space-y-2">
                  {history.length === 0 && <p className="text-xs text-muted-foreground">No visits yet.</p>}
                  {history.map(h => (
                    <div key={h.id} className="text-xs p-2 rounded-md border border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{h.scheduled_at ? format(new Date(h.scheduled_at), "d MMM yyyy · HH:mm") : "—"}</span>
                        <Badge variant="outline" className="text-[9px]">{h.status}</Badge>
                      </div>
                      {h.notes && <p className="text-muted-foreground mt-0.5">{h.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
