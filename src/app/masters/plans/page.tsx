/**
 * Plan Master page - Display and manage cutting plans
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, PRODUCTION_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, Eye, Play, CheckCircle, Factory, QrCode } from "lucide-react";
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

interface CutRollSummary {
  plan_id: string;
  total_cut_rolls: number;
  status_breakdown: Record<string, number>;
  total_weight_kg: number;
  individual_118_rolls: number;
  jumbo_roll_sets_needed: number;
  cut_rolls: CutRoll[];
}

interface CutRoll {
  id: string;
  qr_code: string;
  width_inches: number;
  status: string;
  actual_weight_kg?: number;
  gsm: number;
  shade: string;
}

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [cutRollSummary, setCutRollSummary] = useState<CutRollSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQRCodes, setShowQRCodes] = useState(false);
  const [selectedQRCode, setSelectedQRCode] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(MASTER_ENDPOINTS.PLANS, createRequestOptions('GET'));

      if (!response.ok) {
        throw new Error('Failed to load plans');
      }

      const data = await response.json();
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCutRollSummary = async (planId: string) => {
    try {
      setLoadingSummary(true);
      
      const response = await fetch(PRODUCTION_ENDPOINTS.CUT_ROLLS_PLAN(planId), createRequestOptions('GET'));

      if (!response.ok) {
        throw new Error('Failed to load cut roll summary');
      }

      const data = await response.json();
      setCutRollSummary(data);
    } catch (err) {
      console.error('Error loading cut roll summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const updatePlanStatus = async (planId: string, status: string) => {
    try {
      const response = await fetch(PRODUCTION_ENDPOINTS.PLAN_STATUS(planId), createRequestOptions('PUT', { status }));

      if (!response.ok) {
        throw new Error('Failed to update plan status');
      }

      await loadPlans(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan status');
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
    setSelectedPlan(plan);
    loadCutRollSummary(plan.id);
  };

  const handleShowQRCode = (qrCode: string) => {
    setSelectedQRCode(qrCode);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Plan Master - Production Plans</h1>
          <Button 
            variant="default" 
            onClick={() => router.push('/planning')}
          >
            <Factory className="mr-2 h-4 w-4" />
            Create New Plan
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plans List */}
          <Card>
            <CardHeader>
              <CardTitle>All Plans</CardTitle>
              <CardDescription>Manage and monitor cutting plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          <div className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading plans...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : plans.length > 0 ? (
                      plans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">
                            {plan.name || `Plan ${plan.id.split('-')[0]}`}
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
                                View
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
                        <TableCell colSpan={4} className="h-24 text-center">
                          No plans found. Create your first plan to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Plan Details */}
          {selectedPlan && (
            <Card>
              <CardHeader>
                <CardTitle>Plan Details</CardTitle>
                <CardDescription>
                  {selectedPlan.name || `Plan ${selectedPlan.id.split('-')[0]}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Plan Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <div className="mt-1">
                        <Badge variant={getStatusBadgeVariant(selectedPlan.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(selectedPlan.status)}
                            {selectedPlan.status.replace('_', ' ')}
                          </div>
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Expected Waste</label>
                      <p className="mt-1 text-sm">{selectedPlan.expected_waste_percentage}%</p>
                    </div>
                    {selectedPlan.actual_waste_percentage && (
                      <div>
                        <label className="text-sm font-medium">Actual Waste</label>
                        <p className="mt-1 text-sm">{selectedPlan.actual_waste_percentage}%</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium">Created By</label>
                      <p className="mt-1 text-sm">
                        {selectedPlan.created_by?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Cut Roll Summary */}
                  {loadingSummary ? (
                    <div className="text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Loading cut roll details...</p>
                    </div>
                  ) : cutRollSummary ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Production Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total Cut Rolls:</span>
                          <span className="font-medium ml-2">{cutRollSummary.total_cut_rolls}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">118&quot; Rolls:</span>
                          <span className="font-medium ml-2">{cutRollSummary.individual_118_rolls}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Jumbo Sets:</span>
                          <span className="font-medium ml-2">{cutRollSummary.jumbo_roll_sets_needed}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Weight:</span>
                          <span className="font-medium ml-2">{cutRollSummary.total_weight_kg} kg</span>
                        </div>
                      </div>

                      {/* Status Breakdown */}
                      <div>
                        <h5 className="text-sm font-medium mb-2">Cut Roll Status</h5>
                        <div className="space-y-1">
                          {Object.entries(cutRollSummary.status_breakdown).map(([status, count]) => (
                            <div key={status} className="flex justify-between text-sm">
                              <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
                                {status.replace('_', ' ')}
                              </Badge>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* QR Codes Section */}
                      {cutRollSummary.cut_rolls && cutRollSummary.cut_rolls.length > 0 && (
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="text-sm font-medium">QR Codes</h5>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowQRCodes(!showQRCodes)}
                            >
                              <QrCode className="h-3 w-3 mr-1" />
                              {showQRCodes ? 'Hide' : 'Show'} QR Codes
                            </Button>
                          </div>
                          
                          {showQRCodes && (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {cutRollSummary.cut_rolls.map((roll) => (
                                <div key={roll.id} className="flex justify-between items-center p-2 border rounded">
                                  <div className="text-xs">
                                    <div className="font-medium">{roll.width_inches}&quot; - {roll.gsm}gsm</div>
                                    <div className="text-muted-foreground">{roll.qr_code}</div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleShowQRCode(roll.qr_code)}
                                  >
                                    <QrCode className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No cut roll data available for this plan.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

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