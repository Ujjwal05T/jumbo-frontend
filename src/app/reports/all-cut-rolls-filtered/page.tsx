"use client";

import { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaterialReactTable, useMaterialReactTable, MRT_ColumnDef } from 'material-react-table';
import { Package, Download, Filter, X, FileText, Search } from 'lucide-react';
import { createRequestOptions } from '@/lib/api-config';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OrderDetailsModal } from '@/components/OrderDetailsModal';
import { PlanDetailsModal } from '@/components/PlanDetailsModal';
import { BarcodeDetailsModal } from '@/components/BarcodeDetailsModal';
import { is } from 'zod/v4/locales';

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
  quantity_pending?: number | null;
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
  wastage_details: {
    source: string,
    reel_no: string,
    wastage_barcode: string,
    wastage_frontend_id: string
  } | null,
  allocated_order: {
    id: string;
    frontend_id: string | null;
    client_company_name: string | null;
  } | null;
  source_type: string | null;
  is_wastage_roll: boolean;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Client = {
  id: string;
  company_name: string;
};

type Order = {
  id: string;
  frontend_id: string;
  client: {
    company_name: string;
  };
};

type Plan = {
  id: string;
  frontend_id: string;
  name: string;
};

export default function AllCutRollsFilteredReportPage() {
  const [cutRolls, setCutRolls] = useState<CutRoll[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);

  // Filter states (server-side)
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gsmFilter, setGsmFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [fromProductionDateTime, setFromProductionDateTime] = useState<string>('');
  const [toProductionDateTime, setToProductionDateTime] = useState<string>('');

  // Client-side search (applied after data is loaded)
  const [omniSearch, setOmniSearch] = useState<string>('');

  // Dropdown options
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  // Modal states
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedBarcodeId, setSelectedBarcodeId] = useState<string | null>(null);
  const [selectedIsWastage, setSelectedIsWastage] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);

  // Fetch dropdown options on mount
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      setLoadingDropdowns(true);
      try {
        // Fetch clients
        const clientsResponse = await fetch(`${API_BASE_URL}/clients`, createRequestOptions('GET'));
        const clientsData = await clientsResponse.json();
        if (Array.isArray(clientsData)) {
          const sortedClients = clientsData
            .filter((c: Client) => c.company_name)
            .sort((a: Client, b: Client) => a.company_name.localeCompare(b.company_name));
          setAvailableClients(sortedClients);
        }

        // Fetch orders
        const ordersResponse = await fetch(`${API_BASE_URL}/orders`, createRequestOptions('GET'));
        const ordersData = await ordersResponse.json();
        if (Array.isArray(ordersData)) {
          const sortedOrders = ordersData
            .filter((o: Order) => o.frontend_id)
            .sort((a: Order, b: Order) => {
              // Sort by frontend_id in ascending order
              const aId = a.frontend_id || '';
              const bId = b.frontend_id || '';
              return aId.localeCompare(bId);
            });
          setAvailableOrders(sortedOrders);
        }

        // Fetch plans
        const plansResponse = await fetch(`${API_BASE_URL}/plans`, createRequestOptions('GET'));
        const plansData = await plansResponse.json();
        if (Array.isArray(plansData)) {
          const sortedPlans = plansData
            .filter((p: Plan) => p.frontend_id)
            .sort((a: Plan, b: Plan) => {
              // Sort by frontend_id in ascending order
              const aId = a.frontend_id || '';
              const bId = b.frontend_id || '';
              return aId.localeCompare(bId);
            });
          setAvailablePlans(sortedPlans);
        }
      } catch (error) {
        console.error('Error fetching dropdown options:', error);
      } finally {
        setLoadingDropdowns(false);
      }
    };

    fetchDropdownOptions();
  }, []);

  // Apply filters and fetch data
  const applyFilters = async () => {
    const isPending = statusFilter === 'pending';

    // Check if at least one filter is applied (excluding omniSearch - it's client-side only)
    // For pending orders, plan filter is not applicable
    const hasFilters = !!(
      (statusFilter && statusFilter !== 'all') ||
      gsmFilter ||
      (clientFilter && clientFilter !== 'all') ||
      (orderFilter && orderFilter !== 'all') ||
      (!isPending && planFilter && planFilter !== 'all') ||
      fromProductionDateTime ||
      toProductionDateTime
    );

    if (!hasFilters) {
      alert('Please apply at least one filter before searching');
      return;
    }

    setLoading(true);
    setHasAppliedFilters(true);

    try {
      // Build query parameters
      const params = new URLSearchParams();

      // Add filter parameters if they exist
      if (gsmFilter) params.append('gsm', gsmFilter);
      if (clientFilter && clientFilter !== 'all') params.append('client_name', clientFilter);
      if (orderFilter && orderFilter !== 'all') params.append('order_id', orderFilter);

      // Plan filter only for non-pending orders
      if (!isPending && planFilter && planFilter !== 'all') {
        params.append('plan_id', planFilter);
      }

      // Status filter only for non-pending orders
      if (!isPending && statusFilter && statusFilter !== 'all') {
        params.append('status_filter', statusFilter);
      }

      // Handle datetime filters (convert IST to UTC)
      // User enters datetime in IST, we need to send UTC to server
      if (fromProductionDateTime) {
        // Explicitly treat input as IST by appending +05:30 offset
        const istDateTimeStr = fromProductionDateTime.includes(':00+')
          ? fromProductionDateTime
          : fromProductionDateTime + ':00+05:30';
        const utcDateTime = new Date(istDateTimeStr);
        const dateParam = isPending ? 'from_created_date' : 'from_production_date';
        params.append(dateParam, utcDateTime.toISOString());
      }
      if (toProductionDateTime) {
        // Explicitly treat input as IST by appending +05:30 offset
        // Set to end of minute (59 seconds, 999ms)
        const istDateTimeStr = toProductionDateTime.includes(':00+')
          ? toProductionDateTime
          : toProductionDateTime + ':59.999+05:30';
        const utcDateTime = new Date(istDateTimeStr);
        const dateParam = isPending ? 'to_created_date' : 'to_production_date';
        params.append(dateParam, utcDateTime.toISOString());
      }

      // Switch API endpoint based on status
      const endpoint = isPending ? '/reports/pending-orders-filtered' : '/reports/all-cut-rolls-filtered';
      const url = `${API_BASE_URL}${endpoint}?${params.toString()}`;
      const response = await fetch(url, createRequestOptions('GET'));
      const result = await response.json();

      if (result.success && result.data) {
        // Handle response based on endpoint
        if (isPending) {
          setCutRolls(result.data.pending_orders || []);
          setTotalItems(result.data.total_items || 0);
        } else {
          setCutRolls(result.data.cut_rolls || []);
          setTotalItems(result.data.total_items || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error fetching data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setOmniSearch('');
    setStatusFilter('all');
    setGsmFilter('');
    setClientFilter('all'); // Reset to "All Clients"
    setOrderFilter('all'); // Reset to "All Orders"
    setPlanFilter('all'); // Reset to "All Plans"
    setFromProductionDateTime('');
    setToProductionDateTime('');
    setCutRolls([]);
    setTotalItems(0);
    setHasAppliedFilters(false);
  };

  // Client-side omni search on loaded data
  const filteredCutRolls = useMemo(() => {
    if (!omniSearch.trim()) {
      return cutRolls;
    }

    const searchTerm = omniSearch.toLowerCase().trim();

    return cutRolls.filter(roll => {
      // Search in barcode
      if (roll.barcode_id?.toLowerCase().includes(searchTerm)) return true;

      // Search in paper specs
      if (roll.paper_specs?.paper_name?.toLowerCase().includes(searchTerm)) return true;
      if (roll.paper_specs?.gsm?.toString().includes(searchTerm)) return true;
      if (roll.paper_specs?.bf?.toString().includes(searchTerm)) return true;
      if (roll.paper_specs?.shade?.toLowerCase().includes(searchTerm)) return true;

      // Search in width and weight
      if (roll.width_inches?.toString().includes(searchTerm)) return true;
      if (roll.weight_kg?.toString().includes(searchTerm)) return true;

      // Search in status
      if (roll.status?.toLowerCase().includes(searchTerm)) return true;

      // Search in location
      if (roll.location?.toLowerCase().includes(searchTerm)) return true;

      // Search in parent rolls
      if (roll.parent_118_roll?.barcode_id?.toLowerCase().includes(searchTerm)) return true;
      if (roll.parent_jumbo_roll?.barcode_id?.toLowerCase().includes(searchTerm)) return true;

      // Search in plan
      if (roll.plan_info?.frontend_id?.toLowerCase().includes(searchTerm)) return true;
      if (roll.plan_info?.name?.toLowerCase().includes(searchTerm)) return true;

      // Search in order and client
      if (roll.allocated_order?.frontend_id?.toLowerCase().includes(searchTerm)) return true;
      if (roll.allocated_order?.client_company_name?.toLowerCase().includes(searchTerm)) return true;

      return false;
    });
  }, [cutRolls, omniSearch]);

  // Export to PDF function
  const exportToPDF = () => {
    const doc = new jsPDF('landscape');

    // Generate dynamic title based on filters
    let reportTitle = '';

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
    let minProductionDate: Date | null = null;
    let maxProductionDate: Date | null = null;

    filteredCutRolls.forEach(roll => {
      if (roll.updated_at) {
        const date = new Date(roll.updated_at);
        if (!minProductionDate || date < minProductionDate) minProductionDate = date;
        if (!maxProductionDate || date > maxProductionDate) maxProductionDate = date;
      }
    });

    // Calculate summary statistics
    const totalRolls = filteredCutRolls.length;
    const totalWeight = filteredCutRolls.reduce((sum, roll) => sum + roll.weight_kg, 0);
    const stockRolls = filteredCutRolls.filter(r => r.status.toLowerCase() === 'available').length;
    const dispatchedRolls = filteredCutRolls.filter(r => r.status.toLowerCase() === 'used').length;
    const weightUpdatedRolls = stockRolls + dispatchedRolls;
    const plannedRolls = filteredCutRolls.filter(r => r.status.toLowerCase() === 'cutting').length;

    // Add date range section
    let dateRangeY = 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    if (minProductionDate !== null && maxProductionDate !== null) {
      dateRangeY += 4;
      const minDateIST = new Date((minProductionDate as Date).getTime() + (5.5 * 60 * 60 * 1000));
      const maxDateIST = new Date((maxProductionDate as Date).getTime() + (5.5 * 60 * 60 * 1000));
      const minDateStr = `${minDateIST.toLocaleDateString('en-GB')} ${minDateIST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      const maxDateStr = `${maxDateIST.toLocaleDateString('en-GB')} ${maxDateIST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      doc.text(`Production Date: ${minDateStr} to ${maxDateStr}`, 190, dateRangeY - 10);
    }

    dateRangeY += 5;

    // Add summary section
    const summaryStartY = dateRangeY + 2;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

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
    const sortedRolls = [...filteredCutRolls].sort((a, b) => {
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

    // Save the PDF
    doc.save(`cut-rolls-filtered-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Table columns definition
  const columns = useMemo<MRT_ColumnDef<CutRoll>[]>(() => {
    const isPending = statusFilter === 'pending';

    return [
      {
        accessorKey: isPending ? 'frontend_id' : 'barcode_id',
        header: isPending ? 'Pending Order ID' : 'Cut Roll ID',
        size: 140,
        Cell: ({ row }) => {
          if (isPending) {
            return (
              <span className="font-mono font-semibold">
                {row.original.frontend_id || 'N/A'}
              </span>
            );
          }

          const barcodeId = row.original.barcode_id;
          let reelNo = barcodeId;
          const isWastage = row.original.is_wastage_roll;
          if (isWastage && row.original.wastage_details) {
            reelNo = row.original.wastage_details.reel_no;
          }

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
              {isWastage ? reelNo : barcodeId}
            </button>
          );
        },
      },
      {
        accessorKey: 'quantity_pending',
        header: 'Quantity',
        size: 120,
        Cell: ({ cell }) => {
          const qtyPending = cell.getValue<number | null>();
          return qtyPending !== null && qtyPending !== undefined ? qtyPending : 'N/A';
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
            <div className="text-sm text-muted-foreground">
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
    // Conditionally add Production Date (only for non-pending)
    ...(!isPending ? [{
      accessorKey: 'updated_at',
      header: 'Production Date',
      size: 180,
      Cell: ({ cell }: any) => {
        const date = cell.getValue() as string;
        if (!date) return 'N/A';

        const utcDate = new Date(date);
        const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
        const dateStr = istDate.toLocaleDateString('en-GB');
        const timeStr = istDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        return `${dateStr}  ${timeStr}`;
      },
    }] : []),
    // Conditionally add 118" Roll (only for non-pending)
    ...(!isPending ? [{
      accessorKey: 'parent_118_roll.barcode_id',
      header: '118" Roll ID',
      size: 140,
      Cell: ({ row }: any) => {
        const roll118 = row.original.parent_118_roll;
        return roll118 ? (
          <span className="font-mono text-xs">{roll118.barcode_id}</span>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
    }] : []),
    // Conditionally add Jumbo Roll (only for non-pending)
    ...(!isPending ? [{
      accessorKey: 'parent_jumbo_roll.barcode_id',
      header: 'JR ID',
      size: 140,
      Cell: ({ row }: any) => {
        const jumbo = row.original.parent_jumbo_roll;
        return jumbo ? (
          <span className="font-mono text-xs">{jumbo.barcode_id}</span>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
    }] : []),
    // Conditionally add Plan (only for non-pending)
    ...(!isPending ? [{
      accessorKey: 'plan_info.frontend_id',
      header: 'Plan ID',
      size: 130,
      Cell: ({ row }: any) => {
        const plan = row.original.plan_info;
        return plan ? (
          <button
            onClick={(e: any) => {
              e.stopPropagation();
              setSelectedPlanId(plan.frontend_id);
              setPlanModalOpen(true);
            }}
            className="text-left hover:opacity-80"
          >
            <div className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">{plan.frontend_id}</div>
          </button>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
    }] : []),
    
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
      Cell: ({ cell }: any) => {
        const date = cell.getValue() as string;
        return date ? new Date(date).toLocaleDateString('en-GB') : 'N/A';
      },
    },
  ];
  }, [statusFilter]);

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
    renderTopToolbarCustomActions: () => (
      <div className="flex gap-2">
        <Button
          onClick={() => {
            const csvData = filteredCutRolls.map(roll => {
              let productionDateIST = 'N/A';
              if (roll.updated_at) {
                const utcDate = new Date(roll.updated_at);
                const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
                const dateStr = istDate.toLocaleDateString('en-GB');
                const timeStr = istDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                productionDateIST = `${dateStr} ${timeStr}`;
              }

              return {
                'Cut Roll ID': roll.barcode_id,
                'Paper Name': roll.paper_specs.paper_name,
                'GSM': roll.paper_specs.gsm,
                'BF': roll.paper_specs.bf,
                'Shade': roll.paper_specs.shade,
                'Width (inches)': roll.width_inches,
                'Weight (kg)': roll.weight_kg,
                'Status': roll.status,
                'Production Date (IST)': productionDateIST,
                'Location': roll.location,
                '118" Roll ID': roll.parent_118_roll?.barcode_id || 'N/A',
                'Jumbo Roll ID': roll.parent_jumbo_roll?.barcode_id || 'N/A',
                'Plan ID': roll.plan_info?.frontend_id || 'N/A',
                'Order ID': roll.allocated_order?.frontend_id || 'N/A',
                'Client': roll.allocated_order?.client_company_name || 'N/A',
                'Created At': roll.created_at ? new Date(roll.created_at).toLocaleDateString('en-GB') : 'N/A',
                'Is Wastage': roll.is_wastage_roll ? 'Yes' : 'No',
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
            a.download = `all-cut-rolls-filtered-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          size="sm"
          variant="outline"
          disabled={filteredCutRolls.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button
          onClick={exportToPDF}
          size="sm"
          variant="outline"
          disabled={filteredCutRolls.length === 0}
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
            <h1 className="text-3xl font-bold tracking-tight">Filtered Cut Rolls Report</h1>
            <p className="text-muted-foreground">
              Apply filters to load data, then use search to filter results - shows ALL matching records
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Summary Stats */}
        {hasAppliedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Filtered</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalItems.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  All matching records
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
                <p className="text-xs text-muted-foreground">kg</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stock</CardTitle>
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
                <CardTitle className="text-sm font-medium">Dispatched</CardTitle>
                <Package className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredCutRolls.filter(r => r.status.toLowerCase() === 'used').length}
                </div>
                <p className="text-xs text-muted-foreground">rolls</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Planned</CardTitle>
                <Package className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredCutRolls.filter(r => r.status.toLowerCase() === 'cutting').length}
                </div>
                <p className="text-xs text-muted-foreground">rolls</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Apply Filters to Search
                </CardTitle>
                <CardDescription>
                  Select at least one filter and click "Apply Filters" to view results
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={clearFilters} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
                <Button onClick={applyFilters} variant="default" size="sm" disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? 'Searching...' : 'Apply Filters'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Date Filters */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-1">
                <label className="text-sm font-medium mb-2 block">Search (Client-side)</label>
                <Input
                  placeholder="Search by barcode, paper, client..."
                  value={omniSearch}
                  onChange={(e) => setOmniSearch(e.target.value)}
                  disabled={!hasAppliedFilters}
                />
              </div>
              <div className="lg:col-span-1">
                <label className="text-sm font-medium mb-2 block">
                  {statusFilter === 'pending' ? 'Created From (IST)' : 'Production From (IST)'}
                </label>
                <Input
                  type="datetime-local"
                  value={fromProductionDateTime}
                  onChange={(e) => setFromProductionDateTime(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="text-sm font-medium mb-2 block">
                  {statusFilter === 'pending' ? 'Created To (IST)' : 'Production To (IST)'}
                </label>
                <Input
                  type="datetime-local"
                  value={toProductionDateTime}
                  onChange={(e) => setToProductionDateTime(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="weight_updated">Weight Updated</SelectItem>
                    <SelectItem value="available">Stock</SelectItem>
                    <SelectItem value="cutting">Planned</SelectItem>
                    <SelectItem value="used">Dispatched</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">GSM</label>
                <Input
                  placeholder="Filter by GSM"
                  type="number"
                  value={gsmFilter}
                  onChange={(e) => setGsmFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Client</label>
                <Select value={clientFilter} onValueChange={setClientFilter} disabled={loadingDropdowns}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select Client"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {availableClients.map(client => (
                      <SelectItem key={client.id} value={client.company_name}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Order ID</label>
                <Select value={orderFilter} onValueChange={setOrderFilter} disabled={loadingDropdowns}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select Order"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    {availableOrders.map(order => (
                      <SelectItem key={order.id} value={order.frontend_id}>
                        {order.frontend_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Hide Plan filter for pending orders */}
              {statusFilter !== 'pending' && (
                <div>
                  <label className="text-sm font-medium">Plan ID</label>
                  <Select value={planFilter} onValueChange={setPlanFilter} disabled={loadingDropdowns}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select Plan"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      {availablePlans.map(plan => (
                        <SelectItem key={plan.id} value={plan.frontend_id}>
                          {plan.frontend_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Table or Empty State */}
        <Card>
          <CardHeader>
            <CardTitle>Cut Rolls Results</CardTitle>
            <CardDescription>
              {loading
                ? 'Loading filtered results...'
                : hasAppliedFilters
                  ? omniSearch.trim()
                    ? `Showing ${filteredCutRolls.length.toLocaleString()} of ${totalItems.toLocaleString()} rolls (filtered by search)`
                    : `Showing all ${totalItems.toLocaleString()} filtered rolls`
                  : 'Apply filters above to view results'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-muted-foreground">Fetching filtered results...</p>
              </div>
            ) : !hasAppliedFilters ? (
              <div className="flex flex-col justify-center items-center h-40 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Filters Applied</h3>
                <p className="text-muted-foreground">
                  Select at least one filter above and click "Apply Filters" to view results
                </p>
              </div>
            ) : filteredCutRolls.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-40 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                <p className="text-muted-foreground">
                  {omniSearch.trim()
                    ? 'No rolls match your search criteria. Try adjusting your search term.'
                    : 'No cut rolls match your filter criteria. Try adjusting your filters.'}
                </p>
              </div>
            ) : (
              <MaterialReactTable table={table} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
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
