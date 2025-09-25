"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Plus, Calendar, Truck, Weight, Clock, FileText, DollarSign, Edit } from "lucide-react";
import {
  fetchInwardChallans,
  fetchOutwardChallans,
  createInwardChallan,
  createOutwardChallan,
  updateInwardChallan,
  updateOutwardChallan,
  fetchMaterials,
  InwardChallan,
  OutwardChallan,
  Material,
  CreateInwardChallanData,
  CreateOutwardChallanData,
} from "@/lib/material-management";
import { fetchClients, Client } from "@/lib/clients";

export default function InOutPage() {
  // State for data
  const [inwardChallans, setInwardChallans] = useState<InwardChallan[]>([]);
  const [outwardChallans, setOutwardChallans] = useState<OutwardChallan[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showOutwardModal, setShowOutwardModal] = useState(false);
  const [showInwardUpdateModal, setShowInwardUpdateModal] = useState(false);
  const [showOutwardUpdateModal, setShowOutwardUpdateModal] = useState(false);

  // Currently editing challans
  const [editingInwardChallan, setEditingInwardChallan] = useState<InwardChallan | null>(null);
  const [editingOutwardChallan, setEditingOutwardChallan] = useState<OutwardChallan | null>(null);

  // Form states for Inward Challan
  const [inwardForm, setInwardForm] = useState<Partial<CreateInwardChallanData>>({
    party_id: "",
    material_id: "",
  });

  // Form states for Outward Challan
  const [outwardForm, setOutwardForm] = useState<Partial<CreateOutwardChallanData>>({});

  // Auto-calculate final weight when net_weight or report changes
  useEffect(() => {
    const netWeight = inwardForm.net_weight || 0;
    const report = inwardForm.report || 0;
    const calculatedFinalWeight = netWeight - report;

    // Only update if the calculated value is different to avoid infinite loops
    if (inwardForm.final_weight !== calculatedFinalWeight) {
      setInwardForm(prev => ({ ...prev, final_weight: calculatedFinalWeight }));
    }
  }, [inwardForm.net_weight, inwardForm.report]);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log("Loading data...");
      console.log("API Base URL:", process.env.NEXT_PUBLIC_API_URL);
      
      const [inwardData, outwardData, materialsData, clientsData] = await Promise.all([
        fetchInwardChallans(0, 50),
        fetchOutwardChallans(0, 50),
        fetchMaterials(0, 100),
        fetchClients(0, 'active'),
      ]);
      
      console.log("Data loaded:", {
        inwardChallans: inwardData.length,
        outwardChallans: outwardData.length,
        materials: materialsData.length,
        clients: clientsData.length,
      });
      
      setInwardChallans(inwardData);
      setOutwardChallans(outwardData);
      setMaterials(materialsData);
      setClients(clientsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Handle Inward Challan form submission
  const handleInwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inwardForm.party_id || !inwardForm.material_id) {
      toast.error("Party and Material are required");
      return;
    }

    try {
      setSubmitting(true);
      const challanData: CreateInwardChallanData = {
        party_id: inwardForm.party_id,
        vehicle_number: inwardForm.vehicle_number,
        material_id: inwardForm.material_id,
        slip_no: inwardForm.slip_no,
        rst_no: inwardForm.rst_no,
        gross_weight: inwardForm.gross_weight ? Number(inwardForm.gross_weight) : undefined,
        report: inwardForm.report ? Number(inwardForm.report) : undefined,
        net_weight: inwardForm.net_weight ? Number(inwardForm.net_weight) : undefined,
        final_weight: inwardForm.final_weight ? Number(inwardForm.final_weight) : undefined,
        rate: inwardForm.rate ? Number(inwardForm.rate) : undefined,
        bill_no: inwardForm.bill_no,
        cash: inwardForm.cash ? Number(inwardForm.cash) : undefined,
        time_in: inwardForm.time_in,
        time_out: inwardForm.time_out,
      };

      await createInwardChallan(challanData);
      toast.success("Inward challan created successfully!");
      setShowInwardModal(false);
      setInwardForm({ party_id: "", material_id: "" });
      loadData(); // Refresh data
    } catch (error) {
      console.error("Error creating inward challan:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create inward challan");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Outward Challan form submission
  const handleOutwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      const challanData: CreateOutwardChallanData = {
        vehicle_number: outwardForm.vehicle_number,
        driver_name: outwardForm.driver_name,
        rst_no: outwardForm.rst_no,
        purpose: outwardForm.purpose,
        time_in: outwardForm.time_in,
        time_out: outwardForm.time_out,
        party_name: outwardForm.party_name,
        gross_weight: outwardForm.gross_weight ? Number(outwardForm.gross_weight) : undefined,
        net_weight: outwardForm.net_weight ? Number(outwardForm.net_weight) : undefined,
        bill_no: outwardForm.bill_no,
      };

      await createOutwardChallan(challanData);
      toast.success("Outward challan created successfully!");
      setShowOutwardModal(false);
      setOutwardForm({});
      loadData(); // Refresh data
    } catch (error) {
      console.error("Error creating outward challan:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create outward challan");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle opening inward challan update modal
  const handleInwardEdit = (challan: InwardChallan) => {
    setEditingInwardChallan(challan);
    const material = materials.find(m => m.id === challan.material_id);
    setInwardForm({
      party_id: challan.party_id,
      material_id: challan.material_id,
      vehicle_number: challan.vehicle_number,
      slip_no: challan.slip_no,
      rst_no: challan.rst_no,
      gross_weight: challan.gross_weight,
      report: challan.report,
      net_weight: challan.net_weight,
      final_weight: challan.final_weight,
      rate: challan.rate,
      bill_no: challan.bill_no,
      cash: challan.cash,
      time_in: challan.time_in,
      time_out: challan.time_out,
    });
    setShowInwardUpdateModal(true);
  };

  // Handle opening outward challan update modal
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
    });
    setShowOutwardUpdateModal(true);
  };

  // Handle Inward Challan update
  const handleInwardUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInwardChallan || !inwardForm.party_id || !inwardForm.material_id) {
      toast.error("Party and Material are required");
      return;
    }

    try {
      setSubmitting(true);
      const updateData: Partial<CreateInwardChallanData> = {
        party_id: inwardForm.party_id,
        vehicle_number: inwardForm.vehicle_number,
        material_id: inwardForm.material_id,
        slip_no: inwardForm.slip_no,
        rst_no: inwardForm.rst_no,
        gross_weight: inwardForm.gross_weight ? Number(inwardForm.gross_weight) : undefined,
        report: inwardForm.report ? Number(inwardForm.report) : undefined,
        net_weight: inwardForm.net_weight ? Number(inwardForm.net_weight) : undefined,
        final_weight: inwardForm.final_weight ? Number(inwardForm.final_weight) : undefined,
        rate: inwardForm.rate ? Number(inwardForm.rate) : undefined,
        bill_no: inwardForm.bill_no,
        cash: inwardForm.cash ? Number(inwardForm.cash) : undefined,
        time_in: inwardForm.time_in,
        time_out: inwardForm.time_out,
      };

      await updateInwardChallan(editingInwardChallan.id, updateData);
      toast.success("Inward challan updated successfully!");
      setShowInwardUpdateModal(false);
      setEditingInwardChallan(null);
      setInwardForm({ party_id: "", material_id: "" });
      loadData(); // Refresh data
    } catch (error) {
      console.error("Error updating inward challan:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update inward challan");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Outward Challan update
  const handleOutwardUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutwardChallan) {
      toast.error("No challan selected for update");
      return;
    }

    try {
      setSubmitting(true);
      const updateData: Partial<CreateOutwardChallanData> = {
        vehicle_number: outwardForm.vehicle_number,
        driver_name: outwardForm.driver_name,
        rst_no: outwardForm.rst_no,
        purpose: outwardForm.purpose,
        time_in: outwardForm.time_in,
        time_out: outwardForm.time_out,
        party_name: outwardForm.party_name,
        gross_weight: outwardForm.gross_weight ? Number(outwardForm.gross_weight) : undefined,
        net_weight: outwardForm.net_weight ? Number(outwardForm.net_weight) : undefined,
        bill_no: outwardForm.bill_no,
      };

      await updateOutwardChallan(editingOutwardChallan.id, updateData);
      toast.success("Outward challan updated successfully!");
      setShowOutwardUpdateModal(false);
      setEditingOutwardChallan(null);
      setOutwardForm({});
      loadData(); // Refresh data
    } catch (error) {
      console.error("Error updating outward challan:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update outward challan");
    } finally {
      setSubmitting(false);
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
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Material In/Out Management</h1>

        <Tabs defaultValue="inward" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="inward">Inward Challan</TabsTrigger>
            <TabsTrigger value="outward">Outward Challan</TabsTrigger>
          </TabsList>

          {/* Inward Challan Tab */}
          <TabsContent value="inward" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Inward Challans</h2>
              <Dialog open={showInwardModal} onOpenChange={setShowInwardModal}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Inward Challan
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Inward Challan</DialogTitle>
                    <DialogDescription>
                      Add details for material coming in
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleInwardSubmit} className="grid grid-cols-2 gap-4">
                    {/* Party Name */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="party">Party Name *</Label>
                      <Select
                        value={inwardForm.party_id}
                        onValueChange={(value) => setInwardForm({ ...inwardForm, party_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select party" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.length > 0 ? (
                            clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.company_name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="all" disabled>
                              {loading ? "Loading clients..." : "No clients available"}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Material */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="material">Material *</Label>
                      <Select
                        value={inwardForm.material_id}
                        onValueChange={(value) => setInwardForm({ ...inwardForm, material_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select material" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.length > 0 ? (
                            materials.map((material) => (
                              <SelectItem key={material.id} value={material.id}>
                                {material.name} ({material.unit_of_measure})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="all" disabled>
                              {loading ? "Loading materials..." : "No materials available"}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Vehicle Number */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="vehicle">Vehicle Number</Label>
                      <Input
                        id="vehicle"
                        placeholder="Enter vehicle number"
                        value={inwardForm.vehicle_number || ""}
                        onChange={(e) => setInwardForm({ ...inwardForm, vehicle_number: e.target.value })}
                      />
                    </div>

                    {/* Slip No */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="slip">Slip No.</Label>
                      <Input
                        id="slip"
                        placeholder="Enter slip number"
                        value={inwardForm.slip_no || ""}
                        onChange={(e) => setInwardForm({ ...inwardForm, slip_no: e.target.value })}
                      />
                    </div>

                    {/* RST No */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="rst">RST No.</Label>
                      <Input
                        id="rst"
                        placeholder="Enter RST number"
                        value={inwardForm.rst_no || ""}
                        onChange={(e) => setInwardForm({ ...inwardForm, rst_no: e.target.value })}
                      />
                    </div>

                    {/* Gross Weight */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="gross">Gross Weight</Label>
                      <Input
                        id="gross"
                        type="number"
                        step="0.01"
                        placeholder="Enter gross weight"
                        value={inwardForm.gross_weight || ""}
                        onChange={(e) => setInwardForm({ ...inwardForm, gross_weight: Number(e.target.value) })}
                      />
                    </div>

                    {/* Net Weight */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="net">Net Weight</Label>
                      <Input
                        id="net"
                        type="number"
                        step="0.01"
                        placeholder="Enter net weight"
                        value={inwardForm.net_weight || ""}
                        onChange={(e) => {
                          const netWeight = Number(e.target.value) || 0;
                          const report = inwardForm.report || 0;
                          setInwardForm({
                            ...inwardForm,
                            net_weight: netWeight,
                            final_weight: netWeight - report
                          });
                        }}
                      />
                    </div>

                    {/* Bill No */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="bill">Bill No.</Label>
                      <Input
                        id="bill"
                        placeholder="Enter bill number"
                        value={inwardForm.bill_no || ""}
                        onChange={(e) => setInwardForm({ ...inwardForm, bill_no: e.target.value })}
                      />
                    </div>

                    {/* Cash */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="cash">Bill/Cash</Label>
                      <Input
                        id="cash"
                        type="number"
                        step="0.01"
                        placeholder="Enter cash amount"
                        value={inwardForm.cash || ""}
                        onChange={(e) => setInwardForm({ ...inwardForm, cash: Number(e.target.value) })}
                      />
                    </div>

                    {/* Time In */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="timeIn">Time In</Label>
                      <Input
                        id="timeIn"
                        type="time"
                        value={inwardForm.time_in || ""}
                        onChange={(e) => setInwardForm({ ...inwardForm, time_in: e.target.value })}
                      />
                    </div>

                    {/* Time Out */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="timeOut">Time Out</Label>
                      <Input
                        id="timeOut"
                        type="time"
                        value={inwardForm.time_out || ""}
                        onChange={(e) => setInwardForm({ ...inwardForm, time_out: e.target.value })}
                      />
                    </div>

                    {/* Report */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="report">Report (Weight Deduction)</Label>
                      <Input
                        id="report"
                        type="number"
                        step="0.001"
                        placeholder="Enter weight to deduct"
                        value={inwardForm.report || ""}
                        onChange={(e) => {
                          const report = Number(e.target.value) || 0;
                          const netWeight = inwardForm.net_weight || 0;
                          setInwardForm({
                            ...inwardForm,
                            report: report,
                            final_weight: netWeight - report
                          });
                        }}
                      />
                    </div>

                    {/* Final Weight */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="finalWeight">Final Weight (Net - Report)</Label>
                      <Input
                        id="finalWeight"
                        type="number"
                        step="0.001"
                        placeholder="Auto calculated"
                        value={inwardForm.final_weight || ""}
                        readOnly
                        className="bg-gray-50 cursor-not-allowed"
                        title="This field is automatically calculated as Net Weight - Report"
                      />
                    </div>

                    {/* Rate */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="rate">Rate per Unit</Label>
                      <Input
                        id="rate"
                        type="number"
                        step="0.01"
                        placeholder="Enter rate per unit"
                        value={inwardForm.rate || ""}
                        onChange={(e) => setInwardForm({ ...inwardForm, rate: Number(e.target.value) })}
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="col-span-2 flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowInwardModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? "Creating..." : "Create Challan"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Vehicle No.</TableHead>
                      <TableHead>RST No.</TableHead>
                      <TableHead>Net Weight</TableHead>
                      <TableHead>Final Weight</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Bill No.</TableHead>
                      <TableHead>Time In/Out</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inwardChallans.map((challan) => (
                      <TableRow key={challan.id}>
                        <TableCell className="font-mono text-sm">
                          {challan.serial_no || "Auto-generated"}
                        </TableCell>
                        <TableCell>{formatDate(challan.date)}</TableCell>
                        <TableCell>
                          {materials.find(m => m.id === challan.material_id)?.name || "Unknown"}
                        </TableCell>
                        <TableCell>{challan.vehicle_number || "-"}</TableCell>
                        <TableCell>{challan.rst_no || "-"}</TableCell>
                        <TableCell>{challan.net_weight || "-"}</TableCell>
                        <TableCell>{challan.final_weight || "-"}</TableCell>
                        <TableCell>{challan.rate ? `₹${challan.rate}` : "-"}</TableCell>
                        <TableCell>{challan.bill_no || "-"}</TableCell>
                        <TableCell>
                          {formatTime(challan.time_in)} - {formatTime(challan.time_out)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInwardEdit(challan)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Outward Challan Tab */}
          <TabsContent value="outward" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Outward Challans</h2>
              <Dialog open={showOutwardModal} onOpenChange={setShowOutwardModal}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Outward Challan
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Outward Challan</DialogTitle>
                    <DialogDescription>
                      Add details for material going out
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleOutwardSubmit} className="grid grid-cols-2 gap-4">
                    {/* Vehicle Number */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="outVehicle">Vehicle Number</Label>
                      <Input
                        id="outVehicle"
                        placeholder="Enter vehicle number"
                        value={outwardForm.vehicle_number || ""}
                        onChange={(e) => setOutwardForm({ ...outwardForm, vehicle_number: e.target.value })}
                      />
                    </div>

                    {/* Driver Name */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="driverName">Driver Name</Label>
                      <Input
                        id="driverName"
                        placeholder="Enter driver name"
                        value={outwardForm.driver_name || ""}
                        onChange={(e) => setOutwardForm({ ...outwardForm, driver_name: e.target.value })}
                      />
                    </div>

                    {/* RST No */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="rstNo">RST No.</Label>
                      <Input
                        id="rstNo"
                        placeholder="Enter RST number"
                        value={outwardForm.rst_no || ""}
                        onChange={(e) => setOutwardForm({ ...outwardForm, rst_no: e.target.value })}
                      />
                    </div>

                    {/* Purpose */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="purpose">Purpose</Label>
                      <Input
                        id="purpose"
                        placeholder="Enter purpose"
                        value={outwardForm.purpose || ""}
                        onChange={(e) => setOutwardForm({ ...outwardForm, purpose: e.target.value })}
                      />
                    </div>

                    {/* Party Name */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="outParty">Party Name</Label>
                      <Input
                        id="outParty"
                        placeholder="Enter party name"
                        value={outwardForm.party_name || ""}
                        onChange={(e) => setOutwardForm({ ...outwardForm, party_name: e.target.value })}
                      />
                    </div>

                    {/* Bill No */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="outBill">Bill No.</Label>
                      <Input
                        id="outBill"
                        placeholder="Enter bill number"
                        value={outwardForm.bill_no || ""}
                        onChange={(e) => setOutwardForm({ ...outwardForm, bill_no: e.target.value })}
                      />
                    </div>

                    {/* Gross Weight */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="outGross">Gross Weight</Label>
                      <Input
                        id="outGross"
                        type="number"
                        step="0.01"
                        placeholder="Enter gross weight"
                        value={outwardForm.gross_weight || ""}
                        onChange={(e) => setOutwardForm({ ...outwardForm, gross_weight: Number(e.target.value) })}
                      />
                    </div>

                    {/* Net Weight */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="outNet">Net Weight</Label>
                      <Input
                        id="outNet"
                        type="number"
                        step="0.01"
                        placeholder="Enter net weight"
                        value={outwardForm.net_weight || ""}
                        onChange={(e) => setOutwardForm({ ...outwardForm, net_weight: Number(e.target.value) })}
                      />
                    </div>

                    {/* Time In */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="outTimeIn">Time In</Label>
                      <Input
                        id="outTimeIn"
                        type="time"
                        value={outwardForm.time_in || ""}
                        onChange={(e) => setOutwardForm({ ...outwardForm, time_in: e.target.value })}
                      />
                    </div>

                    {/* Time Out */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="outTimeOut">Time Out</Label>
                      <Input
                        id="outTimeOut"
                        type="time"
                        value={outwardForm.time_out || ""}
                        onChange={(e) => setOutwardForm({ ...outwardForm, time_out: e.target.value })}
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="col-span-2 flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowOutwardModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? "Creating..." : "Create Challan"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle No.</TableHead>
                      <TableHead>Driver Name</TableHead>
                      <TableHead>RST No.</TableHead>
                      <TableHead>Party Name</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Net Weight</TableHead>
                      <TableHead>Time In/Out</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outwardChallans.map((challan) => (
                      <TableRow key={challan.id}>
                        <TableCell className="font-mono text-sm">
                          {challan.serial_no || "Auto-generated"}
                        </TableCell>
                        <TableCell>{formatDate(challan.date)}</TableCell>
                        <TableCell>{challan.vehicle_number || "-"}</TableCell>
                        <TableCell>{challan.driver_name || "-"}</TableCell>
                        <TableCell>{challan.rst_no || "-"}</TableCell>
                        <TableCell>{challan.party_name || "-"}</TableCell>
                        <TableCell>{challan.purpose || "-"}</TableCell>
                        <TableCell>{challan.net_weight || "-"}</TableCell>
                        <TableCell>
                          {formatTime(challan.time_in)} - {formatTime(challan.time_out)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOutwardEdit(challan)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Inward Challan Update Modal */}
        <Dialog open={showInwardUpdateModal} onOpenChange={setShowInwardUpdateModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Inward Challan</DialogTitle>
              <DialogDescription>
                Modify details for the inward challan
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInwardUpdate} className="grid grid-cols-2 gap-4">
              {/* Party Name */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateParty">Party Name *</Label>
                <Select
                  value={inwardForm.party_id}
                  onValueChange={(value) => setInwardForm({ ...inwardForm, party_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select party" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length > 0 ? (
                      clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company_name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="all" disabled>
                        {loading ? "Loading clients..." : "No clients available"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Material */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateMaterial">Material *</Label>
                <Select
                  value={inwardForm.material_id}
                  onValueChange={(value) => setInwardForm({ ...inwardForm, material_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.length > 0 ? (
                      materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name} ({material.unit_of_measure})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="all" disabled>
                        {loading ? "Loading materials..." : "No materials available"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Vehicle Number */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateVehicle">Vehicle Number</Label>
                <Input
                  id="updateVehicle"
                  placeholder="Enter vehicle number"
                  value={inwardForm.vehicle_number || ""}
                  onChange={(e) => setInwardForm({ ...inwardForm, vehicle_number: e.target.value })}
                />
              </div>

              {/* Slip No */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateSlip">Slip No.</Label>
                <Input
                  id="updateSlip"
                  placeholder="Enter slip number"
                  value={inwardForm.slip_no || ""}
                  onChange={(e) => setInwardForm({ ...inwardForm, slip_no: e.target.value })}
                />
              </div>

              {/* RST No */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateRst">RST No.</Label>
                <Input
                  id="updateRst"
                  placeholder="Enter RST number"
                  value={inwardForm.rst_no || ""}
                  onChange={(e) => setInwardForm({ ...inwardForm, rst_no: e.target.value })}
                />
              </div>

              {/* Gross Weight */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateGross">Gross Weight</Label>
                <Input
                  id="updateGross"
                  type="number"
                  step="0.01"
                  placeholder="Enter gross weight"
                  value={inwardForm.gross_weight || ""}
                  onChange={(e) => setInwardForm({ ...inwardForm, gross_weight: Number(e.target.value) })}
                />
              </div>

              {/* Net Weight */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateNet">Net Weight</Label>
                <Input
                  id="updateNet"
                  type="number"
                  step="0.01"
                  placeholder="Enter net weight"
                  value={inwardForm.net_weight || ""}
                  onChange={(e) => {
                    const netWeight = Number(e.target.value) || 0;
                    const report = inwardForm.report || 0;
                    setInwardForm({
                      ...inwardForm,
                      net_weight: netWeight,
                      final_weight: netWeight - report
                    });
                  }}
                />
              </div>

              {/* Bill No */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateBill">Bill No.</Label>
                <Input
                  id="updateBill"
                  placeholder="Enter bill number"
                  value={inwardForm.bill_no || ""}
                  onChange={(e) => setInwardForm({ ...inwardForm, bill_no: e.target.value })}
                />
              </div>

              {/* Cash */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateCash">Cash</Label>
                <Input
                  id="updateCash"
                  type="number"
                  step="0.01"
                  placeholder="Enter cash amount"
                  value={inwardForm.cash || ""}
                  onChange={(e) => setInwardForm({ ...inwardForm, cash: Number(e.target.value) })}
                />
              </div>

              {/* Time In */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateTimeIn">Time In</Label>
                <Input
                  id="updateTimeIn"
                  type="time"
                  value={inwardForm.time_in || ""}
                  onChange={(e) => setInwardForm({ ...inwardForm, time_in: e.target.value })}
                />
              </div>

              {/* Time Out */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateTimeOut">Time Out</Label>
                <Input
                  id="updateTimeOut"
                  type="time"
                  value={inwardForm.time_out || ""}
                  onChange={(e) => setInwardForm({ ...inwardForm, time_out: e.target.value })}
                />
              </div>

              {/* Report */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateReport">Report (Weight Deduction)</Label>
                <Input
                  id="updateReport"
                  type="number"
                  step="0.001"
                  placeholder="Enter weight to deduct"
                  value={inwardForm.report || ""}
                  onChange={(e) => {
                    const report = Number(e.target.value) || 0;
                    const netWeight = inwardForm.net_weight || 0;
                    setInwardForm({
                      ...inwardForm,
                      report: report,
                      final_weight: netWeight - report
                    });
                  }}
                />
              </div>

              {/* Final Weight */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateFinalWeight">Final Weight (Net - Report)</Label>
                <Input
                  id="updateFinalWeight"
                  type="number"
                  step="0.001"
                  placeholder="Auto calculated"
                  value={inwardForm.final_weight || ""}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                  title="This field is automatically calculated as Net Weight - Report"
                />
              </div>

              {/* Rate */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateRate">Rate per Unit</Label>
                <Input
                  id="updateRate"
                  type="number"
                  step="0.01"
                  placeholder="Enter rate per unit"
                  value={inwardForm.rate || ""}
                  onChange={(e) => setInwardForm({ ...inwardForm, rate: Number(e.target.value) })}
                />
              </div>

              {/* Submit Button */}
              <div className="col-span-2 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowInwardUpdateModal(false);
                    setEditingInwardChallan(null);
                    setInwardForm({ party_id: "", material_id: "" });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Updating..." : "Update Challan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Outward Challan Update Modal */}
        <Dialog open={showOutwardUpdateModal} onOpenChange={setShowOutwardUpdateModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Outward Challan</DialogTitle>
              <DialogDescription>
                Modify details for the outward challan
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleOutwardUpdate} className="grid grid-cols-2 gap-4">
              {/* Vehicle Number */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutVehicle">Vehicle Number</Label>
                <Input
                  id="updateOutVehicle"
                  placeholder="Enter vehicle number"
                  value={outwardForm.vehicle_number || ""}
                  onChange={(e) => setOutwardForm({ ...outwardForm, vehicle_number: e.target.value })}
                />
              </div>

              {/* Driver Name */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateDriverName">Driver Name</Label>
                <Input
                  id="updateDriverName"
                  placeholder="Enter driver name"
                  value={outwardForm.driver_name || ""}
                  onChange={(e) => setOutwardForm({ ...outwardForm, driver_name: e.target.value })}
                />
              </div>

              {/* RST No */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateRstNo">RST No.</Label>
                <Input
                  id="updateRstNo"
                  placeholder="Enter RST number"
                  value={outwardForm.rst_no || ""}
                  onChange={(e) => setOutwardForm({ ...outwardForm, rst_no: e.target.value })}
                />
              </div>

              {/* Purpose */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updatePurpose">Purpose</Label>
                <Input
                  id="updatePurpose"
                  placeholder="Enter purpose"
                  value={outwardForm.purpose || ""}
                  onChange={(e) => setOutwardForm({ ...outwardForm, purpose: e.target.value })}
                />
              </div>

              {/* Party Name */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutParty">Party Name</Label>
                <Input
                  id="updateOutParty"
                  placeholder="Enter party name"
                  value={outwardForm.party_name || ""}
                  onChange={(e) => setOutwardForm({ ...outwardForm, party_name: e.target.value })}
                />
              </div>

              {/* Bill No */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutBill">Bill No.</Label>
                <Input
                  id="updateOutBill"
                  placeholder="Enter bill number"
                  value={outwardForm.bill_no || ""}
                  onChange={(e) => setOutwardForm({ ...outwardForm, bill_no: e.target.value })}
                />
              </div>

              {/* Gross Weight */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutGross">Gross Weight</Label>
                <Input
                  id="updateOutGross"
                  type="number"
                  step="0.01"
                  placeholder="Enter gross weight"
                  value={outwardForm.gross_weight || ""}
                  onChange={(e) => setOutwardForm({ ...outwardForm, gross_weight: Number(e.target.value) })}
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
                  onChange={(e) => setOutwardForm({ ...outwardForm, net_weight: Number(e.target.value) })}
                />
              </div>

              {/* Time In */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutTimeIn">Time In</Label>
                <Input
                  id="updateOutTimeIn"
                  type="time"
                  value={outwardForm.time_in || ""}
                  onChange={(e) => setOutwardForm({ ...outwardForm, time_in: e.target.value })}
                />
              </div>

              {/* Time Out */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutTimeOut">Time Out</Label>
                <Input
                  id="updateOutTimeOut"
                  type="time"
                  value={outwardForm.time_out || ""}
                  onChange={(e) => setOutwardForm({ ...outwardForm, time_out: e.target.value })}
                />
              </div>

              {/* Submit Button */}
              <div className="col-span-2 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowOutwardUpdateModal(false);
                    setEditingOutwardChallan(null);
                    setOutwardForm({});
                  }}
                >
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