/**
 * Create Dispatch Modal - Two-step dispatch creation with item selection
 */
"use client";

import { useState, useEffect } from "react";
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
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  CheckCircle,
  Clock,
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

export function CreateDispatchModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateDispatchModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [wastageItems, setWastageItems] = useState<any[]>([]);  // NEW: Wastage items
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedWastageIds, setSelectedWastageIds] = useState<string[]>([]);  // NEW: Selected wastage IDs
  const [searchTerm, setSearchTerm] = useState("");
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"client" | "all" | "wastage">("client");

  const [dispatchDetails, setDispatchDetails] = useState({
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    payment_type: "cash",
    dispatch_number: "",
    reference_number: "",
  });

  // Load clients, warehouse items, and wastage items
  useEffect(() => {
    if (open) {
      loadClients();
      loadWarehouseItems();
      loadWastageItems();  // NEW: Load wastage items
    } else {
      // Reset on close
      setStep(1);
      setSelectedClientId("none");
      setSelectedItems([]);
      setSelectedWastageIds([]);  // NEW: Reset wastage selection
      setSearchTerm("");
      setDispatchDetails({
        vehicle_number: "",
        driver_name: "",
        driver_mobile: "",
        payment_type: "cash",
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

  const handleSaveDetails = () => {
    // Validate details
    if (!dispatchDetails.vehicle_number.trim()) {
      toast.error("Vehicle number is required");
      return;
    }
    if (!dispatchDetails.driver_name.trim()) {
      toast.error("Driver name is required");
      return;
    }
    
    if (!dispatchDetails.dispatch_number.trim()) {
      toast.error("Dispatch number is required");
      return;
    }
    if (selectedClientId === "none") {
      toast.error("Please select a client for the dispatch slip");
      return;
    }

    setStep(2);
    toast.success("Details saved! Now select items to dispatch");
  };

  const handleDispatchConfirm = async () => {
    if (selectedItems.length === 0 && selectedWastageIds.length === 0) {
      toast.error("Please select at least one item to dispatch");
      return;
    }

    try {
      setDispatchLoading(true);

      const dispatchData = {
        ...dispatchDetails,
        client_id: selectedClientId,
        inventory_ids: selectedItems,
        wastage_ids: selectedWastageIds,  // NEW: Include wastage IDs
      };

      const result = await createDispatchRecord(dispatchData);

      // Show success modal
      setDispatchResult(result);
      setSuccessModalOpen(true);

      // Close the create modal
      onOpenChange(false);

      // Call onSuccess callback to refresh parent data
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
  };

  const selectedClient =
    selectedClientId && selectedClientId !== "none"
      ? clients.find((c) => c.id === selectedClientId)
      : null;

     console.log("Selected Client ID:", warehouseItems);
     console.log("Selected Client:", selectedClient);
  
  // Separate client items from other warehouse items
  const clientItems = warehouseItems.filter(
    (item) => item.client_name === (selectedClient ? selectedClient.company_name : "")
  );
  const otherWarehouseItems = warehouseItems.filter(
    (item) => item.client_name !== (selectedClient ? selectedClient.company_name : "")
  );

  // Unified search filter that works across all item types
  const matchesSearch = (item: any, isWastage: boolean) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    
    if (isWastage) {
      // Search in wastage-specific fields
      return (
        (item.barcode_id && item.barcode_id.toLowerCase().includes(searchLower)) ||
        (item.reel_no && item.reel_no.toLowerCase().includes(searchLower)) ||
        (item.frontend_id && item.frontend_id.toLowerCase().includes(searchLower)) ||
        (item.paper_spec && item.paper_spec.toLowerCase().includes(searchLower)) ||
        (item.created_by && item.created_by.toLowerCase().includes(searchLower))
      );
    } else {
      // Search in warehouse item fields
      return (
        (item.barcode_id && item.barcode_id.toLowerCase().includes(searchLower)) ||
        (item.qr_code && item.qr_code.toLowerCase().includes(searchLower)) ||
        (item.client_name && item.client_name.toLowerCase().includes(searchLower)) ||
        (item.order_id && item.order_id.toLowerCase().includes(searchLower)) ||
        (item.paper_spec && item.paper_spec.toLowerCase().includes(searchLower)) ||
        (item.created_by && item.created_by.toLowerCase().includes(searchLower))
      );
    }
  };

  // Combine all items with priority based on active tab and unified search
  const getCombinedItems = () => {
    // Apply search filter to all item types
    const filteredClient = clientItems.filter(item => matchesSearch(item, false));
    const filteredOther = otherWarehouseItems.filter(item => matchesSearch(item, false));
    const filteredWastage = wastageItems.filter(item => matchesSearch(item, true));

    // Prioritize based on active tab
    if (activeTab === "client") {
      return [
        ...filteredClient.map(item => ({ ...item, type: "warehouse", priority: 1, matchScore: 3 })),
        ...filteredOther.map(item => ({ ...item, type: "warehouse", priority: 2, matchScore: 2 })),
        ...filteredWastage.map(item => ({ ...item, type: "wastage", priority: 3, matchScore: 1 }))
      ];
    } else if (activeTab === "all") {
      return [
        ...filteredOther.map(item => ({ ...item, type: "warehouse", priority: 1, matchScore: 3 })),
        ...filteredClient.map(item => ({ ...item, type: "warehouse", priority: 2, matchScore: 2 })),
        ...filteredWastage.map(item => ({ ...item, type: "wastage", priority: 3, matchScore: 1 }))
      ];
    } else { // activeTab === "wastage"
      return [
        ...filteredWastage.map(item => ({ ...item, type: "wastage", priority: 1, matchScore: 3 })),
        ...filteredClient.map(item => ({ ...item, type: "warehouse", priority: 2, matchScore: 2 })),
        ...filteredOther.map(item => ({ ...item, type: "warehouse", priority: 3, matchScore: 1 }))
      ];
    }
  };

  const combinedItems = getCombinedItems();
  
  // Get counts for each category after search filter
  const searchedClientCount = clientItems.filter(item => matchesSearch(item, false)).length;
  const searchedOtherCount = otherWarehouseItems.filter(item => matchesSearch(item, false)).length;
  const searchedWastageCount = wastageItems.filter(item => matchesSearch(item, true)).length;

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text;
    const parts = text.split(new RegExp(`(${searchTerm})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark
          key={index}
          className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const removeSelectedItem = (inventoryId: string) => {
    setSelectedItems((prev) => prev.filter((id) => id !== inventoryId));
    const item = warehouseItems.find(
      (item) => item.inventory_id === inventoryId
    );
    if (item) {
      toast.success(`Removed ${item.barcode_id || item.qr_code} from selection`);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { variant: string; icon: any; label: string }> = {
      in_warehouse: {
        variant: "bg-blue-100 text-blue-800",
        icon: Package,
        label: "In Warehouse",
      },
      pending: { variant: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pending" },
      completed: {
        variant: "bg-green-100 text-green-800",
        icon: CheckCircle,
        label: "Completed",
      },
    };

    const badge = badges[status] || {
      variant: "bg-gray-100 text-gray-800",
      icon: Package,
      label: status,
    };
    const Icon = badge.icon;

    return (
      <Badge className={badge.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.label}
      </Badge>
    );
  };

  // Unified rendering function for combined items
  const renderCombinedItemsTable = (items: any[]) => (
    <div className="rounded-md border max-h-[400px] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-white z-10">
          <TableRow>
            <TableHead className="w-[50px]">Select</TableHead>
            <TableHead>S.No</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>ID / Barcode</TableHead>
            <TableHead>Client & Order</TableHead>
            <TableHead>Paper Specs</TableHead>
            <TableHead>Width</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length > 0 ? (
            items.map((item: any, index) => {
              const isWastageItem = item.type === "wastage";
              const isSelected = isWastageItem 
                ? selectedWastageIds.includes(item.id)
                : selectedItems.includes(item.inventory_id);
              
              return (
                <TableRow
                  key={isWastageItem ? `wastage-${item.id}` : `warehouse-${item.inventory_id}`}
                  className={`${
                    isSelected
                      ? isWastageItem
                        ? "bg-orange-50 border-orange-200"
                        : "bg-blue-50 border-blue-200"
                      : ""
                  } ${item.priority === 1 ? "border-l-4 border-l-green-500" : ""}`}
                >
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (isWastageItem) {
                            if (checked) {
                              setSelectedWastageIds((prev) => [...prev, item.id]);
                              toast.success(`Selected Stock ${item.reel_no || item.frontend_id}`);
                            } else {
                              setSelectedWastageIds((prev) => prev.filter((id) => id !== item.id));
                              toast.success(`Removed Stock ${item.reel_no || item.frontend_id}`);
                            }
                          } else {
                            if (checked) {
                              setSelectedItems((prev) => [...prev, item.inventory_id]);
                              toast.success(`Selected ${item.barcode_id || item.qr_code}`);
                            } else {
                              removeSelectedItem(item.inventory_id);
                            }
                          }
                        }}
                        className="w-5 h-5"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    {isWastageItem ? (
                      <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700">
                        Stock
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                        Warehouse
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div
                        className={`font-mono text-sm ${
                          isSelected
                            ? isWastageItem
                              ? "font-bold text-orange-700"
                              : "font-bold text-blue-700"
                            : ""
                        }`}
                      >
                        {highlightText(
                          isWastageItem
                            ? (item.reel_no || item.barcode_id || item.frontend_id || "N/A")
                            : (item.barcode_id || item.qr_code),
                          searchTerm
                        )}
                        {isSelected && (
                          <Badge className={`ml-2 text-xs ${
                            isWastageItem ? "bg-orange-600" : "bg-blue-600"
                          }`}>
                            SELECTED
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        By: {item.created_by || "Unknown"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isWastageItem ? (
                      <div className="text-sm text-muted-foreground">-</div>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-medium text-sm flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-blue-600" />
                          {highlightText(item.client_name || "N/A", searchTerm)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Order: {highlightText(item.order_id || "N/A", searchTerm)}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {highlightText(item.paper_spec, searchTerm)}
                        </span>
                        {!isWastageItem && (
                          <WastageIndicator isWastageRoll={item.is_wastage_roll} />
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <div className="font-medium">{item.width_inches}"</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <div className="font-medium">{item.weight_kg}kg</div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center">
                {loading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading items...
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <p className="font-medium">No items found</p>
                    <p className="text-sm">
                      {searchTerm
                        ? "Try adjusting your search"
                        : "No items available"}
                    </p>
                  </div>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderItemsTable = (items: any[], showClientColumn: boolean = false) => (
    <div className="rounded-md border max-h-[400px] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-white z-10">
          <TableRow>
            <TableHead className="w-[50px]">
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={items.length > 0 && selectedItems.length === items.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      const allItemIds = items.map((item) => item.inventory_id);
                      setSelectedItems(allItemIds);
                      toast.success(`Selected all ${allItemIds.length} items`);
                    } else {
                      setSelectedItems([]);
                      toast.success("Cleared all selections");
                    }
                  }}
                  className="w-5 h-5"
                />
              </div>
            </TableHead>
            <TableHead>S.No</TableHead>
            <TableHead>QR Code</TableHead>
            {showClientColumn && <TableHead>Client & Order</TableHead>}
            {!showClientColumn && <TableHead>Order</TableHead>}
            <TableHead>Paper Specs</TableHead>
            <TableHead>Width</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length > 0 ? (
            items.map((item: any, index) => (
              <TableRow
                key={item.inventory_id}
                className={
                  selectedItems.includes(item.inventory_id)
                    ? "bg-blue-50 border-blue-200"
                    : ""
                }
              >
                <TableCell>
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={selectedItems.includes(item.inventory_id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedItems((prev) => [...prev, item.inventory_id]);
                          toast.success(`Selected ${item.barcode_id || item.qr_code}`);
                        } else {
                          removeSelectedItem(item.inventory_id);
                        }
                      }}
                      className="w-5 h-5"
                    />
                  </div>
                </TableCell>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div
                      className={`font-mono text-sm ${
                        selectedItems.includes(item.inventory_id)
                          ? "font-bold text-blue-700"
                          : ""
                      }`}
                    >
                      {highlightText(item.barcode_id || item.qr_code, searchTerm)}
                      {selectedItems.includes(item.inventory_id) && (
                        <Badge className="ml-2 text-xs bg-blue-600">SELECTED</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      By: {item.created_by}
                    </div>
                  </div>
                </TableCell>
                {showClientColumn ? (
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-sm flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-blue-600" />
                        {highlightText(item.client_name || "N/A", searchTerm)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Order: {highlightText(item.order_id || "N/A", searchTerm)}
                      </div>
                    </div>
                  </TableCell>
                ) : (
                  <TableCell>
                    <div className="text-sm">
                      {highlightText(item.order_id || "N/A", searchTerm)}
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {highlightText(item.paper_spec, searchTerm)}
                      </span>
                      <WastageIndicator isWastageRoll={item.is_wastage_roll} />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-center">
                    <div className="font-medium">{item.width_inches}"</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-center">
                    <div className="font-medium">{item.weight_kg}kg</div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={showClientColumn ? 9 : 8}
                className="h-24 text-center"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading items...
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <p className="font-medium">No items found</p>
                    <p className="text-sm">
                      {searchTerm
                        ? "Try adjusting your search"
                        : "No warehouse items available"}
                    </p>
                  </div>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Create New Dispatch
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? "Step 1: Fill dispatch details"
                : "Step 2: Select items to dispatch"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Step 1: Dispatch Details */}
            {step === 1 && (
              <div className="space-y-4 py-4">
                {/* Client Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Select Client for Dispatch Slip *
                  </label>
                  <Select
                    value={selectedClientId}
                    onValueChange={(value) => {
                      setSelectedClientId(value);
                      setSelectedItems([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>
                        Select a client
                      </SelectItem>
                        {clients
                        .sort((a, b) => a.company_name.localeCompare(b.company_name))
                        .map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                          {client.company_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This client will appear on the dispatch slip
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Vehicle Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Truck className="w-4 h-4" />
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
                    />
                  </div>

                  {/* Driver Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
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
                    />
                  </div>

                  {/* Driver Mobile */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4" />
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
                    />
                  </div>

                  {/* Dispatch Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Dispatch Number *</label>
                    <Input
                      value={dispatchDetails.dispatch_number}
                      onChange={(e) =>
                        setDispatchDetails((prev) => ({
                          ...prev,
                          dispatch_number: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {/* Payment Type */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bill/Cash</label>
                    <Select
                      value={dispatchDetails.payment_type}
                      onValueChange={(value) =>
                        setDispatchDetails((prev) => ({
                          ...prev,
                          payment_type: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="credit">Bill</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reference Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
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
                    />
                  </div>
                </div>

                <Button onClick={handleSaveDetails} className="w-full" size="lg">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Continue to Item Selection
                </Button>
              </div>
            )}

            {/* Step 2: Item Selection */}
            {step === 2 && (
              <div className="space-y-4 py-4">
                {/* Summary of Details */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Dispatch Details Saved
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(1)}
                    >
                      Edit
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Client:</span>
                      <p className="font-medium">{selectedClient?.company_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vehicle:</span>
                      <p className="font-medium">{dispatchDetails.vehicle_number}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Driver:</span>
                      <p className="font-medium">{dispatchDetails.driver_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mobile:</span>
                      <p className="font-medium">{dispatchDetails.driver_mobile}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dispatch #:</span>
                      <p className="font-medium">{dispatchDetails.dispatch_number}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Payment:</span>
                      <p className="font-medium capitalize">
                        {dispatchDetails.payment_type}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedItems.length + selectedWastageIds.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total Selected
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(
                        warehouseItems
                          .filter((item) => selectedItems.includes(item.inventory_id))
                          .reduce((sum, item) => sum + (item.weight_kg || 0), 0) +
                        wastageItems
                          .filter((item) => selectedWastageIds.includes(item.id))
                          .reduce((sum, item) => sum + (item.weight_kg || 0), 0)
                      ).toFixed(1)}
                      kg
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total Weight
                    </div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedItems.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Regular Items
                    </div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {selectedWastageIds.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Stock Items
                    </div>
                  </div>
                </div>

                {/* Search - Works across all tabs */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search across all items: QR code, barcode, reel no, order, paper spec, creator..."
                      className="pl-8 pr-8"
                    />
                    {searchTerm && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-1 top-1 h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tabs for Client Items vs All Items vs Wastage */}
                <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
                  {/* <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="client" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {selectedClient?.company_name || "Client"} 
                      <Badge variant="secondary" className="ml-1">
                        {searchTerm ? searchedClientCount : clientItems.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="all" className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      All Other Clients
                      <Badge variant="secondary" className="ml-1">
                        {searchTerm ? searchedOtherCount : otherWarehouseItems.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="wastage" className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Stock
                      <Badge variant="secondary" className="ml-1">
                        {searchTerm ? searchedWastageCount : wastageItems.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList> */}
                  <TabsContent value="client" className="mt-4">
                    <div className="mb-2 text-sm text-muted-foreground flex items-center justify-between">
                      <span>
                        <span className="font-medium text-green-600">●</span> Green border = Priority items from {selectedClient?.company_name}
                      </span>
                      <span className="font-medium">
                        Showing {combinedItems.length} total items
                      </span>
                    </div>
                    {renderCombinedItemsTable(combinedItems)}
                  </TabsContent>
                  <TabsContent value="all" className="mt-4">
                    <div className="mb-2 text-sm text-muted-foreground flex items-center justify-between">
                      <span>
                        <span className="font-medium text-green-600">●</span> Green border = Priority items from other clients
                      </span>
                      <span className="font-medium">
                        Showing {combinedItems.length} total items
                      </span>
                    </div>
                    {renderCombinedItemsTable(combinedItems)}
                  </TabsContent>
                  <TabsContent value="wastage" className="mt-4">
                    <div className="mb-2 text-sm text-muted-foreground flex items-center justify-between">
                      <span>
                        <span className="font-medium text-green-600">●</span> Green border = Priority stock items
                      </span>
                      <span className="font-medium">
                        Showing {combinedItems.length} total items
                      </span>
                    </div>
                    {renderCombinedItemsTable(combinedItems)}
                  </TabsContent>
                </Tabs>

                {/* Dispatch Button */}
                <Button
                  onClick={handleDispatchConfirm}
                  disabled={(selectedItems.length === 0 && selectedWastageIds.length === 0) || dispatchLoading}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {dispatchLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Dispatch...
                    </>
                  ) : (
                    <>
                      <Truck className="mr-2 h-5 w-5" />
                      Dispatch {selectedItems.length + selectedWastageIds.length} Items
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <DispatchSuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        dispatchResult={dispatchResult}
      />
    </>
  );
}
