/**
 * Order Master page - Manage all orders
 */
"use client";

import { useState, useEffect } from "react";
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
  Loader2
} from "lucide-react";
import { fetchOrders, updateOrderStatus, Order } from "@/lib/orders";
import { useRouter } from "next/navigation";

interface Order {
  id: string;
  client: {
    company_name: string;
    contact_person: string;
    email: string;
    phone: string;
    address: string;
    status: string;
  };
  created_at: string;
  deliveryDate: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  items: number;
  totalAmount: number;
  paper: {
    name: string;
    gsm: string;
    bf: string;
    shade: string;
  };
  width_inches: number;
  quantity_rolls: number;
  priority: "low" | "normal" | "high" | "urgent";
}

export default function OrderMasterPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
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
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800"><Truck className="w-3 h-3 mr-1" /> In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
      alert(err instanceof Error ? err.message : 'Failed to update order status');
    }
  };

  const filteredOrders = orders.filter((order: Order) => 
    order.client?.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.paper?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingOrders = orders.filter((o: Order) => o.status === 'pending').length;
  const inProgressOrders = orders.filter((o: Order) => o.status === 'in_progress').length;
  const completedOrders = orders.filter((o: Order) => o.status === 'completed').length;

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
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : pendingOrders}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting processing
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : inProgressOrders}</div>
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
                      <TableHead>Paper</TableHead>
                      <TableHead>Width</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            <div className="text-sm">
                              {order.id.substring(0, 8)}...
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{order.client?.contact_person || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">
                              {order.client?.company_name || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{order.paper?.name || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">
                              {order.paper?.gsm}gsm • {order.paper?.bf}bf • {order.paper?.shade}
                            </div>
                          </TableCell>
                          <TableCell>{order.width_inches}"</TableCell>
                          <TableCell>{order.quantity_rolls} rolls</TableCell>
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
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                                {order.status !== 'pending' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'pending')}>
                                    <Clock className="mr-2 h-4 w-4" />
                                    Set as Pending
                                  </DropdownMenuItem>
                                )}
                                {order.status !== 'in_progress' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'in_progress')}>
                                    <Truck className="mr-2 h-4 w-4" />
                                    Mark as In Progress
                                  </DropdownMenuItem>
                                )}
                                {order.status !== 'completed' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'completed')}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Mark as Completed
                                  </DropdownMenuItem>
                                )}
                                {order.status !== 'cancelled' && (
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={() => handleStatusChange(order.id, 'cancelled')}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel Order
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
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
    </DashboardLayout>
  );
}