import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { PageCard, TextInput } from "../shared/PageCard";
import { GoldButton } from "../shared/Buttons";
import { RotaryLogo } from "../shared/RotaryLogo";
import { NAVY, GOLD, sanitizeInput, sanitizeRequiredInput } from "../../../lib/constants";
import { getFriendlyErrorMessage } from "../../../lib/errors";
import { AlertCircle, Building, Globe, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { LoadingScreen } from "../shared/LoadingScreen";

export function OrgSetupPage() {
  const { user, profile, loading: authLoading, profileLoading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [district, setDistrict] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");

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

  // Wait until loading finishes or redirect is in progress
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

  // Helper to auto-generate slug
  function handleNameChange(val: string) {
    setOrgName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("You must be logged in to create an organization.");
      return;
    }

    if (!orgName.trim() || !slug.trim()) {
      setError("Organization Name and custom URL slug are required.");
      return;
    }

    setLoading(true);

    try {
      // Pre-check if name or slug already exists to prevent duplicate club registration
      const { data: existingOrgs, error: checkErr } = await supabase
        .from("organizations")
        .select("name, slug")
        .or(`slug.eq.${slug.trim()},name.ilike.${orgName.trim()}`)
        .limit(1);

      if (checkErr) {
        console.warn("Could not check duplicate organizations", checkErr);
      } else if (existingOrgs && existingOrgs.length > 0) {
        setError("This club is already registered.");
        setLoading(false);
        return;
      }

      let logoUrl = null;
      if (logoFile) {
        try {
          const fileExt = logoFile.name.split(".").pop();
          const fileName = `${slug}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          const filePath = `${fileName}`;

          // Try to upload
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("logos")
            .upload(filePath, logoFile, {
              upsert: true,
              contentType: logoFile.type
            });

          if (uploadErr) throw uploadErr;

          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from("logos")
            .getPublicUrl(filePath);

          logoUrl = publicUrlData.publicUrl;
        } catch (storageErr) {
          console.warn("Storage upload failed, falling back to Base64:", storageErr);
          logoUrl = logoPreview; // Fallback to base64
        }
      }

      // 1. Create the organization
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({
          name: sanitizeRequiredInput(orgName),
          slug: sanitizeRequiredInput(slug),
          logo_url: logoUrl,
          district: district.trim() ? sanitizeInput(district) : null,
          country: country.trim() ? sanitizeInput(country) : null,
          website: website.trim() ? sanitizeInput(website) : null,
        })
        .select()
        .single();

      if (orgErr) throw orgErr;

      // 2. Create the admin user profile linked to the new organization
      const { error: profileErr } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          organization_id: org.id,
          full_name: user.user_metadata?.full_name || "Admin",
          role: "admin",
        });

      if (profileErr) throw profileErr;

      // 3. Refresh context and redirect
      toast.success("Organization successfully configured!");
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)" }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <RotaryLogo size={56} />
          <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
            Configure Your Club
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Set up your organization tenant to begin managing events
          </p>
        </div>

        <PageCard>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <TextInput
              label="Rotary Club/Organization Name"
              placeholder="e.g. Rotary Club of Accra South"
              value={orgName}
              onChange={handleNameChange}
              required
            />

            {/* Club Logo Upload */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-sans)" }}>
                Club Logo (Optional)
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-dashed border-border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} className="w-full h-full object-contain p-1 bg-white" alt="Preview" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-semibold">No Logo</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    id="club-logo-file"
                  />
                  <label
                    htmlFor="club-logo-file"
                    className="inline-flex items-center justify-center px-4 py-2 border border-border rounded-xl text-xs font-bold text-foreground bg-card hover:bg-muted cursor-pointer transition-all"
                  >
                    Choose Logo File
                  </label>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Supports PNG, JPG, GIF up to 1.5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold" style={{ fontFamily: "var(--font-sans)" }}>
                Custom Portal URL Slug
              </label>
              <div className="flex items-center rounded-xl border border-border bg-input-background overflow-hidden focus-within:ring-2 focus-within:ring-[#17458F]/50">
                <span className="bg-muted px-3 py-3 text-xs text-muted-foreground border-r border-border font-semibold select-none">
                  /org/
                </span>
                <input
                  type="text"
                  placeholder="accra-south"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  required
                  className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
                  style={{ fontFamily: "monospace" }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                This will be your public portal link: /org/{slug || "your-club-slug"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput
                label="District (Optional)"
                placeholder="e.g. 9102"
                value={district}
                onChange={setDistrict}
              />
              <TextInput
                label="Country (Optional)"
                placeholder="e.g. Ghana"
                value={country}
                onChange={setCountry}
              />
            </div>

            <TextInput
              label="Website Address (Optional)"
              type="url"
              placeholder="e.g. https://rotary.org"
              value={website}
              onChange={setWebsite}
            />

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-destructive/10 text-destructive">
                <AlertCircle size={15} />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <GoldButton type="submit" disabled={loading} className="w-full justify-center py-2.5 mt-2">
              {loading ? "Configuring Club..." : "Complete Setup"}
            </GoldButton>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate("/admin");
              }}
              className="text-xs font-semibold hover:underline text-center mt-3 w-full cursor-pointer block"
              style={{ color: NAVY }}
            >
              Sign Out & Cancel
            </button>


          </form>
        </PageCard>
      </div>
    </div>
  );
}
