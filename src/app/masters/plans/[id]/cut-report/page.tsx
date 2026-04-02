"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, API_BASE_URL, createRequestOptions } from "@/lib/api-config";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Package,
  Weight,
  BarChart3,
  Scissors,
  Layers,
  ArrowLeft,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CutRoll {
  id: string;
  barcode_id: string;
  width_inches: number;
  weight_kg: number;
  status: string;
  client_name: string;
  order_frontend_id: string | null;
  paper_specs: { gsm: number; bf: number; shade: string } | null;
  is_weight_updated: boolean;
  set_barcode?: string | null;
}

interface JumboGroup {
  jumbo_id: string;
  jumbo_barcode: string;
  jumbo_weight_kg: number | null;
  rolls: CutRoll[];
  summary: { total: number; weight_updated: number; is_complete: boolean; total_cut_weight_kg: number };
}

interface PlanDashboard {
  plan_id: string;
  plan_frontend_id: string | null;
  plan_name: string | null;
  plan_status: string;
  created_at: string;
  executed_at: string | null;
  is_complete: boolean;
  summary: {
    total_rolls: number;
    planned: number;
    stock: number;
    weight_updated: number;
    dispatched: number;
    billed: number;
    allocated: number;
    damaged: number;
    removed: number;
    total_weight_kg: number;
    weight_updated_kg: number;
    dispatched_kg: number;
    billed_kg: number;
    stock_kg: number;
    planned_kg: number;
  };
  jumbo_groups: JumboGroup[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-IN");
}

function fmtKg(n: number) {
  return `${n.toFixed(1)} kg`;
}

// Sentinel weight of 1 means pre-allocated but not yet physically weighed — display as 0
function displayWeight(w: number): number {
  return w === 1 ? 0 : w;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function PlanCutReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<PlanDashboard | null>(null);
  const isAdmin = typeof window !== "undefined" && localStorage.getItem("username") === "admin";
  const [loading, setLoading] = useState(true);

  // ── Remove modal state ────────────────────────────────────────────────────
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedBarcodes, setSelectedBarcodes] = useState<Set<string>>(new Set());
  const [removeLoading, setRemoveLoading] = useState(false);

  // ── Roll detail modal ─────────────────────────────────────────────────────
  const [rollDetail, setRollDetail] = useState<{
    barcode_id: string;
    roll_status: string;
    dispatch_info: { dispatch_number: string; dispatch_date: string | null; client_name: string | null; dispatch_frontend_id: string } | null;
    bill_info: { bill_frontend_id: string | null; payment_type: string; bill_no: string | null; slip_date: string | null } | null;
  } | null>(null);
  const [rollDetailLoading, setRollDetailLoading] = useState(false);

