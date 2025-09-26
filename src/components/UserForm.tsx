/**
 * User Form Component - For creating and editing users
 */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateUserFormData, UpdateUserData, User as ApiUser, createUser, updateUser } from "@/lib/users";
import { User, Plus, Loader2 } from "lucide-react";

interface UserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isOpen?: boolean;
  editingUser?: ApiUser | null;
  isEditing?: boolean;
}

export default function UserForm({ onSuccess, onCancel, isOpen = true, editingUser, isEditing = false }: UserFormProps) {
  const [formData, setFormData] = useState<CreateUserFormData>({
    name: editingUser?.name || "",
    username: editingUser?.username || "",
    password: "",
    role: editingUser?.role || "",
    contact: editingUser?.contact || "",
    department: editingUser?.department || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof CreateUserFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.name || !formData.username || (!formData.password && !isEditing) || !formData.role) {
        throw new Error("Please fill in all required fields");
      }

      if (isEditing && editingUser) {
        // For editing, exclude password field entirely for security
        const updateData: UpdateUserData = {
          name: formData.name,
          role: formData.role,
          contact: formData.contact || undefined,
          department: formData.department || undefined
          // Password updates are disabled for security
        };
        await updateUser(editingUser.id, updateData);
      } else {
        await createUser(formData);
      }
      
      // Reset form
      setFormData({
        name: "",
        username: "",
        password: "",
        role: "",
        contact: "",
        department: "",
      });

      toast.success(`User ${isEditing ? 'updated' : 'created'} successfully!`);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} user`;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          {isEditing ? 'Edit User' : 'Create New User'}
        </CardTitle>
        <CardDescription>
          {isEditing ? 'Update user information and permissions' : 'Add a new user to the system with appropriate role and permissions'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">
                Password {isEditing ? '(disabled for security)' : <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={isEditing ? "••••••••" : formData.password}
                onChange={isEditing ? undefined : (e) => handleInputChange("password", e.target.value)}
                placeholder={isEditing ? "Password change disabled" : "Enter password"}
                disabled={isEditing}
                required={!isEditing}
                className={isEditing ? "bg-gray-100 cursor-not-allowed" : ""}
              />
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  Password changes are disabled for security. Contact administrator to reset password.
                </p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.role} onValueChange={(value: string) => handleInputChange("role", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800">Admin</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="co_admin">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-700">Co Admin</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="order_puncher">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800">Order Puncher</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="security">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-800">Security</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="planner">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800">Planner</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="poduction">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-yellow-100 text-yellow-800">Production</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="accountant">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-100 text-indigo-800">Accountant</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Email</Label>
              <Input
                id="contact"
                type="email"
                value={formData.contact}
                onChange={(e) => handleInputChange("contact", e.target.value)}
                placeholder="Enter email address"
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={formData.department} onValueChange={(value: string) => handleInputChange("department", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Planning">Planning</SelectItem>
                  <SelectItem value="Quality Control">Quality Control</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="Management">Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {isSubmitting ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update User" : "Create User")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}