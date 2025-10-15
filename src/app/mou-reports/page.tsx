"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Eye, 
  Search, 
  Loader2, 
  AlertCircle, 
  Calendar,
  Truck,
  Weight,
  FileText,
  ImageIcon,
  ChevronLeft
} from "lucide-react";
import { toast } from "sonner";

interface WastageReport {
  id: number;
  inwardChallanId: string;
  partyName: string;
  vehicleNo: string;
  date: string;
  mouReport: number[];
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export default function MouReportsPage() {
  const router = useRouter();
  const [wastageReports, setWastageReports] = useState<WastageReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<WastageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadWastageReports();
  }, []);

  useEffect(() => {
    // Filter reports based on search term
    if (searchTerm.trim() === "") {
      setFilteredReports(wastageReports);
    } else {
      const filtered = wastageReports.filter((report) =>
        report.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.inwardChallanId.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredReports(filtered);
    }
  }, [searchTerm, wastageReports]);

  const loadWastageReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_DOTNET_URL}/wastage`);

      if (!response.ok) {
        throw new Error(`Failed to load wastage reports: ${response.status}`);
      }

      const data = await response.json();
      console.log("Loaded wastage reports:", data);

      // Handle both direct array and wrapped response
      const reports = Array.isArray(data) ? data : data.data || [];
      setWastageReports(reports);
      setFilteredReports(reports);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load wastage reports";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error loading wastage reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (reportId: number) => {
    router.push(`/mou-reports/${reportId}`);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const calculateTotalMOU = (mouReport: number[]) => {
    return mouReport.reduce((sum, value) => sum + value, 0).toFixed(2);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/mou")}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to MOU Entry
              </Button>
            </div>
            <h1 className="text-3xl font-bold">MOU Wastage Reports</h1>
            <p className="text-muted-foreground mt-1">
              View and manage all wastage reports submitted through MOU
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by party name, vehicle no, slip no, or challan ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              {searchTerm && (
                <Button variant="outline" onClick={() => setSearchTerm("")}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>Wastage Reports ({filteredReports.length})</CardTitle>
            <CardDescription>
              Complete list of all wastage reports with MOU measurements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Party Name</TableHead>
                    <TableHead>Vehicle No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total MOU</TableHead>
                    <TableHead>Images</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <div className="flex items-center justify-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading wastage reports...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredReports.length > 0 ? (
                    filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.partyName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            {report.vehicleNo}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(report.date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {calculateTotalMOU(report.mouReport)} MOU
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{report.imageUrls.length}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(report.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        {searchTerm
                          ? "No reports match your search criteria."
                          : "No wastage reports found. Create your first report in MOU Entry."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {!loading && filteredReports.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredReports.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total MOU
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredReports
                    .reduce((sum, r) => sum + r.mouReport.reduce((s, v) => s + v, 0), 0)
                    .toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Images
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredReports.reduce((sum, r) => sum + r.imageUrls.length, 0)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
