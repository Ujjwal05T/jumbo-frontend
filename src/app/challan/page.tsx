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
  CheckCircle2,
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
  convertOrdersToChallanData,
  convertDispatchToChallanData 
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
  has_payment_slip: boolean;
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
  const [cashDispatches, setCashDispatches] = useState<DispatchRecord[]>([]);
  const [cashDispatchesLoading, setCashDispatchesLoading] = useState(false);

  // Bill tab state
  const [billSelectedClient, setBillSelectedClient] = useState("all");
  const [billDispatches, setBillDispatches] = useState<DispatchRecord[]>([]);
  const [billDispatchesLoading, setBillDispatchesLoading] = useState(false);
  
  // Bill amount modal state
  const [billAmountModalOpen, setBillAmountModalOpen] = useState(false);
  const [selectedDispatchForBill, setSelectedDispatchForBill] = useState<DispatchRecord | null>(null);
  const [billInvoiceAmount, setBillInvoiceAmount] = useState<string>("");

  // Generate modal state
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedDispatchForGenerate, setSelectedDispatchForGenerate] = useState<DispatchRecord | null>(null);
  const [generatePaymentType, setGeneratePaymentType] = useState<"bill" | "cash" | string | undefined>(undefined);
  const [generatePreviewId, setGeneratePreviewId] = useState<string>("");
  const [generateBillNo, setGenerateBillNo] = useState<string>("");
  const [generateDate, setGenerateDate] = useState<string>("");
  const [generateEbayNo, setGenerateEbayNo] = useState<string>("");
  const [generateDispatchItems, setGenerateDispatchItems] = useState<any[]>([]);
  const [generateItemsLoading, setGenerateItemsLoading] = useState(false);

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

  const loadDispatchItemsForGenerate = async (dispatchId: string) => {
    try {
      setGenerateItemsLoading(true);
      const response = await fetch(`${API_BASE_URL}/dispatch/${dispatchId}/items-with-rates`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to load dispatch items with rates');
      const data = await response.json();

      // API already returns grouped items with rates fetched from order items
      setGenerateDispatchItems(data.items || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dispatch items';
      toast.error(errorMessage);
    } finally {
      setGenerateItemsLoading(false);
    }
  };

  const loadPaymentSlipPreviewId = async (paymentType: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/payment-slip/preview-id?payment_type=${paymentType}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to load preview ID');
      const data = await response.json();

      setGeneratePreviewId(data.preview_id);
    } catch (err) {
      console.error('Error loading preview ID:', err);
      setGeneratePreviewId("");
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

  const printPDF = async (dispatchId: string, dispatchNumber: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/${dispatchId}/pdf`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Open PDF in new window and trigger print dialog
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF opened for printing');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to print PDF';
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

  const loadDispatchesForClient = async (clientId: string, tabType: 'cash' | 'bill') => {
    if (clientId === 'all') {
      if (tabType === 'cash') {
        setCashDispatches([]);
      } else {
        setBillDispatches([]);
      }
      return;
    }

    try {
      if (tabType === 'cash') {
        setCashDispatchesLoading(true);
      } else {
        setBillDispatchesLoading(true);
      }

      // Load dispatches for the selected client with payment type filter
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('payment_type', tabType);
      params.append('skip', '0');
      params.append('limit', '100'); // Load more records for client-specific view

      const response = await fetch(`${API_BASE_URL}/dispatch/history?${params.toString()}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to load dispatches');
      const data = await response.json();
      
      if (tabType === 'cash') {
        setCashDispatches(data.dispatches || []);
      } else {
        setBillDispatches(data.dispatches || []);
      }
    } catch (err) {
      console.error(`Error loading dispatches for ${tabType}:`, err);
      toast.error(`Failed to load dispatches for client`);
    } finally {
      if (tabType === 'cash') {
        setCashDispatchesLoading(false);
      } else {
        setBillDispatchesLoading(false);
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
      loadDispatchesForClient(cashSelectedClient, 'cash');
    }
  }, [cashSelectedClient]);

  useEffect(() => {
    if (billSelectedClient !== 'all') {
      loadDispatchesForClient(billSelectedClient, 'bill');
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
  const handleGeneratePaymentSlip = async () => {
    try {
      if (!selectedDispatchForGenerate) {
        toast.error("No dispatch selected");
        return;
      }

      if (!generatePaymentType) {
        toast.error("Please select payment type");
        return;
      }

      // Get current user ID
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        toast.error("User not authenticated");
        return;
      }

      // Calculate total amount from items
      const totalAmount = generateDispatchItems.reduce((sum, item) => {
        return sum + (item.rate * item.total_weight_kg);
      }, 0);

      // Prepare items data with calculated amounts
      const itemsData = generateDispatchItems.map(item => ({
        width_inches: item.width_inches,
        paper_spec: item.paper_spec,
        quantity: item.quantity,
        total_weight_kg: item.total_weight_kg,
        rate: item.rate,
        amount: item.rate * item.total_weight_kg
      }));

      // Save payment slip to database
      const saveResponse = await fetch(`${API_BASE_URL}/payment-slip/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          dispatch_record_id: selectedDispatchForGenerate.id,
          payment_type: generatePaymentType,
          slip_date: generateDate || null,
          bill_no: generateBillNo || null,
          ebay_no: generateEbayNo || null,
          total_amount: totalAmount,
          items: itemsData,
          created_by_id: userId
        })
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.detail || 'Failed to save payment slip');
      }

      const savedData = await saveResponse.json();

      // Fetch full dispatch details for PDF generation
      const dispatchResponse = await fetch(`${API_BASE_URL}/dispatch/${selectedDispatchForGenerate.id}/details`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!dispatchResponse.ok) throw new Error('Failed to fetch dispatch details');

      const dispatchDetails = await dispatchResponse.json();

      // Convert dispatch to challan data format with the calculated amount
      const challanData = convertDispatchToChallanData(dispatchDetails, generatePaymentType as string, totalAmount);

      // Generate PDF based on payment type
      if (generatePaymentType === 'cash') {
        generateCashChallanPDF(challanData);
        toast.success(`Cash challan ${savedData.frontend_id} saved and PDF generated successfully`);
      } else {
        generateBillInvoicePDF(challanData);
        toast.success(`Bill invoice ${savedData.frontend_id} saved and PDF generated successfully`);
      }

      // Close modal and reset state
      setGenerateModalOpen(false);
      setSelectedDispatchForGenerate(null);
      setGeneratePaymentType(undefined);
      setGeneratePreviewId("");
      setGenerateBillNo("");
      setGenerateDate("");
      setGenerateEbayNo("");
      setGenerateDispatchItems([]);
    } catch (error) {
      console.error("Error generating payment slip:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate payment slip");
    }
  };

  const handleGenerateCashChallan = async (dispatch: DispatchRecord) => {
    try {
      // Fetch full dispatch details with items
      const response = await fetch(`${API_BASE_URL}/dispatch/${dispatch.id}/details`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to fetch dispatch details');
      
      const dispatchDetails = await response.json();
      
      // Convert dispatch to challan data format
      const challanData = convertDispatchToChallanData(dispatchDetails, 'cash');
      
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
      if (!selectedDispatchForBill) {
        toast.error("No dispatch selected");
        return;
      }

      if (!billInvoiceAmount || parseFloat(billInvoiceAmount) <= 0) {
        toast.error("Please enter a valid invoice amount");
        return;
      }

      // Fetch full dispatch details with items
      const response = await fetch(`${API_BASE_URL}/dispatch/${selectedDispatchForBill.id}/details`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to fetch dispatch details');
      
      const dispatchDetails = await response.json();
      const targetFinalAmount = parseFloat(billInvoiceAmount);
      
      // Convert dispatch to challan data format with custom amount
      const challanData = convertDispatchToChallanData(dispatchDetails, 'bill', targetFinalAmount);
      
      // Generate PDF
      generateBillInvoicePDF(challanData);
      
      toast.success("GST Tax Invoice PDF generated successfully");
      
      // Close modal and reset state
      setBillAmountModalOpen(false);
      setSelectedDispatchForBill(null);
      setBillInvoiceAmount("");
    } catch (error) {
      console.error("Error generating tax invoice PDF:", error);
      toast.error("Failed to generate tax invoice PDF");
    }
  };

  const handleOpenBillAmountModal = (dispatch: DispatchRecord) => {
    setSelectedDispatchForBill(dispatch);
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
            Search
          </CardTitle>
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
                  {clients.sort((a, b) => a.company_name.localeCompare(b.company_name)).map((client) => (
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
              <CardTitle className="p-0 m-0">Challan Records</CardTitle>
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
                  <TableHead>Generate</TableHead>
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
                  dispatches.filter(d => !d.has_payment_slip).map((dispatch) => (
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
                            {new Date(dispatch.dispatch_date).toLocaleDateString('en-GB')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(dispatch.dispatch_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
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
                      <TableCell>
                        {dispatch.has_payment_slip ? (
                          <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            Generated
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setSelectedDispatchForGenerate(dispatch);
                              setGenerateModalOpen(true);
                              loadDispatchItemsForGenerate(dispatch.id);
                            }}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Generate
                          </Button>
                        )}
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
                  {clients.sort((a, b) => a.company_name.localeCompare(b.company_name)).map((client) => (
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

      {/* Dispatches Table */}
      {cashSelectedClient !== 'all' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Cash Dispatches for Selected Client</CardTitle>
                <CardDescription>
                  Generate cash challan PDF for individual dispatches
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cashDispatchesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Loading dispatches...
              </div>
            ) : cashDispatches.length > 0 ? (
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
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashDispatches.map((dispatch) => (
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
                              {new Date(dispatch.dispatch_date).toLocaleDateString('en-GB')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(dispatch.dispatch_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
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
                          {getStatusBadge(dispatch.status)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleGenerateCashChallan(dispatch)}
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
                  No Cash Dispatches Found
                </h3>
                <p className="text-sm text-muted-foreground">
                  This client doesn't have any cash dispatches yet.
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
                Choose a client to view their cash dispatches and generate cash challans
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
                  {clients.sort((a, b) => a.company_name.localeCompare(b.company_name)).map((client) => (
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

      {/* Dispatches Table */}
      {billSelectedClient !== 'all' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Bill Dispatches for Selected Client</CardTitle>
                <CardDescription>
                  Generate bill/invoice PDF for individual dispatches
                </CardDescription>
              </div>
              
            </div>
          </CardHeader>
          <CardContent>
            {billDispatchesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Loading dispatches...
              </div>
            ) : billDispatches.length > 0 ? (
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
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billDispatches.map((dispatch) => (
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
                              {new Date(dispatch.dispatch_date).toLocaleDateString('en-GB')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(dispatch.dispatch_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
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
                          {getStatusBadge(dispatch.status)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleOpenBillAmountModal(dispatch)}
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
                  No Bill Dispatches Found
                </h3>
                <p className="text-sm text-muted-foreground">
                  This client doesn't have any bill dispatches yet.
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
                Choose a client to view their bill dispatches and generate bills/invoices
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
            {selectedDispatchForBill && (
              <div className="text-sm text-muted-foreground">
                <div>Dispatch: {selectedDispatchForBill.dispatch_number}</div>
                <div>Client: {selectedDispatchForBill.client.company_name}</div>
                <div>Items: {selectedDispatchForBill.total_items} | Weight: {selectedDispatchForBill.total_weight_kg.toFixed(1)}kg</div>
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
              Bill Management
            </h1>
          </div>
          <Button onClick={() => window.location.href = '/dispatch'} variant="outline">
            <Package className="w-4 h-4 mr-2" />
            Create New Dispatch
          </Button>
        </div>
        
        {/* Payment Slip Content */}
        {renderPackingSlipTab()}
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
                      <CardTitle className="text-lg">Challan Information</CardTitle>
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
                    onClick={() => printPDF(selectedDispatch.id, selectedDispatch.dispatch_number)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Print PDF
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

      {/* Generate Modal */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generate Bill
            </DialogTitle>
          </DialogHeader>

          {selectedDispatchForGenerate && (
            <div className="space-y-6">
              {/* Form Fields */}
              <div className="space-y-4">
                {/* Row 1: Payment Type, Date, and Preview ID */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Payment Type Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Type *</label>
                    <Select
                      value={generatePaymentType}
                      onValueChange={(value) => {
                        setGeneratePaymentType(value);
                        loadPaymentSlipPreviewId(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bill">Bill</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preview ID */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Invoice No.</label>
                    <Input
                      type="text"
                      value={generatePreviewId || ""}
                      readOnly
                      placeholder="Select payment type"
                      className="bg-gray-50 font-semibold"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date</label>
                    <Input
                      type="date"
                      value={generateDate}
                      onChange={(e) => setGenerateDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 2: Bill No., eBay No. (Only for Bill type) */}
                {generatePaymentType === 'bill' && (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Bill No. */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Bill No.</label>
                      <Input
                        type="text"
                        placeholder="Enter bill number"
                        value={generateBillNo}
                        onChange={(e) => setGenerateBillNo(e.target.value)}
                      />
                    </div>

                    {/* eBay No. */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">eBay No.</label>
                      <Input
                        type="text"
                        placeholder="Enter eBay number"
                        value={generateEbayNo}
                        onChange={(e) => setGenerateEbayNo(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Dispatch Items with Rates */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Dispatch Items</label>
                {generateItemsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading items...
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>S.No</TableHead>
                          <TableHead>Width</TableHead>
                          <TableHead>Paper Spec</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Total Weight</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generateDispatchItems.length > 0 ? (
                          generateDispatchItems.map((item, index) => {
                            const amount = (item.rate * item.total_weight_kg).toFixed(2);
                            return (
                              <TableRow key={index}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{item.width_inches}"</TableCell>
                                <TableCell>{item.paper_spec}</TableCell>
                                <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                                <TableCell className="text-right">{item.total_weight_kg.toFixed(2)}kg</TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    value={item.rate}
                                    onChange={(e) => {
                                      const newRate = parseFloat(e.target.value) || 0;
                                      const updatedItems = [...generateDispatchItems];
                                      updatedItems[index].rate = newRate;
                                      setGenerateDispatchItems(updatedItems);
                                    }}
                                    className="w-20 ml-auto text-right"
                                    min="0"
                                    step="1"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-semibold">₹{amount}</TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                              No items found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setGenerateModalOpen(false);
                    setSelectedDispatchForGenerate(null);
                    setGeneratePaymentType(undefined);
                    setGeneratePreviewId("");
                    setGenerateBillNo("");
                    setGenerateDate("");
                    setGenerateEbayNo("");
                    setGenerateDispatchItems([]);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleGeneratePaymentSlip}>
                  <FileText className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