  const handleRollClick = async (roll: CutRoll) => {
    if (roll.status !== "billed" && roll.status !== "dispatched") return;
    setRollDetail(null);
    setRollDetailLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/reports/barcode-details/${roll.barcode_id}`,
        createRequestOptions("GET")
      );
      const json = await res.json();
      if (res.ok) setRollDetail(json.data);
      else toast.error("Failed to fetch roll details");
    } catch {
      toast.error("Failed to fetch roll details");
    } finally {
      setRollDetailLoading(false);
    }
  };

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${MASTER_ENDPOINTS.PLANS}/${id}/dashboard`,
        createRequestOptions("GET")
      );
      if (res.ok) setDashboard(await res.json());
    } catch (e) {
      console.error("Failed to fetch dashboard", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDashboard();
  }, [id]);

  // All pending (red) barcode IDs across all jumbo groups
  const pendingBarcodes = dashboard
    ? dashboard.jumbo_groups.flatMap(g =>
        g.rolls.filter(r => r.weight_kg <= 1).map(r => r.barcode_id)
      ).filter(Boolean)
    : [];

  const allSelected = pendingBarcodes.length > 0 && pendingBarcodes.every(b => selectedBarcodes.has(b));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedBarcodes(new Set());
    } else {
      setSelectedBarcodes(new Set(pendingBarcodes));
    }
  };

  const toggleBarcode = (barcode: string) => {
    setSelectedBarcodes(prev => {
      const next = new Set(prev);
      if (next.has(barcode)) next.delete(barcode);
      else next.add(barcode);
      return next;
    });
  };

  const handleOpenRemoveModal = () => {
    setSelectedBarcodes(new Set());
    setShowRemoveModal(true);
  };

  const handleBulkRemove = async () => {
    if (selectedBarcodes.size === 0) return;
    setRemoveLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/cut-rolls/bulk-mark-removed`,
        createRequestOptions("POST", { barcode_ids: Array.from(selectedBarcodes) })
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || "Failed");
      toast.success(result.message || `${result.updated_count} roll(s) marked as removed`);
      setShowRemoveModal(false);
      fetchDashboard();
    } catch (e: any) {
      toast.error(e.message || "Failed to mark rolls as removed");
    } finally {
      setRemoveLoading(false);
    }
  };

  const metrics = dashboard
    ? [
        {
          label: "Total Rolls",
          value: dashboard.summary.total_rolls,
          sub: fmtKg(dashboard.summary.total_weight_kg),
          icon: Layers,
          border: "",
          text: "text-slate-700",
        },
        {
          label: "Planned",
          value: dashboard.summary.planned,
          sub: fmtKg(dashboard.summary.planned_kg),
          icon: Scissors,
          border: "border-l-yellow-400",
          text: "text-yellow-700",
        },
        {
          label: "Stock",
          value: dashboard.summary.stock,
          sub: fmtKg(dashboard.summary.stock_kg),
          icon: Package,
          border: "border-l-green-500",
          text: "text-green-700",
        },
        {
          label: "Weight Updated",
          value: dashboard.summary.weight_updated,
          sub: fmtKg(dashboard.summary.weight_updated_kg),
          icon: Weight,
          border: "border-l-blue-500",
          text: "text-blue-700",
        },
        {
          label: "Dispatched",
          value: dashboard.summary.dispatched,
          sub: fmtKg(dashboard.summary.dispatched_kg),
          icon: BarChart3,
          border: "",
          text: "text-gray-700",
        },
        {
          label: "Billed",
          value: dashboard.summary.billed,
          sub: fmtKg(dashboard.summary.billed_kg),
          icon: BarChart3,
          border: "",
          text: "text-gray-700",
        },
        ...(dashboard.summary.allocated > 0
          ? [
              {
                label: "Allocated",
                value: dashboard.summary.allocated,
                sub: "",
                icon: Package,
                border: "border-l-indigo-400",
                text: "text-indigo-700",
              },
            ]
          : []),
        ...(dashboard.summary.damaged > 0
          ? [
              {
                label: "Damaged",
                value: dashboard.summary.damaged,
                sub: "",
                icon: AlertCircle,
                border: "border-l-red-400",
                text: "text-red-700",
              },
            ]
          : []),
        ...((dashboard.summary.removed ?? 0) > 0
          ? [
              {
                label: "Manually Completed",
                value: dashboard.summary.removed,
                sub: "",
                icon: Trash2,
                border: "border-l-orange-400",
                text: "text-orange-700",
              },
            ]
          : []),
      ]
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 sm:p-5">
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-8 px-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-lg font-bold">
            Cut Report
            {dashboard && (
              <span className="ml-2 text-foreground font-bold text-lg">
                — {dashboard.plan_frontend_id || dashboard.plan_id}
              </span>
            )}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && dashboard && pendingBarcodes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenRemoveModal}
                className="h-8 border-red-300 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Mark Manually Completed ({pendingBarcodes.length})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboard}
              disabled={loading}
              className="h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {dashboard && !loading && (
          <>
            {/* Plan meta */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground border-b pb-2">
              <span className="capitalize">{dashboard.plan_status}</span>
              <span>·</span>
              <span>{new Date(dashboard.created_at).toLocaleDateString("en-IN")}</span>
              {dashboard.executed_at && (
                <>
                  <span>·</span>
                  <span>executed {new Date(dashboard.executed_at).toLocaleDateString("en-IN")}</span>
                </>
              )}
              <div
                className={`flex items-center gap-1 font-medium px-2 py-0.5 rounded-full ml-1 ${
                  dashboard.is_complete
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {dashboard.is_complete ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
                {dashboard.is_complete
                  ? "All updated"
                  : `${dashboard.summary.weight_updated}/${dashboard.summary.total_rolls} updated`}
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {metrics.map((m) => (
                <Card key={m.label}>
                  <CardContent className="px-3 pt-3 pb-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium leading-tight">
                      {m.label}
                    </p>
                    <p className={`text-xl font-bold mt-0.5 ${m.text}`}>
                      {fmt(m.value)}
                    </p>
                    {m.sub && (
                      <p className="text-[11px] text-muted-foreground">{m.sub}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Jumbo groups */}
            <div className="space-y-3">
              {[...dashboard.jumbo_groups].sort((a, b) => Number(a.summary.is_complete) - Number(b.summary.is_complete)).map((group) => {
                const JUMBO_WIDTH = 123;
                const setMap = new Map<string, CutRoll[]>();
                for (const roll of group.rolls) {
                  const key = roll.set_barcode || "—";
                  if (!setMap.has(key)) setMap.set(key, []);
                  setMap.get(key)!.push(roll);
                }
                const getSetNum = (b: string) => {
                  const m = b.match(/SET_(\d+)/i);
                  return m ? parseInt(m[1]) : 999999;
                };
                const sets = Array.from(setMap.entries()).sort(
                  ([a], [b]) => getSetNum(a) - getSetNum(b)
                );

                const paperSpec = group.rolls.find((r) => r.paper_specs)?.paper_specs;

                return (
                  <Card key={group.jumbo_id} className="overflow-hidden">
                    <CardHeader
                      className={`py-3 px-4 ${
                        group.summary.is_complete ? "bg-green-50" : "bg-red-50"
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {group.summary.is_complete ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <CardTitle className="text-sm font-semibold">
                            {group.jumbo_barcode}
                          </CardTitle>
                          {paperSpec && (
                            <span className="text-xs font-bold">
                              {paperSpec.gsm}gsm · {paperSpec.bf}bf · {paperSpec.shade}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">
                            {group.rolls.length} roll{group.rolls.length !== 1 ? "s" : ""}
                          </span>
                          <span className="text-blue-700 font-semibold">
                            JR: {group.jumbo_weight_kg != null ? group.jumbo_weight_kg.toFixed(1) : "0"} kg
                          </span>
                          <span className="text-purple-700 font-semibold">
                            Cut: {(group.summary.total_cut_weight_kg ?? 0).toFixed(1)} kg
                          </span>
                          <span
                            className={`font-semibold ${
                              group.summary.is_complete ? "text-green-700" : "text-red-600"
                            }`}
                          >
                            {group.summary.weight_updated}/{group.summary.total} updated
                          </span>
                          <div className="w-24 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                group.summary.is_complete ? "bg-green-500" : "bg-red-400"
                              }`}
                              style={{
                                width: `${
                                  group.summary.total > 0
                                    ? (group.summary.weight_updated / group.summary.total) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3">
                      {sets.map(([setBarcode, setRolls]) => {
                        const usedWidth = setRolls.reduce((s, r) => s + r.width_inches, 0);
                        const wasteWidth = Math.max(0, JUMBO_WIDTH - usedWidth);
                        return (
                          <div key={setBarcode}>
                            <div className="text-[11px] font-medium text-muted-foreground mb-1">
                              {setBarcode}
                            </div>
                            <div className="flex h-14 rounded overflow-hidden border border-gray-200">
                              {setRolls.map((roll) => {
                                const isGrey = roll.status === "billed" || roll.status === "dispatched";
                                const isGreen = !isGrey && roll.weight_kg > 1;
                                const widthPct = (roll.width_inches / JUMBO_WIDTH) * 100;
                                return (
                                  <div
                                    key={roll.id}
                                    title={`${roll.barcode_id} | ${roll.width_inches}" | ${
                                      isGrey ? roll.status : isGreen ? fmtKg(displayWeight(roll.weight_kg)) : "Pending"
                                    } | ${roll.client_name}${
                                      roll.paper_specs
                                        ? ` | ${roll.paper_specs.gsm}gsm ${roll.paper_specs.bf}bf ${roll.paper_specs.shade}`
                                        : ""
                                    }`}
                                    style={{ width: `${widthPct}%` }}
                                    onClick={() => isGrey && handleRollClick(roll)}
                                    className={`flex flex-col items-center justify-center text-white border-r border-white/30 overflow-hidden hover:opacity-80 transition-opacity ${
                                      isGrey ? "bg-gray-400 cursor-pointer" : isGreen ? "bg-green-500 cursor-default" : "bg-red-400 cursor-default"
                                    }`}
                                  >
                                    {roll.width_inches >= 8 && (
                                      <span className="text-[10px] font-bold leading-tight">{roll.width_inches}"</span>
                                    )}
                                    {widthPct >= 6 && (
                                      <span className="text-[9px] font-bold leading-tight truncate w-full text-center px-0.5">
                                        {roll.barcode_id}
                                      </span>
                                    )}
                                    {widthPct >= 6 && roll.client_name && (
                                      <span className="text-[9px] font-bold leading-tight truncate w-full text-center px-0.5 opacity-90">
                                        {roll.client_name}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {wasteWidth > 0.5 && (
                                <div
                                  title={`Waste: ~${wasteWidth.toFixed(1)}"`}
                                  style={{ width: `${(wasteWidth / JUMBO_WIDTH) * 100}%` }}
                                  className="flex items-center justify-center text-[9px] text-gray-500 bg-gray-100 overflow-hidden"
                                >
                                  {wasteWidth > 6 && `~${wasteWidth.toFixed(0)}"`}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {/* Legend */}
                      <div className="flex gap-4 text-[10px] text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500" />
                          Updated
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-400" />
                          Billed / Dispatched
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400" />
                          Pending
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-200" />
                          Waste
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {dashboard.jumbo_groups.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No cut rolls found for this plan yet.
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Mark Manually Completed Modal ───────────────────────────────────── */}
      <Dialog open={showRemoveModal} onOpenChange={setShowRemoveModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-orange-500" />
              Mark Rolls as Manually Completed
            </DialogTitle>
            <DialogDescription>
              Select pending (red) barcode IDs to mark as manually completed. Their weight will be set to 2kg and they will count toward plan completion.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Select All */}
            <div className="flex items-center justify-between border-b pb-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                />
                Select All ({pendingBarcodes.length})
              </label>
              <span className="text-xs text-muted-foreground">{selectedBarcodes.size} selected</span>
            </div>

            {/* Barcode list */}
            <div className="max-h-72 overflow-y-auto space-y-1">
              {pendingBarcodes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">No pending rolls found.</p>
              ) : (
                pendingBarcodes.map(barcode => (
                  <label
                    key={barcode}
                    className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedBarcodes.has(barcode)}
                      onCheckedChange={() => toggleBarcode(barcode)}
                    />
                    <span className="font-mono text-sm">{barcode}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveModal(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleBulkRemove}
              disabled={selectedBarcodes.size === 0 || removeLoading}
            >
              {removeLoading ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Marking...</>
              ) : (
                `Mark ${selectedBarcodes.size} Roll${selectedBarcodes.size !== 1 ? "s" : ""} as Manually Completed`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Roll Detail Modal ────────────────────────────────────────────── */}
      <Dialog open={!!rollDetail || rollDetailLoading} onOpenChange={(open) => { if (!open) setRollDetail(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {rollDetailLoading ? "Loading..." : rollDetail?.barcode_id}
            </DialogTitle>
          </DialogHeader>
          {rollDetailLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {rollDetail && !rollDetailLoading && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-20">Status</span>
                <span className="font-medium capitalize">{rollDetail.roll_status}</span>
              </div>
              {rollDetail.dispatch_info && (
                <div className="space-y-1 border rounded p-2.5 bg-gray-50">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">Dispatch</p>
                  <div className="flex gap-2"><span className="text-muted-foreground w-20">Challan</span><span className="font-medium">{rollDetail.dispatch_info.dispatch_frontend_id || rollDetail.dispatch_info.dispatch_number}</span></div>
                  <div className="flex gap-2"><span className="text-muted-foreground w-20">Client</span><span className="font-medium">{rollDetail.dispatch_info.client_name || "—"}</span></div>
                  {rollDetail.dispatch_info.dispatch_date && (
                    <div className="flex gap-2"><span className="text-muted-foreground w-20">Date</span><span className="font-medium">{new Date(rollDetail.dispatch_info.dispatch_date).toLocaleDateString("en-IN")}</span></div>
                  )}
                </div>
              )}
              {rollDetail.bill_info && (
                <div className="space-y-1 border rounded p-2.5 bg-blue-50">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">Bill</p>
                  <div className="flex gap-2"><span className="text-muted-foreground w-20">Bill No</span><span className="font-medium">{rollDetail.bill_info.bill_frontend_id || rollDetail.bill_info.bill_no || "—"}</span></div>
                  <div className="flex gap-2"><span className="text-muted-foreground w-20">Type</span><span className="font-medium capitalize">{rollDetail.bill_info.payment_type}</span></div>
                  {rollDetail.bill_info.slip_date && (
                    <div className="flex gap-2"><span className="text-muted-foreground w-20">Date</span><span className="font-medium">{new Date(rollDetail.bill_info.slip_date).toLocaleDateString("en-IN")}</span></div>
                  )}
                </div>
              )}
              {!rollDetail.dispatch_info && !rollDetail.bill_info && (
                <p className="text-muted-foreground text-center py-2">No dispatch or bill info found.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
