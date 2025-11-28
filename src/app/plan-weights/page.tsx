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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Scale,
  Search,
  CheckCircle,
  Clock,
  Package,
  AlertCircle,
  User,
  Loader2,
  RefreshCw,
  Save,
  Building2,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-config";

interface Plan {
  id: string;
  frontend_id: string;
  name: string;
  status: string;
  executed_at: string | null;
}

interface CutRoll {
  id: string;
  barcode_id: string;
  width_inches: number;
  weight_kg: number;
  status: string;
  location: string;
  paper_specs: {
    gsm: number;
    bf: number;
    shade: string;
  } | null;
  client_name: string;
  order_frontend_id: string | null;
  order_date: string | null;
  created_at: string;
  parent_118_roll_barcode?: string;
  jumbo_barcode_id?: string; // Added for display purposes
}

interface JumboGroup {
  jumbo_roll: {
    id: string;
    barcode_id: string;
    frontend_id: string;
    width_inches: number;
    paper_spec: string;
    status: string;
    location: string;
  };
  intermediate_rolls: Array<{
    id: string;
    barcode_id: string;
    parent_jumbo_id: string;
    individual_roll_number: number;
    width_inches: number;
    paper_spec: string;
  }>;
  cut_rolls: CutRoll[];
}

interface PlanSummary {
  plan_id: string;
  plan_name: string;
  plan_status: string;
  executed_at: string | null;
  production_summary: {
    total_cut_rolls: number;
    total_weight_kg: number;
    average_weight_per_roll: number;
    status_breakdown: Record<string, any>;
  };
  production_hierarchy: JumboGroup[];
  wastage_items: CutRoll[];
  detailed_items?: CutRoll[]; // Keep for backward compatibility
}

