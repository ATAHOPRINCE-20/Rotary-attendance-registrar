import { useState, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
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
import { NAVY, GOLD } from "../../../lib/constants";
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
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import type { Member } from "../../../types/database";

export function MembersPage() {
  const { organization } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries/Mutations
  const { data: members, isLoading } = useOrgMembers(organization?.id);
  const createMutation = useCreateMember();
  const updateMutation = useUpdateMember();
  const deleteMutation = useDeleteMember();
  const bulkImportMutation = useBulkImportMembers();

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
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
  const [csvError, setCsvError] = useState<string | null>(null);

  // Options for Buddy Groups from organization setting
  const buddyGroupsList = organization?.buddy_groups
    ? organization.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean)
    : ["Table 1", "Table 2", "Table 3", "Table 4"];

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
      setMemberFormError(err?.message || "Failed to save member. Please check details.");
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
      toast.success("Member deleted from directory.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to delete member.");
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

        // Standardize header check
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/["']/g, ""));
        const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("full") || h.includes("member"));
        const emailIdx = headers.findIndex(h => h.includes("email") || h.includes("mail"));
        const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("tel") || h.includes("contact"));
        const buddyIdx = headers.findIndex(h => h.includes("buddy") || h.includes("table") || h.includes("group"));

        // Fallbacks
        const nIdx = nameIdx !== -1 ? nameIdx : 0;
        const eIdx = emailIdx !== -1 ? emailIdx : 1;
        const pIdx = phoneIdx !== -1 ? phoneIdx : 2;
        const bIdx = buddyIdx !== -1 ? buddyIdx : 3;

        const parsedRows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          // Regular expression to correctly parse CSV line with potential quoted commas
          const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
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

  // Trigger Bulk Import Mutation
  async function handleImportCsvSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedCsvData.length === 0 || !organization) return;

    setImportingCsv(true);
    setCsvError(null);

    try {
      await bulkImportMutation.mutateAsync({
        organizationId: organization.id,
        members: parsedCsvData,
      });

      toast.success(`Successfully imported ${parsedCsvData.length} members!`);
      setImportModalOpen(false);
      setCsvFile(null);
      setParsedCsvData([]);
    } catch (err: any) {
      console.error(err);
      setCsvError(err?.message || "Failed to bulk import members. Please try again.");
    } finally {
      setImportingCsv(false);
    }
  }

  // Search filter implementation
  const filteredMembers = members?.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.full_name.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.phone && m.phone.toLowerCase().includes(q)) ||
      (m.buddy_group && m.buddy_group.toLowerCase().includes(q))
    );
  }) ?? [];

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

  return (
    <AdminLayout
      pageTitle="Club Members"
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#F4F6FB] border border-border hover:bg-muted text-foreground transition-all cursor-pointer"
          >
            <Upload size={13} /> Import CSV
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all cursor-pointer"
            style={{ background: NAVY }}
          >
            <Plus size={13} /> New Member
          </button>
        </div>
      }
    >
      {/* ── HEADER ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
          Club Members
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your club member database, assign buddy groups, and simplify their on-site registration.
        </p>
      </div>

      {/* ── METRIC STAT CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
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
            className="w-10 h-10 rounded-xl flex items-center justify-center"
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
            className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-600"
            style={{ background: `#10B98118` }}
          >
            <Mail size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Email Coverage</p>
            <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>{emailCoverage}%</p>
          </div>
        </div>
      </div>

      {/* ── MAIN ROSTER BOX ── */}
      <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        {/* Search Bar Row */}
        <div className="px-5 py-4 border-b border-border/40 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-muted/10">
          <div className="flex items-center gap-2">
            <Users size={15} style={{ color: NAVY }} />
            <h3 className="text-sm font-bold" style={{ color: NAVY }}>Member Directory</h3>
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
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                  <th className="px-6 py-4">Full Name</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Buddy Group</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/10 transition-colors">
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
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#17458F] border border-[#17458F]/20"
                          style={{ backgroundColor: `${NAVY}08` }}
                        >
                          {m.buddy_group}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 italic">None assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── MODAL: ADD / EDIT MEMBER ── */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-base font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
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
                label="Buddy Group / Table Assignment (Optional)"
                options={buddyGroupsList.map(g => ({ value: g, label: g }))}
                value={buddyGroup}
                onChange={setBuddyGroup}
              />
              {/* Optional write-in override if they want to assign a group not in selection */}
              <div className="flex flex-col gap-1 -mt-2">
                <input
                  type="text"
                  placeholder="Or enter custom table name..."
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

      {/* ── MODAL: BULK CSV IMPORT ── */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/20">
              <h2 className="text-base font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
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
                            <span className="bg-[#17458F]/5 text-[#17458F] font-bold px-1.5 py-0.5 rounded">
                              {row.buddy_group}
                            </span>
                          )}
                          <span className="truncate max-w-[120px]">{row.email || "No email"}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Confirm that the roster mapping looks correct. Clicking "Import Roster" will add all these profiles to your club members roster database.
                  </p>
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
