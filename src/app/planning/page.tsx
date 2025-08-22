/**
 * Planning page - NEW FLOW: 3-input/4-output optimization workflow
 */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { 
  processMultipleOrders,
  validateCuttingPlan,
  getWorkflowStatus,
  convertOrdersToRequirements,
  groupCutRollsBySpec,
  groupCutRollsByJumbo,
  calculateEfficiencyMetrics,
  formatPaperSpec,
  getStatusBadgeVariant as getNewFlowStatusBadgeVariant,
  OptimizationResult,
  WorkflowProcessRequest,
  CutRoll,
  JumboRollDetail
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
  ArrowLeft,
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
  plans_created?: string[]; // Array of plan IDs created
}

interface ProductionRecord {
  id: string;
  qr_code: string;
  barcode_id?: string;
  jumbo_roll_id?: string;
  jumbo_frontend_id?: string;
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
  const [selected118Rolls, setSelected118Rolls] = useState<string[]>([]); // 118" roll composite keys (spec-rollNumber)
  const [selectedJumboRolls, setSelectedJumboRolls] = useState<string[]>([]); // Individual jumbo roll composite keys
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
  const [productionStarted, setProductionStarted] = useState(false);
  const [wastage, setWastage] = useState(1); // Default 1 inch wastage
  const [displayMode, setDisplayMode] = useState<'traditional' | 'jumbo'>('jumbo'); // Display mode toggle

  // Calculate planning width from wastage
  const planningWidth = useMemo(() => {
    const calculated = 119 - wastage;
    return Math.max(calculated, 50); // Ensure minimum width of 50 inches
  }, [wastage]);

  // Helper functions for composite roll keys
  const generateRollKey = useCallback((gsm: number, bf: number, shade: string, rollNumber: number): string => {
    return `${gsm}gsm-${bf}bf-${shade}-${rollNumber}`;
  }, []);

  const parseRollKey = useCallback((key: string): { gsm: number, bf: number, shade: string, rollNumber: number } | null => {
    const match = key.match(/^(\d+)gsm-([.\d]+)bf-(.+)-(\d+)$/);
    if (!match) return null;
    return {
      gsm: parseInt(match[1]),
      bf: parseFloat(match[2]),
      shade: match[3],
      rollNumber: parseInt(match[4])
    };
  }, []);

  const getRollKeyFromCutRoll = useCallback((cutRoll: CutRoll): string | null => {
    if (!cutRoll.individual_roll_number) return null;
    return generateRollKey(cutRoll.gsm, cutRoll.bf, cutRoll.shade, cutRoll.individual_roll_number);
  }, [generateRollKey]);

  // Helper function to check if a jumbo roll is selected
  const isJumboRollSelected = useCallback((jumboDetail: JumboRollDetail): boolean => {
    if (!planResult?.cut_rolls_generated) return false;
    
    // Get all cut rolls for this jumbo
    const jumboRolls = planResult.cut_rolls_generated.filter(roll => 
      roll.jumbo_roll_id === jumboDetail.jumbo_id
    );
    
    // Check if any 118" roll from this jumbo is selected
    return jumboRolls.some(roll => {
      const rollKey = getRollKeyFromCutRoll(roll);
      return rollKey && selected118Rolls.includes(rollKey);
    });
  }, [planResult, selected118Rolls, getRollKeyFromCutRoll]);

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
          (item) => `${item.width_inches} inches`
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

  // Helper function to get unique 118" roll keys from cut rolls
  const get118RollKeys = useCallback(() => {
    if (!planResult) return [];
    const rollKeys = new Set<string>();
    planResult.cut_rolls_generated.forEach(roll => {
      const key = getRollKeyFromCutRoll(roll);
      if (key) {
        rollKeys.add(key);
      }
    });
    return Array.from(rollKeys).sort();
  }, [planResult, getRollKeyFromCutRoll]);

  // Helper function to get available jumbo roll count (only complete jumbos with exactly 3 x 118" rolls)
  const getAvailableJumboRolls = useCallback(() => {
    // Only count complete jumbos (exactly 3 x 118" rolls)
    if (!planResult?.jumbo_roll_details) {
      return 0;
    }
    
    const completeJumbos = planResult.jumbo_roll_details.filter(jumbo => 
      jumbo && jumbo.is_complete && jumbo.roll_count === 3
    );
    
    return completeJumbos.length;
  }, [planResult]);

  // Helper function to check if selection is valid (only complete jumbos with exactly 3 x 118" rolls)
  const isValid118RollSelection = useCallback(
    (selectedRollCount: number) => {
      if (selectedRollCount === 0) return true;
      
      // Must be multiple of 3 AND must correspond to complete jumbos only
      if (selectedRollCount % 3 !== 0) return false;
      
      const requestedJumbos = selectedRollCount / 3;
      const availableCompleteJumbos = getAvailableJumboRolls();
      
      return requestedJumbos <= availableCompleteJumbos;
    },
    [getAvailableJumboRolls]
  );

  // Helper function to select specific number of COMPLETE jumbo rolls (exactly 3 x 118" rolls each)
  const selectJumboRolls = useCallback(
    (jumboCount: number) => {
      if (!planResult?.jumbo_roll_details) return;
      
      // Get only complete jumbos (exactly 3 x 118" rolls)
      const completeJumbos = planResult.jumbo_roll_details.filter(jumbo => 
        jumbo && jumbo.is_complete && jumbo.roll_count === 3
      ).slice(0, jumboCount); // Select only the requested number of complete jumbos
      
      if (completeJumbos.length < jumboCount) {
        console.warn(`Only ${completeJumbos.length} complete jumbos available, requested ${jumboCount}`);
        return;
      }
      
      // Get roll keys for the selected complete jumbos
      const selectedRollKeysSet = new Set<string>();
      const cutRollIndices: number[] = [];
      
      completeJumbos.forEach(jumbo => {
        // Find cut rolls belonging to this complete jumbo
        planResult.cut_rolls_generated.forEach((roll, index) => {
          if (roll.jumbo_roll_id === jumbo.jumbo_id) {
            const rollKey = getRollKeyFromCutRoll(roll);
            if (rollKey) {
              selectedRollKeysSet.add(rollKey); // Use Set to avoid duplicates
              cutRollIndices.push(index);
            }
          }
        });
      });
      
      setSelected118Rolls(Array.from(selectedRollKeysSet));
      setSelectedCutRolls(cutRollIndices);
      
      // Sync with individual jumbo checkbox state
      const selectedJumboKeys = completeJumbos.map(jumbo => `jumbo-${jumbo.jumbo_id}`);
      setSelectedJumboRolls(selectedJumboKeys);
    },
    [planResult, getRollKeyFromCutRoll]
  );

