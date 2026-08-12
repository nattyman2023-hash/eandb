import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/apiClient";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return setState("invalid");
      try {
        const r = await fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        if (j.valid) setState("valid");
        else if (j.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch { setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setBusy(true);
    const { data } = await apiRequest<{ data: { success: boolean; reason?: string } }>("/api/email/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    setBusy(false);
    if (!data?.success) setState(data?.reason === "already_unsubscribed" ? "already" : "error");
    else setState("done");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-primary">Selam Unisex Salon</h1>
        {state === "loading" && <p className="text-muted-foreground">Checking your link…</p>}
        {state === "invalid" && <p>This unsubscribe link is invalid or expired.</p>}
        {state === "already" && <p>You're already unsubscribed. We won't email you again.</p>}
        {state === "error" && <p className="text-destructive">Something went wrong. Please try again later.</p>}
        {state === "valid" && (
          <>
            <p>Click below to unsubscribe from emails sent by Selam Unisex Salon.</p>
            <Button onClick={confirm} disabled={busy} className="w-full">
              {busy ? "Unsubscribing…" : "Confirm unsubscribe"}
            </Button>
          </>
        )}
        {state === "done" && <p>You've been unsubscribed. Sorry to see you go.</p>}
      </Card>
    </main>
  );
}
