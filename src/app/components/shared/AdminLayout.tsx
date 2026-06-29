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
} from "lucide-react";

const MENU_ITEMS = [
  { label: "Dashboard",      to: "/admin/dashboard",      icon: LayoutDashboard },
  { label: "Events",         to: "/admin/events",         icon: Calendar        },
  { label: "Reports Archive", to: "/admin/reports",        icon: FolderArchive   },
  { label: "Members",        to: "/admin/members",        icon: Users           },
  { label: "Communications", to: "/admin/communications", icon: MessageSquare   },
  { label: "Analytics",      to: "/admin/analytics",      icon: BarChart3       },
];

interface AdminLayoutProps {
  children: ReactNode;
  /** Label shown in the top-bar (e.g. "Events") */
  pageTitle?: string;
  /** Slot for primary action button in the top-bar */
  actions?: ReactNode;
}

export function AdminLayout({ children, pageTitle, actions }: AdminLayoutProps) {
  const { profile, organization, signOut } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}
          >
            {organization?.name ?? "RotaryConnect"}
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">
            Menu
          </p>
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
                style={{ background: active ? NAVY : undefined }}
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
                <p className="font-extrabold text-xs uppercase truncate max-w-[140px]" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
                  {organization?.name ?? "RotaryConnect"}
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
              {MENU_ITEMS.map(({ label, to, icon: Icon }) => {
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
                        ? "text-white shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    style={{ background: active ? NAVY : undefined }}
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
