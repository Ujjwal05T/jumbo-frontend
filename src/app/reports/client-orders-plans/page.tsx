"use client";

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Package, TrendingUp, Calendar, BarChart3, Zap, Search, Eye } from 'lucide-react';
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

type Plan = {
  plan_id: string;
  plan_frontend_id: string;
  name: string | null;
  plan_status: string;
  created_at: string;
  executed_at: string | null;
  completed_at: string | null;
  expected_waste_percentage: number;
  actual_waste_percentage: number | null;
  cut_pattern: any;
  wastage_allocations: any;
};

type OrderItem = {
  id: string;
  paper: {
    name: string;
    gsm: number;
    bf: number;
    shade: string;
  };
  width_inches: number;
  quantity_rolls: number;
  quantity_kg: number;
  rate: number;
  amount: number;
  quantity_fulfilled: number;
  item_status: string;
};

type OrderWithPlan = {
  order_id: string;
  frontend_id: string;
  status: string;
  priority: string;
  payment_type: string;
  delivery_date: string | null;
  created_at: string;
  is_overdue: boolean;
  total_items: number;
  total_quantity_ordered: number;
  total_quantity_fulfilled: number;
  fulfillment_percentage: number;
  total_value: number;
  order_items: OrderItem[];
  associated_plans: Plan[];
  total_plans: number;
};

type Summary = {
  total_orders: number;
  total_value: number;
  total_quantity_ordered: number;
  completed_orders: number;
  pending_orders: number;
  completion_rate: number;
  orders_with_plans: number;
  orders_without_plans: number;
  plan_coverage_rate: number;
};

type ClientInfo = {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  gst_number: string;
};

