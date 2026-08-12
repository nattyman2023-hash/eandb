import { useState, useRef, useEffect } from "react";
import { api, apiRequest } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lock, Upload, ImageIcon, Loader2, CreditCard, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useSiteImages, ALL_IMAGE_SLOTS } from "@/hooks/useSiteImages";

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { getImage, uploading, uploadImage } = useSiteImages();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const { error } = await api.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password changed successfully");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const globalSlots = ALL_IMAGE_SLOTS.filter((s) => s.group === "global");
  const boroughSlots = ALL_IMAGE_SLOTS.filter((s) => s.group === "borough");
  const serviceSlots = ALL_IMAGE_SLOTS.filter((s) => s.group === "service");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Change Password</CardTitle>
          </div>
          <CardDescription>Update your login password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-new-pw">New Password</Label>
              <Input id="settings-new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-confirm-pw">Confirm New Password</Label>
              <Input id="settings-confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Changing…" : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <PaymentsCard />

      {/* Site Images */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Site Images</CardTitle>
          </div>
          <CardDescription>Upload your own images for the public website. Changes appear immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <ImageGroup title="Global Images" slots={globalSlots} getImage={getImage} uploading={uploading} uploadImage={uploadImage} />
          <ImageGroup title="Borough Images" slots={boroughSlots} getImage={getImage} uploading={uploading} uploadImage={uploadImage} />
          <ImageGroup title="Service Images" slots={serviceSlots} getImage={getImage} uploading={uploading} uploadImage={uploadImage} />
        </CardContent>
      </Card>
    </div>
  );
};

function ImageGroup({
  title,
  slots,
  getImage,
  uploading,
  uploadImage,
}: {
  title: string;
  slots: typeof ALL_IMAGE_SLOTS;
  getImage: (key: string) => string;
  uploading: string | null;
  uploadImage: (key: string, file: File) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => (
          <ImageSlotCard
            key={slot.key}
            slot={slot}
            currentUrl={getImage(slot.key)}
            isUploading={uploading === slot.key}
            onUpload={(file) => uploadImage(slot.key, file)}
          />
        ))}
      </div>
    </div>
  );
}

function ImageSlotCard({
  slot,
  currentUrl,
  isUploading,
  onUpload,
}: {
  slot: (typeof ALL_IMAGE_SLOTS)[number];
  currentUrl: string;
  isUploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="aspect-video relative bg-muted">
        <img src={currentUrl} alt={slot.label} className="w-full h-full object-cover" loading="lazy" />
        {isUploading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      <div className="p-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{slot.label}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 gap-1"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </Button>
      </div>
    </div>
  );
}

function PaymentsCard() {
  const [status, setStatus] = useState<{ secretConfigured: boolean; publishableConfigured: boolean; secretMode: string | null } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; accountName?: string; livemode?: boolean; error?: string } | null>(null);

  const refresh = async () => {
    const { data } = await apiRequest<{ data: { secretConfigured: boolean; publishableConfigured: boolean; secretMode: string | null } }>("/api/payments/status");
    setStatus(data ?? null);
  };
  useEffect(() => { refresh(); }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    let data;
    try {
      ({ data } = await apiRequest<{ data: { ok: boolean; accountName?: string; livemode?: boolean; error?: string } }>("/api/payments/test", { method: "POST" }));
    } catch (error: any) {
      setTesting(false);
      toast.error(error.message || "Connection failed");
      return;
    }
    setTesting(false);
    setTestResult(data);
    if (data?.ok) toast.success(`Connected as ${data.accountName}`);
    else toast.error(data?.error || "Connection failed");
  };

  const connected = status?.secretConfigured && status?.publishableConfigured;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Payments — Stripe</CardTitle>
          {status?.secretMode && (
            <Badge variant={status.secretMode === "live" ? "default" : "secondary"} className="ml-1">
              {status.secretMode === "live" ? "Live" : "Test"} mode
            </Badge>
          )}
        </div>
        <CardDescription>
          Connect your own Stripe account. Keys are stored securely as encrypted secrets — never in the database or codebase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <KeyRow label="Secret key (STRIPE_SECRET_KEY)" set={status.secretConfigured} />
              <KeyRow label="Publishable key (STRIPE_PUBLISHABLE_KEY)" set={status.publishableConfigured} />
            </div>

            {!connected && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  Add both keys via the secure secrets form. Get your keys from{" "}
                  <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline font-medium">Stripe → Developers → API keys</a>.
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => toast.info("Configure STRIPE_SECRET_KEY in the server environment, then refresh this status.")}
              >
                {status.secretConfigured ? "Update secret key" : "Add secret key"}
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.info("Configure STRIPE_PUBLISHABLE_KEY in the server environment, then refresh this status.")}
              >
                {status.publishableConfigured ? "Update publishable key" : "Add publishable key"}
              </Button>
              <Button onClick={handleTest} disabled={testing || !status.secretConfigured}>
                {testing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing…</> : "Test connection"}
              </Button>
              <Button variant="ghost" size="sm" onClick={refresh}>Refresh</Button>
            </div>

            {testResult && (
              <div className={`rounded-md border p-3 text-sm flex gap-2 ${testResult.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}>
                {testResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <XCircle className="h-4 w-4 mt-0.5" />}
                <div>
                  {testResult.ok
                    ? <>Connected as <strong>{testResult.accountName}</strong> ({testResult.livemode ? "live" : "test"} mode).</>
                    : <>Failed: {testResult.error}</>}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              After adding keys, functions redeploy automatically. Click <em>Test connection</em> to verify.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KeyRow({ label, set }: { label: string; set: boolean }) {
  return (
    <div className={`rounded-md border p-3 flex items-center gap-2 text-sm ${set ? "border-green-300 bg-green-50/50" : "border-border"}`}>
      {set ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
      <span className={set ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

export default Settings;
