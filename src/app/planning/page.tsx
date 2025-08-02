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
  CuttingPlanRequest,
  CutRoll
} from "@/lib/new-flow";
// Removed old production imports - now using direct API calls
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
  ScanLine,
  X,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import BarcodeDisplay from "@/components/BarcodeDisplay";
import { fetchOrders, Order } from "@/lib/orders";
import { PRODUCTION_ENDPOINTS, API_BASE_URL, createRequestOptions } from "@/lib/api-config";
import jsPDF from "jspdf";
import JsBarcode from 'jsbarcode';

// NEW FLOW: Updated interfaces
interface PlanGenerationResult extends OptimizationResult {
  plan_id?: string;
  validation_result?: any;
  next_steps?: string[];
}

interface ProductionRecord {
  id: string;
  qr_code: string;
  barcode_id?: string;
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
  const [selectedCutRolls, setSelectedCutRolls] = useState<number[]>([]); // Individual cut piece indices
  const [selected118Rolls, setSelected118Rolls] = useState<number[]>([]); // 118" roll numbers
  const [productionRecords, setProductionRecords] = useState<
    ProductionRecord[]
  >([]);
  const [creatingProduction, setCreatingProduction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [barcodeModalLoading, setBarcodeModalLoading] = useState(false);
  const [expandedRollSets, setExpandedRollSets] = useState<Set<string>>(
    new Set()
  );
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [generatingBarcodePDF, setGeneratingBarcodePDF] = useState(false);

  // Helper function to generate barcode as canvas
  const generateBarcodeCanvas = (value: string): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, value, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        textAlign: "center",
        textPosition: "bottom"
      });
    } catch (error) {
      console.error('Error generating barcode:', error);
      // Fallback: create a simple canvas with text
      canvas.width = 200;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 60);
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(value, 100, 35);
      }
    }
    return canvas;
  };

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

  // Helper function to get unique 118" roll numbers from cut rolls
  const get118RollNumbers = useCallback(() => {
    if (!planResult) return [];
    const rollNumbers = new Set<number>();
    planResult.cut_rolls_generated.forEach(roll => {
      if (roll.individual_roll_number) {
        rollNumbers.add(roll.individual_roll_number);
      }
    });
    return Array.from(rollNumbers).sort((a, b) => a - b);
  }, [planResult]);

  // Helper function to check if 118" roll selection is valid (multiples of 3)
  const isValid118RollSelection = useCallback(
    (selectedRollCount: number) => {
      return selectedRollCount === 0 || selectedRollCount % 3 === 0;
    },
    []
  );

  // Helper function to get available jumbo roll count (based on 118" rolls)
  const getAvailableJumboRolls = useCallback(() => {
    const rollNumbers = get118RollNumbers();
    return Math.floor(rollNumbers.length / 3);
  }, [get118RollNumbers]);

  // Helper function to select specific number of jumbo rolls (3 x 118" rolls each)
  const selectJumboRolls = useCallback(
    (jumboCount: number) => {
      const rollNumbers = get118RollNumbers();
      const rollsToSelect = jumboCount * 3;
      const selectedRollNumbers = rollNumbers.slice(0, rollsToSelect);
      setSelected118Rolls(selectedRollNumbers);
      
      // Also update selectedCutRolls to match the 118" roll selection
      if (!planResult) return;
      const cutRollIndices: number[] = [];
      planResult.cut_rolls_generated.forEach((roll, index) => {
        if (roll.individual_roll_number && selectedRollNumbers.includes(roll.individual_roll_number)) {
          cutRollIndices.push(index);
        }
      });
      setSelectedCutRolls(cutRollIndices);
    },
    [get118RollNumbers, planResult]
  );

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

  // Handler for selecting individual 118" rolls - ALLOWS ANY SELECTION
  const handle118RollSelect = useCallback((rollNumber: number) => {
    setSelected118Rolls((prev) => {
      const newSelection = prev.includes(rollNumber) 
        ? prev.filter((r) => r !== rollNumber) 
        : [...prev, rollNumber].sort((a, b) => a - b);
      
      // Always allow the selection - no restrictions during selection
      // Update selectedCutRolls to match the 118" roll selection
      if (planResult) {
        const cutRollIndices: number[] = [];
        planResult.cut_rolls_generated.forEach((roll, index) => {
          if (roll.individual_roll_number && newSelection.includes(roll.individual_roll_number)) {
            cutRollIndices.push(index);
          }
        });
        setSelectedCutRolls(cutRollIndices);
      }
      
      return newSelection;
    });
  }, [planResult]);

  // Legacy handler for individual cut pieces (kept for backward compatibility but discouraged)
  const handleCutRollSelect = useCallback((index: number) => {
    // This should ideally not be used - we want to select by 118" rolls
    if (!planResult) return;
    const cutRoll = planResult.cut_rolls_generated[index];
    if (cutRoll.individual_roll_number) {
      handle118RollSelect(cutRoll.individual_roll_number);
    }
  }, [planResult, handle118RollSelect]);

  const handleSelectAll118Rolls = useCallback(
    (checked: boolean) => {
      const rollNumbers = get118RollNumbers();
      
      // Select ALL available 118" rolls, not just complete jumbos
      const selectedRollNumbers = checked ? rollNumbers : [];
      
      setSelected118Rolls(selectedRollNumbers);
      
      // Update selectedCutRolls to match
      if (planResult) {
        const cutRollIndices: number[] = [];
        planResult.cut_rolls_generated.forEach((roll, index) => {
          if (roll.individual_roll_number && selectedRollNumbers.includes(roll.individual_roll_number)) {
            cutRollIndices.push(index);
          }
        });
        setSelectedCutRolls(cutRollIndices);
      }
    },
    [get118RollNumbers, planResult]
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
    if (selected118Rolls.length === 0) {
      const errorMessage = "Please select at least one 118\" roll for production.";
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }
    
    if (!isValid118RollSelection(selected118Rolls.length)) {
      const availableJumbos = getAvailableJumboRolls();
      const errorMessage = `Please select 118" rolls in multiples of 3 to match jumbo roll constraints. Available options: ${Array.from({ length: availableJumbos }, (_, i) => (i + 1) * 3).join(', ')} rolls`;
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

      // Get plan ID from the plan result (from plans_created array)
      console.log("🔍 DEBUG: Plan result structure:", planResult);
      const planId = planResult?.plans_created?.[0];
      console.log("🔍 DEBUG: Extracted plan ID:", planId);
      
      if (!planId) {
        console.error("❌ ERROR: No plan ID found in plan result:", planResult);
        throw new Error("No plan ID found. Please regenerate the plan.");
      }

      // Validate 118" roll selection before proceeding
      if (!isValid118RollSelection(selected118Rolls.length)) {
        const availableJumbos = getAvailableJumboRolls();
        toast.error(
          `Please select 118" rolls in multiples of 3 to match jumbo roll constraints. ` +
          `Available options: ${Array.from({ length: availableJumbos }, (_, i) => (i + 1) * 3).join(', ')} 118" rolls`
        );
        return;
      }

      // NEW FLOW: Prepare cut roll selections for production start
      const selectedRolls = selectedCutRolls.map((index) => {
        const cutRoll = planResult!.cut_rolls_generated[index];
        
        // Try to find paper_id from the cut roll, or fallback to other fields
        let paper_id = cutRoll.paper_id || '';
        
        // If paper_id is empty, try to find it from order data
        if (!paper_id && cutRoll.order_id) {
          const orderFound = orders.find(o => o.id === cutRoll.order_id);
          if (orderFound?.order_items?.[0]?.paper_id) {
            paper_id = orderFound.order_items[0].paper_id;
          }
        }
        
        // If still no paper_id, look for one in the original selected orders
        if (!paper_id && selectedOrders.length > 0) {
          const firstOrder = orders.find(o => selectedOrders.includes(o.id));
          if (firstOrder?.order_items?.[0]?.paper_id) {
            paper_id = firstOrder.order_items[0].paper_id;
          }
        }
        
        return {
          paper_id: paper_id,
          width_inches: cutRoll.width,
          qr_code: `CUT_ROLL_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${index}`, // Generate unique QR code
          barcode_id: `CR_${String(index + 1).padStart(5, '0')}`, // Generate barcode ID like CR_00001
          gsm: cutRoll.gsm,
          bf: cutRoll.bf,
          shade: cutRoll.shade,
          individual_roll_number: cutRoll.individual_roll_number,
          trim_left: cutRoll.trim_left,
          order_id: cutRoll.order_id
        };
      });

      // Prepare ALL available cuts (for backend to handle unselected ones)
      // SHOW ALL ROLLS - don't limit to complete jumbos, show everything the algorithm generated
      const allAvailableCuts = planResult!.cut_rolls_generated
        .map((cutRoll, index) => {
          let paper_id = cutRoll.paper_id || '';
          
          if (!paper_id && cutRoll.order_id) {
            const orderFound = orders.find(o => o.id === cutRoll.order_id);
            if (orderFound?.order_items?.[0]?.paper_id) {
              paper_id = orderFound.order_items[0].paper_id;
            }
          }
          
          if (!paper_id && selectedOrders.length > 0) {
            const firstOrder = orders.find(o => selectedOrders.includes(o.id));
            if (firstOrder?.order_items?.[0]?.paper_id) {
              paper_id = firstOrder.order_items[0].paper_id;
            }
          }
          
          return {
            paper_id: paper_id,
            width_inches: cutRoll.width,
            qr_code: `CUT_ROLL_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${index}`,
            barcode_id: `CR_${String(index + 1).padStart(5, '0')}`,
            gsm: cutRoll.gsm,
            bf: cutRoll.bf,
            shade: cutRoll.shade,
            individual_roll_number: cutRoll.individual_roll_number,
            trim_left: cutRoll.trim_left,
            order_id: cutRoll.order_id
          };
        });

      // Call the new backend endpoint for starting production with comprehensive status updates
      const productionRequest = {
        selected_cut_rolls: selectedRolls,
        all_available_cuts: allAvailableCuts,
        created_by_id: user_id
      };

      const response = await fetch(`${API_BASE_URL}/plans/${planId}/start-production`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(productionRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to start production');
      }

      const result = await response.json();

      // Create production records for UI display
      const productionRecords = selectedRolls.map((roll, index) => ({
        id: `inv_${Date.now()}_${index}`,
        qr_code: roll.qr_code,
        barcode_id: roll.barcode_id,
        width_inches: roll.width_inches,
        gsm: roll.gsm,
        bf: roll.bf,
        shade: roll.shade,
        status: "cutting",
        selected_at: new Date().toISOString()
      }));

      setProductionRecords(productionRecords);
      setActiveTab("production");
      
      // Show comprehensive success message with pending items info
      let successMessage = `Production started successfully! Updated ${result.summary.orders_updated} orders, ${result.summary.order_items_updated} order items`;
      if (result.summary.pending_items_created > 0) {
        successMessage += `, and created ${result.summary.pending_items_created} pending items from unselected rolls`;
      }
      if (result.summary.pending_orders_updated > 0) {
        successMessage += `, and updated ${result.summary.pending_orders_updated} pending orders`;
      }
      successMessage += '.';
      
      toast.success(successMessage);

      console.log("✅ Production started successfully with comprehensive status updates:", {
        planId,
        updatedOrders: result.summary.orders_updated,
        updatedOrderItems: result.summary.order_items_updated,
        updatedPendingOrders: result.summary.pending_orders_updated,
        inventoryCreated: result.summary.inventory_created
      });

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
    // Get the 118" roll number from the first roll in the set
    const roll118Number = parseInt(rollNumber);
    if (isNaN(roll118Number)) return; // Skip if no valid roll number
    
    // Use the handle118RollSelect function for proper validation
    handle118RollSelect(roll118Number);
  };

  const generatePDF = async () => {
    if (!planResult) {
      toast.error("No plan result available to generate PDF");
      return;
    }

    if (!planResult.summary) {
      toast.error("Plan result is missing summary data");
      return;
    }

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
      yPosition += 15;

      // Legend
      pdf.setFontSize(12);
      pdf.setTextColor(40, 40, 40);
      pdf.text("Color Legend:", 20, yPosition);
      yPosition += 8;

      const legendItems = [
        { color: [34, 197, 94], text: "✓ Selected for Production" },
        { color: [59, 130, 246], text: "Available but Not Selected" },
        { color: [239, 68, 68], text: "Waste Material" }
      ];

      legendItems.forEach((item, index) => {
        const legendX = 20 + (index * 65);
        
        // Draw color box
        pdf.setFillColor(...item.color);
        pdf.rect(legendX, yPosition - 3, 8, 6, 'F');
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        pdf.rect(legendX, yPosition - 3, 8, 6, 'S');
        
        // Add text
        pdf.setFontSize(8);
        pdf.setTextColor(60, 60, 60);
        pdf.text(item.text, legendX + 10, yPosition);
      });

      yPosition += 15;

      // Jumbo Roll Sets Section
      if (planResult.jumbo_rolls_needed > 0) {
        checkPageBreak(30);
        pdf.setFontSize(16);
        pdf.setTextColor(40, 40, 40);
        pdf.text("Jumbo Rolls Required", 20, yPosition);
        yPosition += 15;

        pdf.setFontSize(12);
        pdf.setTextColor(60, 60, 60);
        pdf.text(
          `Total jumbo rolls needed: ${planResult.jumbo_rolls_needed}`,
          20,
          yPosition
        );
        yPosition += 8;
        pdf.text(`Each jumbo roll contains 3 rolls of 118" width`, 20, yPosition);
        yPosition += 8;
        pdf.text(
          `Total 118" rolls produced: ${planResult.jumbo_rolls_needed * 3}`,
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
      const groupedRolls = planResult.cut_rolls_generated.reduce(
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
          checkPageBreak(30);

          pdf.setFontSize(12);
          pdf.setTextColor(60, 60, 60);
          const rollTitle =
            rollNumber === "No Roll #"
              ? "Unassigned Roll"
              : `Roll #${rollNumber}`;
          pdf.text(rollTitle, 25, yPosition);
          yPosition += 8;

          // Visual cutting pattern representation in PDF
          checkPageBreak(25);
          pdf.setFontSize(9);
          pdf.setTextColor(60, 60, 60);
          pdf.text("Cutting Pattern:", 30, yPosition);
          yPosition += 8;

          // Draw visual cutting representation
          const rectStartX = 30;
          const rectWidth = pageWidth - 60; // Leave margins
          const rectHeight = 12;
          let currentX = rectStartX;

          rollsInNumber.forEach((roll, cutIndex) => {
            const widthRatio = roll.width / 118;
            const sectionWidth = rectWidth * widthRatio;
            const isSelected = selectedCutRolls.includes(roll.originalIndex);

            // Set color based on selection
            if (isSelected) {
              pdf.setFillColor(34, 197, 94); // Green for selected
            } else {
              pdf.setFillColor(59, 130, 246); // Blue for not selected
            }

            // Draw rectangle for this cut
            pdf.rect(currentX, yPosition, sectionWidth, rectHeight, 'F');
            
            // Add border
            pdf.setDrawColor(255, 255, 255);
            pdf.setLineWidth(0.5);
            pdf.rect(currentX, yPosition, sectionWidth, rectHeight, 'S');

            // Add width text inside the rectangle
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(7);
            const textX = currentX + sectionWidth/2;
            const textY = yPosition + rectHeight/2 + 1;
            pdf.text(`${roll.width}"`, textX, textY, { align: 'center' });

            currentX += sectionWidth;
          });

          // Calculate roll statistics for visualization
          const totalUsed = rollsInNumber.reduce((sum, roll) => sum + roll.width, 0);
          const waste = 118 - totalUsed;
          const efficiency = ((totalUsed / 118) * 100).toFixed(1);

          // Draw waste section if any
          if (waste > 0) {
            const wasteRatio = waste / 118;
            const wasteWidth = rectWidth * wasteRatio;
            
            pdf.setFillColor(239, 68, 68); // Red for waste
            pdf.rect(currentX, yPosition, wasteWidth, rectHeight, 'F');
            pdf.setDrawColor(255, 255, 255);
            pdf.rect(currentX, yPosition, wasteWidth, rectHeight, 'S');
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(6);
            pdf.text(`Waste: ${waste.toFixed(1)}"`, currentX + wasteWidth/2, yPosition + rectHeight/2 + 1, { align: 'center' });
          }

          yPosition += rectHeight + 3;

          // Add 118" total indicator
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(7);
          pdf.text("118\" Total Width", rectStartX + rectWidth/2, yPosition, { align: 'center' });
          yPosition += 8;

          // Enhanced statistics boxes
          checkPageBreak(20);
          const statsY = yPosition;
          const statsBoxWidth = (rectWidth - 15) / 4; // 4 stats boxes with gaps
          const statsBoxHeight = 15;

          // Used Width box
          pdf.setDrawColor(60, 60, 60);
          pdf.setLineWidth(0.5);
          pdf.rect(rectStartX, statsY, statsBoxWidth, statsBoxHeight, 'S');
          pdf.setTextColor(40, 40, 40);
          pdf.setFontSize(10);
          pdf.text(`${totalUsed}"`, rectStartX + statsBoxWidth/2, statsY + 6, { align: 'center' });
          pdf.setFontSize(7);
          pdf.text("Used Width", rectStartX + statsBoxWidth/2, statsY + 12, { align: 'center' });

          // Waste box
          const wasteX = rectStartX + statsBoxWidth + 5;
          pdf.setDrawColor(60, 60, 60);
          pdf.setLineWidth(0.5);
          pdf.rect(wasteX, statsY, statsBoxWidth, statsBoxHeight, 'S');
          pdf.setTextColor(40, 40, 40);
          pdf.setFontSize(10);
          pdf.text(`${waste.toFixed(1)}"`, wasteX + statsBoxWidth/2, statsY + 6, { align: 'center' });
          pdf.setFontSize(7);
          pdf.text("Waste", wasteX + statsBoxWidth/2, statsY + 12, { align: 'center' });

          // Efficiency box
          const efficiencyX = wasteX + statsBoxWidth + 5;
          pdf.setDrawColor(60, 60, 60);
          pdf.setLineWidth(0.5);
          pdf.rect(efficiencyX, statsY, statsBoxWidth, statsBoxHeight, 'S');
          pdf.setTextColor(40, 40, 40);
          pdf.setFontSize(10);
          pdf.text(`${efficiency}%`, efficiencyX + statsBoxWidth/2, statsY + 6, { align: 'center' });
          pdf.setFontSize(7);
          pdf.text("Efficiency", efficiencyX + statsBoxWidth/2, statsY + 12, { align: 'center' });

          // Cuts box
          const cutsX = efficiencyX + statsBoxWidth + 5;
          pdf.setDrawColor(60, 60, 60);
          pdf.setLineWidth(0.5);
          pdf.rect(cutsX, statsY, statsBoxWidth, statsBoxHeight, 'S');
          pdf.setTextColor(40, 40, 40);
          pdf.setFontSize(10);
          pdf.text(`${rollsInNumber.length}`, cutsX + statsBoxWidth/2, statsY + 6, { align: 'center' });
          pdf.setFontSize(7);
          pdf.text("Total Cuts", cutsX + statsBoxWidth/2, statsY + 12, { align: 'center' });

          yPosition += statsBoxHeight + 10;


          yPosition += 5;
        });

        yPosition += 5;
      });

      // Pending Orders Section
      if (planResult.pending_orders.length > 0) {
        checkPageBreak(30);
        pdf.setFontSize(16);
        pdf.setTextColor(220, 38, 38);
        pdf.text("Pending Orders", 20, yPosition);
        yPosition += 15;

        planResult.pending_orders.forEach((order, index) => {
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

      // Summary Section - moved to bottom
      checkPageBreak(50);
      pdf.setFontSize(16);
      pdf.setTextColor(40, 40, 40);
      pdf.text("Production Summary", 20, yPosition);
      yPosition += 15;

      const summaryData = [
        [
          "Total Cut Rolls Generated",
          planResult.summary.total_cut_rolls.toString(),
        ],
        [
          'Individual 118" Rolls Required',
          planResult.summary.total_individual_118_rolls.toString(),
        ],
        [
          "Jumbo Rolls Needed",
          planResult.jumbo_rolls_needed.toString(),
        ],
        [
          "Total Pending Orders",
          planResult.summary.total_pending_orders.toString(),
        ],
        [
          "Selected for Production", 
          selectedCutRolls.length.toString()
        ],
        [
          "Material Efficiency",
          `${calculateEfficiencyMetrics(planResult.cut_rolls_generated).averageEfficiency.toFixed(1)}%`
        ],
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

  const generateBarcodesPDF = async () => {
    if (productionRecords.length === 0) {
      toast.error("No production records available to generate barcode labels PDF");
      return;
    }

    setGeneratingBarcodePDF(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Single column layout configuration
      const marginX = 20;
      const marginY = 20;
      const labelWidth = pageWidth - (marginX * 2);
      const itemsPerPage = 10; // More items per page since content is simpler
      
      let yPosition = marginY;
      let itemCount = 0;
      let pageCount = 1;

      // Title on first page
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Barcode Labels - Production Records`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      doc.text(`Total Items: ${productionRecords.length}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      productionRecords.forEach((record, index) => {
        // Check if we need a new page
        if (itemCount >= itemsPerPage || yPosition > pageHeight - 60) {
          doc.addPage();
          pageCount++;
          yPosition = marginY;
          itemCount = 0;
        }

        const barcodeValue = record.barcode_id || record.qr_code;
        
        // Generate and add barcode image
        try {
          const canvas = generateBarcodeCanvas(barcodeValue);
          const barcodeDataUrl = canvas.toDataURL('image/png');
          
          // Barcode at full width, centered
          const barcodeWidth = labelWidth * 0.8; // 80% of available width
          const barcodeHeight = 25;
          const barcodeX = marginX + (labelWidth - barcodeWidth) / 2;
          const barcodeY = yPosition;
          
          doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
          yPosition += barcodeHeight + 8;
          
        } catch (error) {
          console.error('Error adding barcode:', error);
          // Fallback: text representation
          doc.setFontSize(12);
          doc.setFont('courier', 'bold');
          doc.text(`|||| ${barcodeValue} ||||`, pageWidth / 2, yPosition, { align: 'center' });
          yPosition += 12;
        }

        // Paper specifications in single row
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${record.gsm}gsm, BF:${record.bf}, ${record.shade}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 12;

        // Separation line
        if (index < productionRecords.length - 1) {
          doc.setDrawColor(150, 150, 150);
          doc.setLineWidth(0.5);
          doc.line(marginX + 20, yPosition, pageWidth - marginX - 20, yPosition);
          yPosition += 15;
        }

        itemCount++;
      });

      // Add page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
      }

      doc.save(`barcode-labels-production-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Barcode labels exported to PDF successfully!');
    } catch (error) {
      console.error('Error exporting barcode PDF:', error);
      toast.error('Failed to export barcode PDF');
    } finally {
      setGeneratingBarcodePDF(false);
    }
  };

  return (
    <div className="space-y-6 m-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Production Planning </h1>
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
                disabled={creatingProduction || selected118Rolls.length === 0 || !isValid118RollSelection(selected118Rolls.length)}>
                {creatingProduction ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Production...
                  </>
                ) : (
                  <>
                    <Factory className="mr-2 h-4 w-4" />
                    Start Production ({selected118Rolls.length} × 118" rolls)
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
                      {/* Jumbo Roll Constraint Indicator */}
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="text-sm font-medium text-blue-700">
                            User Choice: Select any 118" rolls you want - production requires multiples of 3
                          </span>
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Available: {get118RollNumbers().length} individual 118" rolls total ({getAvailableJumboRolls()} complete jumbos)
                          {get118RollNumbers().length % 3 > 0 && (
                            <span className="ml-2 text-orange-600">
                              • {get118RollNumbers().length % 3} additional 118" roll(s) - your choice to include
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        {selected118Rolls.length} of{" "}
                        {get118RollNumbers().length}{" "}
                        individual 118" rolls selected
                        {selected118Rolls.length > 0 && (
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            isValid118RollSelection(selected118Rolls.length) 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {isValid118RollSelection(selected118Rolls.length) 
                              ? `✓ ${selected118Rolls.length / 3} jumbo roll${selected118Rolls.length / 3 > 1 ? 's' : ''} (${selectedCutRolls.length} cut pieces)` 
                              : `⚠ Need multiples of 3 (currently ${selected118Rolls.length} rolls)`
                            }
                          </span>
                        )}
                      </div>
                      {/* Show warning message when selection is invalid */}
                      {selected118Rolls.length > 0 && !isValid118RollSelection(selected118Rolls.length) && (
                        <div className="text-xs text-yellow-600 mt-1">
                          ⚠ Production disabled: Please select 118" rolls in multiples of 3 to match jumbo roll constraints
                        </div>
                      )}
                      <div className="flex gap-2">
                        {/* Jumbo Roll Selection Helpers */}
                        {getAvailableJumboRolls() > 0 && (
                          <>
                            {Array.from({ length: getAvailableJumboRolls() }, (_, i) => i + 1).map((jumboCount) => (
                              <Button
                                key={jumboCount}
                                size="sm"
                                variant={selected118Rolls.length === jumboCount * 3 ? "default" : "outline"}
                                onClick={() => selectJumboRolls(jumboCount)}
                                className="text-xs">
                                {jumboCount} Jumbo{jumboCount > 1 ? 's' : ''} ({jumboCount * 3} × 118" rolls)
                              </Button>
                            ))}
                            <div className="w-px h-6 bg-border mx-1" />
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectAll118Rolls(true)}>
                          ✓ Select All 118" Rolls
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectAll118Rolls(false)}>
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
                                          checked={(() => {
                                            const roll118Number = parseInt(rollNumber);
                                            return !isNaN(roll118Number) && selected118Rolls.includes(roll118Number);
                                          })()}
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
                                          variant={(() => {
                                            const roll118Number = parseInt(rollNumber);
                                            return !isNaN(roll118Number) && selected118Rolls.includes(roll118Number)
                                              ? "default"
                                              : "secondary";
                                          })()}>
                                          {(() => {
                                            const roll118Number = parseInt(rollNumber);
                                            return !isNaN(roll118Number) && selected118Rolls.includes(roll118Number)
                                              ? "✓ Selected"
                                              : "Not Selected";
                                          })()}
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

              {/* Note: Inventory Items section removed - no more waste inventory creation */}
            </div>
          )}
        </TabsContent>

        <TabsContent value="production">
          <ProductionRecordsErrorBoundary>
            {productionRecords.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Production Records</CardTitle>
                      <CardDescription>
                        Cut rolls moved to production with barcode labels generated
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={generateBarcodesPDF}
                      disabled={generatingBarcodePDF || productionRecords.length === 0}>
                      {generatingBarcodePDF ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating Barcode PDF...
                        </>
                      ) : (
                        <>
                          <ScanLine className="mr-2 h-4 w-4" />
                          Print Barcode Labels ({productionRecords.length})
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Barcode</TableHead>
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
                                  setBarcodeModalLoading(true);
                                  setSelectedBarcode(record.barcode_id || record.qr_code);
                                  // Simulate loading time for barcode generation
                                  setTimeout(
                                    () => setBarcodeModalLoading(false),
                                    300
                                  );
                                }}
                                aria-label={`View barcode for ${record.barcode_id || record.qr_code}`}>
                                <ScanLine className="h-4 w-4" />
                              </Button>
                              <code className="text-sm">{record.barcode_id || record.qr_code}</code>
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

      {/* Barcode Display Modal */}
      {selectedBarcode && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedBarcode(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSelectedBarcode(null);
            }
          }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="barcode-modal-title">
          <div className="bg-background p-4 rounded-lg max-w-sm w-full mx-4">
            {barcodeModalLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 id="barcode-modal-title" className="text-lg font-semibold">
                    Cut Roll Barcode
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBarcode(null)}
                    aria-label="Close barcode modal">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <BarcodeDisplay
                  value={selectedBarcode}
                  title="Cut Roll Barcode"
                  description={`Production Barcode`}
                  width={2}
                  height={100}
                  showActions={true}
                />
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => setSelectedBarcode(null)}>
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
        message={`Are you sure you want to move ${selected118Rolls.length} individual 118" roll(s) (containing ${selectedCutRolls.length} cut pieces) to production? This action will generate barcode labels and cannot be undone.`}
        onConfirm={createProductionRecords}
        onCancel={() => setShowConfirmDialog(false)}
        confirmText="Start Production"
      />
    </div>
  );
}
