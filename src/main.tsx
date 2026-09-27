import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

// The old site was an installable PWA whose service worker cached the retired
// booking/CRM app. Remove any leftover registration and its caches so returning
// visitors get the marketing site straight from the network.
const retireOldServiceWorker = async () => {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) || [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("eandb-") || name.startsWith("workbox-")).map((name) => caches.delete(name)));
    }
  } catch (error) {
    console.warn("[sw] cleanup failed", error);
  }
};

retireOldServiceWorker();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </HelmetProvider>,
);
