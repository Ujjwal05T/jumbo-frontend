/**
 * Pending Order Items page - Manage pending order items
 */
"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Clock, 
  Search, 
  AlertTriangle,
  Calendar,
  DollarSign,
  Package,
  Settings,
  Target,
  FileDown,
  Filter,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface PendingOrderItem {
  id: string;
  original_order_id: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  quantity_pending: number;
  reason: string;
  status: "pending" | "in_production" | "resolved" | "cancelled";
  production_order_id?: string;
  created_at: string;
  resolved_at?: string;
  // Related data
  original_order?: {
    id: string;
    client?: {
      company_name: string;
    };
  };
  created_by?: {
    name: string;
  };
  frontend_id?: string; // Human-readable ID for display
}

interface JumboRollSuggestion {
  suggestion_id: string;
  paper_specs: {
    gsm: number;
    bf: number;
    shade: string;
  };
  jumbo_number: number;
  target_width: number;
  pending_order_ids: string[];
  rolls: Array<{
    roll_number: number;
    target_width: number;
    actual_width: number;
    waste: number;
    display_as: 'waste' | 'needed';
    needed_width?: number;
    uses_existing: boolean;
    widths: number[];
    used_widths: Record<string, number>;
    description: string;
  }>;
  summary: {
    total_rolls: number;
    using_existing: number;
    new_rolls_needed: number;
    total_waste: number;
    avg_waste: number;
  };
}

interface SuggestionResult {
  status: string;
  target_width: number;
  wastage: number;
  jumbo_suggestions: JumboRollSuggestion[];
  summary: {
    total_pending_input: number;
    spec_groups_processed: number;
    jumbo_rolls_suggested: number;
    total_rolls_suggested: number;
  };
}

