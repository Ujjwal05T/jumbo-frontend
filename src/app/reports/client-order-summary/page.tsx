"use client";

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSearch } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Users, Package, TrendingUp, Calendar, Filter, Eye, Loader2,
  CheckCircle, AlertTriangle, Box, Barcode, ChevronDown, ChevronUp, Printer
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
};

type PendingItem = {
  id: string;
  frontend_id: string;
  gsm: number;
  bf: number;
  shade: string;
  width_inches: number;
  quantity_pending: number;
  reason: string;
  status: string;
  created_at: string | null;
};

type LinkedPlan = {
  plan_id: string;
  plan_frontend_id: string;
  plan_name: string;
  status: string;
};

type OrderSummary = {
  order_id: string;
  order_frontend_id: string;
  order_date: string | null;
  delivery_date: string | null;
  status: string;
  priority: string;
  payment_type: string;
  total_rolls_ordered: number;
  total_cuts: number;
  total_weight_ordered: number;
  total_order_value: number;
  pending_items_count: number;
  pending_items: PendingItem[];
  linked_plans: LinkedPlan[];
  fulfillment_percentage: number;
  is_overdue: boolean;
};

type CutRoll = {
  id: string;
  frontend_id: string;
  barcode_id: string | null;
  plan_frontend_ids: string[];
  jumbo_barcode_id: string | null;
  width_inches: number;
  weight_kg: number;
  roll_type: string;
  status: string;
  location: string | null;
  production_date: string | null;
  created_at: string | null;
  paper: {
    name: string | null;
    gsm: number | null;
    bf: number | null;
    shade: string | null;
    type: string | null;
  } | null;
  parent_jumbo: {
    id: string;
    frontend_id: string;
    barcode_id: string | null;
  } | null;
  roll_sequence: number | null;
  individual_roll_number: number | null;
  is_dispatched: boolean;
  dispatch_info: {
    dispatch_id: string | null;
    dispatch_number: string | null;
    dispatch_date: string | null;
    vehicle_number: string | null;
    driver_name: string | null;
  } | null;
};

type CutRollsData = {
  order_info: {
    order_id: string;
    order_frontend_id: string;
    client_name: string | null;
    order_date: string | null;
    delivery_date: string | null;
    status: string;
  };
  cut_rolls: CutRoll[];
  mapping_summary: {
    total_cut_rolls: number;
    by_status: Record<string, number>;
    by_width: Record<string, number>;
    total_weight_kg: number;
  };
};

type ClientOrderSummaryData = {
  client: {
    id: string;
    company_name: string;
    gst_number: string | null;
    contact_person: string | null;
    phone: string | null;
  };
  orders: OrderSummary[];
  summary: {
    total_orders: number;
    total_rolls_ordered: number;
    total_cuts: number;
    total_pending_rolls: number;
    avg_fulfillment_rate: number;
  };
};

