import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { useAdminEvents } from "../../../hooks/useEvents";
import { useOrgRegistrations } from "../../../hooks/useRegistrations";
import { useOrgDonations } from "../../../hooks/useDonations";
import { PageCard } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD } from "../../../lib/constants";
import {
  Calendar,
  Users,
  Heart,
  MessageSquare,
  Plus,
  ArrowRight,
  UserCheck,
  CheckCircle,
  FileText,
  LogOut,
  TrendingUp,
} from "lucide-react";

export function AdminDashboard() {
  const { profile, organization, signOut } = useAuth();
  const navigate = useNavigate();

  // Queries
  const { data: events, isLoading: eventsLoading } = useAdminEvents();
  const { data: registrations, isLoading: regsLoading } = useOrgRegistrations();
  const { data: donations, isLoading: donationsLoading } = useOrgDonations();

  const loading = eventsLoading || regsLoading || donationsLoading;

  // Compute metrics
  const activeEventsCount = events?.filter(e => e.status === "published").length ?? 0;
  const totalRegistrations = registrations?.length ?? 0;
  const totalDonations = donations?.reduce((acc, curr) => acc + Number(curr.amount), 0) ?? 0;
  const checkedInCount = registrations?.filter(r => r.status === "checked-in").length ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-[#17458F] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <NavBar organization={organization} currentPath={window.location.pathname} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: GOLD }}>
              ADMIN CONTROL CENTER
            </p>
            <h1 className="text-3xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Managing portal for <span className="font-semibold">{organization?.name}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <GoldButton onClick={() => navigate("/admin/events")} className="py-2.5 px-4 text-xs">
              <Plus size={14} /> Create Event
            </GoldButton>
            <OutlineButton onClick={signOut} className="py-2.5 px-4 text-xs text-destructive hover:bg-destructive/10 border-destructive/20">
              <LogOut size={14} /> Sign Out
            </OutlineButton>
          </div>
        </div>

        {/* Sidebar/Subnav layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Admin Navigation Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-2">
            <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase px-4 mb-2">Navigation</h3>
            {[
              { label: "Overview", to: "/admin/dashboard", active: true },
              { label: "Events", to: "/admin/events", active: false },
              { label: "Communications", to: "/admin/communications", active: false },
              { label: "Analytics", to: "/admin/analytics", active: false },
            ].map((navItem) => (
              <button
                key={navItem.label}
                onClick={() => navigate(navItem.to)}
                className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                  navItem.active
                    ? "bg-[#17458F] text-white shadow-sm"
                    : "hover:bg-muted text-foreground"
                }`}
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                {navItem.label}
              </button>
            ))}

            <div className="bg-muted/40 p-4 rounded-xl mt-6 border border-border/50 text-xs">
              <p className="font-semibold" style={{ color: NAVY }}>Public Portal</p>
              <p className="text-muted-foreground mt-1">Share this link with attendees to register:</p>
              <a
                href={`${window.location.origin}/org/${organization?.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block font-bold hover:underline break-all mt-2"
                style={{ color: GOLD }}
              >
                /org/{organization?.slug}
              </a>
            </div>
          </div>

          {/* Main Dashboard Panel */}
          <div className="lg:col-span-3 flex flex-col gap-8">
            {/* Stat widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Active Events", val: activeEventsCount, icon: Calendar, color: GOLD },
                { label: "Total Registrations", val: totalRegistrations, icon: Users, color: "#0067C8" },
                { label: "Checked In", val: `${checkedInCount}/${totalRegistrations}`, icon: UserCheck, color: "#48BB78" },
                { label: "Total Donations", val: `$${totalDonations.toFixed(2)}`, icon: Heart, color: "#E53E3E" },
              ].map((stat, idx) => (
                <PageCard key={idx} className="flex items-center gap-4 relative overflow-hidden group">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                    <stat.icon size={22} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase">{stat.label}</p>
                    <p className="text-lg font-black mt-1" style={{ color: NAVY }}>{stat.val}</p>
                  </div>
                </PageCard>
              ))}
            </div>

            {/* Main Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Recent registrations */}
              <PageCard>
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Users size={16} /> Recent Registrations
                  </h3>
                </div>

                {!registrations || registrations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No registrations recorded yet.</p>
                ) : (
                  <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
                    {registrations.slice(0, 10).map((r: any) => (
                      <div key={r.id} className="flex justify-between items-center p-3 rounded-xl bg-muted/30 border border-border/30 text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{r.full_name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {r.events?.title || "Event"}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                            r.status === "checked-in"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </PageCard>

              {/* Recent donations */}
              <PageCard>
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Heart size={16} /> Recent Donations
                  </h3>
                </div>

                {!donations || donations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No donations received yet.</p>
                ) : (
                  <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
                    {donations.slice(0, 10).map((d) => (
                      <div key={d.id} className="flex justify-between items-center p-3 rounded-xl bg-muted/30 border border-border/30 text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{d.full_name || "Anonymous Donor"}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {d.category ? DONATION_CATEGORIES.find(c => c.id === d.category)?.label : "General Allocation"}
                          </p>
                        </div>
                        <span className="font-bold text-[#17458F]">
                          +${d.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </PageCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DONATION_CATEGORIES = [
  { id: "community",    label: "Community Service Projects" },
  { id: "sponsorship",  label: "Event Sponsorship" },
  { id: "development",  label: "Club Development" },
  { id: "general",      label: "General Contribution" },
];
