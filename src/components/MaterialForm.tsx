/**
 * Material Form Component - For creating and editing materials
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateMaterialData } from "@/lib/material-management";
import { X } from "lucide-react";

interface MaterialFormProps {
  onSubmit: (data: CreateMaterialData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<CreateMaterialData>;
  isLoading?: boolean;
  title?: string;
  isEditing?: boolean;
}

export default function MaterialForm({
  onSubmit,
  onCancel,
  initialData = {},
  isLoading = false,
  title = "Add New Material",
  isEditing = false
}: MaterialFormProps) {
  const [formData, setFormData] = useState<CreateMaterialData>({
    name: initialData.name || "",
    unit_of_measure: initialData.unit_of_measure || "",
    current_quantity: initialData.current_quantity || 0,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateMaterialData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateMaterialData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Material name is required";
    }

    if (!formData.unit_of_measure.trim()) {
      newErrors.unit_of_measure = "Unit of measure is required";
    }

    if (formData.current_quantity < 0) {
      newErrors.current_quantity = "Quantity cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      // Handle API errors
      if (err instanceof Error) {
        if (err.message.includes('name')) {
          setErrors({ name: "Material name already exists" });
        } else {
          setErrors({ name: err.message });
        }
      }
    }
  };

  const handleInputChange = (field: keyof CreateMaterialData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          <CardDescription>
            {isEditing ? "Update material information" : "Enter material details to add to the system"}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Material Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Material Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Scrap Paper, Coal, Rice Husk"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Unit of Measure */}
          <div className="space-y-2">
            <Label htmlFor="unit_of_measure">Unit of Measure *</Label>
            <Input
              id="unit_of_measure"
              placeholder="e.g., KG, TON, METER, PCS"
              value={formData.unit_of_measure}
              onChange={(e) => handleInputChange('unit_of_measure', e.target.value.toUpperCase())}
              className={errors.unit_of_measure ? "border-red-500" : ""}
            />
            {errors.unit_of_measure && (
              <p className="text-sm text-red-600">{errors.unit_of_measure}</p>
            )}
          </div>

          {/* Current Quantity */}
          <div className="space-y-2">
            <Label htmlFor="current_quantity">Current Quantity</Label>
            <Input
              id="current_quantity"
              type="number"
              step="0.001"
              min="0"
              placeholder="0"
              value={formData.current_quantity}
              onChange={(e) => handleInputChange('current_quantity', parseFloat(e.target.value) || 0)}
              className={errors.current_quantity ? "border-red-500" : ""}
            />
            {errors.current_quantity && (
              <p className="text-sm text-red-600">{errors.current_quantity}</p>
            )}
            <p className="text-xs text-gray-500">
              Initial quantity of this material in stock
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEditing ? "Update Material" : "Create Material"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}