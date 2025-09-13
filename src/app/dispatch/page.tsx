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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Search,
  MoreHorizontal,
  CheckCircle,
  Clock,
  Package,
  AlertCircle,
  Eye,
  MapPin,
  Calendar,
  User,
  Loader2,
  History,
  Scan,
  X,
  ShoppingCart,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DispatchForm } from "@/components/DispatchForm";
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
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    itemIds: string[];
    action: "complete";
  }>({ open: false, itemIds: [], action: "complete" });
  const [dispatchFormOpen, setDispatchFormOpen] = useState(false);
  const [selectedItemsForDispatch, setSelectedItemsForDispatch] = useState<any[]>([]);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  // Client selection state
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [clientsLoading, setClientsLoading] = useState(false);

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


  // Load warehouse items with optional filtering
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // If no client is selected, don't load any items - require client selection first
      if (selectedClientId === "none") {
        setWarehouseItems([]);
        console.log("No client selected - showing empty list");
        setLoading(false);
        return;
      }
      
      // Build query parameters for filtering
      const params = new URLSearchParams();
      if (selectedClientId && selectedClientId !== "none") params.append('client_id', selectedClientId);
      
      const queryString = params.toString();
      const url = `${API_BASE_URL}/dispatch/warehouse-items?${queryString}`;
      
      const response = await fetch(url, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (!response.ok) throw new Error('Failed to load warehouse items');
      const warehouseResponse = await response.json();
      
      setWarehouseItems(warehouseResponse.warehouse_items || []);
      
      console.log("Loaded warehouse items:", warehouseResponse.warehouse_items?.length || 0);
      console.log("Filter applied:", warehouseResponse.dispatch_info);
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
    loadData(); // Load warehouse items based on initial state (will be empty since no client selected)
  }, []);

  // Reload warehouse items when client filter changes
  useEffect(() => {
    loadData();
  }, [selectedClientId]);

  const filteredItems = warehouseItems;

  const handleCompleteItems = (itemIds: string[]) => {
    // Get selected items data for dispatch form
    const selectedItems = warehouseItems.filter(item => 
      itemIds.includes(item.inventory_id)
    );
    
    setSelectedItemsForDispatch(selectedItems);
    setDispatchFormOpen(true);
  };

  // Get selected client info for dispatch form
  const selectedClient = selectedClientId && selectedClientId !== "none" ? clients.find(c => c.id === selectedClientId) : null;

  const handleDispatchConfirm = async (formData: any) => {
    try {
      setDispatchLoading(true);
      
      const dispatchData = {
        ...formData,
        inventory_ids: selectedItemsForDispatch.map(item => item.inventory_id)
      };
      
      const result = await createDispatchRecord(dispatchData);
      
      // Show success modal with dispatch details
      setDispatchResult(result);
      setSuccessModalOpen(true);
      
      // Reload data and reset selections
      await loadData();
      setSelectedItems([]);
      setSelectedItemsForDispatch([]);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create dispatch';
      toast.error(errorMessage);
      console.error("Dispatch error:", error);
      throw error; // Re-throw to prevent modal from closing on error
    } finally {
      setDispatchLoading(false);
    }
  };

  const confirmStatusChange = async () => {
    // This is now handled by the dispatch form
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  const handleBulkDispatch = () => {
    if (selectedItems.length === 0) {
      toast.error("Please select items to dispatch");
      return;
    }
    handleCompleteItems(selectedItems);
  };

  const handleBarcodeSubmit = async () => {
    if (!barcodeInput.trim()) {
      toast.error("Please enter a barcode");
      return;
    }

    if (selectedClientId === "none") {
      toast.error("Please select a client first");
      return;
    }

    try {
      setScanLoading(true);
      
      // Find item in current filtered warehouse items
      const foundItem = warehouseItems.find(item => 
        item.barcode_id === barcodeInput.trim() || 
        item.qr_code === barcodeInput.trim()
      );
      
      if (!foundItem) {
        toast.error("Item not found or doesn't belong to selected client");
        return;
      }
      
      // Check if already selected
      if (selectedItems.includes(foundItem.inventory_id)) {
        toast.error("Item already selected");
        return;
      }
      
      // Add to selected items
      setSelectedItems(prev => [...prev, foundItem.inventory_id]);
      setBarcodeInput("");
      toast.success(`Item ${foundItem.barcode_id || foundItem.qr_code} selected for dispatch`);
      
    } catch (error) {
      toast.error("Error scanning barcode");
    } finally {
      setScanLoading(false);
    }
  };

  const clearSelectedItems = () => {
    setSelectedItems([]);
    toast.success("Selection cleared");
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

        {/* Client Selection & Barcode Scanner */}
        <Card>
          <CardContent className="pt-3">
            <div className="grid grid-cols-1 sm:flex sm:flex-row sm:justify-between gap-4">
              {/* Client Selection */}
              <div className="space-y-2 max-w-xs sm:w-full">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Client
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
                    <SelectValue placeholder={clientsLoading ? "Loading..." : "Select client"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select Client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Barcode Scanner */}
              <div className="md:col-span-2 space-y-2 sm:h-20  max-w-xl sm:w-full">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Scan className="w-4 h-4" />
                  Scan Barcode
                </label>
                <div className="flex gap-2">
                  <Input
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan or enter barcode (e.g., CR_00001)"
                    onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSubmit()}
                    className="font-mono py-1"
                    disabled={selectedClientId === "none"}
                  />
                  <Button 
                    onClick={handleBarcodeSubmit}
                    disabled={!barcodeInput.trim() || scanLoading || selectedClientId === "none"}
                  >
                    {scanLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Scan className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {selectedClientId === "none" && (
                  <p className="text-xs text-orange-600">Select a client first</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{selectedItems.length}</div>
                  <div className="text-xs text-muted-foreground">Selected</div>
                </div>
                {selectedItems.length > 0 && (
                  <Button 
                    variant="outline" 
                    onClick={clearSelectedItems}
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
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

        {/* Dispatch Items Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Dispatch Queue</CardTitle>
                <CardDescription>
                  Manage order items ready for dispatch and delivery
                </CardDescription>
              </div>
              {selectedItems.length > 0 && (
                <Button 
                  onClick={handleBulkDispatch}
                  className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
                  size="lg"
                >
                  <Truck className="mr-2 h-5 w-5" />
                  Dispatch {selectedItems.length} Items
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <div className="flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead>S.No</TableHead>
                    <TableHead>QR Code</TableHead>
                    <TableHead>Paper Specs</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                            {selectedItems.includes(item.inventory_id) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeSelectedItem(item.inventory_id)}
                                className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Not Selected
                              </Badge>
                            )}
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
                              {item.barcode_id || item.qr_code}
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.paper_spec}</span>
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
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {item.location}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(item.production_date).toLocaleDateString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status, "warehouse")}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View QR Code
                              </DropdownMenuItem>
                              {item.status === "available" && (
                                <DropdownMenuItem
                                  className="text-green-600"
                                  onClick={() =>
                                    handleCompleteItems([item.inventory_id])
                                  }>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark as Dispatched
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        {loading ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading warehouse items...
                          </div>
                        ) : selectedClientId === "none" ? (
                          <div className="text-center py-4">
                            <div className="text-muted-foreground">
                              <p className="font-medium">Please select a client first</p>
                              <p className="text-sm">Choose a client from the dropdown above to view their warehouse items ready for dispatch</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <div className="text-muted-foreground">
                              <p className="font-medium">No cut rolls ready for dispatch</p>
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

      {/* Dispatch Form Modal */}
      <DispatchForm
        open={dispatchFormOpen}
        onOpenChange={setDispatchFormOpen}
        selectedItems={selectedItemsForDispatch.map(item => ({
          inventory_id: item.inventory_id,
          qr_code: item.qr_code,
          barcode_id: item.barcode_id,
          paper_spec: item.paper_spec,
          width_inches: item.width_inches,
          weight_kg: item.weight_kg,
          location: item.location
        }))}
        onConfirmDispatch={handleDispatchConfirm}
        loading={dispatchLoading}
        preSelectedClient={selectedClient}
        preSelectedOrder={null}
      />

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
