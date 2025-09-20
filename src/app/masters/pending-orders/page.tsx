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
  ChevronUp,
  Plus
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
  sets:any
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
    efficiency: number;
  };
}

interface OrderSuggestion {
  suggestion_id: string;
  order_info: {
    order_id: string;
    order_frontend_id: string;
    client_name: string;
  };
  
  paper_spec: {
    gsm: number;
    bf: number;
    shade: string;
  };
  target_width: number;
  jumbo_rolls: Array<{
    jumbo_id: string;
    jumbo_number: number;
    target_width: number;
    sets: Array<{
      set_id: string;
      set_number: number;
      target_width: number;
      cuts: Array<{
        cut_id: string;
        width_inches: number;
        uses_existing: boolean;
        used_widths: Record<string, number>;
        description: string;
        is_manual_cut?: boolean;
        client_name?: string;
        order_frontend_id?: string;
      }>;
      manual_addition_available: boolean;
      summary: {
        total_cuts: number;
        using_existing_cuts: number;
        total_actual_width: number;
        total_waste: number;
        efficiency: number;
      };
    }>;
    summary: {
      total_sets: number;
      total_cuts: number;
      using_existing_cuts: number;
      total_actual_width: number;
      total_waste: number;
      efficiency: number;
    };
  }>;
  pending_order_ids: string[];
  manual_addition_enabled: boolean;
  summary: {
    total_jumbo_rolls: number;
    total_118_sets: number;
    total_cuts: number;
    using_existing_cuts: number;
  };
}

interface SpecSuggestion {
  jumbo_rolls?: JumboRollSuggestion[];
  spec_id: string;
  paper_spec: {
    gsm: number;
    bf: number;
    shade: string;
  };
  order_frontend_id?: string;
  target_width: number;
  order_suggestions: OrderSuggestion[];
  summary: {
    total_orders: number;
    total_jumbo_rolls: number;
    total_118_sets: number;
    total_cuts: number;
  };
}

