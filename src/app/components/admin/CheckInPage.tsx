import { useParams, useNavigate } from "react-router";
import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useEvent } from "../../../hooks/useEvents";
import { useEventRegistrations, useCheckIn } from "../../../hooks/useRegistrations";
import { PageCard, TextInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { AdminLayout } from "../shared/AdminLayout";
import { NAVY, GOLD } from "../../../lib/constants";
import {
  ChevronLeft,
  Users,
  Search,
  CheckCircle,
  XCircle,
  QrCode,
  UserCheck,
  AlertCircle,
  FileSpreadsheet,
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

  // Filter/Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "checked-in">("all");
  const [scanningCode, setScanningCode] = useState("");
  const [scanning, setScanning] = useState(false);

  const loading = eventLoading || regsLoading;

  // Filter registrations
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
    <AdminLayout pageTitle={event.title}>
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
    </AdminLayout>
  );
}
