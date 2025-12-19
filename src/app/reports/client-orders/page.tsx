"use client";

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSearch } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Package, TrendingUp, Calendar, BarChart3, FileText, Eye } from 'lucide-react';
import { REPORTS_ENDPOINTS, MASTER_ENDPOINTS, createRequestOptions } from '@/lib/api-config';

// Types
type Client = {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  gst_number: string;
  address: string;
};

type ClientOrder = {
  order_id: string;
  frontend_id: string;
  client_name: string;
  status: string;
  priority: string;
  delivery_date: string | null;
  created_at: string;
  total_items: number;
  total_quantity_ordered: number;
  total_quantity_fulfilled: number;
  total_quantity_pending: number;
  total_quantity_cut: number;
  total_quantity_dispatched: number;
  remaining_to_plan: number;
  fulfillment_percentage: number;
  total_value: number;
  is_overdue: boolean;
  payment_type: string;
};

type ClientSummary = {
  total_orders: number;
  total_value: number;
  total_quantity_kg: number;
  completed_orders: number;
  pending_orders: number;
  completion_rate: number;
  avg_order_value: number;
  last_order_date: string | null;
  first_order_date: string | null;
};

export default function ClientOrdersPage() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [clientOrders, setClientOrders] = useState<ClientOrder[]>([]);
  const [clientSummary, setClientSummary] = useState<ClientSummary | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Search states for dropdowns
  const [clientSearch, setClientSearch] = useState('');
  const [statusSearch, setStatusSearch] = useState('');

  // Fetch available clients
  const fetchAvailableClients = async () => {
    try {
      const response = await fetch(MASTER_ENDPOINTS.CLIENTS, createRequestOptions('GET'));
      const result = await response.json();

      if (result && Array.isArray(result)) {
        setAvailableClients(result);
      } else if (result.status === 'success' && result.data) {
        setAvailableClients(result.data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  // Fetch client orders using the new orders with summary endpoint
  const fetchClientOrders = async (clientId: string) => {
    if (!clientId) return;

    setLoading(true);
    try {
      // Build query parameters for orders with summary endpoint
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('limit', '1000'); // Get more orders
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

      // Fetch orders using the new orders with summary endpoint
      const ordersUrl = `${MASTER_ENDPOINTS.ORDERS_WITH_SUMMARY}?${params}`;
      console.log('Fetching orders with summary from:', ordersUrl);

      const ordersResponse = await fetch(ordersUrl, createRequestOptions('GET'));
      const ordersResult = await ordersResponse.json();

      console.log('Orders API response:', ordersResult);

      if (Array.isArray(ordersResult)) {
        // Transform the data to match our ClientOrder type - now using summary data from backend
        const transformedOrders = ordersResult.map((order: any) => {
          return {
            order_id: order.order_id,
            frontend_id: order.frontend_id,
            client_name: order.client_name,
            status: order.status,
            priority: order.priority,
            delivery_date: order.delivery_date,
            created_at: order.created_at,
            total_items: order.total_items,
            total_quantity_ordered: order.total_quantity_ordered,
            total_quantity_fulfilled: order.total_quantity_fulfilled,
            total_quantity_pending: order.total_quantity_pending,
            total_quantity_cut: order.total_quantity_cut,
            total_quantity_dispatched: order.total_quantity_dispatched,
            remaining_to_plan: order.total_quantity_pending, // Same as pending
            fulfillment_percentage: order.fulfillment_percentage,
            total_value: order.total_value,
            is_overdue: order.is_overdue,
            payment_type: order.payment_type
          };
        });

        setClientOrders(transformedOrders);

        // Calculate client summary from the fetched orders
        if (transformedOrders.length > 0) {
          const summary = calculateClientSummary(transformedOrders);
          setClientSummary(summary);
        } else {
          setClientSummary({
            total_orders: 0,
            total_value: 0,
            total_quantity_kg: 0,
            completed_orders: 0,
            pending_orders: 0,
            completion_rate: 0,
            avg_order_value: 0,
            last_order_date: null,
            first_order_date: null,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching client orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate client summary from orders data
  const calculateClientSummary = (orders: ClientOrder[]): ClientSummary => {
    const total_orders = orders.length;
    const total_value = orders.reduce((sum, order) => sum + order.total_value, 0);
    const completed_orders = orders.filter(order => order.status === 'completed').length;
    const pending_orders = total_orders - completed_orders;
    const completion_rate = total_orders > 0 ? (completed_orders / total_orders) * 100 : 0;
    const avg_order_value = total_orders > 0 ? total_value / total_orders : 0;

    // Calculate total quantity in kg (approximate: 1 roll ≈ 13kg as per backend logic)
    const total_quantity_kg = orders.reduce((sum, order) => sum + (order.total_quantity_ordered * 13), 0);

    // Get first and last order dates
    const sortedOrders = orders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const first_order_date = sortedOrders.length > 0 ? sortedOrders[0].created_at : null;
    const last_order_date = sortedOrders.length > 0 ? sortedOrders[sortedOrders.length - 1].created_at : null;

    return {
      total_orders,
      total_value,
      total_quantity_kg,
      completed_orders,
      pending_orders,
      completion_rate,
      avg_order_value,
      first_order_date,
      last_order_date,
    };
  };

  // Fetch detailed order information
  const fetchOrderDetails = async (orderId: string) => {
    setLoadingOrderDetails(true);
    try {
      const url = REPORTS_ENDPOINTS.ORDER_ANALYSIS.ORDER_DETAILS(orderId);
      const response = await fetch(url, createRequestOptions('GET'));
      const result = await response.json();
      if (result.status === 'success') {
        setSelectedOrderDetails(result.data);
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  // Load clients on component mount
  useEffect(() => {
    fetchAvailableClients();
  }, []);

  // Fetch client orders when client or filters change
  useEffect(() => {
    if (selectedClient) {
      fetchClientOrders(selectedClient.id);
    }
  }, [selectedClient, startDate, endDate, statusFilter]);


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_process':
        return 'bg-blue-100 text-blue-800';
      case 'created':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-gray-100 text-gray-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Unified View - Always show client selector and orders below
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client-Order Analysis</h1>
          <p className="text-muted-foreground">
            Select a client to view their orders and detailed analysis
          </p>
        </div>

        {/* Client Selection - Always Visible */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Client
            </CardTitle>
            <CardDescription>
              Choose a client to analyze their order history and performance ({availableClients.length} clients available)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <label className="text-sm font-medium">Select Client</label>
              <Select
                value={selectedClient?.id || ""}
                onValueChange={(value) => {
                  if (value === "none") {
                    setSelectedClient(null);
                    return;
                  }
                  const client = availableClients.find(c => c.id === value);
                  if (client) {
                    setSelectedClient(client);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectSearch
                    placeholder="Search clients..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <SelectItem value="none">-- No Client Selected --</SelectItem>
                  {availableClients.length === 0 ? (
                    <SelectItem value="no-clients" disabled>No clients found</SelectItem>
                  ) : (
                    availableClients
                    .filter((client) => client.company_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                      (client.contact_person && client.contact_person.toLowerCase().includes(clientSearch.toLowerCase())))
                    .sort((a, b) => a.company_name.localeCompare(b.company_name))
                    .map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{client.company_name}</span>
                          {client.contact_person && (
                            <span className="text-xs text-muted-foreground">
                              Contact: {client.contact_person}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Show content based on client selection */}
        {!selectedClient ? (
          /* No Client Selected Message */
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <div className="text-lg font-medium text-muted-foreground mb-2">Please select a client</div>
                <div className="text-sm text-muted-foreground">
                  Choose a client from the dropdown above to view their order history and detailed analysis
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Client Orders Content */
          <>

            {/* Client Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Client Information - {selectedClient.company_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Contact Details</h4>
                    <div className="mt-2 space-y-1">
                      {selectedClient.contact_person && (
                        <div className="text-sm">Contact: {selectedClient.contact_person}</div>
                      )}
                      {selectedClient.phone && (
                        <div className="text-sm">Phone: {selectedClient.phone}</div>
                      )}
                      {selectedClient.email && (
                        <div className="text-sm">Email: {selectedClient.email}</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Business Details</h4>
                    <div className="mt-2 space-y-1">
                      {selectedClient.gst_number && (
                        <div className="text-sm">GST: <span className="font-mono">{selectedClient.gst_number}</span></div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Address</h4>
                    <div className="mt-2">
                      {selectedClient.address && (
                        <div className="text-sm">{selectedClient.address}</div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

        {/* Client Summary Cards */}
        {clientSummary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clientSummary.total_orders}</div>
                <p className="text-xs text-muted-foreground">
                  {clientSummary.completed_orders} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{clientSummary.total_value.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg: ₹{clientSummary.avg_order_value.toLocaleString()}/order
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clientSummary.total_quantity_kg.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">kg delivered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clientSummary.completion_rate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  {clientSummary.pending_orders} pending
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Order</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {clientSummary.last_order_date
                    ? new Date(clientSummary.last_order_date).toLocaleDateString('en-GB')
                    : 'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {clientSummary.first_order_date
                    ? `First: ${new Date(clientSummary.first_order_date).toLocaleDateString('en-GB')}`
                    : 'First order date unknown'
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Filter orders by date range and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectSearch
                      placeholder="Search status..."
                      value={statusSearch}
                      onChange={(e) => setStatusSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    {[
                      { value: 'all', label: 'All Statuses' },
                      { value: 'created', label: 'Created' },
                      { value: 'in_process', label: 'In Process' },
                      { value: 'completed', label: 'Completed' },
                      { value: 'cancelled', label: 'Cancelled' }
                    ]
                      .filter((item) => item.label.toLowerCase().includes(statusSearch.toLowerCase()))
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Orders ({clientOrders.length})
            </CardTitle>
            <CardDescription>
              Click on any order to view detailed breakdown and analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : clientOrders.length > 0 ? (
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Order ID</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Priority</th>
                        <th className="text-left p-3">Created Date</th>
                        <th className="text-left p-3">Ordered</th>
                        <th className="text-left p-3">Pending</th>
                        <th className="text-left p-3">Cut</th>
                        <th className="text-left p-3">In Dispatch</th>
                        <th className="text-left p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientOrders.map((order) => (
                        <tr key={order.order_id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div className="font-mono text-sm">{order.frontend_id || order.order_id}</div>
                          </td>
                          <td className="p-3">
                            <Badge className={getStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge className={getPriorityColor(order.priority || 'normal')}>
                              {order.priority || 'normal'}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="text-sm">{new Date(order.created_at).toLocaleDateString('en-GB')}</div>
                            {order.delivery_date && (
                              <div className={`text-xs ${order.is_overdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                                Due: {new Date(order.delivery_date).toLocaleDateString('en-GB')}
                                {order.is_overdue && ' ⚠️'}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="text-lg font-bold text-blue-600">{order.total_quantity_ordered || 0}</div>
                            <div className="text-xs text-muted-foreground">rolls</div>
                          </td>
                          <td className="p-3">
                            <div className="text-lg font-bold text-yellow-600">{order.total_quantity_pending || 0}</div>
                            <div className="text-xs text-muted-foreground">rolls</div>
                          </td>
                          <td className="p-3">
                            <div className="text-lg font-bold text-orange-600">{order.total_quantity_cut || 0}</div>
                            <div className="text-xs text-muted-foreground">rolls</div>
                          </td>
                          <td className="p-3">
                            <div className="text-lg font-bold text-green-600">{order.total_quantity_dispatched || 0}</div>
                            <div className="text-xs text-muted-foreground">rolls</div>
                          </td>
                          <td className="p-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Use frontend_id for the API call, fallback to order_id
                                const idToUse = order.frontend_id || order.order_id;
                                fetchOrderDetails(idToUse);
                                setIsOrderModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-2">No orders found</div>
                <div className="text-sm text-muted-foreground">
                  {statusFilter !== 'all' || startDate || endDate
                    ? 'Try adjusting your filters'
                    : 'This client has no orders yet'
                  }
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Details Modal (Same as in the original reports page) */}
        <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
              <DialogDescription>
                Complete breakdown of order information
              </DialogDescription>
            </DialogHeader>

            {loadingOrderDetails ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : selectedOrderDetails ? (
              <div className="space-y-6">
                {/* Order Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedOrderDetails.order_info?.frontend_id}</CardTitle>
                    <CardDescription>{selectedOrderDetails.client_info?.company_name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-lg font-bold">₹{(selectedOrderDetails.order_info?.total_value || 0).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Total Value</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{selectedOrderDetails.summary?.total_order_items || 0}</div>
                        <div className="text-xs text-muted-foreground">Total Items</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{(selectedOrderDetails.summary?.fulfillment_percentage || 0).toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">Dispatched Percent</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{selectedOrderDetails.summary?.total_pending_items || 0}</div>
                        <div className="text-xs text-muted-foreground">Pending Items</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Order Items */}
                {selectedOrderDetails.order_items && selectedOrderDetails.order_items.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Order Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3">Paper</th>
                              <th className="text-left p-3">Width</th>
                              <th className="text-left p-3">Ordered</th>
                              <th className="text-left p-3">Pending</th>
                              <th className="text-left p-3">Cut</th>
                              <th className="text-left p-3">In Dispatch</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrderDetails.order_items.map((item: any, index: any) => {
                              const pendingQuantity = selectedOrderDetails.pending_items
                                ?.filter((pendingItem: any) =>
                                  pendingItem.gsm === item.paper?.gsm &&
                                  pendingItem.bf === item.paper?.bf &&
                                  pendingItem.shade === item.paper?.shade &&
                                  pendingItem.width_inches === item.width_inches
                                )
                                .reduce((sum: number, pendingItem: any) => sum + (pendingItem.quantity_pending || 0), 0) || 0;

                              const cutQuantity = selectedOrderDetails.allocated_inventory
                                ?.filter((invItem: any) =>
                                  invItem.paper?.gsm === item.paper?.gsm &&
                                  invItem.paper?.bf === item.paper?.bf &&
                                  invItem.paper?.shade === item.paper?.shade &&
                                  invItem.width_inches === item.width_inches
                                )
                                .length || 0;

                              return (
                                <tr key={index} className="border-b">
                                  <td className="p-3">
                                    <div className="text-sm font-medium">{item.paper?.name || 'Unknown Paper'}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {item.paper?.gsm}GSM, {item.paper?.bf}BF, {item.paper?.shade}
                                    </div>
                                  </td>
                                  <td className="p-3">{item.width_inches}"</td>
                                  <td className="p-3">{item.quantity_rolls}</td>
                                  <td className="p-3">{pendingQuantity}</td>
                                  <td className="p-3">{cutQuantity}</td>
                                  <td className="p-3">{item.quantity_fulfilled}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Pending Items */}
                {selectedOrderDetails.pending_items && selectedOrderDetails.pending_items.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Pending Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3">Paper</th>
                              <th className="text-left p-3">Width</th>
                              <th className="text-left p-3">Quantity</th>
                              <th className="text-left p-3">Status</th>
                              <th className="text-left p-3">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrderDetails.pending_items.map((item: any, index: any) => (
                              <tr key={index} className="border-b">
                                <td className="p-3">
                                  <div className="text-sm font-medium">{item.paper_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.gsm}GSM, {item.bf}BF, {item.shade}
                                  </div>
                                </td>
                                <td className="p-3">{item.width_inches}"</td>
                                <td className="p-3">{item.quantity_rolls}</td>
                                <td className="p-3">
                                  <Badge className="bg-yellow-100 text-yellow-800">
                                    {item.status}
                                  </Badge>
                                </td>
                                <td className="p-3">{item.reason || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Dispatch Records */}
                {selectedOrderDetails.dispatch_records && selectedOrderDetails.dispatch_records.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Dispatch Records</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3">Dispatch ID</th>
                              <th className="text-left p-3">Vehicle</th>
                              <th className="text-left p-3">Driver</th>
                              <th className="text-left p-3">Date</th>
                              <th className="text-left p-3">Items</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrderDetails.dispatch_records.map((dispatch: any, index: any) => (
                              <tr key={index} className="border-b">
                                <td className="p-3 font-mono">{dispatch.dispatch_id}</td>
                                <td className="p-3">{dispatch.vehicle_number}</td>
                                <td className="p-3">
                                  <div>{dispatch.driver_name}</div>
                                  <div className="text-xs text-muted-foreground">{dispatch.driver_mobile}</div>
                                </td>
                                <td className="p-3">{dispatch.dispatch_date ? new Date(dispatch.dispatch_date).toLocaleDateString('en-GB') : 'N/A'}</td>
                                <td className="p-3">{dispatch.dispatched_items} items</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Timeline */}
                {selectedOrderDetails.timeline && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Created:</span>
                          <span className="text-sm">{selectedOrderDetails.timeline.created_days || 0} days ago</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Production Started:</span>
                          <span className="text-sm">{selectedOrderDetails.timeline.production_days || 'Not started'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Moved to Warehouse:</span>
                          <span className="text-sm">{selectedOrderDetails.timeline.warehouse_days || 'Not moved'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Dispatched:</span>
                          <span className="text-sm">{selectedOrderDetails.timeline.dispatch_days || 'Not dispatched'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Total Cycle Time:</span>
                          <span className="text-sm font-bold">{selectedOrderDetails.timeline.total_cycle_time || 'In progress'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-muted-foreground">No order details available</div>
              </div>
            )}
          </DialogContent>
        </Dialog>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
