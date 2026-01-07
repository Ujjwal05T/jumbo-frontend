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
import { createDispatchRecord, updateDispatchRecord, fetchDispatchDetails, DraftDispatch } from "@/lib/dispatch";
import WastageIndicator from "@/components/WastageIndicator";
import { DispatchSuccessModal } from "@/components/DispatchSuccessModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import jsPDF from 'jspdf';

interface CreateDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  draftIdToRestore?: string | null;  // Optional draft ID to restore when modal opens
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
  draftIdToRestore,
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

  // Draft management state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [draftItems, setDraftItems] = useState<any[]>([]); // Items from the draft's dispatch_items table

  const [dispatchDetails, setDispatchDetails] = useState({
    rst_no: "",
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    locket_no: "",
    dispatch_number: "",
    reference_number: "",
    gross_weight: "",
  });

  const [previewNumber, setPreviewNumber] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [orderSearch, setOrderSearch] = useState("");
  const [todaysVehicles, setTodaysVehicles] = useState<any[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState("");

  // Detect mobile device to prevent keyboard auto-focus issues with Select dropdowns
  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window);

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
      // Don't show draft restore dialog automatically - drafts are accessed via table
      loadClients();
      loadWarehouseItems();
      loadWastageItems();
      loadManualCutRolls();
      loadPreviewNumber();
      loadOrders(); // Load all orders on mount
      loadTodaysVehicles(); // Load today's vehicles for dropdown
    } else {
      // Reset state (but keep draft info)
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
      setOrders([]); // Clear orders when modal closes
      setDraftItems([]); // Clear draft items
      setCurrentDraftId(null); // Clear draft ID
      setIsDraftMode(false); // Exit draft mode
      // Reset dispatch details
      setDispatchDetails({
        rst_no: "",
        vehicle_number: "",
        driver_name: "",
        driver_mobile: "",
        locket_no: "",
        dispatch_number: "",
        reference_number: "",
        gross_weight: "",
      });
    }
  }, [open, draftIdToRestore]);

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

  const loadOrders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/list-for-dispatch?limit=1000`, {
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

  const loadTodaysVehicles = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const response = await fetch(`${API_BASE_URL}/dispatch/today-vehicles?date=${today}`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!response.ok) throw new Error("Failed to load today's vehicles");
      const data = await response.json();
      setTodaysVehicles(data.vehicles || []);
    } catch (err) {
      console.error("Error loading today's vehicles:", err);
      // Don't show error toast, just log it - vehicles dropdown will be empty
    }
  };

  // Helper function to normalize company/party names for fuzzy matching
  const normalizeForMatch = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/private\s+limited/gi, '')   // Remove "Private Limited"
      .replace(/pvt\.?\s*ltd\.?/gi, '')     // Remove "Pvt Ltd", "Pvt. Ltd.", etc.
      .replace(/\blimited\b/gi, '')         // Remove "Limited"
      .replace(/\bltd\.?\b/gi, '')          // Remove "Ltd", "Ltd."
      .replace(/\binc\.?\b/gi, '')          // Remove "Inc", "Inc."
      .replace(/\bcorp\.?\b/gi, '')         // Remove "Corp", "Corp."
      .replace(/\bcorporation\b/gi, '')     // Remove "Corporation"
      .replace(/\bllc\.?\b/gi, '')          // Remove "LLC", "LLC."
      .replace(/\bco\.?\b/gi, '')           // Remove "Co", "Co."
      .replace(/&/g, 'and')                 // Replace & with "and"
      .replace(/[^\w\s]/g, '')              // Remove all punctuation
      .replace(/\s+/g, ' ')                 // Normalize whitespace
      .trim();
  };

  const handleVehicleSelect = (vehicleNumber: string) => {
    // Find the vehicle data from today's vehicles
    const vehicleData = todaysVehicles.find(v => v.vehicle_number === vehicleNumber);

    if (vehicleData) {
      // Auto-fill dispatch details from the most recent dispatch with this vehicle
      setDispatchDetails({
        vehicle_number: vehicleNumber,
        rst_no: vehicleData.rst_no || "",
        driver_name: vehicleData.driver_name || "",
        driver_mobile: vehicleData.driver_mobile || "",
        gross_weight: vehicleData.gross_weight || "",
        locket_no: vehicleData.locket_no || "",
        dispatch_number: vehicleData.dispatch_number || "",
        reference_number: vehicleData.reference_number || "",
      });

      // Auto-select client based on party_name from outward challan (using fuzzy matching)
      if (vehicleData.party_name && vehicleData.party_name.trim()) {
        const normalizedParty = normalizeForMatch(vehicleData.party_name);

        const matchingClient = clients.find(client => {
          const normalizedClient = normalizeForMatch(client.company_name);
          // Check if either name contains the other (bidirectional partial match)
          return normalizedClient.includes(normalizedParty) ||
                 normalizedParty.includes(normalizedClient);
        });

        if (matchingClient) {
          setSelectedClientId(matchingClient.id);
          toast.success(`Vehicle details and client (${matchingClient.company_name}) auto-filled from outward challan`);
        } else {
          toast.success("Vehicle details auto-filled from outward challan");
          toast.info(`Party name "${vehicleData.party_name}" from challan doesn't match any client. Please select manually.`);
        }
      } else {
        toast.success("Vehicle details auto-filled from outward challan");
      }
    } else {
      // New vehicle - just set the vehicle number
      setDispatchDetails(prev => ({
        ...prev,
        vehicle_number: vehicleNumber,
      }));
    }
  };

  const restoreDraft = async (draft: DraftDispatch) => {
    try {
      setLoading(true);
      toast.info("Restoring draft...");

      // Restore all draft data
      setCurrentDraftId(draft.id);
      setIsDraftMode(true);
      setSelectedClientId(draft.client_id);
      setSelectedOrderId(draft.primary_order_id || "");

      setDispatchDetails({
        rst_no: draft.rst_no || "",
        vehicle_number: draft.vehicle_number,
        driver_name: draft.driver_name,
        driver_mobile: draft.driver_mobile,
        locket_no: draft.locket_no || "",
        dispatch_number: draft.dispatch_number,
        reference_number: draft.reference_number || "",
        gross_weight: draft.gross_weight || "",
      });

      // Fetch draft items from dispatch_items table (they're marked as "used" so won't appear in warehouse query)
      const dispatchDetails = await fetchDispatchDetails(draft.id);

      // Enhance draft items with order information
      // Client name now comes from backend (inventory → order → client relationship)
      const enhancedDraftItems = (dispatchDetails.items || []).map(item => ({
        ...item,
        // Use backend-provided client_name (from inventory allocation), fallback to dispatch-level client
        client_name: item.client_name || dispatchDetails.client?.company_name || "Unknown",
        order_id: item.order_frontend_id || "N/A"
      }));

      setDraftItems(enhancedDraftItems);

      console.log("Draft items loaded:", enhancedDraftItems.length);

      // Wait for all data to load (for adding additional items)
      await Promise.all([
        loadWarehouseItems(),
        loadWastageItems(),
        loadManualCutRolls(),
        loadClients(),
        loadOrders()
      ]);

      // Mark draft items as selected based on their type
      // Regular inventory items

      const draftInventoryIds = enhancedDraftItems
        .filter(item => item.inventory?.id)
        .map(item => item.inventory!.id);

      // Wastage items (identified by barcode pattern)
      const draftWastageIds = enhancedDraftItems
        .filter(item => !item.inventory?.id && item.barcode_id?.includes("WAS"))
        .map(item => item.id);

      // Manual cut rolls (identified by barcode pattern)
      const draftManualIds = enhancedDraftItems
        .filter(item => !item.inventory?.id && item.barcode_id?.startsWith("CR_") && (item as any).manual_cut_roll_id)
        .map(item => (item as any).manual_cut_roll_id);

      console.log("Selecting draft items:", { draftInventoryIds, draftWastageIds, draftManualIds });

      setSelectedItems(new Set(draftInventoryIds));
      setSelectedWastageIds(new Set(draftWastageIds));
      setSelectedManualCutRollIds(new Set(draftManualIds));

      // Jump to step 2 (item selection) so user can see draft items
      setStep(2);
      toast.success(`Draft restored: ${draft.dispatch_number} with ${enhancedDraftItems.length} items`);
    } catch (error) {
      console.error("Error restoring draft:", error);
      toast.error("Failed to restore draft");
    } finally {
      setLoading(false);
    }
  };

  // Restore draft by ID (used when clicking on a draft in the dispatch history table)
  const restoreDraftById = async (draftId: string) => {
    try {
      setLoading(true);
      toast.info("Loading draft...");

      // Fetch the draft details
      const dispatchDetails = await fetchDispatchDetails(draftId);

      // Create a DraftDispatch object from the details
      const draft: DraftDispatch = {
        id: dispatchDetails.id,
        dispatch_number: dispatchDetails.dispatch_number,
        reference_number: dispatchDetails.reference_number || "",
        client_id: dispatchDetails.client?.id || "",
        primary_order_id: dispatchDetails.primary_order?.id || null,
        vehicle_number: dispatchDetails.vehicle_number,
        driver_name: dispatchDetails.driver_name,
        driver_mobile: dispatchDetails.driver_mobile,
        locket_no: "",
        rst_no: "",
        gross_weight: "",
        created_at: dispatchDetails.created_at,
      };

      // Use the existing restoreDraft function
      await restoreDraft(draft);
    } catch (error) {
      console.error("Error restoring draft by ID:", error);
      toast.error("Failed to load draft");
      setLoading(false);
    }
  };

  // Effect to handle draftIdToRestore prop
  useEffect(() => {
    if (open && draftIdToRestore) {
      restoreDraftById(draftIdToRestore);
    }
  }, [open, draftIdToRestore]);

  const loadWarehouseItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/dispatch/warehouse-items`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!response.ok) throw new Error("Failed to load warehouse items");
      const data = await response.json();
      console.log("Loaded warehouse items:", data.warehouse_items);
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
      console.log("Loaded manual cut rolls:", data.manual_cut_rolls);
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

  const handleProceedToConfirmation = useCallback(async () => {
    if (
      selectedItems.size === 0 &&
      selectedWastageIds.size === 0 &&
      selectedManualCutRollIds.size === 0
    ) {
      toast.error("Please select at least one item to dispatch");
      return;
    }

    try {
      // Create or update draft dispatch
      if (!isDraftMode || !currentDraftId) {
        // Create new draft
        const draftData = {
          ...dispatchDetails,
          dispatch_number: "",
          client_id: selectedClientId,
          primary_order_id: selectedOrderId || undefined,
          inventory_ids: Array.from(selectedItems),
          wastage_ids: Array.from(selectedWastageIds),
          manual_cut_roll_ids: Array.from(selectedManualCutRollIds),
          is_draft: true, // Mark as draft
          payment_type: "to_pay", // Default value
        };

        const result = await createDispatchRecord(draftData as any);
        setCurrentDraftId(result.dispatch_id);
        setIsDraftMode(true);
        console.log("Draft created:", result.dispatch_id);
      } else {
        // Update existing draft
        await updateDispatchRecord(currentDraftId, {
          ...dispatchDetails,
          client_id: selectedClientId,
          primary_order_id: selectedOrderId || undefined,
          inventory_ids: Array.from(selectedItems),
          wastage_ids: Array.from(selectedWastageIds),
          manual_cut_roll_ids: Array.from(selectedManualCutRollIds),
          is_draft: true,
        });
        console.log("Draft updated:", currentDraftId);
      }

      setStep(3);
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    }
  }, [
    selectedItems,
    selectedWastageIds,
    selectedManualCutRollIds,
    isDraftMode,
    currentDraftId,
    dispatchDetails,
    selectedClientId,
    selectedOrderId,
  ]);

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
        is_draft: false, // Finalize the dispatch
      };

      let result;

      if (isDraftMode && currentDraftId) {
        // Update existing draft and finalize it
        result = await updateDispatchRecord(currentDraftId, {
          ...dispatchData,
          is_draft: false,
        });
        toast.success("Draft finalized successfully!");
      } else {
        // Create new dispatch directly (shouldn't normally happen with current flow)
        result = await createDispatchRecord(dispatchData as any);
      }

      setDispatchResult(result);
      setSuccessModalOpen(true);

      // Clear draft state
      setCurrentDraftId(null);
      setIsDraftMode(false);

      // Call onSuccess first to refresh the list before closing modal
      if (onSuccess) {
        onSuccess();
      }

      onOpenChange(false);
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
    isDraftMode,
    currentDraftId,
    onOpenChange,
    onSuccess,
  ]);

  // Memoize selected client
  const selectedClient = useMemo(() => {
    return selectedClientId && selectedClientId !== "none"
      ? clients.find((c) => c.id === selectedClientId)
      : null;
  }, [selectedClientId, clients]);

  // Filter orders based on selected client and search term
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Filter by selected client
    if (selectedClientId && selectedClientId !== "none" && selectedClient) {
      filtered = filtered.filter(order => order.client_name === selectedClient.company_name);
    }

    // Filter by search term
    if (orderSearch && orderSearch.trim()) {
      const searchLower = orderSearch.toLowerCase();
      filtered = filtered.filter(order =>
        order.frontend_id?.toLowerCase().includes(searchLower) ||
        order.client_name?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [orders, selectedClientId, selectedClient, orderSearch]);

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

    // Filter draft items by search term if in draft mode
    const filteredDraftItems = isDraftMode ? draftItems.filter((item) => {
      if (!debouncedSearchTerm) return true;
      const fields = [
        item.barcode_id,
        item.qr_code,
        item.paper_spec,
        String(item.width_inches),
        String(item.weight_kg),
      ];
      return fields.some(
        (field) => field && field.toLowerCase().includes(debouncedSearchTerm)
      );
    }) : [];

    // Build items array in correct order:
    // 0. Draft items (if in draft mode) - shown first with highest priority
    // 1. Selected client warehouse items
    // 2. Selected client manual rolls
    // 3. Other warehouse items (alphabetically by client)
    // 4. Other manual rolls (alphabetically by client)
    // 5. Wastage items
    const items = [];

    // Add draft items first if in draft mode
    if (isDraftMode && filteredDraftItems.length > 0) {
      items.push(
        ...filteredDraftItems.map((item) => {
          // Determine the correct ID based on item type
          let itemId;
          if (item.inventory?.id) {
            // Regular inventory item
            itemId = item.inventory.id;
          } else if ((item as any).manual_cut_roll_id) {
            // Manual cut roll - use manual_cut_roll_id
            itemId = (item as any).manual_cut_roll_id;
          } else {
            // Wastage or other - use dispatch_item id
            itemId = item.id;
          }

          return {
            ...item,
            inventory_id: itemId,
            id: itemId, // Override id to be the correct ID for matching
            type: "draft",
            priority: 0,
          };
        })
      );
    }

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
  }, [filteredData, manualCutRolls, debouncedSearchTerm, selectedClient, isDraftMode, draftItems]);

  // Optimized toggle handler - use Set for O(1) operations
  const handleToggleItem = useCallback((item: any, itemType: string) => {
    // For draft items, determine the correct Set and ID based on the item's characteristics
    let itemId;
    let targetSet: "wastage" | "manual" | "inventory";

    if (itemType === "draft") {
      if (item.inventory?.id) {
        // Draft inventory item
        itemId = item.inventory.id;
        targetSet = "inventory";
      } else if (item.barcode_id?.startsWith("CR_") && (item as any).manual_cut_roll_id) {
        // Draft manual cut roll
        itemId = (item as any).manual_cut_roll_id;
        targetSet = "manual";
      } else if (item.barcode_id?.includes("WAS")) {
        // Draft wastage item
        itemId = item.id;
        targetSet = "wastage";
      } else {
        console.warn("Unknown draft item type:", item);
        return;
      }
    } else {
      itemId =
        itemType === "wastage"
          ? item.id
          : itemType === "manual"
          ? item.id
          : item.inventory_id;
      targetSet = itemType === "wastage" ? "wastage" : itemType === "manual" ? "manual" : "inventory";
    }

    if (targetSet === "wastage") {
      setSelectedWastageIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else if (targetSet === "manual") {
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
      // Include draft items in weight calculation
      draftItems.forEach((item) => {
        // Draft items with inventory
        if (item.inventory?.id && selectedItems.has(item.inventory.id)) {
          totalWeight += item.weight_kg || 0;
        }
        // Draft wastage items (no inventory, barcode contains "WAS")
        else if (!item.inventory?.id && item.barcode_id?.includes("WAS") && selectedWastageIds.has(item.id)) {
          totalWeight += item.weight_kg || 0;
        }
        // Draft manual cut rolls (no inventory, barcode starts with "CR_")
        else if (!item.inventory?.id && item.barcode_id?.startsWith("CR_") && (item as any).manual_cut_roll_id && selectedManualCutRollIds.has((item as any).manual_cut_roll_id)) {
          totalWeight += item.weight_kg || 0;
        }
      });

      // Include warehouse items
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
    draftItems,
  ]);

  // Helper functions to extract paper specifications (same as packing slip)
  const extractGSMFromSpec = (spec: string): string => {
    if (!spec) return '';
    const match = spec.match(/(\d+)gsm/i);
    return match ? match[1] : '';
  };

  const extractBFFromSpec = (spec: string): string => {
    if (!spec) return '';
    const match = spec.match(/(\d+(?:\.\d+)?)bf/i);
    return match ? match[1] : '';
  };

  const extractShadeFromSpec = (spec: string): string => {
    if (!spec) return '';
    const parts = spec.split(',').map(p => p.trim());
    const shadePart = parts.find(part =>
      !part.toLowerCase().includes('gsm') &&
      !part.toLowerCase().includes('bf') &&
      !part.match(/^\d/)
    );
    return shadePart || '';
  };

  const extractReelNumber = (barcode: string): string => {
    if (!barcode) return '';
    return barcode.replace(/^[A-Z]+_/, '');
  };

  // Print Preview Handler - uses jsPDF with same format as packing slip
  const handlePrintPreview = useCallback(async () => {
    try {
      // Collect all selected items (draft + new)
      const allSelectedItems = [
        ...draftItems.filter(item =>
          (item.inventory?.id && selectedItems.has(item.inventory.id)) ||
          (!item.inventory?.id && item.barcode_id?.includes("WAS") && selectedWastageIds.has(item.id)) ||
          (!item.inventory?.id && item.barcode_id?.startsWith("CR_") && (item as any).manual_cut_roll_id && selectedManualCutRollIds.has((item as any).manual_cut_roll_id))
        ),
        ...warehouseItems.filter(item => selectedItems.has(item.inventory_id)),
        ...wastageItems.filter(item => selectedWastageIds.has(item.id)),
        ...manualCutRolls.filter(item => selectedManualCutRollIds.has(item.id))
      ];

      // Convert items to packing slip format
      const packingSlipItems = allSelectedItems.map((item: any, index: number) => ({
        sno: index + 1,
        gsm: extractGSMFromSpec(item.paper_spec) || '',
        bf: extractBFFromSpec(item.paper_spec) || '',
        size: parseFloat(item.width_inches) || '',
        reel: extractReelNumber(item.barcode_id) || item.qr_code || item.barcode_id || '',
        weight: Math.round(parseFloat(item.weight_kg) || 0),
        natgold: extractShadeFromSpec(item.paper_spec) || '',
        order_frontend_id: item.order_id || item.order_frontend_id || ''
      }));

      // Sort items (same logic as packing slip)
      const sortedItems = packingSlipItems.sort((a: any, b: any) => {
        const sizeA = parseFloat(String(a.size)) || 0;
        const sizeB = parseFloat(String(b.size)) || 0;
        if (sizeA !== sizeB) return sizeA - sizeB;

        const gsmA = parseFloat(String(a.gsm)) || 0;
        const gsmB = parseFloat(String(b.gsm)) || 0;
        if (gsmA !== gsmB) return gsmA - gsmB;

        const bfA = parseFloat(String(a.bf)) || 0;
        const bfB = parseFloat(String(b.bf)) || 0;
        if (bfA !== bfB) return bfA - bfB;

        const reelA = parseFloat(String(a.reel)) || 0;
        const reelB = parseFloat(String(b.reel)) || 0;
        return reelA - reelB;
      });

      // Generate PDF using jsPDF with A4 size
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 0;

      // Header - Add pre-packing image
      const headerImg = new Image();
      headerImg.src = '/pre_packing.png';
      await new Promise((resolve) => {
        headerImg.onload = resolve;
      });

      // Calculate image dimensions maintaining aspect ratio
      const imgWidth = pageWidth; // Full width
      const aspectRatio = headerImg.naturalHeight / headerImg.naturalWidth;
      const imgHeight = imgWidth * aspectRatio; // Calculate height based on aspect ratio
      doc.addImage(headerImg, 'PNG', 0, yPosition, imgWidth, imgHeight);

      yPosition += imgHeight + 5; // Move position down after image

      // Dispatch Information
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');

      const leftMargin = 2;
      const rightMargin = 2;
      const usableWidth = pageWidth - leftMargin - rightMargin;
      const bottomMargin = 20;
      const midColX = pageWidth / 2 + 10; // Middle-right position
      const rightColX = pageWidth - 55; // Far right position

      // Row 1: Party (left), Date (middle-right), Dispatch No (far right)
      doc.text(`Party :- ${selectedClient?.company_name || 'N/A'}`, leftMargin, yPosition);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Date :- ${new Date().toLocaleDateString('en-GB')}`, midColX, yPosition);
      doc.text(`Dispatch No : ${previewNumber}`, rightColX, yPosition);

      yPosition += 7;

      // Row 2: Address (left), Vehicle (middle-right), Driver (far right)
      // let formatAddress = '';
      // if (selectedClient?.address && selectedClient.address.length > 0) {
      //   formatAddress = selectedClient.address.length > 50
      //     ? selectedClient.address.substring(0, 48) + '...'
      //     : selectedClient.address;
      // }
      // doc.text(`Address :- ${formatAddress}`, leftMargin, yPosition);
      doc.text(`Vehicle :- ${dispatchDetails.vehicle_number || 'N/A'}`, midColX, yPosition);
      doc.text(`Driver : ${dispatchDetails.driver_name || 'N/A'}`, rightColX, yPosition);

      yPosition += 10;

      // Table setup - Two side-by-side tables
      const totalWeight = sortedItems.reduce((sum: number, item: any) => sum + item.weight, 0);
      const totalItems = sortedItems.length;

      const tableHeaders = ['S.No', 'GSM', 'BF', 'Size', 'Reel', 'Weight', 'Shade', 'Order Id'];

      // Calculate dimensions for two tables
      const tableGap = 2; // Gap between two tables
      const singleTableWidth = (pageWidth - tableGap) / 2;

      const colWidths = [
        singleTableWidth * 0.08,
        singleTableWidth * 0.10,
        singleTableWidth * 0.10,
        singleTableWidth * 0.10,
        singleTableWidth * 0.15,
        singleTableWidth * 0.11,
        singleTableWidth * 0.15,
        singleTableWidth * 0.20
      ];
      const rowHeight = 8;
      const headerHeight = 10;
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);

      // Calculate max rows that can fit on current page
      const footerSpaceNeeded = 40; // Space for totals + footer
      const availableHeightFirstPage = pageHeight - yPosition - footerSpaceNeeded;
      const maxRowsFirstPage = Math.floor((availableHeightFirstPage - headerHeight) / rowHeight);

      // For subsequent pages (if needed)
      const topMarginNewPage = 10;
      const availableHeightNewPage = pageHeight - topMarginNewPage - footerSpaceNeeded;
      const maxRowsPerNewPage = Math.floor((availableHeightNewPage - headerHeight) / rowHeight);

      // Prepare table data
      const tableData = sortedItems.map((item: any, index: number) => [
        (index + 1).toString(),
        item.gsm.toString() || '',
        item.bf.toString() || '',
        item.size.toString() || '',
        item.reel.toString() || '',
        item.weight.toString(),
        item.natgold || '',
        item.order_frontend_id || ''
      ]);

      // Calculate total rows needed for both tables combined
      const totalRowsNeeded = Math.ceil(totalItems / 2);
      const rows = Math.max(totalRowsNeeded, 23);

      // Split data into two tables - fill first table first, then second
      const leftTableData: any[] = [];
      const rightTableData: any[] = [];

      for (let i = 0; i < rows; i++) {
        leftTableData.push(tableData[i] || ['', '', '', '', '', '', '', '']);
        rightTableData.push(tableData[i + rows] || ['', '', '', '', '', '', '', '']);
      }

      // Helper function to calculate GSM/BF/Shade-wise totals
      const calculateGsmBfTotals = (tableData: any[]) => {
        const totalsMap = new Map<string, { gsm: string, bf: string, shade: string, items: number, weight: number }>();

        tableData.forEach(row => {
          if (row[0] !== '') { // Skip empty rows
            const gsm = row[1];
            const bf = row[2];
            const shade = row[6]; // Shade column
            const weight = parseFloat(row[5]) || 0;
            const key = `${gsm}-${bf}-${shade}`;

            if (totalsMap.has(key)) {
              const existing = totalsMap.get(key)!;
              existing.items += 1;
              existing.weight += weight;
            } else {
              totalsMap.set(key, { gsm, bf, shade, items: 1, weight });
            }
          }
        });

        return Array.from(totalsMap.values());
      };

      // Helper to draw table header
      const drawTableHeader = (startX: number, startY: number) => {
        doc.setFillColor(240, 240, 240);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);

        doc.rect(startX, startY, tableWidth, headerHeight, 'F');

        let currentX = startX;
        tableHeaders.forEach((header, i) => {
          doc.text(header, currentX + colWidths[i] / 2, startY + headerHeight / 2 + 2, { align: 'center' });
          currentX += colWidths[i];
        });
      };

      // Helper to draw table rows with alternating colors
      const drawTableRows = (startX: number, startY: number, data: any[]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);

        let currentY = startY + headerHeight;

        data.forEach((row, rowIndex) => {
          // Alternating row colors - white and light gray
          if (rowIndex % 2 === 1) {
            doc.setFillColor(230, 230, 230); // Light gray for odd rows
            doc.rect(startX, currentY, tableWidth, rowHeight, 'F');
          }

          let currentX = startX;
          row.forEach((cell: string, colIndex: number) => {
            doc.text(cell, currentX + colWidths[colIndex] / 2, currentY + rowHeight / 2 + 1, { align: 'center' });
            currentX += colWidths[colIndex];
          });
          currentY += rowHeight;
        });
      };

      // Helper to draw table borders
      const drawTableBorders = (startX: number, startY: number, numRows: number) => {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);

        const tableHeight = headerHeight + (numRows * rowHeight);

        // Outer border
        doc.rect(startX, startY, tableWidth, tableHeight, 'S');

        // Vertical lines between columns
        let x = startX;
        for (let i = 0; i < colWidths.length - 1; i++) {
          x += colWidths[i];
          doc.line(x, startY, x, startY + tableHeight);
        }

        // Only horizontal line after header (no lines between rows)
        doc.line(startX, startY + headerHeight, startX + tableWidth, startY + headerHeight);
      };

      // Pagination logic - draw tables with page breaks
      const leftTableX = 0;
      const rightTableX = tableWidth + tableGap;

      let currentRowIndex = 0;
      let currentPage = 1;
      let currentYPosition = yPosition;

      while (currentRowIndex < rows) {
        // Calculate available space on current page
        const availableSpace = currentPage === 1
          ? availableHeightFirstPage
          : availableHeightNewPage;

        const maxRowsThisPage = Math.floor((availableSpace - headerHeight) / rowHeight);
        const rowsToDrawThisPage = Math.min(maxRowsThisPage, rows - currentRowIndex);

        // Get data slice for this page
        const leftDataSlice = leftTableData.slice(currentRowIndex, currentRowIndex + rowsToDrawThisPage);
        const rightDataSlice = rightTableData.slice(currentRowIndex, currentRowIndex + rowsToDrawThisPage);

        const tableStartY = currentYPosition;

        // Draw left table
        drawTableHeader(leftTableX+1, tableStartY);
        drawTableRows(leftTableX+1, tableStartY, leftDataSlice);
        drawTableBorders(leftTableX+1, tableStartY, rowsToDrawThisPage);

        // Draw right table
        drawTableHeader(rightTableX, tableStartY);
        drawTableRows(rightTableX, tableStartY, rightDataSlice);
        drawTableBorders(rightTableX, tableStartY, rowsToDrawThisPage);

        // Update position
        const tableHeight = headerHeight + (rowsToDrawThisPage * rowHeight);
        currentYPosition = tableStartY + tableHeight;
        currentRowIndex += rowsToDrawThisPage;

        // If more rows remain, add a new page
        if (currentRowIndex < rows) {
          doc.addPage();
          currentPage++;
          currentYPosition = topMarginNewPage;
        }
      }

      yPosition = currentYPosition;

      // Calculate GSM/BF-wise totals for both tables
      const leftTotals = calculateGsmBfTotals(leftTableData);
      const rightTotals = calculateGsmBfTotals(rightTableData);

      // Add TOTAL rows - 2 GSM/BF combinations per row
      const totalRowHeight = 7;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);

      // Combine totals from both tables
      const allTotals = [...leftTotals, ...rightTotals];

      // Remove duplicates by creating a new map
      const uniqueTotalsMap = new Map<string, { gsm: string, bf: string, shade: string, items: number, weight: number }>();
      allTotals.forEach(total => {
        const key = `${total.gsm}-${total.bf}-${total.shade}`;
        if (uniqueTotalsMap.has(key)) {
          const existing = uniqueTotalsMap.get(key)!;
          existing.items += total.items;
          existing.weight += total.weight;
        } else {
          uniqueTotalsMap.set(key, { ...total });
        }
      });

      const uniqueTotals = Array.from(uniqueTotalsMap.values());

      // Draw total rows - 3 combinations per row
      const totalRows = Math.ceil(uniqueTotals.length / 3);
      for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
        const currentY = yPosition + (rowIndex * totalRowHeight);
        const firstTotal = uniqueTotals[rowIndex * 3];
        const secondTotal = uniqueTotals[rowIndex * 3 + 1];
        const thirdTotal = uniqueTotals[rowIndex * 3 + 2];

        // First combination
        if (firstTotal) {
          const firstText = `${firstTotal.gsm}gsm, ${firstTotal.bf}bf, ${firstTotal.shade} : ${firstTotal.items} | ${Math.round(firstTotal.weight)} kg`;
          doc.text(firstText, 2, currentY + totalRowHeight / 2 + 1);
        }

        // Second combination
        if (secondTotal) {
          const secondText = `${secondTotal.gsm}gsm, ${secondTotal.bf}bf, ${secondTotal.shade} : ${secondTotal.items} | ${Math.round(secondTotal.weight)} kg`;
          doc.text(secondText, pageWidth / 3, currentY + totalRowHeight / 2 + 1);
        }

        // Third combination
        if (thirdTotal) {
          const thirdText = `${thirdTotal.gsm}gsm, ${thirdTotal.bf}bf, ${thirdTotal.shade} : ${thirdTotal.items} | ${Math.round(thirdTotal.weight)} kg`;
          doc.text(thirdText, (pageWidth / 3) * 2, currentY + totalRowHeight / 2 + 1);
        }
      }

      // Update yPosition after TOTAL rows
      yPosition += totalRows * totalRowHeight;

      // Footer table with 3 columns (half width)
      const footerStartY = yPosition + 1;
      const footerHeight = 12;
      const footerTotalWidth = tableWidth; // Half the page width
      const footerColWidth = footerTotalWidth / 3;

      // Draw footer boxes and labels (no borders)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);

      // Column headers and values
      const footerHeaders = ['Total Items', 'Total Weight', 'Freight'];
      const footerValues = [totalItems.toString(), `${totalWeight} kg`, ''];

      for (let i = 0; i < 3; i++) {
        const x = i * footerColWidth + 1;

        // Header box - Total Weight (index 1) is light gray, others are medium gray
        if (i === 1) {
          doc.setFillColor(180, 180, 180); // Light gray for Total Weight
        } else {
          doc.setFillColor(140, 140, 140); // Medium gray for Total Items and Freight
        }
        doc.rect(x, footerStartY, footerColWidth, footerHeight, 'F');

        // Header text (white)
        doc.setTextColor(255, 255, 255);
        doc.text(footerHeaders[i], x + footerColWidth / 2, footerStartY + footerHeight / 2 + 1, { align: 'center' });

        // Value box - Total Weight (index 1) is medium gray, others are light gray
        if (i === 1) {
          doc.setFillColor(140, 140, 140); // Medium gray for Total Weight
        } else {
          doc.setFillColor(220, 220, 220); // Light gray for Total Items and Freight
        }
        doc.rect(x, footerStartY + footerHeight, footerColWidth, footerHeight, 'F');

        // Value text (black)
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text(footerValues[i], x + footerColWidth / 2, footerStartY + footerHeight + footerHeight / 2 + 1, { align: 'center' });
        doc.setFont('helvetica', 'bold');
      }

      // Add Manager and In-charge labels in the right half
      const rightHalfStartX = footerTotalWidth + 10; // Start after the boxes with some gap
      const rightHalfWidth = pageWidth - footerTotalWidth;
      const labelSpacing = rightHalfWidth / 2;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);

      // Manager label
      doc.text('Manager', rightHalfStartX + labelSpacing / 2 - 20, footerStartY + 10, { align: 'center' });

      // In-charge label
      doc.text('In-charge', rightHalfStartX + labelSpacing - 10 + labelSpacing / 2, footerStartY + 10, { align: 'center' });

      // Open print dialog in popup window
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, '_blank', 'width=900,height=700,toolbar=no,menubar=no,location=no');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          URL.revokeObjectURL(pdfUrl);
        };
      } else {
        toast.error("Unable to open print preview. Please check your browser's popup settings.");
      }
    } catch (error) {
      console.error('Error generating pre-packing slip:', error);
      toast.error('Failed to generate print preview');
    }
  }, [
    warehouseItems,
    wastageItems,
    manualCutRolls,
    draftItems,
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

      // For draft items, determine the correct selection Set based on the item's characteristics
      let isSelected = false;
      if (itemType === "draft") {
        if (item.inventory?.id) {
          // Draft inventory item
          isSelected = selectedItems.has(item.inventory.id);
        } else if (item.barcode_id?.startsWith("CR_") && (item as any).manual_cut_roll_id) {
          // Draft manual cut roll
          isSelected = selectedManualCutRollIds.has((item as any).manual_cut_roll_id);
        } else if (item.barcode_id?.includes("WAS")) {
          // Draft wastage item
          isSelected = selectedWastageIds.has(item.id);
        }
      } else {
        const itemId =
          itemType === "wastage"
            ? item.id
            : itemType === "manual"
            ? item.id
            : item.inventory_id;
        isSelected = itemType === "wastage"
          ? selectedWastageIds.has(itemId)
          : itemType === "manual"
          ? selectedManualCutRollIds.has(itemId)
          : selectedItems.has(itemId);
      }

      return !isSelected; // Only return unselected items
    });

    // Filter selected items for right column
    const selectedDisplayItems = displayItems.filter((item: any) => {
      const itemType = item.type;

      // For draft items, determine the correct selection Set based on the item's characteristics
      if (itemType === "draft") {
        if (item.inventory?.id) {
          // Draft inventory item
          return selectedItems.has(item.inventory.id);
        } else if (item.barcode_id?.startsWith("CR_") && (item as any).manual_cut_roll_id) {
          // Draft manual cut roll
          return selectedManualCutRollIds.has((item as any).manual_cut_roll_id);
        } else if (item.barcode_id?.includes("WAS")) {
          // Draft wastage item
          return selectedWastageIds.has(item.id);
        }
        return false;
      }

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
          className="w-[95vw]  max-w-[1200px] lg:max-w-[1680px] max-h-[95vh] flex flex-col p-4 md:p-6"
          style={{
            display: "flex",
            flexDirection: "column",
            width: step === 1 ? "75vw" : "98vw",
            maxHeight: "100vh",
            padding: "5px",
            overflow: "hidden",
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
                    setSelectedOrderId(""); // Reset order when client changes
                    setOrderSearch(""); // Clear order search
                    }}>
                    <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                    {!isMobile && (
                      <SelectSearch
                        placeholder="Search clients..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    )}
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
                    {selectedClientId === "none" && (
                      <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: 400 }}>
                        (Select client first)
                      </span>
                    )}
                  </label>
                  <Select
                    value={selectedOrderId}
                    onValueChange={setSelectedOrderId}
                    disabled={selectedClientId === "none"}>
                    <SelectTrigger disabled={selectedClientId === "none"}>
                    <SelectValue placeholder={selectedClientId === "none" ? "Select client first" : "Select order"} />
                    </SelectTrigger>
                    <SelectContent>
                    {!isMobile && (
                      <SelectSearch
                        placeholder="Search orders..."
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    )}
                    <SelectItem value="all">
                      No order selected
                    </SelectItem>
                    {filteredOrders.length === 0 && selectedClientId !== "none" ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        No orders found for this client
                      </div>
                    ) : (
                      filteredOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.frontend_id} - {order.client_name}
                        </SelectItem>
                      ))
                    )}
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
                  {/* RST Number Field */}
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
                      RST No.
                    </label>
                    <Input
                      value={dispatchDetails.rst_no}
                      readOnly
                      style={{
                        fontSize: "16px",
                        padding: "12px",
                        backgroundColor: "#f9fafb",
                        cursor: "not-allowed",
                        color: "#374151",
                      }}
                      placeholder="Auto-filled from vehicle"
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
                      Gross Weight (kg)
                    </label>
                    <Input
                      value={dispatchDetails.gross_weight}
                      onChange={(e) =>
                        setDispatchDetails((prev) => ({
                          ...prev,
                          gross_weight: e.target.value,
                        }))
                      }
                      type="number"
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
                      <Truck style={{ width: "18px", height: "18px" }} />
                      Vehicle Number *
                    </label>
                    <Select
                      value={dispatchDetails.vehicle_number || "none"}
                      onValueChange={(value) => {
                        if (value !== "none") {
                          handleVehicleSelect(value);
                        }
                      }}>
                      <SelectTrigger style={{ fontSize: "16px", padding: "12px", height: "48px" }}>
                        <SelectValue placeholder="Select or type vehicle number" />
                      </SelectTrigger>
                      <SelectContent>
                        {!isMobile && (
                          <SelectSearch
                            placeholder="Search or type new vehicle..."
                            value={vehicleSearch}
                            onChange={(e) => setVehicleSearch(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              // Allow manual entry - when user types and presses Enter
                              if (e.key === 'Enter' && vehicleSearch.trim()) {
                                handleVehicleSelect(vehicleSearch.trim().toUpperCase());
                                setVehicleSearch("");
                              }
                            }}
                          />
                        )}
                        <SelectItem value="none" disabled>
                          Select vehicle from today or type new
                        </SelectItem>
                        {todaysVehicles
                          .filter((vehicle) =>
                            vehicle.vehicle_number
                              .toLowerCase()
                              .includes(vehicleSearch.toLowerCase())
                          )
                          .map((vehicle) => (
                            <SelectItem key={vehicle.vehicle_number} value={vehicle.vehicle_number}>
                              {vehicle.vehicle_number} - {vehicle.party_name || "No Party Name"}
                            </SelectItem>
                          ))}
                        {vehicleSearch.trim() &&
                         !todaysVehicles.some(v => v.vehicle_number.toLowerCase() === vehicleSearch.toLowerCase()) && (
                          <SelectItem value={vehicleSearch.trim().toUpperCase()}>
                            ➕ Add new: {vehicleSearch.trim().toUpperCase()}
                          </SelectItem>
                        )}
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
                      Dispatch Number
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
                  height: "93vh",
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
                  <div className="flex gap-2 md:gap-4 w-full md:w-auto mr-7">
                   
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
                        Gross Weight:
                      </span>
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: "bold",
                          color: "#16a34a",
                          minWidth: "80px",
                          textAlign: "center",
                        }}>
                        {dispatchDetails.gross_weight || 0} kg
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
                  height: "93vh",
                }}>
                {/* Header wi5th Action Buttons */}
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
                      className="flex-1 md:flex-none bg-green-600 text-sm md:text-base mr-8"
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

                            // Handle draft items specially
                            if (itemType === "draft") {
                              if (item.inventory?.id) {
                                return selectedItems.has(item.inventory.id);
                              } else if (item.barcode_id?.startsWith("CR_") && (item as any).manual_cut_roll_id) {
                                return selectedManualCutRollIds.has((item as any).manual_cut_roll_id);
                              } else if (item.barcode_id?.includes("WAS")) {
                                return selectedWastageIds.has(item.id);
                              }
                              return false;
                            }

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

                            // Handle draft items specially
                            if (itemType === "draft") {
                              if (item.inventory?.id) {
                                return selectedItems.has(item.inventory.id);
                              } else if (item.barcode_id?.startsWith("CR_") && (item as any).manual_cut_roll_id) {
                                return selectedManualCutRollIds.has((item as any).manual_cut_roll_id);
                              } else if (item.barcode_id?.includes("WAS")) {
                                return selectedWastageIds.has(item.id);
                              }
                              return false;
                            }

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
