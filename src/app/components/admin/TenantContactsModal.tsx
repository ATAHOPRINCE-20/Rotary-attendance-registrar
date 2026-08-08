import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { NAVY } from "../../../lib/constants";
import {
  X,
  Download,
  Mail,
  Phone,
  Users,
  ShieldCheck,
  Building,
  Globe,
} from "lucide-react";
import type { Organization, Profile, Member } from "../../../types/database";

type Tab = "admins" | "members" | "club";

function downloadCsv(rows: string[][], filename: string) {
  const content = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchTenantContacts(organizationId?: string, all = false) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("You must be signed in to view tenant contacts.");
  }

  const params = new URLSearchParams();
  if (all) {
    params.set("all", "true");
  } else if (organizationId) {
    params.set("organizationId", organizationId);
  }

  const res = await fetch(`/api/tenant-contacts?${params.toString()}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || "Failed to load tenant contacts.");
  }

  return body as { profiles: Profile[]; members: Member[] };
}

function buildTenantContactRows(
  tenant: Organization,
  profiles: Profile[],
  members: Member[]
): string[][] {
  const rows: string[][] = [];

  if (tenant.president_name) {
    rows.push([tenant.name, tenant.district || "", "Leadership", tenant.president_name, "", "", "President"]);
  }
  if (tenant.secretary_name) {
    rows.push([tenant.name, tenant.district || "", "Leadership", tenant.secretary_name, "", "", "Secretary"]);
  }
  if (tenant.momo_phone) {
    rows.push([tenant.name, tenant.district || "", "Club", tenant.name, "", tenant.momo_phone, "MoMo phone"]);
  }
  if (tenant.brevo_sender_email) {
    rows.push([tenant.name, tenant.district || "", "Club", tenant.brevo_sender_name || tenant.name, tenant.brevo_sender_email, "", "Sender email"]);
  }

  for (const p of profiles) {
    rows.push([tenant.name, tenant.district || "", "Admin", p.full_name || "", p.email || "", p.phone || "", p.role]);
  }
  for (const m of members) {
    rows.push([tenant.name, tenant.district || "", "Member", m.full_name, m.email || "", m.phone || "", m.buddy_group || ""]);
  }

  return rows;
}

function buildTenantCsv(
  tenant: Organization,
  profiles: Profile[],
  members: Member[]
): string[][] {
  return [
    ["Club", "District", "Type", "Name", "Email", "Phone", "Role / Notes"],
    ...buildTenantContactRows(tenant, profiles, members),
  ];
}

interface TenantContactsModalProps {
  tenant: Organization;
  onClose: () => void;
}

export function TenantContactsModal({ tenant, onClose }: TenantContactsModalProps) {
  const [tab, setTab] = useState<Tab>("admins");
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadContacts() {
      setLoading(true);
      try {
        const data = await fetchTenantContacts(tenant.id);
        if (cancelled) return;
        setProfiles(data.profiles || []);
        setMembers(data.members || []);
      } catch (err: unknown) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to load tenant contacts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadContacts();
    return () => {
      cancelled = true;
    };
  }, [tenant.id]);

  const adminProfiles = profiles.filter((p) => p.role !== "member");

  function handleExport() {
    downloadCsv(
      buildTenantCsv(tenant, profiles, members),
      `${tenant.slug}-contacts.csv`
    );
    toast.success(`Exported contacts for ${tenant.name}`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#17458F]/5 text-[#17458F] border border-[#17458F]/10 flex items-center justify-center">
              <Building size={20} />
            </div>
            <div>
              <h3 className="text-base font-black" style={{ color: NAVY }}>
                Tenant Contacts
              </h3>
              <p className="text-[10px] text-muted-foreground font-medium">
                {tenant.name} · District {tenant.district || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg border border-border hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Download size={12} />
              Export CSV
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-border/30">
          {([
            { id: "admins" as Tab, label: "Admins", count: adminProfiles.length, icon: ShieldCheck },
            { id: "members" as Tab, label: "Members", count: members.length, icon: Users },
            { id: "club" as Tab, label: "Club Info", count: null, icon: Building },
          ]).map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
                tab === id
                  ? "border-[#17458F] text-[#17458F]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={12} />
              {label}
              {count !== null && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[9px]">{count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#17458F] rounded-full animate-spin" />
            </div>
          ) : tab === "club" ? (
            <div className="space-y-3">
              {[
                { label: "Website", value: tenant.website, icon: Globe },
                { label: "MoMo Phone", value: tenant.momo_phone, icon: Phone },
                { label: "President", value: tenant.president_name, icon: Users },
                { label: "Secretary", value: tenant.secretary_name, icon: Users },
                { label: "Sender Email", value: tenant.brevo_sender_email, icon: Mail },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <Icon size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[9px] font-bold uppercase text-muted-foreground">{label}</p>
                    <p className="text-xs font-semibold text-foreground">{value || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : tab === "admins" ? (
            adminProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No admin users found for this tenant.</p>
            ) : (
              <div className="space-y-2">
                {adminProfiles.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/40 hover:bg-slate-50/60"
                  >
                    <div>
                      <p className="text-xs font-bold text-foreground">{p.full_name || "Unnamed"}</p>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {p.role.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      {p.email && (
                        <a
                          href={`mailto:${p.email}`}
                          className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                        >
                          <Mail size={11} />
                          {p.email}
                        </a>
                      )}
                      {p.phone && (
                        <a
                          href={`tel:${p.phone}`}
                          className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                        >
                          <Phone size={11} />
                          {p.phone}
                        </a>
                      )}
                      {!p.email && !p.phone && (
                        <span className="text-[10px] text-muted-foreground">No contact info</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No members registered for this tenant.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/40 hover:bg-slate-50/60"
                >
                  <div>
                    <p className="text-xs font-bold text-foreground">{m.full_name}</p>
                    {m.buddy_group && (
                      <p className="text-[10px] text-muted-foreground">{m.buddy_group}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {m.email && (
                      <a
                        href={`mailto:${m.email}`}
                        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                      >
                        <Mail size={11} />
                        {m.email}
                      </a>
                    )}
                    {m.phone && (
                      <a
                        href={`tel:${m.phone}`}
                        className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                      >
                        <Phone size={11} />
                        {m.phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export async function exportAllTenantContacts(tenants: Organization[]) {
  const data = await fetchTenantContacts(undefined, true);
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const rows: string[][] = [
    ["Club", "District", "Type", "Name", "Email", "Phone", "Role / Notes"],
  ];

  for (const tenant of tenants) {
    rows.push(...buildTenantContactRows(tenant, [], []));
  }

  for (const p of data.profiles || []) {
    const tenant = tenantMap.get(p.organization_id);
    if (!tenant) continue;
    rows.push([
      tenant.name,
      tenant.district || "",
      "Admin",
      p.full_name || "",
      p.email || "",
      p.phone || "",
      p.role,
    ]);
  }

  for (const m of data.members || []) {
    const tenant = tenantMap.get(m.organization_id);
    if (!tenant) continue;
    rows.push([
      tenant.name,
      tenant.district || "",
      "Member",
      m.full_name,
      m.email || "",
      m.phone || "",
      m.buddy_group || "",
    ]);
  }

  downloadCsv(rows, `all-tenant-contacts-${new Date().toISOString().slice(0, 10)}.csv`);
}
