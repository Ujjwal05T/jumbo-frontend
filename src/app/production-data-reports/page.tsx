"use client";

import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Calendar, Loader2, Printer, ChevronDown, ChevronUp, Download } from "lucide-react";
import { PRODUCTION_DATA_ENDPOINTS } from "@/lib/api-config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReportData {
  from_date: string;
  to_date: string;
  columns: string[];
  count: number;
  data: Record<string, any>[];
}

const COLUMN_LABELS: Record<string, string> = {
  date: "Date",
  is_shutdown: "Is Shutdown",
  production_day: "Production Day",
  production_night: "Production Night",
  electricity: "Electricity",
  coal: "Coal",
  bhushi: "Bhushi",
  dispatch_ton: "Dispatch (Ton)",
  dispatch_party: "Dispatch Party",
  po_ton: "PO (Ton)",
  po_party: "PO Party",
  waste: "Waste",
  wastage_party: "Wastage Party",
  starch: "Starch",
  guar_gum: "Guar Gum",
  pac: "PAC",
  rct: "RCT",
  s_seizing: "S.Seizing",
  d_former: "D.Former",
  sodium_silicate: "Sodium Silicate",
  enzyme: "Enzyme",
  dsr: "D.S.R.",
  ret_aid: "Ret.Aid",
  colour_dye: "Colour Dye",
  shutdown_hours: "Shutdown Hours",
};

const ALL_COLUMNS = Object.keys(COLUMN_LABELS);
const DATA_COLUMNS = ALL_COLUMNS.filter((col) => col !== "date"); // All columns except date

