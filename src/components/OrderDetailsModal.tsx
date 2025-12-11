"use client";

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createRequestOptions } from '@/lib/api-config';
import { Loader2, Package, FileText, AlertCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface OrderDetailsModalProps {
  orderFrontendId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailsModal({ orderFrontendId, open, onOpenChange }: OrderDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (open && orderFrontendId) {
      fetchOrderDetails();
    }
  }, [open, orderFrontendId]);

  const fetchOrderDetails = async () => {
    if (!orderFrontendId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch order details with cut rolls and pending items
      const detailsResponse = await fetch(
        `${API_BASE_URL}/reports/order-details/${orderFrontendId}`,
        createRequestOptions('GET')
      );

      if (!detailsResponse.ok) {
        throw new Error('Failed to fetch order details');
      }

      const detailsData = await detailsResponse.json();
      setOrderDetails(detailsData.data);
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  // Filter cut rolls based on status
  const filteredCutRolls = useMemo(() => {
    if (!orderDetails?.cut_rolls) return [];

    if (statusFilter === 'all') {
      return orderDetails.cut_rolls;
    }

    return orderDetails.cut_rolls.filter((roll: any) =>
      roll.status.toLowerCase() === statusFilter.toLowerCase()
    );
  }, [orderDetails?.cut_rolls, statusFilter]);

  // Get unique statuses for filter
  const uniqueStatuses = useMemo<string[]>(() => {
    if (!orderDetails?.cut_rolls) return [];

    const statuses = new Set<string>(orderDetails.cut_rolls.map((roll: any) => roll.status.toLowerCase()));
    return Array.from(statuses);
  }, [orderDetails?.cut_rolls]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Order Details: {orderFrontendId}
          </DialogTitle>
          <DialogDescription>
            Complete information about this order
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

        {!loading && !error && orderDetails && (
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="rolls">Cut Rolls ({orderDetails.cut_rolls?.length || 0})</TabsTrigger>
              <TabsTrigger value="pending">Pending Items ({orderDetails.pending_items?.length || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              <Card>
                <CardHeader>
                  <CardTitle>Order Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Order ID</p>
                      <p className="font-semibold">{orderDetails.order?.frontend_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Client</p>
                      <p className="font-semibold">{orderDetails.order?.client_company_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Order Date</p>
                      <p>{orderDetails.order?.order_date ? new Date(orderDetails.order.order_date).toLocaleDateString('en-GB') : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Delivery Date</p>
                      <p>{orderDetails.order?.delivery_date ? new Date(orderDetails.order.delivery_date).toLocaleDateString('en-GB') : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge>{orderDetails.order?.status || 'N/A'}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Allocated Weight</p>
                      <p className="font-semibold">{orderDetails.summary?.total_allocated_weight?.toFixed(2) || 0} kg</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cut Rolls</p>
                      <p className="font-semibold">{orderDetails.summary?.total_cut_rolls || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pending Items</p>
                      <p className="font-semibold">{orderDetails.summary?.total_pending_items || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rolls">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Cut Rolls Allocated to Order ({filteredCutRolls.length})
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {uniqueStatuses.map((status: string) => {
                          const statusMap: Record<string, string> = {
                            'used': 'Dispatched',
                            'available': 'Weight Updated',
                            'cutting': 'Planned'
                          };
                          const displayLabel = statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
                          return (
                            <SelectItem key={status} value={status}>
                              {displayLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!orderDetails.cut_rolls || orderDetails.cut_rolls.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No cut rolls allocated yet</p>
                  ) : filteredCutRolls.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No cut rolls match the selected filter</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredCutRolls.map((roll: any) => {
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
                          <div key={roll.id} className="border rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-mono font-semibold text-sm">{roll.barcode_id}</p>
                                <p className="text-xs text-muted-foreground">
                                  {roll.paper_specs?.name} - {roll.paper_specs?.gsm}GSM, {roll.paper_specs?.bf}BF, {roll.paper_specs?.shade}
                                </p>
                                <p className="text-xs">Width: {roll.width_inches}"</p>
                                {roll.parent_jumbo_roll?.barcode_id && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Jumbo: {roll.parent_jumbo_roll.barcode_id}
                                    {roll.parent_118_roll?.barcode_id && ` → 118": ${roll.parent_118_roll.barcode_id}`}
                                  </p>
                                )}
                              </div>
                              <div className="text-right ml-2">
                                <p className="font-semibold text-sm">{roll.weight_kg} kg</p>
                                <Badge className="mt-1 text-xs">{getStatusLabel(roll.status)}</Badge>
                                {roll.production_date && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(roll.production_date).toLocaleDateString('en-GB')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Pending Order Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!orderDetails.pending_items || orderDetails.pending_items.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No pending items for this order</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {orderDetails.pending_items.map((item: any) => (
                        <div key={item.id} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-mono text-sm font-semibold">{item.frontend_id}</p>
                            <Badge variant={item.status === 'pending' ? 'destructive' : 'default'} className="text-xs">
                              {item.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.paper_specs?.gsm}GSM, {item.paper_specs?.bf}BF, {item.paper_specs?.shade}
                          </p>
                          <p className="text-xs">Width: {item.width_inches}"</p>
                          
                          {item.production_order?.frontend_id && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Production Order: {item.production_order.frontend_id} ({item.production_order.status})
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
