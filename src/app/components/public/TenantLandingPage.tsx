import { useNavigate, useParams } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { RotaryLogo } from "../shared/RotaryLogo";
import { GoldButton, NavyButton } from "../shared/Buttons";
import { PageCard } from "../shared/PageCard";
import { NAVY } from "../../../lib/constants";
import { Calendar, Heart, ShieldAlert } from "lucide-react";

export function TenantLandingPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const { organization, loading, notFound } = useTenant();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-[#17458F] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !organization) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <PageCard className="max-w-md w-full text-center flex flex-col items-center gap-4">
          <ShieldAlert className="w-16 h-16 text-destructive" />
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Club Not Found</h1>
          <p className="text-muted-foreground text-sm">
            We couldn't find a Rotary Club corresponding to "/org/{slug}".
          </p>
          <GoldButton onClick={() => navigate("/")} className="w-full justify-center">
            Go to Homepage
          </GoldButton>
        </PageCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#f0f4fa] to-[#e8edf5] px-4 py-8">
      <div className="w-full max-w-xl text-center flex flex-col items-center gap-6">
        {organization.logo_url ? (
          <img
            src={organization.logo_url}
            alt={organization.name}
            className="max-w-[480px] max-h-[200px] object-contain mx-auto mb-2"
          />
        ) : (
          <RotaryLogo size={80} />
        )}

        {!organization.logo_url && (
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
              {organization.name}
            </h1>
            {organization.district && (
              <p className="text-sm font-bold tracking-wider uppercase text-muted-foreground">
                District {organization.district} • {organization.country || "Global"}
              </p>
            )}
          </div>
        )}

        <p className="text-base text-muted-foreground leading-relaxed max-w-md">
          Welcome to our official hub. Explore upcoming events, register attendance, or support our community service projects.
        </p>

        <PageCard className="w-full mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GoldButton
              onClick={() => navigate(`/org/${slug}/events`)}
              className="w-full justify-center py-4 flex items-center gap-2"
            >
              <Calendar size={18} />
              View Events
            </GoldButton>
            <NavyButton
              onClick={() => navigate(`/org/${slug}/donate`)}
              className="w-full justify-center py-4 flex items-center gap-2"
            >
              <Heart size={18} />
              Support/Donate
            </NavyButton>
          </div>
        </PageCard>

        {organization.website && (
          <a
            href={organization.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold hover:underline transition-all mt-4"
            style={{ color: NAVY }}
          >
            Visit Our Main Website
          </a>
        )}
      </div>
    </div>
  );
}
