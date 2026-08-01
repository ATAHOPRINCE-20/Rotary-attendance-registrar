import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { PageCard, TextInput, SelectInput } from "../shared/PageCard";
import { GoldButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD, BOARD_ROLES, sanitizeInput, sanitizeRequiredInput, formatUgandanPhone } from "../../../lib/constants";
import { Shield, ChevronLeft, Check, UserCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { usePublicOrgMembers, useCreateMember } from "../../../hooks/useMembers";
import { supabase } from "../../../lib/supabase";
import { getFriendlyErrorMessage } from "../../../lib/errors";

interface BoardMeetingRegisterPageProps {
  event: any;
  organization: any;
  slug?: string;
  base: string;
  mutation: any;
  updateMutation?: any;
  existingReg?: any;
  editQrRef?: string | null;
}

export function BoardMeetingRegisterPage({
  event,
  organization,
  base,
  mutation,
  updateMutation,
  existingReg,
  editQrRef,
}: BoardMeetingRegisterPageProps) {
  const navigate = useNavigate();

  const { data: members, error: membersError } = usePublicOrgMembers(organization?.id);
  const createMemberMutation = useCreateMember();

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form States
  const [fullName, setFullName] = useState(existingReg?.full_name || "");
  const [email, setEmail] = useState(existingReg?.email || "");
  const [phone, setPhone] = useState(existingReg?.phone || "");
  const [boardRole, setBoardRole] = useState(existingReg?.board_role || "Director - Service Projects");
  const [notes, setNotes] = useState(existingReg?.comments || "");

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(existingReg?.member_id || null);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [isManualInput, setIsManualInput] = useState(existingReg ? !existingReg.member_id : false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (membersError) {
      setIsManualInput(true);
    }
  }, [membersError]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMemberDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMembers = members?.filter((m) =>
    (m.full_name || "").toLowerCase().includes(fullName.toLowerCase())
  ) || [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || mutation.isPending || (updateMutation && updateMutation.isPending)) return;

    setError(null);
    setIsSubmitting(true);

    const sanitizedFullName = sanitizeRequiredInput(fullName);
    const sanitizedEmail = email.trim() ? sanitizeInput(email) : null;
    const sanitizedPhone = phone.trim() ? formatUgandanPhone(phone) : null;
    const sanitizedNotes = sanitizeInput(notes);

    if (!sanitizedFullName) {
      setError("Please enter your full name.");
      setIsSubmitting(false);
      return;
    }

    if (!boardRole) {
      setError("Please select your Board Role / Capacity.");
      setIsSubmitting(false);
      return;
    }

    try {
      let finalMemberId = !isManualInput ? selectedMemberId : null;
      let matchedMember = members?.find((m) => m.id === finalMemberId || (m.full_name && m.full_name.toLowerCase() === sanitizedFullName.toLowerCase()));

      if (!finalMemberId || isManualInput) {
        try {
          const { data: existing } = await supabase
            .rpc("get_public_org_members", { p_org_id: organization?.id || "" })
            .select("id, buddy_group")
            .ilike("full_name", sanitizedFullName)
            .maybeSingle();

          if (existing && existing.id) {
            finalMemberId = existing.id;
            matchedMember = existing as any;
          } else {
            const newMember = await createMemberMutation.mutateAsync({
              organization_id: organization?.id || "",
              full_name: sanitizedFullName,
              email: sanitizedEmail,
              phone: sanitizedPhone,
              buddy_group: "Board of Directors",
            });
            finalMemberId = newMember.id;
            matchedMember = newMember as any;
          }
        } catch (mErr) {
          console.error("Auto-enrolling board member error:", mErr);
        }
      }

      const payload = {
        event_id: event.id,
        organization_id: organization?.id || event.organization_id,
        full_name: sanitizedFullName,
        email: sanitizedEmail || `member-${Date.now()}@agoroll.com`,
        phone: sanitizedPhone,
        is_member: true,
        club_name: organization?.name || null,
        district: organization?.district || null,
        buddy_group: matchedMember?.buddy_group || "Board of Directors",
        occupation: null,
        organization_name: null,
        comments: sanitizedNotes,
        board_role: boardRole,
        member_id: finalMemberId || null,
      };

      let reg;
      if (editQrRef && updateMutation) {
        reg = await updateMutation.mutateAsync({
          qr_ref: editQrRef,
          ...payload,
        });
        toast.success("Board Meeting Check-In updated!");
      } else {
        reg = await mutation.mutateAsync(payload);
        toast.success(`Welcome ${sanitizedFullName}! Board Meeting Check-In complete.`);
        localStorage.setItem(`reg-ref-${event.id}`, reg.qr_ref);
      }

      navigate(`${base}/post-register?ref=${reg.qr_ref}`);
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  const eventDate = new Date(event.date);

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <NavBar organization={organization} currentPath={window.location.pathname} />

      <div className="max-w-xl mx-auto px-4">
        {/* Navigation Link */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(`${base}/event/${event.id}`)}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} /> View Event Details
          </button>
        </div>

        {/* Board Meeting Header Banner */}
        <div className="bg-gradient-to-br from-[#081c3b] via-[#17458F] to-[#0f2d5c] rounded-3xl p-6 text-white shadow-xl mb-6 relative overflow-hidden border border-white/10">
          <div className="absolute -right-8 -bottom-8 w-56 h-56 bg-[#F7A81B]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F7A81B] text-[#081c3b] shadow-xs inline-flex items-center gap-1">
                <Shield size={12} /> Board Meeting Check-In
              </span>
              {organization?.district && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-blue-100 border border-white/15">
                  District {organization.district}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 font-sans">
              {organization?.name || "Rotary Club"}
            </h1>
            <p className="text-sm font-bold text-amber-300">{event.title}</p>
            <p className="text-xs text-blue-100/80">
              {eventDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} at {eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* Form Card */}
        <PageCard>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-black text-foreground" style={{ color: NAVY }}>
                Official Board Member Attendance
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Please select your name and board capacity to record attendance for official minutes & quorum.
              </p>
            </div>

            {/* Member Selection / Autocomplete */}
            {!isManualInput ? (
              <div className="relative flex flex-col gap-1.5" ref={dropdownRef}>
                <label className="text-xs font-bold text-foreground flex justify-between items-center">
                  <span>Select Board Member Name <span className="text-amber-500">*</span></span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualInput(true);
                      setFullName("");
                      setSelectedMemberId(null);
                    }}
                    className="text-[11px] font-semibold text-[#17458F] hover:underline cursor-pointer"
                  >
                    Enter Manually
                  </button>
                </label>

                <input
                  type="text"
                  placeholder="Start typing your name..."
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setSelectedMemberId(null);
                    setShowMemberDropdown(true);
                  }}
                  onFocus={() => setShowMemberDropdown(true)}
                  className="px-4 py-3 rounded-xl border border-border bg-input-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#17458F]/50 transition-all"
                />

                {showMemberDropdown && filteredMembers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-xl border border-border shadow-xl max-h-56 overflow-y-auto z-50 py-1">
                    {filteredMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setFullName(m.full_name);
                          if (m.email) setEmail(m.email);
                          if (m.phone) setPhone(m.phone);
                          setSelectedMemberId(m.id || null);
                          setShowMemberDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted text-xs flex justify-between items-center transition-colors cursor-pointer border-b border-border/40 last:border-0"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">{m.full_name}</span>
                          {m.buddy_group && (
                            <span className="text-[10px] text-muted-foreground">{m.buddy_group}</span>
                          )}
                        </div>
                        {selectedMemberId === m.id && <Check size={14} className="text-emerald-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-foreground">
                    Full Name <span className="text-amber-500">*</span>
                  </label>
                  {members && members.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualInput(false);
                        setFullName("");
                      }}
                      className="text-[11px] font-semibold text-[#17458F] hover:underline cursor-pointer"
                    >
                      Select From List
                    </button>
                  )}
                </div>
                <TextInput
                  label="Full Name *"
                  placeholder="e.g. Rtn. John Doe"
                  value={fullName}
                  onChange={setFullName}
                  required
                />
              </div>
            )}

            {/* Board Role / Capacity Selection */}
            <SelectInput
              label="Board Role / Capacity *"
              options={BOARD_ROLES.map((r) => ({ value: r, label: r }))}
              value={boardRole}
              onChange={setBoardRole}
            />

            {/* Optional Email & Phone - Only shown for manual entry */}
            {isManualInput && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextInput
                  label="Email Address (Optional)"
                  type="email"
                  placeholder="rtn.member@gmail.com"
                  value={email}
                  onChange={setEmail}
                />
                <TextInput
                  label="Phone Number (Optional)"
                  type="tel"
                  placeholder="+256 7..."
                  value={phone}
                  onChange={setPhone}
                />
              </div>
            )}

            {/* Optional Meeting Notes / Motion Comments */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground">
                Discussion Notes / Motions (Optional)
              </label>
              <textarea
                placeholder="Any key agenda notes or comments for official minutes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="px-4 py-3 rounded-xl border border-border bg-input-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#17458F]/50 transition-all resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs bg-destructive/10 text-destructive font-semibold">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <GoldButton
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="w-full justify-center py-3 text-xs font-bold uppercase tracking-wider mt-2"
            >
              <UserCheck size={16} /> {isSubmitting ? "Processing Check-In..." : "Complete Board Check-In"}
            </GoldButton>
          </form>
        </PageCard>
      </div>
    </div>
  );
}
