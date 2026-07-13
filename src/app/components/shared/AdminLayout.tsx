import { useNavigate, useLocation } from "react-router";
import { ReactNode, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { RotaryLogo } from "./RotaryLogo";
import { NAVY, GOLD } from "../../../lib/constants";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  BarChart3,
  Globe,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  Users,
  FolderArchive,
  Wallet,
  BookOpen,
  ShieldCheck,
  Heart,
  Building,
} from "lucide-react";

const SupportIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Headset Arc */}
    <path d="M4 14c0-4.42 3.58-8 8-8s8 3.58 8 8" />
    {/* Left Earpad */}
    <rect x="2" y="11" width="4" height="6" rx="2" fill="white" />
    {/* Right Earpad */}
    <rect x="18" y="11" width="4" height="6" rx="2" fill="white" />
    {/* Orange Microphone stem */}
    <path d="M19 16c0 2-2 3.5-4 3.5" stroke="#F97316" strokeWidth="3" />
  </svg>
);

interface AdminLayoutProps {
  children: ReactNode;
  /** Label shown in the top-bar (e.g. "Events") */
  pageTitle?: string;
  /** Slot for primary action button in the top-bar */
  actions?: ReactNode;
}

export function AdminLayout({ children, pageTitle, actions }: AdminLayoutProps) {
  const { profile, organization, signOut, impersonatedOrgId, impersonateOrganization } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { label: "Dashboard",       to: "/admin/dashboard",      icon: LayoutDashboard },
    ...(profile?.role === "super_admin" ? [
      { label: "Tenants Directory", to: "/admin/tenants",        icon: Building        },
    ] : []),
    { label: "Events",          to: "/admin/events",         icon: Calendar        },
    { label: "Reports Archive", to: "/admin/reports",        icon: FolderArchive   },
    { label: "Members",         to: "/admin/members",        icon: Users           },
    { label: "Directory",       to: "/admin/directory",      icon: BookOpen        },
    ...(profile?.role !== "staff" ? [
      { label: "Donation Campaigns", to: "/admin/donation-campaigns", icon: Heart        },
      { label: "Withdrawals",    to: "/admin/withdrawals",    icon: Wallet          },
      { label: "Communications", to: "/admin/communications", icon: MessageSquare   },
      { label: "Analytics",      to: "/admin/analytics",      icon: BarChart3       },
      { label: "Team",           to: "/admin/team",           icon: ShieldCheck     },
    ] : []),
  ];

  const initials = profile?.full_name
    ?.split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "AD";

  return (
    <div className="flex h-screen bg-[#f4f6fb] overflow-hidden">

      {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-full border-r border-border/60 bg-white">

        {/* Logo */}
        <div className="flex flex-col items-center justify-center px-5 py-6 border-b border-border/40 min-h-[110px]">
          <RotaryLogo size={56} />
          <p
            className="font-extrabold text-xs mt-3 tracking-wider uppercase text-center truncate max-w-[200px]"
            style={{ color: NAVY, fontFamily: "var(--font-sans)" }}
          >
            {organization?.name ?? "agoroll"}
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">
            Menu
          </p>
          {menuItems.map(({ label, to, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  active
                    ? "bg-muted text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}

          <div className="mt-6">
            <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">
              General
            </p>
            <button
              onClick={() => window.open(`/org/${organization?.slug}`, "_blank")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <Globe size={16} />
              Public Portal
            </button>
            <a
              href="https://wa.me/256757136062"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <SupportIcon size={16} />
              System Support
            </a>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </nav>

        {/* User card */}
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

      {/* ── CONTENT ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {impersonatedOrgId && (
          <div className="bg-amber-500 text-white text-xs font-bold px-6 py-2 flex items-center justify-between shrink-0 shadow-sm z-50">
            <span className="flex items-center gap-1.5">
              <span>⚠️</span>
              You are currently viewing and managing <strong>{organization?.name}</strong> as an administrator.
            </span>
            <button
              onClick={() => {
                impersonateOrganization(null);
                navigate("/admin/tenants");
              }}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-all text-[11px] font-extrabold uppercase tracking-wide cursor-pointer"
            >
              Stop Impersonation
            </button>
          </div>
        )}

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            {/* Hamburger button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 mr-1 rounded-xl bg-[#f4f6fb] hover:bg-muted text-foreground transition-all"
              title="Open menu"
            >
              <Menu size={18} />
            </button>
            {/* Search */}
            <div className="hidden sm:flex items-center gap-2 bg-[#f4f6fb] rounded-xl px-4 py-2.5 w-52">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">{pageTitle ?? "Search…"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Injected action buttons */}
            {actions}
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden bg-white/95 backdrop-blur-md border-t border-border/50 shrink-0 px-2 py-2 flex items-center justify-around pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)]">
          {[
            { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
            { label: "Events",    to: "/admin/events",    icon: Calendar        },
            { label: "Members",   to: "/admin/members",   icon: Users           },
            { label: "Directory", to: "/admin/directory", icon: BookOpen        },
          ].map(({ label, to, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer"
                style={{
                  color: active ? NAVY : "#64748B",
                }}
              >
                <Icon size={18} className={active ? "scale-110 transition-transform" : ""} style={{ strokeWidth: active ? 2.5 : 2 }} />
                <span className="text-[9px] font-bold" style={{ fontFamily: "var(--font-sans)" }}>
                  {label}
                </span>
              </button>
            );
          })}
          
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[#64748B] hover:text-foreground transition-all duration-200 cursor-pointer"
          >
            <Menu size={18} />
            <span className="text-[9px] font-bold" style={{ fontFamily: "var(--font-sans)" }}>
              More
            </span>
          </button>
        </nav>
      </div>

      {/* ── MOBILE DRAWER OVERLAY ────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex bg-black/50 backdrop-blur-sm animate-in fade-in">
          {/* Drawer Panel */}
          <aside className="w-60 h-full bg-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Logo & Close button */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-border/40">
              <div className="flex-1 flex items-center justify-center gap-2">
                <RotaryLogo size={36} />
                <p className="font-extrabold text-xs uppercase truncate max-w-[140px]" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                  {organization?.name ?? "agoroll"}
                </p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0 ml-2"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
              <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">
                Menu
              </p>
              {menuItems.map(({ label, to, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <button
                    key={to}
                    onClick={() => {
                      navigate(to);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      active
                        ? "bg-muted text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                );
              })}

              <div className="mt-6">
                <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">
                  General
                </p>
                <button
                  onClick={() => {
                    window.open(`/org/${organization?.slug}`, "_blank");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  <Globe size={16} />
                  Public Portal
                </button>
                <a
                  href="https://wa.me/256757136062"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  <SupportIcon size={16} />
                  System Support
                </a>
                <button
                  onClick={() => {
                    signOut();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </nav>

            {/* User card */}
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

          {/* Click outside to close area */}
          <div className="flex-1 bg-transparent" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}
