/**
 * Past Inventory Items page - Display imported inventory data with filters
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Package, 
  Search, 
  Filter, 
  Calendar,
  Weight,
  FileText,
  TrendingUp,
  Package2,
  Database
} from "lucide-react";
import {
  fetchInventoryItems,
  fetchInventoryStats,
  fetchFilterOptions,
  type InventoryItem,
  type InventoryFilters,
  type InventoryStats,
  type FilterOptions
} from "@/lib/inventory-items";

export default function PastInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter states
  const [filters, setFilters] = useState<InventoryFilters>({
    per_page: 50,
    page: 1
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGSM, setSelectedGSM] = useState<string>("");
  const [selectedBF, setSelectedBF] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filters object
      const currentFilters: InventoryFilters = {
        page: currentPage,
        per_page: 50,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedGSM && selectedGSM !== "all" && { gsm: parseInt(selectedGSM) }),
        ...(selectedBF && selectedBF !== "all" && { bf: parseInt(selectedBF) }),
        ...(selectedGrade && selectedGrade !== "all" && { grade: selectedGrade }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(minWeight && { min_weight: parseFloat(minWeight) }),
        ...(maxWeight && { max_weight: parseFloat(maxWeight) })
      };

      const [itemsData, statsData, filtersData] = await Promise.all([
        fetchInventoryItems(currentFilters),
        fetchInventoryStats(),
        fetchFilterOptions()
      ]);

      setItems(itemsData.items);
      setTotalPages(itemsData.total_pages);
      setTotalItems(itemsData.total);
      setStats(statsData);
      setFilterOptions(filtersData);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load inventory data';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage, selectedGSM, selectedBF, selectedGrade, startDate, endDate]);

  const handleSearch = () => {
    setCurrentPage(1);
    loadData();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedGSM("");
    setSelectedBF("");
    setSelectedGrade("");
    setStartDate("");
    setEndDate("");
    setMinWeight("");
    setMaxWeight("");
    setCurrentPage(1);
    loadData();
  };

  const formatWeight = (weight?: number) => {
    return weight ? `${weight.toFixed(2)} kg` : 'N/A';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Database className="w-8 h-8 text-primary" />
              Past Inventory Items
            </h1>
            <p className="text-muted-foreground">
              View imported inventory data with advanced filtering
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                <Package2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_items.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Inventory records
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
                <Weight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(stats.total_weight_kg / 1000).toFixed(1)}T</div>
                <p className="text-xs text-muted-foreground">
                  {stats.total_weight_kg.toFixed(0)} kg total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Weight</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.average_weight_kg.toFixed(1)}kg</div>
                <p className="text-xs text-muted-foreground">
                  Per item average
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Specs</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.unique_gsm_values}</div>
                <p className="text-xs text-muted-foreground">
                  GSM variants
                </p>
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
                  <Filter className="w-4 h-4" />
                  Filters
                </CardTitle>
                <CardDescription>
                  Filter inventory items by various criteria
                </CardDescription>
              </div>
              <Button variant="outline" onClick={handleClearFilters}>
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Dropdowns Row */}
            <div className="grid gap-4 md:grid-cols-6">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search reel no, size, grade..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>
              <div>
                <Select value={selectedGSM} onValueChange={setSelectedGSM}>
                  <SelectTrigger>
                    <SelectValue placeholder="GSM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All GSM</SelectItem>
                    {filterOptions?.gsm_options.map((gsm) => (
                      <SelectItem key={gsm} value={gsm.toString()}>
                        {gsm} GSM
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={selectedBF} onValueChange={setSelectedBF}>
                  <SelectTrigger>
                    <SelectValue placeholder="BF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All BF</SelectItem>
                    {filterOptions?.bf_options.map((bf) => (
                      <SelectItem key={bf} value={bf.toString()}>
                        {bf} BF
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Shade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shades</SelectItem>
                    {filterOptions?.grade_options.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button onClick={handleSearch} className="w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>

            {/* Date and Weight Filters Row */}
            <div className="grid gap-4 md:grid-cols-6">
              <div>
                <Input
                  type="date"
                  placeholder="Start Date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Input
                  type="date"
                  placeholder="End Date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="Min Weight (kg)"
                  value={minWeight}
                  onChange={(e) => setMinWeight(e.target.value)}
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="Max Weight (kg)"
                  value={maxWeight}
                  onChange={(e) => setMaxWeight(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Inventory Items ({totalItems.toLocaleString()})</CardTitle>
                <CardDescription>
                  Showing page {currentPage} of {totalPages} ({items.length} items)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">
                Error: {error}
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stock ID</TableHead>
                        <TableHead>SNO</TableHead>
                        <TableHead>Reel No</TableHead>
                        <TableHead>GSM</TableHead>
                        <TableHead>BF</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Shade</TableHead>
                        <TableHead>Stock Date</TableHead>
                        <TableHead>Imported</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length > 0 ? (
                        items.map((item) => (
                          <TableRow key={item.stock_id}>
                            <TableCell className="font-medium">
                              {item.stock_id}
                            </TableCell>
                            <TableCell>{item.sno_from_file || 'N/A'}</TableCell>
                            <TableCell className="font-mono">
                              {item.reel_no || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {item.gsm ? (
                                <Badge variant="secondary">{item.gsm} GSM</Badge>
                              ) : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {item.bf ? (
                                <Badge variant="outline">{item.bf} BF</Badge>
                              ) : 'N/A'}
                            </TableCell>
                            <TableCell className="font-mono">
                              {item.size || 'N/A'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatWeight(item.weight_kg)}
                            </TableCell>
                            <TableCell>
                              {item.grade ? (
                                <Badge variant={item.grade === 'N' ? 'default' : 'secondary'}>
                                  {item.grade}
                                </Badge>
                              ) : 'N/A'}
                            </TableCell>
                            <TableCell>{formatDate(item.stock_date)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(item.record_imported_at)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={10} className="h-24 text-center">
                            No inventory items found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * 50) + 1} to {Math.min(currentPage * 50, totalItems)} of {totalItems} items
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                          return (
                            <Button
                              key={pageNum}
                              variant={pageNum === currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}