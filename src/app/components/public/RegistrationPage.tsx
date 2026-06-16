import { useParams, useNavigate } from "react-router";
import { useState } from "react";
import { useTenant } from "../../../context/TenantContext";
import { useEvent } from "../../../hooks/useEvents";
import { useSubmitRegistration } from "../../../hooks/useRegistrations";
import { PageCard, TextInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD } from "../../../lib/constants";
import { AlertCircle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export function RegistrationPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const navigate = useNavigate();
  const { organization, loading: tenantLoading } = useTenant();
  const { data: event, isLoading: eventLoading } = useEvent(id);
  const mutation = useSubmitRegistration();

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [clubName, setClubName] = useState("");
  const [district, setDistrict] = useState("");
  const [buddyGroup, setBuddyGroup] = useState("");
  const [occupation, setOccupation] = useState("");
  const [comments, setComments] = useState("");

  const [error, setError] = useState<string | null>(null);

  const loading = tenantLoading || eventLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-[#17458F] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageCard className="text-center max-w-sm flex flex-col gap-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>Event Not Found</h2>
          <GoldButton onClick={() => navigate(`/org/${slug}/events`)} className="w-full justify-center">
            Back to Events
          </GoldButton>
        </PageCard>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim()) {
      setError("Please fill out all required fields.");
      return;
    }

    try {
      const reg = await mutation.mutateAsync({
        event_id: event!.id,
        organization_id: organization?.id || "",
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        is_member: isMember,
        club_name: isMember ? clubName.trim() || null : null,
        district: isMember ? district.trim() || null : null,
        buddy_group: buddyGroup.trim() || null,
        occupation: occupation.trim() || null,
        organization_name: null,
        comments: comments.trim() || null,
      });

      toast.success("Successfully registered!");
      // Redirect to post-register confirmation page with the QR ref
      navigate(`/org/${slug}/post-register?ref=${reg.qr_ref}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to submit registration. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <NavBar organization={organization} currentPath={window.location.pathname} />

      <div className="max-w-2xl mx-auto px-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ChevronLeft size={16} /> Back to details
        </button>

        <PageCard>
          <div className="mb-6 pb-4 border-b border-border">
            <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
              Event Registration
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Confirming attendance for: <strong style={{ color: NAVY }}>{event.title}</strong>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <TextInput
              label="Full Name"
              placeholder="Enter your full name"
              value={fullName}
              onChange={setFullName}
              required
            />

            <TextInput
              label="Email Address"
              type="email"
              placeholder="e.g. you@example.com"
              value={email}
              onChange={setEmail}
              required
            />

            <TextInput
              label="Phone Number (Optional)"
              type="tel"
              placeholder="e.g. +1 234 567 8900"
              value={phone}
              onChange={setPhone}
            />

            <div className="flex flex-col gap-2 p-4 bg-muted/30 rounded-xl">
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ fontFamily: "Montserrat, sans-serif" }}>
                <input
                  type="checkbox"
                  checked={isMember}
                  onChange={(e) => setIsMember(e.target.checked)}
                  className="rounded border-border text-[#17458F] focus:ring-[#17458F] w-4 h-4"
                />
                Are you a Rotary Member?
              </label>

              {isMember && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-border/50 animate-in fade-in slide-in-from-top-1">
                  <TextInput
                    label="Club Name"
                    placeholder="e.g. Rotary Club of Accra"
                    value={clubName}
                    onChange={setClubName}
                    required={isMember}
                  />
                  <TextInput
                    label="District"
                    placeholder="e.g. 9102"
                    value={district}
                    onChange={setDistrict}
                    required={isMember}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput
                label="Buddy Group / Table (Optional)"
                placeholder="e.g. Table 4"
                value={buddyGroup}
                onChange={setBuddyGroup}
              />
              <TextInput
                label="Occupation / Company (Optional)"
                placeholder="e.g. Software Engineer"
                value={occupation}
                onChange={setOccupation}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Special Requirements or Comments (Optional)
              </label>
              <textarea
                placeholder="Dietary requests, accessibility requirements, etc."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="px-4 py-3 rounded-xl border border-border bg-input-background text-foreground text-sm focus:outline-none focus:ring-2 transition-all resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-destructive/10 text-destructive">
                <AlertCircle size={15} />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <div className="flex gap-4 mt-2">
              <OutlineButton type="button" onClick={() => navigate(-1)} className="flex-1 justify-center">
                Cancel
              </OutlineButton>
              <GoldButton type="submit" disabled={mutation.isPending} className="flex-1 justify-center">
                {mutation.isPending ? "Submitting..." : "Complete RSVP"}
              </GoldButton>
            </div>
          </form>
        </PageCard>
      </div>
    </div>
  );
}
