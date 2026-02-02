/**
 * Dashboard page component - Modern overview with dynamic statistics
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isAuthenticated } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DASHBOARD_ENDPOINTS, createRequestOptions, PRODUCTION_DATA_ENDPOINTS } from "@/lib/api-config";
import { trackRollHierarchy, type JumboHierarchy } from "@/lib/roll-tracking";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Users,
  ShoppingCart,
  Clock,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Package,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Factory,
  Scissors,
  Activity,
  BarChart3,
  Zap,
  Calendar,
  FileText,
  Weight,
  Download,
  Printer
} from "lucide-react";

interface DashboardSummary {
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    completion_rate: number;
  };
  pending_items: {
    total_items: number;
    total_quantity: number;
    high_priority: number;
    avg_wait_time: number;
  };
  plans: {
    total: number;
    planned: number;
    in_progress: number;
    completed: number;
    success_rate: number;
  };
  inventory: {
    total_available: number;
    jumbo_rolls: number;
    cut_rolls: number;
    utilization_rate: number;
  };
  production: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    efficiency: number;
  };
  activity: {
    recent_orders: number;
    recent_plans: number;
    recent_production: number;
    total_clients: number;
    active_clients: number;
    paper_types: number;
  };
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status: string;
  icon: string;
}

interface CutRollsStats {
  total_rolls: number;
  total_weight_kg: number;
  status_breakdown: Record<string, number>;
}

interface ProductionSummary {
  totalDay: number;
  totalNight: number;
  grandTotal: number;
  totalProduction: number;
  electricity: number;
  coal: number;
  bhushi: number;
  dispatchTon: number;
  poTon: number;
  waste: number;
  starch: number;
  guarGum: number;
  pac: number;
  rct: number;
  sSeizing: number;
  dFormer: number;
  sodiumSilicate: number;
  enzyme: number;
  dsr: number;
  retAid: number;
  colourDye: number;
  poParty: number;
  wastageParty: number;
  dispatchParty: number;
  shutdownHours: number;
  monthName: string;
  year: number;
}

interface CutRoll {
  id: string;
  frontend_id: string;
  barcode_id: string;
  width_inches: number;
  weight_kg: number;
  location: string;
  status: string;
  created_at: string;
  updated_at: string;
  production_date: string;
  roll_sequence: number | null;
  individual_roll_number: number | null;
  paper_specs: {
    paper_name: string;
    gsm: number;
    bf: number;
    shade: string;
    type: string;
  };
  parent_118_roll: {
    id: string;
    frontend_id: string;
    barcode_id: string;
    width_inches: number;
    weight_kg: number;
    roll_sequence: number | null;
  } | null;
  parent_jumbo_roll: {
    id: string;
    frontend_id: string;
    barcode_id: string;
    width_inches: number;
    weight_kg: number;
  } | null;
  plan_info: {
    id: string;
    frontend_id: string;
    name: string;
    status: string;
    created_at: string;
  } | null;
  allocated_order: {
    id: string;
    frontend_id: string | null;
    client_company_name: string | null;
  } | null;
  source_type: string | null;
  is_wastage_roll: boolean;
}


export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [currentJumbo, setCurrentJumbo] = useState<any>(null);
  const [jumboHierarchy, setJumboHierarchy] = useState<JumboHierarchy | null>(null);
  const [showJumboDetails, setShowJumboDetails] = useState(false);

  // Cut Rolls Report states
  const [cutRollsStats, setCutRollsStats] = useState<CutRollsStats | null>(null);
  const [cutRollsData, setCutRollsData] = useState<CutRoll[]>([]);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [loadingStats, setLoadingStats] = useState(false);

  // Today Stats states (automatic)
  const [todayStats, setTodayStats] = useState<CutRollsStats | null>(null);
  const [todayData, setTodayData] = useState<CutRoll[]>([]);
  const [loadingTodayStats, setLoadingTodayStats] = useState(false);
  const [todayStatsLastUpdated, setTodayStatsLastUpdated] = useState<string>("");

  // Production Summary states (1-27 of current month)
  const [productionSummary, setProductionSummary] = useState<ProductionSummary | null>(null);
  const [loadingProductionSummary, setLoadingProductionSummary] = useState(false);
  const [productionSummaryLastUpdated, setProductionSummaryLastUpdated] = useState<string>("");

  const router = useRouter();

  // Helper function to get status display info
  const getStatusDisplayInfo = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'available':
        return {
          label: 'Stock',
          icon: <CheckCircle className="w-8 h-8 text-green-600 mb-2" />,
          smallIcon: <CheckCircle className="w-4 h-4 text-green-600" />,
          colorClass: 'border-green-200 bg-green-50',
          textClass: 'text-green-700'
        };
      case 'cutting':
        return {
          label: 'Planned',
          icon: <Scissors className="w-8 h-8 text-blue-600 mb-2" />,
          smallIcon: <Scissors className="w-4 h-4 text-blue-600" />,
          colorClass: 'border-blue-200 bg-blue-50',
          textClass: 'text-blue-700'
        };
      case 'used':
        return {
          label: 'Dispatched',
          icon: <AlertCircle className="w-8 h-8 text-gray-600 mb-2" />,
          smallIcon: <AlertCircle className="w-4 h-4 text-gray-600" />,
          colorClass: 'border-gray-200 bg-gray-50',
          textClass: 'text-gray-700'
        };
      case 'billed':
        return {
          label: 'Billed',
          icon: <CheckCircle className="w-8 h-8 text-purple-600 mb-2" />,
          smallIcon: <CheckCircle className="w-4 h-4 text-purple-600" />,
          colorClass: 'border-purple-200 bg-purple-50',
          textClass: 'text-purple-700'
        };
      case 'removed':
        return {
          label: 'Removed',
          icon: <AlertCircle className="w-8 h-8 text-red-600 mb-2" />,
          smallIcon: <AlertCircle className="w-4 h-4 text-red-600" />,
          colorClass: 'border-red-200 bg-red-50',
          textClass: 'text-red-700'
        };
      default:
        return {
          label: status.charAt(0).toUpperCase() + status.slice(1),
          icon: <Package className="w-8 h-8 text-gray-600 mb-2" />,
          smallIcon: <Package className="w-4 h-4 text-gray-600" />,
          colorClass: 'border-gray-200 bg-gray-50',
          textClass: 'text-gray-700'
        };
    }
  };

  // Fetch today's stats automatically
  const fetchTodayStats = async () => {
    try {
      setLoadingTodayStats(true);

      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayDateStr = today.toISOString().split('T')[0];

      // Get tomorrow's date for production day end (8 AM IST next day)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDateStr = tomorrow.toISOString().split('T')[0];

      const params = new URLSearchParams();
      // From date: 8 AM IST = 2:30 AM UTC on the same day
      params.append('from_production_date', `${todayDateStr}T02:30:00Z`);
      // To date: 8 AM IST next day (covers full production day)
      params.append('to_production_date', `${tomorrowDateStr}T02:30:00Z`);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/reports/cut-rolls-with-stats?${params.toString()}`,
        createRequestOptions('GET')
      );

      if (response.ok) {
        const data = await response.json();
        setTodayStats(data.data.stats);
        setTodayData(data.data.cut_rolls || []);
        setTodayStatsLastUpdated(new Date().toLocaleString());
      } else {
        console.error('Failed to load today stats');
      }
    } catch (error) {
      console.error('Error fetching today stats:', error);
    } finally {
      setLoadingTodayStats(false);
    }
  };

  // Helper function to parse numeric value (handles hyphen format like "4-49990")
  const parseNumericValue = (value: any): number => {
    if (value === null || value === undefined || value === "") return 0;
    const strValue = String(value);
    if (strValue.includes('-')) {
      const parts = strValue.split('-');
      const afterHyphen = parts[parts.length - 1].trim();
      const num = parseFloat(afterHyphen);
      return isNaN(num) ? 0 : num;
    }
    const num = parseFloat(strValue);
    return isNaN(num) ? 0 : num;
  };

  // Fetch production summary for 1-27 of current month
  const fetchProductionSummary = async () => {
    try {
      setLoadingProductionSummary(true);

      // Get current month and year
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();

      // Calculate API date range: 1st to 27th of the current month
      const apiFromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const apiToDate = `${year}-${String(month + 1).padStart(2, '0')}-27`;

      // Fetch all columns
      const response = await fetch(
        PRODUCTION_DATA_ENDPOINTS.PRODUCTION_DATA_REPORT(
          apiFromDate,
          apiToDate
        ),
        {
          headers: { "ngrok-skip-browser-warning": "true" },
        }
      );

      if (!response.ok) {
        console.error("Failed to fetch production summary");
        return;
      }

      const data = await response.json();

      // Initialize totals for all fields
      let totalDay = 0;
      let totalNight = 0;
      let cumulativeTotal = 0;
      let electricity = 0;
      let coal = 0;
      let bhushi = 0;
      let dispatchTon = 0;
      let poTon = 0;
      let waste = 0;
      let starch = 0;
      let guarGum = 0;
      let pac = 0;
      let rct = 0;
      let sSeizing = 0;
      let dFormer = 0;
      let sodiumSilicate = 0;
      let enzyme = 0;
      let dsr = 0;
      let retAid = 0;
      let colourDye = 0;
      let poParty = 0;
      let wastageParty = 0;
      let dispatchParty = 0;
      let shutdownHours = 0;

      // Process all data rows
      data.data?.forEach((row: any) => {
        const dayValue = parseNumericValue(row.production_day);
        const nightValue = parseNumericValue(row.production_night);
        totalDay += dayValue;
        totalNight += nightValue;
        cumulativeTotal += dayValue + nightValue;

        // Sum all other fields
        electricity += parseNumericValue(row.electricity);
        coal += parseNumericValue(row.coal);
        bhushi += parseNumericValue(row.bhushi);
        dispatchTon += parseNumericValue(row.dispatch_ton);
        poTon += parseNumericValue(row.po_ton);
        waste += parseNumericValue(row.waste);
        starch += parseNumericValue(row.starch);
        guarGum += parseNumericValue(row.guar_gum);
        pac += parseNumericValue(row.pac);
        rct += parseNumericValue(row.rct);
        sSeizing += parseNumericValue(row.s_seizing);
        dFormer += parseNumericValue(row.d_former);
        sodiumSilicate += parseNumericValue(row.sodium_silicate);
        enzyme += parseNumericValue(row.enzyme);
        dsr += parseNumericValue(row.dsr);
        retAid += parseNumericValue(row.ret_aid);
        colourDye += parseNumericValue(row.colour_dye);
        poParty += parseNumericValue(row.po_party);
        wastageParty += parseNumericValue(row.wastage_party);
        dispatchParty += parseNumericValue(row.dispatch_party);
        shutdownHours += parseNumericValue(row.shutdown_hours);
      });

      const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
                          "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

      setProductionSummary({
        totalDay,
        totalNight,
        grandTotal: totalDay + totalNight,
        totalProduction: cumulativeTotal,
        electricity,
        coal,
        bhushi,
        dispatchTon,
        poTon,
        waste,
        starch,
        guarGum,
        pac,
        rct,
        sSeizing,
        dFormer,
        sodiumSilicate,
        enzyme,
        dsr,
        retAid,
        colourDye,
        poParty,
        wastageParty,
        dispatchParty,
        shutdownHours,
        monthName: monthNames[month],
        year
      });

      setProductionSummaryLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error("Error fetching production summary:", error);
    } finally {
      setLoadingProductionSummary(false);
    }
  };

  // Fetch cut rolls stats
  const fetchCutRollsStats = async () => {
    if (!fromDate && !toDate) {
      toast.error('Please select at least one date');
      return;
    }

    try {
      setLoadingStats(true);

      const params = new URLSearchParams();

      // Convert IST dates to UTC with 8 AM IST time
      // IST is UTC+5:30, so 8 AM IST = 2:30 AM UTC
      if (fromDate) {
        // From date: 8 AM IST = 2:30 AM UTC on the same day
        params.append('from_production_date', `${fromDate}T02:30:00Z`);
      }

      if (toDate) {
        // To date: 8 AM IST = 2:30 AM UTC on the selected day
        params.append('to_production_date', `${toDate}T02:30:00Z`);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/reports/cut-rolls-with-stats?${params.toString()}`,
        createRequestOptions('GET')
      );

      if (response.ok) {
        const data = await response.json();
        setCutRollsStats(data.data.stats);
        setCutRollsData(data.data.cut_rolls || []);
        toast.success('Stats loaded successfully');
      } else {
        toast.error('Failed to load stats');
      }
    } catch (error) {
      console.error('Error fetching cut rolls stats:', error);
      toast.error('Failed to load cut rolls stats');
    } finally {
      setLoadingStats(false);
    }
  };

  // Generate PDF document (shared function)
  const generatePDFDocument = () => {
    const doc = new jsPDF('landscape');

    // Title
    const reportTitle = 'Cut Rolls Production Report';
    doc.setFontSize(18);
    doc.text(reportTitle, 148, 20, { align: 'center' });

    // Calculate date range
    let dateRangeY = 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    let minProductionDate: Date | null = null;
    let maxProductionDate: Date | null = null;

    cutRollsData.forEach(roll => {
      if (roll.updated_at) {
        const date = new Date(roll.updated_at);
        if (!minProductionDate || date < minProductionDate) minProductionDate = date;
        if (!maxProductionDate || date > maxProductionDate) maxProductionDate = date;
      }
    });

    if (minProductionDate !== null && maxProductionDate !== null) {
      dateRangeY += 4;
      const minDateIST = new Date((minProductionDate as Date).getTime() + (5.5 * 60 * 60 * 1000));
      const maxDateIST = new Date((maxProductionDate as Date).getTime() + (5.5 * 60 * 60 * 1000));
      const minDateStr = `${minDateIST.toLocaleDateString('en-GB')} ${minDateIST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      const maxDateStr = `${maxDateIST.toLocaleDateString('en-GB')} ${maxDateIST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      doc.text(`Production Date: ${minDateStr} to ${maxDateStr}`, 190, dateRangeY - 10);
    }

    dateRangeY += 5;

    // Summary statistics
    const summaryStartY = dateRangeY + 2;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    const totalRolls = cutRollsData.length;
    const totalWeight = cutRollsData.reduce((sum, roll) => sum + roll.weight_kg, 0);
    const stockRolls = cutRollsData.filter(r => r.status.toLowerCase() === 'available').length;
    const dispatchedRolls = cutRollsData.filter(r => r.status.toLowerCase() === 'used').length;
    const weightUpdatedRolls = stockRolls + dispatchedRolls;
    const plannedRolls = cutRollsData.filter(r => r.status.toLowerCase() === 'cutting').length;

    let summaryText = `Total Rolls: ${totalRolls}  |  Total Weight: ${totalWeight.toFixed(2)} kg`;

    if (weightUpdatedRolls > 0) {
      summaryText += `  |  Weight Updated: ${weightUpdatedRolls}`;
    }
    if (stockRolls > 0) {
      summaryText += `  |  Stock: ${stockRolls}`;
    }
    if (plannedRolls > 0) {
      summaryText += `  |  Planned: ${plannedRolls}`;
    }
    if (dispatchedRolls > 0) {
      summaryText += `  |  Dispatched: ${dispatchedRolls}`;
    }

    doc.text(summaryText, 14, summaryStartY);

    const finalY = summaryStartY + 5;

    // Sort by production date and then by width
    const sortedRolls = [...cutRollsData].sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : -Infinity;
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : -Infinity;
      if (dateB !== dateA) {
        return dateA - dateB;
      }
      return a.width_inches - b.width_inches;
    });

    // Prepare table data
    const tableData = sortedRolls.map(roll => {
      let productionDateIST = 'N/A';
      if (roll.updated_at) {
        const utcDate = new Date(roll.updated_at);
        const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
        const dateStr = istDate.toLocaleDateString('en-GB');
        const timeStr = istDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        productionDateIST = `${dateStr} ${timeStr}`;
      }

      return [
        roll.barcode_id || 'N/A',
        `${roll.paper_specs.gsm}GSM, ${roll.paper_specs.bf}BF, ${roll.paper_specs.shade}`,
        `${roll.width_inches}"`,
        roll.weight_kg.toFixed(2),
        roll.status === 'available' ? 'Stock' :
        roll.status === 'cutting' ? 'Planned' :
        roll.status === 'used' ? 'Dispatched' :
        roll.status === 'billed' ? 'Billed' :
        'Removed',
        productionDateIST,
        roll.parent_118_roll?.barcode_id || 'N/A',
        roll.parent_jumbo_roll?.barcode_id || 'N/A',
        roll.plan_info?.frontend_id || 'N/A',
        roll.allocated_order?.frontend_id || 'N/A',
        roll.allocated_order?.client_company_name || 'N/A',
        roll.created_at ? new Date(roll.created_at).toLocaleDateString('en-GB') : 'N/A'
      ];
    });

    // Create table
    autoTable(doc, {
      head: [['Cut Roll ID', 'Paper', 'Width', 'Weight', 'Status', 'Production (IST)', '118" Roll', 'JR Roll', 'Plan ID', 'Order ID', 'Client', 'Created']],
      body: tableData,
      startY: finalY + 5,
      styles: { fontSize: 7, cellPadding: 2.0 },
      headStyles: { fillColor: [66, 66, 66], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 35 },
        2: { cellWidth: 12 },
        3: { cellWidth: 14 },
        4: { cellWidth: 19 },
        5: { cellWidth: 28 },
        6: { cellWidth: 19 },
        7: { cellWidth: 19 },
        8: { cellWidth: 19 },
        9: { cellWidth: 19 },
        10: { cellWidth: 55 },
        11: { cellWidth: 19 },
      },
      margin: { left: 10, right: 10 },
    });

    // Add footer
    const footerY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`, 14, footerY);

    return doc;
  };

  // Download PDF function
  const downloadPDF = () => {
    if (cutRollsData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const doc = generatePDFDocument();
    const filename = `cut-rolls-production-report-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    toast.success('PDF downloaded successfully');
  };

  // Print PDF function
  const printPDF = () => {
    if (cutRollsData.length === 0) {
      toast.error('No data to print');
      return;
    }

    const doc = generatePDFDocument();

    // Open PDF in new window for printing
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl, '_blank');

    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      toast.error('Please allow popups to print the PDF');
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch summary data
      const summaryResponse = await fetch(DASHBOARD_ENDPOINTS.SUMMARY, createRequestOptions('GET'));
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData.summary);
        setLastUpdated(new Date(summaryData.timestamp).toLocaleString());
      }
      
      // Fetch recent activities
      const activitiesResponse = await fetch(DASHBOARD_ENDPOINTS.RECENT_ACTIVITY, createRequestOptions('GET'));
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setActivities(activitiesData.activities);
      }

      // Fetch current jumbo roll
      try {
        const jumboResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/current-jumbo`, createRequestOptions('GET'));
        if (jumboResponse.ok) {
          const jumboData = await jumboResponse.json();
          if (jumboData.current_jumbo) {
            setCurrentJumbo(jumboData.current_jumbo);

            // Fetch hierarchy details for the jumbo roll
            try {
              const hierarchyData = await trackRollHierarchy(jumboData.current_jumbo.jumbo_barcode_id);
              if (hierarchyData.roll_type === 'jumbo') {
                setJumboHierarchy(hierarchyData.hierarchy as JumboHierarchy);
              }
            } catch (error) {
              console.error('Error fetching jumbo hierarchy:', error);
            }
          } else {
            setCurrentJumbo(null);
            setJumboHierarchy(null);
          }
        }
      } catch (error) {
        console.error('Error fetching current jumbo:', error);
      }


    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        router.push("/auth/login");
      } else {
        await fetchDashboardData();
      }
    };

    checkAuth();
  }, [router]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchDashboardData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading]);

  // Fetch today's stats on mount and auto-refresh every 30 minutes
  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        fetchTodayStats();
      }
    };

    checkAuth();

    // Auto-refresh every 30 minutes (1800000 ms)
    const interval = setInterval(() => {
      fetchTodayStats();
    }, 1800000);

    return () => clearInterval(interval);
  }, []);

  // Fetch production summary on mount and auto-refresh every 15 minutes
  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        fetchProductionSummary();
      }
    };

    checkAuth();

    // Auto-refresh every 15 minutes (900000 ms)
    const interval = setInterval(() => {
      fetchProductionSummary();
    }, 900000);

    return () => clearInterval(interval);
  }, []);

  if (loading || !summary) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <Activity className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
          <h1 className="text-2xl font-bold">Loading Dashboard...</h1>
          <p className="text-muted-foreground">Fetching real-time data</p>
        </div>
      </div>
    );
  }

  // Dynamic stats from API
  const stats = [
    {
      title: "Total Orders",
      value: summary.orders.total.toLocaleString(),
      subValue: `${summary.orders.completion_rate}% completed`,
      icon: ShoppingCart,
      color: "blue",
      details: [
        { label: "Pending", value: summary.orders.pending },
        { label: "Processing", value: summary.orders.processing },
        { label: "Completed", value: summary.orders.completed }
      ]
    },
    {
      title: "Pending Items",
      value: summary.pending_items.total_items.toLocaleString(),
      subValue: `${summary.pending_items.total_quantity} rolls total`,
      icon: Clock,
      color: summary.pending_items.high_priority > 0 ? "red" : "yellow",
      details: [
        { label: "High Priority", value: summary.pending_items.high_priority },
        { label: "Total Quantity", value: summary.pending_items.total_quantity }
      ]
    },
    {
      title: "Production Plans",
      value: summary.plans.total.toLocaleString(),
      subValue: `${summary.plans.success_rate}% success rate`,
      icon: Scissors,
      color: "green",
      details: [
        { label: "Planned", value: summary.plans.planned },
        { label: "In Progress", value: summary.plans.in_progress },
        { label: "Completed", value: summary.plans.completed }
      ]
    },
    {
      title: "Inventory",
      value: summary.inventory.total_available.toLocaleString(),
      subValue: `${summary.inventory.jumbo_rolls} jumbo rolls`,
      icon: Package,
      color: summary.inventory.jumbo_rolls < 5 ? "red" : "purple",
      details: [
        { label: "Jumbo Rolls", value: summary.inventory.jumbo_rolls },
        { label: "Cut Rolls", value: summary.inventory.cut_rolls }
      ]
    },
    {
      title: "Production Orders",
      value: summary.production.total.toLocaleString(),
      subValue: `${summary.production.efficiency}% efficiency`,
      icon: Factory,
      color: "indigo",
      details: [
        { label: "Pending", value: summary.production.pending },
        { label: "In Progress", value: summary.production.in_progress },
        { label: "Completed", value: summary.production.completed }
      ]
    },
    {
      title: "System Activity",
      value: summary.activity.active_clients.toLocaleString(),
      subValue: `of ${summary.activity.total_clients} clients`,
      icon: Activity,
      color: "teal",
      details: [
        { label: "Recent Orders", value: summary.activity.recent_orders },
        { label: "Recent Plans", value: summary.activity.recent_plans },
        { label: "Paper Types", value: summary.activity.paper_types }
      ]
    }
  ];

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case "package": return Package;
      case "scissors": return Scissors;
      case "factory": return Factory;
      default: return Activity;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
      case "created":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Created</Badge>;
      case "processing":
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Progress</Badge>;
      case "planned":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Planned</Badge>;
      case "pending":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };


  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue": return "border-blue-200 bg-blue-50";
      case "red": return "border-red-200 bg-red-50";
      case "green": return "border-green-200 bg-green-50";
      case "yellow": return "border-yellow-200 bg-yellow-50";
      case "purple": return "border-purple-200 bg-purple-50";
      case "indigo": return "border-indigo-200 bg-indigo-50";
      case "teal": return "border-teal-200 bg-teal-50";
      default: return "border-gray-200 bg-gray-50";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-primary" />
              Live Dashboard
            </h1>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="w-4 h-4" />
              Last updated: {lastUpdated}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchDashboardData}
              className="mt-2"
            >
              <Zap className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>


        {/* Stats Cards - Compact */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {stats.slice(0,3).map((stat, index) => (
            <div key={index} className={`hover-lift  p-2 border-2 rounded-lg transition-all duration-300 ${getColorClasses(stat.color)}`}>
              {/* <CardContent className="p-4"> */}
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium truncate">{stat.title}</span>
                </div>
                <div className="text-xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground truncate">{stat.subValue}</p>
              {/* </CardContent> */}
            </div>
          ))}
        </div>

        {/* Current Jumbo Roll */}
        {currentJumbo && jumboHierarchy && (
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Package className="w-6 h-6 text-blue-600" />
                    Current Jumbo Roll in Machine
                  </CardTitle>
                  <CardDescription className="font-mono text-4xl font-semibold mt-1">
                    {currentJumbo.jumbo_barcode_id}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Set on</div>
                  <div className="text-xs text-muted-foreground">{new Date(currentJumbo.created_at).toLocaleString()}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Collapsible Jumbo Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      Jumbo Roll Details
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowJumboDetails(!showJumboDetails)}
                      className="text-xs"
                    >
                      {showJumboDetails ? 'Hide Details' : 'Show Details'}
                      <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showJumboDetails ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                  
                  {showJumboDetails && (
                    <div className="space-y-4 animate-in slide-in-from-top-1 duration-300">
                      {/* Jumbo Details */}
                      <div className="space-y-3 p-4 bg-white rounded-lg border">
                        <h5 className="font-semibold text-sm flex items-center gap-2">
                          <Package className="w-4 h-4 text-blue-600" />
                          Jumbo Roll Specifications
                        </h5>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Width:</span>
                            <span className="font-medium">{jumboHierarchy.jumbo_roll.width_inches}"</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Weight:</span>
                            <span className="font-medium">{jumboHierarchy.jumbo_roll.weight_kg} kg</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total SETs:</span>
                            <span className="font-semibold text-purple-600">{jumboHierarchy.total_sets}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Cuts:</span>
                            <span className="font-semibold text-green-600">{jumboHierarchy.total_cut_rolls}</span>
                          </div>
                        </div>
                      </div>

                      {/* SET Rolls */}
                      {/* <div className="space-y-3 p-4 bg-white rounded-lg border">
                        <h5 className="font-semibold text-sm flex items-center gap-2">
                          <Scissors className="w-4 h-4 text-purple-600" />
                          SET Rolls ({jumboHierarchy.intermediate_rolls.length})
                        </h5>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {jumboHierarchy.intermediate_rolls.slice(0, 5).map((setRoll, idx) => (
                            <div key={setRoll.id} className="text-xs font-mono bg-gray-50 p-2 rounded border">
                              {setRoll.barcode_id} <span className="text-muted-foreground">({setRoll.cut_rolls_count} cuts)</span>
                            </div>
                          ))}
                          {jumboHierarchy.intermediate_rolls.length > 5 && (
                            <div className="text-xs text-muted-foreground text-center py-1">
                              +{jumboHierarchy.intermediate_rolls.length - 5} more SETs
                            </div>
                          )}
                        </div>
                      </div> */}

                      {/* Cut Rolls - Show all cut rolls from all SET rolls */}
                      <div className="space-y-3 p-4 bg-white rounded-lg border">
                        <h5 className="font-semibold text-sm flex items-center gap-2">
                          <Scissors className="w-4 h-4 text-green-600" />
                          Cut Rolls (All SETs)
                        </h5>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {jumboHierarchy.intermediate_rolls.map((setRoll) =>
                            setRoll.cut_rolls?.map((cutRoll) => (
                              <div key={cutRoll.id} className="text-xs font-mono bg-gray-50 p-2 rounded border">
                                <span className="text-purple-600">[{setRoll.barcode_id}]</span> {cutRoll.barcode_id} <span className="text-muted-foreground">({cutRoll.width_inches}")</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* Jumbo Details */}
                {/* <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    Jumbo Roll
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Width:</span>
                      <span className="font-medium">{jumboHierarchy.jumbo_roll.width_inches}"</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Weight:</span>
                      <span className="font-medium">{jumboHierarchy.jumbo_roll.weight_kg} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total SETs:</span>
                      <span className="font-semibold text-purple-600">{jumboHierarchy.total_sets}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Cuts:</span>
                      <span className="font-semibold text-green-600">{jumboHierarchy.total_cut_rolls}</span>
                    </div>
                  </div>
                </div> */}

                {/* SET Rolls */}
                {/* <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-purple-600" />
                    SET Rolls ({jumboHierarchy.intermediate_rolls.length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {jumboHierarchy.intermediate_rolls.slice(0, 5).map((setRoll, idx) => (
                      <div key={setRoll.id} className="text-xs font-mono bg-white p-2 rounded border">
                        {setRoll.barcode_id} <span className="text-muted-foreground">({setRoll.cut_rolls_count} cuts)</span>
                      </div>
                    ))}
                    {jumboHierarchy.intermediate_rolls.length > 5 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        +{jumboHierarchy.intermediate_rolls.length - 5} more SETs
                      </div>
                    )}
                  </div>
                </div> */}

                {/* Cut Rolls */}
                {/* <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-green-600" />
                    Sample Cut Rolls
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {jumboHierarchy.intermediate_rolls[0]?.cut_rolls.slice(0, 5).map((cutRoll) => (
                      <div key={cutRoll.id} className="text-xs font-mono bg-white p-2 rounded border">
                        {cutRoll.barcode_id} <span className="text-muted-foreground">({cutRoll.width_inches}")</span>
                      </div>
                    ))}
                    {jumboHierarchy.total_cut_rolls > 5 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        +{jumboHierarchy.total_cut_rolls - 5} more cuts
                      </div>
                    )}
                  </div>
                </div> */}
              </div>
              {/* <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/barcode-lookup?barcode=${currentJumbo.jumbo_barcode_id}`)}
                >
                  View Full Hierarchy
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div> */}
            </CardContent>
          </Card>
        )}

        {/* Today Stats Card - Automatic */}
        <div className="border-blue-200 p-3 space-y-2 shadow-lg rounded-lg border bg-gradient-to-r from-blue-50 to-cyan-50">
          {/* <CardHeader> */}
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Activity className="w-6 h-6 text-blue-600" />
                  Today's Production Stats (Live)
                </CardTitle>
                <CardDescription>Automatic statistics for today starting from 8:00 AM IST • Updates every 30 minutes</CardDescription>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {todayStatsLastUpdated && `Updated: ${todayStatsLastUpdated}`}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchTodayStats}
                  disabled={loadingTodayStats}
                  className="mt-2"
                >
                  {loadingTodayStats ? (
                    <>
                      <Activity className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Refresh Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          {/* </CardHeader> */}
          <CardContent>
            {loadingTodayStats && !todayStats ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 mx-auto text-blue-600 mb-2 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading today's statistics...</p>
              </div>
            ) : todayStats ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {/* Total Rolls */}
                <div className="border-2 rounded-lg p-4 border-blue-200 bg-blue-50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-muted-foreground">Total Rolls</span>
                  </div>
                  <p className="text-xl font-bold text-blue-700">{todayStats.total_rolls.toLocaleString()}</p>
                </div>

                {/* Total Weight */}
                <div className="border-2 rounded-lg p-2 border-purple-200 bg-purple-50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Weight className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-medium text-muted-foreground">Total Weight</span>
                  </div>
                  <p className="text-xl font-bold text-purple-700">{todayStats.total_weight_kg.toLocaleString()} kg</p>
                </div>

                {/* Dynamic Status Cards */}
                {Object.entries(todayStats.status_breakdown).map(([status, count]) => {
                  const displayInfo = getStatusDisplayInfo(status);
                  return (
                    <div key={status} className={`border-2 rounded-lg p-2 ${displayInfo.colorClass}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {displayInfo.smallIcon}
                        <span className="text-xs font-medium text-muted-foreground">{displayInfo.label}</span>
                      </div>
                      <p className={`text-xl font-bold ${displayInfo.textClass}`}>{count}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-blue-200 rounded-lg bg-white">
                <FileText className="w-12 h-12 mx-auto text-blue-600 mb-2" />
                <p className="text-sm text-muted-foreground">No production data available for today yet</p>
              </div>
            )}
          </CardContent>
        </div>

        {/* Monthly Production Summary Card - Auto refresh every 15 minutes */}
        <div className="border-orange-200 p-3 space-y-1 shadow-lg rounded-lg border bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Factory className="w-6 h-6 text-orange-600" />
                {productionSummary ? `${productionSummary.monthName}-${String(productionSummary.year).slice(-2)} PRODUCTION` : 'Monthly Production Summary'}
              </CardTitle>
              <CardDescription>Production totals for dates 1-27 of current month • Updates every 15 minutes</CardDescription>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {productionSummaryLastUpdated && `Updated: ${productionSummaryLastUpdated}`}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchProductionSummary}
                disabled={loadingProductionSummary}
                className="mt-2"
              >
                {loadingProductionSummary ? (
                  <>
                    <Activity className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Refresh Now
                  </>
                )}
              </Button>
            </div>
          </div>
          <CardContent>
            {loadingProductionSummary && !productionSummary ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 mx-auto text-orange-600 mb-2 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading production summary...</p>
              </div>
            ) : productionSummary ? (
              <div className="space-y-2">
                {/* Primary Production Stats - Row 1 */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Production Day */}
                  <div className="border-2 rounded-lg p-3 border-yellow-300 bg-yellow-50">
                    <span className="text-xs font-bold text-muted-foreground">PRODUCTION DAY</span>
                    <p className="text-xl font-bold text-yellow-700">{productionSummary.totalDay.toLocaleString()}</p>
                  </div>

                  {/* Production Night */}
                  <div className="border-2 rounded-lg p-3 border-indigo-300 bg-indigo-50">
                    <span className="text-xs font-bold text-muted-foreground">PRODUCTION NIGHT</span>
                    <p className="text-xl font-bold text-indigo-700">{productionSummary.totalNight.toLocaleString()}</p>
                  </div>

                  {/* Total Production */}
                  <div className="border-2 rounded-lg p-3 border-orange-300 bg-orange-100">
                    <span className="text-xs font-bold text-muted-foreground">TOTAL PRODUCTION</span>
                    <p className="text-xl font-bold text-orange-700">{productionSummary.totalProduction.toLocaleString()}</p>
                  </div>
                </div>

                {/* Other Fields - Row 2 */}
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">ELECTRICITY</span>
                    <p className="text-sm font-bold">{productionSummary.electricity.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">COAL</span>
                    <p className="text-sm font-bold">{productionSummary.coal.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">BHUSHI</span>
                    <p className="text-sm font-bold">{productionSummary.bhushi.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">DISPATCH PARTY</span>
                    <p className="text-sm font-bold">{productionSummary.dispatchParty.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">DISPATCH TON</span>
                    <p className="text-sm font-bold">{productionSummary.dispatchTon.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">PO PARTY</span>
                    <p className="text-sm font-bold">{productionSummary.poParty.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">PO TON</span>
                    <p className="text-sm font-bold">{productionSummary.poTon.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">WASTAGE PARTY</span>
                    <p className="text-sm font-bold">{productionSummary.wastageParty.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">WASTE</span>
                    <p className="text-sm font-bold">{productionSummary.waste.toLocaleString()}</p>
                  </div>
                </div>

                {/* Other Fields - Row 3 */}
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">STARCH</span>
                    <p className="text-sm font-bold">{productionSummary.starch.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">GUAR GUM</span>
                    <p className="text-sm font-bold">{productionSummary.guarGum.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">PAC</span>
                    <p className="text-sm font-bold">{productionSummary.pac.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">SHUTDOWN HOURS</span>
                    <p className="text-sm font-bold">{productionSummary.shutdownHours.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">RCT</span>
                    <p className="text-sm font-bold">{productionSummary.rct.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">S.SEIZING</span>
                    <p className="text-sm font-bold">{productionSummary.sSeizing.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">D.FORMER</span>
                    <p className="text-sm font-bold">{productionSummary.dFormer.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">SODIUM SILICATE</span>
                    <p className="text-sm font-bold">{productionSummary.sodiumSilicate.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">ENZYME</span>
                    <p className="text-sm font-bold">{productionSummary.enzyme.toLocaleString()}</p>
                  </div>
                </div>

                {/* Other Fields - Row 4 */}
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">D.S.R.</span>
                    <p className="text-sm font-bold">{productionSummary.dsr.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">RET.AID</span>
                    <p className="text-sm font-bold">{productionSummary.retAid.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <span className="text-[10px] font-semibold text-muted-foreground">COLOUR DYE</span>
                    <p className="text-sm font-bold">{productionSummary.colourDye.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-orange-200 rounded-lg bg-white">
                <Factory className="w-12 h-12 mx-auto text-orange-600 mb-2" />
                <p className="text-sm text-muted-foreground">No production data available for this month</p>
              </div>
            )}
          </CardContent>
        </div>

        {/* Cut Rolls Report Card */}
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileText className="w-6 h-6 text-green-600" />
              Cut Rolls Production Report
            </CardTitle>
            <CardDescription>View statistics for cut rolls by production date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Date Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={fetchCutRollsStats}
                    disabled={loadingStats}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {loadingStats ? (
                      <>
                        <Activity className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Apply
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Stats Display */}
              {cutRollsStats && (
                <div className="space-y-4">
                  {/* Export and Print Buttons */}
                  <div className="flex justify-end gap-3">
                    <Button
                      onClick={downloadPDF}
                      variant="outline"
                      className="bg-white hover:bg-gray-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                    <Button
                      onClick={printPDF}
                      variant="outline"
                      className="bg-white hover:bg-gray-50"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print PDF
                    </Button>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {/* Total Rolls */}
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                          <Package className="w-8 h-8 text-blue-600 mb-2" />
                          <p className="text-sm font-medium text-muted-foreground">Total Rolls</p>
                          <p className="text-3xl font-bold text-blue-700 mt-1">{cutRollsStats.total_rolls.toLocaleString()}</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Total Weight */}
                    <Card className="border-purple-200 bg-purple-50">
                      <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                          <Weight className="w-8 h-8 text-purple-600 mb-2" />
                          <p className="text-sm font-medium text-muted-foreground">Total Weight</p>
                          <p className="text-3xl font-bold text-purple-700 mt-1">{cutRollsStats.total_weight_kg.toLocaleString()} kg</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Dynamic Status Cards */}
                    {Object.entries(cutRollsStats.status_breakdown).map(([status, count]) => {
                      const displayInfo = getStatusDisplayInfo(status);
                      return (
                        <Card key={status} className={displayInfo.colorClass}>
                          <CardContent className="pt-6">
                            <div className="flex flex-col items-center text-center">
                              {displayInfo.icon}
                              <p className="text-sm font-medium text-muted-foreground">{displayInfo.label}</p>
                              <p className={`text-3xl font-bold mt-1 ${displayInfo.textClass}`}>{count}</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!cutRollsStats && (
                <div className="text-center py-8 border-2 border-dashed border-green-200 rounded-lg bg-white">
                  <FileText className="w-12 h-12 mx-auto text-green-600 mb-2" />
                  <p className="text-sm text-muted-foreground">Select dates and click Apply to view statistics</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Latest system activities and events</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchDashboardData()}>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.length > 0 ? activities.map((activity) => {
                  const IconComponent = getActivityIcon(activity.icon);
                  return (
                    <div key={activity.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="p-2 rounded-full bg-primary/10">
                        <IconComponent className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{activity.title}</span>
                          {getStatusBadge(activity.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/orders/new')}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                New Order
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/pending-orders')}
              >
                <Clock className="w-4 h-4 mr-2" />
                Pending Orders
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/plans')}
              >
                <Scissors className="w-4 h-4 mr-2" />
                Production Plans
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/masters/clients')}
              >
                <Users className="w-4 h-4 mr-2" />
                Manage Clients
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}