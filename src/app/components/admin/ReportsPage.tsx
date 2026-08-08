import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { useOrgMembers } from "../../../hooks/useMembers";
import { AdminLayout } from "../shared/AdminLayout";
import { PageCard, SelectInput } from "../shared/PageCard";
import { NAVY, GOLD, isSyntheticEmail, parseBuddyGroups } from "../../../lib/constants";
import { supabase } from "../../../lib/supabase";
import {
  FolderArchive,
  Search,
  Printer,
  Calendar,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Award,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import { FellowshipReportModal } from "./FellowshipReportModal";
import { MonthlyMatrixReport } from "./reports/MonthlyMatrixReport";
import { BuddyGroupReport } from "./reports/BuddyGroupReport";
import { MemberSummaryReport } from "./reports/MemberSummaryReport";
import type { ClubActivity } from "../../../types/database";

export function ReportsPage() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: "monthly-matrix" | "meeting-archive" | "buddy-groups" | "member-audit"
  const activeTab = searchParams.get("tab") || "monthly-matrix";

  // State filters for Single Meeting Archive
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [printingEventId, setPrintingEventId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedReportEvent, setSelectedReportEvent] = useState<any | null>(null);

  // Queries for Single Meeting Archive
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["archive-events", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: members, isLoading: membersLoading } = useOrgMembers(organization?.id);
  const [allRegs, setAllRegs] = useState<any[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);

  // Fetch lightweight registrations for stats
  useEffect(() => {
    if (!organization?.id) return;
    setRegsLoading(true);
    supabase
      .from("registrations")
      .select("id, event_id, status, is_member, club_name, district, buddy_group, member_id")
      .eq("organization_id", organization.id)
      .then(({ data, error }) => {
        if (!error && data) {
          setAllRegs(data);
        }
        setRegsLoading(false);
      });
  }, [organization?.id, events]);

  // Group stats in memory for Single Meeting Archive
  const statsByEvent = useMemo(() => {
    const map: Record<
      string,
      {
        total: number;
        checkedIn: number;
        apologies: number;
        leader: string | null;
        leaderCount: number;
        buddyCounts: Record<string, number>;
      }
    > = {};
    if (!allRegs) return map;

    allRegs.forEach((r) => {
      const eId = r.event_id;
      if (!map[eId]) {
        map[eId] = { total: 0, checkedIn: 0, apologies: 0, leader: null, leaderCount: 0, buddyCounts: {} };
      }
      map[eId].total++;
      if (r.status === "checked-in") {
        map[eId].checkedIn++;
        if (r.buddy_group && r.buddy_group.trim()) {
          const bg = r.buddy_group.trim();
          map[eId].buddyCounts[bg] = (map[eId].buddyCounts[bg] || 0) + 1;
        }
      } else if (r.status === "apology") {
        map[eId].apologies++;
      }
    });

    Object.entries(map).forEach(([eId, eventStats]) => {
      let maxGroup: string | null = null;
      let maxCount = 0;
      Object.entries(eventStats.buddyCounts).forEach(([group, count]) => {
        if (count > maxCount) {
          maxCount = count;
          maxGroup = group;
        }
      });
      eventStats.leader = maxGroup;
      eventStats.leaderCount = maxCount;
    });

    return map;
  }, [allRegs]);

  // Filtered events for Single Meeting Archive
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    const sorted = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return sorted.filter((e) => {
      const matchesSearch =
        e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.location && e.location.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = typeFilter === "all" || e.type === typeFilter;
      const matchesStatus = statusFilter === "all" || e.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [events, searchTerm, typeFilter, statusFilter]);

  // Single event print register handler
  async function handlePrintReport(event: any) {
    if (printingEventId) return;
    setPrintingEventId(event.id);

    try {
      const { data: eventRegs, error: regsError } = await supabase
        .from("registrations")
        .select("*")
        .eq("event_id", event.id);

      if (regsError) throw regsError;

      const vClubsList: { club: string; count: number }[] = [];
      if (eventRegs) {
        const counts: Record<string, number> = {};
        eventRegs.forEach((r) => {
          if (r.status !== "apology" && r.is_member && (!r.buddy_group || r.buddy_group.trim() === "") && r.club_name && r.club_name.trim()) {
            const cName = r.club_name.trim();
            counts[cName] = (counts[cName] || 0) + 1;
          }
        });
        Object.entries(counts).forEach(([club, count]) => {
          vClubsList.push({ club, count });
        });
      }

      const eventDate = new Date(event.date).toLocaleDateString("en-GB", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      const now = new Date().toLocaleString("en-GB");
      const orgName = organization?.name ?? "Rotary Club";
      let logoUrl = organization?.logo_url || null;
      if (logoUrl && !logoUrl.startsWith("http")) {
        logoUrl = window.location.origin + logoUrl;
      }
      const totalRegs = eventRegs?.length ?? 0;
      const checkedInCount = eventRegs?.filter(r => r.status === "checked-in").length ?? 0;
      const apologyCount = eventRegs?.filter(r => r.status === "apology").length ?? 0;

      const clubMembers = eventRegs?.filter(r => r.status !== "apology" && r.is_member && ((r.buddy_group && r.buddy_group.trim() !== "") || r.member_id)) ?? [];
      const visitingRotarians = eventRegs?.filter(r => r.status !== "apology" && r.is_member && (!r.buddy_group || r.buddy_group.trim() === "") && r.club_name) ?? [];
      const guests = eventRegs?.filter(r => r.status !== "apology" && !r.is_member) ?? [];
      const apologies = eventRegs?.filter(r => r.status === "apology") ?? [];

      const getDisplayEmail = (r: any) => {
        const matched = members?.find(
          (m) => m.id === r.member_id || m.full_name.toLowerCase().trim() === r.full_name.toLowerCase().trim()
        );
        if (matched?.email && !isSyntheticEmail(matched.email)) return matched.email;
        if (r.email && !isSyntheticEmail(r.email)) return r.email;
        return "—";
      };

      const getDisplayPhone = (r: any) => {
        const matched = members?.find(
          (m) => m.id === r.member_id || m.full_name.toLowerCase().trim() === r.full_name.toLowerCase().trim()
        );
        if (r.phone && r.phone.trim()) return r.phone;
        if (matched?.phone && matched.phone.trim()) return matched.phone;
        return "—";
      };

      const apologyRows = apologies.length > 0 ? apologies.map((r, i) => {
        return `
          <tr class="${i % 2 === 0 ? "even" : "odd"}">
            <td class="no">${i + 1}</td>
            <td class="name">${r.full_name}</td>
            <td>${r.buddy_group || "—"}</td>
            <td>${getDisplayPhone(r)}</td>
            <td>${getDisplayEmail(r)}</td>
          </tr>`;
      }).join("") : `<tr><td colspan="5" class="center text-muted" style="padding: 12px; color: #888; font-style: italic;">No apologies registered for this event.</td></tr>`;

      const checkedInClubCount = clubMembers.filter(r => r.status === "checked-in").length;
      const totalRoster = members?.length ?? 0;
      const clubAttendancePct = totalRoster > 0 ? (checkedInClubCount / totalRoster) * 100 : 0;
      const vClubsHeadcountStr = vClubsList.length > 0
        ? vClubsList.map(item => `${item.club} (${item.count} ${item.count === 1 ? 'person' : 'people'})`).join(", ")
        : "None";

      const eventLeader = statsByEvent[event.id]?.leader;
      const eventLeaderCount = statsByEvent[event.id]?.leaderCount;

      const configuredGroups = event?.buddy_groups
        ? parseBuddyGroups(event.buddy_groups)
        : parseBuddyGroups(organization?.buddy_groups);

      const presentGroups = new Set<string>();
      eventRegs?.forEach(r => {
        if (r.status === "checked-in" && r.buddy_group && r.buddy_group.trim()) {
          presentGroups.add(r.buddy_group.trim());
        }
      });

      const allGroups = Array.from(new Set([...configuredGroups, ...presentGroups]));

      const buddyGroupCounts = allGroups.map(groupName => {
        const rosterCount = members?.filter(
          m => m.buddy_group && m.buddy_group.trim().toLowerCase() === groupName.toLowerCase()
        ).length ?? 0;
        const presentCount = eventRegs?.filter(
          r => r.status === "checked-in" && r.buddy_group && r.buddy_group.trim().toLowerCase() === groupName.toLowerCase()
        ).length ?? 0;
        const attendancePct = rosterCount > 0 ? (presentCount / rosterCount) * 100 : 0;
        return { name: groupName, rosterCount, presentCount, attendancePct };
      });

      buddyGroupCounts.sort((a, b) => {
        if (b.presentCount !== a.presentCount) return b.presentCount - a.presentCount;
        if (b.rosterCount !== a.rosterCount) return b.rosterCount - a.rosterCount;
        return a.name.localeCompare(b.name);
      });

      const buddyGroupRows = buddyGroupCounts.length > 0 ? buddyGroupCounts.map((bg, i) => {
        return `
          <tr class="${i % 2 === 0 ? "even" : "odd"}">
            <td class="name">${bg.name}</td>
            <td class="center">${bg.rosterCount}</td>
            <td class="center" style="font-weight: bold; color: ${bg.presentCount > 0 ? '#047857' : '#64748b'};">${bg.presentCount}</td>
            <td class="center" style="font-weight: bold; color: ${bg.attendancePct >= 50 ? '#047857' : bg.attendancePct > 0 ? '#b45309' : '#64748b'};">${bg.attendancePct.toFixed(1)}%</td>
          </tr>`;
      }).join("") : `<tr><td colspan="4" class="center text-muted" style="padding: 12px; color: #888; font-style: italic;">No buddy groups configured or present.</td></tr>`;

      const clubMemberRows = clubMembers.length > 0 ? clubMembers.map((r, i) => {
        return `
          <tr class="${i % 2 === 0 ? "even" : "odd"}">
            <td class="no">${i + 1}</td>
            <td class="name">
              <div>${r.full_name}</div>
              ${r.visits && r.visits.length > 0 ? `<div style="font-size: 8px; color: #17458F; font-weight: normal; margin-top: 2px;"><b>Visits:</b> ${r.visits.map((v: ClubActivity) => `${v.club_name} (${v.date})`).join(", ")}</div>` : ''}
              ${r.makeups && r.makeups.length > 0 ? `<div style="font-size: 8px; color: #B45309; font-weight: normal; margin-top: 1px;"><b>Make-ups:</b> ${r.makeups.map((m: ClubActivity) => `${m.club_name} (${m.date})`).join(", ")}</div>` : ''}
            </td>
            <td>${r.buddy_group || "—"}</td>
            <td>${getDisplayPhone(r)}</td>
            <td>${getDisplayEmail(r)}</td>
          </tr>`;
      }).join("") : `<tr><td colspan="5" class="center text-muted" style="padding: 12px; color: #888; font-style: italic;">No club members registered for this event.</td></tr>`;

      const visitingRotarianRows = visitingRotarians.length > 0 ? visitingRotarians.map((r, i) => {
        return `
          <tr class="${i % 2 === 0 ? "even" : "odd"}">
            <td class="no">${i + 1}</td>
            <td class="name">${r.full_name}</td>
            <td>${r.club_name || "—"}</td>
            <td>${r.district || "—"}</td>
            <td>${getDisplayPhone(r)}</td>
            <td>${getDisplayEmail(r)}</td>
          </tr>`;
      }).join("") : `<tr><td colspan="6" class="center text-muted" style="padding: 12px; color: #888; font-style: italic;">No visiting Rotarians registered for this event.</td></tr>`;

      const guestRows = guests.length > 0 ? guests.map((r, i) => {
        return `
          <tr class="${i % 2 === 0 ? "even" : "odd"}">
            <td class="no">${i + 1}</td>
            <td class="name">${r.full_name}</td>
            <td>${r.occupation || "—"}</td>
            <td>${getDisplayPhone(r)}</td>
            <td>${getDisplayEmail(r)}</td>
          </tr>`;
      }).join("") : `<tr><td colspan="5" class="center text-muted" style="padding: 12px; color: #888; font-style: italic;">No guests registered for this event.</td></tr>`;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Attendance – ${event.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Open Sans', Arial, sans-serif; font-size: 10px; color: #1a1a1a; background: #fff; padding: 24px 32px; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #17458F; padding-bottom: 14px; margin-bottom: 16px; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .wheel { width: 50px; height: 50px; }
    .club-meta h1 { font-size: 14px; font-weight: 800; color: #17458F; text-transform: uppercase; margin-bottom: 2px; }
    .club-meta p { font-size: 9px; color: #666; font-weight: 600; }
    .header-right { text-align: right; }
    .header-right .timestamp { font-size: 8px; color: #888; margin-top: 4px; font-style: italic; }
    .report-title { font-size: 16px; font-weight: 900; color: #17458F; text-transform: uppercase; margin-bottom: 4px; }
    .report-meta { display: flex; gap: 14px; font-size: 9px; color: #444; }
    .summary { display: flex; gap: 8px; margin-bottom: 16px; }
    .pill { font-size: 9px; font-weight: 700; padding: 4px 10px; border-radius: 6px; border: 1px solid; }
    .pill-blue { background: #f0f7ff; color: #0369a1; border-color: #bae6fd; }
    .pill-green { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .pill-gold { background: #fffbeb; color: #b45309; border-color: #fde68a; }
    .section-title { font-size: 11px; font-weight: 800; color: #17458F; text-transform: uppercase; margin: 18px 0 6px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    .section-meta { font-size: 8px; color: #666; margin-bottom: 6px; display: flex; gap: 6px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 8px; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 9px; color: #334155; }
    tr.even { background: #f8fafc; }
    td.no { font-weight: 700; color: #64748b; width: 25px; text-align: center; }
    td.name { font-weight: 700; color: #0f172a; }
    .signature-block { display: flex; justify-content: space-between; margin-top: 36px; page-break-inside: avoid; }
    .sig-line { width: 30%; border-top: 1px solid #64748b; text-align: center; padding-top: 6px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; margin-top: 24px; }
    .footer { display: flex; justify-content: space-between; font-size: 7px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 24px; page-break-inside: avoid; }
    @media print {
      body { padding: 0; margin: 0; }
      @page { size: A4; margin: 12mm 15mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `<img class="wheel" src="${logoUrl}" alt="${orgName}" style="object-fit: contain; border-radius: 4px;" />` : `
        <svg class="wheel" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#17458F" stroke-width="7"/>
          <circle cx="50" cy="50" r="16" fill="#17458F"/>
        </svg>
      `}
      <div class="club-meta">
        <h1>${orgName}</h1>
        <p>District ${organization?.district ?? "—"} &bull; Club Attendance Register</p>
      </div>
    </div>
    <div class="header-right">
      <div class="report-title">Meeting Register</div>
      <div class="report-meta">
        <span><b>Date:</b> ${eventDate}</span>
      </div>
      <div class="timestamp">Exported: ${now}</div>
    </div>
  </div>

  <div class="report-meta" style="margin-bottom: 10px; font-size: 10px;">
    <span><b>Meeting:</b> <strong style="color:#17458F">${event.title}</strong></span>
    ${event.location ? `<span>| &nbsp; <b>Venue:</b> ${event.location}</span>` : ""}
    ${eventLeader ? `<span>| &nbsp; <b>🌟 Buddy Group of the Day:</b> ${eventLeader} (${eventLeaderCount} Present)</span>` : ""}
  </div>

  <div class="summary">
    <div class="pill pill-blue">Total Registered: ${totalRegs}</div>
    <div class="pill pill-green">Checked In: ${checkedInCount}</div>
    <div class="pill pill-gold">Apologies: ${apologyCount}</div>
  </div>

  <div class="section-title">1. Club Members</div>
  <div class="section-meta">
    <span>Checked In: <b>${checkedInClubCount}</b> of <b>${clubMembers.length}</b> registered</span>
    <span>|</span>
    <span>Active Directory Roster: <b>${totalRoster}</b> members</span>
    <span>|</span>
    <span>Meeting Attendance Rate: <b>${clubAttendancePct.toFixed(1)}%</b></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Buddy Group</th>
        <th>Phone</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>${clubMemberRows}</tbody>
  </table>

  <div class="section-title">2. Buddy Group Attendance Summary</div>
  <div class="section-meta">
    <span>Breakdown of roster headcount, checked-in members, and attendance rate for each buddy group</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Buddy Group Name</th>
        <th style="text-align: center; width: 20%;">Roster Count</th>
        <th style="text-align: center; width: 20%;">Present Count</th>
        <th style="text-align: center; width: 20%;">Attendance Rate (%)</th>
      </tr>
    </thead>
    <tbody>${buddyGroupRows}</tbody>
  </table>

  <div class="section-title">3. Visiting Rotarians</div>
  <div class="section-meta">
    <span>Checked In: <b>${visitingRotarians.filter(r => r.status === "checked-in").length}</b> of <b>${visitingRotarians.length}</b> registered</span>
    <span>|</span>
    <span>Visiting Clubs: <b>${vClubsHeadcountStr}</b></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Club Name</th>
        <th>District</th>
        <th>Phone</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>${visitingRotarianRows}</tbody>
  </table>

  <div class="section-title">4. Guests & Non-Rotarians</div>
  <div class="section-meta">
    <span>Checked In: <b>${guests.filter(r => r.status === "checked-in").length}</b> of <b>${guests.length}</b> registered</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Profession / Classification</th>
        <th>Phone</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>${guestRows}</tbody>
  </table>

  <div class="section-title">5. Apologies (Absent with Apology)</div>
  <div class="section-meta">
    <span>Total absent with apologies: <b>${apologies.length}</b></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Buddy Group</th>
        <th>Phone</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>${apologyRows}</tbody>
  </table>

  <div class="signature-block">
    <div class="sig-line">Club President / Chairperson</div>
    <div class="sig-line">Secretary</div>
    <div class="sig-line">Event Coordinator</div>
  </div>

  <div class="footer">
    <span>${orgName} — Attendance Register — ${event.title}</span>
    <span>Generated by agoroll</span>
  </div>

  <script>
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Pop-up blocked — please allow pop-ups and try again.");
        return;
      }
      win.document.write(html);
      win.document.close();
      toast.success("Register generated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to load report data.");
    } finally {
      setPrintingEventId(null);
    }
  }

  // Auto-scroll active tab heading into view on mobile/small screens
  useEffect(() => {
    const el = document.getElementById(`tab-btn-${activeTab}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

  // Switch Tab Handler
  const handleTabChange = (tabKey: string) => {
    setSearchParams({ tab: tabKey });
  };

  return (
    <AdminLayout pageTitle="Reports Center">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2.5" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              <FolderArchive size={26} className="text-[#F7A81B]" />
              Reports Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Comprehensive organization reporting center. Access monthly member attendance matrices, printable meeting registers, buddy group analytics, and member audits.
            </p>
          </div>
        </div>

        {/* Tab Navigation Header */}
        <div className="flex items-center gap-5 sm:gap-6 border-b border-slate-200/80 overflow-x-auto touch-pan-x scrollbar-none pb-0.5 scroll-smooth">
          <button
            id="tab-btn-monthly-matrix"
            onClick={() => handleTabChange("monthly-matrix")}
            className={`pb-3 pt-2 px-1 text-xs font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 -mb-px ${
              activeTab === "monthly-matrix"
                ? "border-[#17458F] text-[#17458F]"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            Monthly Attendance Matrix
          </button>

          <button
            id="tab-btn-meeting-archive"
            onClick={() => handleTabChange("meeting-archive")}
            className={`pb-3 pt-2 px-1 text-xs font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 -mb-px ${
              activeTab === "meeting-archive"
                ? "border-[#17458F] text-[#17458F]"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            Meeting Registers Archive
          </button>

          <button
            id="tab-btn-buddy-groups"
            onClick={() => handleTabChange("buddy-groups")}
            className={`pb-3 pt-2 px-1 text-xs font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 -mb-px ${
              activeTab === "buddy-groups"
                ? "border-[#17458F] text-[#17458F]"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            Buddy Group Analytics
          </button>

          <button
            id="tab-btn-member-audit"
            onClick={() => handleTabChange("member-audit")}
            className={`pb-3 pt-2 px-1 text-xs font-extrabold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 -mb-px ${
              activeTab === "member-audit"
                ? "border-[#17458F] text-[#17458F]"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            Member Attendance Audit
          </button>
        </div>

        {/* TAB 1: MONTHLY MATRIX REPORT */}
        {activeTab === "monthly-matrix" && (
          <MonthlyMatrixReport
            organization={organization}
            members={members || []}
            membersLoading={membersLoading}
          />
        )}

        {/* TAB 2: SINGLE MEETING REGISTERS ARCHIVE */}
        {activeTab === "meeting-archive" && (
          <div className="flex flex-col gap-6">
            {/* Filter Controls */}
            <PageCard className="p-4 bg-white border border-border/40 shadow-sm flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2 bg-[#f4f6fb] rounded-xl px-4 py-2.5 w-full md:max-w-md">
                <Search size={16} className="text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search meetings by title or venue..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder-muted-foreground"
                />
              </div>

              <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto items-center ml-auto">
                <div className="w-full md:w-44">
                  <SelectInput
                    label=""
                    options={[
                      { value: "all", label: "All Types" },
                      { value: "Fellowship", label: "Fellowship" },
                      { value: "Gala", label: "Gala" },
                      { value: "Conference", label: "Conference" },
                      { value: "Service", label: "Service" },
                      { value: "General", label: "General" },
                    ]}
                    value={typeFilter}
                    onChange={setTypeFilter}
                  />
                </div>
                <div className="w-full md:w-40">
                  <SelectInput
                    label=""
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "published", label: "Published" },
                      { value: "closed", label: "Closed" },
                      { value: "draft", label: "Draft" },
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />
                </div>
              </div>
            </PageCard>

            {/* Dossiers Grid */}
            {eventsLoading || regsLoading ? (
              <LoadingScreen variant="light" />
            ) : filteredEvents.length === 0 ? (
              <PageCard className="text-center py-20 bg-white border border-border/40 shadow-sm">
                <FolderArchive className="w-16 h-16 mx-auto text-muted-foreground/60 mb-4 stroke-[1.2]" />
                <h3 className="text-lg font-bold" style={{ color: NAVY }}>No Reports Found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  We couldn't find any meetings matching your criteria. Try adjusting your search query or filters.
                </p>
              </PageCard>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredEvents.map((ev) => {
                  const stats = statsByEvent[ev.id] || { total: 0, checkedIn: 0, leader: null, leaderCount: 0, buddyCounts: {} };
                  const formattedDate = new Date(ev.date).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                  });
                  const isPrinting = printingEventId === ev.id;
                  const isExpanded = expandedEventId === ev.id;

                  const eventBuddyGroups = ev.buddy_groups
                    ? parseBuddyGroups(ev.buddy_groups)
                    : parseBuddyGroups(organization?.buddy_groups);

                  const allEventGroups = Array.from(new Set([
                    ...eventBuddyGroups,
                    ...Object.keys(stats.buddyCounts)
                  ]));

                  allEventGroups.sort((a, b) => {
                    const countA = stats.buddyCounts[a] || 0;
                    const countB = stats.buddyCounts[b] || 0;
                    if (countB !== countA) return countB - countA;
                    return a.localeCompare(b);
                  });

                  return (
                    <div 
                      key={ev.id} 
                      className="bg-white rounded-2xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                    >
                      <div 
                        onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                        className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#17458F]/5 text-[#17458F] flex items-center justify-center shrink-0 border border-[#17458F]/10">
                            <FileText size={18} className="text-[#17458F]" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/60 tracking-wider">
                                {ev.type || "General"}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border bg-slate-100 text-slate-700 border-slate-200/60">
                                {ev.status}
                              </span>
                            </div>
                            <h3 className="text-sm font-extrabold text-[#001D4A] leading-snug" style={{ fontFamily: "var(--font-sans)" }}>
                              {ev.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-1 font-medium">
                              <span className="flex items-center gap-1"><Calendar size={12} /> {formattedDate}</span>
                              {ev.location && <span className="hidden sm:inline">&bull;</span>}
                              {ev.location && <span>Venue: <strong className="text-slate-700">{ev.location}</strong></span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="hidden sm:flex flex-col items-end">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Attendance</p>
                            <p className="text-xs font-black text-[#001D4A] mt-0.5">{stats.total} Attendees</p>
                          </div>
                          
                          <div className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors shrink-0">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-5 pb-5 pt-4 border-t border-slate-200/60 bg-slate-50/40 animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                              <div className="flex gap-6">
                                <div>
                                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Registered</p>
                                  <p className="text-base font-black mt-0.5 text-slate-900">{stats.total}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Present</p>
                                  <p className="text-base font-black mt-0.5 text-slate-900">{stats.checkedIn}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Apologies</p>
                                  <p className="text-base font-black mt-0.5 text-slate-900">{stats.apologies || 0}</p>
                                </div>
                              </div>

                              <div className="min-w-[140px]">
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Buddy Group Leader</p>
                                {stats.leader ? (
                                  <p className="text-xs font-bold text-[#001D4A] mt-1">
                                    {stats.leader} <span className="font-medium text-slate-500">({stats.leaderCount} Present)</span>
                                  </p>
                                ) : (
                                  <p className="text-xs text-slate-400 mt-1 font-medium">—</p>
                                )}
                              </div>
                            </div>

                            <div 
                              className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handlePrintReport(ev)}
                                disabled={isPrinting}
                                className="py-2 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                              >
                                {isPrinting ? (
                                  <>
                                    <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <Printer size={13} className="text-slate-500" /> Print Register
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => setSelectedReportEvent(ev)}
                                className="py-2 px-3.5 bg-[#001D4A]/5 hover:bg-[#001D4A]/10 text-[#001D4A] border border-[#001D4A]/20 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <FileText size={13} className="text-[#001D4A]" />
                                {ev.fellowship_report || (ev.description && ev.description.startsWith("[FELLOWSHIP_REPORT]"))
                                  ? "Fellowship Report"
                                  : "Create Report"}
                              </button>
                              <button
                                onClick={() => navigate(`/admin/checkin/${ev.id}`)}
                                className="py-2 px-3.5 bg-[#001D4A] hover:bg-[#001D4A]/90 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <Users size={13} /> View Attendees
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BUDDY GROUP ANALYTICS */}
        {activeTab === "buddy-groups" && (
          <BuddyGroupReport
            organization={organization}
            members={members || []}
            membersLoading={membersLoading}
          />
        )}

        {/* TAB 4: MEMBER ATTENDANCE AUDIT */}
        {activeTab === "member-audit" && (
          <MemberSummaryReport
            organization={organization}
            members={members || []}
            membersLoading={membersLoading}
          />
        )}

        {/* Modal for Fellowship Report */}
        {selectedReportEvent && (
          <FellowshipReportModal
            event={selectedReportEvent}
            organization={organization}
            onClose={() => setSelectedReportEvent(null)}
            onSaveSuccess={() => {
              setSelectedReportEvent(null);
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
