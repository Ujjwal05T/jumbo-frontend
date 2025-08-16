"use client";

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
          filteredData = result.data.filter((item: PaperReport) => item.paper_name === selectedPaper);
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

  // Effect to fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'paper') {
      fetchPaperReport();
    } else if (activeTab === 'client') {
      fetchClientReport();
    } else if (activeTab === 'date') {
      fetchDateReport();
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
        return date ? new Date(date).toLocaleDateString() : 'N/A';
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
        return new Date(date).toLocaleDateString();
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
          onClick={() => exportPaperToPDF(table)}
          size="sm"
          variant="outline"
        >
          Export PDF
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
          onClick={() => exportClientToPDF(table)}
          size="sm"
          variant="outline"
        >
          Export PDF
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
          onClick={() => exportDateToPDF(table)}
          size="sm"
          variant="outline"
        >
          Export PDF
        </Button>
      </div>
    ),
  });

  // PDF Export helper functions
  const exportPaperToPDF = (table: any) => {
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
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    
    autoTable(doc, {
      head: [['Paper Name', 'GSM', 'BF', 'Shade', 'Type', 'Orders', 'Quantity (Rolls)', 'Quantity (kg)', 'Total Value', 'Clients', 'Avg Order Value']],
      body: tableData,
      startY: 40,
    });

    doc.save('paper-analysis-report.pdf');
  };

  const exportClientToPDF = (table: any) => {
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
      row.original.last_order_date ? new Date(row.original.last_order_date).toLocaleDateString() : 'N/A',
      row.original.first_order_date ? new Date(row.original.first_order_date).toLocaleDateString() : 'N/A'
    ]);

    doc.setFontSize(18);
    doc.text('Client-wise Analysis Report', 20, 20);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    
    autoTable(doc, {
      head: [['Client Name', 'Client ID', 'GST Number', 'Contact Person', 'Orders', 'Quantity (Rolls)', 'Quantity (kg)', 'Total Value', 'Paper Types', 'Avg Order Value', 'Last Order', 'First Order']],
      body: tableData,
      startY: 40,
    });

    doc.save('client-analysis-report.pdf');
  };

  const exportDateToPDF = (table: any) => {
    const doc = new jsPDF();
    const tableData = table.getCoreRowModel().rows.map((row: any) => [
      new Date(row.original.date_period).toLocaleDateString(),
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
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    
    autoTable(doc, {
      head: [['Date', 'Orders', 'Quantity (Rolls)', 'Quantity (kg)', 'Total Value', 'Clients', 'Papers', 'Avg Order Value']],
      body: tableData,
      startY: 40,
    });

    doc.save('date-analysis-report.pdf');
  };

  // Chart export function (for chart view)
  const exportChartToPDF = () => {
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
              <Button onClick={exportChartToPDF} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Chart
              </Button>
            )}
          </div>
        </div>


        {/* Reports Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
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
                          availablePapers.map((paper) => (
                            <SelectItem key={paper.id} value={paper.name}>
                              {paper.name} - {paper.gsm}GSM
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
                  {selectedPaper ? `${selectedPaper} Analysis` : 'Paper-wise Analysis'}
                </CardTitle>
                <CardDescription>
                  {selectedPaper 
                    ? `Detailed analytics for ${selectedPaper}` 
                    : 'Analysis of orders grouped by paper types and specifications'
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
                        `Last order: ${new Date(clientData[0].last_order_date).toLocaleDateString()}` : 
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
                        new Date(dateData.reduce((max, item) => item.total_value > max.total_value ? item : max, dateData[0]).date_period).toLocaleDateString() :
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
                              tickFormatter={(date) => new Date(date).toLocaleDateString()}
                            />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip 
                              labelFormatter={(date) => new Date(date).toLocaleDateString()}
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
                              tickFormatter={(date) => new Date(date).toLocaleDateString()}
                            />
                            <YAxis domain={[0, 100]} />
                            <Tooltip 
                              labelFormatter={(date) => new Date(date).toLocaleDateString()}
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}