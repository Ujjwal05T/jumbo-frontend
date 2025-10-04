"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Truck,
  Package,
  Weight,
  FileText,
  User,
  Phone,
  Building2,
  Calendar,
  Download,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import { generatePackingSlipPDF, convertDispatchToPackingSlip } from "@/lib/packing-slip-pdf";
import { API_BASE_URL } from "@/lib/api-config";

interface DispatchResult {
  dispatch_id: string;
  dispatch_number: string;
  client_name: string;
  vehicle_number: string;
  driver_name: string;
  total_items: number;
  total_weight_kg: number;
  completed_orders: string[];
  summary: {
    dispatched_items: number;
    orders_completed: number;
    total_weight: number;
  };
}

interface DispatchSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatchResult: DispatchResult | null;
}

export function DispatchSuccessModal({
  open,
  onOpenChange,
  dispatchResult,
}: DispatchSuccessModalProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  
  if (!dispatchResult) return null;

  const generateDispatchPDF = async (printMode = false) => {
    try {
      setPdfLoading(true);
      
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;
      
      // Header
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Dispatch Record", pageWidth / 2, yPos, { align: "center" });
      yPos += 15;
      
      // Dispatch details section
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Dispatch Details", margin, yPos);
      yPos += 10;
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      
      // Two column layout for dispatch info
      const leftCol = margin;
      const rightCol = pageWidth / 2 + 10;
      
      pdf.text(`Dispatch Number: ${dispatchResult.dispatch_number}`, leftCol, yPos);
      pdf.text(`Dispatch ID: ${dispatchResult.dispatch_id}`, rightCol, yPos);
      yPos += 8;
      
      pdf.text(`Client: ${dispatchResult.client_name}`, leftCol, yPos);
      // Date
      pdf.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, rightCol, yPos);
      yPos += 15;
      
      // Vehicle & Driver section
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Vehicle & Driver Information", margin, yPos);
      yPos += 10;
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Vehicle Number: ${dispatchResult.vehicle_number}`, leftCol, yPos);
      pdf.text(`Driver Name: ${dispatchResult.driver_name}`, rightCol, yPos);
      yPos += 15;
      
      // Summary section
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Summary", margin, yPos);
      yPos += 10;
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Items Dispatched: ${dispatchResult.summary.dispatched_items}`, leftCol, yPos);
      pdf.text(`Orders Completed: ${dispatchResult.summary.orders_completed}`, rightCol, yPos);
      yPos += 8;
      pdf.text(`Total Weight: ${dispatchResult.summary.total_weight.toFixed(2)} kg`, leftCol, yPos);
      yPos += 15;
      
      // Completed orders section
      if (dispatchResult.completed_orders && dispatchResult.completed_orders.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Completed Orders", margin, yPos);
        yPos += 10;
        
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        dispatchResult.completed_orders.forEach((orderId, index) => {
          if (yPos > pageHeight - 30) {
            pdf.addPage();
            yPos = margin;
          }
          pdf.text(`${index + 1}. Order ID: ${orderId}`, margin + 5, yPos);
          yPos += 8;
        });
        yPos += 10;
      }
      
      // Footer
      yPos = pageHeight - 30;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "italic");
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, yPos);
      pdf.text(`Document ID: ${dispatchResult.dispatch_id}`, pageWidth - margin, yPos, { align: "right" });
      
      const fileName = `dispatch-${dispatchResult.dispatch_number}-${new Date().toISOString().slice(0, 10)}.pdf`;
      
      if (printMode) {
        // Open print dialog
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(pdfUrl);
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
            URL.revokeObjectURL(pdfUrl);
          };
        }
        toast.success("Print dialog opened");
      } else {
        pdf.save(fileName);
        toast.success("Dispatch report downloaded successfully");
      }
      
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrintDispatchSlip = () => {
    generateDispatchPDF(true);
  };

  const handleDownloadReport = () => {
    generateDispatchPDF(false);
  };

  const handleDownloadPackingSlip = async () => {
    try {
      setPdfLoading(true);
      
      // Fetch detailed dispatch data
      const response = await fetch(`${API_BASE_URL}/dispatch/${dispatchResult.dispatch_id}/details`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to fetch dispatch details');
      
      const dispatchData = await response.json();
      const packingSlipData = convertDispatchToPackingSlip(dispatchData);
      generatePackingSlipPDF(packingSlipData);
      
      toast.success('Packing slip downloaded successfully');
    } catch (error) {
      console.error('Packing slip generation error:', error);
      toast.error('Failed to generate packing slip');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-6 h-6" />
            Dispatch Created Successfully!
          </DialogTitle>
          <DialogDescription>
            Your dispatch record has been created and items have been marked as dispatched
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dispatch Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Dispatch Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Dispatch Number</p>
                  <p className="font-mono font-semibold text-lg">{dispatchResult.dispatch_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dispatch ID</p>
                  <p className="font-mono text-sm">{dispatchResult.dispatch_id}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Client
                  </p>
                  <p className="font-medium">{dispatchResult.client_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Date
                  </p>
                  <p className="font-medium">{new Date().toLocaleDateString('en-GB')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vehicle & Driver Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Vehicle & Driver
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Vehicle Number:</span>
                <span className="font-semibold">{dispatchResult.vehicle_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Driver Name:</span>
                <span className="font-medium">{dispatchResult.driver_name}</span>
              </div>
            </CardContent>
          </Card>

          {/* Summary Statistics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {dispatchResult.summary.dispatched_items}
                  </div>
                  <div className="text-sm text-muted-foreground">Items Dispatched</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {dispatchResult.summary.orders_completed}
                  </div>
                  <div className="text-sm text-muted-foreground">Orders Completed</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {dispatchResult.summary.total_weight.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Weight (kg)</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Dispatch Created
            </Badge>
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              <Truck className="w-3 h-3 mr-1" />
              Ready for Delivery
            </Badge>
            {dispatchResult.summary.orders_completed > 0 && (
              <Badge variant="outline" className="text-purple-600 border-purple-600">
                <Package className="w-3 h-3 mr-1" />
                {dispatchResult.summary.orders_completed} Order(s) Completed
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handlePrintDispatchSlip}
            className="flex items-center gap-2"
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Print Report
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadReport}
            className="flex items-center gap-2"
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download Report
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadPackingSlip}
            className="flex items-center gap-2"
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            Packing Slip
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
