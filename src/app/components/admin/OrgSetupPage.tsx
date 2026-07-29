import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { PageCard, TextInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { RotaryLogo } from "../shared/RotaryLogo";
import { NAVY, GOLD, sanitizeInput, sanitizeRequiredInput } from "../../../lib/constants";
import { getFriendlyErrorMessage } from "../../../lib/errors";
import { AlertCircle, Building, Globe, Users, ArrowRight, ArrowLeft, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";

export function OrgSetupPage() {
  const { user, profile, loading: authLoading, profileLoading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  // Multi-step Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Form states
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [district, setDistrict] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [buddyGroups, setBuddyGroups] = useState("Eagles, Doves, Flamingos, Cranes");
  const [momoPhone, setMomoPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Logo upload states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Redirect checks safely executed inside useEffect
  useEffect(() => {
    if (!authLoading && !profileLoading) {
      if (!user) {
        navigate("/admin", { replace: true });
      } else if (profile) {
        navigate("/admin/dashboard", { replace: true });
      }
    }
  }, [authLoading, profileLoading, user, profile, navigate]);

  if (authLoading || profileLoading || !user || profile) {
    return <LoadingScreen variant="light" />;
  }

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

  function handleNameChange(val: string) {
    setOrgName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    );
  }

  const handleNextStep = () => {
    setError(null);
    if (currentStep === 1) {
      if (!orgName.trim()) {
        setError("Please enter your Rotary / Rotaract Club Name.");
        return;
      }
      if (!slug.trim()) {
        setError("Please enter a custom URL slug.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("You must be logged in to create an organization.");
      return;
    }

    if (!orgName.trim() || !slug.trim()) {
      setError("Organization Name and custom URL slug are required.");
      setCurrentStep(1);
      return;
    }

    setLoading(true);

    try {
      const { data: existingOrgs } = await supabase
        .from("organizations")
        .select("name, slug")
        .or(`slug.eq.${slug.trim()},name.ilike.${orgName.trim()}`)
        .limit(1);

      if (existingOrgs && existingOrgs.length > 0) {
        setError("This club name or URL slug is already registered.");
        setCurrentStep(1);
        setLoading(false);
        return;
      }

      let logoUrl = null;
      if (logoFile) {
        try {
          const fileExt = logoFile.name.split(".").pop();
          const fileName = `${slug}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
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

      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({
          name: sanitizeRequiredInput(orgName),
          slug: sanitizeRequiredInput(slug),
          logo_url: logoUrl,
          district: district.trim() ? sanitizeInput(district) : null,
          country: country.trim() ? sanitizeInput(country) : null,
          website: website.trim() ? sanitizeInput(website) : null,
          buddy_groups: buddyGroups.trim() ? sanitizeInput(buddyGroups) : null,
          momo_phone: momoPhone.trim() ? sanitizeInput(momoPhone) : null,
          subscription_tier: "trial",
          subscription_expires_at: trialEndDate.toISOString(),
        })
        .select()
        .single();

      if (orgErr) throw orgErr;

      const { error: profileErr } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          organization_id: org.id,
          full_name: user.user_metadata?.full_name || "Admin",
          role: "admin",
        });

      if (profileErr) throw profileErr;

      toast.success("Organization setup complete! Welcome to your admin portal.");
      await refreshProfile();
      navigate("/admin/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)" }}
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <RotaryLogo size={52} />
          <h1 className="text-2xl font-black mt-3 mb-1" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
            Configure Your Club
          </h1>
          <p className="text-xs text-muted-foreground">
            Complete the 3 quick setup steps to launch your club portal
          </p>
        </div>

        {/* Step Progress Stepper */}
        <div className="mb-6 bg-white p-4 rounded-2xl border border-border/40 shadow-sm">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#17458F]">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              {currentStep === 1 ? "Identity & Branding" : currentStep === 2 ? "Region & District" : "Buddy Groups & Payouts"}
            </span>
          </div>
          
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#17458F] h-full transition-all duration-300 ease-out"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className={`text-[10px] font-bold flex items-center justify-center gap-1 ${currentStep >= 1 ? "text-[#17458F]" : "text-muted-foreground/50"}`}>
              <Building size={11} /> 1. Identity
            </div>
            <div className={`text-[10px] font-bold flex items-center justify-center gap-1 ${currentStep >= 2 ? "text-[#17458F]" : "text-muted-foreground/50"}`}>
              <Globe size={11} /> 2. Region
            </div>
            <div className={`text-[10px] font-bold flex items-center justify-center gap-1 ${currentStep >= 3 ? "text-[#17458F]" : "text-muted-foreground/50"}`}>
              <Users size={11} /> 3. Buddy Groups
            </div>
          </div>
        </div>

        <PageCard className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            {/* STEP 1: IDENTITY & BRANDING */}
            {currentStep === 1 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider mb-1" style={{ color: NAVY }}>
                    Step 1: Club Identity & URL
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Enter your club's official title and set up your public website link.
                  </p>
                </div>

                <TextInput
                  label="Rotary / Rotaract Club Name"
                  placeholder="e.g. Rotary Club of Ntinda"
                  value={orgName}
                  onChange={handleNameChange}
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Custom Portal URL Link
                  </label>
                  <div className="flex items-center rounded-xl border border-border bg-input-background overflow-hidden focus-within:ring-2 focus-within:ring-[#17458F]/30">
                    <span className="bg-muted px-3 py-2.5 text-xs text-muted-foreground border-r border-border font-semibold select-none">
                      /org/
                    </span>
                    <input
                      type="text"
                      placeholder="rotary-ntinda"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      required
                      className="flex-1 px-3 py-2 text-xs bg-transparent focus:outline-none font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Your public link: <strong>/org/{slug || "your-slug"}</strong>
                  </p>
                </div>
              </div>
            )}

            {/* STEP 2: REGION & DISTRICT */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider mb-1" style={{ color: NAVY }}>
                    Step 2: Region & District Info
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Specify your Rotary District number and geographical location.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextInput
                    label="Rotary District (Optional)"
                    placeholder="e.g. 9213"
                    value={district}
                    onChange={setDistrict}
                  />
                  <TextInput
                    label="Country (Optional)"
                    placeholder="e.g. Uganda"
                    value={country}
                    onChange={setCountry}
                  />
                </div>

                <TextInput
                  label="Official Club Website URL (Optional)"
                  type="url"
                  placeholder="e.g. https://rotary.org"
                  value={website}
                  onChange={setWebsite}
                />
              </div>
            )}

            {/* STEP 3: BUDDY GROUPS & PAYOUTS */}
            {currentStep === 3 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider mb-1" style={{ color: NAVY }}>
                    Step 3: Buddy Groups & Mobile Money Payouts
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Configure member fellowship host groups and dues payout collection phone.
                  </p>
                </div>

                <TextInput
                  label="Buddy Groups Roster (Commas Separated)"
                  placeholder="e.g. Eagles, Doves, Flamingos, Cranes"
                  value={buddyGroups}
                  onChange={setBuddyGroups}
                />
                <p className="text-[10px] text-muted-foreground -mt-3">
                  These host groups appear during event registration and attendance registers.
                </p>

                <TextInput
                  label="Mobile Money Payout Phone (Optional)"
                  placeholder="e.g. 0770000000"
                  value={momoPhone}
                  onChange={setMomoPhone}
                />
                <p className="text-[10px] text-muted-foreground -mt-3">
                  Used for collecting member dues payments and contributions.
                </p>

                {/* Review Summary */}
                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-xs flex flex-col gap-1.5 mt-1">
                  <span className="font-bold text-slate-700 uppercase text-[9px] tracking-wider">Setup Summary</span>
                  <div className="flex justify-between text-slate-600">
                    <span>Club Name:</span>
                    <strong className="text-slate-900">{orgName}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Portal Link:</span>
                    <strong className="text-[#17458F]">/org/{slug}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>District:</span>
                    <strong className="text-slate-900">{district || "Not set"}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs bg-destructive/10 text-destructive">
                <AlertCircle size={15} />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Wizard Action Controls */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/40">
              {currentStep > 1 ? (
                <OutlineButton
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </OutlineButton>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    navigate("/admin");
                  }}
                  className="text-xs font-semibold hover:underline text-muted-foreground cursor-pointer"
                >
                  Sign Out
                </button>
              )}

              {currentStep < totalSteps ? (
                <GoldButton
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2 text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  Next Step <ArrowRight size={14} />
                </GoldButton>
              ) : (
                <GoldButton
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  {loading ? "Configuring Club..." : <><CheckCircle2 size={15} /> Launch Portal</>}
                </GoldButton>
              )}
            </div>

          </form>
        </PageCard>
      </div>
    </div>
  );
}
