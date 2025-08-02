/**
 * Pending Order Items page - Manage pending order items
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Clock, 
  Search, 
  MoreHorizontal, 
  CheckCircle, 
  XCircle, 
  Eye,
  AlertTriangle,
  Calendar,
  DollarSign,
  Package,
  Play,
  Settings,
  Target
} from "lucide-react";

interface PendingOrderItem {
  id: string;
  original_order_id: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  quantity_pending: number;
  reason: string;
  status: "pending" | "in_production" | "resolved" | "cancelled";
  production_order_id?: string;
  created_at: string;
  resolved_at?: string;
  // Related data
  original_order?: {
    id: string;
    client?: {
      company_name: string;
    };
  };
  created_by?: {
    name: string;
  };
}

interface OptimizationResult {
  status: string;
  remaining_pending: any[];
  roll_combinations: Array<{
    combination_id: string;
    paper_specs: {
      gsm: number;
      bf: number;
      shade: string;
    };
    rolls: Array<{
      width: number;
      quantity: number;
    }>;
    total_width: number;
    trim: number;
  }>;
  roll_suggestions: Array<{
    suggestion_id: string;
    paper_specs: {
      gsm: number;
      bf: number;
      shade: string;
    };
    existing_width: number;
    needed_width: number;
    possible_combinations: Array<{
      rolls: number[];
      total_width: number;
      trim: number;
    }>;
    description: string;
  }>;
  summary: {
    total_pending_input: number;
    combinations_found: number;
    remaining_pending: number;
    suggested_rolls: number;
  };
}

export default function PendingOrderItemsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingItems, setPendingItems] = useState<PendingOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Optimization preview state
  const [showOptimization, setShowOptimization] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [selectedCombinations, setSelectedCombinations] = useState<Set<string>>(new Set());

  // Fetch pending order items from API
  useEffect(() => {
    const fetchPendingItems = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Call backend API directly
        let response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}?status=pending`, createRequestOptions('GET'));
        if (!response.ok) {
          response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS.replace('pending-order-items', 'pending-orders')}?status=pending`, createRequestOptions('GET'));
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch pending order items: ${response.status}`);
        }
        
        const data = await response.json();
        setPendingItems(Array.isArray(data) ? data : []);
        
        console.log('Fetched pending order items:', {
          count: Array.isArray(data) ? data.length : 0,
          data: data,
          isArray: Array.isArray(data)
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        toast.error(errorMessage);
        console.error('Error fetching pending items:', err);
        
        // Use sample data as fallback for development
        setPendingItems(samplePendingItems);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingItems();
  }, []);

  // Sample data for demo (remove when API is working)
  const samplePendingItems: PendingOrderItem[] = [
    {
      id: "pend-001",
      original_order_id: "ord-123",
      width_inches: 34,
      gsm: 80,
      bf: 18.0,
      shade: "Natural",
      quantity_pending: 5,
      reason: "no_suitable_jumbo",
      status: "pending",
      created_at: "2024-01-18T10:00:00Z",
      original_order: {
        id: "ord-123",
        client: {
          company_name: "Tech Solutions Corp"
        }
      },
      created_by: {
        name: "John Doe"
      }
    },
    {
      id: "pend-002", 
      original_order_id: "ord-124",
      width_inches: 28,
      gsm: 90,
      bf: 20.0,
      shade: "White",
      quantity_pending: 3,
      reason: "waste_too_high",
      status: "pending",
      created_at: "2024-01-19T14:30:00Z",
      original_order: {
        id: "ord-124",
        client: {
          company_name: "Print Masters Inc"
        }
      },
      created_by: {
        name: "Jane Smith"
      }
    }
  ];

  // Use real data or sample data as fallback
  const displayItems = pendingItems.length > 0 ? pendingItems : (loading ? [] : samplePendingItems);

  const filteredItems = displayItems.filter(item =>
    item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.original_order?.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.shade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case "in_production":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Production</Badge>;
      case "resolved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Resolved</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case "no_suitable_jumbo":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">No Suitable Jumbo</Badge>;
      case "waste_too_high":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Waste Too High</Badge>;
      case "inventory_shortage":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Inventory Shortage</Badge>;
      default:
        return <Badge variant="secondary">{reason.replace(/_/g, ' ')}</Badge>;
    }
  };

  const getDaysWaiting = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  };

  const totalPendingQuantity = displayItems.reduce((sum, item) => sum + item.quantity_pending, 0);
  const highPriorityItems = displayItems.filter(item => {
    const daysWaiting = getDaysWaiting(item.created_at);
    return daysWaiting >= 3; // Consider items waiting 3+ days as high priority
  }).length;
  const averageWaitTime = displayItems.length > 0 ? Math.round(
    displayItems.reduce((sum, item) => sum + getDaysWaiting(item.created_at), 0) / displayItems.length
  ) : 0;

  // Action handlers
  const handleUpdateStatus = async (itemId: string, newStatus: string) => {
    try {
      const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/${itemId}`, createRequestOptions('PUT', { status: newStatus }));

      if (response.ok) {
        // Refresh the data
        const updatedItems = pendingItems.map(item => 
          item.id === itemId ? { ...item, status: newStatus as "pending" | "in_production" | "resolved" | "cancelled" } : item
        );
        setPendingItems(updatedItems);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleMoveToProduction = (itemId: string) => {
    handleUpdateStatus(itemId, 'in_production');
  };

  const handleCancelItem = (itemId: string) => {
    handleUpdateStatus(itemId, 'cancelled');
  };

  // Optimization preview functions
  const handleOptimizePreview = async () => {
    try {
      setOptimizationLoading(true);
      const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/optimize-preview`, createRequestOptions('POST'));
      
      if (!response.ok) {
        throw new Error(`Optimization failed: ${response.status}`);
      }
      
      const result = await response.json();
      setOptimizationResult(result);
      setShowOptimization(true);
      const actualCombinations = result.roll_combinations?.length || 0;
      toast.success(`Found ${actualCombinations} possible combinations`);
    } catch (error) {
      toast.error('Failed to run optimization preview');
      console.error('Optimization error:', error);
    } finally {
      setOptimizationLoading(false);
    }
  };

  const handleToggleCombination = (combinationId: string) => {
    const newSelected = new Set(selectedCombinations);
    if (newSelected.has(combinationId)) {
      newSelected.delete(combinationId);
    } else {
      newSelected.add(combinationId);
    }
    setSelectedCombinations(newSelected);
  };

  const handleAcceptCombinations = async () => {
    if (selectedCombinations.size === 0) {
      toast.error('Please select at least one combination');
      return;
    }

    if (selectedCombinations.size % 3 !== 0) {
      toast.error('Only multiple of 3 rolls can be selected');
      return;
    }

    try {
      const selectedCombos = optimizationResult?.roll_combinations.filter(combo => 
        selectedCombinations.has(combo.combination_id)
      ) || [];

      const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/accept-combinations`, 
        createRequestOptions('POST', selectedCombos)
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.detail || `Failed to accept combinations: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      toast.success(`Created plan: ${result.plan_name}`);
      
      // Refresh pending items
      window.location.reload();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept combinations';
      toast.error(errorMessage);
      console.error('Accept combinations error:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="w-8 h-8 text-primary" />
              Pending Order Items
            </h1>
            <p className="text-muted-foreground">
              Manage order items that couldn&apos;t be fulfilled immediately
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handleOptimizePreview}
              disabled={optimizationLoading || displayItems.length === 0}
            >
              <Target className="w-4 h-4" />
              {optimizationLoading ? 'Optimizing...' : 'Optimize Preview'}
            </Button>
            <Button variant="outline" className="gap-2">
              <Play className="w-4 h-4" />
              Process All
            </Button>
            {showOptimization && selectedCombinations.size > 0 && (
              <Button 
                className="gap-2"
                onClick={handleAcceptCombinations}
                disabled={selectedCombinations.size % 3 !== 0}
              >
                <CheckCircle className="w-4 h-4" />
                Accept Selected ({selectedCombinations.size})
                {selectedCombinations.size % 3 !== 0 && (
                  <span className="text-xs ml-1">(Must be multiple of 3)</span>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Items</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayItems.length}</div>
              <p className="text-xs text-muted-foreground">
                Items awaiting fulfillment
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{highPriorityItems}</div>
              <p className="text-xs text-muted-foreground">
                Items waiting 3+ days
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageWaitTime} days</div>
              <p className="text-xs text-muted-foreground">
                Average processing delay
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPendingQuantity.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Rolls pending fulfillment
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Optimization Preview Results */}
        {showOptimization && optimizationResult && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Optimization Preview Results
                </CardTitle>
                <CardDescription>
                  Found {optimizationResult.summary.combinations_found} possible roll combinations. 
                  Select combinations to create a plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{optimizationResult.summary.combinations_found}</div>
                    <div className="text-sm text-blue-800">Combinations Found</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{optimizationResult.summary.total_pending_input - optimizationResult.summary.remaining_pending}</div>
                    <div className="text-sm text-green-800">Orders Resolved</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{optimizationResult.summary.remaining_pending}</div>
                    <div className="text-sm text-yellow-800">Still Pending</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{optimizationResult.summary.suggested_rolls}</div>
                    <div className="text-sm text-purple-800">Roll Suggestions</div>
                  </div>
                </div>

                {/* Roll Combinations */}
                {optimizationResult.roll_combinations.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Available Roll Combinations</h3>
                      <div className="flex items-center gap-1">
                        <Checkbox 
                          checked={selectedCombinations.size === optimizationResult.roll_combinations.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCombinations(new Set(optimizationResult.roll_combinations.map(c => c.combination_id)));
                            } else {
                              setSelectedCombinations(new Set());
                            }
                          }}
                        />
                        <span className="text-sm font-medium">Select All</span>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {optimizationResult.roll_combinations.map((combo) => (
                        <Card 
                          key={combo.combination_id} 
                          className={`cursor-pointer transition-colors ${
                            selectedCombinations.has(combo.combination_id) 
                              ? 'ring-2 ring-blue-500 bg-blue-50' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleToggleCombination(combo.combination_id)}
                        >
                          <CardHeader className="pb-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Checkbox 
                                  checked={selectedCombinations.has(combo.combination_id)}
                                  onCheckedChange={(checked) => {
                                    handleToggleCombination(combo.combination_id);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <CardTitle className="text-base">
                                  {combo.paper_specs.shade} {combo.paper_specs.gsm}GSM BF: {combo.paper_specs.bf}
                                </CardTitle>
                              </div>
                              <Badge className={combo.trim <= 6 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                {combo.trim}" trim
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              {/* Visual Cutting Pattern */}
                              <div>
                                <div className="text-sm font-medium text-muted-foreground mb-2">
                                  Cutting Pattern (118" Jumbo Roll):
                                </div>
                                <div className="relative h-12 bg-muted rounded-lg border overflow-hidden">
                                  {(() => {
                                    let currentPosition = 0;
                                    const waste = 118 - combo.total_width;
                                    const wastePercentage = (waste / 118) * 100;

                                    return (
                                      <>
                                        {/* Cut sections */}
                                        {combo.rolls.map((roll, idx) => {
                                          const widthPercentage = (roll.width / 118) * 100;
                                          const leftPosition = (currentPosition / 118) * 100;
                                          currentPosition += roll.width;

                                          return (
                                            <div
                                              key={idx}
                                              className="absolute h-full border-r-2 border-white bg-gradient-to-r from-blue-400 to-blue-500"
                                              style={{
                                                left: `${leftPosition}%`,
                                                width: `${widthPercentage}%`,
                                              }}>
                                              <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                                {roll.width}"
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {/* Waste section */}
                                        {waste > 0 && (
                                          <div
                                            className="absolute h-full bg-gradient-to-r from-red-400 to-red-500 border-l-2 border-white"
                                            style={{
                                              right: "0%",
                                              width: `${wastePercentage}%`,
                                            }}>
                                            <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                              Waste: {waste.toFixed(1)}"
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">Total: {combo.total_width}" / 118"</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Roll Suggestions */}
                {optimizationResult.roll_suggestions.length > 0 && (
                  <div className="space-y-4 mt-6">
                    <h3 className="text-lg font-semibold">Roll Suggestions for Remaining Items</h3>
                    <div className="space-y-3">
                      {optimizationResult.roll_suggestions.map((suggestion) => (
                        <Card key={suggestion.suggestion_id} className="bg-gray-50">
                          <CardContent className="pt-4">
                            <div className="space-y-4">
                              <div className="font-medium">
                                {suggestion.paper_specs.shade} {suggestion.paper_specs.gsm}GSM Paper
                              </div>
                              <div className="text-sm font-medium">
                                {suggestion.description}
                              </div>
                              
                              {/* Visual Pattern for Available/Required */}
                              <div>
                                <div className="text-sm font-medium text-muted-foreground mb-2">
                                  118" Roll Completion Pattern:
                                </div>
                                <div className="relative h-12 bg-muted rounded-lg border overflow-hidden">
                                  {(() => {
                                    const availableWidth = suggestion.existing_width;
                                    const requiredWidth = suggestion.needed_width;
                                    const availablePercentage = (availableWidth / 118) * 100;
                                    const requiredPercentage = (requiredWidth / 118) * 100;

                                    return (
                                      <>
                                        {/* Available section (green) */}
                                        <div
                                          className="absolute h-full border-r-2 border-white bg-gradient-to-r from-green-400 to-green-500"
                                          style={{
                                            left: "0%",
                                            width: `${availablePercentage}%`,
                                          }}>
                                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                            Available: {availableWidth}"
                                          </div>
                                        </div>

                                        {/* Required section (orange) */}
                                        <div
                                          className="absolute h-full bg-gradient-to-r from-orange-400 to-orange-500 border-l-2 border-white"
                                          style={{
                                            left: `${availablePercentage}%`,
                                            width: `${requiredPercentage}%`,
                                          }}>
                                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                            Required: {requiredWidth}"
                                          </div>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowOptimization(false);
                      setSelectedCombinations(new Set());
                    }}
                  >
                    Close Preview
                  </Button>
                  <Button 
                    onClick={() => setSelectedCombinations(new Set(optimizationResult.roll_combinations.map(c => c.combination_id)))}
                    variant="outline"
                  >
                    Select All
                  </Button>
                  <Button 
                    onClick={() => setSelectedCombinations(new Set())}
                    variant="outline"
                  >
                    Clear Selection
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Order Items Queue</CardTitle>
            <CardDescription>
              Review and process order items that couldn&apos;t be fulfilled immediately
              {loading && " (Loading...)"}
              {error && ` (Error: ${error} - showing sample data)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pending items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline">Priority Filter</Button>
              <Button variant="outline">Sort by Wait Time</Button>
            </div>

            {/* Pending Orders Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pending ID</TableHead>
                    <TableHead>Item Details</TableHead>
                    <TableHead>Paper Specification</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Wait Time</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => {
                    const daysWaiting = getDaysWaiting(item.created_at);
                    return (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm font-medium">
                        {item.frontend_id || 'Generating...'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">#{index + 1}</div>
                          <div className="text-sm text-muted-foreground">
                            Order: {item.original_order_id}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Created: {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.width_inches}&quot; x {item.shade}</div>
                          <div className="text-sm text-muted-foreground">
                            GSM: {item.gsm}, BF: {item.bf}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.original_order?.client?.company_name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            Created by: {item.created_by?.name || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.quantity_pending} rolls</div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item.status)}
                      </TableCell>
                      <TableCell>
                        {getReasonBadge(item.reason)}
                      </TableCell>
                      <TableCell>
                        <Badge className={daysWaiting >= 5 ? "bg-red-100 text-red-800" : daysWaiting >= 3 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
                          {daysWaiting} days
                        </Badge>
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
                            <DropdownMenuItem 
                              className="text-green-600"
                              onClick={() => handleMoveToProduction(item.id)}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Move to Production
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Package className="mr-2 h-4 w-4" />
                              Update Status
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleCancelItem(item.id)}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel Item
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No pending order items found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  All order items are currently being processed or completed.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}