"use client";

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MaterialReactTable, useMaterialReactTable, MRT_ColumnDef } from 'material-react-table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { BarChart3, PieChart as PieChartIcon, Calendar, FileText, Download, Grid3X3, TrendingUp, Users, Package } from 'lucide-react';
import { REPORTS_ENDPOINTS, MASTER_ENDPOINTS, createRequestOptions } from '@/lib/api-config';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types for report data
type PaperReport = {
  paper_name: string;
  gsm: number;
  bf: number;
  shade: string;
  paper_type: string;
  total_orders: number;
  total_quantity_rolls: number;
  total_quantity_kg: number;
  total_value: number;
  unique_clients: number;
  avg_order_value: number;
  // Completion metrics
  completed_orders: number;
  pending_orders: number;
  completion_rate: number;
  total_quantity_fulfilled: number;
  fulfillment_rate: number;
  partially_completed_items: number;
};

type ClientReport = {
  client_name: string;
  client_id: string;
  gst_number: string;
  contact_person: string;
  total_orders: number;
  total_quantity_rolls: number;
  total_quantity_kg: number;
  total_value: number;
  unique_papers: number;
  avg_order_value: number;
  last_order_date: string;
  first_order_date: string;
  // Completion metrics
  completed_orders: number;
  pending_orders: number;
  completion_rate: number;
  total_quantity_fulfilled: number;
  fulfillment_rate: number;
  partially_completed_items: number;
};

type DateReport = {
  date_period: string;
  total_orders: number;
  total_quantity_rolls: number;
  total_quantity_kg: number;
  total_value: number;
  unique_clients: number;
  unique_papers: number;
  avg_order_value: number;
  // Completion metrics
  completed_orders: number;
  pending_orders: number;
  completion_rate: number;
  total_quantity_fulfilled: number;
  fulfillment_rate: number;
  partially_completed_items: number;
};

// Order Analysis types
type OrderStatusReport = {
  status: string;
  order_count: number;
  overdue_count: number;
  percentage: number;
};

type OrderFulfillmentReport = {
  order_id: string;
  client_name: string;
  order_status: string;
  priority: string;
  delivery_date: string | null;
  created_at: string;
  total_items: number;
  total_quantity_ordered: number;
  total_quantity_fulfilled: number;
  total_quantity_pending: number;
  remaining_to_plan: number;
  fulfillment_percentage: number;
  total_value: number;
  is_overdue: boolean;
};

type OrderTimelineReport = {
  order_id: string;
  client_name: string;
  status: string;
  created_at: string;
  started_production_at: string | null;
  moved_to_warehouse_at: string | null;
  dispatched_at: string | null;
  delivery_date: string | null;
  days_to_production: number | null;
  days_in_production: number | null;
  days_in_warehouse: number | null;
  total_cycle_time: number | null;
};

type PendingOrderReport = {
  order_id: string;
  client_name: string;
  order_status: string;
  pending_items_count: number;
  total_pending_quantity: number;
  pending_reasons: string;
  first_pending_date: string | null;
  latest_pending_date: string | null;
  days_pending: number;
};

type DispatchTrackingReport = {
  order_id: string;
  client_name: string;
  order_status: string;
  dispatch_id: string;
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  dispatch_date: string | null;
  dispatch_number: string;
  dispatched_items: number;
  dispatched_weight: number;
  dispatch_status: string;
};

type OverdueOrderReport = {
  order_id: string;
  client_name: string;
  status: string;
  priority: string;
  delivery_date: string | null;
  created_at: string;
  days_overdue: number;
  total_quantity_ordered: number;
  total_quantity_fulfilled: number;
  fulfillment_percentage: number;
  total_value: number;
};

type DetailedOrderBreakdown = {
  order_id: string;
  client_name: string;
  order_status: string;
  created_at: string;
  delivery_date: string | null;
  total_items: number;
  total_ordered: number;
  total_fulfilled: number;
  total_pending: number;
  total_value: number;
  overall_fulfillment: number;
  items: {
    item_id: string;
    paper_name: string;
    gsm: number;
    bf: number;
    shade: string;
    width_inches: number;
    ordered_quantity: number;
    quantity_fulfilled: number;
    quantity_in_pending: number;
    remaining_to_plan: number;
    item_status: string;
    fulfillment_percentage: number;
    rate: number;
    amount: number;
  }[];
};

