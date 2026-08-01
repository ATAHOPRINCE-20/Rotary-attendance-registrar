import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import {
  useOrgMembers,
  useCreateMember,
  useUpdateMember,
  useDeleteMember,
  useBulkImportMembers,
} from "../../../hooks/useMembers";
import { PageCard, TextInput, SelectInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { AdminLayout } from "../shared/AdminLayout";
import { NAVY, GOLD, parseBuddyGroups } from "../../../lib/constants";
import {
  Users,
  Plus,
  Upload,
  Search,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Grid,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  X,
  Send,
  Loader2,
  Eye,
  CheckCircle,
  CheckSquare,
  Square,
  Award,
  Calendar,
  Building2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import type { Member } from "../../../types/database";
import { getFriendlyErrorMessage } from "../../../lib/errors";

export function MembersPage() {
  const { profile, organization } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries/Mutations
  const { data: members, isLoading } = useOrgMembers(organization?.id);
  const createMutation = useCreateMember();
  const updateMutation = useUpdateMember();
  const deleteMutation = useDeleteMember();
  const bulkImportMutation = useBulkImportMembers();

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [viewTab, setViewTab] = useState<"directory" | "makeups">("directory");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Compute members who logged make-ups for the selected month
  const membersWithMonthlyMakeups = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => {
      if (!m.makeups || !Array.isArray(m.makeups)) return false;
      return m.makeups.some((mk) => {
        if (!mk.date) return false;
        return mk.date.startsWith(selectedMonth);
      });
    });
  }, [members, selectedMonth]);

  // Table Row Selection
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Modals state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [bulkInviteModalOpen, setBulkInviteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Single member form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [buddyGroup, setBuddyGroup] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [memberFormError, setMemberFormError] = useState<string | null>(null);

  // CSV Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedCsvData, setParsedCsvData] = useState<any[]>([]);
  const [importingCsv, setImportingCsv] = useState(false);
  const [autoInviteOnImport, setAutoInviteOnImport] = useState(true);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Batch Invite state
  const [invitingBatch, setInvitingBatch] = useState(false);
  const [inviteTargetMode, setInviteTargetMode] = useState<"uninvited" | "all" | "selected">("uninvited");

  // Options for Buddy Groups from organization setting
  const buddyGroupsList = Array.from(new Set<string>(
    organization?.buddy_groups
      ? parseBuddyGroups(organization.buddy_groups)
      : ["Group A", "Group B", "Group C", "Group D"]
  ));

  // Filtered members list
  const filteredMembers = members?.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.full_name.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.phone && m.phone.toLowerCase().includes(q)) ||
      (m.buddy_group && m.buddy_group.toLowerCase().includes(q))
    );
  }) ?? [];

  // Active profiles list to confirm true logged-in member activation state
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchActiveProfiles() {
      if (!organization?.id) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("organization_id", organization.id);
        if (data) {
          setActiveUserIds(new Set(data.map((p) => p.id)));
        }
      } catch (e) {
        console.warn("Failed to fetch active profiles:", e);
      }
    }
    fetchActiveProfiles();
  }, [organization?.id, members]);

  // Helper to determine if a member has truly activated and logged in
  const isActivated = (m: Member) => Boolean(m.user_id && activeUserIds.has(m.user_id));

  // Eligible members with emails
  const membersWithEmail = members?.filter(m => m.email && m.email.trim().length > 0) ?? [];
  const uninvitedMembers = membersWithEmail.filter(m => !isActivated(m));

  // Toggle selection
  function toggleSelectAll() {
    const membersWithEmailIds = filteredMembers.filter(m => m.email && m.email.trim().length > 0).map(m => m.id);
    const allSelected = membersWithEmailIds.every(id => selectedMemberIds.includes(id));
    if (allSelected) {
      setSelectedMemberIds(prev => prev.filter(id => !membersWithEmailIds.includes(id)));
    } else {
      setSelectedMemberIds(Array.from(new Set([...selectedMemberIds, ...membersWithEmailIds])));
    }
  }

  function toggleSelectMember(memberId: string) {
    setSelectedMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  }

  // Open modal for single member creation
  function openAddModal() {
    setEditingMember(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setBuddyGroup("");
    setMemberFormError(null);
    setMemberModalOpen(true);
  }

  // Open modal for editing a member
  function openEditModal(member: Member) {
    setEditingMember(member);
    setFullName(member.full_name);
    setEmail(member.email || "");
    setPhone(member.phone || "");
    setBuddyGroup(member.buddy_group || "");
    setMemberFormError(null);
    setMemberModalOpen(true);
  }

  // Submit Single Member Add/Edit Form
  async function handleSaveMember(e: React.FormEvent) {
    e.preventDefault();
    setMemberFormError(null);

    if (!fullName.trim()) {
      setMemberFormError("Full Name is required.");
      return;
    }

    setSavingMember(true);
    try {
      const payload = {
        organization_id: organization?.id || "",
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        buddy_group: buddyGroup.trim() || null,
      };

      if (editingMember) {
        await updateMutation.mutateAsync({
          id: editingMember.id,
          ...payload,
        });
        toast.success("Member updated successfully!");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Member added to directory!");
      }
      setMemberModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setMemberFormError(getFriendlyErrorMessage(err));
    } finally {
      setSavingMember(false);
    }
  }

  // Delete Member Profile
  async function handleDeleteMember(memberId: string) {
    if (!window.confirm("Are you sure you want to delete this member? This action cannot be undone.")) return;

    try {
      await deleteMutation.mutateAsync({
        id: memberId,
        organizationId: organization?.id || "",
      });
      setSelectedMemberIds(prev => prev.filter(id => id !== memberId));
      toast.success("Member deleted from directory.");
    } catch (err: any) {
      console.error(err);
      toast.error(getFriendlyErrorMessage(err));
    }
  }

  // Helper to ensure fresh JWT token
  async function getFreshAccessToken() {
    let session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      const refreshRes = await supabase.auth.refreshSession();
      session = refreshRes.data.session;
    }
    return session?.access_token || null;
  }

  // Single Member Invite
  async function handleInviteMember(memberId: string) {
    try {
      const token = await getFreshAccessToken();
      if (!token) {
        toast.error("Authentication session expired. Please sign in again.");
        return;
      }

      toast.promise(
        (async () => {
          const response = await fetch("/api/member/invite-member", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ memberId, organizationId: organization?.id })
          });
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || "Failed to invite member");
          }
          return result;
        })(),
        {
          loading: "Sending invitation email...",
          success: "Invitation email sent successfully!",
          error: (err) => err.message
        }
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to trigger invitation.");
    }
  }

  // Batch Member Invites
  async function handleExecuteBatchInvite(options: { memberIds?: string[]; inviteAll?: boolean; uninvitedOnly?: boolean }) {
    try {
      const token = await getFreshAccessToken();
      if (!token) {
        toast.error("Authentication session expired. Please sign in again.");
        return;
      }

      setInvitingBatch(true);
      const response = await fetch("/api/member/invite-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ...options, organizationId: organization?.id })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to dispatch batch invitations");
      }

      if (result.successCount > 0) {
        toast.success(`Batch Invitations Complete! ${result.successCount} email(s) sent successfully.${result.failedCount > 0 ? ` (${result.failedCount} failed)` : ''}`);
      } else if (result.failedCount > 0) {
        toast.error(`Batch invitations failed for ${result.failedCount} member(s). Verify their email addresses.`);
      } else {
        toast.info(result.message || "No invitations sent.");
      }

      setSelectedMemberIds([]);
      setBulkInviteModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to dispatch batch invitations");
    } finally {
      setInvitingBatch(false);
    }
  }

  // Parse CSV File Client-side
  function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCsvError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setCsvError("Invalid file type. Please upload a standard CSV file.");
      setCsvFile(null);
      setParsedCsvData([]);
      return;
    }

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setCsvError("Empty file. Could not extract member records.");
        return;
      }

      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) {
          setCsvError("CSV must contain a header row and at least one member row.");
          return;
        }

        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/["']/g, ""));
        const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("full") || h.includes("member"));
        const emailIdx = headers.findIndex(h => h.includes("email") || h.includes("mail"));
        const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("tel") || h.includes("contact"));
        const buddyIdx = headers.findIndex(h => h.includes("buddy") || h.includes("table") || h.includes("group"));

        const nIdx = nameIdx !== -1 ? nameIdx : 0;
        const eIdx = emailIdx !== -1 ? emailIdx : 1;
        const pIdx = phoneIdx !== -1 ? phoneIdx : 2;
        const bIdx = buddyIdx !== -1 ? buddyIdx : 3;

        const parsedRows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          let cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(",");
          cols = cols.map(c => c.trim().replace(/^["']|["']$/g, ""));
          if (!cols[nIdx]) continue;

          parsedRows.push({
            full_name: cols[nIdx],
            email: cols[eIdx] || null,
            phone: cols[pIdx] || null,
            buddy_group: cols[bIdx] || null,
          });
        }

        if (parsedRows.length === 0) {
          setCsvError("No valid rows parsed. Ensure your CSV is not empty.");
        } else {
          setParsedCsvData(parsedRows);
        }
      } catch (err: any) {
        console.error(err);
        setCsvError("Failed to parse CSV format. Please make sure columns are separated by commas.");
      }
    };
    reader.readAsText(file);
  }

  // Trigger Bulk Import Mutation & optional auto-invite
  async function handleImportCsvSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedCsvData.length === 0 || !organization) return;

    setImportingCsv(true);
    setCsvError(null);

    try {
      const res = await bulkImportMutation.mutateAsync({
        organizationId: organization.id,
        members: parsedCsvData,
      });

      toast.success(`Successfully imported ${parsedCsvData.length} members!`);

      // Trigger automatic bulk email invitations if enabled
      if (autoInviteOnImport && res.data && res.data.length > 0) {
        const importedIdsWithEmail = res.data.filter(m => m.email && m.email.trim()).map(m => m.id);
        if (importedIdsWithEmail.length > 0) {
          toast.info(`Dispatching portal invitation emails to ${importedIdsWithEmail.length} imported member(s)...`);
          await handleExecuteBatchInvite({ memberIds: importedIdsWithEmail });
        }
      }

      setImportModalOpen(false);
      setCsvFile(null);
      setParsedCsvData([]);
    } catch (err: any) {
      console.error(err);
      setCsvError(getFriendlyErrorMessage(err));
    } finally {
      setImportingCsv(false);
    }
  }

  // Summary Metrics Calculations
  const totalCount = members?.length ?? 0;
  const buddyGroupDistribution = members?.reduce((acc: Record<string, number>, m) => {
    if (m.buddy_group) {
      acc[m.buddy_group] = (acc[m.buddy_group] || 0) + 1;
    }
    return acc;
  }, {}) ?? {};
  const activeBuddyGroupsCount = Object.keys(buddyGroupDistribution).length;

  const emailCoverage = totalCount > 0
    ? Math.round((members!.filter(m => m.email).length / totalCount) * 100)
    : 0;

  const allFilteredWithEmail = filteredMembers.filter(m => m.email && m.email.trim().length > 0);
  const isAllSelected = allFilteredWithEmail.length > 0 && allFilteredWithEmail.every(m => selectedMemberIds.includes(m.id));

  return (
    <AdminLayout
      pageTitle="Club Members"
      actions={
        <div className="flex items-center gap-2 shrink-0">
          {profile?.role !== "staff" && (
            <>
              <button
                onClick={() => {
                  setInviteTargetMode(selectedMemberIds.length > 0 ? "selected" : "uninvited");
                  setBulkInviteModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#17458F] bg-[#17458F]/10 hover:bg-[#17458F]/20 border border-[#17458F]/20 transition-all cursor-pointer"
                title="Bulk Invite Members"
              >
                <Send size={13} />
                <span className="hidden sm:inline">Bulk Invite</span>
              </button>
              <button
                onClick={() => setImportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#F4F6FB] border border-border hover:bg-muted text-foreground transition-all cursor-pointer"
                title="Import CSV Roster"
              >
                <Upload size={13} />
                <span className="hidden sm:inline">Import CSV</span>
              </button>
              <button
                onClick={openAddModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all cursor-pointer shadow-sm shrink-0"
                style={{ background: NAVY }}
                title="Add New Member"
              >
                <Plus size={13} />
                <span className="inline">New Member</span>
              </button>
            </>
          )}
        </div>
      }
    >
      {/* ── HEADER ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
          Club Members
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your club member database, assign buddy groups, and invite all members to their portal in bulk.
        </p>
      </div>

      {/* ── METRIC STAT CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: `${NAVY}18`, color: NAVY }}
          >
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Total Members</p>
            <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>{totalCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${GOLD}18`, color: GOLD }}
          >
            <Grid size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Active Buddy Groups</p>
            <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>{activeBuddyGroupsCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-50 shrink-0"
          >
            <Mail size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Email Coverage</p>
            <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>{emailCoverage}%</p>
          </div>
        </div>

        <div 
          onClick={() => setViewTab("makeups")}
          className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4 cursor-pointer hover:border-[#17458F]/40 transition-all"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-amber-600 bg-amber-50 shrink-0">
            <Award size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Make-ups ({selectedMonth})</p>
            <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>{membersWithMonthlyMakeups.length} <span className="text-xs text-muted-foreground font-normal">members</span></p>
          </div>
        </div>
      </div>

      {/* ── TAB SWITCHER BUTTONS ── */}
      <div className="flex items-center gap-2 mb-4 border-b border-border/40 pb-2">
        <button
          onClick={() => setViewTab("directory")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            viewTab === "directory"
              ? "bg-[#17458F] text-white shadow-sm"
              : "bg-white text-muted-foreground hover:bg-slate-100 border border-border/40"
          }`}
        >
          <Users size={14} /> Member Directory
        </button>

        <button
          onClick={() => setViewTab("makeups")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            viewTab === "makeups"
              ? "bg-[#17458F] text-white shadow-sm"
              : "bg-white text-muted-foreground hover:bg-slate-100 border border-border/40"
          }`}
        >
          <Award size={14} /> Monthly Make-Ups Audit
          {membersWithMonthlyMakeups.length > 0 && (
            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
              viewTab === "makeups" ? "bg-amber-400 text-slate-900" : "bg-amber-100 text-amber-800"
            }`}>
              {membersWithMonthlyMakeups.length}
            </span>
          )}
        </button>
      </div>

      {/* ── MAIN CONTENT (DIRECTORY vs MAKEUPS AUDIT) ── */}
      {viewTab === "makeups" ? (
        <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden relative animate-in fade-in duration-200">
          {/* Header & Month Filter */}
          <div className="px-5 py-4 border-b border-border/40 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-muted/10">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-amber-500" />
              <div>
                <h3 className="text-sm font-bold" style={{ color: NAVY }}>Monthly Make-Ups & Club Visits Audit</h3>
                <p className="text-[11px] text-muted-foreground">Showing member make-up submissions for {selectedMonth}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-border/60 shadow-sm">
                <Calendar size={14} className="text-muted-foreground" />
                <span className="text-xs font-bold text-slate-500">Filter Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs font-bold text-foreground bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              <button
                onClick={() => {
                  const csvRows = [["Member Name", "Email", "Phone", "Buddy Group", "Visited Club (Make-Up)", "Date Completed"]];
                  membersWithMonthlyMakeups.forEach((m) => {
                    m.makeups?.forEach((mk) => {
                      if (mk.date && mk.date.startsWith(selectedMonth)) {
                        csvRows.push([
                          `"${m.full_name}"`,
                          `"${m.email || ""}"`,
                          `"${m.phone || ""}"`,
                          `"${m.buddy_group || ""}"`,
                          `"${mk.club_name}"`,
                          `"${mk.date}"`
                        ]);
                      }
                    });
                  });
                  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `Makeups_Report_${selectedMonth}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`Exported make-ups report for ${selectedMonth}`);
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-[#17458F]/10 text-[#17458F] border border-[#17458F]/20 hover:bg-[#17458F]/20 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto">
            {membersWithMonthlyMakeups.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Award className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold text-foreground">No Make-ups Logged for {selectedMonth}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Members can log their make-ups from their member portal dashboard, or select a different month.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-slate-50/50">
                    <th className="px-5 py-3">Member Name</th>
                    <th className="px-5 py-3">Buddy Group</th>
                    <th className="px-5 py-3">Visited Club (Make-Up)</th>
                    <th className="px-5 py-3">Date Completed</th>
                    <th className="px-5 py-3 text-right">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 text-xs font-medium">
                  {membersWithMonthlyMakeups.flatMap((m) =>
                    (m.makeups || [])
                      .filter((mk) => mk.date && mk.date.startsWith(selectedMonth))
                      .map((mk, idx) => (
                        <tr key={`${m.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-foreground">{m.full_name}</div>
                            <div className="text-[10px] text-muted-foreground">{m.email || m.phone || "No contact info"}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            {m.buddy_group ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#17458F] border border-[#17458F]/20 whitespace-nowrap bg-[#17458F]/10">
                                {m.buddy_group}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <Building2 size={13} className="text-amber-500 shrink-0" />
                              {mk.club_name}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-slate-600">{mk.date}</div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={11} /> Verified Logged
                            </span>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* ── MAIN ROSTER BOX ── */
        <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden relative animate-in fade-in duration-200">
          {/* Search Bar Row */}
          <div className="px-5 py-4 border-b border-border/40 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-muted/10">
            <div className="flex items-center gap-2">
              <Users size={15} style={{ color: NAVY }} />
              <h3 className="text-sm font-bold" style={{ color: NAVY }}>Member Directory</h3>
              {uninvitedMembers.length > 0 && (
                <span className="ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                  {uninvitedMembers.length} pending activation
                </span>
              )}
            </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
            <input
              type="text"
              placeholder="Search directory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 text-foreground transition-all"
            />
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingScreen variant="light" fullScreen={false} />
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-foreground">No members found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchQuery ? "Try altering your search filters." : "Start building your roster by adding members or importing CSV."}
              </p>
              {!searchQuery && (
                <div className="mt-4 flex justify-center gap-2">
                  <OutlineButton onClick={() => setImportModalOpen(true)}>Import Roster</OutlineButton>
                  <GoldButton onClick={openAddModal}>Add Individual Member</GoldButton>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <table className="hidden sm:table w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    {profile?.role !== "staff" && (
                      <th className="px-4 py-4 w-10 text-center">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Select all with emails"
                        >
                          {isAllSelected ? <CheckSquare size={15} className="text-[#17458F]" /> : <Square size={15} />}
                        </button>
                      </th>
                    )}
                    <th className="px-6 py-4">Full Name</th>
                    <th className="px-6 py-4">Contact Info</th>
                    <th className="px-6 py-4">Buddy Group</th>
                    <th className="px-6 py-4">Portal Status</th>
                    {profile?.role !== "staff" && <th className="px-6 py-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredMembers.map((m) => {
                    const isSelected = selectedMemberIds.includes(m.id);
                    const hasEmail = Boolean(m.email && m.email.trim());

                    return (
                      <tr key={m.id} className={`hover:bg-muted/10 transition-colors ${isSelected ? "bg-[#17458F]/5" : ""}`}>
                        {profile?.role !== "staff" && (
                          <td className="px-4 py-4 text-center">
                            {hasEmail ? (
                              <button
                                type="button"
                                onClick={() => toggleSelectMember(m.id)}
                                className="p-1 rounded cursor-pointer text-muted-foreground hover:text-foreground"
                              >
                                {isSelected ? (
                                  <CheckSquare size={15} className="text-[#17458F]" />
                                ) : (
                                  <Square size={15} />
                                )}
                              </button>
                            ) : (
                              <span className="text-muted-foreground/30 text-[10px]" title="No email to select">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0"
                              style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
                            >
                              {m.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{m.full_name}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Member ID: {m.id.substring(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {m.email ? (
                              <span className="flex items-center gap-1.5 text-foreground">
                                <Mail size={11} className="text-muted-foreground" />
                                {m.email}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">No email</span>
                            )}
                            {m.phone ? (
                              <span className="flex items-center gap-1.5 text-foreground">
                                <Phone size={11} className="text-muted-foreground" />
                                {m.phone}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">No phone</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {m.buddy_group ? (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#17458F] border border-[#17458F]/20 whitespace-nowrap"
                              style={{ backgroundColor: `${NAVY}08` }}
                            >
                              {m.buddy_group}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 italic">None assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isActivated(m) ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200" title="Member has activated their account and logged in">
                              <CheckCircle2 size={11} /> Logged In & Active
                            </span>
                          ) : m.email ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200" title="Invitation link dispatched — awaiting member password setup">
                              <Mail size={11} /> Pending Activation
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50 italic">No email address</span>
                          )}
                        </td>
                        {profile?.role !== "staff" && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              {m.email && (
                                <button
                                  onClick={() => handleInviteMember(m.id)}
                                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                                    isActivated(m)
                                      ? "text-emerald-600 hover:bg-emerald-50/50"
                                      : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                  }`}
                                  title={isActivated(m) ? "Resend Portal Invitation" : "Send Portal Invitation Email"}
                                >
                                  <Mail size={13} />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  sessionStorage.setItem("impersonated_member_id", m.id);

                                  let targetPath = "/member/dashboard";
                                  if (m.user_id) {
                                    try {
                                      const { data: linkedProfile } = await supabase
                                        .from("profiles")
                                        .select("role")
                                        .eq("id", m.user_id)
                                        .maybeSingle();
                                      if (linkedProfile?.role === "treasurer") {
                                        targetPath = "/treasurer/dashboard";
                                      } else if (linkedProfile?.role === "admin" || linkedProfile?.role === "super_admin" || linkedProfile?.role === "staff") {
                                        targetPath = "/admin/dashboard";
                                      }
                                    } catch {
                                      // Fall back to default member dashboard
                                    }
                                  }

                                  toast.success(`Now impersonating ${m.full_name}. Opening Portal...`);
                                  navigate(targetPath);
                                }}
                                className="p-2 rounded-xl text-purple-600 hover:bg-purple-50 transition-all cursor-pointer"
                                title={`Impersonate ${m.full_name}'s Portal`}
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => openEditModal(m)}
                                className="p-2 rounded-xl text-muted-foreground hover:bg-[#17458F]/10 hover:text-[#17458F] transition-all cursor-pointer"
                                title="Edit member"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteMember(m.id)}
                                className="p-2 rounded-xl text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer"
                                title="Delete member"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile Card List View */}
              <div className="sm:hidden divide-y divide-border/30">
                {filteredMembers.map((m) => {
                  const isSelected = selectedMemberIds.includes(m.id);
                  const hasEmail = Boolean(m.email && m.email.trim());

                  return (
                    <div key={m.id} className={`p-4 flex flex-col gap-3 hover:bg-muted/5 transition-colors ${isSelected ? "bg-[#17458F]/5" : ""}`}>
                      {/* Header: Select Checkbox, Avatar, Name & Actions */}
                      <div className="flex items-start justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                          {profile?.role !== "staff" && hasEmail && (
                            <button
                              type="button"
                              onClick={() => toggleSelectMember(m.id)}
                              className="p-1 rounded cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} className="text-[#17458F]" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          )}
                          <div
                            className="w-9 h-9 rounded-full text-white text-[12px] font-black flex items-center justify-center shrink-0"
                            style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
                          >
                            {m.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-foreground text-sm leading-tight truncate">{m.full_name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">ID: {m.id.substring(0, 8)}</p>
                          </div>
                        </div>
                        
                        {profile?.role !== "staff" && (
                          <div className="flex items-center gap-0.5">
                            {m.email && (
                              <button
                                onClick={() => handleInviteMember(m.id)}
                                className={`p-2 rounded-xl transition-all cursor-pointer ${
                                  m.user_id
                                    ? "text-emerald-600 hover:bg-emerald-50/50"
                                    : "text-muted-foreground hover:bg-[#17458F]/10 hover:text-[#17458F]"
                                }`}
                                title={m.user_id ? "Resend Portal Invitation" : "Invite member to portal"}
                              >
                                <Mail size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(m)}
                              className="p-2 rounded-xl text-muted-foreground hover:bg-[#17458F]/10 hover:text-[#17458F] transition-all cursor-pointer"
                              title="Edit member"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteMember(m.id)}
                              className="p-2 rounded-xl text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer"
                              title="Delete member"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Middle: Details (Buddy group & contacts) */}
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Buddy Group</p>
                          <div className="mt-1">
                            {m.buddy_group ? (
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#17458F] border border-[#17458F]/20 whitespace-nowrap"
                                style={{ backgroundColor: `${NAVY}08` }}
                              >
                                {m.buddy_group}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/50 italic">None assigned</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 min-w-0">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Contact Info</p>
                          {m.email ? (
                            <span className="flex items-center gap-1.5 text-[11px] text-foreground min-w-0" title={m.email}>
                              <Mail size={11} className="text-muted-foreground shrink-0" />
                              <span className="truncate">{m.email}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60 italic">No email</span>
                          )}
                          {m.phone ? (
                            <span className="flex items-center gap-1.5 text-[11px] text-foreground min-w-0">
                              <Phone size={11} className="text-muted-foreground shrink-0" />
                              <span className="truncate">{m.phone}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60 italic">No phone</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    )}

      {/* ── FLOATING BATCH ACTION TOOLBAR ── */}
      {selectedMemberIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0B2265] text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200">
          <span className="text-xs font-bold flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-black text-[11px] flex items-center justify-center">
              {selectedMemberIds.length}
            </span>
            Members Selected
          </span>

          <div className="h-4 w-px bg-white/20" />

          <button
            onClick={() => {
              setInviteTargetMode("selected");
              setBulkInviteModalOpen(true);
            }}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Send size={13} /> Invite Selected ({selectedMemberIds.length})
          </button>

          <button
            onClick={() => setSelectedMemberIds([])}
            className="text-xs text-white/70 hover:text-white underline cursor-pointer ml-1 font-medium"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT MEMBER ── */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-base font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                {editingMember ? "Modify Member Profile" : "Enroll New Member"}
              </h2>
              <button
                onClick={() => setMemberModalOpen(false)}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveMember} className="px-6 py-5 flex flex-col gap-4">
              <TextInput
                label="Full Name"
                placeholder="e.g. Rtn. Brenda Nabirye"
                value={fullName}
                onChange={setFullName}
                required
              />
              <TextInput
                label="Email Address (Optional)"
                type="email"
                placeholder="e.g. brenda@example.com"
                value={email}
                onChange={setEmail}
              />
              <TextInput
                label="Phone Number (Optional)"
                type="tel"
                placeholder="e.g. +256 772 000000"
                value={phone}
                onChange={setPhone}
              />
              <SelectInput
                label="Buddy Group"
                options={buddyGroupsList.map(g => ({ value: g, label: g }))}
                value={buddyGroup}
                onChange={setBuddyGroup}
              />
              <div className="flex flex-col gap-1 -mt-2">
                <input
                  type="text"
                  placeholder="Or type a custom buddy group name..."
                  value={buddyGroup}
                  onChange={(e) => setBuddyGroup(e.target.value)}
                  className="px-4 py-2.5 text-xs rounded-xl border border-border bg-input-background text-foreground focus:outline-none"
                />
              </div>

              {memberFormError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs bg-destructive/10 text-destructive">
                  <AlertCircle size={14} />
                  <span className="font-semibold">{memberFormError}</span>
                </div>
              )}

              <div className="flex gap-4 border-t border-border pt-4 mt-2">
                <OutlineButton type="button" onClick={() => setMemberModalOpen(false)} className="flex-1 justify-center">
                  Cancel
                </OutlineButton>
                <GoldButton type="submit" disabled={savingMember} className="flex-1 justify-center">
                  {savingMember ? "Saving..." : editingMember ? "Save Changes" : "Create Profile"}
                </GoldButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK INVITATION OPTIONS ── */}
      {bulkInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-base font-black flex items-center gap-2" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                <Send size={16} className="text-amber-500" />
                Bulk Member Invitations
              </h2>
              <button
                onClick={() => setBulkInviteModalOpen(false)}
                disabled={invitingBatch}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Send email invitations to your members so they can activate their portal account, set up their credentials, and view their attendance records.
              </p>

              {/* Roster Overview Pill Box */}
              <div className="grid grid-cols-3 gap-2 bg-muted/20 p-3 rounded-xl border border-border text-center text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Total Roster</p>
                  <p className="text-sm font-black text-foreground">{totalCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">With Email</p>
                  <p className="text-sm font-black text-emerald-600">{membersWithEmail.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Uninvited</p>
                  <p className="text-sm font-black text-amber-600">{uninvitedMembers.length}</p>
                </div>
              </div>

              {/* Invitation Target Options */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-bold text-foreground">Select Invitation Target:</label>

                {/* Option 1: Uninvited Only */}
                <label
                  onClick={() => setInviteTargetMode("uninvited")}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    inviteTargetMode === "uninvited"
                      ? "border-[#17458F] bg-[#17458F]/5 text-foreground font-semibold"
                      : "border-border hover:bg-muted/10 text-muted-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="inviteMode"
                    checked={inviteTargetMode === "uninvited"}
                    onChange={() => setInviteTargetMode("uninvited")}
                    className="mt-0.5 text-[#17458F]"
                  />
                  <div>
                    <p className="text-xs font-bold text-foreground">Invite Uninvited Members Only ({uninvitedMembers.length})</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Sends invitation email only to members with an email address who have not yet activated their portal.
                    </p>
                  </div>
                </label>

                {/* Option 2: Selected Members */}
                {selectedMemberIds.length > 0 && (
                  <label
                    onClick={() => setInviteTargetMode("selected")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      inviteTargetMode === "selected"
                        ? "border-[#17458F] bg-[#17458F]/5 text-foreground font-semibold"
                        : "border-border hover:bg-muted/10 text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="inviteMode"
                      checked={inviteTargetMode === "selected"}
                      onChange={() => setInviteTargetMode("selected")}
                      className="mt-0.5 text-[#17458F]"
                    />
                    <div>
                      <p className="text-xs font-bold text-foreground">Invite Selected Members Only ({selectedMemberIds.length})</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Target only the specific members selected in the table checkboxes.
                      </p>
                    </div>
                  </label>
                )}

                {/* Option 3: All Members with Email */}
                <label
                  onClick={() => setInviteTargetMode("all")}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    inviteTargetMode === "all"
                      ? "border-[#17458F] bg-[#17458F]/5 text-foreground font-semibold"
                      : "border-border hover:bg-muted/10 text-muted-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="inviteMode"
                    checked={inviteTargetMode === "all"}
                    onChange={() => setInviteTargetMode("all")}
                    className="mt-0.5 text-[#17458F]"
                  />
                  <div>
                    <p className="text-xs font-bold text-foreground">Invite All Members with Emails ({membersWithEmail.length})</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Sends or resends invitations to every member with a valid email address.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 border-t border-border pt-4 mt-2">
                <OutlineButton
                  type="button"
                  onClick={() => setBulkInviteModalOpen(false)}
                  disabled={invitingBatch}
                  className="flex-1 justify-center"
                >
                  Cancel
                </OutlineButton>
                <GoldButton
                  type="button"
                  disabled={invitingBatch || (inviteTargetMode === "uninvited" && uninvitedMembers.length === 0) || (inviteTargetMode === "selected" && selectedMemberIds.length === 0) || (inviteTargetMode === "all" && membersWithEmail.length === 0)}
                  onClick={() => {
                    if (inviteTargetMode === "selected") {
                      handleExecuteBatchInvite({ memberIds: selectedMemberIds });
                    } else if (inviteTargetMode === "uninvited") {
                      handleExecuteBatchInvite({ inviteAll: true, uninvitedOnly: true });
                    } else {
                      handleExecuteBatchInvite({ inviteAll: true, uninvitedOnly: false });
                    }
                  }}
                  className="flex-1 justify-center py-2.5 text-slate-900 font-bold"
                >
                  {invitingBatch ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" /> Dispatching Emails...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Send size={14} /> Send Invitations
                    </span>
                  )}
                </GoldButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK CSV IMPORT ── */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-base font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                Import Roster via CSV
              </h2>
              <button
                onClick={() => {
                  setImportModalOpen(false);
                  setCsvFile(null);
                  setParsedCsvData([]);
                  setCsvError(null);
                }}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleImportCsvSubmit} className="px-6 py-5 flex flex-col gap-4">
              {parsedCsvData.length === 0 ? (
                // Drag-and-drop zone
                <div className="flex flex-col gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:bg-muted/15 cursor-pointer transition-all flex flex-col items-center gap-3"
                  >
                    <FileSpreadsheet className="w-10 h-10" style={{ color: GOLD }} />
                    <div>
                      <p className="text-xs font-bold text-foreground">Click to select CSV File</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Accepts standard `.csv` file format</p>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleCsvFileChange}
                      accept=".csv"
                      className="hidden"
                    />
                  </div>

                  {/* Format specifications info box */}
                  <div className="bg-muted/20 border border-border rounded-xl p-4 text-[11px] leading-relaxed">
                    <p className="font-bold text-foreground mb-1.5 flex items-center gap-1">
                      <AlertCircle size={12} className="text-muted-foreground" />
                      Required CSV Header Format:
                    </p>
                    <code className="block bg-card px-2.5 py-1.5 border border-border rounded-lg text-muted-foreground font-mono select-all">
                      full_name, email, phone, buddy_group
                    </code>
                    <p className="text-muted-foreground mt-2">
                      Make sure that `full_name` contains names (e.g. John Doe). The remaining fields are optional.
                    </p>
                  </div>
                </div>
              ) : (
                // Preview parsed data before bulk insert
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-border">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      Parsed {parsedCsvData.length} records successfully.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCsvFile(null);
                        setParsedCsvData([]);
                      }}
                      className="text-amber-500 font-bold hover:underline text-[10px]"
                    >
                      Clear File
                    </button>
                  </div>

                  {/* Preview scroll list */}
                  <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border text-[10px]">
                    {parsedCsvData.map((row, idx) => (
                      <div key={idx} className="flex justify-between items-center px-4 py-2 hover:bg-muted/10">
                        <div className="font-bold text-foreground">{row.full_name}</div>
                        <div className="text-muted-foreground text-right flex gap-3">
                          {row.buddy_group && (
                            <span className="text-[10px] bg-[#17458F]/10 text-[#17458F] px-2 py-0.5 rounded-full font-bold whitespace-nowrap inline-flex items-center">
                              {row.buddy_group}
                            </span>
                          )}
                          <span className="truncate max-w-[120px]">{row.email || "No email"}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Auto-invite Checkbox Option */}
                  <label className="flex items-center gap-2.5 p-3 bg-muted/20 border border-border rounded-xl cursor-pointer hover:bg-muted/30 transition-all mt-1">
                    <input
                      type="checkbox"
                      checked={autoInviteOnImport}
                      onChange={(e) => setAutoInviteOnImport(e.target.checked)}
                      className="rounded text-[#17458F] focus:ring-[#17458F]/20"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Send size={12} className="text-[#17458F]" />
                        Automatically send email invitations after import
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Dispatches portal setup email links to all imported members with valid emails immediately.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {csvError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs bg-destructive/10 text-destructive">
                  <AlertCircle size={14} />
                  <span className="font-semibold">{csvError}</span>
                </div>
              )}

              <div className="flex gap-4 border-t border-border pt-4 mt-2">
                <OutlineButton
                  type="button"
                  onClick={() => {
                    setImportModalOpen(false);
                    setCsvFile(null);
                    setParsedCsvData([]);
                    setCsvError(null);
                  }}
                  className="flex-1 justify-center"
                >
                  Cancel
                </OutlineButton>
                <GoldButton
                  type="submit"
                  disabled={parsedCsvData.length === 0 || importingCsv}
                  className="flex-1 justify-center"
                >
                  {importingCsv ? "Importing..." : `Import ${parsedCsvData.length || ""} Roster`}
                </GoldButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default MembersPage;
