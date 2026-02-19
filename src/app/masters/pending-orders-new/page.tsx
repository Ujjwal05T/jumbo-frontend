/**
 * Pending Order Items page - Manage pending order items
 */
"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { cancelPendingOrderItem } from "@/lib/pending-orders";
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
  SelectSearch,
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
  Plus,
  Trash2,
  Loader2,
  Pencil,
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

declare global {
  interface Window {
    tempWastageData: any;
  }
}

interface JumboRollSuggestion {
  sets:any
  suggestion_id: string;
  paper_specs: {
    gsm: number;
    bf: number;
    shade: string;
  };
  jumbo_id?: string;
  jumbo_rolls?: any;
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
    total_cuts?: number;
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

// ============================================================
// EDITABLE PLAN TYPES
// ============================================================

interface EditableCutRoll {
  id: string;
  width: number;
  quantity: number;
  clientName: string;
  clientId?: string;
  source: 'algorithm' | 'manual';
  order_id?: string;
  order_frontend_id?: string;
  source_pending_id?: string;
  gsm?: number;
  bf?: number;
  shade?: string;
}

interface EditableRollSet {
  id: string;
  setNumber: number;
  cuts: EditableCutRoll[];
}

interface EditableJumbo {
  id: string;
  jumboNumber: number;
  sets: EditableRollSet[];
}

interface EditablePaperSpec {
  id: string;
  specId: string; // original spec_id from backend
  gsm: number;
  bf: number;
  shade: string;
  jumbos: EditableJumbo[];
}

interface EditablePlanState {
  targetWidth: number;
  wastage: number;
  paperSpecs: EditablePaperSpec[];
  orphanedRolls: EditableCutRoll[];
  isModified: boolean;
}

// ── helpers ──────────────────────────────────────────────────

function _genId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function _setTotalWidth(set: EditableRollSet) {
  return set.cuts.reduce((s, c) => s + c.width * c.quantity, 0);
}

function transformSuggestionsToEditablePlan(
  suggestionResult: SuggestionResult,
): EditablePlanState | null {
  if (!suggestionResult.spec_suggestions?.length) return null;

  const paperSpecs: EditablePaperSpec[] = [];

  for (const spec of suggestionResult.spec_suggestions) {
    const jumbos: EditableJumbo[] = [];

    for (const jumbo of (spec.jumbo_rolls ?? [])) {
      const sets: EditableRollSet[] = [];

      for (const rollSet of (jumbo.sets ?? [])) {
        const cuts: EditableCutRoll[] = [];

        for (const cut of (rollSet.cuts ?? [])) {
          if (!cut.uses_existing || !cut.width_inches) continue;

          // Expand quantity into individual cut entries
          const qty = cut.used_widths
            ? (() => {
                const w = cut.width_inches;
                const key = Object.keys(cut.used_widths).find(k => parseFloat(k) === w);
                return key ? (cut.used_widths[key] as number) : 1;
              })()
            : 1;

          cuts.push({
            id: `cut-${_genId()}`,
            width: cut.width_inches,
            quantity: qty,
            clientName: cut.client_name || '',
            clientId: cut.client_id,
            source: 'algorithm',
            order_id: cut.order_id,
            order_frontend_id: cut.order_frontend_id,
            source_pending_id: cut.item_id || cut.source_pending_id,
            gsm: spec.paper_spec.gsm,
            bf: spec.paper_spec.bf,
            shade: spec.paper_spec.shade,
          });

          // Handle manual cuts inside suggestions
          if (cut.is_manual_cut) {
            cuts[cuts.length - 1].source = 'manual';
            cuts[cuts.length - 1].source_pending_id = undefined;
            cuts[cuts.length - 1].clientId = cut.client_id;
          }
        }

        sets.push({ id: `set-${_genId()}`, setNumber: rollSet.set_number ?? sets.length + 1, cuts });
      }

      jumbos.push({ id: `jumbo-${_genId()}`, jumboNumber: jumbo.jumbo_number ?? jumbos.length + 1, sets });
    }

    paperSpecs.push({
      id: `spec-${_genId()}`,
      specId: spec.spec_id,
      gsm: spec.paper_spec.gsm,
      bf: spec.paper_spec.bf,
      shade: spec.paper_spec.shade,
      jumbos,
    });
  }

  return {
    targetWidth: suggestionResult.target_width,
    wastage: suggestionResult.wastage,
    paperSpecs,
    orphanedRolls: [],
    isModified: false,
  };
}

// ── CuttingPatternVisual ──────────────────────────────────────

function CuttingPatternVisual({ cuts, targetWidth }: { cuts: EditableCutRoll[]; targetWidth: number }) {
  const totalUsed = cuts.reduce((s, c) => s + c.width * c.quantity, 0);
  const waste = Math.max(0, targetWidth - totalUsed);

  const segments: { key: string; pct: number; label: string; color: string; isWaste: boolean }[] = [];
  let colorIdx = 0;

  for (const cut of cuts) {
    for (let i = 0; i < cut.quantity; i++) {
      const pct = (cut.width / targetWidth) * 100;
      segments.push({
        key: `${cut.id}-${i}`,
        pct,
        label: `${cut.width}"`,
        color: 'bg-green-500',
        isWaste: false,
      });
    }
    colorIdx++;
  }

  if (waste > 0) {
    segments.push({ key: 'waste', pct: (waste / targetWidth) * 100, label: `${waste.toFixed(1)}"`, color: 'bg-gray-300', isWaste: true });
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex h-11 rounded-lg overflow-hidden border text-[10px] font-medium">
        {segments.map(s => (
          <div
            key={s.key}
            className={`${s.color} border-x-1 flex items-center justify-center overflow-hidden  shrink-0 ${s.isWaste ? 'text-gray-500 italic' : 'text-white'}`}
            style={{ width: `${s.pct}%` }}
            title={s.isWaste ? `Waste: ${s.label}` : s.label}
          >
            {s.pct > 6 ? s.label : ''}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Used: {totalUsed.toFixed(1)}"</span>
        <span className={waste > 5 ? 'text-amber-600 font-medium' : ''}>{waste > 0 ? `Waste: ${waste.toFixed(1)}"` : 'No waste'}</span>
      </div>
    </div>
  );
}

// ============================================================

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
  // Granular selection: tracks spec_id, jumbo_id, and set_id combinations
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set()); // Format: "spec_id|jumbo_id|set_id"
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

  // Client suggestions state
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
  const [clientSuggestionsLoading, setClientSuggestionsLoading] = useState(false);

  const [modifiedSuggestions, setModifiedSuggestions] = useState<Map<string, any>>(new Map());
  const [clients, setClients] = useState<any[]>([]);
  
  // Edit manual cut state
  const [editManualCutDialog, setEditManualCutDialog] = useState<{
    isOpen: boolean;
    cut: any | null;
    suggestionId: string;
    jumboId: string;
    setId: string;
  }>({
    isOpen: false,
    cut: null,
    suggestionId: '',
    jumboId: '',
    setId: ''
  });

  // Filter states
  const [clientFilter, setClientFilter] = useState<string>("");
  const [gsmFilter, setGsmFilter] = useState<string>("");
  const [bfFilter, setBfFilter] = useState<string>("");
  const [shadeFilter, setShadeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reasonFilter, setReasonFilter] = useState<string>("");
  const [widthFilter, setWidthFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // ── Editable plan state (hybrid-style editing) ──
  const [editablePlan, setEditablePlan] = useState<EditablePlanState | null>(null);
  const [showAddCutDialog, setShowAddCutDialog] = useState(false);
  const [showEditCutDialog, setShowEditCutDialog] = useState(false);
  const [cutRollForm, setCutRollForm] = useState({ width: '', quantity: '1', clientId: '' });
  const [editingCut, setEditingCut] = useState<EditableCutRoll | null>(null);
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [currentPaperSpec, setCurrentPaperSpec] = useState<{ gsm: number; bf: number; shade: string } | null>(null);
  const [showOrphanConfirmDialog, setShowOrphanConfirmDialog] = useState(false);

  // Delete confirmation dialog state
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    item: PendingOrderItem | null;
  }>({
    isOpen: false,
    item: null
  });
  const [deletingItem, setDeletingItem] = useState<boolean>(false);

  // Collapse/expand state for suggestions
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set());

  // Toggle collapse/expand for a suggestion
  const toggleSuggestionExpand = (suggestionId: string) => {
    setExpandedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suggestionId)) {
        newSet.delete(suggestionId);
      } else {
        newSet.add(suggestionId);
      }
      return newSet;
    });
  };

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

  // Handle delete pending order item
  const handleDeletePendingItem = async () => {
    if (!deleteConfirmDialog.item) return;

    setDeletingItem(true);
    try {
      // Get current user ID from localStorage or context
      const currentUserId = localStorage.getItem('userId') || 'system'; // You may need to adjust this based on your auth system

      await cancelPendingOrderItem(deleteConfirmDialog.item.id, currentUserId);

      // Remove the item from the local state
      setPendingItems(prevItems =>
        prevItems.filter(item => item.id !== deleteConfirmDialog.item?.id)
      );

      toast.success(`Pending order item ${deleteConfirmDialog.item.frontend_id} has been cancelled successfully`);

      // Close the dialog
      setDeleteConfirmDialog({ isOpen: false, item: null });
    } catch (error) {
      console.error('Error cancelling pending order item:', error);
      toast.error(`Failed to cancel pending order item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingItem(false);
    }
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

      // Generate idempotency key to prevent duplicate suggestions on network retry
      const userId = localStorage.getItem('user_id') || 'unknown';
      const idempotencyKey = `suggestions-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      console.log('🔑 Generated idempotency key for suggestions:', idempotencyKey);

      // Get the request options and add idempotency header
      const requestOptions = createRequestOptions('POST', { wastage });
      requestOptions.headers = {
        ...requestOptions.headers,
        'X-Idempotency-Key': idempotencyKey
      };

      const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/roll-suggestions`,
        requestOptions
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Failed to get suggestions: ${response.status}`;
        throw new Error(errorMessage);
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
        // Build editable plan from suggestions
        const ep = transformSuggestionsToEditablePlan(processedResult);
        setEditablePlan(ep);
        if (ep) {
          // Auto-select all sets
          const allSetIds = new Set<string>();
          ep.paperSpecs.forEach(spec => spec.jumbos.forEach(j => j.sets.forEach(s => allSetIds.add(s.id))));
          setSelectedSets(allSetIds);
        }

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
  pdf.text(`Target Width: ${suggestionResult.target_width}" (124"- ${suggestionResult.wastage}" wastage)`, margin, yPosition);
  
  yPosition += 10;
  pdf.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, margin, yPosition);
  
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
        // Select all sets from all jumbo rolls from all specs
        const allSetKeys = new Set<string>();
        suggestionResult.spec_suggestions.forEach(spec => {
          spec.jumbo_rolls?.forEach(jumbo => {
            jumbo.sets?.forEach((set:any) => {
              allSetKeys.add(`${spec.spec_id}|${jumbo.jumbo_id}|${set.set_id}`);
            });
          });
        });
        setSelectedSets(allSetKeys);
      } else if (suggestionResult?.order_suggestions) {
        setSelectedSuggestions(new Set(suggestionResult.order_suggestions?.map(s => s.suggestion_id)));
      } else if (suggestionResult?.jumbo_suggestions) {
        setSelectedSuggestions(new Set(suggestionResult.jumbo_suggestions?.map(s => s.suggestion_id)));
      }
    } else {
      setSelectedSets(new Set());
      setSelectedSuggestions(new Set());
    }
  };

  // Manual cut addition functions
  const fetchClientSuggestions = async (availableWaste: number, paperSpecs: any) => {
    if (!availableWaste || availableWaste < 10) {
      setClientSuggestions([]);
      return;
    }

    try {
      setClientSuggestionsLoading(true);
      const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/client-suggestions`,
        createRequestOptions('POST', {
          available_waste: availableWaste,
          paper_specs: paperSpecs
        })
      );

      if (!response.ok) {
        throw new Error(`Failed to get client suggestions: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'success') {
        setClientSuggestions(result.suggestions || []);
        if (result.suggestions.length > 0) {
          toast.info(`Found ${result.summary.total_clients} client suggestions based on recent orders`);
        }
      } else {
        setClientSuggestions([]);
        if (result.message) {
          toast.info(result.message);
        }
      }
    } catch (error) {
      console.error('Error fetching client suggestions:', error);
      setClientSuggestions([]);
      // Don't show error toast for suggestions, it's not critical
    } finally {
      setClientSuggestionsLoading(false);
    }
  };

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

    const jumboRoll = suggestion?.jumbo_rolls?.find((jr:any) => jr.jumbo_id === jumboId);
    const rollSet = jumboRoll?.sets?.find((s:any) => s.set_id === setId);
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

    // Fetch client suggestions for this waste space
    fetchClientSuggestions(availableWaste, paperSpecs);
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
                updatedJumboRoll.sets = jumboRoll.sets?.map((rollSet:any) => {
                  if (rollSet.set_id === manualRollData.setId) {
                    const updatedRollSet = { ...rollSet };
                    updatedRollSet.cuts = [...(rollSet.cuts || []), manualCut];

                    // Update summary - Account for used_widths quantities
                    const totalActualWidth = updatedRollSet.cuts.reduce((sum:any, c:any) => {
                      if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                        return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]:[any, any]) =>
                          widthSum + (parseFloat(width) * qty), 0);
                      }
                      return sum + c.width_inches;
                    }, 0);

                    updatedRollSet.summary = {
                      ...updatedRollSet.summary,
                      total_cuts: updatedRollSet.cuts.reduce((sum:any, c:any) => {
                        if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                          return sum + Object.values(c.used_widths).reduce((a:any, b:any) => a + b, 0);
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
                  (sum:any, set:any) => sum + (set.summary?.total_cuts || 0), 0
                ) || 0;
                
                const totalWaste = updatedJumboRoll.sets?.reduce(
                  (sum:any, set:any) => sum + (set.summary?.total_waste || 0), 0
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
          order_suggestions: specSuggestion.order_suggestions?.map((suggestion:any) => {
            if (suggestion.suggestion_id === manualRollData.suggestionId) {
              const updatedSuggestion = { ...suggestion };
              updatedSuggestion.jumbo_rolls = suggestion.jumbo_rolls?.map((jumboRoll:any) => {
                if (jumboRoll.jumbo_id === manualRollData.jumboId) {
                  const updatedJumboRoll = { ...jumboRoll };
                  updatedJumboRoll.sets = jumboRoll.sets?.map((rollSet:any) => {
                    if (rollSet.set_id === manualRollData.setId) {
                      const updatedRollSet = { ...rollSet };
                      updatedRollSet.cuts = [...(rollSet.cuts || []), manualCut];
  
                      // Update summary - Account for used_widths quantities
                      const totalActualWidth = updatedRollSet.cuts.reduce((sum:any, c:any) => {
                        if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                          return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]:[width:any,qty:any]) =>
                            widthSum + (parseFloat(width) * qty), 0);
                        }
                        return sum + c.width_inches;
                      }, 0);
  
                      updatedRollSet.summary = {
                        ...updatedRollSet.summary,
                        total_cuts: updatedRollSet.cuts.reduce((sum:any, c:any) => {
                          if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                            return sum + Object.values(c.used_widths).reduce((a:any, b:any) => a + b, 0);
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
    setClientSuggestions([]);
    toast.success('Manual cut added successfully');
  };

  // Handler to open edit dialog for manual cuts
  const handleEditManualCut = (suggestionId: string, jumboId: string, setId: string, cut: any) => {
    // Find the suggestion and available waste
    let suggestion, paperSpecs;

    if (suggestionResult?.spec_suggestions) {
      const specSuggestion = suggestionResult.spec_suggestions.find(s => s.spec_id === suggestionId);
      if (specSuggestion) {
        paperSpecs = specSuggestion.paper_spec;
        suggestion = specSuggestion;
      } else {
        for (const specSuggestion of suggestionResult.spec_suggestions) {
          suggestion = specSuggestion.order_suggestions?.find(s => s.suggestion_id === suggestionId);
          if (suggestion) {
            paperSpecs = specSuggestion.paper_spec;
            break;
          }
        }
      }
    } else if (suggestionResult?.order_suggestions) {
      suggestion = suggestionResult.order_suggestions?.find(s => s.suggestion_id === suggestionId);
      paperSpecs = suggestion?.paper_spec;
    }

    const jumboRoll = suggestion?.jumbo_rolls?.find((jr: any) => jr.jumbo_id === jumboId);
    const rollSet = jumboRoll?.sets?.find((s: any) => s.set_id === setId);
    
    // Calculate available waste including current cut's width
    const currentAvailableWaste = rollSet?.summary?.total_waste || 0;
    const totalAvailableWaste = currentAvailableWaste + cut.width_inches;

    setEditManualCutDialog({
      isOpen: true,
      cut: cut,
      suggestionId,
      jumboId,
      setId
    });

    setManualRollData({
      suggestionId,
      jumboId,
      setId,
      width: cut.width_inches.toString(),
      description: cut.description || 'Manual Cut',
      availableWaste: totalAvailableWaste,
      selectedClient: cut.client_id || '',
      paperSpecs: paperSpecs || { gsm: 0, bf: 0, shade: '' }
    });
  };

  // Handler to save edited manual cut
  const handleSaveEditedManualCut = () => {
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

    const selectedClient = clients?.find(client => client.id === manualRollData.selectedClient);

    // Update the cut in the suggestion result
    if (suggestionResult?.spec_suggestions) {
      const updatedSpecSuggestions = suggestionResult.spec_suggestions.map(specSuggestion => {
        if (specSuggestion.spec_id === manualRollData.suggestionId) {
          const updatedSpecSuggestion = { ...specSuggestion };
          
          if (updatedSpecSuggestion.jumbo_rolls) {
            updatedSpecSuggestion.jumbo_rolls = updatedSpecSuggestion.jumbo_rolls.map(jumboRoll => {
              if (jumboRoll.jumbo_id === manualRollData.jumboId) {
                const updatedJumboRoll = { ...jumboRoll };
                updatedJumboRoll.sets = jumboRoll.sets?.map((rollSet: any) => {
                  if (rollSet.set_id === manualRollData.setId) {
                    const updatedRollSet = { ...rollSet };
                    
                    // Find and update the specific cut
                    updatedRollSet.cuts = rollSet.cuts?.map((c: any) => {
                      if (c.cut_id === editManualCutDialog.cut.cut_id) {
                        return {
                          ...c,
                          width_inches: width,
                          description: `${manualRollData.description}: ${width}"`,
                          client_id: manualRollData.selectedClient,
                          client_name: selectedClient?.company_name || 'Unknown',
                          paper_specs: {
                            gsm: manualRollData.paperSpecs.gsm,
                            bf: manualRollData.paperSpecs.bf,
                            shade: manualRollData.paperSpecs.shade
                          }
                        };
                      }
                      return c;
                    });

                    // Recalculate summary
                    const totalActualWidth = updatedRollSet.cuts.reduce((sum: any, c: any) => {
                      if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                        return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]: [any, any]) =>
                          widthSum + (parseFloat(width) * qty), 0);
                      }
                      return sum + c.width_inches;
                    }, 0);

                    updatedRollSet.summary = {
                      ...updatedRollSet.summary,
                      total_actual_width: totalActualWidth,
                      total_waste: rollSet.target_width - totalActualWidth,
                      efficiency: Math.round((totalActualWidth / rollSet.target_width) * 100)
                    };

                    return updatedRollSet;
                  }
                  return rollSet;
                });
                
                return updatedJumboRoll;
              }
              return jumboRoll;
            });
          }
          
          return updatedSpecSuggestion;
        }
        
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
                      
                      updatedRollSet.cuts = rollSet.cuts?.map((c: any) => {
                        if (c.cut_id === editManualCutDialog.cut.cut_id) {
                          return {
                            ...c,
                            width_inches: width,
                            description: `${manualRollData.description}: ${width}"`,
                            client_id: manualRollData.selectedClient,
                            client_name: selectedClient?.company_name || 'Unknown'
                          };
                        }
                        return c;
                      });

                      const totalActualWidth = updatedRollSet.cuts.reduce((sum: any, c: any) => {
                        if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                          return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]:[width:any,qty:any]) =>
                            widthSum + (parseFloat(width) * qty), 0);
                        }
                        return sum + c.width_inches;
                      }, 0);

                      updatedRollSet.summary = {
                        ...updatedRollSet.summary,
                        total_actual_width: totalActualWidth,
                        total_waste: rollSet.target_width - totalActualWidth,
                        efficiency: Math.round((totalActualWidth / rollSet.target_width) * 100)
                      };

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
                  
                  updatedRollSet.cuts = rollSet.cuts?.map((c: any) => {
                    if (c.cut_id === editManualCutDialog.cut.cut_id) {
                      return {
                        ...c,
                        width_inches: width,
                        description: `${manualRollData.description}: ${width}"`,
                        client_id: manualRollData.selectedClient,
                        client_name: selectedClient?.company_name || 'Unknown'
                      };
                    }
                    return c;
                  });

                  const totalActualWidth = updatedRollSet.cuts.reduce((sum, c) => {
                    if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                      return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]) =>
                        widthSum + (parseFloat(width) * qty), 0);
                    }
                    return sum + c.width_inches;
                  }, 0);

                  updatedRollSet.summary = {
                    ...updatedRollSet.summary,
                    total_actual_width: totalActualWidth,
                    total_waste: rollSet.target_width - totalActualWidth,
                    efficiency: Math.round((totalActualWidth / rollSet.target_width) * 100)
                  };

                  return updatedRollSet;
                }
                return rollSet;
              });
              
              updatedJumboRoll.summary = {
                ...updatedJumboRoll.summary,
                total_actual_width: updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.total_actual_width, 0),
                total_waste: updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.total_waste, 0),
                efficiency: Math.round((updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.total_actual_width, 0) / (jumboRoll.target_width * updatedJumboRoll.sets.length)) * 100)
              };
              
              return updatedJumboRoll;
            }
            return jumboRoll;
          });
          return updatedSuggestion;
        }
        return suggestion;
      });

      setSuggestionResult(prev => prev ? { ...prev, order_suggestions: updatedSuggestions } : null);
    }

    setEditManualCutDialog({ isOpen: false, cut: null, suggestionId: '', jumboId: '', setId: '' });
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
    toast.success('Manual cut updated successfully');
  };

  // Handler to delete manual cut
  const handleDeleteManualCut = (suggestionId: string, jumboId: string, setId: string, cutId: string) => {
    if (suggestionResult?.spec_suggestions) {
      const updatedSpecSuggestions = suggestionResult.spec_suggestions.map(specSuggestion => {
        if (specSuggestion.spec_id === suggestionId) {
          const updatedSpecSuggestion = { ...specSuggestion };
          
          if (updatedSpecSuggestion.jumbo_rolls) {
            updatedSpecSuggestion.jumbo_rolls = updatedSpecSuggestion.jumbo_rolls.map(jumboRoll => {
              if (jumboRoll.jumbo_id === jumboId) {
                const updatedJumboRoll = { ...jumboRoll };
                updatedJumboRoll.sets = jumboRoll.sets?.map((rollSet: any) => {
                  if (rollSet.set_id === setId) {
                    const updatedRollSet = { ...rollSet };
                    
                    // Remove the cut
                    updatedRollSet.cuts = rollSet.cuts?.filter((c: any) => c.cut_id !== cutId);

                    // Recalculate summary
                    const totalActualWidth = updatedRollSet.cuts.reduce((sum: any, c: any) => {
                      if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                        return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]: [any, any]) =>
                          widthSum + (parseFloat(width) * qty), 0);
                      }
                      return sum + c.width_inches;
                    }, 0);

                    updatedRollSet.summary = {
                      ...updatedRollSet.summary,
                      total_cuts: updatedRollSet.cuts.reduce((sum: any, c: any) => {
                        if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                          return sum + Object.values(c.used_widths).reduce((a: any, b: any) => a + b, 0);
                        }
                        return sum + 1;
                      }, 0),
                      total_actual_width: totalActualWidth,
                      total_waste: rollSet.target_width - totalActualWidth,
                      efficiency: Math.round((totalActualWidth / rollSet.target_width) * 100)
                    };
                    
                    // Re-enable manual addition if waste is sufficient
                    if (updatedRollSet.summary.total_waste >= 5) {
                      updatedRollSet.manual_addition_available = true;
                    }

                    return updatedRollSet;
                  }
                  return rollSet;
                });
                
                return updatedJumboRoll;
              }
              return jumboRoll;
            });
          }
          
          return updatedSpecSuggestion;
        }
        
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
                      
                      updatedRollSet.cuts = rollSet.cuts?.filter((c: any) => c.cut_id !== cutId);

                      const totalActualWidth = updatedRollSet.cuts.reduce((sum: any, c: any) => {
                        if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                          return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]:[width:any,qty:any]) =>
                            widthSum + (parseFloat(width) * qty), 0);
                        }
                        return sum + c.width_inches;
                      }, 0);

                      updatedRollSet.summary = {
                        ...updatedRollSet.summary,
                        total_cuts: updatedRollSet.cuts.reduce((sum: any, c: any) => {
                          if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                            return sum + Object.values(c.used_widths).reduce((a: any, b: any) => a + b, 0);
                          }
                          return sum + 1;
                        }, 0),
                        total_actual_width: totalActualWidth,
                        total_waste: rollSet.target_width - totalActualWidth,
                        efficiency: Math.round((totalActualWidth / rollSet.target_width) * 100)
                      };
                      
                      if (updatedRollSet.summary.total_waste >= 5) {
                        updatedRollSet.manual_addition_available = true;
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

      setSuggestionResult(prev => prev ? { ...prev, spec_suggestions: updatedSpecSuggestions } : null);
    } else if (suggestionResult?.order_suggestions) {
      const updatedSuggestions = suggestionResult.order_suggestions?.map(suggestion => {
        if (suggestion.suggestion_id === suggestionId) {
          const updatedSuggestion = { ...suggestion };
          updatedSuggestion.jumbo_rolls = suggestion.jumbo_rolls?.map(jumboRoll => {
            if (jumboRoll.jumbo_id === jumboId) {
              const updatedJumboRoll = { ...jumboRoll };
              updatedJumboRoll.sets = jumboRoll.sets?.map(rollSet => {
                if (rollSet.set_id === setId) {
                  const updatedRollSet = { ...rollSet };
                  
                  updatedRollSet.cuts = rollSet.cuts?.filter((c: any) => c.cut_id !== cutId);

                  const totalActualWidth = updatedRollSet.cuts.reduce((sum, c) => {
                    if (c.used_widths && Object.keys(c.used_widths).length > 0) {
                      return sum + Object.entries(c.used_widths).reduce((widthSum, [width, qty]) =>
                        widthSum + (parseFloat(width) * qty), 0);
                    }
                    return sum + c.width_inches;
                  }, 0);

                  updatedRollSet.summary = {
                    ...updatedRollSet.summary,
                    total_cuts: updatedRollSet.cuts.length,
                    total_actual_width: totalActualWidth,
                    total_waste: rollSet.target_width - totalActualWidth,
                    efficiency: Math.round((totalActualWidth / rollSet.target_width) * 100)
                  };

                  return updatedRollSet;
                }
                return rollSet;
              });
              
              updatedJumboRoll.summary = {
                ...updatedJumboRoll.summary,
                total_cuts: updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.total_cuts, 0),
                total_actual_width: updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.total_actual_width, 0),
                total_waste: updatedJumboRoll.sets.reduce((sum, s) => sum + s.summary.total_waste, 0)
              };
              
              return updatedJumboRoll;
            }
            return jumboRoll;
          });
          return updatedSuggestion;
        }
        return suggestion;
      });

      setSuggestionResult(prev => prev ? { ...prev, order_suggestions: updatedSuggestions } : null);
    }

    toast.success('Manual cut removed successfully');
  };
  

  // ── Editable plan handlers ───────────────────────────────────────────────

  const handleDeleteCut = (cutId: string) => {
    if (!editablePlan) return;
    let foundCut: EditableCutRoll | null = null;
    outer: for (const spec of editablePlan.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        for (const set of jumbo.sets) {
          const c = set.cuts.find(c => c.id === cutId);
          if (c) { foundCut = c; break outer; }
        }
      }
    }
    if (!foundCut) return;
    const isAlgo = foundCut.source === 'algorithm';
    setEditablePlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        paperSpecs: prev.paperSpecs.map(spec => ({
          ...spec,
          jumbos: spec.jumbos.map(j => ({
            ...j,
            sets: j.sets.map(s => ({ ...s, cuts: s.cuts.filter(c => c.id !== cutId) })),
          })),
        })),
        orphanedRolls: isAlgo ? [...prev.orphanedRolls, foundCut!] : prev.orphanedRolls,
        isModified: true,
      };
    });
    toast.info(isAlgo ? 'Roll moved to orphaned panel' : 'Manual roll deleted');
  };

  const handleAddCut = (setId: string) => {
    if (!editablePlan) return;
    setCurrentSetId(setId);
    setCutRollForm({ width: '', quantity: '1', clientId: '' });
    for (const spec of editablePlan.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        if (jumbo.sets.some(s => s.id === setId)) {
          setCurrentPaperSpec({ gsm: spec.gsm, bf: spec.bf, shade: spec.shade });
          break;
        }
      }
    }
    setShowAddCutDialog(true);
  };

  const handleAssignOrphan = (orphanId: string) => {
    if (!editablePlan || !currentSetId) return;

    const orphan = editablePlan.orphanedRolls.find(c => c.id === orphanId);
    if (!orphan) return;

    let targetSet: EditableRollSet | null = null;
    for (const spec of editablePlan.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const s = jumbo.sets.find(s => s.id === currentSetId);
        if (s) { targetSet = s; break; }
      }
    }
    if (!targetSet) return;

    if (_setTotalWidth(targetSet) + orphan.width * orphan.quantity > editablePlan.targetWidth) {
      toast.error(`Cannot add: would exceed ${editablePlan.targetWidth}"`);
      return;
    }

    setEditablePlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        paperSpecs: prev.paperSpecs.map(spec => ({
          ...spec,
          jumbos: spec.jumbos.map(jumbo => ({
            ...jumbo,
            sets: jumbo.sets.map(set =>
              set.id === currentSetId ? { ...set, cuts: [...set.cuts, orphan] } : set
            ),
          })),
        })),
        orphanedRolls: prev.orphanedRolls.filter(c => c.id !== orphanId),
        isModified: true,
      };
    });

    setShowAddCutDialog(false);
    toast.success('Orphaned roll assigned to set');
  };

  const handleSaveNewCut = () => {
    if (!editablePlan || !currentSetId) return;
    const width = parseFloat(cutRollForm.width);
    const quantity = parseInt(cutRollForm.quantity);
    if (isNaN(width) || width <= 0) { toast.error('Enter a valid width'); return; }
    let targetSet: EditableRollSet | null = null;
    for (const spec of editablePlan.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const s = jumbo.sets.find(s => s.id === currentSetId);
        if (s) { targetSet = s; break; }
      }
    }
    if (!targetSet) return;
    if (_setTotalWidth(targetSet) + width * quantity > editablePlan.targetWidth) {
      toast.error(`Exceeds ${editablePlan.targetWidth}" limit`); return;
    }
    const client = clients.find(c => c.id === cutRollForm.clientId);
    const newCuts: EditableCutRoll[] = Array.from({ length: quantity }, (_, i) => ({
      id: `cut-${_genId()}-${i}`,
      width,
      quantity: 1,
      clientName: client?.company_name || '',
      clientId: cutRollForm.clientId || undefined,
      source: 'manual' as const,
      gsm: currentPaperSpec?.gsm,
      bf: currentPaperSpec?.bf,
      shade: currentPaperSpec?.shade,
    }));
    setEditablePlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        paperSpecs: prev.paperSpecs.map(spec => ({
          ...spec,
          jumbos: spec.jumbos.map(j => ({
            ...j,
            sets: j.sets.map(s => s.id === currentSetId ? { ...s, cuts: [...s.cuts, ...newCuts] } : s),
          })),
        })),
        isModified: true,
      };
    });
    setShowAddCutDialog(false);
    toast.success('Manual roll added');
  };

  const handleEditCut = (cutId: string) => {
    if (!editablePlan) return;
    for (const spec of editablePlan.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        for (const set of jumbo.sets) {
          const c = set.cuts.find(c => c.id === cutId);
          if (c) {
            if (c.source === 'algorithm') { toast.error('Algorithm rolls cannot be edited — only deleted.'); return; }
            setEditingCut(c);
            setCutRollForm({ width: c.width.toString(), quantity: c.quantity.toString(), clientId: c.clientId || '' });
            setShowEditCutDialog(true);
            return;
          }
        }
      }
    }
  };

  const handleSaveEditCut = () => {
    if (!editablePlan || !editingCut) return;
    const width = parseFloat(cutRollForm.width);
    const quantity = parseInt(cutRollForm.quantity);
    if (isNaN(width) || width <= 0) { toast.error('Enter a valid width'); return; }
    let targetSet: EditableRollSet | null = null;
    for (const spec of editablePlan.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const s = jumbo.sets.find(s => s.cuts.some(c => c.id === editingCut.id));
        if (s) { targetSet = s; break; }
      }
    }
    if (targetSet) {
      const otherWidth = targetSet.cuts.filter(c => c.id !== editingCut.id).reduce((s, c) => s + c.width * c.quantity, 0);
      if (otherWidth + width * quantity > editablePlan.targetWidth) {
        toast.error(`Exceeds ${editablePlan.targetWidth}" limit`); return;
      }
    }
    const client = clients.find(c => c.id === cutRollForm.clientId);
    setEditablePlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        paperSpecs: prev.paperSpecs.map(spec => ({
          ...spec,
          jumbos: spec.jumbos.map(j => ({
            ...j,
            sets: j.sets.map(s => ({
              ...s,
              cuts: s.cuts.map(c => c.id === editingCut.id
                ? { ...c, width, quantity, clientName: client?.company_name || c.clientName, clientId: cutRollForm.clientId || c.clientId }
                : c),
            })),
          })),
        })),
        isModified: true,
      };
    });
    setShowEditCutDialog(false);
    setEditingCut(null);
    toast.success('Roll updated');
  };

  const handleAddJumbo = (specId: string) => {
    if (!editablePlan) return;
    const newJumbo: EditableJumbo = {
      id: `jumbo-${_genId()}`,
      jumboNumber: 0, // set below
      sets: [
        { id: `set-${_genId()}-1`, setNumber: 1, cuts: [] },
        { id: `set-${_genId()}-2`, setNumber: 2, cuts: [] },
        { id: `set-${_genId()}-3`, setNumber: 3, cuts: [] },
      ],
    };
    setEditablePlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        paperSpecs: prev.paperSpecs.map(spec => {
          if (spec.id !== specId) return spec;
          const maxNum = Math.max(...spec.jumbos.map(j => j.jumboNumber), 0);
          return { ...spec, jumbos: [...spec.jumbos, { ...newJumbo, jumboNumber: maxNum + 1 }] };
        }),
        isModified: true,
      };
    });
    // Auto-select the new sets
    setSelectedSets(prev => {
      const next = new Set(prev);
      newJumbo.sets.forEach(s => next.add(s.id));
      return next;
    });
    toast.success('Jumbo roll added');
  };

  const handleReassignOrphan = (cutId: string, targetSetId: string) => {
    if (!editablePlan) return;
    const orphan = editablePlan.orphanedRolls.find(c => c.id === cutId);
    if (!orphan) return;
    let targetSet: EditableRollSet | null = null;
    for (const spec of editablePlan.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const s = jumbo.sets.find(s => s.id === targetSetId);
        if (s) { targetSet = s; break; }
      }
    }
    if (!targetSet) return;
    if (_setTotalWidth(targetSet) + orphan.width * orphan.quantity > editablePlan.targetWidth) {
      toast.error(`Cannot add: would exceed ${editablePlan.targetWidth}"`); return;
    }
    setEditablePlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        paperSpecs: prev.paperSpecs.map(spec => ({
          ...spec,
          jumbos: spec.jumbos.map(j => ({
            ...j,
            sets: j.sets.map(s => s.id === targetSetId ? { ...s, cuts: [...s.cuts, orphan] } : s),
          })),
        })),
        orphanedRolls: prev.orphanedRolls.filter(c => c.id !== cutId),
        isModified: true,
      };
    });
    toast.success('Roll reassigned to set');
  };

  // ── End editing handlers ─────────────────────────────────────────────────

  const handleStartProduction = async () => {
    if (!editablePlan || selectedSets.size === 0) {
      toast.error('Please select at least one set');
      return;
    }

    // Warn about orphaned rolls (they stay as pending items — not a blocker)
    if (editablePlan.orphanedRolls.length > 0) {
      setShowOrphanConfirmDialog(true);
      return;
    }

    await _doStartProduction();
  };

  const _doStartProduction = async () => {
    if (!editablePlan) return;

    try {
      setProductionLoading(true);
      setShowOrphanConfirmDialog(false);

      const userId = localStorage.getItem('user_id');
      if (!userId) { toast.error('User not authenticated'); return; }

      // ── Build selectedCutRolls from editablePlan ─────────────────────────
      const selectedCutRolls: any[] = [];
      let rollNumber = 1;

      for (const spec of editablePlan.paperSpecs) {
        for (const jumbo of spec.jumbos) {
          for (const set of jumbo.sets) {
            if (!selectedSets.has(set.id)) continue; // skip deselected sets

            for (const cut of set.cuts) {
              if (cut.source === 'algorithm') {
                // Pending order cut — needs source_pending_id
                if (!cut.source_pending_id) continue;
                for (let i = 0; i < cut.quantity; i++) {
                  selectedCutRolls.push({
                    paper_id: '',
                    width_inches: cut.width,
                    qr_code: `PENDING_CUT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${selectedCutRolls.length}`,
                    gsm: spec.gsm,
                    bf: spec.bf,
                    shade: spec.shade,
                    individual_roll_number: rollNumber,
                    trim_left: null,
                    source_type: 'pending_order',
                    source_pending_id: cut.source_pending_id,
                    order_id: cut.order_id,
                  });
                }
              } else {
                // Manual roll — no source_pending_id
                for (let i = 0; i < cut.quantity; i++) {
                  selectedCutRolls.push({
                    paper_id: '',
                    width_inches: cut.width,
                    qr_code: `MANUAL_CUT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${selectedCutRolls.length}`,
                    gsm: spec.gsm,
                    bf: spec.bf,
                    shade: spec.shade,
                    individual_roll_number: rollNumber,
                    trim_left: null,
                    source_type: 'manual_cut',
                    is_manual_cut: true,
                    manual_cut_client_id: cut.clientId,
                    manual_cut_client_name: cut.clientName,
                  });
                }
              }
            }
            rollNumber++;
          }
        }
      }

      if (selectedCutRolls.length === 0) {
        toast.error('No cut rolls in selected sets. Add rolls or select a different set.');
        setProductionLoading(false);
        return;
      }

      // Wastage per set = targetWidth - used width (backend handles inventory creation)
      const wastageData: any[] = [];
      for (const spec of editablePlan.paperSpecs) {
        for (const jumbo of spec.jumbos) {
          for (const set of jumbo.sets) {
            if (!selectedSets.has(set.id)) continue;
            const waste = editablePlan.targetWidth - _setTotalWidth(set);
            if (waste > 0) {
              wastageData.push({
                width_inches: waste,
                paper_id: '',
                gsm: spec.gsm,
                bf: spec.bf,
                shade: spec.shade,
                source_plan_id: '',
                individual_roll_number: 0,
                notes: `Waste from set ${set.setNumber}`,
                source_pending_id: set.id,
              });
            }
          }
        }
      }

      const requestData = {
        selected_cut_rolls: selectedCutRolls,
        all_available_cuts: [...selectedCutRolls],
        wastage_data: wastageData,
        added_rolls_data: {},
        created_by_id: userId,
        jumbo_roll_width: editablePlan.targetWidth,
      };

      // Generate idempotency key to prevent duplicate production start on network retry
      const productionUserId = requestData.created_by_id || 'unknown';
      const idempotencyKey = `production-${productionUserId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      console.log('🔑 Generated idempotency key for production:', idempotencyKey);

      // Get the request options and add idempotency header
      const requestOptions = createRequestOptions('POST', requestData);
      requestOptions.headers = {
        ...requestOptions.headers,
        'X-Idempotency-Key': idempotencyKey
      };

      const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS.replace('pending-order-items', 'pending-orders')}/start-production`,
        requestOptions
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Failed to start production: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      toast.success(`Production started! Created ${result.summary.inventory_created} inventory items`);

      // Reset all suggestion/edit state
      setSelectedSuggestions(new Set());
      setSelectedSets(new Set());
      setShowSuggestions(false);
      setSuggestionResult(null);
      setEditablePlan(null);
      
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
    pdf.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}`, margin, yPosition);
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
                Enter the wastage amount to subtract from 124 inches. The system will create suggestions using unlimited pieces per roll to minimize waste.
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
                  Target width: {124 - parseFloat(wastageInput)}" (124 - {wastageInput})
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

        {/* ── Add Roll to Set Dialog ── */}
        <Dialog open={showAddCutDialog} onOpenChange={setShowAddCutDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Roll to Set</DialogTitle>
              <DialogDescription>
                {currentPaperSpec && `${currentPaperSpec.shade} ${currentPaperSpec.gsm}GSM — target width ${editablePlan?.targetWidth}"`}
              </DialogDescription>
            </DialogHeader>

            {/* ── Orphaned rolls section (same paper spec only) ── */}
            {editablePlan && currentPaperSpec && (() => {
              const matchingOrphans = editablePlan.orphanedRolls.filter(o =>
                o.gsm === currentPaperSpec.gsm &&
                o.bf === currentPaperSpec.bf &&
                o.shade === currentPaperSpec.shade
              );
              if (matchingOrphans.length === 0) return null;
              return (
                <div className="space-y-2">
                  <Label className="text-orange-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Assign Orphaned Roll
                    <span className="text-xs font-normal text-muted-foreground">
                      ({currentPaperSpec.gsm}gsm / {currentPaperSpec.bf}bf / {currentPaperSpec.shade})
                    </span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg bg-orange-50">
                    {matchingOrphans.map(orphan => (
                      <Button
                        key={orphan.id}
                        variant="outline"
                        size="sm"
                        className="justify-start h-auto py-2 px-3"
                        onClick={() => handleAssignOrphan(orphan.id)}
                      >
                        <div className="text-left">
                          <div className="font-medium">
                            {orphan.width}"{orphan.quantity > 1 && ` ×${orphan.quantity}`}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {orphan.clientName || 'No client'}
                            {orphan.source_pending_id && ' (P)'}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                  <div className="text-center text-sm text-muted-foreground py-1">— or create new —</div>
                </div>
              );
            })()}

            {/* ── Manual roll form ── */}
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="add-width">Width (inches)</Label>
                  <Input
                    id="add-width"
                    type="number"
                    step="0.5"
                    placeholder="e.g. 40"
                    value={cutRollForm.width}
                    onChange={e => setCutRollForm(f => ({ ...f, width: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="add-qty">Quantity</Label>
                  <Input
                    id="add-qty"
                    type="number"
                    min="1"
                    value={cutRollForm.quantity}
                    onChange={e => setCutRollForm(f => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="add-client">Client (optional)</Label>
                <Select value={cutRollForm.clientId} onValueChange={v => setCutRollForm(f => ({ ...f, clientId: v }))}>
                  <SelectTrigger id="add-client">
                    <SelectValue placeholder="Select client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.sort((a, b) => a.company_name.localeCompare(b.company_name)).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddCutDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveNewCut}>Add Roll</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Edit Manual Roll Dialog ── */}
        <Dialog open={showEditCutDialog} onOpenChange={setShowEditCutDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Manual Roll</DialogTitle>
              <DialogDescription>Modify width, quantity, or client</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-width">Width (inches)</Label>
                  <Input
                    id="edit-width"
                    type="number"
                    step="0.5"
                    value={cutRollForm.width}
                    onChange={e => setCutRollForm(f => ({ ...f, width: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-qty">Quantity</Label>
                  <Input
                    id="edit-qty"
                    type="number"
                    min="1"
                    value={cutRollForm.quantity}
                    onChange={e => setCutRollForm(f => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-client">Client</Label>
                <Select value={cutRollForm.clientId} onValueChange={v => setCutRollForm(f => ({ ...f, clientId: v }))}>
                  <SelectTrigger id="edit-client">
                    <SelectValue placeholder="Select client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.sort((a, b) => a.company_name.localeCompare(b.company_name)).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEditCutDialog(false); setEditingCut(null); }}>Cancel</Button>
              <Button onClick={handleSaveEditCut}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Orphaned rolls confirm dialog ── */}
        <Dialog open={showOrphanConfirmDialog} onOpenChange={setShowOrphanConfirmDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Orphaned Rolls
              </DialogTitle>
              <DialogDescription>
                You have {editablePlan?.orphanedRolls.length} orphaned roll(s) that will remain as pending items (not included in production). Continue?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOrphanConfirmDialog(false)}>Go Back</Button>
              <Button onClick={_doStartProduction} disabled={productionLoading}>
                {productionLoading ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Starting...</> : 'Continue Anyway'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Cut Addition Dialog */}
        <Dialog open={showManualRollDialog} onOpenChange={setShowManualRollDialog}>
          <DialogContent className="sm:max-w-3xl w-full">
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
                    {/* Combine original clients with suggested clients */}
                    {(() => {
                      const allClients = [...(clients || [])];
                      const existingIds = new Set(allClients.map(c => c.id.toLowerCase()));

                      // Add suggested clients that aren't already in the array
                      clientSuggestions.forEach(suggestion => {
                        if (!existingIds.has(suggestion.client_id.toLowerCase())) {
                          allClients.push({
                            id: suggestion.client_id,
                            company_name: suggestion.client_name
                          });
                        }
                      });

                      return allClients
                        .sort((a, b) => a.company_name.localeCompare(b.company_name))
                        .map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.company_name}
                          </SelectItem>
                        ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground space-y-3">
                <div className="grid grid-cols-2 gap-3">
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
              </div>
              {manualRollData.width && !isNaN(parseFloat(manualRollData.width)) && (
                <div className="text-sm text-muted-foreground text-center">
                  {parseFloat(manualRollData.width) > manualRollData.availableWaste && (
                    <div className="text-red-500 text-xs mt-1">
                      ⚠️ Width exceeds available waste space
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Client Suggestions Section */}
            {clientSuggestionsLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Finding client suggestions...</span>
              </div>
            ) : clientSuggestions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <Target className="h-4 w-4" />
                  Suggested Clients (based on AI)
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2">
                  {clientSuggestions.map((suggestion) => (
                    <div key={suggestion.client_id} className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="font-medium text-sm">{suggestion.client_name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            console.log('🔍 Selecting client:', suggestion.client_id, suggestion.client_name);
                            setManualRollData(prev => {
                              const newData = { ...prev, selectedClient: suggestion.client_id.toLowerCase() };
                              console.log('🔍 Updated manualRollData:', newData);
                              return newData;
                            });
                          }}
                        >
                          Select
                        </Button>
                      </div>
                      <div className="ml-4 space-y-1">
                        {suggestion.suggested_widths.map((widthSuggestion: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-1 hover:bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">• {widthSuggestion.width}"</span>
                              <span className="text-xs text-gray-500">
                                ({widthSuggestion.frequency} order{widthSuggestion.frequency > 1 ? 's' : ''})
                              </span>
                              {widthSuggestion.days_ago !== null && (
                                <span className="text-xs text-blue-600">
                                  Last: {widthSuggestion.days_ago === 0 ? 'Today' :
                                         widthSuggestion.days_ago === 1 ? 'Yesterday' :
                                         `${widthSuggestion.days_ago} days ago`}
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => setManualRollData(prev => ({
                                ...prev,
                                width: widthSuggestion.width.toString(),
                                selectedClient: suggestion.client_id
                              }))}
                            >
                              Use
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-3 text-sm text-muted-foreground">
                No client suggestions available for this waste space
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowManualRollDialog(false);
                setClientSuggestions([]);
              }}>
                Cancel
              </Button>
              <Button onClick={handleManualRollSubmit}>
                Add Manual Cut
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Manual Cut Dialog */}
        <Dialog open={editManualCutDialog.isOpen} onOpenChange={(open) => {
          if (!open) {
            setEditManualCutDialog({ isOpen: false, cut: null, suggestionId: '', jumboId: '', setId: '' });
          }
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Manual Cut</DialogTitle>
              <DialogDescription>
                Modify the custom cut details. Changes will update the roll set calculations.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-manual-width" className="text-right">
                  Width (inches)
                </Label>
                <Input
                  id="edit-manual-width"
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
                <Label htmlFor="edit-manual-description" className="text-right">
                  Description
                </Label>
                <Input
                  id="edit-manual-description"
                  value={manualRollData.description}
                  onChange={(e) => setManualRollData(prev => ({ ...prev, description: e.target.value }))}
                  className="col-span-3"
                  placeholder="e.g., Additional cut for order"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-client-select" className="text-right">
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
                    {clients?.sort((a, b) => a.company_name.localeCompare(b.company_name)).map((client) => (
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
                  <div className="text-xs text-blue-600">Maximum cut width allowed (including current cut)</div>
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
                </div>
              </div>
              {manualRollData.width && !isNaN(parseFloat(manualRollData.width)) && (
                <div className="text-sm text-muted-foreground text-center">
                  This will update the cut to {manualRollData.width}"
                  {parseFloat(manualRollData.width) > manualRollData.availableWaste && (
                    <div className="text-red-500 text-xs mt-1">
                      ⚠️ Width exceeds available waste space
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditManualCutDialog({ isOpen: false, cut: null, suggestionId: '', jumboId: '', setId: '' })}>
                Cancel
              </Button>
              <Button onClick={handleSaveEditedManualCut}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Roll Suggestions Results */}
        {showSuggestions && editablePlan && (
          <div className="space-y-4">
            {/* ── Header card ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Edit Production Plan
                      {editablePlan.isModified && <Badge variant="outline" className="ml-2 text-amber-600 border-amber-400">Modified</Badge>}
                    </CardTitle>
                    <CardDescription>
                      {editablePlan.targetWidth}" target width — delete algorithm rolls to orphan them, add manual rolls, or reassign orphans
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowSuggestions(false); setEditablePlan(null); setSuggestionResult(null); }}>Close</Button>
                    <Button variant="outline" size="sm" onClick={handleGetSuggestions}>Regenerate</Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={selectedSets.size === 0 || productionLoading}
                      onClick={handleStartProduction}
                    >
                      {productionLoading ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Starting...</> : `Start Production (${selectedSets.size} sets)`}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* ── Editable spec / jumbo / set hierarchy ── */}
                <div className="space-y-6">
                  {editablePlan.paperSpecs.map(spec => (
                    <div key={spec.id} className="border-2 border-amber-200 rounded-lg p-4 bg-amber-50">
                      {/* Spec header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="font-semibold text-amber-900 flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          {spec.shade} {spec.gsm}GSM (BF: {spec.bf})
                          <Badge variant="outline" className="text-amber-700 border-amber-400">
                            {spec.jumbos.reduce((s, j) => s + j.sets.reduce((ss, set) => ss + set.cuts.length, 0), 0)} cuts
                          </Badge>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleAddJumbo(spec.id)}>
                          <Plus className="h-3 w-3 mr-1" />Add Jumbo
                        </Button>
                      </div>

                      {spec.jumbos.map(jumbo => (
                        <div key={jumbo.id} className="mb-4 border border-purple-200 rounded-lg p-3 bg-purple-50">
                          <div className="font-medium text-purple-800 mb-3">Jumbo #{jumbo.jumboNumber}</div>

                          <div className="space-y-3">
                            {jumbo.sets.map(set => {
                              const isSelected = selectedSets.has(set.id);
                              const usedWidth = _setTotalWidth(set);
                              const waste = editablePlan.targetWidth - usedWidth;
                              const over = waste < 0;

                              return (
                                <div key={set.id} className={`rounded-lg border p-3 transition-all ${isSelected ? 'border-green-400 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                                  {/* Set header */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => setSelectedSets(prev => {
                                          const n = new Set(prev);
                                          n.has(set.id) ? n.delete(set.id) : n.add(set.id);
                                          return n;
                                        })}
                                      />
                                      <span className="text-sm font-medium text-blue-800">Set #{set.setNumber}</span>
                                      <Badge variant="outline" className={over ? 'text-red-600 border-red-400' : 'text-green-700 border-green-400'}>
                                        {usedWidth.toFixed(1)}" / {editablePlan.targetWidth}"
                                        {over ? ' OVER' : ` (${waste.toFixed(1)}" waste)`}
                                      </Badge>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => handleAddCut(set.id)}>
                                      <Plus className="h-3 w-3 mr-1" />Add Roll
                                    </Button>
                                  </div>

                                  {/* Visual pattern */}
                                  {set.cuts.length > 0 && (
                                    <CuttingPatternVisual cuts={set.cuts} targetWidth={editablePlan.targetWidth} />
                                  )}

                                  {/* Cut rolls table */}
                                  {set.cuts.length > 0 ? (
                                    <div className="mt-2 space-y-1">
                                      {set.cuts.map(cut => (
                                        <div key={cut.id} className="flex items-center justify-between text-sm bg-white border rounded px-2 py-1">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <Badge variant="outline" className={cut.source === 'manual' ? 'border-blue-400 text-blue-700 shrink-0' : 'border-gray-300 text-gray-600 shrink-0'}>
                                              {cut.source === 'manual' ? 'Manual' : 'Pending'}
                                            </Badge>
                                            <span className="font-medium shrink-0">{cut.width}"</span>
                                            {cut.quantity > 1 && <span className="text-muted-foreground shrink-0">×{cut.quantity}</span>}
                                            <div className="flex flex-col min-w-0">
                                              {cut.order_frontend_id && (
                                                <span className="text-xs font-medium text-blue-700 truncate">{cut.order_frontend_id}</span>
                                              )}
                                              {cut.clientName && (
                                                <span className="text-xs text-muted-foreground truncate">{cut.clientName}</span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex gap-1">
                                            {cut.source === 'manual' && (
                                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditCut(cut.id)}>
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                            )}
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => handleDeleteCut(cut.id)}>
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground mt-2 text-center py-2">Empty set — add rolls or deselect</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* ── Orphaned panel ── */}
                {editablePlan.orphanedRolls.length > 0 && (
                  <div className="mt-6 border-2 border-dashed border-orange-300 rounded-lg p-4 bg-orange-50">
                    <div className="flex items-center gap-2 mb-3 font-medium text-orange-800">
                      <AlertTriangle className="h-4 w-4" />
                      Orphaned Rolls ({editablePlan.orphanedRolls.length}) — will remain as pending items
                    </div>
                    <div className="space-y-2">
                      {editablePlan.orphanedRolls.map(orphan => {
                        // Find sets that have space for this orphan
                        const compatibleSets: { setId: string; label: string }[] = [];
                        for (const spec of editablePlan.paperSpecs) {
                          if (spec.gsm !== orphan.gsm || spec.bf !== orphan.bf || spec.shade !== orphan.shade) continue;
                          for (const jumbo of spec.jumbos) {
                            for (const set of jumbo.sets) {
                              const remaining = editablePlan.targetWidth - _setTotalWidth(set);
                              if (remaining >= orphan.width * orphan.quantity) {
                                compatibleSets.push({ setId: set.id, label: `J${jumbo.jumboNumber}/S${set.setNumber} (${remaining.toFixed(1)}" free)` });
                              }
                            }
                          }
                        }

                        return (
                          <div key={orphan.id} className="flex items-center justify-between bg-white border border-orange-200 rounded px-3 py-2 text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium">{orphan.width}" × {orphan.quantity}{orphan.order_frontend_id && <span className="ml-1 text-blue-700 font-normal">— {orphan.order_frontend_id}</span>}</span>
                              {orphan.clientName && <span className="text-xs text-muted-foreground">{orphan.clientName}</span>}
                            </div>
                            {compatibleSets.length > 0 ? (
                              <select
                                className="border rounded px-2 py-1 text-xs ml-2"
                                defaultValue=""
                                onChange={e => { if (e.target.value) handleReassignOrphan(orphan.id, e.target.value); e.target.value = ''; }}
                              >
                                <option value="">Reassign to…</option>
                                {compatibleSets.map(s => <option key={s.setId} value={s.setId}>{s.label}</option>)}
                              </select>
                            ) : (
                              <span className="text-xs text-muted-foreground">No compatible sets</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

               
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
                    <TableHead>Actions</TableHead>
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
                      <TableCell>
                        {item.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeleteConfirmDialog({
                                isOpen: true,
                                item: item
                              });
                            }}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                            title="Cancel pending order item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmDialog({ isOpen: false, item: null });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Pending Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this pending order item? This action will:
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmDialog({ isOpen: false, item: null })}
              disabled={deletingItem}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleDeletePendingItem}
              disabled={deletingItem}
            >
              {deletingItem ? "Cancelling..." : "Delete Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
}

