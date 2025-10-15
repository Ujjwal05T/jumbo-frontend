"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { 
  ChevronLeft,
  Loader2, 
  AlertCircle, 
  Calendar,
  Truck,
  Weight,
  FileText,
  ImageIcon,
  Download,
  Maximize2,
  Package,
  X
} from "lucide-react";
import { toast } from "sonner";

interface WastageReport {
  id: number;
  inwardChallanId: string;
  partyName: string;
  vehicleNo: string;
  slipNo: string;
  date: string;
  netWeight: number;
  mouReport: number[];
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export default function WastageReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<WastageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (reportId) {
      loadReportDetails();
    }
  }, [reportId]);

  const loadReportDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_DOTNET_URL}/wastage/${reportId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Wastage report not found");
        }
        throw new Error(`Failed to load report details: ${response.status}`);
      }

      const data = await response.json();
      console.log("Loaded report details:", data);

      setReport(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load report details";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error loading report details:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const calculateTotalMOU = (mouReport: number[]) => {
    return mouReport.reduce((sum, value) => sum + value, 0).toFixed(2);
  };

  const getFullImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith("http")) {
      return imageUrl;
    }
    
    const baseUrl = `${process.env.NEXT_PUBLIC_DOTNET_URL?.replace('/api', '')}`;
    console.log(`${baseUrl}${imageUrl}`);
    return `${baseUrl}${imageUrl}`;
  };

  const handleDownloadImage = (imageUrl: string, index: number) => {
    const fullUrl = getFullImageUrl(imageUrl);
    const link = document.createElement("a");
    link.href = fullUrl;
    link.download = `wastage-${reportId}-image-${index + 1}.jpg`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading report details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !report) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.push("/mou-reports")}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || "Report not found"}</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.push("/mou-reports")}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
          <h1 className="text-3xl font-bold">Wastage Report Details</h1>
          <p className="text-muted-foreground mt-1">
            Complete information for challan
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>General details about the wastage report</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Party Name
                    </label>
                    <p className="text-lg font-medium mt-1">{report.partyName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Vehicle Number
                    </label>
                    <p className="text-lg mt-1">{report.vehicleNo}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Slip Number
                    </label>
                    <p className="text-lg mt-1">{report.slipNo || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Date
                    </label>
                    <p className="text-lg mt-1">{formatDate(report.date)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Weight className="h-4 w-4" />
                      Net Weight
                    </label>
                    <p className="text-lg font-bold mt-1">{report.netWeight} kg</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* MOU Measurements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  MOU Measurements
                </CardTitle>
                <CardDescription>Individual MOU readings from the report</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {report.mouReport.map((value, index) => (
                      <div
                        key={index}
                        className="p-3 border rounded-lg bg-secondary/20 text-center"
                      >
                        <p className="text-xs text-muted-foreground mb-1">
                          Reading {index + 1}
                        </p>
                        <p className="text-lg font-bold">{value.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between bg-primary/10 p-4 rounded-lg">
                    <span className="text-lg font-medium">Total MOU:</span>
                    <Badge variant="default" className="text-lg px-4 py-2">
                      {calculateTotalMOU(report.mouReport)} MOU
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Attached Images ({report.imageUrls.length})
                </CardTitle>
                <CardDescription>
                  Images captured during wastage inspection
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.imageUrls.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {report.imageUrls.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
                          <img
                            src={getFullImageUrl(imageUrl)}
                            alt={`Wastage ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setSelectedImage(getFullImageUrl(imageUrl))}
                          />
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 p-0"
                              onClick={() => setSelectedImage(getFullImageUrl(imageUrl))}
                            >
                              <Maximize2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDownloadImage(imageUrl, index)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-center mt-2 text-muted-foreground">
                          Image {index + 1}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No images attached to this report
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Metadata */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
                <CardDescription>System information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Report ID
                  </label>
                  <p className="text-lg font-mono mt-1">#{report.id}</p>
                </div>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Created At
                  </label>
                  <p className="text-sm mt-1">{formatDateTime(report.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Last Updated
                  </label>
                  <p className="text-sm mt-1">{formatDateTime(report.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total MOU</span>
                  <span className="font-bold">{calculateTotalMOU(report.mouReport)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Net Weight</span>
                  <span className="font-bold">{report.netWeight} kg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Images</span>
                  <span className="font-bold">{report.imageUrls.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Readings</span>
                  <span className="font-bold">{report.mouReport.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Image Preview Dialog */}
      {selectedImage && (
        <Dialog open={true} onOpenChange={(open) => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto p-0">
            <div className="relative">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              
              {/* Image */}
              <img
                src={selectedImage}
                alt="Full size preview"
                className="w-full h-auto"
                onClick={() => setSelectedImage(null)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
