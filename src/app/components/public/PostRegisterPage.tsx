import { useSearchParams, useNavigate, useParams } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { useRegistrationByQR } from "../../../hooks/useRegistrations";
import { PageCard } from "../shared/PageCard";
import { GoldButton, NavyButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD } from "../../../lib/constants";
import { CheckCircle2, QrCode, Heart, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export function PostRegisterPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qrRef = searchParams.get("ref");

  const { organization, loading: tenantLoading } = useTenant();
  const { data: registration, isLoading: regLoading, error } = useRegistrationByQR(qrRef || undefined);

  const loading = tenantLoading || regLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-[#17458F] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageCard className="text-center max-w-sm flex flex-col gap-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>Registration Not Found</h2>
          <p className="text-sm text-muted-foreground">
            We couldn't retrieve your registration details. Check your ticket link.
          </p>
          <GoldButton onClick={() => navigate(`/org/${slug}/events`)} className="w-full justify-center">
            Go to Events
          </GoldButton>
        </PageCard>
      </div>
    );
  }

  // The check-in QR code contains the unique code. The admin check-in interface will scan this code
  const qrValue = registration.qr_ref;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <NavBar organization={organization} currentPath={window.location.pathname} />

      <div className="max-w-md mx-auto px-4">
        <PageCard className="text-center flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="w-16 h-16 text-[#48BB78] animate-bounce" />
            <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
              Checked In Successfully!
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome, <strong style={{ color: NAVY }}>{registration.full_name}</strong>. You are all set!
            </p>
          </div>

          <div className="bg-muted/30 p-6 rounded-2xl border border-border w-full flex flex-col items-center gap-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              YOUR PERSONAL ATTENDANCE TICKET
            </p>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-border">
              <QRCodeSVG value={qrValue} size={180} level="H" includeMargin={false} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold" style={{ color: NAVY }}>
                Ticket ID: {registration.qr_ref}
              </p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                ✓ Registered & Checked In
              </p>
            </div>
          </div>

          <div className="w-full text-left bg-muted/20 p-4 rounded-xl border border-border/50 text-sm flex flex-col gap-2">
            <p className="font-semibold" style={{ color: NAVY }}>
              Event: {registration.events?.title}
            </p>
            {registration.events?.date && (
              <p className="text-xs text-muted-foreground">
                Date: {new Date(registration.events.date).toLocaleString()}
              </p>
            )}
            {registration.events?.location && (
              <p className="text-xs text-muted-foreground">
                Venue: {registration.events.location}
              </p>
            )}
          </div>

          {/* Call to action for Donations */}
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 w-full flex flex-col gap-3 items-center">
            <p className="text-xs font-bold text-center" style={{ color: NAVY }}>
              SUPPORT OUR COMMUNITY PROJECTS
            </p>
            <p className="text-xs text-muted-foreground text-center">
              If you wish to make a voluntary contribution, you can support our upcoming charity campaigns.
            </p>
            <GoldButton
              onClick={() => navigate(`/org/${slug}/donate?reg_id=${registration.id}`)}
              className="w-full justify-center flex items-center gap-2 py-2.5"
            >
              <Heart size={16} /> Make a Donation
            </GoldButton>
          </div>

          <OutlineButton onClick={() => navigate(`/org/${slug}/events`)} className="w-full justify-center">
            Explore Other Events
          </OutlineButton>
        </PageCard>
      </div>
    </div>
  );
}
