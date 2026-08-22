import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const APP_BUILD_TIME = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_TIME__: JSON.stringify(APP_BUILD_TIME),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "0.0.0"),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      filename: "eandb-app-sw.js",
      registerType: "prompt",
      injectRegister: false,
      devOptions: { enabled: false },
      includeAssets: ["placeholder.svg", "favicon.svg", "eandb-logo.svg", "eandb-mark.svg"],
      manifest: {
        name: "E and B",
        short_name: "E and B",
        description: "E and B — Manchester's salon for braiding, barbering and treatments.",
        theme_color: "#211F1C",
        background_color: "#FBF4EE",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/eandb-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/eandb-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /^\/auth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        globIgnores: ["*hair-logo.png", "favicon.ico", "pwa-*.png"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Always go to network for HTML so deploys appear immediately.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "eandb-html",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ request }) => ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "eandb-assets" },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "eandb-images",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
