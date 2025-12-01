"use client";

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaterialReactTable, useMaterialReactTable, MRT_ColumnDef } from 'material-react-table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Download, FileText, Package, Search, AlertCircle, TrendingUp } from 'lucide-react';
import { REPORTS_ENDPOINTS, createRequestOptions } from '@/lib/api-config';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types for the cut rolls weight update report
type CutRollWeightData = {
  id: string;
  frontend_id: string;
  barcode_id: string;
  width_inches: number;
  weight_kg: number;
  location: string;
  status: string;
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
    created_at: string | null;
  } | null;
  allocated_order: {
    id: string;
    frontend_id: string | null;
  } | null;
  source_type: string | null;
  is_wastage_roll: boolean;
};

type ReportSummary = {
  total_cut_rolls: number;
  total_weight_kg: number;
  unique_jumbo_rolls: number;
  unique_118_rolls: number;
  unique_plans: number;
  unique_paper_types: number;
  avg_weight_per_roll: number;
  date_range: {
    report_date: string;
    start_time: string;
    end_time: string;
  };
};

type ReportResponse = {
  success: boolean;
  data: {
    cut_rolls: CutRollWeightData[];
    summary: ReportSummary;
  };
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function CutRollsWeightReportPage() {
  const [reportDate, setReportDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    if (!reportDate) {
      setError('Please select a date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        REPORTS_ENDPOINTS.CUT_ROLLS_WEIGHT_UPDATE(reportDate),
        createRequestOptions('GET')
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch report');
      }

      const data: ReportResponse = await response.json();
      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportDate]); // Auto-fetch when reportDate changes

  const handleDateChange = (date: string) => {
    setReportDate(date);
  };

  const exportToCSV = () => {
    if (!reportData?.data.cut_rolls.length) return;

    const headers = [
      'Cut Roll ID', 'Barcode', 'Width (inches)', 'Weight (kg)', 'Location', 'Status',
      'Paper Name', 'GSM', 'BF', 'Shade', 'Paper Type',
      'Parent 118" Roll', 'Parent 118" Barcode', 'Parent Jumbo Roll', 'Parent Jumbo Barcode',
      'Plan ID', 'Plan Name', 'Order ID', 'Production Date', 'Roll Sequence', 'Source Type', 'Is Wastage'
    ];

    const csvData = reportData.data.cut_rolls.map(roll => [
      roll.frontend_id,
      roll.barcode_id,
      roll.width_inches,
      roll.weight_kg,
      roll.location,
      roll.status,
      roll.paper_specs.paper_name,
      roll.paper_specs.gsm,
      roll.paper_specs.bf,
      roll.paper_specs.shade,
      roll.paper_specs.type,
      roll.parent_118_roll?.frontend_id || '',
      roll.parent_118_roll?.barcode_id || '',
      roll.parent_jumbo_roll?.frontend_id || '',
      roll.parent_jumbo_roll?.barcode_id || '',
      roll.plan_info?.frontend_id || '',
      roll.plan_info?.name || '',
      roll.allocated_order?.frontend_id || '',
      roll.production_date ? new Date(roll.production_date).toLocaleDateString() : '',
      roll.roll_sequence || '',
      roll.source_type || '',
      roll.is_wastage_roll ? 'Yes' : 'No'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cut_rolls_weight_update_${reportDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (!reportData?.data.cut_rolls.length) return;

    const doc = new jsPDF();
    const summary = reportData.data.summary;

    // Add title
    doc.setFontSize(18);
    doc.text('Cut Rolls Weight Update Report', 14, 15);

    doc.setFontSize(12);
    doc.text(`Report Date: ${summary.date_range.report_date}`, 14, 25);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

    // Add summary
    doc.setFontSize(14);
    doc.text('Summary', 14, 42);
    doc.setFontSize(10);

    const summaryData = [
      ['Total Cut Rolls', summary.total_cut_rolls.toString()],
      ['Total Weight (kg)', summary.total_weight_kg.toString()],
      ['Average Weight per Roll (kg)', summary.avg_weight_per_roll.toString()],
      ['Unique Jumbo Rolls', summary.unique_jumbo_rolls.toString()],
      ['Unique 118" Rolls', summary.unique_118_rolls.toString()],
      ['Unique Plans', summary.unique_plans.toString()],
      ['Unique Paper Types', summary.unique_paper_types.toString()]
    ];

    autoTable(doc, {
      head: [['Metric', 'Value']],
      body: summaryData,
      startY: 48,
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    // Add cut rolls table
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text('Cut Rolls Details', 14, finalY);

    const tableData = reportData.data.cut_rolls
      .sort((a, b) => {
      const aNum = parseInt(a.barcode_id.replace('CR_', ''));
      const bNum = parseInt(b.barcode_id.replace('CR_', ''));
      return aNum - bNum;
      })
      .map(roll => [
      roll.barcode_id,
      roll.width_inches.toString(),
      roll.weight_kg.toString(),
      roll.paper_specs.paper_name,
      roll.paper_specs.gsm.toString(),
      roll.parent_118_roll?.barcode_id || '',
      roll.plan_info?.frontend_id || '',
      roll.status
      ]);

    autoTable(doc, {
      head: [['Barcode', 'Width', 'Weight', 'Paper', 'GSM', '118" Roll', 'Plan', 'Status']],
      body: tableData,
      startY: finalY + 8,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`cut_rolls_weight_update_${reportDate}.pdf`);
  };

  // Prepare chart data
  const widthDistribution = reportData?.data.cut_rolls.reduce((acc: any[], roll) => {
    const existing = acc.find(item => item.width === roll.width_inches);
    if (existing) {
      existing.count += 1;
      existing.totalWeight += roll.weight_kg;
    } else {
      acc.push({
        width: roll.width_inches,
        count: 1,
        totalWeight: roll.weight_kg
      });
    }
    return acc;
  }, []) || [];

  const paperTypeDistribution = reportData?.data.cut_rolls.reduce((acc: any[], roll) => {
    const existing = acc.find(item => item.type === roll.paper_specs.type);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({
        type: roll.paper_specs.type,
        count: 1
      });
    }
    return acc;
  }, []) || [];

  // Define table columns
  const columns: MRT_ColumnDef<CutRollWeightData>[] = [
    
    {
      accessorKey: 'barcode_id',
      header: 'Barcode',
      size: 120,
    },
    {
      accessorKey: 'width_inches',
      header: 'Width (in)',
      size: 80,
      Cell: ({ cell }) => cell.getValue<number>()?.toFixed(2) || '0.00'
    },
    {
      accessorKey: 'weight_kg',
      header: 'Weight (kg)',
      size: 80,
      Cell: ({ cell }) => cell.getValue<number>()?.toFixed(2) || '0.00'
    },
    {
      accessorKey: 'paper_specs.paper_name',
      header: 'Paper Name',
      size: 150,
    },
    {
      accessorKey: 'paper_specs.gsm',
      header: 'GSM',
      size: 60,
    },
    {
      accessorKey: 'parent_118_roll.barcode_id',
      header: '118" Roll',
      size: 100,
      Cell: ({ cell, row }) => row.original.parent_118_roll?.barcode_id || 'N/A'
    },
    {
      accessorKey: 'parent_jumbo_roll.barcode_id',
      header: 'Jumbo Roll',
      size: 100,
      Cell: ({ cell, row }) => row.original.parent_jumbo_roll?.barcode_id || 'N/A'
    },
    {
      accessorKey: 'plan_info.frontend_id',
      header: 'Plan ID',
      size: 100,
      Cell: ({ cell, row }) => row.original.plan_info?.frontend_id || 'N/A'
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 100,
    },
    {
      accessorKey: 'production_date',
      header: 'Production Date',
      size: 100,
      Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleDateString() : 'N/A'
    }
  ];

  const table = useMaterialReactTable({
    columns,
    data: reportData?.data.cut_rolls || [],
    enableStickyHeader: true,
    enableStickyFooter: true,
    enablePagination: true,
    enableSorting: true,
    enableFilters: true,
    enableColumnFilters: true,
    muiTableContainerProps: { sx: { maxHeight: '600px' } },
    initialState: {
      sorting: [{ id: 'production_date', desc: true }]
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cut Rolls Weight Update Report</h1>
            <p className="text-muted-foreground">
              Report showing cut rolls that had their weight updated on a specific date
            </p>
          </div>
        </div>

        {/* Date Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Report Date Selection
            </CardTitle>
            <CardDescription>
              Select a date to automatically generate the cut rolls weight update report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-sm">
                <label className="block text-sm font-medium mb-2">Select Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={reportDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="pl-10"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Loading report...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {reportData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cut Rolls</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.data.summary.total_cut_rolls}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Weight (kg)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.data.summary.total_weight_kg}</div>
                  <p className="text-xs text-muted-foreground">
                    Avg: {reportData.data.summary.avg_weight_per_roll} kg per roll
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Jumbo Rolls</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.data.summary.unique_jumbo_rolls}</div>
                  <p className="text-xs text-muted-foreground">
                    {reportData.data.summary.unique_118_rolls} 118" rolls
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Plans</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.data.summary.unique_plans}</div>
                  <p className="text-xs text-muted-foreground">
                    {reportData.data.summary.unique_paper_types} paper types
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Export Controls */}
            {reportData.data.cut_rolls.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Export Options
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    
                    <Button onClick={exportToPDF} variant="outline">
                      Download PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Data Table */}
            <Card>
              <CardHeader>
                <CardTitle>Cut Rolls Details</CardTitle>
                <CardDescription>
                  {reportData.data.cut_rolls.length} cut rolls found for {reportData.data.summary.date_range.report_date}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.data.cut_rolls.length > 0 ? (
                  <MaterialReactTable table={table} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No cut rolls found for the selected date.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}