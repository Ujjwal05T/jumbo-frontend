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
  Recycle,
  Search,
  BarChart3,
  Loader2,
  Package,
  Ruler,
  Calendar,
  Plus,
  Edit,
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
  const [wastageItems, setWastageItems] = useState<WastageInventory[]>([]);
  const [stats, setStats] = useState<WastageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedWastageItem, setSelectedWastageItem] = useState<WastageInventory | null>(null);

  const loadWastageData = async () => {
    try {
      setLoading(true);
      const [wastageResponse, statsResponse] = await Promise.all([
        fetchWastageInventory(page, 20, searchTerm),
        fetchWastageStats(),
      ]);

      setWastageItems(wastageResponse.items);
      setTotalPages(wastageResponse.total_pages);
      setTotal(wastageResponse.total);
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
  }, [page, searchTerm]);


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

  const filteredItems = wastageItems?.filter((item) =>
    item.frontend_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.barcode_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.paper?.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.paper?.shade?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
            <div className="flex items-center space-x-2 mb-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, barcode, paper type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

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
                            No stock items found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium px-4">
                              {item.reel_no || "-"}
                            </TableCell>
                            <TableCell >
                              {item.frontend_id}
                            </TableCell>
                            <TableCell>
                              <code className="text-sm bg-muted px-2 py-1 rounded">
                                {item.barcode_id}
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
                                  <div className="font-medium">{item.paper.type}</div>
                                  <div className="text-muted-foreground">
                                    {item.paper.gsm}GSM • {item.paper.bf}BF • {item.paper.shade}
                                  </div>
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
                                {new Date(item.created_at).toLocaleDateString()}
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredItems.length} of {total} items
                    </p>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages}
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