/**
 * Paper Master page - Manage paper inventory and specifications
 */
"use client";

import { useState } from "react";
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
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  AlertTriangle,
  CheckCircle,
  Ruler,
  Weight,
  Palette
} from "lucide-react";

interface Paper {
  id: string;
  name: string;
  type: string;
  size: string;
  weight: number; // GSM
  color: string;
  finish: string;
  stockQuantity: number;
  reorderLevel: number;
  unitPrice: number;
  supplier: string;
  lastRestocked: string;
  status: "in_stock" | "low_stock" | "out_of_stock";
  qualityGrade: "A" | "B" | "C";
}

export default function PaperMasterPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Dummy paper data
  const papers: Paper[] = [
    {
      id: "PAP-001",
      name: "Premium A4 White",
      type: "Copy Paper",
      size: "A4 (210x297mm)",
      weight: 80,
      color: "White",
      finish: "Smooth",
      stockQuantity: 15000,
      reorderLevel: 5000,
      unitPrice: 0.05,
      supplier: "Paper Mills Inc",
      lastRestocked: "2024-01-15",
      status: "in_stock",
      qualityGrade: "A"
    },
    {
      id: "PAP-002",
      name: "Standard A3 White",
      type: "Copy Paper",
      size: "A3 (297x420mm)",
      weight: 75,
      color: "White",
      finish: "Smooth",
      stockQuantity: 3200,
      reorderLevel: 5000,
      unitPrice: 0.12,
      supplier: "Global Paper Co",
      lastRestocked: "2024-01-10",
      status: "low_stock",
      qualityGrade: "B"
    },
    {
      id: "PAP-003",
      name: "Glossy A4 Photo",
      type: "Photo Paper",
      size: "A4 (210x297mm)",
      weight: 200,
      color: "White",
      finish: "Glossy",
      stockQuantity: 8500,
      reorderLevel: 2000,
      unitPrice: 0.25,
      supplier: "Premium Papers Ltd",
      lastRestocked: "2024-01-20",
      status: "in_stock",
      qualityGrade: "A"
    },
    {
      id: "PAP-004",
      name: "Kraft Brown A5",
      type: "Kraft Paper",
      size: "A5 (148x210mm)",
      weight: 120,
      color: "Brown",
      finish: "Natural",
      stockQuantity: 0,
      reorderLevel: 3000,
      unitPrice: 0.08,
      supplier: "Eco Papers",
      lastRestocked: "2023-12-28",
      status: "out_of_stock",
      qualityGrade: "B"
    },
    {
      id: "PAP-005",
      name: "Custom Size Premium",
      type: "Custom Paper",
      size: "Custom (varies)",
      weight: 90,
      color: "Various",
      finish: "Matte",
      stockQuantity: 6800,
      reorderLevel: 2500,
      unitPrice: 0.18,
      supplier: "Custom Solutions",
      lastRestocked: "2024-01-18",
      status: "in_stock",
      qualityGrade: "A"
    },
    {
      id: "PAP-006",
      name: "Recycled A4 Gray",
      type: "Recycled Paper",
      size: "A4 (210x297mm)",
      weight: 70,
      color: "Gray",
      finish: "Textured",
      stockQuantity: 1800,
      reorderLevel: 4000,
      unitPrice: 0.06,
      supplier: "Green Papers Co",
      lastRestocked: "2024-01-12",
      status: "low_stock",
      qualityGrade: "C"
    }
  ];

  const filteredPapers = papers.filter(paper =>
    paper.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paper.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paper.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paper.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_stock":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          In Stock
        </Badge>;
      case "low_stock":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Low Stock
        </Badge>;
      case "out_of_stock":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Out of Stock
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case "A":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Grade A</Badge>;
      case "B":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Grade B</Badge>;
      case "C":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Grade C</Badge>;
      default:
        return <Badge variant="secondary">Grade {grade}</Badge>;
    }
  };

  const totalItems = papers.length;
  const inStockItems = papers.filter(paper => paper.status === "in_stock").length;
  const lowStockItems = papers.filter(paper => paper.status === "low_stock").length;
  const outOfStockItems = papers.filter(paper => paper.status === "out_of_stock").length;
  const totalValue = papers.reduce((sum, paper) => sum + (paper.stockQuantity * paper.unitPrice), 0);

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
            <Button variant="outline" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Reorder Alerts
            </Button>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Paper Type
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground">
                Paper types
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Stock</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{inStockItems}</div>
              <p className="text-xs text-muted-foreground">
                Available items
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{lowStockItems}</div>
              <p className="text-xs text-muted-foreground">
                Need reorder
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{outOfStockItems}</div>
              <p className="text-xs text-muted-foreground">
                Urgent reorder
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <Weight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Inventory value
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
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
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search papers by name, type, size, or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline">Type Filter</Button>
              <Button variant="outline">Stock Status</Button>
              <Button variant="outline">Export</Button>
            </div>

            {/* Papers Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paper Details</TableHead>
                    <TableHead>Specifications</TableHead>
                    <TableHead>Stock Status</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Pricing</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Last Restocked</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPapers.map((paper) => (
                    <TableRow key={paper.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{paper.name}</div>
                          <div className="text-sm text-muted-foreground">{paper.type}</div>
                          <div className="text-xs text-muted-foreground">{paper.id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Ruler className="w-3 h-3" />
                            {paper.size}
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Weight className="w-3 h-3" />
                            {paper.weight} GSM
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Palette className="w-3 h-3" />
                            {paper.color} - {paper.finish}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {getStatusBadge(paper.status)}
                          <div className="text-sm">
                            <div>Stock: {paper.stockQuantity.toLocaleString()}</div>
                            <div className="text-muted-foreground">
                              Reorder: {paper.reorderLevel.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getGradeBadge(paper.qualityGrade)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">${paper.unitPrice}</div>
                          <div className="text-sm text-muted-foreground">per unit</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{paper.supplier}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{paper.lastRestocked}</div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Paper
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Package className="mr-2 h-4 w-4" />
                              Update Stock
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Reorder Now
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove Paper
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredPapers.length === 0 && (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No papers found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search criteria or add a new paper type.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}