/**
 * Plan Details page - Comprehensive view of a specific cutting plan
 */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, PRODUCTION_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  AlertCircle,
  Play,
  CheckCircle,
  Factory,
  QrCode,
  ScanLine,
  Search,
  Package,
  Weight,
  Ruler,
  ArrowLeft,
  Calendar,
  User,
  Clock,
  MapPin,
  Download,
  FileText,
  BarChart3,
  Printer,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import BarcodeDisplay from "@/components/BarcodeDisplay";
import { RollbackPlanDialog } from "@/components/RollbackPlanDialog";
import { RollbackApiService } from "@/lib/rollback-api";
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

// Helper functions to transform old hex-based IDs to user-friendly format
const transformJumboIdToDisplay = (barcode: string, index: number): string => {
  // Check if it's an old hex-based ID (VJB_XXX, VIRTUAL_JUMBO_XXX or contains hex patterns)
  if (!barcode || barcode === 'Unknown Jumbo') return barcode;

  // If it's already in the new format (JR_XXXXX), return as is
  if (barcode.startsWith('JR_')) return barcode;

  // If it's old hex format (VJB_XXX, VIRTUAL_JUMBO_XXX or hex-only pattern), convert to JR_0001 format
  if (barcode.startsWith('VJB_') || barcode.includes('VIRTUAL_JUMBO') || /^[A-F0-9]{8}$/i.test(barcode)) {
    return `JR_${String(index + 1).padStart(4, '0')}`;
  }

  // Return as is for any other format
  return barcode;
};

const transformSetIdToDisplay = (setBarcode: string, setIndex: number): string => {
  // Check if it's an old hex-based ID
  if (!setBarcode || setBarcode === 'Unknown SET') return setBarcode;

  // If it's already in the new format (SET_XXXXX), return it with "Set #" prefix
  if (setBarcode.startsWith('SET_')) return setBarcode;

  // If it's old hex format (V118_XXX, VIRTUAL_118_XXX or hex-only pattern), convert to Set #1, Set #2, etc.
  if (setBarcode.startsWith('V118_') || setBarcode.includes('VIRTUAL_118') || /^[A-F0-9]{8}$/i.test(setBarcode)) {
    return `Set #${setIndex}`;
  }

  // Return as is for any other format
  return setBarcode;
};

// Sequential transformation function to convert "INV-367" format to "JR-001", "JR-002", etc.
const transformJumboId = (jumboFrontendId: string | undefined, allJumboIds: string[]): string => {
  if (!jumboFrontendId) return "Unknown";
  
  // Create a sorted list of unique jumbo IDs to ensure consistent ordering
  const uniqueJumboIds = [...new Set(allJumboIds.filter(id => id && id !== 'ungrouped'))].sort();
  
  // Find the index of this jumbo ID in the sorted list
  const index = uniqueJumboIds.indexOf(jumboFrontendId);
  
  if (index >= 0) {
    // Convert to JR-00001, JR-00002, etc. format
    return `JR-${(index + 1).toString().padStart(5, '0')}`;
  }
  
  // Fallback: return as-is if not found
  return jumboFrontendId;
};

// Smart grouping function for PDF generation (handles SCR titles automatically)
const groupCutRollsByJumboWithSequential = (cutRolls: CutRollItem[]): Record<string, { displayId: string; rolls: CutRollItem[] }> => {
  // Get all unique jumbo IDs first
  const allJumboIds = cutRolls.map(item => item.jumbo_roll_frontend_id || 'ungrouped');

  const grouped: Record<string, { displayId: string; rolls: CutRollItem[] }> = {};

  cutRolls.forEach(item => {
    const originalJumboId = item.jumbo_roll_frontend_id || 'ungrouped';
    let transformedId;

    if (originalJumboId === 'ungrouped') {
      // Check if this ungrouped item is a wastage cut roll (SCR barcode)
      const isWastageRoll = item.barcode_id?.startsWith('SCR-');
      transformedId = isWastageRoll ? 'Cut Rolls from Stock' : 'Ungrouped Items';
    } else {
      transformedId = transformJumboId(originalJumboId, allJumboIds);
    }

    if (!grouped[originalJumboId]) {
      grouped[originalJumboId] = {
        displayId: transformedId,
        rolls: []
      };
    }
    grouped[originalJumboId].rolls.push(item);
  });

  return grouped;
};

// UI display grouping function for hierarchical structure (updated)
const groupCutRollsForUIDisplay = (productionItems: any[]): Record<string, { displayId: string; rolls: any[] }> => {
  console.log('🔍 NEW GROUPING: Starting to group', productionItems.length, 'production items for UI');

  const grouped: Record<string, { displayId: string; rolls: any[] }> = {};

  productionItems.forEach((item, index) => {
    let groupId;
    let displayId;

    if (item.groupType === 'wastage') {
      // Wastage items
      groupId = 'wastage';
      displayId = 'Cut Rolls from Stock';
    } else {
      // Production items
      groupId = item.groupIdentifier || 'unknown';
      displayId = item.groupIdentifier || 'Unknown Group';
    }

    console.log(`🔍 NEW GROUPING: Item ${index + 1} - Barcode: ${item.barcode_id}, Group: ${displayId}, Type: ${item.groupType}`);

    if (!grouped[groupId]) {
      grouped[groupId] = {
        displayId: displayId,
        rolls: []
      };
    }
    grouped[groupId].rolls.push(item);
  });

  console.log('🔍 NEW GROUPING: Final groups:', Object.keys(grouped).map(key => ({
    key,
    displayId: grouped[key].displayId,
    rollCount: grouped[key].rolls.length
  })));

  return grouped;
};

interface Plan {
  id: string;
  name: string;
  status: string;
  expected_waste_percentage: number;
  actual_waste_percentage?: number;
  created_at: string;
  executed_at?: string;
  completed_at?: string;
  created_by_id: string;
  created_by?: {
    name: string;
    username: string;
  };
  cut_pattern?: any[];
  frontend_id?: string; 
}

interface ProductionSummary {
  plan_id: string;
  plan_name: string;
  plan_status: string;
  executed_at?: string;
  production_summary: {
    total_cut_rolls: number;
    total_weight_kg: number;
    average_weight_per_roll: number;
    status_breakdown: Record<string, {
      count: number;
      total_weight: number;
      widths: number[];
    }>;
    paper_specifications: {
      gsm: number;
      bf: number;
      shade: string;
      roll_count: number;
    }[];
  };
  wastage_allocations: {
    id: string;
    frontend_id: string;
    barcode_id: string;
    width_inches: number;
    weight_kg: number;
    reel_no: string;
    status: string;
    location: string;
    paper_specs: {
      gsm: number;
      bf: number;
      shade: string;
    } | null;
    created_at: string | null;
    client_name: string | null;
  }[];
  detailed_items: CutRollItem[];
}

interface CutRollItem {
  inventory_id: string;
  width_inches: number;
  weight_kg: number;
  status: string;
  location: string;
  qr_code: string;
  barcode_id?: string;
  created_at: string;
  gsm?: number;
  bf?: number;
  shade?: string;
  paper_specs?: {
    gsm: number;
    bf: number;
    shade: string;
  };
  client_name?: string;
  order_date?: string;
  // Jumbo roll hierarchy fields
  jumbo_roll_frontend_id?: string;
  jumbo_roll_id?: string;
  individual_roll_number?: number;
  parent_jumbo_id?: string;
  parent_118_roll_id?: string;
  roll_sequence?: number;
}

interface User {
  id: string;
  name: string;
  username: string;
}

interface PlanOrderItem {
  id: string;
  quantity_rolls: number;
  width_inches: number;
  paper_specs: {
    gsm: number;
    bf: number;
    shade: string;
  };
  estimated_weight_kg: number;
}

