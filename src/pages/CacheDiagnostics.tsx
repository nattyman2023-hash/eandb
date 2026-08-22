import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Trash2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { CACHE_PREF_KEY, logCacheEvent } from "@/components/PwaUpdatePrompt";

declare const __APP_BUILD_TIME__: string;
declare const __APP_VERSION__: string;

type CacheEvent = { event: string; at: string };

const CacheDiagnostics = () => {
  const [swStatus, setSwStatus] = useState<"loading" | "active" | "none" | "unsupported">("loading");
  const [swScope, setSwScope] = useState<string | null>(null);
  const [cacheNames, setCacheNames] = useState<string[]>([]);
  const [events, setEvents] = useState<CacheEvent[]>([]);
  const [freshMode, setFreshMode] = useState(false);

  const refreshState = async () => {
    setEvents(JSON.parse(localStorage.getItem("eandb-cache-events") || "[]"));
    setFreshMode(localStorage.getItem(CACHE_PREF_KEY) === "fresh");
    if (!("serviceWorker" in navigator)) {
      setSwStatus("unsupported");
    } else {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length === 0) {
        setSwStatus("none");
        setSwScope(null);
      } else {
        setSwStatus("active");
        setSwScope(regs[0].scope);
      }
    }
    if ("caches" in window) {
      const names = await caches.keys();
      setCacheNames(names);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("clear") === "1") {
      clearAll({ skipConfirm: true });
      return;
    }

    refreshState();
  }, []);

  const clearAll = async (options?: { skipConfirm?: boolean }) => {
    if (!options?.skipConfirm && !confirm("Clear all caches and unregister the service worker? Page will reload.")) return;
    try {
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      const regs = (await navigator.serviceWorker?.getRegistrations()) || [];
      await Promise.all(regs.map((r) => r.unregister()));
      logCacheEvent("manual-clear");
      toast.success("Caches cleared. Reloading…");
      setTimeout(() => location.replace(window.location.pathname), 600);
    } catch (e: any) {
      toast.error(e.message || "Clear failed");
    }
  };

  const checkForUpdate = async () => {
    const regs = (await navigator.serviceWorker?.getRegistrations()) || [];
    await Promise.all(regs.map((r) => r.update()));
    logCacheEvent("manual-check-update");
    toast.success("Checked for updates");
    refreshState();
  };

  const toggleFresh = (val: boolean) => {
    if (val) localStorage.setItem(CACHE_PREF_KEY, "fresh");
    else localStorage.removeItem(CACHE_PREF_KEY);
    setFreshMode(val);
    logCacheEvent(val ? "fresh-mode-on" : "fresh-mode-off");
    toast.success(val ? "Fresh data mode enabled" : "Normal caching restored");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Cache Diagnostics</h1>
        <p className="text-sm text-muted-foreground">
          Inspect the app's offline cache, service worker and recent cache events.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Build & Version</CardTitle>
            <CardDescription>Currently loaded application bundle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono">{__APP_VERSION__}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Built at</span>
              <span className="font-mono text-xs">{__APP_BUILD_TIME__}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User agent</span>
              <span className="font-mono text-xs truncate max-w-[60%]" title={navigator.userAgent}>
                {navigator.userAgent.slice(0, 40)}…
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service Worker</CardTitle>
            <CardDescription>Background process that powers offline support.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              {swStatus === "active" ? (
                <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Active</Badge>
              ) : swStatus === "none" ? (
                <Badge variant="outline">Not registered</Badge>
              ) : swStatus === "unsupported" ? (
                <Badge variant="destructive">Unsupported</Badge>
              ) : (
                <Badge variant="outline">Loading…</Badge>
              )}
            </div>
            {swScope && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scope</span>
                <span className="font-mono text-xs">{swScope}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cache stores</span>
              <span className="font-mono">{cacheNames.length}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={checkForUpdate} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Check for update
              </Button>
              <Button size="sm" variant="destructive" onClick={() => clearAll()} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Clear caches & reload
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Offline caching settings
          </CardTitle>
          <CardDescription>
            Disable offline caching so the app always fetches fresh data and assets after every deploy.
            Recommended during active development; turn off for normal use.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="fresh-mode" className="text-sm font-medium">
              Fresh data mode
            </Label>
            <p className="text-xs text-muted-foreground">
              Clears all caches on every load and bypasses the service worker.
            </p>
          </div>
          <Switch id="fresh-mode" checked={freshMode} onCheckedChange={toggleFresh} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cache stores</CardTitle>
          <CardDescription>Names of registered cache buckets in the browser.</CardDescription>
        </CardHeader>
        <CardContent>
          {cacheNames.length === 0 ? (
            <p className="text-sm text-muted-foreground">No caches.</p>
          ) : (
            <ul className="space-y-1 text-sm font-mono">
              {cacheNames.map((n) => (
                <li key={n} className="flex justify-between border-b py-1.5 last:border-0">
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent cache events</CardTitle>
          <CardDescription>Last 50 update / clear events on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {events.map((e, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span className="font-mono text-xs">{e.event}</span>
                  <span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CacheDiagnostics;