export default function PlanWeightsPage() {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);
  const [weightUpdates, setWeightUpdates] = useState<Record<string, string>>({});
  const [savingWeights, setSavingWeights] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");

  // Load plans on component mount
  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/plans`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (!response.ok) throw new Error('Failed to load plans');
      const data = await response.json();
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const loadPlanCutRolls = async (planId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/cut-rolls/production/${planId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (!response.ok) throw new Error('Failed to load cut rolls');
      const data = await response.json();
      setPlanSummary(data);

      // Extract all cut rolls from production_hierarchy
      const allCutRolls: CutRoll[] = [];
      if (data.production_hierarchy && Array.isArray(data.production_hierarchy)) {
        data.production_hierarchy.forEach((jumboGroup: JumboGroup) => {
          if (jumboGroup.cut_rolls && Array.isArray(jumboGroup.cut_rolls)) {
            allCutRolls.push(...jumboGroup.cut_rolls);
          }
        });
      }

      // Initialize weight updates with current weights (but don't show default/small weights)
      const initialWeights: Record<string, string> = {};
      allCutRolls.forEach((item: CutRoll) => {
        // Only show weight if it's meaningful (> 0.1), otherwise leave empty for user input
        initialWeights[item.id] = item.weight_kg > 0.1 ? item.weight_kg.toString() : '';
      });
      setWeightUpdates(initialWeights);
    } catch (error) {
      console.error('Error loading cut rolls:', error);
      toast.error('Failed to load cut rolls for selected plan');
      setPlanSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    if (planId) {
      loadPlanCutRolls(planId);
    } else {
      setPlanSummary(null);
      setWeightUpdates({});
    }
  };

  const handleWeightChange = (inventoryId: string, weight: string) => {
    setWeightUpdates(prev => ({
      ...prev,
      [inventoryId]: weight
    }));
  };

  const updateWeight = async (inventoryId: string, barcodeId: string) => {
    const newWeight = weightUpdates[inventoryId];
    if (!newWeight || isNaN(parseFloat(newWeight))) {
      toast.error("Please enter a valid weight");
      return;
    }

    try {
      setSavingWeights(prev => ({ ...prev, [inventoryId]: true }));

      const response = await fetch(`${API_BASE_URL}/qr/update-weight`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          qr_code: barcodeId, // Use barcode_id as qr_code
          weight_kg: parseFloat(newWeight)
        })
      });

      if (!response.ok) throw new Error('Failed to update weight');
      const result = await response.json();

      toast.success(result.message || `Weight updated to ${newWeight}kg`);

      // Partial refresh - update the modified item in production_hierarchy
      if (selectedPlanId && planSummary?.production_hierarchy) {
        setPlanSummary(prev => {
          if (!prev) return prev;

          return {
            ...prev,
            production_hierarchy: prev.production_hierarchy.map(jumboGroup => ({
              ...jumboGroup,
              cut_rolls: jumboGroup.cut_rolls.map(item =>
                item.id === inventoryId
                  ? {
                      ...item,
                      weight_kg: parseFloat(newWeight),
                      status: 'available' // Update status to available after weighing
                    }
                  : item
              )
            }))
          };
        });
      }
    } catch (error) {
      console.error('Error updating weight:', error);
      toast.error('Failed to update weight');
    } finally {
      setSavingWeights(prev => ({ ...prev, [inventoryId]: false }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Available</Badge>;
      case 'cutting':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Cutting</Badge>;
      case 'allocated':
        return <Badge className="bg-purple-100 text-purple-800"><Package className="w-3 h-3 mr-1" />Allocated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Extract all cut rolls from production_hierarchy for display and filtering
  // Add jumbo barcode to each cut roll for display
  const allCutRolls = planSummary?.production_hierarchy?.flatMap(
    jumboGroup => (jumboGroup.cut_rolls || []).map(cutRoll => ({
      ...cutRoll,
      jumbo_barcode_id: jumboGroup.jumbo_roll.barcode_id
    }))
  ) || [];

  const filteredCutRolls = allCutRolls
    .filter(item =>
      item.barcode_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.order_frontend_id && item.order_frontend_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.jumbo_barcode_id && item.jumbo_barcode_id.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      // First sort by status - "available" comes first
      if (a.status === 'available' && b.status !== 'available') return -1;
      if (a.status !== 'available' && b.status === 'available') return 1;

      // Then sort by barcode_id alphabetically
      return a.barcode_id.localeCompare(b.barcode_id);
    });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Scale className="w-8 h-8 text-primary" />
              Plan Weight Updates
            </h1>
            <p className="text-muted-foreground">
              Select a plan to view and update cut roll weights
            </p>
          </div>
          <Button onClick={loadPlans} variant="outline" disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Plans
          </Button>
        </div>

        {/* Plan Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Plan</CardTitle>
            <CardDescription>Choose a plan to view its cut rolls and update weights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan</label>
                <Select value={selectedPlanId} onValueChange={handlePlanChange} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder={loading ? "Loading plans..." : "Select a plan"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select Plan</SelectItem>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3" />
                          {plan.frontend_id || plan.id.slice(0, 8)} - {plan.name || 'Unnamed Plan'}
                          <Badge variant={plan.status === 'completed' ? 'default' : 'secondary'}>
                            {plan.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {planSummary && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search Cut Rolls</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search by cut/jumbo barcode, order ID, or client..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan Summary */}
        {planSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Plan Summary</CardTitle>
              <CardDescription>
                Overview of cut rolls in {planSummary.plan_name || 'Selected Plan'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {planSummary.production_summary.total_cut_rolls}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Cut Rolls</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {planSummary.production_summary.total_weight_kg.toFixed(1)}kg
                  </div>
                  <div className="text-sm text-muted-foreground">Total Weight</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {planSummary.production_summary.average_weight_per_roll.toFixed(1)}kg
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Weight/Roll</div>
                </div>
                <div className="text-center">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {planSummary.plan_status}
                  </Badge>
                  <div className="text-sm text-muted-foreground">Plan Status</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cut Rolls Table */}
        {planSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Cut Rolls Weight Update</CardTitle>
              <CardDescription>
                Update weights for cut rolls in this plan ({filteredCutRolls.length} items)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>S.No</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Client & Order</TableHead>
                      <TableHead>Paper Specs</TableHead>
                      <TableHead>Dimensions</TableHead>
                      <TableHead>Current Weight</TableHead>
                      <TableHead>New Weight (kg)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center">
                          <div className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading cut rolls...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredCutRolls.length > 0 ? (
                      filteredCutRolls.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-mono text-sm">{item.barcode_id}</div>
                              {item.jumbo_barcode_id && (
                                <div className="text-sm font-mono text-green-600">
                                  Jumbo Roll:{item.jumbo_barcode_id}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-sm flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-blue-600" />
                                {item.client_name || "N/A"}
                              </div>
                              {item.order_frontend_id && (
                                <div className="text-sm font-mono text-purple-600">
                                  Order: {item.order_frontend_id}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {item.paper_specs ? (
                                <div className="font-medium text-sm">
                                  {item.paper_specs.gsm}gsm, {item.paper_specs.bf}bf, {item.paper_specs.shade}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">N/A</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <div className="font-medium">{item.width_inches}"</div>
                              <div className="text-xs text-muted-foreground">width</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <div className="font-medium">{item.weight_kg}kg</div>
                              <div className={`text-xs ${item.weight_kg <= 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                                {item.weight_kg <= 0.1 ? 'Needs weighing' : 'Weight set'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Enter weight"
                              value={weightUpdates[item.id] || ''}
                              onChange={(e) => handleWeightChange(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  updateWeight(item.id, item.barcode_id);
                                }
                              }}
                              className="w-24"
                              disabled={savingWeights[item.id]}
                            />
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(item.status)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => updateWeight(item.id, item.barcode_id)}
                              disabled={
                                savingWeights[item.id] ||
                                !weightUpdates[item.id] ||
                                isNaN(parseFloat(weightUpdates[item.id]))
                              }
                            >
                              {savingWeights[item.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-1" />
                                  Save
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center">
                          <div className="text-center py-4">
                            <div className="text-muted-foreground">
                              <p className="font-medium">No cut rolls found</p>
                              <p className="text-sm">
                                {selectedPlanId
                                  ? "This plan doesn't have any cut rolls, or they don't match your search."
                                  : "Please select a plan to view its cut rolls."
                                }
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
