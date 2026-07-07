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
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";

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
                window.close();
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
      toast.error(err?.message || "Failed to set active event.");
    }
  };

  // Modal / Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);

  const [title, setTitle] = useState("");
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

  function openEdit(ev: any) {
    setEditingEvent(ev);
    setTitle(ev.title);
    setDescription(ev.description || "");
    // Convert timestamp to datetime-local compatible format (YYYY-MM-DDThh:mm)
    const formattedDate = ev.date ? new Date(ev.date).toISOString().slice(0, 16) : "";
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
      setError(err?.message || "Failed to save event. Please check inputs.");
    }
  }


  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to permanently delete this event? This will also delete registrations.")) return;

    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Event deleted.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to delete event.");
    }
  }

  return (
    <AdminLayout
      pageTitle="Events"
      actions={
        <div className="flex items-center gap-2">
          <OutlineButton
            onClick={() => setShowAllInOneQR(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
          >
            <QrCode size={13} /> All-in-One QR Code
          </OutlineButton>
          {profile?.role !== "staff" && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all cursor-pointer"
              style={{ background: NAVY }}
            >
              <Plus size={14} /> Create Event
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((ev) => {
              const isActive = activeEventId === ev.id;
              return (
                <PageCard key={ev.id} className={`flex flex-col justify-between h-full hover:shadow-md transition-shadow ${isActive ? 'ring-2 ring-emerald-500/50' : ''}`}>
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${GOLD}20`, color: GOLD }}
                        >
                          {ev.type || "General"}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> Active Site Event
                          </span>
                        )}
                      </div>
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

                  <div className="grid grid-cols-2 gap-2 mt-6 pt-4 border-t border-border">
                    {profile?.role !== "staff" && (
                      <button
                        type="button"
                        onClick={() => handleSetActiveEvent(isActive ? null : ev.id)}
                        className={`py-2 text-xs flex justify-center items-center gap-1.5 col-span-2 rounded-xl font-bold border transition-all ${
                          isActive
                            ? "bg-emerald-500 border-emerald-500 text-white shadow-sm hover:opacity-90 cursor-pointer"
                            : "bg-white border-border text-foreground hover:bg-muted cursor-pointer"
                        }`}
                      >
                        <CheckCircle size={12} /> {isActive ? "Active Event (Set for Site)" : "Set as Active Event"}
                      </button>
                    )}
                    {profile?.role !== "staff" ? (
                      <>
                        <OutlineButton onClick={() => openEdit(ev)} className="py-2 text-xs flex justify-center items-center gap-1">
                          <Edit2 size={12} /> Edit
                        </OutlineButton>
                        <OutlineButton onClick={() => navigate(`/admin/events/${ev.id}/qr`)} className="py-2 text-xs flex justify-center items-center gap-1">
                          <QrCode size={12} /> QR Codes
                        </OutlineButton>
                      </>
                    ) : (
                      <OutlineButton onClick={() => navigate(`/admin/events/${ev.id}/qr`)} className="py-2 text-xs flex justify-center items-center gap-1 col-span-2">
                        <QrCode size={12} /> QR Codes
                      </OutlineButton>
                    )}
                    <OutlineButton onClick={() => navigate(`/admin/checkin/${ev.id}`)} className="py-2 text-xs flex justify-center items-center gap-1 col-span-2">
                      <Users size={12} /> Attendees & Check‑In
                    </OutlineButton>
                    {profile?.role !== "staff" && (
                      <OutlineButton
                        onClick={() => handleDelete(ev.id)}
                        className="py-2 text-xs flex justify-center items-center gap-1 col-span-2 text-destructive hover:bg-destructive/10 border-destructive/20"
                      >
                        <Trash2 size={12} /> Delete Event
                      </OutlineButton>
                    )}
                  </div>
                </PageCard>
              );
            })}
          </div>
        )}

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
                placeholder="e.g. Annual Charity Ball 2026"
                value={title}
                onChange={setTitle}
                required
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

                <div className="grid grid-cols-2 gap-3 mt-1">
                  <OutlineButton onClick={handlePrintAllInOne} className="w-full justify-center flex items-center gap-1.5 py-2.5">
                    <Printer size={14} /> Print Poster
                  </OutlineButton>
                  <GoldButton 
                    onClick={() => {
                      navigator.clipboard.writeText(generalRegUrl);
                      toast.success("Link shared to clipboard!");
                    }} 
                    className="w-full justify-center flex items-center gap-1.5 py-2.5"
                  >
                    <Share2 size={14} /> Share Link
                  </GoldButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
