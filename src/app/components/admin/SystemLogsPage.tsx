import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { NAVY, GOLD } from "../../../lib/constants";
import { AdminLayout } from "../shared/AdminLayout";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  CheckCheck,
  Building,
  Terminal,
  Activity,
  X,
  Download,
  AlertCircle,
  Info,
  Zap,
  Eye
} from "lucide-react";

export interface SystemLog {
  id: string;
  created_at: string;
  level: "error" | "warn" | "info" | "fatal";
  source: string;
  message: string;
  details: any;
  organization_id?: string | null;
  user_id?: string | null;
  status: "unresolved" | "acknowledged" | "resolved";
  organizations?: { name: string; slug: string } | null;
}

export function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [organizations, setOrganizations] = useState<Record<string, { name: string; slug: string }>>({});
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Realtime new log alert pulse state
  const [hasNewAlert, setHasNewAlert] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");

  // Selected Log Modal
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Fetch initial logs & organization mapping
  async function fetchLogs() {
    setLoading(true);
    try {
      // Fetch system logs
      const { data: logsData, error: logsError } = await supabase
        .from("system_logs")
        .select(`
          *,
          organizations:organization_id (name, slug)
        `)
        .order("created_at", { ascending: false })
        .limit(300);

      if (logsError) throw logsError;

      // Fetch organizations lookup for filtering
      const { data: orgsData } = await supabase
        .from("organizations")
        .select("id, name, slug");

      const orgMap: Record<string, { name: string; slug: string }> = {};
      (orgsData || []).forEach((o) => {
        orgMap[o.id] = { name: o.name, slug: o.slug };
      });

      setOrganizations(orgMap);
      setLogs((logsData as any[]) || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error("Error loading system logs:", err);
      toast.error(err?.message || "Failed to load real-time system logs.");
    } finally {
      setLoading(false);
    }
  }

  // 2. Setup Supabase Realtime Subscription for instant log updates
  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel("system_logs_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_logs" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newLog = payload.new as SystemLog;
            
            // Enrich with org info if present
            if (newLog.organization_id && organizations[newLog.organization_id]) {
              newLog.organizations = organizations[newLog.organization_id];
            }

            setLogs((prev) => [newLog, ...prev.slice(0, 299)]);
            setLastUpdated(new Date());
            setHasNewAlert(true);
            setTimeout(() => setHasNewAlert(false), 3000);

            if (newLog.level === "error" || newLog.level === "fatal") {
              toast.error(`[NEW LOG] ${newLog.source}: ${newLog.message}`, {
                duration: 4000
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as SystemLog;
            setLogs((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setLogs((prev) => prev.filter((l) => l.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Computed KPI Stats
  const kpis = useMemo(() => {
    const total = logs.length;
    const unresolved = logs.filter((l) => l.status === "unresolved").length;
    
    const today = new Date().toISOString().split("T")[0];
    const errorsToday = logs.filter(
      (l) => l.created_at.startsWith(today) && (l.level === "error" || l.level === "fatal")
    ).length;

    // Determine top failing endpoint / source
    const sourceCounts: Record<string, number> = {};
    logs.filter((l) => l.level === "error" || l.level === "fatal").forEach((l) => {
      sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1;
    });

    let topFailingSource = "None";
    let maxCount = 0;
    Object.entries(sourceCounts).forEach(([src, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        topFailingSource = src;
      }
    });

    return { total, unresolved, errorsToday, topFailingSource, maxCount };
  }, [logs]);

  // Overall System Health Status
  const healthStatus = useMemo(() => {
    if (kpis.unresolved > 10 || kpis.errorsToday > 25) {
      return { status: "CRITICAL", label: "Attention Required", color: "bg-rose-500", textColor: "text-rose-600" };
    }
    if (kpis.unresolved > 0 || kpis.errorsToday > 0) {
      return { status: "ELEVATED", label: "Elevated Failures", color: "bg-amber-500", textColor: "text-amber-600" };
    }
    return { status: "HEALTHY", label: "All Systems Operational", color: "bg-emerald-500", textColor: "text-emerald-600" };
  }, [kpis]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(searchTerm.toLowerCase());

      const matchLevel = levelFilter === "all" || log.level === levelFilter;
      const matchStatus = statusFilter === "all" || log.status === statusFilter;
      const matchOrg = orgFilter === "all" || log.organization_id === orgFilter;

      return matchSearch && matchLevel && matchStatus && matchOrg;
    });
  }, [logs, searchTerm, levelFilter, statusFilter, orgFilter]);

  // Mark Log Status
  async function updateLogStatus(id: string, newStatus: "unresolved" | "acknowledged" | "resolved") {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("system_logs")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
      if (selectedLog?.id === id) {
        setSelectedLog({ ...selectedLog, status: newStatus });
      }
      toast.success(`Log status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update log status");
    } finally {
      setActionLoading(false);
    }
  }

  // Acknowledge All Unresolved
  async function handleAcknowledgeAll() {
    const unresolvedIds = filteredLogs.filter((l) => l.status === "unresolved").map((l) => l.id);
    if (unresolvedIds.length === 0) {
      toast.info("No unresolved logs to acknowledge.");
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("system_logs")
        .update({ status: "acknowledged" })
        .in("id", unresolvedIds);

      if (error) throw error;

      setLogs((prev) =>
        prev.map((l) => (unresolvedIds.includes(l.id) ? { ...l, status: "acknowledged" } : l))
      );
      toast.success(`Acknowledged ${unresolvedIds.length} unresolved logs.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to bulk acknowledge logs.");
    } finally {
      setActionLoading(false);
    }
  }

  // Clear Resolved Logs
  async function handleClearResolved() {
    const resolvedIds = logs.filter((l) => l.status === "resolved").map((l) => l.id);
    if (resolvedIds.length === 0) {
      toast.info("No resolved logs to delete.");
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("system_logs")
        .delete()
        .in("id", resolvedIds);

      if (error) throw error;

      setLogs((prev) => prev.filter((l) => !resolvedIds.includes(l.id)));
      toast.success(`Cleared ${resolvedIds.length} resolved logs.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to clear resolved logs.");
    } finally {
      setActionLoading(false);
    }
  }

  // Export Logs to JSON/CSV
  function handleExportLogs() {
    const exportData = filteredLogs.map((l) => ({
      Timestamp: l.created_at,
      Level: l.level.toUpperCase(),
      Source: l.source,
      Message: l.message,
      Status: l.status,
      Organization: l.organizations?.name || l.organization_id || "Global",
      Details: JSON.stringify(l.details)
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system_logs_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported system logs as JSON.");
  }

  // Helper for relative time
  function formatRelativeTime(dateStr: string) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 10) return "Just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(dateStr).toLocaleDateString("en-GB") + " " + new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <AdminLayout pageTitle="Real-Time System Monitoring & Logs">
      <div className="flex-1 min-h-screen pb-12">
        {/* Page Heading & Status Banner */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                System Error & Failure Logs
              </h1>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-border shadow-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${healthStatus.color} ${hasNewAlert ? "animate-ping" : "animate-pulse"}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${healthStatus.textColor}`}>
                  {healthStatus.label}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live WebSocket monitoring of backend serverless errors, API failures, and application telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-border flex items-center gap-2 cursor-pointer transition-all shadow-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={handleAcknowledgeAll}
              disabled={actionLoading || kpis.unresolved === 0}
              className="px-3.5 py-2 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl border border-amber-200 flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            >
              <CheckCheck size={14} />
              Acknowledge All
            </button>
            <button
              onClick={handleExportLogs}
              className="px-3.5 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
              style={{ backgroundColor: NAVY }}
            >
              <Download size={14} />
              Export Logs
            </button>
          </div>
        </div>

        {/* ── KPI Widgets ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Unresolved Failures
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <AlertCircle size={18} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-rose-600">{kpis.unresolved}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Require administrator review</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Errors Today
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <AlertTriangle size={18} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-slate-900">{kpis.errorsToday}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Logged in past 24 hours</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Top Failure Source
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Terminal size={18} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm font-extrabold text-slate-900 truncate max-w-[180px]" title={kpis.topFailingSource}>
                {kpis.topFailingSource}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kpis.maxCount > 0 ? `${kpis.maxCount} error occurrences` : "No active failures"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Total System Logs
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Activity size={18} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-slate-900">{kpis.total}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Last updated {formatRelativeTime(lastUpdated.toISOString())}
              </p>
            </div>
          </div>
        </div>

        {/* ── Controls & Filter Bar ── */}
        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-xs mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search log message, API endpoint, stack trace, or payload..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-border bg-slate-50/50 focus:outline-none focus:bg-white transition-all font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Level Filter */}
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="error">Error Only</option>
              <option value="warn">Warning Only</option>
              <option value="fatal">Fatal Only</option>
              <option value="info">Info Only</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="unresolved">Unresolved Only</option>
              <option value="acknowledged">Acknowledged Only</option>
              <option value="resolved">Resolved Only</option>
            </select>

            {/* Tenant/Org Filter */}
            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none font-semibold text-slate-700 cursor-pointer max-w-[160px]"
            >
              <option value="all">All Clubs / Tenants</option>
              {Object.entries(organizations).map(([id, org]) => (
                <option key={id} value={id}>
                  {org.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleClearResolved}
              disabled={actionLoading}
              className="p-2.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Clear all resolved logs"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* ── System Logs Feed Table ── */}
        <div className="bg-white rounded-2xl border border-border/40 shadow-xs overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#17458F] rounded-full animate-spin" />
              <p className="text-xs font-semibold text-muted-foreground">Connecting to real-time log channel...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No logs found matching your filters</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {logs.length === 0 ? "System is completely error-free!" : "Try adjusting your search criteria."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-slate-50/70 text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-3">Severity</th>
                    <th className="py-3.5 px-3">Source Endpoint</th>
                    <th className="py-3.5 px-4">Message / Exception</th>
                    <th className="py-3.5 px-3">Tenant Club</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredLogs.map((log) => {
                    const isUnresolved = log.status === "unresolved";
                    const isAcknowledged = log.status === "acknowledged";
                    const isResolved = log.status === "resolved";

                    const levelBg =
                      log.level === "fatal" || log.level === "error"
                        ? "bg-rose-100 text-rose-800 border-rose-200"
                        : log.level === "warn"
                        ? "bg-amber-100 text-amber-800 border-amber-200"
                        : "bg-blue-100 text-blue-800 border-blue-200";

                    return (
                      <tr
                        key={log.id}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isUnresolved ? "bg-rose-50/20" : ""
                        }`}
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-500">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">
                              {formatRelativeTime(log.created_at)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(log.created_at).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${levelBg}`}>
                            {log.level}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-100">
                            {log.source}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                          <p className="font-semibold text-slate-900 truncate" title={log.message}>
                            {log.message}
                          </p>
                          {log.details?.url && (
                            <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
                              {log.details.url}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {log.organizations ? (
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                              <Building size={12} className="text-muted-foreground" />
                              {log.organizations.name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Global Platform</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                            isUnresolved
                              ? "bg-rose-100 text-rose-800 border-rose-200 animate-pulse"
                              : isAcknowledged
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-emerald-100 text-emerald-800 border-emerald-200"
                          }`}>
                            {log.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-600 transition-colors"
                              title="Inspect details"
                            >
                              <Eye size={15} />
                            </button>
                            {isUnresolved && (
                              <button
                                onClick={() => updateLogStatus(log.id, "acknowledged")}
                                className="p-1.5 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors"
                                title="Mark Acknowledged"
                              >
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                            {!isResolved && (
                              <button
                                onClick={() => updateLogStatus(log.id, "resolved")}
                                className="p-1.5 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                                title="Mark Resolved"
                              >
                                <CheckCheck size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Log Details Drawer / Modal ── */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-border/40 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    selectedLog.level === "error" || selectedLog.level === "fatal"
                      ? "bg-rose-100 text-rose-600"
                      : selectedLog.level === "warn"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-blue-100 text-blue-600"
                  }`}>
                    <Terminal size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">{selectedLog.source}</span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                        {selectedLog.level}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                      Logged {new Date(selectedLog.created_at).toLocaleString("en-GB")} ({formatRelativeTime(selectedLog.created_at)})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                {/* Exception Message */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Log Exception Message
                  </label>
                  <div className="p-3.5 rounded-xl bg-slate-900 text-rose-300 font-mono text-xs leading-relaxed border border-slate-800">
                    {selectedLog.message}
                  </div>
                </div>

                {/* Metadata details */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Resolution Status</span>
                    <span className="font-bold text-slate-800 capitalize mt-0.5 block">{selectedLog.status}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Tenant / Organization</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {selectedLog.organizations?.name || selectedLog.organization_id || "Global Platform"}
                    </span>
                  </div>
                </div>

                {/* Formatted JSON Stack Trace / Details */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Context & Payload Details (JSON)
                  </label>
                  <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-72 border border-slate-800">
                    {JSON.stringify(selectedLog.details || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-border bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedLog.status !== "acknowledged" && (
                    <button
                      onClick={() => updateLogStatus(selectedLog.id, "acknowledged")}
                      className="px-3 py-2 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl border border-amber-200 cursor-pointer transition-all"
                    >
                      Mark Acknowledged
                    </button>
                  )}
                  {selectedLog.status !== "resolved" && (
                    <button
                      onClick={() => updateLogStatus(selectedLog.id, "resolved")}
                      className="px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer transition-all shadow-xs"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-border cursor-pointer transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
