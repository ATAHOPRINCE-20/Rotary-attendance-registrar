import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import type { Event, Organization, Registration, FellowshipReport } from "../../../types/database";
import { X, Printer, Save, Loader2, FileText, CheckCircle2, UserCheck, DollarSign, Users, Award } from "lucide-react";
import { toast } from "sonner";
import { NAVY, GOLD } from "../../../lib/constants";
import { RotaryLogo } from "../shared/RotaryLogo";

interface FellowshipReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
  organization: Organization | null;
}

export function FellowshipReportModal({
  isOpen,
  onClose,
  event,
  organization,
}: FellowshipReportModalProps) {
  const queryClient = useQueryClient();

  // Form State
  const [report, setReport] = useState<FellowshipReport>({
    presided_by: "",
    grace_by: "",
    loyal_toast_by: "",
    away_toast_by: "",
    object_of_rotary_by: "",
    final_toast_by: "",
    sergeant_at_arms: "",
    guest_speaker_name: "",
    guest_speaker_contact: "",
    guest_speaker_introduced_by: "",
    guest_speaker_topic: "",
    guest_speaker_thanks_by: "",
    polio_plus_collections: 0,
    rotarians_collections: 0,
    sergeant_collections: 0,
    account_redemption_collections: 0,
    general_collections: 0,
    secretary_directors_report: "",
    secretary_name: "",
  });

  const [activeTab, setActiveTab] = useState<"edit" | "preview">("preview");

  // Load existing report from event if saved
  useEffect(() => {
    if (event?.fellowship_report) {
      setReport((prev) => ({
        ...prev,
        ...event.fellowship_report,
      }));
    } else if (event?.description) {
      try {
        if (event.description.startsWith("[FELLOWSHIP_REPORT]")) {
          const parsed = JSON.parse(event.description.replace("[FELLOWSHIP_REPORT]", ""));
          setReport((prev) => ({ ...prev, ...parsed }));
        }
      } catch (e) {
        // Not a JSON report string
      }
    }
  }, [event]);

  // Fetch checked-in registrations for this event
  const { data: registrations = [] } = useQuery({
    queryKey: ["event-registrations-report", event?.id],
    enabled: !!event?.id && isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("event_id", event!.id);
      if (error) throw error;
      return (data as Registration[]) || [];
    },
  });

  const targetOrgId = organization?.id || event?.organization_id;

  // Fetch total active club members with buddy groups
  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org-members-report", targetOrgId],
    enabled: !!targetOrgId && isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, buddy_group")
        .eq("organization_id", targetOrgId!);
      if (error) return [];
      return data || [];
    },
  });

  const totalClubMembersCount = orgMembers.length;

  // Fetch system donations tied to this event
  const { data: eventDonations = [] } = useQuery({
    queryKey: ["event-donations-report", event?.id],
    enabled: !!event?.id && isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .eq("event_id", event!.id)
        .eq("status", "completed");
      if (error) return [];
      return data || [];
    },
  });

  // Categorize Attendees
  const checkedInList = registrations.filter(
    (r) => r.status !== "apology"
  );

  const clubMembersPresent = checkedInList.filter(
    (r) => r.is_member && (r.member_id || (r.buddy_group && r.buddy_group.trim() !== "") || !r.club_name || r.club_name.trim() === "")
  );

  const nonClubMembers = checkedInList.filter(
    (r) => !clubMembersPresent.includes(r)
  );

  const visitingRotaractors = nonClubMembers.filter(
    (r) =>
      r.club_name &&
      (r.club_name.toLowerCase().includes("rotaract") ||
        r.club_name.toLowerCase().startsWith("rac "))
  );

  const visitingRotarians = nonClubMembers.filter(
    (r) =>
      !visitingRotaractors.includes(r) &&
      (r.is_member ||
        (r.club_name &&
          (r.club_name.toLowerCase().includes("rotary") ||
            r.club_name.toLowerCase().startsWith("rc "))))
  );

  const generalGuests = nonClubMembers.filter(
    (r) =>
      !visitingRotarians.includes(r) && !visitingRotaractors.includes(r)
  );

  // Extract all distinct buddy groups configured for the event/club or assigned to members
  const rawBuddyGroupsList = Array.from(
    new Set<string>([
      ...(event?.buddy_groups ? event.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean) : []),
      ...(organization?.buddy_groups ? organization.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean) : []),
      ...orgMembers.map((m) => m.buddy_group?.trim()).filter(Boolean),
      ...registrations.map((r) => r.buddy_group?.trim()).filter(Boolean),
    ])
  ).filter(Boolean);

  const effectiveBuddyGroups = rawBuddyGroupsList.length > 0 ? rawBuddyGroupsList : ["Group A", "Group B", "Group C", "Group D"];

  // Compute breakdown stats per Buddy Group
  const buddyGroupStats = effectiveBuddyGroups.map((bgName) => {
    const presentCount = clubMembersPresent.filter((r) => {
      const matchedMem = orgMembers.find(
        (m) => m.id === r.member_id || m.full_name.toLowerCase().trim() === r.full_name.toLowerCase().trim()
      );
      const bg = r.buddy_group || matchedMem?.buddy_group;
      return bg?.trim().toLowerCase() === bgName.toLowerCase();
    }).length;

    const totalCount = orgMembers.filter(
      (m) => m.buddy_group && m.buddy_group.trim().toLowerCase() === bgName.toLowerCase()
    ).length;

    return {
      name: bgName,
      present: presentCount,
      total: totalCount,
    };
  });

  // Auto-calculated online donations
  const autoDonationSum = eventDonations.reduce((acc, d) => acc + (d.amount || 0), 0);

  // Mutation to save report to event with schema fallback
  const saveReportMutation = useMutation({
    mutationFn: async () => {
      if (!event) return;

      // 1. Try direct update of fellowship_report column
      const { error } = await supabase
        .from("events")
        .update({ fellowship_report: report as any })
        .eq("id", event.id);

      // 2. Fallback if fellowship_report column hasn't been added to Supabase schema yet
      if (error) {
        console.warn("fellowship_report column error, saving via description fallback:", error.message);
        const fallbackValue = `[FELLOWSHIP_REPORT]${JSON.stringify(report)}`;
        const { error: fallbackErr } = await supabase
          .from("events")
          .update({ description: fallbackValue })
          .eq("id", event.id);

        if (fallbackErr) throw fallbackErr;
      }
    },
    onSuccess: () => {
      toast.success("Report saved to archives successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["archive-events"] });
      queryClient.invalidateQueries({ queryKey: ["event-details", event?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save fellowship report");
    },
  });

  // Print Utility using a dedicated clean pop-up window
  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=850,height=1100");
    if (!printWindow) {
      toast.error("Popup blocked! Please allow popups to print the report.");
      return;
    }

    const orgTitle = organization?.name ?? "ROTARY CLUB OF NTINDA";
    const dateFormatted = event
      ? new Date(event.date).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

    const visitorRowsHtml = nonClubMembers.length === 0
      ? `<tr><td colspan="4" style="padding:10px; text-align:center; color:#94a3b8; font-style:italic;">No visiting Rotarians or guests recorded.</td></tr>`
      : nonClubMembers.map((v, i) => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6px 8px; font-weight: bold; color: #64748b;">${i + 1}</td>
            <td style="padding: 6px 8px; font-weight: bold; color: #0f172a;">${v.full_name}</td>
            <td style="padding: 6px 8px; color: #475569;">${v.phone || v.email || "—"}</td>
            <td style="padding: 6px 8px; color: #334155;">${v.club_name || v.organization_name || "Guest"}</td>
          </tr>
        `).join("");

    const secretaryReportHtml = report.secretary_directors_report
      ? `<div style="font-size: 13px; line-height: 1.6; color: #0f172a; white-space: pre-wrap; font-family: serif; background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; min-height: 200px;">${report.secretary_directors_report}</div>`
      : `
        <div style="margin-top: 10px;">
          <div style="border-bottom: 1px solid #94a3b8; height: 26px;"></div>
          <div style="border-bottom: 1px solid #94a3b8; height: 26px;"></div>
          <div style="border-bottom: 1px solid #94a3b8; height: 26px;"></div>
          <div style="border-bottom: 1px solid #94a3b8; height: 26px;"></div>
          <div style="border-bottom: 1px solid #94a3b8; height: 26px;"></div>
          <div style="border-bottom: 1px solid #94a3b8; height: 26px;"></div>
          <div style="border-bottom: 1px solid #94a3b8; height: 26px;"></div>
        </div>
      `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${orgTitle} - Regular Fellowship Report</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #001D4A;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            .header h1 {
              font-size: 20px;
              font-weight: 900;
              color: #001D4A;
              margin: 0;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            .header h2 {
              font-size: 13px;
              font-weight: 800;
              color: #F7A81B;
              margin: 4px 0 0 0;
              letter-spacing: 1.5px;
              text-transform: uppercase;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px 24px;
              font-size: 12px;
              margin-bottom: 20px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 16px;
            }
            .label {
              font-weight: bold;
              color: #475569;
              text-transform: uppercase;
            }
            .value {
              font-weight: 700;
              color: #0f172a;
              border-bottom: 1px dotted #94a3b8;
              padding-bottom: 2px;
            }
            .section-box {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 14px;
              margin-bottom: 20px;
              background: #fafafa;
            }
            .section-title {
              font-size: 12px;
              font-weight: 900;
              color: #001D4A;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0 0 10px 0;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            .speaker-row {
              font-size: 12px;
              margin-bottom: 6px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              font-size: 12px;
              margin-bottom: 20px;
            }
            .stat-card {
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 8px 12px;
              background: #ffffff;
            }
            .collections-list {
              font-size: 12px;
              margin-bottom: 20px;
            }
            .collection-item {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
              border-bottom: 1px solid #f1f5f9;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-bottom: 20px;
            }
            th {
              background: #f1f5f9;
              color: #334155;
              font-weight: 800;
              text-transform: uppercase;
              font-size: 10px;
              text-align: left;
              padding: 8px;
              border-bottom: 1px solid #cbd5e1;
            }
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 15px;
              font-size: 11px;
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #cbd5e1;
            }
            .sig-line {
              border-bottom: 1px dotted #94a3b8;
              margin-top: 25px;
              padding-bottom: 2px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${orgTitle}</h1>
            <h2>REGULAR FELLOWSHIP REPORT</h2>
          </div>

          <div class="grid-2">
            <div><span class="label">DATE: </span><span class="value">${dateFormatted}</span></div>
            <div><span class="label">PRESIDED OVER BY: </span><span class="value">${report.presided_by || "..........................................................."}</span></div>
            <div><span class="label">THE GRACE BY: </span><span class="value">${report.grace_by || "..........................................................."}</span></div>
            <div><span class="label">LOYAL TOAST BY: </span><span class="value">${report.loyal_toast_by || "..........................................................."}</span></div>
            <div><span class="label">AWAY TOAST BY: </span><span class="value">${report.away_toast_by || "..........................................................."}</span></div>
            <div><span class="label">OBJECT OF ROTARY BY: </span><span class="value">${report.object_of_rotary_by || "..........................................................."}</span></div>
          </div>

          <div class="section-box">
            <div class="section-title">GUEST SPEAKER</div>
            <div class="speaker-row"><span class="label">Name: </span><span class="value">${report.guest_speaker_name || "......................................................................................................................................................"}</span></div>
            <div class="speaker-row"><span class="label">Contact: </span><span class="value">${report.guest_speaker_contact || "..................................................................................................................................................."}</span></div>
            <div class="speaker-row"><span class="label">Introduced by: </span><span class="value">${report.guest_speaker_introduced_by || ".........................................................................................................................................."}</span></div>
            <div class="speaker-row"><span class="label">Topics: </span><span class="value">${report.guest_speaker_topic || "......................................................................................................................................................."}</span></div>
            <div class="speaker-row"><span class="label">Vote of Thanks by: </span><span class="value">${report.guest_speaker_thanks_by || "..................................................................................................................................."}</span></div>
          </div>

          <div class="section-title">ATTENDANCE</div>
          <div class="stats-grid">
            <div class="stat-card"><strong>Club Members: </strong><span style="color:#001D4A; font-weight:900;">${clubMembersPresent.length}</span> Out of <strong>${totalClubMembersCount}</strong></div>
            <div class="stat-card"><strong>Visiting Rotarians: </strong><span style="color:#001D4A; font-weight:900;">${visitingRotarians.length}</span></div>
            <div class="stat-card"><strong>Visiting Rotaractors: </strong><span style="color:#001D4A; font-weight:900;">${visitingRotaractors.length}</span></div>
            <div class="stat-card"><strong>Guests: </strong><span style="color:#001D4A; font-weight:900;">${generalGuests.length}</span></div>
          </div>

          ${buddyGroupStats.length > 0 ? `
            <div class="section-title" style="margin-top: 10px; font-size: 11px;">BUDDY GROUP ATTENDANCE BREAKDOWN</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 20px;">
              ${buddyGroupStats.map(bg => `
                <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; background: #ffffff; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                  <span style="font-weight: 700; color: #475569;">${bg.name}:</span>
                  <span style="font-weight: 900; color: #001D4A;">
                    ${bg.present} ${bg.total > 0 ? `<span style="font-weight: 500; color: #64748b;">/ ${bg.total}</span>` : 'present'}
                  </span>
                </div>
              `).join("")}
            </div>
          ` : ''}

          <div class="section-title">COLLECTIONS</div>
          <div class="collections-list">
            <div class="collection-item"><span>Polio Plus:</span><strong>UGX ${(report.polio_plus_collections || 0).toLocaleString()}</strong></div>
            <div class="collection-item"><span>Rotarians Collections:</span><strong>UGX ${(report.rotarians_collections || 0).toLocaleString()}</strong></div>
            <div class="collection-item"><span>Sergeant At Arms:</span><strong>UGX ${(report.sergeant_collections || 0).toLocaleString()}</strong></div>
            <div class="collection-item"><span>Account Redemption:</span><strong>UGX ${(report.account_redemption_collections || 0).toLocaleString()}</strong></div>
            <div class="collection-item"><span>General Collections:</span><strong>UGX ${(report.general_collections || 0).toLocaleString()}</strong></div>
          </div>

          <div class="section-title">VISITORS REGISTER (${nonClubMembers.length})</div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Visitor Name</th>
                <th>Contact</th>
                <th>Club / Organization</th>
              </tr>
            </thead>
            <tbody>
              ${visitorRowsHtml}
            </tbody>
          </table>

          <div style="page-break-before: auto; margin-top: 25px; padding-top: 15px; border-top: 2px solid #001D4A;">
            <div class="section-title" style="text-align: center; font-size: 13px;">SECRETARY / DIRECTORS’ REPORT</div>
            ${secretaryReportHtml}
          </div>
        </body>
      </html>`;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  if (!isOpen || !event) return null;

  const eventDateFormatted = new Date(event.date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      {/* Container */}
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[78vh] sm:max-h-[90vh]">
        
        {/* Responsive Header */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <RotaryLogo size={28} className="shrink-0" />
              <div className="min-w-0">
                <h2 className="font-extrabold text-xs text-[#001D4A] uppercase tracking-wide truncate">
                  Regular Report
                </h2>
                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  {event.title} • {eventDateFormatted}
                </p>
              </div>
            </div>
            {/* Mobile Close Button */}
            <button
              onClick={onClose}
              className="sm:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer shrink-0 ml-2"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
            {/* Tab Switcher */}
            <div className="flex bg-slate-100/90 rounded-lg p-0.5 border border-slate-200 text-xs font-semibold shrink-0">
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "preview"
                    ? "bg-white text-[#001D4A] font-bold shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setActiveTab("edit")}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "edit"
                    ? "bg-white text-[#001D4A] font-bold shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Edit Data
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Print Action */}
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 bg-[#001D4A] hover:bg-[#002868] text-white rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap"
                title="Print clean official report"
              >
                <Printer size={13} /> <span className="hidden sm:inline">Print / Save PDF</span><span className="sm:hidden">Print</span>
              </button>

              {/* Save Action */}
              <button
                onClick={() => saveReportMutation.mutate()}
                disabled={saveReportMutation.isPending}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
              >
                {saveReportMutation.isPending ? (
                  <Loader2 size={13} className="animate-spin text-slate-500" />
                ) : (
                  <Save size={13} className="text-slate-500" />
                )}
                <span className="hidden sm:inline">Save Report</span><span className="sm:hidden">Save</span>
              </button>

              {/* Desktop Close Button */}
              <button
                onClick={onClose}
                className="hidden sm:block p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer ml-1"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50">
          
          {/* ── EDIT TAB ─────────────────────────────────────────────────────────────── */}
          {activeTab === "edit" && (
            <div className="space-y-6 max-w-3xl mx-auto">
              
              {/* Meeting Officers */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-black text-[#001D4A] uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Award size={16} className="text-[#F7A81B]" /> Fellowship Meeting Officers
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Presided Over By</label>
                    <input
                      type="text"
                      value={report.presided_by || ""}
                      onChange={(e) => setReport({ ...report, presided_by: e.target.value })}
                      placeholder="e.g. Rtn. President..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">The Grace By</label>
                    <input
                      type="text"
                      value={report.grace_by || ""}
                      onChange={(e) => setReport({ ...report, grace_by: e.target.value })}
                      placeholder="e.g. Rtn. grace"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Loyal Toast By</label>
                    <input
                      type="text"
                      value={report.loyal_toast_by || ""}
                      onChange={(e) => setReport({ ...report, loyal_toast_by: e.target.value })}
                      placeholder="e.g. Rtn. Mary "
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Away Toast By</label>
                    <input
                      type="text"
                      value={report.away_toast_by || ""}
                      onChange={(e) => setReport({ ...report, away_toast_by: e.target.value })}
                      placeholder="e.g. Rtn. Alex Prince"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Object of Rotary By</label>
                    <input
                      type="text"
                      value={report.object_of_rotary_by || ""}
                      onChange={(e) => setReport({ ...report, object_of_rotary_by: e.target.value })}
                      placeholder="e.g. Rtn. David Kasibante"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Sergeant At Arms</label>
                    <input
                      type="text"
                      value={report.sergeant_at_arms || ""}
                      onChange={(e) => setReport({ ...report, sergeant_at_arms: e.target.value })}
                      placeholder="e.g. Rtn. Sergeant"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Final Toast By</label>
                    <input
                      type="text"
                      value={report.final_toast_by || ""}
                      onChange={(e) => setReport({ ...report, final_toast_by: e.target.value })}
                      placeholder="e.g. Rtn. Grace"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Club Secretary Name</label>
                    <input
                      type="text"
                      value={report.secretary_name || ""}
                      onChange={(e) => setReport({ ...report, secretary_name: e.target.value })}
                      placeholder="e.g. Rtn. Secretary Name"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Guest Speaker */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-black text-[#001D4A] uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <UserCheck size={16} className="text-[#F7A81B]" /> Guest Speaker Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Speaker Name</label>
                    <input
                      type="text"
                      value={report.guest_speaker_name || ""}
                      onChange={(e) => setReport({ ...report, guest_speaker_name: e.target.value })}
                      placeholder="Guest Speaker Name..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Contact</label>
                    <input
                      type="text"
                      value={report.guest_speaker_contact || ""}
                      onChange={(e) => setReport({ ...report, guest_speaker_contact: e.target.value })}
                      placeholder="Phone / Email..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Introduced By</label>
                    <input
                      type="text"
                      value={report.guest_speaker_introduced_by || ""}
                      onChange={(e) => setReport({ ...report, guest_speaker_introduced_by: e.target.value })}
                      placeholder="Rtn. Name..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Topic / Presentation</label>
                    <input
                      type="text"
                      value={report.guest_speaker_topic || ""}
                      onChange={(e) => setReport({ ...report, guest_speaker_topic: e.target.value })}
                      placeholder="Presentation topic..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Vote of Thanks By</label>
                    <input
                      type="text"
                      value={report.guest_speaker_thanks_by || ""}
                      onChange={(e) => setReport({ ...report, guest_speaker_thanks_by: e.target.value })}
                      placeholder="Rtn. Name..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Collections Breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-[#001D4A] uppercase tracking-wider flex items-center gap-2">
                    <DollarSign size={16} className="text-emerald-600" /> Meeting Collections (UGX)
                  </h3>
                  {autoDonationSum > 0 && (
                    <span className="text-[10px] font-extrabold bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-lg">
                      Recorded Online: UGX {autoDonationSum.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Polio Plus Collections</label>
                    <input
                      type="number"
                      value={report.polio_plus_collections || 0}
                      onChange={(e) => setReport({ ...report, polio_plus_collections: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Rotarians Collections</label>
                    <input
                      type="number"
                      value={report.rotarians_collections || 0}
                      onChange={(e) => setReport({ ...report, rotarians_collections: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Sergeant At Arms Collections</label>
                    <input
                      type="number"
                      value={report.sergeant_collections || 0}
                      onChange={(e) => setReport({ ...report, sergeant_collections: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Account Redemption</label>
                    <input
                      type="number"
                      value={report.account_redemption_collections || 0}
                      onChange={(e) => setReport({ ...report, account_redemption_collections: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">General Collections</label>
                    <input
                      type="number"
                      value={report.general_collections || 0}
                      onChange={(e) => setReport({ ...report, general_collections: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Secretary / Directors' Report Notes */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-black text-[#001D4A] uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <FileText size={16} className="text-[#001D4A]" /> Secretary / Directors' Report
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">
                  Type announcements, upcoming club projects, and director reports discussed during fellowship.
                </p>
                <textarea
                  rows={8}
                  value={report.secretary_directors_report || ""}
                  onChange={(e) => setReport({ ...report, secretary_directors_report: e.target.value })}
                  placeholder="Enter Secretary and Directors' report details here..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-[#001D4A] outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setActiveTab("preview")}
                  className="px-5 py-2.5 bg-[#001D4A] text-white rounded-xl text-xs font-bold hover:bg-[#002868] transition-all cursor-pointer shadow-sm"
                >
                  View Document Preview →
                </button>
              </div>
            </div>
          )}

          {/* ── OFFICIAL PREVIEW TEMPLATE ────────────────────────────────────── */}
          {activeTab === "preview" && (
            <div className="max-w-3xl mx-auto bg-white text-slate-900 font-sans p-6 sm:p-10 border border-slate-200 shadow-sm rounded-xl">
              
              {/* Rotary Header */}
              <div className="text-center border-b-2 border-[#001D4A] pb-4 mb-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <RotaryLogo size={48} />
                  <div>
                    <h1 className="text-xl font-black uppercase tracking-wider text-[#001D4A]">
                      {organization?.name ?? "ROTARY CLUB OF NTINDA"}
                    </h1>
                    <h2 className="text-xs font-extrabold tracking-widest text-[#F7A81B] uppercase mt-0.5">
                      REGULAR FELLOWSHIP REPORT
                    </h2>
                  </div>
                </div>
              </div>

              {/* Meeting Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs mb-6 border-b border-slate-200 pb-4">
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-bold uppercase text-slate-500 shrink-0">DATE: </span>
                  <span className="font-bold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 truncate flex-1 min-w-0">
                    {eventDateFormatted}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-bold uppercase text-slate-500 shrink-0">PRESIDED OVER BY: </span>
                  <span className="font-semibold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 truncate flex-1 min-w-0">
                    {report.presided_by || "—"}
                  </span>
                </div>

                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-bold uppercase text-slate-500 shrink-0">THE GRACE BY: </span>
                  <span className="font-semibold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 truncate flex-1 min-w-0">
                    {report.grace_by || "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-bold uppercase text-slate-500 shrink-0">LOYAL TOAST BY: </span>
                  <span className="font-semibold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 truncate flex-1 min-w-0">
                    {report.loyal_toast_by || "—"}
                  </span>
                </div>

                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-bold uppercase text-slate-500 shrink-0">AWAY TOAST BY: </span>
                  <span className="font-semibold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 truncate flex-1 min-w-0">
                    {report.away_toast_by || "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-bold uppercase text-slate-500 shrink-0">OBJECT OF ROTARY BY: </span>
                  <span className="font-semibold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 truncate flex-1 min-w-0">
                    {report.object_of_rotary_by || "—"}
                  </span>
                </div>
              </div>

              {/* Guest Speaker Box */}
              <div className="mb-6 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <h3 className="font-black text-xs uppercase tracking-wider text-[#001D4A] mb-3 border-b border-slate-200 pb-1">
                  GUEST SPEAKER
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 min-w-0">
                    <span className="font-bold text-slate-600 shrink-0 w-32">Name: </span>
                    <span className="font-semibold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 flex-1 min-w-0 break-words">
                      {report.guest_speaker_name || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 min-w-0">
                    <span className="font-bold text-slate-600 shrink-0 w-32">Contact: </span>
                    <span className="font-semibold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 flex-1 min-w-0 break-words">
                      {report.guest_speaker_contact || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 min-w-0">
                    <span className="font-bold text-slate-600 shrink-0 w-32">Introduced by: </span>
                    <span className="font-semibold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 flex-1 min-w-0 break-words">
                      {report.guest_speaker_introduced_by || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 min-w-0">
                    <span className="font-bold text-slate-600 shrink-0 w-32">Topics: </span>
                    <span className="font-semibold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 flex-1 min-w-0 break-words">
                      {report.guest_speaker_topic || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 min-w-0">
                    <span className="font-bold text-slate-600 shrink-0 w-32">Vote of Thanks by: </span>
                    <span className="font-semibold text-slate-900 border-b border-dotted border-slate-400 pb-0.5 px-1 flex-1 min-w-0 break-words">
                      {report.guest_speaker_thanks_by || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attendance Statistics */}
              <div className="mb-6">
                <h3 className="font-black text-xs uppercase tracking-wider text-[#001D4A] mb-2 border-b border-slate-200 pb-1">
                  ATTENDANCE
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="font-bold text-slate-600">Club Members: </span>
                    <span className="font-black text-[#001D4A]">{clubMembersPresent.length}</span> Out of <span className="font-bold">{totalClubMembersCount}</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="font-bold text-slate-600">Visiting Rotarians: </span>
                    <span className="font-black text-[#001D4A]">{visitingRotarians.length}</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="font-bold text-slate-600">Visiting Rotaractors: </span>
                    <span className="font-black text-[#001D4A]">{visitingRotaractors.length}</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <span className="font-bold text-slate-600">Guests: </span>
                    <span className="font-black text-[#001D4A]">{generalGuests.length}</span>
                  </div>
                </div>

                {/* Buddy Group Breakdown Sub-section */}
                {buddyGroupStats.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                      Buddy Group Attendance Breakdown
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {buddyGroupStats.map((bg, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 flex justify-between items-center">
                          <span className="font-bold text-slate-700">{bg.name}:</span>
                          <span className="font-black text-[#001D4A]">
                            {bg.present}{" "}
                            {bg.total > 0 ? (
                              <span className="font-normal text-slate-500 text-[11px]">out of {bg.total}</span>
                            ) : (
                              <span className="font-normal text-slate-500 text-[11px]">present</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Collections Table */}
              <div className="mb-6">
                <h3 className="font-black text-xs uppercase tracking-wider text-[#001D4A] mb-2 border-b border-slate-200 pb-1">
                  COLLECTIONS
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="font-bold text-slate-600">Polio Plus:</span>
                    <span className="font-bold text-slate-900">UGX {(report.polio_plus_collections || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="font-bold text-slate-600">Rotarians Collections:</span>
                    <span className="font-bold text-slate-900">UGX {(report.rotarians_collections || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="font-bold text-slate-600">Sergeant At Arms:</span>
                    <span className="font-bold text-slate-900">UGX {(report.sergeant_collections || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="font-bold text-slate-600">Account Redemption:</span>
                    <span className="font-bold text-slate-900">UGX {(report.account_redemption_collections || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="font-bold text-slate-600">General Collections:</span>
                    <span className="font-bold text-slate-900">UGX {(report.general_collections || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Visitors Register Table */}
              <div className="mb-6">
                <h3 className="font-black text-xs uppercase tracking-wider text-[#001D4A] mb-2 border-b border-slate-200 pb-1">
                  VISITORS REGISTER ({nonClubMembers.length})
                </h3>
                {nonClubMembers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No visiting Rotarians or guests checked in for this fellowship.</p>
                ) : (
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2 border-b border-slate-200">#</th>
                        <th className="p-2 border-b border-slate-200">Visitor Name</th>
                        <th className="p-2 border-b border-slate-200">Contact / Phone</th>
                        <th className="p-2 border-b border-slate-200">Club / Organization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {nonClubMembers.map((v, i) => (
                        <tr key={v.id || i} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-400">{i + 1}</td>
                          <td className="p-2 font-bold text-slate-900">{v.full_name}</td>
                          <td className="p-2 text-slate-600">{v.phone || v.email || "—"}</td>
                          <td className="p-2 text-slate-700">{v.club_name || v.organization_name || "Guest"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* SECRETARY / DIRECTORS' REPORT SECTION */}
              <div className="mb-6 pt-4 border-t-2 border-slate-200">
                <h3 className="font-black text-sm uppercase tracking-wider text-[#001D4A] mb-3 text-center border-b border-slate-200 pb-2">
                  SECRETARY / DIRECTORS’ REPORT
                </h3>

                {report.secretary_directors_report ? (
                  <div className="text-xs text-slate-900 leading-relaxed whitespace-pre-wrap font-serif min-h-[160px] bg-slate-50 p-4 border border-slate-200 rounded-xl">
                    {report.secretary_directors_report}
                  </div>
                ) : (
                  <div className="space-y-6 pt-2">
                    <div className="border-b border-slate-300 h-6"></div>
                    <div className="border-b border-slate-300 h-6"></div>
                    <div className="border-b border-slate-300 h-6"></div>
                    <div className="border-b border-slate-300 h-6"></div>
                    <div className="border-b border-slate-300 h-6"></div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
