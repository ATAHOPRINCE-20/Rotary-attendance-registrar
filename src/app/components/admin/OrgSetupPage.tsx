import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { PageCard, TextInput } from "../shared/PageCard";
import { GoldButton } from "../shared/Buttons";
import { RotaryLogo } from "../shared/RotaryLogo";
import { NAVY, GOLD } from "../../../lib/constants";
import { AlertCircle, Building, Globe, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function OrgSetupPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [district, setDistrict] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // 1. Create the organization
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({
          name: orgName.trim(),
          slug: slug.trim(),
          district: district.trim() || null,
          country: country.trim() || null,
          website: website.trim() || null,
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
      setError(err?.message || "Failed to configure organization. The URL slug might already be in use.");
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
          <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
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

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold" style={{ fontFamily: "Montserrat, sans-serif" }}>
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

            <GoldButton type="submit" disabled={loading} className="w-full justify-center py-3.5 mt-2">
              {loading ? "Configuring Club..." : "Complete Setup"}
            </GoldButton>
          </form>
        </PageCard>
      </div>
    </div>
  );
}