  const handleOrderSelect = useCallback((orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  }, []);

  // Handler for individual jumbo roll checkbox selection
  const handleJumboRollSelect = useCallback((jumboDetail: JumboRollDetail) => {
    if (!planResult?.cut_rolls_generated) return;

    const jumboKey = `jumbo-${jumboDetail.jumbo_id}`;
    
    // Get all 118" roll keys for this jumbo
    const jumboRolls = planResult.cut_rolls_generated.filter(roll => 
      roll.jumbo_roll_id === jumboDetail.jumbo_id
    );
    const jumboRollKeys = jumboRolls.map(roll => getRollKeyFromCutRoll(roll)).filter(Boolean) as string[];
    const jumboRollIndices = jumboRolls.map((_, index) => 
      planResult.cut_rolls_generated.findIndex(roll => roll.jumbo_roll_id === jumboDetail.jumbo_id) + index
    );

    const isCurrentlySelected = selectedJumboRolls.includes(jumboKey);
    
    if (isCurrentlySelected) {
      // Deselect this jumbo
      setSelectedJumboRolls(prev => prev.filter(key => key !== jumboKey));
      setSelected118Rolls(prev => prev.filter(key => !jumboRollKeys.includes(key)));
      setSelectedCutRolls(prev => prev.filter(index => !jumboRollIndices.includes(index)));
    } else {
      // Select this jumbo
      setSelectedJumboRolls(prev => [...prev, jumboKey]);
      setSelected118Rolls(prev => [...new Set([...prev, ...jumboRollKeys])]);
      setSelectedCutRolls(prev => [...new Set([...prev, ...jumboRollIndices])]);
    }
  }, [planResult, selectedJumboRolls, getRollKeyFromCutRoll]);

 

  // REMOVED: Individual roll selection handlers - only jumbo-based selection now

  // REMOVED: handleSelectAll118Rolls - only jumbo selection buttons now

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

      // NEW FLOW: Use the 3-input/4-output workflow with dynamic width
      const request: WorkflowProcessRequest = {
        order_ids: selectedOrders,
        user_id: user_id,
        include_pending_orders: true,
        include_available_inventory: true,
        jumbo_roll_width: planningWidth // Use calculated width from wastage
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
          `Procure ${optimizationResult.jumbo_rolls_needed} jumbo rolls (${optimizationResult.jumbo_rolls_needed * 3} individual ${planningWidth}" rolls)`
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
      const errorMessage = `Please select at least one ${planningWidth}\" roll for production.`;
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }
    
    if (!isValid118RollSelection(selected118Rolls.length)) {
      const availableJumbos = getAvailableJumboRolls();
      const errorMessage = `Please select complete jumbo rolls only (exactly 3 x 118" rolls each). Available: ${availableJumbos} complete jumbo${availableJumbos !== 1 ? 's' : ''}`;
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }
    
