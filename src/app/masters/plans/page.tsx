/**
 * Plan Master page - Display and manage cutting plans with detailed cut roll information
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, PRODUCTION_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, Eye, Play, CheckCircle, Factory, Search, Filter } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  status: string;
  expected_waste_percentage: number;
  actual_waste_percentage?: number;
  created_at: string;
  executed_at?: string;
  completed_at?: string;
  created_by_id: string;
  created_by?: {
    name: string;
    username: string;
  };
}

interface Client {
  id: string;
  company_name: string;
}

interface User {
  id: string;
  name: string;
  username: string;
}

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  useEffect(() => {
    loadClients();
    loadUsers();
  }, []);

  useEffect(() => {
    loadPlans();
  }, [statusFilter, clientFilter, dateFilter]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters for backend filtering
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (clientFilter !== "all") params.append("client_id", clientFilter);
      
      // Add date filtering
      if (dateFilter !== "all") {
        const today = new Date();
        let dateFrom = "";
        switch (dateFilter) {
          case "today":
            dateFrom = today.toISOString().split('T')[0];
            break;
          case "week":
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateFrom = weekAgo.toISOString().split('T')[0];
            break;
          case "month":
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            dateFrom = monthAgo.toISOString().split('T')[0];
            break;
        }
        if (dateFrom) params.append("date_from", dateFrom);
      }
      
      const url = `${MASTER_ENDPOINTS.PLANS}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, createRequestOptions('GET'));

      if (!response.ok) {
        throw new Error('Failed to load plans');
      }

      const data = await response.json();
      setPlans(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load plans';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await fetch(MASTER_ENDPOINTS.CLIENTS, createRequestOptions('GET'));
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(MASTER_ENDPOINTS.USERS, createRequestOptions('GET'));
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const getUserById = (userId: string): User | null => {
    return users.find(user => user.id === userId) || null;
  };

  const updatePlanStatus = async (planId: string, status: string) => {
    try {
      const response = await fetch(PRODUCTION_ENDPOINTS.PLAN_STATUS(planId), createRequestOptions('PUT', { status }));

      if (!response.ok) {
        throw new Error('Failed to update plan status');
      }

      await loadPlans(); // Refresh the list
      toast.success("Plan status updated successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update plan status';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'planned': return 'outline';
      case 'in_progress': return 'secondary';
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned': return <Eye className="h-4 w-4" />;
      case 'in_progress': return <Play className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const handleViewPlan = (plan: Plan) => {
    // Navigate to the dedicated plan details page
    router.push(`/masters/plans/${plan.id}`);
  };

  // Filter functions
  const filteredPlans = plans.filter(plan => {
    const user = getUserById(plan.created_by_id);
    const matchesSearch = !searchTerm || 
      plan.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
    
    const matchesDate = dateFilter === "all" || (() => {
      const planDate = new Date(plan.created_at);
      const today = new Date();
      switch (dateFilter) {
        case "today":
          return planDate.toDateString() === today.toDateString();
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return planDate >= weekAgo;
        case "month":
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return planDate >= monthAgo;
        default:
          return true;
      }
    })();
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Plan Master - Production Plans</h1>
            <p className="text-muted-foreground mt-1">
              Manage cutting plans and track cut roll production with detailed analytics
            </p>
          </div>
          <Button 
            variant="default" 
            onClick={() => router.push('/planning')}
          >
            <Factory className="mr-2 h-4 w-4" />
            Create New Plan
          </Button>
        </div>

        {/* Filters Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Plans</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or creator..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setClientFilter("all");
                    setDateFilter("all");
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Plans List */}
        <Card>
          <CardHeader>
            <CardTitle>Plans ({filteredPlans.length})</CardTitle>
            <CardDescription>Manage and monitor cutting plans - click View Details to see comprehensive plan information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expected Waste</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <div className="flex items-center justify-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading plans...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredPlans.length > 0 ? (
                    filteredPlans.map((plan, index) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">
                          {plan.name || `Plan #${index + 1}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(plan.status)}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(plan.status)}
                              {plan.status.replace('_', ' ')}
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{plan.expected_waste_percentage}%</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            {(() => {
                              const user = getUserById(plan.created_by_id);
                              return (
                                <>
                                  <div className="font-medium">{user?.name || 'Unknown User'}</div>
                                  <div className="text-xs text-muted-foreground">@{user?.username || 'unknown'}</div>
                                </>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(plan.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewPlan(plan)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Details
                            </Button>
                            {plan.status === 'planned' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => updatePlanStatus(plan.id, 'in_progress')}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Start
                              </Button>
                            )}
                            {plan.status === 'in_progress' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updatePlanStatus(plan.id, 'completed')}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Complete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        {plans.length === 0 
                          ? "No plans found. Create your first plan to get started."
                          : "No plans match the current filters."
                        }
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}