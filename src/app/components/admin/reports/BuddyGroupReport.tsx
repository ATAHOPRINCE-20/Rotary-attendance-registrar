import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase";
import { PageCard, SelectInput } from "../../shared/PageCard";
import { NAVY, parseBuddyGroups } from "../../../../lib/constants";
import { Users, Award, TrendingUp, Calendar, Printer, FileSpreadsheet, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../../shared/LoadingScreen";

interface BuddyGroupReportProps {
  organization: any;
  members: any[];
  membersLoading: boolean;
}

export function BuddyGroupReport({ organization, members, membersLoading }: BuddyGroupReportProps) {
  const todayISO = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayISO);
  const [printingReport, setPrintingReport] = useState<boolean>(false);

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
    queryKey: ["buddy-report-events", organization?.id, selectedMonth],
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

  // Query registrations
  const { data: monthRegistrations, isLoading: regsLoading } = useQuery({
    queryKey: ["buddy-report-regs", organization?.id, selectedMonth],
    enabled: !!organization?.id && !!monthEvents && monthEvents.length > 0,
    queryFn: async () => {
      const eventIds = monthEvents!.map((e) => e.id);
      if (eventIds.length === 0) return [];

      const { data, error } = await supabase
        .from("registrations")
        .select("id, event_id, status, is_member, member_id, full_name, buddy_group")
        .eq("organization_id", organization.id)
        .in("event_id", eventIds);

      if (error) throw error;
      return data || [];
    },
  });

  // Configured buddy groups
  const groupStats = useMemo(() => {
    const configured = parseBuddyGroups(organization?.buddy_groups);
    const presentGroups = new Set<string>();

    if (monthRegistrations) {
      monthRegistrations.forEach((r) => {
        if (r.buddy_group && r.buddy_group.trim()) {
          presentGroups.add(r.buddy_group.trim());
        }
      });
    }

    const allGroups = Array.from(new Set([...configured, ...presentGroups]));
    const totalEvents = monthEvents?.length || 0;

    const list = allGroups.map((groupName) => {
      const groupMembers = (members || []).filter(
        (m) => m.buddy_group && m.buddy_group.trim().toLowerCase() === groupName.toLowerCase()
      );
      const rosterCount = groupMembers.length;

      let checkedInCount = 0;
      let apologyCount = 0;

      if (monthRegistrations) {
        monthRegistrations.forEach((r) => {
          if (
            r.buddy_group &&
            r.buddy_group.trim().toLowerCase() === groupName.toLowerCase() &&
            r.status === "checked-in"
          ) {
            checkedInCount++;
          } else if (
            r.buddy_group &&
            r.buddy_group.trim().toLowerCase() === groupName.toLowerCase() &&
            r.status === "apology"
          ) {
            apologyCount++;
          }
        });
      }

      const totalExpected = rosterCount * totalEvents;
      const attendancePct = totalExpected > 0 ? (checkedInCount / totalExpected) * 100 : 0;

      return {
        name: groupName,
        rosterCount,
        checkedInCount,
        apologyCount,
        totalEvents,
        attendancePct,
        members: groupMembers,
      };
    });

    list.sort((a, b) => b.attendancePct - a.attendancePct);
    return list;
  }, [organization?.buddy_groups, monthRegistrations, members, monthEvents]);

  function handleExportCSV() {
    if (groupStats.length === 0) {
      toast.error("No buddy group data to export.");
      return;
    }

    const headers = ["Buddy Group", "Roster Headcount", "Total Check-ins", "Apologies Logged", "Total Meetings", "Attendance Rate (%)"];
    const rows = groupStats.map((g) => [
      `"${g.name.replace(/"/g, '""')}"`,
      g.rosterCount,
      g.checkedInCount,
      g.apologyCount,
      g.totalEvents,
      `"${g.attendancePct.toFixed(1)}%"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.join("\n")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Buddy_Group_Attendance_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Buddy Group report exported to CSV!");
  }

  const isLoading = membersLoading || eventsLoading || regsLoading;

  if (isLoading) {
    return <LoadingScreen variant="light" />;
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Month Selector & Controls */}
      <PageCard className="p-4 sm:p-5 bg-white border border-border/40 shadow-sm flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
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

        <button
          onClick={handleExportCSV}
          className="w-full sm:w-auto py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <FileSpreadsheet size={15} /> Export CSV
        </button>
      </PageCard>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200/60 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#001D4A] flex items-center gap-2" style={{ fontFamily: "var(--font-sans)" }}>
            <Award size={18} className="text-[#F7A81B]" />
            Buddy Group Leaderboard ({monthLabel})
          </h3>
        </div>

        <div className="overflow-x-auto max-w-full touch-pan-x">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                <th className="py-3 px-3 sm:px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-3 sm:px-4 min-w-[140px]">Buddy Group Name</th>
                <th className="py-3 px-3 sm:px-4 text-center min-w-[110px]">Roster Headcount</th>
                <th className="py-3 px-3 sm:px-4 text-center min-w-[110px]">Total Check-ins</th>
                <th className="py-3 px-3 sm:px-4 text-center min-w-[110px]">Apologies Logged</th>
                <th className="py-3 px-3 sm:px-4 text-center min-w-[120px]">Attendance Rate (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 italic text-xs">
                    No buddy groups configured or recorded for this month.
                  </td>
                </tr>
              ) : (
                groupStats.map((group, idx) => (
                  <tr key={group.name} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 sm:px-4 text-center font-black text-xs text-slate-600">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      <p className="text-xs font-extrabold text-[#001D4A] whitespace-nowrap">{group.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{group.rosterCount} registered members</p>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-center text-xs font-bold text-slate-800 whitespace-nowrap">{group.rosterCount}</td>
                    <td className="py-3 px-3 sm:px-4 text-center text-xs font-extrabold text-emerald-700 whitespace-nowrap">{group.checkedInCount}</td>
                    <td className="py-3 px-3 sm:px-4 text-center text-xs font-bold text-amber-700 whitespace-nowrap">{group.apologyCount}</td>
                    <td className="py-3 px-3 sm:px-4 text-center text-xs font-black whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-md ${
                          group.attendancePct >= 50
                            ? "bg-emerald-100 text-emerald-800"
                            : group.attendancePct > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {group.attendancePct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
