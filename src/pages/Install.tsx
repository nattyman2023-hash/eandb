import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Share, Smartphone, Monitor, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { BUSINESS } from "@/lib/siteContent";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);

    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-success mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">App Installed!</h1>
            <p className="text-muted-foreground">
              {BUSINESS.name} is installed on your device. You can now access it from your home screen.
            </p>
            <Button asChild><Link to="/">Go to Home</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <img src="/eandb-mark.svg" alt="E and B" className="w-20 h-20 rounded-2xl mx-auto mb-4" width="64" height="64" />
          <CardTitle className="text-2xl">Install Our App</CardTitle>
          <p className="text-muted-foreground text-sm mt-2">
            Get quick access to {BUSINESS.name} right from your home screen — no app store needed.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {platform === "ios" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> Install on iPhone / iPad</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3"><span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span><span>Tap the <Share className="inline w-4 h-4 text-primary" /> <strong>Share</strong> button in Safari</span></li>
                <li className="flex gap-3"><span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span><span>Scroll down and tap <strong>"Add to Home Screen"</strong></span></li>
                <li className="flex gap-3"><span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span><span>Tap <strong>"Add"</strong> to confirm</span></li>
              </ol>
            </div>
          )}
          {platform === "android" && deferredPrompt && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> Install on Android</h3>
              <Button onClick={handleInstall} className="w-full" size="lg"><Download className="w-5 h-5 mr-2" /> Install App</Button>
            </div>
          )}
          {platform === "android" && !deferredPrompt && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> Install on Android</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3"><span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span><span>Tap the <strong>⋮ menu</strong> in Chrome</span></li>
                <li className="flex gap-3"><span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span><span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></span></li>
              </ol>
            </div>
          )}
          {platform === "desktop" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><Monitor className="w-5 h-5 text-primary" /> Install on Desktop</h3>
              {deferredPrompt ? (
                <Button onClick={handleInstall} className="w-full" size="lg"><Download className="w-5 h-5 mr-2" /> Install App</Button>
              ) : (
                <p className="text-sm text-muted-foreground">Look for the install icon <Download className="inline w-4 h-4" /> in your browser's address bar, or use the browser menu to install this app.</p>
              )}
            </div>
          )}
          <div className="pt-4 border-t border-border text-center">
            <Button variant="ghost" asChild><Link to="/">← Back to site</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
