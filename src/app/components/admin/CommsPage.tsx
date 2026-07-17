import { useState } from "react";
import { useNavigate } from "react-router";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { useCampaigns, useCreateCampaign, useDeleteCampaign } from "../../../hooks/useCampaigns";
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
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import { getFriendlyErrorMessage } from "../../../lib/errors";

export function CommsPage() {
  const { organization } = useAuth();
  const navigate = useNavigate();

  // Queries/Mutations
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(organization?.id);
  const { data: events } = useAdminEvents(organization?.id);
  const createMutation = useCreateCampaign();
  const deleteMutation = useDeleteCampaign();

  // Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email");
  const [eventId, setEventId] = useState("");
  const [audience, setAudience] = useState("all");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attachment states
  const [attachmentType, setAttachmentType] = useState<"none" | "generic" | "personalized_pdf">("none");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [pdfYCoord, setPdfYCoord] = useState<number>(300);
  const [pdfFontSize, setPdfFontSize] = useState<number>(40);

  const audienceOptions = [
    { value: "all", label: "All Registered Attendees" },
    { value: "checked-in", label: "Only Checked-In Guests" },
    { value: "pending", label: "Pending (Not Checked-In)" },
    { value: "members", label: "Club Members Only" },
    { value: "rotarians", label: "Visiting Rotarians Only" },
    { value: "visitors", label: "Guests & Non-Rotarians" },
  ];
  
  if (organization?.buddy_groups) {
    const groups = Array.from(new Set<string>(organization.buddy_groups.split(",").map(g => g.trim()).filter(Boolean)));
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
      // 0. Get Auth Token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session has expired. Please log in again.");
        setLoading(false);
        return;
      }
      const token = session.access_token;

      // 1. Fetch matching contacts
      let query = supabase
        .from("registrations")
        .select("email, phone, full_name, is_member, club_name, district, buddy_group, member_id")
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

      const validContacts = filteredContacts.filter(c => {
        if (channel === "email") {
          return c.email && c.email.trim().includes("@") && !c.email.match(/^member-[a-f0-9\-]+@/);
        } else {
          return c.phone && c.phone.trim().length > 8;
        }
      });

      if (validContacts.length === 0) {
        setError(
          channel === "email"
            ? "No contacts found matching the selected audience with valid email addresses."
            : "No contacts found matching the selected audience with valid phone numbers."
        );
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

      // 3. Dispatch messages
      if (channel === "whatsapp") {
        toast.success(`Broadcasting WhatsApp campaign to ${validContacts.length} contacts...`);
        
        const GATEWAY_BASE_URL = "http://ugpay.tech:3000";
        const webhookUrl = `${GATEWAY_BASE_URL}/send-whatsapp/${organization!.id}`;

        // Fire off requests concurrently
        await Promise.all(validContacts.map(async contact => {
           const customizedMessage = message.trim().replace(/{full_name}/g, contact.full_name);
           const res = await fetch("/api/send-whatsapp", {
             method: "POST",
             headers: { 
               "Content-Type": "application/json",
               "Authorization": `Bearer ${token}`
             },
             body: JSON.stringify({
               webhookUrl: webhookUrl,
               phone: contact.phone,
               message: customizedMessage
             })
           });
           if (!res.ok) {
             const errData = await res.json().catch(() => ({}));
             throw new Error(errData.error || "Failed to send WhatsApp message");
           }
        }));
      } else if (channel === "email") {
        toast.success(`Broadcasting Email campaign to ${validContacts.length} contacts...`);
        
        let genericAttachmentBase64: string | null = null;
        let genericAttachmentName: string = "";
        let templateBuffer: ArrayBuffer | null = null;

        if (attachmentType === "generic" && attachmentFile) {
          genericAttachmentName = attachmentFile.name;
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
          });
          reader.readAsDataURL(attachmentFile);
          genericAttachmentBase64 = await base64Promise;
        } else if (attachmentType === "personalized_pdf" && attachmentFile) {
          templateBuffer = await attachmentFile.arrayBuffer();
        }
        
        await Promise.all(validContacts.map(async contact => {
          const customizedMessage = message.trim().replace(/{full_name}/g, contact.full_name);
          const htmlMessage = `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">
            ${customizedMessage.replace(/\n/g, '<br />')}
          </div>`;

          let currentAttachment = undefined;

          if (attachmentType === "generic" && genericAttachmentBase64) {
            currentAttachment = [
              { name: genericAttachmentName, content: genericAttachmentBase64 }
            ];
          } else if (attachmentType === "personalized_pdf" && templateBuffer) {
            try {
              const pdfDoc = await PDFDocument.load(templateBuffer);
              const pages = pdfDoc.getPages();
              const firstPage = pages[0];
              const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
              
              const text = contact.full_name || "Esteemed Guest";
              const textWidth = font.widthOfTextAtSize(text, pdfFontSize);
              const { width, height } = firstPage.getSize();
              
              const x = (width - textWidth) / 2;
              const y = height - pdfYCoord;

              firstPage.drawText(text, { x, y, size: pdfFontSize, font, color: rgb(0, 0, 0) });

              const pdfBytes = await pdfDoc.saveAsBase64();
              currentAttachment = [
                { name: `Certificate_${contact.full_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, content: pdfBytes }
              ];
            } catch (err) {
              console.error("Failed to generate PDF for", contact.full_name, err);
            }
          }

          const res = await fetch("/api/send-email", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              orgId: organization!.id,
              toEmail: contact.email,
              toName: contact.full_name,
              subject: name.trim(),
              htmlContent: htmlMessage,
              ...(currentAttachment ? { attachment: currentAttachment } : {})
            })
          });
          
          if (!res.ok) {
             const errData = await res.json().catch(() => ({}));
             throw new Error(errData.error || "Failed to send email");
          }
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
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this campaign from history?")) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success("Campaign deleted"),
        onError: (err) => toast.error(getFriendlyErrorMessage(err))
      });
    }
  }

  function openCreate(ch: "email" | "whatsapp") {
    setName("");
    setChannel(ch);
    setEventId("");
    setAudience("all");
    setMessage("");
    setAttachmentType("none");
    setAttachmentFile(null);
    setError(null);
    setModalOpen(true);
  }

  return (
    <AdminLayout
      pageTitle="Communications"
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => openCreate("whatsapp")}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-white hover:opacity-90 transition-all bg-[#48BB78]"
          >
            <Smartphone size={16} /> <span>WhatsApp</span>
          </button>
          <button
            onClick={() => openCreate("email")}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-white hover:opacity-90 transition-all"
            style={{ background: NAVY }}
          >
            <Mail size={16} /> <span>Email</span>
          </button>
        </div>
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
                    <div className="flex items-center gap-3">
                      <p className="text-[10px] text-muted-foreground">{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : ""}</p>
                      <button 
                        onClick={() => handleDelete(c.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete Campaign"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gmail-Style Compose Window */}
      {modalOpen && (
        <div className="fixed z-50 bg-background flex flex-col overflow-hidden shadow-[0_4px_24px_0_rgba(0,0,0,0.2)] border-0 sm:border border-border inset-0 w-full h-full rounded-none sm:inset-auto sm:bottom-0 sm:right-10 md:right-24 sm:w-[540px] sm:h-auto sm:max-h-[85vh] sm:rounded-t-xl">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 bg-[#f2f6fc] border-b border-border cursor-pointer rounded-t-xl" onClick={() => setModalOpen(false)}>
            <h2 className="text-sm font-semibold text-foreground">
              {channel === "email" ? "New Message" : "New WhatsApp Broadcast"}
            </h2>
            <div className="flex gap-2">
              <button type="button" onClick={(e) => { e.stopPropagation(); setModalOpen(false); }} className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          
          <form onSubmit={handleSend} className="flex-1 flex flex-col overflow-y-auto relative">
            {/* Target Audience Row */}
            <div className="px-4 py-2 border-b border-border flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 relative">
              <span className="text-sm text-muted-foreground w-16">To</span>
              <select className="flex-1 text-sm bg-transparent outline-none focus:ring-0 py-1" value={audience} onChange={e => setAudience(e.target.value)}>
                {audienceOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>

            {/* Target Event Row */}
            <div className="px-4 py-2 border-b border-border flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-sm text-muted-foreground w-16">Event</span>
              <select className="flex-1 text-sm bg-transparent outline-none focus:ring-0 py-1" value={eventId} onChange={e => setEventId(e.target.value)}>
                <option value="">All Contacts (No Event Filter)</option>
                {events?.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>

            {/* Subject Row */}
            <div className="px-4 py-2 border-b border-border flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-sm text-muted-foreground w-16">Subject</span>
              <input type="text" className="flex-1 text-sm bg-transparent outline-none focus:ring-0 py-1" placeholder="Campaign Subject or Name" value={name} onChange={e => setName(e.target.value)} required />
            </div>

            {/* Email attachments if applicable */}
            {channel === "email" && (
              <div className="px-4 py-3 border-b border-border bg-slate-50/50 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-20">ATTACHMENT</span>
                  <select 
                    className="flex-1 text-xs bg-transparent outline-none border border-border rounded px-2 py-1"
                    value={attachmentType} 
                    onChange={(e) => { setAttachmentType(e.target.value as any); setAttachmentFile(null); }}
                  >
                    <option value="none">No Attachment</option>
                    <option value="generic">Standard File (Same for everyone)</option>
                    <option value="personalized_pdf">Personalized PDF Certificate</option>
                  </select>
                </div>
                
                {attachmentType !== "none" && (
                  <div className="flex items-center gap-2 pl-22">
                    <input 
                      type="file" 
                      accept={attachmentType === "personalized_pdf" ? "application/pdf" : "*/*"}
                      onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                      className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      required
                    />
                  </div>
                )}

                {attachmentType === "personalized_pdf" && (
                  <div className="flex items-center gap-4 pl-22">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Y-Coord</label>
                      <input type="number" value={pdfYCoord} onChange={(e) => setPdfYCoord(parseInt(e.target.value) || 0)} className="w-16 px-2 py-1 rounded border border-border text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Size</label>
                      <input type="number" value={pdfFontSize} onChange={(e) => setPdfFontSize(parseInt(e.target.value) || 0)} className="w-12 px-2 py-1 rounded border border-border text-xs" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {/* Message Body */}
            <div className="flex-1 p-4 pb-20 flex flex-col gap-2 min-h-[250px]">
              <div className="flex items-center gap-2 mb-1">
                <button 
                  type="button" 
                  onClick={() => setMessage(prev => prev + "{full_name}")} 
                  className="text-[11px] font-medium bg-secondary/50 px-2 py-1 rounded-md hover:bg-secondary transition-colors text-secondary-foreground border border-border flex items-center gap-1"
                >
                  <Sparkles size={12} /> Insert Recipient Name
                </button>
                <span className="text-[10px] text-muted-foreground">Will be replaced with each person's full name</span>
              </div>
              <textarea 
                placeholder="Type your message here..." 
                value={message} 
                onChange={e => setMessage(e.target.value)} 
                required 
                className="w-full flex-1 bg-transparent text-sm focus:outline-none resize-none leading-relaxed" 
              />
            </div>
            
            {/* Bottom Toolbar Actions */}
            <div className="absolute bottom-0 left-0 right-0 bg-background px-4 py-3 flex items-center gap-4 border-t border-border">
              <button 
                type="submit" 
                disabled={loading} 
                className="px-6 py-2 rounded-full text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50" 
                style={{ backgroundColor: "#0b57d0" }}
              >
                {loading ? <Clock size={16} className="animate-spin" /> : <Send size={16} />} 
                {loading ? "Sending..." : "Send"}
              </button>
              
              <div className="flex-1"></div>
              
              <button type="button" onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-2" title="Discard">
                <Trash2 size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
