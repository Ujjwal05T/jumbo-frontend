/**
 * Planning page - Cutting plans and production planning
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, Save } from "lucide-react";
import { fetchOrders, Order } from "@/lib/orders";

interface OptimizationResult {
  jumbo_rolls_used: Array<{
    jumbo_number: number;
    rolls: Array<{
      width: number;
      gsm: number;
      bf: number;
      shade: string;
      min_length: number;
    }>;
    trim_left: number;
    waste_percentage: number;
    paper_spec: {
      gsm: number;
      shade: string;
      bf: number;
    };
  }>;
  pending_orders: Array<{
    width: number;
    quantity: number;
    gsm: number;
    bf: number;
    shade: string;
    min_length: number;
  }>;
  summary: {
    total_jumbos_used: number;
    total_trim_inches: number;
    overall_waste_percentage: number;
    all_orders_fulfilled: boolean;
    pending_rolls_count: number;
    specification_groups_processed: number;
  };
}

export default function PlanningPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        const data = await fetchOrders();
        setOrders(data);
      } catch (err) {
        setError("Failed to load orders. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrders(checked ? orders.map(order => order.id) : []);
  };

  const generatePlan = async () => {
    if (selectedOrders.length === 0) {
      setError("Please select at least one order to generate a plan.");
      return;
    }

    try {
      setOptimizing(true);
      setError(null);
      
      const user_id = localStorage.getItem("user_id");
      if (!user_id) {
        throw new Error("User not authenticated");
      }

      const response = await fetch('http://localhost:8000/api/optimizer/test-with-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_ids: selectedOrders,
          created_by_id: user_id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate optimization plan');
      }

      const data = await response.json();
      setOptimizationResult(data.optimization_result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
      console.error(err);
    } finally {
      setOptimizing(false);
    }
  };

  // Group pending orders by paper specifications
  const groupedPendingOrders = optimizationResult?.pending_orders.reduce((acc, order) => {
    const key = `${order.gsm}-${order.bf}-${order.shade}`;
    if (!acc[key]) {
      acc[key] = {
        gsm: order.gsm,
        bf: order.bf,
        shade: order.shade,
        orders: []
      };
    }
    acc[key].orders.push(order);
    return acc;
  }, {} as Record<string, { gsm: number; bf: number; shade: string; orders: any[] }>) || {};

  return (
    <div className="space-y-6 m-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Production Planning</h1>
        <div className="flex gap-2">
          <Button 
            variant="default" 
            onClick={generatePlan}
            disabled={optimizing || selectedOrders.length === 0}
          >
            {optimizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Optimizing...
              </>
            ) : 'Generate Plan'}
          </Button>
          <Button variant="outline" disabled>
            <Save className="mr-2 h-4 w-4" />
            Save Plan
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>Select orders to include in the production plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedOrders.length > 0 && selectedOrders.length === orders.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Paper</TableHead>
                  <TableHead>Width (in)</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Min Length</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      <div className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading orders...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : orders.length > 0 ? (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={() => handleOrderSelect(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{order.id.split('-')[0]}</TableCell>
                      <TableCell>{order.client?.company_name || 'N/A'}</TableCell>
                      <TableCell>
                        {order.paper?.name} ({order.paper?.gsm}gsm, {order.paper?.bf}bf, {order.paper?.shade})
                      </TableCell>
                      <TableCell>{order.width_inches}"</TableCell>
                      <TableCell>{order.quantity_rolls} rolls</TableCell>
                      <TableCell>{order.min_length || 'N/A'} m</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            order.priority === 'urgent' ? 'destructive' :
                            order.priority === 'high' ? 'secondary' :
                            order.priority === 'normal' ? 'default' : 'outline'
                          }
                        >
                          {order.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            order.status === 'completed' ? 'default' :
                            order.status === 'in_progress' ? 'secondary' :
                            order.status === 'cancelled' ? 'destructive' : 'outline'
                          }
                        >
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      No orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {optimizationResult && (
        <Card>
          <CardHeader>
            <CardTitle>Optimization Results</CardTitle>
            <CardDescription>
              {optimizationResult.summary.all_orders_fulfilled 
                ? 'All orders have been fulfilled' 
                : `Some orders could not be fulfilled (${optimizationResult.summary.pending_rolls_count} rolls pending)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl">{optimizationResult.summary.total_jumbos_used}</CardTitle>
                    <CardDescription>Jumbo Rolls Used</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl">{optimizationResult.summary.overall_waste_percentage.toFixed(2)}%</CardTitle>
                    <CardDescription>Waste Percentage</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl">{optimizationResult.summary.total_trim_inches}"</CardTitle>
                    <CardDescription>Total Trim</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              {/* Jumbo Rolls Used */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Jumbo Rolls Used</h3>
                <div className="space-y-4">
                  {optimizationResult.jumbo_rolls_used.map((jumbo) => (
                    <Card key={jumbo.jumbo_number}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium">Jumbo Roll #{jumbo.jumbo_number}</h4>
                          <div className="text-sm text-muted-foreground">
                            Waste: {jumbo.waste_percentage.toFixed(2)}% | Trim: {jumbo.trim_left}"
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {jumbo.paper_spec.gsm}gsm, {jumbo.paper_spec.bf}bf, {jumbo.paper_spec.shade}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {jumbo.rolls.map((roll, idx) => (
                            <Badge key={idx} variant="outline" className="text-sm">
                              {roll.width}" × {roll.min_length}m
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Pending Orders Grouped by Specs */}
              {optimizationResult.summary.pending_rolls_count > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Pending Orders</h3>
                  <div className="space-y-4">
                    {Object.entries(groupedPendingOrders).map(([key, group]) => (
                      <Card key={key}>
                        <CardHeader className="pb-2">
                          <h4 className="font-medium">
                            {group.gsm}gsm, {group.bf}bf, {group.shade}
                          </h4>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Width</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Min Length</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.orders.map((order, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{order.width}"</TableCell>
                                  <TableCell>{order.quantity} rolls</TableCell>
                                  <TableCell>{order.min_length}m</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}