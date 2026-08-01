import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Reset mobile viewport zoom on input blur (keyboard collapse)
document.addEventListener(
  "blur",
  (e) => {
    const target = e.target as HTMLElement;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
      const meta = document.querySelector('meta[name="viewport"]');
      if (meta) {
        meta.setAttribute(
          "content",
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0"
        );
        setTimeout(() => {
          meta.setAttribute("content", "width=device-width, initial-scale=1.0");
        }, 300);
      }
    }
  },
  true
);

// Capture PWA installation prompt event for Android
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).deferredPrompt = e;
  window.dispatchEvent(new CustomEvent("pwa-beforeinstallprompt"));
});


// Auto-recover from stale dynamic chunk imports on deployment updates
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason?.toString() || "";
  if (
    reason.includes("Failed to fetch dynamically imported module") ||
    reason.includes("Loading chunk") ||
    reason.includes("Importing a module script failed")
  ) {
    console.warn("Stale chunk detected, refreshing page automatically...");
    const lastChunkReload = sessionStorage.getItem("chunk-reload-timestamp");
    const now = Date.now();
    if (!lastChunkReload || now - parseInt(lastChunkReload, 10) > 10000) {
      sessionStorage.setItem("chunk-reload-timestamp", now.toString());
      window.location.reload();
    }
  }
});

// Unregister legacy or stale service workers and clear caches immediately to prevent stale bundle hangs
if (typeof window !== "undefined") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
  }
  if ("caches" in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name).catch(() => {});
      }
    }).catch(() => {});
  }
}