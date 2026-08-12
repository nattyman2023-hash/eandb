import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isPreviewOrDevHost = () => {
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("id-preview--")
  );
};

const isEmbeddedPreview = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const cleanPreviewUrl = () => {
  const { pathname, search, hash } = window.location;
  const params = new URLSearchParams(search);
  const hasAuthParams = ["code", "access_token", "refresh_token", "token", "type"].some((key) =>
    params.has(key),
  );
  const hasHashToken = /access_token|refresh_token|token|type=/.test(hash);
  const hasTokenLikeQuery = Array.from(params.entries()).some(
    ([key, value]) => key.length > 80 || value.length > 80,
  );

  if (hasAuthParams || hasHashToken || hasTokenLikeQuery) {
    window.history.replaceState(null, "", pathname || "/");
  }
};

const resetPreviewPwaState = async () => {
  if (!isPreviewOrDevHost() && !isEmbeddedPreview()) return;

  cleanPreviewUrl();

  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }

    const registrations = (await navigator.serviceWorker?.getRegistrations()) || [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn("[pwa] preview cache reset failed", error);
  }
};

const renderApp = () => createRoot(document.getElementById("root")!).render(<App />);

resetPreviewPwaState().finally(renderApp);
