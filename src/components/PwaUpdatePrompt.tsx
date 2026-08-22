import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";

const CACHE_PREF_KEY = "eandb-cache-mode"; // "fresh" | "normal"

function logCacheEvent(event: string) {
  try {
    const log = JSON.parse(localStorage.getItem("eandb-cache-events") || "[]");
    log.unshift({ event, at: new Date().toISOString() });
    localStorage.setItem("eandb-cache-events", JSON.stringify(log.slice(0, 50)));
  } catch {
    /* noop */
  }
}

export function isFreshMode() {
  return typeof window !== "undefined" && localStorage.getItem(CACHE_PREF_KEY) === "fresh";
}

export function shouldDisablePwaRegistration() {
  if (typeof window === "undefined") return true;

  const host = window.location.hostname;
  const isPreviewOrDevHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("id-preview--");

  let isEmbedded = false;
  try {
    isEmbedded = window.self !== window.top;
  } catch {
    isEmbedded = true;
  }

  return isPreviewOrDevHost || isEmbedded || isFreshMode();
}

const PwaUpdatePromptInner = () => {
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      logCacheEvent(`sw-registered:${swUrl}`);
      // Poll for updates every 60s so we surface deploys quickly.
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60_000);
      }
    },
    onNeedRefresh() {
      logCacheEvent("update-available");
    },
    onRegisterError(err) {
      console.warn("[pwa] registration error", err);
    },
  });

  // "Fresh data mode" — auto-clear caches and unregister SW so the next nav is fully fresh.
  useEffect(() => {
    if (!isFreshMode()) return;
    (async () => {
      try {
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        const regs = (await navigator.serviceWorker?.getRegistrations()) || [];
        await Promise.all(regs.map((r) => r.unregister()));
        logCacheEvent("fresh-mode-clear");
      } catch (e) {
        console.warn("[pwa] fresh mode clear failed", e);
      }
    })();
  }, []);

  if (!needRefresh || dismissed) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md sm:left-1/2 sm:-translate-x-1/2 sm:inset-x-auto">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <RefreshCw className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">A new version is available</p>
          <p className="text-xs text-muted-foreground">Refresh to get the latest features and fixes.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            logCacheEvent("update-applied");
            updateServiceWorker(true);
          }}
        >
          Refresh
        </Button>
        <button
          onClick={() => {
            setDismissed(true);
            setNeedRefresh(false);
          }}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const PwaUpdatePrompt = () => {
  if (shouldDisablePwaRegistration()) return null;

  return <PwaUpdatePromptInner />;
};

export default PwaUpdatePrompt;
export { CACHE_PREF_KEY, logCacheEvent };
