import { useNavigate, useLocation } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { useAdminEvents } from "../../../hooks/useEvents";
import { useOrgRegistrations } from "../../../hooks/useRegistrations";
import { useOrgDonations } from "../../../hooks/useDonations";
import { NAVY, GOLD } from "../../../lib/constants";
import { RotaryLogo } from "../shared/RotaryLogo";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Heart,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  UserCheck,
  Globe,
  Bell,
  Search,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

// ─── Sidebar nav items ─────────────────────────────────────────────────────────
const MENU_ITEMS = [
  { label: "Dashboard",       to: "/admin/dashboard",       icon: LayoutDashboard },
  { label: "Events",          to: "/admin/events",          icon: Calendar },
  { label: "Communications",  to: "/admin/communications",  icon: MessageSquare },
  { label: "Analytics",       to: "/admin/analytics",       icon: BarChart3 },
];

export function AdminDashboard() {
  const { profile, organization, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: events,        isLoading: eventsLoading   } = useAdminEvents();
  const { data: registrations, isLoading: regsLoading     } = useOrgRegistrations();
  const { data: donations,     isLoading: donationsLoading } = useOrgDonations();

  const loading = eventsLoading || regsLoading || donationsLoading;

  const activeEventsCount  = events?.filter(e => e.status === "published").length ?? 0;
  const totalRegistrations = registrations?.length ?? 0;
  const totalDonations     = donations?.reduce((a, d) => a + Number(d.amount), 0) ?? 0;
  const checkedInCount     = registrations?.filter(r => r.status === "checked-in").length ?? 0;

  const initials = profile?.full_name
    ?.split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "AD";

  return (
    <div className="flex h-screen bg-[#f4f6fb] overflow-hidden">

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 h-full border-r border-border/60"
        style={{ background: "#fff" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border/40">
          {organization?.logo_url ? (
            <img src={organization.logo_url} className="h-12 w-auto object-contain rounded-md" alt={organization.name} />
          ) : (
            <RotaryLogo size={44} />
          )}
          <div className="leading-tight overflow-hidden">
            <p className="font-black text-xs truncate" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
              {organization?.name ?? "RotaryConnect"}
            </p>
            <p className="text-[10px] text-muted-foreground">Service Above Self</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">Menu</p>
          {MENU_ITEMS.map(({ label, to, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  active
                    ? "text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                style={{
                  background: active ? NAVY : undefined,
                  fontFamily: "Open Sans, sans-serif",
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}

          <div className="mt-6">
            <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">General</p>
            <button
              onClick={() => window.open(`/org/${organization?.slug}`, "_blank")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <Globe size={16} />
              Public Portal
            </button>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </nav>

        {/* User avatar card at bottom */}
        <div className="p-4 border-t border-border/40">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted transition-all cursor-default">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
              style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
            >
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-foreground truncate">{profile?.full_name ?? "Admin"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile?.role ?? "admin"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border/40 shrink-0">
          {/* Search */}
          <div className="flex items-center gap-2 bg-[#f4f6fb] rounded-xl px-4 py-2.5 w-64">
            <Search size={14} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Search…</span>
          </div>

          {/* Right: bell + avatar */}
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-xl bg-[#f4f6fb] flex items-center justify-center hover:bg-muted transition-all">
              <Bell size={16} className="text-muted-foreground" />
            </button>
            {/* Create event shortcut */}
            <button
              onClick={() => navigate("/admin/events")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: NAVY }}
            >
              <Plus size={14} />
              New Event
            </button>
            {/* Avatar */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black"
                style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
              >
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-foreground">{profile?.full_name ?? "Admin"}</p>
                <p className="text-[10px] text-muted-foreground">{organization?.name}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable page body */}
        <main className="flex-1 overflow-y-auto px-6 py-6">

          {/* Page heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Plan, manage and track your Rotary club with ease.
            </p>
          </div>

          {/* ── STAT CARDS ── */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-4 border-[#17458F] border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: "Active Events",
                    val:   activeEventsCount,
                    icon:  Calendar,
                    accent: GOLD,
                    bg:    `${GOLD}18`,
                    trend: "+1 this month",
                  },
                  {
                    label: "Registrations",
                    val:   totalRegistrations,
                    icon:  Users,
                    accent: "#0067C8",
                    bg:    "#0067C818",
                    trend: "Total attendees",
                  },
                  {
                    label: "Checked In",
                    val:   `${checkedInCount}/${totalRegistrations}`,
                    icon:  UserCheck,
                    accent: "#48BB78",
                    bg:    "#48BB7818",
                    trend: "At door",
                  },
                  {
                    label: "Total Donations",
                    val:   `$${totalDonations.toFixed(2)}`,
                    icon:  Heart,
                    accent: "#E53E3E",
                    bg:    "#E53E3E18",
                    trend: "Raised",
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: stat.bg, color: stat.accent }}
                      >
                        <stat.icon size={18} />
                      </div>
                      <ArrowUpRight size={14} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">{stat.label}</p>
                      <p className="text-2xl font-black mt-0.5" style={{ color: NAVY }}>{stat.val}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <TrendingUp size={10} className="text-emerald-500" />
                      {stat.trend}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── RECENT TABLES ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Recent Registrations */}
                <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <Users size={15} style={{ color: NAVY }} />
                      <h3 className="text-sm font-bold" style={{ color: NAVY }}>Recent Registrations</h3>
                    </div>
                    <button
                      onClick={() => navigate("/admin/events")}
                      className="text-[11px] font-bold hover:underline"
                      style={{ color: GOLD }}
                    >
                      View all
                    </button>
                  </div>
                  <div className="divide-y divide-border/30">
                    {!registrations || registrations.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-10 text-center">No registrations yet.</p>
                    ) : (
                      registrations.slice(0, 6).map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                              style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
                            >
                              {r.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">{r.full_name}</p>
                              <p className="text-[10px] text-muted-foreground">{r.events?.title ?? "Event"}</p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              r.status === "checked-in"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Donations */}
                <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <Heart size={15} style={{ color: "#E53E3E" }} />
                      <h3 className="text-sm font-bold" style={{ color: NAVY }}>Recent Donations</h3>
                    </div>
                    <button
                      onClick={() => navigate("/admin/analytics")}
                      className="text-[11px] font-bold hover:underline"
                      style={{ color: GOLD }}
                    >
                      View all
                    </button>
                  </div>
                  <div className="divide-y divide-border/30">
                    {!donations || donations.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-10 text-center">No donations yet.</p>
                    ) : (
                      donations.slice(0, 6).map((d) => (
                        <div key={d.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                              style={{ background: "linear-gradient(135deg,#E53E3E,#F56565)" }}
                            >
                              {(d.full_name ?? "A").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">{d.full_name ?? "Anonymous"}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {DONATION_CATEGORIES.find(c => c.id === d.category)?.label ?? "General Allocation"}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-black" style={{ color: "#17458F" }}>
                            +${Number(d.amount).toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
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