    setShowConfirmDialog(true);
  };

  const handleBackToDashboard = () => {
    // Redirect to dashboard after production is completed
    toast.success("Production completed successfully. Redirecting to dashboard...");
    window.location.href = "/dashboard";
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

      if(planResult == null ){
        console.error("❌ ERROR: No plan result found");
        throw new Error("No plan result found. Please regenerate the plan.");
      }

      // NEW FLOW: Create plan during start production since generate plan is now read-only
      console.log("🔍 DEBUG: Creating plan during production start (read-only workflow)");
      
      // Create a plan record first with actual optimization data
      const planCreateRequest = {
        name: `Production Plan - ${new Date().toISOString().split('T')[0]}`,
        cut_pattern: planResult.cut_rolls_generated.map((roll:CutRoll, index) => ({
          width: roll.width,
          gsm: roll.gsm,
          bf: roll.bf,
          shade: roll.shade,
          individual_roll_number: roll.individual_roll_number,
          source: roll.source,
          order_id: roll.order_id,
          selected: selectedCutRolls.includes(index),
          // CRITICAL: Include source tracking in cut_pattern
          source_type: roll.source_type || 'regular_order',
          source_pending_id: roll.source_pending_id || null
        })),
        expected_waste_percentage: 100 - calculateEfficiencyMetrics(planResult.cut_rolls_generated).averageEfficiency,
        created_by_id: user_id,
        order_ids: selectedOrders,
        pending_orders: planResult.pending_orders || [] // Include pending orders from algorithm
      };

      // Create the plan
      const planCreateResponse = await fetch(`${API_BASE_URL}/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(planCreateRequest)
      });

      if (!planCreateResponse.ok) {
        throw new Error('Failed to create plan for production');
      }

      const createdPlan = await planCreateResponse.json();
      const planId = createdPlan.id;
      console.log("✅ Created plan for production:", planId);

      // Validate 118" roll selection before proceeding
      if (!isValid118RollSelection(selected118Rolls.length)) {
        const availableJumbos = getAvailableJumboRolls();
        toast.error(
          `Please select complete jumbo rolls only (exactly 3 x 118" rolls each). ` +
          `Available: ${availableJumbos} complete jumbo${availableJumbos !== 1 ? 's' : ''}`
        );
        return;
      }

      // NEW FLOW: Prepare cut roll selections for production start with source tracking
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
          order_id: cutRoll.order_id,
          // CRITICAL: Include source tracking from optimization algorithm
          source_type: cutRoll.source_type || 'regular_order',
          source_pending_id: cutRoll.source_pending_id || null
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
            order_id: cutRoll.order_id,
            // CRITICAL: Include source tracking from optimization algorithm
            source_type: cutRoll.source_type || 'regular_order',
            source_pending_id: cutRoll.source_pending_id || null
          };
        });

      // Call the new backend endpoint for starting production with comprehensive status updates
      const productionRequest = {
        selected_cut_rolls: selectedRolls,
        all_available_cuts: allAvailableCuts,
        created_by_id: user_id,
        jumbo_roll_width: planningWidth // Use calculated width from wastage
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

      // Create production records using existing jumbo roll data with comprehensive matching
      const productionRecords = result.created_inventory_details?.map((inventory: any, index: any) => {
        const selectedRoll = selectedRolls[index];
        const originalCutRoll = planResult!.cut_rolls_generated[selectedCutRolls[index]];
        
        console.log('🔍 DEBUG originalCutRoll:', originalCutRoll);
        
        let jumboRollId = 'Unknown';
        let jumboFrontendId = 'Unknown';
        
        if (originalCutRoll && planResult!.jumbo_roll_details) {
          // METHOD 1: Try to match by paper specification (most reliable)
          const cutRollPaperSpec = `${originalCutRoll.gsm}gsm, ${originalCutRoll.bf}bf, ${originalCutRoll.shade}`;
          
          const matchingJumbo = planResult!.jumbo_roll_details.find(jumbo => 
            jumbo && jumbo.paper_spec === cutRollPaperSpec
          );
          
          if (matchingJumbo) {
            jumboRollId = matchingJumbo.jumbo_id;
            jumboFrontendId = matchingJumbo.jumbo_frontend_id;
            console.log('✅ Found jumbo by paper spec:', { cutRollPaperSpec, jumboRollId, jumboFrontendId });
          } else {
            // METHOD 2: Try to match by jumbo_roll_id if paper spec matching fails
            const belongsToJumbo = planResult!.jumbo_roll_details.find(jumbo => 
              jumbo && jumbo.jumbo_id === originalCutRoll.jumbo_roll_id
            );
            
            if (belongsToJumbo) {
              jumboRollId = belongsToJumbo.jumbo_id;
              jumboFrontendId = belongsToJumbo.jumbo_frontend_id;
              console.log('✅ Found jumbo by jumbo_roll_id:', { jumboRollId, jumboFrontendId });
            } else {
              // METHOD 3: Fallback - use the first available jumbo of same paper type
              const fallbackJumbo = planResult!.jumbo_roll_details.find(jumbo => 
                jumbo && jumbo.paper_spec.includes(`${originalCutRoll.gsm}gsm`)
              );
              
              if (fallbackJumbo) {
                jumboRollId = fallbackJumbo.jumbo_id;
                jumboFrontendId = fallbackJumbo.jumbo_frontend_id;
                console.log('🔄 Using fallback jumbo:', { jumboRollId, jumboFrontendId });
              } else {
                console.log('❌ No matching jumbo found for:', { 
                  cutRollPaperSpec, 
                  jumbo_roll_id: originalCutRoll.jumbo_roll_id,
                  availableJumbos: planResult!.jumbo_roll_details.map(j => ({ 
                    id: j?.jumbo_id, 
                    frontend_id: j?.jumbo_frontend_id, 
                    paper_spec: j?.paper_spec 
                  }))
                });
              }
            }
          }
        }
        
        return {
          id: inventory.id,
          qr_code: inventory.qr_code,
          barcode_id: inventory.barcode_id,
          jumbo_roll_id: jumboRollId,
          jumbo_frontend_id: jumboFrontendId,
          width_inches: inventory.width_inches,
          gsm: selectedRoll?.gsm || originalCutRoll?.gsm || 0,
          bf: selectedRoll?.bf || originalCutRoll?.bf || 0,
          shade: selectedRoll?.shade || originalCutRoll?.shade || '',
          status: inventory.status,
          selected_at: inventory.created_at || new Date().toISOString()
        };
      }) || [];

      console.log('🔍 DEBUG Final production records:', productionRecords);

      setProductionRecords(productionRecords);
      setActiveTab("production");
      setProductionStarted(true); // Mark production as started
      
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

  // REMOVED: handleRollSetSelection - only jumbo-level selection now

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
        pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
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

      // Enhanced Jumbo Roll Summary Section
      if (planResult.jumbo_rolls_needed > 0) {
        checkPageBreak(40);
        pdf.setFontSize(16);
        pdf.setTextColor(40, 40, 40);
        pdf.text("Jumbo Rolls Summary", 20, yPosition);
        yPosition += 15;

        // Basic statistics
        pdf.setFontSize(12);
        pdf.setTextColor(60, 60, 60);
        pdf.text(`Total Virtual Jumbo Rolls: ${planResult.jumbo_rolls_needed}`, 20, yPosition);
        yPosition += 8;
        
        // Enhanced statistics if jumbo details are available
        if (planResult.summary.complete_jumbos !== undefined && planResult.summary.partial_jumbos !== undefined) {
          pdf.text(`Complete Jumbos (3/3 rolls): ${planResult.summary.complete_jumbos}`, 20, yPosition);
          yPosition += 8;
          pdf.text(`Partial Jumbos (<3 rolls): ${planResult.summary.partial_jumbos}`, 20, yPosition);
          yPosition += 8;
        }
        
        pdf.text(`Each jumbo roll contains up to 3 rolls of ${planningWidth}" width`, 20, yPosition);
        yPosition += 8;
        pdf.text(`Total ${planningWidth}" rolls produced: ${planResult.jumbo_rolls_needed * 3}`, 20, yPosition);
        yPosition += 8;
        
        // Efficiency metrics
        const metrics = calculateEfficiencyMetrics(planResult.cut_rolls_generated);
        pdf.text(`Overall Material Efficiency: ${metrics.averageEfficiency.toFixed(1)}%`, 20, yPosition);
        yPosition += 8;
        pdf.text(`Total Cut Rolls Generated: ${planResult.summary.total_cut_rolls}`, 20, yPosition);
        yPosition += 15;
      }

      // Enhanced: Jumbo Roll Hierarchy Section
      checkPageBreak(30);
      pdf.setFontSize(16);
      pdf.setTextColor(40, 40, 40);
      
      // Check if we have jumbo roll details for enhanced view
      if (planResult.jumbo_roll_details && planResult.jumbo_roll_details.length > 0) {
        pdf.text("Production Plan - Jumbo Roll Hierarchy", 20, yPosition);
        yPosition += 15;

        // Process jumbo roll details
        (planResult.jumbo_roll_details || []).forEach((jumboDetail: JumboRollDetail) => {
          if (!jumboDetail) return; // Skip if jumboDetail is null/undefined
          
          checkPageBreak(40);

          // Jumbo Roll Header
          pdf.setFontSize(14);
          pdf.setTextColor(40, 40, 40);
          pdf.text(`Jumbo Roll ${jumboDetail.jumbo_frontend_id || jumboDetail.jumbo_id || 'Unknown'}`, 20, yPosition);
          yPosition += 8;

          // Jumbo Roll Details
          pdf.setFontSize(10);
          pdf.setTextColor(80, 80, 80);
          pdf.text(`Paper: ${jumboDetail.paper_spec || 'Unknown'}`, 25, yPosition);
          pdf.text(`Rolls: ${jumboDetail.roll_count || 0}/3`, 120, yPosition);
          pdf.text(`Efficiency: ${jumboDetail.efficiency_percentage || 0}%`, 160, yPosition);
          yPosition += 8;

          pdf.text(`Total Cuts: ${jumboDetail.total_cuts || 0}`, 25, yPosition);
          pdf.text(`Status: ${jumboDetail.is_complete ? 'Complete' : 'Partial'}`, 120, yPosition);
          yPosition += 12;

          // Get cut rolls for this jumbo
          const jumboRolls = (planResult.cut_rolls_generated || []).filter(roll => 
            roll && roll.jumbo_roll_id === jumboDetail.jumbo_id
          );

          // Group by 118" roll
          const roll118Groups = jumboRolls.reduce((groups, roll, index) => {
            if (!roll) return groups; // Skip null/undefined rolls
            const key = roll.parent_118_roll_id || `roll-${roll.individual_roll_number || 0}`;
            if (!groups[key]) {
              groups[key] = [];
            }
            const originalIndex = (planResult.cut_rolls_generated || []).findIndex(r => r === roll);
            groups[key].push({ ...roll, originalIndex: originalIndex >= 0 ? originalIndex : index });
            return groups;
          }, {} as Record<string, Array<CutRoll & { originalIndex: number }>>);

          // Process each 118" roll within this jumbo
          Object.entries(roll118Groups).forEach(([roll118Id, cutsInRoll]) => {
            checkPageBreak(35);

            const rollNum = cutsInRoll[0]?.individual_roll_number || 'Unknown';
            const rollSeq = cutsInRoll[0]?.roll_sequence || '?';
            
            pdf.setFontSize(12);
            pdf.setTextColor(60, 60, 60);
            pdf.text(`118" Roll #${rollNum} (Position ${rollSeq})`, 30, yPosition);
            yPosition += 8;

            // Visual cutting representation
            checkPageBreak(25);
            pdf.setFontSize(9);
            pdf.setTextColor(60, 60, 60);
            pdf.text("Cutting Pattern:", 35, yPosition);
            yPosition += 8;

            // Draw visual cutting representation
            const rectStartX = 35;
            const rectWidth = pageWidth - 70;
            const rectHeight = 12;
            let currentX = rectStartX;

            cutsInRoll.forEach((roll) => {
              // Add safety checks for undefined values
              const rollWidth = roll.width || 0;
              const rollOriginalIndex = roll.originalIndex ?? -1;
              
              const widthRatio = rollWidth / planningWidth;
              const sectionWidth = rectWidth * widthRatio;
              const isSelected = selectedCutRolls.includes(rollOriginalIndex);

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

              // Add width text inside the rectangle if wide enough
              if (sectionWidth > 15 && rollWidth > 0) {
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(7);
                const textX = currentX + sectionWidth/2;
                const textY = yPosition + rectHeight/2 + 1;
                pdf.text(`${rollWidth}"`, textX, textY, { align: 'center' });
              }

              currentX += sectionWidth;
            });

            // Calculate and draw waste section
            const totalUsed = cutsInRoll.reduce((sum, roll) => sum + (roll.width || 0), 0);
            const waste = planningWidth - totalUsed;
            if (waste > 0) {
              const wasteRatio = waste / planningWidth;
              const wasteWidth = rectWidth * wasteRatio;
              
              pdf.setFillColor(239, 68, 68); // Red for waste
              pdf.rect(currentX, yPosition, wasteWidth, rectHeight, 'F');
              pdf.setDrawColor(255, 255, 255);
              pdf.rect(currentX, yPosition, wasteWidth, rectHeight, 'S');
              
              if (wasteWidth > 15) {
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(6);
                pdf.text(`${waste.toFixed(1)}"`, currentX + wasteWidth/2, yPosition + rectHeight/2 + 1, { align: 'center' });
              }
            }

            yPosition += rectHeight + 3;

            // Add width indicator
            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(7);
            pdf.text(`${planningWidth}" Total Width`, rectStartX + rectWidth/2, yPosition, { align: 'center' });
            yPosition += 8;

            // Enhanced statistics for this 118" roll
            checkPageBreak(20);
            const statsY = yPosition;
            const statsBoxWidth = (rectWidth - 15) / 4;
            const statsBoxHeight = 15;

            // Add safety checks for calculations
            const safeTotalUsed = totalUsed || 0;
            const safeWaste = waste || 0;
            const safeEfficiency = planningWidth > 0 ? ((safeTotalUsed / planningWidth) * 100) : 0;
            const safeCutsCount = cutsInRoll ? cutsInRoll.length : 0;

            // Used Width box
            pdf.setDrawColor(60, 60, 60);
            pdf.setLineWidth(0.5);
            pdf.rect(rectStartX, statsY, statsBoxWidth, statsBoxHeight, 'S');
            pdf.setTextColor(40, 40, 40);
            pdf.setFontSize(10);
            pdf.text(`${safeTotalUsed.toFixed(1)}"`, rectStartX + statsBoxWidth/2, statsY + 6, { align: 'center' });
            pdf.setFontSize(7);
            pdf.text("Used", rectStartX + statsBoxWidth/2, statsY + 12, { align: 'center' });

            // Waste box
            const wasteX = rectStartX + statsBoxWidth + 5;
            pdf.rect(wasteX, statsY, statsBoxWidth, statsBoxHeight, 'S');
            pdf.setFontSize(10);
            pdf.text(`${safeWaste.toFixed(1)}"`, wasteX + statsBoxWidth/2, statsY + 6, { align: 'center' });
            pdf.setFontSize(7);
            pdf.text("Waste", wasteX + statsBoxWidth/2, statsY + 12, { align: 'center' });

            // Efficiency box
            const efficiencyX = wasteX + statsBoxWidth + 5;
            pdf.rect(efficiencyX, statsY, statsBoxWidth, statsBoxHeight, 'S');
            pdf.setFontSize(10);
            pdf.text(`${safeEfficiency.toFixed(1)}%`, efficiencyX + statsBoxWidth/2, statsY + 6, { align: 'center' });
            pdf.setFontSize(7);
            pdf.text("Efficiency", efficiencyX + statsBoxWidth/2, statsY + 12, { align: 'center' });

            // Cuts box
            const cutsX = efficiencyX + statsBoxWidth + 5;
            pdf.rect(cutsX, statsY, statsBoxWidth, statsBoxHeight, 'S');
            pdf.setFontSize(10);
            pdf.text(`${safeCutsCount}`, cutsX + statsBoxWidth/2, statsY + 6, { align: 'center' });
            pdf.setFontSize(7);
            pdf.text("Cuts", cutsX + statsBoxWidth/2, statsY + 12, { align: 'center' });

            yPosition += statsBoxHeight + 15;
          });

          yPosition += 10; // Space between jumbos
        });
      } else {
        // Fallback to traditional view if no jumbo details
        pdf.text("Cut Rolls by Specification (Traditional View)", 20, yPosition);
        yPosition += 15;

        // Group cut rolls by specification (original logic)
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

        // Process traditional grouped rolls
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
            const widthRatio = roll.width / planningWidth;
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
          const waste = planningWidth - totalUsed;
          const efficiency = ((totalUsed / planningWidth) * 100).toFixed(1);

          // Draw waste section if any
          if (waste > 0) {
            const wasteRatio = waste / planningWidth;
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
          pdf.text(`${planningWidth}\" Total Width`, rectStartX + rectWidth/2, yPosition, { align: 'center' });
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

        yPosition += 5;
      }

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
          (planResult.summary?.total_cut_rolls || 0).toString(),
        ],
        [
          `Individual ${planningWidth}" Rolls Required`,
          (planResult.summary?.total_individual_118_rolls || 0).toString(),
        ],
        [
          "Jumbo Rolls Needed",
          (planResult.jumbo_rolls_needed || 0).toString(),
        ],
        [
          "Total Pending Orders",
          (planResult.summary?.total_pending_orders || 0).toString(),
        ],
        [
          "Selected for Production", 
          (selectedCutRolls?.length || 0).toString()
        ],
        [
          "Material Efficiency",
          `${calculateEfficiencyMetrics(planResult.cut_rolls_generated || []).averageEfficiency.toFixed(1)}%`
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
      
      // Group records by jumbo roll for PDF
      const recordsByJumbo = productionRecords.reduce((groups, record) => {
        const jumboId = record.jumbo_roll_id || record.jumbo_frontend_id || 'Unknown';
        if (!groups[jumboId]) {
          groups[jumboId] = [];
        }
        groups[jumboId].push(record);
        return groups;
      }, {} as Record<string, ProductionRecord[]>);

      Object.entries(recordsByJumbo).forEach(([jumboId, records]) => {
        // Check if we need a new page for jumbo header
        if (itemCount >= itemsPerPage || yPosition > pageHeight - 80) {
          doc.addPage();
          pageCount++;
          yPosition = marginY;
          itemCount = 0;
        }

        // Jumbo Roll Header in PDF
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(`Jumbo Roll: ${jumboId}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`${records.length} cut rolls in this jumbo`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;

        // Add separator line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(1);
        doc.line(marginX, yPosition, pageWidth - marginX, yPosition);
        yPosition += 10;

        // Process cut rolls under this jumbo
        records.forEach((record, index) => {
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
            
            const barcodeWidth = labelWidth * 0.8;
            const barcodeHeight = 25;
            const barcodeX = marginX + (labelWidth - barcodeWidth) / 2;
            const barcodeY = yPosition;
            
            doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
            yPosition += barcodeHeight + 8;
            
          } catch (error) {
            console.error('Error adding barcode:', error);
            doc.setFontSize(12);
            doc.setFont('courier', 'bold');
            doc.text(`|||| ${barcodeValue} ||||`, pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 12;
          }

          // Paper specifications
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(`${record.gsm}gsm, BF:${record.bf}, ${record.shade}`, pageWidth / 2, yPosition, { align: 'center' });
          yPosition += 12;

          // Separation line between cut rolls (not after last item in jumbo)
          if (index < records.length - 1) {
            doc.setDrawColor(150, 150, 150);
            doc.setLineWidth(0.5);
            doc.line(marginX + 20, yPosition, pageWidth - marginX - 20, yPosition);
            yPosition += 10;
          }

          itemCount++;
        });

        // Extra space between jumbos
        yPosition += 20;
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
          {productionStarted ? (
            // After production started - only show Back button
            <Button
              variant="outline"
              onClick={handleBackToDashboard}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          ) : (
            // Before production started - show normal buttons
            <>
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
                    onClick={handleCreateProductionRecords}
                    disabled={creatingProduction || selected118Rolls.length === 0 || !isValid118RollSelection(selected118Rolls.length)}
                    className={`transition-all duration-200 font-semibold ${
                      creatingProduction || selected118Rolls.length === 0 || !isValid118RollSelection(selected118Rolls.length)
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed border-gray-200 hover:bg-gray-200 hover:text-gray-400"
                        : "bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700 shadow-lg hover:shadow-xl transform hover:scale-105"
                    }`}>
                    {creatingProduction ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Production...
                      </>
                    ) : (
                      <>
                        <Factory className="mr-2 h-4 w-4" />
                        Start Production ({selected118Rolls.length} × {planningWidth}" rolls)
                      </>
                    )}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Waste-based Width Configuration */}
      {!productionStarted && (
        <Card>
          <CardHeader>
            <CardTitle>Roll Width Configuration</CardTitle>
            <CardDescription>
              Enter wastage allowance to calculate planning width
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="flex flex-col space-y-2">
                <label htmlFor="wastage-input" className="text-sm font-medium">
                  Enter Wastage (inches)
                </label>
                <input
                  id="wastage-input"
                  type="number"
                  min="1"
                  max="69"
                  value={wastage}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value >= 1 && value <= 69) {
                      setWastage(value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1.0"
                />
                <div className="text-xs text-muted-foreground">
                  Range: 1-69 inches
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">Calculation</label>
                <div className="text-lg font-mono bg-muted p-2 rounded-md">
                  119 - {wastage} = {planningWidth}"
                </div>
                <div className="text-xs text-muted-foreground">
                  Default Roll Width - Wastage
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">Planning Width</label>
                <div className="text-2xl font-bold text-primary">
                  {planningWidth} inches
                </div>
                <div className="text-sm text-green-600">
                  ✓ Planning with width: {planningWidth} inches
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                            {order.frontend_id || order.id.split("-")[0]}
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
              {/* Enhanced Summary Cards - NEW FLOW with Jumbo Hierarchy */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
                    <CardTitle className="text-2xl text-cyan-600">
                      {planResult.summary.complete_jumbos || 0}
                    </CardTitle>
                    <CardDescription>Complete Jumbos</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl text-yellow-600">
                      {planResult.summary.partial_jumbos || 0}
                    </CardTitle>
                    <CardDescription>Partial Jumbos</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl text-green-600">
                      {calculateEfficiencyMetrics(planResult.cut_rolls_generated).averageEfficiency.toFixed(1)}%
                    </CardTitle>
                    <CardDescription>Material Efficiency</CardDescription>
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

              {/* Cut Rolls Selection - Enhanced with Jumbo Roll Hierarchy */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Cut Rolls Available for Production</CardTitle>
                      <CardDescription>
                        {displayMode === 'jumbo' 
                          ? 'Select complete jumbo rolls only (exactly 3 x 118" rolls each)'
                          : 'Select rolls by paper specification and roll number - Traditional view'
                        }
                        <div className="text-xs text-blue-600 mt-1">
                          ℹ️ Only complete jumbos available for selection. Partial jumbos are excluded.
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={displayMode === 'traditional' ? "default" : "outline"}
                        onClick={() => setDisplayMode('traditional')}>
                        Traditional View
                      </Button>
                      <Button
                        size="sm"
                        variant={displayMode === 'jumbo' ? "default" : "outline"}
                        onClick={() => setDisplayMode('jumbo')}>
                        Jumbo Hierarchy
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                      <div className="text-sm text-muted-foreground">
                        {selected118Rolls.length > 0 && selected118Rolls.length % 3 === 0 
                          ? `${selected118Rolls.length / 3} of ${getAvailableJumboRolls()} complete jumbo rolls selected`
                          : `${selectedCutRolls.length} cut rolls selected from ${selected118Rolls.length} x 118" rolls`
                        }
                        {selected118Rolls.length > 0 && (
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            isValid118RollSelection(selected118Rolls.length) 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {isValid118RollSelection(selected118Rolls.length) 
                              ? `✓ ${selected118Rolls.length / 3} complete jumbo${selected118Rolls.length / 3 > 1 ? 's' : ''} (${selectedCutRolls.length} cut pieces)` 
                              : `⚠ Invalid selection: ${selected118Rolls.length} x 118" rolls (need multiples of 3 from complete jumbos)`
                            }
                          </span>
                        )}
                      </div>
                      {/* Show warning message when selection is invalid */}
                      {selected118Rolls.length > 0 && !isValid118RollSelection(selected118Rolls.length) && (
                        <div className="text-xs text-yellow-600">
                           Production disabled: Please select complete jumbo rolls only (exactly 3 x 118" rolls each)
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
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
                                {jumboCount} Jumbo{jumboCount > 1 ? 's' : ''} ({jumboCount * 3} × {planningWidth}" rolls)
                              </Button>
                            ))}
                            <div className="w-px h-6 bg-border mx-1" />
                          </>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected118Rolls([]);
                            setSelectedCutRolls([]);
                            setSelectedJumboRolls([]);
                          }}>
                          ✗ Clear Selection
                        </Button>
                      </div>
                    </div>
                </CardHeader>
                <CardContent>
                  {displayMode === 'traditional' ? (
                    // Traditional view - Group by paper specifications
                    (() => {
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
                                            if (isNaN(roll118Number) || rollsInNumber.length === 0) return false;
                                            const firstRoll = rollsInNumber[0];
                                            const rollKey = generateRollKey(firstRoll.gsm, firstRoll.bf, firstRoll.shade, roll118Number);
                                            return selected118Rolls.includes(rollKey);
                                          })()}
                                          disabled={true}
                                          onCheckedChange={() => {
                                            // Individual roll set selection disabled - use jumbo buttons instead
                                          }}
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
                                            if (isNaN(roll118Number) || rollsInNumber.length === 0) return "secondary";
                                            const firstRoll = rollsInNumber[0];
                                            const rollKey = generateRollKey(firstRoll.gsm, firstRoll.bf, firstRoll.shade, roll118Number);
                                            return selected118Rolls.includes(rollKey) ? "default" : "secondary";
                                          })()}>
                                          {(() => {
                                            const roll118Number = parseInt(rollNumber);
                                            if (isNaN(roll118Number) || rollsInNumber.length === 0) return "Not Selected";
                                            const firstRoll = rollsInNumber[0];
                                            const rollKey = generateRollKey(firstRoll.gsm, firstRoll.bf, firstRoll.shade, roll118Number);
                                            return selected118Rolls.includes(rollKey) ? "✓ Selected" : "Not Selected";
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
                                        Cutting Pattern ({planningWidth}&quot; Jumbo Roll):
                                      </div>
                                      <div className="relative h-12 bg-muted rounded-lg border overflow-hidden">
                                        {/* Show how cuts are made from {planningWidth}" roll */}
                                        {(() => {
                                          let currentPosition = 0;
                                          const totalUsed =
                                            rollsInNumber.reduce(
                                              (sum, roll) => sum + roll.width,
                                              0
                                            );
                                          const waste = planningWidth - totalUsed;
                                          const wastePercentage =
                                            (waste / planningWidth) * 100;

                                          return (
                                            <>
                                              {/* Cut sections */}
                                              {rollsInNumber.map(
                                                (roll, cutIndex) => {
                                                  const widthPercentage =
                                                    (roll.width / planningWidth) * 100;
                                                  const leftPosition =
                                                    (currentPosition / planningWidth) *
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

                                              {/* {planningWidth}" total indicator */}
                                              <div className="absolute -bottom-6 left-0 right-0 text-center text-xs text-slate-600 font-medium">
                                                {planningWidth}&quot; Total Width
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
                                            onClick={() => {
                                              // Individual cut roll selection disabled - use jumbo buttons instead
                                            }}>
                                            <div className="flex items-center gap-3">
                                              <Checkbox
                                                checked={selectedCutRolls.includes(
                                                  roll.originalIndex
                                                )}
                                                disabled={true}
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
                  })()
                  ) : (
                    // Enhanced Jumbo Hierarchy View
                    <div className="space-y-8">
                      {planResult.jumbo_roll_details && planResult.jumbo_roll_details.length > 0 ? (
                        planResult.jumbo_roll_details.map((jumboDetail: JumboRollDetail) => {
                          const isSelected = isJumboRollSelected(jumboDetail);
                          return (
                          <div 
                            key={jumboDetail.jumbo_id} 
                            className={`rounded-lg p-6 bg-card transition-all duration-200 ${
                              isSelected 
                                ? "border-2 border-green-500 shadow-lg shadow-green-500/20" 
                                : "border border-gray-200"
                            }`}
                          >
                            {/* Jumbo Roll Header */}
                            <div className="flex justify-between items-center mb-6 pb-4 border-b">
                              <div className="flex items-center gap-4">
                                <Checkbox
                                  checked={selectedJumboRolls.includes(`jumbo-${jumboDetail.jumbo_id}`)}
                                  onCheckedChange={() => handleJumboRollSelect(jumboDetail)}
                                  className="w-5 h-5"
                                />
                                <div className="w-12 h-12 bg-blue-600 text-white rounded-lg flex items-center justify-center text-lg font-bold">
                                  📦
                                </div>
                                <div>
                                  <h3 className="text-xl font-bold text-foreground">
                                    Jumbo Roll {jumboDetail.jumbo_frontend_id}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {jumboDetail.paper_spec} • {jumboDetail.roll_count} of 3 rolls • {jumboDetail.total_cuts} cuts
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge 
                                  variant={jumboDetail.is_complete ? "default" : "secondary"}
                                  className="text-sm">
                                  {jumboDetail.is_complete ? "Complete" : `${jumboDetail.roll_count}/3 Rolls`}
                                </Badge>
                                <div className="text-right">
                                  <div className="text-lg font-semibold text-green-600">
                                    {jumboDetail.efficiency_percentage}%
                                  </div>
                                  <div className="text-xs text-muted-foreground">Efficiency</div>
                                </div>
                              </div>
                            </div>

                            {/* 118" Rolls within this Jumbo */}
                            <div className="grid gap-4">
                              {(() => {
                                // Get cut rolls for this jumbo
                                const jumboRolls = planResult.cut_rolls_generated.filter(roll => 
                                  roll.jumbo_roll_id === jumboDetail.jumbo_id
                                );

                                // Group by 118" roll (parent_118_roll_id)
                                const roll118Groups = jumboRolls.reduce((groups, roll) => {
                                  const key = roll.parent_118_roll_id || `roll-${roll.individual_roll_number || 0}`;
                                  if (!groups[key]) {
                                    groups[key] = [];
                                  }
                                  groups[key].push({
                                    ...roll,
                                    originalIndex: planResult.cut_rolls_generated.findIndex(r => r === roll)
                                  });
                                  return groups;
                                }, {} as Record<string, Array<CutRoll & { originalIndex: number }>>);

                                return Object.entries(roll118Groups).map(([roll118Id, cutsInRoll]) => (
                                  <div key={roll118Id} className="bg-background border rounded-lg p-4">
                                    <div className="flex justify-between items-center mb-3">
                                      <div className="flex items-center gap-3">
                                        <Checkbox
                                          checked={cutsInRoll.every(roll => 
                                            selectedCutRolls.includes(roll.originalIndex)
                                          )}
                                          disabled={true}
                                          onCheckedChange={() => {
                                            // Individual 118" roll selection disabled - use jumbo buttons instead
                                          }}
                                        />
                                        <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                          {cutsInRoll[0]?.roll_sequence || '?'}
                                        </div>
                                        <h4 className="text-lg font-semibold">
                                          118" Roll #{cutsInRoll[0]?.individual_roll_number || 'Unknown'}
                                        </h4>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline">
                                          {cutsInRoll.length} cuts
                                        </Badge>
                                        <Badge
                                          variant={cutsInRoll.every(roll => selectedCutRolls.includes(roll.originalIndex)) 
                                            ? "default" : "secondary"}>
                                          {cutsInRoll.every(roll => selectedCutRolls.includes(roll.originalIndex)) 
                                            ? "✓ Selected" : "Not Selected"}
                                        </Badge>
                                      </div>
                                    </div>

                                    {/* Visual cutting pattern */}
                                    <div className="mb-4">
                                      <div className="text-sm font-medium text-muted-foreground mb-2">
                                        Cutting Pattern ({planningWidth}" Roll):
                                      </div>
                                      <div className="relative h-12 bg-muted rounded-lg border overflow-hidden">
                                        {(() => {
                                          let currentPosition = 0;
                                          const totalUsed = cutsInRoll.reduce((sum, roll) => sum + roll.width, 0);
                                          const waste = planningWidth - totalUsed;
                                          
                                          return (
                                            <>
                                              {cutsInRoll.map((roll, cutIndex) => {
                                                const widthPercentage = (roll.width / planningWidth) * 100;
                                                const leftPosition = (currentPosition / planningWidth) * 100;
                                                currentPosition += roll.width;
                                                const isSelected = selectedCutRolls.includes(roll.originalIndex);

                                                return (
                                                  <div
                                                    key={cutIndex}
                                                    className={`absolute h-full border-r-2 border-white ${
                                                      isSelected
                                                        ? "bg-gradient-to-r from-green-400 to-green-500"
                                                        : "bg-gradient-to-r from-blue-400 to-blue-500"
                                                    }`}
                                                    style={{
                                                      left: `${leftPosition}%`,
                                                      width: `${widthPercentage}%`,
                                                    }}>
                                                    <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                                      {roll.width}"
                                                    </div>
                                                  </div>
                                                );
                                              })}

                                              {waste > 0 && (
                                                <div
                                                  className="absolute h-full bg-gradient-to-r from-red-400 to-red-500 border-l-2 border-white"
                                                  style={{
                                                    right: "0%",
                                                    width: `${(waste / planningWidth) * 100}%`,
                                                  }}>
                                                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                                    {waste.toFixed(1)}"
                                                  </div>
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>

                                    {/* Individual cut roll details */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {cutsInRoll.map((roll) => (
                                        <div
                                          key={roll.originalIndex}
                                          className={`p-2 rounded border cursor-pointer transition-all ${
                                            selectedCutRolls.includes(roll.originalIndex)
                                              ? "bg-green-50 border-green-200"
                                              : "bg-muted/30 border-border hover:bg-muted"
                                          }`}
                                          onClick={() => {
                                            // Individual cut selection disabled - use jumbo buttons instead
                                          }}>
                                          <div className="flex items-center justify-between">
                                            <div className="text-sm font-medium">
                                              {roll.width}" cut
                                            </div>
                                            <Checkbox
                                              checked={selectedCutRolls.includes(roll.originalIndex)}
                                              disabled={true}
                                              onChange={() => {}}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No jumbo roll hierarchy data available
                        </div>
                      )}
                    </div>
                  )}
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
                      {(() => {
                        // Group production records by jumbo roll ID
                        const recordsByJumbo = productionRecords.reduce((groups, record) => {
                          const jumboId = record.jumbo_roll_id || record.jumbo_frontend_id || 'Unknown';
                          if (!groups[jumboId]) {
                            groups[jumboId] = [];
                          }
                          groups[jumboId].push(record);
                          return groups;
                        }, {} as Record<string, ProductionRecord[]>);

                        const rows: React.ReactNode[] = [];

                        // Create header row + cut rolls for each jumbo
                        Object.entries(recordsByJumbo).forEach(([jumboId, records]) => {
                          // Jumbo Roll Header Row
                          rows.push(
                            <TableRow key={`jumbo-${jumboId}`} className="bg-primary/5 border-b-2">
                              <TableCell colSpan={6} className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-sm font-bold">
                                    
                                  </div>
                                  <div>
                                    <div className="text-lg font-bold text-primary">
                                      Jumbo Roll: {jumboId}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {records.length} cut rolls in this jumbo
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          );

                          // Cut Rolls under this Jumbo
                          records.forEach((record) => {
                            rows.push(
                              <TableRow key={record.id} className="border-l-4 border-primary/20">
                                <TableCell>
                                  <div className="flex items-center gap-2 ml-4">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setBarcodeModalLoading(true);
                                        setSelectedBarcode(record.barcode_id || record.qr_code);
                                        setTimeout(() => setBarcodeModalLoading(false), 300);
                                      }}
                                      aria-label={`View barcode for ${record.barcode_id || record.qr_code}`}>
                                      <ScanLine className="h-4 w-4" />
                                    </Button>
                                    <code className="text-sm">{record.barcode_id || record.qr_code}</code>
                                  </div>
                                </TableCell>
                                <TableCell className="pl-8">{record.width_inches}&quot;</TableCell>
                                <TableCell className="pl-8">
                                  {record.gsm}gsm, {record.bf}bf, {record.shade}
                                </TableCell>
                                <TableCell className="pl-8">
                                  <Badge variant={getStatusBadgeVariant(record.status)}>
                                    {record.status.replace("_", " ")}
                                  </Badge>
                                </TableCell>
                                <TableCell className="pl-8">{record.actual_weight_kg || "-"}</TableCell>
                                <TableCell className="pl-8">
                                  {new Date(record.selected_at).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            );
                          });
                        });

                        return rows;
                      })()}
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
              {planResult.next_steps!.map((step, index) => (
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
        message={`Are you sure you want to move ${selected118Rolls.length} individual ${planningWidth}" roll(s) (containing ${selectedCutRolls.length} cut pieces) to production? This action will generate barcode labels and cannot be undone.`}
        onConfirm={createProductionRecords}
        onCancel={() => setShowConfirmDialog(false)}
        confirmText="Start Production"
      />
    </div>
  );
}
