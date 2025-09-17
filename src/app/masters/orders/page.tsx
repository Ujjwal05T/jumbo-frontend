/**
 * Order Master page - Manage all orders
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  Package, 
  Search, 
  MoreHorizontal, 
  Plus,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  Edit,
  Trash2,
  Eye
} from "lucide-react";
import { fetchOrders, updateOrderStatus, deleteOrder, Order } from "@/lib/orders";
import { getStatusBadgeVariant, getStatusDisplayText } from "@/lib/production";
import { MASTER_ENDPOINTS } from "@/lib/api-config";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRouter } from "next/navigation";

export default function OrderMasterPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    orderId: string;
    orderInfo: string;
  }>({ open: false, orderId: "", orderInfo: "" });
  const router = useRouter();

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchOrders();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const getStatusBadge = (status: string) => {
    const variant = getStatusBadgeVariant(status, 'order');
    const displayText = getStatusDisplayText(status);
    
    const iconMap = {
      'created': Clock,
      'in_process': Truck,
      'completed': CheckCircle,
      'cancelled': XCircle
    };
    
    const Icon = iconMap[status as keyof typeof iconMap] || Clock;
    
    return (
      <Badge variant={variant as "default" | "secondary" | "destructive" | "outline"}>
        <Icon className="w-3 h-3 mr-1" />
        {displayText}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      case 'normal':
        return <Badge>Normal</Badge>;
      case 'high':
        return <Badge variant="secondary">High</Badge>;
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      await loadOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update order status');
    }
  };

  const handleEditOrder = (order: Order) => {
    // Navigate to edit page (you can create an edit page similar to the new order page)
    router.push(`/masters/orders/${order.id}/edit`);
  };

  const handleDeleteOrder = (order: Order) => {
    setDeleteDialog({
      open: true,
      orderId: order.id,
      orderInfo: `${order.client?.company_name || 'Unknown Client'} order`
    });
  };

  const confirmDeleteOrder = async () => {
    try {
      await deleteOrder(deleteDialog.orderId);
      toast.success('Order deleted successfully!');
      await loadOrders();
      setDeleteDialog({ open: false, orderId: '', orderInfo: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete order');
    }
  };

  // Sorting function for order IDs
  const sortOrdersByIdDesc = (ordersToSort: Order[]) => {
    return ordersToSort.sort((a, b) => {
      const parseOrderId = (orderId: string) => {
        if (!orderId) return { year: 0, month: 0, number: 0 };
        
        // ORD-YY-MM-0001 format
        const yymmMatch = orderId.match(/^ORD-(\d{2})-(\d{2})-(\d{4})$/);
        if (yymmMatch) {
          const year = 2000 + parseInt(yymmMatch[1]);
          const month = parseInt(yymmMatch[2]);
          const number = parseInt(yymmMatch[3]);
          return { year, month, number };
        }
        
        // ORD-YYYY-00001 format (5 digits)
        const yyyy5Match = orderId.match(/^ORD-(\d{4})-(\d{5})$/);
        if (yyyy5Match) {
          const year = parseInt(yyyy5Match[1]);
          const number = parseInt(yyyy5Match[2]);
          return { year, month: 0, number };
        }
        
        // ORD-YYYY-001 format (3 digits)
        const yyyy3Match = orderId.match(/^ORD-(\d{4})-(\d{3})$/);
        if (yyyy3Match) {
          const year = parseInt(yyyy3Match[1]);
          const number = parseInt(yyyy3Match[2]);
          return { year, month: 0, number };
        }
        
        return { year: 0, month: 0, number: 0 };
      };
      
      const parsedA = parseOrderId(a.frontend_id || '');
      const parsedB = parseOrderId(b.frontend_id || '');
      
      // Sort by year descending
      if (parsedA.year !== parsedB.year) {
        return parsedB.year - parsedA.year;
      }
      
      // Sort by month descending (for YY-MM format)
      if (parsedA.month !== parsedB.month) {
        return parsedB.month - parsedA.month;
      }
      
      // Sort by number descending
      return parsedB.number - parsedA.number;
    });
  };

  const filteredOrders = sortOrdersByIdDesc(
    orders.filter((order: Order) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        order.client?.contact_person?.toLowerCase().includes(searchLower) ||
        order.client?.company_name?.toLowerCase().includes(searchLower) ||
        order.order_items?.some(item => 
          item.paper?.name?.toLowerCase().includes(searchLower)
        )
      );
    })
  );

  const createdOrders = orders.filter((o: Order) => o.status === 'created').length;
  const inProcessOrders = orders.filter((o: Order) => o.status === 'in_process').length;
  const completedOrders = orders.filter((o: Order) => o.status === 'completed').length;

  // Helper functions for order item calculations
  const getTotalQuantity = (order: Order) => {
    return order.order_items?.reduce((sum, item) => sum + item.quantity_rolls, 0) || 0;
  };

  const getFulfilledQuantity = (order: Order) => {
    return order.order_items?.reduce((sum, item) => sum + item.quantity_fulfilled, 0) || 0;
  };

  const getOrderWidths = (order: Order) => {
    return order.order_items?.map(item => `${item.width_inches}"`).join(", ") || "N/A";
  };

  const getOrderPapers = (order: Order) => {
    const papers = order.order_items?.map(item => item.paper?.name).filter(Boolean) || [];
    return papers.length > 0 ? papers.join(", ") : "N/A";
  };

  const getTotalAmount = (order: Order) => {
    return order.order_items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Package className="w-8 h-8 text-primary" />
              Orders
            </h1>
            <p className="text-muted-foreground">
              Manage and track all customer orders
            </p>
          </div>
          <Button onClick={() => router.push('/masters/orders/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : orders.length}</div>
              <p className="text-xs text-muted-foreground">
                All orders
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Created</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : createdOrders}</div>
              <p className="text-xs text-muted-foreground">
                Newly created orders
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Process</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : inProcessOrders}</div>
              <p className="text-xs text-muted-foreground">
                Currently being processed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : completedOrders}</div>
              <p className="text-xs text-muted-foreground">
                Successfully delivered
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Order List</CardTitle>
                <CardDescription>
                  View and manage all customer orders
                </CardDescription>
              </div>
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
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-md text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Papers</TableHead>
                      <TableHead>Widths</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((order, index) => {
                        const totalQuantity = getTotalQuantity(order);
                        const fulfilledQuantity = getFulfilledQuantity(order);
                        const progressPercentage = totalQuantity > 0 ? (fulfilledQuantity / totalQuantity) * 100 : 0;
                        
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm font-medium">
                              {order.frontend_id || 'Generating...'}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium max-w-32 truncate" title={order.client?.company_name || 'N/A'}>
                                {order.client?.company_name || 'N/A'}
                              </div>
                              <div className="text-xs text-muted-foreground max-w-32 truncate" title={order.client?.contact_person || 'N/A'}>
                                {order.client?.contact_person || 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-xs max-w-32 truncate" title={getOrderPapers(order)}>
                                {getOrderPapers(order)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {order.order_items?.length || 0} different papers
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm max-w-24 truncate" title={getOrderWidths(order)}>
                                {getOrderWidths(order)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-center">
                                <div className="font-medium">{order.order_items?.length || 0}</div>
                                <div className="text-xs text-muted-foreground">items</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">₹{getTotalAmount(order).toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">
                                {getTotalQuantity(order)} rolls total
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm capitalize">{order.payment_type}</div>
                              {order.delivery_date && (
                                <div className="text-xs text-muted-foreground">
                                  Created:
                                  <span className="font-bold text-black">{new Date(order.created_at).toLocaleDateString()}</span>
                                   
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <div className="w-12 bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className={`h-1.5 rounded-full ${
                                        progressPercentage === 100 ? 'bg-green-600' : 
                                        progressPercentage > 0 ? 'bg-blue-600' : 'bg-gray-400'
                                      }`}
                                      style={{ width: `${progressPercentage}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs">{progressPercentage.toFixed(0)}%</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {fulfilledQuantity}/{totalQuantity} rolls
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => router.push(`/masters/orders/${order.id}`)}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  <div className="mr-2"> 
                                  View Details
                                  </div>
                                </DropdownMenuItem>
                                {order.status === 'created' && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => handleEditOrder(order)}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit Order
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      className="text-red-600"
                                      onClick={() => handleDeleteOrder(order)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete Order
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={11} className="h-24 text-center">
                          No orders found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title="Delete Order"
        description={`Are you sure you want to delete this ${deleteDialog.orderInfo}? This action cannot be undone and will remove all associated order items.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteOrder}
      />
    </DashboardLayout>
  );
}