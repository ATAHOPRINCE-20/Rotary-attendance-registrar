import { useSearchParams, useNavigate, useParams } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { useRegistrationByQR } from "../../../hooks/useRegistrations";
import { PageCard } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY } from "../../../lib/constants";
import { CheckCircle2, Heart, AlertCircle, Calendar, BookOpen } from "lucide-react";
import { LoadingScreen } from "../shared/LoadingScreen";
import { getTenantBase } from "../../../lib/subdomain";

export function PostRegisterPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qrRef = searchParams.get("ref");
  const base = getTenantBase(slug);

  const { organization, loading: tenantLoading } = useTenant();
  const { data: registrationData, isLoading: regLoading, error } = useRegistrationByQR(qrRef || undefined);
  const registration = registrationData as any;

  const loading = tenantLoading || regLoading;

  if (loading) {
    return <LoadingScreen variant="blue" />;
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
          <GoldButton onClick={() => navigate(`${base}/events`)} className="w-full justify-center">
            Go to Events
          </GoldButton>
        </PageCard>
      </div>
    );
  }

  // The check-in QR code contains the unique code. The admin check-in interface will scan this code
  const qrValue = registration.qr_ref;

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <NavBar organization={organization} currentPath={window.location.pathname} />

      <div className="max-w-md mx-auto px-4">
        <PageCard className="text-center flex flex-col items-center gap-4 p-5 sm:p-6 shadow-xl border-border/80">
          {/* Status Header */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-black tracking-tight" style={{ color: NAVY }}>
              Attendance Registered!
            </h1>
            <p className="text-xs text-muted-foreground">
              Thank you, <strong className="text-foreground">{registration.full_name}</strong>.
            </p>
          </div>

          {/* Ticket Pass Details */}
          <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs flex flex-col gap-1.5 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#17458F]/5 rounded-bl-full pointer-events-none" />
            
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Event Pass</span>
            <p className="font-extrabold text-sm leading-snug" style={{ color: NAVY }}>
              {registration.events?.title}
            </p>

            {registration.board_role && (
              <div className="my-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#F7A81B] text-[#081c3b]">
                  Board Capacity: {registration.board_role}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-0.5 text-muted-foreground mt-1 pt-2 border-t border-slate-200">
              {registration.events?.date && (
                <p><strong>Date:</strong> {new Date(registration.events.date).toLocaleString()}</p>
              )}
              {registration.events?.location && (
                <p><strong>Venue:</strong> {registration.events.location}</p>
              )}
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-1">
            <button
              onClick={() => navigate(`${base}/monthly-program`)}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-[#17458F] hover:bg-[#10346e] transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <BookOpen size={14} /> Monthly Program
            </button>

            <button
              onClick={() => navigate(`${base}/donate?reg_id=${registration.id}`)}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-slate-900 bg-[#F7A81B] hover:bg-[#e09412] transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Heart size={14} /> Donate to Projects
            </button>
          </div>

          {/* Secondary Links */}
          <div className="flex items-center justify-between w-full pt-3 border-t border-border text-xs">
            <button 
              onClick={() => navigate(`${base}/register/${registration.event_id}?edit=${registration.qr_ref}`)} 
              className="text-muted-foreground hover:text-foreground underline font-medium cursor-pointer"
            >
              Edit Registration
            </button>
            <button 
              onClick={() => navigate(`${base}/events`)} 
              className="text-[#17458F] font-bold hover:underline cursor-pointer"
            >
              Explore Other Events →
            </button>
          </div>
        </PageCard>
      </div>
    </div>
  );
}
