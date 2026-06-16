import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { useCampaigns, useCreateCampaign } from "../../../hooks/useCampaigns";
import { useAdminEvents } from "../../../hooks/useEvents";
import { PageCard, TextInput, SelectInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { AdminLayout } from "../shared/AdminLayout";
import { NAVY, GOLD } from "../../../lib/constants";
import {
  MessageSquare,
  Plus,
  Send,
  Mail,
  Smartphone,
  CheckCircle,
  Clock,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export function CommsPage() {
  const { organization } = useAuth();
  const navigate = useNavigate();

  // Queries/Mutations
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(organization?.id);
  const { data: events } = useAdminEvents(organization?.id);
  const createMutation = useCreateCampaign();

  // Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email");
  const [eventId, setEventId] = useState("");
  const [audience, setAudience] = useState("all");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !message.trim()) {
      setError("Campaign Name and Message Body are required.");
      return;
    }

    setLoading(true);

    try {
      // Create campaign in db
      const campaign = await createMutation.mutateAsync({
        organization_id: organization?.id || "",
        event_id: eventId ? eventId : null,
        name: name.trim(),
        channel,
        audience,
        message: message.trim(),
        status: "sent",
        sent_at: new Date().toISOString(),
        scheduled_at: null,
        created_by: null,
      });

      // Simulate sending communications (API trigger hooks)
      toast.success(`Broadcasting campaign via ${channel.toUpperCase()}...`);
      setTimeout(() => {
        toast.success(`Campaign "${name}" sent to matching attendees!`);
        setModalOpen(false);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to create campaign. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setName("");
    setChannel("email");
    setEventId("");
    setAudience("all");
    setMessage("");
    setError(null);
    setModalOpen(true);
  }

  return (
    <AdminLayout
      pageTitle="Communications"
      actions={
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: NAVY }}
        >
          <Plus size={14} /> New Campaign
        </button>
      }
    >
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>Communications</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Send notifications, email invites, and follow-up templates to registered attendees.</p>
      </div>

      <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/40">
          <MessageSquare size={15} style={{ color: NAVY }} />
          <h3 className="text-sm font-bold" style={{ color: NAVY }}>Campaign History</h3>
        </div>

        <div className="px-5 py-4">
          {campaignsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-4 border-[#17458F] border-t-transparent animate-spin" />
            </div>
          ) : !campaigns || campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No campaigns sent yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor:
                          c.channel === "email" ? "#0067C815" : c.channel === "sms" ? "#F7A81B15" : "#48BB7815",
                        color:
                          c.channel === "email" ? "#0067C8" : c.channel === "sms" ? "#F7A81B" : "#48BB78",
                      }}
                    >
                      {c.channel === "email" ? <Mail size={16} /> : c.channel === "sms" ? <Smartphone size={16} /> : <MessageSquare size={16} />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{c.name}</p>
                      {c.events && <p className="text-[10px] text-muted-foreground mt-0.5">Event: <strong>{c.events.title}</strong></p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono max-w-sm truncate">{c.message}</p>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-end gap-2 text-right">
                    <span className="bg-emerald-100 text-emerald-800 font-bold uppercase text-[8px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <CheckCircle size={10} /> Sent
                    </span>
                    <p className="text-[10px] text-muted-foreground">{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Campaign Dialog Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-lg font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>Send New Broadcast</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 text-muted-foreground hover:bg-muted rounded">
                <Clock size={16} />
              </button>
            </div>
            <form onSubmit={handleSend} className="px-6 py-5 flex flex-col gap-4">
              <TextInput label="Campaign Name" placeholder="e.g. Thank You for attending Gala" value={name} onChange={setName} required />
              <SelectInput label="Broadcast Channel" options={[{ value: "email", label: "Email Campaign" }, { value: "sms", label: "SMS Broadcast" }, { value: "whatsapp", label: "WhatsApp Template" }]} value={channel} onChange={(val) => setChannel(val as any)} />
              <SelectInput label="Target Event (Optional)" options={events ? [{ value: "", label: "All Contacts" }, ...events.map(e => ({ value: e.id, label: e.title }))] : [{ value: "", label: "All Contacts" }]} value={eventId} onChange={setEventId} />
              <SelectInput label="Target Audience" options={[{ value: "all", label: "All Registered Attendees" }, { value: "checked-in", label: "Only Checked-In Guests" }, { value: "pending", label: "Only RSVPs (Not Checked-In)" }]} value={audience} onChange={setAudience} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground">Message Body</label>
                <textarea placeholder="Type your message..." value={message} onChange={e => setMessage(e.target.value)} rows={4} required className="px-4 py-3 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
              </div>
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-destructive/10 text-destructive">
                  <AlertCircle size={15} /><span className="font-semibold">{error}</span>
                </div>
              )}
              <div className="flex gap-4 border-t border-border pt-4 mt-2">
                <OutlineButton type="button" onClick={() => setModalOpen(false)} className="flex-1 justify-center">Cancel</OutlineButton>
                <GoldButton type="submit" disabled={loading} className="flex-1 justify-center flex items-center gap-2"><Send size={14} /> Send Now</GoldButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