interface SuggestionResult {
  status: string;
  target_width: number;
  wastage: number;
  spec_suggestions?: SpecSuggestion[];  // New structure
  order_suggestions?: OrderSuggestion[]; // Legacy support
  jumbo_suggestions?: JumboRollSuggestion[]; // Legacy support
  summary: {
    total_pending_input: number;
    specs_processed?: number;
    orders_processed?: number;
    total_cuts?: number;
    roll_sets_suggested?: number;
    spec_groups_processed?: number;
    jumbo_rolls_suggested?: number;
    total_rolls_suggested: number;
    total_118_sets:number;
    expected_cut_rolls?: number;
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
  
  // Manual cut addition state
  const [showManualRollDialog, setShowManualRollDialog] = useState(false);
  const [manualRollData, setManualRollData] = useState({
    suggestionId: '',
    jumboId: '',
    setId: '',
    width: '',
    description: 'Manual Cut',
    availableWaste: 0,
    selectedClient: '',
    paperSpecs: {
      gsm: 0,
      bf: 0,
      shade: ''
    }
  });
  const [modifiedSuggestions, setModifiedSuggestions] = useState<Map<string, any>>(new Map());
  const [clients, setClients] = useState<any[]>([]);

  // Filter states
  const [clientFilter, setClientFilter] = useState<string>("");
  const [gsmFilter, setGsmFilter] = useState<string>("");
  const [bfFilter, setBfFilter] = useState<string>("");
  const [shadeFilter, setShadeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reasonFilter, setReasonFilter] = useState<string>("");
  const [widthFilter, setWidthFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Fetch clients for manual cut dialog
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch(MASTER_ENDPOINTS.CLIENTS, createRequestOptions('GET'));
        if (response.ok) {
          const clientsData = await response.json();
          setClients(clientsData);
        }
      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };
    
    fetchClients();
  }, []);

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
      ?.map(item => item.original_order?.client?.company_name)
      .filter(name => name)
  )].sort();

  const uniqueGSMs = [...new Set(
    displayItems?.map(item => item.gsm.toString())
  )].sort((a, b) => parseInt(a) - parseInt(b));

  const uniqueBFs = [...new Set(
    displayItems?.map(item => item.bf.toString())
  )].sort((a, b) => parseFloat(a) - parseFloat(b));

  const uniqueShades = [...new Set(
    displayItems?.map(item => item.shade)
  )].sort();

  const uniqueStatuses = [...new Set(
    displayItems?.map(item => item.status)
  )].sort();

  const uniqueReasons = [...new Set(
    displayItems?.map(item => item.reason)
  )].sort();

  const uniqueWidths = [...new Set(
    displayItems?.map(item => item.width_inches.toString())
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


      // Check if the result is valid - support new spec-based, order-based and legacy jumbo suggestions
      if (result.status === 'success' && (result.spec_suggestions || result.order_suggestions || result.jumbo_suggestions)) {
        // Fix summary counts to account for quantities in used_widths
        const processedResult = { ...result };

        // Process new spec_suggestions format
        if (processedResult.spec_suggestions) {
          // DEBUG LOG 2: Check first spec suggestion cuts
          const firstSpec = processedResult.spec_suggestions[0];
          if (firstSpec?.jumbo_rolls?.[0]?.sets?.[0]?.cuts) {
            console.log('🔍 DEBUG: First spec cuts sample:',
              firstSpec.jumbo_rolls[0].sets[0].cuts.slice(0, 2).map((cut: any) => ({
                width: cut.width_inches,
                order_id: cut.order_frontend_id,
                client: cut.client_name,
                description: cut.description
              }))
            );
          }

          processedResult.spec_suggestions = processedResult.spec_suggestions?.map((specSuggestion: any) => ({
            ...specSuggestion,
            order_suggestions: specSuggestion.order_suggestions?.map((suggestion: any) => ({
              ...suggestion,
              jumbo_rolls: suggestion.jumbo_rolls?.map((jumboRoll: any) => ({
                ...jumboRoll,
                sets: jumboRoll.sets?.map((rollSet: any) => ({
                  ...rollSet,
                  summary: {
                    ...rollSet.summary,
                    total_cuts: rollSet.cuts.reduce((sum: number, c: any) => {
                      if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                        return sum + (Object.values(c.used_widths) as number[]).reduce((a: number, b: number) => a + b, 0);
                      }
                      return sum + 1;
                    }, 0),
                    using_existing_cuts: rollSet.cuts.reduce((sum: number, c: any) => {
                      if (c.uses_existing && c.used_widths && Object.keys(c.used_widths).length > 0) {
                        return sum + (Object.values(c.used_widths) as number[]).reduce((a: number, b: number) => a + b, 0);
                      }
                      return sum + (c.uses_existing ? 1 : 0);
                    }, 0)
                  }
                })),
                summary: {
                  ...jumboRoll.summary,
                  total_cuts: jumboRoll.sets.reduce((sum: number, s: any) => sum + s.cuts.reduce((cutSum: number, c: any) => {
                    if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                      return cutSum + (Object.values(c.used_widths) as number[]).reduce((a: number, b: number) => a + b, 0);
                    }
                    return cutSum + 1;
                  }, 0), 0),
                  using_existing_cuts: jumboRoll.sets.reduce((sum: number, s: any) => sum + s.cuts.reduce((cutSum: number, c: any) => {
                    if (c.uses_existing && c.used_widths && Object.keys(c.used_widths).length > 0) {
                      return cutSum + (Object.values(c.used_widths) as number[]).reduce((a: number, b: number) => a + b, 0);
                    }
                    return cutSum + (c.uses_existing ? 1 : 0);
                  }, 0), 0)
                }
              }))
            }))
          }));
        }
        setSuggestionResult(processedResult);
        setShowSuggestions(true);
        
        if (result.spec_suggestions) {
          // New spec-based flow
          const specCount = result.spec_suggestions.length;
          const orderCount = result.summary?.total_orders || 0;
          const totalRolls = result.summary?.total_rolls_suggested || 0;

          toast.success(`Generated ${specCount} paper spec group(s) with ${orderCount} order(s) and ${totalRolls} roll suggestion(s)!`);
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
  const margin = 10;
  let yPosition = 15;

  // --- HEADER SECTION ---
  pdf.setFontSize(20);
  pdf.text('Roll Suggestions Report', margin, yPosition);
  
  yPosition += 10;
  pdf.setFontSize(12);
  pdf.text(`Target Width: ${suggestionResult.target_width}" (119" - ${suggestionResult.wastage}" wastage)`, margin, yPosition);
  
  yPosition += 10;
  pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, yPosition);
  
  // --- SUMMARY STATISTICS SECTION ---
  yPosition += 20;
  pdf.setFontSize(16);
  pdf.text('Summary Statistics', margin, yPosition);
  
  yPosition += 15;
  pdf.setFontSize(12);
  pdf.text(`Target Width: ${suggestionResult.target_width}"`, margin, yPosition);
  yPosition += 8;
  
  // Only render spec-based statistics
  pdf.text(`Paper Specs Processed: ${suggestionResult.summary.specs_processed || 0}`, margin, yPosition);
  yPosition += 8;
  pdf.text(`Total Pending Input: ${suggestionResult.summary.total_pending_input || 0}`, margin, yPosition);
  yPosition += 8;
  pdf.text(`Total Cuts: ${suggestionResult.summary.total_cuts || 0}`, margin, yPosition);
  yPosition += 8;
  
  // --- SUGGESTIONS SECTION ---
  pdf.addPage();
  yPosition = 12;
  pdf.setFontSize(16);
  pdf.text('Roll Suggestions', margin, yPosition);
  yPosition += 8;

  // Only process spec-based suggestions
  if (suggestionResult.spec_suggestions && suggestionResult.spec_suggestions.length > 0) {
    suggestionResult.spec_suggestions.forEach((specSuggestion) => {
      if (yPosition > 240) {
        pdf.addPage();
        yPosition = 20;
      }

      // Paper spec header
      yPosition += 10;
      pdf.setFontSize(14);
      pdf.text(`Paper Spec: ${specSuggestion.paper_spec.shade} ${specSuggestion.paper_spec.gsm}GSM (BF: ${specSuggestion.paper_spec.bf})`, margin, yPosition);
      yPosition += 8;

      // Process jumbo rolls directly (simplified structure)
      specSuggestion.jumbo_rolls?.forEach((jumboRoll) => {
        if (yPosition > 235) {
          pdf.addPage();
          yPosition = 20;
        }

        // Jumbo roll header
        yPosition += 6;
        pdf.setFontSize(10);
        pdf.text(`Jumbo Roll #${jumboRoll.jumbo_number}:`, margin + 5, yPosition);
        yPosition += 6;

        // Process sets within jumbo roll
        jumboRoll.sets?.forEach((rollSet:any) => {
          if (yPosition > 240) {
            pdf.addPage();
            yPosition = 20;
          }

          // Set header
          pdf.text(`Set #${rollSet.set_number} (${rollSet.summary.efficiency}% efficient):`, margin + 10, yPosition);
          yPosition += 8;

          // IMPROVED: Visual representation of cutting pattern with actual widths and strong borders
          const rectStartX = margin + 15;
          const rectWidth = pageWidth - 50;
          const rectHeight = 16;
          
          // Draw the container box with thicker border
          pdf.setDrawColor(50, 50, 50); // Darker border color
          pdf.setLineWidth(0.5); // Thicker border
          pdf.rect(rectStartX, yPosition, rectWidth, rectHeight);
          
          // Group cuts by width and count for cleaner display
          const groupedCuts = new Map();
          
          rollSet.cuts?.forEach((cut:any) => {
            const width = cut.width_inches;
            let quantity = 1;
            
            // Get quantity from used_widths if available
            if (cut.used_widths && Object.keys(cut.used_widths).length > 0) {
              for (const widthStr in cut.used_widths) {
                if (Math.abs(parseFloat(widthStr) - width) < 0.1) {
                  quantity = cut.used_widths[widthStr];
                  break;
                }
              }
            }
            
            const key = `${width}-${cut.uses_existing ? 'existing' : 'manual'}`;
            if (groupedCuts.has(key)) {
              groupedCuts.set(key, {
                ...groupedCuts.get(key),
                quantity: groupedCuts.get(key).quantity + quantity
              });
            } else {
              groupedCuts.set(key, {
                width,
                quantity,
                uses_existing: cut.uses_existing
              });
            }
          });
          
          // Calculate total width for scaling
          const targetWidth = rollSet.target_width;
          let currentX = rectStartX;
          
          // Draw segments for each cut group with clear borders
          Array.from(groupedCuts.values()).forEach((cutGroup) => {
            for (let i = 0; i < cutGroup.quantity; i++) {
              // Calculate width of this segment
              const segmentWidthInInches = cutGroup.width;
              const segmentWidth = (segmentWidthInInches / targetWidth) * rectWidth;
              
              // Draw the segment with fill color
              pdf.setFillColor(cutGroup.uses_existing ? 100 : 150, 170, 100);
              pdf.rect(currentX, yPosition, segmentWidth, rectHeight, 'F');
              
              // Draw border around the segment
              pdf.setDrawColor(40, 40, 40); // Dark border for segments
              pdf.setLineWidth(0.3);
              pdf.rect(currentX, yPosition, segmentWidth, rectHeight);
              
              // Add text in the middle of the segment
              pdf.setFontSize(8);
              pdf.setTextColor(0);
              const textX = currentX + (segmentWidth / 2);
              const textY = yPosition + (rectHeight / 2);
              pdf.text(`${segmentWidthInInches}"`, textX, textY, { align: 'center', baseline: 'middle' });
              
              // Move to next position
              currentX += segmentWidth;
            }
          });
          
          // Draw waste section if any
          const wasteInInches = rollSet.summary.total_waste;
          if (wasteInInches > 0) {
            const wasteWidth = (wasteInInches / targetWidth) * rectWidth;
            pdf.setFillColor(240, 130, 130);
            pdf.rect(currentX, yPosition, wasteWidth, rectHeight, 'F');
            
            // Draw border around waste section
            pdf.setDrawColor(40, 40, 40);
            pdf.setLineWidth(0.3);
            pdf.rect(currentX, yPosition, wasteWidth, rectHeight);
            
            // Add waste text
            pdf.setFontSize(8);
            pdf.setTextColor(0);
            const textX = currentX + (wasteWidth / 2);
            const textY = yPosition + (rectHeight / 2);
            pdf.text(`${wasteInInches.toFixed(1)}"`, textX, textY, { align: 'center', baseline: 'middle' });
          }
          
          yPosition += rectHeight + 5;

          // Show individual cuts with order information below the visual representation
          pdf.setFontSize(9);
          pdf.setTextColor(0);
          pdf.text("Cut Details:", margin + 15, yPosition);
          yPosition += 5;
          
          rollSet.cuts?.forEach((cut:any) => {
            if (yPosition > 260) {
              pdf.addPage();
              yPosition = 20;
            }

            let quantity:any = 1;
            if (cut.used_widths && Object.keys(cut.used_widths).length > 0) {
              quantity = Object.values(cut.used_widths).reduce((sum :any, qty:any) => sum + qty , 0);
            }

            const cutText = `• ${cut.width_inches}"×${quantity}`;
            let orderInfo = '';
            
            // Use cut.order_frontend_id and cut.client_name if available
            if (cut.order_frontend_id && cut.client_name) {
              orderInfo = ` - ${cut.order_frontend_id} (${cut.client_name})`;
            } 
            // Otherwise, try to extract from description as fallback
            else if (cut.description && cut.description.includes('from')) {
              orderInfo = ` - ${cut.description}`;
            }

            pdf.text(`${cutText}${orderInfo}`, margin + 15, yPosition);
            yPosition += 5;
          });

          // Add waste information
          pdf.setFontSize(8);
          pdf.text(`Total width: ${rollSet.summary.total_actual_width.toFixed(1)}" | Waste: ${rollSet.summary.total_waste.toFixed(1)}"`, margin + 15, yPosition);
          yPosition += 8;
        });

        // Jumbo roll summary
        pdf.setFontSize(9);
        pdf.text(`Jumbo efficiency: ${jumboRoll.summary.efficiency}% | Total waste: ${jumboRoll.summary.total_waste.toFixed(1)}"`, margin + 5, yPosition);
        yPosition += 10;
      });

      // Paper spec summary
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Spec summary: ${specSuggestion.summary.total_jumbo_rolls} jumbo rolls, ${specSuggestion.summary.total_cuts} total cuts`, margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      yPosition += 15;
    });
  } else {
    // No suggestions available
    yPosition += 10;
    pdf.setFontSize(12);
    pdf.text("No roll suggestions available with the current settings.", margin, yPosition);
  }

  const pdfBlob = pdf.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
  
  URL.revokeObjectURL(url);
  toast.success('PDF opened for printing');
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
    if (checked) {
      if (suggestionResult?.spec_suggestions) {
        // Use spec_id for the new simplified structure
        const allSpecIds = suggestionResult.spec_suggestions?.map(spec => spec.spec_id);
        setSelectedSuggestions(new Set(allSpecIds));
      } else if (suggestionResult?.order_suggestions) {
        setSelectedSuggestions(new Set(suggestionResult.order_suggestions?.map(s => s.suggestion_id)));
      } else if (suggestionResult?.jumbo_suggestions) {
        setSelectedSuggestions(new Set(suggestionResult.jumbo_suggestions?.map(s => s.suggestion_id)));
      }
    } else {
      setSelectedSuggestions(new Set());
    }
  };

  // Manual cut addition functions
  const handleAddManualCut = (suggestionId: string, jumboId: string, setId: string) => {
    // Find the available waste for this set - handle both spec-based and order-based structures
    let suggestion, paperSpecs;

    if (suggestionResult?.spec_suggestions) {
      // New spec-based structure - handle case where suggestionId might be spec_id
      const specSuggestion = suggestionResult.spec_suggestions.find(s => s.spec_id === suggestionId);
      if (specSuggestion) {
        // This is a spec-based suggestion
        paperSpecs = specSuggestion.paper_spec;
        suggestion = specSuggestion; // Use the spec suggestion directly
      } else {
        // Try to find it in nested order_suggestions
        for (const specSuggestion of suggestionResult.spec_suggestions) {
          suggestion = specSuggestion.order_suggestions?.find(s => s.suggestion_id === suggestionId);
          if (suggestion) {
            paperSpecs = specSuggestion.paper_spec;
            break;
          }
        }
      }
    } else if (suggestionResult?.order_suggestions) {
      // Legacy order-based structure
      suggestion = suggestionResult.order_suggestions?.find(s => s.suggestion_id === suggestionId);
      paperSpecs = suggestion?.paper_spec;
    } else if (suggestionResult?.jumbo_suggestions) {
      // Jumbo-based structure
      suggestion = suggestionResult.jumbo_suggestions?.find(s => s.suggestion_id === suggestionId);
      paperSpecs = suggestion?.paper_specs;
    }

    const jumboRoll = suggestion?.jumbo_rolls?.find(jr => jr.jumbo_id === jumboId);
    const rollSet = jumboRoll?.sets?.find(s => s.set_id === setId);
    const availableWaste = rollSet?.summary?.total_waste || 0;

    // Capture paper specs from the suggestion
    paperSpecs = paperSpecs || {
      gsm: 0,
      bf: 0,
      shade: ''
    };
    
    setManualRollData({
      suggestionId,
      jumboId,
      setId,
      width: '',
      description: 'Manual Cut',
      availableWaste,
      selectedClient: '',
      paperSpecs
    });
    setShowManualRollDialog(true);
  };

  const handleManualRollSubmit = () => {
    const width = parseFloat(manualRollData.width);
    if (isNaN(width) || width <= 0) {
      toast.error('Please enter a valid width');
      return;
    }
    
    if (width > manualRollData.availableWaste) {
      toast.error(`Width cannot exceed available waste of ${manualRollData.availableWaste.toFixed(1)}"`);
      return;
    }

    if (!manualRollData.selectedClient) {
      toast.error('Please select a client for the manual cut');
      return;
    }

    // Create the manual cut with client and paper specs info
    const selectedClient = clients?.find(client => client.id === manualRollData.selectedClient);
    const manualCut = {
      cut_id: `manual_cut_${Date.now()}`,
      width_inches: width,
      uses_existing: false,
      used_widths: {},
      description: `${manualRollData.description}: ${width}"`,
      // Manual cut specific fields
      is_manual_cut: true,
      client_id: manualRollData.selectedClient,
      client_name: selectedClient?.company_name || 'Unknown',
      paper_specs: {
        gsm: manualRollData.paperSpecs.gsm,
        bf: manualRollData.paperSpecs.bf,
        shade: manualRollData.paperSpecs.shade
      }
    };

    // Clone current suggestions and add the manual cut
    if (suggestionResult?.spec_suggestions) {
      const updatedSpecSuggestions = suggestionResult.spec_suggestions.map(specSuggestion => {
        // Check if this is the specSuggestion we need to update (direct spec match)
        if (specSuggestion.spec_id === manualRollData.suggestionId) {
          const updatedSpecSuggestion = { ...specSuggestion };
          
          // Update jumbo rolls directly in the spec suggestion
          if (updatedSpecSuggestion.jumbo_rolls) {
            updatedSpecSuggestion.jumbo_rolls = updatedSpecSuggestion.jumbo_rolls.map(jumboRoll => {
              if (jumboRoll.jumbo_id === manualRollData.jumboId) {
                const updatedJumboRoll = { ...jumboRoll };
                updatedJumboRoll.sets = jumboRoll.sets?.map(rollSet => {
                  if (rollSet.set_id === manualRollData.setId) {
                    const updatedRollSet = { ...rollSet };
                    updatedRollSet.cuts = [...(rollSet.cuts || []), manualCut];

                    // Update summary - Account for used_widths quantities
                    const totalActualWidth = updatedRollSet.cuts.reduce((sum, c) => {
                      if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                        return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]) =>
                          widthSum + (parseFloat(width) * qty), 0);
                      }
                      return sum + c.width_inches;
                    }, 0);

                    updatedRollSet.summary = {
                      ...updatedRollSet.summary,
                      total_cuts: updatedRollSet.cuts.reduce((sum, c) => {
                        if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                          return sum + Object.values(c.used_widths).reduce((a, b) => a + b, 0);
                        }
                        return sum + 1;
                      }, 0),
                      total_actual_width: totalActualWidth,
                      total_waste: manualRollData.availableWaste - width,
                      efficiency: Math.round((totalActualWidth / rollSet.target_width) * 100)
                    };
                    
                    // Set manual_addition_available to false if waste is too low
                    if (updatedRollSet.summary.total_waste < 5) {
                      updatedRollSet.manual_addition_available = false;
                    }

                    return updatedRollSet;
                  }
                  return rollSet;
                });
                
                // Update jumbo roll summary
                const totalCuts = updatedJumboRoll.sets?.reduce(
                  (sum, set) => sum + (set.summary?.total_cuts || 0), 0
                ) || 0;
                
                const totalWaste = updatedJumboRoll.sets?.reduce(
                  (sum, set) => sum + (set.summary?.total_waste || 0), 0
                ) || 0;
                
                updatedJumboRoll.summary = {
                  ...updatedJumboRoll.summary,
                  total_cuts: totalCuts,
                  total_waste: totalWaste
                };
                
                return updatedJumboRoll;
              }
              return jumboRoll;
            });
          }
          
          return updatedSpecSuggestion;
        }
        
        // Otherwise check order_suggestions
        return {
          ...specSuggestion,
          order_suggestions: specSuggestion.order_suggestions?.map(suggestion => {
            if (suggestion.suggestion_id === manualRollData.suggestionId) {
              const updatedSuggestion = { ...suggestion };
              updatedSuggestion.jumbo_rolls = suggestion.jumbo_rolls?.map(jumboRoll => {
                if (jumboRoll.jumbo_id === manualRollData.jumboId) {
                  const updatedJumboRoll = { ...jumboRoll };
                  updatedJumboRoll.sets = jumboRoll.sets?.map(rollSet => {
                    if (rollSet.set_id === manualRollData.setId) {
                      const updatedRollSet = { ...rollSet };
                      updatedRollSet.cuts = [...(rollSet.cuts || []), manualCut];
  
                      // Update summary - Account for used_widths quantities
                      const totalActualWidth = updatedRollSet.cuts.reduce((sum, c) => {
                        if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                          return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]) =>
                            widthSum + (parseFloat(width) * qty), 0);
                        }
                        return sum + c.width_inches;
                      }, 0);
  
                      updatedRollSet.summary = {
                        ...updatedRollSet.summary,
                        total_cuts: updatedRollSet.cuts.reduce((sum, c) => {
                          if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                            return sum + Object.values(c.used_widths).reduce((a, b) => a + b, 0);
                          }
                          return sum + 1;
                        }, 0),
                        total_actual_width: totalActualWidth,
                        total_waste: manualRollData.availableWaste - width,
                        efficiency: Math.round((totalActualWidth / rollSet.target_width) * 100)
                      };
                      
                      // Set manual_addition_available to false if waste is too low
                      if (updatedRollSet.summary.total_waste < 5) {
                        updatedRollSet.manual_addition_available = false;
                      }
  
                      return updatedRollSet;
                    }
                    return rollSet;
                  });
                  return updatedJumboRoll;
                }
                return jumboRoll;
              });
              return updatedSuggestion;
            }
            return suggestion;
          })
        };
      });

      // Update the suggestion result
      setSuggestionResult(prev => prev ? { ...prev, spec_suggestions: updatedSpecSuggestions } : null);
    } else if (suggestionResult?.order_suggestions) {
      const updatedSuggestions = suggestionResult.order_suggestions?.map(suggestion => {
        if (suggestion.suggestion_id === manualRollData.suggestionId) {
          const updatedSuggestion = { ...suggestion };
          updatedSuggestion.jumbo_rolls = suggestion.jumbo_rolls?.map(jumboRoll => {
            if (jumboRoll.jumbo_id === manualRollData.jumboId) {
              const updatedJumboRoll = { ...jumboRoll };
              updatedJumboRoll.sets = jumboRoll.sets?.map(rollSet => {
                if (rollSet.set_id === manualRollData.setId) {
                  const updatedRollSet = { ...rollSet };
                  updatedRollSet.cuts = [...rollSet.cuts, manualCut];
                  
                  // Update summary - FIXED: Account for used_widths quantities
                  const totalActualWidth = updatedRollSet.cuts.reduce((sum, c) => {
                    if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                      // Sum width × quantity for cuts with used_widths (existing cuts)
                      return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]) => 
                        widthSum + (parseFloat(width) * qty), 0);
                    }
                    // Manual cuts or cuts without used_widths - use width_inches directly
                    return sum + c.width_inches;
                  }, 0);
                  
                  updatedRollSet.summary = {
                    ...updatedRollSet.summary,
                    total_cuts: updatedRollSet.cuts.reduce((sum, c) => {
                      if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                        return sum + Object.values(c.used_widths).reduce((a, b) => a + b, 0);
                      }
                      return sum + 1;
                    }, 0),
                    using_existing_cuts: updatedRollSet.cuts.reduce((sum, c) => {
                      if (c.uses_existing && c.used_widths && Object.keys(c.used_widths).length > 0) {
                        return sum + Object.values(c.used_widths).reduce((a, b) => a + b, 0);
                      }
                      return sum + (c.uses_existing ? 1 : 0);
                    }, 0),
                    total_actual_width: totalActualWidth,
                    total_waste: Math.max(0, rollSet.target_width - totalActualWidth),
                    efficiency: Math.round((totalActualWidth / rollSet.target_width) * 100)
                  };
                  
                  return updatedRollSet;
                }
                return rollSet;
              });
              
              // Update jumbo summary
              updatedJumboRoll.summary = {
                ...updatedJumboRoll.summary,
                total_cuts: updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.total_cuts, 0),
                using_existing_cuts: updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.using_existing_cuts, 0),
                total_actual_width: updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.total_actual_width, 0),
                total_waste: updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.total_waste, 0),
                efficiency: Math.round((updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.total_actual_width, 0) / (jumboRoll.target_width * updatedJumboRoll.sets.length)) * 100)
              };
              
              return updatedJumboRoll;
            }
            return jumboRoll;
          });
          
          // Update suggestion summary
          updatedSuggestion.summary = {
            ...suggestion.summary,
            total_cuts: updatedSuggestion.jumbo_rolls.reduce((sum, jr) => sum + jr.summary.total_cuts, 0),
            using_existing_cuts: updatedSuggestion.jumbo_rolls.reduce((sum, jr) => sum + jr.summary.using_existing_cuts, 0)
          };
          
          return updatedSuggestion;
        }
        return suggestion;
      });

      // Update the suggestion result
      setSuggestionResult(prev => prev ? { ...prev, order_suggestions: updatedSuggestions } : null);
    }

    setShowManualRollDialog(false);
    setManualRollData({ 
      suggestionId: '', 
      jumboId: '', 
      setId: '', 
      width: '', 
      description: 'Manual Cut', 
      availableWaste: 0,
      selectedClient: '',
      paperSpecs: { gsm: 0, bf: 0, shade: '' }
    });
    toast.success('Manual cut added successfully');
  };
  

  const handleStartProduction = async () => {
    if (!suggestionResult || selectedSuggestions.size === 0) {
      toast.error('Please select at least one suggestion');
      return;
    }

    try {
      setProductionLoading(true);
      
      // Debug log the selected suggestions
      console.log('🔍 Selected suggestions count:', selectedSuggestions.size);
      console.log('🔍 Selected suggestions:', Array.from(selectedSuggestions));
      
      // Get user ID from localStorage
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        toast.error('User not authenticated');
        return;
      }
      
      // Filter selected suggestions - handle spec-based, order-based and legacy formats
      let selectedSuggestionData;
      if (suggestionResult.spec_suggestions) {
        // New spec-based format - get selected specs directly
        selectedSuggestionData = suggestionResult.spec_suggestions.filter(
          spec => selectedSuggestions.has(spec.spec_id)
        );
      } else if (suggestionResult.order_suggestions) {
        // Legacy order-based format
        selectedSuggestionData = suggestionResult.order_suggestions.filter(
          suggestion => selectedSuggestions.has(suggestion.suggestion_id)
        );
      } else {
        // Legacy jumbo suggestions format
        selectedSuggestionData = suggestionResult.jumbo_suggestions?.filter(
          suggestion => selectedSuggestions.has(suggestion.suggestion_id)
        ) || [];
      }
      console.log('🔧 SELECTED SUGGESTIONS DATA:', selectedSuggestions);
      console.log(selectedSuggestionData)

      // Extract all pending order IDs from selected suggestions
      const allSelectedPendingIds = selectedSuggestionData.flatMap(
        suggestion =>(suggestion as any).pending_order_ids
      );

      // Get original pending order items for selected suggestions
      const originalPendingOrders = pendingItems.filter(item =>
        allSelectedPendingIds.includes(item.id)
      );

      console.log('🔧 PRODUCTION DATA EXTRACTION:');
      console.log('Selected suggestions:', selectedSuggestionData.length);
      console.log('Pending IDs from suggestions:', allSelectedPendingIds);
      console.log('Original pending orders found:', originalPendingOrders.length);

      // Transform to main planning format using suggestion roll structure
      // ✅ FIX: Use actual suggestion roll numbers for proper individual_roll_number assignment
      const selectedCutRolls: any[] = [];
      let globalIndex = 0;
      
      // Process each selected suggestion (could be spec or order)
      selectedSuggestionData.forEach((suggestion : any, suggestionIndex: number) => {
        console.log(`🔧 === PROCESSING SUGGESTION ${suggestionIndex + 1} ===`);
        console.log('🔧 Suggestion ID:', suggestion.spec_id || suggestion.suggestion_id);
        console.log('🔧 Has jumbo_rolls:', !!suggestion.jumbo_rolls);
        console.log('🔧 Has rolls (legacy):', !!suggestion.rolls);

        // Check if it's spec-based, order-based or legacy jumbo-based format
        if (suggestion.jumbo_rolls) {
          // NEW SPEC-BASED OR ORDER-BASED FORMAT
          console.log(`🔧 Processing ${suggestion.jumbo_rolls.length} jumbo rolls`);
          suggestion.jumbo_rolls.forEach((jumboRoll:any, jumboIndex: number) => {
            console.log(`🔧 Jumbo ${jumboIndex + 1}: ${jumboRoll.sets?.length || 0} sets`);
            jumboRoll.sets.forEach((rollSet:any, setIndex: number) => {
              console.log(`🔧 Set ${setIndex + 1}: ${rollSet.cuts?.length || 0} cuts`);

              // Add wastage data once per rollSet (moved from inside the pending items loop)
              const totalWaste = rollSet.summary?.total_waste || 0;
              if (totalWaste > 0) {
                const wastageItem = {
                  width_inches: parseFloat(totalWaste.toString()),
                  paper_id: suggestion.paper_spec.paper_id || "",
                  gsm: suggestion.paper_spec.gsm,
                  bf: suggestion.paper_spec.bf,
                  shade: suggestion.paper_spec.shade,
                  source_plan_id: "", // Will be filled by backend
                  individual_roll_number: rollSet.set_number,
                  notes: `Wastage from pending order rollset ${rollSet.set_number}`,
                  source_pending_id: rollSet.set_id // Use rollSet ID since this is per rollSet
                };
                // Store wastage data (we'll collect all at the end)
                if (!window.tempWastageData) window.tempWastageData = [];
                window.tempWastageData.push(wastageItem);
                console.log('🗑️ Added wastage:', totalWaste, 'inches from rollset', rollSet.set_number);
              }

              rollSet.cuts.forEach((cut:any, cutIndex: number) => {
                console.log(`🔧 Cut ${cutIndex + 1}: ${cut.width_inches}" uses_existing=${cut.uses_existing} used_widths=`, cut.used_widths);
                if (cut.uses_existing && cut.width_inches) {
                  // Handle existing pending order cuts
                  const paperSpec = suggestion.paper_spec || suggestion.paper_specs;
                  console.log(`🔍 SEARCHING for pending item: width=${cut.width_inches}, gsm=${paperSpec.gsm}, shade=${paperSpec.shade}, bf=${paperSpec.bf}`);
                  console.log(`🔍 Available pending items:`, originalPendingOrders?.map(item => ({
                    id: item.id.substring(0, 8),
                    width: item.width_inches,
                    gsm: item.gsm,
                    shade: item.shade,
                    bf: item.bf
                  })));

                  // Find ALL matching pending items for this width and paper spec
                  const matchingPendingItems = originalPendingOrders.filter(item =>
                    Math.abs(item.width_inches - cut.width_inches) < 0.1 &&
                    item.gsm === paperSpec.gsm &&
                    item.shade === paperSpec.shade &&
                    Math.abs(item.bf - paperSpec.bf) < 0.01 &&
                    item.quantity_pending > 0  // Only items with remaining quantity
                  );
                  
                  // Select the item with the most remaining quantity (greedy approach)
                  const matchingPendingItem = matchingPendingItems.length > 0 
                    ? matchingPendingItems.reduce((best, current) => 
                        current.quantity_pending > best.quantity_pending ? current : best
                      )
                    : null;
                  
                  console.log(`🔍 MATCH RESULT: ${matchingPendingItem ? 'FOUND' : 'NOT FOUND'} for ${cut.width_inches}"`);
                  if (!matchingPendingItem) {
                    console.log(`❌ NO MATCH for ${cut.width_inches}" - skipping cut_roll creation`);
                  }

                  if (matchingPendingItem && cut.used_widths) {
                    // FIXED: Handle both "40" and "40.0" key formats in used_widths
                    const widthStr = cut.width_inches.toString();
                    const widthFloatStr = parseFloat(cut.width_inches).toString();
                    
                    // Try all possible key formats
                    let quantity = 1;
                    const availableKeys = Object.keys(cut.used_widths);
                    console.log(`🔍 Available keys in used_widths:`, availableKeys);
                    
                    for (const key of availableKeys) {
                      if (parseFloat(key) === cut.width_inches) {
                        quantity = cut.used_widths[key];
                        console.log(`🔍 FOUND MATCH: key="${key}" matches width=${cut.width_inches}, quantity=${quantity}`);
                        break;
                      }
                    }
                    
                    // Distribute cut_rolls across available items (CRITICAL FIX)
                    let remainingQuantity = quantity;
                    let currentItemIndex = 0;
                    
                    while (remainingQuantity > 0 && currentItemIndex < matchingPendingItems.length) {
                      const currentItem = matchingPendingItems[currentItemIndex];
                      
                      // Skip items with no remaining quantity
                      if (currentItem.quantity_pending <= 0) {
                        currentItemIndex++;
                        continue;
                      }
                      
                      // Take minimum of what we need and what's available
                      const canTake = Math.min(remainingQuantity, currentItem.quantity_pending);
                      console.log(`📦 Taking ${canTake} from item ${currentItem.id} (has ${currentItem.quantity_pending})`);
                      
                      // Create cut_rolls for this item
                      for (let i = 0; i < canTake; i++) {
                        selectedCutRolls.push({
                          paper_id: "", // Will be resolved by backend from paper specs
                          width_inches: cut.width_inches,
                          qr_code: `PENDING_CUT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${globalIndex}`,
                          gsm: suggestion.paper_spec.gsm,
                          bf: suggestion.paper_spec.bf,
                          shade: suggestion.paper_spec.shade,
                          individual_roll_number: rollSet.set_number,
                          trim_left: null,
                          source_type: 'pending_order',
                          source_pending_id: currentItem.id,
                          order_id: currentItem.original_order_id,
                          
                        });
                        globalIndex++;
                      }
                      
                      // Update tracking
                      currentItem.quantity_pending -= canTake;
                      remainingQuantity -= canTake;
                      
                      currentItemIndex++;
                    }
                    
                    if (remainingQuantity > 0) {
                      console.error(`❌ SHORTAGE: Could not create ${remainingQuantity} cut_rolls - insufficient items`);
                    }
                    console.log(`📊 RUNNING TOTAL: ${selectedCutRolls.length} cut_rolls so far`);
                  }
                } else if (cut.is_manual_cut && cut.width_inches) {
                  // Handle manual cuts - no source_pending_id, special processing
                  console.log(`🔧 Creating manual cut: ${cut.width_inches}" for client ${cut.client_name}`);
                  console.log('🔍 Manual cut full data:', cut);
                  console.log('🔍 Client mapping: client_id =', cut.client_id, ', client_name =', cut.client_name);
                  
                  const manualCutRoll = {
                    paper_id: "", // Will be resolved by backend from paper specs
                    width_inches: cut.width_inches,
                    qr_code: `MANUAL_CUT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${globalIndex}`,
                    gsm: cut.paper_specs.gsm,
                    bf: cut.paper_specs.bf,
                    shade: cut.paper_specs.shade,
                    individual_roll_number: rollSet.set_number,
                    trim_left: null,
                    source_type: 'manual_cut',
                    // Manual cut specific fields
                    is_manual_cut: true,
                    manual_cut_client_id: cut.client_id,
                    manual_cut_client_name: cut.client_name,
                    description: cut.description
                  };
                  
                  console.log('🔍 Final manual cut roll being sent:', manualCutRoll);
                  selectedCutRolls.push(manualCutRoll);
                  globalIndex++;
                }
              });
            });
          });
        } else if (suggestion.rolls) {
          // LEGACY JUMBO-BASED FORMAT
          suggestion.rolls.forEach((roll:any) => {
            // Get pending items for this roll's widths
            if (roll.uses_existing && roll.widths && roll.widths.length > 0) {
              // Create individual cut_rolls for each width piece in this 118" roll
              roll.widths.forEach((width:any) => {
                // Find matching pending item
                const matchingPendingItem = originalPendingOrders?.find(item => 
                  item.width_inches === width && 
                  item.gsm === suggestion.paper_specs.gsm &&
                  item.bf === suggestion.paper_specs.bf &&
                  item.shade === suggestion.paper_specs.shade
                );
                
                if (matchingPendingItem) {
                  // Calculate the proper wastage for this roll
                  const totalRollWaste = roll.waste || 0;
                  const numWidths = roll.widths?.length || 1;
                  const wastagePerWidth = numWidths > 1 ? totalRollWaste / numWidths : totalRollWaste;
                  
                  console.log(`🗑️ Legacy format - Roll ${roll.roll_number} waste: ${totalRollWaste}", widths: ${numWidths}, wastage per width: ${wastagePerWidth}"`);
                  
                  selectedCutRolls.push({
                    paper_id: "", // Will be resolved by backend from paper specs
                    width_inches: width,
                    qr_code: `PENDING_CUT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${globalIndex}`,
                    gsm: suggestion.paper_specs.gsm,
                    bf: suggestion.paper_specs.bf,
                    shade: suggestion.paper_specs.shade,
                    individual_roll_number: roll.roll_number,
                    trim_left: null,
                    source_type: 'pending_order',
                    source_pending_id: matchingPendingItem.id,
                    order_id: matchingPendingItem.original_order_id,
                   
                  });
                  globalIndex++;
                }
              });
            }
          });
        }
      });

      // Also send all available cuts (same as selected for pending flow)
      const allAvailableCuts = [...selectedCutRolls];
      console.log('🔧 ALL AVAILABLE CUTS COUNT:', allAvailableCuts.length);

      console.log('🔧 TRANSFORMED CUT ROLLS COUNT:', selectedCutRolls.length);
      
      // Check if we actually have any selected cut rolls
      if (!selectedCutRolls || selectedCutRolls.length === 0) {
        toast.error("No cut rolls were created from the selected suggestions. Please check your selection.");
        setProductionLoading(false);
        return;
      }
      
      console.log('🔧 SAMPLE CUT ROLL:', selectedCutRolls[0]);
      
      // Debug: Show count per width
      const widthCounts = selectedCutRolls.reduce((acc, roll) => {
        const width = roll.width_inches;
        acc[width] = (acc[width] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      console.log('🔧 CUT ROLLS BY WIDTH:', widthCounts);

      // Double-check selected cut rolls count
      console.log('🔍 FINAL VERIFICATION - Selected cut rolls count:', selectedCutRolls.length);
      
      // Get wastage data that was collected during processing
      const wastageData = window.tempWastageData || [];
      // Clear temp data
      window.tempWastageData = [];
      console.log('🔍 COLLECTED WASTAGE DATA: Total wastage items:', wastageData.length);
      console.log('🗑️ WASTAGE DATA EXTRACTED:', wastageData.length, 'items');
      
      // Debug the wastage data structure to ensure it's correct
      console.log('🔧 WASTAGE DATA TYPE:', Array.isArray(wastageData) ? 'Array' : typeof wastageData);
      
      if (wastageData.length > 0) {
        console.log('🗑️ SAMPLE WASTAGE ITEMS:');
        wastageData.slice(0, Math.min(3, wastageData.length)).forEach((item, i) => {
          console.log(`  Item ${i+1}: width=${item.width_inches}", paper=${item.gsm}GSM ${item.shade}`);
          console.log(`  Item ${i+1} type:`, typeof item);
          console.log(`  Item ${i+1} has get method:`, typeof item.get === 'function');
          console.log(`  Item ${i+1} stringified:`, JSON.stringify(item));
        });
      } else {
        console.log('⚠️ NO WASTAGE ITEMS EXTRACTED - Check cut roll wastage values');
      }
      
      // Ensure wastage_data is a plain array of objects
      const plainWastageData = wastageData.map(item => ({
        width_inches: parseFloat(item.width_inches?.toString() || '0'),
        paper_id: item.paper_id || "",
        gsm: item.gsm ? parseInt(item.gsm.toString(), 10) : 0,
        bf: item.bf ? parseFloat(item.bf.toString()) : 0,
        shade: item.shade || "",
        source_plan_id: item.source_plan_id || "",
        individual_roll_number: item.individual_roll_number,
        notes: item.notes || "",
        source_pending_id: item.source_pending_id
      }));
      
      console.log('🔧 PLAIN WASTAGE DATA:', plainWastageData);
      
      // Use same format as main planning page (StartProductionRequest)
      const requestData = {
        selected_cut_rolls: selectedCutRolls,
        all_available_cuts: allAvailableCuts,
        wastage_data: plainWastageData, // Use the plain objects
        added_rolls_data: {}, // No added rolls for pending flow
        created_by_id: userId,
        jumbo_roll_width: 118
      };
      
      // Final verification of request data
      console.log('🔧 FINAL REQUEST DATA CHECK:');
      console.log('  → selected_cut_rolls count:', requestData.selected_cut_rolls.length);
      console.log('  → all_available_cuts count:', requestData.all_available_cuts.length);
      console.log('  → wastage_data count:', requestData.wastage_data.length);
      console.log('  → created_by_id:', requestData.created_by_id);
      
      // Safety checks before API call
      if (requestData.selected_cut_rolls.length === 0) {
        toast.error("No cut rolls were selected. Please select at least one roll before starting production.");
        setProductionLoading(false);
        return;
      }
      
      // Verify that wastage_data is properly formatted
      if (requestData.wastage_data.length > 0) {
        console.log('🔧 WASTAGE DATA FORMAT CHECK:');
        const sampleItem = requestData.wastage_data[0];
        console.log('  → Sample item:', sampleItem);
        console.log('  → Sample item type:', typeof sampleItem);
        console.log('  → Sample item width_inches type:', typeof sampleItem.width_inches);
        console.log('  → Sample item serializes to:', JSON.stringify(sampleItem));
      }
      
      // Convert the request to a plain object via JSON serialization to ensure no class instances
      const plainRequestData = JSON.parse(JSON.stringify(requestData));
      console.log('🔧 FINAL REQUEST DATA:', requestData);

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
      // window.location.reload();
      
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
    const margin = 10;
    let yPosition = 15;

    // Header
    pdf.setFontSize(20);
    pdf.text('Pending Order Items Report', margin, yPosition);
    
    yPosition += 10;
    pdf.setFontSize(12);
    pdf.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, yPosition);
    pdf.text(`Total Items: ${filteredItems.length}`, pageWidth - margin - 50, yPosition);
    
    yPosition += 12;
    
    // Summary Statistics
    pdf.setFontSize(16);
    pdf.text('Summary Statistics', margin, yPosition);
    yPosition += 10;
    
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
    yPosition += 10;

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
    
    yPosition += 10;

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
        
        yPosition += 10;
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

    const pdfBlob = pdf.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    URL.revokeObjectURL(url);
    toast.success('Pending orders PDF opened for printing');
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

        {/* Manual Cut Addition Dialog */}
        <Dialog open={showManualRollDialog} onOpenChange={setShowManualRollDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Manual Cut</DialogTitle>
              <DialogDescription>
                Add a custom cut to the selected 118" roll set. This will be marked as a manual cut requirement.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="manual-width" className="text-right">
                  Width (inches)
                </Label>
                <Input
                  id="manual-width"
                  type="number"
                  min="1"
                  max={manualRollData.availableWaste}
                  step="0.1"
                  value={manualRollData.width}
                  onChange={(e) => setManualRollData(prev => ({ ...prev, width: e.target.value }))}
                  className="col-span-3"
                  placeholder={`Max: ${manualRollData.availableWaste.toFixed(1)}"`}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="manual-description" className="text-right">
                  Description
                </Label>
                <Input
                  id="manual-description"
                  value={manualRollData.description}
                  onChange={(e) => setManualRollData(prev => ({ ...prev, description: e.target.value }))}
                  className="col-span-3"
                  placeholder="e.g., Additional cut for order"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="client-select" className="text-right">
                  Client
                </Label>
                <Select 
                  value={manualRollData.selectedClient} 
                  onValueChange={(value) => setManualRollData(prev => ({ ...prev, selectedClient: value }))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground space-y-3">
                <div className="bg-blue-50 p-3 rounded text-center">
                  <div className="font-medium text-blue-800">Available Waste Space</div>
                  <div className="text-lg font-bold text-blue-600">{manualRollData.availableWaste.toFixed(1)}"</div>
                  <div className="text-xs text-blue-600">Maximum cut width allowed</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-medium text-gray-800 mb-2">Paper Specifications</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-gray-600">GSM:</div>
                      <div className="font-medium">{manualRollData.paperSpecs.gsm}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">BF:</div>
                      <div className="font-medium">{manualRollData.paperSpecs.bf}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Shade:</div>
                      <div className="font-medium">{manualRollData.paperSpecs.shade}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">Will be used for the manual cut order</div>
                </div>
              </div>
              {manualRollData.width && !isNaN(parseFloat(manualRollData.width)) && (
                <div className="text-sm text-muted-foreground text-center">
                  This will add a {manualRollData.width}" cut marked as "Manual Cut"
                  {parseFloat(manualRollData.width) > manualRollData.availableWaste && (
                    <div className="text-red-500 text-xs mt-1">
                      ⚠️ Width exceeds available waste space
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManualRollDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleManualRollSubmit}>
                Add Manual Cut
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
                {/* Summary Stats - Support both order-based and legacy */}
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{suggestionResult.target_width}"</div>
                    <div className="text-sm text-blue-800">Target Width</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {suggestionResult.spec_suggestions ? suggestionResult.summary.specs_processed :
                       suggestionResult.order_suggestions ? suggestionResult.summary.orders_processed :
                       suggestionResult.summary.jumbo_rolls_suggested}
                    </div>
                    <div className="text-sm text-green-800">
                      {suggestionResult.spec_suggestions ? 'Paper Specs' :
                       suggestionResult.order_suggestions ? 'Orders' : 'Jumbo Rolls'}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {suggestionResult.spec_suggestions ? suggestionResult.spec_suggestions[0]?.summary?.total_orders as number : suggestionResult.summary.total_rolls_suggested}
                    </div>
                    <div className="text-sm text-purple-800">
                      {suggestionResult.spec_suggestions ? 'Orders' : 'Total Rolls'}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {suggestionResult.spec_suggestions ? suggestionResult.summary?.total_cuts :
                       suggestionResult.order_suggestions ? suggestionResult.summary.total_118_sets :
                       suggestionResult.summary.spec_groups_processed}
                    </div>
                    <div className="text-sm text-orange-800">
                      {suggestionResult.spec_suggestions ? 'Total Rolls' :
                       suggestionResult.order_suggestions ? '118" Sets' : 'Paper Specs'}
                    </div>
                  </div>
                </div>

                {/* New Spec-Based Suggestions */}
                {suggestionResult.spec_suggestions && suggestionResult.spec_suggestions.length > 0 ? (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Paper Spec Based Roll Suggestions</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="select-all-spec-suggestions"
                            checked={selectedSuggestions.size === suggestionResult.spec_suggestions.length}
                            onCheckedChange={handleSelectAllSuggestions}
                          />
                          <label htmlFor="select-all-spec-suggestions" className="text-sm font-medium">
                            Select All ({selectedSuggestions.size}/{suggestionResult.spec_suggestions.length})
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

                    {/* Display each paper spec group */}
                    {suggestionResult.spec_suggestions?.map((specSuggestion, specIndex) => (
                      <Card key={specSuggestion.spec_id} className={`bg-gradient-to-r from-amber-50 to-orange-50 border-2 ${
                        selectedSuggestions.has(specSuggestion.spec_id) ? 'border-green-400 ring-2 ring-green-200' : 'border-amber-200'
                      }`}>
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={`spec-suggestion-${specSuggestion.spec_id}`}
                                checked={selectedSuggestions.has(specSuggestion.spec_id)}
                                onCheckedChange={(checked) => handleSuggestionToggle(specSuggestion.spec_id, checked as boolean)}
                              />
                              <div>
                                <CardTitle className="text-xl flex items-center gap-3">
                                  <Package className="h-6 w-6 text-amber-600" />
                                  📋 {specSuggestion.paper_spec.shade} {specSuggestion.paper_spec.gsm}GSM (BF: {specSuggestion.paper_spec.bf})
                                </CardTitle>
                                <CardDescription className="flex items-center gap-4 mt-2">
                                  <Badge className="bg-amber-100 text-amber-800">
                                    {specSuggestion.summary.total_orders} Orders
                                  </Badge>
                                  <Badge className="bg-amber-100 text-amber-800">
                                    {specSuggestion.summary.total_jumbo_rolls} Jumbo Rolls
                                  </Badge>
                                  <Badge className="bg-amber-100 text-amber-800">
                                    {specSuggestion.summary.total_118_sets} Sets
                                  </Badge>
                                  <Badge className="bg-amber-100 text-amber-800">
                                    {specSuggestion.summary.total_cuts} Cuts
                                  </Badge>
                                </CardDescription>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-6">
                            {/* Display jumbo rolls directly (no order grouping) */}
                            {specSuggestion.jumbo_rolls?.map((jumboRoll:any, jumboIndex:any) => (
                              <div key={jumboRoll.jumbo_id} className="p-4 rounded-lg border-2 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="font-medium text-purple-800">
                                    Jumbo Roll #{jumboRoll.jumbo_number} ({jumboRoll.summary.efficiency}% efficient)
                                  </div>
                                  <Badge className="bg-purple-100 text-purple-800">
                                    {jumboRoll.summary.total_sets} sets | {jumboRoll.summary.total_waste.toFixed(1)}" total waste
                                  </Badge>
                                </div>
                                {/* 118" Roll Sets in this Jumbo */}
                                <div className="space-y-3">
                                  {jumboRoll.sets?.map((rollSet:any, setIndex:any) => (
                                    <div key={rollSet.set_id} className="p-3 rounded-lg border bg-white border-blue-200">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="font-medium text-blue-800">
                                          118" Roll Set #{rollSet.set_number} ({rollSet.summary.efficiency}% efficient)
                                        </div>
                                        <Badge className="bg-blue-100 text-blue-800">
                                          {rollSet.summary.total_cuts} cuts | {rollSet.summary.total_waste.toFixed(1)}" waste
                                        </Badge>
                                      </div>

                                      {/* Visual cutting pattern representation */}
                                      <div className="mb-3">
                                        <div className="text-sm font-medium text-muted-foreground mb-2">
                                          Cutting Pattern ({rollSet.target_width}" Roll):
                                        </div>
                                        <div className="relative h-12 bg-muted rounded-lg border overflow-hidden">
                                          {(() => {
                                            let currentPosition = 0;
                                            const targetWidth = rollSet.target_width;
                                            const totalWaste = rollSet.summary.total_waste;

                                            return (
                                              <>
                                                {/* Individual cut sections */}
                                                {rollSet.cuts?.map((cut:any, cutIndex : any) => {
                                                  const cutWidth = cut.width_inches;
                                                  const sections = [];

                                                  // Determine quantity
                                                  let quantity = 1;
                                                  if (cut.used_widths && Object.keys(cut.used_widths).length > 0) {
                                                    for (const [widthKey, qty] of Object.entries(cut.used_widths)) {
                                                      if (Math.abs(parseFloat(widthKey) - cutWidth) < 0.1) {
                                                        quantity = qty as number;
                                                        break;
                                                      }
                                                    }
                                                  }

                                                  // Create individual sections for each quantity
                                                  for (let i = 0; i < quantity; i++) {
                                                    const widthPercentage = (cutWidth / targetWidth) * 100;
                                                    const leftPosition = (currentPosition / targetWidth) * 100;
                                                    currentPosition += cutWidth;

                                                    sections.push(
                                                      <div
                                                        key={`${cutIndex}-${i}`}
                                                        className={`absolute h-full border-r-2 border-white ${
                                                          cut.uses_existing
                                                            ? "bg-gradient-to-r from-green-400 to-green-500"
                                                            : "bg-gradient-to-r from-blue-400 to-blue-500"
                                                        }`}
                                                        style={{
                                                          left: `${leftPosition}%`,
                                                          width: `${widthPercentage}%`,
                                                        }}
                                                      >
                                                        <div className="flex items-center justify-center h-full text-white text-xs font-medium">
                                                          {cutWidth}"
                                                        </div>
                                                      </div>
                                                    );
                                                  }

                                                  return sections;
                                                })}

                                                {/* Waste section */}
                                                {totalWaste > 0 && (
                                                  <div
                                                    className="absolute h-full bg-gradient-to-r from-red-300 to-red-400"
                                                    style={{
                                                      left: `${(currentPosition / targetWidth) * 100}%`,
                                                      width: `${(totalWaste / targetWidth) * 100}%`,
                                                    }}
                                                  >
                                                    <div className="flex items-center justify-center h-full text-red-800 text-xs font-medium">
                                                      {totalWaste.toFixed(1)}" waste
                                                    </div>
                                                  </div>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>

                                      {/* Cut Details with Order Information */}
                                      <div className="space-y-2">
                                        {rollSet.cuts?.map((cut:any, cutIndex:any) => {
                                          let quantity = 1;
                                          if (cut.used_widths && Object.keys(cut.used_widths).length > 0) {
                                            quantity = Object.values(cut.used_widths as number).reduce((sum:any, qty:any) => sum + qty, 0);
                                          }

                                          return (
                                            <div key={cutIndex} className={`flex items-center justify-between p-2 rounded ${
                                              cut.uses_existing ? 'bg-green-50' : 'bg-blue-50'
                                            }`}>
                                              <div className="flex items-center gap-2">
                                                <Badge className={cut.uses_existing ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                                                  {cut.width_inches}" × {quantity}
                                                </Badge>
                                                <div className="flex flex-col">
                                                  <span className="text-sm font-medium">{cut.description}</span>
                                                  {/* DEBUG LOG 3: Check each cut's order info */}
                                                  {(() => {
                                                    if (!cut.order_frontend_id || !cut.client_name) {
                                                      console.log('🔍 DEBUG: Missing order info for cut:', {
                                                        cut_id: cut.cut_id,
                                                        width: cut.width_inches,
                                                        has_order_id: !!cut.order_frontend_id,
                                                        has_client: !!cut.client_name,
                                                        order_id: cut.order_frontend_id,
                                                        client: cut.client_name
                                                      });
                                                    }
                                                    return null;
                                                  })()}
                                                  {cut.order_frontend_id && cut.client_name && (
                                                    <span className="text-xs text-muted-foreground">
                                                      {cut.order_frontend_id} - {cut.client_name}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                {cut.uses_existing && (
                                                  <Badge variant="outline" className="text-xs">
                                                    From Pending
                                                  </Badge>
                                                )}
                                                {cut.is_manual_cut && (
                                                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                                                    Manual: {cut.client_name}
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Manual Addition Button */}
                                      {rollSet.manual_addition_available && (
                                        <div className="mt-3 flex justify-center">
                                          <Button
                                            onClick={() => handleAddManualCut(specSuggestion.spec_id, jumboRoll.jumbo_id, rollSet.set_id)}
                                            size="sm"
                                            variant="outline"
                                            className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                          >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Manual Cut ({rollSet.summary.total_waste.toFixed(1)}" available)
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : suggestionResult.order_suggestions && suggestionResult.order_suggestions.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Order-Based Roll Suggestions</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="select-all-order-suggestions"
                            checked={suggestionResult.order_suggestions.length > 0 && selectedSuggestions.size === suggestionResult.order_suggestions.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSuggestions(new Set(suggestionResult.order_suggestions!.map(s => s.suggestion_id)));
                              } else {
                                setSelectedSuggestions(new Set());
                              }
                            }}
                          />
                          <label htmlFor="select-all-order-suggestions" className="text-sm font-medium">
                            Select All ({selectedSuggestions.size}/{suggestionResult.order_suggestions.length})
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
                      {suggestionResult.order_suggestions?.map((orderSuggestion) => (
                        <Card key={orderSuggestion.suggestion_id} className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-2 ${
                          selectedSuggestions.has(orderSuggestion.suggestion_id) ? 'border-green-400 ring-2 ring-green-200' : 'border-blue-200'
                        }`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={`order-suggestion-${orderSuggestion.suggestion_id}`}
                                  checked={selectedSuggestions.has(orderSuggestion.suggestion_id)}
                                  onCheckedChange={(checked) => handleSuggestionToggle(orderSuggestion.suggestion_id, checked as boolean)}
                                />
                                <div>
                                  <CardTitle className="text-lg">
                                    Order {orderSuggestion.order_info.order_frontend_id} - {orderSuggestion.order_info.client_name}
                                  </CardTitle>
                                  <CardDescription>
                                    {orderSuggestion.paper_spec.shade} {orderSuggestion.paper_spec.gsm}GSM (BF: {orderSuggestion.paper_spec.bf}) | Target: {orderSuggestion.target_width}" per roll
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">
                                  {orderSuggestion.summary.total_jumbo_rolls} jumbo rolls | {orderSuggestion.summary.total_118_sets} sets | {orderSuggestion.summary.total_cuts} cuts
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {orderSuggestion.summary.using_existing_cuts} using existing cuts
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Jumbo Rolls for this Order */}
                            <div className="grid gap-4">
                              {orderSuggestion.jumbo_rolls?.map((jumboRoll, jumboIndex) => (
                                <div key={jumboRoll.jumbo_id} className="p-4 rounded-lg border-2 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="font-medium text-purple-800">
                                      Jumbo Roll #{jumboRoll.jumbo_number} ({jumboRoll.summary.efficiency}% efficient)
                                    </div>
                                    <Badge className="bg-purple-100 text-purple-800">
                                      {jumboRoll.summary.total_sets} sets | {jumboRoll.summary.total_waste.toFixed(1)}" total waste
                                    </Badge>
                                  </div>
                                  
                                  {/* 118" Roll Sets in this Jumbo */}
                                  <div className="space-y-3">
                                    {jumboRoll.sets?.map((rollSet, setIndex) => (
                                      <div key={rollSet.set_id} className="p-3 rounded-lg border bg-white border-blue-200">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="font-medium text-blue-800">
                                            118" Roll Set #{rollSet.set_number} ({rollSet.summary.efficiency}% efficient)
                                          </div>
                                          <Badge className="bg-blue-100 text-blue-800">
                                            {rollSet.summary.total_cuts} cuts | {rollSet.summary.total_waste.toFixed(1)}" waste
                                          </Badge>
                                        </div>
                                        
                                        {/* Visual cutting pattern representation like planning page */}
                                        <div className="mb-3">
                                          <div className="text-sm font-medium text-muted-foreground mb-2">
                                            Cutting Pattern ({rollSet.target_width}" Roll):
                                          </div>
                                          <div className="relative h-12 bg-muted rounded-lg border overflow-hidden">
                                            {(() => {
                                              let currentPosition = 0;
                                              const targetWidth = rollSet.target_width;
                                              const totalWaste = rollSet.summary.total_waste;
                                              const wastePercentage = (totalWaste / targetWidth) * 100;
                                              
                                              return (
                                                <>
                                                  {/* Individual cut sections - handle quantities > 1 */}
                                                  {rollSet.cuts?.map((cut, cutIndex) => {
                                                    const cutWidth = cut.width_inches;
                                                    const sections = [];
                                                    
                                                    // Determine quantity - check used_widths for quantity info
                                                    let quantity = 1;
                                                    if (cut.used_widths && Object.keys(cut.used_widths).length > 0) {
                                                      // Find the quantity for this width in used_widths
                                                      for (const [widthKey, qty] of Object.entries(cut.used_widths)) {
                                                        if (Math.abs(parseFloat(widthKey) - cutWidth) < 0.1) {
                                                          quantity = qty;
                                                          break;
                                                        }
                                                      }
                                                    }
                                                    
                                                    // Create individual sections for each quantity
                                                    for (let i = 0; i < quantity; i++) {
                                                      const widthPercentage = (cutWidth / targetWidth) * 100;
                                                      const leftPosition = (currentPosition / targetWidth) * 100;
                                                      currentPosition += cutWidth;
                                                      
                                                      sections.push(
                                                        <div
                                                          key={`${cutIndex}-${i}`}
                                                          className={`absolute h-full border-r-2 border-white ${
                                                            cut.uses_existing
                                                              ? "bg-gradient-to-r from-green-400 to-green-500"
                                                              : "bg-gradient-to-r from-blue-400 to-blue-500"
                                                          }`}
                                                          style={{
                                                            left: `${leftPosition}%`,
                                                            width: `${widthPercentage}%`,
                                                          }}>
                                                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                                            {cutWidth}"
                                                            {cut.uses_existing && i === 0 && (
                                                              <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full text-xs px-1 py-0.5 text-[10px] font-bold shadow-lg">
                                                                P
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      );
                                                    }
                                                    
                                                    return sections;
                                                  }).flat()}
                                                  
                                                  {/* Waste section */}
                                                  {totalWaste > 0 && (
                                                    <div
                                                      className="absolute h-full bg-gradient-to-r from-red-400 to-red-500 border-l-2 border-white"
                                                      style={{
                                                        right: "0%",
                                                        width: `${wastePercentage}%`,
                                                      }}>
                                                      <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                                        Waste: {totalWaste.toFixed(1)}"
                                                      </div>
                                                    </div>
                                                  )}
                                                  
                                                  {/* Target width indicator */}
                                                  <div className="absolute -bottom-6 left-0 right-0 text-center">
                                                    <div className="text-xs text-muted-foreground font-mono">
                                                      Total: {targetWidth}" target width
                                                    </div>
                                                  </div>
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                        
                                        {/* Individual cuts in this 118" roll */}
                                        <div className="space-y-2">
                                          {rollSet.cuts?.map((cut, cutIndex) => (
                                            <div key={cut.cut_id} className={`p-2 rounded border text-sm ${
                                              cut.uses_existing 
                                                ? 'bg-green-50 border-green-200' 
                                                : 'bg-orange-50 border-orange-200'
                                            }`}>
                                              <div className="flex items-center justify-between">
                                                <div className="font-medium">
                                                  Cut #{cutIndex + 1}: {cut.width_inches}" ({cut.uses_existing ? 'From Pending' : 'Manual'})
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {cut.description}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                          
                                          {/* Manual Cut Addition Button */}
                                          {rollSet.manual_addition_available && rollSet.summary.total_waste > 20 ? (
                                            <div className="p-2 rounded border-2 border-dashed border-green-300 bg-green-50">
                                              <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="w-full gap-2 text-xs border-green-300 text-green-700 hover:bg-green-100"
                                                onClick={() => handleAddManualCut(orderSuggestion.suggestion_id, jumboRoll.jumbo_id, rollSet.set_id)}
                                              >
                                                <Plus className="w-3 h-3" />
                                                Add Manual Cut to 118" Set #{rollSet.set_number}
                                              </Button>
                                              <div className="text-xs text-green-600 text-center mt-1">
                                                {rollSet.summary.total_waste.toFixed(1)}" waste available for manual cut
                                              </div>
                                            </div>
                                          ) : rollSet.summary.total_waste <= 20 ? (
                                            <div className="p-2 rounded border-2 border-dashed border-gray-300 bg-gray-50">
                                              <div className="text-xs text-gray-500 text-center py-2">
                                                Manual cuts only available when waste is greater than 20"
                                                <br />
                                                Current waste: {rollSet.summary.total_waste.toFixed(1)}"
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Order Summary */}
                            <div className="pt-3 border-t border-blue-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div>
                                  <div className="text-lg font-bold text-purple-600">{orderSuggestion.summary.total_jumbo_rolls}</div>
                                  <div className="text-xs text-purple-800">Jumbo Rolls</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-blue-600">{orderSuggestion.summary.total_118_sets}</div>
                                  <div className="text-xs text-blue-800">118" Sets</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-green-600">{orderSuggestion.summary.using_existing_cuts}</div>
                                  <div className="text-xs text-green-800">Existing Cuts</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-orange-600">{orderSuggestion.summary.total_cuts}</div>
                                  <div className="text-xs text-orange-800">Total Cuts</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : suggestionResult.jumbo_suggestions && suggestionResult.jumbo_suggestions.length > 0 ? (
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
                      {suggestionResult.jumbo_suggestions?.map((jumbo) => (
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
                              {jumbo.rolls?.map((roll, rollIndex) => (
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
                                        {roll.widths?.map((width, idx) => (
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
                        {uniqueClients?.map((client : any) => (
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
                        {uniqueGSMs?.map(gsm => (
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
                        {uniqueBFs?.map(bf => (
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
                        {uniqueShades?.map(shade => (
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
                        {uniqueWidths?.map(width => (
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
                        {uniqueStatuses?.map(status => (
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
                        {uniqueReasons?.map(reason => (
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
                  {filteredItems?.map((item, index) => {
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