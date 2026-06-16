import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { PageCard, TextInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD } from "../../../lib/constants";
import { QrCode, Scan, Camera, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";

export function QRScannerPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const { organization, loading } = useTenant();
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;

    // Check if it's a registration check-in code (starts with ROT- or similar)
    const code = manualCode.trim().toUpperCase();
    if (code.startsWith("ROT-")) {
      toast.success("Ticket code entered! Redirecting...");
      navigate(`/org/${slug}/post-register?ref=${code}`);
    } else {
      toast.error("Invalid ticket format. Try again.");
    }
  }

  function simulateScan() {
    setScanning(true);
    toast.info("Accessing camera simulation...");
    setTimeout(() => {
      setScanning(false);
      // Let's redirect to events list as an example of a successful scan
      toast.success("Successfully scanned club event QR code!");
      navigate(`/org/${slug}/events`);
    }, 2500);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-[#17458F] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <NavBar organization={organization} currentPath={window.location.pathname} />

      <div className="max-w-md mx-auto px-4">
        <PageCard className="flex flex-col items-center gap-6">
          <div className="text-center">
            <QrCode className="w-12 h-12 mx-auto mb-2 text-[#17458F]" />
            <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
              Scan QR Code
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Scan club materials or enter code manually to access tickets or check in.
            </p>
          </div>

          <div className="w-full relative aspect-square rounded-2xl overflow-hidden border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-4 group">
            {scanning ? (
              <div className="flex flex-col items-center gap-3">
                <Scan className="w-16 h-16 text-[#F7A81B] animate-pulse" />
                <p className="text-xs font-bold tracking-widest text-[#F7A81B] animate-bounce">
                  SCANNING CAMERA FEED...
                </p>
              </div>
            ) : (
              <>
                <div className="absolute inset-4 rounded-xl border border-primary/20 pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-[#F7A81B]/40 absolute animate-[scan_2s_ease-in-out_infinite]" />
                </div>
                <Camera className="w-12 h-12 text-muted-foreground group-hover:scale-110 transition-transform" />
                <GoldButton onClick={simulateScan} className="flex items-center gap-2">
                  <Sparkles size={16} /> Simulate Camera Scan
                </GoldButton>
              </>
            )}
          </div>

          <div className="w-full flex items-center gap-3 py-2">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs font-bold text-muted-foreground">OR ENTER MANUALLY</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <form onSubmit={handleManualSubmit} className="w-full flex gap-2">
            <input
              placeholder="e.g. ROT-A1B2C3D4"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border border-border bg-input-background text-sm uppercase focus:outline-none focus:ring-2 transition-all"
              style={{ fontFamily: "monospace" }}
            />
            <GoldButton type="submit" className="px-4">
              <Send size={15} />
            </GoldButton>
          </form>

          <OutlineButton onClick={() => navigate(-1)} className="w-full justify-center">
            Go Back
          </OutlineButton>
        </PageCard>
      </div>
    </div>
  );
}
