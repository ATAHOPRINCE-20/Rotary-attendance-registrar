import { useNavigate, useParams, Navigate } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { RotaryLogo } from "../shared/RotaryLogo";
import { PageCard } from "../shared/PageCard";
import { GOLD, NAVY, parseOrgWebsite } from "../../../lib/constants";
import { Calendar, Heart, ShieldAlert } from "lucide-react";

import { LoadingScreen } from "../shared/LoadingScreen";

export function TenantLandingPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const { organization, loading, notFound } = useTenant();

  if (loading) {
    return <LoadingScreen variant="blue" />;
  }

  if (notFound || !organization) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#081c3b] to-[#0d2c54] px-4">
        <PageCard className="max-w-md w-full text-center flex flex-col items-center gap-4 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl p-8 border border-white/10">
          <ShieldAlert className="w-16 h-16 text-destructive" />
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Club Not Found</h1>
          <p className="text-muted-foreground text-sm">
            We couldn't find a Rotary Club corresponding to "/org/{slug}".
          </p>
          <button 
            onClick={() => navigate("/")} 
            className="w-full py-2.5 bg-[#F7A81B] hover:bg-[#e09412] text-white font-bold rounded-xl shadow-lg transition-all text-center cursor-pointer"
          >
            Go to Homepage
          </button>
        </PageCard>
      </div>
    );
  }

  const { activeEventId } = parseOrgWebsite(organization.website);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#081c3b] via-[#0d2c54] to-[#17458F] overflow-hidden flex items-center py-16 px-6 sm:px-12 lg:px-24">
      {/* Giant faint background logo */}
      <div className="absolute -right-48 -bottom-48 opacity-[0.03] pointer-events-none select-none text-white w-[800px] h-[800px] flex items-center justify-center">
        <RotaryLogo size={800} />
      </div>

      {/* Decorative gradient blob */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[40%] h-[40%] rounded-full bg-amber-500/5 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center relative z-10">
        
        {/* Left Content Column */}
        <div className="lg:col-span-7 flex flex-col items-start text-left relative z-20">
          
          {/* Logo container */}
          <div className="mb-6">
            <RotaryLogo size={64} />
          </div>

          {/* Top small category */}
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-[2px]" style={{ backgroundColor: GOLD }} />
            <span 
              className="text-xs uppercase tracking-[0.25em] font-extrabold"
              style={{ color: GOLD }}
            >
              {organization.district 
                ? `District ${organization.district} • ${organization.country || "Global"}` 
                : "Rotary Connect Partner"
              }
            </span>
          </div>

          {/* Main Title */}
          <h1 className="font-heading font-black text-4xl sm:text-5xl md:text-6xl leading-[1.1] text-white tracking-tight mb-6">
            {organization.name}
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-blue-100/80 font-normal leading-relaxed max-w-xl mb-8">
            Welcome to our official hub. Explore upcoming events, register attendance, or support our community service projects.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            {activeEventId ? (
              <button
                onClick={() => navigate(`/org/${slug}/register/${activeEventId}`)}
                className="px-8 py-2.5 bg-[#F7A81B] hover:bg-[#e09412] text-white font-bold rounded-xl shadow-lg shadow-orange-500/15 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 text-center flex items-center justify-center gap-2 cursor-pointer animate-pulse"
              >
                <Calendar size={18} />
                Register Attendance
              </button>
            ) : (
              <button
                onClick={() => navigate(`/org/${slug}/events`)}
                className="px-8 py-2.5 bg-[#F7A81B] hover:bg-[#e09412] text-white font-bold rounded-xl shadow-lg shadow-orange-500/15 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 text-center flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar size={18} />
                View Events
              </button>
            )}
            <button
              disabled
              className="px-8 py-2.5 border border-white/10 text-white/40 bg-white/5 backdrop-blur-md font-semibold rounded-xl text-center flex items-center justify-center gap-2 cursor-not-allowed opacity-50"
              title="Donations are temporarily offline"
            >
              <Heart size={18} />
              Support / Donate (Offline)
            </button>
          </div>
        </div>

        {/* Right Photo Grid Column */}
        <div className="lg:col-span-5 w-full mt-12 lg:mt-0">
          <div className="grid grid-cols-2 gap-4 md:gap-6 items-start">
            
            {/* Left Masonry Column */}
            <div className="flex flex-col gap-4 md:gap-6 pt-10 md:pt-16">
              {/* Card 1: Volunteer (Tall) */}
              <div className="relative aspect-[3/4] overflow-hidden rounded-[24px] shadow-2xl border border-white/5 hover:border-white/15 transition-all duration-500 hover:scale-[1.03] hover:shadow-orange-500/5 group">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent z-10" />
                <img
                  src="/assets/landing/volunteer_leader.png"
                  alt="Volunteer Leader"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              {/* Card 3: Team Sunset (Wide) */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] shadow-2xl border border-white/5 hover:border-white/15 transition-all duration-500 hover:scale-[1.03] hover:shadow-orange-500/5 group">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent z-10" />
                <img
                  src="/assets/landing/team_sunset.png"
                  alt="Team Sunset"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            </div>

            {/* Right Masonry Column */}
            <div className="flex flex-col gap-4 md:gap-6">
              {/* Card 2: Community Gathering (Wide) */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] shadow-2xl border border-white/5 hover:border-white/15 transition-all duration-500 hover:scale-[1.03] hover:shadow-orange-500/5 group">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent z-10" />
                <img
                  src="/assets/landing/community_gathering.png"
                  alt="Community Gathering"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              {/* Card 4: Make a Change (Tall) */}
              <div className="relative aspect-[3/4] overflow-hidden rounded-[24px] shadow-2xl border border-white/5 hover:border-white/15 transition-all duration-500 hover:scale-[1.03] hover:shadow-orange-500/5 group">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent z-10" />
                <img
                  src="/assets/landing/make_a_change.png"
                  alt="Make a Change"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