type ViewMode = 'grid' | 'chart';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('paper');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [groupBy, setGroupBy] = useState('day');

  // Paper Analysis specific state
  const [selectedPaper, setSelectedPaper] = useState('');
  const [availablePapers, setAvailablePapers] = useState<any[]>([]);

  // Client Analysis specific state
  const [selectedClient, setSelectedClient] = useState('');
  const [availableClients, setAvailableClients] = useState<any[]>([]);

  // Data states
  const [paperData, setPaperData] = useState<PaperReport[]>([]);
  const [clientData, setClientData] = useState<ClientReport[]>([]);
  const [dateData, setDateData] = useState<DateReport[]>([]);
  const [loading, setLoading] = useState(false);

  // Order Analysis state
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  // Fetch available papers for dropdown
  const fetchAvailablePapers = async () => {
    try {
      console.log('Fetching papers from:', MASTER_ENDPOINTS.PAPERS);
      const response = await fetch(`${MASTER_ENDPOINTS.PAPERS}`, createRequestOptions('GET'));
      const result = await response.json();
      console.log('Papers API response:', result);
      
      if (result.status === 'success' && result.data) {
        setAvailablePapers(result.data);
        console.log('Available papers set:', result.data);
      } else if (Array.isArray(result)) {
        // Handle case where API returns array directly
        setAvailablePapers(result);
        console.log('Available papers set (direct array):', result);
      }
    } catch (error) {
      console.error('Error fetching papers:', error);
    }
  };

  // Fetch available clients for dropdown
  const fetchAvailableClients = async () => {
    try {
      console.log('Fetching clients from:', MASTER_ENDPOINTS.CLIENTS);
      const response = await fetch(`${MASTER_ENDPOINTS.CLIENTS}`, createRequestOptions('GET'));
      console.log('Clients response status:', response.status);
      
      if (!response.ok) {
        console.error('Clients API error:', response.status, response.statusText);
        return;
      }
      
      const result = await response.json();
      console.log('Clients API response:', result);
      console.log('Response type:', typeof result);
      console.log('Is array:', Array.isArray(result));
      
      if (result && result.status === 'success' && result.data) {
        setAvailableClients(result.data);
        console.log('Available clients set (success format):', result.data);
      } else if (Array.isArray(result)) {
        // Handle case where API returns array directly
        setAvailableClients(result);
        console.log('Available clients set (direct array):', result);
      } else if (result && Array.isArray(result.clients)) {
        // Handle case where API returns {clients: [...]}
        setAvailableClients(result.clients);
        console.log('Available clients set (clients property):', result.clients);
      } else {
        console.log('Unexpected response format, trying to use result directly');
        console.log('Result keys:', Object.keys(result || {}));
        if (result) {
          setAvailableClients([]);
        }
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  // Fetch data functions
  const fetchPaperReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (status && status !== 'all') params.append('status', status);

      const url = `${REPORTS_ENDPOINTS.PAPER_WISE}?${params}`;
      const response = await fetch(url, createRequestOptions('GET'));
      const result = await response.json();
      if (result.status === 'success') {
        // Filter data if a specific paper is selected
        let filteredData = result.data;
        if (selectedPaper && selectedPaper !== 'all' && selectedPaper !== '') {
          try {
            const selectedPaperObj = JSON.parse(selectedPaper);
            filteredData = result.data.filter((item: PaperReport) => 
              item.paper_name === selectedPaperObj.name &&
              item.gsm === selectedPaperObj.gsm &&
              item.bf === selectedPaperObj.bf &&
              item.shade === selectedPaperObj.shade
            );
          } catch (error) {
            // Fallback to name-only filtering for backward compatibility
            filteredData = result.data.filter((item: PaperReport) => item.paper_name === selectedPaper);
          }
        }
        setPaperData(filteredData);
      }
    } catch (error) {
      console.error('Error fetching paper report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (status && status !== 'all') params.append('status', status);

      const url = `${REPORTS_ENDPOINTS.CLIENT_WISE}?${params}`;
      const response = await fetch(url, createRequestOptions('GET'));
      const result = await response.json();
      if (result.status === 'success') {
        // Filter data if a specific client is selected
        let filteredData = result.data;
        if (selectedClient && selectedClient !== 'all' && selectedClient !== '') {
          filteredData = result.data.filter((item: ClientReport) => item.client_name === selectedClient);
        }
        setClientData(filteredData);
      }
    } catch (error) {
      console.error('Error fetching client report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDateReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (status && status !== 'all') params.append('status', status);
      params.append('group_by', groupBy);

      const url = `${REPORTS_ENDPOINTS.DATE_WISE}?${params}`;
      const response = await fetch(url, createRequestOptions('GET'));
      const result = await response.json();
      if (result.status === 'success') {
        setDateData(result.data);
      }
    } catch (error) {
      console.error('Error fetching date report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Effect to load papers and clients on mount
  useEffect(() => {
    fetchAvailablePapers();
    fetchAvailableClients();
  }, []);

  // Fetch orders list for Order Analysis
  const fetchOrdersList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (status && status !== 'all') params.append('status', status);

      const url = `${REPORTS_ENDPOINTS.ORDER_ANALYSIS.ORDERS_LIST}?${params}`;
      const response = await fetch(url, createRequestOptions('GET'));
      const result = await response.json();
      setOrdersList(result);
    } catch (error) {
      console.error('Error fetching orders list:', error);
    } finally {
      setLoading(false);
    }
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

  // Effect to fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'paper') {
      fetchPaperReport();
    } else if (activeTab === 'client') {
      fetchClientReport();
    } else if (activeTab === 'date') {
      fetchDateReport();
    } else if (activeTab === 'order') {
      fetchOrdersList();
    }
  }, [activeTab, startDate, endDate, status, groupBy, selectedPaper, selectedClient]);

  // Material React Table columns
  const paperColumns = useMemo<MRT_ColumnDef<PaperReport>[]>(() => [
    {
      accessorKey: 'paper_name',
      header: 'Paper Name',
      size: 250,
      Cell: ({ row }) => {
        const data = row.original;
        return `${data.paper_name} (${data.gsm}GSM, ${data.bf}BF, ${data.shade})`;
      },
    },
    {
      accessorKey: 'total_orders',
      header: 'Orders',
      size: 100,
    },
    {
      accessorKey: 'total_quantity_kg',
      header: 'Quantity (kg)',
      size: 120,
      Cell: ({ cell }) => cell.getValue<number>().toFixed(2),
    },
    {
      accessorKey: 'total_value',
      header: 'Total Value',
      size: 120,
      Cell: ({ cell }) => `₹${cell.getValue<number>().toLocaleString()}`,
    },
    {
      accessorKey: 'unique_clients',
      header: 'Clients',
      size: 100,
    },
    {
      accessorKey: 'avg_order_value',
      header: 'Avg Order Value',
      size: 140,
      Cell: ({ cell }) => `₹${cell.getValue<number>().toLocaleString()}`,
    },
    {
      accessorKey: 'completed_orders',
      header: 'Completed',
      size: 100,
    },
  ], []);

  const clientColumns = useMemo<MRT_ColumnDef<ClientReport>[]>(() => [
    {
      accessorKey: 'client_name',
      header: 'Client Name',
      size: 200,
    },
    {
      accessorKey: 'client_id',
      header: 'Client ID',
      size: 100,
    },
    {
      accessorKey: 'total_orders',
      header: 'Orders',
      size: 100,
    },
    {
      accessorKey: 'total_quantity_kg',
      header: 'Quantity (kg)',
      size: 120,
      Cell: ({ cell }) => cell.getValue<number>().toFixed(2),
    },
    {
      accessorKey: 'total_value',
      header: 'Total Value',
      size: 120,
      Cell: ({ cell }) => `₹${cell.getValue<number>().toLocaleString()}`,
    },
    {
      accessorKey: 'unique_papers',
      header: 'Paper Types',
      size: 120,
    },
    {
      accessorKey: 'last_order_date',
      header: 'Last Order',
      size: 120,
      Cell: ({ cell }) => {
        const date = cell.getValue<string>();
        return date ? new Date(date).toLocaleDateString('en-GB') : 'N/A';
      },
    },
    {
      accessorKey: 'completed_orders',
      header: 'Completed',
      size: 100,
    },
    {
      accessorKey: 'completion_rate',
      header: 'Completion %',
      size: 120,
      Cell: ({ cell }) => `${cell.getValue<number>().toFixed(1)}%`,
    },
    {
      accessorKey: 'fulfillment_rate',
      header: 'Fulfillment %',
      size: 120,
      Cell: ({ cell }) => `${cell.getValue<number>().toFixed(1)}%`,
    },
  ], []);

  const dateColumns = useMemo<MRT_ColumnDef<DateReport>[]>(() => [
    {
      accessorKey: 'date_period',
      header: 'Date',
      size: 120,
      Cell: ({ cell }) => {
        const date = cell.getValue<string>();
        return new Date(date).toLocaleDateString('en-GB');
      },
    },
    {
      accessorKey: 'total_orders',
      header: 'Orders',
      size: 100,
    },
    {
      accessorKey: 'total_quantity_kg',
      header: 'Quantity (kg)',
      size: 120,
      Cell: ({ cell }) => cell.getValue<number>().toFixed(2),
    },
    {
      accessorKey: 'total_value',
      header: 'Total Value',
      size: 120,
      Cell: ({ cell }) => `₹${cell.getValue<number>().toLocaleString()}`,
    },
    {
      accessorKey: 'unique_clients',
      header: 'Clients',
      size: 100,
    },
    {
      accessorKey: 'unique_papers',
      header: 'Papers',
      size: 100,
    },
    {
      accessorKey: 'avg_order_value',
      header: 'Avg Order Value',
      size: 140,
      Cell: ({ cell }) => `₹${cell.getValue<number>().toLocaleString()}`,
    },
    {
      accessorKey: 'completed_orders',
      header: 'Completed',
      size: 100,
    },
    {
      accessorKey: 'completion_rate',
      header: 'Completion %',
      size: 120,
      Cell: ({ cell }) => `${cell.getValue<number>().toFixed(1)}%`,
    },
    {
      accessorKey: 'fulfillment_rate',
      header: 'Fulfillment %',
      size: 120,
      Cell: ({ cell }) => `${cell.getValue<number>().toFixed(1)}%`,
    },
  ], []);

  // Material React Table instances
  const paperTable = useMaterialReactTable({
    columns: paperColumns,
    data: paperData,
    enableSorting: true,
    enableGlobalFilter: true,
    enablePagination: true,
    enableRowSelection: false,
    enableColumnOrdering: true,
    initialState: { pagination: { pageSize: 10 , pageIndex: 0} },
    renderTopToolbarCustomActions: ({ table }) => (
      <div className="flex gap-2">
        <Button
          onClick={() => {
            // Export CSV functionality
            const csvData = table.getCoreRowModel().rows.map(row => 
              paperColumns.reduce((acc, col) => {
                const key = col.accessorKey as keyof PaperReport;
                acc[col.header as string] = row.original[key];
                return acc;
              }, {} as any)
            );
            const csv = [
              paperColumns.map(col => col.header).join(','),
              ...csvData.map(row => Object.values(row).join(','))
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'paper-analysis.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
          size="sm"
          variant="outline"
        >
          Export CSV
        </Button>
        <Button
          onClick={() => printPaperToPDF(table)}
          size="sm"
          variant="outline"
        >
          Print PDF
        </Button>
      </div>
    ),
  });

  const clientTable = useMaterialReactTable({
    columns: clientColumns,
    data: clientData,
    enableSorting: true,
    enableGlobalFilter: true,
    enablePagination: true,
    enableRowSelection: false,
    enableColumnOrdering: true,
    initialState: { pagination: { pageSize: 10 , pageIndex: 0 } },
    renderTopToolbarCustomActions: ({ table }) => (
      <div className="flex gap-2">
        <Button
          onClick={() => {
            // Export CSV functionality
            const csvData = table.getCoreRowModel().rows.map(row => 
              clientColumns.reduce((acc, col) => {
                const key = col.accessorKey as keyof ClientReport;
                acc[col.header as string] = row.original[key];
                return acc;
              }, {} as any)
            );
            const csv = [
              clientColumns.map(col => col.header).join(','),
              ...csvData.map(row => Object.values(row).join(','))
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'client-analysis.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
          size="sm"
          variant="outline"
        >
          Export CSV
        </Button>
        <Button
          onClick={() => printClientToPDF(table)}
          size="sm"
          variant="outline"
        >
          Print PDF
        </Button>
      </div>
    ),
  });

  const dateTable = useMaterialReactTable({
    columns: dateColumns,
    data: dateData,
    enableSorting: true,
    enableGlobalFilter: true,
    enablePagination: true,
    enableRowSelection: false,
    enableColumnOrdering: true,
    initialState: { pagination: { pageSize: 10 , pageIndex: 0} },
    renderTopToolbarCustomActions: ({ table }) => (
      <div className="flex gap-2">
        <Button
          onClick={() => {
            // Export CSV functionality
            const csvData = table.getCoreRowModel().rows.map(row => 
              dateColumns.reduce((acc, col) => {
                const key = col.accessorKey as keyof DateReport;
                acc[col.header as string] = row.original[key];
                return acc;
              }, {} as any)
            );
            const csv = [
              dateColumns.map(col => col.header).join(','),
              ...csvData.map(row => Object.values(row).join(','))
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'date-analysis.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
          size="sm"
          variant="outline"
        >
          Export CSV
        </Button>
        <Button
          onClick={() => printDateToPDF(table)}
          size="sm"
          variant="outline"
        >
          Print PDF
        </Button>
      </div>
    ),
  });

  // PDF Print helper functions
  const openPDFForPrint = (doc: any, filename: string) => {
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    URL.revokeObjectURL(url);
  };
  const printPaperToPDF = (table: any) => {
    const doc = new jsPDF();
    const tableData = table.getCoreRowModel().rows.map((row: any) => [
      row.original.paper_name,
      row.original.gsm,
      row.original.bf,
      row.original.shade,
      row.original.paper_type,
      row.original.total_orders,
      row.original.total_quantity_rolls,
      row.original.total_quantity_kg.toFixed(2),
      row.original.total_value.toFixed(2),
      row.original.unique_clients,
      row.original.avg_order_value.toFixed(2)
    ]);

    doc.setFontSize(18);
    doc.text('Paper-wise Analysis Report', 20, 20);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, 20, 30);
    
    autoTable(doc, {
      head: [['Paper Name', 'GSM', 'BF', 'Shade', 'Type', 'Orders', 'Quantity (Rolls)', 'Quantity (kg)', 'Total Value', 'Clients', 'Avg Order Value']],
      body: tableData,
      startY: 40,
    });

    openPDFForPrint(doc, 'paper-analysis-report.pdf');
  };

  const printClientToPDF = (table: any) => {
    const doc = new jsPDF();
    const tableData = table.getCoreRowModel().rows.map((row: any) => [
      row.original.client_name,
      row.original.client_id,
      row.original.gst_number || 'N/A',
      row.original.contact_person || 'N/A',
      row.original.total_orders,
      row.original.total_quantity_rolls,
      row.original.total_quantity_kg.toFixed(2),
      row.original.total_value.toFixed(2),
      row.original.unique_papers,
      row.original.avg_order_value.toFixed(2),
      row.original.last_order_date ? new Date(row.original.last_order_date).toLocaleDateString('en-GB') : 'N/A',
      row.original.first_order_date ? new Date(row.original.first_order_date).toLocaleDateString('en-GB') : 'N/A'
    ]);

    doc.setFontSize(18);
    doc.text('Client-wise Analysis Report', 20, 20);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, 20, 30);
    
    autoTable(doc, {
      head: [['Client Name', 'Client ID', 'GST Number', 'Contact Person', 'Orders', 'Quantity (Rolls)', 'Quantity (kg)', 'Total Value', 'Paper Types', 'Avg Order Value', 'Last Order', 'First Order']],
      body: tableData,
      startY: 40,
    });

    openPDFForPrint(doc, 'client-analysis-report.pdf');
  };

  const printDateToPDF = (table: any) => {
    const doc = new jsPDF();
    const tableData = table.getCoreRowModel().rows.map((row: any) => [
      new Date(row.original.date_period).toLocaleDateString('en-GB'),
      row.original.total_orders,
      row.original.total_quantity_rolls,
      row.original.total_quantity_kg.toFixed(2),
      row.original.total_value.toFixed(2),
      row.original.unique_clients,
      row.original.unique_papers,
      row.original.avg_order_value.toFixed(2)
    ]);

    doc.setFontSize(18);
    doc.text('Date-wise Analysis Report', 20, 20);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, 20, 30);
    
    autoTable(doc, {
      head: [['Date', 'Orders', 'Quantity (Rolls)', 'Quantity (kg)', 'Total Value', 'Clients', 'Papers', 'Avg Order Value']],
      body: tableData,
      startY: 40,
    });

    openPDFForPrint(doc, 'date-analysis-report.pdf');
  };

  // Chart export function (for chart view)
  const printChartToPDF = () => {
    // For chart view, we'll use html2canvas to capture the chart
    // This is a simple implementation - you could enhance it further
    alert('Chart export functionality can be added using html2canvas library');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive reports and analytics for paper, client, and date-wise analysis
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Grid
            </Button>
            <Button
              variant={viewMode === 'chart' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('chart')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Chart
            </Button>
            {viewMode === 'chart' && (
              <Button onClick={printChartToPDF} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Chart
              </Button>
            )}
          </div>
        </div>


        {/* Reports Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="paper" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Paper Analysis
            </TabsTrigger>
            <TabsTrigger value="client" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Client Analysis
            </TabsTrigger>
            <TabsTrigger value="date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date Analysis
            </TabsTrigger>
            <TabsTrigger value="order" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Order Analysis
            </TabsTrigger>
          </TabsList>

          {/* Paper Analysis */}
          <TabsContent value="paper" className="space-y-4">
            {/* Paper Selection Filter */}
            <Card>
              <CardHeader>
                <CardTitle>Paper Selection</CardTitle>
                <CardDescription>
                  Select a specific paper to view detailed analytics ({availablePapers.length} papers available)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Select Paper</label>
                    <Select value={selectedPaper} onValueChange={setSelectedPaper}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Papers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Papers</SelectItem>
                        {availablePapers.length === 0 ? (
                          <SelectItem value="none" disabled>No papers found</SelectItem>
                        ) : (
                          availablePapers.sort((a, b) => a.gsm - b.gsm).map((paper) => (
                            <SelectItem key={paper.id} value={JSON.stringify({name: paper.name, gsm: paper.gsm, bf: paper.bf, shade: paper.shade})}>
                              {paper.name} - {paper.gsm}GSM - {paper.bf}BF - {paper.shade}
                            </SelectItem>
                          ))
                        )}
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
                </div>
              </CardContent>
            </Card>

            {/* Paper Details Summary (when a specific paper is selected) */}
            {selectedPaper && selectedPaper !== 'all' && selectedPaper !== '' && paperData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{paperData[0]?.total_orders || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      From {paperData[0]?.unique_clients || 0} clients
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
                      ₹{paperData[0]?.total_value.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Avg: ₹{paperData[0]?.avg_order_value.toLocaleString() || 0}/order
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{paperData[0]?.total_quantity_rolls || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {paperData[0]?.total_quantity_kg.toFixed(2) || 0} kg total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Paper Specs</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{paperData[0]?.gsm}GSM</div>
                    <p className="text-xs text-muted-foreground">
                      BF: {paperData[0]?.bf} | {paperData[0]?.shade}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Order Completion</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{paperData[0]?.completion_rate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">
                      {paperData[0]?.completed_orders || 0} / {paperData[0]?.total_orders || 0} completed
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Main Analysis Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {selectedPaper && selectedPaper !== 'all' && selectedPaper !== '' ? 
                    (() => {
                      try {
                        const paperObj = JSON.parse(selectedPaper);
                        return `${paperObj.name} Analysis`;
                      } catch {
                        return `${selectedPaper} Analysis`;
                      }
                    })() : 'Paper-wise Analysis'}
                </CardTitle>
                <CardDescription>
                  {selectedPaper && selectedPaper !== 'all' && selectedPaper !== '' ? 
                    (() => {
                      try {
                        const paperObj = JSON.parse(selectedPaper);
                        return `Detailed analytics for ${paperObj.name} (${paperObj.gsm}GSM, ${paperObj.bf}BF, ${paperObj.shade})`;
                      } catch {
                        return `Detailed analytics for ${selectedPaper}`;
                      }
                    })() : 'Analysis of orders grouped by paper types and specifications'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {viewMode === 'grid' ? (
                  <MaterialReactTable table={paperTable} />
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Value by Paper Type</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={paperData.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="paper_name" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Total Value']} />
                            <Bar dataKey="total_value" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Completion Rate by Paper</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={paperData.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="paper_name" angle={-45} textAnchor="end" height={100} />
                            <YAxis domain={[0, 100]} />
                            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Completion Rate']} />
                            <Bar dataKey="completion_rate" fill="#82ca9d" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Orders Distribution</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={paperData.slice(0, 8)}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ paper_name, percent }) => `${paper_name} (${(percent! * 100).toFixed(0)}%)`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="total_orders"
                            >
                              {paperData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Order Status Distribution</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={[
                                {
                                  name: 'Completed',
                                  value: paperData.reduce((sum, item) => sum + item.completed_orders, 0),
                                  fill: '#00C49F'
                                },
                                {
                                  name: 'Pending',
                                  value: paperData.reduce((sum, item) => sum + item.pending_orders, 0),
                                  fill: '#FF8042'
                                }
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} (${(percent! * 100).toFixed(0)}%)`}
                              outerRadius={80}
                              dataKey="value"
                            >
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client Analysis */}
          <TabsContent value="client" className="space-y-4">
            {/* Client Selection Filter */}
            <Card>
              <CardHeader>
                <CardTitle>Client Selection</CardTitle>
                <CardDescription>
                  Select a specific client to view detailed analytics ({availableClients.length} clients available)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Select Client</label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Clients</SelectItem>
                        {availableClients.length === 0 ? (
                          <SelectItem value="none" disabled>No clients found</SelectItem>
                        ) : (
                          availableClients.map((client) => (
                            <SelectItem key={client.id} value={client.company_name}>
                              {client.company_name}
                            </SelectItem>
                          ))
                        )}
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
                </div>
              </CardContent>
            </Card>

            {/* Client Details Summary (when a specific client is selected) */}
            {selectedClient && selectedClient !== 'all' && selectedClient !== '' && clientData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{clientData[0]?.total_orders || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {clientData[0]?.unique_papers || 0} different paper types
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
                      ₹{clientData[0]?.total_value.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Avg: ₹{clientData[0]?.avg_order_value.toLocaleString() || 0}/order
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{clientData[0]?.total_quantity_rolls || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {clientData[0]?.total_quantity_kg.toFixed(2) || 0} kg total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Client Info</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{clientData[0]?.client_id}</div>
                    <p className="text-xs text-muted-foreground">
                      {clientData[0]?.last_order_date ? 
                        `Last order: ${new Date(clientData[0].last_order_date).toLocaleDateString('en-GB')}` : 
                        'No recent orders'
                      }
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Order Completion</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{clientData[0]?.completion_rate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">
                      {clientData[0]?.completed_orders || 0} / {clientData[0]?.total_orders || 0} completed
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Main Analysis Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {selectedClient && selectedClient !== 'all' ? `${selectedClient} Analysis` : 'Client-wise Analysis'}
                </CardTitle>
                <CardDescription>
                  {selectedClient && selectedClient !== 'all'
                    ? `Detailed analytics for ${selectedClient}` 
                    : 'Analysis of orders grouped by client companies'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {viewMode === 'grid' ? (
                  <MaterialReactTable table={clientTable} />
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Value by Client</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={clientData.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="client_name" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Total Value']} />
                            <Bar dataKey="total_value" fill="#82ca9d" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Completion Rate by Client</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={clientData.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="client_name" angle={-45} textAnchor="end" height={100} />
                            <YAxis domain={[0, 100]} />
                            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Completion Rate']} />
                            <Bar dataKey="completion_rate" fill="#ff7300" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Orders by Client</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={clientData.slice(0, 8)}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ client_name, percent }) => `${client_name} (${(percent! * 100).toFixed(0)}%)`}
                              outerRadius={80}
                              fill="#82ca9d"
                              dataKey="total_orders"
                            >
                              {clientData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Client Order Status Distribution</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={[
                                {
                                  name: 'Completed',
                                  value: clientData.reduce((sum, item) => sum + item.completed_orders, 0),
                                  fill: '#00C49F'
                                },
                                {
                                  name: 'Pending',
                                  value: clientData.reduce((sum, item) => sum + item.pending_orders, 0),
                                  fill: '#FF8042'
                                }
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} (${(percent! * 100).toFixed(0)}%)`}
                              outerRadius={80}
                              dataKey="value"
                            >
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Date Analysis */}
          <TabsContent value="date" className="space-y-4">
            {/* Date Analysis Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Date Analysis Filters</CardTitle>
                <CardDescription>
                  Configure date range and grouping for time-based analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <label className="text-sm font-medium">Group By</label>
                    <Select value={groupBy} onValueChange={setGroupBy}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Daily</SelectItem>
                        <SelectItem value="week">Weekly</SelectItem>
                        <SelectItem value="month">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Order Status</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="created">Created</SelectItem>
                        <SelectItem value="in_process">In Process</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Date Analysis Summary Cards */}
            {dateData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Periods</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dateData.length}</div>
                    <p className="text-xs text-muted-foreground">
                      {groupBy === 'day' ? 'Days' : groupBy === 'week' ? 'Weeks' : 'Months'} analyzed
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {dateData.reduce((sum, item) => sum + item.total_orders, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Avg: {Math.round(dateData.reduce((sum, item) => sum + item.total_orders, 0) / dateData.length)} per {groupBy}
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
                      ₹{dateData.reduce((sum, item) => sum + item.total_value, 0).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Avg: ₹{Math.round(dateData.reduce((sum, item) => sum + item.total_value, 0) / dateData.length).toLocaleString()} per {groupBy}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Peak Period</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">
                      {dateData.length > 0 ? 
                        new Date(dateData.reduce((max, item) => item.total_value > max.total_value ? item : max, dateData[0]).date_period).toLocaleDateString('en-GB') :
                        'N/A'
                      }
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Highest value period
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {dateData.length > 0 ? 
                        (dateData.reduce((sum, item) => sum + item.completion_rate, 0) / dateData.length).toFixed(1) :
                        0
                      }%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Average across all periods
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Main Analysis Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Date-wise Analysis ({groupBy === 'day' ? 'Daily' : groupBy === 'week' ? 'Weekly' : 'Monthly'})
                </CardTitle>
                <CardDescription>
                  Analysis of orders grouped by {groupBy === 'day' ? 'daily' : groupBy === 'week' ? 'weekly' : 'monthly'} time periods
                  {startDate && endDate && ` from ${startDate} to ${endDate}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {viewMode === 'grid' ? (
                  <MaterialReactTable table={dateTable} />
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Value & Orders Trends</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={dateData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date_period" 
                              tickFormatter={(date) => new Date(date).toLocaleDateString('en-GB')}
                            />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip 
                              labelFormatter={(date) => new Date(date).toLocaleDateString('en-GB')}
                              formatter={(value, name) => [
                                name === 'total_value' ? `₹${Number(value).toLocaleString()}` : value,
                                name === 'total_value' ? 'Total Value' : 'Orders'
                              ]}
                            />
                            <Line yAxisId="left" type="monotone" dataKey="total_orders" stroke="#8884d8" strokeWidth={2} />
                            <Line yAxisId="right" type="monotone" dataKey="total_value" stroke="#82ca9d" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Completion Rate Trends</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={dateData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date_period" 
                              tickFormatter={(date) => new Date(date).toLocaleDateString('en-GB')}
                            />
                            <YAxis domain={[0, 100]} />
                            <Tooltip 
                              labelFormatter={(date) => new Date(date).toLocaleDateString('en-GB')}
                              formatter={(value, name) => [
                                `${Number(value).toFixed(1)}%`,
                                name === 'completion_rate' ? 'Completion Rate' : 'Fulfillment Rate'
                              ]}
                            />
                            <Line type="monotone" dataKey="completion_rate" stroke="#ff7300" strokeWidth={2} />
                            <Line type="monotone" dataKey="fulfillment_rate" stroke="#8884d8" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Order Analysis */}
          <TabsContent value="order" className="space-y-4">
            {/* Order Analysis Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Order Analysis</CardTitle>
                <CardDescription>
                  View all orders with detailed breakdown. Click on any order to see complete details.
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
                    <label className="text-sm font-medium">Order Status</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="created">Created</SelectItem>
                        <SelectItem value="in_process">In Process</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
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
                  Orders List
                </CardTitle>
                <CardDescription>
                  Click on any order to view detailed breakdown with all information
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : ordersList.length > 0 ? (
                  <div className="rounded-md border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3">Order ID</th>
                            <th className="text-left p-3">Client</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-left p-3">Priority</th>
                            <th className="text-left p-3">Progress</th>
                            <th className="text-left p-3">Value</th>
                            <th className="text-left p-3">Delivery Date</th>
                            <th className="text-left p-3">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ordersList.map((order) => (
                            <tr key={order.order_id} className="border-b hover:bg-muted/50">
                              <td className="p-3 font-mono">{order.order_id}</td>
                              <td className="p-3">{order.client_name}</td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  order.status === 'in_process' ? 'bg-blue-100 text-blue-800' :
                                  order.status === 'created' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  order.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                  order.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {order.priority || 'normal'}
                                </span>
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
                                  <span className="text-xs">{(order.fulfillment_percentage || 0).toFixed(0)}%</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {order.total_quantity_fulfilled || 0}/{order.total_quantity_ordered || 0} rolls
                                </div>
                              </td>
                              <td className="p-3">₹{(order.total_value || 0).toLocaleString()}</td>
                              <td className="p-3">
                                {order.delivery_date ? (
                                  <div className={order.is_overdue ? 'text-red-600' : ''}>
                                    {new Date(order.delivery_date).toLocaleDateString('en-GB')}
                                    {order.is_overdue && <span className="block text-xs">⚠️ Overdue</span>}
                                  </div>
                                ) : 'N/A'}
                              </td>
                              <td className="p-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    fetchOrderDetails(order.order_id);
                                    setIsOrderModalOpen(true);
                                  }}
                                >
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
                    <div className="text-sm text-muted-foreground">Try adjusting your filters or check back later</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Details Modal */}
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
                                  <th className="text-left p-3">Dispatched</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedOrderDetails.order_items.map((item:any, index:any) => {
                                  // Calculate pending quantity from pending items
                                  const pendingQuantity = selectedOrderDetails.pending_items
                                    ?.filter((pendingItem: any) =>
                                      pendingItem.gsm === item.paper?.gsm &&
                                      pendingItem.bf === item.paper?.bf &&
                                      pendingItem.shade === item.paper?.shade &&
                                      pendingItem.width_inches === item.width_inches
                                    )
                                    .reduce((sum: number, pendingItem: any) => sum + (pendingItem.quantity_pending || 0), 0) || 0;

                                  // Calculate cut quantity from allocated inventory
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
                                {selectedOrderDetails.pending_items.map((item:any, index:any) => (
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
                                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                                        {item.status}
                                      </span>
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
                                {selectedOrderDetails.dispatch_records.map((dispatch:any, index:any) => (
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


          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