export default function ClientOrdersPlansPage() {
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [ordersData, setOrdersData] = useState<OrderWithPlan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

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

  // Fetch client orders with plans
  const fetchClientOrdersWithPlans = async () => {
    if (!selectedClient) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('client_id', selectedClient);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const url = `${REPORTS_ENDPOINTS.CLIENT_ORDERS_WITH_PLANS}?${params}`;
      const response = await fetch(url, createRequestOptions('GET'));
      const result = await response.json();

      if (result.status === 'success') {
        setOrdersData(result.data || []);
        setSummary(result.summary);
        setClientInfo(result.client_info);

        
      } else {
        console.error('API error:', result);
        setOrdersData([]);
        setSummary(null);
        setClientInfo(null);
      }
    } catch (error) {
      console.error('Error fetching client orders with plans:', error);
      setOrdersData([]);
      setSummary(null);
      setClientInfo(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = () => {
    if (selectedClient) {
      fetchClientOrdersWithPlans();
    }
  };

  // Reset search
  const handleReset = () => {
    setSelectedClient('');
    setStartDate('');
    setEndDate('');
    setOrdersData([]);
    setSummary(null);
    setClientInfo(null);
    setExpandedOrderId(null);
  };

  // Load clients on component mount
  useEffect(() => {
    fetchAvailableClients();
  }, []);

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

  const getPlanStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_production':
        return 'bg-blue-100 text-blue-800';
      case 'planned':
        return 'bg-purple-100 text-purple-800';
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Orders with Production Plans</h1>
          <p className="text-muted-foreground">
            Analyze client orders and their associated production plans with timeline filters
          </p>
        </div>

        {/* Search Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Filters
            </CardTitle>
            <CardDescription>
              Select client and date range to view orders with their production plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="text-sm font-medium">Select Client *</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClients.map((client) => (
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
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <div className="flex gap-2">
                <Button
                  onClick={handleSearch}
                  disabled={!selectedClient || loading}
                  className="flex-1"
                >
                  {loading ? 'Searching...' : 'Search'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Info & Summary */}
        {clientInfo && summary && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {clientInfo.company_name}
                </CardTitle>
                <CardDescription>
                  {clientInfo.contact_person && `Contact: ${clientInfo.contact_person}`}
                  {clientInfo.phone && ` | Phone: ${clientInfo.phone}`}
                  {clientInfo.gst_number && ` | GST: ${clientInfo.gst_number}`}
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.total_orders}</div>
                  <p className="text-xs text-muted-foreground">
                    {summary.completed_orders} completed, {summary.pending_orders} pending
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{summary.total_value.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {summary.total_quantity_ordered} rolls ordered
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Plan Coverage</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.plan_coverage_rate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {summary.orders_with_plans} with plans, {summary.orders_without_plans} without
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.completion_rate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    Order completion rate
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Orders List */}
        {ordersData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Orders with Plans ({ordersData.length})
              </CardTitle>
              <CardDescription>
                Click on any row to expand and view associated production plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Order ID</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Priority</th>
                        <th className="text-left p-3">Created Date</th>
                        <th className="text-left p-3">Delivery Date</th>
                        <th className="text-left p-3">Value</th>
                        <th className="text-left p-3">Progress</th>
                        <th className="text-left p-3">Planned</th>
                        <th className="text-left p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersData.map((order) => (
                        <>
                          <tr key={order.order_id} className="border-b hover:bg-muted/50">
                            <td className="p-3">
                              <div className="font-mono text-sm">{order.frontend_id}</div>
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
                              {new Date(order.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                              {order.delivery_date ? (
                                <div className={order.is_overdue ? 'text-red-600' : ''}>
                                  {new Date(order.delivery_date).toLocaleDateString()}
                                  {order.is_overdue && (
                                    <div className="text-xs text-red-600">⚠️ Overdue</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Not set</span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="font-medium">₹{order.total_value.toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">
                                {order.total_items} items
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      order.fulfillment_percentage === 100 ? 'bg-green-600' :
                                      order.fulfillment_percentage > 0 ? 'bg-blue-600' : 'bg-gray-400'
                                    }`}
                                    style={{ width: `${order.fulfillment_percentage || 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs">{order.fulfillment_percentage.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                
                                {order.total_plans > 0 ? (
                                  <span className="text-sm font-semibold text-green-600">Yes</span>
                                ) : (
                                  <span className="text-sm font-semibold text-red-600">No</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpandedOrderId(
                                  expandedOrderId === order.order_id ? null : order.order_id
                                )}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {expandedOrderId === order.order_id ? 'Hide' : 'View'}
                              </Button>
                            </td>
                          </tr>

                          {/* Expanded Details */}
                          {expandedOrderId === order.order_id && (
                            <tr>
                              <td colSpan={9} className="p-0">
                                <div className="bg-muted/30 p-4">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Order Items */}
                                    <div>
                                      <h4 className="font-medium mb-2">Order Items</h4>
                                      <div className="rounded-md border bg-white">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="border-b bg-muted/20">
                                              <th className="text-left p-2">Paper</th>
                                              <th className="text-left p-2">Width</th>
                                              <th className="text-left p-2">Qty</th>
                                              <th className="text-left p-2">Status</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {order.order_items.map((item) => (
                                              <tr key={item.id} className="border-b">
                                                <td className="p-2">
                                                  <div className="text-xs font-medium">{item.paper.name}</div>
                                                  <div className="text-xs text-muted-foreground">
                                                    {item.paper.gsm}GSM, {item.paper.bf}BF, {item.paper.shade}
                                                  </div>
                                                </td>
                                                <td className="p-2">{item.width_inches}"</td>
                                                <td className="p-2">
                                                  <div>{item.quantity_rolls} rolls</div>
                                                  <div className="text-muted-foreground">{item.quantity_kg.toFixed(1)}kg</div>
                                                </td>
                                                <td className="p-2">
                                                  <Badge variant="outline" className="text-xs">
                                                    {item.item_status}
                                                  </Badge>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>

                                    {/* Associated Plans */}
                                    <div>
                                      <h4 className="font-medium mb-2">
                                        Associated Plans
                                      </h4>
                                      {order.associated_plans.length > 0 ? (
                                        <div className="space-y-2">
                                          {order.associated_plans
                                          .filter((plan, index, self) => 
                                            index === self.findIndex(p => p.plan_id === plan.plan_id)
                                          )
                                          .map((plan) => (
                                          <div key={plan.plan_id} className="rounded-md border bg-white p-3">
                                            <div className="flex items-center justify-between mb-2">
                                            <div className="font-mono text-sm font-medium">
                                              {plan.plan_frontend_id}
                                            </div>
                                            <Badge className={getPlanStatusColor(plan.plan_status)}>
                                              {plan.plan_status}
                                            </Badge>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                              <span className="text-muted-foreground">Name:</span>
                                              <div className="font-medium">{plan.name || 'Unnamed Plan'}</div>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">Created:</span>
                                              <div className="font-medium">
                                              {new Date(plan.created_at).toLocaleDateString()}
                                              </div>
                                            </div>
                                            
                                            
                                            </div>
                                          </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="rounded-md border bg-white p-4 text-center text-muted-foreground">
                                          <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                          <div className="text-sm">No production plans yet</div>
                                          <div className="text-xs">This order hasn't been planned for production</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && ordersData.length === 0 && selectedClient && (
          <Card>
            <CardContent className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <div className="text-lg font-medium text-muted-foreground mb-2">No orders found</div>
              <div className="text-sm text-muted-foreground">
                {startDate || endDate
                  ? 'Try adjusting your date range filters'
                  : 'This client has no orders in the selected timeframe'
                }
              </div>
            </CardContent>
          </Card>
        )}

        {/* Initial State */}
        {!selectedClient && (
          <Card>
            <CardContent className="text-center py-8">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <div className="text-lg font-medium text-muted-foreground mb-2">Select client to get started</div>
              <div className="text-sm text-muted-foreground">
                Choose a client and optionally set date filters to view orders with their production plans
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}