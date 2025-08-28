/**
 * Paper Master page - Manage paper inventory and specifications
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Package,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Paper, fetchPapers, deletePaper } from "@/lib/papers";
import { PaperForm } from "@/components/PaperForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const HighlightText = ({ text, searchTerm }: { text: string; searchTerm: string }) => {
  if (!searchTerm.trim()) return <span>{text}</span>;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <span>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <span key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
};

export default function PaperMasterPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    paperId: string;
    paperName: string;
  }>({ open: false, paperId: "", paperName: "" });

  const loadPapers = async () => {
    try {
      setLoading(true);
      setError(null);
      const papersData = await fetchPapers();
      setPapers(papersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load papers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPapers();
  }, []);

  const handleEditPaper = (paper: Paper) => {
    setEditingPaper(paper);
  };

  const handleDeletePaper = (paper: Paper) => {
    setDeleteDialog({
      open: true,
      paperId: paper.id,
      paperName: paper.name,
    });
  };

  const confirmDeletePaper = async () => {
    try {
      await deletePaper(deleteDialog.paperId);
      await loadPapers();
      toast.success("Paper type deleted successfully.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete paper type"
      );
    }
  };

  const handleEditSuccess = () => {
    setEditingPaper(null);
    loadPapers();
  };

  const filteredPapers = papers.filter(
    (paper) =>
      paper.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paper.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paper.shade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paper.gsm.toString().includes(searchTerm.toLowerCase()) ||
      paper.bf.toString().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
        Inactive
      </Badge>
    );
  };

  const totalItems = papers.length;
  const activeItems = papers.filter((p) => p.status === "active").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Package className="w-8 h-8 text-primary" />
              Paper Master
            </h1>
            <p className="text-muted-foreground">
              Manage paper inventory, specifications, and stock levels
            </p>
          </div>
          <div className="flex gap-2">
            <PaperForm onSuccess={loadPapers} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : totalItems}
              </div>
              <p className="text-xs text-muted-foreground">Paper types</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {loading ? "..." : activeItems}
              </div>
              <p className="text-xs text-muted-foreground">
                Active paper types
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <CardTitle>Paper Inventory</CardTitle>
            <CardDescription>
              Manage paper types, stock levels, and specifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search papers by name, type, shade, GSM, or BF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-md text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paper ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>GSM</TableHead>
                      <TableHead>BF</TableHead>
                      <TableHead>Shade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPapers.length > 0 ? (
                      filteredPapers.map((paper) => (
                        <TableRow key={paper.id}>
                          <TableCell className="font-mono text-sm font-medium">
                            {paper.frontend_id || 'Generating...'}
                          </TableCell>
                          <TableCell className="font-medium">
                            <HighlightText text={paper.name} searchTerm={searchTerm} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              <HighlightText text={paper.type} searchTerm={searchTerm} />
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <HighlightText text={paper.gsm.toString()} searchTerm={searchTerm} />
                          </TableCell>
                          <TableCell>
                            <HighlightText text={paper.bf.toString()} searchTerm={searchTerm} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full border"
                                style={{
                                  backgroundColor: paper.shade.toLowerCase(),
                                }}
                                title={paper.shade}
                              />
                              <span>
                                <HighlightText text={paper.shade} searchTerm={searchTerm} />
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(paper.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleEditPaper(paper)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDeletePaper(paper)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
                          No papers found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Paper Dialog */}
      <PaperForm
        editingPaper={editingPaper}
        isEditing={true}
        open={!!editingPaper}
        onOpenChange={(open) => !open && setEditingPaper(null)}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title="Delete Paper Type"
        description={`Are you sure you want to delete "${deleteDialog.paperName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDeletePaper}
      />
    </DashboardLayout>
  );
}
