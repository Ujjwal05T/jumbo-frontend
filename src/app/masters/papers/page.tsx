/**
 * Paper Master page - Manage paper inventory and specifications
 */
"use client";

import { useState, useEffect } from "react";
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
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Package, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { Paper, fetchPapers, deletePaper } from "@/lib/papers";
import { PaperForm } from "@/components/PaperForm";

export default function PaperMasterPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPapers = async () => {
    try {
      setLoading(true);
      setError(null);
      const papersData = await fetchPapers();
      setPapers(papersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load papers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPapers();
  }, []);
  
  const handleDeletePaper = async (id: string) => {
    if (!confirm('Are you sure you want to delete this paper type?')) {
      return;
    }

    try {
      await deletePaper(id);
      await loadPapers();
      alert("Paper type deleted successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete paper type');
    }
  };
  
  const filteredPapers = papers.filter(paper =>
    paper.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paper.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paper.shade.toLowerCase().includes(searchTerm.toLowerCase())
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
  const activeItems = papers.filter(p => p.status === "active").length;

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
              <div className="text-2xl font-bold">{loading ? "..." : totalItems}</div>
              <p className="text-xs text-muted-foreground">
                Paper types
              </p>
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
                  placeholder="Search papers by name, type, or shade..."
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
                          <TableCell className="font-medium">{paper.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{paper.type}</Badge>
                          </TableCell>
                          <TableCell>{paper.gsm}</TableCell>
                          <TableCell>{paper.bf}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full border" 
                                style={{ backgroundColor: paper.shade.toLowerCase() }}
                                title={paper.shade}
                              />
                              <span>{paper.shade}</span>
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
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => handleDeletePaper(paper.id)}
                                >
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
                        <TableCell colSpan={7} className="h-24 text-center">
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
    </DashboardLayout>
  );
}