/**
 * Wastage Inventory page - Manage wastage rolls and inventory
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
} from "@/components/ui/select";
import {
  Recycle,
  Search,
  BarChart3,
  Loader2,
  Package,
  Ruler,
  Calendar,
  Plus,
  Edit,
  Filter,
  X,
} from "lucide-react";
import {
  WastageInventory,
  WastageStats,
  fetchWastageInventory,
  fetchWastageStats,
} from "@/lib/wastage";
import CreateWastageModal from "@/components/CreateWastageModal";
import EditWastageModal from "@/components/EditWastageModal";

export default function WastagePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPaperType, setSelectedPaperType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [wastageItems, setWastageItems] = useState<WastageInventory[]>([]);
  const [stats, setStats] = useState<WastageStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedWastageItem, setSelectedWastageItem] = useState<WastageInventory | null>(null);

  const loadWastageData = async () => {
    try {
      setLoading(true);
      const [wastageResponse, statsResponse] = await Promise.all([
        fetchWastageInventory(1, 1000), // Get all items without search term - handle search on frontend
        fetchWastageStats(),
      ]);

      setWastageItems(wastageResponse.items);
      setStats(statsResponse);
    } catch (error) {
      console.error("Error loading wastage data:", error);
      toast.error("Failed to load wastage data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWastageData();
  }, []); // Only load data once on component mount


  const handleEditWastage = (item: WastageInventory) => {
    setSelectedWastageItem(item);
    setEditModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "available":
        return <Badge variant="secondary">Available</Badge>;
      case "used":
        return <Badge variant="default">Used</Badge>;
      case "damaged":
        return <Badge variant="destructive">Damaged</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Enhanced omni search with fuzzy matching and exact match prioritization
  const omniSearchFilter = (item: WastageInventory, term: string) => {
    if (!term.trim()) return true;

    const searchLower = term.toLowerCase();
    const fields = [
      item.reel_no?.toLowerCase() || '',
      item.frontend_id?.toLowerCase() || '',
      item.barcode_id?.toLowerCase() || '',
    ];

    // Exact match gets highest priority
    const exactMatch = fields.some(field => field === searchLower);
    if (exactMatch) return true;

    // Starts with match gets second priority
    const startsWithMatch = fields.some(field => field.startsWith(searchLower));
    if (startsWithMatch) return true;

    // Contains match gets third priority
    const containsMatch = fields.some(field => field.includes(searchLower));
    if (containsMatch) return true;

    // Fuzzy search for partial matches
    const words = searchLower.split(' ').filter(w => w.length > 0);
    return words.every(word =>
      fields.some(field => field.includes(word))
    );
  };

  // Get unique paper types sorted by GSM (average for each type)
  const paperTypes = Array.from(new Set(
    wastageItems
      .filter(item => item.paper?.type)
      .map(item => item.paper!.type)
  ))
    .map(type => {
      const itemsOfType = wastageItems.filter(item => item.paper?.type === type);
      const avgGsm = itemsOfType.reduce((sum, item) => sum + (item.paper?.gsm || 0), 0) / itemsOfType.length;
      return { type, avgGsm };
    })
    .sort((a, b) => a.avgGsm - b.avgGsm)
    .map(item => item.type);

  // Get unique statuses with counts
  const statusOptions = Array.from(new Set(wastageItems.map(item => item.status.toLowerCase())))
    .map(status => ({
      value: status,
      label: status.charAt(0).toUpperCase() + status.slice(1),
      count: wastageItems.filter(item => item.status.toLowerCase() === status).length
    }))
    .sort((a, b) => b.count - a.count); // Sort by count (most common first)

  const filteredItems = (wastageItems || [])
    .filter(item => omniSearchFilter(item, searchTerm))
    .filter(item => selectedPaperType === "all" || item.paper?.type === selectedPaperType)
    .filter(item => selectedStatus === "all" || item.status.toLowerCase() === selectedStatus)
    .sort((a, b) => {
      // Sort by GSM within the filtered results
      const aGsm = a.paper?.gsm || 0;
      const bGsm = b.paper?.gsm || 0;
      return aGsm - bGsm;
    });

  // Component for highlighting search text
  const HighlightText = ({ text, searchTerm }: { text: string; searchTerm: string }) => {
    if (!searchTerm || !text) return <span>{text}</span>;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded">
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Stock Inventory</h2>
            <p className="text-muted-foreground">
              Manage stock rolls from production cuts and manual stock entries
            </p>
          </div>
          <CreateWastageModal onWastageCreated={loadWastageData} />
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Rolls</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_rolls}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Width</CardTitle>
                <Ruler className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_width_inches}"</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available</CardTitle>
                <Recycle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.available_rolls}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Width</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avg_width_inches.toFixed(1)}"</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Rolls</CardTitle>
            <CardDescription>
              Browse and manage stock inventory from production cuts and manual entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Omni search: reel no, barcode, paper specs, GSM, width, status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Select value={selectedPaperType} onValueChange={setSelectedPaperType}>
                    <SelectTrigger className="w-full min-w-[180px] lg:w-48">
                      <SelectValue placeholder="Paper type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Paper Types</SelectItem>
                      {paperTypes.length > 0 ? (
                        paperTypes.map((type) => {
                          const itemsOfType = wastageItems.filter(item => item.paper?.type === type);
                          const avgGsm = Math.round(itemsOfType.reduce((sum, item) => sum + (item.paper?.gsm || 0), 0) / itemsOfType.length);
                          return (
                            <SelectItem key={type} value={type}>
                              {type} (GSM: {avgGsm})
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="no-types" disabled>
                          No paper types available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-full min-w-[150px] lg:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label} ({status.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(selectedPaperType !== "all" || selectedStatus !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPaperType("all");
                      setSelectedStatus("all");
                    }}
                    className="flex-shrink-0"
                    title="Clear all filters"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {!loading && (searchTerm || selectedPaperType !== "all" || selectedStatus !== "all") && (
              <div className="mb-4 text-sm text-muted-foreground">
                Showing {filteredItems.length} of {wastageItems.length} items
                {searchTerm && ` matching "${searchTerm}"`}
                {selectedPaperType !== "all" && ` • paper type: "${selectedPaperType}"`}
                {selectedStatus !== "all" && ` • status: "${selectedStatus}"`}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reel Number</TableHead>
                        <TableHead>Stock ID</TableHead>
                        <TableHead>Barcode</TableHead>
                        <TableHead>Width</TableHead>
                        <TableHead>Paper Specs</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            {searchTerm || selectedPaperType !== "all" || selectedStatus !== "all"
                              ? "No stock items match your current search and filters."
                              : "No stock items found"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium px-4">
                              <HighlightText text={item.reel_no || "-"} searchTerm={searchTerm} />
                            </TableCell>
                            <TableCell >
                              <HighlightText text={item.frontend_id} searchTerm={searchTerm} />
                            </TableCell>
                            <TableCell>
                              <code className="text-sm bg-muted px-2 py-1 rounded">
                                <HighlightText text={item.barcode_id} searchTerm={searchTerm} />
                              </code>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Ruler className="h-4 w-4 mr-1 text-muted-foreground" />
                                {item.width_inches}"
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.paper ? (
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {item.paper.gsm}GSM • {item.paper.bf}BF • <HighlightText text={item.paper.shade} searchTerm={searchTerm} />
                                  </div>
                                  {item.paper.type && (
                                    <div className="text-muted-foreground">
                                      <HighlightText text={item.paper.type} searchTerm={searchTerm} />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            
                            <TableCell>
                              {getStatusBadge(item.status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(item.created_at).toLocaleDateString('en-GB')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditWastage(item)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Item count */}
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredItems.length} items
                    {(searchTerm || selectedPaperType !== "all" || selectedStatus !== "all") && ` (filtered from ${wastageItems.length} total)`}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit Modal */}
        <EditWastageModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          wastageItem={selectedWastageItem}
          onWastageUpdated={loadWastageData}
        />
      </div>
    </DashboardLayout>
  );
}