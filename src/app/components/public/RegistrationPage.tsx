import { useParams, useNavigate, useSearchParams } from "react-router";
import { useState, useEffect, useRef } from "react";
import { useTenant } from "../../../context/TenantContext";
import { useEvent } from "../../../hooks/useEvents";
import { useSubmitRegistration, useUpdateRegistration, useRegistrationByQR } from "../../../hooks/useRegistrations";
import { PageCard, TextInput, SelectInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD, parseOrgWebsite, sanitizeInput, sanitizeRequiredInput, formatUgandanPhone } from "../../../lib/constants";
import { AlertCircle, ChevronLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import { useOrgMembers, useCreateMember } from "../../../hooks/useMembers";
import { supabase } from "../../../lib/supabase";
import type { ClubActivity } from "../../../types/database";

export function RegistrationPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editQrRef = searchParams.get("edit");

  const { organization, loading: tenantLoading } = useTenant();

  const { activeEventId } = parseOrgWebsite(organization?.website || null);
  const targetEventId = (id === undefined || id === "active") ? (activeEventId || undefined) : id;

  const { data: event, isLoading: eventLoading } = useEvent(targetEventId);
  
  const { data: existingReg, isLoading: existingRegLoading } = useRegistrationByQR(editQrRef || undefined);

  const mutation = useSubmitRegistration();
  const updateMutation = useUpdateRegistration();

  const loading = tenantLoading || (targetEventId ? eventLoading : false) || (editQrRef ? existingRegLoading : false);

  if (loading) {
    return <LoadingScreen variant="blue" />;
  }

  // Handle case where dynamic active event was scanned but no event is active
  if ((id === undefined || id === "active") && !activeEventId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageCard className="text-center max-w-md flex flex-col items-center gap-4 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl p-8 border border-border">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto animate-bounce" />
          <h2 className="text-xl font-bold text-amber-600 font-sans" style={{ fontFamily: "var(--font-sans)" }}>No Active Event</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            There is currently no active event configured for on-site registration at <strong className="text-foreground">{organization?.name || "the club"}</strong>.
            Please check with the host at the venue, or browse upcoming events below.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full mt-4">
            <OutlineButton onClick={() => navigate(`/org/${slug}`)} className="flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider">
              Club Home
            </OutlineButton>
            <GoldButton onClick={() => navigate(`/org/${slug}/events`)} className="flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider">
              View Events List
            </GoldButton>
          </div>
        </PageCard>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageCard className="text-center max-w-sm flex flex-col gap-4 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl p-8 border border-border">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>Event Not Found</h2>
          <p className="text-xs text-muted-foreground">The event registration page you are looking for does not exist or may have been deleted.</p>
          <GoldButton onClick={() => navigate(`/org/${slug}/events`)} className="w-full justify-center text-xs font-bold uppercase tracking-wider py-2.5">
            Back to Events
          </GoldButton>
        </PageCard>
      </div>
    );
  }

  // Check if user is already registered on this device
  const registeredRef = targetEventId ? localStorage.getItem(`reg-ref-${targetEventId}`) : null;
  if (registeredRef && !editQrRef) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageCard className="text-center max-w-md flex flex-col items-center gap-4 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl p-8 border border-border">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground font-sans animate-in fade-in" style={{ fontFamily: "var(--font-sans)", color: NAVY }}>
            Already Registered
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You have already registered for <strong className="text-foreground">{event.title}</strong> using this phone/device. Each attendee may only register once.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full mt-4">
            <OutlineButton onClick={() => navigate(`/org/${slug}`)} className="flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider">
              Club Home
            </OutlineButton>
            <GoldButton onClick={() => navigate(`/org/${slug}/post-register?ref=${registeredRef}`)} className="flex-1 justify-center py-2.5 text-xs font-bold uppercase tracking-wider">
              View My Ticket
            </GoldButton>
          </div>
        </PageCard>
      </div>
    );
  }

  const isActiveEvent = activeEventId === event.id;

  if (!isActiveEvent && !editQrRef) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageCard className="text-center max-w-md flex flex-col items-center gap-4 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl p-8 border border-border">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-amber-600" style={{ fontFamily: "var(--font-sans)" }}>On-Site Registration Closed</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Registration for <strong className="text-foreground">{event.title}</strong> is currently closed. Attendance registration is strictly available on-site at the venue when the event is set active by the host.
          </p>
          <GoldButton onClick={() => navigate(`/org/${slug}/events`)} className="w-full justify-center mt-2 text-xs font-bold uppercase tracking-wider py-2.5">
            Back to Events
          </GoldButton>
        </PageCard>
      </div>
    );
  }

  return (
    <RegistrationForm
      key={event.id}
      event={event}
      organization={organization}
      slug={slug}
      mutation={mutation}
      updateMutation={updateMutation}
      existingReg={existingReg}
      editQrRef={editQrRef}
    />
  );
}

