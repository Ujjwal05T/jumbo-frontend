/**
 * Edit Dispatch Modal - High Performance Version v2
 * Shows currently dispatched items separately so they can be removed
 */
"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Truck,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Search,
  User,
  Phone,
  RefreshCw,
  Package,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-config";
import {
  fetchDispatchDetails,
  updateDispatchRecord,
  type DispatchDetails,
  type DispatchItemDetails,
} from "@/lib/dispatch";

interface EditDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatchId: string | null;
  onSuccess?: () => void;
}

// Pure component for checkbox
const PureCheckbox = memo(
  ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => <Checkbox checked={checked} onCheckedChange={onChange} className="w-5 h-5" />
);

PureCheckbox.displayName = "PureCheckbox";

export function EditDispatchModal({
  open,
  onOpenChange,
  dispatchId,
  onSuccess,
}: EditDispatchModalProps) {
  const [loading, setLoading] = useState(false);
  const [dispatchDetails, setDispatchDetails] = useState<DispatchDetails | null>(null);
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [wastageItems, setWastageItems] = useState<any[]>([]);
  const [manualCutRolls, setManualCutRolls] = useState<any[]>([]);

  // Currently dispatched items (can be removed)
  const [currentDispatchItems, setCurrentDispatchItems] = useState<DispatchItemDetails[]>([]);
  const [removedItemIds, setRemovedItemIds] = useState<Set<string>>(new Set());

  // Store mapping of barcode -> inventory UUID for currently dispatched wastage/manual items
  const [currentItemsInventoryMap, setCurrentItemsInventoryMap] = useState<Map<string, string>>(new Map());

  // New items to add
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedWastageIds, setSelectedWastageIds] = useState<Set<string>>(new Set());
  const [selectedManualCutRollIds, setSelectedManualCutRollIds] = useState<Set<string>>(new Set());

  const [searchTerm, setSearchTerm] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [formCollapsed, setFormCollapsed] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    locket_no: "",
    reference_number: "",
  });

  // Debounce search
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load data on mount
  useEffect(() => {
    if (open && dispatchId) {
      loadDispatchDetails();
      loadWarehouseItems();
      loadWastageItems();
      loadManualCutRolls();
    } else if (!open) {
      // Reset state
      setDispatchDetails(null);
      setCurrentDispatchItems([]);
      setRemovedItemIds(new Set());
      setCurrentItemsInventoryMap(new Map());
      setSelectedItems(new Set());
      setSelectedWastageIds(new Set());
      setSelectedManualCutRollIds(new Set());
      setSearchTerm("");
      setDebouncedSearchTerm("");
      setFormData({
        vehicle_number: "",
        driver_name: "",
        driver_mobile: "",
        locket_no: "",
        reference_number: "",
      });
    }
  }, [open, dispatchId]);

  const loadDispatchDetails = async () => {
    if (!dispatchId) return;

    try {
      setLoading(true);
      const details = await fetchDispatchDetails(dispatchId);
      setDispatchDetails(details);

      // Pre-populate form data
      setFormData({
        vehicle_number: details.vehicle_number,
        driver_name: details.driver_name,
        driver_mobile: details.driver_mobile,
        locket_no: details.locket_no || "",
        reference_number: details.reference_number || "",
      });

      // Store currently dispatched items
      setCurrentDispatchItems(details.items || []);
      setRemovedItemIds(new Set()); // Start with none removed

      // Build mapping for wastage and manual items (fetch their UUIDs)
      const inventoryMap = new Map<string, string>();

      console.log("=== BUILDING INVENTORY MAP ===");
      console.log("Dispatch items:", details.items?.length || 0);

      // Check if we have any wastage or manual items
      const hasWastageItems = (details.items || []).some(
        (item) => !item.inventory?.id && item.barcode_id?.startsWith("WSB")
      );
      const hasManualItems = (details.items || []).some(
        (item) => !item.inventory?.id && item.barcode_id?.startsWith("CR_")
      );

      console.log("Has wastage items:", hasWastageItems);
      console.log("Has manual items:", hasManualItems);

      // Fetch all "used" wastage items (single API call)
      if (hasWastageItems) {
        try {
          console.log("Fetching wastage items with status=used...");
          const response = await fetch(
            `${API_BASE_URL}/dispatch/wastage-inventory-items?status=used`,
            { headers: { "ngrok-skip-browser-warning": "true" } }
          );
          if (response.ok) {
            const data = await response.json();
            console.log("Wastage items fetched:", data.wastage_items?.length || 0);
            // Map all wastage items by barcode
            (data.wastage_items || []).forEach((w: any) => {
              if (w.barcode_id) {
                inventoryMap.set(w.barcode_id, w.id);
                console.log(`  Mapped wastage: ${w.barcode_id} → ${w.id}`);
              }
              if (w.reel_no) {
                inventoryMap.set(w.reel_no, w.id);
                console.log(`  Mapped wastage reel: ${w.reel_no} → ${w.id}`);
              }
            });
          } else {
            console.error("Failed to fetch wastage items, status:", response.status);
          }
        } catch (err) {
          console.error("Failed to fetch wastage items:", err);
        }
      }

      // Fetch all "used" manual cut rolls (single API call)
      if (hasManualItems) {
        try {
          console.log("Fetching manual cut rolls with status=used...");
          const response = await fetch(
            `${API_BASE_URL}/dispatch/manual-cut-rolls?status=used`,
            { headers: { "ngrok-skip-browser-warning": "true" } }
          );
          if (response.ok) {
            const data = await response.json();
            console.log("Manual items fetched:", data.manual_cut_rolls?.length || 0);
            // Map all manual items by barcode
            (data.manual_cut_rolls || []).forEach((m: any) => {
              if (m.barcode_id) {
                inventoryMap.set(m.barcode_id, m.id);
                console.log(`  Mapped manual: ${m.barcode_id} → ${m.id}`);
              }
            });
          } else {
            console.error("Failed to fetch manual items, status:", response.status);
          }
        } catch (err) {
          console.error("Failed to fetch manual cut rolls:", err);
        }
      }

      console.log("=== INVENTORY MAP COMPLETE ===");
      console.log("Total mappings:", inventoryMap.size);

      setCurrentItemsInventoryMap(inventoryMap);
    } catch (err) {
      console.error("Error loading dispatch details:", err);
      toast.error("Failed to load dispatch details");
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouseItems = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/warehouse-items`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!response.ok) throw new Error("Failed to load warehouse items");
      const data = await response.json();
      setWarehouseItems(data.warehouse_items || []);
    } catch (err) {
      console.error("Error loading warehouse items:", err);
      toast.error("Failed to load warehouse items");
    }
  };

  const loadWastageItems = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dispatch/wastage-inventory-items`,
        {
          headers: { "ngrok-skip-browser-warning": "true" },
        }
      );
      if (!response.ok) throw new Error("Failed to load wastage items");
      const data = await response.json();
      setWastageItems(data.wastage_items || []);
    } catch (err) {
      console.error("Error loading wastage items:", err);
      toast.error("Failed to load Stock items");
    }
  };

  const loadManualCutRolls = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/manual-cut-rolls`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!response.ok) throw new Error("Failed to load manual cut rolls");
      const data = await response.json();
      setManualCutRolls(data.manual_cut_rolls || []);
    } catch (err) {
      console.error("Error loading manual cut rolls:", err);
      toast.error("Failed to load manual cut rolls");
    }
  };

  const handleUpdateDispatch = useCallback(async () => {
    if (!dispatchId) return;

    if (!formData.vehicle_number.trim()) {
      toast.error("Vehicle number is required");
      return;
    }
    if (!formData.driver_name.trim()) {
      toast.error("Driver name is required");
      return;
    }

    try {
      setUpdateLoading(true);

      console.log("=== DISPATCH UPDATE: Starting ===");
      console.log("Total current items:", currentDispatchItems.length);
      console.log("Removed item IDs:", Array.from(removedItemIds));
      console.log("Inventory map size:", currentItemsInventoryMap.size);
      console.log("Inventory map contents:", Object.fromEntries(currentItemsInventoryMap));

      // Build final lists
      // 1. Get IDs of items that are NOT removed (still in dispatch)
      const keptRegularIds: string[] = [];
      const keptWastageIds: string[] = [];
      const keptManualIds: string[] = [];

      currentDispatchItems.forEach((item) => {
        const isRemoved = removedItemIds.has(item.id);
        console.log(`Item ${item.barcode_id} (id: ${item.id}):`, {
          isRemoved,
          hasInventory: !!item.inventory,
          inventoryId: item.inventory?.id,
          barcodePrefix: item.barcode_id.substring(0, 5)
        });

        if (!isRemoved) {
          // This item is NOT removed, keep it
          if (item.inventory && item.inventory.id) {
            // Regular inventory item
            console.log(`  → Keeping regular item: ${item.inventory.id}`);
            keptRegularIds.push(item.inventory.id);
          } else if (item.barcode_id) {
            // Wastage or manual item - get UUID from our pre-loaded map
            const inventoryId = currentItemsInventoryMap.get(item.barcode_id);
            console.log(`  → Looking up ${item.barcode_id} in map: ${inventoryId}`);
            if (inventoryId) {
              if (item.barcode_id.startsWith("WSB")) {
                console.log(`  → Keeping wastage item: ${inventoryId}`);
                keptWastageIds.push(inventoryId);
              } else if (item.barcode_id.startsWith("CR_")) {
                console.log(`  → Keeping manual item: ${inventoryId}`);
                keptManualIds.push(inventoryId);
              }
            } else {
              console.warn(`  ⚠️ Could not find inventory ID for ${item.barcode_id}`);
            }
          }
        } else {
          console.log(`  → REMOVING item: ${item.barcode_id}`);
        }
      });

      // 2. Add newly selected items
      const finalRegularIds = [...keptRegularIds, ...Array.from(selectedItems)];
      const finalWastageIds = [...keptWastageIds, ...Array.from(selectedWastageIds)];
      const finalManualIds = [...keptManualIds, ...Array.from(selectedManualCutRollIds)];

      console.log("=== FINAL ITEM LISTS ===");
      console.log("Kept regular IDs:", keptRegularIds);
      console.log("New regular IDs:", Array.from(selectedItems));
      console.log("Final regular IDs:", finalRegularIds);
      console.log("---");
      console.log("Kept wastage IDs:", keptWastageIds);
      console.log("New wastage IDs:", Array.from(selectedWastageIds));
      console.log("Final wastage IDs:", finalWastageIds);
      console.log("---");
      console.log("Kept manual IDs:", keptManualIds);
      console.log("New manual IDs:", Array.from(selectedManualCutRollIds));
      console.log("Final manual IDs:", finalManualIds);

      if (finalRegularIds.length === 0 && finalWastageIds.length === 0 && finalManualIds.length === 0) {
        toast.error("Cannot remove all items. Dispatch must have at least one item.");
        return;
      }

      const updateData = {
        vehicle_number: formData.vehicle_number,
        driver_name: formData.driver_name,
        driver_mobile: formData.driver_mobile,
        locket_no: formData.locket_no || undefined,
        reference_number: formData.reference_number || undefined,
        inventory_ids: finalRegularIds,
        wastage_ids: finalWastageIds,
        manual_cut_roll_ids: finalManualIds,
      };

      console.log("=== SENDING UPDATE TO BACKEND ===");
      console.log("Update data:", JSON.stringify(updateData, null, 2));

      const result = await updateDispatchRecord(dispatchId, updateData);

      console.log("=== BACKEND RESPONSE ===");
      console.log("Result:", JSON.stringify(result, null, 2));

      toast.success("Dispatch updated successfully!");
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update dispatch";
      toast.error(errorMessage);
      console.error("Dispatch update error:", error);
    } finally {
      setUpdateLoading(false);
    }
  }, [
    dispatchId,
    formData,
    currentDispatchItems,
    removedItemIds,
    currentItemsInventoryMap,
    selectedItems,
    selectedWastageIds,
    selectedManualCutRollIds,
    onOpenChange,
    onSuccess,
  ]);

  // Toggle removal of current dispatch item
  const toggleCurrentItem = useCallback((itemId: string) => {
    setRemovedItemIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Memoize filtered items
  const filteredData = useMemo(() => {
    const filterItems = (items: any[], isWastage = false) => {
      if (!debouncedSearchTerm) return items;

      return items.filter((item) => {
        const fields = isWastage
          ? [
              item.barcode_id,
              item.reel_no,
              item.frontend_id,
              item.paper_spec,
              item.created_by,
            ]
          : [
              item.barcode_id,
              item.qr_code,
              item.client_name,
              item.order_id,
              item.paper_spec,
              item.created_by,
            ];

        return fields.some(
          (field) => field && field.toLowerCase().includes(debouncedSearchTerm)
        );
      });
    };

    return {
      filteredWarehouse: filterItems(warehouseItems),
      filteredWastage: filterItems(wastageItems, true),
      filteredManual: filterItems(manualCutRolls),
    };
  }, [warehouseItems, wastageItems, manualCutRolls, debouncedSearchTerm]);

  // Optimized toggle handler for new items
  const handleToggleItem = useCallback((item: any, itemType: string) => {
    const itemId =
      itemType === "wastage"
        ? item.id
        : itemType === "manual"
        ? item.id
        : item.inventory_id;

    if (itemType === "wastage") {
      setSelectedWastageIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else if (itemType === "manual") {
      setSelectedManualCutRollIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else {
      setSelectedItems((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    }
  }, []);

  // Memoize stats
  const stats = useMemo(() => {
    const currentNotRemoved = currentDispatchItems.filter(
      (item) => !removedItemIds.has(item.id)
    );
    const newItemsCount =
      selectedItems.size + selectedWastageIds.size + selectedManualCutRollIds.size;
    const totalSelected = currentNotRemoved.length + newItemsCount;

    let totalWeight = 0;

    // Weight from current items not removed
    currentNotRemoved.forEach((item) => {
      totalWeight += item.weight_kg || 0;
    });

    // Weight from newly selected warehouse items
    warehouseItems.forEach((item) => {
      if (selectedItems.has(item.inventory_id)) {
        totalWeight += item.weight_kg || 0;
      }
    });

    // Weight from newly selected wastage items
    wastageItems.forEach((item) => {
      if (selectedWastageIds.has(item.id)) {
        totalWeight += item.weight_kg || 0;
      }
    });

    // Weight from newly selected manual items
    manualCutRolls.forEach((item) => {
      if (selectedManualCutRollIds.has(item.id)) {
        totalWeight += item.weight_kg || 0;
      }
    });

    return {
      totalSelected,
      totalWeight,
      currentCount: currentNotRemoved.length,
      newCount: newItemsCount,
      removedCount: removedItemIds.size,
    };
  }, [
    currentDispatchItems,
    removedItemIds,
    selectedItems,
    selectedWastageIds,
    selectedManualCutRollIds,
    warehouseItems,
    wastageItems,
    manualCutRolls,
  ]);

  if (!dispatchDetails && !loading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          maxWidth: "1200px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "20px",
            }}
          >
            <RefreshCw style={{ width: "24px", height: "24px" }} />
            Edit Dispatch: {dispatchDetails?.dispatch_number || "Loading..."}
          </DialogTitle>
          <DialogDescription style={{ fontSize: "16px" }}>
            Update dispatch details and add/remove items
            {dispatchDetails?.status === "delivered" && (
              <span style={{ color: "#dc2626", marginLeft: "8px" }}>
                (Cannot edit delivered dispatch)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div style={{ flex: 1, overflow: "auto" }}>
          {loading && !dispatchDetails ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "200px",
              }}
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading dispatch details...
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                padding: "16px",
              }}
            >
              {/* Dispatch Info Summary */}
              <div
                style={{
                  backgroundColor: "#f0f9ff",
                  border: "1px solid #93c5fd",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "12px",
                    fontSize: "14px",
                  }}
                >
                  <div>
                    <span style={{ color: "#6b7280" }}>Client:</span>
                    <p style={{ fontWeight: 500 }}>
                      {dispatchDetails?.client.company_name}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: "#6b7280" }}>Status:</span>
                    <p style={{ fontWeight: 500 }}>{dispatchDetails?.status}</p>
                  </div>
                  <div>
                    <span style={{ color: "#6b7280" }}>Created By:</span>
                    <p style={{ fontWeight: 500 }}>
                      {dispatchDetails?.created_by?.name || "Unknown"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <h3 style={{ fontSize: "16px", fontWeight: 600 }}>
                    Edit Dispatch Details
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormCollapsed(!formCollapsed)}
                    style={{ padding: "4px 8px" }}
                  >
                    {formCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {!formCollapsed && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "16px",
                    }}
                  >
                <div>
                  <label
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <Truck style={{ width: "18px", height: "18px" }} />
                    Vehicle Number *
                  </label>
                  <Input
                    value={formData.vehicle_number}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        vehicle_number: e.target.value,
                      }))
                    }
                    style={{ fontSize: "16px", padding: "12px" }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <User style={{ width: "18px", height: "18px" }} />
                    Driver Name *
                  </label>
                  <Input
                    value={formData.driver_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        driver_name: e.target.value,
                      }))
                    }
                    style={{ fontSize: "16px", padding: "12px" }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <Phone style={{ width: "18px", height: "18px" }} />
                    Driver Mobile
                  </label>
                  <Input
                    value={formData.driver_mobile}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        driver_mobile: e.target.value,
                      }))
                    }
                    style={{ fontSize: "16px", padding: "12px" }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      marginBottom: "8px",
                    }}
                  >
                    Dispatch Number (Optional)
                  </label>
                  <Input
                    value={formData.locket_no}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        locket_no: e.target.value,
                      }))
                    }
                    style={{ fontSize: "16px", padding: "12px" }}
                  />
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      marginBottom: "8px",
                    }}
                  >
                    Reference Number (Optional)
                  </label>
                  <Input
                    value={formData.reference_number}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reference_number: e.target.value,
                      }))
                    }
                    style={{ fontSize: "16px", padding: "12px" }}
                  />
                </div>
              </div>
                )}
              </div>

              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#eff6ff",
                    border: "1px solid #93c5fd",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#2563eb" }}>
                    {stats.totalSelected}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>Total Items</div>
                </div>
                <div
                  style={{
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #86efac",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#16a34a" }}>
                    {stats.totalWeight.toFixed(1)} kg
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>Total Weight</div>
                </div>
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#dc2626" }}>
                    {stats.removedCount}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>Removed</div>
                </div>
                <div
                  style={{
                    backgroundColor: "#faf5ff",
                    border: "1px solid #d8b4fe",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#9333ea" }}>
                    +{stats.newCount}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>Added</div>
                </div>
              </div>

              {/* Currently Dispatched Items */}
              {currentDispatchItems.length > 0 && (
                <div
                  style={{
                    border: "2px solid #93c5fd",
                    borderRadius: "8px",
                    padding: "16px",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Package style={{ width: "20px", height: "20px" }} />
                    Currently Dispatched Items (Uncheck to Remove)
                  </h3>
                  <div
                    style={{
                      maxHeight: "300px",
                      overflow: "auto",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      backgroundColor: "white",
                    }}
                  >
                    <Table>
                      <TableHeader
                        style={{
                          position: "sticky",
                          top: 0,
                          backgroundColor: "#f1f5f9",
                          zIndex: 10,
                        }}
                      >
                        <TableRow>
                          <TableHead style={{ width: "60px" }}>S.No</TableHead>
                          <TableHead>Barcode / ID</TableHead>
                          <TableHead>Paper Spec</TableHead>
                          <TableHead style={{ textAlign: "center" }}>Width</TableHead>
                          <TableHead style={{ textAlign: "center" }}>Weight</TableHead>
                          <TableHead style={{ width: "80px" }}>Keep?</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentDispatchItems.map((item, index) => {
                          const isRemoved = removedItemIds.has(item.id);
                          return (
                            <TableRow
                              key={item.id}
                              onClick={() => toggleCurrentItem(item.id)}
                              style={{
                                backgroundColor: isRemoved
                                  ? "#fee2e2"
                                  : "white",
                                textDecoration: isRemoved
                                  ? "line-through"
                                  : "none",
                                opacity: isRemoved ? 0.6 : 1,
                                cursor: "pointer",
                              }}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <TableCell style={{ fontWeight: 500 }}>
                                {index + 1}
                              </TableCell>
                              <TableCell
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "14px",
                                }}
                              >
                                {item.barcode_id}
                              </TableCell>
                              <TableCell style={{ fontSize: "14px" }}>
                                {item.paper_spec}
                              </TableCell>
                              <TableCell
                                style={{
                                  textAlign: "center",
                                  fontWeight: 500,
                                }}
                              >
                                {item.width_inches}"
                              </TableCell>
                              <TableCell
                                style={{
                                  textAlign: "center",
                                  fontWeight: 500,
                                }}
                              >
                                {item.weight_kg.toFixed(2)}kg
                              </TableCell>
                              <TableCell
                                style={{ display: "flex", justifyContent: "center" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <PureCheckbox
                                  checked={!isRemoved}
                                  onChange={() => toggleCurrentItem(item.id)}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Search for new items to add */}
              <div
                style={{
                  border: "2px solid #86efac",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Plus style={{ width: "20px", height: "20px" }} />
                  Add New Items
                </h3>

                <div style={{ position: "relative", marginBottom: "12px" }}>
                  <Search
                    style={{
                      position: "absolute",
                      left: "16px",
                      top: "16px",
                      width: "24px",
                      height: "24px",
                      color: "#6b7280",
                    }}
                  />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search available items..."
                    style={{
                      paddingLeft: "48px",
                      paddingRight: "48px",
                      height: "56px",
                      fontSize: "16px",
                    }}
                  />
                  {searchTerm && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSearchTerm("")}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "8px",
                        width: "40px",
                        height: "40px",
                        padding: 0,
                      }}
                    >
                      <X style={{ width: "20px", height: "20px" }} />
                    </Button>
                  )}
                </div>

                <div
                  style={{
                    maxHeight: "300px",
                    overflow: "auto",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                  }}
                >
                  {filteredData.filteredWarehouse.length === 0 &&
                  filteredData.filteredWastage.length === 0 &&
                  filteredData.filteredManual.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        color: "#6b7280",
                      }}
                    >
                      <p style={{ fontWeight: 500 }}>No available items found</p>
                      <p style={{ fontSize: "14px", marginTop: "4px" }}>
                        Try adjusting your search
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader
                        style={{
                          position: "sticky",
                          top: 0,
                          backgroundColor: "white",
                          zIndex: 10,
                        }}
                      >
                        <TableRow>
                          <TableHead style={{ width: "60px" }}>S.No</TableHead>
                          <TableHead>Barcode</TableHead>
                          <TableHead>Client / Order</TableHead>
                          <TableHead>Paper Spec</TableHead>
                          <TableHead style={{ textAlign: "center" }}>
                            Width
                          </TableHead>
                          <TableHead style={{ textAlign: "center" }}>
                            Weight
                          </TableHead>
                          <TableHead style={{ width: "80px" }}>Add</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Warehouse items */}
                        {filteredData.filteredWarehouse.map((item, idx) => {
                          const isSelected = selectedItems.has(
                            item.inventory_id
                          );
                          return (
                            <TableRow
                              key={`w-${item.inventory_id}`}
                              onClick={() => handleToggleItem(item, "warehouse")}
                              style={{
                                backgroundColor: isSelected
                                  ? "#dcfce7"
                                  : "white",
                                cursor: "pointer",
                              }}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "14px",
                                }}
                              >
                                {item.barcode_id}
                              </TableCell>
                              <TableCell style={{ fontSize: "14px" }}>
                                {item.client_name}
                              </TableCell>
                              <TableCell style={{ fontSize: "14px" }}>
                                {item.paper_spec}
                              </TableCell>
                              <TableCell
                                style={{
                                  textAlign: "center",
                                  fontWeight: 500,
                                }}
                              >
                                {item.width_inches}"
                              </TableCell>
                              <TableCell
                                style={{
                                  textAlign: "center",
                                  fontWeight: 500,
                                }}
                              >
                                {item.weight_kg}kg
                              </TableCell>
                              <TableCell
                                style={{ display: "flex", justifyContent: "center" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <PureCheckbox
                                  checked={isSelected}
                                  onChange={() =>
                                    handleToggleItem(item, "warehouse")
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {/* Wastage items */}
                        {filteredData.filteredWastage.map((item, idx) => {
                          const isSelected = selectedWastageIds.has(item.id);
                          return (
                            <TableRow
                              key={`ws-${item.id}`}
                              onClick={() => handleToggleItem(item, "wastage")}
                              style={{
                                backgroundColor: isSelected
                                  ? "#fff7ed"
                                  : "white",
                                cursor: "pointer",
                              }}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <TableCell>
                                {filteredData.filteredWarehouse.length +
                                  idx +
                                  1}
                              </TableCell>
                              <TableCell
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "14px",
                                }}
                              >
                                {item.barcode_id}
                              </TableCell>
                              <TableCell style={{ color: "#6b7280" }}>
                                Stock Item
                              </TableCell>
                              <TableCell style={{ fontSize: "14px" }}>
                                {item.paper_spec}
                              </TableCell>
                              <TableCell
                                style={{
                                  textAlign: "center",
                                  fontWeight: 500,
                                }}
                              >
                                {item.width_inches}"
                              </TableCell>
                              <TableCell
                                style={{
                                  textAlign: "center",
                                  fontWeight: 500,
                                }}
                              >
                                {item.weight_kg}kg
                              </TableCell>
                              <TableCell
                                style={{ display: "flex", justifyContent: "center" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <PureCheckbox
                                  checked={isSelected}
                                  onChange={() =>
                                    handleToggleItem(item, "wastage")
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {/* Manual cut rolls */}
                        {filteredData.filteredManual.map((item, idx) => {
                          const isSelected = selectedManualCutRollIds.has(
                            item.id
                          );
                          return (
                            <TableRow
                              key={`m-${item.id}`}
                              onClick={() => handleToggleItem(item, "manual")}
                              style={{
                                backgroundColor: isSelected
                                  ? "#fef3c7"
                                  : "white",
                                cursor: "pointer",
                              }}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <TableCell>
                                {filteredData.filteredWarehouse.length +
                                  filteredData.filteredWastage.length +
                                  idx +
                                  1}
                              </TableCell>
                              <TableCell
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "14px",
                                }}
                              >
                                {item.barcode_id}
                              </TableCell>
                              <TableCell style={{ fontSize: "14px" }}>
                                {item.client_name}
                              </TableCell>
                              <TableCell style={{ fontSize: "14px" }}>
                                {item.paper_spec}
                              </TableCell>
                              <TableCell
                                style={{
                                  textAlign: "center",
                                  fontWeight: 500,
                                }}
                              >
                                {item.width_inches}"
                              </TableCell>
                              <TableCell
                                style={{
                                  textAlign: "center",
                                  fontWeight: 500,
                                }}
                              >
                                {item.weight_kg}kg
                              </TableCell>
                              <TableCell
                                style={{ display: "flex", justifyContent: "center" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <PureCheckbox
                                  checked={isSelected}
                                  onChange={() =>
                                    handleToggleItem(item, "manual")
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>

              {/* Update Button */}
              <Button
                onClick={handleUpdateDispatch}
                disabled={
                  stats.totalSelected === 0 ||
                  updateLoading ||
                  dispatchDetails?.status !== "dispatched"
                }
                style={{
                  width: "100%",
                  backgroundColor: "#16a34a",
                  fontSize: "16px",
                  padding: "12px",
                }}
                size="lg"
              >
                {updateLoading ? (
                  <>
                    <Loader2
                      style={{
                        marginRight: "8px",
                        width: "20px",
                        height: "20px",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Updating Dispatch...
                  </>
                ) : (
                  <>
                    <CheckCircle
                      style={{ marginRight: "8px", width: "20px", height: "20px" }}
                    />
                    Update Dispatch ({stats.currentCount} kept + {stats.newCount}{" "}
                    added = {stats.totalSelected} items)
                  </>
                )}
              </Button>

              {dispatchDetails?.status !== "dispatched" && (
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <AlertCircle
                    style={{ width: "20px", height: "20px", color: "#dc2626" }}
                  />
                  <span style={{ color: "#dc2626", fontSize: "14px" }}>
                    This dispatch cannot be edited because its status is "
                    {dispatchDetails?.status}". Only dispatches with "dispatched"
                    status can be edited.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
