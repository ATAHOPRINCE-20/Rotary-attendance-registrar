import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import {
  useAdminEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "../../../hooks/useEvents";
import { PageCard, TextInput, SelectInput } from "../shared/PageCard";
import { GoldButton, NavyButton, OutlineButton } from "../shared/Buttons";
import { AdminLayout } from "../shared/AdminLayout";
import { NAVY, GOLD, EVENT_TYPES, parseOrgWebsite, serializeOrgWebsite } from "../../../lib/constants";
import { supabase } from "../../../lib/supabase";
import { QRCodeSVG } from "qrcode.react";
import { getTenantUrl } from "../../../lib/subdomain";
import { downloadQR } from "../../../lib/qr";
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  QrCode,
  Users,
  Eye,
  CheckCircle,
  AlertCircle,
  X,
  FileImage,
  Printer,
  Copy,
  Check,
  Share2,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  Award,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import { getFriendlyErrorMessage } from "../../../lib/errors";
import { FellowshipReportModal } from "./FellowshipReportModal";
import { FellowshipCardModal, VisitorCardItem } from "../shared/FellowshipCardModal";

export function EventsPage() {
  const { profile, organization, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Queries/Mutations
  const { data: events, isLoading } = useAdminEvents(organization?.id);
  const createMutation = useCreateEvent();
  const updateMutation = useUpdateEvent();
  const deleteMutation = useDeleteEvent();

  const { activeEventId } = parseOrgWebsite(organization?.website || null);

  const [showAllInOneQR, setShowAllInOneQR] = useState(false);
  const [copiedGeneralQR, setCopiedGeneralQR] = useState(false);

  const generalRegUrl = organization?.slug ? getTenantUrl(organization.slug, "/register") : "";

  const handlePrintAllInOne = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocker prevented printing. Please allow popups.");
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Registration QR Code - ${organization?.name}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              text-align: center;
              padding: 40px;
              color: #17458F;
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              border: 3px solid #F7A81B;
              padding: 40px;
              border-radius: 24px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            }
            .logo-placeholder {
              font-size: 24px;
              font-weight: 900;
              margin-bottom: 20px;
              letter-spacing: 1px;
            }
            .title {
              font-size: 28px;
              font-weight: 900;
              margin: 10px 0;
            }
            .subtitle {
              font-size: 14px;
              color: #64748B;
              margin-bottom: 30px;
              line-height: 1.5;
            }
            .qr-container {
              background: white;
              padding: 20px;
              display: inline-block;
              border-radius: 16px;
              border: 1px solid #E2E8F0;
              margin-bottom: 20px;
            }
            .footer-info {
              margin-top: 20px;
              background: #F8FAFC;
              padding: 15px;
              border-radius: 12px;
              border: 1px solid #E2E8F0;
            }
            .active-badge {
              display: inline-block;
              background: #10B981;
              color: white;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              padding: 4px 8px;
              border-radius: 9999px;
              margin-bottom: 5px;
            }
            .event-name {
              font-weight: bold;
              font-size: 16px;
              color: #0F172A;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo-placeholder">AGOROLL</div>
            <div class="active-badge">Scan to Register</div>
            <h1 class="title">Event Registration</h1>
            <p class="subtitle">Please scan this QR code with your mobile camera to quickly check-in and register for today's event.</p>
            
            <div class="qr-container">
              <div id="qrcode-svg"></div>
            </div>
            
            <div class="footer-info">
              <div class="event-name">${organization?.name}</div>
              <p style="font-size: 11px; color: #64748B; margin: 4px 0 0 0; word-break: break-all;">${generalRegUrl}</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              const svgContent = window.opener.document.getElementById('general-qr-svg').outerHTML;
              document.getElementById('qrcode-svg').innerHTML = svgContent;
              
              const svgElement = document.getElementById('qrcode-svg').querySelector('svg');
              if (svgElement) {
                svgElement.setAttribute('width', '260');
                svgElement.setAttribute('height', '260');
              }
              
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSetActiveEvent = async (eventId: string | null) => {
    if (!organization) return;
    const { websiteUrl } = parseOrgWebsite(organization.website);
    const newWebsite = serializeOrgWebsite(eventId, websiteUrl);

    try {
      const { error } = await supabase
        .from("organizations")
        .update({ website: newWebsite })
        .eq("id", organization.id);

      if (error) throw error;

      toast.success(eventId ? "Active event set successfully!" : "Active event cleared!");
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(getFriendlyErrorMessage(err));
    }
  };

  // Modal / Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [reportEvent, setReportEvent] = useState<any | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [cardEvent, setCardEvent] = useState<any | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardVisitors, setCardVisitors] = useState<VisitorCardItem[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  const handleOpenCardsForEvent = async (ev: any) => {
    setLoadingCards(true);
    try {
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("event_id", ev.id);

      if (error) throw error;

      const checkedInList = (data || []).filter((r: any) => r.status !== "apology");
      const visitors = checkedInList.filter((r: any) => !r.is_member || (r.club_name && r.club_name.trim() !== ""));

      if (visitors.length === 0) {
        toast.info("No visiting Rotarians or guests found for this event yet.");
        setCardVisitors([
          {
            visitorName: "Visiting Rotarian",
            visitorClub: "Visiting Club",
            eventTitle: ev.title,
            eventDate: ev.date,
          },
        ]);
      } else {
        setCardVisitors(
          visitors.map((v: any) => ({
            id: v.id,
            visitorName: v.full_name,
            visitorClub: v.club_name || v.organization_name || "Visiting Club",
            email: v.email,
            phone: v.phone,
            eventTitle: ev.title,
            eventDate: ev.date,
          }))
        );
      }
      setCardEvent(ev);
      setShowCardModal(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load visitor cards.");
    } finally {
      setLoadingCards(false);
    }
  };

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [type, setType] = useState("General");
  const [status, setStatus] = useState("draft");
  const [coverUrl, setCoverUrl] = useState("");

  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingEvent(null);
    setTitle("");
    setTopic("");
    setDescription("");
    setDate("");
    setLocation("");
    setCapacity("");
    setType("General");
    setStatus("draft");
    setCoverUrl("");
    setError(null);
    setModalOpen(true);
  }

  function toDatetimeLocal(dateString?: string | null): string {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openEdit(ev: any) {
    setEditingEvent(ev);
    setTitle(ev.title);
    setTopic(ev.fellowship_report?.guest_speaker_topic || ev.topic || "");
    setDescription(ev.description || "");
    // Convert timestamp to local datetime-local compatible format (YYYY-MM-DDThh:mm)
    const formattedDate = toDatetimeLocal(ev.date);
    setDate(formattedDate);
    setLocation(ev.location || "");
    setCapacity(ev.capacity?.toString() || "");
    setType(ev.type || "General");
    setStatus(ev.status || "draft");
    setCoverUrl(ev.cover_image_url || "");
    setError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !date) {
      setError("Title and Date are required.");
      return;
    }

    const fellowshipReport = {
      ...(editingEvent?.fellowship_report || {}),
      guest_speaker_topic: topic.trim() || title.trim(),
    };

    const payload = {
      organization_id: organization?.id || "",
      title: title.trim(),
      description: description.trim() || null,
      date: new Date(date).toISOString(),
      end_date: null,
      location: location.trim() || null,
      capacity: capacity ? parseInt(capacity, 10) : null,
      type,
      status: status as "draft" | "published" | "closed",
      cover_image_url: coverUrl.trim() || null,
      created_by: null,
      buddy_groups: null,
      fellowship_report: fellowshipReport,
    };

    try {
      if (editingEvent) {
        await updateMutation.mutateAsync({
          id: editingEvent.id,
          ...payload,
        });
        toast.success("Event updated successfully!");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Event created successfully!");
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
    }
  }


  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to permanently delete this event? This will also delete registrations.")) return;

    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Event deleted.");
    } catch (err: any) {
      console.error(err);
      toast.error(getFriendlyErrorMessage(err));
    }
  }

  return (
    <AdminLayout
      pageTitle="Events"
      actions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          <OutlineButton
            onClick={() => setShowAllInOneQR(true)}
            className="flex items-center gap-1 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold whitespace-nowrap"
          >
            <QrCode size={13} /> <span className="hidden sm:inline">All-in-One QR Code</span><span className="sm:hidden">QR Code</span>
          </OutlineButton>
          {profile?.role !== "staff" && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold text-white hover:opacity-90 transition-all cursor-pointer whitespace-nowrap"
              style={{ background: NAVY }}
            >
              <Plus size={14} /> <span className="hidden sm:inline">Create Event</span><span className="sm:hidden">Create</span>
            </button>
          )}
        </div>
      }
    >
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>Events</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Create and publish gatherings, generate check-in codes, and monitor RSVPs.</p>
      </div>

      {/* Content list */}
        {isLoading ? (
          <LoadingScreen variant="light" fullScreen={false} />
        ) : !events || events.length === 0 ? (
          <PageCard className="text-center py-16">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold" style={{ color: NAVY }}>No Events Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Get started by creating your club's first community gathering or fundraiser gala.
            </p>
            <GoldButton onClick={openCreate} className="mt-4">
              Create Event
            </GoldButton>
          </PageCard>
        ) : (() => {
          const now = Date.now();
          // Filter active & upcoming events (not closed, date is today or future), sorted chronologically (nearest date first)
          const activeUpcomingEvents = events
            .filter((ev) => ev.status !== "closed" && new Date(ev.date).getTime() >= now - 24 * 60 * 60 * 1000)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Closed or past events are archived
          const archivedEvents = events
            .filter((ev) => ev.status === "closed" || new Date(ev.date).getTime() < now - 24 * 60 * 60 * 1000)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          const displayedEvents = showAllEvents ? activeUpcomingEvents : activeUpcomingEvents.slice(0, 6);

          return (
            <div className="flex flex-col gap-6">
              {activeUpcomingEvents.length === 0 ? (
                <PageCard className="text-center py-8">
                  <h3 className="text-base font-bold text-slate-700">No Active Upcoming Events</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    All previous events have been archived or closed. Click "Create Event" to schedule your next gathering.
                  </p>
                </PageCard>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedEvents.map((ev) => {
                    const isActive = activeEventId === ev.id;
                    return (
                      <PageCard key={ev.id} className={`flex flex-col justify-between h-full hover:shadow-md transition-shadow ${isActive ? 'ring-2 ring-emerald-500/50' : ''}`}>
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${GOLD}20`, color: GOLD }}
                              >
                                {ev.type || "General"}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  ev.status === "published"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : ev.status === "closed"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-slate-100 text-slate-800"
                                }`}
                              >
                                {ev.status}
                              </span>
                            </div>

                            {/* Quick Actions & Menu */}
                            <div className="flex items-center gap-1.5">
                              {profile?.role !== "staff" && (
                                <button
                                  type="button"
                                  onClick={() => handleSetActiveEvent(isActive ? null : ev.id)}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                    isActive
                                      ? "bg-emerald-500 text-white shadow-xs"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200"
                                  }`}
                                  title={isActive ? "Active Event for Public QR" : "Set as Active Event"}
                                >
                                  <CheckCircle size={10} />
                                  <span>{isActive ? "Active" : "Set Active"}</span>
                                </button>
                              )}

                              {/* Dropdown Options */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(openMenuId === ev.id ? null : ev.id);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                                  title="Event Options"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                
                                {openMenuId === ev.id && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-20" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                      }} 
                                    />
                                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 animate-in fade-in duration-100">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          navigate(`/admin/events/${ev.id}/qr`);
                                        }}
                                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                      >
                                        <QrCode size={13} className="text-slate-400" /> QR Codes & Posters
                                      </button>
                                      {profile?.role !== "staff" && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenMenuId(null);
                                              openEdit(ev);
                                            }}
                                            className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                          >
                                            <Edit2 size={13} className="text-slate-400" /> Edit Event
                                          </button>
                                          <div className="border-t border-slate-100 my-1" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenMenuId(null);
                                              handleDelete(ev.id);
                                            }}
                                            className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                                          >
                                            <Trash2 size={13} className="text-rose-500" /> Delete Event
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <h3 className="text-lg font-black mb-2 leading-snug" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                            {ev.title}
                          </h3>

                          <p className="text-xs text-muted-foreground mb-1">
                            <strong>Date:</strong> {new Date(ev.date).toLocaleString()}
                          </p>
                          {ev.location && (
                            <p className="text-xs text-muted-foreground mb-1">
                              <strong>Venue:</strong> {ev.location}
                            </p>
                          )}
                          {ev.capacity && (
                            <p className="text-xs text-muted-foreground mb-3">
                              <strong>Capacity:</strong> {ev.capacity} attendees
                            </p>
                          )}

                          {ev.description && (
                            <p className="text-xs text-muted-foreground line-clamp-3 mt-3 pt-3 border-t border-border/50">
                              {ev.description}
                            </p>
                          )}
                        </div>

                        {/* Streamlined Card Actions */}
                        <div className="flex flex-col gap-2 mt-6 pt-4 border-t border-border">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/checkin/${ev.id}`)}
                            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-[#17458F] hover:bg-[#0f2e60] transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                          >
                            <Users size={14} /> <span>Attendees & Check‑In</span>
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setReportEvent(ev)}
                              className="py-2 text-xs flex justify-center items-center gap-1.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all cursor-pointer border border-slate-200"
                            >
                              <FileText size={13} className="text-[#17458F]" /> Report
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenCardsForEvent(ev)}
                              disabled={loadingCards}
                              className="py-2 text-xs flex justify-center items-center gap-1.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              <Award size={13} /> <span>Fellowship Cards</span>
                            </button>
                          </div>
                        </div>
                      </PageCard>
                    );
                  })}
                </div>
              )}

              {activeUpcomingEvents.length > 6 && (
                <div className="flex justify-center mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAllEvents(!showAllEvents)}
                    className="px-6 py-2.5 rounded-xl border border-border bg-white hover:bg-slate-50 text-xs font-bold text-[#17458F] transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    {showAllEvents ? (
                      <>Show Less <ChevronUp size={14} /></>
                    ) : (
                      <>Show More Upcoming Events ({activeUpcomingEvents.length - 6} more) <ChevronDown size={14} /></>
                    )}
                  </button>
                </div>
              )}

              {/* Archived & Closed Past Events Section */}
              {archivedEvents.length > 0 && (
                <div className="mt-10 pt-8 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                        Archived / Closed Events ({archivedEvents.length})
                      </h3>
                      <p className="text-xs text-muted-foreground">Past and completed club events</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
                    {archivedEvents.map((ev) => {
                      const eventDate = new Date(ev.date);
                      return (
                        <div key={ev.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                                Archived
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">{ev.title}</h4>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/checkin/${ev.id}`)}
                              className="text-xs font-bold text-[#17458F] hover:underline"
                            >
                              Check-in Log
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(ev)}
                              className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {/* Fellowship Report Modal */}
      <FellowshipReportModal
        isOpen={!!reportEvent}
        onClose={() => setReportEvent(null)}
        event={reportEvent}
        organization={organization}
      />

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-lg font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                {editingEvent ? "Edit Event" : "Create New Event"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
              <TextInput
                label="Event Title"
                placeholder="e.g. Weekly Fellowship Meeting"
                value={title}
                onChange={setTitle}
                required
              />

              <TextInput
                label="Fellowship Topic / Guest Speaker Topic"
                placeholder="e.g. Strategic Water Harvesting & Environmental Sustainability"
                value={topic}
                onChange={setTopic}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextInput
                  label="Date & Time"
                  type="datetime-local"
                  value={date}
                  onChange={setDate}
                  required
                />
                <TextInput
                  label="Venue Location"
                  placeholder="e.g. Grand Arena Hall"
                  value={location}
                  onChange={setLocation}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectInput
                  label="Event Type"
                  options={EVENT_TYPES.map(t => ({ value: t, label: t }))}
                  value={type}
                  onChange={setType}
                />
                <TextInput
                  label="Max Capacity (Optional)"
                  type="number"
                  placeholder="Unlimited if empty"
                  value={capacity}
                  onChange={setCapacity}
                />
              </div>

              <TextInput
                label="Cover Image URL (Optional)"
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={coverUrl}
                onChange={setCoverUrl}
              />

              <SelectInput
                label="Publish Status"
                options={[
                  { value: "draft", label: "Draft (Internal Only)" },
                  { value: "published", label: "Published (Public View)" },
                  { value: "closed", label: "Closed" },
                ]}
                value={status}
                onChange={setStatus}
              />

              {/* Buddy Group of the Day is now calculated dynamically from check-ins */}


              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground font-sans">
                  Description / Event Details
                </label>
                <textarea
                  placeholder="Describe your event..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="px-4 py-3 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 transition-all resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-destructive/10 text-destructive">
                  <AlertCircle size={15} />
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              <div className="flex gap-4 border-t border-border pt-4 mt-2">
                <OutlineButton type="button" onClick={() => setModalOpen(false)} className="flex-1 justify-center">
                  Cancel
                </OutlineButton>
                <GoldButton type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 justify-center">
                  Save Event
                </GoldButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* All-in-One QR Code Modal */}
      {showAllInOneQR && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-lg font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                All-in-One QR Code
              </h2>
              <button 
                onClick={() => setShowAllInOneQR(false)} 
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col items-center gap-5 text-center">
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                This is a <strong>permanent QR code</strong>. Scanners will automatically be routed to whichever event you set as <strong>Active</strong>. Print this once and display it at your venue!
              </p>

              <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex flex-col items-center gap-4">
                <div id="general-qr-svg" className="inline-block">
                  <QRCodeSVG 
                    value={generalRegUrl} 
                    size={200} 
                    level="H" 
                    includeMargin={true} 
                  />
                </div>
                <div className="text-center px-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Active Event</span>
                  {activeEventId ? (
                    <p className="text-sm font-bold text-emerald-600 mt-0.5 leading-snug">
                      ✓ {events?.find(e => e.id === activeEventId)?.title || "Active Event"}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-amber-600 mt-0.5 leading-snug">
                      ⚠ No Event Set Active (Directs to Events List)
                    </p>
                  )}
                </div>
              </div>

              <div className="w-full flex flex-col gap-2">
                <div className="flex items-center gap-2 p-3 bg-muted/40 border border-border rounded-xl text-xs overflow-hidden">
                  <span className="font-semibold text-muted-foreground select-none">Link:</span>
                  <span className="flex-1 font-mono truncate text-left">
                    {generalRegUrl}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generalRegUrl);
                      setCopiedGeneralQR(true);
                      toast.success("All-in-One Registration link copied!");
                      setTimeout(() => setCopiedGeneralQR(false), 2000);
                    }}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground flex-shrink-0 transition-colors cursor-pointer"
                  >
                    {copiedGeneralQR ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-1">
                  <OutlineButton onClick={() => downloadQR("general-qr-svg", "all-in-one-qr")} className="w-full justify-center flex items-center gap-1.5 py-2.5 px-2 text-xs">
                    <Download size={14} /> Download
                  </OutlineButton>
                  <OutlineButton onClick={handlePrintAllInOne} className="w-full justify-center flex items-center gap-1.5 py-2.5 px-2 text-xs">
                    <Printer size={14} /> Print
                  </OutlineButton>
                  <GoldButton 
                    onClick={() => {
                      navigator.clipboard.writeText(generalRegUrl);
                      toast.success("Link shared to clipboard!");
                    }} 
                    className="w-full justify-center flex items-center gap-1.5 py-2.5 px-2 text-xs"
                  >
                    <Share2 size={14} /> Share
                  </GoldButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fellowship Card Modal */}
      <FellowshipCardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        visitors={cardVisitors}
        organization={organization}
        event={cardEvent}
      />
    </AdminLayout>
  );
}
