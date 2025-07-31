/**
 * Plan Details page - Comprehensive view of a specific cutting plan
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  AlertCircle, 
  Play, 
  CheckCircle, 
  Factory, 
  QrCode, 
  Search, 
  Package, 
  Weight, 
  Ruler, 
  ArrowLeft,
  Calendar,
  User,
  Clock,
  MapPin
} from "lucide-react";
import QRCodeDisplay from "@/components/QRCodeDisplay";

interface Plan {
  id: string;
  name: string;
  status: string;
  expected_waste_percentage: number;
  actual_waste_percentage?: number;
  created_at: string;
  executed_at?: string;
  completed_at?: string;
  created_by?: {
    name: string;
    username: string;
  };
}

interface ProductionSummary {
  plan_id: string;
  plan_name: string;
  plan_status: string;
  executed_at?: string;
  production_summary: {
    total_cut_rolls: number;
    total_weight_kg: number;
    average_weight_per_roll: number;
    status_breakdown: Record<string, {
      count: number;
      total_weight: number;
      widths: number[];
    }>;
    paper_specifications: {
      gsm: number;
      bf: number;
      shade: string;
      roll_count: number;
    }[];
  };
  detailed_items: CutRollItem[];
}

interface CutRollItem {
  inventory_id: string;
  width_inches: number;
  weight_kg: number;
  status: string;
  location: string;
  qr_code: string;
  created_at: string;
  paper_specs?: {
    gsm: number;
    bf: number;
    shade: string;
  };
  client_name?: string;
  order_date?: string;
}

export default function PlanDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [productionSummary, setProductionSummary] = useState<ProductionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQRCode, setSelectedQRCode] = useState<string | null>(null);
  
  // Filter states for cut rolls
  const [cutRollSearchTerm, setCutRollSearchTerm] = useState("");
  const [cutRollStatusFilter, setCutRollStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (planId) {
      loadPlanDetails();
      loadProductionSummary();
    }
  }, [planId]);

  const loadPlanDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${MASTER_ENDPOINTS.PLANS}/${planId}`, createRequestOptions('GET'));

      if (!response.ok) {
        throw new Error('Failed to load plan details');
      }

      const data = await response.json();
      setPlan(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load plan details';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProductionSummary = async () => {
    try {
      setLoadingSummary(true);
      setProductionSummary(null);
      
      console.log(`Loading production summary for plan: ${planId}`);
      
      const response = await fetch(PRODUCTION_ENDPOINTS.CUT_ROLLS_PLAN(planId), createRequestOptions('GET'));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to load production summary: ${response.status}`);
      }

      const data = await response.json();
      console.log('Production summary data:', data);
      
      setProductionSummary(data);
      
      if (data.detailed_items && data.detailed_items.length > 0) {
        toast.success(`Loaded ${data.detailed_items.length} cut rolls for this plan`);
      } else {
        toast.info('No cut rolls found for this plan yet');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cut roll details';
      console.error('Error loading production summary:', err);
      toast.error(errorMessage);
      setProductionSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const createSampleData = async () => {
    try {
      const response = await fetch(`${PRODUCTION_ENDPOINTS.CUT_ROLLS_PLAN(planId).replace('/production/', '/create-sample-data/')}`, 
        createRequestOptions('POST')
      );

      if (!response.ok) {
        throw new Error('Failed to create sample data');
      }

      const data = await response.json();
      toast.success(data.message);
      
      // Reload the production summary to show the new data
      loadProductionSummary();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create sample data';
      toast.error(errorMessage);
      console.error('Error creating sample data:', err);
    }
  };

  const updatePlanStatus = async (status: string) => {
    try {
      const response = await fetch(PRODUCTION_ENDPOINTS.PLAN_STATUS(planId), createRequestOptions('PUT', { status }));

      if (!response.ok) {
        throw new Error('Failed to update plan status');
      }

      await loadPlanDetails(); // Refresh the plan data
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
      case 'available': return 'default';
      case 'cutting': return 'secondary';
      case 'allocated': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <Play className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleShowQRCode = (qrCode: string) => {
    setSelectedQRCode(qrCode);
  };

  // Filter cut rolls
  const filteredCutRolls = productionSummary?.detailed_items.filter(item => {
    const matchesSearch = !cutRollSearchTerm || 
      item.qr_code.toLowerCase().includes(cutRollSearchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(cutRollSearchTerm.toLowerCase()) ||
      item.paper_specs?.shade.toLowerCase().includes(cutRollSearchTerm.toLowerCase()) ||
      item.client_name?.toLowerCase().includes(cutRollSearchTerm.toLowerCase());
    
    const matchesStatus = cutRollStatusFilter === "all" || item.status === cutRollStatusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading plan details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !plan) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Plans
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || 'Plan not found'}</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Plans
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Factory className="w-8 h-8 text-primary" />
                {plan.name || 'Plan Details'}
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive view of cutting plan and production details
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {plan.status === 'planned' && (
              <Button
                onClick={() => updatePlanStatus('in_progress')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="mr-2 h-4 w-4" />
                Start Plan
              </Button>
            )}
            {plan.status === 'in_progress' && (
              <Button
                onClick={() => updatePlanStatus('completed')}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Plan
              </Button>
            )}
          </div>
        </div>

        {/* Plan Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plan Overview
                  <Badge variant={getStatusBadgeVariant(plan.status)}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(plan.status)}
                      {plan.status.replace('_', ' ')}
                    </div>
                  </Badge>
                </CardTitle>
                <CardDescription>Basic plan information and timeline</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Expected Waste</label>
                <p className="text-2xl font-bold">{plan.expected_waste_percentage}%</p>
              </div>
              {plan.actual_waste_percentage && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Actual Waste</label>
                  <p className="text-2xl font-bold">{plan.actual_waste_percentage}%</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Created
                </label>
                <p className="text-lg font-medium">
                  {new Date(plan.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(plan.created_at).toLocaleTimeString()}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Created By
                </label>
                <p className="text-lg font-medium">
                  {plan.created_by?.name || 'Unknown'}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{plan.created_by?.username || 'unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Production Summary */}
        {loadingSummary ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Loading production details...</p>
              </div>
            </CardContent>
          </Card>
        ) : productionSummary ? (
          <div className="space-y-6">
            {/* Production Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">Total Rolls</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.total_cut_rolls}</p>
                  <p className="text-xs text-muted-foreground mt-1">Cut rolls produced</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Weight className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">Total Weight</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.total_weight_kg}</p>
                  <p className="text-xs text-muted-foreground mt-1">kg total weight</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Ruler className="h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium">Avg Weight</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.average_weight_per_roll.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground mt-1">kg per roll</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Factory className="h-5 w-5 text-orange-500" />
                    <span className="text-sm font-medium">Paper Types</span>
                  </div>
                  <p className="text-3xl font-bold">{productionSummary.production_summary.paper_specifications.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">different specs</p>
                </CardContent>
              </Card>
            </div>

            {/* Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Production Status Breakdown</CardTitle>
                <CardDescription>Overview of cut roll statuses and their distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(productionSummary.production_summary.status_breakdown).map(([status, data]) => (
                    <div key={status} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
                          {status.replace('_', ' ')}
                        </Badge>
                        <span className="font-bold text-xl">{data.count}</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Weight: {data.total_weight.toFixed(1)} kg</div>
                        <div>Widths: {[...new Set(data.widths)].join('", ')}"</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cut Rolls Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Cut Rolls Details ({filteredCutRolls.length})</CardTitle>
                    <CardDescription>Detailed information about all cut rolls in this plan</CardDescription>
                  </div>
                  <div className="flex gap-3">
                    {productionSummary.detailed_items.length === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={createSampleData}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        <Factory className="h-3 w-3 mr-1" />
                        Create Sample Data
                      </Button>
                    )}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search cut rolls..."
                        value={cutRollSearchTerm}
                        onChange={(e) => setCutRollSearchTerm(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={cutRollStatusFilter} onValueChange={setCutRollStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {Object.keys(productionSummary.production_summary.status_breakdown).map(status => (
                          <SelectItem key={status} value={status}>
                            {status.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>QR Code</TableHead>
                        <TableHead>Dimensions</TableHead>
                        <TableHead>Paper Specs</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCutRolls.length > 0 ? (
                        filteredCutRolls.map((item) => (
                          <TableRow key={item.inventory_id}>
                            <TableCell>
                              <div className="font-mono text-xs">{item.qr_code}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{item.width_inches}"</div>
                            </TableCell>
                            <TableCell>
                              {item.paper_specs && (
                                <div className="text-sm">
                                  <div>{item.paper_specs.gsm}gsm</div>
                                  <div className="text-xs text-muted-foreground">
                                    BF: {item.paper_specs.bf}, {item.paper_specs.shade}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{item.weight_kg} kg</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(item.status)} className="text-xs">
                                {item.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {item.location}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {item.client_name || "Unknown Client"}
                              </div>
                              {item.order_date && (
                                <div className="text-xs text-muted-foreground">
                                  Order: {new Date(item.order_date).toLocaleDateString()}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-muted-foreground">
                                {new Date(item.created_at).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleShowQRCode(item.qr_code)}
                              >
                                <QrCode className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="h-24 text-center">
                            {productionSummary.detailed_items.length === 0
                              ? "No cut rolls found for this plan."
                              : "No cut rolls match the current filters."
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
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  No production data available for this plan.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Code Display Modal */}
        {selectedQRCode && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-4 rounded-lg max-w-sm w-full mx-4">
              <QRCodeDisplay
                value={selectedQRCode}
                title="Cut Roll QR Code"
                description={`Scan this code to access cut roll details`}
                size={200}
                showActions={true}
              />
              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={() => setSelectedQRCode(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}