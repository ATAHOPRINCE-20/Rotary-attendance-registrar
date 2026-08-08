import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase";
import { PageCard, SelectInput } from "../../shared/PageCard";
import { NAVY, GOLD, parseBuddyGroups, isSyntheticEmail } from "../../../../lib/constants";
import {
  Calendar,
  Users,
  CheckCircle,
  Mail,
  Printer,
  Download,
  Search,
  Filter,
  TrendingUp,
  FileSpreadsheet,
  Award,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../../shared/LoadingScreen";

interface MonthlyMatrixReportProps {
  organization: any;
  members: any[];
  membersLoading: boolean;
}

export function MonthlyMatrixReport({ organization, members, membersLoading }: MonthlyMatrixReportProps) {
  // Current year-month default (YYYY-MM)
  const todayISO = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayISO);
  const [buddyGroupFilter, setBuddyGroupFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [printingMatrix, setPrintingMatrix] = useState<boolean>(false);

  // Compute month start and end ISO dates
  const { startDateISO, endDateISO, monthLabel } = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const label = start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    return {
      startDateISO: start.toISOString(),
      endDateISO: end.toISOString(),
      monthLabel: label,
    };
  }, [selectedMonth]);

  // Query events in this month
  const { data: monthEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["monthly-matrix-events", organization?.id, selectedMonth],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("organization_id", organization.id)
        .gte("date", startDateISO)
        .lte("date", endDateISO)
        .order("date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Query all registrations for events in this month
  const { data: monthRegistrations, isLoading: regsLoading } = useQuery({
    queryKey: ["monthly-matrix-regs", organization?.id, selectedMonth],
    enabled: !!organization?.id && !!monthEvents && monthEvents.length > 0,
    queryFn: async () => {
      const eventIds = monthEvents!.map((e) => e.id);
      if (eventIds.length === 0) return [];

      const { data, error } = await supabase
        .from("registrations")
        .select("id, event_id, status, is_member, member_id, full_name, buddy_group, email, phone")
        .eq("organization_id", organization.id)
        .in("event_id", eventIds);

      if (error) throw error;
      return data || [];
    },
  });

  // Buddy groups list
  const configuredGroups = useMemo(() => {
    return parseBuddyGroups(organization?.buddy_groups);
  }, [organization?.buddy_groups]);

  // Map registrations by key: `memberId_eventId` or `fullNameLower_eventId`
  const regMap = useMemo(() => {
    const map = new Map<string, any>();
    if (!monthRegistrations) return map;

    monthRegistrations.forEach((r) => {
      if (r.member_id) {
        map.set(`${r.member_id}_${r.event_id}`, r);
      }
      if (r.full_name) {
        map.set(`${r.full_name.trim().toLowerCase()}_${r.event_id}`, r);
      }
    });

    return map;
  }, [monthRegistrations]);

  // Filter members list
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => {
      const matchesSearch =
        m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesGroup =
        buddyGroupFilter === "all" ||
        (m.buddy_group && m.buddy_group.trim().toLowerCase() === buddyGroupFilter.toLowerCase());

      return matchesSearch && matchesGroup;
    });
  }, [members, searchTerm, buddyGroupFilter]);

  // Metrics summary
  const matrixStats = useMemo(() => {
    const totalEvents = monthEvents?.length || 0;
    const totalMembers = filteredMembers.length;
    if (totalEvents === 0 || totalMembers === 0) {
      return { totalEvents, totalMembers, avgAttendancePct: 0, mostAttendedEvent: null };
    }

    let totalPresentCount = 0;
    const eventPresentCounts: Record<string, number> = {};

    filteredMembers.forEach((m) => {
      monthEvents!.forEach((ev) => {
        const reg = regMap.get(`${m.id}_${ev.id}`) || regMap.get(`${m.full_name.trim().toLowerCase()}_${ev.id}`);
        if (reg && reg.status === "checked-in") {
          totalPresentCount++;
          eventPresentCounts[ev.id] = (eventPresentCounts[ev.id] || 0) + 1;
        }
      });
    });

    const maxPossible = totalEvents * totalMembers;
    const avgAttendancePct = maxPossible > 0 ? (totalPresentCount / maxPossible) * 100 : 0;

    let bestEv: any = null;
    let maxCount = -1;
    monthEvents!.forEach((ev) => {
      const cnt = eventPresentCounts[ev.id] || 0;
      if (cnt > maxCount) {
        maxCount = cnt;
        bestEv = ev;
      }
    });

    return {
      totalEvents,
      totalMembers,
      avgAttendancePct,
      mostAttendedEvent: bestEv ? `${bestEv.title} (${maxCount} Present)` : null,
    };
  }, [monthEvents, filteredMembers, regMap]);

  // CSV Export Handler
  function handleExportCSV() {
    if (!monthEvents || monthEvents.length === 0) {
      toast.error("No events found in the selected month to export.");
      return;
    }
    if (!filteredMembers || filteredMembers.length === 0) {
      toast.error("No members to export.");
      return;
    }

    const headers = [
      "Member Name",
      "Buddy Group",
      "Email",
      "Phone",
      ...monthEvents.map((e) => `"${e.title.replace(/"/g, '""')} (${new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })})"`),
      "Total Attended",
      "Total Meetings",
      "Attendance Rate (%)",
    ];

    const rows = filteredMembers.map((m) => {
      let attendedCount = 0;
      const statusCols = monthEvents.map((ev) => {
        const reg = regMap.get(`${m.id}_${ev.id}`) || regMap.get(`${m.full_name.trim().toLowerCase()}_${ev.id}`);
        if (reg?.status === "checked-in") {
          attendedCount++;
          return "Checked-In";
        } else if (reg?.status === "apology") {
          return "Apology";
        } else {
          return "Absent";
        }
      });

      const rate = monthEvents.length > 0 ? ((attendedCount / monthEvents.length) * 100).toFixed(1) : "0.0";

      return [
        `"${m.full_name.replace(/"/g, '""')}"`,
        `"${(m.buddy_group || "Unassigned").replace(/"/g, '""')}"`,
        `"${(!isSyntheticEmail(m.email) ? m.email || "" : "").replace(/"/g, '""')}"`,
        `"${(m.phone || "").replace(/"/g, '""')}"`,
        ...statusCols,
        attendedCount,
        monthEvents.length,
        `"${rate}%"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Monthly_Attendance_Matrix_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Monthly attendance matrix exported successfully!");
  }

  // Print Monthly Matrix Register
  async function handlePrintMonthlyMatrix() {
    if (!monthEvents || monthEvents.length === 0) {
      toast.error("No events found in this month to print.");
      return;
    }
    setPrintingMatrix(true);

    try {
      const now = new Date().toLocaleString("en-GB");
      const orgName = organization?.name ?? "Rotary Club";
      let logoUrl = organization?.logo_url || null;
      if (logoUrl && !logoUrl.startsWith("http")) {
        logoUrl = window.location.origin + logoUrl;
      }

      // Event columns headers
      const eventThs = monthEvents
        .map(
          (e) => `
        <th style="text-align: center; font-size: 7.5px; padding: 4px; min-width: 65px;">
          <div>${new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
          <div style="font-weight: 800; color: #17458F; text-transform: none; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.title}</div>
        </th>`
        )
        .join("");

      // Member Rows
      const memberRows = filteredMembers
        .map((m, i) => {
          let attendedCount = 0;
          let apologyCount = 0;

          const cells = monthEvents
            .map((ev) => {
              const reg = regMap.get(`${m.id}_${ev.id}`) || regMap.get(`${m.full_name.trim().toLowerCase()}_${ev.id}`);
              if (reg?.status === "checked-in") {
                attendedCount++;
                return `<td style="text-align: center; color: #047857; font-weight: bold; font-size: 8px;">✓ Present</td>`;
              } else if (reg?.status === "apology") {
                apologyCount++;
                return `<td style="text-align: center; color: #b45309; font-weight: bold; font-size: 8px;">✉ Apology</td>`;
              } else {
                return `<td style="text-align: center; color: #94a3b8; font-size: 8px;">—</td>`;
              }
            })
            .join("");

          const ratePct = monthEvents.length > 0 ? (attendedCount / monthEvents.length) * 100 : 0;

          return `
          <tr class="${i % 2 === 0 ? "even" : "odd"}">
            <td style="font-weight: bold; text-align: center; color: #64748b;">${i + 1}</td>
            <td style="font-weight: 800; color: #0f172a;">${m.full_name}</td>
            <td style="color: #475569;">${m.buddy_group || "Unassigned"}</td>
            ${cells}
            <td style="text-align: center; font-weight: bold; color: #047857;">${attendedCount} / ${monthEvents.length}</td>
            <td style="text-align: center; font-weight: bold; color: ${ratePct >= 50 ? "#047857" : ratePct > 0 ? "#b45309" : "#94a3b8"};">${ratePct.toFixed(1)}%</td>
          </tr>`;
        })
        .join("");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Monthly Attendance Matrix – ${monthLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Open Sans', Arial, sans-serif; font-size: 9px; color: #1a1a1a; background: #fff; padding: 20px 24px; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #17458F; padding-bottom: 12px; margin-bottom: 14px; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .wheel { width: 44px; height: 44px; }
    .club-meta h1 { font-size: 14px; font-weight: 800; color: #17458F; text-transform: uppercase; margin-bottom: 2px; }
    .club-meta p { font-size: 8.5px; color: #666; font-weight: 600; }
    .header-right { text-align: right; }
    .header-right .timestamp { font-size: 8px; color: #888; margin-top: 4px; font-style: italic; }
    .report-title { font-size: 14px; font-weight: 900; color: #17458F; text-transform: uppercase; margin-bottom: 2px; }
    .summary { display: flex; gap: 8px; margin-bottom: 14px; }
    .pill { font-size: 8.5px; font-weight: 700; padding: 4px 10px; border-radius: 6px; border: 1px solid; }
    .pill-blue { background: #f0f7ff; color: #0369a1; border-color: #bae6fd; }
    .pill-green { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .pill-gold { background: #fffbeb; color: #b45309; border-color: #fde68a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 8px; padding: 6px; border: 1px solid #cbd5e1; text-align: left; }
    td { padding: 5px 6px; border: 1px solid #e2e8f0; font-size: 8.5px; color: #334155; }
    tr.even { background: #f8fafc; }
    .signature-block { display: flex; justify-content: space-between; margin-top: 32px; page-break-inside: avoid; }
    .sig-line { width: 30%; border-top: 1px solid #64748b; text-align: center; padding-top: 6px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; margin-top: 20px; }
    .footer { display: flex; justify-content: space-between; font-size: 7px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 20px; page-break-inside: avoid; }
    @media print {
      body { padding: 0; margin: 0; }
      @page { size: A4 landscape; margin: 10mm 12mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${
        logoUrl
          ? `<img class="wheel" src="${logoUrl}" alt="${orgName}" style="object-fit: contain; border-radius: 4px;" />`
          : `<svg class="wheel" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#17458F" stroke-width="7"/>
              <circle cx="50" cy="50" r="16" fill="#17458F"/>
            </svg>`
      }
      <div class="club-meta">
        <h1>${orgName}</h1>
        <p>District ${organization?.district ?? "—"} &bull; Monthly Attendance Matrix Register</p>
      </div>
    </div>
    <div class="header-right">
      <div class="report-title">Monthly Member Attendance</div>
      <div style="font-size: 10px; font-weight: 800; color: #0f172a;">${monthLabel}</div>
      <div class="timestamp">Exported: ${now}</div>
    </div>
  </div>

  <div class="summary">
    <div class="pill pill-blue">Total Meetings: ${monthEvents.length}</div>
    <div class="pill pill-green">Roster Count: ${filteredMembers.length} Members</div>
    <div class="pill pill-gold">Avg Attendance Rate: ${matrixStats.avgAttendancePct.toFixed(1)}%</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25px; text-align: center;">#</th>
        <th style="min-width: 140px;">Member Name</th>
        <th style="min-width: 100px;">Buddy Group</th>
        ${eventThs}
        <th style="text-align: center; min-width: 70px;">Attended</th>
        <th style="text-align: center; min-width: 60px;">Rate (%)</th>
      </tr>
    </thead>
    <tbody>${memberRows}</tbody>
  </table>

  <div class="signature-block">
    <div class="sig-line">Club President</div>
    <div class="sig-line">Club Secretary</div>
    <div class="sig-line">Attendance Director</div>
  </div>

  <div class="footer">
    <span>${orgName} — Monthly Attendance Matrix — ${monthLabel}</span>
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
      toast.success("Monthly matrix printed successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to print matrix.");
    } finally {
      setPrintingMatrix(false);
    }
  }

  const isLoading = membersLoading || eventsLoading || regsLoading;

  if (isLoading) {
    return <LoadingScreen variant="light" />;
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Month & Filter Controls Header Card */}
      <PageCard className="p-4 sm:p-5 bg-white border border-border/40 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#f4f6fb] rounded-xl px-3 py-2 border border-slate-200/80 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#17458F]" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Month:</span>
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-extrabold text-[#001D4A] cursor-pointer"
            />
          </div>

          <div className="w-full sm:w-48">
            <SelectInput
              label=""
              options={[
                { value: "all", label: "All Buddy Groups" },
                ...configuredGroups.map((g) => ({ value: g, label: g })),
              ]}
              value={buddyGroupFilter}
              onChange={setBuddyGroupFilter}
            />
          </div>

          <div className="flex items-center gap-2 bg-[#f4f6fb] rounded-xl px-3 py-2 border border-slate-200/80 w-full sm:w-64">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search member name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full text-foreground placeholder-muted-foreground"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial py-2.5 px-3.5 sm:px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet size={15} /> Export CSV
          </button>

          <button
            onClick={handlePrintMonthlyMatrix}
            disabled={printingMatrix}
            className="flex-1 sm:flex-initial py-2.5 px-3.5 sm:px-4 bg-[#001D4A] hover:bg-[#001D4A]/90 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
          >
            {printingMatrix ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Printer size={15} /> Print Matrix
              </>
            )}
          </button>
        </div>
      </PageCard>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-border/40 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-[#17458F] flex items-center justify-center shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">Meetings</p>
            <p className="text-sm sm:text-lg font-black text-[#001D4A]">{matrixStats.totalEvents} Events</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-border/40 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
          <div>
            <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Roster</p>
            <p className="text-sm sm:text-lg font-black text-slate-900">{matrixStats.totalMembers} Members</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-border/40 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">Avg Attendance</p>
            <p className="text-sm sm:text-lg font-black text-amber-700">{matrixStats.avgAttendancePct.toFixed(1)}%</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-border/40 shadow-xs flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Award size={18} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">Top Meeting</p>
            <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
              {matrixStats.mostAttendedEvent || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Matrix Table */}
      {!monthEvents || monthEvents.length === 0 ? (
        <PageCard className="text-center py-16 bg-white border border-border/40 shadow-sm">
          <Calendar className="w-14 h-14 mx-auto text-muted-foreground/50 mb-3 stroke-[1.2]" />
          <h3 className="text-base font-bold" style={{ color: NAVY }}>No Meetings Found for {monthLabel}</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            There were no events scheduled or recorded in this calendar month. Try selecting another month above.
          </p>
        </PageCard>
      ) : filteredMembers.length === 0 ? (
        <PageCard className="text-center py-16 bg-white border border-border/40 shadow-sm">
          <Users className="w-14 h-14 mx-auto text-muted-foreground/50 mb-3 stroke-[1.2]" />
          <h3 className="text-base font-bold" style={{ color: NAVY }}>No Members Match Filters</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Adjust your search keyword or buddy group filter to display member attendance rows.
          </p>
        </PageCard>
      ) : (
        <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-w-full touch-pan-x">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200">
                  <th className="py-3 px-3 sm:px-4 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider sticky left-0 bg-slate-100 z-20 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] min-w-[150px] sm:min-w-[200px]">
                    Member & Buddy Group
                  </th>
                  {monthEvents.map((ev) => (
                    <th key={ev.id} className="py-3 px-2.5 sm:px-3 text-center min-w-[110px] border-r border-slate-200/60">
                      <div className="text-[10px] font-extrabold text-[#001D4A] uppercase tracking-wider">
                        {new Date(ev.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </div>
                      <div className="text-[11px] font-bold text-slate-700 truncate max-w-[100px] mx-auto mt-0.5" title={ev.title}>
                        {ev.title}
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-3 sm:px-4 text-center text-[10px] font-extrabold uppercase text-slate-500 tracking-wider min-w-[100px]">
                    Attended / Total
                  </th>
                  <th className="py-3 px-3 sm:px-4 text-center text-[10px] font-extrabold uppercase text-slate-500 tracking-wider min-w-[85px]">
                    Rate (%)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((m, idx) => {
                  let attendedCount = 0;
                  const rowBgClass = idx % 2 === 0 ? "bg-white" : "bg-slate-50/40";

                  return (
                    <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${rowBgClass}`}>
                      {/* Sticky Member Column */}
                      <td className={`py-2.5 sm:py-3 px-3 sm:px-4 sticky left-0 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] ${idx % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}`}>
                        <p className="text-xs font-extrabold text-[#001D4A] truncate max-w-[140px] sm:max-w-none">{m.full_name}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate max-w-[140px] sm:max-w-none">{m.buddy_group || "Unassigned"}</p>
                      </td>

                      {/* Event Attendance Cells */}
                      {monthEvents.map((ev) => {
                        const reg = regMap.get(`${m.id}_${ev.id}`) || regMap.get(`${m.full_name.trim().toLowerCase()}_${ev.id}`);
                        const isPresent = reg?.status === "checked-in";
                        const isApology = reg?.status === "apology";

                        if (isPresent) attendedCount++;

                        return (
                          <td key={ev.id} className="py-2.5 sm:py-3 px-2 sm:px-3 text-center border-r border-slate-200/60">
                            {isPresent ? (
                              <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs whitespace-nowrap">
                                <CheckCircle size={12} /> Present
                              </span>
                            ) : isApology ? (
                              <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs whitespace-nowrap">
                                <Mail size={12} /> Apology
                              </span>
                            ) : (
                              <span className="text-slate-300 font-bold text-xs">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Attended */}
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-extrabold text-xs text-slate-800 whitespace-nowrap">
                        {attendedCount} / {monthEvents.length}
                      </td>

                      {/* Attendance Percentage */}
                      {(() => {
                        const ratePct = monthEvents.length > 0 ? (attendedCount / monthEvents.length) * 100 : 0;
                        return (
                          <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-black text-xs whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md ${
                                ratePct >= 50
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ratePct > 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {ratePct.toFixed(0)}%
                            </span>
                          </td>
                        );
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
