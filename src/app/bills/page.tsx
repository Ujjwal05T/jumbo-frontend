/**
 * Bills page - View and print generated payment slips
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Search,
  User,
  Loader2,
  RefreshCw,
  FileText,
  Phone,
  Receipt,
  Printer,
  Calendar,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-config";
import {
  generateCashChallanPDF,
  generateBillInvoicePDF
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
  has_payment_slip: boolean;
}

export default function BillsPage() {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;

  useEffect(() => {
    loadClients();
    loadDispatches();
  }, [currentPage, searchTerm, statusFilter, clientFilter, fromDate, toDate]);

  const loadClients = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/clients`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  };

  const loadDispatches = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('skip', ((currentPage - 1) * limit).toString());
      params.append('limit', limit.toString());

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (clientFilter !== 'all') params.append('client_id', clientFilter);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      const response = await fetch(`${API_BASE_URL}/dispatch/history?${params.toString()}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to load dispatches');

      const data = await response.json();
      setDispatches(data.dispatches || []);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error("Error loading dispatches:", error);
      toast.error("Failed to load payment slips");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintChallan = async (dispatch: DispatchRecord) => {
    try {
      // Fetch saved payment slip data with items
      const response = await fetch(`${API_BASE_URL}/payment-slip/by-dispatch/${dispatch.id}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to fetch payment slip details');

      const data = await response.json();
      const { payment_slip, dispatch: dispatchInfo } = data;

      // Build challan data using saved payment slip items with actual rates
      const orderItems = payment_slip.items.map((item: any) => {
        // Parse paper_spec to extract gsm, bf, shade
        const specsString = item.paper_spec || '';
        const parts = specsString.split(', ');
        const gsm = parts[0] ? parseInt(parts[0].replace('gsm', '')) : 0;
        const bf = parts[1] ? parseFloat(parts[1].replace('bf', '')) : 0;
        const shade = parts[2] || 'N/A';

        return {
          id: `${dispatch.id}_${item.width_inches}_${item.paper_spec}`,
          paper: {
            name: `${gsm}GSM ${bf}BF ${shade}`,
            gsm: gsm,
            bf: bf,
            shade: shade
          },
          width_inches: item.width_inches,
          quantity_rolls: item.quantity,
          rate: item.rate,
          amount: item.amount,
          quantity_kg: item.total_weight_kg
        };
      });

      const challanData = {
        type: payment_slip.payment_type,
        orders: [{
          id: dispatch.id,
          frontend_id: dispatchInfo.dispatch_number,
          order_items: orderItems,
          client: {
            company_name: dispatchInfo.client.company_name,
            contact_person: dispatchInfo.client.contact_person,
            address: dispatchInfo.client.address,
            phone: dispatchInfo.client.phone,
            email: dispatchInfo.client.email,
            gst_number: dispatchInfo.client.gst_number
          },
          payment_type: payment_slip.payment_type,
          delivery_date: dispatchInfo.dispatch_date,
          created_at: dispatch.created_at
        }],
        invoice_number: payment_slip.frontend_id,
        invoice_date: payment_slip.slip_date || new Date().toISOString().split('T')[0],
        vehicle_info: {
          vehicle_number: dispatchInfo.vehicle_number,
          driver_name: dispatchInfo.driver_name,
          driver_mobile: dispatchInfo.driver_mobile,
          dispatch_date: dispatchInfo.dispatch_date,
          dispatch_number: dispatchInfo.dispatch_number,
          reference_number: dispatchInfo.reference_number
        }
      };

      // Generate PDF based on payment type
      if (dispatch.payment_type === 'cash') {
        generateCashChallanPDF(challanData);
        toast.success("Cash challan PDF generated successfully");
      } else {
        generateBillInvoicePDF(challanData);
        toast.success("Bill invoice PDF generated successfully");
      }
    } catch (error) {
      console.error("Error printing challan:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const getPaymentTypeBadge = (type: string) => {
    return type === 'bill' ? (
      <Badge variant="default" className="bg-blue-600">Bill</Badge>
    ) : (
      <Badge variant="secondary" className="bg-green-600 text-white">Cash</Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'dispatched':
        return <Badge variant="default">Dispatched</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Delivered</Badge>;
      case 'returned':
        return <Badge variant="destructive">Returned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="w-8 h-8 text-primary" />
              Generated Bills
            </h1>
            <p className="text-muted-foreground">
              View and print generated payment slips
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
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

        {/* Generated Bills Table */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Bills</CardTitle>
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
                    <TableHead>Print</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        <div className="flex items-center justify-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading bills...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : dispatches.filter(d => d.has_payment_slip).length > 0 ? (
                    dispatches.filter(d => d.has_payment_slip).map((dispatch) => (
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintChallan(dispatch)}
                          >
                            <Printer className="w-4 h-4 mr-1" />
                            Print
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        <div className="text-center py-4">
                          <div className="text-muted-foreground">
                            <p className="font-medium">No generated bills found</p>
                            <p className="text-sm">Bills will appear here once they are generated</p>
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
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
