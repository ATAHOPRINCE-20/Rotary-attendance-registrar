import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase";
import { PageCard, SelectInput } from "../../shared/PageCard";
import { NAVY, parseBuddyGroups, isSyntheticEmail } from "../../../../lib/constants";
import { Users, Search, FileSpreadsheet, CheckCircle, Mail, Clock, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../../shared/LoadingScreen";

interface MemberSummaryReportProps {
  organization: any;
  members: any[];
  membersLoading: boolean;
}

export function MemberSummaryReport({ organization, members, membersLoading }: MemberSummaryReportProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [buddyGroupFilter, setBuddyGroupFilter] = useState<string>("all");

  // Fetch lightweight registrations overall to calculate total member statistics
  const { data: allRegistrations, isLoading: regsLoading } = useQuery({
    queryKey: ["member-summary-regs", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("id, event_id, status, is_member, member_id, full_name, buddy_group")
        .eq("organization_id", organization.id);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch total event count
  const { data: allEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["member-summary-events", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date, status")
        .eq("organization_id", organization.id);

      if (error) throw error;
      return data || [];
    },
  });

  const configuredGroups = useMemo(() => {
    return parseBuddyGroups(organization?.buddy_groups);
  }, [organization?.buddy_groups]);

  // Aggregate stats per member
  const memberStats = useMemo(() => {
    if (!members) return [];
    const totalEventsCount = allEvents?.length || 0;

    const statsMap: Record<string, { present: number; apologies: number }> = {};

    if (allRegistrations) {
      allRegistrations.forEach((r) => {
        const key = r.member_id || r.full_name?.trim().toLowerCase();
        if (!key) return;
        if (!statsMap[key]) statsMap[key] = { present: 0, apologies: 0 };
        if (r.status === "checked-in") statsMap[key].present++;
        else if (r.status === "apology") statsMap[key].apologies++;
      });
    }

    return members
      .filter((m) => {
        const matchesSearch =
          m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (m.email && m.email.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesGroup =
          buddyGroupFilter === "all" ||
          (m.buddy_group && m.buddy_group.trim().toLowerCase() === buddyGroupFilter.toLowerCase());

        return matchesSearch && matchesGroup;
      })
      .map((m) => {
        const keyId = m.id;
        const keyName = m.full_name.trim().toLowerCase();
        const stat = statsMap[keyId] || statsMap[keyName] || { present: 0, apologies: 0 };

        const visitsCount = m.visits?.length || 0;
        const makeupsCount = m.makeups?.length || 0;
        const effectivePresent = stat.present + makeupsCount;

        const ratePct = totalEventsCount > 0 ? (effectivePresent / totalEventsCount) * 100 : 0;

        return {
          ...m,
          presentCount: stat.present,
          apologyCount: stat.apologies,
          visitsCount,
          makeupsCount,
          effectivePresent,
          ratePct,
        };
      })
      .sort((a, b) => b.ratePct - a.ratePct);
  }, [members, allRegistrations, allEvents, searchTerm, buddyGroupFilter]);

  function handleExportCSV() {
    if (memberStats.length === 0) {
      toast.error("No member data to export.");
      return;
    }

    const headers = [
      "Member Name",
      "Buddy Group",
      "Email",
      "Phone",
      "Meetings Attended",
      "Apologies Logged",
      "Make-ups Recorded",
      "Visits Logged",
      "Total Meetings",
      "Attendance Rate (%)",
    ];

    const rows = memberStats.map((m) => [
      `"${m.full_name.replace(/"/g, '""')}"`,
      `"${(m.buddy_group || "Unassigned").replace(/"/g, '""')}"`,
      `"${(!isSyntheticEmail(m.email) ? m.email || "" : "").replace(/"/g, '""')}"`,
      `"${(m.phone || "").replace(/"/g, '""')}"`,
      m.presentCount,
      m.apologyCount,
      m.makeupsCount,
      m.visitsCount,
      allEvents?.length || 0,
      `"${m.ratePct.toFixed(1)}%"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.join("\n")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Member_Attendance_Summary.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Member summary exported to CSV!");
  }

  const isLoading = membersLoading || regsLoading || eventsLoading;

  if (isLoading) {
    return <LoadingScreen variant="light" />;
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Controls */}
      <PageCard className="p-4 sm:p-5 bg-white border border-border/40 shadow-sm flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto">
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

        <button
          onClick={handleExportCSV}
          className="w-full sm:w-auto py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <FileSpreadsheet size={15} /> Export CSV
        </button>
      </PageCard>

      {/* Member Audit Summary Table */}
      <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-[#001D4A] flex items-center gap-2" style={{ fontFamily: "var(--font-sans)" }}>
            <Users size={18} className="text-[#17458F]" />
            Member Attendance Audit & Make-up History
          </h3>
          <span className="text-xs font-bold text-slate-500">Total Events: {allEvents?.length || 0}</span>
        </div>

        <div className="overflow-x-auto max-w-full touch-pan-x">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                <th className="py-3 px-4 sticky left-0 bg-slate-100 z-20 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] min-w-[140px] sm:min-w-[180px]">
                  Member Name
                </th>
                <th className="py-3 px-4 min-w-[120px]">Buddy Group</th>
                <th className="py-3 px-4 text-center min-w-[120px]">Attended Meetings</th>
                <th className="py-3 px-4 text-center min-w-[120px]">Apologies Logged</th>
                <th className="py-3 px-4 text-center min-w-[150px]">Make-ups / Visits</th>
                <th className="py-3 px-4 text-center min-w-[100px]">Overall Rate (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {memberStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 italic text-xs">
                    No members match search criteria.
                  </td>
                </tr>
              ) : (
                memberStats.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className={`py-3 px-4 sticky left-0 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] ${idx % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}`}>
                      <p className="text-xs font-extrabold text-[#001D4A] truncate max-w-[130px] sm:max-w-none">{m.full_name}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate max-w-[130px] sm:max-w-none">{!isSyntheticEmail(m.email) ? m.email : m.phone || "—"}</p>
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-slate-700 whitespace-nowrap">{m.buddy_group || "Unassigned"}</td>
                    <td className="py-3 px-4 text-center text-xs font-extrabold text-emerald-700 whitespace-nowrap">{m.presentCount}</td>
                    <td className="py-3 px-4 text-center text-xs font-bold text-amber-700 whitespace-nowrap">{m.apologyCount}</td>
                    <td className="py-3 px-4 text-center text-xs font-bold text-blue-700 whitespace-nowrap">
                      {m.makeupsCount} make-ups &bull; {m.visitsCount} visits
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-black whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-md ${
                          m.ratePct >= 50
                            ? "bg-emerald-100 text-emerald-800"
                            : m.ratePct > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {m.ratePct.toFixed(1)}%
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
