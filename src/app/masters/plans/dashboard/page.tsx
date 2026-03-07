"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ───────────────────────────────────────────────────────────────────
interface PlanSummary {
  id: string;
  frontend_id: string | null;
  name: string | null;
  status: string;
  created_at: string;
  total_rolls: number;
  weight_updated_rolls: number;
  is_complete: boolean;
}

const PAGE_SIZE = 30;

// ─── Component ───────────────────────────────────────────────────────────────
export default function PlanDashboardPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [page, setPage] = useState(0);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${MASTER_ENDPOINTS.PLANS}/summary-list`,
        createRequestOptions("GET")
      );
      if (res.ok) {
        const data: PlanSummary[] = await res.json();
        setPlans(data);
        setPage(0);
      }
    } catch (e) {
      console.error("Failed to fetch plans", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const totalPages = Math.ceil(plans.length / PAGE_SIZE);
  const pagePlans = plans.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const navigateTo = (plan: PlanSummary) =>
    router.push(`/masters/plans/${plan.id}/cut-report`);

  // ── Pagination bar ────────────────────────────────────────────────────────
  const Pagination = () =>
    totalPages <= 1 ? null : (
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, plans.length)} of {plans.length} plans
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`h-7 min-w-[28px] rounded text-xs font-medium px-2 transition-colors ${
                i === page
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-muted"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={page === totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 sm:p-5">
        {/* ── Top bar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Plan Dashboard</h1>
          <div className="ml-auto flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border rounded-md overflow-hidden text-xs font-medium">
              <button
                onClick={() => setView("grid")}
                className={`px-3 py-1.5 transition-colors ${
                  view === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setView("table")}
                className={`px-3 py-1.5 transition-colors ${
                  view === "table"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                Table
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPlans}
              disabled={loading}
              className="h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading plans…
          </div>
        )}

        {/* ── Grid view ────────────────────────────────────────────────── */}
        {!loading && view === "grid" && (
          <>
            <div className="grid gap-3 grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pagePlans.map((plan) => {
                const pct =
                  plan.total_rolls > 0
                    ? Math.round((plan.weight_updated_rolls / plan.total_rolls) * 100)
                    : 0;
                return (
                  <div
                    key={plan.id}
                    onClick={() => navigateTo(plan)}
                    className={`hover-lift cursor-pointer p-2 border-2 rounded-lg transition-all duration-300 ${
                      plan.is_complete
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {plan.is_complete ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium truncate">
                        {plan.frontend_id || plan.id}
                      </span>
                    </div>
                    <div className="text-xl font-bold">
                      {plan.weight_updated_rolls}/{plan.total_rolls}
                    </div>
                    <div className="w-full h-1 rounded-full bg-gray-200 overflow-hidden my-1">
                      <div
                        className={`h-full rounded-full ${
                          plan.is_complete ? "bg-green-500" : "bg-red-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {new Date(plan.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                );
              })}
            </div>
            <Pagination />
          </>
        )}

        {/* ── Table view ───────────────────────────────────────────────── */}
        {!loading && view === "table" && (
          <>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10 text-center text-sm">#</TableHead>
                    <TableHead className="font-semibold text-foreground text-sm">Plan ID</TableHead>
                    <TableHead className="font-semibold text-foreground text-sm min-w-[160px]">Progress</TableHead>
                    <TableHead className="font-semibold text-foreground text-sm text-center">Rolls</TableHead>
                    <TableHead className="font-semibold text-foreground text-sm">Status</TableHead>
                    <TableHead className="font-semibold text-foreground text-sm">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagePlans.map((plan, idx) => {
                    const pct =
                      plan.total_rolls > 0
                        ? Math.round((plan.weight_updated_rolls / plan.total_rolls) * 100)
                        : 0;
                    return (
                      <TableRow
                        key={plan.id}
                        className={`cursor-pointer transition-colors hover:bg-muted/40 ${
                          plan.is_complete ? "bg-green-50/40" : "bg-red-50/30"
                        }`}
                        onClick={() => navigateTo(plan)}
                      >
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {page * PAGE_SIZE + idx + 1}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-base font-mono">
                            {plan.frontend_id || plan.id}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  plan.is_complete ? "bg-green-500" : "bg-red-400"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-sm font-semibold w-10 text-right ${
                              plan.is_complete ? "text-green-700" : "text-red-600"
                            }`}>
                              {pct}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-base font-semibold">
                            {plan.weight_updated_rolls}
                            <span className="text-muted-foreground font-normal">/{plan.total_rolls}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1 text-sm font-medium px-2.5 py-0.5 rounded-full ${
                            plan.is_complete
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {plan.is_complete ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5" />
                            )}
                            {plan.is_complete ? "Complete" : "Pending"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(plan.created_at).toLocaleDateString("en-IN")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Pagination />
          </>
        )}

        {!loading && plans.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">No plans found.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
