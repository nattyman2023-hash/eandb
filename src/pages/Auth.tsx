import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Scissors, Heart, Download } from "lucide-react";
import { BUSINESS } from "@/lib/siteContent";
import tileAdmin from "@/assets/portal-tile-admin.jpg";
import tileStaff from "@/assets/portal-tile-staff.jpg";
// customer tile retired — customers reach login via header/footer "Sign in" link

type Role = "admin" | "staff" | "customer";

const ROLE_TILES: Record<"admin" | "staff", { label: string; description: string; image: string; icon: any }> = {
  admin: {
    label: "Admin Portal",
    description: "Salon management — bookings, staff, finance.",
    image: tileAdmin,
    icon: ShieldCheck,
  },
  staff: {
    label: "Staff PWA",
    description: "Stylists & barbers — schedule and clients on the go.",
    image: tileStaff,
    icon: Scissors,
  },
};

const ROLE_INFO: Record<Role, { label: string; description: string; icon: any }> = {
  ...ROLE_TILES,
  customer: {
    label: "Client sign in",
    description: "Book appointments, view history & rewards.",
    icon: Heart,
  },
};

const Auth = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = (params.get("role") as Role) || "customer";

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");

  const redirectByRole = async (userId: string) => {
    const { data: roles } = await api.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles ?? []).map((r: any) => r.role);
    if (role === "admin" && (roleList.includes("super_admin") || roleList.includes("admin"))) {
      navigate("/dashboard");
    } else if (role === "staff" && roleList.includes("mechanic")) {
      navigate("/staff");
    } else if (roleList.includes("super_admin") || roleList.includes("admin")) {
      navigate("/dashboard");
    } else if (roleList.includes("mechanic")) {
      navigate("/staff");
    } else {
      navigate("/portal");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await api.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Logged in successfully");
      await redirectByRole(data.user.id);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await api.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: { data: { full_name: signupName }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Account created! Sign in below to continue.");
      setSignupEmail("");
      setSignupPassword("");
      setSignupName("");
      setActiveTab("login");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await api.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Check your email for a password reset link");
      setShowForgot(false);
      setForgotEmail("");
    }
  };

  const setRole = (r: Role) => setParams({ role: r });
  const current = ROLE_INFO[role];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-start">
        {/* LEFT — form */}
        <div className="order-2 lg:order-1 space-y-6">
          {/* Portal tiles — staff/admin only. Customers arrive via header/footer link. */}
          {role !== "customer" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(ROLE_TILES) as Array<"admin" | "staff">).map((r) => {
                const info = ROLE_TILES[r];
                const Icon = info.icon;
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all ${
                      active
                        ? "border-primary shadow-lg ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div
                      className="aspect-[4/3] w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${info.image})` }}
                    />
                    <div className="p-3 bg-card">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">{info.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{info.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <current.icon className="h-5 w-5 text-primary" /> {current.label}
              </CardTitle>
              <CardDescription>{current.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {showForgot ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Reset Password</h3>
                  <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Sending…" : "Send Reset Link"}
                    </Button>
                  </form>
                  <Button variant="ghost" className="w-full" onClick={() => setShowForgot(false)}>
                    Back to Login
                  </Button>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="signup" disabled={role !== "customer"}>
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password">Password</Label>
                        <Input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Signing in…" : `Sign in to ${current.label}`}
                      </Button>
                      <Button type="button" variant="link" className="w-full text-sm" onClick={() => setShowForgot(true)}>
                        Forgot your password?
                      </Button>
                      {(role === "staff" || role === "admin") && (
                        <Link
                          to="/install"
                          className="flex items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 p-2 text-xs text-muted-foreground hover:bg-muted"
                        >
                          <Download className="h-3.5 w-3.5 text-primary" />
                          Install the {role === "admin" ? "Admin" : "Staff"} app on your device
                        </Link>
                      )}
                      <Link to="/" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                        <ArrowLeft className="h-4 w-4" /> Back to Website
                      </Link>
                    </form>
                  </TabsContent>
                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Full Name</Label>
                        <Input id="signup-name" value={signupName} onChange={(e) => setSignupName(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input id="signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={8} />
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Creating account…" : "Create Account"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — brand panel with logo */}
        <aside className="order-1 lg:order-2 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <img
            src="/eandb-logo.svg"
            alt={`${BUSINESS.name} logo`}
            className="h-24 w-full max-w-[240px] object-contain"
            width={240}
            height={64}
          />
          <div>
            <h1 className="text-2xl font-bold">{BUSINESS.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{BUSINESS.tagline}</p>
          </div>
          <p className="text-xs text-muted-foreground">{BUSINESS.address}</p>
        </aside>
      </div>
    </div>
  );
};

export default Auth;
