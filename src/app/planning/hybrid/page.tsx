"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchOrders, Order } from "@/lib/orders";
import { fetchClients, Client } from "@/lib/clients";
import {
  processMultipleOrders,
  calculateEfficiencyMetrics,
  OptimizationResult,
  WorkflowProcessRequest,
  PendingOrder,
} from "@/lib/new-flow";
import { API_BASE_URL } from "@/lib/api-config";
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
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Package,
  FileText,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Pencil,
  GripVertical,
  AlertTriangle,
  Loader2,
  X,
  RotateCcw,
  Clock,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ============================================
// TYPES
// ============================================

interface EditableCutRoll {
  id: string;
  width: number;
  quantity: number;
  clientName: string;
  clientId?: string;
  source: 'algorithm' | 'manual';
  order_id?: string;
  source_pending_id?: string;
  source_type?: 'regular_order' | 'pending_order';
  paper_id?: string;
  selected: boolean;
  trimLeft?: number;
  originalWidth?: number;
  originalQuantity?: number;
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
  planningWidth: number,
  orders: Order[]
): HybridPlanState {
  const paperSpecMap = new Map<string, PaperSpecGroup>();

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
    const jumboNumber = Math.ceil(rollNum / 3);
    const setNumber = ((rollNum - 1) % 3) + 1;

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

    // Get client name
    let clientName = '';
    if (roll.source_type === 'pending_order' && roll.source_pending_id) {
      const pendingOrder = result.pending_orders?.find((p: any) => p.id === roll.source_pending_id);
      if (pendingOrder?.client_name) {
        clientName = pendingOrder.client_name;
      }
    } else {
      const sourceOrder = orders.find(o => o.id === roll.order_id);
      if (sourceOrder?.client?.company_name) {
        clientName = sourceOrder.client.company_name;
      }
    }

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
    });
  });

  paperSpecMap.forEach(spec => {
    spec.jumbos.sort((a, b) => a.jumboNumber - b.jumboNumber);
  });

  return {
    wastage: 124 - planningWidth,
    planningWidth,
    selectedOrderIds: [],
    paperSpecs: Array.from(paperSpecMap.values()),
    orphanedRolls: [],
    isGenerated: true,
    isModified: false,
    pendingOrders: result.pending_orders || [],
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
}: {
  cuts: EditableCutRoll[];
  planningWidth: number;
}) {
  const totalUsed = cuts.reduce((sum, cut) => sum + (cut.width * cut.quantity), 0);
  const waste = planningWidth - totalUsed;
  const wastePercentage = (waste / planningWidth) * 100;
  const efficiency = ((totalUsed / planningWidth) * 100).toFixed(1);

  let currentPosition = 0;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Cutting Pattern ({planningWidth}" Roll):
      </div>
      <div className="relative h-14 bg-muted rounded-lg border overflow-hidden">
        {cuts.map((cut, index) => {
          const widthForCut = cut.width * cut.quantity;
          const widthPercentage = (widthForCut / planningWidth) * 100;
          const leftPosition = (currentPosition / planningWidth) * 100;
          currentPosition += widthForCut;

          const isPending = cut.source_type === 'pending_order' || !!cut.source_pending_id;

          return (
            <div
              key={cut.id}
              className={`absolute h-full border-r-2 border-white ${
                cut.selected
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

      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="text-center p-2 bg-primary/10 rounded-lg">
          <div className="font-semibold text-primary">{totalUsed}"</div>
          <div className="text-xs text-muted-foreground">Used</div>
        </div>
        <div className="text-center p-2 bg-destructive/10 rounded-lg">
          <div className="font-semibold text-destructive">{waste.toFixed(1)}"</div>
          <div className="text-xs text-muted-foreground">Waste</div>
        </div>
        <div className="text-center p-2 bg-green-500/10 rounded-lg">
          <div className="font-semibold text-green-700">{efficiency}%</div>
          <div className="text-xs text-muted-foreground">Efficiency</div>
        </div>
        <div className="text-center p-2 bg-secondary rounded-lg">
          <div className="font-semibold">{cuts.length}</div>
          <div className="text-xs text-muted-foreground">Cuts</div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DRAGGABLE CUT ROLL COMPONENT
// ============================================

function DraggableCutRoll({
  cut,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  cut: EditableCutRoll;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cut.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isPending = cut.source_type === 'pending_order' || !!cut.source_pending_id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-white border rounded-md ${
        isDragging ? 'shadow-lg' : ''
      } ${!cut.selected ? 'opacity-50 bg-gray-50' : ''}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>

      <Checkbox
        checked={cut.selected}
        onCheckedChange={onToggleSelect}
      />

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

      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete}>
        <Trash2 className="h-3 w-3 text-red-500" />
      </Button>
    </div>
  );
}

// ============================================
// DROPPABLE SET COMPONENT
// ============================================

function DroppableRollSet({
  set,
  planningWidth,
  onToggleSelect,
  onEditCut,
  onDeleteCut,
  onAddCut,
}: {
  set: RollSetGroup;
  planningWidth: number;
  onToggleSelect: (cutId: string) => void;
  onEditCut: (cutId: string) => void;
  onDeleteCut: (cutId: string) => void;
  onAddCut: (setId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: set.id,
  });

  const totalWidth = getTotalWidthForSet(set);
  const remainingWidth = getRemainingWidthForSet(set, planningWidth);

  return (
    <div
      ref={setNodeRef}
      className={`border rounded-lg p-3 ${isOver ? 'border-blue-500 bg-blue-50' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
            {set.setNumber}
          </div>
          <span className="font-medium">Set #{set.setNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          {remainingWidth < 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Exceeds
            </Badge>
          )}
          <span className="text-sm text-gray-500">
            {totalWidth}" / {planningWidth}"
          </span>
        </div>
      </div>

      {/* Visual Cutting Pattern */}
      {set.cuts.length > 0 && (
        <div className="mb-4">
          <CuttingPatternVisual cuts={set.cuts} planningWidth={planningWidth} />
        </div>
      )}

      <SortableContext items={set.cuts.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {set.cuts.map((cut) => (
            <DraggableCutRoll
              key={cut.id}
              cut={cut}
              onToggleSelect={() => onToggleSelect(cut.id)}
              onEdit={() => onEditCut(cut.id)}
              onDelete={() => onDeleteCut(cut.id)}
            />
          ))}
        </div>
      </SortableContext>

      {set.cuts.length === 0 && (
        <div className="text-center py-4 text-gray-400 text-sm border-2 border-dashed rounded-lg">
          Drop rolls here or add new
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2 text-gray-500"
        onClick={() => onAddCut(set.id)}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add Cut Roll
      </Button>
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

  // UI state
  const [activeTab, setActiveTab] = useState("orders");
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());
  const [expandedJumbos, setExpandedJumbos] = useState<Set<string>>(new Set());
  const [showAddCutDialog, setShowAddCutDialog] = useState(false);
  const [showEditCutDialog, setShowEditCutDialog] = useState(false);
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [editingCut, setEditingCut] = useState<EditableCutRoll | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [includePendingOrders, setIncludePendingOrders] = useState(true);
  const [includeWastageAllocation, setIncludeWastageAllocation] = useState(true);

  // Cut roll form
  const [cutRollForm, setCutRollForm] = useState({
    width: '',
    quantity: '1',
    clientId: '',
  });

  // Drag state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Calculate planning width
  const planningWidth = useMemo(() => {
    return Math.max(124 - appliedWastage, 50);
  }, [appliedWastage]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      const nestedState = transformToNestedStructure(result, planningWidth, orders);
      nestedState.selectedOrderIds = selectedOrders;

      setPlanState(nestedState);

      // Expand all specs by default
      const allSpecIds = new Set(nestedState.paperSpecs.map(s => s.id));
      setExpandedSpecs(allSpecIds);

      // Expand all jumbos by default
      const allJumboIds = new Set<string>();
      nestedState.paperSpecs.forEach(spec => {
        spec.jumbos.forEach(jumbo => {
          allJumboIds.add(jumbo.id);
        });
      });
      setExpandedJumbos(allJumboIds);

      setActiveTab("edit-plan");
      toast.success('Plan generated successfully!');

    } catch (error) {
      console.error('Failed to generate plan:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleSelect = (cutId: string) => {
    if (!planState) return;

    setPlanState(prev => {
      if (!prev) return prev;

      const newSpecs = prev.paperSpecs.map(spec => ({
        ...spec,
        jumbos: spec.jumbos.map(jumbo => ({
          ...jumbo,
          sets: jumbo.sets.map(set => ({
            ...set,
            cuts: set.cuts.map(cut =>
              cut.id === cutId ? { ...cut, selected: !cut.selected } : cut
            ),
          })),
        })),
      }));

      return { ...prev, paperSpecs: newSpecs, isModified: true };
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
        orphanedRolls: [...prev.orphanedRolls, foundCut!],
        isModified: true,
      };
    });

    toast.info('Roll moved to orphaned panel');
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

  const handleAddCut = (setId: string) => {
    setCurrentSetId(setId);
    setCutRollForm({ width: '', quantity: '1', clientId: '' });
    setShowAddCutDialog(true);
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
    let targetSpec: PaperSpecGroup | null = null;

    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        const set = jumbo.sets.find(s => s.id === currentSetId);
        if (set) {
          targetSet = set;
          targetSpec = spec;
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

    const newCut: EditableCutRoll = {
      id: `cut-${generateId()}`,
      width,
      quantity,
      clientName: client?.company_name || '',
      clientId: cutRollForm.clientId || undefined,
      source: 'manual',
      selected: true,
    };

    setPlanState(prev => {
      if (!prev) return prev;

      const newSpecs = prev.paperSpecs.map(spec => ({
        ...spec,
        jumbos: spec.jumbos.map(jumbo => ({
          ...jumbo,
          sets: jumbo.sets.map(set => {
            if (set.id === currentSetId) {
              return { ...set, cuts: [...set.cuts, newCut] };
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
      setEditingCut(foundCut);
      setCutRollForm({
        width: foundCut.width.toString(),
        quantity: foundCut.quantity.toString(),
        clientId: foundCut.clientId || '',
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

    setPlanState(prev => {
      if (!prev) return prev;

      const newSpecs = prev.paperSpecs.map(spec => {
        if (spec.id === specId) {
          const maxJumboNum = Math.max(...spec.jumbos.map(j => j.jumboNumber), 0);
          const newJumbo: JumboRollGroup = {
            id: `jumbo-${generateId()}`,
            jumboNumber: maxJumboNum + 1,
            sets: [
              { id: `set-${generateId()}-1`, setNumber: 1, cuts: [] },
              { id: `set-${generateId()}-2`, setNumber: 2, cuts: [] },
              { id: `set-${generateId()}-3`, setNumber: 3, cuts: [] },
            ],
          };
          return { ...spec, jumbos: [...spec.jumbos, newJumbo] };
        }
        return spec;
      });

      return { ...prev, paperSpecs: newSpecs, isModified: true };
    });

    toast.success('Jumbo roll added');
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || !planState) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    let sourceCut: EditableCutRoll | null = null;
    let sourceSetId: string | null = null;

    for (const spec of planState.paperSpecs) {
      for (const jumbo of spec.jumbos) {
        for (const set of jumbo.sets) {
          const cut = set.cuts.find(c => c.id === activeId);
          if (cut) {
            sourceCut = cut;
            sourceSetId = set.id;
            break;
          }
        }
      }
    }

    if (!sourceCut || !sourceSetId) return;

    const isDroppedOnSet = planState.paperSpecs.some(spec =>
      spec.jumbos.some(jumbo =>
        jumbo.sets.some(set => set.id === overId)
      )
    );

    if (isDroppedOnSet && overId !== sourceSetId) {
      let targetSet: RollSetGroup | null = null;

      for (const spec of planState.paperSpecs) {
        for (const jumbo of spec.jumbos) {
          const set = jumbo.sets.find(s => s.id === overId);
          if (set) {
            targetSet = set;
            break;
          }
        }
      }

      if (!targetSet) return;

      const newTotalWidth = getTotalWidthForSet(targetSet) + (sourceCut.width * sourceCut.quantity);
      if (newTotalWidth > planningWidth) {
        toast.error(`Cannot move: would exceed ${planningWidth}" limit`);
        return;
      }

      setPlanState(prev => {
        if (!prev) return prev;

        const newSpecs = prev.paperSpecs.map(spec => ({
          ...spec,
          jumbos: spec.jumbos.map(jumbo => ({
            ...jumbo,
            sets: jumbo.sets.map(set => {
              if (set.id === sourceSetId) {
                return { ...set, cuts: set.cuts.filter(c => c.id !== activeId) };
              }
              if (set.id === overId) {
                return { ...set, cuts: [...set.cuts, sourceCut!] };
              }
              return set;
            }),
          })),
        }));

        return { ...prev, paperSpecs: newSpecs, isModified: true };
      });

      toast.success('Roll moved to new set');
    } else {
      setPlanState(prev => {
        if (!prev) return prev;

        const newSpecs = prev.paperSpecs.map(spec => ({
          ...spec,
          jumbos: spec.jumbos.map(jumbo => ({
            ...jumbo,
            sets: jumbo.sets.map(set => {
              if (set.id === sourceSetId) {
                const oldIndex = set.cuts.findIndex(c => c.id === activeId);
                const newIndex = set.cuts.findIndex(c => c.id === overId);

                if (oldIndex !== -1 && newIndex !== -1) {
                  return { ...set, cuts: arrayMove(set.cuts, oldIndex, newIndex) };
                }
              }
              return set;
            }),
          })),
        }));

        return { ...prev, paperSpecs: newSpecs, isModified: true };
      });
    }
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

      const allCuts: any[] = [];
      const selectedCuts: any[] = [];
      let rollIndex = 0;

      planState.paperSpecs.forEach(spec => {
        spec.jumbos.forEach(jumbo => {
          jumbo.sets.forEach(set => {
            set.cuts.forEach(cut => {
              const cutData = {
                paper_id: cut.paper_id || '',
                width_inches: cut.width,
                qr_code: `CUT_ROLL_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${rollIndex}`,
                barcode_id: `CR_${String(rollIndex + 1).padStart(5, '0')}`,
                gsm: spec.gsm,
                bf: spec.bf,
                shade: spec.shade,
                individual_roll_number: (jumbo.jumboNumber - 1) * 3 + set.setNumber,
                trim_left: cut.trimLeft || 0,
                order_id: cut.order_id || null,
                source_type: cut.source_type || (cut.source === 'manual' ? 'manual' : 'regular_order'),
                source_pending_id: cut.source_pending_id || null,
              };

              allCuts.push(cutData);

              if (cut.selected) {
                selectedCuts.push(cutData);
              }

              rollIndex++;
            });
          });
        });
      });

      planState.orphanedRolls.forEach(cut => {
        const specKey = planState.paperSpecs[0];

        allCuts.push({
          paper_id: cut.paper_id || '',
          width_inches: cut.width,
          qr_code: `CUT_ROLL_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${rollIndex}`,
          barcode_id: `CR_${String(rollIndex + 1).padStart(5, '0')}`,
          gsm: specKey?.gsm || 0,
          bf: specKey?.bf || 0,
          shade: specKey?.shade || '',
          individual_roll_number: 0,
          trim_left: 0,
          order_id: cut.order_id || null,
          source_type: cut.source_type || 'regular_order',
          source_pending_id: cut.source_pending_id || null,
        });

        rollIndex++;
      });

      const cutPattern = allCuts.map((cut) => ({
        width: cut.width_inches,
        gsm: cut.gsm,
        bf: cut.bf,
        shade: cut.shade,
        individual_roll_number: cut.individual_roll_number,
        source: 'cutting',
        order_id: cut.order_id || '',
        selected: selectedCuts.some(sc => sc.barcode_id === cut.barcode_id),
        source_type: cut.source_type,
        source_pending_id: cut.source_pending_id,
        company_name: '',
      }));

      const efficiency = calculateEfficiencyMetrics(
        selectedCuts.map(c => ({
          width: c.width_inches,
          quantity: 1,
          gsm: c.gsm,
          bf: c.bf,
          shade: c.shade,
          source: 'cutting' as const,
          individual_roll_number: c.individual_roll_number,
        }))
      );

      const idempotencyKey = `plan-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      const planCreateRequest = {
        name: `Hybrid Plan - ${new Date().toISOString().split('T')[0]}`,
        cut_pattern: cutPattern,
        wastage_allocations: planState.wastageAllocations || [],
        expected_waste_percentage: Math.max(0, 100 - efficiency.averageEfficiency),
        created_by_id: userId,
        order_ids: planState.selectedOrderIds,
        pending_orders: planState.pendingOrders || [],
      };

      const planResponse = await fetch(`${API_BASE_URL}/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(planCreateRequest),
      });

      if (!planResponse.ok) {
        const error = await planResponse.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to create plan');
      }

      const createdPlan = await planResponse.json();
      const planId = createdPlan.id;

      const productionRequest = {
        selected_cut_rolls: selectedCuts,
        all_available_cuts: allCuts,
        wastage_data: [],
        added_rolls_data: {},
        created_by_id: userId,
        jumbo_roll_width: planningWidth,
      };

      const productionResponse = await fetch(`${API_BASE_URL}/plans/${planId}/start-production`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(productionRequest),
      });

      if (!productionResponse.ok) {
        const error = await productionResponse.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to start production');
      }

      const result = await productionResponse.json();

      setProductionResult(result);
      setProductionCreated(true);
      setActiveTab("production");

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

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!planState) return null;

    let totalJumbos = 0;
    let totalSets = 0;
    let totalCuts = 0;
    let selectedCuts = 0;
    let unselectedCuts = 0;
    let pendingCuts = 0;

    planState.paperSpecs.forEach(spec => {
      totalJumbos += spec.jumbos.length;
      spec.jumbos.forEach(jumbo => {
        totalSets += jumbo.sets.length;
        jumbo.sets.forEach(set => {
          totalCuts += set.cuts.length;
          set.cuts.forEach(cut => {
            if (cut.selected) selectedCuts++;
            else unselectedCuts++;
            if (cut.source_type === 'pending_order' || cut.source_pending_id) {
              pendingCuts++;
            }
          });
        });
      });
    });

    return {
      totalJumbos,
      totalSets,
      totalCuts,
      selectedCuts,
      unselectedCuts,
      pendingCuts,
      orphanedCount: planState.orphanedRolls.length,
    };
  }, [planState]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 m-4 md:m-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Hybrid Planning</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => router.push("/planning")}>
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
                const isPending = cut.source_type === 'pending_order' || !!cut.source_pending_id;
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
                    <div className="text-sm text-gray-600 mb-2 truncate">
                      {cut.clientName || 'No Client'}
                    </div>
                    <Select
                      onValueChange={(setId) => handleReassignOrphan(cut.id, setId)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Add to set..." />
                      </SelectTrigger>
                      <SelectContent>
                        {planState.paperSpecs.flatMap((spec) =>
                          spec.jumbos.flatMap((jumbo) =>
                            jumbo.sets.map((set) => (
                              <SelectItem key={set.id} value={set.id}>
                                {spec.gsm}gsm J#{jumbo.jumboNumber} Set#{set.setNumber} (
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
            Pending ({planState?.pendingOrders?.length || 0})
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Total Cuts:</span>
                    <span className="font-medium">{summaryStats.totalCuts}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span className="text-sm">Selected:</span>
                    <span className="font-medium">{summaryStats.selectedCuts}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <span className="text-sm">Unselected:</span>
                    <span className="font-medium">{summaryStats.unselectedCuts}</span>
                  </div>
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
              <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  {planState.paperSpecs.map((spec) => (
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
                          <Badge variant="outline">
                            {spec.jumbos.length} jumbos
                          </Badge>
                        </div>
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {jumbo.sets.map((set) => (
                                    <DroppableRollSet
                                      key={set.id}
                                      set={set}
                                      planningWidth={planningWidth}
                                      onToggleSelect={handleToggleSelect}
                                      onEditCut={handleEditCut}
                                      onDeleteCut={handleDeleteCut}
                                      onAddCut={handleAddCut}
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
                  ))}
                </DndContext>
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
            <CardContent>
              {planState ? (
                <PendingOrdersTable pendingOrders={planState.pendingOrders} />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cut Roll</DialogTitle>
            <DialogDescription>
              Add a manual cut roll (no order linkage)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Width (inches)</Label>
              <Input
                type="number"
                value={cutRollForm.width}
                onChange={(e) => setCutRollForm(prev => ({ ...prev, width: e.target.value }))}
                placeholder="e.g., 24"
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
              <Label>Client (optional)</Label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNewCut}>Add</Button>
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
    </div>
  );
}