export default function ProductionDataReportsPage() {
  const [fromDate, setFromDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .split("T")[0]
  );
  const [toDate, setToDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  // Date is always selected, selectedColumns only contains data columns
  const [selectedColumns, setSelectedColumns] = useState<string[]>(DATA_COLUMNS);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);

  const handleColumnToggle = (column: string) => {
    // Don't allow toggling date column
    if (column === "date") return;

    setSelectedColumns((prev) =>
      prev.includes(column)
        ? prev.filter((c) => c !== column)
        : [...prev, column]
    );
  };

  const handleSelectAll = () => {
    setSelectedColumns(DATA_COLUMNS);
  };

  const handleDeselectAll = () => {
    setSelectedColumns([]);
  };

  const handleGenerateReport = async () => {
    if (selectedColumns.length === 0) {
      toast.error("Please select at least one column");
      return;
    }

    if (!fromDate || !toDate) {
      toast.error("Please select both from and to dates");
      return;
    }

    try {
      setLoading(true);

      // Ensure date is not in selectedColumns, then prepend it
      const filteredColumns = selectedColumns.filter(col => col !== "date");
      const allSelectedColumns = ["date", ...filteredColumns];
      const columnsParam = allSelectedColumns.join(",");
      const response = await fetch(
        PRODUCTION_DATA_ENDPOINTS.PRODUCTION_DATA_REPORT(
          fromDate,
          toDate,
          columnsParam
        ),
        {
          headers: { "ngrok-skip-browser-warning": "true" },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const data: ReportData = await response.json();
      setReportData(data);

      toast.success(`Report generated with ${data.count} records`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate report";
      toast.error(errorMessage);
      console.error("Error generating report:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCellValue = (column: string, value: any) => {
    if (value === null || value === undefined) {
      return "-";
    }
    if (column === "date") {
      const date = new Date(value);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return value;
  };

  // Calculate totals for each column
  const calculateColumnTotals = (data: Record<string, any>[], columns: string[]) => {
    const totals: Record<string, string> = {};

    columns.forEach(column => {
      if (column === "date") {
        totals[column] = "Total";
        return;
      }

      let sum = 0;
      let hasNumericValue = false;

      data.forEach(row => {
        const value = row[column];
        if (value !== null && value !== undefined && value !== "") {
          const strValue = String(value);
          let numValue: number;

          // Check if value contains a hyphen (e.g., "4-49990")
          if (strValue.includes('-')) {
            // Take the number after the hyphen
            const parts = strValue.split('-');
            const afterHyphen = parts[parts.length - 1].trim();
            numValue = parseFloat(afterHyphen);
          } else {
            numValue = parseFloat(strValue);
          }

          if (!isNaN(numValue)) {
            sum += numValue;
            hasNumericValue = true;
          }
        }
      });

      totals[column] = hasNumericValue ? sum.toFixed(2) : "-";
    });

    return totals;
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

  // Download Production Summary PDF (Date, Day, Night, Total, Total Production)
  // Always fetches 1-27 of the month from fromDate, independent of date filters
  const handleDownloadProductionPDF = async () => {
    if (!fromDate) {
      toast.error("Please select a from date to determine the month");
      return;
    }

    try {
      setLoading(true);

      // Get month and year from fromDate
      const startDate = new Date(fromDate);
      const month = startDate.getMonth();
      const year = startDate.getFullYear();

      // Calculate API date range: 1st to 27th of the month
      const apiFromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const apiToDate = `${year}-${String(month + 1).padStart(2, '0')}-27`;

      // Fetch data with only the required columns for 1-27 of the month
      const columnsParam = "date,production_day,production_night";
      const response = await fetch(
        PRODUCTION_DATA_ENDPOINTS.PRODUCTION_DATA_REPORT(
          apiFromDate,
          apiToDate,
          columnsParam
        ),
        {
          headers: { "ngrok-skip-browser-warning": "true" },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch production data");
      }

      const data: ReportData = await response.json();

      // Create a map of existing data by date (dd/mm/yyyy format)
      const dataByDate: Record<string, any> = {};
      data.data.forEach(row => {
        const dateKey = formatCellValue("date", row.date);
        dataByDate[dateKey] = row;
      });

      // Generate all dates from 1 to 27 for the month
      let cumulativeTotal = 0;
      const rows = [];

      for (let day = 1; day <= 27; day++) {
        const dateStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;

        const existingData = dataByDate[dateStr];

        let dayValue = 0;
        let nightValue = 0;
        let dayDisplay = "0";
        let nightDisplay = "0";

        if (existingData) {
          dayValue = parseNumericValue(existingData.production_day);
          nightValue = parseNumericValue(existingData.production_night);
          dayDisplay = existingData.production_day || "0";
          nightDisplay = existingData.production_night || "0";
        }

        const total = dayValue + nightValue;
        cumulativeTotal += total;

        rows.push({
          date: dateStr,
          day: dayDisplay,
          night: nightDisplay,
          total: total,
          totalProduction: cumulativeTotal
        });
      }

      // Get month name for title
      const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
                          "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
      const monthName = monthNames[month];
      const yearShort = String(year).slice(-2);
      const reportTitle = `${monthName}-${yearShort} PRODUCTION`;

      // Create PDF window
      const pdfWindow = window.open('', '_blank');
      if (!pdfWindow) {
        toast.error("Unable to open PDF window. Please check popup blocker settings.");
        return;
      }

      const pdfContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${reportTitle}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                margin: 0;
                font-weight: bold;
              }
              .title-container {
                text-align: center;
                margin-bottom: 10px;
              }
              h1 {
                font-size: 22px;
                font-weight: bold;
                color: #000;
                margin: 0;
                padding: 10px;
                display: inline-block;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                border: 2px solid #000;
              }
              th, td {
                border: 2px solid #000;
                padding: 8px 12px;
                text-align: center;
                font-size: 13px;
                font-weight: bold;
              }
              th {
                background-color: #fff;
                font-weight: bold;
                color: #000;
              }
              .header-row th {
                border-bottom: 3px solid #000;
              }
              td {
                font-weight: bold;
              }
              .total-production-col {
                font-weight: bold;
              }
              @media print {
                body {
                  padding: 10px;
                }
                th, td {
                  padding: 6px 10px;
                  font-size: 12px;
                  font-weight: bold;
                }
              }
            </style>
          </head>
          <body>
            <table>
              <thead>
                <tr>
                  <th colspan="4" style="font-size: 20px; padding: 15px; border-bottom: none;">
                    ${reportTitle}
                  </th>
                  <th rowspan="2" style="vertical-align: middle; font-size: 12px;">TOTAL<br>PRODUCTION</th>
                </tr>
                <tr class="header-row">
                  <th>DATE</th>
                  <th>DAY</th>
                  <th>NIGHT</th>
                  <th>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(row => `
                  <tr>
                    <td>${row.date}</td>
                    <td>${row.day}</td>
                    <td>${row.night}</td>
                    <td>${row.total}</td>
                    <td class="total-production-col">${row.totalProduction}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `;

      pdfWindow.document.write(pdfContent);
      pdfWindow.document.close();

      toast.success("Production Summary PDF generated");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate PDF";
      toast.error(errorMessage);
      console.error("Error generating production PDF:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!reportData) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Unable to open print window. Please check popup blocker settings.");
      return;
    }

    // Build the HTML content for printing
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Production Data Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              margin: 0;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 8px;
              color: #1f2937;
            }
            .report-info {
              margin-bottom: 20px;
              font-size: 14px;
              color: #6b7280;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 8px 12px;
              text-align: left;
              font-size: 12px;
            }
            th {
              background-color: #f3f4f6;
              font-weight: 600;
              color: #374151;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .total-row {
              background-color: #e5e7eb !important;
              font-weight: 700;
              border-top: 2px solid #374151;
            }
            .total-row td {
              font-weight: 700;
            }
            .print-date {
              margin-top: 30px;
              font-size: 12px;
              color: #9ca3af;
              text-align: right;
            }
            @media print {
              body {
                padding: 10px;
              }
              th, td {
                padding: 6px 8px;
                font-size: 11px;
              }
            }
          </style>
        </head>
        <body>
          <h1>Production Data Report</h1>
          <div class="report-info">
            <strong>Date Range:</strong> ${reportData.from_date} to ${reportData.to_date}<br>
            <strong>Total Records:</strong> ${reportData.count}
          </div>
          <table>
            <thead>
              <tr>
                ${reportData.columns.map(col => `<th>${COLUMN_LABELS[col]}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${reportData.data.map(row => `
                <tr>
                  ${reportData.columns.map(col => `<td>${formatCellValue(col, row[col])}</td>`).join('')}
                </tr>
              `).join('')}
              ${(() => {
                const totals = calculateColumnTotals(reportData.data, reportData.columns);
                return `
                  <tr class="total-row">
                    ${reportData.columns.map(col => `<td>${totals[col]}</td>`).join('')}
                  </tr>
                `;
              })()}
            </tbody>
          </table>
          <div class="print-date">
            Printed on: ${new Date().toLocaleString()}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-8 h-8 text-primary" />
              Production Data Reports
            </h1>
            <p className="text-muted-foreground">
              Generate reports with custom date ranges and column selection
            </p>
          </div>

          {/* Date Range Filters */}
          <div className="flex items-center gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fromDate" className="text-xs">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={loading}
                className="w-40"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="toDate" className="text-xs">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={loading}
                className="w-40"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <Button
              onClick={handleDownloadProductionPDF}
              variant="outline"
              className="flex items-center gap-2"
              disabled={loading}
              title="Download Production Summary PDF (Date, Day, Night, Total, Total Production)"
            >
              <Download className="w-4 h-4" />
              Production PDF
            </Button>
            <Button
              onClick={handleGenerateReport}
              className="flex items-center gap-2"
              disabled={loading || selectedColumns.length === 0}
              title={selectedColumns.length === 0 ? "Please select at least one data column" : ""}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Column Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Column Selection</CardTitle>
                <CardDescription>
                  Choose which columns to include in the report
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isFiltersExpanded && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      disabled={loading}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAll}
                      disabled={loading}
                    >
                      Deselect All
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                  className="flex items-center gap-2"
                >
                  {isFiltersExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Expand
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          {isFiltersExpanded && (
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 p-4 border rounded-lg">
                {ALL_COLUMNS.map((column) => {
                  const isDate = column === "date";
                  const isChecked = isDate || selectedColumns.includes(column);

                  return (
                    <div key={column} className="flex items-center space-x-2">
                      <Checkbox
                        id={column}
                        checked={isChecked}
                        onCheckedChange={() => handleColumnToggle(column)}
                        disabled={loading || isDate}
                      />
                      <label
                        htmlFor={column}
                        className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                          isDate ? "opacity-70" : "cursor-pointer"
                        }`}
                      >
                        {COLUMN_LABELS[column]} {isDate && "(Required)"}
                      </label>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedColumns.length + 1} column(s) selected (Date + {selectedColumns.length} data columns)
              </p>
            </CardContent>
          )}
        </Card>

        {/* Report Results */}
        {reportData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Report Results</CardTitle>
                  <CardDescription>
                    Showing {reportData.count} record(s) from {reportData.from_date} to{" "}
                    {reportData.to_date}
                  </CardDescription>
                </div>
                {reportData.count > 0 && (
                  <Button
                    onClick={handlePrint}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print Report
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {reportData.count === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No data found for the selected date range
                </div>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        {reportData.columns.map((column) => (
                          <TableHead key={column} className="font-semibold">
                            {COLUMN_LABELS[column]}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.data.map((row, index) => (
                        <TableRow key={index}>
                          {reportData.columns.map((column) => (
                            <TableCell key={column}>
                              {formatCellValue(column, row[column])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {/* Total Row */}
                      {(() => {
                        const totals = calculateColumnTotals(reportData.data, reportData.columns);
                        return (
                          <TableRow className="bg-muted/50 font-semibold border-t-2">
                            {reportData.columns.map((column) => (
                              <TableCell key={column} className="font-bold">
                                {totals[column]}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
