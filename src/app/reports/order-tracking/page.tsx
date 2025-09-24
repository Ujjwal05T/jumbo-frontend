"use client";

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Truck,
  MapPin,
  Settings,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { REPORTS_ENDPOINTS, createRequestOptions } from '@/lib/api-config';

// Types for tracking data
type OrderTrackingData = {
  order_info: {
    id: string;
    frontend_id: string;
    client_name: string;
    status: string;
    created_at: string;
    delivery_date: string | null;
  };
  order_items: Array<{
    id: string;
    frontend_id: string;
    paper_specs: {
      name: string;
      gsm: number;
      bf: number;
      shade: string;
      type: string;
    };
    width_inches: number;
    quantity_ordered: number;
    quantity_fulfilled: number;
    quantity_pending: number;
    item_status: string;
    allocated_inventory: Array<{
      id: string;
      frontend_id: string;
      paper_specs: {
        name: string;
        gsm: number;
        bf: number;
        shade: string;
        type: string;
      };
      width_inches: number;
      weight_kg: number;
      status: string;
      location: string;
      roll_type: string;
      production_date: string | null;
      is_paper_match: boolean;
      is_width_match: boolean;
      mismatch_reasons: string[];
    }>;
    production_assignments: Array<{
      id: string;
      frontend_id: string;
      production_order_id: string | null;
      production_order_frontend_id: string | null;
      status: string;
      quantity_pending: number;
      quantity_fulfilled: number;
      reason: string;
      created_at: string;
      paper_specs: {
        gsm: number;
        bf: number;
        shade: string;
      };
      width_inches: number;
      mismatch_reasons: string[];
    }>;
    dispatch_records: Array<{
      id: string;
      dispatch_record_id: string;
      dispatch_frontend_id: string | null;
      inventory_id: string;
      inventory_frontend_id: string | null;
      quantity_dispatched: number;
      weight_kg: number;
      dispatch_date: string | null;
      vehicle_number: string | null;
      status: string | null;
    }>;
    potential_issues: string[];
  }>;
  potential_mismatches: Array<{
    type: string;
    description: string;
    inventory_id: string;
    inventory_frontend_id: string;
    allocated_to_order: string | null;
    allocated_to_client: string | null;
    paper_specs: {
      gsm: number;
      bf: number;
      shade: string;
    };
    width_inches: number;
    weight_kg: number;
  }>;
  summary: {
    total_order_items: number;
    total_allocated_inventory: number;
    total_potential_issues: number;
    total_cross_order_matches: number;
    items_with_issues: number;
    health_status: string;
  };
};

type CorrectionData = {
  inventory_id: string;
  new_order_id: string;
  reason: string;
};

