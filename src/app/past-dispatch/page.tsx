"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, 
  Search, 
  Plus,
  Download,
  FileText,
  Truck,
  Calendar,
  Package,
  Weight,
  Filter,
  Eye
} from "lucide-react";
import Link from "next/link";

interface PastDispatchRecord {
  id: string;
  frontend_id: string;
  dispatch_number: string;
  dispatch_date: string;
  client_name: string;
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  payment_type: string;
  status: string;
  total_items: number;
  total_weight_kg: number;
  created_at: string;
  delivered_at?: string;
  items_count: number;
}

interface DropdownOptions {
  client_names: string[];
  paper_specs: string[];
  statuses: string[];
  payment_types: string[];
}

export default function PastDispatchListPage() {
  const [dispatches, setDispatches] = useState<PastDispatchRecord[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>({
    client_names: [],
    paper_specs: [],
    statuses: [],
    payment_types: []
  });
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [paperSpecFilter, setPaperSpecFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  const itemsPerPage = 20;

  useEffect(() => {
    loadDropdownOptions();
    loadDispatches();
  }, [currentPage, searchTerm, clientFilter, paperSpecFilter, statusFilter, fromDate, toDate]);

  const loadDropdownOptions = async () => {
    try {
      const response = await fetch(`${MASTER_ENDPOINTS.BASE}/past-dispatch/dropdowns`, createRequestOptions('GET'));
      if (response.ok) {
        const data = await response.json();
        setDropdownOptions(data);
      }
    } catch (err) {
      console.error('Error loading dropdown options:', err);
    }
  };

  const loadDispatches = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        skip: ((currentPage - 1) * itemsPerPage).toString(),
        limit: itemsPerPage.toString()
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (clientFilter && clientFilter !== 'all') params.append('client_name', clientFilter);
      if (paperSpecFilter && paperSpecFilter !== 'all') params.append('paper_spec', paperSpecFilter);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      
      const response = await fetch(`${MASTER_ENDPOINTS.BASE}/past-dispatch/history?${params.toString()}`, createRequestOptions('GET'));
      
      if (!response.ok) {
        throw new Error('Failed to load past dispatch records');
      }
      
      const data = await response.json();
      setDispatches(data.dispatches);
      setTotalCount(data.total_count);
      setCurrentPage(data.current_page);
      setTotalPages(data.total_pages);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load past dispatch records';
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setClientFilter("all");
    setPaperSpecFilter("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'dispatched': return 'secondary';
      case 'delivered': return 'default';
      case 'returned': return 'destructive';
      default: return 'outline';
    }
  };

  const downloadPDF = async (dispatchId: string, dispatchNumber: string) => {
    try {
      const response = await fetch(`${MASTER_ENDPOINTS.BASE}/past-dispatch/${dispatchId}/pdf`, createRequestOptions('GET'));
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `past-dispatch-${dispatchNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download PDF';
      toast.error(errorMessage);
    }
  };

  if (loading && dispatches.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading past dispatch records...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Truck className="w-8 h-8 text-primary" />
              Past Dispatch Records
            </h1>
            <p className="text-muted-foreground mt-1">
              View historical dispatch records and generate reports
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/past-dispatch/create">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Past Dispatch
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">Total Records</span>
              </div>
              <p className="text-3xl font-bold">{totalCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Historical dispatches</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Total Items</span>
              </div>
              <p className="text-3xl font-bold">
                {dispatches.reduce((sum, dispatch) => sum + dispatch.total_items, 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Items dispatched</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Weight className="h-5 w-5 text-purple-500" />
                <span className="text-sm font-medium">Total Weight</span>
              </div>
              <p className="text-3xl font-bold">
                {dispatches.reduce((sum, dispatch) => sum + dispatch.total_weight_kg, 0).toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">kg dispatched</p>
            </CardContent>
          </Card>
          
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>Filter past dispatch records by various criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {dropdownOptions.client_names.map(client => (
                    <SelectItem key={client} value={client}>{client}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={paperSpecFilter} onValueChange={setPaperSpecFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Paper Specs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Paper Specs</SelectItem>
                  {dropdownOptions.paper_specs.map(spec => (
                    <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {dropdownOptions.statuses.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                type="date"
                placeholder="From Date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              
              <Input
                type="date"
                placeholder="To Date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2">
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dispatch Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Past Dispatch Records ({totalCount})</CardTitle>
            <CardDescription>Historical dispatch records with download options</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Loading dispatch records...</p>
              </div>
            ) : dispatches.length > 0 ? (
              <div className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dispatch ID</TableHead>
                        <TableHead>Dispatch Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dispatches.map((dispatch) => (
                        <TableRow key={dispatch.id}>
                          <TableCell>
                            <div className="font-mono text-sm">{dispatch.frontend_id}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{dispatch.dispatch_number}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(dispatch.dispatch_date).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(dispatch.dispatch_date).toLocaleTimeString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{dispatch.client_name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{dispatch.vehicle_number}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{dispatch.driver_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {dispatch.driver_mobile}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(dispatch.status)}>
                              {dispatch.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{dispatch.total_items}</div>
                            <div className="text-xs text-muted-foreground">items</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{dispatch.total_weight_kg.toFixed(1)} kg</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Link href={`/past-dispatch/${dispatch.id}`}>
                                <Button variant="ghost" size="sm" title="View Details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadPDF(dispatch.id, dispatch.dispatch_number)}
                                title="Download PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} records
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                          return (
                            <Button
                              key={page}
                              variant={page === currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No past dispatch records found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm || clientFilter !== "all" || statusFilter !== "all" || fromDate || toDate
                    ? "Try adjusting your filters to see more results."
                    : "Get started by adding your first past dispatch record."
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}