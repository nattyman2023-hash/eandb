import { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CalendarClock, ClipboardList, Users, LogOut, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/staff", label: "Today", icon: CalendarClock, end: true },
  { to: "/staff/schedule", label: "Salon", icon: LayoutGrid },
  { to: "/staff/waitlist", label: "Walk-ins", icon: ClipboardList },
  { to: "/staff/clients", label: "Clients", icon: Users },
];

export default function StaffLayout({ children }: { children?: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background pb-20">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-lg leading-none">E and B · Staff</h1>
          {profile?.full_name && <p className="text-[11px] text-muted-foreground mt-0.5">Hi {profile.full_name.split(" ")[0]}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
      </header>

      <main className="flex-1 px-3 py-4 max-w-3xl w-full mx-auto">
        {children ?? <Outlet />}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border z-30">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] uppercase tracking-wider transition",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