export default function PendingOrderItemsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingItems, setPendingItems] = useState<PendingOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Roll suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionResult, setSuggestionResult] = useState<SuggestionResult | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showWastageDialog, setShowWastageDialog] = useState(false);
  const [wastageInput, setWastageInput] = useState<string>("");
  
  // Selection and production state
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [productionLoading, setProductionLoading] = useState(false);

  // Filter states
  const [clientFilter, setClientFilter] = useState<string>("");
  const [gsmFilter, setGsmFilter] = useState<string>("");
  const [bfFilter, setBfFilter] = useState<string>("");
  const [shadeFilter, setShadeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reasonFilter, setReasonFilter] = useState<string>("");
  const [widthFilter, setWidthFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Fetch pending order items from API
  useEffect(() => {
    const fetchPendingItems = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Call backend API directly
        let response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}?status=pending`, createRequestOptions('GET'));
        if (!response.ok) {
          response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS.replace('pending-order-items', 'pending-orders')}?status=pending`, createRequestOptions('GET'));
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch pending order items: ${response.status}`);
        }
        
        const data = await response.json();
        setPendingItems(Array.isArray(data) ? data : []);
        
        console.log('Fetched pending order items:', {
          count: Array.isArray(data) ? data.length : 0,
          data: data,
          isArray: Array.isArray(data)
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        toast.error(errorMessage);
        console.error('Error fetching pending items:', err);
        
        // No fallback data - show empty state instead
        setPendingItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingItems();
  }, []);


  // Use real data only - no fallback to sample data
  const displayItems = pendingItems;

  const filteredItems = displayItems.filter(item => {
    // Search term filter
    const matchesSearch = !searchTerm || (
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.original_order?.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.shade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.frontend_id && item.frontend_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Client filter
    const matchesClient = !clientFilter || (
      item.original_order?.client?.company_name?.toLowerCase().includes(clientFilter.toLowerCase())
    );

    // GSM filter
    const matchesGsm = !gsmFilter || item.gsm.toString() === gsmFilter;

    // BF filter
    const matchesBf = !bfFilter || item.bf.toString() === bfFilter;

    // Shade filter
    const matchesShade = !shadeFilter || item.shade.toLowerCase().includes(shadeFilter.toLowerCase());

    // Status filter
    const matchesStatus = !statusFilter || item.status === statusFilter;

    // Reason filter
    const matchesReason = !reasonFilter || item.reason === reasonFilter;

    // Width filter
    const matchesWidth = !widthFilter || item.width_inches.toString() === widthFilter;

    return matchesSearch && matchesClient && matchesGsm && matchesBf && 
           matchesShade && matchesStatus && matchesReason && matchesWidth;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case "in_production":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Production</Badge>;
      case "resolved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Resolved</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case "no_suitable_jumbo":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">No Suitable Jumbo</Badge>;
      case "waste_too_high":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Waste Too High</Badge>;
      case "inventory_shortage":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Inventory Shortage</Badge>;
      default:
        return <Badge variant="secondary">{reason.replace(/_/g, ' ')}</Badge>;
    }
  };

  const getDaysWaiting = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  };

  const totalPendingQuantity = displayItems.reduce((sum, item) => sum + item.quantity_pending, 0);
  const highPriorityItems = displayItems.filter(item => {
    const daysWaiting = getDaysWaiting(item.created_at);
    return daysWaiting >= 3; // Consider items waiting 3+ days as high priority
  }).length;
  const averageWaitTime = displayItems.length > 0 ? Math.round(
    displayItems.reduce((sum, item) => sum + getDaysWaiting(item.created_at), 0) / displayItems.length
  ) : 0;

  // Get unique values for filter dropdowns
  const uniqueClients = [...new Set(
    displayItems
      .map(item => item.original_order?.client?.company_name)
      .filter(name => name)
  )].sort();

  const uniqueGSMs = [...new Set(
    displayItems.map(item => item.gsm.toString())
  )].sort((a, b) => parseInt(a) - parseInt(b));

  const uniqueBFs = [...new Set(
    displayItems.map(item => item.bf.toString())
  )].sort((a, b) => parseFloat(a) - parseFloat(b));

  const uniqueShades = [...new Set(
    displayItems.map(item => item.shade)
  )].sort();

  const uniqueStatuses = [...new Set(
    displayItems.map(item => item.status)
  )].sort();

  const uniqueReasons = [...new Set(
    displayItems.map(item => item.reason)
  )].sort();

  const uniqueWidths = [...new Set(
    displayItems.map(item => item.width_inches.toString())
  )].sort((a, b) => parseFloat(a) - parseFloat(b));

  const clearAllFilters = () => {
    setSearchTerm("");
    setClientFilter("");
    setGsmFilter("");
    setBfFilter("");
    setShadeFilter("");
    setStatusFilter("");
    setReasonFilter("");
    setWidthFilter("");
  };


  // Roll suggestions functions
  const handleGetSuggestions = () => {
    setWastageInput("");
    setShowWastageDialog(true);
  };

  const handleWastageSubmit = async () => {
    const wastage = parseFloat(wastageInput);
    if (isNaN(wastage) || wastage < 0) {
      toast.error('Please enter a valid wastage value');
      return;
    }

    try {
      setSuggestionsLoading(true);
      setShowWastageDialog(false);
      
      const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/roll-suggestions`, 
        createRequestOptions('POST', { wastage })
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get suggestions: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Check if the result is valid
      if (result.status === 'success' && result.jumbo_suggestions) {
        setSuggestionResult(result);
        setShowSuggestions(true);
        const jumboCount = result.jumbo_suggestions?.length || 0;
        const totalRolls = result.summary?.total_rolls_suggested || 0;
        
        if (jumboCount > 0) {
          toast.success(`Generated ${jumboCount} jumbo roll suggestions with ${totalRolls} individual rolls for ${result.target_width}" target width`);
        } else {
          toast.info('No jumbo roll suggestions could be generated with the current pending items');
        }
      } else if (result.status === 'no_pending_orders') {
        toast.info('No pending orders found to generate suggestions from');
        setSuggestionResult(result);
        setShowSuggestions(true);
      } else {
        throw new Error(result.message || 'Unknown error occurred');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get roll suggestions';
      toast.error(`Error: ${errorMessage}`);
      console.error('Suggestions error:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handlePrintPDF = () => {
    if (!suggestionResult) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 30;

    pdf.setFontSize(20);
    pdf.text('Roll Suggestions Report', margin, yPosition);
    
    yPosition += 15;
    pdf.setFontSize(12);
    pdf.text(`Target Width: ${suggestionResult.target_width}" (119" - ${suggestionResult.wastage}" wastage)`, margin, yPosition);
    
    yPosition += 10;
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, yPosition);
    
    yPosition += 20;
    pdf.setFontSize(16);
    pdf.text('Summary Statistics', margin, yPosition);
    
    yPosition += 15
    pdf.setFontSize(12);
    pdf.text(`Target Width: ${suggestionResult.target_width}"`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Spec Groups Processed: ${suggestionResult.summary.spec_groups_processed}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Jumbo Rolls Suggested: ${suggestionResult.summary.jumbo_rolls_suggested}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Total Rolls: ${suggestionResult.summary.total_rolls_suggested}`, margin, yPosition);
    
    yPosition += 20;
    pdf.setFontSize(16);
    pdf.text('Jumbo Roll Suggestions', margin, yPosition);
    yPosition += 10;

    suggestionResult.jumbo_suggestions.forEach((jumbo, jumboIndex) => {
      if (yPosition > 220) {
        pdf.addPage();
        yPosition = 30;
      }
      
      yPosition += 15;
      pdf.setFontSize(14);
      pdf.text(`Jumbo ${jumbo.jumbo_number}: ${jumbo.paper_specs.shade} ${jumbo.paper_specs.gsm}GSM (BF: ${jumbo.paper_specs.bf})`, margin, yPosition);
      
      yPosition += 10;
      pdf.setFontSize(11);
      pdf.text(`${jumbo.summary.using_existing} using existing + ${jumbo.summary.new_rolls_needed} new rolls | Avg waste: ${jumbo.summary.avg_waste}"`, margin, yPosition);
      
      // Show each roll in the jumbo
      jumbo.rolls.forEach((roll, rollIndex) => {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 30;
        }
        
        yPosition += 12;
        pdf.setFontSize(10);
        const rollColor = roll.uses_existing ? '[EXISTING]' : '[NEW]';
        pdf.text(`  Roll ${roll.roll_number}: ${rollColor} ${roll.description}`, margin + 10, yPosition);
        
        if (roll.uses_existing && roll.widths.length > 3) {
          yPosition += 8;
          pdf.setFontSize(8);
          pdf.text(`    (${roll.widths.length} pieces total)`, margin + 15, yPosition);
        }
      });
      
      yPosition += 15;
    });

    pdf.save(`roll-suggestions-${suggestionResult.target_width}inch-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  // Selection and production functions
  const handleSuggestionToggle = (suggestionId: string, checked: boolean) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(suggestionId);
      } else {
        newSet.delete(suggestionId);
      }
      return newSet;
    });
  };

  const handleSelectAllSuggestions = (checked: boolean) => {
    if (checked && suggestionResult?.jumbo_suggestions) {
      setSelectedSuggestions(new Set(suggestionResult.jumbo_suggestions.map(s => s.suggestion_id)));
    } else {
      setSelectedSuggestions(new Set());
    }
  };

  const handleStartProduction = async () => {
    if (!suggestionResult || selectedSuggestions.size === 0) {
      toast.error('Please select at least one suggestion');
      return;
    }

    try {
      setProductionLoading(true);
      
      // Get user ID from localStorage
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        toast.error('User not authenticated');
        return;
      }
      
      // Filter selected suggestions
      const selectedSuggestionData = suggestionResult.jumbo_suggestions.filter(
        suggestion => selectedSuggestions.has(suggestion.suggestion_id)
      );
      console.log('🔧 SELECTED SUGGESTIONS DATA:', selectedSuggestions);
      console.log(selectedSuggestionData)

      // Extract all pending order IDs from selected suggestions
      const allSelectedPendingIds = selectedSuggestionData.flatMap(
        suggestion => suggestion.pending_order_ids
      );

      // Get original pending order items for selected suggestions
      const originalPendingOrders = pendingItems.filter(item =>
        allSelectedPendingIds.includes(item.id)
      );

      console.log('🔧 PRODUCTION DATA EXTRACTION:');
      console.log('Selected suggestions:', selectedSuggestionData.length);
      console.log('Pending IDs from suggestions:', allSelectedPendingIds);
      console.log('Original pending orders found:', originalPendingOrders.length);

      // Transform to main planning format - individual cut_rolls from original pending orders
      const selectedCutRolls = originalPendingOrders.map((pendingItem, index) => ({
        paper_id: "", // Will be filled by backend from paper specs
        width_inches: pendingItem.width_inches,
        qr_code: `PENDING_CUT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${index}`,
        barcode_id: `PCR_${String(index + 1).padStart(5, '0')}`,
        gsm: pendingItem.gsm,
        bf: pendingItem.bf,
        shade: pendingItem.shade,
        individual_roll_number: index + 1,
        trim_left: null,
        order_id: pendingItem.original_order_id, // ✅ PRESERVE ORDER LINK
        // ✅ CRITICAL: Include source tracking for pending orders
        source_type: 'pending_order',
        source_pending_id: pendingItem.id
      }));

      // Also send all available cuts (same as selected for pending flow)
      const allAvailableCuts = [...selectedCutRolls];
      console.log('🔧 ALL AVAILABLE CUTS:', allAvailableCuts);

      console.log('🔧 TRANSFORMED CUT ROLLS:', selectedCutRolls);

      // Use same format as main planning page (StartProductionRequest)
      const requestData = {
        selected_cut_rolls: selectedCutRolls,
        all_available_cuts: allAvailableCuts,
        wastage_data: [], // No wastage for pending flow
        added_rolls_data: {}, // No added rolls for pending flow
        created_by_id: userId,
        jumbo_roll_width: 118
      };

      const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS.replace('pending-order-items', 'pending-orders')}/start-production`, 
        createRequestOptions('POST', requestData)
      );

      if (!response.ok) {
        throw new Error(`Failed to start production: ${response.status}`);
      }

      const result = await response.json();
      
      toast.success(`Production started successfully! Created ${result.summary.inventory_created} inventory items`);
      
      // Reset selection and refresh data
      setSelectedSuggestions(new Set());
      setShowSuggestions(false);
      setSuggestionResult(null);
      
      // Refresh pending items
      window.location.reload();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start production';
      toast.error(`Error: ${errorMessage}`);
      console.error('Production error:', error);
    } finally {
      setProductionLoading(false);
    }
  };

  const handlePrintTablePDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 30;

    // Header
    pdf.setFontSize(20);
    pdf.text('Pending Order Items Report', margin, yPosition);
    
    yPosition += 15;
    pdf.setFontSize(12);
    pdf.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, yPosition);
    pdf.text(`Total Items: ${filteredItems.length}`, pageWidth - margin - 50, yPosition);
    
    yPosition += 20;
    
    // Summary Statistics
    pdf.setFontSize(16);
    pdf.text('Summary Statistics', margin, yPosition);
    yPosition += 15;
    
    pdf.setFontSize(11);
    pdf.text(`• Total Pending Items: ${displayItems.length}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`• High Priority Items (3+ days): ${highPriorityItems}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`• Average Wait Time: ${averageWaitTime} days`, margin, yPosition);
    yPosition += 8;
    pdf.text(`• Total Quantity: ${totalPendingQuantity.toLocaleString()} rolls`, margin, yPosition);
    yPosition += 20;

    // Table Header
    pdf.setFontSize(16);
    pdf.text('Pending Items Details', margin, yPosition);
    yPosition += 15;

    // Table column setup
    const colWidths = [25, 40, 35, 20, 25, 35, 20];
    const colHeaders = ['ID', 'Paper Spec', 'Client', 'Qty', 'Status', 'Reason', 'Days'];
    
    // Draw table header
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 10, 'F');
    
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    
    let xPos = margin + 2;
    colHeaders.forEach((header, index) => {
      pdf.text(header, xPos, yPosition);
      xPos += colWidths[index];
    });
    
    yPosition += 15;

    // Table rows
    filteredItems.forEach((item, index) => {
      // Check if we need a new page
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 30;
        
        // Redraw header on new page
        pdf.setFillColor(230, 230, 230);
        pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 10, 'F');
        
        xPos = margin + 2;
        colHeaders.forEach((header, hIndex) => {
          pdf.text(header, xPos, yPosition);
          xPos += colWidths[hIndex];
        });
        
        yPosition += 15;
      }

      // Alternate row background
      if (index % 2 === 0) {
        pdf.setFillColor(248, 248, 248);
        pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 10, 'F');
      }

      pdf.setFontSize(8);
      xPos = margin + 2;

      // Pending ID
      const displayId = item.frontend_id || item.id.substring(0, 8);
      pdf.text(displayId, xPos, yPosition);
      xPos += colWidths[0];

      // Paper Specification
      const paperSpec = `${item.width_inches}" x ${item.shade}\nGSM:${item.gsm} BF:${item.bf}`;
      const specLines = paperSpec.split('\n');
      pdf.text(specLines[0], xPos, yPosition - 2);
      pdf.text(specLines[1], xPos, yPosition + 3);
      xPos += colWidths[1];

      // Client
      const clientName = item.original_order?.client?.company_name || 'N/A';
      const truncatedClient = clientName.length > 15 ? clientName.substring(0, 15) + '...' : clientName;
      pdf.text(truncatedClient, xPos, yPosition);
      xPos += colWidths[2];

      // Quantity
      pdf.text(`${item.quantity_pending}`, xPos, yPosition);
      xPos += colWidths[3];

      // Status
      pdf.text(item.status, xPos, yPosition);
      xPos += colWidths[4];

      // Reason
      const reasonText = item.reason.replace(/_/g, ' ');
      const truncatedReason = reasonText.length > 12 ? reasonText.substring(0, 12) + '...' : reasonText;
      pdf.text(truncatedReason, xPos, yPosition);
      xPos += colWidths[5];

      // Days waiting
      const daysWaiting = getDaysWaiting(item.created_at);
      pdf.text(`${daysWaiting}`, xPos, yPosition);

      yPosition += 12;
    });

    // Footer
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pdf.internal.pageSize.getHeight() - 10);
      pdf.text('JumboReel App - Pending Orders Report', margin, pdf.internal.pageSize.getHeight() - 10);
    }

    pdf.save(`pending-orders-report-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Pending orders PDF downloaded successfully');
  };


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="w-8 h-8 text-primary" />
              Pending Order Items
            </h1>
            <p className="text-muted-foreground">
              Manage order items that couldn&apos;t be fulfilled immediately
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handlePrintTablePDF}
              disabled={displayItems.length === 0}
            >
              <FileDown className="w-4 h-4" />
              Print Table PDF
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handleGetSuggestions}
              disabled={suggestionsLoading || displayItems.length === 0}
            >
              <Target className="w-4 h-4" />
              {suggestionsLoading ? 'Generating...' : 'Get Jumbo Suggestions'}
            </Button>
            {suggestionResult && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={handlePrintPDF}
              >
                <FileDown className="w-4 h-4" />
                Print Suggestions PDF
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Items</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayItems.length}</div>
              <p className="text-xs text-muted-foreground">
                Items awaiting fulfillment
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{highPriorityItems}</div>
              <p className="text-xs text-muted-foreground">
                Items waiting 3+ days
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageWaitTime} days</div>
              <p className="text-xs text-muted-foreground">
                Average processing delay
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPendingQuantity.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Rolls pending fulfillment
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Wastage Input Dialog */}
        <Dialog open={showWastageDialog} onOpenChange={setShowWastageDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Enter Wastage for Jumbo Roll Suggestions</DialogTitle>
              <DialogDescription>
                Enter the wastage amount to subtract from 119 inches. The system will create suggestions using unlimited pieces per roll to minimize waste.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="wastage" className="text-right">
                  Wastage (inches)
                </Label>
                <Input
                  id="wastage"
                  type="number"
                  min="0"
                  max="50"
                  value={wastageInput}
                  onChange={(e) => setWastageInput(e.target.value)}
                  className="col-span-3"
                />
              </div>
              {wastageInput && !isNaN(parseFloat(wastageInput)) && (
                <div className="text-sm text-muted-foreground text-center">
                  Target width: {119 - parseFloat(wastageInput)}" (119 - {wastageInput})
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWastageDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleWastageSubmit}>
                Generate Jumbo Suggestions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Roll Suggestions Results */}
        {showSuggestions && suggestionResult && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Roll Suggestions
                </CardTitle>
                <CardDescription>
                  Suggestions for completing {suggestionResult.target_width}" rolls (119" - {suggestionResult.wastage}" wastage)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{suggestionResult.target_width}"</div>
                    <div className="text-sm text-blue-800">Target Width</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{suggestionResult.summary.jumbo_rolls_suggested}</div>
                    <div className="text-sm text-green-800">Jumbo Rolls</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{suggestionResult.summary.total_rolls_suggested}</div>
                    <div className="text-sm text-purple-800">Total Rolls</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{suggestionResult.summary.spec_groups_processed}</div>
                    <div className="text-sm text-orange-800">Paper Specs</div>
                  </div>
                </div>

                {/* Jumbo Roll Suggestions */}
                {suggestionResult.jumbo_suggestions && suggestionResult.jumbo_suggestions.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Jumbo Roll Suggestions</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="select-all-suggestions"
                            checked={suggestionResult.jumbo_suggestions.length > 0 && selectedSuggestions.size === suggestionResult.jumbo_suggestions.length}
                            onCheckedChange={handleSelectAllSuggestions}
                          />
                          <label htmlFor="select-all-suggestions" className="text-sm font-medium">
                            Select All ({selectedSuggestions.size}/{suggestionResult.jumbo_suggestions.length})
                          </label>
                        </div>
                        <Button 
                          onClick={handleStartProduction}
                          disabled={selectedSuggestions.size === 0 || productionLoading}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {productionLoading ? 'Starting Production...' : `Start Production (${selectedSuggestions.size})`}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-6">
                      {suggestionResult.jumbo_suggestions.map((jumbo) => (
                        <Card key={jumbo.suggestion_id} className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-2 ${
                          selectedSuggestions.has(jumbo.suggestion_id) ? 'border-green-400 ring-2 ring-green-200' : 'border-blue-200'
                        }`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={`suggestion-${jumbo.suggestion_id}`}
                                  checked={selectedSuggestions.has(jumbo.suggestion_id)}
                                  onCheckedChange={(checked) => handleSuggestionToggle(jumbo.suggestion_id, checked as boolean)}
                                />
                                <div>
                                  <CardTitle className="text-lg">
                                    Jumbo Roll #{jumbo.jumbo_number} - {jumbo.paper_specs.shade} {jumbo.paper_specs.gsm}GSM
                                  </CardTitle>
                                  <CardDescription>
                                    BF: {jumbo.paper_specs.bf} | Target: {jumbo.target_width}" per roll
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">
                                  {jumbo.summary.using_existing} existing + {jumbo.summary.new_rolls_needed} new
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Avg {jumbo.summary.avg_waste <= 5 ? 'waste' : 'needed'}: {jumbo.summary.avg_waste}"
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Individual Rolls in this Jumbo */}
                            <div className="grid gap-3">
                              {jumbo.rolls.map((roll, rollIndex) => (
                                <div key={rollIndex} className={`p-4 rounded-lg border-2 ${
                                  roll.uses_existing 
                                    ? 'bg-green-50 border-green-200' 
                                    : 'bg-orange-50 border-orange-200'
                                }`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium">
                                      Roll #{roll.roll_number} ({roll.uses_existing ? 'Using Existing' : 'New Roll Needed'})
                                    </div>
                                    <Badge className={roll.uses_existing ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                                      {roll.display_as === 'waste' 
                                        ? `Waste: ${roll.waste.toFixed(1)}"` 
                                        : `Need: ${(roll.needed_width || roll.waste).toFixed(1)}"`}
                                    </Badge>
                                  </div>
                                  
                                  <div className="text-sm text-muted-foreground mb-3">
                                    {roll.description}
                                  </div>
                                  
                                  {/* Visual representation of the roll */}
                                  <div className="relative h-8 bg-muted rounded border overflow-hidden">
                                    {(() => {
                                      const actualPercentage = (roll.actual_width / jumbo.target_width) * 100;
                                      const remainingPercentage = ((roll.needed_width || roll.waste) / jumbo.target_width) * 100;
                                      const isWaste = roll.display_as === 'waste';
                                      
                                      return (
                                        <>
                                          {/* Actual width section */}
                                          <div
                                            className={`absolute h-full ${
                                              roll.uses_existing 
                                                ? 'bg-gradient-to-r from-green-400 to-green-500' 
                                                : 'bg-gradient-to-r from-blue-400 to-blue-500'
                                            }`}
                                            style={{
                                              left: "0%",
                                              width: `${actualPercentage}%`,
                                            }}>
                                            <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                              {roll.actual_width.toFixed(1)}"
                                            </div>
                                          </div>
                                          
                                          {/* Remaining section - waste or needed */}
                                          {(roll.waste > 0 || roll.needed_width) && (
                                            <div
                                              className={`absolute h-full border-l-2 border-white ${
                                                isWaste 
                                                  ? 'bg-gradient-to-r from-gray-300 to-gray-400'
                                                  : 'bg-gradient-to-r from-orange-300 to-orange-400'
                                              }`}
                                              style={{
                                                left: `${actualPercentage}%`,
                                                width: `${remainingPercentage}%`,
                                              }}>
                                              <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${
                                                isWaste ? 'text-gray-700' : 'text-orange-700'
                                              }`}>
                                                {isWaste 
                                                  ? `${roll.waste.toFixed(1)}" waste`
                                                  : `${(roll.needed_width || roll.waste).toFixed(1)}" needed`
                                                }
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                  
                                  {roll.uses_existing && (
                                    <div className="mt-2 text-xs text-green-700">
                                      <div className="font-medium mb-1">Pieces used from pending:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {roll.widths.map((width, idx) => (
                                          <span key={idx} className="inline-block px-2 py-1 bg-green-100 rounded text-xs">
                                            {width}"
                                          </span>
                                        ))}
                                      </div>
                                      <div className="mt-1 text-xs text-green-600">
                                        Total pieces: {roll.widths.length}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            {/* Jumbo Summary */}
                            <div className="pt-3 border-t border-blue-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div>
                                  <div className="text-lg font-bold text-blue-600">{jumbo.summary.total_rolls}</div>
                                  <div className="text-xs text-blue-800">Total Rolls</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-green-600">{jumbo.summary.using_existing}</div>
                                  <div className="text-xs text-green-800">Using Existing</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-orange-600">{jumbo.summary.new_rolls_needed}</div>
                                  <div className="text-xs text-orange-800">New Needed</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-gray-600">{jumbo.summary.total_waste.toFixed(1)}"</div>
                                  <div className="text-xs text-gray-800">
                                    {jumbo.summary.avg_waste <= 5 ? 'Total Waste' : 'Total Needed'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                      {suggestionResult.status === 'no_pending_orders' 
                        ? 'No Pending Orders Found' 
                        : 'No Suggestions Generated'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {suggestionResult.status === 'no_pending_orders'
                        ? 'There are no pending order items to create suggestions from.'
                        : 'Unable to generate jumbo roll suggestions with the current pending items and target width.'}
                    </p>
                    {suggestionResult.status !== 'no_pending_orders' && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Try adjusting the wastage value for different target widths.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowSuggestions(false)}
                  >
                    Close Suggestions
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleGetSuggestions}
                  >
                    New Suggestions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pending Order Items Queue</CardTitle>
                <CardDescription>
                  Review and process order items that couldn&apos;t be fulfilled immediately
                  {loading && " (Loading...)"}
                  {error && ` (Error: ${error} - showing sample data)`}
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pending items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              {(clientFilter || gsmFilter || bfFilter || shadeFilter || statusFilter || reasonFilter || widthFilter) && (
                <Button 
                  variant="outline" 
                  onClick={clearAllFilters}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Client Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Client</label>
                    <Select value={clientFilter} onValueChange={setClientFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All clients</SelectItem>
                        {uniqueClients.map((client : any) => (
                          <SelectItem key={client} value={client}>{client}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* GSM Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">GSM</label>
                    <Select value={gsmFilter} onValueChange={setGsmFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All GSM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All GSM</SelectItem>
                        {uniqueGSMs.map(gsm => (
                          <SelectItem key={gsm} value={gsm}>{gsm}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* BF Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">BF</label>
                    <Select value={bfFilter} onValueChange={setBfFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All BF" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All BF</SelectItem>
                        {uniqueBFs.map(bf => (
                          <SelectItem key={bf} value={bf}>{bf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Shade Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Shade</label>
                    <Select value={shadeFilter} onValueChange={setShadeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All shades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All shades</SelectItem>
                        {uniqueShades.map(shade => (
                          <SelectItem key={shade} value={shade}>{shade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Width Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Width (inches)</label>
                    <Select value={widthFilter} onValueChange={setWidthFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All widths" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All widths</SelectItem>
                        {uniqueWidths.map(width => (
                          <SelectItem key={width} value={width}>{width}"</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All status</SelectItem>
                        {uniqueStatuses.map(status => (
                          <SelectItem key={status} value={status}>
                            {status.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reason Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reason</label>
                    <Select value={reasonFilter} onValueChange={setReasonFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All reasons" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All reasons</SelectItem>
                        {uniqueReasons.map(reason => (
                          <SelectItem key={reason} value={reason}>
                            {reason.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Filter Summary */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Showing {filteredItems.length} of {displayItems.length} pending items
                    </span>
                    <span>
                      Active filters: {[clientFilter, gsmFilter, bfFilter, shadeFilter, statusFilter, reasonFilter, widthFilter].filter(f => f).length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Orders Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pending ID</TableHead>
                    <TableHead>Paper Specification</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Wait Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => {
                    const daysWaiting = getDaysWaiting(item.created_at);
                    return (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm font-medium">
                        {item.frontend_id || 'Generating...'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.width_inches}&quot; x {item.shade}</div>
                          <div className="text-sm text-muted-foreground">
                            GSM: {item.gsm}, BF: {item.bf}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.original_order?.client?.company_name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            Created by: {item.created_by?.name || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.quantity_pending} rolls</div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item.status)}
                      </TableCell>
                      <TableCell>
                        {getReasonBadge(item.reason)}
                      </TableCell>
                      <TableCell>
                        <Badge className={daysWaiting >= 5 ? "bg-red-100 text-red-800" : daysWaiting >= 3 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
                          {daysWaiting} days
                        </Badge>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No pending order items found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  All order items are currently being processed or completed.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}