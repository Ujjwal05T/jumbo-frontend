/**
 * Pending Order Allocation Management Page
 * Allows users to allocate/transfer pending orders between different orders
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  Settings,
  ArrowRight,
  Package,
  Users,
  FileText,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";

interface PendingOrderItem {
  id: string;
  frontend_id: string;
  original_order_id: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  quantity_pending: number;
  quantity_fulfilled: number;
  reason: string;
  status: "pending" | "included_in_plan" | "resolved" | "cancelled";
  created_at: string;
  resolved_at?: string;
  original_order?: {
    id: string;
    frontend_id: string;
    client?: {
      company_name: string;
    };
  };
}

interface AvailableOrder {
  id: string;
  frontend_id: string;
  client_id: string;
  client_name: string;
  status: string;
  priority: string;
  payment_type: string;
  delivery_date?: string;
  created_at: string;
  has_matching_paper: boolean;
  matching_items_count: number;
}

interface AllocationData {
  pending_item: {
    id: string;
    frontend_id: string;
    width_inches: number;
    gsm: number;
    bf: number;
    shade: string;
    quantity_pending: number;
    status: string;
    original_order_client: string;
  };
  matching_orders: AvailableOrder[];
  other_orders: AvailableOrder[];
  total_available: number;
}

export default function PendingOrderAllocationPage() {
  const [pendingItems, setPendingItems] = useState<PendingOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPendingItem, setSelectedPendingItem] = useState<PendingOrderItem | null>(null);
  const [allocationData, setAllocationData] = useState<AllocationData | null>(null);
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [quantityToTransfer, setQuantityToTransfer] = useState(1);
  const [isTransferring, setIsTransferring] = useState(false);

  // Load pending order items
  const loadPendingItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${MASTER_ENDPOINTS.PENDING_ORDER_ITEMS}?status=pending&limit=1000`,
        createRequestOptions("GET")
      );

      if (!response.ok) {
        throw new Error("Failed to fetch pending order items");
      }

      const data = await response.json();
      setPendingItems(data);
    } catch (error) {
      console.error("Error loading pending items:", error);
      toast.error("Failed to load pending order items");
    } finally {
      setLoading(false);
    }
  };

  // Load available orders for allocation
  const loadAvailableOrders = async (itemId: string) => {
    try {
      const response = await fetch(
        `${MASTER_ENDPOINTS.PENDING_ORDER_ITEMS}/${itemId}/available-orders`,
        createRequestOptions("GET")
      );

      if (!response.ok) {
        throw new Error("Failed to fetch available orders");
      }

      const data = await response.json();
      setAllocationData(data);
    } catch (error) {
      console.error("Error loading available orders:", error);
      toast.error("Failed to load available orders");
    }
  };

  // Handle allocation process
  const handleAllocate = async () => {
    if (!selectedPendingItem || !selectedOrderId) return;

    try {
      setIsTransferring(true);
      const response = await fetch(
        `${MASTER_ENDPOINTS.PENDING_ORDER_ITEMS}/${selectedPendingItem.id}/allocate`,
        createRequestOptions("POST", {
          target_order_id: selectedOrderId,
          quantity_to_transfer: quantityToTransfer,
          created_by_id: "current-user-id" // Should come from auth context
        })
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to allocate pending order");
      }

      const result = await response.json();
      toast.success(result.message || "Successfully allocated pending order");

      // Refresh data
      await loadPendingItems();
      setIsAllocationDialogOpen(false);
      setSelectedPendingItem(null);
      setSelectedOrderId("");
      setQuantityToTransfer(1);
    } catch (error) {
      console.error("Error allocating pending order:", error);
      toast.error(error instanceof Error ? error.message : "Failed to allocate pending order");
    } finally {
      setIsTransferring(false);
    }
  };

  // Open allocation dialog
  const openAllocationDialog = async (item: PendingOrderItem) => {
    setSelectedPendingItem(item);
    setQuantityToTransfer(Math.min(1, item.quantity_pending));
    await loadAvailableOrders(item.id);
    setIsAllocationDialogOpen(true);
  };

  // Filter pending items based on search
  const filteredItems = pendingItems.filter(item =>
    item.frontend_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.original_order?.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.shade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    loadPendingItems();
  }, []);

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: "bg-yellow-100 text-yellow-800",
      included_in_plan: "bg-blue-100 text-blue-800",
      resolved: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800"
    };

    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityColors = {
      low: "bg-gray-100 text-gray-800",
      normal: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800"
    };

    return (
      <Badge className={priorityColors[priority as keyof typeof priorityColors] || "bg-gray-100 text-gray-800"}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Pending Order Allocation</h1>
            <p className="text-gray-600 mt-2">
              Manage pending order allocations and transfers between orders
            </p>
          </div>
          <Button onClick={() => loadPendingItems()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Pending</p>
                  <p className="text-2xl font-bold">{pendingItems.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">High Priority</p>
                  <p className="text-2xl font-bold">
                    {pendingItems.filter(item => item.reason.includes('urgent')).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ready for Allocation</p>
                  <p className="text-2xl font-bold">
                    {pendingItems.filter(item => item.status === 'pending').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Unique Clients</p>
                  <p className="text-2xl font-bold">
                    {new Set(pendingItems.map(item => item.original_order?.client?.company_name).filter(Boolean)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by ID, client name, or paper shade..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Order Items</CardTitle>
            <CardDescription>
              Select a pending order item to allocate it to another order
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Paper Specs</TableHead>
                    <TableHead>Width</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.frontend_id || item.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {item.original_order?.client?.company_name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{item.gsm}GSM</div>
                          <div className="text-gray-500">{item.bf}BF, {item.shade}</div>
                        </div>
                      </TableCell>
                      <TableCell>{item.width_inches}"</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>Pending: {item.quantity_pending}</div>
                          <div className="text-gray-500">Fulfilled: {item.quantity_fulfilled}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                      <TableCell>
                        {new Date(item.created_at).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell>
                        {item.status === 'pending' && item.quantity_pending > 0 && (
                          <Button
                            onClick={() => openAllocationDialog(item)}
                            size="sm"
                            variant="outline"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Allocate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Allocation Dialog */}
        <Dialog open={isAllocationDialogOpen} onOpenChange={setIsAllocationDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Allocate Pending Order</DialogTitle>
              <DialogDescription>
                Transfer pending order quantity to another order
              </DialogDescription>
            </DialogHeader>

            {allocationData && selectedPendingItem && (
              <div className="space-y-6">
                {/* Pending Item Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pending Item Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Item ID</Label>
                        <p className="font-medium">{allocationData.pending_item.frontend_id}</p>
                      </div>
                      <div>
                        <Label>Original Client</Label>
                        <p className="font-medium">{allocationData.pending_item.original_order_client}</p>
                      </div>
                      <div>
                        <Label>Paper Specs</Label>
                        <p className="font-medium">
                          {allocationData.pending_item.gsm}GSM, {allocationData.pending_item.bf}BF, {allocationData.pending_item.shade}
                        </p>
                      </div>
                      <div>
                        <Label>Width & Quantity</Label>
                        <p className="font-medium">
                          {allocationData.pending_item.width_inches}" × {allocationData.pending_item.quantity_pending} pending
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Transfer Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantity to Transfer</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max={selectedPendingItem.quantity_pending}
                      value={quantityToTransfer}
                      onChange={(e) => setQuantityToTransfer(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="target-order">Target Order</Label>
                    <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target order" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Matching Orders First */}
                        {allocationData.matching_orders.length > 0 && (
                          <>
                            <SelectItem value="matching-header" disabled>
                              <span className="font-semibold text-green-600">📋 Orders with Matching Paper Specs</span>
                            </SelectItem>
                            {allocationData.matching_orders.map((order) => (
                              <SelectItem key={order.id} value={order.id}>
                                <div className="flex items-center space-x-2">
                                  <span className="text-green-600">✓</span>
                                  <span>{order.frontend_id} - {order.client_name}</span>
                                  <Badge variant="outline" className="ml-2">
                                    {order.matching_items_count} matching
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}

                        {/* Other Orders */}
                        {allocationData.other_orders.length > 0 && (
                          <>
                            <SelectItem value="other-header" disabled>
                              <span className="font-semibold text-gray-600">📄 Other Active Orders</span>
                            </SelectItem>
                            {allocationData.other_orders.map((order) => (
                              <SelectItem key={order.id} value={order.id}>
                                <div className="flex items-center space-x-2">
                                  <span>{order.frontend_id} - {order.client_name}</span>
                                  {getPriorityBadge(order.priority)}
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preview */}
                {selectedOrderId && selectedOrderId !== "matching-header" && selectedOrderId !== "other-header" && (
                  <Card className="bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <Package className="h-6 w-6 text-blue-600" />
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <FileText className="h-6 w-6 text-green-600" />
                        <div className="flex-1">
                          <p className="font-medium">
                            Transfer {quantityToTransfer} items from pending order to target order
                          </p>
                          <p className="text-sm text-gray-600">
                            Remaining pending after transfer: {selectedPendingItem.quantity_pending - quantityToTransfer}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAllocationDialogOpen(false)}
                disabled={isTransferring}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAllocate}
                disabled={!selectedOrderId || selectedOrderId.includes("header") || isTransferring || quantityToTransfer <= 0}
              >
                {isTransferring ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Transferring...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Allocate to Order
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
