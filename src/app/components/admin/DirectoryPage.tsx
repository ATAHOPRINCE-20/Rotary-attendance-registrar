import { useState, useMemo, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useOrgMembers } from "../../../hooks/useMembers";
import { useOrgRegistrations } from "../../../hooks/useRegistrations";
import { AdminLayout } from "../shared/AdminLayout";
import { NAVY, GOLD } from "../../../lib/constants";
import {
  Users,
  UserCheck,
  Search,
  Mail,
  Phone,
  Calendar,
  Grid3x3,
  Filter,
  Download,
  ChevronDown,
} from "lucide-react";
import { LoadingScreen } from "../shared/LoadingScreen";

type Tab = "members" | "rotarians" | "visitors";

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  rotarian: { label: "Rotarian",    color: "#17458F", bg: "#17458F12" },
  club_member: { label: "Club Member", color: "#0067C8", bg: "#0067C812" },
  guest:    { label: "Guest",       color: "#64748B", bg: "#64748B12" },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarGradient(name: string) {
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(1 % name.length) * 13) % 360;
  return `linear-gradient(135deg, hsl(${hue},60%,35%), hsl(${(hue + 40) % 360},60%,50%))`;
}

// ─── Download helpers ──────────────────────────────────────────────────────────
function downloadCsv(rows: string[][], filename: string) {
  const content = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function DirectoryPage() {
  const { organization } = useAuth();

  const { data: members, isLoading: membersLoading } = useOrgMembers(organization?.id);
  const { data: registrations, isLoading: regsLoading } = useOrgRegistrations(organization?.id);

  const [tab, setTab] = useState<Tab>("members");
  const [searchQuery, setSearchQuery] = useState("");

  const loading = membersLoading || regsLoading;

  const tabsRef = useRef<HTMLDivElement>(null);

  const scrollTabIntoView = (tabId: Tab) => {
    const container = tabsRef.current;
    if (!container) return;

    const button = container.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement;
    if (!button) return;

    if (tabId === "members") {
      container.scrollTo({ left: 0, behavior: "smooth" });
    } else if (tabId === "rotarians") {
      const membersButton = container.querySelector(`[data-tab-id="members"]`) as HTMLElement;
      const scrollAmount = membersButton ? membersButton.offsetWidth : 80;
      container.scrollTo({ left: scrollAmount, behavior: "smooth" });
    } else if (tabId === "visitors") {
      container.scrollTo({ left: container.scrollWidth, behavior: "smooth" });
    }
  };

  // ── Deduplicated visitors list built from registrations ──────────────────────
  // Group by email/phone to de-duplicate across multiple events, keeping visit count
  const visitorsMap = useMemo(() => {
    if (!registrations) return [];
    const map = new Map<string, {
      key: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      reg_type: string;
      club_name: string | null;
      district: string | null;
      buddy_group: string | null;
      visits: number;
      lastVisit: string;
      eventTitles: string[];
    }>();

    registrations.forEach((r: any) => {
      const key = r.email?.toLowerCase() || r.phone || `${r.full_name?.toLowerCase()}-${r.event_id}`;
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.visits += 1;
        if (r.created_at > existing.lastVisit) existing.lastVisit = r.created_at;
        const title = r.events?.title;
        if (title && !existing.eventTitles.includes(title)) {
          existing.eventTitles.push(title);
        }
      } else {
        map.set(key, {
          key,
          full_name: r.full_name,
          email: r.email,
          phone: r.phone,
          reg_type: r.is_member
            ? (r.club_name && r.club_name.trim() ? "rotarian" : "club_member")
            : "guest",
          club_name: r.club_name,
          district: r.district,
          buddy_group: r.buddy_group,
          visits: 1,
          lastVisit: r.created_at,
          eventTitles: r.events?.title ? [r.events.title] : [],
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
  }, [registrations]);

  // ── Filtered Members ──────────────────────────────────────────────────────────
  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (members ?? []).filter((m) =>
      m.full_name.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.phone && m.phone.toLowerCase().includes(q)) ||
      (m.buddy_group && m.buddy_group.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  // ── Filtered Visiting Rotarians ──────────────────────────────────────────────
  const filteredRotarians = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return visitorsMap
      .filter((v) => v.reg_type === "rotarian")
      .filter((v) =>
        v.full_name.toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.phone && v.phone.toLowerCase().includes(q)) ||
        (v.club_name && v.club_name.toLowerCase().includes(q)) ||
        (v.district && v.district.toLowerCase().includes(q))
      );
  }, [visitorsMap, searchQuery]);

  // ── Filtered Guests ──────────────────────────────────────────────────────────
  const filteredGuests = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return visitorsMap
      .filter((v) => v.reg_type === "guest")
      .filter((v) =>
        v.full_name.toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.phone && v.phone.toLowerCase().includes(q))
      );
  }, [visitorsMap, searchQuery]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalMembers = members?.length ?? 0;
  const totalVisitors = visitorsMap.length;
  const rotarianVisitors = visitorsMap.filter((v) => v.reg_type === "rotarian").length;
  const guestVisitors = visitorsMap.filter((v) => v.reg_type === "guest").length;

  // ── Export CSV ───────────────────────────────────────────────────────────────
  function handleExport() {
    if (tab === "members") {
      const rows = [
        ["Full Name", "Email", "Phone", "Buddy Group", "Member Since"],
        ...(filteredMembers.map((m) => [
          m.full_name, m.email ?? "", m.phone ?? "",
          m.buddy_group ?? "", new Date(m.created_at).toLocaleDateString(),
        ])),
      ];
      downloadCsv(rows, "members-directory.csv");
    } else if (tab === "rotarians") {
      const rows = [
        ["Full Name", "Email", "Phone", "Club", "District", "Total Visits", "Last Visit", "Events Attended"],
        ...(filteredRotarians.map((v) => [
          v.full_name, v.email ?? "", v.phone ?? "",
          v.club_name ?? "", v.district ?? "",
          String(v.visits), new Date(v.lastVisit).toLocaleDateString(),
          v.eventTitles.join(" | "),
        ])),
      ];
      downloadCsv(rows, "visiting-rotarians-directory.csv");
    } else {
      const rows = [
        ["Full Name", "Email", "Phone", "Total Visits", "Last Visit", "Events Attended"],
        ...(filteredGuests.map((v) => [
          v.full_name, v.email ?? "", v.phone ?? "",
          String(v.visits), new Date(v.lastVisit).toLocaleDateString(),
          v.eventTitles.join(" | "),
        ])),
      ];
      downloadCsv(rows, "visitors-directory.csv");
    }
  }

  return (
    <AdminLayout
      pageTitle="Directory"
      actions={
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#F4F6FB] border border-border hover:bg-muted text-foreground transition-all cursor-pointer"
        >
          <Download size={13} /> Export CSV
        </button>
      }
    >
      {/* ── PAGE HEADER ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
          Club Directory
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          A complete record of Rotarians, club members, and guests who have attended events.
        </p>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Members on Record",  val: totalMembers,     icon: Users,      accent: NAVY,      bg: `${NAVY}12`     },
          { label: "Unique Visitors",     val: totalVisitors,   icon: UserCheck,  accent: "#0067C8", bg: "#0067C812"     },
          { label: "Rotarian Visitors",   val: rotarianVisitors,icon: Grid3x3,    accent: GOLD,      bg: `${GOLD}12`     },
          { label: "Guest Visitors",      val: guestVisitors,   icon: Calendar,   accent: "#10B981", bg: "#10B98112"     },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-4 border border-border/40 shadow-sm flex items-center gap-3"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: s.bg, color: s.accent }}
            >
              <s.icon size={17} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase leading-tight">{s.label}</p>
              <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">

        {/* Tab bar + search + filter */}
        <div className="border-b border-border/40 px-5 pt-4 pb-0 flex flex-col sm:flex-row sm:items-end gap-3">
          {/* Tabs */}
          <div ref={tabsRef} className="flex gap-1 overflow-x-auto scrollbar-none shrink-0 max-w-full -mx-5 px-5 sm:mx-0 sm:px-0">
            {[
              { id: "members"   as Tab, label: "Members",            icon: Users },
              { id: "rotarians" as Tab, label: "Visiting Rotarians", icon: Grid3x3 },
              { id: "visitors"  as Tab, label: "Guests / Visitors",  icon: UserCheck },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-tab-id={id}
                onClick={() => {
                  setTab(id);
                  setSearchQuery("");
                  scrollTabIntoView(id);
                }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  tab === id
                    ? "border-[#17458F] text-[#17458F] bg-[#17458F]/5"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={13} />
                {label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  tab === id ? "bg-[#17458F] text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {id === "members" ? totalMembers : id === "rotarians" ? rotarianVisitors : guestVisitors}
                </span>
              </button>
            ))}
          </div>

          {/* Search row */}
          <div className="flex gap-2 sm:ml-auto pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
              <input
                type="text"
                placeholder="Search directory…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs rounded-xl border border-border bg-[#f4f6fb] focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 w-48 transition-all"
              />
            </div>
          </div>
        </div>

        {/* ── TABLE BODY ── */}
        {loading ? (
          <LoadingScreen variant="light" fullScreen={false} />
        ) : tab === "members" ? (
          // ── MEMBERS TABLE ───────────────────────────────────────────────────
          filteredMembers.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-foreground">No members found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchQuery ? "Try adjusting your search." : "Add members from the Members page."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Desktop */}
              <table className="hidden sm:table w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="px-6 py-4">Member</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Buddy Group</th>
                    <th className="px-6 py-4">On Record Since</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0"
                            style={{ background: avatarGradient(m.full_name) }}
                          >
                            {getInitials(m.full_name)}
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{m.full_name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              ID: {m.id.substring(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          {m.email ? (
                            <span className="flex items-center gap-1.5 text-foreground">
                              <Mail size={11} className="text-muted-foreground" /> {m.email}
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground/50">No email</span>
                          )}
                          {m.phone ? (
                            <span className="flex items-center gap-1.5 text-foreground">
                              <Phone size={11} className="text-muted-foreground" /> {m.phone}
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground/50">No phone</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {m.buddy_group ? (
                          <span
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold border"
                            style={{ color: NAVY, borderColor: `${NAVY}30`, background: `${NAVY}08` }}
                          >
                            {m.buddy_group}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/50">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-border/30">
                {filteredMembers.map((m) => (
                  <div key={m.id} className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0"
                        style={{ background: avatarGradient(m.full_name) }}
                      >
                        {getInitials(m.full_name)}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{m.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {m.buddy_group ?? "No table"} · Since {new Date(m.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 pl-12">
                      {m.email && <span className="flex items-center gap-1.5 text-xs text-foreground"><Mail size={10} />{m.email}</span>}
                      {m.phone && <span className="flex items-center gap-1.5 text-xs text-foreground"><Phone size={10} />{m.phone}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : tab === "rotarians" ? (
          // ── VISITING ROTARIANS TABLE ────────────────────────────────────────
          filteredRotarians.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-foreground">No visiting Rotarians found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchQuery ? "Try adjusting your search." : "Visiting Rotarians will appear here after they register for events."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Desktop */}
              <table className="hidden sm:table w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="px-6 py-4">Rotarian</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Club / District</th>
                    <th className="px-6 py-4">Visits</th>
                    <th className="px-6 py-4">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredRotarians.map((v) => (
                    <tr key={v.key} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0"
                            style={{ background: avatarGradient(v.full_name) }}
                          >
                            {getInitials(v.full_name)}
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{v.full_name}</p>
                            {v.eventTitles.length > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[180px] truncate" title={v.eventTitles.join(", ")}>
                                {v.eventTitles[0]}{v.eventTitles.length > 1 ? ` +${v.eventTitles.length - 1}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          {v.email ? (
                            <span className="flex items-center gap-1.5 text-foreground">
                              <Mail size={11} className="text-muted-foreground" />{v.email}
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground/50">No email</span>
                          )}
                          {v.phone ? (
                            <span className="flex items-center gap-1.5 text-foreground">
                              <Phone size={11} className="text-muted-foreground" />{v.phone}
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground/50">No phone</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          {v.club_name && <span className="font-semibold text-foreground">{v.club_name}</span>}
                          {v.district && <span className="text-muted-foreground">{v.district}</span>}
                          {!v.club_name && !v.district && (
                            <span className="italic text-muted-foreground/50">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-black text-white"
                          style={{ background: v.visits > 1 ? GOLD : `${NAVY}40` }}
                          title={`${v.visits} event${v.visits !== 1 ? "s" : ""}`}
                        >
                          {v.visits}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(v.lastVisit).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-border/30">
                {filteredRotarians.map((v) => (
                  <div key={v.key} className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0"
                          style={{ background: avatarGradient(v.full_name) }}
                        >
                          {getInitials(v.full_name)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{v.full_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {v.club_name ?? ""}{v.district ? ` · ${v.district}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground shrink-0 font-semibold">
                        {v.visits} visit{v.visits !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 pl-12">
                      {v.email && <span className="flex items-center gap-1.5 text-xs text-foreground"><Mail size={10} />{v.email}</span>}
                      {v.phone && <span className="flex items-center gap-1.5 text-xs text-foreground"><Phone size={10} />{v.phone}</span>}
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        Last: {new Date(v.lastVisit).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          // ── GUESTS / VISITORS TABLE ─────────────────────────────────────────
          filteredGuests.length === 0 ? (
            <div className="text-center py-16 px-4">
              <UserCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-foreground">No guest visitors found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchQuery ? "Try adjusting your search." : "Visitors will appear here after they register for events."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Desktop */}
              <table className="hidden sm:table w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="px-6 py-4">Visitor</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Visits</th>
                    <th className="px-6 py-4">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredGuests.map((v) => (
                    <tr key={v.key} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0"
                            style={{ background: avatarGradient(v.full_name) }}
                          >
                            {getInitials(v.full_name)}
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{v.full_name}</p>
                            {v.eventTitles.length > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[180px] truncate" title={v.eventTitles.join(", ")}>
                                {v.eventTitles[0]}{v.eventTitles.length > 1 ? ` +${v.eventTitles.length - 1}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          {v.email ? (
                            <span className="flex items-center gap-1.5 text-foreground">
                              <Mail size={11} className="text-muted-foreground" />{v.email}
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground/50">No email</span>
                          )}
                          {v.phone ? (
                            <span className="flex items-center gap-1.5 text-foreground">
                              <Phone size={11} className="text-muted-foreground" />{v.phone}
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground/50">No phone</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-black text-white"
                          style={{ background: v.visits > 1 ? GOLD : `${NAVY}40` }}
                          title={`${v.visits} event${v.visits !== 1 ? "s" : ""}`}
                        >
                          {v.visits}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(v.lastVisit).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-border/30">
                {filteredGuests.map((v) => (
                  <div key={v.key} className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0"
                          style={{ background: avatarGradient(v.full_name) }}
                        >
                          {getInitials(v.full_name)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{v.full_name}</p>
                        </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground shrink-0 font-semibold">
                        {v.visits} visit{v.visits !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 pl-12">
                      {v.email && <span className="flex items-center gap-1.5 text-xs text-foreground"><Mail size={10} />{v.email}</span>}
                      {v.phone && <span className="flex items-center gap-1.5 text-xs text-foreground"><Phone size={10} />{v.phone}</span>}
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        Last: {new Date(v.lastVisit).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* Footer count */}
        {!loading && (
          <div className="px-6 py-3 border-t border-border/30 bg-muted/5 text-[10px] text-muted-foreground font-semibold">
            Showing {tab === "members" ? filteredMembers.length : tab === "rotarians" ? filteredRotarians.length : filteredGuests.length} record
            {(tab === "members" ? filteredMembers.length : tab === "rotarians" ? filteredRotarians.length : filteredGuests.length) !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default DirectoryPage;
