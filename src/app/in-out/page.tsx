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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Plus, Calendar, Truck, Weight, Clock, FileText, DollarSign, Edit, SplinePointer, LoaderCircle, LogOut } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  fetchInwardChallans,
  fetchOutwardChallans,
  createInwardChallan,
  createOutwardChallan,
  updateInwardChallan,
  updateOutwardChallan,
  fetchMaterials,
  fetchNextInwardSerialNumber,
  fetchNextOutwardSerialNumber,
  InwardChallan,
  OutwardChallan,
  Material,
  CreateInwardChallanData,
  CreateOutwardChallanData,
} from "@/lib/material-management";
import { fetchClients, Client } from "@/lib/clients";

export default function InOutPage() {
  // Get user role for field visibility
  const userRole = typeof window !== "undefined" ? localStorage.getItem("user_role") : null;

  // Role-based field visibility helper functions
  const isAdmin = userRole === "admin";
  const isSecurity = userRole === "security";
  const isAccountant = userRole === "accountant";

  // Check if field should be visible for current role
  const canViewField = (fieldType: 'security' | 'accountant' | 'all') => {
    if (isAdmin) return true; // Admin can see everything
    if (fieldType === 'security') return isSecurity;
    if (fieldType === 'accountant') return isAccountant;
    return false;
  };

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

  // Serial number states - fetched from database
  const [nextInwardSerial, setNextInwardSerial] = useState<string>("00001");
  const [nextOutwardSerial, setNextOutwardSerial] = useState<string>("00001");

  // PDF generation states
  const [pdfDateRange, setPdfDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1), // Start of current year
    to: new Date() // Today
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Fetch next serial numbers from database
  const loadNextSerialNumbers = async () => {
    try {
      const [inwardSerial, outwardSerial] = await Promise.all([
        fetchNextInwardSerialNumber(),
        fetchNextOutwardSerialNumber()
      ]);
      setNextInwardSerial(inwardSerial);
      setNextOutwardSerial(outwardSerial);
    } catch (error) {
      console.error("Error loading serial numbers:", error);
      // Keep default values if API fails
    }
  };

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Debug function to check data
  const debugChallanData = () => {
    console.log("=== CHALLAN DATA DEBUG ===");
    console.log("Inward Challans Count:", inwardChallans.length);
    console.log("Outward Challans Count:", outwardChallans.length);
    console.log("Current Date Range:", {
      from: pdfDateRange.from.toISOString(),
      to: pdfDateRange.to.toISOString(),
      fromDateOnly: new Date(pdfDateRange.from.getFullYear(), pdfDateRange.from.getMonth(), pdfDateRange.from.getDate()),
      toDateOnly: new Date(pdfDateRange.to.getFullYear(), pdfDateRange.to.getMonth(), pdfDateRange.to.getDate())
    });
    
    if (inwardChallans.length > 0) {
      console.log("Sample Inward Challan:", inwardChallans[0]);
      console.log("All Inward Dates:", inwardChallans.map(c => ({
        original: c.date,
        parsed: new Date(c.date),
        dateOnly: new Date(new Date(c.date).getFullYear(), new Date(c.date).getMonth(), new Date(c.date).getDate()),
        valid: !isNaN(new Date(c.date).getTime())
      })));
    }
    
    if (outwardChallans.length > 0) {
      console.log("Sample Outward Challan:", outwardChallans[0]);
      console.log("All Outward Dates:", outwardChallans.map(c => ({
        original: c.date,
        parsed: new Date(c.date),
        dateOnly: new Date(new Date(c.date).getFullYear(), new Date(c.date).getMonth(), new Date(c.date).getDate()),
        valid: !isNaN(new Date(c.date).getTime())
      })));
    }
    
    toast.info("Debug info logged to console - check date formats");
  };

  // PDF generation function
  const generateChallanPdf = async (type: 'inward' | 'outward' | 'both', action: 'download' | 'print') => {
    try {
      setGeneratingPdf(true);
      
      // Debug: Log the current data and date range
      console.log("PDF Generation Debug:");
      console.log("Date Range:", pdfDateRange);
      console.log("Inward Challans:", inwardChallans.length);
      console.log("Outward Challans:", outwardChallans.length);
      
      // Filter data based on date range with more robust date comparison
      const filterByDate = (challans: any[]) => {
        return challans.filter(challan => {
          if (!challan.date) return false;
          
          // Handle different date formats
          const challanDate = new Date(challan.date);
          
          // Check if date is valid
          if (isNaN(challanDate.getTime())) {
            console.warn("Invalid date found:", challan.date);
            return false;
          }
          
          // Normalize dates to start of day for comparison
          const challanDateOnly = new Date(challanDate.getFullYear(), challanDate.getMonth(), challanDate.getDate());
          const fromDateOnly = new Date(pdfDateRange.from.getFullYear(), pdfDateRange.from.getMonth(), pdfDateRange.from.getDate());
          const toDateOnly = new Date(pdfDateRange.to.getFullYear(), pdfDateRange.to.getMonth(), pdfDateRange.to.getDate());
          
          const isInRange = challanDateOnly >= fromDateOnly && challanDateOnly <= toDateOnly;
          
          // Debug individual record
          if (challans.length <= 5) { // Only log for small datasets to avoid spam
            console.log(`Challan date: ${challanDate.toDateString()}, In range: ${isInRange}`);
          }
          
          return isInRange;
        });
      };

      const filteredInward = filterByDate(inwardChallans);
      const filteredOutward = filterByDate(outwardChallans);

      // Check if we have any data for the requested type
      if (type === 'inward' && filteredInward.length === 0) {
        toast.error(`No inward challans found for the selected date range (${pdfDateRange.from.toLocaleDateString()} to ${pdfDateRange.to.toLocaleDateString()})`);
        return;
      }
      if (type === 'outward' && filteredOutward.length === 0) {
        toast.error(`No outward challans found for the selected date range (${pdfDateRange.from.toLocaleDateString()} to ${pdfDateRange.to.toLocaleDateString()})`);
        return;
      }
      if (type === 'both' && filteredInward.length === 0 && filteredOutward.length === 0) {
        toast.error(`No challans found for the selected date range (${pdfDateRange.from.toLocaleDateString()} to ${pdfDateRange.to.toLocaleDateString()})`);
        return;
      }

      const pdf = new jsPDF({
        orientation: 'landscape', // Use landscape for better table fitting
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      let yPosition = 15; // Start closer to top for more space

      // Helper function to add title
      const addTitle = (title: string) => {
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
        
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.text(
          `Date Range: ${pdfDateRange.from.toLocaleDateString()} to ${pdfDateRange.to.toLocaleDateString()}`,
          pageWidth / 2,
          yPosition,
          { align: 'center' }
        );
        yPosition += 15;
      };

      // Helper function to check if new page is needed
      const checkNewPage = (requiredSpace: number) => {
        if (yPosition + requiredSpace > pageHeight - 15) { // Leave 15mm margin at bottom
          pdf.addPage();
          yPosition = 15;
        }
      };

      // Generate Inward Challans Table
      if (type === 'inward' || type === 'both') {
        addTitle('Inward Challans Report');
        
        if (filteredInward.length > 0) {
          const inwardColumns = [
            'S.No', 'Party', 'Date', 'Material', 'Vehicle', 'RST', 'Net Wt', 'Final Wt', 'Bill No', 'Time In', 'Time Out'
          ];

          const inwardRows = filteredInward.map(challan => {
            const client = clients.find(c => c.id === challan.party_id);
            const material = materials.find(m => m.id === challan.material_id);
            
            return [
              challan.serial_no || '',
              client?.company_name || 'Unknown',
              new Date(challan.date).toLocaleDateString('en-GB'),
              material?.name || 'Unknown',
              challan.vehicle_number || '',
              challan.rst_no || '',
              challan.net_weight?.toString() || '',
              challan.final_weight?.toString() || '',
              challan.bill_no || 'CASH',
              challan.time_in ? new Date(`1970-01-01T${challan.time_in}`).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true
              }) : '',
              challan.time_out ? new Date(`1970-01-01T${challan.time_out}`).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true
              }) : ''
            ];
          });

          console.log("Generating inward table with", inwardRows.length, "rows");
          
          try {
            autoTable(pdf, {
              head: [inwardColumns],
              body: inwardRows,
              startY: yPosition,
              theme: 'striped',
              headStyles: { 
                fillColor: [128, 128, 128], 
                textColor: [255, 255, 255],
                fontSize: 9,
                fontStyle: 'bold'
              },
              styles: { 
                fontSize: 7, 
                cellPadding: 2,
                overflow: 'linebreak',
                lineWidth: 0.1
              },
              alternateRowStyles: { fillColor: [245, 245, 245] },
              columnStyles: {
                0: { cellWidth: 18 }, // S.No
                1: { cellWidth: 35 }, // Party
                2: { cellWidth: 25 }, // Date
                3: { cellWidth: 35 }, // Material
                4: { cellWidth: 25 }, // Vehicle
                5: { cellWidth: 20 }, // RST
                6: { cellWidth: 20 }, // Net Wt
                7: { cellWidth: 20 }, // Final Wt
                8: { cellWidth: 25 }, // Bill No
                9: { cellWidth: 20 }, // Time In
                10: { cellWidth: 20 } // Time Out
              },
              margin: { left: 5, right: 5, top: 5, bottom: 5 },
              didDrawPage: function(data: any) {
                yPosition = data.cursor.y + 5;
              }
            });
            console.log("Inward table generated successfully");
          } catch (tableError) {
            console.error("Error generating inward table:", tableError);
            pdf.text('Error generating inward table', 20, yPosition);
            yPosition += 10;
          }
        } else {
          pdf.text('No inward challans found for the selected date range', 20, yPosition);
          yPosition += 20;
        }
      }

      // Generate Outward Challans Table
      if (type === 'outward' || type === 'both') {
        if (type === 'both') {
          checkNewPage(50);
          yPosition += 20;
        }
        
        if (type === 'outward') {
          addTitle('Outward Challans Report');
        } else {
          pdf.setFontSize(16);
          pdf.setFont("helvetica", "bold");
          pdf.text('Outward Challans Report', pageWidth / 2, yPosition, { align: 'center' });
          yPosition += 15;
        }
        
        if (filteredOutward.length > 0) {
          const outwardColumns = [
            'S.No', 'Party', 'Date', 'Vehicle', 'Driver', 'RST', 'Purpose', 'Net Wt', 'Time In', 'Time Out'
          ];

          const outwardRows = filteredOutward.map(challan => {
            return [
              challan.serial_no || '',
              challan.party_name || '',
              new Date(challan.date).toLocaleDateString('en-GB'),
              challan.vehicle_number || '',
              challan.driver_name || '',
              challan.rst_no || '',
              challan.purpose || '',
              challan.net_weight?.toString() || '',
              challan.time_in ? new Date(`1970-01-01T${challan.time_in}`).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true
              }) : '',
              challan.time_out ? new Date(`1970-01-01T${challan.time_out}`).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true
              }) : ''
            ];
          });

          console.log("Generating outward table with", outwardRows.length, "rows");
          
          try {
            autoTable(pdf, {
              head: [outwardColumns],
              body: outwardRows,
              startY: yPosition,
              theme: 'striped',
              headStyles: { 
                fillColor: [128, 128, 128], 
                textColor: [255, 255, 255],
                fontSize: 9,
                fontStyle: 'bold'
              },
              styles: { 
                fontSize: 7, 
                cellPadding: 2,
                overflow: 'linebreak',
                lineWidth: 0.1
              },
              alternateRowStyles: { fillColor: [245, 245, 245] },
              columnStyles: {
                0: { cellWidth: 18 }, // S.No
                1: { cellWidth: 40 }, // Party
                2: { cellWidth: 25 }, // Date
                3: { cellWidth: 30 }, // Vehicle
                4: { cellWidth: 35 }, // Driver
                5: { cellWidth: 20 }, // RST
                6: { cellWidth: 40 }, // Purpose
                7: { cellWidth: 25 }, // Net Wt
                8: { cellWidth: 20 }, // Time In
                9: { cellWidth: 20 }  // Time Out
              },
              margin: { left: 5, right: 5, top: 5, bottom: 5 }
            });
            console.log("Outward table generated successfully");
          } catch (tableError) {
            console.error("Error generating outward table:", tableError);
            pdf.text('Error generating outward table', 20, yPosition);
          }
        } else {
          pdf.text('No outward challans found for the selected date range', 20, yPosition);
        }
      }

      // Execute action
      console.log("Executing PDF action:", action);
      
      if (action === 'download') {
        const filename = `${type}_challans_${pdfDateRange.from.toISOString().split('T')[0]}_to_${pdfDateRange.to.toISOString().split('T')[0]}.pdf`;
        console.log("Saving PDF with filename:", filename);
        pdf.save(filename);
        toast.success("PDF downloaded successfully");
      } else {
        console.log("Opening PDF for printing");
        try {
          const blobUrl = pdf.output('bloburl');
          console.log("Generated blob URL:", blobUrl);
          
          // Open in new tab for printing
          const printWindow = window.open(blobUrl, '_blank');
          if (printWindow) {
            printWindow.onload = () => {
              console.log("PDF loaded, triggering print");
              printWindow.print();
            };
            toast.success("PDF opened for printing");
          } else {
            toast.error("Failed to open print window. Please check popup blocker.");
          }
        } catch (printError) {
          console.error("Error opening PDF for printing:", printError);
          // Fallback: try autoPrint
          pdf.autoPrint();
          window.open(pdf.output('bloburl'), '_blank');
          toast.success("PDF opened for printing (fallback method)");
        }
      }
      
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Form states for Inward Challan
  const [inwardForm, setInwardForm] = useState<Partial<CreateInwardChallanData & { payment_type: string; serial_no: string; date: string }>>({
    party_id: "",
    material_id: "",
    payment_type: undefined, // Add payment type field
    serial_no: "",
    date: "",
  });

  // Form states for Outward Challan
  const [outwardForm, setOutwardForm] = useState<Partial<CreateOutwardChallanData & { serial_no: string; date: string }>>({
    serial_no: "",
    date: "",
  });

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
    loadNextSerialNumbers();
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

    // Role-based validation
    if (isSecurity) {
      if (!inwardForm.party_id || !inwardForm.material_id) {
        toast.error("Party and Material are required");
        return;
      }
    } else if (isAccountant) {
      // Accountant can submit without payment type initially
      // Validation for bill number only if payment type is bill
      if (inwardForm.payment_type === "bill" && !inwardForm.bill_no) {
        toast.error("Bill number is required when payment type is Bill");
        return;
      }
    } else if (isAdmin) {
      // Admin validation - party and material required, payment type optional
      if (!inwardForm.party_id || !inwardForm.material_id) {
        toast.error("Party and Material are required");
        return;
      }
      // Bill number validation only if payment type is bill
      if (inwardForm.payment_type === "bill" && !inwardForm.bill_no) {
        toast.error("Bill number is required when payment type is Bill");
        return;
      }
    }

    try {
      setSubmitting(true);

      // Auto-set time_in when security or admin creates the challan
      const currentTime = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const autoTimeIn = (isSecurity || isAdmin) && !inwardForm.time_in ? currentTime : inwardForm.time_in;

      const challanData: CreateInwardChallanData = {
        party_id: inwardForm.party_id as string,
        vehicle_number: inwardForm.vehicle_number,
        material_id: inwardForm.material_id as string,
        slip_no: inwardForm.slip_no,
        rst_no: inwardForm.rst_no,
        gross_weight: inwardForm.gross_weight ? Number(inwardForm.gross_weight) : undefined,
        report: inwardForm.report ? Number(inwardForm.report) : undefined,
        net_weight: inwardForm.net_weight ? Number(inwardForm.net_weight) : undefined,
        final_weight: inwardForm.final_weight ? Number(inwardForm.final_weight) : undefined,
        rate: inwardForm.rate ? Number(inwardForm.rate) : undefined,
        bill_no: inwardForm.payment_type === "bill" ? inwardForm.bill_no : undefined,
        time_in: autoTimeIn,
        time_out: inwardForm.time_out,
        payment_type: inwardForm.payment_type && inwardForm.payment_type.trim() !== "" ? inwardForm.payment_type as "bill" | "cash" : undefined, // Only send if not empty
      };

      await createInwardChallan(challanData);
      toast.success("Inward challan created successfully!");
      loadNextSerialNumbers(); // Refresh serial numbers after successful creation
      setShowInwardModal(false);
      // Reset form with empty values
      setInwardForm({
        party_id: "",
        material_id: "",
        payment_type: undefined,
        serial_no: "",
        date: "",
        vehicle_number: "",
        slip_no: "",
        rst_no: "",
        gross_weight: undefined,
        net_weight: undefined,
        final_weight: undefined,
        rate: undefined,
        bill_no: "",
        time_in: "",
        time_out: "",
        report: undefined
      });
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

    // Role-based validation for outward challan
    if (isSecurity) {
      if (!outwardForm.vehicle_number || !outwardForm.purpose) {
        toast.error("Vehicle Number and Purpose are required");
        return;
      }
    }

    try {
      setSubmitting(true);

      // Auto-set time_in when security or admin creates the challan
      const currentTime = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const autoTimeIn = (isSecurity || isAdmin) && !outwardForm.time_in ? currentTime : outwardForm.time_in;

      const challanData: CreateOutwardChallanData = {
        vehicle_number: outwardForm.vehicle_number,
        driver_name: outwardForm.driver_name,
        rst_no: outwardForm.rst_no,
        purpose: outwardForm.purpose,
        time_in: autoTimeIn,
        time_out: outwardForm.time_out,
        party_name: outwardForm.party_name,
        gross_weight: outwardForm.gross_weight ? Number(outwardForm.gross_weight) : undefined,
        net_weight: outwardForm.net_weight ? Number(outwardForm.net_weight) : undefined,
        bill_no: outwardForm.bill_no,
      };

      await createOutwardChallan(challanData);
      toast.success("Outward challan created successfully!");
      loadNextSerialNumbers(); // Refresh serial numbers after successful creation
      setShowOutwardModal(false);
      // Reset form with empty values
      setOutwardForm({
        serial_no: "",
        date: "",
        vehicle_number: "",
        driver_name: "",
        rst_no: "",
        purpose: "",
        time_in: "",
        time_out: "",
        party_name: "",
        gross_weight: undefined,
        net_weight: undefined,
        bill_no: ""
      });
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
    
    // Determine payment type based on existing data
    const paymentType = challan.bill_no ? "bill" : "cash";
    
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
      time_in: challan.time_in,
      time_out: challan.time_out,
      payment_type: paymentType, // Set the payment type
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

    // Validate bill number if payment type is bill
    if (inwardForm.payment_type === "bill" && !inwardForm.bill_no) {
      toast.error("Bill number is required when payment type is Bill");
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
        bill_no: inwardForm.payment_type === "bill" ? inwardForm.bill_no : undefined,
        time_in: inwardForm.time_in,
        time_out: inwardForm.time_out,
        payment_type: inwardForm.payment_type && inwardForm.payment_type.trim() !== "" ? inwardForm.payment_type as "bill" | "cash" : undefined, // Only send if not empty
      };

      await updateInwardChallan(editingInwardChallan.id, updateData);
      toast.success("Inward challan updated successfully!");
      setShowInwardUpdateModal(false);
      setEditingInwardChallan(null);
      setInwardForm({
        party_id: "",
        material_id: "",
        payment_type: undefined,
        serial_no: "",
        date: "",
        vehicle_number: "",
        slip_no: "",
        rst_no: "",
        gross_weight: undefined,
        net_weight: undefined,
        final_weight: undefined,
        rate: undefined,
        bill_no: "",
        time_in: "",
        time_out: "",
        report: undefined
      });
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
      setOutwardForm({
        serial_no: "",
        date: "",
        vehicle_number: "",
        driver_name: "",
        rst_no: "",
        purpose: "",
        time_in: "",
        time_out: "",
        party_name: "",
        gross_weight: undefined,
        net_weight: undefined,
        bill_no: ""
      });
      loadData(); // Refresh data
    } catch (error) {
      console.error("Error updating outward challan:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update outward challan");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle TimeOut for Inward Challan
  const handleInwardTimeOut = async (challan: InwardChallan) => {
    try {
      setSubmitting(true);
      const currentTime = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });

      const updateData: Partial<CreateInwardChallanData> = {
        time_out: currentTime,
      };

      await updateInwardChallan(challan.id, updateData);
      toast.success("Time out recorded successfully!");
      loadData(); // Refresh data
    } catch (error) {
      console.error("Error updating inward challan time out:", error);
      toast.error(error instanceof Error ? error.message : "Failed to record time out");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle TimeOut for Outward Challan
  const handleOutwardTimeOut = async (challan: OutwardChallan) => {
    try {
      setSubmitting(true);
      const currentTime = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });

      const updateData: Partial<CreateOutwardChallanData> = {
        time_out: currentTime,
      };

      await updateOutwardChallan(challan.id, updateData);
      toast.success("Time out recorded successfully!");
      loadData(); // Refresh data
    } catch (error) {
      console.error("Error updating outward challan time out:", error);
      toast.error(error instanceof Error ? error.message : "Failed to record time out");
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
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg animate-spin"><LoaderCircle /></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Material In/Out Management</h1>
          
          {/* PDF Generation Controls */}
          <div className="flex items-center gap-2">
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  {pdfDateRange.from.toLocaleDateString()} - {pdfDateRange.to.toLocaleDateString()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>From Date</Label>
                    <Input
                      type="date"
                      value={pdfDateRange.from.toISOString().split('T')[0]}
                      onChange={(e) => setPdfDateRange(prev => ({
                        ...prev,
                        from: new Date(e.target.value)
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>To Date</Label>
                    <Input
                      type="date"
                      value={pdfDateRange.to.toISOString().split('T')[0]}
                      onChange={(e) => setPdfDateRange(prev => ({
                        ...prev,
                        to: new Date(e.target.value)
                      }))}
                    />
                  </div>
                  <Button onClick={() => setShowDatePicker(false)} className="w-full">
                    Apply Date Range
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button 
              size="sm" 
              disabled={generatingPdf}
              onClick={() => generateChallanPdf('inward', 'print')}
              className=" text-white"
            >
              {generatingPdf ? (
                <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Print Inward
            </Button>

            <Button 
              size="sm" 
              disabled={generatingPdf}
              onClick={() => generateChallanPdf('outward', 'print')}
              className=" text-white"
            >
              {generatingPdf ? (
                <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Print Outward
            </Button>

            <Button 
              size="sm" 
              disabled={generatingPdf}
              onClick={() => generateChallanPdf('both', 'print')}
              className=" text-white"
            >
              {generatingPdf ? (
                <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Print Both
            </Button>
          </div>
        </div>

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
                  {(isSecurity || isAdmin) && <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Inward Challan
                  </Button>}
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Inward Challan</DialogTitle>
                    <DialogDescription>
                      Add details for material coming in
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleInwardSubmit} className="grid grid-cols-2 gap-4">
                    {/* Serial No - Readonly */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="serialNo">Serial No.</Label>
                      <Input
                        id="serialNo"
                        placeholder="Auto-generated"
                        value={inwardForm.serial_no || nextInwardSerial}
                        readOnly
                        className="bg-gray-50 cursor-not-allowed"
                        title="This field is automatically generated"
                      />
                    </div>

                    {/* Date - Readonly */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={inwardForm.date || getTodayDate()}
                        readOnly
                        className="bg-gray-50 cursor-not-allowed"
                        title="This field is automatically set to today's date"
                      />
                    </div>

                    {/* Party Name - Security & Admin can see */}
                    {canViewField('security') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="party">Party Name *</Label>
                        <Select
                          key={`party-${showInwardModal}-${inwardForm.party_id}`}
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
                    )}

                    {/* Vehicle Number - Security & Admin can see */}
                    {canViewField('security') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="vehicle">Vehicle Number</Label>
                        <Input
                          id="vehicle"
                          placeholder="Enter vehicle number"
                          value={inwardForm.vehicle_number || ""}
                          onChange={(e) => setInwardForm({ ...inwardForm, vehicle_number: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Material - Security & Admin can see */}
                    {canViewField('security') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="material">Material *</Label>
                        <Select
                          key={`material-${showInwardModal}-${inwardForm.material_id}`}
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
                    )}

                    {/* RST No - Accountant & Admin can see */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="rst">RST No.</Label>
                        <Input
                          id="rst"
                          placeholder="Enter RST number"
                          value={inwardForm.rst_no || ""}
                          onChange={(e) => setInwardForm({ ...inwardForm, rst_no: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Slip No - Accountant & Admin can see */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="slip">Slip No.</Label>
                        <Input
                          id="slip"
                          placeholder="Enter slip number"
                          value={inwardForm.slip_no || ""}
                          onChange={(e) => setInwardForm({ ...inwardForm, slip_no: e.target.value })}
                        />
                      </div>
                    )}

                    

                    {/* Gross Weight - Accountant & Admin can see */}
                    {canViewField('accountant') && (
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
                    )}

                    {/* Net Weight - Accountant & Admin can see */}
                    {canViewField('accountant') && (
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
                    )}

                    {/* Payment Type - Accountant & Admin can see */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="paymentType">Bill/Cash </Label>
                        <Select
                          key={`payment-${showInwardModal}-${inwardForm.payment_type}`}
                          value={inwardForm.payment_type || ""}
                          onValueChange={(value) => {
                            setInwardForm({
                              ...inwardForm,
                              payment_type: value as 'bill' | 'cash',
                              // Clear bill_no when cash is selected
                              ...(value === "cash" ? { bill_no: "" } : {})
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bill">Bill</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Conditionally show Bill No. when payment type is bill - Accountant & Admin can see */}
                    {canViewField('accountant') && inwardForm.payment_type === "bill" && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="bill">Bill No. *</Label>
                        <Input
                          id="bill"
                          placeholder="Enter bill number"
                          value={inwardForm.bill_no || ""}
                          onChange={(e) => setInwardForm({ ...inwardForm, bill_no: e.target.value })}
                          required
                        />
                      </div>
                    )}

                    {/* Report - Accountant & Admin can see */}
                    {canViewField('accountant') && (
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
                    )}

                    {/* Final Weight - Accountant & Admin can see */}
                    {canViewField('accountant') && (
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
                    )}

                    {/* Rate - Accountant & Admin can see */}
                    {canViewField('accountant') && (
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
                    )}

                    {/* Time In - Accountant & Admin can see (Auto-populated for Security) */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="timeIn">Time In</Label>
                        <Input
                          id="timeIn"
                          type="time"
                          value={inwardForm.time_in || ""}
                          onChange={(e) => setInwardForm({ ...inwardForm, time_in: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Time Out - Accountant & Admin can see */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="timeOut">Time Out</Label>
                        <Input
                          id="timeOut"
                          type="time"
                          value={inwardForm.time_out || ""}
                          onChange={(e) => setInwardForm({ ...inwardForm, time_out: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Submit Button */}
                    <div className="col-span-2 flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowInwardModal(false);
                          // Reset form when canceling
                          setInwardForm({
                            party_id: "",
                            material_id: "",
                            payment_type: undefined,
                            serial_no: "",
                            date: "",
                            vehicle_number: "",
                            slip_no: "",
                            rst_no: "",
                            gross_weight: undefined,
                            net_weight: undefined,
                            final_weight: undefined,
                            rate: undefined,
                            bill_no: "",
                            time_in: "",
                            time_out: "",
                            report: undefined
                          });
                        }}
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
                      <TableHead>Party Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Vehicle No.</TableHead>
                      <TableHead>RST No.</TableHead>
                      <TableHead>Net Weight</TableHead>
                      <TableHead>Final Weight</TableHead>
                      {/* <TableHead>Rate</TableHead> */}
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
                        <TableCell >
                          {clients.find(c => c.id === challan.party_id)?.company_name || "Unknown"}
                        </TableCell>
                        <TableCell>{formatDate(challan.date)}</TableCell>
                        <TableCell>
                          {materials.find(m => m.id === challan.material_id)?.name || "Unknown"}
                        </TableCell>
                        <TableCell>{challan.vehicle_number || "-"}</TableCell>
                        <TableCell>{challan.rst_no || "-"}</TableCell>
                        <TableCell>{challan.net_weight || "-"}</TableCell>
                        <TableCell>{challan.final_weight || "-"}</TableCell>
                        {/* <TableCell>{challan.rate ? `₹${challan.rate}` : "-"}</TableCell> */}
                        <TableCell>{challan.bill_no || "CASH"}</TableCell>
                        <TableCell>
                          {formatTime(challan.time_in)} - {formatTime(challan.time_out)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInwardEdit(challan)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {isSecurity && !challan.time_out && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleInwardTimeOut(challan)}
                                disabled={submitting}
                                title="Record Time Out"
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                <LogOut className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
                  {(isSecurity || isAdmin) &&<Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Outward Challan
                  </Button>}
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Outward Challan</DialogTitle>
                    <DialogDescription>
                      Add details for material going out
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleOutwardSubmit} className="grid grid-cols-2 gap-4">
                    {/* Serial No - Readonly */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="outSerialNo">Serial No.</Label>
                      <Input
                        id="outSerialNo"
                        placeholder="Auto-generated"
                        value={outwardForm.serial_no || nextOutwardSerial}
                        readOnly
                        className="bg-gray-50 cursor-not-allowed"
                        title="This field is automatically generated"
                      />
                    </div>

                    {/* Date - Readonly */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="outDate">Date</Label>
                      <Input
                        id="outDate"
                        type="date"
                        value={outwardForm.date || getTodayDate()}
                        readOnly
                        className="bg-gray-50 cursor-not-allowed"
                        title="This field is automatically set to today's date"
                      />
                    </div>

                    {/* Vehicle Number - Security & Admin can see */}
                    {canViewField('security') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="outVehicle">Vehicle Number</Label>
                        <Input
                          id="outVehicle"
                          placeholder="Enter vehicle number"
                          value={outwardForm.vehicle_number || ""}
                          onChange={(e) => setOutwardForm({ ...outwardForm, vehicle_number: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Purpose - Security & Admin can see */}
                    {canViewField('security') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="purpose">Purpose</Label>
                        <Input
                          id="purpose"
                          placeholder="Enter purpose"
                          value={outwardForm.purpose || ""}
                          onChange={(e) => setOutwardForm({ ...outwardForm, purpose: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Driver Name - Accountant & Admin can see */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="driverName">Driver Name</Label>
                        <Input
                          id="driverName"
                          placeholder="Enter driver name"
                          value={outwardForm.driver_name || ""}
                          onChange={(e) => setOutwardForm({ ...outwardForm, driver_name: e.target.value })}
                        />
                      </div>
                    )}

                    {/* RST No - Accountant & Admin can see */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="rstNo">RST No.</Label>
                        <Input
                          id="rstNo"
                          placeholder="Enter RST number"
                          value={outwardForm.rst_no || ""}
                          onChange={(e) => setOutwardForm({ ...outwardForm, rst_no: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Party Name - Accountant & Admin can see */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="outParty">Party Name</Label>
                        <Input
                          id="outParty"
                          placeholder="Enter party name"
                          value={outwardForm.party_name || ""}
                          onChange={(e) => setOutwardForm({ ...outwardForm, party_name: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Bill No - Accountant & Admin can see */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="outBill">Bill No.</Label>
                        <Input
                          id="outBill"
                          placeholder="Enter bill number"
                          value={outwardForm.bill_no || ""}
                          onChange={(e) => setOutwardForm({ ...outwardForm, bill_no: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Gross Weight - Accountant & Admin can see */}
                    {canViewField('accountant') && (
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
                    )}

                    {/* Net Weight - Accountant & Admin can see */}
                    {canViewField('accountant') && (
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
                    )}

                    {/* Time In - Accountant & Admin can see */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="outTimeIn">Time In</Label>
                        <Input
                          id="outTimeIn"
                          type="time"
                          disabled={!isAdmin}
                          value={outwardForm.time_in || ""}
                          onChange={(e) => setOutwardForm({ ...outwardForm, time_in: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Time Out - Accountant & Admin can see */}
                    {canViewField('accountant') && (
                      <div className="flex flex-col space-y-2">
                        <Label htmlFor="outTimeOut">Time Out</Label>
                        <Input
                          id="outTimeOut"
                          type="time"
                          disabled={!isAdmin}
                          value={outwardForm.time_out || ""}
                          onChange={(e) => setOutwardForm({ ...outwardForm, time_out: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Submit Button */}
                    <div className="col-span-2 flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowOutwardModal(false);
                          // Reset form when canceling
                          setOutwardForm({
                            serial_no: "",
                            date: "",
                            vehicle_number: "",
                            driver_name: "",
                            rst_no: "",
                            purpose: "",
                            time_in: "",
                            time_out: "",
                            party_name: "",
                            gross_weight: undefined,
                            net_weight: undefined,
                            bill_no: ""
                          });
                        }}
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
                    {outwardChallans.map((challan) => (
                      <TableRow key={challan.id}>
                        <TableCell className="font-mono text-sm">
                          {challan.serial_no || "Auto-generated"}
                        </TableCell>
                        <TableCell>{challan.party_name || "-"}</TableCell>
                        <TableCell>{formatDate(challan.date)}</TableCell>
                        <TableCell>{challan.vehicle_number || "-"}</TableCell>
                        <TableCell>{challan.driver_name || "-"}</TableCell>
                        <TableCell>{challan.rst_no || "-"}</TableCell>
                        <TableCell>{challan.purpose || "-"}</TableCell>
                        <TableCell>{challan.net_weight || "-"}</TableCell>
                        <TableCell>
                          {formatTime(challan.time_in)} - {formatTime(challan.time_out)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOutwardEdit(challan)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {isSecurity && !challan.time_out && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOutwardTimeOut(challan)}
                                disabled={submitting}
                                title="Record Time Out"
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                <LogOut className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
              {/* Serial No - Readonly from DB */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateSerialNo">Serial No.</Label>
                <Input
                  id="updateSerialNo"
                  placeholder="From database"
                  value={editingInwardChallan?.serial_no || "N/A"}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                  title="This field is fetched from database"
                />
              </div>

              {/* Date - Readonly from DB */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateDate">Date</Label>
                <Input
                  id="updateDate"
                  type="date"
                  value={editingInwardChallan?.date ? new Date(editingInwardChallan.date).toISOString().split('T')[0] : ""}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                  title="This field is fetched from database"
                />
              </div>

              {/* Party Name - Security & Admin can see */}
              {canViewField('security') && (
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
              )}

              {/* Vehicle Number - Security & Admin can see */}
              {canViewField('security') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateVehicle">Vehicle Number</Label>
                  <Input
                    id="updateVehicle"
                    placeholder="Enter vehicle number"
                    value={inwardForm.vehicle_number || ""}
                    onChange={(e) => setInwardForm({ ...inwardForm, vehicle_number: e.target.value })}
                  />
                </div>
              )}

              {/* Material - Security & Admin can see */}
              {canViewField('security') && (
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
              )}

              {/* RST No - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateRst">RST No.</Label>
                  <Input
                    id="updateRst"
                    placeholder="Enter RST number"
                    value={inwardForm.rst_no || ""}
                    onChange={(e) => setInwardForm({ ...inwardForm, rst_no: e.target.value })}
                  />
                </div>
              )}

              {/* Slip No - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateSlip">Slip No.</Label>
                  <Input
                    id="updateSlip"
                    placeholder="Enter slip number"
                    value={inwardForm.slip_no || ""}
                    onChange={(e) => setInwardForm({ ...inwardForm, slip_no: e.target.value })}
                  />
                </div>
              )}

              {/* Gross Weight - Accountant & Admin can see */}
              {canViewField('accountant') && (
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
              )}

              {/* Net Weight - Accountant & Admin can see */}
              {canViewField('accountant') && (
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
              )}

              {/* Payment Type - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updatePaymentType">Bill/Cash </Label>
                  <Select
                    value={inwardForm.payment_type || ""}
                    onValueChange={(value) => {
                      setInwardForm({
                        ...inwardForm,
                        payment_type: value as 'bill' | 'cash',
                        // Clear bill_no when cash is selected
                        ...(value === "cash" ? { bill_no: "" } : {})
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bill">Bill</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Conditionally show Bill No. when payment type is bill - Accountant & Admin can see */}
              {canViewField('accountant') && inwardForm.payment_type === "bill" && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateBill">Bill No. *</Label>
                  <Input
                    id="updateBill"
                    placeholder="Enter bill number"
                    value={inwardForm.bill_no || ""}
                    onChange={(e) => setInwardForm({ ...inwardForm, bill_no: e.target.value })}
                    required
                  />
                </div>
              )}

              {/* Report - Accountant & Admin can see */}
              {canViewField('accountant') && (
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
              )}

              {/* Final Weight - Accountant & Admin can see */}
              {canViewField('accountant') && (
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
              )}

              {/* Rate - Accountant & Admin can see */}
              {canViewField('accountant') && (
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
              )}

              {/* Time In - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateTimeIn">Time In</Label>
                  <Input
                    id="updateTimeIn"
                    type="time"
                    disabled={!isAdmin}
                    value={inwardForm.time_in || ""}
                    onChange={(e) => setInwardForm({ ...inwardForm, time_in: e.target.value })}
                  />
                </div>
              )}

              {/* Time Out - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateTimeOut">Time Out</Label>
                  <Input
                    id="updateTimeOut"
                    type="time"
                    disabled={!isAdmin}
                    value={inwardForm.time_out || ""}
                    onChange={(e) => setInwardForm({ ...inwardForm, time_out: e.target.value })}
                  />
                </div>
              )}

              {/* Submit Button */}
              <div className="col-span-2 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowInwardUpdateModal(false);
                    setEditingInwardChallan(null);
                    setInwardForm({
                      party_id: "",
                      material_id: "",
                      payment_type: undefined,
                      serial_no: "",
                      date: "",
                      vehicle_number: "",
                      slip_no: "",
                      rst_no: "",
                      gross_weight: undefined,
                      net_weight: undefined,
                      final_weight: undefined,
                      rate: undefined,
                      bill_no: "",
                      time_in: "",
                      time_out: "",
                      report: undefined
                    });
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
              {/* Serial No - Readonly from DB */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutSerialNo">Serial No.</Label>
                <Input
                  id="updateOutSerialNo"
                  placeholder="From database"
                  value={editingOutwardChallan?.serial_no || "N/A"}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                  title="This field is fetched from database"
                />
              </div>

              {/* Date - Readonly from DB */}
              <div className="flex flex-col space-y-2">
                <Label htmlFor="updateOutDate">Date</Label>
                <Input
                  id="updateOutDate"
                  type="date"
                  value={editingOutwardChallan?.date ? new Date(editingOutwardChallan.date).toISOString().split('T')[0] : ""}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                  title="This field is fetched from database"
                />
              </div>

              {/* Vehicle Number - Security & Admin can see */}
              {canViewField('security') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateOutVehicle">Vehicle Number</Label>
                  <Input
                    id="updateOutVehicle"
                    placeholder="Enter vehicle number"
                    value={outwardForm.vehicle_number || ""}
                    onChange={(e) => setOutwardForm({ ...outwardForm, vehicle_number: e.target.value })}
                  />
                </div>
              )}

              {/* Driver Name - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateDriverName">Driver Name</Label>
                  <Input
                    id="updateDriverName"
                    placeholder="Enter driver name"
                    value={outwardForm.driver_name || ""}
                    onChange={(e) => setOutwardForm({ ...outwardForm, driver_name: e.target.value })}
                  />
                </div>
              )}

              {/* RST No - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateRstNo">RST No.</Label>
                  <Input
                    id="updateRstNo"
                    placeholder="Enter RST number"
                    value={outwardForm.rst_no || ""}
                    onChange={(e) => setOutwardForm({ ...outwardForm, rst_no: e.target.value })}
                  />
                </div>
              )}

              {/* Purpose - Security & Admin can see */}
              {canViewField('security') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updatePurpose">Purpose</Label>
                  <Input
                    id="updatePurpose"
                    placeholder="Enter purpose"
                    value={outwardForm.purpose || ""}
                    onChange={(e) => setOutwardForm({ ...outwardForm, purpose: e.target.value })}
                  />
                </div>
              )}

              {/* Party Name - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateOutParty">Party Name</Label>
                  <Input
                    id="updateOutParty"
                    placeholder="Enter party name"
                    value={outwardForm.party_name || ""}
                    onChange={(e) => setOutwardForm({ ...outwardForm, party_name: e.target.value })}
                  />
                </div>
              )}

              {/* Bill No - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateOutBill">Bill No.</Label>
                  <Input
                    id="updateOutBill"
                    placeholder="Enter bill number"
                    value={outwardForm.bill_no || ""}
                    onChange={(e) => setOutwardForm({ ...outwardForm, bill_no: e.target.value })}
                  />
                </div>
              )}

              {/* Gross Weight - Accountant & Admin can see */}
              {canViewField('accountant') && (
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
              )}

              {/* Net Weight - Accountant & Admin can see */}
              {canViewField('accountant') && (
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
              )}

              {/* Time In - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateOutTimeIn">Time In</Label>
                  <Input
                    id="updateOutTimeIn"
                    type="time"
                    disabled={!isAdmin}
                    value={outwardForm.time_in || ""}
                    onChange={(e) => setOutwardForm({ ...outwardForm, time_in: e.target.value })}
                  />
                </div>
              )}

              {/* Time Out - Accountant & Admin can see */}
              {canViewField('accountant') && (
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="updateOutTimeOut">Time Out</Label>
                  <Input
                    id="updateOutTimeOut"
                    type="time"
                    disabled={!isAdmin}
                    value={outwardForm.time_out || ""}
                    onChange={(e) => setOutwardForm({ ...outwardForm, time_out: e.target.value })}
                  />
                </div>
              )}

              {/* Submit Button */}
              <div className="col-span-2 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowOutwardUpdateModal(false);
                    setEditingOutwardChallan(null);
                    setOutwardForm({
        serial_no: "",
        date: "",
        vehicle_number: "",
        driver_name: "",
        rst_no: "",
        purpose: "",
        time_in: "",
        time_out: "",
        party_name: "",
        gross_weight: undefined,
        net_weight: undefined,
        bill_no: ""
      });
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