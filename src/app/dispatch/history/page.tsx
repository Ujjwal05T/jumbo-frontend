/**
 * Dispatch History page - View and manage dispatch records
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
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-config";
import { generatePackingSlipPDF, convertDispatchToPackingSlip } from "@/lib/packing-slip-pdf";

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

export default function DispatchHistoryPage() {
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
      await loadDispatches(); // Reload data
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
      // First get the detailed dispatch data
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

  useEffect(() => {
    loadClients();
    loadStats();
  }, []);

  useEffect(() => {
    loadDispatches();
  }, [currentPage, statusFilter, clientFilter, fromDate, toDate, searchTerm]);

  useEffect(() => {
    loadStats();
  }, [fromDate, toDate]);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Truck className="w-8 h-8 text-primary" />
              Dispatch History
            </h1>
            <p className="text-muted-foreground">
              View and manage dispatch records and delivery tracking
            </p>
          </div>
          <Button onClick={() => window.location.href = '/dispatch'} variant="outline">
            <Package className="w-4 h-4 mr-2" />
            Create New Dispatch
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Dispatches</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
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
              Filter dispatch records by date range, status, client, or search terms
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

        {/* Dispatch Records Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Dispatch Records</CardTitle>
                <CardDescription>
                  {totalCount} dispatch records found
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
                          Loading dispatch records...
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
                                onClick={() => printPDF(dispatch.id, dispatch.dispatch_number)}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Print PDF
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
                            <p className="font-medium">No dispatch records found</p>
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

      {/* Dispatch Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Dispatch Details
            </DialogTitle>
            <DialogDescription>
              Complete information for dispatch record
            </DialogDescription>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              Loading dispatch details...
            </div>
          ) : selectedDispatch && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dispatch Information</CardTitle>
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
    </DashboardLayout>
  );
}