import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import {
  useDonationCampaigns,
  useCreateDonationCampaign,
  useUpdateDonationCampaign,
  useDeleteDonationCampaign,
  DonationCampaign
} from "../../../hooks/useDonationCampaigns";
import { useOrgDonations } from "../../../hooks/useDonations";
import { AdminLayout } from "../shared/AdminLayout";
import { PageCard, TextInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NAVY, GOLD } from "../../../lib/constants";
import { 
  Heart, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  TrendingUp, 
  Coins, 
  CheckCircle, 
  Archive, 
  X,
  Calendar,
  QrCode,
  Share2,
  Printer,
  Copy,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import { QRCodeSVG } from "qrcode.react";
import { getTenantUrl } from "../../../lib/subdomain";

export function DonationCampaignsPage() {
  const { organization } = useAuth();
  
  // Queries & Mutations
  const { data: campaigns, isLoading: campaignsLoading } = useDonationCampaigns(organization?.id);
  const { data: allDonations, isLoading: donationsLoading } = useOrgDonations(organization?.id);
  const createMutation = useCreateDonationCampaign();
  const updateMutation = useUpdateDonationCampaign();
  const deleteMutation = useDeleteDonationCampaign();

  // Selected campaign for viewing recent donations
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // QR Modal State
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCampaign, setQrCampaign] = useState<DonationCampaign | null>(null);
  const [copiedCampaignId, setCopiedCampaignId] = useState<string | null>(null);

  // General QR Code States
  const [showGeneralQr, setShowGeneralQr] = useState(false);
  const [copiedGeneral, setCopiedGeneral] = useState(false);

  // Modal dialog states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<DonationCampaign | null>(null);
  
  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");

  const loading = campaignsLoading || donationsLoading;

  function openCreateModal() {
    setError("");
    setEditingCampaign(null);
    setTitle("");
    setDescription("");
    setGoalAmount("");
    setIsActive(true);
    setModalOpen(true);
  }

  function openEditModal(c: DonationCampaign) {
    setError("");
    setEditingCampaign(c);
    setTitle(c.title);
    setDescription(c.description || "");
    setGoalAmount(c.goal_amount.toString());
    setIsActive(c.is_active);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Campaign Title is required.");
      return;
    }

    const goal = parseFloat(goalAmount) || 0;
    if (goal <= 0) {
      setError("Goal Amount must be greater than 0.");
      return;
    }

    try {
      if (editingCampaign) {
        await updateMutation.mutateAsync({
          id: editingCampaign.id,
          title: title.trim(),
          description: description.trim() || null,
          goal_amount: goal,
          is_active: isActive
        });
        toast.success("Donation campaign updated successfully!");
      } else {
        await createMutation.mutateAsync({
          organization_id: organization?.id || "",
          title: title.trim(),
          description: description.trim() || null,
          goal_amount: goal,
          is_active: true
        });
        toast.success("New donation campaign launched!");
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "An error occurred. Please try again.");
    }
  }

  async function handleToggleStatus(c: DonationCampaign) {
    try {
      await updateMutation.mutateAsync({
        id: c.id,
        is_active: !c.is_active
      });
      toast.success(c.is_active ? "Campaign archived!" : "Campaign reactivated!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update status.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this campaign? This won't delete past donations, but will unlink them from this campaign.")) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Campaign deleted.");
      if (selectedCampaignId === id) {
        setSelectedCampaignId(null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to delete campaign.");
    }
  }

  function openQrModal(c: DonationCampaign) {
    setQrCampaign(c);
    setQrModalOpen(true);
  }

  function copyCampaignLink(c: DonationCampaign) {
    const campaignUrl = organization?.slug ? getTenantUrl(organization.slug, `/donate?campaignId=${c.id}`) : "";
    navigator.clipboard.writeText(campaignUrl);
    setCopiedCampaignId(c.id);
    toast.success("Campaign donation link copied!");
    setTimeout(() => setCopiedCampaignId(null), 2000);
  }

  function printQR(c: DonationCampaign) {
    const campaignUrl = organization?.slug ? getTenantUrl(organization.slug, `/donate?campaignId=${c.id}`) : "";
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked! Please allow popups to print.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code - \${c.title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 40px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background-color: white;
            }
            .container {
              border: 2px solid #E2E8F0;
              border-radius: 24px;
              padding: 40px;
              text-align: center;
              max-width: 480px;
              width: 100%;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
            }
            .logo {
              font-size: 24px;
              font-weight: 900;
              color: ${NAVY};
              margin-bottom: 24px;
              letter-spacing: 0.05em;
            }
            .qr-card {
              background: #F8FAFC;
              border: 1px solid #E2E8F0;
              border-radius: 16px;
              padding: 24px;
              display: inline-block;
              margin-bottom: 24px;
            }
            .title {
              font-size: 22px;
              font-weight: 800;
              color: ${NAVY};
              margin: 0 0 8px 0;
            }
            .desc {
              font-size: 13px;
              color: #64748B;
              line-height: 1.6;
              margin: 0 0 24px 0;
            }
            .url {
              font-family: monospace;
              font-size: 11px;
              color: #475569;
              word-break: break-all;
              background: #F1F5F9;
              padding: 8px 12px;
              border-radius: 8px;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">AGOROLL</div>
            <h1 class="title">\${c.title}</h1>
            <p class="desc">Scan the QR code below to contribute directly to this campaign online.</p>
            <div class="qr-card">
              <div id="qrcode-svg"></div>
            </div>
            <p class="url">\${campaignUrl}</p>
          </div>
          <script>
            window.onload = function() {
              const svgContent = window.opener.document.getElementById('campaign-qr-svg').outerHTML;
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
  }

  function copyGeneralLink() {
    const generalUrl = organization?.slug ? getTenantUrl(organization.slug, "/donate") : "";
    navigator.clipboard.writeText(generalUrl);
    setCopiedGeneral(true);
    toast.success("General donation link copied!");
    setTimeout(() => setCopiedGeneral(false), 2000);
  }

  function printGeneralQR() {
    const generalUrl = organization?.slug ? getTenantUrl(organization.slug, "/donate") : "";
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked! Please allow popups to print.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code - Donation Drive</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 40px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background-color: white;
            }
            .container {
              border: 2px solid #E2E8F0;
              border-radius: 24px;
              padding: 40px;
              text-align: center;
              max-width: 480px;
              width: 100%;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
            }
            .logo {
              font-size: 24px;
              font-weight: 900;
              color: ${NAVY};
              margin-bottom: 24px;
              letter-spacing: 0.05em;
            }
            .qr-card {
              background: #F8FAFC;
              border: 1px solid #E2E8F0;
              border-radius: 16px;
              padding: 24px;
              display: inline-block;
              margin-bottom: 24px;
            }
            .title {
              font-size: 22px;
              font-weight: 800;
              color: ${NAVY};
              margin: 0 0 8px 0;
            }
            .desc {
              font-size: 13px;
              color: #64748B;
              line-height: 1.6;
              margin: 0 0 24px 0;
            }
            .url {
              font-family: monospace;
              font-size: 11px;
              color: #475569;
              word-break: break-all;
              background: #F1F5F9;
              padding: 8px 12px;
              border-radius: 8px;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">AGOROLL</div>
            <h1 class="title">Donation Drive</h1>
            <p class="desc">Scan the QR code below to contribute and support our club projects and community initiatives.</p>
            <div class="qr-card">
              <div id="qrcode-svg"></div>
            </div>
            <p class="url">\${generalUrl}</p>
          </div>
          <script>
            window.onload = function() {
              const svgContent = window.opener.document.getElementById('general-donation-qr-svg').outerHTML;
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
  }

  if (loading) {
    return <LoadingScreen variant="light" />;
  }

  // Filter donations for the selected campaign
  const campaignDonations = allDonations?.filter(
    d => d.campaign_id === selectedCampaignId && d.status === "completed"
  ) || [];

  return (
    <AdminLayout 
      pageTitle="Donation Campaigns"
      actions={
        <div className="flex gap-3">
          <OutlineButton onClick={() => setShowGeneralQr(true)} className="flex items-center gap-2 text-xs py-2">
            <QrCode size={14} /> General QR Code
          </OutlineButton>
          <GoldButton onClick={openCreateModal} className="flex items-center gap-2 text-xs py-2">
            <Plus size={14} /> Launch Campaign
          </GoldButton>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Campaigns List Column */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {!campaigns || campaigns.length === 0 ? (
              <div className="col-span-2">
                <PageCard className="text-center py-16 flex flex-col items-center gap-4">
                  <Heart className="w-12 h-12 text-muted-foreground animate-pulse" />
                  <h3 className="text-lg font-bold" style={{ color: NAVY }}>No Campaigns Launched</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Initiate custom donation drives to target special service projects and support your communities.
                  </p>
                  <GoldButton onClick={openCreateModal} className="mt-2 text-xs">
                    Create Your First Campaign
                  </GoldButton>
                </PageCard>
              </div>
            ) : (
              campaigns.map((c) => {
                const raised = (c as any).amount_raised || 0;
                const percent = Math.min(Math.round((raised / c.goal_amount) * 100), 100);
                const isSelected = selectedCampaignId === c.id;

                return (
                  <PageCard 
                    key={c.id} 
                    className={`flex flex-col justify-between border transition-all duration-200 ${
                      isSelected 
                        ? "border-[#F7A81B] shadow-md bg-[#F7A81B]/5" 
                        : "border-border/60 hover:shadow-sm hover:border-slate-300"
                    }`}
                  >
                    <div>
                      {/* Badge / Status */}
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <span 
                          onClick={() => setSelectedCampaignId(isSelected ? null : c.id)}
                          className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full cursor-pointer hover:bg-slate-100 transition-all select-none"
                          style={{ 
                            backgroundColor: c.is_active ? "#E6F4EA" : "#F1F3F4", 
                            color: c.is_active ? "#137333" : "#5F6368" 
                          }}
                        >
                          {c.is_active ? "● Live Campaign" : "● Archived"}
                        </span>

                        <div className="flex items-center gap-1.5 print:hidden">
                          <button
                            onClick={() => openQrModal(c)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                            title="Share QR Code"
                          >
                            <QrCode size={13} />
                          </button>
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                            title="Edit Campaign"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(c)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                            title={c.is_active ? "Archive Campaign" : "Reactivate Campaign"}
                          >
                            <Archive size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                            title="Delete Campaign"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Header */}
                      <h3 
                        onClick={() => setSelectedCampaignId(isSelected ? null : c.id)}
                        className="font-bold text-base cursor-pointer hover:text-[#17458F] transition-colors"
                        style={{ color: NAVY, fontFamily: "var(--font-sans)" }}
                      >
                        {c.title}
                      </h3>
                      
                      {c.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3 leading-relaxed">
                          {c.description}
                        </p>
                      )}
                    </div>

                    {/* Progress tracker */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Progress</span>
                        <span style={{ color: NAVY }}>{percent}%</span>
                      </div>
                      
                      {/* Bar */}
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${percent}%`, 
                            backgroundColor: percent >= 100 ? "#48BB78" : GOLD
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-medium mt-1">
                        <span className="text-emerald-600 font-bold">Raised: UGX {raised.toLocaleString()}</span>
                        <span className="text-muted-foreground">Goal: UGX {c.goal_amount.toLocaleString()}</span>
                      </div>

                      <OutlineButton 
                        onClick={() => setSelectedCampaignId(isSelected ? null : c.id)}
                        className="mt-3 py-1.5 justify-center text-[10px] uppercase font-bold tracking-wider"
                      >
                        {isSelected ? "Hide Donations" : "View Donations"}
                      </OutlineButton>
                    </div>
                  </PageCard>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Campaign Transactions Sidebar */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <PageCard className="h-full min-h-[400px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: NAVY }}>
                  <Coins size={16} style={{ color: GOLD }} /> 
                  Campaign Contributions
                </h3>
                {selectedCampaignId && (
                  <button 
                    onClick={() => setSelectedCampaignId(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground font-semibold flex items-center gap-0.5"
                  >
                    Clear <X size={10} />
                  </button>
                )}
              </div>

              {!selectedCampaignId ? (
                <div className="text-center py-20 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <Heart size={18} />
                  </div>
                  <p className="text-xs text-muted-foreground px-4">
                    Select a donation campaign to audit specific contributions and donor payments.
                  </p>
                </div>
              ) : campaignDonations.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-xs text-muted-foreground">
                    No contributions received for this campaign yet.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                  {campaignDonations.map((d) => (
                    <div 
                      key={d.id} 
                      className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex flex-col gap-1 hover:border-slate-200 transition-all"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-800">{d.full_name || "Anonymous"}</span>
                        <span className="text-emerald-600 font-bold">UGX {Number(d.amount).toLocaleString()}</span>
                      </div>
                      {d.email && <span className="text-[10px] text-muted-foreground">{d.email}</span>}
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-1 pt-1.5 border-t border-slate-200/50">
                        <span>{new Date(d.created_at).toLocaleDateString()}</span>
                        <span className="font-mono">{d.receipt_number}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedCampaignId && campaignDonations.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Total Campaign Sum</span>
                <span style={{ color: NAVY }}>
                  UGX {campaignDonations.reduce((sum, d) => sum + Number(d.amount), 0).toLocaleString()}
                </span>
              </div>
            )}
          </PageCard>
        </div>

      </div>

      {/* Campaign Dialog Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-lg font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                {editingCampaign ? "Edit Campaign" : "Launch Donation Campaign"}
              </h2>
              <button 
                onClick={() => setModalOpen(false)} 
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-5 flex flex-col gap-4">
                
                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-destructive/10 text-destructive">
                    <AlertCircle size={15} />
                    <span className="font-semibold">{error}</span>
                  </div>
                )}

                <TextInput 
                  label="Campaign Title" 
                  placeholder="e.g. Polio Eradication Drive 2026" 
                  value={title} 
                  onChange={setTitle} 
                  required 
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Description / Call to Action</label>
                  <textarea
                    placeholder="Describe what the money raised will be used for..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-input-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#F7A81B] transition-all resize-none"
                  />
                </div>

                <TextInput 
                  label="Target Goal Amount (UGX)" 
                  placeholder="e.g. 5000000" 
                  value={goalAmount} 
                  onChange={setGoalAmount} 
                  type="number"
                  required 
                />

                {editingCampaign && (
                  <div className="flex items-center gap-3 py-1.5">
                    <input
                      type="checkbox"
                      id="campaign-active-check"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 accent-[#F7A81B] rounded cursor-pointer"
                    />
                    <label htmlFor="campaign-active-check" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                      Set Campaign Active (Shown on Donor Page)
                    </label>
                  </div>
                )}

              </div>

              <div className="flex gap-4 border-t border-border px-6 py-4 bg-muted/10">
                <OutlineButton type="button" onClick={() => setModalOpen(false)} className="flex-1 justify-center">
                  Cancel
                </OutlineButton>
                <GoldButton 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending} 
                  className="flex-1 justify-center"
                >
                  {editingCampaign ? "Save Changes" : "Launch Drive"}
                </GoldButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden QRCodeSVG for printing */}
      <div id="campaign-qr-svg-container" className="hidden">
        {qrCampaign && (
          <QRCodeSVG 
            id="campaign-qr-svg"
            value={organization?.slug ? getTenantUrl(organization.slug, `/donate?campaignId=${qrCampaign.id}`) : ""}
            size={260}
            level="H"
            includeMargin={true}
          />
        )}
      </div>

      {/* QR Code Share Modal */}
      {qrModalOpen && qrCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                Share Campaign Gateway
              </h2>
              <button 
                onClick={() => {
                  setQrModalOpen(false);
                  setQrCampaign(null);
                }} 
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-8 flex flex-col items-center gap-6">
              <div className="text-center max-w-xs">
                <h3 className="font-bold text-base" style={{ color: NAVY }}>{qrCampaign.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Attendees scan this QR code with their mobile device to open the campaign donation checkout page directly.
                </p>
              </div>

              {/* QR Render card */}
              <div className="bg-white p-6 rounded-2xl border border-border/80 shadow-sm flex items-center justify-center">
                <QRCodeSVG 
                  value={organization?.slug ? getTenantUrl(organization.slug, `/donate?campaignId=${qrCampaign.id}`) : ""}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* URL Display */}
              <div className="w-full flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs overflow-hidden">
                <span className="font-semibold text-muted-foreground select-none">URL:</span>
                <span className="flex-1 font-mono truncate select-all">
                  {organization?.slug ? getTenantUrl(organization.slug, `/donate?campaignId=${qrCampaign.id}`) : ""}
                </span>
                <button
                  onClick={() => copyCampaignLink(qrCampaign)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-muted-foreground transition-all shrink-0 cursor-pointer"
                >
                  {copiedCampaignId === qrCampaign.id ? <Check size={14} className="text-emerald-600 font-bold" /> : <Copy size={14} />}
                </button>
              </div>

              <div className="w-full grid grid-cols-2 gap-4 mt-2">
                <OutlineButton onClick={() => printQR(qrCampaign)} className="w-full justify-center flex items-center gap-1.5 py-2.5">
                  <Printer size={15} /> Print Poster
                </OutlineButton>
                <GoldButton onClick={() => copyCampaignLink(qrCampaign)} className="w-full justify-center flex items-center gap-1.5 py-2.5">
                  <Share2 size={15} /> Share Link
                </GoldButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden QRCodeSVG for printing general donation */}
      <div id="general-donation-qr-svg-container" className="hidden">
        <QRCodeSVG 
          id="general-donation-qr-svg"
          value={organization?.slug ? getTenantUrl(organization.slug, "/donate") : ""}
          size={260}
          level="H"
          includeMargin={true}
        />
      </div>

      {/* General QR Code Share Modal */}
      {showGeneralQr && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                General Donation Drive QR
              </h2>
              <button 
                onClick={() => {
                  setShowGeneralQr(false);
                }} 
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-8 flex flex-col items-center gap-6">
              <div className="text-center max-w-xs">
                <h3 className="font-bold text-base" style={{ color: NAVY }}>{organization?.name || "General Donation Drive"}</h3>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Attendees scan this QR code with their mobile device to open the general club donation form.
                </p>
              </div>

              {/* QR Render card */}
              <div className="bg-white p-6 rounded-2xl border border-border/80 shadow-sm flex items-center justify-center">
                <QRCodeSVG 
                  value={organization?.slug ? getTenantUrl(organization.slug, "/donate") : ""}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* URL Display */}
              <div className="w-full flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs overflow-hidden">
                <span className="font-semibold text-muted-foreground select-none">URL:</span>
                <span className="flex-1 font-mono truncate select-all">
                  {organization?.slug ? getTenantUrl(organization.slug, "/donate") : ""}
                </span>
                <button
                  onClick={copyGeneralLink}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-muted-foreground transition-all shrink-0 cursor-pointer"
                >
                  {copiedGeneral ? <Check size={14} className="text-emerald-600 font-bold" /> : <Copy size={14} />}
                </button>
              </div>

              <div className="w-full grid grid-cols-2 gap-4 mt-2">
                <OutlineButton onClick={printGeneralQR} className="w-full justify-center flex items-center gap-1.5 py-2.5">
                  <Printer size={15} /> Print Poster
                </OutlineButton>
                <GoldButton onClick={copyGeneralLink} className="w-full justify-center flex items-center gap-1.5 py-2.5">
                  <Share2 size={15} /> Share Link
                </GoldButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
