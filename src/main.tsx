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


// Service worker is auto-registered by vite-plugin-pwa (registerType: 'autoUpdate')