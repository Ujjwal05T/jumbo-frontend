/**
 * Planning page - NEW FLOW: 3-input/4-output optimization workflow
 */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { 
  processMultipleOrders,
  generateCuttingPlan,
  validateCuttingPlan,
  getWorkflowStatus,
  convertOrdersToRequirements,
  groupCutRollsBySpec,
  calculateEfficiencyMetrics,
  formatPaperSpec,
  getStatusBadgeVariant as getNewFlowStatusBadgeVariant,
  OptimizationResult,
  WorkflowProcessRequest,
  CuttingPlanRequest
} from "@/lib/new-flow";
import { 
  selectCutRollsForProduction,
  CutRollProductionRequest
} from "@/lib/production";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  AlertCircle,
  Factory,
  QrCode,
  X,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import { fetchOrders, Order } from "@/lib/orders";
import { PRODUCTION_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import jsPDF from "jspdf";

// NEW FLOW: Updated interfaces
interface PlanGenerationResult extends OptimizationResult {
  plan_id?: string;
  validation_result?: any;
  next_steps?: string[];
}

interface ProductionRecord {
  id: string;
  qr_code: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  status: string;
  actual_weight_kg?: number;
  selected_at: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

function ConfirmationDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>
  );
}

function ProductionRecordsErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ErrorBoundaryState>({ hasError: false });

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setState({ hasError: true, error: event.error });
    };

    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("error", handleError);
    };
  }, []);

  if (state.hasError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Production Records Error</AlertTitle>
        <AlertDescription>
          Unable to load production records. Please refresh the page and try
          again.
          {state.error && (
            <details className="mt-2">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="text-xs mt-1 overflow-auto">
                {state.error.message}
              </pre>
            </details>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}

export default function PlanningPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [planResult, setPlanResult] = useState<PlanGenerationResult | null>(
    null
  );
  const [selectedCutRolls, setSelectedCutRolls] = useState<number[]>([]);
  const [productionRecords, setProductionRecords] = useState<
    ProductionRecord[]
  >([]);
  const [creatingProduction, setCreatingProduction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedQRCode, setSelectedQRCode] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [qrModalLoading, setQrModalLoading] = useState(false);
  const [expandedRollSets, setExpandedRollSets] = useState<Set<string>>(
    new Set()
  );
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Memoized computations for performance
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => order.status === "created");
  }, [orders]);

  const orderTableData = useMemo(() => {
    return filteredOrders.map((order) => ({
      ...order,
      aggregatedPaper: (() => {
        const firstItem = order.order_items?.[0];
        const paper = firstItem?.paper;
        if (paper) {
          return `${paper.gsm}gsm, ${paper.bf}bf, ${paper.shade}`;
        }
        // Fallback: aggregate all paper specs from order items
        const uniqueSpecs = Array.from(
          new Set(
            order.order_items
              ?.filter((item) => item.paper)
              .map(
                (item) =>
                  `${item.paper!.gsm}gsm, ${item.paper!.bf}bf, ${
                    item.paper!.shade
                  }`
              )
          )
        );
        return uniqueSpecs.length > 0 ? uniqueSpecs.join("; ") : "N/A";
      })(),
      aggregatedWidths: (() => {
        const widths = order.order_items?.map(
          (item) => `${item.width_inches}&quot;`
        );
        return widths?.length ? [...new Set(widths)].join(", ") : "N/A";
      })(),
      totalQuantity:
        order.order_items?.reduce(
          (total, item) => total + item.quantity_rolls,
          0
        ) || 0,
    }));
  }, [filteredOrders]);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        const data = await fetchOrders();
        console.log("Fetched orders:", data);
        setOrders(data);
      } catch (err) {
        const errorMessage = "Failed to load orders. Please try again.";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  const handleOrderSelect = useCallback((orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedOrders(checked ? filteredOrders.map((order) => order.id) : []);
    },
    [filteredOrders]
  );

  const handleCutRollSelect = useCallback((index: number) => {
    setSelectedCutRolls((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }, []);

  const handleSelectAllCutRolls = useCallback(
    (checked: boolean) => {
      setSelectedCutRolls(
        checked
          ? planResult?.cut_rolls_generated.map(
              (_, index) => index
            ) || []
          : []
      );
    },
    [planResult]
  );

  const generatePlan = async () => {
    if (selectedOrders.length === 0) {
      const errorMessage = "Please select at least one order to generate a plan.";
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const user_id = localStorage.getItem("user_id");
      if (!user_id) {
        throw new Error("User not authenticated");
      }

      // NEW FLOW: Use the 3-input/4-output workflow
      const request: WorkflowProcessRequest = {
        order_ids: selectedOrders,
        user_id: user_id,
        include_pending_orders: true,
        include_available_inventory: true
      };

      const optimizationResult = await processMultipleOrders(request);
      
      // Validate the plan automatically
      const validationResult = await validateCuttingPlan(optimizationResult);
      
      const planResult: PlanGenerationResult = {
        ...optimizationResult,
        validation_result: validationResult,
        next_steps: [
          "Review optimization results and efficiency metrics",
          "Select cut rolls for production",
          "Validate plan constraints and waste levels",
          "Start production with selected rolls",
          `Procure ${optimizationResult.jumbo_rolls_needed} jumbo rolls (${optimizationResult.jumbo_rolls_needed * 3} individual 118" rolls)`
        ]
      };

      setPlanResult(planResult);
      setActiveTab("cut-rolls");
      
      if (validationResult.is_valid) {
        toast.success(`Plan generated successfully! Efficiency: ${calculateEfficiencyMetrics(optimizationResult.cut_rolls_generated).averageEfficiency.toFixed(1)}%`);
      } else {
        toast.warning(`Plan generated with ${validationResult.violations.length} constraint violations`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate plan";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateProductionRecords = () => {
    if (selectedCutRolls.length === 0) {
      const errorMessage = "Please select at least one cut roll for production.";
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }
    setShowConfirmDialog(true);
  };

  const createProductionRecords = async () => {
    setShowConfirmDialog(false);

    try {
      setCreatingProduction(true);
      setError(null);

      const user_id = localStorage.getItem("user_id");
      if (!user_id) {
        throw new Error("User not authenticated");
      }

      // NEW FLOW: Prepare cut roll selections for production
      const selectedRolls = selectedCutRolls.map((index) => {
        const cutRoll = planResult!.cut_rolls_generated[index];
        
        // DEBUG: Log cut roll data to see what's available
        console.log('🔍 DEBUG Frontend: Cut roll data for production:', cutRoll);
        
        // Try to find paper_id from the cut roll, or fallback to other fields
        let paper_id = cutRoll.paper_id || '';
        
        // If paper_id is empty, try to find it from order data or create a lookup
        if (!paper_id && cutRoll.order_id) {
          const orderFound = orders.find(o => o.id === cutRoll.order_id);
          if (orderFound?.order_items?.[0]?.paper_id) {
            paper_id = orderFound.order_items[0].paper_id;
            console.log('✅ DEBUG Frontend: Found paper_id from order:', paper_id);
          }
        }
        
        // If still no paper_id, look for one in the original selected orders
        if (!paper_id && selectedOrders.length > 0) {
          const firstOrder = orders.find(o => selectedOrders.includes(o.id));
          if (firstOrder?.order_items?.[0]?.paper_id) {
            paper_id = firstOrder.order_items[0].paper_id;
            console.log('✅ DEBUG Frontend: Using fallback paper_id from first selected order:', paper_id);
          }
        }
        
        console.log('🔍 DEBUG Frontend: Final paper_id for cut roll:', paper_id);
        
        return {
          paper_id: paper_id,
          width_inches: cutRoll.width,
          qr_code: `CUT_${Date.now()}_${index}`, // Generate temporary QR code
          cutting_pattern: `Roll #${cutRoll.individual_roll_number || 'N/A'}`
        };
      });

      const productionRequest: CutRollProductionRequest = {
        plan_id: planResult?.plan_id,
        selected_rolls: selectedRolls,
        created_by_id: user_id
      };

      const response = await selectCutRollsForProduction(productionRequest);

      // Update UI with the production response
      setProductionRecords(response.selected_rolls.map(roll => ({
        id: roll.inventory_id,
        qr_code: roll.qr_code,
        width_inches: roll.width_inches,
        gsm: planResult!.cut_rolls_generated[0]?.gsm || 0,
        bf: planResult!.cut_rolls_generated[0]?.bf || 0,
        shade: planResult!.cut_rolls_generated[0]?.shade || '',
        status: roll.status,
        selected_at: new Date().toISOString()
      })));

      setActiveTab("production");
      
      toast.success(
        `Production started successfully! Created ${response.production_summary.total_inventory_items_created} inventory records.`
      );

      console.log("Production started:", response);

    } catch (err) {
      const errorMessage = err instanceof Error
          ? err.message
          : "Failed to start production";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Production start error:", err);
    } finally {
      setCreatingProduction(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "selected":
        return "outline";
      case "in_production":
        return "secondary";
      case "completed":
        return "default";
      case "quality_check":
        return "destructive";
      case "delivered":
        return "default";
      default:
        return "outline";
    }
  };

  const toggleRollSetExpansion = (specKey: string, rollNumber: string) => {
    const key = `${specKey}-${rollNumber}`;
    const newExpanded = new Set(expandedRollSets);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRollSets(newExpanded);
  };

  const handleRollSetSelection = (
    specKey: string,
    rollNumber: string,
    rollsInNumber: Array<CutRoll & { originalIndex: number }>
  ) => {
    const indices = rollsInNumber.map((roll) => roll.originalIndex);
    const allSelected = indices.every((i) => selectedCutRolls.includes(i));

    if (allSelected) {
      setSelectedCutRolls((prev) => prev.filter((i) => !indices.includes(i)));
    } else {
      setSelectedCutRolls((prev) => [...new Set([...prev, ...indices])]);
    }
  };

  const generatePDF = async () => {
    if (!planResult) return;

    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // Helper function to check if we need a new page
      const checkPageBreak = (height: number) => {
        if (yPosition + height > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
      };

      // Title
      pdf.setFontSize(20);
      pdf.setTextColor(40, 40, 40);
      pdf.text("Production Planning Report", 20, yPosition);
      yPosition += 15;

      // Date
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, 20, yPosition);
      yPosition += 20;

      // Summary Section
      checkPageBreak(40);
      pdf.setFontSize(16);
      pdf.setTextColor(40, 40, 40);
      pdf.text("Summary", 20, yPosition);
      yPosition += 15;

      const summaryData = [
        [
          "Total Cut Rolls",
          planResult.selection_data.summary.total_cut_rolls.toString(),
        ],
        [
          'Individual 118" Rolls',
          planResult.selection_data.summary.total_individual_118_rolls.toString(),
        ],
        [
          "Jumbo Roll Sets Needed",
          planResult.selection_data.summary.jumbo_roll_sets_needed.toString(),
        ],
        [
          "Pending Orders",
          planResult.selection_data.summary.pending_orders_count.toString(),
        ],
        ["Selected Cut Rolls", selectedCutRolls.length.toString()],
      ];

      pdf.setFontSize(12);
      summaryData.forEach(([label, value]) => {
        checkPageBreak(8);
        pdf.setTextColor(60, 60, 60);
        pdf.text(`${label}:`, 20, yPosition);
        pdf.setTextColor(40, 40, 40);
        pdf.text(value, 120, yPosition);
        yPosition += 8;
      });

      yPosition += 10;

      // Jumbo Roll Sets Section
      if (planResult.selection_data.summary.jumbo_roll_sets_needed > 0) {
        checkPageBreak(30);
        pdf.setFontSize(16);
        pdf.setTextColor(40, 40, 40);
        pdf.text("Jumbo Roll Sets Required", 20, yPosition);
        yPosition += 15;

        pdf.setFontSize(12);
        pdf.setTextColor(60, 60, 60);
        pdf.text(
          `Total sets needed: ${planResult.selection_data.summary.jumbo_roll_sets_needed}`,
          20,
          yPosition
        );
        yPosition += 8;
        pdf.text(`Each set contains 3 rolls of 118" width`, 20, yPosition);
        yPosition += 8;
        pdf.text(
          `Total 118" rolls required: ${
            planResult.selection_data.summary.jumbo_roll_sets_needed * 3
          }`,
          20,
          yPosition
        );
        yPosition += 15;
      }

      // Cut Rolls by Specification
      checkPageBreak(30);
      pdf.setFontSize(16);
      pdf.setTextColor(40, 40, 40);
      pdf.text("Cut Rolls by Specification", 20, yPosition);
      yPosition += 15;

      // Group cut rolls by specification
      const groupedRolls = planResult.selection_data.cut_rolls_available.reduce(
        (groups, roll, index) => {
          const key = `${roll.gsm}gsm, ${roll.bf}bf, ${roll.shade}`;
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push({ ...roll, originalIndex: index });
          return groups;
        },
        {} as Record<string, Array<CutRoll & { originalIndex: number }>>
      );

      Object.entries(groupedRolls).forEach(([specKey, rolls]) => {
        checkPageBreak(25);

        // Specification header
        pdf.setFontSize(14);
        pdf.setTextColor(40, 40, 40);
        pdf.text(specKey, 20, yPosition);
        yPosition += 10;

        // Group by roll number
        const rollsByNumber = rolls.reduce((rollGroups, roll) => {
          const rollNum = roll.individual_roll_number || "No Roll #";
          if (!rollGroups[rollNum]) {
            rollGroups[rollNum] = [];
          }
          rollGroups[rollNum].push(roll);
          return rollGroups;
        }, {} as Record<string, Array<CutRoll & { originalIndex: number }>>);

        Object.entries(rollsByNumber).forEach(([rollNumber, rollsInNumber]) => {
          checkPageBreak(20);

          pdf.setFontSize(12);
          pdf.setTextColor(60, 60, 60);
          const rollTitle =
            rollNumber === "No Roll #"
              ? "Unassigned Roll"
              : `Roll #${rollNumber}`;
          pdf.text(rollTitle, 25, yPosition);
          yPosition += 8;

          // Roll statistics
          const totalUsed = rollsInNumber.reduce(
            (sum, roll) => sum + roll.width,
            0
          );
          const waste = 118 - totalUsed;
          const efficiency = ((totalUsed / 118) * 100).toFixed(1);

          pdf.setFontSize(10);
          pdf.setTextColor(80, 80, 80);
          pdf.text(
            `Used: ${totalUsed}" | Waste: ${waste.toFixed(
              1
            )}" | Efficiency: ${efficiency}% | Cuts: ${rollsInNumber.length}`,
            30,
            yPosition
          );
          yPosition += 8;

          // Individual cuts
          const selectedInThisRoll = rollsInNumber.filter((roll) =>
            selectedCutRolls.includes(roll.originalIndex)
          ).length;
          pdf.text(
            `Selected for production: ${selectedInThisRoll}/${rollsInNumber.length} cuts`,
            30,
            yPosition
          );
          yPosition += 10;
        });

        yPosition += 5;
      });

      // Pending Orders Section
      if (planResult.selection_data.pending_orders.length > 0) {
        checkPageBreak(30);
        pdf.setFontSize(16);
        pdf.setTextColor(220, 38, 38);
        pdf.text("Pending Orders", 20, yPosition);
        yPosition += 15;

        planResult.selection_data.pending_orders.forEach((order, index) => {
          checkPageBreak(8);
          pdf.setFontSize(10);
          pdf.setTextColor(80, 80, 80);
          pdf.text(
            `${order.width}" × ${order.quantity} rolls (${order.gsm}gsm, ${order.bf}bf, ${order.shade}) - ${order.reason}`,
            25,
            yPosition
          );
          yPosition += 8;
        });
      }

      // Next Steps
      checkPageBreak(30);
      pdf.setFontSize(16);
      pdf.setTextColor(40, 40, 40);
      pdf.text("Next Steps", 20, yPosition);
      yPosition += 15;

      const nextSteps = [
        "1. Review selected cut rolls for production",
        "2. Procure required jumbo roll sets",
        "3. Execute cutting plans",
        "4. Generate QR codes for production tracking",
        "5. Monitor production progress",
      ];

      nextSteps.forEach((step) => {
        checkPageBreak(8);
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        pdf.text(step, 25, yPosition);
        yPosition += 8;
      });

      // Save the PDF
      pdf.save(`production-planning-${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      const errorMessage = "Failed to generate PDF. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6 m-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Production Planning - New Flow</h1>
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={generatePlan}
            disabled={generating || selectedOrders.length === 0}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Plan...
              </>
            ) : (
              "Generate Plan"
            )}
          </Button>
          {planResult && (
            <>
              <Button
                variant="outline"
                onClick={generatePDF}
                disabled={generatingPDF}>
                {generatingPDF ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate PDF Report
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={handleCreateProductionRecords}
                disabled={creatingProduction || selectedCutRolls.length === 0}>
                {creatingProduction ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Production...
                  </>
                ) : (
                  <>
                    <Factory className="mr-2 h-4 w-4" />
                    Start Production ({selectedCutRolls.length} rolls)
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="cut-rolls" disabled={!planResult}>
            Cut Rolls
          </TabsTrigger>
          <TabsTrigger value="pending-inventory" disabled={!planResult}>
            Pending & Inventory
          </TabsTrigger>
          <TabsTrigger
            value="production"
            disabled={productionRecords.length === 0}>
            Production
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardDescription>
                Select orders to include in the production plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            selectedOrders.length > 0 &&
                            selectedOrders.length === filteredOrders.length
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Paper</TableHead>
                      <TableHead>Width (in)</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          <div className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading orders...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : orderTableData.length > 0 ? (
                      orderTableData.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={() =>
                                handleOrderSelect(order.id)
                              }
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {order.id.split("-")[0]}
                          </TableCell>
                          <TableCell>
                            {order.client?.company_name || "N/A"}
                          </TableCell>
                          <TableCell>{order.aggregatedPaper}</TableCell>
                          <TableCell>{order.aggregatedWidths}</TableCell>
                          <TableCell>{order.totalQuantity} rolls</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {order.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          No pending orders found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cut-rolls">
          {planResult && (
            <div className="space-y-6">
              {/* Summary Cards - NEW FLOW */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl text-primary">
                      {planResult.summary.total_cut_rolls}
                    </CardTitle>
                    <CardDescription>Total Cut Rolls</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl text-blue-600">
                      {planResult.jumbo_rolls_needed}
                    </CardTitle>
                    <CardDescription>
                      Jumbo Rolls Needed (CORRECTED)
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl text-green-600">
                      {calculateEfficiencyMetrics(planResult.cut_rolls_generated).averageEfficiency.toFixed(1)}%
                    </CardTitle>
                    <CardDescription>
                      Material Efficiency
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl text-orange-600">
                      {planResult.summary.total_pending_orders}
                    </CardTitle>
                    <CardDescription>Pending Orders</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              {/* Jumbo Roll Sets - Brief Summary - NEW FLOW */}
              {planResult.jumbo_rolls_needed > 0 && (
                <div className="mb-6 p-4 bg-muted/50 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold">
                          {planResult.jumbo_rolls_needed}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          Jumbo Rolls Required (CORRECTED)
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {planResult.jumbo_rolls_needed} jumbo rolls × 3 individual rolls = {planResult.jumbo_rolls_needed * 3} total 118&quot; rolls
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Algorithm: {planResult.summary.algorithm_note}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      NEW FLOW Ready
                    </Badge>
                  </div>
                </div>
              )}

              {/* Cut Rolls Selection - Enhanced with Roll Numbers and Cutting Visualization */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Cut Rolls Available for Production</CardTitle>
                      <CardDescription>
                        Select rolls to move to production phase - organized by
                        paper specification and roll number
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        {selectedCutRolls.length} of{" "}
                        {planResult.cut_rolls_generated.length}{" "}
                        selected
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectAllCutRolls(true)}>
                          ✓ Select All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectAllCutRolls(false)}>
                          ✗ Select None
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Group by paper specifications - NEW FLOW */}
                  {(() => {
                    const groupedRolls = groupCutRollsBySpec(planResult.cut_rolls_generated);
                    const groupedWithIndex = Object.fromEntries(
                      Object.entries(groupedRolls).map(([key, rolls]) => [
                        key.replace(/-/g, ', '),
                        rolls.map((roll, idx) => ({ 
                          ...roll, 
                          originalIndex: planResult.cut_rolls_generated.findIndex(r => r === roll)
                        }))
                      ])
                    );

                    return Object.entries(groupedWithIndex).map(
                      ([specKey, rolls]) => {
                        // Group rolls by roll number within each specification
                        const rollsByNumber = rolls.reduce(
                          (rollGroups, roll) => {
                            const rollNum =
                              roll.individual_roll_number || "No Roll #";
                            if (!rollGroups[rollNum]) {
                              rollGroups[rollNum] = [];
                            }
                            rollGroups[rollNum].push(roll);
                            return rollGroups;
                          },
                          {} as Record<
                            string,
                            Array<CutRoll & { originalIndex: number }>
                          >
                        );

                        return (
                          <div
                            key={specKey}
                            className="mb-8 border rounded-lg p-4 bg-card">
                            {/* Specification Header */}
                            <div className="flex justify-between items-center mb-4 pb-3 border-b">
                              <div className="flex items-center gap-4">
                                <Checkbox
                                  checked={rolls.every((roll) =>
                                    selectedCutRolls.includes(
                                      roll.originalIndex
                                    )
                                  )}
                                  onCheckedChange={(checked) => {
                                    const indices = rolls.map(
                                      (roll) => roll.originalIndex
                                    );
                                    if (checked) {
                                      setSelectedCutRolls((prev) => [
                                        ...new Set([...prev, ...indices]),
                                      ]);
                                    } else {
                                      setSelectedCutRolls((prev) =>
                                        prev.filter((i) => !indices.includes(i))
                                      );
                                    }
                                  }}
                                />
                                <h3 className="text-xl font-bold text-foreground">
                                  {specKey}
                                </h3>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="secondary" className="text-sm">
                                  {rolls.length} total rolls
                                </Badge>
                                <Badge variant="outline" className="text-sm">
                                  {
                                    rolls.filter((roll) =>
                                      selectedCutRolls.includes(
                                        roll.originalIndex
                                      )
                                    ).length
                                  }{" "}
                                  selected
                                </Badge>
                              </div>
                            </div>

                            {/* Rolls organized by Roll Number */}
                            <div className="space-y-6">
                              {Object.entries(rollsByNumber).map(
                                ([rollNumber, rollsInNumber]) => (
                                  <div
                                    key={rollNumber}
                                    className="bg-background border rounded-lg p-4 shadow-sm">
                                    {/* Roll Number Header */}
                                    <div className="flex justify-between items-center mb-3 pb-2 border-b">
                                      <div className="flex items-center gap-3">
                                        <Checkbox
                                          checked={rollsInNumber.every((roll) =>
                                            selectedCutRolls.includes(
                                              roll.originalIndex
                                            )
                                          )}
                                          onCheckedChange={() =>
                                            handleRollSetSelection(
                                              specKey,
                                              rollNumber,
                                              rollsInNumber
                                            )
                                          }
                                        />
                                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                                          {rollNumber === "No Roll #"
                                            ? "?"
                                            : rollNumber}
                                        </div>
                                        <h4 className="text-lg font-semibold text-foreground">
                                          {rollNumber === "No Roll #"
                                            ? "Unassigned Roll"
                                            : `Roll #${rollNumber}`}
                                        </h4>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline">
                                          {rollsInNumber.length} cuts
                                        </Badge>
                                        <Badge
                                          variant={
                                            rollsInNumber.every((roll) =>
                                              selectedCutRolls.includes(
                                                roll.originalIndex
                                              )
                                            )
                                              ? "default"
                                              : "secondary"
                                          }>
                                          {
                                            rollsInNumber.filter((roll) =>
                                              selectedCutRolls.includes(
                                                roll.originalIndex
                                              )
                                            ).length
                                          }{" "}
                                          selected
                                        </Badge>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            toggleRollSetExpansion(
                                              specKey,
                                              rollNumber
                                            )
                                          }>
                                          {expandedRollSets.has(
                                            `${specKey}-${rollNumber}`
                                          ) ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Visual Cutting Representation */}
                                    <div className="mb-4">
                                      <div className="text-sm font-medium text-muted-foreground mb-2">
                                        Cutting Pattern (118&quot; Jumbo Roll):
                                      </div>
                                      <div className="relative h-12 bg-muted rounded-lg border overflow-hidden">
                                        {/* Show how cuts are made from 118" roll */}
                                        {(() => {
                                          let currentPosition = 0;
                                          const totalUsed =
                                            rollsInNumber.reduce(
                                              (sum, roll) => sum + roll.width,
                                              0
                                            );
                                          const waste = 118 - totalUsed;
                                          const wastePercentage =
                                            (waste / 118) * 100;

                                          return (
                                            <>
                                              {/* Cut sections */}
                                              {rollsInNumber.map(
                                                (roll, cutIndex) => {
                                                  const widthPercentage =
                                                    (roll.width / 118) * 100;
                                                  const leftPosition =
                                                    (currentPosition / 118) *
                                                    100;
                                                  currentPosition += roll.width;

                                                  return (
                                                    <div
                                                      key={cutIndex}
                                                      className={`absolute h-full border-r-2 border-white ${
                                                        selectedCutRolls.includes(
                                                          roll.originalIndex
                                                        )
                                                          ? "bg-gradient-to-r from-green-400 to-green-500"
                                                          : "bg-gradient-to-r from-blue-400 to-blue-500"
                                                      }`}
                                                      style={{
                                                        left: `${leftPosition}%`,
                                                        width: `${widthPercentage}%`,
                                                      }}>
                                                      <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                                        {roll.width}&quot;
                                                      </div>
                                                    </div>
                                                  );
                                                }
                                              )}

                                              {/* Waste section */}
                                              {waste > 0 && (
                                                <div
                                                  className="absolute h-full bg-gradient-to-r from-red-400 to-red-500 border-l-2 border-white"
                                                  style={{
                                                    right: "0%",
                                                    width: `${wastePercentage}%`,
                                                  }}>
                                                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                                    Waste: {waste.toFixed(1)}
                                                    &quot;
                                                  </div>
                                                </div>
                                              )}

                                              {/* 118" total indicator */}
                                              <div className="absolute -bottom-6 left-0 right-0 text-center text-xs text-slate-600 font-medium">
                                                118&quot; Total Width
                                              </div>
                                            </>
                                          );
                                        })()}
                                      </div>

                                      {/* Cutting Statistics */}
                                      <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                                        <div className="text-center p-3 bg-primary/10 border rounded-lg">
                                          <div className="font-semibold text-primary">
                                            {rollsInNumber.reduce(
                                              (sum, roll) => sum + roll.width,
                                              0
                                            )}
                                            &quot;
                                          </div>
                                          <div className="text-muted-foreground">
                                            Used Width
                                          </div>
                                        </div>
                                        <div className="text-center p-3 bg-destructive/10 border rounded-lg">
                                          <div className="font-semibold text-destructive">
                                            {(
                                              118 -
                                              rollsInNumber.reduce(
                                                (sum, roll) => sum + roll.width,
                                                0
                                              )
                                            ).toFixed(1)}
                                            &quot;
                                          </div>
                                          <div className="text-muted-foreground">
                                            Waste
                                          </div>
                                        </div>
                                        <div className="text-center p-3 bg-green-500/10 border rounded-lg">
                                          <div className="font-semibold text-green-700">
                                            {(
                                              (rollsInNumber.reduce(
                                                (sum, roll) => sum + roll.width,
                                                0
                                              ) /
                                                118) *
                                              100
                                            ).toFixed(1)}
                                            %
                                          </div>
                                          <div className="text-muted-foreground">
                                            Efficiency
                                          </div>
                                        </div>
                                        <div className="text-center p-3 bg-secondary border rounded-lg">
                                          <div className="font-semibold text-secondary-foreground">
                                            {rollsInNumber.length}
                                          </div>
                                          <div className="text-muted-foreground">
                                            Total Cuts
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Individual Cut Rolls - Collapsible */}
                                    {expandedRollSets.has(
                                      `${specKey}-${rollNumber}`
                                    ) && (
                                      <div className="space-y-2 mt-4 pt-4 border-t">
                                        <h5 className="text-sm font-medium text-muted-foreground mb-2">
                                          Individual Cut Rolls:
                                        </h5>
                                        {rollsInNumber.map((roll) => (
                                          <div
                                            key={roll.originalIndex}
                                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${
                                              selectedCutRolls.includes(
                                                roll.originalIndex
                                              )
                                                ? "bg-primary/10 border-primary"
                                                : "bg-muted/50 border-border hover:bg-muted"
                                            }`}
                                            onClick={() =>
                                              handleCutRollSelect(
                                                roll.originalIndex
                                              )
                                            }>
                                            <div className="flex items-center gap-3">
                                              <Checkbox
                                                checked={selectedCutRolls.includes(
                                                  roll.originalIndex
                                                )}
                                                onChange={() => {}}
                                              />
                                              <div className="flex items-center gap-3">
                                                <div className="text-xl font-bold text-foreground">
                                                  {roll.width}&quot;
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                  Width
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-sm">
                                              <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground">
                                                  Source:
                                                </span>
                                                <Badge
                                                  variant={
                                                    roll.source === "cutting"
                                                      ? "default"
                                                      : "secondary"
                                                  }
                                                  className="text-xs">
                                                  {roll.source}
                                                </Badge>
                                              </div>
                                              {roll.trim_left && (
                                                <div className="flex items-center gap-2">
                                                  <span className="text-muted-foreground">
                                                    Trim:
                                                  </span>
                                                  <span className="font-medium text-foreground">
                                                    {roll.trim_left}&quot;
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        );
                      }
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending-inventory">
          {planResult && (
            <div className="space-y-6">
              {/* Pending Orders - NEW FLOW */}
              {planResult.pending_orders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Orders</CardTitle>
                    <CardDescription>
                      Orders that could not be fulfilled in this plan
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Width (in)</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Paper Spec</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {planResult.pending_orders.map(
                          (order, index) => (
                            <TableRow key={index}>
                              <TableCell>{order.width}&quot;</TableCell>
                              <TableCell>{order.quantity} rolls</TableCell>
                              <TableCell>
                                {formatPaperSpec(order.gsm, order.bf, order.shade)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="destructive">
                                  {order.reason}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Inventory Items to Add - NEW FLOW */}
              {planResult.inventory_remaining.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Inventory Items to Add</CardTitle>
                    <CardDescription>
                      20-25&quot; waste rolls that will be added to inventory
                      for future use
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Width (in)</TableHead>
                          <TableHead>Paper Spec</TableHead>
                          <TableHead>Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {planResult.inventory_remaining.map(
                          (item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.width}&quot;</TableCell>
                              <TableCell>
                                {formatPaperSpec(item.gsm, item.bf, item.shade)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.source}</Badge>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="production">
          <ProductionRecordsErrorBoundary>
            {productionRecords.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Production Records</CardTitle>
                  <CardDescription>
                    Cut rolls moved to production with QR codes generated
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>QR Code</TableHead>
                        <TableHead>Width (in)</TableHead>
                        <TableHead>Paper Spec</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Weight (kg)</TableHead>
                        <TableHead>Selected At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setQrModalLoading(true);
                                  setSelectedQRCode(record.qr_code);
                                  // Simulate loading time for QR code generation
                                  setTimeout(
                                    () => setQrModalLoading(false),
                                    300
                                  );
                                }}
                                aria-label={`View QR code for ${record.qr_code}`}>
                                <QrCode className="h-4 w-4" />
                              </Button>
                              <code className="text-sm">{record.qr_code}</code>
                            </div>
                          </TableCell>
                          <TableCell>{record.width_inches}&quot;</TableCell>
                          <TableCell>
                            {record.gsm}gsm, {record.bf}bf, {record.shade}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getStatusBadgeVariant(record.status)}>
                              {record.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {record.actual_weight_kg || "-"}
                          </TableCell>
                          <TableCell>
                            {new Date(record.selected_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </ProductionRecordsErrorBoundary>
        </TabsContent>
      </Tabs>

      {planResult && (
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2">
              {planResult.next_steps.map((step, index) => (
                <li key={index} className="text-sm">
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* QR Code Display Modal */}
      {selectedQRCode && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedQRCode(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSelectedQRCode(null);
            }
          }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title">
          <div className="bg-background p-4 rounded-lg max-w-sm w-full mx-4">
            {qrModalLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 id="qr-modal-title" className="text-lg font-semibold">
                    Cut Roll QR Code
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedQRCode(null)}
                    aria-label="Close QR code modal">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <QRCodeDisplay
                  value={selectedQRCode}
                  title="Cut Roll QR Code"
                  description={`Production QR Code`}
                  size={200}
                  showActions={true}
                />
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => setSelectedQRCode(null)}>
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        title="Confirm Production Creation"
        message={`Are you sure you want to move ${selectedCutRolls.length} cut roll(s) to production? This action will generate QR codes and cannot be undone.`}
        onConfirm={createProductionRecords}
        onCancel={() => setShowConfirmDialog(false)}
        confirmText="Start Production"
      />
    </div>
  );
}
