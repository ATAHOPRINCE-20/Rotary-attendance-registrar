import { useParams, useNavigate } from "react-router";
import { useState, useEffect, Fragment, MouseEvent } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useEvent } from "../../../hooks/useEvents";
import { useEventRegistrations, useCheckIn, useSubmitRegistration, useUpdateRegistration } from "../../../hooks/useRegistrations";
import { PageCard, TextInput, SelectInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { AdminLayout } from "../shared/AdminLayout";
import { NAVY, GOLD, sanitizeInput, sanitizeRequiredInput, formatUgandanPhone, isSyntheticEmail } from "../../../lib/constants";
import {
  ChevronLeft,
  Users,
  Search,
  CheckCircle,
  FileSpreadsheet,
  Printer,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import { supabase } from "../../../lib/supabase";
import type { ClubActivity } from "../../../types/database";
import { useCreateMember, useOrgMembers } from "../../../hooks/useMembers";


export function CheckInPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { organization } = useAuth();

  // Queries
  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { data: registrations, isLoading: regsLoading } = useEventRegistrations(eventId);

  const loading = eventLoading || regsLoading;

  if (loading) {
    return <LoadingScreen variant="light" />;
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <PageCard className="text-center max-w-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>Event Not Found</h2>
          <GoldButton onClick={() => navigate("/admin/events")} className="w-full justify-center">
            Back to Events
          </GoldButton>
        </PageCard>
      </div>
    );
  }

  return (
    <CheckInContent
      key={event.id}
      event={event}
      registrations={registrations || []}
      organization={organization}
      eventId={eventId!}
    />
  );
}

interface CheckInContentProps {
  event: any;
  registrations: any[];
  organization: any;
  eventId: string;
}

