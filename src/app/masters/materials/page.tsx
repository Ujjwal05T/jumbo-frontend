/**
 * Material Master page - Manage material information
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import MaterialForm from "@/components/MaterialForm";
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
  Loader2,
  AlertCircle,
  Weight,
  Ruler
} from "lucide-react";
import { 
  Material, 
  CreateMaterialData, 
  fetchMaterials, 
  createMaterial, 
  updateMaterial, 
  deleteMaterial 
} from "@/lib/material-management";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function MaterialMasterPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    materialId: string;
    materialName: string;
  }>({ open: false, materialId: "", materialName: "" });

  // Load materials on component mount
  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      setError(null);
      const materialsData = await fetchMaterials(0, 100);
      setMaterials(materialsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMaterial = async (materialData: CreateMaterialData) => {
    try {
      setFormLoading(true);
      await createMaterial(materialData);
      setShowMaterialForm(false);
      await loadMaterials(); // Reload materials after creation
      toast.success("Material created successfully!");
    } catch (err) {
      throw err; // Let the form handle the error
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditMaterial = (material: Material) => {
    setEditingMaterial(material);
  };

  const handleUpdateMaterial = async (materialData: CreateMaterialData) => {
    if (!editingMaterial) return;
    
    try {
      setFormLoading(true);
      await updateMaterial(editingMaterial.id, materialData);
      setEditingMaterial(null);
      await loadMaterials(); // Reload materials after update
      toast.success("Material updated successfully!");
    } catch (err) {
      throw err; // Let the form handle the error
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClick = (material: Material) => {
    setDeleteDialog({
      open: true,
      materialId: material.id,
      materialName: material.name
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteMaterial(deleteDialog.materialId);
      setDeleteDialog({ open: false, materialId: "", materialName: "" });
      await loadMaterials(); // Reload materials after deletion
      toast.success("Material deleted successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete material');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, materialId: "", materialName: "" });
  };

  // Filter materials based on search term
  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.unit_of_measure.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium">Error loading materials</p>
            <p className="text-gray-500 text-sm">{error}</p>
            <Button onClick={loadMaterials} className="mt-4" variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="h-6 w-6" />
              Material Master
            </h1>
            <p className="text-gray-600 mt-1">Manage materials and their information</p>
          </div>
          <Button onClick={() => setShowMaterialForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Material
          </Button>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search materials by name or unit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Materials Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Materials ({filteredMaterials.length})</span>
              <Badge variant="secondary" className="ml-2">
                {materials.length} total
              </Badge>
            </CardTitle>
            <CardDescription>
              View and manage all materials in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No materials found</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm ? "Try adjusting your search criteria" : "Get started by adding your first material"}
                </p>
                <Button onClick={() => setShowMaterialForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Material
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Unit of Measure</TableHead>
                      <TableHead>Current Quantity</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{material.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-gray-400" />
                            <span>{material.unit_of_measure}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Weight className="h-4 w-4 text-gray-400" />
                            <span>{material.current_quantity} {material.unit_of_measure}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(material.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditMaterial(material)}
                                className="flex items-center gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(material)}
                                className="flex items-center gap-2 text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Material Form Modal */}
        {(showMaterialForm || editingMaterial) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <MaterialForm
                onSubmit={editingMaterial ? handleUpdateMaterial : handleCreateMaterial}
                onCancel={() => {
                  setShowMaterialForm(false);
                  setEditingMaterial(null);
                }}
                initialData={editingMaterial || {}}
                isLoading={formLoading}
                title={editingMaterial ? "Edit Material" : "Add New Material"}
                isEditing={!!editingMaterial}
              />
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialog.open}
          onOpenChange={(open) => !open && handleDeleteCancel()}
          onConfirm={handleDeleteConfirm}
          title="Delete Material"
          description={`Are you sure you want to delete "${deleteDialog.materialName}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="destructive"
        />
      </div>
    </DashboardLayout>
  );
}