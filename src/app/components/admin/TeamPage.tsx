import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../shared/AdminLayout";
import { PageCard, SelectInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NAVY, GOLD, isSyntheticEmail } from "../../../lib/constants";
import {
  Users,
  Plus,
  Copy,
  Check,
  ShieldCheck,
  UserX,
  X,
  UserCheck,
  Wallet,
  Mail,
  Loader2,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import type { Profile } from "../../../types/database";

export function TeamPage() {
  const { profile: currentProfile, organization } = useAuth();
  const queryClient = useQueryClient();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<"admin" | "treasurer" | "staff" | "member">("staff");
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMemberDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Query: Fetch club members for invitation lookup
  const { data: members } = useQuery({
    queryKey: ["org-members-list", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, email, phone, buddy_group")
        .eq("organization_id", organization!.id)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Query: Fetch all team members (profiles) in the organization
  const { data: team, isLoading } = useQuery<Profile[]>({
    queryKey: ["org-profiles", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Mutation: Update a user's role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "admin" | "treasurer" | "staff" | "member" }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-profiles", organization?.id] });
      toast.success("User role updated successfully.");
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.message || "Failed to update role.");
    },
  });

  // Mutation: Remove a user from the organization
  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-profiles", organization?.id] });
      toast.success("User removed from organization.");
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.message || "Failed to remove user.");
    },
  });

  const inviteLink = `${window.location.origin}/signup?orgId=${organization?.id || ""}&role=${inviteRole}`;

  const totalMembers = team?.length ?? 0;
  const adminCount = team?.filter((t) => t.role === "admin" || t.role === "super_admin").length ?? 0;
  const treasurerCount = team?.filter((t) => t.role === "treasurer").length ?? 0;
  const staffCount = team?.filter((t) => t.role === "staff").length ?? 0;

  function handleCopyInviteLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopiedInviteLink(true);
    toast.success("Invitation link copied to clipboard!");
    setTimeout(() => setCopiedInviteLink(false), 2000);
  }

  async function handleSendInviteEmail(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSendingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          inviteUrl: inviteLink
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to send invitation email");
      }

      toast.success(`Invitation email sent to ${inviteEmail}!`);
      setInviteEmail("");
      setInviteModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to send invitation email.");
    } finally {
      setSendingEmail(false);
    }
  }

  function handleToggleRole(userId: string, currentRole: string) {
    if (userId === currentProfile?.id) {
      toast.error("You cannot change your own role.");
      return;
    }
    // Cycle: staff → member → treasurer → admin → staff
    const cycle: Record<string, "admin" | "treasurer" | "staff" | "member"> = {
      staff: "member",
      member: "treasurer",
      treasurer: "admin",
      admin: "staff",
    };
    const newRole = cycle[currentRole] ?? "staff";
    updateRoleMutation.mutate({ userId, newRole });
  }

  function handleRemoveUser(userId: string, name: string) {
    if (userId === currentProfile?.id) {
      toast.error("You cannot remove yourself from the organization.");
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to revoke access for ${name}? They will be immediately signed out and locked out of this organization.`
      )
    ) {
      removeUserMutation.mutate(userId);
    }
  }

  if (isLoading) {
    return <LoadingScreen variant="light" />;
  }

  return (
    <AdminLayout
      pageTitle="Team Management"
      actions={
        <button
          onClick={() => setInviteModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all cursor-pointer shadow-sm"
          style={{ background: NAVY }}
        >
          <Plus size={14} /> Invite Member
        </button>
      }
    >
      {/* Page Heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
          Team Management
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Control access, assign roles, and invite co-workers to manage events and registers.
        </p>
      </div>

      {/* ── METRICS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${NAVY}18`, color: NAVY }}
          >
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Team Size</p>
            <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>
              {totalMembers}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "#E6F4EA", color: "#137333" }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Admins</p>
            <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>
              {adminCount}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "#E0F2FE", color: "#0369A1" }}
          >
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Treasurers</p>
            <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>
              {treasurerCount}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "#FEF7E0", color: "#B06000" }}
          >
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Staff Members</p>
            <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>
              {staffCount}
            </p>
          </div>
        </div>
      </div>

      {/* ── TEAM LIST ── */}
      <PageCard className="overflow-hidden">
        {totalMembers === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold" style={{ color: NAVY }}>
              No Team Members
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Get started by inviting other club officers or committee chairs to your portal.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {team?.map((m) => {
                    const isSelf = m.id === currentProfile?.id;
                    const initials = m.full_name
                      ?.split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "TM";

                    return (
                      <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0"
                              style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
                            >
                              {initials}
                            </div>
                            <div>
                              <p className="font-bold text-foreground flex items-center gap-2">
                                {m.full_name}
                                {isSelf && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-slate-100 border text-slate-600 font-semibold uppercase">
                                    You
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                ID: {m.id.substring(0, 8)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              m.role === "admin" || m.role === "super_admin"
                                ? "bg-emerald-100 text-emerald-800"
                                : m.role === "treasurer"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {m.role === "admin" || m.role === "super_admin" ? (
                              <><ShieldCheck size={11} /> Admin</>
                            ) : m.role === "treasurer" ? (
                              <><Wallet size={11} /> Treasurer</>
                            ) : (
                              <><UserCheck size={11} /> Staff</>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <OutlineButton
                              onClick={() => handleToggleRole(m.id, m.role)}
                              disabled={isSelf || m.role === "super_admin" || updateRoleMutation.isPending}
                              className="py-1.5 px-3 text-[10px] font-bold"
                            >
                              Change Role
                            </OutlineButton>
                            <OutlineButton
                              onClick={() => handleRemoveUser(m.id, m.full_name || "Staff")}
                              disabled={isSelf || m.role === "super_admin" || removeUserMutation.isPending}
                              className="py-1.5 px-3 text-[10px] font-bold text-destructive hover:bg-destructive/10 border-destructive/20"
                            >
                              <UserX size={12} /> Remove
                            </OutlineButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="sm:hidden divide-y divide-border/30">
              {team?.map((m) => {
                const isSelf = m.id === currentProfile?.id;
                const initials = m.full_name
                  ?.split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "TM";

                return (
                  <div key={m.id} className="p-4 flex flex-col gap-3 hover:bg-muted/5 transition-colors">
                    {/* Header: Avatar, Name & Role Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full text-white text-[12px] font-black flex items-center justify-center shrink-0"
                          style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
                        >
                          {initials}
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-sm leading-tight flex items-center gap-2 flex-wrap">
                            {m.full_name}
                            {isSelf && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] bg-slate-100 border text-slate-600 font-semibold uppercase">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                            ID: {m.id.substring(0, 8)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider shrink-0 ${
                          m.role === "admin" || m.role === "super_admin"
                            ? "bg-emerald-100 text-emerald-800"
                            : m.role === "treasurer"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {m.role === "admin" || m.role === "super_admin" ? (
                          <><ShieldCheck size={9} /> Admin</>
                        ) : m.role === "treasurer" ? (
                          <><Wallet size={9} /> Treasurer</>
                        ) : (
                          <><UserCheck size={9} /> Staff</>
                        )}
                      </span>
                    </div>

                    {/* Footer / Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" /> Active
                      </span>
                      
                      <div className="flex gap-2">
                        <OutlineButton
                          onClick={() => handleToggleRole(m.id, m.role)}
                          disabled={isSelf || m.role === "super_admin" || updateRoleMutation.isPending}
                          className="py-1 px-2.5 text-[9px] font-bold"
                        >
                          Change Role
                        </OutlineButton>
                        <OutlineButton
                          onClick={() => handleRemoveUser(m.id, m.full_name || "Staff")}
                          disabled={isSelf || m.role === "super_admin" || removeUserMutation.isPending}
                          className="py-1 px-2.5 text-[9px] font-bold text-destructive hover:bg-destructive/10 border-destructive/20"
                        >
                          <UserX size={10} /> Remove
                        </OutlineButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PageCard>

      {/* ── INVITATION MODAL ── */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-lg font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                Invite Team Member
              </h2>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendInviteEmail} className="px-6 py-5 flex flex-col gap-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Select a member from your club roster or type an email address below to send a team invitation.
              </p>

              {/* Searchable Member Roster Dropdown */}
              <div className="relative flex flex-col gap-1.5" ref={dropdownRef}>
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-foreground">Select Member from Roster</label>
                  {selectedMemberName && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMemberName(null);
                        setSearchMemberQuery("");
                        setInviteEmail("");
                      }}
                      className="text-[10px] font-bold text-[#17458F] hover:underline cursor-pointer"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search member by name..."
                    value={selectedMemberName || searchMemberQuery}
                    onChange={(e) => {
                      setSelectedMemberName(null);
                      setSearchMemberQuery(e.target.value);
                      setShowMemberDropdown(true);
                    }}
                    onFocus={() => setShowMemberDropdown(true)}
                    className="w-full px-4 py-2.5 pr-9 rounded-xl border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 font-medium"
                  />
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />

                  {showMemberDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto z-30 divide-y divide-border/40 animate-in fade-in duration-150">
                      {members && members.filter(m => 
                        (m.full_name || "").toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
                        (m.email || "").toLowerCase().includes(searchMemberQuery.toLowerCase())
                      ).length === 0 ? (
                        <div className="px-4 py-3 text-xs text-muted-foreground">
                          No member found matching "{searchMemberQuery}". Type their email below directly.
                        </div>
                      ) : (
                        members?.filter(m => 
                          (m.full_name || "").toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
                          (m.email || "").toLowerCase().includes(searchMemberQuery.toLowerCase())
                        ).map((m) => {
                          const hasEmail = m.email && !isSyntheticEmail(m.email);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedMemberName(m.full_name);
                                if (hasEmail) {
                                  setInviteEmail(m.email!);
                                } else {
                                  setInviteEmail("");
                                }
                                setShowMemberDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs text-foreground hover:bg-muted/30 transition-all font-medium flex justify-between items-center cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground">{m.full_name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {hasEmail ? m.email : "No email stored — type email below"}
                                </span>
                              </div>
                              {m.buddy_group && (
                                <span className="text-[9px] bg-[#17458F]/5 text-[#17458F] px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">
                                  {m.buddy_group}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">Recipient Email Address</label>
                <input
                  type="email"
                  placeholder="co-worker@rotaryclub.org"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 font-medium"
                />
                {selectedMemberName && !inviteEmail && (
                  <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                    ⚠️ {selectedMemberName} has no email address stored on their member profile. Please enter their email address above.
                  </p>
                )}
              </div>

              <SelectInput
                label="Assign Role"
                options={[
                  { value: "staff", label: "Staff — Read-only access to dashboard records" },
                  { value: "treasurer", label: "Treasurer — Financial management: dues, payments & analytics" },
                  { value: "admin", label: "Admin — Full control to edit, configure, and manage" },
                ]}
                value={inviteRole}
                onChange={(val) => setInviteRole(val as "admin" | "treasurer" | "staff")}
              />

              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-xs font-semibold text-foreground">Or Share Link Directly</label>
                <div className="flex items-center rounded-xl border border-border bg-input-background overflow-hidden p-1.5 focus-within:ring-2 focus-within:ring-[#17458F]/50">
                  <span className="flex-1 font-mono text-[11px] truncate px-2.5 text-muted-foreground select-all">
                    {inviteLink}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex-shrink-0 transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                    title="Copy to clipboard"
                  >
                    {copiedInviteLink ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-2 flex gap-3">
                <OutlineButton type="button" onClick={() => setInviteModalOpen(false)} className="flex-1 justify-center">
                  Cancel
                </OutlineButton>
                <GoldButton
                  type="submit"
                  disabled={sendingEmail || !inviteEmail.trim()}
                  className="flex-1 justify-center py-2.5 text-slate-900 font-bold"
                >
                  {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : <><Mail size={14} /> Send Invitation</>}
                </GoldButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
