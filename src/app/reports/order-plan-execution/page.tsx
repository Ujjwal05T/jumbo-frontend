"use client";

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Users, Package, TrendingUp, Calendar, BarChart3, FileText,
  CheckCircle, AlertTriangle, Download, Filter, Target, Activity
} from 'lucide-react';
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

type PendingItem = {
  id: string;
  paper_name: string;
  gsm: number;
  bf: number;
  shade: string;
  width_inches: number;
  pending_quantity: number;
  pending_weight: number;
  rate: number;
  pending_value: number;
};

type OrderPlanExecution = {
  order_id: string;
  order_frontend_id: string;
  order_date: string | null;
  delivery_date: string | null;
  order_status: string;
  priority: string;
  client_name: string;
  client_phone: string;
  client_gstin: string;

  // Main metrics requested
  total_rolls: number;
  cuts: number;
  pending: {
    total_rolls: number;
    details: PendingItem[];
  };
  plan_frontend_ids: string[];

  // Additional useful data
  total_items: number;
  total_weight_ordered: number;
  total_order_value: number;
  has_plan: boolean;
  is_overdue: boolean;
};

type OrderPlanSummary = {
  total_orders: number;
  orders_with_plans: number;
  orders_without_plans: number;
  plan_coverage_rate: number;
  total_rolls: number;
  total_cuts: number;
  total_pending_rolls: number;
  fulfillment_rate: number;
};