export default function ClientOrderSummaryPage() {
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [clientData, setClientData] = useState<ClientOrderSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cutRollsLoading, setCutRollsLoading] = useState(false);

  // Filters
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Search states for dropdowns
  const [clientSearch, setClientSearch] = useState('');
  const [statusSearch, setStatusSearch] = useState('');

  // Cut rolls modal state
  const [showCutRollsModal, setShowCutRollsModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [cutRollsData, setCutRollsData] = useState<CutRollsData | null>(null);
  const [barcodeSearch, setBarcodeSearch] = useState('');

  // Expanded rows state for pending items
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Local barcode transformation function (context-aware numbering with unique constraint)
  const transformJumboIdToDisplay = (barcode: string | null | undefined, allCutRolls: CutRoll[]): string => {
    if (!barcode || barcode === 'Unknown Jumbo') return barcode || '';
    if (barcode.startsWith('JR_')) return barcode;

    // Check for old format identifiers - more lenient pattern
    if (barcode.startsWith('VJB_') || barcode.startsWith('VJB') ||
        barcode.includes('VIRTUAL_JUMBO') || /^[A-F0-9]{8}$/i.test(barcode)) {

      // Get unique jumbo barcodes in order of first appearance
      const uniqueJumbos: string[] = [];
      allCutRolls.forEach(roll => {
        if (roll.jumbo_barcode_id && !uniqueJumbos.includes(roll.jumbo_barcode_id)) {
          uniqueJumbos.push(roll.jumbo_barcode_id);
        }
      });

      // Find the index of this barcode in the unique list
      const uniqueIndex = uniqueJumbos.indexOf(barcode);
      if (uniqueIndex !== -1) {
        return `JR_${String(uniqueIndex + 1).padStart(4, '0')}`;
      }
    }

    return barcode;
  };

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

  // Fetch client order summary
  const fetchClientOrderSummary = async () => {
    if (!selectedClient) {
      setClientData(null);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('client_id', selectedClient);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`${REPORTS_ENDPOINTS.CLIENT_ORDER_SUMMARY}?${params}`, createRequestOptions('GET'));
      const result = await response.json();

      if (result.success && result.data) {
        setClientData(result.data);
      }
    } catch (error) {
      console.error('Error fetching client order summary:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch cut rolls details for an order
  const fetchCutRollsDetails = async (orderFrontendId: string) => {
    setCutRollsLoading(true);
    try {
      const response = await fetch(
        REPORTS_ENDPOINTS.CLIENT_ORDER_CUT_ROLLS(orderFrontendId),
        createRequestOptions('GET')
      );
      const result = await response.json();

      if (result.success && result.data) {
        setCutRollsData(result.data);
      }
    } catch (error) {
      console.error('Error fetching cut rolls details:', error);
    } finally {
      setCutRollsLoading(false);
    }
  };

  // Handle view details click
  const handleViewDetails = async (order: OrderSummary) => {
    setSelectedOrder(order);
    setShowCutRollsModal(true);
    setCutRollsData(null);
    setBarcodeSearch('');
    await fetchCutRollsDetails(order.order_frontend_id);
  };

  // Toggle expanded row for pending items
  const toggleExpandRow = (orderId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(orderId)) {
      newExpandedRows.delete(orderId);
    } else {
      newExpandedRows.add(orderId);
    }
    setExpandedRows(newExpandedRows);
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

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Print cut rolls modal
  const printCutRollsModal = () => {
    if (!cutRollsData || !selectedOrder) {
      return;
    }

    // Create print window content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cut Rolls Details - ${selectedOrder.order_frontend_id}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            font-size: 12px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .order-info {
            display: flex;
            justify-content: space-around;
            margin-bottom: 20px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 5px;
          }
          .info-item {
            text-align: center;
          }
          .info-item .label {
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
          }
          .info-item .value {
            font-size: 14px;
            font-weight: bold;
            color: #333;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 20px;
          }
          .summary-card {
            padding: 15px;
            background: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .summary-card .title {
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .summary-card .value {
            font-size: 18px;
            font-weight: bold;
            color: #333;
          }
          .summary-card .details {
            font-size: 9px;
            color: #666;
            margin-top: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #4CAF50;
            color: white;
            font-weight: bold;
            font-size: 11px;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .barcode {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            color: #2563eb;
          }
          .plan-id {
            font-family: 'Courier New', monospace;
            color: #9333ea;
            font-size: 10px;
            display: inline-block;
            margin: 2px;
            padding: 2px 6px;
            background: #f3e8ff;
            border-radius: 3px;
          }
          .jumbo-barcode {
            font-family: 'Courier New', monospace;
            color: #22c55e;
            font-size: 10px;
          }
          .paper-info {
            font-size: 10px;
          }
          .paper-name {
            font-weight: bold;
          }
          .status-badge {
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
          }
          .status-available {
            background: #dcfce7;
            color: #166534;
          }
          .status-cutting {
            background: #dbeafe;
            color: #1e40af;
          }
          .status-allocated {
            background: #f3e8ff;
            color: #6b21a8;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 10px;
          }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Cut Rolls Details Report</h1>
          <p><strong>Order ID: ${selectedOrder.order_frontend_id}</strong></p>
          <p>Generated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="order-info">
          <div class="info-item">
            <div class="label">Client</div>
            <div class="value">${cutRollsData.order_info.client_name || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="label">Order Date</div>
            <div class="value">${formatDate(cutRollsData.order_info.order_date)}</div>
          </div>
          <div class="info-item">
            <div class="label">Status</div>
            <div class="value">${cutRollsData.order_info.status.replace('_', ' ')}</div>
          </div>
        </div>

        <div class="summary">
          <div class="summary-card">
            <div class="title">Total Cut Rolls</div>
            <div class="value">${cutRollsData.mapping_summary.total_cut_rolls}</div>
          </div>
          <div class="summary-card">
            <div class="title">Total Weight</div>
            <div class="value">${cutRollsData.mapping_summary.total_weight_kg} kg</div>
          </div>
          <div class="summary-card">
            <div class="title">By Status</div>
            <div class="details">
              ${Object.entries(cutRollsData.mapping_summary.by_status)
                .map(([status, count]) => `${status}: ${count}`)
                .join('<br/>')}
            </div>
          </div>
          <div class="summary-card">
            <div class="title">By Width</div>
            <div class="details">
              ${Object.entries(cutRollsData.mapping_summary.by_width)
                .slice(0, 5)
                .map(([width, count]) => `${width}": ${count}`)
                .join('<br/>')}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Cut Roll Barcode</th>
              <th style="width: 15%;">Plan IDs</th>
              <th style="width: 12%;">Jumbo Barcode</th>
              <th style="width: 8%;">Width</th>
              <th style="width: 10%;">Weight</th>
              <th style="width: 25%;">Paper Specifications</th>
              <th style="width: 10%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCutRolls.map((roll, index) => `
              <tr>
                <td>
                  <span class="barcode">${roll.barcode_id || 'N/A'}</span>
                </td>
                <td>
                  ${roll.plan_frontend_ids && roll.plan_frontend_ids.length > 0
                    ? roll.plan_frontend_ids.map(planId => `<span class="plan-id">${planId}</span>`).join(' ')
                    : 'N/A'
                  }
                </td>
                <td>
                  <span class="jumbo-barcode">
                    ${roll.jumbo_barcode_id ? transformJumboIdToDisplay(roll.jumbo_barcode_id, filteredCutRolls) : 'N/A'}
                  </span>
                </td>
                <td style="text-align: center;">${roll.width_inches}"</td>
                <td style="text-align: center;">${roll.weight_kg} kg</td>
                <td>
                  ${roll.paper
                    ? `<div class="paper-info">
                        <div class="paper-name">${roll.paper.name || 'N/A'}</div>
                        <div>${roll.paper.gsm}gsm, ${roll.paper.bf}bf, ${roll.paper.shade}</div>
                      </div>`
                    : 'N/A'
                  }
                </td>
                <td>
                  <span class="status-badge status-${roll.status.toLowerCase()}">
                    ${roll.status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Total Cut Rolls: ${filteredCutRolls.length} | Order: ${selectedOrder.order_frontend_id} | Client: ${cutRollsData.order_info.client_name || 'N/A'}</p>
          <p>Printed on: ${new Date().toLocaleString()}</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  // Filter cut rolls by barcode search
  const filteredCutRolls = cutRollsData?.cut_rolls.filter(roll =>
    !barcodeSearch || (roll.barcode_id && roll.barcode_id.toLowerCase().includes(barcodeSearch.toLowerCase()))
  ) || [];

  // Initial fetch
  useEffect(() => {
    fetchAvailableClients();
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    fetchClientOrderSummary();
  }, [selectedClient, startDate, endDate, statusFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Client Order Summary</h1>
            <p className="text-gray-600 mt-1">
              View detailed order information, pending items, and cut rolls for a specific client
            </p>
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Client Filter (Required) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Client *</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectSearch
                      placeholder="Search clients..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    {availableClients
                      .filter((client) => client.company_name.toLowerCase().includes(clientSearch.toLowerCase()))
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
                    <SelectSearch
                      placeholder="Search status..."
                      value={statusSearch}
                      onChange={(e) => setStatusSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    {[
                      { value: 'all', label: 'All Status' },
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

        {/* Summary Cards */}
        {clientData && (
          <>
            {/* Client Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Company Name</p>
                    <p className="font-semibold">{clientData.client.company_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">GST Number</p>
                    <p className="font-semibold">{clientData.client.gst_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Contact Person</p>
                    <p className="font-semibold">{clientData.client.contact_person || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-semibold">{clientData.client.phone || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Orders</p>
                      <p className="text-2xl font-bold">{clientData.summary.total_orders}</p>
                    </div>
                    <Package className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Rolls Ordered</p>
                      <p className="text-2xl font-bold">{clientData.summary.total_rolls_ordered}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Cuts</p>
                      <p className="text-2xl font-bold">{clientData.summary.total_cuts}</p>
                    </div>
                    <Box className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Pending Rolls</p>
                      <p className="text-2xl font-bold">{clientData.summary.total_pending_rolls}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Fulfillment Rate</p>
                      <p className="text-2xl font-bold">{clientData.summary.avg_fulfillment_rate}%</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-teal-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Orders Table */}
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </CardContent>
          </Card>
        ) : !selectedClient ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-gray-500">Please select a client to view orders</p>
            </CardContent>
          </Card>
        ) : clientData && clientData.orders.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Orders ({clientData.orders.length})</CardTitle>
              <CardDescription>
                Click the chevron icon to expand pending items & linked plans • Click "View Details" to see cut rolls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                        {/* Expand icon column */}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Rolls
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cuts
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pending
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Plans
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fulfillment
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clientData.orders.map((order) => (
                      <>
                        <tr key={order.order_id} className="hover:bg-gray-50">
                          <td className="px-2 py-4 whitespace-nowrap">
                            {(order.pending_items_count > 0 || order.linked_plans.length > 0) && (
                              <button
                                onClick={() => toggleExpandRow(order.order_id)}
                                className="text-gray-500 hover:text-gray-700 focus:outline-none"
                              >
                                {expandedRows.has(order.order_id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{order.order_frontend_id}</span>
                              {order.is_overdue && (
                                <Badge variant="destructive" className="text-xs">Overdue</Badge>
                              )}
                            </div>
                          </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(order.order_date)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Badge className={getStatusColor(order.status)}>
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.total_rolls_ordered}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.total_cuts}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900">{order.pending_items_count}</span>
                            {order.pending_items_count > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {order.pending_items.reduce((sum, item) => sum + item.quantity_pending, 0)} rolls
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {order.linked_plans.slice(0, 2).map((plan) => (
                              <Badge key={plan.plan_id} variant="outline" className="text-xs">
                                {plan.plan_frontend_id}
                              </Badge>
                            ))}
                            {order.linked_plans.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{order.linked_plans.length - 2}
                              </Badge>
                            )}
                            {order.linked_plans.length === 0 && (
                              <span className="text-sm text-gray-400">No plans</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{order.fulfillment_percentage}%</span>
                            <div className="w-20 h-2 bg-gray-200 rounded-full">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${order.fulfillment_percentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(order)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View Details
                          </Button>
                        </td>
                      </tr>

                      {/* Expanded row showing pending items and plans */}
                      {expandedRows.has(order.order_id) && (order.pending_items.length > 0 || order.linked_plans.length > 0) && (
                        <tr key={`${order.order_id}-expanded`} className="bg-blue-50">
                          <td colSpan={10} className="px-4 py-4">
                            <div className="space-y-4">
                              {/* Pending Items Section */}
                              {order.pending_items.length > 0 && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  <h4 className="font-semibold text-sm text-gray-900">
                                    Pending Order Items ({order.pending_items.length})
                                  </h4>
                                </div>
                                <div className="bg-white rounded-md border border-gray-200">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Item ID
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Paper Specs
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Width
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Qty Pending
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Reason
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Status
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Created At
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {order.pending_items.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                          <td className="px-3 py-3 whitespace-nowrap">
                                            <span className="font-mono text-xs text-blue-600">
                                              {item.frontend_id}
                                            </span>
                                          </td>
                                          <td className="px-3 py-3">
                                            <div className="text-xs">
                                              <span className="font-medium">{item.gsm}gsm</span>
                                              <span className="text-gray-500"> • {item.bf}bf</span>
                                              <span className="text-gray-500"> • {item.shade}</span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-3 whitespace-nowrap">
                                            <span className="text-xs">{item.width_inches}"</span>
                                          </td>
                                          <td className="px-3 py-3 whitespace-nowrap">
                                            <span className="font-semibold text-orange-600">
                                              {item.quantity_pending} rolls
                                            </span>
                                          </td>
                                          <td className="px-3 py-3 whitespace-nowrap">
                                            <Badge variant="outline" className="text-xs">
                                              {item.reason.replace(/_/g, ' ')}
                                            </Badge>
                                          </td>
                                          <td className="px-3 py-3 whitespace-nowrap">
                                            <Badge className={getStatusColor(item.status)} variant="outline">
                                              {item.status}
                                            </Badge>
                                          </td>
                                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                                            {formatDate(item.created_at)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              )}

                              {/* Linked Plans Section */}
                              {order.linked_plans.length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-purple-500" />
                                    <h4 className="font-semibold text-sm text-gray-900">
                                      Linked Production Plans ({order.linked_plans.length})
                                    </h4>
                                  </div>
                                  <div className="bg-white rounded-md border border-gray-200">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50 border-b">
                                        <tr>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                            Plan ID
                                          </th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                            Plan Name
                                          </th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                            Status
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {order.linked_plans.map((plan) => (
                                          <tr key={plan.plan_id} className="hover:bg-gray-50">
                                            <td className="px-3 py-3 whitespace-nowrap">
                                              <span className="font-mono text-xs text-purple-600 font-semibold">
                                                {plan.plan_frontend_id}
                                              </span>
                                            </td>
                                            <td className="px-3 py-3">
                                              <span className="text-xs text-gray-700">
                                                {plan.plan_name || 'N/A'}
                                              </span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap">
                                              <Badge className={getStatusColor(plan.status)} variant="outline">
                                                {plan.status.replace(/_/g, ' ')}
                                              </Badge>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : clientData && clientData.orders.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-gray-500">No orders found for this client</p>
            </CardContent>
          </Card>
        ) : null}

        {/* Cut Rolls Details Modal */}
        <Dialog open={showCutRollsModal} onOpenChange={setShowCutRollsModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <Barcode className="h-5 w-5" />
                    Cut Rolls Details - {selectedOrder?.order_frontend_id}
                  </DialogTitle>
                  <DialogDescription>
                    Detailed information about cut rolls linked to this order
                  </DialogDescription>
                </div>
                {cutRollsData && filteredCutRolls.length > 0 && (
                  <Button
                    onClick={printCutRollsModal}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                )}
              </div>
            </DialogHeader>

            {cutRollsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : cutRollsData ? (
              <div className="space-y-6">
                {/* Order Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Client</p>
                      <p className="font-semibold">{cutRollsData.order_info.client_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Order Date</p>
                      <p className="font-semibold">{formatDate(cutRollsData.order_info.order_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <Badge className={getStatusColor(cutRollsData.order_info.status)}>
                        {cutRollsData.order_info.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Mapping Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-500">Total Cut Rolls</p>
                      <p className="text-2xl font-bold">{cutRollsData.mapping_summary.total_cut_rolls}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-500">Total Weight</p>
                      <p className="text-2xl font-bold">{cutRollsData.mapping_summary.total_weight_kg} kg</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-500">By Status</p>
                      <div className="text-xs space-y-1 mt-2">
                        {Object.entries(cutRollsData.mapping_summary.by_status).map(([status, count]) => (
                          <div key={status} className="flex justify-between">
                            <span className="text-gray-500">{status}:</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-500">By Width</p>
                      <div className="text-xs space-y-1 mt-2">
                        {Object.entries(cutRollsData.mapping_summary.by_width).slice(0, 3).map(([width, count]) => (
                          <div key={width} className="flex justify-between">
                            <span className="text-gray-500">{width}":</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Barcode Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search by Barcode</label>
                  <Input
                    type="text"
                    placeholder="Enter barcode ID..."
                    value={barcodeSearch}
                    onChange={(e) => setBarcodeSearch(e.target.value)}
                    className="max-w-md"
                  />
                </div>

                {/* Cut Rolls Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cut Roll Barcode</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plan IDs</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jumbo Barcode</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Width</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paper</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredCutRolls.length > 0 ? (
                        filteredCutRolls.map((roll, index) => (
                          <tr key={roll.id} className="hover:bg-gray-50">
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="font-mono font-semibold text-blue-600">
                                {roll.barcode_id || 'N/A'}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {roll.plan_frontend_ids && roll.plan_frontend_ids.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {roll.plan_frontend_ids.map((planId, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs font-mono text-purple-600">
                                      {planId}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="font-mono text-xs text-green-600">
                                {roll.jumbo_barcode_id ? transformJumboIdToDisplay(roll.jumbo_barcode_id, filteredCutRolls) : 'N/A'}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {roll.width_inches}"
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {roll.weight_kg} kg
                            </td>
                            <td className="px-3 py-3">
                              {roll.paper ? (
                                <div className="text-xs">
                                  <div className="font-medium">{roll.paper.name}</div>
                                  <div className="text-gray-500">
                                    {roll.paper.gsm}gsm, {roll.paper.bf}bf, {roll.paper.shade}
                                  </div>
                                </div>
                              ) : (
                                'N/A'
                              )}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <Badge className={getStatusColor(roll.status)} variant="outline">
                                {roll.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                            {barcodeSearch ? 'No cut rolls found matching the search' : 'No cut rolls found'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500">No data available</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
