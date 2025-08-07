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

type ItemType = "warehouse" | "pending";

export default function DispatchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
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

  // New state for client-order selection
  const [clients, setClients] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("none");
  const [clientsLoading, setClientsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

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

  // Load orders for selected client
  const loadOrders = async (clientId: string) => {
    if (!clientId) {
      setOrders([]);
      return;
    }
    
    try {
      setOrdersLoading(true);
      const response = await fetch(`${API_BASE_URL}/orders?client_id=${clientId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (!response.ok) throw new Error('Failed to load orders');
      const data = await response.json();
      setOrders(data || []);
    } catch (err) {
      console.error('Error loading orders:', err);
      toast.error('Failed to load orders');
    } finally {
      setOrdersLoading(false);
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
      if (selectedOrderId && selectedOrderId !== "none") params.append('order_id', selectedOrderId);
      
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

  // Load orders when client changes
  useEffect(() => {
    if (selectedClientId && selectedClientId !== "none") {
      loadOrders(selectedClientId);
      setSelectedOrderId("none"); // Reset order selection when client changes
    } else {
      setOrders([]);
      setSelectedOrderId("none");
    }
  }, [selectedClientId]);

  // Reload warehouse items when client or order filter changes
  useEffect(() => {
    loadData();
  }, [selectedClientId, selectedOrderId]);

  const filteredItems = warehouseItems.filter((item: any) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.qr_code?.toLowerCase().includes(searchLower) ||
      item.barcode_id?.toLowerCase().includes(searchLower) ||
      item.paper_spec?.toLowerCase().includes(searchLower) ||
      item.location?.toLowerCase().includes(searchLower) ||
      item.created_by?.toLowerCase().includes(searchLower)
    );
  });

  const handleCompleteItems = (itemIds: string[]) => {
    // Get selected items data for dispatch form
    const selectedItems = warehouseItems.filter(item => 
      itemIds.includes(item.inventory_id)
    );
    
    setSelectedItemsForDispatch(selectedItems);
    setDispatchFormOpen(true);
  };

  // Get selected client and order info for dispatch form
  const selectedClient = selectedClientId && selectedClientId !== "none" ? clients.find(c => c.id === selectedClientId) : null;
  const selectedOrder = selectedOrderId && selectedOrderId !== "none" ? orders.find(o => o.id === selectedOrderId) : null;

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

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            High
          </Badge>
        );
      case "normal":
        return <Badge variant="outline">Normal</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const warehouseItemsCount = warehouseItems.length;
  const totalItems = warehouseItemsCount;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Truck className="w-8 h-8 text-primary" />
              Dispatch Management
            </h1>
            <p className="text-muted-foreground">
              Manage order items ready for dispatch and track delivery status
            </p>
          </div>
          <Button
            onClick={() => window.location.href = '/dispatch/history'}
            variant="outline"
          >
            <History className="w-4 h-4 mr-2" />
            View Dispatch History
          </Button>
        </div>

        {/* Client and Order Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Filter by Client & Order
            </CardTitle>
            <CardDescription>
              Select a client and order to view specific warehouse items ready for dispatch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Client Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <Select 
                  value={selectedClientId} 
                  onValueChange={(value) => {
                    setSelectedClientId(value);
                    setSelectedItems([]); // Clear selected items when filter changes
                  }}
                  disabled={clientsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={clientsLoading ? "Loading clients..." : "Select client"} />
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

              {/* Order Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Order</label>
                <Select 
                  value={selectedOrderId} 
                  onValueChange={(value) => {
                    setSelectedOrderId(value);
                    setSelectedItems([]); // Clear selected items when filter changes
                  }}
                  disabled={ordersLoading || !selectedClientId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !selectedClientId ? "Select client first" :
                      ordersLoading ? "Loading orders..." : 
                      "Select order (optional)"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select Order</SelectItem>
                    {orders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        Order #{order.frontend_id || order.id.slice(0, 8)} - {order.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Filter</label>
                <div className="p-2 bg-muted rounded-md text-sm">
                  {selectedClientId === "none" && (
                    <span className="text-muted-foreground">Please select a client to view warehouse items</span>
                  )}
                  {selectedClientId !== "none" && selectedOrderId === "none" && (
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary">
                        Client: {clients.find(c => c.id === selectedClientId)?.company_name}
                      </Badge>
                      <span className="text-muted-foreground ml-2">All orders for this client</span>
                    </div>
                  )}
                  {selectedClientId !== "none" && selectedOrderId !== "none" && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary">
                          Client: {clients.find(c => c.id === selectedClientId)?.company_name}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">
                          Order: #{orders.find(o => o.id === selectedOrderId)?.frontend_id}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground">
                Total items in system
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ready for Dispatch
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {warehouseItemsCount}
              </div>
              <p className="text-xs text-muted-foreground">Cut rolls ready</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {warehouseItems.filter(item => item.weight_kg > 10).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Heavy rolls ({'>'}10kg)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Filtered Items</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {filteredItems.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Matching search
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
              <div className="flex items-center gap-4">
                {selectedItems.length > 0 && (
                  <Button 
                    onClick={handleBulkDispatch}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Dispatch {selectedItems.length} Items
                  </Button>
                )}
                <div className="w-64">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search orders..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems(filteredItems.map(item => item.inventory_id));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
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
                      <TableRow key={item.inventory_id || item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.includes(item.inventory_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedItems(prev => [...prev, item.inventory_id]);
                              } else {
                                setSelectedItems(prev => prev.filter(id => id !== item.inventory_id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-mono text-sm">{item.barcode_id || item.qr_code}</div>
                            <div className="text-xs text-muted-foreground">
                              Created by: {item.created_by}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{item.paper_spec}</div>
                            <div className="text-xs text-muted-foreground">
                              Cut roll ready for dispatch
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
                              <p className="text-sm">
                                {selectedOrderId !== "none" 
                                  ? "No items found for the selected client and order" 
                                  : "No items found for the selected client"}
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
        preSelectedOrder={selectedOrder}
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
