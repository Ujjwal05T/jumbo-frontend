/**
 * Create Dispatch Modal - High Performance Version v2
 * Optimized to handle large datasets without lag
 * Updated with larger fonts and removed Type column
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
  TableRow,
} from "@/components/ui/table";
import {
  Truck,
  CheckCircle,
  Package,
  AlertCircle,
  Loader2,
  X,
  Building2,
  Search,
  User,
  Phone,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-config";
import { createDispatchRecord } from "@/lib/dispatch";
import WastageIndicator from "@/components/WastageIndicator";
import { DispatchSuccessModal } from "@/components/DispatchSuccessModal";

interface CreateDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Pure component for checkbox to prevent unnecessary re-renders
const PureCheckbox = memo(({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <Checkbox
    checked={checked}
    onCheckedChange={onChange}
    className="w-5 h-5"
  />
));

PureCheckbox.displayName = "PureCheckbox";

// Highly optimized row component - minimal re-renders
const OptimizedRow = memo(({
  item,
  index,
  isSelected,
  itemType,
  searchTerm,
  onToggle
}: {
  item: any;
  index: number;
  isSelected: boolean;
  itemType: string;
  searchTerm: string;
  onToggle: () => void;
}) => {
  const isWastageItem = itemType === "wastage";
  const isManualItem = itemType === "manual";
  // Use inline styles for highlighting instead of mark components
  const getHighlightedText = (text: string, highlight: string) => {
    if (!highlight || !text) return text;

    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return parts.map((part, idx) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <span key={idx} style={{ backgroundColor: '#fef08a', padding: '0 2px', borderRadius: '2px' }}>
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const itemId = isWastageItem ? item.id : item.inventory_id;

  return (
    <TableRow
      style={{
        backgroundColor: isSelected ? (isWastageItem ? '#fff7ed' : '#eff6ff') : 'transparent',
        borderLeft: item.priority === 1 ? '4px solid #22c55e' : 'none'
      }}
    >
      <TableCell style={{ fontWeight: 500, fontSize: '16px' }}>{index + 1}</TableCell>
      <TableCell>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontFamily: 'monospace' }}>
          {getHighlightedText(
            isWastageItem
              ? (item.reel_no || item.barcode_id || item.frontend_id || "N/A")
              : (item.barcode_id || item.qr_code),
            searchTerm
          )}
          {isSelected && (
            <span style={{
              marginLeft: '8px',
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: isWastageItem ? '#ea580c' : '#2563eb',
              color: 'white',
              fontWeight: 500
            }}>
              SELECTED
            </span>
          )}
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
          By: {item.created_by || "Unknown"}
        </div>
      </TableCell>
      <TableCell>
        {isWastageItem ? (
          <div style={{ color: '#6b7280', fontSize: '16px' }}>-</div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '16px', fontWeight: 500 }}>
              <Building2 style={{ width: '14px', height: '14px', color: '#2563eb' }} />
              {getHighlightedText(item.client_name || "N/A", searchTerm)}
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              Order: {getHighlightedText(item.order_id || "N/A", searchTerm)}
            </div>
          </div>
        )}
      </TableCell>
      <TableCell>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 500, fontSize: '16px' }}>
            {getHighlightedText(item.paper_spec, searchTerm)}
          </span>
          {!isWastageItem && (
            <WastageIndicator isWastageRoll={item.is_wastage_roll} />
          )}
        </div>
      </TableCell>
      <TableCell style={{ textAlign: 'center', fontWeight: 500, fontSize: '16px' }}>
        {item.width_inches}"
      </TableCell>
      <TableCell style={{ textAlign: 'center', fontWeight: 500, fontSize: '16px' }}>
        {item.weight_kg}kg
      </TableCell>
      <TableCell style={{ display: 'flex', justifyContent: 'center' }}>
        <PureCheckbox checked={isSelected} onChange={onToggle} />
      </TableCell>
    </TableRow>
  );
});

OptimizedRow.displayName = "OptimizedRow";

export function CreateDispatchModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateDispatchModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [wastageItems, setWastageItems] = useState<any[]>([]);
  const [manualCutRolls, setManualCutRolls] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedWastageIds, setSelectedWastageIds] = useState<Set<string>>(new Set());
  const [selectedManualCutRollIds, setSelectedManualCutRollIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"client" | "all" | "wastage" | "manual">("client");

  const [dispatchDetails, setDispatchDetails] = useState({
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    locket_no: "",
    dispatch_number: "",
    reference_number: "",
  });

  const [previewNumber, setPreviewNumber] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Debounce search to reduce re-renders
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load data on mount
  useEffect(() => {
    if (open) {
      loadClients();
      loadWarehouseItems();
      loadWastageItems();
      loadManualCutRolls();
      loadPreviewNumber();
    } else {
      // Reset state
      setStep(1);
      setSelectedClientId("none");
      setSelectedItems(new Set());
      setSelectedWastageIds(new Set());
      setSelectedManualCutRollIds(new Set());
      setSearchTerm("");
      setDebouncedSearchTerm("");
      setPreviewNumber("");
      setDispatchDetails({
        vehicle_number: "",
        driver_name: "",
        driver_mobile: "",
        locket_no: "",
        dispatch_number: "",
        reference_number: "",
      });
    }
  }, [open]);

  const loadClients = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/clients`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!response.ok) throw new Error("Failed to load clients");
      const data = await response.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error("Error loading clients:", err);
      toast.error("Failed to load clients");
    }
  };

  const loadWarehouseItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/dispatch/warehouse-items`,
        {
          headers: { "ngrok-skip-browser-warning": "true" },
        }
      );
      if (!response.ok) throw new Error("Failed to load warehouse items");
      const data = await response.json();
      setWarehouseItems(data.warehouse_items || []);
    } catch (err) {
      console.error("Error loading warehouse items:", err);
      toast.error("Failed to load warehouse items");
    } finally {
      setLoading(false);
    }
  };

  const loadWastageItems = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const loadManualCutRolls = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/dispatch/manual-cut-rolls`,
        {
          headers: { "ngrok-skip-browser-warning": "true" },
        }
      );
      if (!response.ok) throw new Error("Failed to load manual cut rolls");
      const data = await response.json();
      setManualCutRolls(data.manual_cut_rolls || []);
    } catch (err) {
      console.error("Error loading manual cut rolls:", err);
      toast.error("Failed to load manual cut rolls");
    } finally {
      setLoading(false);
    }
  };

  const loadPreviewNumber = async () => {
    try {
      setPreviewLoading(true);
      const response = await fetch(`${API_BASE_URL}/dispatch/preview-number`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!response.ok) throw new Error("Failed to load preview number");
      const data = await response.json();
      setPreviewNumber(data.preview_number || "");
    } catch (err) {
      console.error("Error loading preview number:", err);
      setPreviewNumber("Loading...");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveDetails = useCallback(() => {
    if (!dispatchDetails.vehicle_number.trim()) {
      toast.error("Vehicle number is required");
      return;
    }
    if (!dispatchDetails.driver_name.trim()) {
      toast.error("Driver name is required");
      return;
    }
    if (selectedClientId === "none") {
      toast.error("Please select a client for the dispatch slip");
      return;
    }
    setStep(2);
    toast.success("Details saved! Now select items to dispatch");
  }, [dispatchDetails, selectedClientId]);

  const handleDispatchConfirm = useCallback(async () => {
    if (selectedItems.size === 0 && selectedWastageIds.size === 0 && selectedManualCutRollIds.size === 0) {
      toast.error("Please select at least one item to dispatch");
      return;
    }

    try {
      setDispatchLoading(true);

      const dispatchData = {
        ...dispatchDetails,
        dispatch_number: "",
        client_id: selectedClientId,
        inventory_ids: Array.from(selectedItems),
        wastage_ids: Array.from(selectedWastageIds),
        manual_cut_roll_ids: Array.from(selectedManualCutRollIds),
      };

      const result = await createDispatchRecord(dispatchData as any);

      setDispatchResult(result);
      setSuccessModalOpen(true);
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create dispatch";
      toast.error(errorMessage);
      console.error("Dispatch error:", error);
    } finally {
      setDispatchLoading(false);
    }
  }, [dispatchDetails, selectedClientId, selectedItems, selectedWastageIds, selectedManualCutRollIds, onOpenChange, onSuccess]);

  // Memoize selected client
  const selectedClient = useMemo(() => {
    return selectedClientId && selectedClientId !== "none"
      ? clients.find((c) => c.id === selectedClientId)
      : null;
  }, [selectedClientId, clients]);

  // Memoize filtered items - only recompute when search term changes
  const filteredData = useMemo(() => {
    const clientName = selectedClient?.company_name || "";

    const clientItems = warehouseItems.filter(item => item.client_name === clientName);
    const otherItems = warehouseItems.filter(item => item.client_name !== clientName);

    const filterItems = (items: any[], isWastage = false) => {
      if (!debouncedSearchTerm) return items;

      return items.filter(item => {
        const fields = isWastage
          ? [item.barcode_id, item.reel_no, item.frontend_id, item.paper_spec, item.created_by]
          : [item.barcode_id, item.qr_code, item.client_name, item.order_id, item.paper_spec, item.created_by];

        return fields.some(field =>
          field && field.toLowerCase().includes(debouncedSearchTerm)
        );
      });
    };

    return {
      filteredClient: filterItems(clientItems),
      filteredOther: filterItems(otherItems),
      filteredWastage: filterItems(wastageItems, true),
      clientItems,
      otherItems
    };
  }, [warehouseItems, wastageItems, selectedClient?.company_name, debouncedSearchTerm]);

  // Memoize combined items based on active tab
  const displayItems = useMemo(() => {
    const { filteredClient, filteredOther, filteredWastage } = filteredData;

    // Filter manual cut rolls
    const filteredManual = manualCutRolls.filter(roll => {
      if (!debouncedSearchTerm) return true;
      const fields = [
        roll.barcode_id,
        roll.frontend_id,
        roll.reel_number,
        roll.client_name,
        roll.paper_spec,
        String(roll.width_inches),
        String(roll.weight_kg),
      ];
      return fields.some(field =>
        field && field.toLowerCase().includes(debouncedSearchTerm)
      );
    });

    const items = [];

    if (activeTab === "client") {
      items.push(
        ...filteredClient.map(item => ({ ...item, type: "warehouse", priority: 1 })),
        ...filteredOther.map(item => ({ ...item, type: "warehouse", priority: 2 })),
        ...filteredWastage.map(item => ({ ...item, type: "wastage", priority: 3 })),
        ...filteredManual.map(item => ({ ...item, type: "manual", priority: 4 }))
      );
    } else if (activeTab === "all") {
      items.push(
        ...filteredOther.map(item => ({ ...item, type: "warehouse", priority: 1 })),
        ...filteredClient.map(item => ({ ...item, type: "warehouse", priority: 2 })),
        ...filteredWastage.map(item => ({ ...item, type: "wastage", priority: 3 })),
        ...filteredManual.map(item => ({ ...item, type: "manual", priority: 4 }))
      );
    } else if (activeTab === "wastage") {
      items.push(
        ...filteredWastage.map(item => ({ ...item, type: "wastage", priority: 1 })),
        ...filteredClient.map(item => ({ ...item, type: "warehouse", priority: 2 })),
        ...filteredOther.map(item => ({ ...item, type: "warehouse", priority: 3 })),
        ...filteredManual.map(item => ({ ...item, type: "manual", priority: 4 }))
      );
    } else {
      // manual tab
      items.push(
        ...filteredManual.map(item => ({ ...item, type: "manual", priority: 1 })),
        ...filteredClient.map(item => ({ ...item, type: "warehouse", priority: 2 })),
        ...filteredOther.map(item => ({ ...item, type: "warehouse", priority: 3 })),
        ...filteredWastage.map(item => ({ ...item, type: "wastage", priority: 4 }))
      );
    }

    return items;
  }, [filteredData, activeTab, manualCutRolls, debouncedSearchTerm]);

  // Optimized toggle handler - use Set for O(1) operations
  const handleToggleItem = useCallback((item: any, itemType: string) => {
    const itemId = itemType === "wastage" ? item.id : (itemType === "manual" ? item.id : item.inventory_id);

    if (itemType === "wastage") {
      setSelectedWastageIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else if (itemType === "manual") {
      setSelectedManualCutRollIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else {
      setSelectedItems(prev => {
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

  // Memoize stats to avoid recalculation
  const stats = useMemo(() => {
    const totalSelected = selectedItems.size + selectedWastageIds.size + selectedManualCutRollIds.size;

    // Calculate total weight only when needed
    let totalWeight = 0;
    if (totalSelected > 0) {
      warehouseItems.forEach(item => {
        if (selectedItems.has(item.inventory_id)) {
          totalWeight += item.weight_kg || 0;
        }
      });
      wastageItems.forEach(item => {
        if (selectedWastageIds.has(item.id)) {
          totalWeight += item.weight_kg || 0;
        }
      });
      manualCutRolls.forEach(item => {
        if (selectedManualCutRollIds.has(item.id)) {
          totalWeight += item.weight_kg || 0;
        }
      });
    }

    return {
      totalSelected,
      totalWeight,
      regularCount: selectedItems.size,
      wastageCount: selectedWastageIds.size,
      manualCount: selectedManualCutRollIds.size
    };
  }, [selectedItems, selectedWastageIds, selectedManualCutRollIds, warehouseItems, wastageItems, manualCutRolls]);

  // Render optimized table
  const renderTable = useMemo(() => {
    if (loading) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '96px',
          border: '1px solid #e5e7eb',
          borderRadius: '6px'
        }}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading items...
        </div>
      );
    }

    if (displayItems.length === 0) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '96px',
          border: '1px solid #e5e7eb',
          borderRadius: '6px'
        }}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontWeight: 500, fontSize: '16px' }}>No items found</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>
              {debouncedSearchTerm ? "Try adjusting your search" : "No items available"}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        maxHeight: '400px',
        overflow: 'auto'
      }}>
        <Table>
          <TableHeader style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
            <TableRow>
              <TableHead style={{ width: '60px', fontSize: '16px', fontWeight: 600 }}>S.No</TableHead>
              <TableHead style={{ width: '200px', fontSize: '16px', fontWeight: 600 }}>ID / Barcode</TableHead>
              <TableHead style={{ width: '200px', fontSize: '16px', fontWeight: 600 }}>Client & Order</TableHead>
              <TableHead style={{ fontSize: '16px', fontWeight: 600 }}>Paper Specs</TableHead>
              <TableHead style={{ width: '80px', textAlign: 'center', fontSize: '16px', fontWeight: 600 }}>Width</TableHead>
              <TableHead style={{ width: '80px', textAlign: 'center', fontSize: '16px', fontWeight: 600 }}>Weight</TableHead>
              <TableHead style={{ width: '60px', fontSize: '16px', fontWeight: 600 }}>Select</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((item: any, index) => {
              const itemType = item.type;
              const itemId = itemType === "wastage" ? item.id : (itemType === "manual" ? item.id : item.inventory_id);
              const isSelected = itemType === "wastage"
                ? selectedWastageIds.has(itemId)
                : (itemType === "manual"
                  ? selectedManualCutRollIds.has(itemId)
                  : selectedItems.has(itemId));

              return (
                <OptimizedRow
                  key={`${itemType.charAt(0)}-${itemId}`}
                  item={item}
                  index={index}
                  isSelected={isSelected}
                  itemType={itemType}
                  searchTerm={searchTerm}
                  onToggle={() => handleToggleItem(item, itemType)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }, [loading, displayItems, debouncedSearchTerm, searchTerm, selectedItems, selectedWastageIds, selectedManualCutRollIds, handleToggleItem]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent style={{ maxWidth: '1200px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
              <Truck style={{ width: '24px', height: '24px' }} />
              Create New Dispatch
            </DialogTitle>
            <DialogDescription style={{ fontSize: '16px' }}>
              {step === 1 ? "Step 1: Fill dispatch details" : "Step 2: Select items to dispatch"}
            </DialogDescription>
          </DialogHeader>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {step === 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
                {/* Form fields... */}
                <div style={{ display: 'grid',gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '16px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Building2 style={{ width: '18px', height: '18px' }} />
                      Select Client *
                    </label>
                    <Select
                      value={selectedClientId}
                      onValueChange={(value) => {
                        setSelectedClientId(value);
                        setSelectedItems(new Set());
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>Select a client</SelectItem>
                        {clients
                          .sort((a, b) => a.company_name.localeCompare(b.company_name))
                          .map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.company_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>

                  <div>
                    <label style={{ fontSize: '16px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      Challan Number *
                      <span style={{
                        fontSize: '12px',
                        color: '#2563eb',
                        backgroundColor: '#dbeafe',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        Preview
                      </span>
                    </label>
                    <Input
                      value={previewLoading ? "Loading..." : previewNumber || "Loading..."}
                      readOnly
                      style={{
                        fontFamily: 'monospace',
                        backgroundColor: '#f9fafb',
                        borderColor: '#bfdbfe',
                        color: '#1d4ed8',
                        fontSize: '16px',
                        padding: '12px'
                      }}
                      placeholder="Loading preview..."
                    />
                  </div>

                    <div>
                    <label style={{ fontSize: '16px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      Date
                    </label>
                    <Input
                      value={new Date().toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                      readOnly
                      style={{
                        fontSize: '16px',
                        padding: '12px',
                        backgroundColor: '#f3f4f6',
                        cursor: 'not-allowed',
                        color: '#374151'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '16px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Truck style={{ width: '18px', height: '18px' }} />
                      Vehicle Number *
                    </label>
                    <Input
                      value={dispatchDetails.vehicle_number}
                      onChange={(e) =>
                        setDispatchDetails((prev) => ({
                          ...prev,
                          vehicle_number: e.target.value,
                        }))
                      }
                      style={{ fontSize: '16px', padding: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '16px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <User style={{ width: '18px', height: '18px' }} />
                      Driver Name *
                    </label>
                    <Input
                      value={dispatchDetails.driver_name}
                      onChange={(e) =>
                        setDispatchDetails((prev) => ({
                          ...prev,
                          driver_name: e.target.value,
                        }))
                      }
                      style={{ fontSize: '16px', padding: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '16px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Phone style={{ width: '18px', height: '18px' }} />
                      Driver Mobile
                    </label>
                    <Input
                      value={dispatchDetails.driver_mobile}
                      onChange={(e) =>
                        setDispatchDetails((prev) => ({
                          ...prev,
                          driver_mobile: e.target.value,
                        }))
                      }
                      style={{ fontSize: '16px', padding: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
                      Dispatch Number (Optional)
                    </label>
                    <Input
                      value={dispatchDetails.locket_no}
                      onChange={(e) =>
                        setDispatchDetails((prev) => ({
                          ...prev,
                          locket_no: e.target.value,
                        }))
                      }
                      style={{ fontSize: '16px', padding: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
                      Reference Number (Optional)
                    </label>
                    <Input
                      value={dispatchDetails.reference_number}
                      onChange={(e) =>
                        setDispatchDetails((prev) => ({
                          ...prev,
                          reference_number: e.target.value,
                        }))
                      }
                      style={{ fontSize: '16px', padding: '12px' }}
                    />
                  </div>
                </div>

                <Button onClick={handleSaveDetails} style={{ width: '100%', fontSize: '16px', padding: '12px' }} size="lg">
                  <CheckCircle style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                  Continue to Item Selection
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
                {/* Summary */}
                <div style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ fontWeight: 600, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle style={{ width: '20px', height: '20px', color: '#16a34a' }} />
                      Dispatch Details Saved
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                      Edit
                    </Button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '16px' }}>
                    <div>
                      <span style={{ color: '#6b7280' }}>Client:</span>
                      <p style={{ fontWeight: 500 }}>{selectedClient?.company_name}</p>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Vehicle:</span>
                      <p style={{ fontWeight: 500 }}>{dispatchDetails.vehicle_number}</p>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Driver:</span>
                      <p style={{ fontWeight: 500 }}>{dispatchDetails.driver_name}</p>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{
                    backgroundColor: '#eff6ff',
                    border: '1px solid #93c5fd',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>
                      {stats.totalSelected}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Selected</div>
                  </div>
                  <div style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
                      {stats.totalWeight.toFixed(1)} kg
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Weight</div>
                  </div>
                  <div style={{
                    backgroundColor: '#faf5ff',
                    border: '1px solid #d8b4fe',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9333ea' }}>
                      {stats.regularCount}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Regular Items</div>
                  </div>
                  <div style={{
                    backgroundColor: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ea580c' }}>
                      {stats.wastageCount}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Stock Items</div>
                  </div>
                </div>

                {/* Search */}
                <div>
                  <div style={{ position: 'relative' }}>
                    <Search style={{
                      position: 'absolute',
                      left: '16px',
                      top: '16px',
                      width: '24px',
                      height: '24px',
                      color: '#6b7280'
                    }} />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search across all items: QR code, barcode, reel no, order, paper spec, creator..."
                      style={{
                        paddingLeft: '48px',
                        paddingRight: '48px',
                        height: '56px',
                        fontSize: '16px'
                      }}
                    />
                    {searchTerm && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSearchTerm("")}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '8px',
                          width: '40px',
                          height: '40px',
                          padding: 0
                        }}
                      >
                        <X style={{ width: '20px', height: '20px' }} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tab content with optimized table */}
                <div>
                  <div style={{
                    marginBottom: '8px',
                    fontSize: '14px',
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>
                      <span style={{ color: '#22c55e', fontWeight: 500 }}>●</span> Green border = Priority items
                    </span>
                    <span style={{ fontWeight: 500 }}>
                      Showing {displayItems.length} total items
                    </span>
                  </div>
                  {renderTable}
                </div>

                {/* Dispatch Button */}
                <Button
                  onClick={handleDispatchConfirm}
                  disabled={stats.totalSelected === 0 || dispatchLoading}
                  style={{
                    width: '100%',
                    backgroundColor: '#16a34a',
                    fontSize: '16px',
                    padding: '12px'
                  }}
                  size="lg"
                >
                  {dispatchLoading ? (
                    <>
                      <Loader2 style={{ marginRight: '8px', width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                      Creating Dispatch...
                    </>
                  ) : (
                    <>
                      <Truck style={{ marginRight: '8px', width: '20px', height: '20px' }} />
                      Dispatch {stats.totalSelected} Items
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DispatchSuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        dispatchResult={dispatchResult}
      />
    </>
  );
}