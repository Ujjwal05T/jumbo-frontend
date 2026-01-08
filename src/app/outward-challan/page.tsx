"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
  Search,
  X,
  Edit,
  LoaderCircle,
} from "lucide-react";
import {
  fetchOutwardChallans,
  updateOutwardChallan,
  OutwardChallan,
  CreateOutwardChallanData,
} from "@/lib/material-management";

export default function OutwardChallanPage() {
  // Get user role for field visibility
  const userRole =
    typeof window !== "undefined" ? localStorage.getItem("user_role") : null;

  // Role-based field visibility helper functions
  const isAdmin = userRole === "admin";
  const isDispatch = userRole === "dispatch";

  // Check if user has access to this page
  const hasAccess = isAdmin || isDispatch;

  // State for data
  const [outwardChallans, setOutwardChallans] = useState<OutwardChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [showOutwardUpdateModal, setShowOutwardUpdateModal] = useState(false);

  // Currently editing challan
  const [editingOutwardChallan, setEditingOutwardChallan] =
    useState<OutwardChallan | null>(null);

  // Filter states
  const [outwardSearchTerm, setOutwardSearchTerm] = useState<string>("");
  const [outwardStatusFilter, setOutwardStatusFilter] = useState<string>("all"); // all or still_inside

  // Form state
  const [outwardForm, setOutwardForm] = useState<Partial<CreateOutwardChallanData>>({
    vehicle_number: "",
    driver_name: "",
    rst_no: "",
    purpose: "",
    time_in: "",
    time_out: "",
    party_name: "",
    gross_weight: undefined,
    net_weight: undefined,
    bill_no: "",
    bill_date: "",
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const outwardData = await fetchOutwardChallans();
      setOutwardChallans(outwardData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Filtering function
  const getFilteredOutwardChallans = () => {
    return outwardChallans.filter((challan) => {
      // Omni search across serial_no, party_name, rst_no, vehicle_number
      const searchLower = outwardSearchTerm.toLowerCase().trim();
      const matchesSearch = !searchLower ||
        (challan.serial_no || "").toLowerCase().includes(searchLower) ||
        (challan.party_name || "").toLowerCase().includes(searchLower) ||
        (challan.rst_no || "").toLowerCase().includes(searchLower) ||
        (challan.vehicle_number || "").toLowerCase().includes(searchLower);

      // Status filter (still inside = no time_out)
      const matchesStatus = outwardStatusFilter === "all" ||
        (outwardStatusFilter === "still_inside" && (!challan.time_out || challan.time_out === ""));

      return matchesSearch && matchesStatus;
    });
  };

  // Highlight search text
  const highlightText = (text: string | null | undefined, searchTerm: string) => {
    if (!text || !searchTerm.trim()) return text || "-";

    const regex = new RegExp(`(${searchTerm.trim()})`, "gi");
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <span key={index} className="bg-yellow-200 font-semibold">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
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

  const handleOutwardEdit = (challan: OutwardChallan) => {
    setEditingOutwardChallan(challan);
    setOutwardForm({
      vehicle_number: challan.vehicle_number,
      driver_name: challan.driver_name,
      rst_no: challan.rst_no,
      purpose: challan.purpose,
      time_in: challan.time_in,
      time_out: challan.time_out,
      party_name: challan.party_name,
      gross_weight: challan.gross_weight,
      net_weight: challan.net_weight,
      bill_no: challan.bill_no,
      bill_date: challan.bill_date ? challan.bill_date.split('T')[0] : "",
    });
    setShowOutwardUpdateModal(true);
  };

  const handleOutwardUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutwardChallan) {
      toast.error("No challan selected for update");
      return;
    }

    try {
      setSubmitting(true);
      // Only send RST No and Gross Weight for update
      const updateData: Partial<CreateOutwardChallanData> = {
        rst_no: outwardForm.rst_no,
        gross_weight: outwardForm.gross_weight,
      };

      await updateOutwardChallan(editingOutwardChallan.id, updateData);
      toast.success("Outward challan updated successfully!");
      setShowOutwardUpdateModal(false);
      setEditingOutwardChallan(null);
      setOutwardForm({
        vehicle_number: "",
        driver_name: "",
        rst_no: "",
        purpose: "",
        time_in: "",
        time_out: "",
        party_name: "",
        gross_weight: undefined,
        net_weight: undefined,
        bill_no: "",
        bill_date: "",
      });
      loadData(); // Refresh data
    } catch (error) {
      console.error("Error updating outward challan:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update outward challan"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You do not have permission to view this page.</p>
            <p className="text-sm text-muted-foreground mt-2">This page is only accessible to Dispatch and Admin users.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Outward Challans</h2>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="outwardSearch"
                type="text"
                placeholder="Search by Serial No., Party Name, RST No., or Vehicle No..."
                value={outwardSearchTerm}
                onChange={(e) => setOutwardSearchTerm(e.target.value)}
                className="pl-10 pr-10 sm:py-6 text-xl border-3 border-orange-700/70"
              />
              {outwardSearchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setOutwardSearchTerm("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {outwardSearchTerm && (
              <p className="text-sm text-muted-foreground mt-2">
                Found {getFilteredOutwardChallans().length} result(s)
              </p>
            )}
          </div>
          <div className="w-full md:w-64">
            <Select
              value={outwardStatusFilter}
              onValueChange={setOutwardStatusFilter}
            >
              <SelectTrigger id="outwardStatusFilter" className="sm:h-14">
                <SelectValue placeholder="All Challans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Challans</SelectItem>
                <SelectItem value="still_inside">Still Inside (No Time Out)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Desktop Table */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial No.</TableHead>
                  <TableHead>Party Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle No.</TableHead>
                  <TableHead>Driver Name</TableHead>
                  <TableHead>RST No.</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Net Weight</TableHead>
                  <TableHead>Time In/Out</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFilteredOutwardChallans().map((challan) => (
                  <TableRow key={challan.id}>
                    <TableCell className="font-mono text-sm">
                      {highlightText(challan.serial_no || "Auto-generated", outwardSearchTerm)}
                    </TableCell>
                    <TableCell>{highlightText(challan.party_name, outwardSearchTerm)}</TableCell>
                    <TableCell>{formatDate(challan.date)}</TableCell>
                    <TableCell>{highlightText(challan.vehicle_number, outwardSearchTerm)}</TableCell>
                    <TableCell>{challan.driver_name || "-"}</TableCell>
                    <TableCell>{highlightText(challan.rst_no, outwardSearchTerm)}</TableCell>
                    <TableCell>{challan.purpose || "-"}</TableCell>
                    <TableCell>{challan.net_weight || "-"}</TableCell>
                    <TableCell>
                      {formatTime(challan.time_in)} -{" "}
                      {formatTime(challan.time_out)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOutwardEdit(challan)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {getFilteredOutwardChallans().length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                No outward challans found
              </CardContent>
            </Card>
          ) : (
            getFilteredOutwardChallans().map((challan) => (
              <Card key={challan.id} className="hover:border-primary transition-colors">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">Serial No.</div>
                        <div className="font-mono font-semibold">{highlightText(challan.serial_no || "Auto", outwardSearchTerm)}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(challan.date)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Party</div>
                        <div className="font-medium">{highlightText(challan.party_name, outwardSearchTerm)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Vehicle</div>
                        <div>{highlightText(challan.vehicle_number, outwardSearchTerm)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Driver</div>
                        <div>{challan.driver_name || "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Purpose</div>
                        <div>{challan.purpose || "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Net Weight</div>
                        <div>{challan.net_weight || "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">RST No.</div>
                        <div>{highlightText(challan.rst_no, outwardSearchTerm)}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground">Time In/Out</div>
                        <div>{formatTime(challan.time_in)} - {formatTime(challan.time_out)}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleOutwardEdit(challan)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Outward Challan Update Modal */}
        <Dialog
          open={showOutwardUpdateModal}
          onOpenChange={setShowOutwardUpdateModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Outward Challan</DialogTitle>
              <DialogDescription>
                Modify details for the outward challan
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleOutwardUpdate}
              className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Serial No - Readonly from DB */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutSerialNo" className="font-bold">Serial No.</Label>
                <Input
                  id="updateOutSerialNo"
                  placeholder="From database"
                  value={editingOutwardChallan?.serial_no || "N/A"}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed text-2xl font-bold border-3 border-orange-700/70"
                  title="This field is fetched from database"
                />
              </div>

              {/* Date - Readonly from DB */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutDate">Date</Label>
                <Input
                  id="updateOutDate"
                  type="date"
                  value={
                    editingOutwardChallan?.date
                      ? new Date(editingOutwardChallan.date)
                          .toISOString()
                          .split("T")[0]
                      : ""
                  }
                  readOnly
                  className="bg-gray-50 cursor-not-allowed text-2xl font-bold"
                  title="This field is fetched from database"
                />
              </div>

              {/* Vehicle Number, Driver Name, Purpose in same row */}
              <div className="col-span-1 md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Vehicle Number */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="updateOutVehicle">Vehicle Number</Label>
                    <Input
                      id="updateOutVehicle"
                      placeholder="Enter vehicle number"
                      value={outwardForm.vehicle_number || ""}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                    />
                  </div>

                  {/* Driver Name */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="updateDriverName">Driver Name</Label>
                    <Input
                      id="updateDriverName"
                      placeholder="Enter driver name"
                      value={outwardForm.driver_name || ""}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                    />
                  </div>

                  {/* Purpose */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="updatePurpose">Purpose</Label>
                    <Input
                      id="updatePurpose"
                      placeholder="Enter purpose"
                      value={outwardForm.purpose || ""}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* RST No, Gross Weight, Net Weight in same row */}
              <div className="col-span-1 md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* RST No */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="updateRstNo" className="font-bold">RST No. *</Label>
                    <Input
                    className="text-xl font-bold border-3 border-orange-700/70"
                      id="updateRstNo"
                      placeholder="Enter RST number"
                      value={outwardForm.rst_no || ""}
                      onChange={(e) =>
                        setOutwardForm({ ...outwardForm, rst_no: e.target.value })
                      }
                    />
                  </div>

                  {/* Gross Weight */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="updateOutGross">Gross Weight</Label>
                    <Input
                    className="border-3 border-orange-700/70"
                      id="updateOutGross"
                      type="number"
                      placeholder="Enter gross weight"
                      value={outwardForm.gross_weight || ""}
                      onChange={(e) =>
                        setOutwardForm({
                          ...outwardForm,
                          gross_weight: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  {/* Net Weight */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="updateOutNet">Net Weight</Label>
                    <Input
                      id="updateOutNet"
                      type="number"
                      step="0.01"
                      placeholder="Enter net weight"
                      value={outwardForm.net_weight || ""}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Party Name, Bill No, Bill Date in same row */}
              <div className="col-span-1 md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Party Name */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="updateOutParty">Party Name</Label>
                    <Input
                      id="updateOutParty"
                      placeholder="Party name"
                      value={outwardForm.party_name || ""}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                    />
                  </div>

                  {/* Bill No */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="updateOutBill">Bill No.</Label>
                    <Input
                      id="updateOutBill"
                      placeholder="Enter bill number"
                      value={outwardForm.bill_no || ""}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                    />
                  </div>

                  {/* Bill Date */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="updateOutBillDate">Bill Date</Label>
                    <Input
                      id="updateOutBillDate"
                      type="date"
                      placeholder="Enter bill date"
                      value={outwardForm.bill_date || ""}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Time In */}
              {/* <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutTimeIn">Time In</Label>
                <Input
                  id="updateOutTimeIn"
                  type="time"
                  value={outwardForm.time_in || ""}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                />
              </div> */}

              {/* Time Out */}
              {/* <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutTimeOut">Time Out</Label>
                <Input
                  id="updateOutTimeOut"
                  type="time"
                  value={outwardForm.time_out || ""}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                />
              </div> */}

              {/* Submit Button */}
              <div className="col-span-1 md:col-span-2 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowOutwardUpdateModal(false);
                    setEditingOutwardChallan(null);
                    setOutwardForm({
                      vehicle_number: "",
                      driver_name: "",
                      rst_no: "",
                      purpose: "",
                      time_in: "",
                      time_out: "",
                      party_name: "",
                      gross_weight: undefined,
                      net_weight: undefined,
                      bill_no: "",
                      bill_date: "",
                    });
                  }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Updating..." : "Update Challan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
