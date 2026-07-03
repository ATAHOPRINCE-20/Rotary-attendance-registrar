import { useState, useEffect } from "react";
import { X, Download, Share, PlusSquare, Smartphone } from "lucide-react";
import { NAVY, GOLD } from "../../../lib/constants";

export function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    if (isStandalone) return;

    // 2. Check if dismissed recently
    const isDismissed = localStorage.getItem("pwa-install-dismissed") === "true";
    if (isDismissed) return;

    // 3. Detect Platform
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isIOS =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);

    if (isIOS) {
      setPlatform("ios");
      // Delayed display for better UX
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    } else if (isAndroid) {
      setPlatform("android");
      
      // Check if deferredPrompt already exists
      if ((window as any).deferredPrompt) {
        setCanPrompt(true);
      }

      // Listen for custom event or standard event
      const handlePrompt = () => {
        setCanPrompt(true);
        setShowBanner(true);
      };

      window.addEventListener("pwa-beforeinstallprompt", handlePrompt);

      // Even if deferredPrompt doesn't fire immediately, show instructions after delay
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 4000);

      return () => {
        window.removeEventListener("pwa-beforeinstallprompt", handlePrompt);
        clearTimeout(timer);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the install prompt");
        localStorage.setItem("pwa-install-dismissed", "true");
      }
      (window as any).deferredPrompt = null;
      setCanPrompt(false);
      setShowBanner(false);
    } else {
      // Fallback instructions if native prompt is unavailable but they clicked install
      alert("To install: Tap the three-dot menu in Chrome and select 'Add to Home screen' or 'Install app'.");
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "true");
    setShowBanner(false);
  };

  if (!showBanner || !platform) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] md:max-w-sm md:left-auto md:right-4 animate-in slide-in-from-bottom duration-300">
      <div 
        className="relative overflow-hidden bg-card/95 backdrop-blur-md border border-border/60 text-card-foreground shadow-2xl rounded-2xl p-5 flex flex-col gap-3"
        style={{ borderTop: `4px solid ${GOLD}` }}
      >
        {/* Close Button */}
        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted/40 cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pr-6">
          <div className="p-2 rounded-xl text-white flex items-center justify-center shrink-0 shadow-md" style={{ backgroundColor: NAVY }}>
            <Smartphone size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight text-foreground" style={{ fontFamily: "var(--font-sans)" }}>
              Install Rotary Ntinda
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Add this app to your home screen for quick offline registration & check-ins.
            </p>
          </div>
        </div>

        {/* Content & Action based on platform */}
        {platform === "ios" ? (
          <div className="flex flex-col gap-2 mt-1">
            <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5 bg-muted/40 p-3 rounded-xl border border-border/30">
              <div className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                <span>Tap the <strong className="text-foreground inline-flex items-center gap-0.5">Share <Share size={12} className="inline" /></strong> button in Safari.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                <span>Scroll down and tap <strong className="text-foreground inline-flex items-center gap-0.5">Add to Home Screen <PlusSquare size={12} className="inline" /></strong>.</span>
              </div>
            </div>
            <button 
              onClick={handleDismiss}
              className="w-full text-center py-2 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-1">
            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 p-3 rounded-xl border border-border/30">
              Get instant access and offline features by installing the app on your home screen.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={handleDismiss}
                className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
              >
                Maybe Later
              </button>
              <button 
                onClick={handleInstallClick}
                className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                style={{ backgroundColor: NAVY }}
              >
                <Download size={13} />
                Install Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
