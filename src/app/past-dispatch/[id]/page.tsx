"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { generatePackingSlipPDF, convertDispatchToPackingSlip } from "@/lib/packing-slip-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  ArrowLeft,
  Download,
  Truck,
  Calendar,
  User,
  Package,
  FileText,
  MapPin,
  Phone,
  Weight,
  Ruler,
  Eye
} from "lucide-react";
import Link from "next/link";

interface PastDispatchItem {
  id: string;
  frontend_id: string;
  width_inches: number;
  weight_kg: number;
  rate?: number;
  paper_spec: string;
}

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
  delivered_at: string;
  items: PastDispatchItem[];
}

export default function PastDispatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dispatchId = params.id as string;

  const [dispatch, setDispatch] = useState<PastDispatchRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dispatchId) {
      loadDispatchDetails();
    }
  }, [dispatchId]);

  const loadDispatchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${MASTER_ENDPOINTS.BASE}/past-dispatch/${dispatchId}/details`, createRequestOptions('GET'));

      if (!response.ok) {
        throw new Error('Failed to load past dispatch details');
      }

      const data = await response.json();
      setDispatch(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load past dispatch details';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'dispatched': return 'secondary';
      case 'delivered': return 'default';
      case 'returned': return 'destructive';
      default: return 'outline';
    }
  };

  const printPDF = async () => {
    if (!dispatch) return;
    
    try {
      // Convert past dispatch data to packing slip format
      const packingSlipData = convertDispatchToPackingSlip({
        ...dispatch,
        dispatch_items: dispatch.items, // Map items field
        client: {
          company_name: dispatch.client_name // Map client name field
        }
      });
      
      // Generate PDF and open print dialog
      const doc:any = generatePackingSlipPDF(packingSlipData, true); // Add print flag
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      URL.revokeObjectURL(url);
      
      toast.success('Packing slip PDF opened for printing');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to print packing slip PDF';
      toast.error(errorMessage);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading past dispatch details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !dispatch) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Link href="/past-dispatch">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Past Dispatches
            </Button>
          </Link>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Past dispatch record not found</p>
            <p className="text-sm text-muted-foreground">
              {error || 'The requested past dispatch record could not be found.'}
            </p>
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
          <div className="flex items-center gap-4">
            <Link href="/past-dispatch">
              <Button variant="ghost">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Past Dispatches
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Truck className="w-8 h-8 text-primary" />
                {dispatch.frontend_id || dispatch.dispatch_number}
              </h1>
              <p className="text-muted-foreground mt-1">
                Past dispatch record details and items
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={printPDF}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Print PDF
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">Total Items</span>
              </div>
              <p className="text-3xl font-bold">{dispatch.total_items}</p>
              <p className="text-xs text-muted-foreground mt-1">Items dispatched</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Weight className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Total Weight</span>
              </div>
              <p className="text-3xl font-bold">{dispatch.total_weight_kg.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mt-1">kg total weight</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="h-5 w-5 text-purple-500" />
                <span className="text-sm font-medium">Avg Weight</span>
              </div>
              <p className="text-3xl font-bold">
                {dispatch.total_items > 0 ? (dispatch.total_weight_kg / dispatch.total_items).toFixed(1) : '0.0'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">kg per item</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={getStatusBadgeVariant(dispatch.status)} className="h-5 w-5 p-0 rounded-full">
                  <span className="sr-only">Status</span>
                </Badge>
                <span className="text-sm font-medium">Status</span>
              </div>
              <p className="text-3xl font-bold capitalize">{dispatch.status}</p>
              <p className="text-xs text-muted-foreground mt-1">Current status</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dispatch Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dispatch Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Dispatch ID:</span>
                  <div className="font-medium">{dispatch.frontend_id || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Packing Slip Number:</span>
                  <div className="font-medium">{dispatch.dispatch_number}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Type:</span>
                  <div className="font-medium capitalize">{dispatch.payment_type}</div>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Dispatch Date:
                  </span>
                  <div className="font-medium">
                    {new Date(dispatch.dispatch_date).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Created At:</span>
                  <div className="font-medium">
                    {new Date(dispatch.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client & Transport Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Client & Transport Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-muted-foreground text-sm">Client Name:</span>
                <div className="font-medium text-lg">{dispatch.client_name}</div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    Vehicle Number:
                  </span>
                  <div className="font-medium">{dispatch.vehicle_number}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Driver Name:</span>
                  <div className="font-medium">{dispatch.driver_name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Driver Mobile:
                  </span>
                  <div className="font-medium">{dispatch.driver_mobile}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dispatch Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Dispatched Items ({dispatch.items?.length || 0})
            </CardTitle>
            <CardDescription>Items included in this past dispatch record</CardDescription>
          </CardHeader>
          <CardContent>
            {dispatch.items && dispatch.items.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reel No.</TableHead>
                      <TableHead>Width</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Paper Spec</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatch.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-mono text-sm">
                            {item.frontend_id || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.width_inches}"</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.weight_kg.toFixed(2)} kg</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {item.rate ? `₹${item.rate.toFixed(2)}` : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {item.paper_spec}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No items found</p>
                <p className="text-sm text-muted-foreground">
                  This past dispatch record doesn't contain any items.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}