"use client";

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSearch } from '@/components/ui/select';
import { MaterialReactTable, useMaterialReactTable, MRT_ColumnDef } from 'material-react-table';
import { Package, Download, Filter, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText } from 'lucide-react';
import { createRequestOptions } from '@/lib/api-config';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OrderDetailsModal } from '@/components/OrderDetailsModal';
import { PlanDetailsModal } from '@/components/PlanDetailsModal';
import { BarcodeDetailsModal } from '@/components/BarcodeDetailsModal';

type CutRoll = {
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
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AllCutRollsReportPage() {
  const [cutRolls, setCutRolls] = useState<CutRoll[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 500;

  // Client-side filter states
  const [omniSearch, setOmniSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paperNameFilter, setPaperNameFilter] = useState<string>('');
  const [gsmFilter, setGsmFilter] = useState<string>('');
  const [widthFilter, setWidthFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [fromProductionDateTime, setFromProductionDateTime] = useState<string>('');
  const [toProductionDateTime, setToProductionDateTime] = useState<string>('');

  // Search states for dropdowns
  const [statusSearch, setStatusSearch] = useState('');
  const [planSearch, setPlanSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  // Modal states
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedBarcodeId, setSelectedBarcodeId] = useState<string | null>(null);
  const [selectedIsWastage, setSelectedIsWastage] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);

  // Fetch data with pagination
  const fetchData = async (page: number) => {
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/reports/all-cut-rolls?page=${page}&page_size=${pageSize}`;
      const response = await fetch(url, createRequestOptions('GET'));
      const result = await response.json();

      if (result.success && result.data) {
        setCutRolls(result.data.cut_rolls);
        setTotalPages(result.data.pagination.total_pages);
        setTotalItems(result.data.pagination.total_items);
        setCurrentPage(result.data.pagination.current_page);
      }
    } catch (error) {
      console.error('Error fetching cut rolls:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchData(1);
  }, []);

  // Apply client-side filters on current page data
  const filteredCutRolls = useMemo(() => {
    let filtered = [...cutRolls];

    // Omni search - searches across barcode_id, paper name, client, order, plan
    if (omniSearch && omniSearch.trim()) {
      const searchLower = omniSearch.toLowerCase().trim();
      filtered = filtered.filter(roll => {
        return (
          roll.barcode_id?.toLowerCase().includes(searchLower) ||
          roll.paper_specs.paper_name?.toLowerCase().includes(searchLower) ||
          roll.allocated_order?.client_company_name?.toLowerCase().includes(searchLower) ||
          roll.allocated_order?.frontend_id?.toLowerCase().includes(searchLower) ||
          roll.plan_info?.frontend_id?.toLowerCase().includes(searchLower) ||
          roll.parent_118_roll?.barcode_id?.toLowerCase().includes(searchLower) ||
          roll.parent_jumbo_roll?.barcode_id?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Production date range filter (based on updated_at)
    // Convert IST datetime to UTC for comparison with database timestamps
    if (fromProductionDateTime) {
      // Parse datetime-local value (format: YYYY-MM-DDTHH:mm)
      const istDateTime = new Date(fromProductionDateTime);
      // Convert IST to UTC (IST is UTC+5:30)
      const utcDateTime = new Date(istDateTime.getTime() - (5.5 * 60 * 60 * 1000));

      filtered = filtered.filter(roll => {
        if (!roll.updated_at) return false;
        const rollDate = new Date(roll.updated_at);
        return rollDate >= utcDateTime;
      });
    }

    if (toProductionDateTime) {
      // Parse datetime-local value (format: YYYY-MM-DDTHH:mm)
      const istDateTime = new Date(toProductionDateTime);
      // Add 59 seconds and 999ms to include the full minute
      istDateTime.setSeconds(59, 999);
      // Convert IST to UTC (IST is UTC+5:30)
      const utcDateTime = new Date(istDateTime.getTime() - (5.5 * 60 * 60 * 1000));

      filtered = filtered.filter(roll => {
        if (!roll.updated_at) return false;
        const rollDate = new Date(roll.updated_at);
        return rollDate <= utcDateTime;
      });
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'weight_updated') {
        // Weight Updated = available + used
        filtered = filtered.filter(roll =>
          roll.status.toLowerCase() === 'available' || roll.status.toLowerCase() === 'used'
        );
      } else {
        filtered = filtered.filter(roll => roll.status.toLowerCase() === statusFilter.toLowerCase());
      }
    }

    // Paper name filter
    if (paperNameFilter) {
      filtered = filtered.filter(roll =>
        roll.paper_specs.paper_name.toLowerCase().includes(paperNameFilter.toLowerCase())
      );
    }

    // GSM filter
    if (gsmFilter) {
      filtered = filtered.filter(roll =>
        roll.paper_specs.gsm.toString().includes(gsmFilter)
      );
    }

    // Width filter
    if (widthFilter) {
      filtered = filtered.filter(roll =>
        roll.width_inches.toString().includes(widthFilter)
      );
    }

    // Location filter
    if (locationFilter) {
      filtered = filtered.filter(roll =>
        roll.location.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    // Client filter
    if (clientFilter && clientFilter !== 'all') {
      filtered = filtered.filter(roll =>
        roll.allocated_order?.client_company_name?.toLowerCase() === clientFilter.toLowerCase()
      );
    }

    // Order filter
    if (orderFilter && orderFilter !== 'all') {
      filtered = filtered.filter(roll =>
        roll.allocated_order?.frontend_id === orderFilter
      );
    }

    // Plan filter
    if (planFilter && planFilter !== 'all') {
      filtered = filtered.filter(roll =>
        roll.plan_info?.frontend_id === planFilter
      );
    }

    return filtered;
  }, [cutRolls, omniSearch, statusFilter, paperNameFilter, gsmFilter, widthFilter, locationFilter, clientFilter, orderFilter, planFilter, fromProductionDateTime, toProductionDateTime]);

  // Clear all filters
  const clearFilters = () => {
    setOmniSearch('');
    setStatusFilter('all');
    setPaperNameFilter('');
    setGsmFilter('');
    setWidthFilter('');
    setLocationFilter('');
    setClientFilter('all');
    setOrderFilter('all');
    setPlanFilter('all');
    setFromProductionDateTime('');
    setToProductionDateTime('');
  };

  // Get unique clients, orders, and plans for filter dropdowns (sorted)
  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    cutRolls.forEach(roll => {
      if (roll.allocated_order?.client_company_name) {
        clients.add(roll.allocated_order.client_company_name);
      }
    });
    return Array.from(clients).sort((a, b) => a.localeCompare(b));
  }, [cutRolls]);

  const uniqueOrders = useMemo(() => {
    const orders = new Set<string>();
    cutRolls.forEach(roll => {
      if (roll.allocated_order?.frontend_id) {
        orders.add(roll.allocated_order.frontend_id);
      }
    });
    return Array.from(orders).sort((a, b) => a.localeCompare(b));
  }, [cutRolls]);

  const uniquePlans = useMemo(() => {
    const plans = new Set<string>();
    cutRolls.forEach(roll => {
      if (roll.plan_info?.frontend_id) {
        plans.add(roll.plan_info.frontend_id);
      }
    });
    return Array.from(plans).sort((a, b) => a.localeCompare(b));
  }, [cutRolls]);

  // Pagination handlers
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      fetchData(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      fetchData(currentPage - 1);
    }
  };

  const handleGoToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchData(page);
    }
  };

  // Helper function to convert UTC to IST
  const convertUTCtoIST = (utcDateString: string) => {
    const utcDate = new Date(utcDateString);
    // Add 5 hours 30 minutes for IST
    const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
    return istDate;
  };

  // Helper function to format datetime in IST
  const formatISTDateTime = (utcDateString: string) => {
    const istDate = convertUTCtoIST(utcDateString);
    const date = istDate.toLocaleDateString('en-GB');
    const time = istDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date} ${time}`;
  };

  // Export to PDF function
  const exportToPDF = () => {
    const doc = new jsPDF('landscape');

    // Generate dynamic title based on filters
    let reportTitle = '';

    // Add client name if filter is active
    if (clientFilter && clientFilter !== 'all') {
      reportTitle = clientFilter + ' ';
    }

    // Add status-based name
    if (statusFilter && statusFilter !== 'all') {
      const statusName = statusFilter === 'weight_updated' ? 'Weight Updated' :
                         statusFilter === 'available' ? 'Stock' :
                         statusFilter === 'cutting' ? 'Planned' :
                         statusFilter === 'used' ? 'Dispatched' :
                         statusFilter;
      reportTitle += statusName + ' Rolls Report';
    } else {
      reportTitle += 'All Rolls Report';
    }

    // Add title
    doc.setFontSize(18);
    doc.text(reportTitle, 148, 20, { align: 'center' });


    // Calculate date ranges from actual data
    let minCreatedDate: Date | null = null;
    let maxCreatedDate: Date | null = null;
    let minProductionDate: Date | null = null;
    let maxProductionDate: Date | null = null;

    filteredCutRolls.forEach(roll => {
      if (roll.created_at) {
        const date = new Date(roll.created_at);
        if (!minCreatedDate || date < minCreatedDate) minCreatedDate = date;
        if (!maxCreatedDate || date > maxCreatedDate) maxCreatedDate = date;
      }
      if (roll.updated_at) {
        const date = new Date(roll.updated_at);
        if (!minProductionDate || date < minProductionDate) minProductionDate = date;
        if (!maxProductionDate || date > maxProductionDate) maxProductionDate = date;
      }
    });

    // Calculate summary statistics from filtered data
    const totalRolls = filteredCutRolls.length;
    const totalWeight = filteredCutRolls.reduce((sum, roll) => sum + roll.weight_kg, 0);
    const stockRolls = filteredCutRolls.filter(r => r.status.toLowerCase() === 'available').length;
    const dispatchedRolls = filteredCutRolls.filter(r => r.status.toLowerCase() === 'used').length;
    const weightUpdatedRolls = stockRolls + dispatchedRolls; // Weight Updated = Stock + Dispatched
    const plannedRolls = filteredCutRolls.filter(r => r.status.toLowerCase() === 'cutting').length;

    // Add date range section
    let dateRangeY = 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);


    if (minProductionDate !== null && maxProductionDate !== null) {
      dateRangeY += 4;
      // Convert UTC to IST and show with time
      const minDateIST = new Date((minProductionDate as Date).getTime() + (5.5 * 60 * 60 * 1000));
      const maxDateIST = new Date((maxProductionDate as Date).getTime() + (5.5 * 60 * 60 * 1000));
      const minDateStr = `${minDateIST.toLocaleDateString('en-GB')} ${minDateIST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      const maxDateStr = `${maxDateIST.toLocaleDateString('en-GB')} ${maxDateIST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      doc.text(`Production Date: ${minDateStr} to ${maxDateStr}`, 190, dateRangeY -10);
    }

    dateRangeY += 5;

    // Add summary section
    const summaryStartY = dateRangeY + 2;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    // Build summary text in one line
    let summaryText = `Total Rolls: ${totalRolls}  |  Total Weight: ${totalWeight.toFixed(2)} kg`;

    // Only add status-specific info if they have values
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

    // Sort by production date and then by width (ascending)
    const sortedRolls = [...filteredCutRolls].sort((a, b) => {
      // First sort by production date (updated_at) - null dates come first
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : -Infinity;
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : -Infinity;
      if (dateB !== dateA) {
        return dateA - dateB; 
      }
      // If dates are equal, sort by width (ascending)
      return a.width_inches - b.width_inches;
    });

    // Prepare table data from filtered results
    const tableData = sortedRolls.map(roll => {
      // Convert production date (updated_at) to IST with time
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
        0: { cellWidth: 20 },  // Cut Roll ID
        1: { cellWidth: 35 },  // Paper
        2: { cellWidth: 12 },  // Width
        3: { cellWidth: 14 },  // Weight
        4: { cellWidth: 19 },  // Status
        5: { cellWidth: 28 },  // Production Date with time (IST)
        6: { cellWidth: 19 },  // 118" Roll
        7: { cellWidth: 19 },  // Jumbo Roll
        8: { cellWidth: 19 },  // Plan ID
        9: { cellWidth: 19 },  // Order ID
        10: { cellWidth: 55 }, // Client
        11: { cellWidth: 19 }, // Created
      },
      margin: { left: 10, right: 10 },
    });

    // Add footer with timestamps
    const footerY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    let footerText = `Generated on: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`;

    if (minCreatedDate !== null && maxCreatedDate !== null) {
      footerText += `  |  Created at: ${(minCreatedDate as Date).toLocaleDateString('en-GB')} to ${(maxCreatedDate as Date).toLocaleDateString('en-GB')}`;
    }

    doc.text(footerText, 14, footerY);

    // Save the PDF
    doc.save(`cut-rolls-report-page-${currentPage}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Table columns definition
  const columns = useMemo<MRT_ColumnDef<CutRoll>[]>(() => [
    {
      accessorKey: 'barcode_id',
      header: 'Cut Roll ID',
      size: 140,
      Cell: ({ row }) => {
        const barcodeId = row.original.barcode_id;
        const isWastage = row.original.is_wastage_roll;

        // Make all barcodes clickable to show dispatch info
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBarcodeId(barcodeId);
              setSelectedIsWastage(isWastage);
              setBarcodeModalOpen(true);
            }}
            className="font-mono font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          >
            {barcodeId}
          </button>
        );
      },
    },
    {
      accessorKey: 'paper_specs.paper_name',
      header: 'Paper',
      size: 200,
      Cell: ({ row }) => {
        const specs = row.original.paper_specs;
        return (
          <div>
            <div className="font-medium">{specs.paper_name}</div>
            <div className="text-xs text-muted-foreground">
              {specs.gsm}GSM, {specs.bf}BF, {specs.shade}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'width_inches',
      header: 'Width',
      size: 100,
      Cell: ({ cell }) => `${cell.getValue<number>()}"`,
    },
    {
      accessorKey: 'weight_kg',
      header: 'Weight (kg)',
      size: 120,
      Cell: ({ cell }) => cell.getValue<number>().toFixed(2),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 120,
      Cell: ({ cell }) => {
        const status = cell.getValue<string>();
        const colorMap: Record<string, string> = {
          'available': 'bg-green-100 text-green-800',
          'allocated': 'bg-blue-100 text-blue-800',
          'cutting': 'bg-yellow-100 text-yellow-800',
          'used': 'bg-gray-100 text-gray-800',
          'damaged': 'bg-red-100 text-red-800',
        };
        return (
          <Badge className={colorMap[status.toLowerCase()] || 'bg-gray-100 text-gray-800'}>
            {status === 'available' ? 'Stock' :
             status === 'cutting' ? 'Planned' :
             status === 'used' ? 'Dispatched' :
             status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'updated_at',
      header: 'Production Date',
      size: 180,
      Cell: ({ cell }) => {
        const date = cell.getValue<string>();
        if (!date) return 'N/A';

        // Convert UTC to IST and show with time in AM/PM format
        const utcDate = new Date(date);
        const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
        const dateStr = istDate.toLocaleDateString('en-GB');
        const timeStr = istDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        return `${dateStr}  ${timeStr}`;
      },
    },
    {
      accessorKey: 'parent_118_roll.barcode_id',
      header: '118" Roll ID',
      size: 140,
      Cell: ({ row }) => {
        const roll118 = row.original.parent_118_roll;
        return roll118 ? (
          <span className="font-mono text-xs">{roll118.barcode_id}</span>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
    },
    {
      accessorKey: 'parent_jumbo_roll.barcode_id',
      header: 'Jumbo Roll ID',
      size: 140,
      Cell: ({ row }) => {
        const jumbo = row.original.parent_jumbo_roll;
        return jumbo ? (
          <span className="font-mono text-xs">{jumbo.barcode_id}</span>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
    },
    {
      accessorKey: 'plan_info.frontend_id',
      header: 'Plan ID',
      size: 130,
      Cell: ({ row }) => {
        const plan = row.original.plan_info;
        return plan ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPlanId(plan.frontend_id);
              setPlanModalOpen(true);
            }}
            className="text-left hover:opacity-80"
          >
            <div className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">{plan.frontend_id}</div>
            <div className="text-xs text-muted-foreground">{plan.name}</div>
          </button>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
    },
    {
      accessorKey: 'allocated_order.frontend_id',
      header: 'Order ID',
      size: 130,
      Cell: ({ row }) => {
        const order = row.original.allocated_order;
        return order ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOrderId(order.frontend_id);
              setOrderModalOpen(true);
            }}
            className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          >
            {order.frontend_id}
          </button>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
    },
    {
      accessorKey: 'allocated_order.client_company_name',
      header: 'Client',
      size: 180,
      Cell: ({ row }) => {
        const order = row.original.allocated_order;
        return order ? (
          <span className="text-sm">{order.client_company_name}</span>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      size: 130,
      Cell: ({ cell }) => {
        const date = cell.getValue<string>();
        return date ? new Date(date).toLocaleDateString('en-GB') : 'N/A';
      },
    },
    
  ], []);

  // Material React Table instance
  const table = useMaterialReactTable({
    columns,
    data: filteredCutRolls,
    enableSorting: true,
    enableGlobalFilter: true,
    enableColumnFilters: false,
    enableFilters: false,
    enablePagination: true,
    enableRowSelection: false,
    enableColumnOrdering: true,
    enableColumnDragging: true,
    initialState: {
      pagination: { pageSize: 100, pageIndex: 0 },
      density: 'compact'
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <div className="flex gap-2">
        <Button
          onClick={() => {
            // Export CSV functionality
            const csvData = table.getCoreRowModel().rows.map(row => {
              // Convert production date to IST with time
              let productionDateIST = 'N/A';
              if (row.original.updated_at) {
                const utcDate = new Date(row.original.updated_at);
                const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
                const dateStr = istDate.toLocaleDateString('en-GB');
                const timeStr = istDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                productionDateIST = `${dateStr} ${timeStr}`;
              }

              return {
                'Cut Roll ID': row.original.barcode_id,
                'Paper Name': row.original.paper_specs.paper_name,
                'GSM': row.original.paper_specs.gsm,
                'BF': row.original.paper_specs.bf,
                'Shade': row.original.paper_specs.shade,
                'Width (inches)': row.original.width_inches,
                'Weight (kg)': row.original.weight_kg,
                'Status': row.original.status,
                'Production Date (IST)': productionDateIST,
                'Location': row.original.location,
                '118" Roll ID': row.original.parent_118_roll?.barcode_id || 'N/A',
                'Jumbo Roll ID': row.original.parent_jumbo_roll?.barcode_id || 'N/A',
                'Plan ID': row.original.plan_info?.frontend_id || 'N/A',
                'Order ID': row.original.allocated_order?.frontend_id || 'N/A',
                'Client': row.original.allocated_order?.client_company_name || 'N/A',
                'Created At': row.original.created_at ? new Date(row.original.created_at).toLocaleDateString('en-GB') : 'N/A',
                'Is Wastage': row.original.is_wastage_roll ? 'Yes' : 'No',
              };
            });

            const headers = Object.keys(csvData[0] || {});
            const csv = [
              headers.join(','),
              ...csvData.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `all-cut-rolls-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          size="sm"
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button
          onClick={exportToPDF}
          size="sm"
          variant="outline"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>
    ),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Cut Rolls Report</h1>
            <p className="text-muted-foreground">
              Comprehensive view of all cut rolls in the system with advanced filtering
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rolls (DB)</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Page</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredCutRolls.length}</div>
              <p className="text-xs text-muted-foreground">
                of {cutRolls.length} loaded
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredCutRolls.reduce((sum, roll) => sum + roll.weight_kg, 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">kg (filtered)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <Package className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredCutRolls.filter(r => r.status.toLowerCase() === 'available').length}
              </div>
              <p className="text-xs text-muted-foreground">rolls</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Allocated</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredCutRolls.filter(r => r.status.toLowerCase() === 'allocated').length}
              </div>
              <p className="text-xs text-muted-foreground">rolls</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
                <CardDescription>
                  Apply filters to narrow down the cut rolls list
                </CardDescription>
              </div>
              <Button onClick={clearFilters} variant="outline" size="sm">
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Date Filters */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-1">
                <label className="text-sm font-medium mb-2 block">Search</label>
                <Input
                  placeholder="Search by barcode, paper, client..."
                  value={omniSearch}
                  onChange={(e) => setOmniSearch(e.target.value)}
                />
              </div>
              <div className="lg:col-span-1">
                <label className="text-sm font-medium mb-2 block">Production From (IST)</label>
                <Input
                  type="datetime-local"
                  value={fromProductionDateTime}
                  onChange={(e) => setFromProductionDateTime(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="text-sm font-medium mb-2 block">Production To (IST)</label>
                <Input
                  type="datetime-local"
                  value={toProductionDateTime}
                  onChange={(e) => setToProductionDateTime(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectSearch
                      placeholder="Search status..."
                      value={statusSearch}
                      onChange={(e) => setStatusSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    {[
                      { value: 'all', label: 'All Statuses' },
                      { value: 'weight_updated', label: 'Weight Updated' },
                      { value: 'available', label: 'Stock' },
                      { value: 'cutting', label: 'Planned' },
                      { value: 'used', label: 'Dispatched' }
                    ]
                      .filter((item) => item.label.toLowerCase().includes(statusSearch.toLowerCase()))
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">GSM</label>
                <Input
                  placeholder="Filter by GSM"
                  value={gsmFilter}
                  onChange={(e) => setGsmFilter(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Width</label>
                <Input
                  placeholder="Filter by width"
                  value={widthFilter}
                  onChange={(e) => setWidthFilter(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Plan</label>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectSearch
                      placeholder="Search plans..."
                      value={planSearch}
                      onChange={(e) => setPlanSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <SelectItem value="all">All Plans</SelectItem>
                    {uniquePlans
                      .filter((plan) => plan.toLowerCase().includes(planSearch.toLowerCase()))
                      .sort((a, b) => a.localeCompare(b))
                      .map(plan => (
                        <SelectItem key={plan} value={plan}>
                          {plan}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Client</label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectSearch
                      placeholder="Search clients..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <SelectItem value="all">All Clients</SelectItem>
                    {uniqueClients
                      .filter((client) => client.toLowerCase().includes(clientSearch.toLowerCase()))
                      .sort((a, b) => a.localeCompare(b))
                      .map(client => (
                        <SelectItem key={client} value={client}>
                          {client}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Order</label>
                <Select value={orderFilter} onValueChange={setOrderFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Orders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectSearch
                      placeholder="Search orders..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <SelectItem value="all">All Orders</SelectItem>
                    {uniqueOrders
                      .filter((order) => order.toLowerCase().includes(orderSearch.toLowerCase()))
                      .sort((a, b) => a.localeCompare(b))
                      .map(order => (
                        <SelectItem key={order} value={order}>
                          {order}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Table */}
        <Card>
          <CardHeader>
            <CardTitle>Cut Rolls List</CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : `Showing ${filteredCutRolls.length} rolls (page ${currentPage} of ${totalPages}, ${totalItems.toLocaleString()} total in database)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <MaterialReactTable table={table} />
            )}
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({totalItems.toLocaleString()} total rolls)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGoToPage(1)}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value);
                      if (!isNaN(page)) {
                        handleGoToPage(page);
                      }
                    }}
                    className="w-20 text-center"
                  />
                  <span className="text-sm text-muted-foreground">of {totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGoToPage(totalPages)}
                  disabled={currentPage === totalPages || loading}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        orderFrontendId={selectedOrderId}
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
      />

      <PlanDetailsModal
        planFrontendId={selectedPlanId}
        open={planModalOpen}
        onOpenChange={setPlanModalOpen}
      />

      <BarcodeDetailsModal
        barcodeId={selectedBarcodeId}
        isWastage={selectedIsWastage}
        open={barcodeModalOpen}
        onOpenChange={setBarcodeModalOpen}
      />
    </DashboardLayout>
  );
}