interface RegistrationFormProps {
  event: any;
  organization: any;
  slug?: string;
  mutation: any;
  updateMutation?: any;
  existingReg?: any;
  editQrRef?: string | null;
}

function RegistrationForm({ event, organization, slug, mutation, updateMutation, existingReg, editQrRef }: RegistrationFormProps) {
  const navigate = useNavigate();
  const storageKey = `rotary-reg-${event.id}`;

  const { data: members, error: membersError } = useOrgMembers(organization?.id);
  const createMemberMutation = useCreateMember();

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fallback to manual if members table query fails
  useEffect(() => {
    if (membersError) {
      console.warn("Failed to fetch club members roster. Falling back to manual name entry.", membersError);
      setIsManualInput(true);
    }
  }, [membersError]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMemberDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Read saved form data if exists
  const savedData = (() => {
    if (editQrRef && existingReg) {
      return {
        fullName: existingReg.full_name || "",
        email: existingReg.email && existingReg.email.startsWith("member-") ? "" : existingReg.email || "",
        phone: existingReg.phone || "",
        regType: existingReg.is_member ? (existingReg.member_id || (existingReg.buddy_group && !existingReg.club_name) ? "club_member" : "rotarian") : "guest",
        clubName: existingReg.club_name || "",
        district: existingReg.district || "",
        buddyGroup: existingReg.buddy_group || "",
        occupation: existingReg.occupation || "",
        comments: existingReg.comments || "",
        selectedMemberId: existingReg.member_id || null,
        isManualInput: existingReg.is_member && !existingReg.club_name && !existingReg.member_id,
        visits: existingReg.visits || [],
        makeups: existingReg.makeups || [],
      };
    }
    try {
      const data = sessionStorage.getItem(storageKey);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  })();

  // Form states initialized from savedData or fallback
  const [fullName, setFullName] = useState(savedData.fullName || "");
  const [email, setEmail] = useState(savedData.email || "");
  const [phone, setPhone] = useState(savedData.phone || "");
  const [regType, setRegType] = useState<"guest" | "rotarian" | "club_member" | null>(savedData.regType || null);
  const [clubName, setClubName] = useState(savedData.clubName || "");
  const [district, setDistrict] = useState(savedData.district || "");
  const [buddyGroup, setBuddyGroup] = useState(savedData.buddyGroup || "");
  const [occupation, setOccupation] = useState(savedData.occupation || "");
  const [comments, setComments] = useState(savedData.comments || "");
  const [error, setError] = useState<string | null>(null);

  // Autocomplete states
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(savedData.selectedMemberId || null);
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [isManualInput, setIsManualInput] = useState(!!savedData.isManualInput);

  const [visits, setVisits] = useState<ClubActivity[]>(savedData.visits || []);
  const [makeups, setMakeups] = useState<ClubActivity[]>(savedData.makeups || []);
  const [existingMakeupsCount, setExistingMakeupsCount] = useState(0);

  // Fetch existing make-ups count for the calendar month of the event
  useEffect(() => {
    if (regType !== "club_member") {
      setExistingMakeupsCount(0);
      return;
    }

    const targetMemberId = !isManualInput ? selectedMemberId : null;
    const targetName = isManualInput ? fullName.trim() : "";

    if (!targetMemberId && !targetName) {
      setExistingMakeupsCount(0);
      return;
    }

    const fetchCount = async () => {
      try {
        const eventDate = new Date(event.date);
        const startOfMonth = new Date(eventDate.getFullYear(), eventDate.getMonth(), 1).toISOString();
        const endOfMonth = new Date(eventDate.getFullYear(), eventDate.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

        let query = supabase
          .from("registrations")
          .select("id, makeups, events!inner(date)")
          .eq("organization_id", organization?.id || "")
          .gte("events.date", startOfMonth)
          .lte("events.date", endOfMonth);

        if (targetMemberId) {
          query = query.eq("member_id", targetMemberId);
        } else {
          query = query.ilike("full_name", targetName);
        }

        const { data, error } = await query;
        if (error) throw error;

        const count = data?.reduce((acc, reg) => {
          const mUps = reg.makeups;
          if (Array.isArray(mUps)) {
            return acc + mUps.length;
          }
          return acc;
        }, 0) || 0;

        setExistingMakeupsCount(count);
      } catch (err) {
        console.error("Error fetching monthly makeups:", err);
      }
    };

    if (targetMemberId) {
      fetchCount();
    } else {
      const timer = setTimeout(fetchCount, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedMemberId, fullName, isManualInput, regType, event.date, organization?.id]);

  const filteredMembers = members?.filter(m =>
    m.full_name.toLowerCase().includes((fullName || searchMemberQuery).toLowerCase())
  ) || [];

  // Auto-persist inputs on changes
  useEffect(() => {
    const data = {
      fullName,
      email,
      phone,
      regType,
      clubName,
      district,
      buddyGroup,
      occupation,
      comments,
    };
    sessionStorage.setItem(storageKey, JSON.stringify(data));
  }, [fullName, email, phone, regType, clubName, district, buddyGroup, occupation, comments, storageKey]);

  const buddyGroupsList = event?.buddy_groups
    ? event.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean)
    : organization?.buddy_groups
    ? organization.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean)
    : ["Group A", "Group B", "Group C", "Group D"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const sanitizedFullName = sanitizeRequiredInput(fullName);
    const sanitizedEmail = regType === "club_member"
      ? (isManualInput
          ? sanitizeRequiredInput(email)
          : (email.trim() ? sanitizeRequiredInput(email) : `member-${selectedMemberId ?? "x"}@${organization?.slug || "rotary"}.org`))
      : sanitizeRequiredInput(email);
    const sanitizedPhone = regType === "club_member"
      ? (isManualInput ? formatUgandanPhone(phone) : null)
      : formatUgandanPhone(phone);
    const sanitizedClubName = regType === "rotarian" ? sanitizeRequiredInput(clubName) : null;
    const sanitizedDistrict = regType === "rotarian" ? sanitizeRequiredInput(district) : null;
    const sanitizedBuddyGroup = regType === "club_member" ? sanitizeRequiredInput(buddyGroup) : null;
    const sanitizedOccupation = regType !== "club_member" ? sanitizeInput(occupation) : null;
    const sanitizedComments = sanitizeInput(comments);

    if (!regType) {
      setError("Please select a registration type.");
      return;
    }

    if (regType === "club_member") {
      if (!sanitizedFullName || !sanitizedBuddyGroup) {
        setError("Please enter your Full Name and select your Buddy Group.");
        return;
      }
      if (isManualInput && (!sanitizedEmail || !sanitizedPhone)) {
        setError("Please fill out all required fields (Name, Email, Phone, and Buddy Group).");
        return;
      }
    } else {
      if (!sanitizedFullName || !sanitizedEmail || !sanitizedPhone) {
        setError("Please fill out all required fields (Name, Email, and Phone Number).");
        return;
      }
    }

    if (regType === "rotarian" && (!sanitizedClubName || !sanitizedDistrict)) {
      setError("Please enter your Club Name and District.");
      return;
    }

    const filteredVisits = visits
      .map(v => ({
        club_name: sanitizeRequiredInput(v.club_name),
        date: sanitizeRequiredInput(v.date),
      }))
      .filter(v => v.club_name !== "");

    const filteredMakeups = makeups
      .map(m => ({
        club_name: sanitizeRequiredInput(m.club_name),
        date: sanitizeRequiredInput(m.date),
      }))
      .filter(m => m.club_name !== "");

    if (regType === "club_member" && (existingMakeupsCount + filteredMakeups.length > 2)) {
      setError(`You have already registered ${existingMakeupsCount} make-up(s) this month. You cannot exceed 2 make-ups per month (attempted to add ${filteredMakeups.length} more).`);
      return;
    }

    try {
      const isRotaryMember = regType === "rotarian" || regType === "club_member";

      let finalMemberId = regType === "club_member" && !isManualInput ? selectedMemberId : null;

      if (regType === "club_member" && (!finalMemberId || isManualInput)) {
        try {
          const { data: existing } = await supabase
            .from("members")
            .select("id")
            .eq("organization_id", organization?.id || "")
            .ilike("full_name", sanitizedFullName)
            .limit(1);

          if (existing && existing.length > 0) {
            finalMemberId = existing[0].id;
          } else {
            const newMember = await createMemberMutation.mutateAsync({
              organization_id: organization?.id || "",
              full_name: sanitizedFullName,
              email: isManualInput ? sanitizedEmail : null,
              phone: sanitizedPhone,
              buddy_group: sanitizedBuddyGroup || null,
            });
            finalMemberId = newMember.id;
          }
        } catch (mErr) {
          console.error("Failed to auto-enroll member in directory:", mErr);
        }
      }

      const payload = {
        event_id: event.id,
        organization_id: organization?.id || "",
        full_name: sanitizedFullName,
        email: sanitizedEmail,
        phone: sanitizedPhone,
        is_member: isRotaryMember,
        club_name: sanitizedClubName,
        district: sanitizedDistrict,
        buddy_group: sanitizedBuddyGroup,
        occupation: sanitizedOccupation,
        organization_name: null,
        comments: sanitizedComments,
        member_id: finalMemberId || null,
        visits: regType === "club_member" && filteredVisits.length > 0 ? filteredVisits : null,
        makeups: regType === "club_member" && filteredMakeups.length > 0 ? filteredMakeups : null,
      };

      let reg;
      if (editQrRef && updateMutation) {
        reg = await updateMutation.mutateAsync({
          qr_ref: editQrRef,
          ...payload
        });
        toast.success("Registration updated successfully!");
      } else {
        reg = await mutation.mutateAsync(payload);
        toast.success("Successfully registered!");
        // Store registration reference in localStorage to enforce one registration per device
        localStorage.setItem(`reg-ref-${event.id}`, reg.qr_ref);
      }

      sessionStorage.removeItem(storageKey);
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
            <h1 className="text-2xl font-black font-sans" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              {event.title} Checkin
            </h1>
          </div>


          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-foreground font-sans" style={{ fontFamily: "var(--font-sans)" }}>
                Select Registration Type:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "guest", label: "Guest", desc: "Visitor / Non-member" },
                  { id: "rotarian", label: "Rotarian", desc: "Member of another Rotary Club" },
                  { id: "club_member", label: "Club Member", desc: "Member of this Rotary Club" },
                ].map((type) => {
                  const isSelected = regType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setRegType(type.id as any)}
                      className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-[#17458F] bg-[#17458F]/5 shadow-sm"
                          : "border-border bg-card hover:bg-muted/30"
                      }`}
                    >
                      <span className="font-bold text-sm text-foreground" style={{ fontFamily: "var(--font-sans)" }}>
                        {type.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {type.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {regType && (
              <div className="flex flex-col gap-5 mt-2 animate-in fade-in duration-300">
                {regType === "club_member" && !isManualInput ? (
                  <div className="relative flex flex-col gap-1.5" ref={dropdownRef}>
                    <label className="text-sm font-semibold text-foreground flex justify-between items-center" style={{ fontFamily: "var(--font-sans)" }}>
                      <span>Select Your Name <span style={{ color: "#F7A81B" }}>*</span></span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualInput(true);
                          setFullName("");
                          setBuddyGroup("");
                          setEmail("");
                          setPhone("");
                        }}
                        className="text-xs font-bold text-[#F7A81B] hover:underline cursor-pointer animate-in fade-in duration-200"
                      >
                        Name not in list? Type manually
                      </button>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type to search your name..."
                        value={fullName || searchMemberQuery}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          setSearchMemberQuery(e.target.value);
                          setSelectedMemberId(null);
                          setShowMemberDropdown(true);
                        }}
                        onFocus={() => setShowMemberDropdown(true)}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-input-background text-foreground text-sm focus:outline-none focus:ring-2 transition-all font-semibold"
                        required
                      />
                      {showMemberDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto z-20 divide-y divide-border/40 animate-in fade-in duration-200">
                          {filteredMembers.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-muted-foreground flex flex-col gap-1">
                              <span>No members match "{fullName || searchMemberQuery}"</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsManualInput(true);
                                  setShowMemberDropdown(false);
                                }}
                                className="font-bold text-[#17458F] hover:underline text-left cursor-pointer"
                              >
                                Register with this name manually
                              </button>
                            </div>
                          ) : (
                            filteredMembers.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setFullName(m.full_name);
                                  setSelectedMemberId(m.id);
                                  if (m.buddy_group) setBuddyGroup(m.buddy_group);
                                  // Auto-fill email and phone from members table
                                  if (m.email) setEmail(m.email);
                                  if (m.phone) setPhone(m.phone);
                                  setShowMemberDropdown(false);
                                }}
                                className="w-full text-left px-4 py-3 text-xs text-foreground hover:bg-muted/30 transition-all font-semibold flex justify-between items-center cursor-pointer"
                              >
                                <span>{m.full_name}</span>
                                {m.buddy_group && (
                                  <span className="text-[10px] bg-[#17458F]/5 text-[#17458F] px-1.5 py-0.5 rounded font-bold">
                                    {m.buddy_group}
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <TextInput
                      label="Full Name"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(val) => {
                        setFullName(val);
                        if (regType !== "club_member") {
                          setSelectedMemberId(null);
                        }
                      }}
                      required
                    />
                    {regType === "club_member" && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setIsManualInput(false);
                            setFullName("");
                            setBuddyGroup("");
                            setSearchMemberQuery("");
                            setSelectedMemberId(null);
                          }}
                          className="text-[10px] font-bold text-[#17458F] hover:underline cursor-pointer"
                        >
                          ← Search from club members roster list
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Show captured email/phone from DB for roster-selected club members */}
                {regType === "club_member" && !isManualInput && selectedMemberId && (
                  <div className="flex flex-col gap-2 p-3 rounded-xl bg-[#17458F]/5 border border-[#17458F]/15 animate-in fade-in duration-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#17458F]">Contact On File</p>
                    {email ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground w-10 shrink-0">Email</span>
                          <span className="text-xs font-semibold text-foreground bg-white border border-border/40 px-3 py-1.5 rounded-lg flex-1 truncate">{email}</span>
                        </div>
                        {phone && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground w-10 shrink-0">Phone</span>
                            <span className="text-xs font-semibold text-foreground bg-white border border-border/40 px-3 py-1.5 rounded-lg flex-1">{phone}</span>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">These contact details are from your member record and will be used for your registration.</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">No email on file for this member. Your registration will proceed without email contact details.</p>
                    )}
                  </div>
                )}

                {(regType !== "club_member" || isManualInput) && (
                  <>
                    <TextInput
                      label="Email Address"
                      type="email"
                      placeholder="e.g. you@example.com"
                      value={email}
                      onChange={setEmail}
                      required={regType !== "club_member" || isManualInput}
                    />

                    <TextInput
                      label="Phone Number"
                      type="tel"
                      placeholder="e.g. +256 700 000000"
                      value={phone}
                      onChange={setPhone}
                      required={regType !== "club_member" || isManualInput}
                    />
                  </>
                )}

                {regType === "rotarian" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                    <TextInput
                      label="Club Name"
                      placeholder="e.g. Rotary Club of Accra"
                      value={clubName}
                      onChange={setClubName}
                      required
                    />
                    <TextInput
                      label="District"
                      placeholder="e.g. 9102"
                      value={district}
                      onChange={setDistrict}
                      required
                    />
                  </div>
                )}

                {regType === "club_member" && (
                  <div className="animate-in fade-in slide-in-from-top-1 flex flex-col gap-5">
                    <div>
                      <SelectInput
                        label="Buddy Group"
                        options={buddyGroupsList.map((g: string) => ({ value: g, label: g }))}
                        value={buddyGroup}
                        onChange={setBuddyGroup}
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Please select the Buddy Group you belong to.
                      </p>
                    </div>

                    <div className="flex flex-col gap-6 p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] dark:bg-[#18181B] dark:border-[#27272A] animate-in fade-in slide-in-from-top-2">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#A1A1AA]" style={{ fontFamily: "var(--font-sans)" }}>
                          Recent Club Activities
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Report any other club visits or make-ups you completed this month.
                        </p>
                      </div>

                      {/* VISITS SECTION */}
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-foreground flex items-center gap-1.5" style={{ fontFamily: "var(--font-sans)" }}>
                            Other Clubs Visited <span className="text-[10px] bg-[#E2E8F0] text-slate-600 px-1.5 py-0.5 rounded font-normal dark:bg-zinc-800 dark:text-zinc-300">Unlimited</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setVisits([...visits, { club_name: "", date: new Date().toISOString().split("T")[0] }])}
                            className="text-xs font-bold text-[#17458F] hover:text-[#17458F]/80 flex items-center gap-1 transition-colors cursor-pointer font-sans"
                            style={{ fontFamily: "var(--font-sans)" }}
                          >
                            <Plus size={14} /> Add Visit
                          </button>
                        </div>

                        {visits.map((visit, index) => (
                          <div key={index} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center animate-in fade-in zoom-in-95 duration-150">
                            <input
                              type="text"
                              placeholder="Club Name (e.g. Rotary Club of Kampala)"
                              value={visit.club_name}
                              onChange={(e) => {
                                const newVisits = [...visits];
                                newVisits[index] = { ...newVisits[index], club_name: e.target.value };
                                setVisits(newVisits);
                              }}
                              className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-xs focus:outline-none focus:ring-2 transition-all font-semibold"
                              required
                            />
                            <input
                              type="date"
                              value={visit.date}
                              onChange={(e) => {
                                const newVisits = [...visits];
                                newVisits[index] = { ...newVisits[index], date: e.target.value };
                                setVisits(newVisits);
                              }}
                              className="w-full sm:w-40 px-4 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-xs focus:outline-none focus:ring-2 transition-all font-semibold"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setVisits(visits.filter((_, i) => i !== index))}
                              className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all cursor-pointer self-end sm:self-auto"
                              title="Remove visit"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* MAKE-UPS SECTION */}
                      <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <label className="text-xs font-bold text-foreground flex items-center gap-1.5" style={{ fontFamily: "var(--font-sans)" }}>
                              Make-ups Done <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30">Max 2 / Month</span>
                            </label>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              Registered this month: <strong className="text-foreground">{existingMakeupsCount}</strong> / 2
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (existingMakeupsCount + makeups.length >= 2) {
                                toast.error(`You cannot exceed the limit of 2 make-ups per month. You already have ${existingMakeupsCount} registered.`);
                                return;
                              }
                              setMakeups([...makeups, { club_name: "", date: new Date().toISOString().split("T")[0] }]);
                            }}
                            disabled={existingMakeupsCount + makeups.length >= 2}
                            className={`text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer font-sans ${
                              existingMakeupsCount + makeups.length >= 2
                                ? "text-muted-foreground cursor-not-allowed opacity-50"
                                : "text-[#17458F] hover:text-[#17458F]/80"
                            }`}
                            style={{ fontFamily: "var(--font-sans)" }}
                          >
                            <Plus size={14} /> Add Make-up
                          </button>
                        </div>

                        {makeups.map((makeup, index) => (
                          <div key={index} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center animate-in fade-in zoom-in-95 duration-150">
                            <input
                              type="text"
                              placeholder="Club Name (e.g. Rotary Club of Ntinda)"
                              value={makeup.club_name}
                              onChange={(e) => {
                                const newMakeups = [...makeups];
                                newMakeups[index] = { ...newMakeups[index], club_name: e.target.value };
                                setMakeups(newMakeups);
                              }}
                              className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-xs focus:outline-none focus:ring-2 transition-all font-semibold"
                              required
                            />
                            <input
                              type="date"
                              value={makeup.date}
                              onChange={(e) => {
                                const newMakeups = [...makeups];
                                newMakeups[index] = { ...newMakeups[index], date: e.target.value };
                                setMakeups(newMakeups);
                              }}
                              className="w-full sm:w-40 px-4 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-xs focus:outline-none focus:ring-2 transition-all font-semibold"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setMakeups(makeups.filter((_, i) => i !== index))}
                              className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all cursor-pointer self-end sm:self-auto"
                              title="Remove makeup"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}

                        {existingMakeupsCount >= 2 && (
                          <div className="text-[11px] text-amber-600 bg-amber-50/50 dark:bg-amber-950/10 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 px-3 py-2 rounded-xl flex items-center gap-1.5 font-medium">
                            ✓ You have already registered 2 make-ups for this month.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {regType !== "club_member" && (
                  <div className="grid grid-cols-1 gap-4">
                    <TextInput
                      label={regType === "guest" ? "Profession (Optional)" : "Classification (Optional)"}
                      placeholder={regType === "guest" ? "e.g. Software Engineer" : "e.g. Software Engineer / Consultant"}
                      value={occupation}
                      onChange={setOccupation}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-sans)" }}>
                    Comment (Optional)
                  </label>
                  <textarea
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
                    {mutation.isPending ? "Submitting..." : "Register Attendance"}
                  </GoldButton>
                </div>
              </div>
            )}
          </form>
        </PageCard>
      </div>
    </div>
  );
}
