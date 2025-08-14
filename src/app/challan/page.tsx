/**
 * Challan page - Manage packing slips, cash challans, and bills
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Truck,
  Search,
  MoreHorizontal,
  Eye,
  Download,
  Calendar,
  User,
  Loader2,
  RefreshCw,
  FileText,
  Package,
  MapPin,
  Phone,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  TrendingUp,
  Receipt,
  Banknote,
  ScrollText,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-config";
import { generatePackingSlipPDF, convertDispatchToPackingSlip } from "@/lib/packing-slip-pdf";
import { 
  generateCashChallanPDF, 
  generateBillInvoicePDF, 
  convertOrdersToChallanData 
} from "@/lib/challan-pdf";

interface DispatchRecord {
  id: string;
  frontend_id: string;
  dispatch_number: string;
  reference_number: string;
  dispatch_date: string;
  client: {
    id: string;
    company_name: string;
    contact_person: string;
    mobile?: string;
    email?: string;
    address?: string;
  };
  primary_order?: {
    id: string;
    order_number: string;
  };
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  payment_type: string;
  status: string;
  total_items: number;
  total_weight_kg: number;
  created_by: {
    id: string;
    name: string;
  };
  created_at: string;
  delivered_at?: string;
  items_count: number;
}

interface DispatchDetails {
  id: string;
  frontend_id: string;
  dispatch_number: string;
  reference_number: string;
  dispatch_date: string;
  order_date?: string;
  client: {
    id: string;
    company_name: string;
    contact_person: string;
    mobile: string;
    email: string;
    address: string;
  };
  primary_order?: {
    id: string;
    order_number: string;
    quantity_rolls: number;
    width_inches: number;
  };
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  payment_type: string;
  status: string;
  total_items: number;
  total_weight_kg: number;
  created_by: {
    id: string;
    name: string;
    username: string;
  };
  created_at: string;
  delivered_at?: string;
  items: Array<{
    id: string;
    frontend_id: string;
    qr_code: string;
    barcode_id: string;
    width_inches: number;
    weight_kg: number;
    paper_spec: string;
    status: string;
    dispatched_at: string;
  }>;
}

interface DispatchStats {
  summary: {
    total_dispatches: number;
    total_items_dispatched: number;
    total_weight_kg: number;
  };
  status_breakdown: Record<string, number>;
  payment_type_breakdown: Record<string, number>;
  recent_dispatches: Array<{
    id: string;
    dispatch_number: string;
    client_name: string;
    total_items: number;
    dispatch_date: string;
  }>;
}

export default function ChallanPage() {
  const [activeTab, setActiveTab] = useState("packing-slip");
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(20);

  // Details modal
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchDetails | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<DispatchStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Clients for filter
  const [clients, setClients] = useState<any[]>([]);

  // Cash tab state
  const [cashSelectedClient, setCashSelectedClient] = useState("all");
  const [cashOrders, setCashOrders] = useState<any[]>([]);
  const [cashOrdersLoading, setCashOrdersLoading] = useState(false);

  // Bill tab state
  const [billSelectedClient, setBillSelectedClient] = useState("all");
  const [billOrders, setBillOrders] = useState<any[]>([]);
  const [billOrdersLoading, setBillOrdersLoading] = useState(false);
  
  // Bill amount modal state
  const [billAmountModalOpen, setBillAmountModalOpen] = useState(false);
  const [selectedOrderForBill, setSelectedOrderForBill] = useState<any>(null);
  const [billInvoiceAmount, setBillInvoiceAmount] = useState<string>("");

  const loadDispatches = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('skip', ((currentPage - 1) * limit).toString());
      params.append('limit', limit.toString());
      
      if (clientFilter && clientFilter !== 'all') params.append('client_id', clientFilter);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const response = await fetch(`${API_BASE_URL}/dispatch/history?${params.toString()}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to load dispatch history');
      const data = await response.json();

      setDispatches(data.dispatches || []);
      setTotalCount(data.total_count || 0);
      setTotalPages(data.total_pages || 1);
      setCurrentPage(data.current_page || 1);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dispatch history';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      const response = await fetch(`${API_BASE_URL}/dispatch/stats?${params.toString()}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to load stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/clients`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (!response.ok) throw new Error('Failed to load clients');
      const data = await response.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const loadDispatchDetails = async (dispatchId: string) => {
    try {
      setDetailsLoading(true);
      const response = await fetch(`${API_BASE_URL}/dispatch/${dispatchId}/details`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to load dispatch details');
      const data = await response.json();
      setSelectedDispatch(data);
      setDetailsModalOpen(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dispatch details';
      toast.error(errorMessage);
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateDispatchStatus = async (dispatchId: string, newStatus: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/${dispatchId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update status');
      const data = await response.json();
      
      toast.success(data.message);
      await loadDispatches();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(errorMessage);
    }
  };

  const downloadPDF = async (dispatchId: string, dispatchNumber: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/${dispatchId}/pdf`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `dispatch_${dispatchNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('PDF downloaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download PDF';
      toast.error(errorMessage);
    }
  };

  const downloadPackingSlip = async (dispatchId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/${dispatchId}/details`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to fetch dispatch details');
      
      const dispatchData = await response.json();
      const packingSlipData = convertDispatchToPackingSlip(dispatchData);
      generatePackingSlipPDF(packingSlipData);
      
      toast.success('Packing slip downloaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate packing slip';
      toast.error(errorMessage);
    }
  };

  const loadOrdersForClient = async (clientId: string, tabType: 'cash' | 'bill') => {
    if (clientId === 'all') {
      if (tabType === 'cash') {
        setCashOrders([]);
      } else {
        setBillOrders([]);
      }
      return;
    }

    try {
      if (tabType === 'cash') {
        setCashOrdersLoading(true);
      } else {
        setBillOrdersLoading(true);
      }

      const response = await fetch(`${API_BASE_URL}/orders?client_id=${clientId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to load orders');
      const data = await response.json();
      console.log(data)
      
      if (tabType === 'cash') {
        setCashOrders(data || []);
      } else {
        setBillOrders(data || []);
      }
    } catch (err) {
      console.error(`Error loading orders for ${tabType}:`, err);
      toast.error(`Failed to load orders for client`);
    } finally {
      if (tabType === 'cash') {
        setCashOrdersLoading(false);
      } else {
        setBillOrdersLoading(false);
      }
    }
  };

  useEffect(() => {
    loadClients(); // Load clients for all tabs
    if (activeTab === "packing-slip") {
      loadStats();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "packing-slip") {
      loadDispatches();
    }
  }, [currentPage, statusFilter, clientFilter, fromDate, toDate, searchTerm, activeTab]);

  useEffect(() => {
    if (activeTab === "packing-slip") {
      loadStats();
    }
  }, [fromDate, toDate, activeTab]);

  useEffect(() => {
    if (cashSelectedClient !== 'all') {
      loadOrdersForClient(cashSelectedClient, 'cash');
    }
  }, [cashSelectedClient]);

  useEffect(() => {
    if (billSelectedClient !== 'all') {
      loadOrdersForClient(billSelectedClient, 'bill');
    }
  }, [billSelectedClient]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'dispatched':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Dispatched</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Delivered</Badge>;
      case 'returned':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Returned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentTypeBadge = (paymentType: string) => {
    switch (paymentType) {
      case 'bill':
        return <Badge variant="outline">Bill</Badge>;
      case 'cash':
        return <Badge className="bg-green-100 text-green-800">Cash</Badge>;
      default:
        return <Badge variant="outline">{paymentType}</Badge>;
    }
  };

  // Helper functions for order item calculations (similar to Order Master page)
  const getTotalQuantity = (order: any) => {
    return order.order_items?.reduce((sum: number, item: any) => sum + item.quantity_rolls, 0) || 0;
  };

  const getFulfilledQuantity = (order: any) => {
    return order.order_items?.reduce((sum: number, item: any) => sum + item.quantity_fulfilled, 0) || 0;
  };

  const getOrderWidths = (order: any) => {
    return order.order_items?.map((item: any) => `${item.width_inches}"`).join(", ") || "N/A";
  };

  const getOrderPapers = (order: any) => {
    const papers = order.order_items?.map((item: any) => item.paper?.name).filter(Boolean) || [];
    return papers.length > 0 ? papers.join(", ") : "N/A";
  };

  const getTotalAmount = (order: any) => {
    return order.order_items?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0;
  };

  // PDF generation handlers
  const handleGenerateCashChallan = async (order: any) => {
    try {

      // Fetch dispatch information for the order
      let dispatchInfo = null;
      try {
        const response = await fetch(
          `${API_BASE_URL}/reports/order/${order.id}/challan-with-dispatch`,
          {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          }
        );
        if (response.ok) {
          const data = await response.json();
          dispatchInfo = data.data.dispatch;
          console.log("Fetched dispatch info:", dispatchInfo);
        }
      } catch (err) {
        console.warn("Could not fetch dispatch info:", err);
      }

      // Convert to challan data format with dispatch info
      const challanData = convertOrdersToChallanData([order], 'cash', dispatchInfo);
      
      // Generate PDF
      generateCashChallanPDF(challanData);
      
      toast.success("Cash challan PDF generated successfully");
    } catch (error) {
      console.error("Error generating cash challan PDF:", error);
      toast.error("Failed to generate cash challan PDF");
    }
  };

  const handleGenerateBillInvoice = async () => {
    try {
      if (!selectedOrderForBill) {
        toast.error("No order selected");
        return;
      }

      if (!billInvoiceAmount || parseFloat(billInvoiceAmount) <= 0) {
        toast.error("Please enter a valid invoice amount");
        return;
      }

      const targetFinalAmount = parseFloat(billInvoiceAmount);
      
      // Calculate taxable amount from final amount (remove 12% GST: 6% CGST + 6% SGST)
      const gstRate = 0.12; // 12% total GST
      const targetTaxableAmount = targetFinalAmount / (1 + gstRate);
      
      // Adjust the single order's amounts
      const orderItemsOriginalAmount = selectedOrderForBill.order_items.reduce((sum: number, item: any) => sum + item.amount, 0);
      
      const adjustedOrderItems = selectedOrderForBill.order_items.map((item: any) => {
        const itemRatio = item.amount / orderItemsOriginalAmount;
        const adjustedTaxableAmount = targetTaxableAmount * itemRatio;
        
        // Calculate new rate based on adjusted amount and original quantity
        const originalQuantity = item.quantity_kg || (item.quantity_rolls * 50); // Use kg if available, else estimate from rolls
        const adjustedRate = originalQuantity > 0 ? adjustedTaxableAmount / originalQuantity : 0;
        
        return {
          ...item,
          amount: adjustedTaxableAmount,
          rate: adjustedRate,
          // Keep original quantities unchanged
          quantity_rolls: item.quantity_rolls,
          quantity_kg: item.quantity_kg
        };
      });
      
      const adjustedOrder = {
        ...selectedOrderForBill,
        order_items: adjustedOrderItems
      };

      // Fetch dispatch information for the order
      let dispatchInfo = null;
      try {
        const response = await fetch(
          `${API_BASE_URL}/reports/order/${selectedOrderForBill.id}/challan-with-dispatch`,
          {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          }
        );
        if (response.ok) {
          const data = await response.json();
          dispatchInfo = data.data.dispatch;
          console.log("Fetched dispatch info:", dispatchInfo);
        }
      } catch (err) {
        console.warn("Could not fetch dispatch info:", err);
      }

      // Convert to challan data format with dispatch info using adjusted amounts
      const challanData = convertOrdersToChallanData([adjustedOrder], 'bill', dispatchInfo);
      
      // Generate PDF
      generateBillInvoicePDF(challanData);
      
      toast.success("GST Tax Invoice PDF generated successfully");
      
      // Close modal and reset state
      setBillAmountModalOpen(false);
      setSelectedOrderForBill(null);
      setBillInvoiceAmount("");
    } catch (error) {
      console.error("Error generating tax invoice PDF:", error);
      toast.error("Failed to generate tax invoice PDF");
    }
  };

  const handleOpenBillAmountModal = (order: any) => {
    setSelectedOrderForBill(order);
    setBillInvoiceAmount("");
    setBillAmountModalOpen(true);
  };

  const renderPackingSlipTab = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Packing Slips</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary.total_dispatches}</div>
              <p className="text-xs text-muted-foreground">
                {fromDate || toDate ? 'In selected period' : 'All time'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Items Dispatched</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.summary.total_items_dispatched}
              </div>
              <p className="text-xs text-muted-foreground">Total cut rolls</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.summary.total_weight_kg.toFixed(1)}kg
              </div>
              <p className="text-xs text-muted-foreground">Total dispatched</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.status_breakdown.delivered || 0}
              </div>
              <p className="text-xs text-muted-foreground">Successfully delivered</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
          <CardDescription>
            Filter packing slip records by date range, status, client, or search terms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Dispatch #, driver, vehicle..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            {/* To Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            {/* Reset Button */}
            <div className="space-y-2">
              <label className="text-sm font-medium">&nbsp;</label>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setClientFilter("all");
                  setFromDate("");
                  setToDate("");
                  setCurrentPage(1);
                }}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Packing Slip Records Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Packing Slip Records</CardTitle>
              <CardDescription>
                {totalCount} packing slip records found
              </CardDescription>
            </div>
            <Button onClick={loadDispatches} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispatch #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Vehicle & Driver</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      <div className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading packing slip records...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : dispatches.length > 0 ? (
                  dispatches.map((dispatch) => (
                    <TableRow key={dispatch.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{dispatch.dispatch_number}</div>
                          {dispatch.reference_number && (
                            <div className="text-xs text-muted-foreground">
                              Ref: {dispatch.reference_number}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {new Date(dispatch.dispatch_date).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(dispatch.dispatch_date).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{dispatch.client.company_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {dispatch.client.contact_person}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            {dispatch.vehicle_number}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {dispatch.driver_name}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {dispatch.driver_mobile}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <div className="font-medium">{dispatch.total_items}</div>
                          <div className="text-xs text-muted-foreground">items</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <div className="font-medium">{dispatch.total_weight_kg.toFixed(1)}kg</div>
                          <div className="text-xs text-muted-foreground">total</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPaymentTypeBadge(dispatch.payment_type)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(dispatch.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => loadDispatchDetails(dispatch.id)}
                              disabled={detailsLoading}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => downloadPDF(dispatch.id, dispatch.dispatch_number)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => downloadPackingSlip(dispatch.id)}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Download Packing Slip
                            </DropdownMenuItem>
                            {dispatch.status === 'dispatched' && (
                              <DropdownMenuItem
                                className="text-green-600"
                                onClick={() => updateDispatchStatus(dispatch.id, 'delivered')}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Delivered
                              </DropdownMenuItem>
                            )}
                            {dispatch.status === 'dispatched' && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => updateDispatchStatus(dispatch.id, 'returned')}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Mark as Returned
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      <div className="text-center py-4">
                        <div className="text-muted-foreground">
                          <p className="font-medium">No packing slip records found</p>
                          <p className="text-sm">Try adjusting your filters or search terms</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderCashTab = () => (
    <div className="space-y-6">
      {/* Client Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5" />
            Cash Challan Generation
          </CardTitle>
          <CardDescription>
            Select client to view their orders for cash challan generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Client</label>
              <Select value={cashSelectedClient} onValueChange={setCashSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select Client</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      {cashSelectedClient !== 'all' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Orders for Selected Client</CardTitle>
                <CardDescription>
                  Generate cash challan PDF for individual orders
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cashOrdersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Loading orders...
              </div>
            ) : cashOrders.length > 0 ? (
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
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashOrders.map((order) => (
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
                              Due: {new Date(order.delivery_date).toLocaleDateString()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleGenerateCashChallan(order)}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Generate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No Orders Found
                </h3>
                <p className="text-sm text-muted-foreground">
                  This client doesn't have any orders yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {/* Instructions */}
      {cashSelectedClient === 'all' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Banknote className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Select Client
              </h3>
              <p className="text-sm text-muted-foreground">
                Choose a client to view their orders and generate cash challans
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderBillTab = () => (
    <div className="space-y-6">
      {/* Client Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5" />
            Bill/Invoice Generation
          </CardTitle>
          <CardDescription>
            Select client to view their orders for bill/invoice generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Client</label>
              <Select value={billSelectedClient} onValueChange={setBillSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select Client</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      {billSelectedClient !== 'all' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Orders for Selected Client</CardTitle>
                <CardDescription>
                  Generate bill/invoice PDF for individual orders
                </CardDescription>
              </div>
              
            </div>
          </CardHeader>
          <CardContent>
            {billOrdersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Loading orders...
              </div>
            ) : billOrders.length > 0 ? (
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
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billOrders.map((order) => (
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
                              Due: {new Date(order.delivery_date).toLocaleDateString()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleOpenBillAmountModal(order)}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Generate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No Orders Found
                </h3>
                <p className="text-sm text-muted-foreground">
                  This client doesn't have any orders yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {/* Instructions */}
      {billSelectedClient === 'all' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <ScrollText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Select Client
              </h3>
              <p className="text-sm text-muted-foreground">
                Choose a client to view their orders and generate bills/invoices
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Amount Input Modal */}
      <Dialog open={billAmountModalOpen} onOpenChange={setBillAmountModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Invoice Amount</DialogTitle>
            <DialogDescription>
              Enter the total amount for the invoice (including GST)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Enter amount to generate Invoice</label>
              <Input
                type="number"
                placeholder="Enter invoice amount (e.g., 50000)"
                value={billInvoiceAmount}
                onChange={(e) => setBillInvoiceAmount(e.target.value)}
                className="mt-2"
                min="0"
                step="0.01"
              />
            </div>
            {selectedOrderForBill && (
              <div className="text-sm text-muted-foreground">
                <div>Original Total: ₹{getTotalAmount(selectedOrderForBill).toFixed(2)}</div>
                <div>Order: {selectedOrderForBill.frontend_id || 'Generating...'}</div>
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setBillAmountModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateBillInvoice}>
                Generate Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="w-8 h-8 text-primary" />
              Challan Management
            </h1>
            <p className="text-muted-foreground">
              Manage packing slips, cash challans, and billing records
            </p>
          </div>
          <Button onClick={() => window.location.href = '/dispatch'} variant="outline">
            <Package className="w-4 h-4 mr-2" />
            Create New Dispatch
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="packing-slip" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Packing Slip
            </TabsTrigger>
            <TabsTrigger value="cash" className="flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              Cash
            </TabsTrigger>
            <TabsTrigger value="bill" className="flex items-center gap-2">
              <ScrollText className="w-4 h-4" />
              Bill
            </TabsTrigger>
          </TabsList>

          <TabsContent value="packing-slip">
            {renderPackingSlipTab()}
          </TabsContent>

          <TabsContent value="cash">
            {renderCashTab()}
          </TabsContent>

          <TabsContent value="bill">
            {renderBillTab()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dispatch Details Modal - Only for Packing Slip tab */}
      {activeTab === "packing-slip" && (
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Packing Slip Details
              </DialogTitle>
              <DialogDescription>
                Complete information for packing slip record
              </DialogDescription>
            </DialogHeader>
            
            {detailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Loading packing slip details...
              </div>
            ) : selectedDispatch && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Packing Slip Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Dispatch Number</label>
                        <div className="font-medium">{selectedDispatch.dispatch_number}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Reference Number</label>
                        <div className="font-medium">{selectedDispatch.reference_number || "N/A"}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Dispatch Date</label>
                        <div className="font-medium">{new Date(selectedDispatch.dispatch_date).toLocaleString()}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Status</label>
                        <div>{getStatusBadge(selectedDispatch.status)}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Payment Type</label>
                        <div>{getPaymentTypeBadge(selectedDispatch.payment_type)}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Client Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                        <div className="font-medium">{selectedDispatch.client.company_name}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
                        <div className="font-medium">{selectedDispatch.client.contact_person}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Mobile</label>
                        <div className="font-medium">{selectedDispatch.client.mobile || 'N/A'}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <div className="font-medium">{selectedDispatch.client.email || 'N/A'}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Address</label>
                        <div className="font-medium">{selectedDispatch.client.address || 'N/A'}</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Transport Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Transport Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Vehicle Number</label>
                        <div className="font-medium flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          {selectedDispatch.vehicle_number}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Driver Name</label>
                        <div className="font-medium flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {selectedDispatch.driver_name}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Driver Mobile</label>
                        <div className="font-medium flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {selectedDispatch.driver_mobile}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{selectedDispatch.total_items}</div>
                        <div className="text-sm text-muted-foreground">Total Items</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{selectedDispatch.total_weight_kg.toFixed(1)}kg</div>
                        <div className="text-sm text-muted-foreground">Total Weight</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{selectedDispatch.items?.length || 0}</div>
                        <div className="text-sm text-muted-foreground">Items Listed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Created By</div>
                        <div className="font-medium">{selectedDispatch.created_by.name}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Items */}
                {selectedDispatch.items && selectedDispatch.items.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Dispatched Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>S.No</TableHead>
                              <TableHead>Barcode</TableHead>
                              <TableHead>QR Code</TableHead>
                              <TableHead>Width</TableHead>
                              <TableHead>Weight</TableHead>
                              <TableHead>Paper Spec</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedDispatch.items.map((item, index) => (
                              <TableRow key={item.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="font-mono text-sm">{item.barcode_id || "N/A"}</TableCell>
                                <TableCell className="font-mono text-sm">{item.qr_code}</TableCell>
                                <TableCell>{item.width_inches}"</TableCell>
                                <TableCell>{item.weight_kg.toFixed(2)}kg</TableCell>
                                <TableCell>{item.paper_spec}</TableCell>
                                <TableCell>{getStatusBadge(item.status)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadPDF(selectedDispatch.id, selectedDispatch.dispatch_number)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadPackingSlip(selectedDispatch.id)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Packing Slip
                  </Button>
                  <Button onClick={() => setDetailsModalOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}