export default function OrderPlanExecutionPage() {
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [orderData, setOrderData] = useState<OrderPlanExecution[]>([]);
  const [summary, setSummary] = useState<OrderPlanSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planStatusFilter, setPlanStatusFilter] = useState('all');
  const [includeUnplanned, setIncludeUnplanned] = useState(true);

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

  // Fetch order plan execution data
  const fetchOrderPlanExecution = async () => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (selectedClient) params.append('client_id', selectedClient);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (planStatusFilter !== 'all') params.append('plan_status', planStatusFilter);
      params.append('include_unplanned', includeUnplanned.toString());
      params.append('limit', '1000');

      const response = await fetch(`${REPORTS_ENDPOINTS.ORDER_PLAN_EXECUTION}?${params}`, createRequestOptions('GET'));
      const result = await response.json();

      if (result.success && result.data) {
        setOrderData(result.data.orders || []);
        setSummary(result.data.summary);
      }
    } catch (error) {
      console.error('Error fetching order plan execution data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    try {
      // Build query parameters for export
      const params = new URLSearchParams();
      if (selectedClient) params.append('client_id', selectedClient);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (planStatusFilter !== 'all') params.append('plan_status', planStatusFilter);
      params.append('include_unplanned', includeUnplanned.toString());

      const response = await fetch(`${REPORTS_ENDPOINTS.ORDER_PLAN_EXECUTION}/export?${params}`, createRequestOptions('GET'));

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `order-plan-execution-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_process':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'created':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  
  // Filtered data
  const filteredData = useMemo(() => {
    return orderData.filter(order => {
      if (statusFilter !== 'all' && order.order_status !== statusFilter) return false;
      return true;
    });
  }, [orderData, statusFilter]);

  // Initial fetch
  useEffect(() => {
    fetchAvailableClients();
  }, []);

  // Auto-fetch when filters change
  useEffect(() => {
    if (availableClients.length > 0) {
      fetchOrderPlanExecution();
    }
  }, [selectedClient, startDate, endDate, statusFilter, planStatusFilter, includeUnplanned]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order-Plan Execution Report</h1>
            <p className="text-gray-600 mt-1">
              Comprehensive view of orders, their production plans, and execution status
            </p>
          </div>
          <Button onClick={exportToPDF} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Client Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {availableClients
                      .sort((a, b) => a.company_name.localeCompare(b.company_name))
                      .map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Order Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Order Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="in_process">In Process</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Plan Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan Status</label>
                <Select value={planStatusFilter} onValueChange={setPlanStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="optimized">Optimized</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Include Unplanned */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Options</label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-unplanned"
                    checked={includeUnplanned}
                    onCheckedChange={(checked) => setIncludeUnplanned(checked as boolean)}
                  />
                  <label htmlFor="include-unplanned" className="text-sm">
                    Include Unplanned
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total_orders}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.orders_with_plans} with plans ({summary.plan_coverage_rate}%)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Plan Coverage</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.plan_coverage_rate}%</div>
                <Progress value={summary.plan_coverage_rate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Rolls</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total_rolls}</div>
                <p className="text-xs text-muted-foreground">
                  Total rolls ordered
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cuts Completed</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total_cuts}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.fulfillment_rate}% fulfillment rate
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Orders and Plans</CardTitle>
            <CardDescription>
              Showing {filteredData.length} orders with their plan linkage and execution status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading order data...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No orders found matching the selected criteria</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Order Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-medium">Order ID</th>
                        <th className="text-left p-3 font-medium">Client</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-right p-3 font-medium">Total Rolls</th>
                        <th className="text-right p-3 font-medium">Cuts</th>
                        <th className="text-right p-3 font-medium">Pending</th>
                        <th className="text-left p-3 font-medium">Plan IDs</th>
                        <th className="text-center p-3 font-medium">Indicators</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((order) => (
                        <tr key={order.order_id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-mono text-xs">{order.order_frontend_id}</div>
                            {order.delivery_date && (
                              <div className={`text-xs ${order.is_overdue ? 'text-red-600' : 'text-gray-500'}`}>
                                Due: {new Date(order.delivery_date).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{order.client_name}</div>
                            <div className="text-xs text-gray-500">{order.client_gstin}</div>
                          </td>
                          <td className="p-3">
                            <Badge className={getStatusColor(order.order_status)}>
                              {order.order_status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="font-medium">{order.total_rolls}</div>
                            <div className="text-xs text-gray-500">₹{order.total_order_value.toLocaleString()}</div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="font-medium text-blue-600">{order.cuts}</div>
                            <div className="text-xs text-gray-500">
                              {order.total_rolls > 0 ? Math.round((order.cuts / order.total_rolls) * 100) : 0}%
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="font-medium text-orange-600">{order.pending.total_rolls}</div>
                            <div className="text-xs text-gray-500">
                              {order.total_rolls > 0 ? Math.round((order.pending.total_rolls / order.total_rolls) * 100) : 0}%
                            </div>
                          </td>
                          <td className="p-3">
                            {order.plan_frontend_ids.length > 0 ? (
                              <div className="space-y-1">
                                {order.plan_frontend_ids.slice(0, 3).map((planId, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="font-mono font-medium">{planId}</span>
                                  </div>
                                ))}
                                {order.plan_frontend_ids.length > 3 && (
                                  <div className="text-xs text-gray-500">
                                    +{order.plan_frontend_ids.length - 3} more
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-red-600">No Plans</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {order.has_plan && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Planned
                                </Badge>
                              )}
                              {order.is_overdue && (
                                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Overdue
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pending Details Section */}
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4">Pending Items Details</h3>
                  <div className="space-y-4">
                    {filteredData.filter(order => order.pending.details.length > 0).map((order) => (
                      <Card key={order.order_id} className="bg-orange-50 border-orange-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base">{order.order_frontend_id}</CardTitle>
                              <CardDescription className="text-xs">
                                {order.client_name} - {order.pending.total_rolls} rolls pending
                              </CardDescription>
                            </div>
                            <Badge className="bg-orange-100 text-orange-800">
                              Pending Items
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b bg-orange-100">
                                  <th className="text-left p-2 font-medium">Paper</th>
                                  <th className="text-left p-2 font-medium">Specs</th>
                                  <th className="text-left p-2 font-medium">Width</th>
                                  <th className="text-right p-2 font-medium">Quantity</th>
                                  <th className="text-right p-2 font-medium">Weight</th>
                                  <th className="text-right p-2 font-medium">Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.pending.details.map((item) => (
                                  <tr key={item.id} className="border-b">
                                    <td className="p-2">
                                      <div className="font-medium">{item.paper_name}</div>
                                    </td>
                                    <td className="p-2">
                                      <div className="text-xs">
                                        {item.gsm}GSM, {item.bf}BF, {item.shade}
                                      </div>
                                    </td>
                                    <td className="p-2">{item.width_inches}"</td>
                                    <td className="p-2 text-right">
                                      <div className="font-medium">{item.pending_quantity} rolls</div>
                                    </td>
                                    <td className="p-2 text-right">
                                      <div className="font-medium">-</div>
                                    </td>
                                    <td className="p-2 text-right">
                                      <div className="font-medium">-</div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {filteredData.filter(order => order.pending.details.length > 0).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p>No pending items found</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}