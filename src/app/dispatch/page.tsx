/**
 * Dispatch page - Manage order items in warehouse and dispatch
 */
"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSearch,
} from "@/components/ui/select";
import {
  Truck,
  CheckCircle,
  Clock,
  Package,
  AlertCircle,
  Calendar,
  Loader2,
  History,
  X,
  Building2,
  Search,
  Printer,
  Filter,
} from "lucide-react";
import {
  getStatusBadgeVariant,
  getStatusDisplayText
} from "@/lib/production";
import { API_BASE_URL } from "@/lib/api-config";
import WastageIndicator from "@/components/WastageIndicator";

type ItemType = "warehouse" | "pending";

export default function DispatchPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    client: "all",
    paperSpec: "all",
    minWeight: "",
    maxWeight: "",
    isWastage: "all",
  });

  // Search state for select dropdowns
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [paperSpecSearchTerm, setPaperSpecSearchTerm] = useState("");
  const [wastageSearchTerm, setWastageSearchTerm] = useState("");

  // Helper function to highlight matching text
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text;

    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  // Load warehouse items - always load all items (no filtering)
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = `${API_BASE_URL}/dispatch/warehouse-items`;

      const response = await fetch(url, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Failed to load warehouse items');
      const warehouseResponse = await response.json();

      setWarehouseItems(warehouseResponse.warehouse_items || []);

      console.log("Loaded warehouse items:", warehouseResponse.warehouse_items?.length || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(); // Load all warehouse items
  }, []);

  // Filter items based on search term and filters
  const filteredItems = warehouseItems.filter((item) => {
    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        (item.barcode_id && item.barcode_id.toLowerCase().includes(searchLower)) ||
        (item.qr_code && item.qr_code.toLowerCase().includes(searchLower)) ||
        (item.client_name && item.client_name.toLowerCase().includes(searchLower)) ||
        (item.order_id && item.order_id.toLowerCase().includes(searchLower)) ||
        (item.paper_spec && item.paper_spec.toLowerCase().includes(searchLower))
      );
      if (!matchesSearch) return false;
    }

    // Client filter
    if (filters.client !== "all" && item.client_name !== filters.client) {
      return false;
    }

    // Paper spec filter
    if (filters.paperSpec !== "all" && item.paper_spec !== filters.paperSpec) {
      return false;
    }

    // Weight filters
    if (filters.minWeight && item.weight_kg < parseFloat(filters.minWeight)) {
      return false;
    }
    if (filters.maxWeight && item.weight_kg > parseFloat(filters.maxWeight)) {
      return false;
    }

    // Wastage filter
    if (filters.isWastage === "wastage" && !item.is_wastage_roll) {
      return false;
    }
    if (filters.isWastage === "non-wastage" && item.is_wastage_roll) {
      return false;
    }

    return true;
  });

  // Get unique clients and paper specs for filter dropdowns
  const uniqueClients = Array.from(new Set(warehouseItems.map(item => item.client_name).filter(Boolean)));
  const uniquePaperSpecs = Array.from(new Set(warehouseItems.map(item => item.paper_spec).filter(Boolean)));

  // Print functionality - Simple HTML table
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Warehouse Items Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          h1 {
            text-align: center;
            margin-bottom: 10px;
          }
          .info {
            text-align: center;
            margin-bottom: 20px;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .wastage-badge {
            background-color: #fef3c7;
            color: #92400e;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
          }
          @media print {
            body { padding: 10px; }
          }
        </style>
      </head>
      <body>
        <h1>Warehouse Items Report</h1>
        <div class="info">
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <p>Total Items: ${filteredItems.length}</p>
          <p>Total Weight: ${filteredItems.reduce((sum, item) => sum + (item.weight_kg || 0), 0).toFixed(1)} kg</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>QR Code</th>
              <th>Client</th>
              <th>Order</th>
              <th>Paper Specs</th>
              <th>Width (in)</th>
              <th>Weight (kg)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.barcode_id || item.qr_code}</td>
                <td>${item.client_name || 'N/A'}</td>
                <td>${item.order_id || 'N/A'}</td>
                <td>
                  ${item.paper_spec}
                  ${item.is_wastage_roll ? '<span class="wastage-badge">Stock</span>' : ''}
                </td>
                <td>${item.width_inches}"</td>
                <td>${item.weight_kg} kg</td>
                <td>${item.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      client: "all",
      paperSpec: "all",
      minWeight: "",
      maxWeight: "",
      isWastage: "all",
    });
    toast.success("Filters cleared");
  };

  const getStatusBadge = (status: string, itemType: ItemType = "warehouse") => {
    const variant = getStatusBadgeVariant(status, itemType === "warehouse" ? "order_item" : "pending_order");
    const displayText = getStatusDisplayText(status);
    
    const iconMap = {
      'in_warehouse': Package,
      'pending': Clock,
      'completed': CheckCircle,
      'included_in_plan': AlertCircle,
      'resolved': CheckCircle
    };
    
    const Icon = iconMap[status as keyof typeof iconMap] || Package;
    
    return (
      <Badge variant={variant as "default" | "secondary" | "destructive" | "outline"}>
        <Icon className="w-3 h-3 mr-1" />
        {displayText}
      </Badge>
    );
  };

  

  const warehouseItemsCount = warehouseItems.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="w-8 h-8 text-primary" />
            Weight Updated Rolls
          </h1>
        </div>

       

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warehouseItemsCount}</div>
              <p className="text-xs text-muted-foreground">
                Ready for dispatch
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Filtered Items</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {filteredItems.length}
              </div>
              <p className="text-xs text-muted-foreground">Matching filters</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {filteredItems
                  .reduce((sum, item) => sum + (item.weight_kg || 0), 0)
                  .toFixed(1)}kg
              </div>
              <p className="text-xs text-muted-foreground">Filtered items weight</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Heavy Rolls</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {filteredItems.filter(item => item.weight_kg > 10).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {'>'}10kg rolls
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Warehouse Items</CardTitle>
                  <CardDescription>
                    View and filter all warehouse items ready for dispatch
                  </CardDescription>
                </div>
                <div className="flex gap-2 no-print">
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    {showFilters ? "Hide Filters" : "Show Filters"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePrint}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-4 no-print">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by QR code, client, order, or paper spec..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-8"
                  />
                  {searchTerm && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-1 top-1 h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {searchTerm && (
                  <div className="text-sm text-muted-foreground">
                    Found {filteredItems.length} of {warehouseItems.length} items
                  </div>
                )}
              </div>

              {/* Filters Section */}
              {showFilters && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/50 no-print">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Filters</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Client Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Client</label>
                      <Select
                        value={filters.client}
                        onValueChange={(value) => setFilters({ ...filters, client: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectSearch
                            placeholder="Search clients..."
                            value={clientSearchTerm}
                            onChange={(e) => setClientSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                          <SelectItem value="all">All Clients</SelectItem>
                          {uniqueClients
                            .filter((client) =>
                              client.toLowerCase().includes(clientSearchTerm.toLowerCase())
                            )
                            .sort((a, b) => a.localeCompare(b))
                            .map((client) => (
                              <SelectItem key={client} value={client}>
                                {client}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Paper Spec Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Paper Spec</label>
                      <Select
                        value={filters.paperSpec}
                        onValueChange={(value) => setFilters({ ...filters, paperSpec: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectSearch
                            placeholder="Search paper specs..."
                            value={paperSpecSearchTerm}
                            onChange={(e) => setPaperSpecSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                          <SelectItem value="all">All Specs</SelectItem>
                          {uniquePaperSpecs
                            .filter((spec) =>
                              spec.toLowerCase().includes(paperSpecSearchTerm.toLowerCase())
                            )
                            .sort((a, b) => a.localeCompare(b))
                            .map((spec) => (
                              <SelectItem key={spec} value={spec}>
                                {spec}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Min Weight Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Min Weight (kg)</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={filters.minWeight}
                        onChange={(e) => setFilters({ ...filters, minWeight: e.target.value })}
                      />
                    </div>

                    {/* Max Weight Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max Weight (kg)</label>
                      <Input
                        type="number"
                        placeholder="100"
                        value={filters.maxWeight}
                        onChange={(e) => setFilters({ ...filters, maxWeight: e.target.value })}
                      />
                    </div>

                    {/* Wastage Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Roll Type</label>
                      <Select
                        value={filters.isWastage}
                        onValueChange={(value) => setFilters({ ...filters, isWastage: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectSearch
                            placeholder="Search roll types..."
                            value={wastageSearchTerm}
                            onChange={(e) => setWastageSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="wastage">Stock Only</SelectItem>
                          <SelectItem value="non-wastage">Non-Stock Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredItems.length} of {warehouseItems.length} items
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>QR Code</TableHead>
                    <TableHead>Client & Order</TableHead>
                    <TableHead>Paper Specs</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item: any, index) => (
                      <TableRow
                        key={item.inventory_id || item.id}
                      >
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-mono text-sm">
                              {highlightText(item.barcode_id || item.qr_code, searchTerm)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Created by: {item.created_by}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-blue-600" />
                              {highlightText(item.client_name || "N/A", searchTerm)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Order: {highlightText(item.order_id || "N/A", searchTerm)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{highlightText(item.paper_spec, searchTerm)}</span>
                              <WastageIndicator isWastageRoll={item.is_wastage_roll} />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.is_wastage_roll ? "Stock roll ready for dispatch" : "Cut roll ready for dispatch"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-medium">{item.width_inches}"</div>
                            <div className="text-xs text-muted-foreground">
                              width
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-medium">{item.weight_kg}kg</div>
                            <div className="text-xs text-green-600">
                              Weight verified
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status, "warehouse")}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        {loading ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading warehouse items...
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <div className="text-muted-foreground">
                              <p className="font-medium">No items found</p>
                              <p className="text-sm">
                                {searchTerm || filters.client !== "all" || filters.paperSpec !== "all" || filters.minWeight || filters.maxWeight || filters.isWastage !== "all"
                                  ? "Try adjusting your search or filters"
                                  : "No warehouse items available"
                                }
                              </p>
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
