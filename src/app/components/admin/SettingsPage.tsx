import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { NAVY, sanitizeInput } from "../../../lib/constants";
import { AdminLayout } from "../shared/AdminLayout";
import { QRCodeSVG } from "qrcode.react";
import { X, Settings, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const { organization, refreshProfile } = useAuth();

  const [welcomeTemplate, setWelcomeTemplate] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  
  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [showBrevoApiKey, setShowBrevoApiKey] = useState(false);
  const [brevoSenderEmail, setBrevoSenderEmail] = useState("");
  const [brevoSenderName, setBrevoSenderName] = useState("");
  const [savingBrevo, setSavingBrevo] = useState(false);
  
  const [isEditingWhatsApp, setIsEditingWhatsApp] = useState(false);
  const [isEditingBrevo, setIsEditingBrevo] = useState(false);
  
  const [showQRModal, setShowQRModal] = useState(false);
  const [linkMode, setLinkMode] = useState<"qr" | "phone">("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"not_started" | "initializing" | "waiting_for_qr" | "connected" | "disconnected">("not_started");
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);

  async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      }
    });
  }

  useEffect(() => {
    let interval: any;
    if (showQRModal && organization) {
      const gatewayBaseUrl = "http://ugpay.tech:3000";
      const sessionId = organization.id;

      interval = setInterval(async () => {
        try {
          const res = await fetchWithAuth(`/api/whatsapp-proxy?action=status&sessionId=${sessionId}&gatewayUrl=${encodeURIComponent(gatewayBaseUrl)}`);
          const data = await res.json();
          if (data.status) setQrStatus(data.status);
          if (data.qr) setQrCodeData(data.qr);
          if (data.status === "connected") {
            setIsWhatsAppConnected(true);
            toast.success("WhatsApp Linked Successfully!");
            setTimeout(() => setShowQRModal(false), 3000);
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showQRModal, organization]);

  useEffect(() => {
    if (organization) {
      setWelcomeTemplate(organization.whatsapp_welcome_template || "");
      setBrevoApiKey(organization.brevo_api_key || "");
      setBrevoSenderEmail(organization.brevo_sender_email || "");
      setBrevoSenderName(organization.brevo_sender_name || "");
      
      setIsEditingWhatsApp(!organization.whatsapp_welcome_template);
      setIsEditingBrevo(!organization.brevo_api_key);
      
      // Check initial WhatsApp connection status
      fetchWithAuth(`/api/whatsapp-proxy?action=status&sessionId=${organization.id}&gatewayUrl=${encodeURIComponent("http://ugpay.tech:3000")}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === "connected") setIsWhatsAppConnected(true);
        })
        .catch(console.error);
    }
  }, [organization]);

  async function handleLinkWhatsApp(phone?: string) {
    if (!organization) return;
    
    try {
      const gatewayBaseUrl = "http://ugpay.tech:3000";
      const sessionId = organization.id;
      
      setShowQRModal(true);
      setQrStatus("initializing");
      setQrCodeData(null);
      
      const payload: any = {
        action: 'start',
        sessionId,
        gatewayUrl: gatewayBaseUrl
      };
      
      if (phone) {
        payload.phone = phone;
      }

      await fetchWithAuth('/api/whatsapp-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err: any) {
      toast.error("Could not connect to WhatsApp gateway.");
      setShowQRModal(false);
    }
  }

  function handleOpenLinkModal() {
    setShowQRModal(true);
    setQrStatus("not_started");
    setLinkMode("qr");
    setQrCodeData(null);
    
    if (organization) {
      fetchWithAuth('/api/whatsapp-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          sessionId: organization.id,
          gatewayUrl: "http://ugpay.tech:3000"
        })
      }).catch(console.error);
    }
  }

  async function handleUnlinkWhatsApp() {
    if (!organization) return;
    if (!confirm("Are you sure you want to unlink WhatsApp? This will log out the current device and delete the session.")) return;
    
    try {
      const gatewayBaseUrl = "http://ugpay.tech:3000";
      const sessionId = organization.id;
      
      await fetchWithAuth('/api/whatsapp-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          sessionId,
          gatewayUrl: gatewayBaseUrl
        })
      });
      setIsWhatsAppConnected(false);
      toast.success("WhatsApp successfully unlinked.");
    } catch (err: any) {
      toast.error("Failed to unlink WhatsApp.");
    }
  }

  async function handleSaveWhatsAppSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;
    setSavingSettings(true);
    try {
      const sanitizedTemplate = welcomeTemplate.trim() ? sanitizeInput(welcomeTemplate) : null;
      const { error } = await supabase
        .from("organizations")
        .update({
          whatsapp_welcome_template: sanitizedTemplate,
        })
        .eq("id", organization.id);

      if (error) throw error;
      toast.success("WhatsApp Welcomer Settings updated successfully!");
      setIsEditingWhatsApp(false);
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update WhatsApp settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveBrevoSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;
    setSavingBrevo(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          brevo_api_key: brevoApiKey.trim() || null,
          brevo_sender_email: brevoSenderEmail.trim() || null,
          brevo_sender_name: brevoSenderName.trim() || null,
        })
        .eq("id", organization.id);

      if (error) throw error;
      toast.success("Email Integration Settings updated successfully!");
      setIsEditingBrevo(false);
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update Email settings.");
    } finally {
      setSavingBrevo(false);
    }
  }

  return (
    <AdminLayout pageTitle="Settings">
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
          Settings & Integrations
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure third-party integrations like WhatsApp and Email delivery.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Settings Card */}
        <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              WhatsApp Welcomer Integration
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Link your WhatsApp number and configure your welcome message template for registrants.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {!isEditingWhatsApp ? (
              <div className="flex flex-col gap-4 border-b border-border/40 pb-4">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-blue-800">Template Configured</p>
                    <p className="text-[10px] text-blue-600/80 truncate">Template saved and ready to use.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingWhatsApp(true)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Edit Template
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveWhatsAppSettings} className="flex flex-col gap-3 border-b border-border/40 pb-4">
                <div className="flex flex-col gap-1">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase">Welcome Template Message</label>
                  <textarea
                    placeholder="Template (use tags: {full_name}, {event_title}, {qr_ref}, {org_name})"
                    value={welcomeTemplate}
                    onChange={(e) => setWelcomeTemplate(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none resize-none"
                  />
                </div>
                <div className="flex gap-2 mt-1">
                  {organization?.whatsapp_welcome_template && (
                    <button
                      type="button"
                      onClick={() => {
                        setWelcomeTemplate(organization.whatsapp_welcome_template || "");
                        setIsEditingWhatsApp(false);
                      }}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all cursor-pointer"
                    style={{ background: NAVY }}
                  >
                    {savingSettings ? "Saving Settings..." : "Save Template"}
                  </button>
                </div>
              </form>
            )}
            {isWhatsAppConnected ? (
              <button
                type="button"
                onClick={handleUnlinkWhatsApp}
                className="w-full py-3 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all cursor-pointer flex items-center justify-center gap-2 border border-red-100 shadow-sm"
              >
                Disconnect WhatsApp
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenLinkModal}
                className="w-full py-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200 shadow-sm"
              >
                📱 Link WhatsApp Number
              </button>
            )}
          </div>
        </div>

        {/* Email Settings Card */}
        <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              Email Sender Integration
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Configure your Email API key and sender details to send emails directly from your club's address.
            </p>
          </div>
          {!isEditingBrevo ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-emerald-800">Email Sender Configured</p>
                  <p className="text-[10px] text-emerald-600/80 truncate">Sender: {brevoSenderEmail}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingBrevo(true)}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Edit Email Settings
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveBrevoSettings} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-muted-foreground uppercase">Brevo API Key</label>
                <div className="relative">
                  <input
                    type={showBrevoApiKey ? "text" : "password"}
                    placeholder="xkeysib-..."
                    value={brevoApiKey}
                    onChange={(e) => setBrevoApiKey(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 text-xs rounded-xl border border-border bg-input-background focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBrevoApiKey(!showBrevoApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={showBrevoApiKey ? "Hide API Key" : "Show API Key"}
                  >
                    {showBrevoApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-muted-foreground uppercase">Sender Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rotary Club of Ntinda"
                  value={brevoSenderName}
                  onChange={(e) => setBrevoSenderName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-muted-foreground uppercase">Sender Email</label>
                <input
                  type="email"
                  placeholder="e.g. info@ntindarotary.org"
                  value={brevoSenderEmail}
                  onChange={(e) => setBrevoSenderEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none"
                />
              </div>
              <div className="flex gap-2 mt-1">
                {organization?.brevo_api_key && (
                  <button
                    type="button"
                    onClick={() => {
                      setBrevoApiKey(organization.brevo_api_key || "");
                      setBrevoSenderName(organization.brevo_sender_name || "");
                      setBrevoSenderEmail(organization.brevo_sender_email || "");
                      setIsEditingBrevo(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingBrevo}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all cursor-pointer"
                  style={{ background: NAVY }}
                >
                  {savingBrevo ? "Saving Settings..." : "Save Email Settings"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* WhatsApp QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 items-center text-center animate-in zoom-in-95 duration-150 relative">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4 text-emerald-600">
              📱
            </div>
            
            <h3 className="text-base font-black text-foreground mb-1" style={{ color: NAVY }}>
              {qrStatus === "connected" ? "Successfully Connected!" : "Link WhatsApp"}
            </h3>
            
            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-full mt-2 mb-4">
              <button 
                className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${linkMode === 'qr' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setLinkMode("qr")}
              >
                QR Code
              </button>
              <button 
                className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${linkMode === 'phone' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setLinkMode("phone")}
              >
                Phone Number
              </button>
            </div>

            {linkMode === "phone" && qrStatus !== "waiting_for_qr" && qrStatus !== "connected" && (
              <div className="w-full flex flex-col gap-2 mb-4">
                <input
                  type="text"
                  placeholder="e.g. 256701234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/30"
                />
                <button
                  onClick={() => handleLinkWhatsApp(phoneNumber)}
                  disabled={!phoneNumber.trim() || qrStatus === "initializing"}
                  className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: NAVY }}
                >
                  Get Pairing Code
                </button>
              </div>
            )}

            {linkMode === "qr" && (qrStatus === "not_started" || qrStatus === "disconnected") && (
              <div className="w-full flex flex-col gap-2 mb-4">
                <button
                  onClick={() => handleLinkWhatsApp()}
                  className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all"
                  style={{ background: NAVY }}
                >
                  Generate QR Code
                </button>
              </div>
            )}

            <p className="text-xs text-slate-500 mb-6 px-4">
              {qrStatus === "not_started" && "Select your preferred authentication method above."}
              {qrStatus === "initializing" && "Initializing secure connection to your server..."}
              {qrStatus === "waiting_for_qr" && linkMode === "qr" && !qrCodeData?.startsWith("PAIRING_CODE:") && "Open WhatsApp > Linked Devices > Link a Device, and scan the QR code below."}
              {qrStatus === "waiting_for_qr" && qrCodeData?.startsWith("PAIRING_CODE:") && "Open WhatsApp > Linked Devices > Link with phone number instead, and enter the code below."}
              {qrStatus === "connected" && "Your WhatsApp is linked and ready to send automated messages!"}
              {qrStatus === "disconnected" && "Connection lost or logged out. Please try again."}
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full flex items-center justify-center min-h-[240px]">
              {qrStatus === "not_started" && (
                <div className="text-4xl opacity-20">👋</div>
              )}
              {qrStatus === "initializing" && (
                <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
              )}
              
              {qrStatus === "waiting_for_qr" && qrCodeData && !qrCodeData.startsWith("PAIRING_CODE:") && linkMode === "qr" && (
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 animate-in fade-in zoom-in duration-300">
                  <QRCodeSVG value={qrCodeData} size={200} />
                </div>
              )}

              {qrStatus === "waiting_for_qr" && qrCodeData?.startsWith("PAIRING_CODE:") && (
                <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Your Pairing Code</span>
                  <div className="text-3xl font-black tracking-widest text-foreground font-mono bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    {qrCodeData.split(":")[1]}
                  </div>
                </div>
              )}

              {qrStatus === "connected" && (
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-in zoom-in duration-300">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
