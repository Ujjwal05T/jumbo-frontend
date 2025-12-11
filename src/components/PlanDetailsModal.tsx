"use client";

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createRequestOptions } from '@/lib/api-config';
import { Loader2, Scissors, Package, AlertCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface PlanDetailsModalProps {
  planFrontendId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlanDetailsModal({ planFrontendId, open, onOpenChange }: PlanDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [planDetails, setPlanDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (open && planFrontendId) {
      fetchPlanDetails();
    }
  }, [open, planFrontendId]);

  const fetchPlanDetails = async () => {
    if (!planFrontendId) return;

    setLoading(true);
    setError(null);

    try {
      const detailsResponse = await fetch(
        `${API_BASE_URL}/reports/plan-details/${planFrontendId}`,
        createRequestOptions('GET')
      );

      if (!detailsResponse.ok) {
        throw new Error('Failed to fetch plan details');
      }

      const detailsData = await detailsResponse.json();
      setPlanDetails(detailsData.data);
    } catch (err) {
      console.error('Error fetching plan details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plan details');
    } finally {
      setLoading(false);
    }
  };

  // Filter cut rolls based on status
  const filteredCutRolls = useMemo(() => {
    if (!planDetails?.cut_rolls) return [];

    if (statusFilter === 'all') {
      return planDetails.cut_rolls;
    }

    return planDetails.cut_rolls.filter((roll: any) =>
      roll.status.toLowerCase() === statusFilter.toLowerCase()
    );
  }, [planDetails?.cut_rolls, statusFilter]);

  // Get unique statuses for filter
  const uniqueStatuses = useMemo<string[]>(() => {
    if (!planDetails?.cut_rolls) return [];

    const statuses = new Set<string>(planDetails.cut_rolls.map((roll: any) => roll.status.toLowerCase()));
    return Array.from(statuses);
  }, [planDetails?.cut_rolls]);

  // Map status to display labels
  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'used': 'dispatched',
      'available': 'weight updated',
      'cutting': 'planned'
    };
    return statusMap[status.toLowerCase()] || status;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Plan Details: {planFrontendId}
          </DialogTitle>
          <DialogDescription>
            Cut rolls created from this cutting plan
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive py-4">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && planDetails && (
          <div className="space-y-4">
            {/* Plan Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Plan Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan ID</p>
                    <p className="font-semibold">{planDetails.plan?.frontend_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge>{planDetails.plan?.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created At</p>
                    <p>{planDetails.plan?.created_at ? new Date(planDetails.plan.created_at).toLocaleDateString('en-GB') : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cut Rolls</p>
                    <p className="font-semibold">{planDetails.summary?.total_cut_rolls || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Weight</p>
                    <p className="font-semibold">{planDetails.summary?.total_weight?.toFixed(2) || 0} kg</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unique Clients</p>
                    <p className="font-semibold">{planDetails.summary?.unique_clients || 0}</p>
                  </div>
                  {planDetails.plan?.expected_waste_percentage !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Expected Waste</p>
                      <p className="font-semibold">{planDetails.plan.expected_waste_percentage}%</p>
                    </div>
                  )}
                  {planDetails.plan?.actual_waste_percentage !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Actual Waste</p>
                      <p className="font-semibold">{planDetails.plan.actual_waste_percentage}%</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cut Rolls */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Cut Rolls ({filteredCutRolls.length} / {planDetails.cut_rolls?.length || 0})
                  </CardTitle>
                  {uniqueStatuses.length > 0 && (
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {uniqueStatuses.map((status: string) => (
                          <SelectItem key={status} value={status}>
                            {getStatusLabel(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!planDetails.cut_rolls || planDetails.cut_rolls.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No cut rolls found for this plan</p>
                ) : filteredCutRolls.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No cut rolls match the selected status</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {filteredCutRolls.map((roll: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="space-y-2">
                          <div>
                            <p className="font-mono font-semibold text-sm">{roll.barcode_id}</p>
                            <p className="text-xs text-muted-foreground">
                              {roll.paper_name} - {roll.gsm}GSM, {roll.bf}BF, {roll.shade}
                            </p>
                            <p className="text-xs">Width: {roll.width_inches}"</p>
                            {roll.client_name && (
                              <p className="text-xs text-blue-600 mt-1">
                                Client: {roll.client_name} {roll.order_id && `(${roll.order_id})`}
                              </p>
                            )}
                            {roll.parent_jumbo_roll && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Jumbo: {roll.parent_jumbo_roll}
                                {roll.parent_118_roll && ` → 118": ${roll.parent_118_roll}`}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm">{roll.weight_kg} kg</p>
                            <Badge className="text-xs">{getStatusLabel(roll.status)}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
