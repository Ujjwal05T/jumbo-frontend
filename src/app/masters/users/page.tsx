/**
 * User Master page - Manage system users
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import UserForm from "@/components/UserForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Shield,
  UserCheck,
  UserX,
  Settings,
  Crown,
  User,
  Loader2,
  AlertCircle,
  Truck,
  Clock
} from "lucide-react";
import { User as ApiUser, fetchUsers, deleteUser, updateUserStatus } from "@/lib/users";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import OTPVerificationModal from "@/components/OTPVerificationModal";

export default function UserMasterPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
  }>({ open: false, userId: "", userName: "" });

  // OTP verification states
  const [otpVerification, setOtpVerification] = useState<{
    open: boolean;
    action: 'edit' | 'delete' | 'toggle-status' | null;
    user: ApiUser | null;
  }>({ open: false, action: null, user: null });

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedUsers = await fetchUsers();
      setUsers(fetchedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleUserCreated = async () => {
    setShowUserForm(false);
    // Refresh the users list
    await loadUsers();
  };

  const handleEditUser = (user: ApiUser) => {
    // Check if current user is admin - if yes, allow direct edit, if no, require OTP
    const userRole = document.cookie
      .split('; ')
      .find(row => row.startsWith('user_role='))
      ?.split('=')[1];

    if (userRole === 'co_admin') {
      setEditingUser(user);
    } else {
      setOtpVerification({ open: true, action: 'edit', user });
    }
  };

  const handleUserUpdated = async () => {
    setEditingUser(null);
    // Refresh the users list
    await loadUsers();
  };

  const handleDeleteUser = (user: ApiUser) => {
    // Check if current user is admin - if yes, show delete dialog, if no, require OTP
    const userRole = document.cookie
      .split('; ')
      .find(row => row.startsWith('user_role='))
      ?.split('=')[1];

    if (userRole === 'admin' || userRole === 'co_admin') {
      setDeleteDialog({
        open: true,
        userId: user.id,
        userName: user.name,
      });
    } else {
      setOtpVerification({ open: true, action: 'delete', user });
    }
  };

  const confirmDeleteUser = async () => {
    try {
      await deleteUser(deleteDialog.userId);
      // Refresh the users list
      await loadUsers();
      toast.success("User deleted successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const handleToggleUserStatus = (userId: string, currentStatus: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // Check if current user is admin - if yes, allow direct toggle, if no, require OTP
    const userRole = document.cookie
      .split('; ')
      .find(row => row.startsWith('user_role='))
      ?.split('=')[1];

    if (userRole === 'admin' || userRole === 'co_admin') {
      performToggleUserStatus(userId, currentStatus);
    } else {
      setOtpVerification({ open: true, action: 'toggle-status', user });
    }
  };

  const performToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";

    try {
      await updateUserStatus(userId, newStatus);
      // Refresh the users list
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user status");
    }
  };

  const refreshUsers = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  // OTP verification handlers
  const handleOTPVerified = () => {
    const { action, user } = otpVerification;

    if (!user || !action) return;

    switch (action) {
      case 'edit':
        setEditingUser(user);
        break;
      case 'delete':
        setDeleteDialog({
          open: true,
          userId: user.id,
          userName: user.name,
        });
        break;
      case 'toggle-status':
        performToggleUserStatus(user.id, user.status);
        break;
    }

    setOtpVerification({ open: false, action: null, user: null });
  };

  const handleOTPCancelled = () => {
    setOtpVerification({ open: false, action: null, user: null });
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.contact && user.contact.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.department && user.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
          <Crown className="w-3 h-3 mr-1" />
          Admin
        </Badge>;
      case "co_admin":
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
          <Shield className="w-3 h-3 mr-1" />
          Co Admin
        </Badge>;
      case "order_puncher":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          <User className="w-3 h-3 mr-1" />
          Order Puncher
        </Badge>;
      case "security":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <Shield className="w-3 h-3 mr-1" />
          Security
        </Badge>;
      case "weight_update":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <Settings className="w-3 h-3 mr-1" />
          Weight Update
        </Badge>;
      case "poduction":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Settings className="w-3 h-3 mr-1" />
          Production
        </Badge>;
      case "accountant":
        return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">
          <Settings className="w-3 h-3 mr-1" />
          Accountant
        </Badge>;
      case "dispatch":
        return <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">
          <Truck className="w-3 h-3 mr-1" />
          Dispatch
        </Badge>;
      case "mou":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
          <Clock className="w-3 h-3 mr-1" />
          MOU
        </Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <UserCheck className="w-3 h-3 mr-1" />
          Active
        </Badge>;
      case "inactive":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          <User className="w-3 h-3 mr-1" />
          Inactive
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const activeUsers = users.filter(user => user.status === "active").length;
  const adminUsers = users.filter(user => user.role === "admin").length;
  const inactiveUsers = users.filter(user => user.status === "inactive").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-8 h-8 text-primary" />
              User Master
            </h1>
            <p className="text-muted-foreground">
              Manage system users, roles, and permissions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshUsers} disabled={refreshing} className="gap-2">
              <Loader2 className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowUserForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add New User
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">
                Registered in system
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeUsers}</div>
              <p className="text-xs text-muted-foreground">
                Currently active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administrators</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{adminUsers}</div>
              <p className="text-xs text-muted-foreground">
                Admin privileges
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{inactiveUsers}</div>
              <p className="text-xs text-muted-foreground">
                Currently inactive
              </p>
            </CardContent>
          </Card>
        </div>

        {/* User Form Modal */}
        {showUserForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <UserForm
                onSuccess={handleUserCreated}
                onCancel={() => setShowUserForm(false)}
              />
            </div>
          </div>
        )}

        {/* Edit User Form Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <UserForm
                editingUser={editingUser}
                isEditing={true}
                onSuccess={handleUserUpdated}
                onCancel={() => setEditingUser(null)}
              />
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage user accounts, roles, and system access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadUsers}
                  className="ml-auto"
                >
                  Retry
                </Button>
              </div>
            )}

            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, username, contact, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  disabled={loading}
                />
              </div>
              <Button variant="outline" disabled={loading}>Role Filter</Button>
              <Button variant="outline" disabled={loading}>Department</Button>
            </div>

            {/* Users Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading users...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-2 text-sm font-semibold">No users found</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {searchTerm ? "Try adjusting your search criteria" : "No users available"} or add a new user.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="font-mono text-sm font-medium">
                          {user.frontend_id || 'Generating...'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">@{user.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{user.contact || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(user.status)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{user.department}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{user.last_login || 'Never'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{new Date(user.created_at).toLocaleDateString('en-GB')}</div>
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
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Shield className="mr-2 h-4 w-4" />
                              Manage Permissions
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={user.status === "active" ? "text-orange-600" : "text-green-600"}
                              onClick={() => handleToggleUserStatus(user.id, user.status)}
                            >
                              {user.status === "active" ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate User
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Activate User
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteUser(user)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title="Delete User"
        description={`Are you sure you want to delete "${deleteDialog.userName}"? This action cannot be undone and will remove all associated data.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteUser}
      />

      {/* OTP Verification Modal */}
      <OTPVerificationModal
        open={otpVerification.open}
        onOpenChange={(open) => !open && handleOTPCancelled()}
        title={`Admin Verification Required - ${otpVerification.action === 'edit' ? 'Edit User' : otpVerification.action === 'delete' ? 'Delete User' : 'Change Status'}`}
        description={`${otpVerification.action === 'edit' ? 'Editing' : otpVerification.action === 'delete' ? 'Deleting' : 'Changing status for'} user "${otpVerification.user?.name}" requires admin verification. Please ask an administrator to provide their current OTP code.`}
        onVerified={handleOTPVerified}
        onCancel={handleOTPCancelled}
      />
    </DashboardLayout>
  );
}