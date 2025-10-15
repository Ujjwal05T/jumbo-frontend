"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Upload, Plus, X, AlertCircle, PackageX, Trash2, Image as ImageIcon, Truck, Building2, FileText, LoaderCircle, Download } from "lucide-react";
import { fetchInwardChallans, fetchMaterials, InwardChallan, Material } from "@/lib/material-management";
import { fetchClients, Client } from "@/lib/clients";
import { downloadWastageReportPDF } from "@/lib/wastage-pdf";

interface ExistingWastage {
  id: number;
  inwardChallanId: string;
  partyName: string;
  vehicleNo: string;
  date: string;
  mouReport: number[];
  imageUrls: string[];
}

export default function WastageMOUPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<InwardChallan | null>(null);
  const [existingWastage, setExistingWastage] = useState<ExistingWastage | null>(null);
  const [mouReports, setMouReports] = useState<string[]>(["10.5", "15.75", "20.25"]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // Data states
  const [inwardChallans, setInwardChallans] = useState<InwardChallan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [challansWithWastage, setChallansWithWastage] = useState<Set<string>>(new Set());

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [challansData, clientsData, materialsData] = await Promise.all([
        fetchInwardChallans(0, 100),
        fetchClients(0, "active"),
        fetchMaterials(0, 100),
      ]);

      // Filter inward challans without time_out
      const pendingChallans = challansData.filter((challan: InwardChallan) => !challan.time_out);

      setInwardChallans(pendingChallans);
      setClients(clientsData);
      setMaterials(materialsData);

      // Check which challans already have wastage reports
      const challansWithWastageSet = new Set<string>();
      await Promise.all(
        pendingChallans.map(async (challan) => {
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_DOTNET_URL}/wastage/by-challan/${challan.id}`
            );
            if (response.ok) {
              challansWithWastageSet.add(challan.id);
            }
          } catch (error) {
            // Ignore errors, assume no wastage
          }
        })
      );
      setChallansWithWastage(challansWithWastageSet);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const addMouReportField = () => {
    setMouReports([...mouReports, ""]);
  };

  const removeMouReportField = (index: number) => {
    setMouReports(mouReports.filter((_, i) => i !== index));
  };

  const updateMouReport = (index: number, value: string) => {
    const updated = [...mouReports];
    updated[index] = value;
    setMouReports(updated);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImageFiles([...imageFiles, ...files]);

    // Create preview URLs
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    const updatedFiles = imageFiles.filter((_, i) => i !== index);
    const updatedPreviews = imagePreviews.filter((_, i) => i !== index);

    // Revoke the URL to free memory
    URL.revokeObjectURL(imagePreviews[index]);

    setImageFiles(updatedFiles);
    setImagePreviews(updatedPreviews);
  };

  const handleAddWastageClick = async (challan: InwardChallan) => {
    // Check if wastage already exists for this challan
    if (challansWithWastage.has(challan.id)) {
      // If wastage exists, fetch data and download PDF
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_DOTNET_URL}/wastage/by-challan/${challan.id}`
        );

        if (response.ok) {
          const wastageData = await response.json();
          
          // Map PascalCase from .NET to camelCase for PDF generator
          const pdfData = {
            id: wastageData.Id || wastageData.id,
            inwardChallanId: wastageData.InwardChallanId || wastageData.inwardChallanId,
            partyName: wastageData.PartyName || wastageData.partyName,
            vehicleNo: wastageData.VehicleNo || wastageData.vehicleNo,
            date: wastageData.Date || wastageData.date,
            mouReport: wastageData.MouReport || wastageData.mouReport || [],
            imageUrls: wastageData.ImageUrls || wastageData.imageUrls || [],
            createdAt: wastageData.CreatedAt || wastageData.createdAt,
            updatedAt: wastageData.UpdatedAt || wastageData.updatedAt,
          };

          await downloadWastageReportPDF(pdfData);
          toast.success("Opening wastage report for printing...");
        } else {
          toast.error("Failed to fetch wastage report data");
        }
      } catch (error) {
        console.error("Error downloading PDF:", error);
        toast.error("Failed to download PDF. Please try again.");
      }
      return;
    }

    setSelectedChallan(challan);
    setCheckingExisting(true);

    // Check if wastage already exists for this challan
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_DOTNET_URL}/wastage/by-challan/${challan.id}`
      );

      if (response.ok) {
        // Wastage exists - mark it and download PDF
        setChallansWithWastage(prev => new Set(prev).add(challan.id));
        
        const wastageData = await response.json();
        const pdfData = {
          id: wastageData.Id || wastageData.id,
          inwardChallanId: wastageData.InwardChallanId || wastageData.inwardChallanId,
          partyName: wastageData.PartyName || wastageData.partyName,
          vehicleNo: wastageData.VehicleNo || wastageData.vehicleNo,
          date: wastageData.Date || wastageData.date,
          mouReport: wastageData.MouReport || wastageData.mouReport || [],
          imageUrls: wastageData.ImageUrls || wastageData.imageUrls || [],
          createdAt: wastageData.CreatedAt || wastageData.createdAt,
          updatedAt: wastageData.UpdatedAt || wastageData.updatedAt,
        };

        await downloadWastageReportPDF(pdfData);
        toast.success("Opening wastage report for printing...");
        setCheckingExisting(false);
        return;
      } else if (response.status === 404) {
        // No existing wastage found - this is expected for first time
        console.log("No existing wastage found, creating new");
        setExistingWastage(null);
        setMouReports([""]);
        setImagePreviews([]);
        setImageFiles([]);
      } else {
        // Some other error
        console.error("Unexpected error checking wastage:", response.status);
        setExistingWastage(null);
        setMouReports([""]);
      }
    } catch (error) {
      console.error("Error checking existing wastage:", error);
      // Continue anyway - will create new
      setExistingWastage(null);
      setMouReports([""]);
    } finally {
      setCheckingExisting(false);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedChallan(null);
    setExistingWastage(null);
    // Reset form
    setMouReports(["10.5", "15.75", "20.25"]);
    setImageFiles([]);
    setImagePreviews([]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formElement = e.currentTarget;
    const formData = new FormData();

    if (!selectedChallan) {
      toast.error("No challan selected");
      return;
    }

    // Append Inward Challan ID (required for linking) - PascalCase for .NET
    formData.append("InwardChallanId", selectedChallan.id);

    // Append form fields - PascalCase for .NET
    formData.append("PartyName", (formElement.elements.namedItem("partyName") as HTMLInputElement).value);
    formData.append("VehicleNo", (formElement.elements.namedItem("vehicleNo") as HTMLInputElement).value);
    formData.append("Date", (formElement.elements.namedItem("date") as HTMLInputElement).value);

    // Append MOU reports as individual form data entries - PascalCase for .NET
    const filteredMouReports = mouReports.filter(r => r).map(r => parseFloat(r));
    filteredMouReports.forEach((report) => {
      formData.append("MouReport", report.toString());
    });

    // Append images - PascalCase for .NET
    imageFiles.forEach((file) => {
      formData.append("ImageFiles", file);
    });

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DOTNET_URL}/wastage`, {
        method: "POST",
        body: formData,
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
          console.error("Parsed error:", errorData);

          // Check for validation errors
          if (errorData.errors) {
            console.error("Validation errors:", errorData.errors);
            const validationMessages = Object.entries(errorData.errors)
              .map(([field, messages]) => `${field}: ${(messages as string[]).join(", ")}`)
              .join("; ");
            throw new Error(`Validation failed: ${validationMessages}`);
          }
        } catch (parseError) {
          errorData = { message: errorText };
        }

        throw new Error(errorData?.message || errorData?.title || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Success:", result);

      const data = result.data || result;

      toast.success("Wastage entry created successfully!");

      handleCloseModal();
      // Mark this challan as having wastage so user cannot edit it again
      if (selectedChallan) {
        setChallansWithWastage(prev => new Set(prev).add(selectedChallan.id));
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error(`Failed to submit wastage entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return "-";
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getClientName = (partyId: string) => {
    const client = clients.find(c => c.id === partyId);
    return client?.company_name || "Unknown";
  };

  const getMaterialName = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    return material?.name || "Unknown";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg animate-spin">
            <LoaderCircle />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MOU Wastage Management</h1>
            <p className="text-muted-foreground mt-1">
              Add wastage reports for pending inward challans (cannot be edited once submitted)
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Challans</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inwardChallans.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting time out</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Parties</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(inwardChallans.map(c => c.party_id)).size}
              </div>
              <p className="text-xs text-muted-foreground">Unique parties with pending entries</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(inwardChallans.map(c => c.material_id)).size}
              </div>
              <p className="text-xs text-muted-foreground">Different material types</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Inward Challans - Desktop Table */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle>Pending Inward Challans</CardTitle>
            <CardDescription>
              Inward challans without time out - click "Add Wastage" to submit wastage report. Once submitted, you can download the PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Party Name</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Vehicle No.</TableHead>
                  <TableHead>Net Weight</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inwardChallans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No pending inward challans found
                    </TableCell>
                  </TableRow>
                ) : (
                  inwardChallans.map((challan) => (
                    <TableRow key={challan.id}>
                      <TableCell className="font-mono text-sm">
                        {challan.serial_no || "-"}
                      </TableCell>
                      <TableCell>{formatDate(challan.date)}</TableCell>
                      <TableCell>{getClientName(challan.party_id)}</TableCell>
                      <TableCell>{getMaterialName(challan.material_id)}</TableCell>
                      <TableCell>{challan.vehicle_number || "-"}</TableCell>
                      <TableCell>{challan.net_weight || "-"}</TableCell>
                      <TableCell>{formatTime(challan.time_in)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleAddWastageClick(challan)}
                          variant={challansWithWastage.has(challan.id) ? "outline" : "default"}
                        >
                          {challansWithWastage.has(challan.id) ? (
                            <Download className="h-4 w-4 mr-2" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          {challansWithWastage.has(challan.id) ? "Download PDF" : "Add Wastage"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pending Inward Challans - Mobile Cards */}
        <div className="md:hidden space-y-4">
          <div className="px-1">
            <h2 className="text-lg font-semibold">Pending Inward Challans</h2>
            <p className="text-sm text-muted-foreground">
              Tap a card to add wastage report. Once submitted, you can download the PDF.
            </p>
          </div>
          {inwardChallans.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                No pending inward challans found
              </CardContent>
            </Card>
          ) : (
            inwardChallans.map((challan) => (
              <Card
                key={challan.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleAddWastageClick(challan)}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-base">
                            {getClientName(challan.party_id)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {challan.vehicle_number || "-"}
                          </span>
                        </div>
                      </div>
                      {challansWithWastage.has(challan.id) && (
                        <Badge variant="outline" className="text-xs">
                          Has Wastage
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Modal with Form */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageX className="h-5 w-5 text-primary" />
                Add Wastage Entry - {selectedChallan ? getClientName(selectedChallan.party_id) : ""}
              </DialogTitle>
              <DialogDescription>
                Fill in the wastage details for {selectedChallan?.vehicle_number || "this challan"}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Party Name */}
              <div className="space-y-2">
                <Label htmlFor="partyName">
                  Party Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="partyName"
                  name="partyName"
                  placeholder="Enter party/supplier name"
                  required
                  maxLength={200}
                  defaultValue={existingWastage?.partyName || (selectedChallan ? getClientName(selectedChallan.party_id) : "")}
                />
              </div>

              {/* Vehicle No */}
              <div className="space-y-2">
                <Label htmlFor="vehicleNo">
                  Vehicle Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vehicleNo"
                  name="vehicleNo"
                  placeholder="e.g., MH-12-AB-1234"
                  required
                  maxLength={50}
                  defaultValue={existingWastage?.vehicleNo || selectedChallan?.vehicle_number || ""}
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">
                  Date <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date"
                    name="date"
                    type="datetime-local"
                    required
                    className="pl-10"
                    defaultValue={existingWastage?.date ? new Date(existingWastage.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}
                  />
                </div>
              </div>

              {/* MOU Report (Array of floats) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>
                    MOU Report Values (Optional)
                  </Label>
                  
                </div>
                <div className="space-y-2">
                  {mouReports.map((value, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={`MOU Report value ${index + 1}`}
                        value={value}
                        onChange={(e) => updateMouReport(index, e.target.value)}
                      />
                      {mouReports.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMouReportField(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMouReportField}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Value
                  </Button>
                </div>
                
              </div>

              {/* Image Upload (Multiple) */}
              <div className="space-y-3">
                <Label>
                  Upload Images <span className="text-destructive">*</span>
                </Label>

                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <label htmlFor="imageFiles" className="cursor-pointer">
                    <span className="text-primary hover:underline font-medium">
                      Click to upload images
                    </span>
                    <span className="text-muted-foreground"> or drag and drop</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      PNG, JPG, JPEG up to 10MB each
                    </p>
                  </label>
                  <Input
                    id="imageFiles"
                    name="imageFiles"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </div>

                {/* Image Previews */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                    {/* Show newly uploaded images */}
                    {imagePreviews.map((preview, index) => (
                      <div key={`new-${index}`} className="relative group">
                        <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => removeImage(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="absolute top-2 right-2">
                            <Badge variant="default" className="text-xs">New</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {imageFiles[index]?.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {existingWastage
                      ? `${existingWastage.imageUrls.length} existing image(s)${imageFiles.length > 0 ? `, ${imageFiles.length} new image(s) selected` : ""}`
                      : imageFiles.length > 0
                        ? `${imageFiles.length} image(s) selected`
                        : "At least one image is required"
                    }
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-6 border-t">
                <Button
                  type="submit"
                  className="flex-1"
                  size="lg"
                  disabled={imageFiles.length === 0 && !existingWastage}
                >
                  {existingWastage ? "Update Wastage Entry" : "Submit Wastage Entry"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleCloseModal}
                >
                  Cancel
                </Button>
              </div>
            </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
