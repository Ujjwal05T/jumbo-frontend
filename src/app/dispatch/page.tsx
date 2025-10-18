/**
 * Dispatch page - Manage order items in warehouse and dispatch
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  CheckCircle,
  Clock,
  Package,
  AlertCircle,
  Calendar,
  Loader2,
  History,
  X,
  ShoppingCart,
  Building2,
  Search,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DispatchSuccessModal } from "@/components/DispatchSuccessModal";
import { 
  getWarehouseItems,
  getStatusBadgeVariant,
  getStatusDisplayText
} from "@/lib/production";
import { 
  fetchPendingItems,
  completePendingItem,
  createDispatchRecord,
  WarehouseItem,
  PendingItem
} from "@/lib/dispatch";
import { API_BASE_URL } from "@/lib/api-config";
import WastageIndicator from "@/components/WastageIndicator";

type ItemType = "warehouse" | "pending";

export default function DispatchPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    itemIds: string[];
    action: "complete";
  }>({ open: false, itemIds: [], action: "complete" });
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  // Client selection state
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [clientsLoading, setClientsLoading] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Dispatch details state (filled first before selecting items)
  const [dispatchDetails, setDispatchDetails] = useState({
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    dispatch_number: "",
    reference_number: "",
  });
  const [detailsFilled, setDetailsFilled] = useState(false);

  // Helper function to highlight matching text
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text;

    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  // Load clients on page load
  const loadClients = async () => {
    try {
      setClientsLoading(true);
      const response = await fetch(`${API_BASE_URL}/dispatch/clients`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (!response.ok) throw new Error('Failed to load clients');
      const data = await response.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error('Error loading clients:', err);
      toast.error('Failed to load clients');
    } finally {
      setClientsLoading(false);
    }
  };


  // Load warehouse items - always load all items (no filtering)
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = `${API_BASE_URL}/dispatch/warehouse-items`;

      const response = await fetch(url, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to load warehouse items');
      const warehouseResponse = await response.json();

      setWarehouseItems(warehouseResponse.warehouse_items || []);

      console.log("Loaded warehouse items:", warehouseResponse.warehouse_items?.length || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients(); // Load clients on page load
    loadData(); // Load all warehouse items
  }, []);

  // Filter items based on search term
  const filteredItems = warehouseItems.filter((item) => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      (item.barcode_id && item.barcode_id.toLowerCase().includes(searchLower)) ||
      (item.qr_code && item.qr_code.toLowerCase().includes(searchLower)) ||
      (item.client_name && item.client_name.toLowerCase().includes(searchLower)) ||
      (item.order_id && item.order_id.toLowerCase().includes(searchLower)) ||
      (item.paper_spec && item.paper_spec.toLowerCase().includes(searchLower))
    );
  });

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
    if (!dispatchDetails.driver_mobile.trim()) {
      toast.error("Driver mobile is required");
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

    setDetailsFilled(true);
    toast.success("Details saved! Now select items to dispatch");
  };

  const handleEditDetails = () => {
    setDetailsFilled(false);
    setSelectedItems([]);
    toast.info("Edit dispatch details");
  };

  // Get selected client info for dispatch form
  const selectedClient = selectedClientId && selectedClientId !== "none" ? clients.find(c => c.id === selectedClientId) : null;

  const handleDispatchConfirm = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to dispatch");
      return;
    }

    try {
      setDispatchLoading(true);

      const dispatchData = {
        ...dispatchDetails,
        client_id: selectedClientId, // Use selected client for dispatch slip
        inventory_ids: selectedItems
      };

      const result = await createDispatchRecord(dispatchData as any);

      // Show success modal with dispatch details
      setDispatchResult(result);
      setSuccessModalOpen(true);

      // Reload data and reset selections
      await loadData();
      setSelectedItems([]);
      setDispatchDetails({
        vehicle_number: "",
        driver_name: "",
        driver_mobile: "",
        // payment_type: "cash",
        dispatch_number: "",
        reference_number: "",
      });
      setDetailsFilled(false);
      setSelectedClientId("none");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create dispatch';
      toast.error(errorMessage);
      console.error("Dispatch error:", error);
    } finally {
      setDispatchLoading(false);
    }
  };

  const confirmStatusChange = async () => {
    // This is now handled by the dispatch form
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  const handleBulkDispatch = () => {
    if (!detailsFilled) {
      toast.error("Please fill dispatch details first");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Please select items to dispatch");
      return;
    }
    handleDispatchConfirm();
  };

  const removeSelectedItem = (inventoryId: string) => {
    setSelectedItems(prev => prev.filter(id => id !== inventoryId));
    const item = warehouseItems.find(item => item.inventory_id === inventoryId);
    if (item) {
      toast.success(`Removed ${item.barcode_id || item.qr_code} from selection`);
    }
  };

  const getStatusBadge = (status: string, itemType: ItemType = "warehouse") => {
    const variant = getStatusBadgeVariant(status, itemType === "warehouse" ? "order_item" : "pending_order");
    const displayText = getStatusDisplayText(status);
    
    const iconMap = {
      'in_warehouse': Package,
      'pending': Clock,
      'completed': CheckCircle,
      'included_in_plan': AlertCircle,
      'resolved': CheckCircle
    };
    
    const Icon = iconMap[status as keyof typeof iconMap] || Package;
    
    return (
      <Badge variant={variant as "default" | "secondary" | "destructive" | "outline"}>
        <Icon className="w-3 h-3 mr-1" />
        {displayText}
      </Badge>
    );
  };

  

  const warehouseItemsCount = warehouseItems.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="w-8 h-8 text-primary" />
            Dispatch Management
          </h1>
          <Button
            onClick={() => window.location.href = '/dispatch/history'}
            variant="outline"
          >
            <History className="w-4 h-4 mr-2" />
            View History
          </Button>
        </div>

        {/* Step 1: Dispatch Details Form */}
        <Card className={detailsFilled ? "border-green-500 bg-green-50/50" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">1</div>
              Dispatch Details
              {detailsFilled && <CheckCircle className="w-5 h-5 text-green-600 ml-2" />}
            </CardTitle>
            <CardDescription>
              {detailsFilled ? "Details saved. Select items below to dispatch." : "Fill dispatch information before selecting items"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!detailsFilled ? (
              <>
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
                    disabled={clientsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={clientsLoading ? "Loading..." : "Select a client"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>Select a client</SelectItem>
                      {clients.sort((a, b) => a.company_name.localeCompare(b.company_name)).map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This client will appear on the dispatch slip. You can still select items from any client below.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Vehicle Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Vehicle Number *</label>
                    <Input
                      value={dispatchDetails.vehicle_number}
                      onChange={(e) => setDispatchDetails(prev => ({ ...prev, vehicle_number: e.target.value }))}
                      placeholder="e.g., MH-12-AB-1234"
                    />
                  </div>

                  {/* Driver Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Driver Name *</label>
                    <Input
                      value={dispatchDetails.driver_name}
                      onChange={(e) => setDispatchDetails(prev => ({ ...prev, driver_name: e.target.value }))}
                      placeholder="e.g., John Doe"
                    />
                  </div>

                  {/* Driver Mobile */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Driver Mobile *</label>
                    <Input
                      value={dispatchDetails.driver_mobile}
                      onChange={(e) => setDispatchDetails(prev => ({ ...prev, driver_mobile: e.target.value }))}
                      placeholder="e.g., +91 9876543210"
                    />
                  </div>

                  {/* Dispatch Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Dispatch Number *</label>
                    <Input
                      value={dispatchDetails.dispatch_number}
                      onChange={(e) => setDispatchDetails(prev => ({ ...prev, dispatch_number: e.target.value }))}
                      placeholder="e.g., DISP-001"
                    />
                  </div>

                  {/* Payment Type */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Type</label>
                    {/* <Select
                      value={dispatchDetails.payment_type}
                      onValueChange={(value) => setDispatchDetails(prev => ({ ...prev, payment_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                      </SelectContent>
                    </Select> */}
                  </div>

                  {/* Reference Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reference Number (Optional)</label>
                    <Input
                      value={dispatchDetails.reference_number}
                      onChange={(e) => setDispatchDetails(prev => ({ ...prev, reference_number: e.target.value }))}
                      placeholder="e.g., REF-123"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveDetails} className="w-full">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Details & Continue to Item Selection
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Dispatch Client:</span>
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
                  {/* <div>
                    <span className="text-muted-foreground">Payment:</span>
                    <p className="font-medium capitalize">{dispatchDetails.payment_type}</p>
                  </div> */}
                </div>
                <Button onClick={handleEditDetails} variant="outline" size="sm">
                  Edit Details
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warehouseItemsCount}</div>
              <p className="text-xs text-muted-foreground">
                Ready for dispatch
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Selected Items</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {selectedItems.length}
              </div>
              <p className="text-xs text-muted-foreground">Items to dispatch</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {warehouseItems
                  .filter(item => selectedItems.includes(item.inventory_id))
                  .reduce((sum, item) => sum + (item.weight_kg || 0), 0)
                  .toFixed(1)}kg
              </div>
              <p className="text-xs text-muted-foreground">Selected weight</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Heavy Rolls</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {warehouseItems.filter(item => item.weight_kg > 10).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {'>'}10kg rolls
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Step 2: Item Selection */}
        <Card className={!detailsFilled ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">2</div>
                    Select Items to Dispatch
                  </CardTitle>
                  <CardDescription>
                    {detailsFilled
                      ? `Showing all warehouse items. Select items to dispatch to ${selectedClient?.company_name}.`
                      : "Complete step 1 to enable item selection"}
                  </CardDescription>
                </div>
                {selectedItems.length > 0 && detailsFilled && (
                  <Button
                    onClick={handleBulkDispatch}
                    className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
                    size="lg"
                    disabled={dispatchLoading}
                  >
                    {dispatchLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Dispatching...
                      </>
                    ) : (
                      <>
                        <Truck className="mr-2 h-5 w-5" />
                        Dispatch {selectedItems.length} Items
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
                {searchTerm && (
                  <div className="text-sm text-muted-foreground">
                    Found {filteredItems.length} of {warehouseItems.length} items
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                          disabled={!detailsFilled}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const allItemIds = filteredItems.map(item => item.inventory_id);
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
                    <TableHead>Client & Order</TableHead>
                    <TableHead>Paper Specs</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item: any, index) => (
                      <TableRow
                        key={item.inventory_id || item.id}
                        className={selectedItems.includes(item.inventory_id) ? "bg-blue-50 border-blue-200" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={selectedItems.includes(item.inventory_id)}
                              disabled={!detailsFilled}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedItems(prev => [...prev, item.inventory_id]);
                                  toast.success(`Selected ${item.barcode_id || item.qr_code}`);
                                } else {
                                  removeSelectedItem(item.inventory_id);
                                }
                              }}
                              className="w-5 h-5"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className={`font-mono text-sm ${
                              selectedItems.includes(item.inventory_id)
                                ? "font-bold text-blue-700"
                                : ""
                            }`}>
                              {highlightText(item.barcode_id || item.qr_code, searchTerm)}
                              {selectedItems.includes(item.inventory_id) && (
                                <Badge className="ml-2 text-xs bg-blue-600">SELECTED</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Created by: {item.created_by}
                            </div>
                          </div>
                        </TableCell>
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
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{highlightText(item.paper_spec, searchTerm)}</span>
                              <WastageIndicator isWastageRoll={item.is_wastage_roll} />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.is_wastage_roll ? "Wastage roll ready for dispatch" : "Cut roll ready for dispatch"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-medium">{item.width_inches}"</div>
                            <div className="text-xs text-muted-foreground">
                              width
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-medium">{item.weight_kg}kg</div>
                            <div className="text-xs text-green-600">
                              Weight verified
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status, "warehouse")}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        {loading ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading warehouse items...
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <div className="text-muted-foreground">
                              <p className="font-medium">No cut rolls ready for dispatch</p>
                              <p className="text-sm">
                                {selectedClientId === "none"
                                  ? "No warehouse items found for any client"
                                  : `No warehouse items found for the selected client`
                                }
                              </p>
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Modal */}
      <DispatchSuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        dispatchResult={dispatchResult}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={
          confirmDialog.action === "complete"
            ? "Mark as Delivered"
            : "Mark as Dispatched"
        }
        description={`Are you sure you want to mark ${confirmDialog.itemIds.length} item(s) as ${
          confirmDialog.action === "complete" ? "dispatched" : "processed"
        }?`}
        confirmText={
          confirmDialog.action === "complete"
            ? "Mark Delivered"
            : "Mark Dispatched"
        }
        cancelText="Cancel"
        variant="default"
        onConfirm={confirmStatusChange}
      />
    </DashboardLayout>
  );
}
