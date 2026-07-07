import { useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../../lib/supabase";
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
import { LoadingScreen } from "../shared/LoadingScreen";

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

  const audienceOptions = [
    { value: "all", label: "All Registered Attendees" },
    { value: "checked-in", label: "Only Checked-In Guests" },
    { value: "pending", label: "Pending (Not Checked-In)" },
    { value: "members", label: "Club Members Only" },
    { value: "rotarians", label: "Visiting Rotarians Only" },
    { value: "visitors", label: "Guests & Non-Rotarians" },
  ];
  
  if (organization?.buddy_groups) {
    const groups = organization.buddy_groups.split(",").map(g => g.trim()).filter(Boolean);
    groups.forEach(g => {
      audienceOptions.push({ value: `group:${g}`, label: `Group: ${g}` });
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !message.trim()) {
      setError("Campaign Name and Message Body are required.");
      return;
    }

    setLoading(true);

    try {
      // 1. Fetch matching contacts
      let query = supabase
        .from("registrations")
        .select("phone, full_name, is_member, club_name, district, buddy_group, member_id")
        .eq("organization_id", organization!.id);
      
      if (eventId) {
        query = query.eq("event_id", eventId);
      }
      if (audience === "checked-in") {
        query = query.not("checked_in_at", "is", null);
      } else if (audience === "pending") {
        query = query.is("checked_in_at", null);
      } else if (audience.startsWith("group:")) {
        query = query.eq("buddy_group", audience.split(":")[1]);
      }

      const { data: contacts, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      let filteredContacts = contacts || [];
      if (audience === "members") {
        filteredContacts = filteredContacts.filter(
          (r) => r.is_member && ((r.buddy_group && r.buddy_group.trim() !== "") || r.member_id)
        );
      } else if (audience === "rotarians") {
        filteredContacts = filteredContacts.filter(
          (r) => r.is_member && (!r.buddy_group || r.buddy_group.trim() === "") && r.club_name
        );
      } else if (audience === "visitors") {
        filteredContacts = filteredContacts.filter((r) => !r.is_member);
      }

      const validContacts = filteredContacts.filter(c => c.phone && c.phone.trim().length > 8);

      if (validContacts.length === 0) {
        setError("No contacts found matching the selected audience with valid phone numbers.");
        setLoading(false);
        return;
      }

      // 2. Create campaign log in db
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

      // 3. Dispatch messages if WhatsApp
      if (channel === "whatsapp") {
        toast.success(`Broadcasting WhatsApp campaign to ${validContacts.length} contacts...`);
        
        const GATEWAY_BASE_URL = "http://ugpay.tech:3000";
        const webhookUrl = `${GATEWAY_BASE_URL}/send-whatsapp/${organization!.id}`;

        // Fire off requests concurrently
        Promise.all(validContacts.map(contact => {
           const customizedMessage = message.trim().replace(/{full_name}/g, contact.full_name);
           return fetch("/api/send-whatsapp", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
               webhookUrl: webhookUrl,
               phone: contact.phone,
               message: customizedMessage
             })
           }).catch(err => console.error("WhatsApp broadcast failed for", contact.phone, err));
        }));
      } else {
        toast.success(`Simulating broadcast for ${channel.toUpperCase()} to ${validContacts.length} contacts...`);
      }

      setTimeout(() => {
        toast.success(`Campaign "${name}" sent successfully!`);
        setModalOpen(false);
      }, 1000);

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
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>Communications</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Send notifications, email invites, and follow-up templates to registered attendees.</p>
      </div>
      <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/40">
          <MessageSquare size={15} style={{ color: NAVY }} />
          <h3 className="text-sm font-bold" style={{ color: NAVY }}>Campaign History</h3>
        </div>

        <div className="px-5 py-4">
          {campaignsLoading ? (
            <LoadingScreen variant="light" fullScreen={false} />
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
              <h2 className="text-lg font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>Send New Broadcast</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 text-muted-foreground hover:bg-muted rounded">
                <Clock size={16} />
              </button>
            </div>
            <form onSubmit={handleSend} className="px-6 py-5 flex flex-col gap-4">
              <TextInput label="Campaign Name" placeholder="e.g. Thank You for attending Gala" value={name} onChange={setName} required />
              <SelectInput label="Broadcast Channel" options={[{ value: "email", label: "Email Campaign" }, { value: "sms", label: "SMS Broadcast" }, { value: "whatsapp", label: "WhatsApp Template" }]} value={channel} onChange={(val) => setChannel(val as any)} />
              <SelectInput label="Target Event (Optional)" options={events ? [{ value: "", label: "All Contacts" }, ...events.map(e => ({ value: e.id, label: e.title }))] : [{ value: "", label: "All Contacts" }]} value={eventId} onChange={setEventId} />
              <SelectInput label="Target Audience" options={audienceOptions} value={audience} onChange={setAudience} />
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
