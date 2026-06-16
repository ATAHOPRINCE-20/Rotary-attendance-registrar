import { useParams, useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { useEvent } from "../../../hooks/useEvents";
import { PageCard } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD } from "../../../lib/constants";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, Download, Printer, Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function EventQRPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const { data: event, isLoading } = useEvent(id);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-[#17458F] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageCard className="text-center max-w-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>Event Not Found</h2>
          <GoldButton onClick={() => navigate("/admin/events")} className="w-full justify-center">
            Back to Events
          </GoldButton>
        </PageCard>
      </div>
    );
  }

  // The landing/registration link for attendees
  const publicUrl = `${window.location.origin}/org/${organization?.slug}/event/${event.id}`;

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Public event registration URL copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function printQR() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-12 print:pt-0 print:pb-0">
      <div className="print:hidden">
        <NavBar organization={organization} currentPath={window.location.pathname} />
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6">
        <button
          onClick={() => navigate("/admin/events")}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors mb-6 print:hidden"
        >
          <ChevronLeft size={16} /> Back to events
        </button>

        <PageCard className="flex flex-col items-center gap-6 print:border-none print:shadow-none print:p-0">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: GOLD }}>
              EVENT GATEWAY CODE
            </p>
            <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
              Registration QR Code
            </h1>
            <p className="text-xs text-muted-foreground mt-1 px-4">
              Attendees scan this code using their phone camera to open the event portal and register their attendance.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-border flex flex-col items-center gap-4">
            <QRCodeSVG value={publicUrl} size={240} level="H" includeMargin={true} />
            <div className="text-center">
              <h2 className="text-lg font-bold" style={{ color: NAVY }}>{event.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(event.date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="w-full flex flex-col gap-2 print:hidden">
            <div className="flex items-center gap-2 p-3 bg-muted/40 border border-border rounded-xl text-xs overflow-hidden">
              <span className="font-semibold text-muted-foreground select-none">URL:</span>
              <span className="flex-1 font-mono truncate">{publicUrl}</span>
              <button
                onClick={copyLink}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground flex-shrink-0"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <OutlineButton onClick={printQR} className="w-full justify-center flex items-center gap-1.5">
                <Printer size={15} /> Print Poster
              </OutlineButton>
              <GoldButton onClick={copyLink} className="w-full justify-center flex items-center gap-1.5">
                <Share2 size={15} /> Share Link
              </GoldButton>
            </div>
          </div>
        </PageCard>
      </div>
    </div>
  );
}