export default function OrderTrackingPage() {
  const [orderFrontendId, setOrderFrontendId] = useState('');
  const [trackingData, setTrackingData] = useState<OrderTrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Correction modal state
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [correctionOrderId, setCorrectionOrderId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionLoading, setCorrectionLoading] = useState(false);

  // System health state
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [loadingSystemHealth, setLoadingSystemHealth] = useState(false);

  const fetchOrderTracking = async () => {
    if (!orderFrontendId.trim()) {
      setError('Please enter an order ID');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const url = `${REPORTS_ENDPOINTS.ORDER_TRACKING}/${orderFrontendId}`;
      const response = await fetch(url, createRequestOptions('GET'));
      const result = await response.json();

      if (result.status === 'success') {
        setTrackingData(result.data);
      } else {
        setError(result.detail || 'Failed to fetch order tracking data');
      }
    } catch (error) {
      console.error('Error fetching order tracking:', error);
      setError('Failed to fetch order tracking data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemHealth = async () => {
    setLoadingSystemHealth(true);
    try {
      const url = REPORTS_ENDPOINTS.ORDER_TRACKING_SYSTEM_HEALTH;
      const response = await fetch(url, createRequestOptions('GET'));
      const result = await response.json();

      if (result.status === 'success') {
        setSystemHealth(result.data);
      }
    } catch (error) {
      console.error('Error fetching system health:', error);
    } finally {
      setLoadingSystemHealth(false);
    }
  };

  const handleCorrection = async () => {
    if (!selectedInventoryId || !correctionOrderId.trim() || !correctionReason.trim()) {
      return;
    }

    setCorrectionLoading(true);
    try {
      const url = REPORTS_ENDPOINTS.ORDER_TRACKING_FIX;
      const response = await fetch(url, createRequestOptions('POST', {
        inventory_id: selectedInventoryId,
        new_order_id: correctionOrderId,
        reason: correctionReason
      }));

      const result = await response.json();

      if (result.status === 'success') {
        // Refresh tracking data
        await fetchOrderTracking();
        setCorrectionModalOpen(false);
        setSelectedInventoryId('');
        setCorrectionOrderId('');
        setCorrectionReason('');
      } else {
        setError(result.detail || 'Failed to fix allocation');
      }
    } catch (error) {
      console.error('Error fixing allocation:', error);
      setError('Failed to fix allocation');
    } finally {
      setCorrectionLoading(false);
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return 'text-green-600 bg-green-100';
      case 'WARNING': return 'text-yellow-600 bg-yellow-100';
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY': return <CheckCircle className="h-4 w-4" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4" />;
      case 'CRITICAL': return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Order Item Tracking</h1>
            <p className="text-muted-foreground">
              Track order items, detect mismatches, and fix inventory allocations
            </p>
          </div>
          <Button
            onClick={fetchSystemHealth}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            System Health
          </Button>
        </div>

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle>Search Order</CardTitle>
            <CardDescription>
              Enter an order frontend ID to view detailed tracking information and detect potential mismatches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Enter order frontend ID (e.g., ORD-001)"
                value={orderFrontendId}
                onChange={(e) => setOrderFrontendId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && fetchOrderTracking()}
                className="flex-1"
              />
              <Button
                onClick={fetchOrderTracking}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                {loading ? 'Searching...' : 'Track Order'}
              </Button>
            </div>
            {error && (
              <Alert className="mt-4" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* System Health Summary */}
        {systemHealth && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                System Health Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${getHealthStatusColor(systemHealth.overall_status)}`}>
                    {getHealthStatusIcon(systemHealth.overall_status)}
                    {systemHealth.overall_status}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Overall Status</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{systemHealth.total_issues}</div>
                  <div className="text-xs text-muted-foreground">Total Issues</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{systemHealth.issue_categories?.specification_mismatches || 0}</div>
                  <div className="text-xs text-muted-foreground">Spec Mismatches</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{systemHealth.issue_categories?.missing_allocations || 0}</div>
                  <div className="text-xs text-muted-foreground">Missing Allocations</div>
                </div>
              </div>
              {systemHealth.recommendations && systemHealth.recommendations.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Recommendations:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {systemHealth.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-current rounded-full"></div>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Order Tracking Results */}
        {trackingData && (
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Order: {trackingData.order_info.frontend_id}</span>
                  <Badge className={`${getHealthStatusColor(trackingData.summary.health_status)}`}>
                    {getHealthStatusIcon(trackingData.summary.health_status)}
                    <span className="ml-1">{trackingData.summary.health_status}</span>
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Client: {trackingData.order_info.client_name} | Status: {trackingData.order_info.status}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{trackingData.summary.total_order_items}</div>
                    <div className="text-xs text-muted-foreground">Order Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{trackingData.summary.total_allocated_inventory}</div>
                    <div className="text-xs text-muted-foreground">Allocated Inventory</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{trackingData.summary.total_potential_issues}</div>
                    <div className="text-xs text-muted-foreground">Potential Issues</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{trackingData.summary.total_cross_order_matches}</div>
                    <div className="text-xs text-muted-foreground">Cross-Order Matches</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{trackingData.summary.items_with_issues}</div>
                    <div className="text-xs text-muted-foreground">Items with Issues</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Critical Issues Alert */}
            {trackingData.summary.total_potential_issues > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Critical Issues Detected</AlertTitle>
                <AlertDescription>
                  Found {trackingData.summary.total_potential_issues} potential issues that require attention.
                  Review the detailed breakdown below and use the correction tools to fix mismatches.
                </AlertDescription>
              </Alert>
            )}

            {/* Order Items Detailed Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Items Tracking
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of each order item with inventory allocations and potential issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {trackingData.order_items.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      {/* Item Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-semibold">{item.paper_specs.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {item.paper_specs.gsm}GSM, {item.paper_specs.bf}BF, {item.paper_specs.shade} | {item.width_inches}"
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>Ordered: <strong>{item.quantity_ordered}</strong></span>
                          <span>Fulfilled: <strong>{item.quantity_fulfilled}</strong></span>
                          <span>Pending: <strong>{item.quantity_pending}</strong></span>
                          {item.potential_issues.length > 0 && (
                            <Badge variant="destructive">{item.potential_issues.length} Issues</Badge>
                          )}
                        </div>
                      </div>

                      {/* Potential Issues */}
                      {item.potential_issues.length > 0 && (
                        <Alert className="mb-4" variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Issues Detected</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc list-inside space-y-1">
                              {item.potential_issues.map((issue, issueIndex) => (
                                <li key={issueIndex}>{issue}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Allocated Inventory */}
                      {item.allocated_inventory.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Allocated Inventory ({item.allocated_inventory.length} items)
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {item.allocated_inventory.map((inv, invIndex) => (
                              <div key={invIndex} className={`border rounded p-3 ${inv.mismatch_reasons.length > 0 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-mono text-sm">{inv.frontend_id}</span>
                                  <div className="flex items-center gap-2">
                                    {inv.is_paper_match && inv.is_width_match ? (
                                      <Badge variant="secondary" className="text-green-700 bg-green-100">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Match
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive">
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Mismatch
                                      </Badge>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedInventoryId(inv.id);
                                        setCorrectionModalOpen(true);
                                      }}
                                    >
                                      <Settings className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="text-xs space-y-1">
                                  <div>Paper: {inv.paper_specs.gsm}GSM, {inv.paper_specs.bf}BF, {inv.paper_specs.shade}</div>
                                  <div>Width: {inv.width_inches}" | Weight: {inv.weight_kg}kg</div>
                                  <div>Location: {inv.location} | Status: {inv.status}</div>
                                  {inv.mismatch_reasons.length > 0 && (
                                    <div className="text-red-600 mt-2">
                                      <strong>Issues:</strong>
                                      <ul className="list-disc list-inside ml-2">
                                        {inv.mismatch_reasons.map((reason, reasonIndex) => (
                                          <li key={reasonIndex}>{reason}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Production Assignments */}
                      {item.production_assignments.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Production Assignments ({item.production_assignments.length} items)
                          </h5>
                          <div className="space-y-2">
                            {item.production_assignments.map((prod, prodIndex) => (
                              <div key={prodIndex} className={`border rounded p-3 ${prod.mismatch_reasons.length > 0 ? 'border-red-300 bg-red-50' : 'border-blue-300 bg-blue-50'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-mono text-sm">{prod.frontend_id}</span>
                                  <Badge variant={prod.mismatch_reasons.length > 0 ? "destructive" : "secondary"}>
                                    {prod.status}
                                  </Badge>
                                </div>
                                <div className="text-xs space-y-1">
                                  <div>Pending: {prod.quantity_pending} | Fulfilled: {prod.quantity_fulfilled}</div>
                                  <div>Reason: {prod.reason}</div>
                                  {prod.mismatch_reasons.length > 0 && (
                                    <div className="text-red-600 mt-2">
                                      <strong>Issues:</strong>
                                      <ul className="list-disc list-inside ml-2">
                                        {prod.mismatch_reasons.map((reason, reasonIndex) => (
                                          <li key={reasonIndex}>{reason}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dispatch Records */}
                      {item.dispatch_records.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            Dispatch Records ({item.dispatch_records.length} items)
                          </h5>
                          <div className="space-y-2">
                            {item.dispatch_records.map((dispatch, dispatchIndex) => (
                              <div key={dispatchIndex} className="border rounded p-3 bg-gray-50">
                                <div className="text-xs space-y-1">
                                  <div>Dispatch ID: {dispatch.dispatch_frontend_id}</div>
                                  <div>Vehicle: {dispatch.vehicle_number} | Quantity: {dispatch.quantity_dispatched}</div>
                                  <div>Date: {dispatch.dispatch_date ? new Date(dispatch.dispatch_date).toLocaleDateString() : 'N/A'}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cross-Order Potential Mismatches */}
            {trackingData.potential_mismatches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Potential Cross-Order Mismatches
                  </CardTitle>
                  <CardDescription>
                    Inventory items with matching specifications allocated to different orders
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {trackingData.potential_mismatches.map((mismatch, index) => (
                      <div key={index} className="border rounded p-4 border-yellow-300 bg-yellow-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm">{mismatch.inventory_frontend_id}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInventoryId(mismatch.inventory_id);
                              setCorrectionOrderId(trackingData.order_info.frontend_id);
                              setCorrectionReason(`Move from ${mismatch.allocated_to_order} to ${trackingData.order_info.frontend_id}`);
                              setCorrectionModalOpen(true);
                            }}
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            Reassign
                          </Button>
                        </div>
                        <div className="text-sm space-y-1">
                          <div><strong>Description:</strong> {mismatch.description}</div>
                          <div><strong>Currently allocated to:</strong> {mismatch.allocated_to_order} ({mismatch.allocated_to_client})</div>
                          <div><strong>Specs:</strong> {mismatch.paper_specs.gsm}GSM, {mismatch.paper_specs.bf}BF, {mismatch.paper_specs.shade} | {mismatch.width_inches}"</div>
                          <div><strong>Weight:</strong> {mismatch.weight_kg}kg</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Correction Modal */}
        <Dialog open={correctionModalOpen} onOpenChange={setCorrectionModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Fix Inventory Allocation</DialogTitle>
              <DialogDescription>
                Reassign inventory item to correct order
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Target Order ID</label>
                <Input
                  placeholder="Enter order frontend ID"
                  value={correctionOrderId}
                  onChange={(e) => setCorrectionOrderId(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Reason for Correction</label>
                <Input
                  placeholder="Describe why this correction is needed"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCorrectionModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCorrection}
                  disabled={correctionLoading || !correctionOrderId.trim() || !correctionReason.trim()}
                >
                  {correctionLoading ? 'Fixing...' : 'Fix Allocation'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}