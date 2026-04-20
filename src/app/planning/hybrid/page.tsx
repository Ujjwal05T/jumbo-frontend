"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchOrders, Order } from "@/lib/orders";
import { fetchClients, Client } from "@/lib/clients";
import {
  processMultipleOrders,
  OptimizationResult,
  WorkflowProcessRequest,
  PendingOrder,
} from "@/lib/new-flow";
import { API_BASE_URL, MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSearch,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Pencil,
  AlertTriangle,
  Loader2,
  Clock,
  RotateCcw,
  Timer,
} from "lucide-react";
import { RollbackApiService, RollbackStatus } from "@/lib/rollback-api";

// ============================================
// TYPES
// ============================================

interface EditableCutRoll {
  id: string;
  width: number;
  quantity: number;
  clientName: string;
  clientId?: string;
  source: 'algorithm' | 'manual' | 'manual_order';
  order_id?: string;
  order_item_id?: string;
  source_pending_id?: string;
  source_type?: 'regular_order' | 'pending_order';
  paper_id?: string;
  selected: boolean;
  isPendingOrphan?: boolean;
  trimLeft?: number;
  originalWidth?: number;
  originalQuantity?: number;
  // Paper spec for filtering orphaned rolls
  gsm?: number;
  bf?: number;
  shade?: string;
}

interface RollSetGroup {
  id: string;
  setNumber: number;
  cuts: EditableCutRoll[];
}

interface JumboRollGroup {
  id: string;
  jumboNumber: number;
  sets: RollSetGroup[];
}

interface PaperSpecGroup {
  id: string;
  gsm: number;
  bf: number;
  shade: string;
  jumbos: JumboRollGroup[];
  isExpanded: boolean;
}

