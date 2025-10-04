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
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  const [dispatchDetails, setDispatchDetails] = useState({
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    payment_type: "cash",
    dispatch_number: "",
    reference_number: "",
  });

  // Load clients and warehouse items
  useEffect(() => {
    if (open) {
      loadClients();
      loadWarehouseItems();
    } else {
      // Reset on close
      setStep(1);
      setSelectedClientId("none");
      setSelectedItems([]);
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
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to dispatch");
      return;
    }

    try {
      setDispatchLoading(true);

      const dispatchData = {
        ...dispatchDetails,
        client_id: selectedClientId,
        inventory_ids: selectedItems,
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
  // Filter items based on selected tab and search
  
  const clientItems = warehouseItems.filter(
    (item) => item.client_name === (selectedClient ? selectedClient.company_name : "")
  );
  
  

  const filteredClientItems = clientItems.filter((item) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (item.barcode_id &&
        item.barcode_id.toLowerCase().includes(searchLower)) ||
      (item.qr_code && item.qr_code.toLowerCase().includes(searchLower)) ||
      (item.order_id && item.order_id.toLowerCase().includes(searchLower)) ||
      (item.paper_spec && item.paper_spec.toLowerCase().includes(searchLower))
    );
  });

  const filteredAllItems = warehouseItems.filter((item) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (item.barcode_id &&
        item.barcode_id.toLowerCase().includes(searchLower)) ||
      (item.qr_code && item.qr_code.toLowerCase().includes(searchLower)) ||
      (item.client_name &&
        item.client_name.toLowerCase().includes(searchLower)) ||
      (item.order_id && item.order_id.toLowerCase().includes(searchLower)) ||
      (item.paper_spec && item.paper_spec.toLowerCase().includes(searchLower))
    );
  });

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
                      {clients.map((client) => (
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedItems.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Items Selected
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {warehouseItems
                        .filter((item) => selectedItems.includes(item.inventory_id))
                        .reduce((sum, item) => sum + (item.weight_kg || 0), 0)
                        .toFixed(1)}
                      kg
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total Weight
                    </div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {clientItems.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Client Items
                    </div>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by QR code, barcode, order, paper spec..."
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

                {/* Tabs for Client Items vs All Items */}
                <Tabs defaultValue="client" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="client" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {selectedClient?.company_name} ({clientItems.length})
                    </TabsTrigger>
                    <TabsTrigger value="all" className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      All Clients ({warehouseItems.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="client" className="mt-4">
                    {renderItemsTable(filteredClientItems, false)}
                  </TabsContent>
                  <TabsContent value="all" className="mt-4">
                    {renderItemsTable(filteredAllItems, true)}
                  </TabsContent>
                </Tabs>

                {/* Dispatch Button */}
                <Button
                  onClick={handleDispatchConfirm}
                  disabled={selectedItems.length === 0 || dispatchLoading}
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
                      Dispatch {selectedItems.length} Items
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
