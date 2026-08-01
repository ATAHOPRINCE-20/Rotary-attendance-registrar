import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { NAVY, sanitizeInput } from "../../../lib/constants";
import { AdminLayout } from "../shared/AdminLayout";
import { QRCodeSVG } from "qrcode.react";
import { Upload, X, Settings, Eye, EyeOff, FileText, UserCheck, ShieldCheck } from "lucide-react";

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

  // Leadership & Signatures state
  const [presidentName, setPresidentName] = useState("");
  const [presidentTitle, setPresidentTitle] = useState("Impact President");
  const [presidentSignaturePreview, setPresidentSignaturePreview] = useState<string | null>(null);
  const [presidentSigFile, setPresidentSigFile] = useState<File | null>(null);

  const [secretaryName, setSecretaryName] = useState("");
  const [secretaryTitle, setSecretaryTitle] = useState("Impact Secretary");
  const [secretarySignaturePreview, setSecretarySignaturePreview] = useState<string | null>(null);
  const [secretarySigFile, setSecretarySigFile] = useState<File | null>(null);

  const [savingLeadership, setSavingLeadership] = useState(false);

  // Monthly Theme & Focus states
  const [monthlyTheme, setMonthlyTheme] = useState("");
  const [monthlyThemeDesc, setMonthlyThemeDesc] = useState("");
  const [monthlyMessage, setMonthlyMessage] = useState("");
  const [savingMonthlyTheme, setSavingMonthlyTheme] = useState(false);

  // Logo upload states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  
  const [showQRModal, setShowQRModal] = useState(false);
  const [linkMode, setLinkMode] = useState<"qr" | "phone">("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"not_started" | "initializing" | "waiting_for_qr" | "connected" | "disconnected">("not_started");
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("Logo file size must be less than 1.5MB");
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleUploadLogo() {
    if (!organization || (!logoFile && !logoPreview)) return;
    setSavingLogo(true);
    try {
      let logoUrl = organization.logo_url;
      if (logoFile) {
        try {
          const fileExt = logoFile.name.split(".").pop();
          const fileName = `${organization.slug}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadErr } = await supabase.storage
            .from("logos")
            .upload(filePath, logoFile, { upsert: true, contentType: logoFile.type });

          if (uploadErr) throw uploadErr;

          const { data: publicUrlData } = supabase.storage
            .from("logos")
            .getPublicUrl(filePath);

          logoUrl = publicUrlData.publicUrl;
        } catch (storageErr) {
          console.warn("Storage upload failed, falling back to Base64:", storageErr);
          logoUrl = logoPreview;
        }
      }

      const { error: updateErr } = await supabase
        .from("organizations")
        .update({ logo_url: logoUrl })
        .eq("id", organization.id);

      if (updateErr) throw updateErr;

      toast.success("Club logo updated successfully!");
      setLogoFile(null);
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update club logo.");
    } finally {
      setSavingLogo(false);
    }
  }

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
          const res = await fetchWithAuth(`/api/send-whatsapp?proxy=true&action=status&sessionId=${sessionId}&gatewayUrl=${encodeURIComponent(gatewayBaseUrl)}`);
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

      setPresidentName(organization.president_name || "");
      setPresidentTitle(organization.president_title || "Impact President");
      setPresidentSignaturePreview(organization.president_signature_url || null);

      setSecretaryName(organization.secretary_name || "");
      setSecretaryTitle(organization.secretary_title || "Impact Secretary");
      setSecretarySignaturePreview(organization.secretary_signature_url || null);

      setMonthlyTheme(organization.monthly_theme || "");
      setMonthlyThemeDesc(organization.monthly_theme_description || "");
      setMonthlyMessage(organization.monthly_message || "");
      
      setIsEditingWhatsApp(!organization.whatsapp_welcome_template);
      setIsEditingBrevo(!organization.brevo_api_key);
      
      // Check initial WhatsApp connection status
      fetchWithAuth(`/api/send-whatsapp?proxy=true&action=status&sessionId=${organization.id}&gatewayUrl=${encodeURIComponent("http://ugpay.tech:3000")}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === "connected") setIsWhatsAppConnected(true);
        })
        .catch(console.error);
    }
  }, [organization]);

  function handlePresidentSigChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Signature image must be under 2MB");
      return;
    }
    setPresidentSigFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPresidentSignaturePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSecretarySigChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Signature image must be under 2MB");
      return;
    }
    setSecretarySigFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setSecretarySignaturePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSaveLeadershipSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;
    setSavingLeadership(true);

    try {
      let presSigUrl = organization.president_signature_url || presidentSignaturePreview;
      let secSigUrl = organization.secretary_signature_url || secretarySignaturePreview;

      // Handle President Signature Upload
      if (presidentSigFile) {
        try {
          const fileExt = presidentSigFile.name.split(".").pop();
          const fileName = `pres-sig-${organization.id}-${Date.now()}.${fileExt}`;
          const { error: uploadErr } = await supabase.storage
            .from("logos")
            .upload(fileName, presidentSigFile, { upsert: true, contentType: presidentSigFile.type });

          if (uploadErr) throw uploadErr;
          const { data } = supabase.storage.from("logos").getPublicUrl(fileName);
          presSigUrl = data.publicUrl;
        } catch (err) {
          console.warn("Storage upload failed, using data URL for president signature", err);
          presSigUrl = presidentSignaturePreview;
        }
      }

      // Handle Secretary Signature Upload
      if (secretarySigFile) {
        try {
          const fileExt = secretarySigFile.name.split(".").pop();
          const fileName = `sec-sig-${organization.id}-${Date.now()}.${fileExt}`;
          const { error: uploadErr } = await supabase.storage
            .from("logos")
            .upload(fileName, secretarySigFile, { upsert: true, contentType: secretarySigFile.type });

          if (uploadErr) throw uploadErr;
          const { data } = supabase.storage.from("logos").getPublicUrl(fileName);
          secSigUrl = data.publicUrl;
        } catch (err) {
          console.warn("Storage upload failed, using data URL for secretary signature", err);
          secSigUrl = secretarySignaturePreview;
        }
      }

      const { error } = await supabase
        .from("organizations")
        .update({
          president_name: presidentName.trim() || null,
          president_title: presidentTitle.trim() || "Impact President",
          president_signature_url: presSigUrl,
          secretary_name: secretaryName.trim() || null,
          secretary_title: secretaryTitle.trim() || "Impact Secretary",
          secretary_signature_url: secSigUrl,
        })
        .eq("id", organization.id);

      if (error) throw error;

      toast.success("Club Leadership & Signatures updated successfully!");
      setPresidentSigFile(null);
      setSecretarySigFile(null);
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update leadership settings.");
    } finally {
      setSavingLeadership(false);
    }
  }

  async function handleSaveMonthlyThemeSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;
    setSavingMonthlyTheme(true);

    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          monthly_theme: monthlyTheme.trim() || null,
          monthly_theme_description: monthlyThemeDesc.trim() || null,
          monthly_message: monthlyMessage.trim() || null,
        })
        .eq("id", organization.id);

      if (error) throw error;

      toast.success("Monthly Program Theme & Focus updated successfully!");
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("schema cache") || err?.message?.includes("monthly_message")) {
        toast.error("Database table missing columns! Please run the SQL migration in Supabase SQL Editor.", {
          duration: 6000
        });
      } else {
        toast.error(err?.message || "Failed to update monthly theme settings.");
      }
    } finally {
      setSavingMonthlyTheme(false);
    }
  }

  async function handleSaveBrevoSettings(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!organization) return;
    
    const trimmedKey = brevoApiKey.trim();

    setSavingBrevo(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          brevo_api_key: trimmedKey || null,
          brevo_sender_email: brevoSenderEmail.trim() || null,
          brevo_sender_name: brevoSenderName.trim() || null,
        })
        .eq("id", organization.id);

      if (error) throw error;

      toast.success("Email Sender Integration (Brevo) saved!");
      setIsEditingBrevo(false);
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to save Email settings.");
    } finally {
      setSavingBrevo(false);
    }
  }

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

      await fetchWithAuth('/api/send-whatsapp?proxy=true', {
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
      fetchWithAuth('/api/send-whatsapp?proxy=true', {
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
      
      await fetchWithAuth('/api/send-whatsapp?proxy=true', {
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
        {/* Club Logo & Profile Settings Card */}
        <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                Club Logo & Branding
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Upload your club's official logo. This logo appears on your portal header, meeting passes, and attendance reports.
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-lg">
              /org/{organization?.slug}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group">
              {logoPreview || organization?.logo_url ? (
                <img
                  src={logoPreview || organization?.logo_url || "/assets/rotary_gold_logo.png"}
                  className="w-full h-full object-contain p-2"
                  alt="Club Logo"
                />
              ) : (
                <span className="text-[10px] text-muted-foreground font-semibold">No Logo</span>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-2 text-center sm:text-left">
              <div>
                <h4 className="text-sm font-black text-slate-800">{organization?.name}</h4>
                <p className="text-xs text-slate-500">
                  {organization?.district ? `District ${organization.district}` : "District Not Set"} • {organization?.country || "Location Not Set"}
                </p>
              </div>

              <div className="flex items-center gap-3 mt-1 justify-center sm:justify-start">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  id="settings-club-logo"
                />
                <label
                  htmlFor="settings-club-logo"
                  className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-all shadow-xs"
                >
                  <Upload size={13} className="mr-1.5" /> Choose New Logo
                </label>

                {(logoFile || logoPreview) && (
                  <button
                    type="button"
                    onClick={handleUploadLogo}
                    disabled={savingLogo}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs"
                    style={{ background: NAVY }}
                  >
                    {savingLogo ? "Uploading..." : "Save Logo"}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                Recommended: PNG or JPG image under 1.5MB.
              </p>
            </div>
          </div>
        </div>

        {/* Club Leadership & Signatures Card */}
        <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4 lg:col-span-2">
          <div>
            <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              Club Leadership & Official Signatures
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Set your President & Secretary names, titles, and signature images. These appear on official Fellowship Cards issued to visiting Rotarians.
            </p>
          </div>

          <form onSubmit={handleSaveLeadershipSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* President Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <ShieldCheck size={16} className="text-[#17458F]" />
                <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider">Club President</h4>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">President Name</label>
                <input
                  type="text"
                  placeholder="e.g. Fred Kafeero"
                  value={presidentName}
                  onChange={(e) => setPresidentName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Title / Role</label>
                <input
                  type="text"
                  placeholder="e.g. Impact President / Club President"
                  value={presidentTitle}
                  onChange={(e) => setPresidentTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">President Signature Image</label>
                <div className="flex items-center gap-4 mt-1">
                  <div className="w-32 h-16 rounded-xl border border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                    {presidentSignaturePreview ? (
                      <img src={presidentSignaturePreview} alt="President Signature" className="max-h-full max-w-full object-contain p-1" />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No signature</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePresidentSigChange}
                      className="hidden"
                      id="president-signature-input"
                    />
                    <label
                      htmlFor="president-signature-input"
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-all inline-flex items-center gap-1 shadow-xs"
                    >
                      <Upload size={12} /> Upload Signature
                    </label>
                    <span className="text-[9px] text-slate-400">Transparent PNG recommended</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Secretary Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <FileText size={16} className="text-[#17458F]" />
                <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider">Club Secretary</h4>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Secretary Name</label>
                <input
                  type="text"
                  placeholder="e.g. Emmanuel Ssemwanga"
                  value={secretaryName}
                  onChange={(e) => setSecretaryName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Title / Role</label>
                <input
                  type="text"
                  placeholder="e.g. Impact Secretary / Club Secretary"
                  value={secretaryTitle}
                  onChange={(e) => setSecretaryTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Secretary Signature Image</label>
                <div className="flex items-center gap-4 mt-1">
                  <div className="w-32 h-16 rounded-xl border border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                    {secretarySignaturePreview ? (
                      <img src={secretarySignaturePreview} alt="Secretary Signature" className="max-h-full max-w-full object-contain p-1" />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No signature</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSecretarySigChange}
                      className="hidden"
                      id="secretary-signature-input"
                    />
                    <label
                      htmlFor="secretary-signature-input"
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer transition-all inline-flex items-center gap-1 shadow-xs"
                    >
                      <Upload size={12} /> Upload Signature
                    </label>
                    <span className="text-[9px] text-slate-400">Transparent PNG recommended</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={savingLeadership}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs"
                style={{ background: NAVY }}
              >
                {savingLeadership ? "Saving Leadership Details..." : "Save Leadership & Signatures"}
              </button>
            </div>
          </form>
        </div>

        {/* Monthly Program Theme & Focus Card */}
        <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4 lg:col-span-2">
          <div>
            <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              Club Monthly Program Theme & Message
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Customize the monthly theme title, description, and President's Message shown to attendees on the Monthly Program roster page.
            </p>
          </div>

          <form onSubmit={handleSaveMonthlyThemeSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Monthly Theme Title</label>
              <input
                type="text"
                placeholder="e.g. Basic Education & Literacy Month (Leave empty to use official Rotary theme)"
                value={monthlyTheme}
                onChange={(e) => setMonthlyTheme(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Theme Description</label>
              <textarea
                placeholder="Brief summary of the monthly theme focus"
                value={monthlyThemeDesc}
                onChange={(e) => setMonthlyThemeDesc(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 resize-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">President's Monthly Quote / Message</label>
              <textarea
                placeholder="e.g. 'Together we nurture minds and transform futures...'"
                value={monthlyMessage}
                onChange={(e) => setMonthlyMessage(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 resize-none"
              />
            </div>

            <div className="md:col-span-2 flex justify-end mt-1">
              <button
                type="submit"
                disabled={savingMonthlyTheme}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs"
                style={{ background: NAVY }}
              >
                {savingMonthlyTheme ? "Saving Theme..." : "Save Monthly Theme & Focus"}
              </button>
            </div>
          </form>
        </div>

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