interface HybridPlanState {
  wastage: number;
  planningWidth: number;
  selectedOrderIds: string[];
  paperSpecs: PaperSpecGroup[];
  orphanedRolls: EditableCutRoll[];
  isGenerated: boolean;
  isModified: boolean;
  pendingOrders: PendingOrder[];
  wastageAllocations: any[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function transformToNestedStructure(
  result: OptimizationResult,
  planningWidth: number
): HybridPlanState {
  const paperSpecMap = new Map<string, PaperSpecGroup>();

  // Build ordered unique roll numbers per spec in the order they appear in
  // cut_rolls_generated (backend already sorts by wastage ascending).
  // We use this position-based index to assign jumbos, NOT the raw roll number.
  const specRollOrder = new Map<string, number[]>();
  result.cut_rolls_generated.forEach((roll) => {
    const specKey = `${roll.gsm}-${roll.bf}-${roll.shade}`;
    if (!specRollOrder.has(specKey)) specRollOrder.set(specKey, []);
    const rollNum = roll.individual_roll_number || 1;
    const ordered = specRollOrder.get(specKey)!;
    if (!ordered.includes(rollNum)) ordered.push(rollNum);
  });

  result.cut_rolls_generated.forEach((roll, index) => {
    const specKey = `${roll.gsm}-${roll.bf}-${roll.shade}`;

    if (!paperSpecMap.has(specKey)) {
      paperSpecMap.set(specKey, {
        id: `spec-${generateId()}`,
        gsm: roll.gsm,
        bf: roll.bf,
        shade: roll.shade,
        jumbos: [],
        isExpanded: true,
      });
    }
    const spec = paperSpecMap.get(specKey)!;

    const rollNum = roll.individual_roll_number || 1;
    const orderedRollNums = specRollOrder.get(specKey)!;
    const rollPosition = orderedRollNums.indexOf(rollNum); // position in wastage-sorted order
    const jumboNumber = Math.floor(rollPosition / 3) + 1;
    const setNumber = (rollPosition % 3) + 1;

    let jumbo = spec.jumbos.find(j => j.jumboNumber === jumboNumber);
    if (!jumbo) {
      jumbo = {
        id: `jumbo-${generateId()}`,
        jumboNumber,
        sets: [
          { id: `set-${generateId()}-1`, setNumber: 1, cuts: [] },
          { id: `set-${generateId()}-2`, setNumber: 2, cuts: [] },
          { id: `set-${generateId()}-3`, setNumber: 3, cuts: [] },
        ],
      };
      spec.jumbos.push(jumbo);
    }

    // Get client name - backend provides it directly on the roll
    const clientName = (roll as any).client_name || '';

    const set = jumbo.sets.find(s => s.setNumber === setNumber)!;
    set.cuts.push({
      id: `cut-${generateId()}-${index}`,
      width: roll.width,
      quantity: roll.quantity || 1,
      clientName,
      clientId: roll.client_id,
      source: 'algorithm',
      order_id: roll.order_id,
      source_pending_id: roll.source_pending_id,
      source_type: roll.source_type as 'regular_order' | 'pending_order',
      paper_id: roll.paper_id,
      selected: true,
      trimLeft: roll.trim_left,
      originalWidth: roll.width,
      originalQuantity: roll.quantity || 1,
      // Store paper spec on the cut for filtering orphaned rolls
      gsm: roll.gsm,
      bf: roll.bf,
      shade: roll.shade,
    });
  });

  paperSpecMap.forEach(spec => {
    spec.jumbos.sort((a, b) => a.jumboNumber - b.jumboNumber);
  });

  const paperSpecs = Array.from(paperSpecMap.values());

  // Build all pending orphan rolls first
  const allPendingOrphans: EditableCutRoll[] = (result.pending_orders || []).flatMap((p: any, i: number) =>
    Array.from({ length: p.quantity || 1 }, (_, j) => ({
      id: `pending-orphan-${i}-${j}-${generateId()}`,
      width: p.width,
      quantity: 1,
      clientName: p.client_name || '',
      clientId: p.client_id,
      source: 'algorithm' as const,
      order_id: p.order_id || p.source_order_id,
      order_item_id: p.order_item_id,
      source_pending_id: p.source_pending_id,
      source_type: p.source_type,
      paper_id: p.paper_id,
      gsm: p.gsm,
      bf: p.bf,
      shade: p.shade,
      selected: true,
      isPendingOrphan: true,
    }))
  );

  // Auto-assign pending orphans into new jumbos at the bottom of each matching paper spec
  const unassignedOrphans: EditableCutRoll[] = [];
  const orphansBySpec = new Map<string, EditableCutRoll[]>();
  for (const orphan of allPendingOrphans) {
    const key = `${orphan.gsm}-${orphan.bf}-${orphan.shade}`;
    if (!orphansBySpec.has(key)) orphansBySpec.set(key, []);
    orphansBySpec.get(key)!.push(orphan);
  }

  orphansBySpec.forEach((orphans, specKey) => {
    let spec = paperSpecs.find(s => `${s.gsm}-${s.bf}-${s.shade}` === specKey);
    if (!spec) {
      // No algo-generated spec exists — create one from orphan data
      const sample = orphans[0];
      spec = {
        id: `spec-pending-${generateId()}`,
        gsm: sample.gsm!,
        bf: sample.bf!,
        shade: sample.shade!,
        jumbos: [],
        isExpanded: true,
      };
      paperSpecs.push(spec);
    }

    const createNewJumbo = (): JumboRollGroup => {
      const nextNum = (spec.jumbos[spec.jumbos.length - 1]?.jumboNumber ?? 0) + 1;
      const j: JumboRollGroup = { id: `jumbo-pending-${generateId()}`, jumboNumber: nextNum, sets: [] };
      spec.jumbos.push(j);
      return j;
    };

    let currentJumbo = createNewJumbo();
    let currentSet: RollSetGroup = { id: `set-pending-${generateId()}`, setNumber: 1, cuts: [] };
    let currentWidth = 0;

    for (const orphan of orphans) {
      const setFull = currentWidth + orphan.width > planningWidth && currentSet.cuts.length > 0;
      if (setFull) {
        currentJumbo.sets.push(currentSet);
        if (currentJumbo.sets.length >= 3) {
          currentJumbo = createNewJumbo();
        }
        currentSet = { id: `set-pending-${generateId()}`, setNumber: currentJumbo.sets.length + 1, cuts: [] };
        currentWidth = 0;
      }
      currentSet.cuts.push(orphan);
      currentWidth += orphan.width;
    }
    if (currentSet.cuts.length > 0) currentJumbo.sets.push(currentSet);
  });

  return {
    wastage: 124 - planningWidth,
    planningWidth,
    selectedOrderIds: [],
    paperSpecs,
    orphanedRolls: unassignedOrphans,
    isGenerated: true,
    isModified: false,
    pendingOrders: [],
    wastageAllocations: result.wastage_allocations || [],
  };
}

function getTotalWidthForSet(set: RollSetGroup): number {
  return set.cuts.reduce((sum, cut) => sum + (cut.width * cut.quantity), 0);
}

function getRemainingWidthForSet(set: RollSetGroup, planningWidth: number): number {
  return planningWidth - getTotalWidthForSet(set);
}

// ============================================
// VISUAL CUTTING PATTERN COMPONENT
// ============================================

function CuttingPatternVisual({
  cuts,
  planningWidth,
  isSetSelected = true,
}: {
  cuts: EditableCutRoll[];
  planningWidth: number;
  isSetSelected?: boolean;
}) {
  const totalUsed = cuts.reduce((sum, cut) => sum + (cut.width * cut.quantity), 0);
  const waste = planningWidth - totalUsed;
  const wastePercentage = (waste / planningWidth) * 100;

  let currentPosition = 0;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Cutting Pattern ({planningWidth}" Roll):
      </div>
      <div className="relative h-14 bg-muted rounded-lg border overflow-hidden">
        {cuts.map((cut) => {
          const widthForCut = cut.width * cut.quantity;
          const widthPercentage = (widthForCut / planningWidth) * 100;
          const leftPosition = (currentPosition / planningWidth) * 100;
          currentPosition += widthForCut;

          const isPending = cut.source_type === 'pending_order' || !!cut.source_pending_id;

          return (
            <div
              key={cut.id}
              className={`absolute h-full border-r-2 border-white ${
                isSetSelected
                  ? isPending
                    ? "bg-gradient-to-r from-orange-400 to-orange-500"
                    : "bg-gradient-to-r from-green-400 to-green-500"
                  : "bg-gradient-to-r from-gray-300 to-gray-400"
              }`}
              style={{
                left: `${leftPosition}%`,
                width: `${widthPercentage}%`,
              }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-white font-bold">
                <div className="text-[10px] truncate max-w-full px-1">
                  {cut.clientName || 'No Client'}
                </div>
                <div>{cut.width}" {cut.quantity > 1 && `×${cut.quantity}`}</div>
                {isPending && (
                  <div className="absolute -top-1 -right-1 bg-orange-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shadow-lg">
                    P
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {waste > 0 && (
          <div
            className="absolute h-full bg-gradient-to-r from-red-400 to-red-500 border-l-2 border-white"
            style={{
              right: "0%",
              width: `${wastePercentage}%`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
              {waste.toFixed(1)}"
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CUT ROLL ITEM COMPONENT
// ============================================

function CutRollItem({
  cut,
  onEdit,
  onDelete,
}: {
  cut: EditableCutRoll;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isPending = cut.source_type === 'pending_order' || !!cut.source_pending_id;

  return (
    <div className="flex items-center gap-2 p-2 bg-white border rounded-md">
      <div className="flex-1 flex items-center gap-2 flex-wrap">
        <span className="font-medium">{cut.width}"</span>
        {cut.quantity > 1 && <span className="text-gray-500">×{cut.quantity}</span>}
        <span className="text-sm text-gray-600">{cut.clientName || 'No Client'}</span>

        <Badge variant={cut.source === 'algorithm' ? 'default' : 'secondary'} className="text-xs">
          {cut.source === 'algorithm' ? 'algo' : 'manual'}
        </Badge>

        {isPending && (
          <Badge variant="destructive" className="text-xs bg-orange-500 hover:bg-orange-600">
            Pending
          </Badge>
        )}

        {cut.order_id && !isPending && (
          <Badge variant="outline" className="text-xs">
            linked
          </Badge>
        )}
      </div>

      {/* Only show edit button for manual rolls - algorithm rolls should not be edited */}
      {cut.source === 'manual' && (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onDelete}>
        <Trash2 className="h-3 w-3 text-red-500" />
      </Button>
    </div>
  );
}

// ============================================
// ROLL SET COMPONENT
// ============================================

function RollSet({
  set,
  planningWidth,
  isSelected,
  onToggleSet,
  onEditCut,
  onDeleteCut,
  onAddCut,
  paperSpec,
}: {
  set: RollSetGroup;
  planningWidth: number;
  isSelected: boolean;
  onToggleSet: (setId: string) => void;
  onEditCut: (cutId: string) => void;
  onDeleteCut: (cutId: string) => void;
  onAddCut: (setId: string) => void;
  paperSpec?: { gsm: number; bf: number; shade: string };
}) {
  const totalWidth = getTotalWidthForSet(set);
  const remainingWidth = getRemainingWidthForSet(set, planningWidth);

  return (
    <div className={`border rounded-lg p-4 ${!isSelected ? 'opacity-50 bg-gray-50' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSet(set.id)}
          />
          <div className={`w-8 h-8 ${isSelected ? 'bg-primary' : 'bg-gray-400'} text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold`}>
            {set.setNumber}
          </div>
          <span className="font-medium">Set #{set.setNumber}</span>
          {paperSpec && (
            <Badge className="text-xs bg-blue-100 text-blue-800 border border-blue-300 font-semibold">
              {paperSpec.gsm}gsm / {paperSpec.bf}bf / {paperSpec.shade}
            </Badge>
          )}
          {!isSelected && (
            <Badge variant="secondary" className="text-xs">
              Excluded
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {remainingWidth < 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Exceeds
            </Badge>
          )}
          <span className="text-sm text-gray-500">
            {totalWidth}" / {planningWidth}" ({remainingWidth}" free)
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddCut(set.id)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Visual Cutting Pattern */}
      {set.cuts.length > 0 && (
        <div className="mb-4">
          <CuttingPatternVisual cuts={set.cuts} planningWidth={planningWidth} isSetSelected={isSelected} />
        </div>
      )}

      {/* Cut Rolls - Horizontal Row */}
      <div className="flex flex-wrap gap-2">
        {set.cuts.map((cut) => (
          <CutRollItem
            key={cut.id}
            cut={cut}
            onEdit={() => onEditCut(cut.id)}
            onDelete={() => onDeleteCut(cut.id)}
          />
        ))}
      </div>

      {set.cuts.length === 0 && (
        <div className="text-center py-4 text-gray-400 text-sm border-2 border-dashed rounded-lg">
          No rolls in this set. Click "Add" to add rolls.
        </div>
      )}
    </div>
  );
}

// ============================================
// WASTAGE ALLOCATION TABLE
// ============================================

function WastageAllocationTable({ wastageAllocations, orders }: { wastageAllocations: any[], orders: Order[] }) {
  if (!wastageAllocations || wastageAllocations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No stock allocations in this plan
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Stock ID</TableHead>
          <TableHead>Width</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Order</TableHead>
          <TableHead>Client</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {wastageAllocations.map((allocation: any, index: number) => {
          const order = orders.find(o => o.id === allocation.order_id);
          return (
            <TableRow key={index}>
              <TableCell className="font-medium">
                {allocation.wastage_reel_no || `STOCK-${index + 1}`}
              </TableCell>
              <TableCell>{allocation.width_inches}"</TableCell>
              <TableCell>{allocation.quantity_reduced || 1}</TableCell>
              <TableCell>{order?.frontend_id || allocation.order_id?.slice(0, 8) || 'N/A'}</TableCell>
              <TableCell>{order?.client?.company_name || 'N/A'}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ============================================
// PENDING ORDERS TABLE
// ============================================

function PendingOrdersTable({ pendingOrders }: { pendingOrders: PendingOrder[] }) {
  if (!pendingOrders || pendingOrders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No pending orders generated
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Width</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Paper Spec</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pendingOrders.map((pending: PendingOrder, index: number) => (
          <TableRow key={index}>
            <TableCell className="font-medium">{pending.width}"</TableCell>
            <TableCell>{pending.quantity}</TableCell>
            <TableCell>{pending.gsm}gsm, {pending.bf}bf, {pending.shade}</TableCell>
            <TableCell>{pending.client_name || 'N/A'}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {pending.reason || 'Unfulfilled'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function HybridPlanningPage() {
  const router = useRouter();

  // Order selection state
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Clients for manual roll assignment
  const [clients, setClients] = useState<Client[]>([]);

  // Wastage configuration
  const [wastageInput, setWastageInput] = useState(6);
  const [appliedWastage, setAppliedWastage] = useState(6);
  const [isEditingWastage, setIsEditingWastage] = useState(true);

  // Plan state
  const [planState, setPlanState] = useState<HybridPlanState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [creatingProduction, setCreatingProduction] = useState(false);
  const [productionCreated, setProductionCreated] = useState(false);
  const [productionResult, setProductionResult] = useState<any>(null);

  // Rollback state
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);
  const [rollbackInfo, setRollbackInfo] = useState<{ rollback_available: boolean; expires_at?: string; minutes_remaining?: number } | null>(null);
  const [rollbackTimeRemaining, setRollbackTimeRemaining] = useState(0);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackStatus, setRollbackStatus] = useState<RollbackStatus | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState("orders");
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());
  const [expandedJumbos, setExpandedJumbos] = useState<Set<string>>(new Set());
  const [showAddCutDialog, setShowAddCutDialog] = useState(false);
  const [showEditCutDialog, setShowEditCutDialog] = useState(false);
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [currentPaperSpec, setCurrentPaperSpec] = useState<{ gsm: number; bf: number; shade: string } | null>(null);
  const [editingCut, setEditingCut] = useState<EditableCutRoll | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [includePendingOrders, setIncludePendingOrders] = useState(true);
  const [includeWastageAllocation, setIncludeWastageAllocation] = useState(true);
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());

  // Cut roll form
  const [cutRollForm, setCutRollForm] = useState({
    width: '',
    quantity: '1',
    clientId: '',
    orderId: '',
    orderItemId: '',
    assignFromOrder: false,
  });

  const [suggestionQuantities, setSuggestionQuantities] = useState<Record<string, string>>({});
  const [clientSelectSearch, setClientSelectSearch] = useState('');

  // AI client suggestions
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
  const [clientSuggestionsLoading, setClientSuggestionsLoading] = useState(false);

  // Calculate planning width
  const planningWidth = useMemo(() => {
    return Math.max(124 - appliedWastage, 50);
  }, [appliedWastage]);

  // Remaining width in the set currently being edited
  const currentSetRemainingWidth = useMemo(() => {
    if (!currentSetId || !planState) return planningWidth;
    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const set = jumbo.sets.find(s => s.id === currentSetId);
        if (set) return getRemainingWidthForSet(set, planningWidth);
      }
    }
    return planningWidth;
  }, [currentSetId, planState, planningWidth]);

  // Count manual_order cuts already in plan per order_item_id to adjust remaining display
  const manualOrderCutCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!planState) return counts;
    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        for (const set of jumbo.sets) {
          for (const cut of set.cuts) {
            if (cut.source === 'manual_order' && cut.order_item_id) {
              counts[cut.order_item_id] = (counts[cut.order_item_id] || 0) + cut.quantity;
            }
          }
        }
      }
    }
    return counts;
  }, [planState]);

  // Load orders on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingOrders(true);
        const [ordersData, clientsData] = await Promise.all([
          fetchOrders(),
          fetchClients(0, 'active'),
        ]);
        setOrders(ordersData);
        setClients(clientsData.sort((a: Client, b: Client) =>
          a.company_name.localeCompare(b.company_name)
        ));
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load orders');
      } finally {
        setLoadingOrders(false);
      }
    };
    loadData();
  }, []);

  // Filter orders to show only 'created' status
  const filteredOrders = useMemo(() => {
    return orders.filter(order => order.status === 'created');
  }, [orders]);

  // Calculate total selected quantity
  const totalSelectedQuantity = useMemo(() => {
    return selectedOrders.reduce((total, orderId) => {
      const order = orders.find(o => o.id === orderId);
      if (!order) return total;
      return total + (order.order_items?.reduce(
        (itemTotal, item) => itemTotal + item.quantity_rolls, 0
      ) || 0);
    }, 0);
  }, [selectedOrders, orders]);

  // Count pending rolls in plan
  const pendingRollsCount = useMemo(() => {
    if (!planState) return 0;
    let count = 0;
    planState.paperSpecs.forEach(spec => {
      spec.jumbos.forEach(jumbo => {
        jumbo.sets.forEach(set => {
          set.cuts.forEach(cut => {
            if (cut.source_type === 'pending_order' || cut.source_pending_id) {
              count++;
            }
          });
        });
      });
    });
    return count;
  }, [planState]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleApplyWastage = () => {
    setAppliedWastage(wastageInput);
    setIsEditingWastage(false);
    toast.success(`Wastage applied: Planning width is now ${124 - wastageInput}"`);
  };

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrders(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      }
      return [...prev, orderId];
    });
  };

  const handleSelectAllOrders = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const handleGeneratePlan = async () => {
    if (selectedOrders.length === 0) {
      toast.error('Please select at least one order');
      return;
    }

    if (isEditingWastage) {
      toast.error('Please apply wastage configuration first');
      return;
    }

    try {
      setGenerating(true);

      const userId = localStorage.getItem('user_id');
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const request: WorkflowProcessRequest = {
        order_ids: selectedOrders,
        user_id: userId,
        include_pending_orders: includePendingOrders,
        include_available_inventory: true,
        include_wastage_allocation: includeWastageAllocation,
        jumbo_roll_width: planningWidth,
      };

      const result = await processMultipleOrders(request);

      // Transform flat result to nested structure
      const nestedState = transformToNestedStructure(result, planningWidth);
      nestedState.selectedOrderIds = selectedOrders;

      setPlanState(nestedState);

      setExpandedSpecs(new Set());
      const allJumboIds = new Set<string>();
      nestedState.paperSpecs.forEach(spec => spec.jumbos.forEach(jumbo => allJumboIds.add(jumbo.id)));
      setExpandedJumbos(allJumboIds);

      // Select all sets by default
      const allSetIds = new Set<string>();
      nestedState.paperSpecs.forEach(spec => {
        spec.jumbos.forEach(jumbo => {
          jumbo.sets.forEach(set => {
            allSetIds.add(set.id);
          });
        });
      });
      setSelectedSets(allSetIds);

      setActiveTab("edit-plan");
      toast.success('Plan generated successfully!');

    } catch (error) {
      console.error('Failed to generate plan:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleJumbo = (jumbo: { sets: { id: string }[] }) => {
    const setIds = jumbo.sets.map(s => s.id);
    const allSelected = setIds.every(id => selectedSets.has(id));
    setSelectedSets(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        setIds.forEach(id => newSet.delete(id));
      } else {
        setIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const handleToggleSet = (setId: string) => {
    setSelectedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setId)) {
        newSet.delete(setId);
      } else {
        newSet.add(setId);
      }
      return newSet;
    });
  };

  const handleDeleteCut = (cutId: string) => {
    if (!planState) return;

    let foundCut: EditableCutRoll | null = null;
    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        for (const set of jumbo.sets) {
          const cut = set.cuts.find(c => c.id === cutId);
          if (cut) {
            foundCut = cut;
            break;
          }
        }
      }
    }

    if (!foundCut) return;

    // Different behavior for algorithm vs manual rolls
    const isAlgorithmRoll = foundCut.source === 'algorithm';

    setPlanState(prev => {
      if (!prev) return prev;

      const newSpecs = prev.paperSpecs.map(spec => ({
        ...spec,
        jumbos: spec.jumbos.map(jumbo => ({
          ...jumbo,
          sets: jumbo.sets.map(set => ({
            ...set,
            cuts: set.cuts.filter(c => c.id !== cutId),
          })),
        })),
      }));

      return {
        ...prev,
        paperSpecs: newSpecs,
        // Only move algorithm rolls to orphaned; manual rolls are deleted completely
        orphanedRolls: isAlgorithmRoll ? [...prev.orphanedRolls, foundCut!] : prev.orphanedRolls,
        isModified: true,
      };
    });

    if (isAlgorithmRoll) {
      toast.info('Roll moved to orphaned panel');
    } else {
      toast.success('Manual roll deleted');
    }
  };

  const handleReassignOrphan = (cutId: string, targetSetId: string) => {
    if (!planState) return;

    const orphan = planState.orphanedRolls.find(c => c.id === cutId);
    if (!orphan) return;

    let targetSet: RollSetGroup | null = null;

    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const set = jumbo.sets.find(s => s.id === targetSetId);
        if (set) {
          targetSet = set;
          break;
        }
      }
    }

    if (!targetSet) return;

    const newTotalWidth = getTotalWidthForSet(targetSet) + (orphan.width * orphan.quantity);
    if (newTotalWidth > planningWidth) {
      toast.error(`Cannot add: would exceed ${planningWidth}" limit`);
      return;
    }

    setPlanState(prev => {
      if (!prev) return prev;

      const newSpecs = prev.paperSpecs.map(spec => ({
        ...spec,
        jumbos: spec.jumbos.map(jumbo => ({
          ...jumbo,
          sets: jumbo.sets.map(set => {
            if (set.id === targetSetId) {
              return { ...set, cuts: [...set.cuts, orphan] };
            }
            return set;
          }),
        })),
      }));

      return {
        ...prev,
        paperSpecs: newSpecs,
        orphanedRolls: prev.orphanedRolls.filter(c => c.id !== cutId),
        isModified: true,
      };
    });

    toast.success('Roll reassigned to set');
  };

  const fetchClientSuggestions = async (availableWaste: number, paperSpec: { gsm: number; bf: number; shade: string }) => {
    if (!availableWaste || availableWaste < 10) { setClientSuggestions([]); return; }
    setClientSuggestionsLoading(true);
    try {
      const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/client-suggestions`,
        createRequestOptions('POST', { available_waste: availableWaste, paper_specs: paperSpec })
      );
      if (response.ok) {
        const result = await response.json();
        setClientSuggestions(result.status === 'success' ? (result.suggestions || []) : []);
      } else {
        setClientSuggestions([]);
      }
    } catch { setClientSuggestions([]); }
    setClientSuggestionsLoading(false);
  };

  const handleAddCut = (setId: string) => {
    setCurrentSetId(setId);
    setCutRollForm({ width: '', quantity: '1', clientId: '', orderId: '', orderItemId: '', assignFromOrder: false });
    setSuggestionQuantities({});
    setClientSuggestions([]);
    setClientSelectSearch('');

    // Find the paper spec for the set's parent jumbo
    if (planState) {
      for (const spec of planState.paperSpecs) {
        for (const jumbo of spec.jumbos) {
          const set = jumbo.sets.find(s => s.id === setId);
          if (set) {
            setCurrentPaperSpec({ gsm: spec.gsm, bf: spec.bf, shade: spec.shade });
            const remaining = getRemainingWidthForSet(set, planningWidth);
            fetchClientSuggestions(remaining, { gsm: spec.gsm, bf: spec.bf, shade: spec.shade });
            break;
          }
        }
      }
    }

    setShowAddCutDialog(true);
  };

  const handleAssignOrphan = (orphanId: string) => {
    if (!planState || !currentSetId) return;

    const orphan = planState.orphanedRolls.find(c => c.id === orphanId);
    if (!orphan) return;

    let targetSet: RollSetGroup | null = null;

    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const set = jumbo.sets.find(s => s.id === currentSetId);
        if (set) {
          targetSet = set;
          break;
        }
      }
    }

    if (!targetSet) return;

    const newTotalWidth = getTotalWidthForSet(targetSet) + (orphan.width * orphan.quantity);
    if (newTotalWidth > planningWidth) {
      toast.error(`Cannot add: would exceed ${planningWidth}" limit`);
      return;
    }

    setPlanState(prev => {
      if (!prev) return prev;

      const newSpecs = prev.paperSpecs.map(spec => ({
        ...spec,
        jumbos: spec.jumbos.map(jumbo => ({
          ...jumbo,
          sets: jumbo.sets.map(set => {
            if (set.id === currentSetId) {
              return { ...set, cuts: [...set.cuts, orphan] };
            }
            return set;
          }),
        })),
      }));

      return {
        ...prev,
        paperSpecs: newSpecs,
        orphanedRolls: prev.orphanedRolls.filter(c => c.id !== orphanId),
        isModified: true,
      };
    });

    setShowAddCutDialog(false);
    toast.success('Orphaned roll assigned to set');
  };

  const handleSaveNewCut = () => {
    if (!planState || !currentSetId) return;

    const width = parseFloat(cutRollForm.width);
    const quantity = parseInt(cutRollForm.quantity);

    if (isNaN(width) || width <= 0) {
      toast.error('Please enter a valid width');
      return;
    }

    let targetSet: RollSetGroup | null = null;

    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const set = jumbo.sets.find(s => s.id === currentSetId);
        if (set) {
          targetSet = set;
          break;
        }
      }
    }

    if (!targetSet) {
      toast.error('Set not found');
      return;
    }

    const newTotalWidth = getTotalWidthForSet(targetSet) + (width * quantity);
    if (newTotalWidth > planningWidth) {
      toast.error(`Cannot add: would exceed ${planningWidth}" limit`);
      return;
    }

    const client = clients.find(c => c.id === cutRollForm.clientId);

    // Validate order selection if assigning from order
    if (cutRollForm.assignFromOrder) {
      if (!cutRollForm.orderId) {
        toast.error('Please select an order');
        return;
      }
      if (!cutRollForm.orderItemId) {
        toast.error('Please select a roll from the order');
        return;
      }
    }

    const selectedOrder = cutRollForm.assignFromOrder
      ? orders.find(o => o.id === cutRollForm.orderId)
      : null;

    // Create separate cut objects for each roll (not grouped by quantity)
    const newCuts: EditableCutRoll[] = [];
    for (let i = 0; i < quantity; i++) {
      if (cutRollForm.assignFromOrder && selectedOrder) {
        newCuts.push({
          id: `cut-${generateId()}-${i}`,
          width,
          quantity: 1,
          clientName: selectedOrder.client.company_name,
          source: 'manual_order',
          order_id: cutRollForm.orderId,
          order_item_id: cutRollForm.orderItemId,
          source_type: 'regular_order',
          selected: true,
          gsm: currentPaperSpec?.gsm,
          bf: currentPaperSpec?.bf,
          shade: currentPaperSpec?.shade,
        });
      } else {
        newCuts.push({
          id: `cut-${generateId()}-${i}`,
          width,
          quantity: 1, // Each roll is tracked individually
          clientName: client?.company_name || '',
          clientId: cutRollForm.clientId || undefined,
          source: 'manual',
          selected: true,
          // Store paper spec from the target set's parent
          gsm: currentPaperSpec?.gsm,
          bf: currentPaperSpec?.bf,
          shade: currentPaperSpec?.shade,
        });
      }
    }

    setPlanState(prev => {
      if (!prev) return prev;

      const newSpecs = prev.paperSpecs.map(spec => ({
        ...spec,
        jumbos: spec.jumbos.map(jumbo => ({
          ...jumbo,
          sets: jumbo.sets.map(set => {
            if (set.id === currentSetId) {
              return { ...set, cuts: [...set.cuts, ...newCuts] };
            }
            return set;
          }),
        })),
      }));

      return { ...prev, paperSpecs: newSpecs, isModified: true };
    });

    setShowAddCutDialog(false);
    toast.success('Cut roll added');
  };

  const handleAddFromOrderSuggestion = (orderId: string, orderItemId: string, width: number, quantity: number) => {
    if (!planState || !currentSetId) return;

    let targetSet: RollSetGroup | null = null;
    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const set = jumbo.sets.find(s => s.id === currentSetId);
        if (set) { targetSet = set; break; }
      }
    }
    if (!targetSet) return;
    const newTotalWidth = getTotalWidthForSet(targetSet) + (width * quantity);
    if (newTotalWidth > planningWidth) {
      toast.error(`Cannot add: would exceed ${planningWidth}" limit`);
      return;
    }

    const order = orders.find(o => o.id === orderId);
    const newCuts: EditableCutRoll[] = [];
    for (let i = 0; i < quantity; i++) {
      newCuts.push({
        id: `cut-${generateId()}-${i}`,
        width,
        quantity: 1,
        clientName: order?.client.company_name || '',
        source: 'manual_order',
        order_id: orderId,
        order_item_id: orderItemId,
        source_type: 'regular_order',
        selected: true,
        gsm: currentPaperSpec?.gsm,
        bf: currentPaperSpec?.bf,
        shade: currentPaperSpec?.shade,
      });
    }

    setPlanState(prev => {
      if (!prev) return prev;
      const newSpecs = prev.paperSpecs.map(spec => ({
        ...spec,
        jumbos: spec.jumbos.map(jumbo => ({
          ...jumbo,
          sets: jumbo.sets.map(set => {
            if (set.id === currentSetId) {
              return { ...set, cuts: [...set.cuts, ...newCuts] };
            }
            return set;
          }),
        })),
      }));
      return { ...prev, paperSpecs: newSpecs, isModified: true };
    });

    setShowAddCutDialog(false);
    toast.success('Roll added from order');
  };

  const handleEditCut = (cutId: string) => {
    if (!planState) return;

    let foundCut: EditableCutRoll | null = null;
    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        for (const set of jumbo.sets) {
          const cut = set.cuts.find(c => c.id === cutId);
          if (cut) {
            foundCut = cut;
            break;
          }
        }
      }
    }

    if (foundCut) {
      // Only allow editing manual rolls - algorithm rolls should not be modified
      if (foundCut.source === 'algorithm') {
        toast.error('Algorithm-generated rolls cannot be edited. You can only delete them.');
        return;
      }

      setEditingCut(foundCut);
      setCutRollForm({
        width: foundCut.width.toString(),
        quantity: foundCut.quantity.toString(),
        clientId: foundCut.clientId || '',
        orderId: '',
        orderItemId: '',
        assignFromOrder: false,
      });
      setShowEditCutDialog(true);
    }
  };

  const handleSaveEditCut = () => {
    if (!planState || !editingCut) return;

    const width = parseFloat(cutRollForm.width);
    const quantity = parseInt(cutRollForm.quantity);

    if (isNaN(width) || width <= 0) {
      toast.error('Please enter a valid width');
      return;
    }

    let targetSet: RollSetGroup | null = null;

    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const set = jumbo.sets.find(s => s.cuts.some(c => c.id === editingCut.id));
        if (set) {
          targetSet = set;
          break;
        }
      }
    }

    if (targetSet) {
      const otherCutsWidth = targetSet.cuts
        .filter(c => c.id !== editingCut.id)
        .reduce((sum, c) => sum + (c.width * c.quantity), 0);

      if (otherCutsWidth + (width * quantity) > planningWidth) {
        toast.error(`Cannot save: would exceed ${planningWidth}" limit`);
        return;
      }
    }

    const client = clients.find(c => c.id === cutRollForm.clientId);

    setPlanState(prev => {
      if (!prev) return prev;

      const newSpecs = prev.paperSpecs.map(spec => ({
        ...spec,
        jumbos: spec.jumbos.map(jumbo => ({
          ...jumbo,
          sets: jumbo.sets.map(set => ({
            ...set,
            cuts: set.cuts.map(cut => {
              if (cut.id === editingCut.id) {
                return {
                  ...cut,
                  width,
                  quantity,
                  clientName: client?.company_name || cut.clientName,
                  clientId: cutRollForm.clientId || cut.clientId,
                };
              }
              return cut;
            }),
          })),
        })),
      }));

      return { ...prev, paperSpecs: newSpecs, isModified: true };
    });

    setShowEditCutDialog(false);
    setEditingCut(null);
    toast.success('Cut roll updated');
  };

  const handleAddJumbo = (specId: string) => {
    if (!planState) return;

    // Generate set IDs for the new jumbo
    const newSetIds = [
      `set-${generateId()}-1`,
      `set-${generateId()}-2`,
      `set-${generateId()}-3`,
    ];

    setPlanState(prev => {
      if (!prev) return prev;

      const newSpecs = prev.paperSpecs.map(spec => {
        if (spec.id === specId) {
          const maxJumboNum = Math.max(...spec.jumbos.map(j => j.jumboNumber), 0);
          const newJumbo: JumboRollGroup = {
            id: `jumbo-${generateId()}`,
            jumboNumber: maxJumboNum + 1,
            sets: [
              { id: newSetIds[0], setNumber: 1, cuts: [] },
              { id: newSetIds[1], setNumber: 2, cuts: [] },
              { id: newSetIds[2], setNumber: 3, cuts: [] },
            ],
          };
          return { ...spec, jumbos: [...spec.jumbos, newJumbo] };
        }
        return spec;
      });

      return { ...prev, paperSpecs: newSpecs, isModified: true };
    });

    // Automatically select all sets in the new jumbo
    setSelectedSets(prev => {
      const newSelected = new Set(prev);
      newSetIds.forEach(setId => newSelected.add(setId));
      return newSelected;
    });

    toast.success('Jumbo roll added');
  };

  const handleStartProduction = () => {
    if (!planState) return;

    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        for (const set of jumbo.sets) {
          if (getTotalWidthForSet(set) > planningWidth) {
            toast.error(`Set #${set.setNumber} in Jumbo #${jumbo.jumboNumber} exceeds width limit`);
            return;
          }
        }
      }
    }

    if (planState.orphanedRolls.length > 0) {
      setShowConfirmDialog(true);
    } else {
      createProduction();
    }
  };

  const createProduction = async () => {
    if (!planState) return;

    setShowConfirmDialog(false);
    setCreatingProduction(true);

    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Build hybrid request structure
      const hybridRequest = {
        wastage: appliedWastage,
        planning_width: planningWidth,
        created_by_id: userId,
        order_ids: planState.selectedOrderIds,
        paper_specs: planState.paperSpecs.map(spec => ({
          gsm: spec.gsm,
          bf: spec.bf,
          shade: spec.shade,
          jumbos: spec.jumbos.map(jumbo => ({
            jumbo_number: jumbo.jumboNumber,
            sets: jumbo.sets
              .filter(set => set.cuts.length > 0) // Only include sets with rolls
              .map(set => ({
                set_number: set.setNumber,
                is_selected: selectedSets.has(set.id),
                cuts: set.cuts.map(cut => ({
                  width_inches: cut.width,
                  quantity: cut.quantity,
                  client_name: cut.clientName || '',
                  client_id: cut.clientId || null,
                  source: cut.source,
                  order_id: cut.order_id || null,
                  order_item_id: cut.order_item_id || null,
                  source_pending_id: cut.source_pending_id || null,
                  source_type: cut.source_type || null,
                  paper_id: cut.paper_id || null,
                  trim_left: cut.trimLeft || 0,
                }))
              }))
          })).filter(jumbo => jumbo.sets.length > 0)
        })),
        orphaned_rolls: planState.orphanedRolls.map(orphan => ({
          width_inches: orphan.width,
          quantity: orphan.quantity,
          client_name: orphan.clientName || '',
          client_id: orphan.clientId || null,
          gsm: orphan.gsm,
          bf: orphan.bf,
          shade: orphan.shade,
          source: orphan.source,
          order_id: orphan.order_id || null,
          source_pending_id: orphan.source_pending_id || null,
          source_type: orphan.source_type || null,
        })),
        pending_orders: planState.pendingOrders || [],
        wastage_allocations: planState.wastageAllocations || [],
      };

      // Call new hybrid endpoint
      const productionResponse = await fetch(`${API_BASE_URL}/plans/hybrid/start-production`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(hybridRequest),
      });

      if (!productionResponse.ok) {
        const error = await productionResponse.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to start production');
      }

      const result = await productionResponse.json();

      setProductionResult(result);
      setProductionCreated(true);
      setActiveTab("production");

      // Store rollback info
      if (result.rollback_info?.rollback_available) {
        setCreatedPlanId(result.plan_id || null);
        setRollbackInfo(result.rollback_info);
        setRollbackTimeRemaining(result.rollback_info.minutes_remaining ?? 10);
      }

      let message = `Production started! Updated ${result.summary.orders_updated} orders`;
      if (result.summary.pending_items_created > 0) {
        message += `, created ${result.summary.pending_items_created} pending items`;
      }
      toast.success(message);

    } catch (error) {
      console.error('Failed to create production:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create production');
    } finally {
      setCreatingProduction(false);
    }
  };

  const toggleSpecExpand = (specId: string) => {
    setExpandedSpecs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(specId)) {
        newSet.delete(specId);
      } else {
        newSet.add(specId);
      }
      return newSet;
    });
  };

  const toggleJumboExpand = (jumboId: string) => {
    setExpandedJumbos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jumboId)) {
        newSet.delete(jumboId);
      } else {
        newSet.add(jumboId);
      }
      return newSet;
    });
  };

  // Countdown timer for rollback window
  useEffect(() => {
    if (!rollbackInfo?.rollback_available || rollbackTimeRemaining <= 0) return;
    const interval = setInterval(() => {
      setRollbackTimeRemaining((prev) => {
        const next = prev - 1 / 60;
        if (next <= 0) {
          clearInterval(interval);
          setRollbackInfo((r) => r ? { ...r, rollback_available: false } : r);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rollbackInfo?.rollback_available]);

  const handleOpenRollback = async () => {
    if (!createdPlanId) return;
    try {
      const status = await RollbackApiService.getRollbackStatus(createdPlanId);
      setRollbackStatus(status);
    } catch {
      setRollbackStatus(null);
    }
    setShowRollbackDialog(true);
  };

  const handleConfirmRollback = async () => {
    if (!createdPlanId) return;
    const userId = localStorage.getItem('user_id');
    if (!userId) { toast.error('User not authenticated'); return; }
    try {
      setRollingBack(true);
      const result = await RollbackApiService.rollbackPlan(createdPlanId, userId);
      if (result.success) {
        toast.success('Plan rolled back successfully. All changes have been undone.');
        setShowRollbackDialog(false);
        // Reset page state — plan is deleted
        setPlanState(null);
        setProductionCreated(false);
        setProductionResult(null);
        setSelectedOrders([]);
        setCreatedPlanId(null);
        setRollbackInfo(null);
        setActiveTab('orders');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setRollingBack(false);
    }
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!planState) return null;

    let totalJumbos = 0;
    let totalSets = 0;
    let selectedSetsCount = 0;
    let totalCuts = 0;
    let selectedCuts = 0;
    let pendingCuts = 0;
    let totalWidthUsed = 0;
    let totalAvailableWidth = 0;

    planState.paperSpecs.forEach(spec => {
      totalJumbos += spec.jumbos.length;
      spec.jumbos.forEach(jumbo => {
        totalSets += jumbo.sets.length;
        jumbo.sets.forEach(set => {
          const isSetSelected = selectedSets.has(set.id);
          if (isSetSelected) {
            selectedSetsCount++;
            selectedCuts += set.cuts.length;

            // Calculate width usage for selected sets
            const setWidth = set.cuts.reduce((sum, cut) => sum + (cut.width * cut.quantity), 0);
            totalWidthUsed += setWidth;
            totalAvailableWidth += planningWidth;
          }
          totalCuts += set.cuts.length;
          set.cuts.forEach(cut => {
            if (cut.source_type === 'pending_order' || cut.source_pending_id) {
              pendingCuts++;
            }
          });
        });
      });
    });

    // Calculate waste percentage: (total waste / total available width) * 100
    const totalWaste = totalAvailableWidth - totalWidthUsed;
    const wastePercentage = totalAvailableWidth > 0 ? (totalWaste / totalAvailableWidth) * 100 : 0;

    return {
      totalJumbos,
      totalSets,
      selectedSetsCount,
      totalCuts,
      selectedCuts,
      excludedCuts: totalCuts - selectedCuts,
      pendingCuts,
      orphanedCount: planState.orphanedRolls.length,
      estimatedWaste: wastePercentage,
    };
  }, [planState, selectedSets, planningWidth]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 m-4 md:m-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Hybrid Planning</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => router.push("/masters/plans")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Planning
          </Button>
          {planState && !productionCreated && (
            <Button
              onClick={handleStartProduction}
              disabled={creatingProduction || summaryStats?.selectedCuts === 0}
            >
              {creatingProduction ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                `Start Production (${summaryStats?.selectedCuts || 0} rolls)`
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Orphaned Rolls - Horizontal Bar (only show when plan exists and on edit-plan tab) */}
      {planState && planState.orphanedRolls.length > 0 && activeTab === "edit-plan" && (
        <Card className="border-orange-300 bg-orange-50/50">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Orphaned Rolls ({planState.orphanedRolls.length})
                <span className="text-sm font-normal text-muted-foreground">
                  - Will go to pending if not reassigned
                </span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {planState.orphanedRolls.map((cut) => {
                const isPending = cut.source_type === 'pending_order' || !!cut.source_pending_id || !!cut.isPendingOrphan;
                return (
                  <div
                    key={cut.id}
                    className="flex-shrink-0 border rounded-lg p-3 bg-white min-w-[200px] max-w-[250px]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{cut.width}"</span>
                        {cut.quantity > 1 && (
                          <span className="text-gray-500">×{cut.quantity}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Badge
                          variant={cut.source === 'algorithm' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {cut.source === 'algorithm' ? 'algo' : 'manual'}
                        </Badge>
                        {isPending && (
                          <Badge variant="destructive" className="text-xs bg-orange-500">
                            P
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 truncate">
                      {cut.clientName || 'No Client'}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {cut.gsm}gsm, {cut.bf}bf, {cut.shade}
                    </div>
                    <Select
                      onValueChange={(setId) => handleReassignOrphan(cut.id, setId)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Add to set..." />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Only show sets from matching paper spec */}
                        {planState.paperSpecs
                          .filter((spec) =>
                            spec.gsm === cut.gsm &&
                            spec.bf === cut.bf &&
                            spec.shade === cut.shade
                          )
                          .flatMap((spec) =>
                            spec.jumbos.flatMap((jumbo) =>
                              jumbo.sets.map((set) => (
                                <SelectItem key={set.id} value={set.id}>
                                  J#{jumbo.jumboNumber} Set#{set.setNumber} (
                                  {getRemainingWidthForSet(set, planningWidth)}" free)
                                </SelectItem>
                              ))
                            )
                          )}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="edit-plan" disabled={!planState}>
            Edit Plan
          </TabsTrigger>
          <TabsTrigger value="stock" disabled={!planState}>
            Stock ({planState?.wastageAllocations?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="pending" disabled={!planState}>
            Pending
          </TabsTrigger>
          <TabsTrigger value="production" disabled={!productionCreated}>
            Production
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          {/* Wastage Configuration */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Roll Width Configuration</CardTitle>
              <CardDescription>
                Configure wastage to determine planning width
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label>Wastage (inches)</Label>
                  <Input
                    type="number"
                    value={wastageInput}
                    onChange={(e) => setWastageInput(Number(e.target.value))}
                    disabled={!isEditingWastage}
                    min={1}
                    max={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Planning Width</Label>
                  <div className="text-2xl font-bold">{124 - wastageInput}"</div>
                </div>
                <div className="flex items-end">
                  {isEditingWastage ? (
                    <Button onClick={handleApplyWastage}>Apply Wastage</Button>
                  ) : (
                    <Button variant="outline" onClick={() => setIsEditingWastage(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleGeneratePlan}
                    disabled={generating || selectedOrders.length === 0 || isEditingWastage}
                    className="w-full"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Plan'
                    )}
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={includePendingOrders}
                    onCheckedChange={(checked) => setIncludePendingOrders(!!checked)}
                  />
                  <Label>Include pending orders</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={includeWastageAllocation}
                    onCheckedChange={(checked) => setIncludeWastageAllocation(!!checked)}
                  />
                  <Label>Include stock allocation</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Select Orders</CardTitle>
                  <CardDescription>
                    Choose orders to include in the plan ({selectedOrders.length} selected, {totalSelectedQuantity} rolls)
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllOrders}
                >
                  {selectedOrders.length === filteredOrders.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingOrders ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Loading orders...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No orders with 'created' status found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Paper Spec</TableHead>
                      <TableHead>Total Qty</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const firstItem = order.order_items?.[0];
                      const paper = firstItem?.paper;
                      const paperSpec = paper
                        ? `${paper.gsm}gsm, ${paper.bf}bf, ${paper.shade}`
                        : 'N/A';
                      const totalQty = order.order_items?.reduce(
                        (sum, item) => sum + item.quantity_rolls, 0
                      ) || 0;

                      return (
                        <TableRow
                          key={order.id}
                          className={`cursor-pointer ${
                            selectedOrders.includes(order.id) ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => handleOrderSelect(order.id)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={() => handleOrderSelect(order.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {order.frontend_id || order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{order.client?.company_name || 'N/A'}</TableCell>
                          <TableCell>{paperSpec}</TableCell>
                          <TableCell>{totalQty} rolls</TableCell>
                          <TableCell>
                            <Badge variant={
                              order.priority === 'urgent' ? 'destructive' :
                              order.priority === 'high' ? 'default' : 'secondary'
                            }>
                              {order.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-bold">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Plan Tab */}
        <TabsContent value="edit-plan">
          {planState && (
            <div className="space-y-4">
              {/* Summary Bar */}
              {summaryStats && (
                <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Jumbos:</span>
                    <span className="font-medium">{summaryStats.totalJumbos}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span className="text-sm">Sets:</span>
                    <span className="font-medium">{summaryStats.selectedSetsCount}/{summaryStats.totalSets}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span className="text-sm">Cuts for Production:</span>
                    <span className="font-medium">{summaryStats.selectedCuts}</span>
                  </div>
                  {summaryStats.excludedCuts > 0 && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <span className="text-sm">Excluded:</span>
                      <span className="font-medium">{summaryStats.excludedCuts}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-orange-500">
                    <span className="text-sm">From Pending:</span>
                    <span className="font-medium">{summaryStats.pendingCuts}</span>
                  </div>
                  {summaryStats.orphanedCount > 0 && (
                    <div className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">Orphaned:</span>
                      <span className="font-medium">{summaryStats.orphanedCount}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Main Editor - Full Width */}
              {planState.paperSpecs.map((spec) => {
                const specPending = (planState.pendingOrders || []).filter(
                  p => p.gsm === spec.gsm && p.bf === spec.bf && p.shade === spec.shade
                );
                const pendingOrphanCount = spec.jumbos.flatMap(j => j.sets).flatMap(s => s.cuts).filter(c => c.isPendingOrphan).length;
                return (
                <Card key={spec.id}>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleSpecExpand(spec.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedSpecs.has(spec.id) ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <CardTitle className="text-lg">
                          {spec.gsm}gsm, {spec.bf}bf, {spec.shade}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {specPending.length > 0 && (
                          <Badge className="bg-orange-100 text-orange-800 border border-orange-300 font-semibold">
                            {specPending.length} pending
                          </Badge>
                        )}
                        {pendingOrphanCount > 0 && (
                          <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 font-semibold">
                            {pendingOrphanCount} from pending
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {spec.jumbos.length} jumbos
                        </Badge>
                      </div>
                    </div>
                    {specPending.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                        {specPending.map((p, i) => (
                          <div key={i} className="text-xs bg-orange-50 border border-orange-200 rounded px-2 py-1 text-orange-800 flex items-center gap-1">
                            <span className="bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">P</span>
                            <span className="font-semibold">{p.width}"</span> × {p.quantity} — {p.client_name || 'N/A'}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardHeader>

                  {expandedSpecs.has(spec.id) && (
                    <CardContent className="space-y-4">
                      {spec.jumbos.map((jumbo) => (
                        <div key={jumbo.id} className="border rounded-lg p-4">
                          <div
                            className="flex items-center justify-between mb-3 cursor-pointer"
                            onClick={() => toggleJumboExpand(jumbo.id)}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={
                                  jumbo.sets.length > 0 && jumbo.sets.every(s => selectedSets.has(s.id))
                                    ? true
                                    : jumbo.sets.some(s => selectedSets.has(s.id))
                                    ? 'indeterminate'
                                    : false
                                }
                                onCheckedChange={() => handleToggleJumbo(jumbo)}
                                onClick={e => e.stopPropagation()}
                              />
                              {expandedJumbos.has(jumbo.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span className="font-medium">Jumbo #{jumbo.jumboNumber}</span>
                              <Badge variant="secondary" className="text-xs">
                                {jumbo.sets.reduce((sum, s) => sum + s.cuts.length, 0)} cuts
                              </Badge>
                            </div>
                          </div>

                          {expandedJumbos.has(jumbo.id) && (
                            <div className="space-y-4">
                              {[...jumbo.sets].map((set) => (
                                <RollSet
                                  key={set.id}
                                  set={set}
                                  planningWidth={planningWidth}
                                  isSelected={selectedSets.has(set.id)}
                                  onToggleSet={handleToggleSet}
                                  onEditCut={handleEditCut}
                                  onDeleteCut={handleDeleteCut}
                                  onAddCut={handleAddCut}
                                  paperSpec={{ gsm: spec.gsm, bf: spec.bf, shade: spec.shade }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddJumbo(spec.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Jumbo Roll
                      </Button>
                    </CardContent>
                  )}
                </Card>
              );
              })}
            </div>
          )}
        </TabsContent>

        {/* Stock Tab */}
        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>Stock Allocations</CardTitle>
              <CardDescription>
                Wastage/stock items allocated from inventory for this plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              {planState ? (
                <WastageAllocationTable
                  wastageAllocations={planState.wastageAllocations}
                  orders={orders}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Generate a plan to view stock allocations
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Pending Orders from Algorithm
              </CardTitle>
              <CardDescription>
                Orders that couldn't be fully fulfilled and will be marked as pending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {planState ? (
                <>
                  
                  <PendingOrdersTable pendingOrders={planState.pendingOrders} />
                  {planState.orphanedRolls.length > 0 && (
                    <>
                        <div className="text-sm flex items-center gap-2 text-orange-700">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          Orphaned Rolls — Will be moved to pending
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Width</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Paper Spec</TableHead>
                              <TableHead>Client</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.values(
                              planState.orphanedRolls.reduce((acc, orphan) => {
                                const key = `${orphan.order_item_id || ''}-${orphan.width}-${orphan.clientId || ''}`;
                                if (acc[key]) {
                                  acc[key].quantity += orphan.quantity;
                                } else {
                                  acc[key] = { ...orphan };
                                }
                                return acc;
                              }, {} as Record<string, any>)
                            ).map((orphan: any) => (
                              <TableRow key={orphan.id}>
                                <TableCell className="font-medium flex items-center gap-2">
                                  {orphan.isPendingOrphan && (
                                    <span className="bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">P</span>
                                  )}
                                  {orphan.width}"
                                </TableCell>
                                <TableCell>{orphan.quantity}</TableCell>
                                <TableCell>{orphan.gsm}gsm, {orphan.bf}bf, {orphan.shade}</TableCell>
                                <TableCell>{orphan.clientName || 'N/A'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Generate a plan to view pending orders
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production">
          {productionCreated && productionResult && (
            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="text-green-600">Production Started Successfully!</CardTitle>
                <CardDescription>
                  Production hierarchy with jumbo rolls and cut rolls
                </CardDescription>
              </CardHeader>
              <CardContent>

                {/* Rollback Banner */}
                {rollbackInfo?.rollback_available && createdPlanId && (
                  <div className="mb-6 p-4 border border-amber-300 bg-amber-50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Timer className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800">Rollback available</p>
                        <p className="text-sm text-amber-700">
                          Window closes in{" "}
                          <span className={`font-bold ${rollbackTimeRemaining <= 3 ? "text-red-600" : "text-amber-800"}`}>
                            {RollbackApiService.formatTimeRemaining(rollbackTimeRemaining)}
                          </span>
                          {" "}— undo all changes made by this plan.
                        </p>
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 w-full bg-amber-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              rollbackTimeRemaining > 7 ? "bg-green-500" :
                              rollbackTimeRemaining > 3 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${RollbackApiService.getProgressValue(rollbackTimeRemaining)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-400 text-amber-800 hover:bg-amber-100 shrink-0"
                      onClick={handleOpenRollback}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Rollback Plan
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{productionResult.production_hierarchy?.length || 0}</div>
                    <div className="text-sm text-gray-500">Jumbo Rolls</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{productionResult.summary?.cut_rolls_created || 0}</div>
                    <div className="text-sm text-gray-500">Cut Rolls</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{productionResult.summary?.orders_updated || 0}</div>
                    <div className="text-sm text-gray-500">Orders Updated</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{productionResult.summary?.pending_items_created || 0}</div>
                    <div className="text-sm text-gray-500">Pending Items</div>
                  </div>
                </div>

                {/* Production Hierarchy */}
                <div className="space-y-4">
                  {productionResult.production_hierarchy?.map((jumboGroup: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4 bg-primary/5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-lg font-bold">
                          J
                        </div>
                        <div>
                          <div className="font-bold text-primary">
                            Jumbo: {jumboGroup.jumbo_roll?.barcode_id || 'Unknown'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {jumboGroup.jumbo_roll?.paper_spec || 'Unknown Spec'} •
                            {jumboGroup.cut_rolls?.length || 0} cut rolls
                          </div>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Barcode</TableHead>
                            <TableHead>Width</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jumboGroup.cut_rolls?.map((cutRoll: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <code className="text-sm">{cutRoll.barcode_id}</code>
                              </TableCell>
                              <TableCell>{cutRoll.width_inches}"</TableCell>
                              <TableCell>{cutRoll.client_name || 'N/A'}</TableCell>
                              <TableCell>
                                <Badge variant="default">{cutRoll.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-6">
                  <Button onClick={() => router.push('/dashboard')}>
                    Go to Dashboard
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setPlanState(null);
                    setProductionCreated(false);
                    setProductionResult(null);
                    setSelectedOrders([]);
                    setActiveTab("orders");
                  }}>
                    Create Another Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Cut Roll Dialog */}
      <Dialog open={showAddCutDialog} onOpenChange={setShowAddCutDialog}>
        <DialogContent className="flex flex-col max-h-[90dvh] sm:max-w-xl max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:w-full max-sm:max-w-full max-sm:max-h-[85dvh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Add Cut Roll</DialogTitle>
            <DialogDescription>
              Add from orphaned rolls or create a new manual roll
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1">

          {/* Orphaned Rolls Section - Only show orphans matching the paper spec */}
          {planState && currentPaperSpec && (() => {
            // Filter orphaned rolls to only show those matching the target set's paper spec
            const matchingOrphans = planState.orphanedRolls.filter(orphan =>
              orphan.gsm === currentPaperSpec.gsm &&
              orphan.bf === currentPaperSpec.bf &&
              orphan.shade === currentPaperSpec.shade
            );

            if (matchingOrphans.length === 0) return null;

            return (
              <div className="space-y-2">
                <Label className="text-orange-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Assign Orphaned Roll
                  <span className="text-xs font-normal text-muted-foreground">
                    ({currentPaperSpec.gsm}gsm, {currentPaperSpec.bf}bf, {currentPaperSpec.shade})
                  </span>
                </Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg bg-orange-50">
                  {matchingOrphans.map((orphan) => {
                    const isPending = orphan.source_type === 'pending_order' || !!orphan.source_pending_id;
                    return (
                      <Button
                        key={orphan.id}
                        variant="outline"
                        size="sm"
                        className="justify-start h-auto py-2 px-3"
                        onClick={() => handleAssignOrphan(orphan.id)}
                      >
                        <div className="text-left">
                          <div className="font-medium">
                            {orphan.width}" {orphan.quantity > 1 && `×${orphan.quantity}`}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {orphan.clientName || 'No Client'}
                            {isPending && ' (P)'}
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
                <div className="text-center text-sm text-muted-foreground py-2">
                  — or create new —
                </div>
              </div>
            );
          })()}

          {/* Mode Toggle */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={!cutRollForm.assignFromOrder ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setCutRollForm(prev => ({ ...prev, assignFromOrder: false, orderId: '', orderItemId: '', width: '' }))}
            >
              Manual Roll
            </Button>
            <Button
              variant={cutRollForm.assignFromOrder ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setCutRollForm(prev => ({ ...prev, assignFromOrder: true, clientId: '', width: '' }))}
            >
              From Order
            </Button>
          </div>

          {cutRollForm.assignFromOrder ? (
            /* Order Roll Suggestions */
            (() => {
              const suggestions = orders
                .filter(o =>
                  o.status === 'created' &&
                  !planState?.selectedOrderIds.includes(o.id)
                )
                .flatMap(o =>
                  o.order_items
                    .filter(item =>
                      item.paper?.gsm === currentPaperSpec?.gsm &&
                      item.paper?.bf === currentPaperSpec?.bf &&
                      item.paper?.shade === currentPaperSpec?.shade &&
                      item.width_inches <= currentSetRemainingWidth &&
                      (item.quantity_rolls - item.quantity_fulfilled - (manualOrderCutCounts[item.id] || 0)) > 0
                    )
                    .map(item => ({ order: o, item, remaining: item.quantity_rolls - item.quantity_fulfilled - (manualOrderCutCounts[item.id] || 0) }))
                )
                .sort((a, b) => b.item.width_inches - a.item.width_inches);

              if (suggestions.length === 0) {
                return (
                  <p className="text-sm text-red-500">
                    No rolls available for the remaining {currentSetRemainingWidth}" space
                  </p>
                );
              }

              return (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {suggestions.map(({ order, item, remaining }) => {
                    const defaultQty = 1;
                    const qtyValue = suggestionQuantities[item.id] ?? String(defaultQty);
                    const parsedQty = Math.min(Math.max(parseInt(qtyValue) || 1, 1), remaining);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{item.width_inches}"</span>
                          <span className="text-muted-foreground ml-2">
                            {remaining} remaining · {order.frontend_id || order.id.slice(0, 8)}
                          </span>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{order.client.company_name}</div>
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={remaining}
                          value={qtyValue}
                          onChange={(e) => setSuggestionQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          className="w-14 h-7 rounded border px-2 text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFromOrderSuggestion(order.id, item.id, item.width_inches, parsedQty)}
                          className="text-xs text-green-600 font-medium shrink-0 hover:text-green-700"
                        >
                          + Add
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            /* Manual Roll Form */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="space-y-2 flex-1">
                  <Label>Width (in)</Label>
                  <Input
                    type="number"
                    value={cutRollForm.width}
                    onChange={(e) => setCutRollForm(prev => ({ ...prev, width: e.target.value }))}
                    placeholder="e.g., 24"
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    value={cutRollForm.quantity}
                    onChange={(e) => setCutRollForm(prev => ({ ...prev, quantity: e.target.value }))}
                    min={1}
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Client (optional)</Label>
                  <Select
                    value={cutRollForm.clientId}
                    onValueChange={(value) => setCutRollForm(prev => ({ ...prev, clientId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectSearch
                        value={clientSelectSearch}
                        onChange={(e) => setClientSelectSearch(e.target.value)}
                        placeholder="Search client..."
                      />
                      {clients
                        .filter(c => c.company_name.toLowerCase().includes(clientSelectSearch.toLowerCase()))
                        .map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.company_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* AI Client Suggestions */}
              {clientSuggestionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finding suggestions...
                </div>
              ) : clientSuggestions.length > 0 && (() => {
                const planClientIds = new Set(
                  (planState?.paperSpecs.flatMap(s => s.jumbos.flatMap(j => j.sets.flatMap(st => st.cuts.filter(c => c.source_type === 'regular_order').map(c => c.clientId).filter(Boolean)))) || []).map(id => id!.toLowerCase())
                );
                const sorted = [...clientSuggestions].sort((a, b) => {
                  const aIn = planClientIds.has(a.client_id?.toLowerCase()) ? 0 : 1;
                  const bIn = planClientIds.has(b.client_id?.toLowerCase()) ? 0 : 1;
                  return aIn - bIn;
                });
                // Flatten to per-roll rows and sort by width descending
                const flatRows = sorted.flatMap(suggestion =>
                  suggestion.suggested_widths.map((w: any) => ({
                    client_id: suggestion.client_id,
                    client_name: suggestion.client_name,
                    inPlan: planClientIds.has(suggestion.client_id?.toLowerCase()),
                    width: w.width,
                    frequency: w.frequency,
                    days_ago: w.days_ago,
                  }))
                ).sort((a, b) => b.width - a.width);

                return (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-green-700">
                    Suggested Rolls (based on past orders)
                  </div>
                  <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
                    {flatRows.map((row, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-muted/40">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-semibold text-sm w-12 shrink-0">{row.width}"</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm truncate">{row.client_name}</span>
                              {row.inPlan && (
                                <span className="text-[10px] text-blue-600 font-semibold bg-blue-100 px-1.5 py-0.5 rounded shrink-0">In Plan</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{row.frequency} order{row.frequency > 1 ? 's' : ''}</span>
                              {row.days_ago !== null && (
                                <span className="text-blue-600">
                                  Last: {row.days_ago === 0 ? 'Today' : row.days_ago === 1 ? 'Yesterday' : `${row.days_ago}d ago`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 px-3 text-xs shrink-0"
                          onClick={() => {
                            const matched = clients.find(c => c.id.toLowerCase() === row.client_id.toLowerCase());
                            if (matched) setCutRollForm(prev => ({ ...prev, clientId: matched.id, width: row.width.toString() }));
                          }}
                        >Use</Button>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })()}
            </div>
          )}

          </div>

          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button variant="outline" onClick={() => setShowAddCutDialog(false)}>
              Cancel
            </Button>
            {!cutRollForm.assignFromOrder && (
              <Button onClick={handleSaveNewCut}>Add New Roll</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Cut Roll Dialog */}
      <Dialog open={showEditCutDialog} onOpenChange={setShowEditCutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cut Roll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Width (inches)</Label>
              <Input
                type="number"
                value={cutRollForm.width}
                onChange={(e) => setCutRollForm(prev => ({ ...prev, width: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={cutRollForm.quantity}
                onChange={(e) => setCutRollForm(prev => ({ ...prev, quantity: e.target.value }))}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={cutRollForm.clientId}
                onValueChange={(value) => setCutRollForm(prev => ({ ...prev, clientId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingCut?.source === 'algorithm' && (
              <div className="p-3 bg-blue-50 rounded-md text-sm text-blue-700">
                This roll is linked to an order. Editing preserves the order linkage.
              </div>
            )}
            {(editingCut?.source_type === 'pending_order' || editingCut?.source_pending_id) && (
              <div className="p-3 bg-orange-50 rounded-md text-sm text-orange-700">
                This roll is from a pending order.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditCut}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Orphaned Rolls Warning</DialogTitle>
            <DialogDescription>
              You have {planState?.orphanedRolls.length} orphaned rolls that will be moved to pending items.
              Do you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createProduction}>
              Continue Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              Rollback Plan
            </DialogTitle>
            <DialogDescription>
              This will completely undo the hybrid plan execution.
            </DialogDescription>
          </DialogHeader>

          {/* Safety check result */}
          {rollbackStatus && (
            <div className={`p-3 rounded-md text-sm ${rollbackStatus.safety_check?.safe ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
              {rollbackStatus.safety_check?.safe
                ? '✅ Safe to rollback — no external changes detected.'
                : `⚠️ ${rollbackStatus.safety_check?.reason}`}
            </div>
          )}

          {/* Time remaining */}
          {rollbackTimeRemaining > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />
              Window closes in{" "}
              <span className={`font-bold ${rollbackTimeRemaining <= 3 ? "text-red-600" : ""}`}>
                {RollbackApiService.formatTimeRemaining(rollbackTimeRemaining)}
              </span>
            </div>
          )}

          {/* Warning list */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            <p className="font-semibold mb-1">This action will:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Delete all inventory created by this plan</li>
              <li>Restore original order statuses and quantities</li>
              <li>Undo pending order modifications</li>
              <li>Delete the plan record permanently</li>
            </ul>
            <p className="mt-2 font-semibold">This cannot be undone.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRollbackDialog(false)} disabled={rollingBack}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRollback}
              disabled={rollingBack || rollbackTimeRemaining <= 0}
            >
              {rollingBack ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rolling Back...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Confirm Rollback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
