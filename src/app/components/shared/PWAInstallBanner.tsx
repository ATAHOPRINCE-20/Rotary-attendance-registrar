import { useState, useEffect } from "react";
import { useLocation } from "react-router";
import { X, Download, Share, PlusSquare, Smartphone, Laptop, CheckCircle2 } from "lucide-react";
import { NAVY, GOLD } from "../../../lib/constants";
import { useTenant } from "../../../context/TenantContext";

export function PWAInstallBanner() {
  const location = useLocation();
  const tenantContext = useTenant();
  const orgName = tenantContext?.organization?.name || "Agoroll";
  const logoUrl = tenantContext?.organization?.logo_url || "/assets/rotary_gold_logo.png";

  const [showBanner, setShowBanner] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode or already installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    const isInstalled = localStorage.getItem("pwa-installed") === "true";
    const isDismissed = localStorage.getItem("pwa-install-dismissed") === "true";

    if (isStandalone || isInstalled || isDismissed) return;

    // 2. Detect Platform
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isIOS =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);

    if (isIOS) {
      setPlatform("ios");
    } else if (isAndroid) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    const handlePrompt = () => {
      setCanPrompt(true);
      setShowBanner(true);
    };

    const handleAppInstalled = () => {
      localStorage.setItem("pwa-installed", "true");
      localStorage.setItem("pwa-install-dismissed", "true");
      setShowBanner(false);
    };

    window.addEventListener("pwa-beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if ((window as any).deferredPrompt) {
      setCanPrompt(true);
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener("pwa-beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Listen for custom trigger event to re-open banner from anywhere in app
  useEffect(() => {
    const handleOpen = () => {
      setShowBanner(true);
    };
    window.addEventListener("open-pwa-install-prompt", handleOpen);
    return () => window.removeEventListener("open-pwa-install-prompt", handleOpen);
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === "accepted") {
        localStorage.setItem("pwa-install-dismissed", "true");
      }
      (window as any).deferredPrompt = null;
      setCanPrompt(false);
      setShowBanner(false);
    } else {
      if (platform === "desktop") {
        alert(
          `To install ${orgName} on Desktop:\n• Click the install icon (⊕ or 💻) in your browser address bar at top right.\n• Or open Chrome/Edge menu (⋮) -> 'Save and share' -> 'Install page as app'.`
        );
      } else {
        alert(
          `To install ${orgName}:\n• On Android/Chrome: Tap menu (⋮) -> 'Add to Home screen' or 'Install app'.`
        );
      }
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "true");
    setShowBanner(false);
  };

  // Hide install banner on registration pages to avoid distracting user during sign up, or when dismissed/unsupported
  if (location.pathname.includes("/register") || !showBanner || !platform) return null;

  const isDesktop = platform === "desktop";

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] md:max-w-md md:left-auto md:right-4 animate-in slide-in-from-bottom duration-500">
      <div 
        className="relative overflow-hidden bg-card/95 backdrop-blur-xl border border-border/80 text-card-foreground shadow-2xl rounded-2xl p-5 flex flex-col gap-3.5 transition-all"
        style={{ borderTop: `4px solid ${GOLD}` }}
      >
        {/* Close Button */}
        <button 
          onClick={handleDismiss}
          aria-label="Close install prompt"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-muted/60 cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 pr-6">
          <div className="relative p-2.5 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-lg" style={{ backgroundColor: NAVY }}>
            {logoUrl ? (
              <img src={logoUrl} alt={orgName} className="w-6 h-6 object-contain" />
            ) : isDesktop ? (
              <Laptop size={22} />
            ) : (
              <Smartphone size={22} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-sm leading-tight text-foreground truncate" style={{ fontFamily: "var(--font-sans)" }}>
              Install Agoroll{orgName && orgName !== "Agoroll" ? ` (${orgName})` : ""}{isDesktop ? " Desktop App" : " App"}
            </h3>
            <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
              {isDesktop 
                ? "Add to your computer desktop or taskbar for instant 1-click access & management."
                : "Add to your phone's home screen for fast 1-tap access, QR check-ins & offline support."}
            </p>
          </div>
        </div>

        {/* Content & Action based on platform */}
        {platform === "ios" ? (
          <div className="flex flex-col gap-2.5 mt-1">
            <div className="text-xs text-muted-foreground leading-relaxed space-y-2 bg-muted/40 p-3 rounded-xl border border-border/40">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">1</span>
                <span className="text-foreground">Tap the <strong className="inline-flex items-center gap-1 text-primary">Share <Share size={13} className="inline text-blue-500" /></strong> icon at the bottom of Safari.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">2</span>
                <span className="text-foreground">Scroll down and select <strong className="inline-flex items-center gap-1 text-primary">Add to Home Screen <PlusSquare size={13} className="inline text-amber-500" /></strong>.</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleDismiss}
                className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button 
                onClick={handleDismiss}
                className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                style={{ backgroundColor: NAVY }}
              >
                <CheckCircle2 size={14} />
                Got It
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 mt-1">
            <div className="flex gap-2">
              <button 
                onClick={handleDismiss}
                className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
              >
                Maybe Later
              </button>
              <button 
                onClick={handleInstallClick}
                className="flex-1 text-center py-2.5 rounded-xl text-xs font-extrabold text-white transition-all hover:opacity-95 shadow-md cursor-pointer flex items-center justify-center gap-2 border border-white/10"
                style={{ backgroundColor: NAVY }}
              >
                <Download size={14} className="text-amber-400 animate-bounce" />
                Install Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