function CheckInContent({ event, registrations, organization, eventId }: CheckInContentProps) {
  const navigate = useNavigate();
  const { data: members } = useOrgMembers(organization?.id);
  const updateRegistrationMutation = useUpdateRegistration();
  const checkInMutation = useCheckIn();

  const handleConvertToHomeMember = async (r: any) => {
    try {
      let matchedMember = members?.find(
        (m) => m.full_name.toLowerCase().trim() === r.full_name.toLowerCase().trim()
      );
      if (!matchedMember && r.member_id) {
        matchedMember = members?.find((m) => m.id === r.member_id);
      }

      const realEmail = matchedMember?.email || (r.email && !r.email.startsWith("member-") && !r.email.startsWith("attendee-") ? r.email : null);
      const realPhone = matchedMember?.phone || r.phone;

      await updateRegistrationMutation.mutateAsync({
        qr_ref: r.qr_ref,
        event_id: r.event_id,
        full_name: r.full_name,
        email: realEmail,
        phone: realPhone,
        is_member: true,
        club_name: null,
        district: null,
        member_id: matchedMember?.id || r.member_id || null,
        buddy_group: matchedMember?.buddy_group || r.buddy_group || null,
      });
      toast.success(`Converted ${r.full_name} to Home Club Member.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update attendee category.");
    }
  };
  const registerMutation = useSubmitRegistration();


  // Filter/Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedAttendeeId, setExpandedAttendeeId] = useState<string | null>(null);

  const storageKey = `rotary-admin-reg-${eventId}`;

  // Read saved form data if exists
  const savedData = (() => {
    try {
      const data = sessionStorage.getItem(storageKey);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  })();

  // Manual Registration Form States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState(savedData.fullName || "");
  const [email, setEmail] = useState(savedData.email || "");
  const [phone, setPhone] = useState(savedData.phone || "");
  const [regType, setRegType] = useState<"guest" | "rotarian" | "club_member">(savedData.regType || "guest");
  const [clubName, setClubName] = useState(savedData.clubName || "");
  const [district, setDistrict] = useState(savedData.district || "");
  const [buddyGroup, setBuddyGroup] = useState(savedData.buddyGroup || "");
  const [occupation, setOccupation] = useState(savedData.occupation || "");
  const [comments, setComments] = useState(savedData.comments || "");
  const [submitting, setSubmitting] = useState(false);

  const [visits, setVisits] = useState<ClubActivity[]>([]);
  const [makeups, setMakeups] = useState<ClubActivity[]>([]);
  const [existingMakeupsCount, setExistingMakeupsCount] = useState(0);
  const [statusVal, setStatusVal] = useState<"checked-in" | "apology">("checked-in");
  const createMemberMutation = useCreateMember();

  // Fetch existing monthly makeups count for manual registration
  useEffect(() => {
    if (regType !== "club_member" || !fullName.trim()) {
      setExistingMakeupsCount(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const eventDate = new Date(event.date);
        const startOfMonth = new Date(eventDate.getFullYear(), eventDate.getMonth(), 1).toISOString();
        const endOfMonth = new Date(eventDate.getFullYear(), eventDate.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

        const { data, error } = await supabase
          .from("registrations")
          .select("id, makeups, events!inner(date)")
          .ilike("full_name", fullName.trim())
          .eq("organization_id", organization?.id || "")
          .gte("events.date", startOfMonth)
          .lte("events.date", endOfMonth);

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
        console.error("Error fetching monthly makeups in admin:", err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fullName, regType, event.date, organization?.id]);

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

  // Calculate dynamic buddy group of the day (highest checked-in attendance count)
  const dynamicBuddyGroup = (() => {
    if (!registrations || registrations.length === 0) return null;
    const counts: { [key: string]: number } = {};
    registrations.forEach((r: any) => {
      if (r.status === "checked-in" && r.buddy_group && r.buddy_group.trim()) {
        const bg = r.buddy_group.trim();
        counts[bg] = (counts[bg] || 0) + 1;
      }
    });

    let maxGroup: string | null = null;
    let maxCount = 0;
    Object.entries(counts).forEach(([group, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxGroup = group;
      }
    });

    return maxGroup ? { name: maxGroup, count: maxCount } : null;
  })();

  // Auto-sync dynamic buddy group of the day back to the Supabase database
  useEffect(() => {
    if (!event) return;
    const currentLeader = dynamicBuddyGroup ? dynamicBuddyGroup.name : null;
    if (currentLeader !== event.buddy_group_of_the_day) {
      supabase
        .from("events")
        .update({ buddy_group_of_the_day: currentLeader })
        .eq("id", event.id)
        .then(({ error }) => {
          if (error) console.error("Error updating buddy_group_of_the_day:", error);
        });
    }
  }, [dynamicBuddyGroup, event]);


  // ── Download / Print Attendance Report ─────────────────────────────────────
  function downloadAttendanceReport() {
    if (!event || !registrations) return;

    const eventDate = new Date(event.date).toLocaleDateString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const now = new Date().toLocaleString("en-GB");
    const orgName = organization?.name ?? "Rotary Club";
    let logoUrl = organization?.logo_url || null;
    if (logoUrl && !logoUrl.startsWith("http")) {
      logoUrl = window.location.origin + logoUrl;
    }
    const checkedInCount = registrations.filter(r => r.status === "checked-in").length;
    const apologyCount = registrations.filter(r => r.status === "apology").length;

    // Filter registrations into groups (excluding apologies from present tables)
    const clubMembers = registrations.filter(r => r.status !== "apology" && r.is_member && ((r.buddy_group && r.buddy_group.trim() !== "") || r.member_id));
    const visitingRotarians = registrations.filter(r => r.status !== "apology" && r.is_member && (!r.buddy_group || r.buddy_group.trim() === "") && r.club_name);
    const guests = registrations.filter(r => r.status !== "apology" && !r.is_member);
    const apologies = registrations.filter(r => r.status === "apology");

    // Calculate club attendance metrics
    const checkedInClubCount = clubMembers.filter(r => r.status === "checked-in").length;
    const totalRoster = members?.length ?? 0;
    const clubAttendancePct = totalRoster > 0 ? (checkedInClubCount / totalRoster) * 100 : 0;

    // Format visiting clubs summary string
    const vClubsHeadcountStr = visitingClubsList.length > 0
      ? visitingClubsList.map(item => `${item.club} (${item.count} ${item.count === 1 ? 'person' : 'people'})`).join(", ")
      : "None";

    // Build a lookup: member_id → phone from the members directory
    const memberPhoneMap: { [id: string]: string } = {};
    members?.forEach(m => {
      if (m.id && m.phone) memberPhoneMap[m.id] = m.phone;
    });

    // Generate table rows for Club Members
    const clubMemberRows = clubMembers.length > 0 ? clubMembers.map((r, i) => {
      return `
        <tr class="${i % 2 === 0 ? "even" : "odd"}">
          <td class="no">${i + 1}</td>
          <td class="name">
            <div>${r.full_name}</div>
            ${r.visits && r.visits.length > 0 ? `<div style="font-size: 8px; color: #17458F; font-weight: normal; margin-top: 2px;"><b>Visits:</b> ${r.visits.map((v: ClubActivity) => `${v.club_name} (${v.date})`).join(", ")}</div>` : ''}
            ${r.makeups && r.makeups.length > 0 ? `<div style="font-size: 8px; color: #B45309; font-weight: normal; margin-top: 1px;"><b>Make-ups:</b> ${r.makeups.map((m: ClubActivity) => `${m.club_name} (${m.date})`).join(", ")}</div>` : ''}
          </td>
          <td>${r.buddy_group || "—"}</td>
          <td>${(r.phone || (r.member_id && memberPhoneMap[r.member_id])) || "—"}</td>
          <td>${r.email}</td>
        </tr>`;
    }).join("") : `<tr><td colspan="5" class="center text-muted" style="padding: 12px; color: #888; font-style: italic;">No club members registered for this event.</td></tr>`;

    // Generate table rows for Visiting Rotarians
    const visitingRotarianRows = visitingRotarians.length > 0 ? visitingRotarians.map((r, i) => {
      return `
        <tr class="${i % 2 === 0 ? "even" : "odd"}">
          <td class="no">${i + 1}</td>
          <td class="name">${r.full_name}</td>
          <td>${r.club_name || "—"}</td>
          <td>${r.district || "—"}</td>
          <td>${r.phone ?? "—"}</td>
          <td>${r.email}</td>
        </tr>`;
    }).join("") : `<tr><td colspan="6" class="center text-muted" style="padding: 12px; color: #888; font-style: italic;">No visiting Rotarians registered for this event.</td></tr>`;

    // Generate table rows for Guests
    const guestRows = guests.length > 0 ? guests.map((r, i) => {
      return `
        <tr class="${i % 2 === 0 ? "even" : "odd"}">
          <td class="no">${i + 1}</td>
          <td class="name">${r.full_name}</td>
          <td>${r.occupation || "—"}</td>
          <td>${r.phone ?? "—"}</td>
          <td>${r.email}</td>
        </tr>`;
    }).join("") : `<tr><td colspan="5" class="center text-muted" style="padding: 12px; color: #888; font-style: italic;">No guests registered for this event.</td></tr>`;

    // Generate table rows for Apologies
    const apologyRows = apologies.length > 0 ? apologies.map((r, i) => {
      return `
        <tr class="${i % 2 === 0 ? "even" : "odd"}">
          <td class="no">${i + 1}</td>
          <td class="name">${r.full_name}</td>
          <td>${r.buddy_group || "—"}</td>
          <td>${r.phone ?? "—"}</td>
          <td>${r.email}</td>
        </tr>`;
    }).join("") : `<tr><td colspan="5" class="center text-muted" style="padding: 12px; color: #888; font-style: italic;">No apologies registered for this event.</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Attendance – ${event.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Open Sans', Arial, sans-serif; font-size: 10px; color: #1a1a1a; background: #fff; padding: 24px 32px; }

    /* ── Header ── */
    .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #17458F; padding-bottom: 14px; margin-bottom: 16px; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .wheel { width: 68px; height: 68px; }
    .org-name { font-size: 18px; font-weight: 900; color: #17458F; font-family: 'Montserrat', Arial, sans-serif; letter-spacing: -0.3px; }
    .org-tagline { font-size: 9px; color: #777; margin-top: 2px; text-transform: uppercase; letter-spacing: 1px; }
    .header-right { text-align: right; font-size: 9.5px; color: #555; line-height: 1.6; }

    /* ── Report title ── */
    .report-title { font-size: 15px; font-weight: 900; color: #17458F; font-family: 'Montserrat', Arial, sans-serif; margin-bottom: 2px; }
    .report-meta { display: flex; flex-wrap: wrap; gap: 24px; font-size: 9.5px; color: #444; margin-bottom: 14px; }
    .report-meta span { display: flex; gap: 4px; }
    .report-meta b { color: #17458F; }

    /* ── Summary pills ── */
    .summary { display: flex; gap: 12px; margin-bottom: 20px; }
    .pill { padding: 5px 12px; border-radius: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .pill-blue { background: #17458F15; color: #17458F; border: 1px solid #17458F30; }
    .pill-green { background: #48BB7815; color: #276749; border: 1px solid #48BB7830; }
    .pill-gold  { background: #F7A81B15; color: #9a6b00; border: 1px solid #F7A81B40; }

    /* ── Sections ── */
    .section-title { font-size: 11px; font-weight: 800; color: #17458F; font-family: 'Montserrat', Arial, sans-serif; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; border-bottom: 1.5px solid #17458F40; padding-bottom: 2px; }
    .section-meta { font-size: 9px; color: #666; margin-bottom: 8px; display: flex; gap: 8px; align-items: center; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    thead tr { background: #17458F; color: #fff; }
    thead th { padding: 7px 8px; text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
    tbody tr.even { background: #f8f9fc; }
    tbody tr.odd  { background: #fff; }
    td { padding: 6px 8px; border-bottom: 1px solid #e8ecf4; vertical-align: middle; }
    td.no   { color: #999; font-size: 8.5px; width: 28px; }
    td.name { font-weight: 700; color: #17458F; }
    td.center { text-align: center; }
    td.sig  { width: 90px; border-bottom: 1px solid #bbb; }
    .checkedin { background: #D1FAE5; color: #065F46; padding: 1px 6px; border-radius: 10px; font-size: 8px; font-weight: 700; }
    .pending  { background: #FEF3C7; color: #92400E; padding: 1px 6px; border-radius: 10px; font-size: 8px; font-weight: 700; }

    /* ── Footer ── */
    .footer { border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8.5px; color: #888; margin-top: 20px; }
    .signature-block { display: flex; gap: 48px; margin-top: 36px; margin-bottom: 12px; }
    .sig-line { flex: 1; border-top: 1px solid #555; padding-top: 4px; font-size: 8.5px; color: #555; text-align: center; }

    @media print {
      body { padding: 12px 18px; }
      @page { size: A4 landscape; margin: 10mm; }
      tr { page-break-inside: avoid; }
      .section-title { page-break-after: avoid; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `
        <img class="wheel" src="${logoUrl}" alt="${orgName}" style="object-fit: contain; border-radius: 4px;" />
      ` : `
        <svg class="wheel" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#17458F" stroke-width="7"/>
          <circle cx="50" cy="50" r="16" fill="#17458F"/>
          ${Array.from({length:6},(_,i)=>{
            const a=i*60*Math.PI/180;
            const x1=50+16*Math.sin(a), y1=50-16*Math.cos(a);
            const x2=50+44*Math.sin(a), y2=50-44*Math.cos(a);
            return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#17458F" stroke-width="7" stroke-linecap="round"/>`;
          }).join('')}
        </svg>
      `}
      <div>
        <div class="org-name">${orgName}</div>
        <div class="org-tagline">Service Above Self</div>
      </div>
    </div>
    <div class="header-right">
      <div>Attendance Report</div>
      <div>Printed: ${now}</div>
      ${organization?.district ? `<div>District ${organization.district}</div>` : ""}
    </div>
  </div>

  <!-- Report title -->
  <div class="report-title">Attendance Register</div>
  <div class="report-meta">
    <span><b>Event:</b> ${event.title}</span>
    <span><b>Date:</b> ${eventDate}</span>
    ${event.location ? `<span><b>Venue:</b> ${event.location}</span>` : ""}
    ${dynamicBuddyGroup ? `<span><b>Buddy Group of the Day:</b> ${dynamicBuddyGroup.name} (${dynamicBuddyGroup.count} Present)</span>` : ""}
  </div>

  <!-- Summary pills -->
  <div class="summary">
    <div class="pill pill-blue">Total Registered: ${registrations.length}</div>
    <div class="pill pill-green">Checked In: ${checkedInCount}</div>
    <div class="pill pill-gold">Apologies: ${apologyCount}</div>
  </div>

  <!-- SECTION 1: CLUB MEMBERS -->
  <div class="section-title">1. Club Members</div>
  <div class="section-meta">
    <span>Checked In: <b>${checkedInClubCount}</b> of <b>${clubMembers.length}</b> registered</span>
    <span>|</span>
    <span>Official Club Member Attendance: <b>${clubAttendancePct.toFixed(1)}%</b> (Based on active roster of ${totalRoster} members)</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Buddy Group</th>
        <th>Phone</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>${clubMemberRows}</tbody>
  </table>

  <!-- SECTION 2: VISITING ROTARIANS -->
  <div class="section-title">2. Visiting Rotarians</div>
  <div class="section-meta">
    <span>Checked In: <b>${visitingRotarians.filter(r => r.status === "checked-in").length}</b> of <b>${visitingRotarians.length}</b> registered</span>
    <span>|</span>
    <span>Visiting Clubs: <b>${vClubsHeadcountStr}</b></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Club Name</th>
        <th>District</th>
        <th>Phone</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>${visitingRotarianRows}</tbody>
  </table>

  <!-- SECTION 3: GUESTS & VISITORS -->
  <div class="section-title">3. Guests & Non-Rotarians</div>
  <div class="section-meta">
    <span>Checked In: <b>${guests.filter(r => r.status === "checked-in").length}</b> of <b>${guests.length}</b> registered</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Profession / Classification</th>
        <th>Phone</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>${guestRows}</tbody>
  </table>

  <!-- SECTION 4: APOLOGIES -->
  <div class="section-title">4. Apologies (Absent with Apology)</div>
  <div class="section-meta">
    <span>Total absent with apologies: <b>${apologies.length}</b></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Buddy Group</th>
        <th>Phone</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>${apologyRows}</tbody>
  </table>

  <!-- Signature block -->
  <div class="signature-block">
    <div class="sig-line">Club President / Chairperson</div>
    <div class="sig-line">Secretary</div>
    <div class="sig-line">Event Coordinator</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>${orgName} — Attendance Register — ${event.title}</span>
    <span>Generated by agoroll &bull; agoroll.com</span>
  </div>

  <script>
    window.addEventListener('DOMContentLoaded', () => {
      const images = Array.from(document.querySelectorAll('img'));
      let loadedCount = 0;
      
      const triggerPrint = () => {
        setTimeout(() => {
          window.print();
        }, 500);
      };

      if (images.length === 0) {
        triggerPrint();
      } else {
        images.forEach(img => {
          if (img.complete) {
            loadedCount++;
            if (loadedCount === images.length) triggerPrint();
          } else {
            img.addEventListener('load', () => {
              loadedCount++;
              if (loadedCount === images.length) triggerPrint();
            });
            img.addEventListener('error', () => {
              loadedCount++;
              if (loadedCount === images.length) triggerPrint();
            });
          }
        });
      }
    });
  </script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked — allow pop-ups and try again."); return; }
    win.document.write(html);
    win.document.close();
  }


  const buddyGroupsList = Array.from(new Set<string>(
    event?.buddy_groups
      ? event.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean)
      : organization?.buddy_groups
      ? organization.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean)
      : ["Group A", "Group B", "Group C", "Group D"]
  ));

  const filteredRegs = registrations?.filter((r) => {
    return (
      r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.qr_ref && r.qr_ref.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }) ?? [];

  async function handleUpdateStatus(regId: string, status: "checked-in" | "apology" | "pending") {
    try {
      await checkInMutation.mutateAsync({ id: regId, eventId: eventId!, status });
      const statusLabels = {
        "checked-in": "checked in",
        "apology": "marked with apology",
        "pending": "reset to pending"
      };
      toast.success(`Attendee successfully ${statusLabels[status]}!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update attendee status.");
    }
  }

  async function handleAddAttendee(e: React.FormEvent) {
    e.preventDefault();

    const sanitizedFullName = sanitizeRequiredInput(fullName);
    const sanitizedEmail = email.trim() 
      ? sanitizeRequiredInput(email) 
      : `attendee-${Date.now()}@${organization?.slug || "agoroll"}.org`;
    const sanitizedPhone = phone.trim() ? formatUgandanPhone(phone) : null;
    const sanitizedClubName = regType === "rotarian" ? sanitizeRequiredInput(clubName) : null;
    const sanitizedDistrict = regType === "rotarian" ? sanitizeRequiredInput(district) : null;
    const sanitizedBuddyGroup = regType === "club_member" ? sanitizeRequiredInput(buddyGroup) : null;
    const sanitizedOccupation = regType !== "club_member" ? sanitizeInput(occupation) : null;
    const sanitizedComments = sanitizeInput(comments);

    if (regType === "club_member") {
      if (!sanitizedFullName) {
        toast.error("Please enter Full Name.");
        return;
      }
    } else {
      if (!sanitizedFullName) {
        toast.error("Please enter Full Name.");
        return;
      }
    }

    if (regType === "rotarian" && (!sanitizedClubName || !sanitizedDistrict)) {
      toast.error("Please enter Club Name and District.");
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
      toast.error(`You have already registered ${existingMakeupsCount} make-up(s) this month. You cannot exceed 2 make-ups per month (attempted to add ${filteredMakeups.length} more).`);
      return;
    }

    setSubmitting(true);
    try {
      const isRotaryMember = regType === "rotarian" || regType === "club_member";

      let finalMemberId = null;

      if (regType === "club_member") {
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
              email: sanitizedEmail,
              phone: sanitizedPhone,
              buddy_group: sanitizedBuddyGroup || null,
            });
            finalMemberId = newMember.id;
          }
        } catch (mErr) {
          console.error("Failed to auto-enroll member in directory:", mErr);
        }
      }

      await registerMutation.mutateAsync({
        event_id: eventId!,
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
        status: statusVal,
      });

      toast.success("Attendee registered & checked in successfully!");
      sessionStorage.removeItem(storageKey);
      // Reset form
      setFullName("");
      setEmail("");
      setPhone("");
      setRegType("guest");
      setClubName("");
      setDistrict("");
      setBuddyGroup("");
      setOccupation("");
      setComments("");
      setVisits([]);
      setMakeups([]);
      setStatusVal("checked-in");
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to register attendee.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Statistics calculations ──────────────────────────────────────────────
  const checkedInMembersCount = registrations?.filter(
    r => r.status === "checked-in" && r.is_member && ((r.buddy_group && r.buddy_group.trim() !== "") || r.member_id)
  ).length ?? 0;
  const totalRosterCount = members?.length ?? 0;
  const memberAttendancePct = totalRosterCount > 0 ? (checkedInMembersCount / totalRosterCount) * 100 : 0;

  // Visiting clubs headcount breakdown
  const visitingClubsMap: { [club: string]: number } = {};
  registrations?.forEach(r => {
    const role = !r.is_member
      ? "guest"
      : r.buddy_group && r.buddy_group.trim() !== ""
      ? "club member"
      : "rotarian";
    if (role === "rotarian" && r.club_name && r.club_name.trim() !== "") {
      const club = r.club_name.trim();
      visitingClubsMap[club] = (visitingClubsMap[club] || 0) + 1;
    }
  });
  const visitingClubsList = Object.entries(visitingClubsMap)
    .map(([club, count]) => ({ club, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <AdminLayout
      pageTitle={event.title}
      actions={
        <div className="flex items-center gap-2">
          {/* QR Scanner view toggle button removed */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all cursor-pointer"
            style={{ background: GOLD }}
          >
            <Plus size={14} /> Register Attendee
          </button>
          <button
            onClick={downloadAttendanceReport}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted bg-card transition-all cursor-pointer"
            title="Download Attendance Report (PDF/Print)"
          >
            <Printer size={14} /> Print Report
          </button>
        </div>
      }
    >
      <div className="mb-6">
        <button
          onClick={() => navigate("/admin/events")}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors mb-2"
        >
          <ChevronLeft size={14} /> Back to events
        </button>
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>Check-In & Registrations</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mt-1">
          <span>Event: <strong className="text-foreground">{event.title}</strong></span>
          {dynamicBuddyGroup && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#F7A81B]/10 border border-[#F7A81B]/20 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
              🌟 Buddy Group of the Day: {dynamicBuddyGroup.name} ({dynamicBuddyGroup.count} Present)
            </span>
          )}
        </div>
      </div>

      {/* Statistics and Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Club Attendance Rate Card */}
        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Club Attendance Rate</span>
            <h3 className="text-2xl font-black mt-1" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              {memberAttendancePct.toFixed(1)}%
            </h3>
          </div>
          <div className="text-[11px] text-muted-foreground flex flex-col gap-1">
            <p>
              <strong>{checkedInMembersCount}</strong> of <strong>{totalRosterCount}</strong> club members checked in today.
            </p>
            <p className="text-[10px] text-amber-700 font-semibold border-t border-border/40 pt-1 mt-1">
              Apologies: <strong>{registrations?.filter(r => r.status === "apology").length ?? 0}</strong> registered absent
            </p>
          </div>
        </div>

        {/* Visiting Clubs Card */}
        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col justify-between gap-3 md:col-span-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Visiting Clubs Headcount</span>
            <div className="flex flex-wrap gap-2 mt-2 max-h-16 overflow-y-auto pr-1">
              {visitingClubsList.length === 0 ? (
                <span className="text-xs text-muted-foreground italic py-1.5">No visiting Rotarians checked in yet.</span>
              ) : (
                visitingClubsList.map(({ club, count }, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#17458F]/5 text-[#17458F] text-[10px] font-bold rounded-lg border border-[#17458F]/10"
                  >
                    <span>{club}</span>
                    <span className="bg-[#17458F] text-white px-1.5 py-0.5 rounded-md text-[9px] font-black">{count}</span>
                  </span>
                ))
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground border-t border-border/30 pt-1.5">
            Total visiting Rotarians registered: <strong>{registrations?.filter(r => r.is_member && (!r.buddy_group || r.buddy_group.trim() === "") && r.club_name).length ?? 0}</strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">

        {/* Attendee list */}
        <div className="w-full flex flex-col gap-4">
          <PageCard>
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  placeholder="Search name, email, or ticket ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none"
                />
              </div>

            </div>

            {/* Table list */}
            {filteredRegs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No matching attendees found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Attendee</th>
                      <th className="hidden md:table-cell py-3 px-3 font-semibold text-muted-foreground">Email</th>
                      <th className="hidden sm:table-cell py-3 px-3 font-semibold text-muted-foreground">Role</th>
                      <th className="hidden md:table-cell py-3 px-3 font-semibold text-muted-foreground">Club</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Apology</th>
                      <th className="w-10 py-3 px-3 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegs.map((r) => {
                      const isExpanded = expandedAttendeeId === r.id;
                      return (
                        <Fragment key={r.id}>
                          <tr
                            onClick={() => setExpandedAttendeeId(isExpanded ? null : r.id)}
                            className={`border-b border-border/50 hover:bg-muted/10 cursor-pointer transition-colors ${
                              isExpanded ? "bg-muted/5" : ""
                            }`}
                          >
                            <td className="py-4 px-3">
                              <p className="font-bold text-foreground">{r.full_name}</p>
                              {(() => {
                                const role = !r.is_member
                                  ? "guest"
                                  : r.buddy_group && r.buddy_group.trim() !== ""
                                  ? "club member"
                                  : "rotarian";
                                const colorStyles =
                                  role === "guest"
                                    ? { backgroundColor: "#F1F5F9", color: "#475569" }
                                    : role === "rotarian"
                                    ? { backgroundColor: "#E0F2FE", color: "#0369A1" }
                                    : { backgroundColor: `${GOLD}15`, color: GOLD };
                                return (
                                  <span
                                    className="inline-block mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase md:hidden"
                                    style={colorStyles}
                                  >
                                    {role}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="hidden md:table-cell py-4 px-3 font-medium text-foreground">
                              {(() => {
                                const matched = members?.find((m) => m.id === r.member_id || m.full_name.toLowerCase().trim() === r.full_name.toLowerCase().trim());
                                const realEmail = matched?.email && !isSyntheticEmail(matched.email) ? matched.email : (!isSyntheticEmail(r.email) ? r.email : null);
                                if (!realEmail) return <span className="text-muted-foreground">—</span>;
                                return (
                                  <a
                                    href={`mailto:${realEmail}`}
                                    className="text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {realEmail}
                                  </a>
                                );
                              })()}
                            </td>
                            <td className="hidden sm:table-cell py-4 px-3">
                              {(() => {
                                const role = !r.is_member
                                  ? "guest"
                                  : !r.club_name
                                  ? "club member"
                                  : "rotarian";
                                const badgeClass =
                                  role === "guest"
                                    ? "bg-slate-100 text-slate-800"
                                    : role === "rotarian"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800";
                                return (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${badgeClass}`}
                                  >
                                    {role}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="hidden md:table-cell py-4 px-3 text-muted-foreground">
                              {r.is_member ? (r.club_name || "Home Club") : "Guest"}
                            </td>
                            <td className="py-4 px-3 text-xs font-bold">
                              {r.status === "apology" ? (
                                <span className="text-amber-700 font-extrabold">Yes</span>
                              ) : (
                                <span className="text-muted-foreground font-normal">—</span>
                              )}
                            </td>
                            <td className="py-4 px-3 text-center text-muted-foreground">
                              <div className="flex justify-center">
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Details Drawer */}
                          {isExpanded && (
                            <tr className="bg-muted/20">
                              <td colSpan={7} className="p-4">
                                <div className="bg-background rounded-2xl p-4 border border-border/60 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <p className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                                      Contact Details
                                    </p>
                                    <p className="text-foreground font-medium">{r.full_name}</p>
                                     {(() => {
                                       const matched = members?.find((m) => m.id === r.member_id || m.full_name.toLowerCase().trim() === r.full_name.toLowerCase().trim());
                                       const realEmail = matched?.email && !isSyntheticEmail(matched.email) ? matched.email : (!isSyntheticEmail(r.email) ? r.email : null);
                                       return realEmail ? (
                                         <p className="text-muted-foreground mt-0.5">{realEmail}</p>
                                       ) : null;
                                     })()}
                                    {r.phone && (
                                      <p className="text-muted-foreground mt-0.5">
                                        <a
                                          href={`tel:${r.phone}`}
                                          className="hover:underline text-[#17458F] font-medium"
                                        >
                                          {r.phone}
                                        </a>
                                      </p>
                                    )}
                                  </div>

                                  <div>
                                    <p className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                                      Rotary Affiliation
                                    </p>
                                    {r.is_member ? (
                                      !r.club_name ? (
                                        <div>
                                          <p className="text-foreground font-semibold">
                                            <span className="text-muted-foreground font-normal">Role:</span>{" "}
                                            Home Club Member
                                          </p>
                                          {r.buddy_group && (
                                            <p className="text-foreground mt-0.5">
                                              <span className="text-muted-foreground font-semibold">Buddy Group:</span>{" "}
                                              {r.buddy_group}
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <div>
                                          <p className="text-foreground">
                                            <span className="text-muted-foreground font-semibold">Club:</span>{" "}
                                            {r.club_name}
                                          </p>
                                          {r.district && (
                                            <p className="text-foreground mt-0.5">
                                              <span className="text-muted-foreground font-semibold">District:</span>{" "}
                                              {r.district}
                                            </p>
                                          )}
                                        </div>
                                      )
                                    ) : (
                                      <p className="text-muted-foreground italic mt-0.5">Guest (Non-Rotarian)</p>
                                    )}

                                    {r.club_name && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleConvertToHomeMember(r);
                                        }}
                                        className="mt-2 text-[10px] font-bold text-[#17458F] bg-[#17458F]/5 hover:bg-[#17458F]/15 px-2.5 py-1 rounded-lg border border-[#17458F]/20 cursor-pointer transition-all flex items-center gap-1"
                                      >
                                        ⇄ Change to Home Club Member
                                      </button>
                                    )}
                                  </div>

                                  <div>
                                    <p className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                                      Attendee Info
                                    </p>
                                    <p className="text-foreground">
                                      <span className="text-muted-foreground font-semibold">Ticket Code:</span>{" "}
                                      <span className="font-mono text-foreground font-semibold">{r.qr_ref}</span>
                                    </p>
                                    {r.occupation && (
                                      <p className="text-foreground mt-0.5">
                                        <span className="text-muted-foreground font-semibold">
                                          {!r.is_member ? "Profession" : "Classification"}:
                                        </span>{" "}
                                        {r.occupation}
                                      </p>
                                    )}
                                  </div>

                                  {r.comments && (
                                    <div className="sm:col-span-2 md:col-span-3 border-t border-border/40 pt-2.5">
                                      <p className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                                        Comments & Notes
                                      </p>
                                      <p className="text-muted-foreground italic bg-white p-2.5 rounded-xl border border-border/40">
                                        {r.comments}
                                      </p>
                                    </div>
                                  )}

                                  {((r.visits && r.visits.length > 0) || (r.makeups && r.makeups.length > 0)) && (
                                    <div className="sm:col-span-2 md:col-span-3 border-t border-border/40 pt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {r.visits && r.visits.length > 0 && (
                                        <div>
                                          <p className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                                            Visited Clubs
                                          </p>
                                          <ul className="list-disc list-inside text-xs text-foreground bg-white p-2.5 rounded-xl border border-border/40 flex flex-col gap-1">
                                            {r.visits.map((v: ClubActivity, idx: number) => (
                                              <li key={idx} className="font-semibold text-[#17458F]">
                                                {v.club_name} <span className="text-[10px] text-muted-foreground font-normal">({v.date})</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {r.makeups && r.makeups.length > 0 && (
                                        <div>
                                          <p className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                                            Make-ups Submitted
                                          </p>
                                          <ul className="list-disc list-inside text-xs text-foreground bg-white p-2.5 rounded-xl border border-border/40 flex flex-col gap-1">
                                            {r.makeups.map((m: ClubActivity, idx: number) => (
                                              <li key={idx} className="font-semibold text-amber-600">
                                                {m.club_name} <span className="text-[10px] text-muted-foreground font-normal">({m.date})</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Status display */}
                                  <div className="sm:col-span-2 md:col-span-3 border-t border-border/40 pt-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {r.status === "checked-in" ? (
                                        <span className="text-xs text-emerald-800 font-bold px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-1.5">
                                          Checked In ✓
                                        </span>
                                      ) : r.status === "apology" ? (
                                        <span className="text-xs text-amber-800 font-bold px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-1.5">
                                          Apology registered
                                        </span>
                                      ) : (
                                        <span className="text-xs text-slate-500 font-semibold px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                                          Registered
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PageCard>
        </div>
      </div>

      {/* Manual Registration Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                Register & Check In Attendee
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setVisits([]);
                  setMakeups([]);
                }}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleAddAttendee} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              <TextInput
                label="Full Name"
                placeholder="Enter attendee's full name"
                value={fullName}
                onChange={setFullName}
                required
              />

              <TextInput
                label="Email Address"
                type="email"
                placeholder="e.g. name@domain.com"
                value={email}
                onChange={setEmail}
              />

              <TextInput
                label="Phone Number"
                type="tel"
                placeholder="e.g. +256 700 000000"
                value={phone}
                onChange={setPhone}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase" style={{ fontFamily: "var(--font-sans)" }}>
                  Registration Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "club_member", label: "Home Club Member" },
                    { id: "rotarian", label: "Visiting Rotarian" },
                    { id: "guest", label: "Guest / Visitor" },
                  ].map((type) => {
                    const isSelected = regType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setRegType(type.id as any)}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                          isSelected
                            ? "border-[#17458F] bg-[#17458F]/5 text-[#17458F]"
                            : "border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {regType === "rotarian" && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-xl border border-border/40 animate-in fade-in slide-in-from-top-1">
                  <TextInput
                    label="Club Name"
                    placeholder="e.g. Rotary Club of Ntinda"
                    value={clubName}
                    onChange={setClubName}
                    required={regType === "rotarian"}
                  />
                  <TextInput
                    label="District"
                    placeholder="e.g. 9213"
                    value={district}
                    onChange={setDistrict}
                    required={regType === "rotarian"}
                  />
                </div>
              )}

              {regType === "club_member" && (
                <div className="p-3 bg-muted/20 rounded-xl border border-border/40 animate-in fade-in slide-in-from-top-1 flex flex-col gap-4">
                  <SelectInput
                  label="Buddy Group"
                    options={buddyGroupsList.map((g: string) => ({ value: g, label: g }))}
                    value={buddyGroup}
                    onChange={buddy => setBuddyGroup(buddy)}
                  />

                  <div className="flex flex-col gap-5 p-4 rounded-xl bg-card border border-border mt-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#A1A1AA]" style={{ fontFamily: "var(--font-sans)" }}>
                        Recent Club Activities
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Report any other club visits or make-ups completed this month.
                      </p>
                    </div>

                    {/* VISITS SECTION */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5" style={{ fontFamily: "var(--font-sans)" }}>
                          Other Clubs Visited <span className="text-[9px] bg-[#E2E8F0] text-slate-600 px-1.5 py-0.5 rounded font-normal dark:bg-zinc-800 dark:text-zinc-300">Unlimited</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setVisits([...visits, { club_name: "", date: new Date().toISOString().split("T")[0] }])}
                          className="text-[11px] font-bold text-[#17458F] hover:text-[#17458F]/80 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus size={12} /> Add Visit
                        </button>
                      </div>

                      {visits.map((visit, index) => (
                        <div key={index} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center animate-in fade-in zoom-in-95 duration-100">
                          <input
                            type="text"
                            placeholder="Club Name (e.g. Rotary Club of Kampala)"
                            value={visit.club_name}
                            onChange={(e) => {
                              const newVisits = [...visits];
                              newVisits[index] = { ...newVisits[index], club_name: e.target.value };
                              setVisits(newVisits);
                            }}
                            className="flex-1 px-3 py-2 rounded-xl border border-border bg-input-background text-foreground text-xs focus:outline-none focus:ring-1 transition-all font-semibold"
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
                            className="w-full sm:w-32 px-3 py-2 rounded-xl border border-border bg-input-background text-foreground text-xs focus:outline-none focus:ring-1 transition-all font-semibold"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setVisits(visits.filter((_, i) => i !== index))}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all cursor-pointer self-end sm:self-auto"
                            title="Remove visit"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* MAKE-UPS SECTION */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5" style={{ fontFamily: "var(--font-sans)" }}>
                            Make-ups Done <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30">Max 2 / Month</span>
                          </label>
                          <span className="text-[9px] text-muted-foreground mt-0.5">
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
                          className={`text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                            existingMakeupsCount + makeups.length >= 2
                              ? "text-muted-foreground cursor-not-allowed opacity-50"
                              : "text-[#17458F] hover:text-[#17458F]/80"
                          }`}
                        >
                          <Plus size={12} /> Add Make-up
                        </button>
                      </div>

                      {makeups.map((makeup, index) => (
                        <div key={index} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center animate-in fade-in zoom-in-95 duration-100">
                          <input
                            type="text"
                            placeholder="Club Name (e.g. Rotary Club of Ntinda)"
                            value={makeup.club_name}
                            onChange={(e) => {
                              const newMakeups = [...makeups];
                              newMakeups[index] = { ...newMakeups[index], club_name: e.target.value };
                              setMakeups(newMakeups);
                            }}
                            className="flex-1 px-3 py-2 rounded-xl border border-border bg-input-background text-foreground text-xs focus:outline-none focus:ring-1 transition-all font-semibold"
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
                            className="w-full sm:w-32 px-3 py-2 rounded-xl border border-border bg-input-background text-foreground text-xs focus:outline-none focus:ring-1 transition-all font-semibold"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setMakeups(makeups.filter((_, i) => i !== index))}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all cursor-pointer self-end sm:self-auto"
                            title="Remove makeup"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}

                      {existingMakeupsCount >= 2 && (
                        <div className="text-[10px] text-amber-600 bg-amber-50/50 dark:bg-amber-950/10 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 font-medium">
                          ✓ Already registered 2 make-ups for this month.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {regType !== "club_member" && (
                <TextInput
                  label={regType === "guest" ? "Profession (Optional)" : "Classification (Optional)"}
                  placeholder={regType === "guest" ? "e.g. Doctor, Manager" : "e.g. Consultant, Architect"}
                  value={occupation}
                  onChange={setOccupation}
                />
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase" style={{ fontFamily: "var(--font-sans)" }}>
                  Attendance Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "checked-in", label: "Checked In (Present)" },
                    { id: "apology", label: "Absent (With Apology)" },
                  ].map((opt) => {
                    const isSelected = statusVal === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStatusVal(opt.id as any)}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                          isSelected
                            ? opt.id === "checked-in"
                              ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                              : "border-amber-600 bg-amber-50 text-amber-800"
                            : "border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase" style={{ fontFamily: "var(--font-sans)" }}>
                  Comments / Notes (Optional)
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={2}
                  className="px-3 py-2 text-xs rounded-xl border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                <OutlineButton
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setVisits([]);
                    setMakeups([]);
                  }}
                  className="px-4 py-2 text-xs"
                >
                  Cancel
                </OutlineButton>
                <GoldButton
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold"
                >
                  {submitting ? "Registering..." : (statusVal === "apology" ? "Register Apology" : "Register & Check In")}
                </GoldButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