export default function PlanDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [productionSummary, setProductionSummary] = useState<ProductionSummary | null>(null);
  const [planOrderItems, setPlanOrderItems] = useState<PlanOrderItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQRCode, setSelectedQRCode] = useState<string | null>(null);

  // New hierarchical state
  const [productionHierarchy, setProductionHierarchy] = useState<any[]>([]);
  const [wastageItems, setWastageItems] = useState<any[]>([]);

  // Rollback state
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [rollbackStatus, setRollbackStatus] = useState<any>(null);
  const [rollbackAvailable, setRollbackAvailable] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [checkingRollback, setCheckingRollback] = useState(false);

  // Filter states for cut rolls
  const [cutRollSearchTerm, setCutRollSearchTerm] = useState("");
  const [cutRollStatusFilter, setCutRollStatusFilter] = useState<string>("all");

  // **PERFORMANCE FIX: Wrap load functions in useCallback to prevent duplicate calls**
  const loadPlanDetails = useCallback(async () => {
    try {
      console.log('📋 Loading plan details for:', planId);
      setLoading(true);
      setError(null);

      const response = await fetch(`${MASTER_ENDPOINTS.PLANS}/${planId}`, createRequestOptions('GET'));
      console.log('Plan details response status:', response.status);

      if (!response.ok) {
        throw new Error('Failed to load plan details');
      }

      const data = await response.json();
      console.log('✅ Plan details loaded:', data);
      setPlan(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load plan details';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('❌ Error loading plan details:', err);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  }, [planId]);

  const loadProductionSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      setProductionSummary(null);

      console.log(`Loading production summary for plan: ${planId}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('❌ Request timed out after 30 seconds');
        controller.abort();
      }, 30000);

      const url = PRODUCTION_ENDPOINTS.CUT_ROLLS_PLAN(planId);
      console.log('Fetching from URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        signal: controller.signal,
        cache: 'no-store',
        next: { revalidate: 0 }
      });

      clearTimeout(timeoutId);
      console.log('✅ Response received, status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to load production summary: ${response.status}`);
      }

      console.log('Parsing JSON...');
      const data = await response.json();
      console.log('✅ Data parsed successfully, items:', data.detailed_items?.length);
      console.log('🎯 PRODUCTION HIERARCHY:', data.production_hierarchy);
      console.log('🗑️ WASTAGE ITEMS:', data.wastage_items);

      // Set hierarchical data (new format)
      setProductionHierarchy(data.production_hierarchy || []);
      setWastageItems(data.wastage_items || []);

      setProductionSummary(data);
      console.log('Production summary set successfully');

      // Show success message with hierarchical data
      const totalItems = (data.production_hierarchy?.length || 0) + (data.wastage_items?.length || 0);
      if (totalItems > 0) {
        toast.success(`Loaded ${data.production_hierarchy?.length || 0} jumbo groups and ${data.wastage_items?.length || 0} wastage items`);
      } else {
        toast.info('No production data found for this plan yet');
      }
      console.log('About to exit try block');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cut roll details';
      console.error('Error loading production summary:', err);
      toast.error(errorMessage);
      setProductionSummary(null);
    } finally {
      console.log('In finally block, setting loadingSummary to false');
      setLoadingSummary(false);
      console.log('LoadingSummary set to false');
    }
  }, [planId]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch(MASTER_ENDPOINTS.USERS, createRequestOptions('GET'));
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }, []);

  // **PERFORMANCE FIX: Load all data in parallel with stable function references**
  useEffect(() => {
    const loadAllData = async () => {
      if (!planId) return;
      
      console.log('🚀 Starting parallel data load for plan:', planId);
      setLoading(true);
      setLoadingSummary(true);
      setLoadingOrderItems(true);
      
      try {
        // Load all API calls in parallel for 4x faster performance
        await Promise.all([
          loadPlanDetails(),
          loadProductionSummary(),
          loadUsers()
        ]);
        console.log('✅ All data loaded successfully');
      } catch (err) {
        console.error('❌ Error loading data:', err);
      }
    };

    loadAllData();
  }, [planId, loadPlanDetails, loadProductionSummary, loadUsers]);

  // **PERFORMANCE FIX: Memoize getUserById to prevent recreation on every render**
  const getUserById = useCallback((userId: string): User | null => {
    return users.find(user => user.id === userId) || null;
  }, [users]);

  // Helper function to get weight multiplier based on GSM
  const getWeightMultiplier = useCallback((gsm: number): number => {
    if (gsm <= 70) return 10;
    if (gsm <= 80) return 11;
    if (gsm <= 100) return 12.7;
    if (gsm <= 120) return 13;
    return 13.3; // 140 gsm and above
  }, []);

  // **PERFORMANCE FIX: Memoize filtered cut rolls to avoid recalculation on every render**
  // Convert hierarchical structure to flat structure for filtering (like planning page)
  const allProductionItems = useMemo(() => {
    const items:any[] = [];

    // Helper function to extract numeric value from jumbo roll ID for sorting
    const extractJumboRollNumber = (barcodeId: string): number => {
      if (!barcodeId) return 999999; // Put items without barcode at the end
      // Handle both JR_ and JR- formats
      const match = barcodeId.match(/JR[_-](\d+)/i);
      return match ? parseInt(match[1], 10) : 999999;
    };

    // Sort production hierarchy by jumbo roll number (JR_0002, JR_0003, JR_0007, etc.)
    const sortedProductionHierarchy = [...productionHierarchy].sort((a: any, b: any) => {
      const numA = extractJumboRollNumber(a.jumbo_roll?.barcode_id);
      const numB = extractJumboRollNumber(b.jumbo_roll?.barcode_id);
      return numA - numB;
    });

    // Add cut rolls from hierarchy
    sortedProductionHierarchy.forEach((jumboGroup: any, jumboIndex: number) => {
      const rawJumboBarcode = jumboGroup.jumbo_roll?.barcode_id;
      const transformedJumboId = transformJumboIdToDisplay(rawJumboBarcode || '', jumboIndex);

      jumboGroup.cut_rolls?.forEach((cutRoll: any) => {
        items.push({
          ...cutRoll,
          groupType: 'production',
          jumboBarcode: rawJumboBarcode,
          jumboLocation: jumboGroup.jumbo_roll?.location,
          groupIdentifier: transformedJumboId  // Use transformed ID for display
        });
      });
    });

    // Add wastage items as "Cut Rolls from Stock"
    wastageItems.forEach((wastageItem: any) => {
      items.push({
        ...wastageItem,
        groupType: 'wastage',
        jumboBarcode: null,
        jumboLocation: 'Stock',
        groupIdentifier: 'Cut Rolls from Stock',
        status: wastageItem.status || 'available'
      });
    });

    return items;
  }, [productionHierarchy, wastageItems]);

  const filteredCutRolls = useMemo(() => {
    if (!allProductionItems.length) return [];

    return allProductionItems.filter(item => {
      const matchesSearch = !cutRollSearchTerm ||
        item.barcode_id?.toLowerCase().includes(cutRollSearchTerm.toLowerCase()) ||
        item.groupIdentifier?.toLowerCase().includes(cutRollSearchTerm.toLowerCase()) ||
        item.paper_spec?.toLowerCase().includes(cutRollSearchTerm.toLowerCase()) ||
        (item.groupType === 'wastage' && 'cut rolls from stock'.includes(cutRollSearchTerm.toLowerCase()));

      const matchesStatus = cutRollStatusFilter === "all" || item.status === cutRollStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [allProductionItems, cutRollSearchTerm, cutRollStatusFilter]);

  // **PERFORMANCE FIX: Memoize total input weight calculation (expensive operation)**
  const totalInputWeight = useMemo(() => {
    if (!productionSummary?.detailed_items) return 0;
    
    let totalWeight = 0;
    
    // Group by paper specifications and calculate weight
    const specGroups = productionSummary.detailed_items.reduce((groups: any, item: any) => {
      if (!item.paper_specs) return groups;
      
      const key = `${item.paper_specs.gsm}_${item.paper_specs.bf}_${item.paper_specs.shade}`;
      if (!groups[key]) {
        groups[key] = {
          gsm: item.paper_specs.gsm,
          widths: {}
        };
      }
      
      const width = item.width_inches;
      if (!groups[key].widths[width]) {
        groups[key].widths[width] = 0;
      }
      groups[key].widths[width] += 1;
      
      return groups;
    }, {});
    
    // Calculate total weight using the same formula: weightMultiplier × width × quantity
    Object.values(specGroups).forEach((group: any) => {
      const weightMultiplier = getWeightMultiplier(group.gsm);
      Object.entries(group.widths).forEach(([width, quantity]: [string, any]) => {
        totalWeight += weightMultiplier * parseFloat(width) * quantity;
      });
    });
    
    return totalWeight;
  }, [productionSummary?.detailed_items, getWeightMultiplier]);

  // **PERFORMANCE FIX: Memoize grouped cut rolls to avoid recalculation**
  const groupedCutRolls = useMemo(() => {
    if (!allProductionItems.length) return {};
    return groupCutRollsForUIDisplay(allProductionItems);
  }, [allProductionItems]);

  // **PERFORMANCE FIX: Memoize sorted jumbo entries**
  const sortedJumboEntries = useMemo(() => {
    return Object.entries(groupedCutRolls)
      .sort(([aId, aGroup], [bId, bGroup]) => {
        const aDisplayId = aGroup.displayId;
        const bDisplayId = bGroup.displayId;
        
        if (aDisplayId === 'Ungrouped Items' || aDisplayId === 'Cut Rolls from Stock') return 1;
        if (bDisplayId === 'Ungrouped Items' || bDisplayId === 'Cut Rolls from Stock') return -1;
        
        const aNum = parseInt(aDisplayId.replace('JR-', '')) || 0;
        const bNum = parseInt(bDisplayId.replace('JR-', '')) || 0;
        
        return aNum - bNum;
      });
  }, [groupedCutRolls]);

  const createSampleData = async () => {
    try {
      const response = await fetch(`${PRODUCTION_ENDPOINTS.CUT_ROLLS_PLAN(planId).replace('/production/', '/create-sample-data/')}`, 
        createRequestOptions('POST')
      );

      if (!response.ok) {
        throw new Error('Failed to create sample data');
      }

      const data = await response.json();
      toast.success(data.message);
      
      // Reload the production summary to show the new data
      loadProductionSummary();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create sample data';
      toast.error(errorMessage);
      console.error('Error creating sample data:', err);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'planned': return 'outline';
      case 'in_progress': return 'secondary';
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      case 'available': return 'default';
      case 'cutting': return 'secondary';
      case 'allocated': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <Play className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleShowQRCode = (qrCode: string) => {
    setSelectedQRCode(qrCode);
  };

  // Check rollback status
  const checkRollbackStatus = useCallback(async () => {
    if (plan?.status !== 'in_progress') {
      setRollbackAvailable(false);
      return;
    }

    try {
      setCheckingRollback(true);
      const status = await RollbackApiService.getRollbackStatus(planId);
      setRollbackStatus(status);

      const isAvailable = RollbackApiService.isRollbackAvailable(status);
      setRollbackAvailable(isAvailable);

      if (isAvailable && status.remaining_minutes) {
        setTimeRemaining(status.remaining_minutes);
      }
    } catch (error) {
      console.error('Error checking rollback status:', error);
      setRollbackAvailable(false);
    } finally {
      setCheckingRollback(false);
    }
  }, [planId, plan?.status]);

  // Setup rollback status timer
  useEffect(() => {
    if (rollbackAvailable && timeRemaining > 0) {
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1/60; // Decrease by 1 second
          if (newTime <= 0) {
            setRollbackAvailable(false);
            return 0;
          }
          return newTime;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [rollbackAvailable, timeRemaining]);

  // Check rollback status when plan status changes to in_progress
  useEffect(() => {
    if (plan?.status === 'in_progress') {
      checkRollbackStatus();
    } else {
      setRollbackAvailable(false);
      setTimeRemaining(0);
    }
  }, [plan?.status, checkRollbackStatus]);

  const handleRollbackSuccess = () => {
    setRollbackAvailable(false);
    setTimeRemaining(0);
    setRollbackDialogOpen(false);

    toast.success('Plan rolled back successfully! Redirecting to plans list...');

    // Redirect to plans list page after successful rollback
    // The plan has been deleted, so we can't stay on this page
    setTimeout(() => {
      window.location.href = '/masters/plans';
    }, 2000); // 2 second delay to show the success message
  };

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
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(value, canvas.width / 2, canvas.height / 2);
      }
    }
    return canvas;
  };

  // PDF Print Functions
  const openPDFForPrint = (doc: any, filename: string) => {
    try {
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error opening PDF for print:', error);
      throw error;
    }
  };
  const printBarcodesToPDF = () => {
      try {
        const img = new Image();
        img.src = '/GPH_LOGO.png'; // Path to your base64 logo file
      if (!productionSummary || filteredCutRolls.length === 0) {
        toast.error('No cut rolls available for export');
        return;
      }

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'cm',
        format: [15.00, 10.13]
      });

      // Group cut rolls by jumbo for organized PDF output (including SCR barcodes)
      const jumboGroups = groupCutRollsByJumboWithSequential(filteredCutRolls);

      // Sort jumbo groups for consistent PDF ordering
      const sortedJumboEntries = Object.entries(jumboGroups).sort(([aId, aGroup], [bId, bGroup]) => {
        const aDisplayId = aGroup.displayId;
        const bDisplayId = bGroup.displayId;

        if (aDisplayId === 'Ungrouped Items' || aDisplayId === 'Cut Rolls from Stock') return 1;
        if (bDisplayId === 'Ungrouped Items' || bDisplayId === 'Cut Rolls from Stock') return -1;

        const aNum = parseInt(aDisplayId.replace('JR-', '')) || 0;
        const bNum = parseInt(bDisplayId.replace('JR-', '')) || 0;

        return aNum - bNum;
      });

      let isFirstLabel = true;

      // Process each jumbo group in sorted order
      sortedJumboEntries.forEach(([originalJumboId, jumboGroup]) => {
        const { displayId: jumboDisplayName, rolls: jumboRolls } = jumboGroup;

        // Sort cut rolls within this jumbo group and process them
        jumboRolls
          .sort((a, b) => {
            const aRollNum = a.individual_roll_number || 999;
            const bRollNum = b.individual_roll_number || 999;
            if (aRollNum !== bRollNum) return aRollNum - bRollNum;

            if (a.width_inches !== b.width_inches) {
              return a.width_inches - b.width_inches;
            }

            const aCode = a.barcode_id || a.qr_code;
            const bCode = b.barcode_id || b.qr_code;
            return aCode.localeCompare(bCode);
          })
          .forEach((item) => {
          // Add new page for each label (except first)
          if (!isFirstLabel) {
            doc.addPage();
          }
          isFirstLabel = false;

          const barcodeValue = item.barcode_id || item.qr_code;

          // Draw border
          doc.setDrawColor(51, 51, 51);
          doc.setLineWidth(0.03);
          doc.rect(0, 0, 15.00, 10.13);

          // Header section (1.2cm height)
          doc.setFillColor(233, 233, 233);
          doc.rect(0, 0, 15.00, 1.2, 'F');
          doc.setDrawColor(191, 191, 191);
          doc.line(0, 1.2, 15.00, 1.2);

          // Logo placeholder
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.addImage(img, 'PNG', 0.5, 0.25, 1.0, 0.7);

          // Company name
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.text('SatGuru Papers Pvt. Ltd.', 7.5, 0.65, { align: 'center' });
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text('Kraft paper Mill', 11.5, 0.65, { align: 'left' });

          // Plant address
          doc.setFontSize(8);
          // doc.setTextColor(102, 102, 102);
          doc.setFont('helvetica', 'bold');
          doc.text('Plant Address - Sector 3 Pithampur Dhar (M.P.)', 14.6, 1.0, { align: 'right' });

          // Content area - Left column (labels)
          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(34, 34, 34);

          let yPos = 2.1;
          doc.text('SHADE :', 0.8, yPos);
          yPos += 1.1;
          doc.text('SIZE (Inch) :', 0.8, yPos);
          yPos += 1.1;
          doc.text('GSM :', 0.8, yPos);
          yPos += 1.1;
          doc.text('BF :', 0.8, yPos);
          yPos += 1.1;
          doc.text('Batch No. :', 0.8, yPos);

          // Content area - Right column (values)
          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');

          yPos = 2.1;
          const rightX = 14.4;

          // PLAN NO
          doc.setFontSize(15);
          doc.text(`PLAN NO. : ${plan?.frontend_id || ''}`, rightX, yPos, { align: 'right' });
          yPos += 1.1;

          // DATE
          const formattedDate = item.order_date ? new Date(item.order_date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
          doc.text(`DATE : ${formattedDate}`, rightX, yPos, { align: 'right' });
          yPos += 1.1;

          // ROLL NO
          doc.text(`REEL NO. : ${barcodeValue}`, rightX, yPos, { align: 'right' });
          yPos += 1.1;

          // WEIGHT
          doc.text(`WEIGHT : ${item.weight_kg}kg`, rightX, yPos, { align: 'right' });

          // Left column values (shade, size, gsm, bf)
          doc.setFontSize(15);
          yPos = 2.1;
          const leftValueX = 4.5;

          doc.text(item.paper_specs?.shade || item.shade || '', leftValueX, yPos);
          yPos += 1.1;
          doc.text(`${item.width_inches}"`, leftValueX, yPos);
          yPos += 1.1;
          doc.text(`${item.paper_specs?.gsm || item.gsm || ''}`, leftValueX, yPos);
          yPos += 1.1;
          doc.text(`${item.paper_specs?.bf || item.bf || ''}`, leftValueX, yPos);
          yPos += 1.1;
          doc.text(" ", leftValueX, yPos);

          // Barcode area (10cm x 2cm) at bottom-right
          try {
            const canvas = generateBarcodeCanvas(barcodeValue);
            const barcodeDataUrl = canvas.toDataURL('image/png');

            // Position barcode at bottom-right
            const barcodeX = 4.4; // right margin 0.6cm
            const barcodeY = 7.63; // bottom margin 0.5cm
            const barcodeWidth = 10.0;
            const barcodeHeight = 2.0;

            // Draw border around barcode
            doc.setDrawColor(153, 153, 153);
            doc.setLineWidth(0.03);
            doc.rect(barcodeX, barcodeY, barcodeWidth, barcodeHeight);

            // Add barcode image
            doc.addImage(barcodeDataUrl, 'PNG', barcodeX + 0.2, barcodeY + 0.2, barcodeWidth - 0.4, barcodeHeight - 0.4);

          } catch (error) {
            console.error('Error adding barcode:', error);
            // Fallback: draw box with text
            const barcodeX = 4.4;
            const barcodeY = 7.63;
            const barcodeWidth = 10.0;
            const barcodeHeight = 2.0;

            doc.setDrawColor(153, 153, 153);
            doc.rect(barcodeX, barcodeY, barcodeWidth, barcodeHeight);

            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(barcodeValue, barcodeX + barcodeWidth / 2, barcodeY + barcodeHeight / 2, { align: 'center' });
          }
        });
      });

      openPDFForPrint(doc, `barcode-labels-${plan?.name || 'plan'}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Barcode labels opened for printing!');
    } catch (error) {
      console.error('Error exporting barcode PDF:', error);
      toast.error('Failed to export barcode PDF');
    }
  };

 const printProductionSummaryToPDF = () => {
  try {
    if (!plan || !productionSummary) {
      toast.error('Production data not available for export');
      return;
    }

    // Helper function to extract numeric value from jumbo roll ID for sorting
    const extractJumboRollNumber = (barcodeId: string): number => {
      if (!barcodeId) return 999999;
      const match = barcodeId.match(/JR[_-](\d+)/i);
      return match ? parseInt(match[1], 10) : 999999;
    };

    // Sort production hierarchy by jumbo roll number
    const sortedProductionHierarchy = [...productionHierarchy].sort((a: any, b: any) => {
      const numA = extractJumboRollNumber(a.jumbo_roll?.barcode_id);
      const numB = extractJumboRollNumber(b.jumbo_roll?.barcode_id);
      return numA - numB;
    });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Helper function to check if we need a new page
    const checkPageBreak = (height:any) => {
      if (yPosition + height > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text("Production Summary", pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Plan name and date
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Plan: ${plan.name}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Production Summary Section
    checkPageBreak(50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text("Summary", margin, yPosition);
    yPosition += 12;

    // Summary stats in grid format
    const summaryData = [
      [`Total Cut Rolls: ${productionSummary.production_summary.total_cut_rolls}`, `Total Weight: ${productionSummary.production_summary.total_weight_kg} kg`],
      [`Average Weight: ${productionSummary.production_summary.average_weight_per_roll.toFixed(1)} kg/roll`, `Paper Types: ${productionSummary.production_summary.paper_specifications.length}`]
    ];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    
    summaryData.forEach(row => {
      doc.text(row[0], margin + 5, yPosition);
      doc.text(row[1], pageWidth / 2 + 5, yPosition);
      yPosition += 8;
    });
    yPosition += 10;

    // Status Breakdown Section
    checkPageBreak(80);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text("Status Breakdown", margin, yPosition);
    yPosition += 12;

    // FIXED: Render table header FIRST, before the data
    const statusTableHeaders = ['Status', 'Count', 'Weight (kg)', 'Widths'];
    const colWidths = [40, 25, 35, 80];

    // Table header with borders
    doc.setFillColor(248, 249, 250);
    doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), 12, 'F');
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), 12, 'S');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    
    // Add column separators for header
    let colX = margin;
    for (let i = 0; i < colWidths.length - 1; i++) {
      colX += colWidths[i];
      doc.line(colX, yPosition - 2, colX, yPosition + 10);
    }
    
    let xPos = margin + 3;
    statusTableHeaders.forEach((header, index) => {
      doc.text(header, xPos, yPosition + 6);
      xPos += colWidths[index];
    });
    yPosition += 12;

    // NOW render the status breakdown table data
    const statusTableData = Object.entries(productionSummary.production_summary.status_breakdown).map(([status, data]) => {
      const uniqueWidths = [...new Set(data.widths)];
      const widthsText = uniqueWidths.join('", ') + '"';
      
      // For PDF, we'll handle text wrapping manually
      const maxCharsPerLine = 40; // Adjust based on column width
      const wrapText = (text:any, maxChars:any) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
          if ((currentLine + word).length <= maxChars) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
      };
      
      // For display purposes, we'll use the wrapped version
      const wrappedWidths = wrapText(widthsText, maxCharsPerLine);
      
      return [
        status.replace('_', ' '),
        data.count.toString(),
        data.total_weight.toFixed(1),
        wrappedWidths // This will be an array of lines
      ];
    });

    // Table rows with borders
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    
    statusTableData.forEach((row, index) => {
      // Calculate row height based on wrapped text
      const widthsLines = Array.isArray(row[3]) ? row[3] : [row[3]];
      const rowHeight = Math.max(10, widthsLines.length * 6 + 4); // Dynamic height
      
      checkPageBreak(rowHeight);
      
      if (index % 2 === 1) {
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), rowHeight, 'F');
      }
      
      // Row border
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), rowHeight, 'S');

      // Column separators
      let colX = margin;
      for (let i = 0; i < colWidths.length - 1; i++) {
        colX += colWidths[i];
        doc.line(colX, yPosition - 2, colX, yPosition + rowHeight - 2);
      }
      
      // Render cell content
      let xPos = margin + 3;
      row.forEach((cell, cellIndex) => {
        if (cellIndex === 3 && Array.isArray(cell)) {
          // Handle wrapped widths text
          cell.forEach((line, lineIndex) => {
            doc.text(line, xPos, yPosition + 5 + (lineIndex * 6));
          });
        } else {
          doc.text(typeof cell === 'string' ? cell : cell.toString(), xPos, yPosition + 5);
        }
        xPos += colWidths[cellIndex];
      });
      
      yPosition += rowHeight;
    });

    yPosition += 15;

    // Cut Rolls Table Section
    checkPageBreak(50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);

    // Calculate total cut rolls from hierarchy
    const totalCutRolls = sortedProductionHierarchy.reduce((sum, jumboGroup) =>
      sum + (jumboGroup.cut_rolls?.length || 0), 0) + wastageItems.length;

    doc.text(`Cut Rolls Details (${totalCutRolls} items)`, margin, yPosition);
    yPosition += 12;

    if (sortedProductionHierarchy.length > 0 || wastageItems.length > 0) {
      // Process production hierarchy (jumbo rolls with cut rolls)
      sortedProductionHierarchy.forEach((jumboGroup, jumboIndex) => {
        const rawJumboBarcode = jumboGroup.jumbo_roll?.barcode_id;
        const jumboDisplayName = transformJumboIdToDisplay(rawJumboBarcode || '', jumboIndex);
        const jumboRolls = jumboGroup.cut_rolls || [];
        
        // Jumbo group header with paper specs
        checkPageBreak(30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        
        // Get paper specs from jumbo roll or first cut roll
        const paperSpecs = jumboGroup.jumbo_roll?.paper_specs
          ? `(${jumboGroup.jumbo_roll.paper_specs.gsm}gsm, BF:${jumboGroup.jumbo_roll.paper_specs.bf}, ${jumboGroup.jumbo_roll.paper_specs.shade})`
          : jumboRolls[0]?.paper_specs
          ? `(${jumboRolls[0].paper_specs.gsm}gsm, BF:${jumboRolls[0].paper_specs.bf}, ${jumboRolls[0].paper_specs.shade})`
          : '';

        doc.text(`${jumboDisplayName} ${paperSpecs} - ${jumboRolls.length} rolls`, margin, yPosition);
        yPosition += 10;

        // Table headers for cut rolls
        const rollTableHeaders = ['Barcode', 'Width', 'Status', 'Client', 'Weight'];
        const rollColWidths = [45, 20, 30, 35, 30];

        doc.setFillColor(248, 249, 250);
        doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), 10, 'F');
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), 10, 'S');
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        
        // Add column separators
        let colX = margin;
        for (let i = 0; i < rollColWidths.length - 1; i++) {
          colX += rollColWidths[i];
          doc.line(colX, yPosition - 2, colX, yPosition + 8);
        }
        
        let xPos = margin + 2;
        rollTableHeaders.forEach((header, index) => {
          doc.text(header, xPos, yPosition + 5);
          xPos += rollColWidths[index];
        });
        yPosition += 10;

        // Roll data rows - sort the rolls first
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        
        jumboRolls
          .sort((a: any, b: any) => {
            const aRollNum = a.individual_roll_number || 999;
            const bRollNum = b.individual_roll_number || 999;
            if (aRollNum !== bRollNum) return aRollNum - bRollNum;

            if (a.width_inches !== b.width_inches) {
              return a.width_inches - b.width_inches;
            }

            const aCode = a.barcode_id || a.qr_code;
            const bCode = b.barcode_id || b.qr_code;
            return aCode.localeCompare(bCode);
          })
          .forEach((roll: any, rollIndex: any) => {
          checkPageBreak(8);
          
          if (rollIndex % 2 === 1) {
            doc.setFillColor(252, 252, 252);
            doc.rect(margin, yPosition - 1, pageWidth - (margin * 2), 8, 'F');
          }

          // Row border
          doc.setDrawColor(100, 100, 100);
          doc.setLineWidth(0.3);
          doc.rect(margin, yPosition - 1, pageWidth - (margin * 2), 8, 'S');
          
          // Column separators
          let colX = margin;
          for (let i = 0; i < rollColWidths.length - 1; i++) {
            colX += rollColWidths[i];
            doc.line(colX, yPosition - 1, colX, yPosition + 7);
          }

          const rollData = [
            roll.barcode_id || roll.qr_code,
            `${roll.width_inches}"`,
            roll.status.replace('_', ' '),
            roll.client_name || 'Unknown',
            roll.weight_kg === 0 ? '' : `${roll.weight_kg}kg`
          ];

          let xPos = margin + 2;
          rollData.forEach((cell, cellIndex) => {
            // Truncate long text to fit column width
            let displayText = cell;
            if (cellIndex === 0 && cell.length > 15) { // Barcode column
              displayText = cell.substring(0, 12) + '...';
            } else if (cellIndex === 3 && cell.length > 25) { // Client column
              displayText = cell.substring(0, 9) + '...';
            }
            
            doc.setFontSize(7);
            doc.text(displayText, xPos, yPosition + 4);
            xPos += rollColWidths[cellIndex];
          });
          yPosition += 8;
        });

        yPosition += 8; // Space between jumbo groups
      });

      // Add wastage items section if exists
      if (wastageItems.length > 0) {
        // Wastage group header
        checkPageBreak(30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(`Cut Rolls from Stock - ${wastageItems.length} rolls`, margin, yPosition);
        yPosition += 10;

        // Table headers for wastage rolls
        const rollTableHeaders = ['Barcode', 'Width', 'Status', 'Client', 'Weight'];
        const rollColWidths = [45, 20, 30, 35, 30];

        doc.setFillColor(248, 249, 250);
        doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), 10, 'F');
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.rect(margin, yPosition - 2, pageWidth - (margin * 2), 10, 'S');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);

        // Add column separators
        let colX = margin;
        for (let i = 0; i < rollColWidths.length - 1; i++) {
          colX += rollColWidths[i];
          doc.line(colX, yPosition - 2, colX, yPosition + 8);
        }

        let xPos = margin + 2;
        rollTableHeaders.forEach((header, index) => {
          doc.text(header, xPos, yPosition + 5);
          xPos += rollColWidths[index];
        });
        yPosition += 10;

        // Wastage roll data rows
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);

        wastageItems
          .sort((a: any, b: any) => {
            if (a.width_inches !== b.width_inches) {
              return a.width_inches - b.width_inches;
            }
            const aCode = a.barcode_id || a.qr_code;
            const bCode = b.barcode_id || b.qr_code;
            return aCode.localeCompare(bCode);
          })
          .forEach((roll: any, rollIndex: any) => {
            checkPageBreak(8);

            if (rollIndex % 2 === 1) {
              doc.setFillColor(252, 252, 252);
              doc.rect(margin, yPosition - 1, pageWidth - (margin * 2), 8, 'F');
            }

            // Row border
            doc.setDrawColor(100, 100, 100);
            doc.setLineWidth(0.3);
            doc.rect(margin, yPosition - 1, pageWidth - (margin * 2), 8, 'S');

            // Column separators
            let colX = margin;
            for (let i = 0; i < rollColWidths.length - 1; i++) {
              colX += rollColWidths[i];
              doc.line(colX, yPosition - 1, colX, yPosition + 7);
            }

            const rollData = [
              roll.barcode_id || roll.qr_code,
              `${roll.width_inches}"`,
              roll.status.replace('_', ' '),
              roll.client_name || 'Unknown',
              roll.weight_kg === 0 ? '' : `${roll.weight_kg}kg`
            ];

            let xPos = margin + 2;
            rollData.forEach((cell, cellIndex) => {
              // Truncate long text to fit column width
              let displayText = cell;
              if (cellIndex === 0 && cell.length > 15) { // Barcode column
                displayText = cell.substring(0, 12) + '...';
              } else if (cellIndex === 3 && cell.length > 25) { // Client column
                displayText = cell.substring(0, 9) + '...';
              }

              doc.setFontSize(7);
              doc.text(displayText, xPos, yPosition + 4);
              xPos += rollColWidths[cellIndex];
            });
            yPosition += 8;
          });
      }
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("No cut rolls found", margin, yPosition);
    }

    // Add page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    // Print the PDF directly
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    const printWindow = window.open(pdfUrl);
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
      toast.success('Printing production summary...');
    } else {
      toast.error('Unable to open print window. Please check your browser settings.');
    }
  } catch (error) {
    console.error('Error exporting production summary PDF:', error);
    toast.error('Failed to export production summary PDF');
  }
};

  const printPlanDetailsToPDF = () => {
    try {
      if (!plan || !productionSummary) {
        toast.error('Plan data not available for export');
        return;
      }

      // Helper function to extract numeric value from jumbo roll ID for sorting
      const extractJumboRollNumber = (barcodeId: string): number => {
        if (!barcodeId) return 999999;
        const match = barcodeId.match(/JR[_-](\d+)/i);
        return match ? parseInt(match[1], 10) : 999999;
      };

      // Sort production hierarchy by jumbo roll number
      const sortedProductionHierarchy = [...productionHierarchy].sort((a: any, b: any) => {
        const numA = extractJumboRollNumber(a.jumbo_roll?.barcode_id);
        const numB = extractJumboRollNumber(b.jumbo_roll?.barcode_id);
        return numA - numB;
      });

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 30; // Top margin to leave space for stapling

      // Helper function to check if we need a new page
      const checkPageBreak = (height: number) => {
        if (yPosition + height > pageHeight - 20) {
          doc.addPage();
          yPosition = 30; // Top margin to leave space for stapling
        }
      };


      // Plan Information
      doc.setFontSize(14);
      doc.text(`Plan: ${plan.frontend_id || 'Unnamed Plan'}`, 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Status: ${plan.status}`, 20, yPosition);
      yPosition += 5;
      doc.text(`Expected Waste: ${plan.expected_waste_percentage}%`, 20, yPosition);
      yPosition += 5;
      doc.text(`Created: ${new Date(plan.created_at).toLocaleString()}`, 20, yPosition);
      yPosition += 5;
      const user = getUserById(plan.created_by_id);
      doc.text(`Created By: ${user?.name || plan.created_by?.name || 'Unknown'}`, 20, yPosition);
      yPosition += 15;

      // Extract unique clients and paper specs from new production hierarchy data
      // Combine cut rolls from all jumbo groups and wastage items
      const allProductionItems: any[] = [];

      // Add cut rolls from production hierarchy
      sortedProductionHierarchy.forEach(jumboGroup => {
        if (jumboGroup.cut_rolls) {
          allProductionItems.push(...jumboGroup.cut_rolls);
        }
      });

      // Add wastage items
      allProductionItems.push(...wastageItems);

      const uniqueClients = [...new Set(allProductionItems
        .map(item => item.client_name)
        .filter(client => client && client !== 'Unknown Client'))];

      const uniquePaperSpecs = [...new Set(allProductionItems
        .filter(item => item.paper_specs)
        .map(item => `${item.paper_specs!.gsm}gsm, BF:${item.paper_specs!.bf}, ${item.paper_specs!.shade}`))];

      // Clients Section
      if (uniqueClients.length > 0) {
        checkPageBreak(30);
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text('Clients:', 20, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        uniqueClients.forEach((client, index) => {
          doc.text(`• ${client}`, 25, yPosition);
          yPosition += 6;
          if ((index + 1) % 15 === 0) checkPageBreak(20); // Check page break every 15 clients
        });
        yPosition += 8;
      }

      // Helper function to get weight multiplier based on GSM
      const getWeightMultiplier = (gsm: number): number => {
        if (gsm <= 70) return 10;
        if (gsm <= 80) return 11;
        if (gsm <= 100) return 12.7;
        if (gsm <= 120) return 13;
        return 13.3; // 140 gsm and above
      };

      // Paper Specifications Section with Roll Counts and Weights
      const paperSpecifications = productionSummary?.production_summary?.paper_specifications || [];
      if (paperSpecifications.length > 0) {
        checkPageBreak(30);
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text('Paper Specifications:', 20, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);

        // Group specifications by paper type (GSM, BF, Shade) and calculate total weight
        const specGroups = paperSpecifications.reduce((groups: any, spec: any) => {
          const key = `${spec.gsm}gsm, BF:${spec.bf}, ${spec.shade}`;
          if (!groups[key]) {
            groups[key] = {
              gsm: spec.gsm,
              bf: spec.bf,
              shade: spec.shade,
              details: []
            };
          }
          groups[key].details.push(spec);
          return groups;
        }, {});

        // Helper function to wrap text for PDF
        const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
          doc.setFontSize(fontSize);
          const words = text.split(' ');
          const lines: string[] = [];
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const textWidth = doc.getTextWidth(testLine);
            
            if (textWidth > maxWidth && currentLine !== '') {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          
          if (currentLine) {
            lines.push(currentLine);
          }
          
          return lines;
        };

        Object.entries(specGroups).forEach(([specKey, specGroup]: [string, any], index) => {
          const weightMultiplier = getWeightMultiplier(specGroup.gsm);
          
          // Calculate total weight for this specification
          let totalWeight = 0;
          let totalRolls = 0;
          
          // Get width and quantity details from allProductionItems (new structure)
          const specItems = allProductionItems.filter((item: any) =>
            item.paper_specs &&
            item.paper_specs.gsm === specGroup.gsm &&
            item.paper_specs.bf === specGroup.bf &&
            item.paper_specs.shade === specGroup.shade
          );
          
          // Group by width to calculate weight properly
          const widthGroups = specItems.reduce((widthMap: any, item: any) => {
            const width = item.width_inches;
            if (!widthMap[width]) {
              widthMap[width] = 0;
            }
            widthMap[width] += 1; // Count rolls for this width
            return widthMap;
          }, {});
          
          // Calculate total weight: weightMultiplier × width × quantity for each width
          Object.entries(widthGroups).forEach(([width, quantity]: [string, any]) => {
            totalWeight += weightMultiplier * parseFloat(width) * quantity;
            totalRolls += quantity;
          });
          
          // Format width details for display
          const widthDetails = Object.entries(widthGroups)
            .map(([width, qty]) => `${width}"×${qty}`)
            .join(', ');
          
          const specText = `• ${specKey} - ${totalRolls} rolls (${widthDetails}) - Weight: ${totalWeight.toFixed(1)}kg`;
          
          // Wrap text if it's too long (max width: pageWidth - 50 for margins and bullet)
          const maxLineWidth = pageWidth - 50;
          const wrappedLines = wrapText(specText, maxLineWidth, 10);
          
          // Check if we need page break for all lines of this spec
          checkPageBreak(wrappedLines.length * 6 + 2);
          
          // Print each line of the wrapped text
          wrappedLines.forEach((line, lineIndex) => {
            const xPos = lineIndex === 0 ? 25 : 30; // Indent continuation lines slightly more
            doc.text(line, xPos, yPosition);
            yPosition += 6;
          });
          
          // Add small gap between specifications
          yPosition += 2;
        });
        yPosition += 8;
      }

      // Cut Rolls Status Summary
      checkPageBreak(30);
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Cut Rolls Summary:', 20, yPosition);
      yPosition += 15;

      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total Cut Rolls: ${productionSummary.production_summary.total_cut_rolls}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Expected Waste: ${plan.expected_waste_percentage}%`, 20, yPosition);
      yPosition += 8;

      // Separate SCR cut rolls from regular cut rolls for plan details PDF - using new data structure
      const regularCutRolls = allProductionItems.filter(roll => !roll.barcode_id?.startsWith('SCR-'));
      const scrCutRolls = allProductionItems.filter(roll => roll.barcode_id?.startsWith('SCR-'));

      // ADD THIS: Total Weight Summary Section
      checkPageBreak(40);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('Total Weight Summary:', 20, yPosition);
      yPosition += 15;

      // Summary statistics
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);

      // Calculate total weight from paper specifications (same calculation as above)
      let totalWeight = 0;

      // Group by paper specs and calculate weight the same way as paper specifications section
      const specGroupsForWeight = productionSummary.production_summary.paper_specifications.reduce((groups: any, spec: any) => {
        const key = `${spec.gsm}gsm, BF:${spec.bf}, ${spec.shade}`;
        if (!groups[key]) {
          groups[key] = {
            gsm: spec.gsm,
            bf: spec.bf,
            shade: spec.shade,
          };
        }
        return groups;
      }, {});

      Object.entries(specGroupsForWeight).forEach(([specKey, specGroup]: [string, any]) => {
        const weightMultiplier = getWeightMultiplier(specGroup.gsm);

        // Get items for this specification - using new data structure
        const specItems = allProductionItems.filter((item: any) =>
          item.paper_specs &&
          item.paper_specs.gsm === specGroup.gsm &&
          item.paper_specs.bf === specGroup.bf &&
          item.paper_specs.shade === specGroup.shade
        );

        // Calculate weight for this specification
        specItems.forEach((item: any) => {
          totalWeight += weightMultiplier * parseFloat(item.width_inches);
        });
      });

      // Calculate SCR weight separately
      const totalScrWeight = scrCutRolls.length > 0 ? scrCutRolls.reduce((sum, roll) => sum + (roll.weight_kg || 0), 0) : 0;
      const totalRegularWeight = totalWeight - totalScrWeight;

      // Display the weight breakdown
      if (scrCutRolls.length > 0) {
        doc.text(`• Regular Production Rolls: ${totalRegularWeight.toFixed(1)}kg`, 25, yPosition);
        yPosition += 8;
        doc.text(`• Stock Sourced Rolls (SCR): ${totalScrWeight.toFixed(1)}kg`, 25, yPosition);
      } else {
        doc.text(`• All rolls are new production: ${totalWeight.toFixed(1)}kg`, 25, yPosition);
      }
      yPosition += 8;

      // Draw separator line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(1);
      doc.line(25, yPosition, pageWidth - 25, yPosition);
      yPosition += 10;

      // Grand total
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(`Grand Total Weight: ${totalWeight.toFixed(1)}kg`, 25, yPosition);
      yPosition += 12;

      // Optional: Weight efficiency metrics
      if (plan.expected_waste_percentage) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Expected Waste Efficiency: ${(100 - plan.expected_waste_percentage).toFixed(1)}%`, 25, yPosition);
        yPosition += 10;
      }

      Object.entries(productionSummary.production_summary.status_breakdown).forEach(([status, data]) => {
        doc.text(`${status}: ${data.count} rolls (${data.total_weight.toFixed(1)} kg)`, 20, yPosition);
        yPosition += 6;
      });
      yPosition += 10;

      // Add SCR Cut Rolls Summary if any exist
      if (scrCutRolls.length > 0) {
        checkPageBreak(80);

        // Summary header
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('Cut Rolls from Stock Summary', 20, yPosition);
        yPosition += 12;

        // Summary description
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(`${scrCutRolls.length} cut rolls sourced from existing stock:`, 20, yPosition);
        yPosition += 12;

        // List each SCR cut roll - using new scrCutRolls data structure
        scrCutRolls.forEach((roll, index) => {
          checkPageBreak(8);

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          const rollText = `• Reel No: ${roll.reel_no || roll.barcode_id} - ${roll.width_inches}" × ${roll.weight_kg}kg - ${roll.paper_specs?.gsm}gsm, ${roll.paper_specs?.bf}bf, ${roll.paper_specs?.shade} - ${roll.client_name || 'Unknown Client'}`;
          doc.text(rollText, 25, yPosition);
          yPosition += 6;
        });

        yPosition += 10;
      }

      // Use production hierarchy data directly for visual cutting patterns
      if (sortedProductionHierarchy.length === 0) {
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text("No production data available for cutting pattern", 20, yPosition);
        yPosition += 15;
      } else {
        // Process each jumbo roll from production hierarchy
        sortedProductionHierarchy.forEach((jumboGroup, jumboIndex) => {
          const rawJumboBarcode = jumboGroup.jumbo_roll?.barcode_id || 'Unknown Jumbo';
          const jumboDisplayId = transformJumboIdToDisplay(rawJumboBarcode, jumboIndex);
          const jumboRolls = jumboGroup.cut_rolls || [];

          // Add new page for each jumbo roll (except the first one)
          if (jumboIndex > -1) {
            doc.addPage();
            yPosition = 30; // Top margin to leave space for stapling
          }
          
          // Get paper specification from first roll (all rolls in jumbo have same specs)
          const paperSpecs = jumboRolls[0]?.paper_specs;
          const specKey = paperSpecs 
            ? `${paperSpecs.gsm}gsm, ${paperSpecs.bf}bf, ${paperSpecs.shade}`
            : 'Unknown Specification';
          
          checkPageBreak(25);

          // Specification header
          doc.setFontSize(14);
          doc.setTextColor(40, 40, 40);
          doc.text(specKey, 20, yPosition);
          yPosition += 10;

          // Jumbo roll info is directly available
          const totalWeight = jumboRolls.reduce((sum: number, roll: any) => sum + (roll.weight_kg || 0), 0);
          const cutCount = jumboRolls.length;
          const productionInfo = { totalWeight, cutCount };

          // LEVEL 1: JUMBO ROLL HEADER (Main header with border)
          checkPageBreak(35);
          doc.setFillColor(240, 240, 240); // Light gray background
          doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'F'); // Background rectangle
          doc.setDrawColor(100, 100, 100);
          doc.setLineWidth(1);
          doc.rect(20, yPosition - 5, pageWidth - 40, 20, 'S'); // Border
          
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(40, 40, 40);
          doc.text(jumboDisplayId, 25, yPosition + 6); // Jumbo roll header
          
          // Add production info next to jumbo header
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          doc.text(`Production: ${productionInfo.cutCount} cuts, ${productionInfo.totalWeight.toFixed(1)}kg`, pageWidth - 25, yPosition + 6, { align: 'right' });
          yPosition += 25;

          // Group by parent_118_roll_barcode (SET rolls) within this jumbo - from production data
          const rollsBySet = jumboRolls.reduce((rollGroups: any, roll: any) => {
            const setBarcode = roll.parent_118_roll_barcode || "Unknown SET";
            if (!rollGroups[setBarcode]) {
              rollGroups[setBarcode] = [];
            }
            rollGroups[setBarcode].push(roll);
            return rollGroups;
          }, {} as Record<string, any[]>);

          // Sort SET rolls by barcode to maintain order
          const sortedSetEntries = Object.entries(rollsBySet).sort(([a], [b]) => {
            // Extract number from barcode for sorting (SET_00031 -> 31)
            const aNum = parseInt(a.split('_')[1] || '0');
            const bNum = parseInt(b.split('_')[1] || '0');
            return aNum - bNum;
          });

          // LEVEL 2: INDIVIDUAL 118" ROLL (SET) SUB-HEADERS + LEVEL 3: VISUAL PATTERNS
          sortedSetEntries.forEach(([setBarcode, rollsInSet]: [any, any], setIndex) => {
            checkPageBreak(80);

            // LEVEL 2: SET Roll Sub-header (Set #1, Set #2, etc.)
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(60, 60, 60);
            const transformedSetId = transformSetIdToDisplay(setBarcode, setIndex + 1);
            const rollTitle = setBarcode === "Unknown SET" ? "Unassigned Roll" : `${transformedSetId} (${rollsInSet.length} cuts)`;
            doc.text(rollTitle, 35, yPosition);
            yPosition += 12;

            // LEVEL 3: Visual cutting pattern representation (reconstructed from production data)
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text("Cutting Pattern:", 40, yPosition);
            yPosition += 8;

            const sortedRolls = rollsInSet.sort((a:any, b:any) => {
  // Extract numeric part from barcode_id (CR_00678 -> 678)
  const getNumericPart = (barcode: string): number => {
    if (!barcode) return 999999;
    const match = barcode.match(/CR_(\d+)/i);
    return match ? parseInt(match[1], 10) : 999999;
  };
  
  const aNum = getNumericPart(a.barcode_id);
  const bNum = getNumericPart(b.barcode_id);
  
  return aNum - bNum;
});

            // Always check if width exceeds 123" and apply automatic segmentation
            const maxAllowedWidth = 123; // Maximum width constraint in inches

            // Create segments automatically based on width constraint
            const segments: any[][] = [];
            let currentSegment: any[] = [];
            let currentWidth = 0;
            
            // Process each roll and create new segments when width exceeds 118"
            sortedRolls.forEach((roll: any) => {
              const rollWidth = roll.width_inches || 0;
              
              // If this single roll exceeds max width, place it in its own segment
              if (rollWidth > maxAllowedWidth) {
                // If we have rolls in current segment, add them first
                if (currentSegment.length > 0) {
                  segments.push([...currentSegment]);
                  currentSegment = [];
                  currentWidth = 0;
                }
                
                // Add this oversized roll in its own segment
                segments.push([roll]);
              }
              // If adding this roll would exceed max width, start a new segment
              else if (currentWidth + rollWidth > maxAllowedWidth) {
                // Add current segment to segments list
                if (currentSegment.length > 0) {
                  segments.push([...currentSegment]);
                  currentSegment = [roll]; // Start new segment with current roll
                  currentWidth = rollWidth;
                } else {
                  // If current segment is empty, add this roll to a new segment
                  currentSegment = [roll];
                  currentWidth = rollWidth;
                }
              } 
              // Otherwise add to current segment
              else {
                currentSegment.push(roll);
                currentWidth += rollWidth;
              }
            });
            
            // Add any remaining rolls in the last segment
            if (currentSegment.length > 0) {
              segments.push(currentSegment);
            }
            
            // Display segments with appropriate labels
            segments.forEach((segment, segmentIndex) => {
              // Add segment labels for multi-segment rolls
              if (segments.length > 1) {
                if (segmentIndex === 0) {
                  
                  yPosition += 2;
                }
              }
              
              // Draw visual cutting representation for this segment
              const rectStartX = 40;
              const rectWidth = pageWidth - 65;
              const rectHeight = 20; // Slightly taller for better visibility
              let currentX = rectStartX;
              
              // Calculate total used width for this segment
              const totalUsedWidth = segment.reduce((sum:number, roll:any) => sum + (roll.width_inches || 0), 0);
              const waste = Math.max(0, maxAllowedWidth - totalUsedWidth); // Calculate waste (ensure non-negative)
              
              // Draw each cut section in this segment
              segment.forEach((roll:any) => {

 const rollRatio = roll.width_inches / 123;
           const availableWidth = rectWidth * 0.85;
             const calculatedWidth = availableWidth *         
            rollRatio;
                    const sectionWidth = Math.max(35, 
            Math.min(55, calculatedWidth))

                // Set color based on status
                if (roll.status === 'cutting') {
                  doc.setFillColor(189, 189, 189); // For cutting status
                } else {
                  doc.setFillColor(115, 114, 114); // Default color
                }

                // Draw rectangle for this cut
                doc.rect(currentX, yPosition, sectionWidth, rectHeight, 'F');
                
                // Add border
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.5);
                doc.rect(currentX, yPosition, sectionWidth, rectHeight, 'S');

                // Add width and client name text inside the rectangle
                if (sectionWidth > 15) { // Only add text if section is wide enough
                  doc.setTextColor(0, 0, 0);
                  doc.setFontSize(6);
                  const textX = currentX + sectionWidth/2;
                  
                  // Get client name directly from the new hierarchy data structure
                  let clientName = roll.client_name || '';
                  // Truncate to first 8 characters if longer
                  if (clientName.length > 8) {
                    clientName = clientName.substring(0, 8);
                  }
                  
                  // Display client name on top line, width on bottom line
                  if (clientName && sectionWidth > 25) {
                    const topTextY = yPosition + rectHeight/2 - 2;
                    const bottomTextY = yPosition + rectHeight/2 + 4;
                    doc.text(clientName, textX, topTextY, { align: 'center' });
                    doc.text(`${roll.width_inches}"`, textX, bottomTextY, { align: 'center' });
                    doc.text(`${roll.barcode_id}`, textX, bottomTextY + 4, { align: 'center' });
                  } else {
                    // If space is limited, show client name only or width only
                    const textY = yPosition + rectHeight/2 + 1;
                    if (clientName) {
                      doc.text(clientName, textX, textY, { align: 'center' });
                    } else {
                      doc.text(`${roll.width_inches}"`, textX, textY, { align: 'center' });
                    }
                  }
                }

                currentX += sectionWidth;
              });

              // Draw waste section
              if (waste > 0) {
                const wasteRatio = waste / maxAllowedWidth;
                const wasteWidth = rectWidth * wasteRatio;
                
                doc.setFillColor(239, 68, 68); // Red for waste
                doc.rect(currentX, yPosition, wasteWidth, rectHeight, 'F');
                doc.setDrawColor(255, 255, 255);
                doc.rect(currentX, yPosition, wasteWidth, rectHeight, 'S');
                
                if (wasteWidth > 20) { // Only add text if waste section is wide enough
                  doc.setTextColor(255, 255, 255);
                  doc.setFontSize(6);
                  doc.text(`Waste: ${waste.toFixed(1)}"`, currentX + wasteWidth/2, yPosition + rectHeight/2 + 1, { align: 'center' });
                }
              }

              yPosition += rectHeight + 3;

              // Add 123" total indicator
              doc.setTextColor(100, 100, 100);
              doc.setFontSize(7);
              doc.text("123\" Total Width", rectStartX + rectWidth/2, yPosition, { align: 'center' });
              yPosition += 8;

              // Statistics for this segment
              const efficiency = ((totalUsedWidth / maxAllowedWidth) * 100);
              checkPageBreak(25);
              doc.setFontSize(8);
              doc.setTextColor(60, 60, 60);
              
              let statsLine = `Used: ${totalUsedWidth.toFixed(1)}"  |  Waste: ${waste.toFixed(1)}"  |  Efficiency: ${efficiency.toFixed(1)}%  |  Cuts: ${segment.length}`;
              
              doc.text(statsLine, 30, yPosition);
              yPosition += 15;
              
              // Add spacing between segments if not the last one
              if (segmentIndex < segments.length - 1) {
                checkPageBreak(10);
                yPosition += 5;
              }
            });
          });

          yPosition += 10; // Space between specifications
        });
      }

      // Add page numbers to all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
      }

      openPDFForPrint(doc, `plan-details-${plan.name || 'plan'}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Plan details opened for printing!');
    } catch (error) {
      console.error('Error exporting plan details PDF:', error);
      toast.error('Failed to export plan details PDF');
    }
  };

  // **REMOVED: filteredCutRolls is now memoized above for better performance**

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading plan details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !plan) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Plans
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || 'Plan not found'}</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Plans
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Factory className="w-8 h-8 text-primary" />
                {plan.name || 'Plan Details'}
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive view of cutting plan and production details
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {productionSummary && filteredCutRolls.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={printProductionSummaryToPDF}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={printBarcodesToPDF}
                >
                  <ScanLine className="mr-2 h-4 w-4" />
                  Export Labels
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={printPlanDetailsToPDF}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Export Plan Report
                </Button>
              </>
            )}

            {/* Rollback Button */}
            {rollbackAvailable && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRollbackDialogOpen(true)}
                className="animate-pulse"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Rollback ({Math.floor(timeRemaining)}:{String(Math.floor((timeRemaining % 1) * 60)).padStart(2, '0')})
              </Button>
            )}
          </div>
        </div>

        {/* Plan Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plan Overview
                  <Badge variant={getStatusBadgeVariant(plan.status)}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(plan.status)}
                      {plan.status.replace('_', ' ')}
                    </div>
                  </Badge>
                </CardTitle>
                <CardDescription>Basic plan information and timeline</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Expected Waste</label>
                <p className="text-2xl font-bold">{plan.expected_waste_percentage}%</p>
              </div>
              {plan.actual_waste_percentage && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Actual Waste</label>
                  <p className="text-2xl font-bold">{plan.actual_waste_percentage}%</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Created
                </label>
                <p className="text-lg font-medium">
                  {new Date(plan.created_at).toLocaleDateString('en-GB')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(plan.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Created By
                </label>
                <p className="text-lg font-medium">
                  {(() => {
                    const user = getUserById(plan.created_by_id);
                    return user?.name || plan.created_by?.name || 'Unknown';
                  })()}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{(() => {
                    const user = getUserById(plan.created_by_id);
                    return user?.username || plan.created_by?.username || 'unknown';
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rollback Availability Notice */}
        {rollbackAvailable && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="w-5 h-5" />
                Rollback Available
              </CardTitle>
              <CardDescription className="text-orange-600">
                You can rollback this plan within the next {Math.floor(timeRemaining)} minutes {Math.floor((timeRemaining % 1) * 60)} seconds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="font-medium text-orange-700">
                    ⏰ Rollback Window Active
                  </div>
                  <div className="text-sm text-orange-600">
                    Time remaining: {RollbackApiService.formatTimeRemaining(timeRemaining)}
                  </div>
                  <div className="w-full bg-orange-200 rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full transition-all duration-1000"
                      style={{
                        width: `${RollbackApiService.getProgressValue(timeRemaining)}%`
                      }}
                    />
                  </div>
                  <div className="text-xs text-orange-500">
                    Rollback will restore this plan to "planned" status and remove all created inventory.
                  </div>
                </div>
                <Button
                  onClick={() => setRollbackDialogOpen(true)}
                  variant="destructive"
                  size="sm"
                  className="min-w-32"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rollback Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        

        {/* Production Summary */}
        {loadingSummary ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Loading production details...</p>
              </div>
            </CardContent>
          </Card>
        ) : productionSummary ? (
          <div className="space-y-6">
            {/* Production Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">Total Rolls</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.total_cut_rolls}</p>
                  <p className="text-xs text-muted-foreground mt-1">Cut rolls produced</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Weight className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">Total Weight</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.total_weight_kg}</p>
                  <p className="text-xs text-muted-foreground mt-1">kg total weight</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Ruler className="h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium">Avg Weight</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.average_weight_per_roll.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground mt-1">kg per roll</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Factory className="h-5 w-5 text-orange-500" />
                    <span className="text-sm font-medium">Paper Types</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.paper_specifications.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">different specs</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Weight className="h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium">Input Weight</span>
                  </div>
                  <p className="text-3xl font-bold">
                    {loadingSummary || !productionSummary ? '...' : totalInputWeight.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">kg calculated</p>
                </CardContent>
              </Card>
            </div>

            {/* Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Production Status Breakdown</CardTitle>
                <CardDescription>Overview of cut roll statuses and their distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(productionSummary.production_summary.status_breakdown).map(([status, data]) => (
                    <div key={status} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
                          {status.replace('_', ' ')}
                        </Badge>
                        <span className="font-bold text-xl">{data.count}</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Weight: {data.total_weight.toFixed(1)} kg</div>
                        <div>Widths: {[...new Set(data.widths)].join('", ')}"</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cut Rolls Table with Jumbo Roll Grouping */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Cut Rolls Details ({filteredCutRolls.length})</CardTitle>
                    <CardDescription>Cut rolls grouped by jumbo rolls in this plan</CardDescription>
                  </div>
                  <div className="flex gap-3">
                    {filteredCutRolls.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={printBarcodesToPDF}
                        className="text-purple-600 border-purple-600 hover:bg-purple-50"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Export Labels
                      </Button>
                    )}
                    {productionSummary.detailed_items.length === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={createSampleData}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        <Factory className="h-3 w-3 mr-1" />
                        Create Sample Data
                      </Button>
                    )}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search cut rolls..."
                        value={cutRollSearchTerm}
                        onChange={(e) => setCutRollSearchTerm(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={cutRollStatusFilter} onValueChange={setCutRollStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {Object.keys(productionSummary.production_summary.status_breakdown).map(status => (
                          <SelectItem key={status} value={status}>
                            {status.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredCutRolls.length > 0 ? (
                  <div className="space-y-6">
                    {sortedJumboEntries.map(([originalJumboId, jumboGroup]) => {
                      const { displayId: jumboDisplayName, rolls: jumboRolls } = jumboGroup;
                      
                      return (
                        <div key={originalJumboId} className="border rounded-lg p-4 bg-card">
                          <div className="flex items-center justify-between mb-4 pb-3 border-b">
                            <div className="flex items-center gap-2">
                              <Package className="h-5 w-5 text-blue-500" />
                              <h3 className="text-lg font-semibold">{jumboDisplayName}</h3>
                              <Badge variant="outline" className="ml-2">
                                {jumboRolls.length} cut {jumboRolls.length === 1 ? 'roll' : 'rolls'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Total Weight: {jumboRolls.reduce((sum, roll) => sum + roll.weight_kg, 0).toFixed(1)} kg
                            </div>
                          </div>
                          
                          <div className="border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Barcode</TableHead>
                                  <TableHead>Dimensions</TableHead>
                                  <TableHead>Paper Specs</TableHead>
                                  <TableHead>Weight</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Client</TableHead>
                                  <TableHead>Created</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {jumboRolls
                                  .sort((a, b) => {

                                    //  by barcode
                                    const aCode = a.barcode_id || a.qr_code;
                                    const bCode = b.barcode_id || b.qr_code;
                                    return aCode.localeCompare(bCode);
                                  })
                                  .map((item) => (
                                  <TableRow key={item.inventory_id}>
                                    <TableCell>
                                      <div className="font-mono text-xs">{item.barcode_id || item.qr_code}</div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{item.width_inches}"</div>
                                    </TableCell>
                                    <TableCell>
                                      {item.paper_specs && (
                                        <div className="text-sm">
                                          <div>{item.paper_specs.gsm}gsm</div>
                                          <div className="text-xs text-muted-foreground">
                                            BF: {item.paper_specs.bf}, {item.paper_specs.shade}
                                          </div>
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{item.weight_kg} kg</div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={getStatusBadgeVariant(item.status)} className="text-xs">
                                        {item.status.replace('_', ' ')}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm">
                                        {item.client_name || "Unknown Client"}
                                      </div>
                                      {item.order_date && (
                                        <div className="text-xs text-muted-foreground">
                                          Order: {new Date(item.order_date).toLocaleDateString('en-GB')}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-xs text-muted-foreground">
                                        {new Date(item.created_at).toLocaleDateString('en-GB')}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleShowQRCode(item.barcode_id || item.qr_code)}
                                      >
                                        {item.barcode_id ? <ScanLine className="h-3 w-3" /> : <QrCode className="h-3 w-3" />}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border rounded-lg p-12 text-center">
                    {productionSummary.detailed_items.length === 0
                      ? "No cut rolls found for this plan."
                      : "No cut rolls match the current filters."
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  No production data available for this plan.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Code Display Modal */}
        {selectedQRCode && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-4 rounded-lg max-w-sm w-full mx-4">
              {selectedQRCode?.startsWith('CR_') ? (
                <BarcodeDisplay
                  value={selectedQRCode}
                  title="Cut Roll Barcode"
                  description={`Scan this barcode to access cut roll details`}
                  width={2}
                  height={100}
                  showActions={true}
                />
              ) : (
                <QRCodeDisplay
                  value={selectedQRCode}
                  title="Cut Roll QR Code"
                  description={`Scan this code to access cut roll details`}
                  size={200}
                  showActions={true}
                />
              )}
              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={() => setSelectedQRCode(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Rollback Dialog */}
        <RollbackPlanDialog
          open={rollbackDialogOpen}
          onClose={() => setRollbackDialogOpen(false)}
          planId={planId}
          planName={plan?.name || plan?.frontend_id || `Plan ${planId?.slice(-8)}`}
          userId={users.find(u => u.id === plan?.created_by_id)?.id || 'current-user-id'}
          onRollbackSuccess={handleRollbackSuccess}
        />
      </div>
    </DashboardLayout>
  );
}