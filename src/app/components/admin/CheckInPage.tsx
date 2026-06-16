import { useParams, useNavigate } from "react-router";
import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useEvent } from "../../../hooks/useEvents";
import { useEventRegistrations, useCheckIn, useSubmitRegistration } from "../../../hooks/useRegistrations";
import { PageCard, TextInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { AdminLayout } from "../shared/AdminLayout";
import { NAVY, GOLD } from "../../../lib/constants";
import {
  ChevronLeft,
  Users,
  Search,
  CheckCircle,
  QrCode,
  UserCheck,
  FileSpreadsheet,
  Printer,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

export function CheckInPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { organization } = useAuth();

  // Queries
  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { data: registrations, isLoading: regsLoading } = useEventRegistrations(eventId);
  const checkInMutation = useCheckIn();
  const registerMutation = useSubmitRegistration();

  // Filter/Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "checked-in">("all");
  const [scanningCode, setScanningCode] = useState("");
  const [scanning, setScanning] = useState(false);

  // Manual Registration Form States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [clubName, setClubName] = useState("");
  const [district, setDistrict] = useState("");
  const [occupation, setOccupation] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loading = eventLoading || regsLoading;

  // ── Download / Print Attendance Report ─────────────────────────────────────
  function downloadAttendanceReport() {
    if (!event || !registrations) return;

    const eventDate = new Date(event.date).toLocaleDateString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const now = new Date().toLocaleString("en-GB");
    const orgName = organization?.name ?? "Rotary Club";
    const checkedIn = registrations.filter(r => r.status === "checked-in").length;

    const rows = registrations.map((r, i) => `
      <tr class="${i % 2 === 0 ? "even" : "odd"}">
        <td class="no">${i + 1}</td>
        <td class="name">${r.full_name}</td>
        <td>${r.phone ?? "—"}</td>
        <td>${r.email}</td>
        <td>${r.club_name ?? (r.is_member ? "Member" : "—")}</td>
        <td class="center">${r.is_member ? "Member" : "<span class='guest'>Guest</span>"}</td>
        <td class="center">${r.status === "checked-in" ? "<span class='checkedin'>✓ Checked In</span>" : "<span class='pending'>Pending</span>"}</td>
        <td class="sig"></td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Attendance – ${event.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Open Sans', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; padding: 24px 32px; }

    /* ── Header ── */
    .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #17458F; padding-bottom: 14px; margin-bottom: 16px; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .wheel { width: 68px; height: 68px; }
    .org-name { font-size: 18px; font-weight: 900; color: #17458F; font-family: 'Montserrat', Arial, sans-serif; letter-spacing: -0.3px; }
    .org-tagline { font-size: 9px; color: #777; margin-top: 2px; text-transform: uppercase; letter-spacing: 1px; }
    .header-right { text-align: right; font-size: 9.5px; color: #555; line-height: 1.6; }

    /* ── Report title ── */
    .report-title { font-size: 15px; font-weight: 900; color: #17458F; font-family: 'Montserrat', Arial, sans-serif; margin-bottom: 2px; }
    .report-meta { display: flex; gap: 24px; font-size: 9.5px; color: #444; margin-bottom: 14px; }
    .report-meta span { display: flex; gap: 4px; }
    .report-meta b { color: #17458F; }

    /* ── Summary pills ── */
    .summary { display: flex; gap: 12px; margin-bottom: 16px; }
    .pill { padding: 5px 12px; border-radius: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .pill-blue { background: #17458F15; color: #17458F; border: 1px solid #17458F30; }
    .pill-green { background: #48BB7815; color: #276749; border: 1px solid #48BB7830; }
    .pill-gold  { background: #F7A81B15; color: #9a6b00; border: 1px solid #F7A81B40; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #17458F; color: #fff; }
    thead th { padding: 7px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
    tbody tr.even { background: #f8f9fc; }
    tbody tr.odd  { background: #fff; }
    tbody tr:hover { background: #EBF0F9; }
    td { padding: 6px 8px; border-bottom: 1px solid #e8ecf4; vertical-align: middle; }
    td.no   { color: #999; font-size: 9px; width: 28px; }
    td.name { font-weight: 700; color: #17458F; }
    td.center { text-align: center; }
    td.sig  { width: 80px; border-bottom: 1px solid #bbb; }
    .guest    { background: #FFF3CD; color: #856404; padding: 1px 6px; border-radius: 10px; font-size: 8px; font-weight: 700; }
    .checkedin{ background: #D1FAE5; color: #065F46; padding: 1px 6px; border-radius: 10px; font-size: 8px; font-weight: 700; }
    .pending  { background: #FEF3C7; color: #92400E; padding: 1px 6px; border-radius: 10px; font-size: 8px; font-weight: 700; }

    /* ── Footer ── */
    .footer { border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8.5px; color: #888; }
    .signature-block { display: flex; gap: 48px; margin-top: 28px; }
    .sig-line { flex: 1; border-top: 1px solid #555; padding-top: 4px; font-size: 8.5px; color: #555; text-align: center; }

    @media print {
      body { padding: 12px 18px; }
      @page { size: A4 landscape; margin: 10mm; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      ${organization?.logo_url ? `
        <img class="wheel" src="${organization.logo_url}" alt="${orgName}" style="object-fit: contain; border-radius: 4px;" />
      ` : `
        <svg class="wheel" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#17458F" stroke-width="7"/>
          <circle cx="50" cy="50" r="16" fill="#17458F"/>
          ${Array.from({length:6},(_,i)=>{
            const a=i*60*Math.PI/180;
            const x1=50+16*Math.sin(a), y1=50-16*Math.cos(a);
            const x2=50+44*Math.sin(a), y2=50-44*Math.cos(a);
            return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#17458F" stroke-width="7" stroke-linecap="round"/>`;
          }).join('')}
        </svg>
      `}
      <div>
        <div class="org-name">${orgName}</div>
        <div class="org-tagline">Service Above Self</div>
      </div>
    </div>
    <div class="header-right">
      <div>Attendance Report</div>
      <div>Printed: ${now}</div>
      ${organization?.district ? `<div>District ${organization.district}</div>` : ""}
    </div>
  </div>

  <!-- Report title -->
  <div class="report-title">Attendance Register</div>
  <div class="report-meta">
    <span><b>Event:</b> ${event.title}</span>
    <span><b>Date:</b> ${eventDate}</span>
    ${event.location ? `<span><b>Venue:</b> ${event.location}</span>` : ""}
  </div>

  <!-- Summary pills -->
  <div class="summary">
    <div class="pill pill-blue">Total Registered: ${registrations.length}</div>
    <div class="pill pill-green">Checked In: ${checkedIn}</div>
    <div class="pill pill-gold">Absent: ${registrations.length - checkedIn}</div>
  </div>

  <!-- Table -->
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Phone</th>
        <th>Email</th>
        <th>Club</th>
        <th style="text-align:center">Type</th>
        <th style="text-align:center">Status</th>
        <th>Signature</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- Signature block -->
  <div class="signature-block">
    <div class="sig-line">Club President / Chairperson</div>
    <div class="sig-line">Secretary</div>
    <div class="sig-line">Event Coordinator</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>${orgName} — Attendance Register — ${event.title}</span>
    <span>Generated by RotaryConnect &bull; rotary-ntinda.vercel.app</span>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked — allow pop-ups and try again."); return; }
    win.document.write(html);
    win.document.close();
  }

  const filteredRegs = registrations?.filter((r) => {
    const matchesSearch =
      r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.qr_ref && r.qr_ref.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === "all" || r.status === filterStatus;

    return matchesSearch && matchesStatus;
  }) ?? [];

  async function handleCheckIn(regId: string) {
    try {
      await checkInMutation.mutateAsync({ id: regId, eventId: eventId! });
      toast.success("Attendee successfully checked in!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to check in attendee.");
    }
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scanningCode.trim()) return;

    const code = scanningCode.trim().toUpperCase();
    const match = registrations?.find((r) => r.qr_ref === code);

    if (!match) {
      toast.error("Ticket code not found for this event.");
      return;
    }

    if (match.status === "checked-in") {
      toast.warning(`${match.full_name} is already checked in.`);
      setScanningCode("");
      return;
    }

    try {
      await handleCheckIn(match.id);
      setScanningCode("");
    } catch (err) {
      // handled above
    }
  }

  async function handleAddAttendee(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      await registerMutation.mutateAsync({
        event_id: eventId!,
        organization_id: organization?.id || "",
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        is_member: isMember,
        club_name: isMember ? clubName.trim() || null : null,
        district: isMember ? district.trim() || null : null,
        buddy_group: null,
        occupation: occupation.trim() || null,
        organization_name: null,
        comments: comments.trim() || null,
      });

      toast.success("Attendee registered & checked in successfully!");
      // Reset form
      setFullName("");
      setEmail("");
      setPhone("");
      setIsMember(false);
      setClubName("");
      setDistrict("");
      setOccupation("");
      setComments("");
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to register attendee.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-[#17458F] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageCard className="text-center max-w-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>Event Not Found</h2>
          <GoldButton onClick={() => navigate("/admin/events")} className="w-full justify-center">
            Back to Events
          </GoldButton>
        </PageCard>
      </div>
    );
  }

  return (
    <AdminLayout
      pageTitle={event.title}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all"
            style={{ background: GOLD }}
          >
            <Plus size={14} /> Register Attendee
          </button>
          <button
            onClick={downloadAttendanceReport}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted bg-card transition-all"
            title="Download Attendance Report (PDF/Print)"
          >
            <Printer size={14} /> Print Report
          </button>
        </div>
      }
    >
      <div className="mb-6">
        <button
          onClick={() => navigate("/admin/events")}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors mb-2"
        >
          <ChevronLeft size={14} /> Back to events
        </button>
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>Check-In & Registrations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Event: <span className="font-bold text-foreground">{event.title}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Check-in scanning utility */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <PageCard>
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                <QrCode size={16} /> QR Scanner Desk
              </h3>

              <div className="aspect-video w-full bg-muted/40 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 mb-4">
                {scanning ? (
                  <div className="flex flex-col items-center gap-2">
                    <UserCheck className="w-8 h-8 text-[#48BB78] animate-bounce" />
                    <p className="text-xs text-muted-foreground font-semibold">Ready for scan feed...</p>
                  </div>
                ) : (
                  <>
                    <QrCode className="w-8 h-8 text-muted-foreground" />
                    <GoldButton onClick={() => setScanning(true)} className="py-1.5 px-3 text-xs">
                      Activate Scan Desk
                    </GoldButton>
                  </>
                )}
              </div>

              <form onSubmit={handleScanSubmit} className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Scan / Type Ticket Code
                </label>
                <div className="flex gap-2">
                  <input
                    placeholder="e.g. ROT-B1C2..."
                    value={scanningCode}
                    onChange={(e) => setScanningCode(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-border bg-input-background uppercase font-mono focus:outline-none"
                  />
                  <GoldButton type="submit" className="py-2 px-3 text-xs font-bold">
                    Validate
                  </GoldButton>
                </div>
              </form>
            </PageCard>
          </div>

          {/* Attendee list */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <PageCard>
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    placeholder="Search name, email, or ticket ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none"
                  />
                </div>

                {/* Filter segments */}
                <div className="flex border border-border rounded-xl overflow-hidden self-start">
                  {(["all", "pending", "checked-in"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-3 py-2 text-[10px] font-bold uppercase transition-all ${
                        filterStatus === status
                          ? "bg-[#17458F] text-white"
                          : "bg-card hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {status === "all" ? "All" : status === "pending" ? "Pending" : "Checked In"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table list */}
              {filteredRegs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">No matching attendees found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="py-3 px-3 font-semibold text-muted-foreground">Attendee</th>
                        <th className="py-3 px-3 font-semibold text-muted-foreground">Ticket Code</th>
                        <th className="py-3 px-3 font-semibold text-muted-foreground">Status</th>
                        <th className="py-3 px-3 font-semibold text-muted-foreground text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegs.map((r) => (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-muted/10">
                          <td className="py-4 px-3">
                            <p className="font-bold text-foreground">{r.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{r.email}</p>
                            {r.is_member && (
                              <span
                                className="inline-block mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                                style={{ backgroundColor: `${GOLD}15`, color: GOLD }}
                              >
                                Rotary Member
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-3 font-mono text-[10px]">{r.qr_ref}</td>
                          <td className="py-4 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                r.status === "checked-in"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {r.status === "checked-in" ? "Checked In" : "Pending"}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right">
                            {r.status === "pending" ? (
                              <GoldButton onClick={() => handleCheckIn(r.id)} className="py-1 px-3.5 text-[10px] inline-flex">
                                Check In
                              </GoldButton>
                            ) : (
                              <span className="text-[10px] text-muted-foreground font-semibold inline-block py-1 pr-2">
                                Checked In
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PageCard>
          </div>
      </div>

      {/* Manual Registration Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
                Register & Check In Attendee
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleAddAttendee} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              <TextInput
                label="Full Name"
                placeholder="Enter attendee's full name"
                value={fullName}
                onChange={setFullName}
                required
              />

              <TextInput
                label="Email Address"
                type="email"
                placeholder="e.g. name@domain.com"
                value={email}
                onChange={setEmail}
                required
              />

              <TextInput
                label="Phone Number (Optional)"
                type="tel"
                placeholder="e.g. +256 700 000000"
                value={phone}
                onChange={setPhone}
              />

              <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  <input
                    type="checkbox"
                    checked={isMember}
                    onChange={(e) => setIsMember(e.target.checked)}
                    className="rounded border-border text-[#17458F] focus:ring-[#17458F] w-4 h-4"
                  />
                  Is this attendee a Rotary Member?
                </label>

                {isMember && (
                  <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-1">
                    <TextInput
                      label="Club Name"
                      placeholder="e.g. Rotary Club of Ntinda"
                      value={clubName}
                      onChange={setClubName}
                      required={isMember}
                    />
                    <TextInput
                      label="District"
                      placeholder="e.g. 9213"
                      value={district}
                      onChange={setDistrict}
                      required={isMember}
                    />
                  </div>
                )}
              </div>

              <TextInput
                label="Occupation / Title (Optional)"
                placeholder="e.g. Doctor, Manager, Guest"
                value={occupation}
                onChange={setOccupation}
              />

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Comments / Notes (Optional)
                </label>
                <textarea
                  placeholder="Special requests or attendee notes..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={2}
                  className="px-3 py-2 text-xs rounded-xl border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                <OutlineButton
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs"
                >
                  Cancel
                </OutlineButton>
                <GoldButton
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold"
                >
                  {submitting ? "Registering..." : "Register & Check In"}
                </GoldButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
