/**
 * Order Details page - Comprehensive view of a specific order
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  AlertCircle, 
  Package, 
  ArrowLeft,
  Calendar,
  User,
  Clock,
  MapPin,
  Phone,
  Building,
  CreditCard,
  Truck,
  CheckCircle,
  XCircle,
  Search,
  Weight,
  Ruler,
  DollarSign,
  FileText
} from "lucide-react";
import { fetchOrders, updateOrderStatus, Order } from "@/lib/orders";
import { getStatusBadgeVariant, getStatusDisplayText } from "@/lib/production";

interface OrderItem {
  id: string;
  paper?: {
    name: string;
    gsm: number;
    bf: number;
    shade: string;
  };
  width_inches: number;
  quantity_rolls: number;
  quantity_fulfilled: number;
  amount: number;
  item_status: string;
  notes?: string;
  created_at: string;
  dispatched_at?: string;
  started_production_at?: string;
}

interface OrderDetails extends Order {
  order_items: any[];
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states for order items
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [itemStatusFilter, setItemStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${MASTER_ENDPOINTS.ORDERS}/${orderId}`, createRequestOptions('GET'));

      if (!response.ok) {
        throw new Error('Failed to load order details');
      }

      const data = await response.json();
      setOrder(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load order details';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: Order['status']) => {
    if (!order) return;
    
    try {
      await updateOrderStatus(order.id, newStatus);
      await loadOrderDetails(); // Refresh the order data
      toast.success("Order status updated successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update order status';
      toast.error(errorMessage);
      console.error(err);
    }
  };

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

  const getItemStatusBadge = (status: string) => {
    // Handle undefined or null status
    const safeStatus = status || 'created';
    
    const statusConfig = {
      'created': { variant: 'outline', icon: Clock, color: 'text-gray-600' },
      'in_process': { variant: 'secondary', icon: Truck, color: 'text-blue-600' },
      'in_warehouse': { variant: 'default', icon: Package, color: 'text-green-600' },
      'completed': { variant: 'default', icon: CheckCircle, color: 'text-green-600' },
      'cancelled': { variant: 'destructive', icon: XCircle, color: 'text-red-600' }
    };
    
    const config = statusConfig[safeStatus as keyof typeof statusConfig] || statusConfig.created;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant as any} className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {safeStatus.replace('_', ' ')}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const safePriority = priority || 'normal';
    switch (safePriority) {
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      case 'normal':
        return <Badge>Normal</Badge>;
      case 'high':
        return <Badge variant="secondary">High</Badge>;
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      default:
        return <Badge variant="outline">{safePriority}</Badge>;
    }
  };

  // Calculate totals
  const getTotalQuantity = () => order?.order_items?.reduce((sum, item) => sum + (item.quantity_rolls || 0), 0) || 0;
  const getFulfilledQuantity = () => order?.order_items?.reduce((sum, item) => sum + (item.quantity_fulfilled || 0), 0) || 0;
  const getTotalAmount = () => order?.order_items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const getProgressPercentage = () => {
    const total = getTotalQuantity();
    const fulfilled = getFulfilledQuantity();
    return total > 0 ? (fulfilled / total) * 100 : 0;
  };

  // Filter order items
  const filteredOrderItems = order?.order_items?.filter(item => {
    const matchesSearch = !itemSearchTerm || 
      item.paper?.name?.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
      item.paper?.shade?.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
      item.width_inches.toString().includes(itemSearchTerm) ||
      item.notes?.toLowerCase().includes(itemSearchTerm.toLowerCase());
    
    const matchesStatus = itemStatusFilter === "all" || item.item_status === itemStatusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading order details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !order) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || 'Order not found'}</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Package className="w-8 h-8 text-primary" />
                Order Details
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive view of order items and progress
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <>
                {order.status === 'created' && (
                  <Button
                    onClick={() => handleStatusChange('in_process')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Start Processing
                  </Button>
                )}
                {order.status === 'in_process' && (
                  <Button
                    onClick={() => handleStatusChange('completed')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark Complete
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange('cancelled')}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Order
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Order Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">Total Items</span>
              </div>
              <p className="text-3xl font-bold">{order.order_items?.length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Different items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Weight className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Total Rolls</span>
              </div>
              <p className="text-3xl font-bold">{getTotalQuantity()}</p>
              <p className="text-xs text-muted-foreground mt-1">Rolls ordered</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-purple-500" />
                <span className="text-sm font-medium">Total Amount</span>
              </div>
              <p className="text-3xl font-bold">₹{getTotalAmount().toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Order value</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-orange-500" />
                <span className="text-sm font-medium">Progress</span>
              </div>
              <p className="text-3xl font-bold">{getProgressPercentage().toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground mt-1">{getFulfilledQuantity()}/{getTotalQuantity()} fulfilled</p>
            </CardContent>
          </Card>
        </div>

        {/* Order Information Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Order Information
                  {getStatusBadge(order.status)}
                  {getPriorityBadge(order.priority)}
                </CardTitle>
                <CardDescription>Client details, payment information, and timeline</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Client Information */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Client Details
                </h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Company</label>
                    <p className="text-lg font-medium">{order.client?.company_name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
                    <p className="text-sm">{order.client?.contact_person || 'N/A'}</p>
                  </div>
                  {order.client?.phone && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Phone
                      </label>
                      <p className="text-sm">{order.client.phone}</p>
                    </div>
                  )}
                  {order.client?.address && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Address
                      </label>
                      <p className="text-sm">{order.client.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment & Delivery */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment & Delivery
                </h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Payment Type</label>
                    <p className="text-lg font-medium capitalize">{order.payment_type}</p>
                  </div>
                  {order.delivery_date && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Delivery Date</label>
                      <p className="text-sm">{new Date(order.delivery_date).toLocaleDateString()}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total Amount</label>
                    <p className="text-lg font-bold text-green-600">₹{getTotalAmount().toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Timeline
                </h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="text-sm">{new Date(order.created_at).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString()}</p>
                  </div>
                  {order.updated_at && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                      <p className="text-sm">{new Date(order.updated_at).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order Items ({filteredOrderItems.length})</CardTitle>
                <CardDescription>Detailed breakdown of all items in this order</CardDescription>
              </div>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
                <Select value={itemStatusFilter} onValueChange={setItemStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="in_process">In Process</SelectItem>
                    <SelectItem value="in_warehouse">In Warehouse</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paper</TableHead>
                    <TableHead>Specifications</TableHead>
                    <TableHead>Width</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Fulfilled</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timeline</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrderItems.length > 0 ? (
                    filteredOrderItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.paper?.name || 'N/A'}</div>
                        </TableCell>
                        <TableCell>
                          {item.paper && (
                            <div className="text-sm">
                              <div>{item.paper.gsm}gsm</div>
                              <div className="text-xs text-muted-foreground">
                                BF: {item.paper.bf}, {item.paper.shade}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.width_inches || 0}"</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.quantity_rolls || 0}</div>
                          <div className="text-xs text-muted-foreground">rolls</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.quantity_fulfilled || 0}</div>
                          <div className="text-xs text-muted-foreground">
                            {(item.quantity_rolls || 0) > 0 ? 
                              `${(((item.quantity_fulfilled || 0) / (item.quantity_rolls || 1)) * 100).toFixed(0)}%` : 
                              '0%'
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">₹{item.amount?.toFixed(2) || '0.00'}</div>
                        </TableCell>
                        <TableCell>
                          {getItemStatusBadge(item.item_status)}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            <div>Created: {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}</div>
                            {item.started_production_at && (
                              <div>Started: {new Date(item.started_production_at).toLocaleDateString()}</div>
                            )}
                            {item.dispatched_at && (
                              <div>Dispatched: {new Date(item.dispatched_at).toLocaleDateString()}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs max-w-32 truncate">
                            {item.notes || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        {order.order_items?.length === 0
                          ? "No items found for this order."
                          : "No items match the current filters."
                        }
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}