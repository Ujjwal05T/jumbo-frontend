/**
 * Client Master page - Manage client information
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import ClientForm from "@/components/ClientForm";
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
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Building,
  Phone,
  Mail,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Client, CreateClientFormData, fetchClients, createClient, updateClient, deleteClient } from "@/lib/clients";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function ClientMasterPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    clientId: string;
    clientName: string;
  }>({ open: false, clientId: "", clientName: "" });

  // Load clients on component mount
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const clientsData = await fetchClients(0, 'active');
      setClients(clientsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (clientData: CreateClientFormData) => {
    try {
      setFormLoading(true);
      await createClient(clientData);
      setShowClientForm(false);
      await loadClients(); // Reload clients after creation
    } catch (err) {
      throw err; // Let the form handle the error
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
  };

  const handleUpdateClient = async (clientData: CreateClientFormData) => {
    if (!editingClient) return;
    
    try {
      setFormLoading(true);
      await updateClient(editingClient.id, clientData);
      setEditingClient(null);
      await loadClients(); // Reload clients after update
    } catch (err) {
      throw err; // Let the form handle the error
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClient = (client: Client) => {
    setDeleteDialog({
      open: true,
      clientId: client.id,
      clientName: client.company_name,
    });
  };

  const confirmDeleteClient = async () => {
    try {
      await deleteClient(deleteDialog.clientId);
      await loadClients(); // Reload clients after deletion
      toast.success("Client deleted successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete client');
    }
  };

  const filteredClients = clients.filter(client =>
    client.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email!.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Inactive</Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-8 h-8 text-primary" />
              Client Master
            </h1>
            <p className="text-muted-foreground">
              Manage your client database and contact information
            </p>
          </div>
          <Button className="gap-2" onClick={() => setShowClientForm(true)}>
            <Plus className="w-4 h-4" />
            Add New Client
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : clients.length}</div>
              <p className="text-xs text-muted-foreground">
                Total registered clients
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : clients.filter(c => c.status === "active").length}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Clients</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : clients.filter(c => {
                  const createdDate = new Date(c.created_at);
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  return createdDate > thirtyDaysAgo;
                }).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Added in last 30 days
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contact Info</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : clients.length}</div>
              <p className="text-xs text-muted-foreground">
                Clients with complete info
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Client Directory</CardTitle>
            <CardDescription>
              Search and manage your client information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients by name, company, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline">Filter</Button>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading clients...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="flex items-center justify-center py-8 text-red-600">
                <AlertCircle className="h-8 w-8 mr-2" />
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  onClick={loadClients}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Clients Table */}
            {!loading && !error && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="font-mono text-sm font-medium">
                            {client.frontend_id || 'Generating...'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{client.contact_person}</div>
                            <div className="text-sm text-muted-foreground">{client.company_name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm">{client.email}</div>
                            <div className="text-sm text-muted-foreground">{client.phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {client.address}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(client.status)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(client.created_at).toLocaleDateString()}
                          </div>
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
                              <DropdownMenuItem onClick={() => handleEditClient(client)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Client
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteClient(client)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Client
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

            {/* No Results State */}
            {!loading && !error && filteredClients.length === 0 && clients.length > 0 && (
              <div className="text-center py-8">
                <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No clients found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search criteria.
                </p>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && clients.length === 0 && (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No clients yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Get started by adding your first client.
                </p>
                <Button
                  className="mt-4 gap-2"
                  onClick={() => setShowClientForm(true)}
                >
                  <Plus className="w-4 h-4" />
                  Add New Client
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client Form Modal */}
      {showClientForm && (
        <ClientForm
          onSubmit={handleCreateClient}
          onCancel={() => setShowClientForm(false)}
          isLoading={formLoading}
        />
      )}

      {/* Edit Client Form Modal */}
      {editingClient && (
        <ClientForm
          onSubmit={handleUpdateClient}
          onCancel={() => setEditingClient(null)}
          initialData={editingClient}
          isLoading={formLoading}
          title="Edit Client"
          isEditing={true}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title="Delete Client"
        description={`Are you sure you want to delete "${deleteDialog.clientName}"? This action cannot be undone and will remove all associated orders and data.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteClient}
      />
    </DashboardLayout>
  );
}