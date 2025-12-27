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
  SelectSearch,
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
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Printer,
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
const PureCheckbox = memo(
  ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <Checkbox
      checked={checked}
      onCheckedChange={onChange}
      className="w-5 h-5"
    />
  )
);

PureCheckbox.displayName = "PureCheckbox";

// Highly optimized row component - minimal re-renders
const OptimizedRow = memo(
  ({
    item,
    index,
    isSelected,
    itemType,
    searchTerm,
    onToggle,
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

    // Format paper spec to compact format
    const formatPaperSpec = (paperSpec: string) => {
      if (!paperSpec) return "N/A";

      // Example: "120gsm, 18.00bf, GOLDEN" -> "120, 18, G"
      const parts = paperSpec.split(",").map(p => p.trim());

      if (parts.length < 3) return paperSpec; // Return original if format is unexpected

      // Extract GSM (remove "gsm")
      const gsm = parts[0].replace("gsm", "").trim();

      // Extract BF (remove "bf" and convert to integer if .00)
      const bf = parts[1].replace("bf", "").trim();
      const bfValue = parseFloat(bf);
      const bfFormatted = bfValue % 1 === 0 ? Math.floor(bfValue).toString() : bf;

      // Extract first letter of shade
      const shade = parts[2].trim().charAt(0).toUpperCase();

      return `${gsm}gsm,${bfFormatted}bf,${shade}`;
    };

    // Use inline styles for highlighting instead of mark components
    const getHighlightedText = (text: string, highlight: string) => {
      if (!highlight || !text) return text;

      const parts = text.split(new RegExp(`(${highlight})`, "gi"));
      return parts.map((part, idx) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span
            key={idx}
            style={{
              backgroundColor: "#fef08a",
              padding: "0 2px",
              borderRadius: "2px",
            }}>
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
        onClick={onToggle}
        style={{
          backgroundColor: isSelected
            ? isWastageItem
              ? "#fff7ed"
              : "#eff6ff"
            : "transparent",
          borderLeft: item.priority === 1 ? "4px solid #22c55e" : "none",
          cursor: "pointer",
          border: isSelected ? "1px solid #2563eb" : "none",
        }}
        className="hover:bg-gray-50 transition-colors">
        <TableCell style={{ fontWeight: 500, fontSize: "14px" }}>
          {index + 1}
        </TableCell>
        <TableCell>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontFamily: "monospace",
            }}>
            {getHighlightedText(
              isWastageItem
                ? item.reel_no || item.barcode_id || item.frontend_id || "N/A"
                : item.reel_no || item.barcode_id || item.qr_code,
              searchTerm
            )}
            {/* {isSelected && (
              <span
                style={{
                  marginLeft: "8px",
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  backgroundColor: isWastageItem ? "#ea580c" : "#2563eb",
                  color: "white",
                  fontWeight: 500,
                }}>
                SELECTED
              </span>
            )} */}
          </div>
        </TableCell>
        <TableCell>
          {isWastageItem ? (
            <div style={{ color: "#6b7280", fontSize: "16px" }}>-</div>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "14px",
                  fontWeight: 500,
                }}>
                
                {getHighlightedText(item.client_name || "N/A", searchTerm)}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  marginTop: "1px",
                }}>
                Order: {getHighlightedText(item.order_id || "N/A", searchTerm)}
              </div>
            </div>
          )}
        </TableCell>
        <TableCell>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ fontWeight: 500, fontSize: "14px" }}>
              {getHighlightedText(formatPaperSpec(item.paper_spec), searchTerm)}
            </span>
            {!isWastageItem && (
              <WastageIndicator isWastageRoll={item.is_wastage_roll} />
            )}
          </div>
        </TableCell>
        <TableCell
          style={{ textAlign: "center", fontWeight: 500, fontSize: "14px" }}>
          {item.width_inches}"
        </TableCell>
        <TableCell
          style={{ textAlign: "center", fontWeight: 500, fontSize: "14px" }}>
          {item.weight_kg}kg
        </TableCell>
        <TableCell
          style={{ display: "flex", justifyContent: "center" }}
          onClick={(e) => e.stopPropagation()}>
          <PureCheckbox checked={isSelected} onChange={onToggle} />
        </TableCell>
      </TableRow>
    );
  }
);

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
  const [selectedWastageIds, setSelectedWastageIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedManualCutRollIds, setSelectedManualCutRollIds] = useState<
    Set<string>
  >(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

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
  const [clientSearch, setClientSearch] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [orderSearch, setOrderSearch] = useState("");

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
      loadOrders();
    } else {
      // Reset state
      setStep(1);
      setSelectedClientId("none");
      setSelectedOrderId("");
      setSelectedItems(new Set());
      setSelectedWastageIds(new Set());
      setSelectedManualCutRollIds(new Set());
      setSearchTerm("");
      setDebouncedSearchTerm("");
      setPreviewNumber("");
      setClientSearch("");
      setOrderSearch("");
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

      // Deduplicate clients based on ID
      const uniqueClients = Array.from(
        new Map(
          (data.clients || []).map((client: any) => [client.id, client])
        ).values()
      );

      setClients(uniqueClients);
    } catch (err) {
      console.error("Error loading clients:", err);
      toast.error("Failed to load clients");
    }
  };

  const loadOrders = async (searchQuery: string = "") => {
    try {
      const url = searchQuery
        ? `${API_BASE_URL}/orders/list-for-dispatch?search=${encodeURIComponent(searchQuery)}`
        : `${API_BASE_URL}/orders/list-for-dispatch?limit=1000`;

      const response = await fetch(url, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!response.ok) throw new Error("Failed to load orders");
      const data = await response.json();
      setOrders(data || []);
    } catch (err) {
      console.error("Error loading orders:", err);
      toast.error("Failed to load orders");
    }
  };

  const loadWarehouseItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/dispatch/warehouse-items`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
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

  const handleProceedToConfirmation = useCallback(() => {
    if (
      selectedItems.size === 0 &&
      selectedWastageIds.size === 0 &&
      selectedManualCutRollIds.size === 0
    ) {
      toast.error("Please select at least one item to dispatch");
      return;
    }
    setStep(3);
  }, [selectedItems, selectedWastageIds, selectedManualCutRollIds]);

  const handleDispatchConfirm = useCallback(async () => {
    try {
      setDispatchLoading(true);

      const dispatchData = {
        ...dispatchDetails,
        dispatch_number: "",
        client_id: selectedClientId,
        primary_order_id: selectedOrderId || undefined,
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
  }, [
    dispatchDetails,
    selectedClientId,
    selectedOrderId,
    selectedItems,
    selectedWastageIds,
    selectedManualCutRollIds,
    onOpenChange,
    onSuccess,
  ]);

  // Memoize selected client
  const selectedClient = useMemo(() => {
    return selectedClientId && selectedClientId !== "none"
      ? clients.find((c) => c.id === selectedClientId)
      : null;
  }, [selectedClientId, clients]);

  // Memoize filtered items - only recompute when search term changes
  const filteredData = useMemo(() => {
    const clientName = selectedClient?.company_name || "";

    const clientItems = warehouseItems.filter(
      (item) => item.client_name === clientName
    );
    const otherItems = warehouseItems.filter(
      (item) => item.client_name !== clientName
    );

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
      filteredClient: filterItems(clientItems),
      filteredOther: filterItems(otherItems),
      filteredWastage: filterItems(wastageItems, true),
      clientItems,
      otherItems,
    };
  }, [
    warehouseItems,
    wastageItems,
    selectedClient?.company_name,
    debouncedSearchTerm,
  ]);

  // Memoize combined items based on active tab
  const displayItems = useMemo(() => {
    const { filteredClient, filteredOther, filteredWastage } = filteredData;
    const selectedClientName = selectedClient?.company_name || "";

    // Filter manual cut rolls
    const filteredManual = manualCutRolls.filter((roll) => {
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
      return fields.some(
        (field) => field && field.toLowerCase().includes(debouncedSearchTerm)
      );
    });

    // Separate manual rolls by selected client
    const selectedClientManual = filteredManual.filter(
      (roll) => roll.client_name === selectedClientName
    );
    const otherClientManual = filteredManual.filter(
      (roll) => roll.client_name !== selectedClientName
    );

    // Sort "other" items alphabetically by client name
    const sortedOtherWarehouse = [...filteredOther].sort((a, b) =>
      (a.client_name || "").localeCompare(b.client_name || "")
    );
    const sortedOtherManual = [...otherClientManual].sort((a, b) =>
      (a.client_name || "").localeCompare(b.client_name || "")
    );

    // Build items array in correct order:
    // 1. Selected client warehouse items
    // 2. Selected client manual rolls
    // 3. Other warehouse items (alphabetically by client)
    // 4. Other manual rolls (alphabetically by client)
    // 5. Wastage items
    const items = [];
    items.push(
      ...filteredClient.map((item) => ({
        ...item,
        type: "warehouse",
        priority: 1,
      })),
      ...selectedClientManual.map((item) => ({
        ...item,
        type: "manual",
        priority: 2,
      })),
      ...sortedOtherWarehouse.map((item) => ({
        ...item,
        type: "warehouse",
        priority: 3,
      })),
      ...sortedOtherManual.map((item) => ({
        ...item,
        type: "manual",
        priority: 4,
      })),
      ...filteredWastage.map((item) => ({
        ...item,
        type: "wastage",
        priority: 5,
      }))
    );

    return items;
  }, [filteredData, manualCutRolls, debouncedSearchTerm, selectedClient]);

  // Optimized toggle handler - use Set for O(1) operations
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

  // Memoize stats to avoid recalculation
  const stats = useMemo(() => {
    const totalSelected =
      selectedItems.size +
      selectedWastageIds.size +
      selectedManualCutRollIds.size;

    // Calculate total weight only when needed
    let totalWeight = 0;
    if (totalSelected > 0) {
      warehouseItems.forEach((item) => {
        if (selectedItems.has(item.inventory_id)) {
          totalWeight += item.weight_kg || 0;
        }
      });
      wastageItems.forEach((item) => {
        if (selectedWastageIds.has(item.id)) {
          totalWeight += item.weight_kg || 0;
        }
      });
      manualCutRolls.forEach((item) => {
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
      manualCount: selectedManualCutRollIds.size,
    };
  }, [
    selectedItems,
    selectedWastageIds,
    selectedManualCutRollIds,
    warehouseItems,
    wastageItems,
    manualCutRolls,
  ]);

  // Print Preview Handler
  const handlePrintPreview = useCallback(() => {
    // Collect selected items data
    const selectedWarehouseItems = warehouseItems.filter(item =>
      selectedItems.has(item.inventory_id)
    );
    const selectedWastageItemsData = wastageItems.filter(item =>
      selectedWastageIds.has(item.id)
    );
    const selectedManualItems = manualCutRolls.filter(item =>
      selectedManualCutRollIds.has(item.id)
    );

    // Create preview dispatch object
    const previewDispatch = {
      dispatch_number: previewNumber,
      client: selectedClient,
      vehicle_number: dispatchDetails.vehicle_number,
      driver_name: dispatchDetails.driver_name,
      driver_mobile: dispatchDetails.driver_mobile,
      locket_no: dispatchDetails.locket_no,
      reference_number: dispatchDetails.reference_number,
      items: [
        ...selectedWarehouseItems.map((item: any) => ({
          ...item,
          item_type: 'warehouse'
        })),
        ...selectedWastageItemsData.map((item: any) => ({
          ...item,
          item_type: 'wastage'
        })),
        ...selectedManualItems.map((item: any) => ({
          ...item,
          item_type: 'manual'
        }))
      ],
      total_items: stats.totalSelected,
      total_weight: stats.totalWeight,
      created_at: new Date().toISOString(),
    };

    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Packing Slip - ${previewNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 6px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .info-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .info-block { display: grid; grid-template-columns: 2fr 1fr; }
            .info-block strong { display: inline-block; width: 150px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .summary { margin-top: 20px; text-align: right; font-size: 14px; font-weight: bold; }
            @media print {
              button { display: none; }
            }
            .print-button { margin: 20px 0; padding: 10px 20px; font-size: 16px; cursor: pointer; }
          </style>
        </head>
        <body>
          <button class="print-button" onclick="window.print()">Print This Document</button>

          <div class="header" style="display: flex; justify-content: space-between; align-items: center; ">
            <h2>Challan No: ${previewNumber}</h2>
            <p>Date: ${new Date().toLocaleDateString('en-GB')}</p>
          </div>

          <div class="info-section">
            <div class="info-block">
              <p><strong>Client:</strong> ${selectedClient?.company_name || 'N/A'}</p>
              <p><strong>Vehicle No:</strong> ${dispatchDetails.vehicle_number}</p>
              <p><strong>Driver Name:</strong> ${dispatchDetails.driver_name}</p>
              ${dispatchDetails.driver_mobile ? `<p><strong>Driver Mobile:</strong> ${dispatchDetails.driver_mobile}</p>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Barcode/QR Code</th>
                <th>Paper Specification</th>
                <th>Width (inches)</th>
                <th>Weight (kg)</th>
                ${selectedWarehouseItems.length > 0 ? '<th>Order ID</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${previewDispatch.items.map((item: any, index: number) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.reel_no || item.barcode_id || item.qr_code || item.frontend_id || 'N/A'}</td>
                  <td>${item.paper_spec || 'N/A'}</td>
                  <td>${item.width_inches || 'N/A'}</td>
                  <td>${item.weight_kg || 'N/A'}</td>
                  ${selectedWarehouseItems.length > 0 ? `<td>${item.order_id || '-'}</td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <p>Total Items: ${stats.totalSelected} | Total Weight: ${stats.totalWeight.toFixed(2)} kg</p>
          </div>

          <div style="margin-top: 50px; display: flex; justify-content: space-between;">
            <div>
              <p>_______________________</p>
              <p>Prepared By</p>
            </div>
            <div>
              <p>_______________________</p>
              <p>Checked By</p>
            </div>
            <div>
              <p>_______________________</p>
              <p>Received By</p>
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      toast.error("Unable to open print preview. Please check your browser's popup settings.");
    }
  }, [
    warehouseItems,
    wastageItems,
    manualCutRolls,
    selectedItems,
    selectedWastageIds,
    selectedManualCutRollIds,
    selectedClient,
    dispatchDetails,
    previewNumber,
    stats,
  ]);

  // Render optimized table
  const renderTable = useMemo(() => {
    if (loading) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "96px",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
          }}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading items...
        </div>
      );
    }

    if (displayItems.length === 0) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "96px",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
          }}>
          <div style={{ textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontWeight: 500, fontSize: "16px" }}>
              No items found
            </div>
            <div style={{ fontSize: "14px", marginTop: "4px" }}>
              {debouncedSearchTerm
                ? "Try adjusting your search"
                : "No items available"}
            </div>
          </div>
        </div>
      );
    }

    // Filter unselected items for left column
    const unselectedDisplayItems = displayItems.filter((item: any) => {
      const itemType = item.type;
      const itemId =
        itemType === "wastage"
          ? item.id
          : itemType === "manual"
          ? item.id
          : item.inventory_id;
      const isSelected = itemType === "wastage"
        ? selectedWastageIds.has(itemId)
        : itemType === "manual"
        ? selectedManualCutRollIds.has(itemId)
        : selectedItems.has(itemId);
      return !isSelected; // Only return unselected items
    });

    // Filter selected items for right column
    const selectedDisplayItems = displayItems.filter((item: any) => {
      const itemType = item.type;
      const itemId =
        itemType === "wastage"
          ? item.id
          : itemType === "manual"
          ? item.id
          : item.inventory_id;
      return itemType === "wastage"
        ? selectedWastageIds.has(itemId)
        : itemType === "manual"
        ? selectedManualCutRollIds.has(itemId)
        : selectedItems.has(itemId);
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border border-gray-200 rounded-md p-2" style={{
  height: '550px',
  maxHeight: '900px',
  overflow: 'hidden'
}}>
  {/* Left Column - Unselected Items */}
  <div style={{
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    overflow: 'auto',
    maxHeight: '545px'
  }}>

    <Table style={{ minWidth: '100%' }}>
      <TableHeader
        style={{
          position: "sticky",
          backgroundColor: "white",
          zIndex: 10,
        }}>
        <TableRow>
          <TableHead className="w-8 md:w-10 text-xs md:text-sm font-semibold">S.No</TableHead>
          <TableHead className="w-32 md:w-36 text-xs md:text-sm font-semibold">ID / Barcode</TableHead>
          <TableHead className="w-28 md:w-32 text-xs md:text-sm font-semibold">Client&Order</TableHead>
          <TableHead className="text-xs md:text-sm font-semibold">Paper Specs</TableHead>
          <TableHead className="w-16 md:w-20 text-center text-xs md:text-sm font-semibold">Width</TableHead>
          <TableHead className="w-16 md:w-20 text-center text-xs md:text-sm font-semibold">Weight</TableHead>
          <TableHead className="w-12 md:w-14 text-center text-xs md:text-sm font-semibold">Select</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {unselectedDisplayItems.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#6b7280" }}>
              <div style={{ fontSize: "14px" }}>All items selected!</div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>Deselect items from the right to see them here</div>
            </TableCell>
          </TableRow>
        ) : (
          unselectedDisplayItems.map((item: any, index) => {
            const itemType = item.type;
            const itemId =
              itemType === "wastage"
                ? item.id
                : itemType === "manual"
                ? item.id
                : item.inventory_id;
            const isSelected = false; // Always false in this column

            return (
              <OptimizedRow
                key={`all-${itemType.charAt(0)}-${itemId}`}
                item={item}
                index={index}
                isSelected={isSelected}
                itemType={itemType}
                searchTerm={searchTerm}
                onToggle={() => handleToggleItem(item, itemType)}
              />
            );
          })
        )}
      </TableBody>
    </Table>
  </div>

  {/* Right Column - Selected Items Only */}
  <div style={{
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    overflow: 'auto',
    maxHeight: '545px'
  }}>
    <Table style={{ minWidth: '100%' }}>
      <TableHeader
        style={{
          position: "sticky",
          backgroundColor: "white",
          zIndex: 10,
        }}>
        <TableRow>
          <TableHead className="w-8 md:w-10 text-xs md:text-sm font-semibold">S.No</TableHead>
          <TableHead className="w-32 md:w-36 text-xs md:text-sm font-semibold">ID / Barcode</TableHead>
          <TableHead className="w-28 md:w-32 text-xs md:text-sm font-semibold">Client & Order</TableHead>
          <TableHead className="text-xs md:text-sm font-semibold">Paper Specs</TableHead>
          <TableHead className="w-16 md:w-20 text-center text-xs md:text-sm font-semibold">Width</TableHead>
          <TableHead className="w-16 md:w-20 text-center text-xs md:text-sm font-semibold">Weight</TableHead>
          <TableHead className="w-12 md:w-14 text-center text-xs md:text-sm font-semibold">Select</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {selectedDisplayItems.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#6b7280" }}>
              <div style={{ fontSize: "14px" }}>No items selected</div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>Click on items from the left to select them</div>
            </TableCell>
          </TableRow>
        ) : (
          selectedDisplayItems.map((item: any, index) => {
            const itemType = item.type;
            const itemId =
              itemType === "wastage"
                ? item.id
                : itemType === "manual"
                ? item.id
                : item.inventory_id;
            const isSelected = true; // Always true in this column

            return (
              <OptimizedRow
                key={`selected-${itemType.charAt(0)}-${itemId}`}
                item={item}
                index={index}
                isSelected={isSelected}
                itemType={itemType}
                searchTerm={searchTerm}
                onToggle={() => handleToggleItem(item, itemType)}
              />
            );
          })
        )}
      </TableBody>
    </Table>
  </div>
</div>
    );
  }, [
    loading,
    displayItems,
    debouncedSearchTerm,
    searchTerm,
    selectedItems,
    selectedWastageIds,
    selectedManualCutRollIds,
    handleToggleItem,
    stats.totalSelected, // Add to trigger re-render when selection changes
  ]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-[95vw] max-w-[1200px] lg:max-w-[1680px] max-h-[95vh] flex flex-col p-4 md:p-6"
          style={{
            display: "flex",
            flexDirection: "column",
          }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            {step === 1 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "8px",
                }}>
                {/* Form fields... */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="md:col-span-2 lg:col-span-2">
                  <label
                    style={{
                    fontSize: "16px",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                    }}>
                    <Building2 style={{ width: "18px", height: "18px" }} />
                    Select Client *
                  </label>
                  <Select
                    value={selectedClientId}
                    onValueChange={(value) => {
                    setSelectedClientId(value);
                    setSelectedItems(new Set());
                    }}>
                    <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectSearch
                      placeholder="Search clients..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <SelectItem value="none" disabled>
                      Select a client
                    </SelectItem>
                    {clients
                      .filter((client) =>
                      client.company_name
                        .toLowerCase()
                        .includes(clientSearch.toLowerCase())
                      )
                      .sort((a, b) =>
                      a.company_name.localeCompare(b.company_name)
                      )
                      .map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </div>

                  <div className="md:col-span-1 lg:col-span-1">
                  <label
                    style={{
                    fontSize: "16px",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                    }}>
                    <Package style={{ width: "18px", height: "18px" }} />
                    Select Order
                  </label>
                  <Select
                    value={selectedOrderId}
                    onValueChange={setSelectedOrderId}>
                    <SelectTrigger>
                    <SelectValue placeholder="Select order" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectSearch
                      placeholder="Search orders..."
                      value={orderSearch}
                      onChange={(e) => {
                        setOrderSearch(e.target.value);
                        loadOrders(e.target.value);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <SelectItem value="all">
                      No order selected
                    </SelectItem>
                    {orders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.frontend_id} - {order.client_name}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
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
                    }}>
                    Challan Number *
                    <span
                    style={{
                      fontSize: "12px",
                      color: "#2563eb",
                      backgroundColor: "#dbeafe",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}>
                    Preview
                    </span>
                  </label>
                  <Input
                    value={
                    previewLoading
                      ? "Loading..."
                      : previewNumber || "Loading..."
                    }
                    readOnly
                    style={{
                    fontFamily: "monospace",
                    backgroundColor: "#f9fafb",
                    borderColor: "#bfdbfe",
                    color: "#1d4ed8",
                    fontSize: "16px",
                    padding: "12px",
                    }}
                    placeholder="Loading preview..."
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
                    }}>
                    Date
                  </label>
                  <Input
                    value={new Date().toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    })}
                    readOnly
                    style={{
                    fontSize: "16px",
                    padding: "12px",
                    backgroundColor: "#f3f4f6",
                    cursor: "not-allowed",
                    color: "#374151",
                    }}
                  />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                 

                  <div>
                    <label
                      style={{
                        fontSize: "16px",
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "8px",
                      }}>
                      <Truck style={{ width: "18px", height: "18px" }} />
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
                      }}>
                      <User style={{ width: "18px", height: "18px" }} />
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
                      }}>
                      <Phone style={{ width: "18px", height: "18px" }} />
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
                      style={{ fontSize: "16px", padding: "12px" }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: "16px",
                        fontWeight: 500,
                        marginBottom: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}>
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
                      style={{ fontSize: "16px", padding: "12px" }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: "16px",
                        fontWeight: 500,
                        marginBottom: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}>
                      Reference Number
                    </label>
                    <Input
                      value={dispatchDetails.reference_number}
                      onChange={(e) =>
                        setDispatchDetails((prev) => ({
                          ...prev,
                          reference_number: e.target.value,
                        }))
                      }
                      style={{ fontSize: "16px", padding: "12px" }}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSaveDetails}
                  className="w-full text-sm md:text-base mt-2"
                  size="lg">
                  <CheckCircle
                    style={{
                      width: "20px",
                      height: "20px",
                      marginRight: "8px",
                    }}
                  />
                  Continue to Item Selection
                </Button>
              </div>
            ) : step === 2 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "8px",
                  height: "90vh",
                }}>
                {/* Summary */}
                {/* Search */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div className="relative w-full md:w-1/2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 text-gray-500" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border-3 border-orange-700 h-12 md:h-16 text-base md:text-xl pl-12 pr-12"
                      placeholder="Search across all items: QR code, barcode, reel no, order, paper spec, creator..."
                    />
                    {searchTerm && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 p-0">
                        <X className="w-4 h-4 md:w-5 md:h-5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2 md:gap-4 w-full md:w-auto">
                   
                    <Button
                      onClick={() => {
                        handleProceedToConfirmation()
                        handlePrintPreview()
                      }}
                      disabled={stats.totalSelected === 0}
                      className="flex-1 md:flex-none bg-green-600 text-base md:text-lg"
                      style={{ minWidth: "120px" }}
                      size="lg">
                      Review
                    </Button>
                    <Button
                      onClick={handleDispatchConfirm}
                      disabled={stats.totalSelected === 0}
                      className="flex-1 md:flex-none bg-green-600 text-base md:text-lg"
                      style={{ minWidth: "120px" }}
                      size="lg">
                      Save
                    </Button>
                  </div>
                </div>

                {/* Tab content with optimized table */}
                <div className="h-full">
                  <div className="mb-2 text-xs md:text-sm text-gray-600 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <span>
                      <span className="text-green-500 font-medium">●</span>{" "}
                      <span className="hidden md:inline">Green border = Priority items | Select items to move them to the right</span>
                      <span className="md:hidden">Priority items (green border)</span>
                    </span>
                    <span className="font-medium text-xs md:text-sm">
                      <span className="hidden md:inline">Total: {displayItems.length} items | Selected: {stats.totalSelected} | Available: {displayItems.length - stats.totalSelected}</span>
                      <span className="md:hidden">Selected: {stats.totalSelected} / {displayItems.length}</span>
                    </span>
                  </div>
                  {renderTable}
                </div>
                <div className="border border-green-300 rounded-md p-2 md:p-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gray-50">
                  {/* Left Section - Dispatch Details */}
                  <div className="flex flex-wrap items-center gap-2 md:gap-4 flex-1">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}>
                      <span
                        style={{
                          color: "#6b7280",
                          fontWeight: 500,
                          fontSize: "15px",
                        }}>
                        Client:
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "15px",
                          color: "#000",
                        }}>
                        {selectedClient?.company_name}
                      </span>
                    </div>

                    <div
                      style={{
                        height: "24px",
                        width: "2px",
                        backgroundColor: "#d1d5db",
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}>
                      <span
                        style={{
                          color: "#6b7280",
                          fontWeight: 500,
                          fontSize: "15px",
                        }}>
                        Vehicle:
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "15px",
                          color: "#000",
                        }}>
                        {dispatchDetails.vehicle_number}
                      </span>
                    </div>

                    <div
                      style={{
                        height: "24px",
                        width: "2px",
                        backgroundColor: "#d1d5db",
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}>
                      <span
                        style={{
                          color: "#6b7280",
                          fontWeight: 500,
                          fontSize: "15px",
                        }}>
                        Driver:
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "15px",
                          color: "#000",
                        }}>
                        {dispatchDetails.driver_name}
                      </span>
                    </div>

                    <div
                      style={{
                        height: "24px",
                        width: "2px",
                        backgroundColor: "#d1d5db",
                      }}
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(1)}>
                      Edit
                    </Button>
                  </div>

                  {/* Right Section - Stats and Action */}
                  <div className="flex flex-wrap items-center gap-2 md:gap-4">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}>
                      <span
                        style={{
                          fontSize: "15px",
                          color: "#6b7280",
                          fontWeight: 500,
                        }}>
                        Total Selected:
                      </span>
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: "bold",
                          color: "#2563eb",
                          minWidth: "30px",
                          textAlign: "center",
                        }}>
                        {stats.totalSelected}
                      </span>
                    </div>

                    <div
                      style={{
                        height: "24px",
                        width: "2px",
                        backgroundColor: "#d1d5db",
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}>
                      <span
                        style={{
                          fontSize: "15px",
                          color: "#6b7280",
                          fontWeight: 500,
                        }}>
                        Total Weight:
                      </span>
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: "bold",
                          color: "#16a34a",
                          minWidth: "80px",
                          textAlign: "center",
                        }}>
                        {stats.totalWeight.toFixed(1)} kg
                      </span>
                    </div>

                    <div
                      style={{
                        height: "24px",
                        width: "2px",
                        backgroundColor: "#d1d5db",
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  padding: "8px",
                }}>
                {/* Header with Action Buttons */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold">
                      Confirm Dispatch
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => setStep(2)}
                      disabled={dispatchLoading}
                      className="flex-1 md:flex-none text-sm md:text-base"
                      size="lg">
                      <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                      Back
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handlePrintPreview}
                      disabled={dispatchLoading}
                      className="flex-1 md:flex-none text-sm md:text-base border-blue-600 text-blue-600"
                      size="lg">
                      <Printer className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                      Print Preview
                    </Button>
                    <Button
                      onClick={handleDispatchConfirm}
                      disabled={dispatchLoading}
                      className="flex-1 md:flex-none bg-green-600 text-sm md:text-base"
                      size="lg">
                      {dispatchLoading ? (
                        <>
                          <Loader2 style={{ marginRight: "8px", width: "20px", height: "20px", animation: "spin 1s linear infinite" }} />
                          Creating Dispatch...
                        </>
                      ) : (
                        <>
                          <CheckCircle style={{ width: "20px", height: "20px", marginRight: "8px" }} />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Dispatch Summary */}
                <div className="border border-green-300 rounded-md p-3 bg-green-50">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Client</div>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{selectedClient?.company_name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Vehicle</div>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{dispatchDetails.vehicle_number}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Driver</div>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{dispatchDetails.driver_name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Total Items</div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#2563eb" }}>{stats.totalSelected}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Total Weight</div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#16a34a" }}>{stats.totalWeight.toFixed(1)} kg</div>
                    </div>
                  </div>
                </div>

                {/* Selected Items in Two Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ maxHeight: "450px", overflow: "hidden" }}>
                  {/* Left Column */}
                  <div className="border border-gray-200 rounded-md overflow-auto" style={{ maxHeight: "450px" }}>
                    <Table>
                      <TableHeader style={{ position: "sticky", top: 0, backgroundColor: "white", zIndex: 10 }}>
                        <TableRow>
                          <TableHead className="text-xs md:text-sm font-semibold">S.No</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold">ID / Barcode</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold">Paper Spec</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-center">Width</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-center">Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayItems
                          .filter((item: any) => {
                            const itemType = item.type;
                            const itemId = itemType === "wastage" ? item.id : (itemType === "manual" ? item.id : item.inventory_id);
                            return itemType === "wastage" ? selectedWastageIds.has(itemId) : (itemType === "manual" ? selectedManualCutRollIds.has(itemId) : selectedItems.has(itemId));
                          })
                          .slice(0, Math.ceil(stats.totalSelected / 2))
                          .map((item: any, index: number) => {
                            const isWastageItem = item.type === "wastage";
                            const formatPaperSpec = (paperSpec: string) => {
                              if (!paperSpec) return "N/A";
                              const parts = paperSpec.split(",").map((p: string) => p.trim());
                              if (parts.length < 3) return paperSpec;
                              const gsm = parts[0].replace("gsm", "").trim();
                              const bf = parts[1].replace("bf", "").trim();
                              const bfValue = parseFloat(bf);
                              const bfFormatted = bfValue % 1 === 0 ? Math.floor(bfValue).toString() : bf;
                              const shade = parts[2].trim().charAt(0).toUpperCase();
                              return `${gsm}gsm,${bfFormatted}bf,${shade}`;
                            };
                            return (
                              <TableRow key={index} style={{ backgroundColor: isWastageItem ? "#fff7ed" : "#eff6ff" }}>
                                <TableCell style={{ fontSize: "14px", fontWeight: 500 }}>{index + 1}</TableCell>
                                <TableCell style={{ fontSize: "14px", fontFamily: "monospace" }}>
                                  {isWastageItem ? (item.reel_no || item.barcode_id || item.frontend_id) : (item.reel_no || item.barcode_id || item.qr_code)}
                                </TableCell>
                                <TableCell style={{ fontSize: "14px" }}>{formatPaperSpec(item.paper_spec)}</TableCell>
                                <TableCell style={{ fontSize: "14px", textAlign: "center" }}>{item.width_inches}"</TableCell>
                                <TableCell style={{ fontSize: "14px", textAlign: "center" }}>{item.weight_kg}kg</TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Right Column */}
                  <div className="border border-gray-200 rounded-md overflow-auto" style={{ maxHeight: "450px" }}>
                    <Table>
                      <TableHeader style={{ position: "sticky", top: 0, backgroundColor: "white", zIndex: 10 }}>
                        <TableRow>
                          <TableHead className="text-xs md:text-sm font-semibold">S.No</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold">ID / Barcode</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold">Paper Spec</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-center">Width</TableHead>
                          <TableHead className="text-xs md:text-sm font-semibold text-center">Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayItems
                          .filter((item: any) => {
                            const itemType = item.type;
                            const itemId = itemType === "wastage" ? item.id : (itemType === "manual" ? item.id : item.inventory_id);
                            return itemType === "wastage" ? selectedWastageIds.has(itemId) : (itemType === "manual" ? selectedManualCutRollIds.has(itemId) : selectedItems.has(itemId));
                          })
                          .slice(Math.ceil(stats.totalSelected / 2))
                          .map((item: any, index: number) => {
                            const isWastageItem = item.type === "wastage";
                            const startIndex = Math.ceil(stats.totalSelected / 2);
                            const formatPaperSpec = (paperSpec: string) => {
                              if (!paperSpec) return "N/A";
                              const parts = paperSpec.split(",").map((p: string) => p.trim());
                              if (parts.length < 3) return paperSpec;
                              const gsm = parts[0].replace("gsm", "").trim();
                              const bf = parts[1].replace("bf", "").trim();
                              const bfValue = parseFloat(bf);
                              const bfFormatted = bfValue % 1 === 0 ? Math.floor(bfValue).toString() : bf;
                              const shade = parts[2].trim().charAt(0).toUpperCase();
                              return `${gsm}gsm,${bfFormatted}bf,${shade}`;
                            };
                            return (
                              <TableRow key={index} style={{ backgroundColor: isWastageItem ? "#fff7ed" : "#eff6ff" }}>
                                <TableCell style={{ fontSize: "14px", fontWeight: 500 }}>{startIndex + index + 1}</TableCell>
                                <TableCell style={{ fontSize: "14px", fontFamily: "monospace" }}>
                                  {isWastageItem ? (item.reel_no || item.barcode_id || item.frontend_id) : (item.reel_no || item.barcode_id || item.qr_code)}
                                </TableCell>
                                <TableCell style={{ fontSize: "14px" }}>{formatPaperSpec(item.paper_spec)}</TableCell>
                                <TableCell style={{ fontSize: "14px", textAlign: "center" }}>{item.width_inches}"</TableCell>
                                <TableCell style={{ fontSize: "14px", textAlign: "center" }}>{item.weight_kg}kg</TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
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
