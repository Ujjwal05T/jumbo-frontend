/**
 * Planning page - NEW FLOW: Cut roll selection and production planning
 */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, Factory, QrCode, X } from "lucide-react";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import { fetchOrders, Order } from "@/lib/orders";
import { PRODUCTION_ENDPOINTS, createRequestOptions } from "@/lib/api-config";


// NEW FLOW: Cut roll interfaces
interface CutRoll {
  width: number;
  quantity: number;
  gsm: number;
  bf: number;
  shade: string;
  source: 'cutting' | 'inventory';
  individual_roll_number?: number;
  trim_left?: number;
  inventory_id?: string;
  order_id?: string;
  client_id?: string;
  paper_id?: string;
}

interface PendingOrder {
  width: number;
  quantity: number;
  gsm: number;
  bf: number;
  shade: string;
  reason: string;
}

interface InventoryItem {
  width: number;
  quantity: number;
  gsm: number;
  bf: number;
  shade: string;
  source: string;
  inventory_id?: string;
}

interface PlanGenerationResult {
  optimization_result: {
    cut_rolls_generated: CutRoll[];
    jumbo_roll_sets_needed: number;
    pending_orders: PendingOrder[];
    inventory_remaining: InventoryItem[];
    summary: {
      total_cut_rolls: number;
      total_individual_118_rolls: number;
      total_jumbo_roll_sets_needed: number;
      total_pending_orders: number;
      total_pending_quantity: number;
      total_inventory_created: number;
      specification_groups_processed: number;
    };
  };
  selection_data: {
    cut_rolls_available: CutRoll[];
    pending_orders: PendingOrder[];
    inventory_items_to_add: InventoryItem[];
    summary: {
      total_cut_rolls: number;
      total_individual_118_rolls: number;
      jumbo_roll_sets_needed: number;
      pending_orders_count: number;
      inventory_items_count: number;
    };
  };
  next_steps: string[];
}

interface ProductionRecord {
  id: string;
  qr_code: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  status: string;
  actual_weight_kg?: number;
  selected_at: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

function ConfirmationDialog({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirm", 
  cancelText = "Cancel" 
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProductionRecordsErrorBoundary({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ErrorBoundaryState>({ hasError: false });

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setState({ hasError: true, error: event.error });
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  if (state.hasError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Production Records Error</AlertTitle>
        <AlertDescription>
          Unable to load production records. Please refresh the page and try again.
          {state.error && (
            <details className="mt-2">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="text-xs mt-1 overflow-auto">{state.error.message}</pre>
            </details>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}

export default function PlanningPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [planResult, setPlanResult] = useState<PlanGenerationResult | null>(null);
  const [selectedCutRolls, setSelectedCutRolls] = useState<number[]>([]);
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([]);
  const [creatingProduction, setCreatingProduction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedQRCode, setSelectedQRCode] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [qrModalLoading, setQrModalLoading] = useState(false);

  // Memoized computations for performance
  const filteredOrders = useMemo(() => {
    return orders.filter(order => order.status === 'pending');
  }, [orders]);

  const orderTableData = useMemo(() => {
    return filteredOrders.map(order => ({
      ...order,
      aggregatedPaper: (() => {
        const firstItem = order.order_items?.[0];
        const paper = firstItem?.paper;
        if (paper) {
          return `${paper.gsm}gsm, ${paper.bf}bf, ${paper.shade}`;
        }
        // Fallback: aggregate all paper specs from order items
        const uniqueSpecs = Array.from(
          new Set(
            order.order_items
              ?.filter(item => item.paper)
              .map(item => `${item.paper!.gsm}gsm, ${item.paper!.bf}bf, ${item.paper!.shade}`)
          )
        );
        return uniqueSpecs.length > 0 ? uniqueSpecs.join('; ') : 'N/A';
      })(),
      aggregatedWidths: (() => {
        const widths = order.order_items?.map(item => `${item.width_inches}"`);
        return widths?.length ? [...new Set(widths)].join(', ') : 'N/A';
      })(),
      totalQuantity: order.order_items?.reduce((total, item) => total + item.quantity_rolls, 0) || 0
    }));
  }, [filteredOrders]);

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

  const handleOrderSelect = useCallback((orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedOrders(checked ? filteredOrders.map(order => order.id) : []);
  }, [filteredOrders]);

  const handleCutRollSelect = useCallback((index: number) => {
    setSelectedCutRolls(prev => 
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  }, []);

  const handleSelectAllCutRolls = useCallback((checked: boolean) => {
    setSelectedCutRolls(checked ? 
      planResult?.selection_data.cut_rolls_available.map((_, index) => index) || [] : []);
  }, [planResult]);

  const generatePlan = async () => {
    if (selectedOrders.length === 0) {
      setError("Please select at least one order to generate a plan.");
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      
      const user_id = localStorage.getItem("user_id");
      if (!user_id) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(PRODUCTION_ENDPOINTS.GENERATE_PLAN, createRequestOptions('POST', {
        order_ids: selectedOrders,
        created_by_id: user_id
      })
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to generate plan with cut roll selection';
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.detail) {
            errorMessage = Array.isArray(errorJson.detail) 
              ? errorJson.detail.map((err: { msg?: string; message?: string } | string) => 
                  typeof err === 'string' ? err : (err.msg || err.message || 'Unknown error')).join(', ')
              : errorJson.detail;
          } else if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data || !data.selection_data) {
        throw new Error('Invalid response format from server');
      }
      setPlanResult(data);
      setActiveTab("cut-rolls");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateProductionRecords = () => {
    if (selectedCutRolls.length === 0) {
      setError("Please select at least one cut roll for production.");
      return;
    }
    setShowConfirmDialog(true);
  };

  const createProductionRecords = async () => {
    setShowConfirmDialog(false);

    try {
      setCreatingProduction(true);
      setError(null);
      
      const user_id = localStorage.getItem("user_id");
      if (!user_id) {
        throw new Error("User not authenticated");
      }

      // Prepare cut roll selections
      const cutRollSelections = selectedCutRolls.map(index => {
        const cutRoll = planResult!.selection_data.cut_rolls_available[index];
        return {
          width: cutRoll.width,
          gsm: cutRoll.gsm,
          bf: cutRoll.bf,
          shade: cutRoll.shade,
          paper_id: cutRoll.paper_id,
          order_id: cutRoll.order_id,
          client_id: cutRoll.client_id,
          individual_roll_number: cutRoll.individual_roll_number,
          trim_left: cutRoll.trim_left
        };
      });

      // Generate a temporary UUID for the plan
      const tempPlanId = crypto.randomUUID();
      
      const response = await fetch(PRODUCTION_ENDPOINTS.SELECT_FOR_PRODUCTION, createRequestOptions('POST', {
        plan_id: tempPlanId,
        cut_roll_selections: cutRollSelections,
        created_by_id: user_id
      })
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to create production records';
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.detail) {
            errorMessage = Array.isArray(errorJson.detail) 
              ? errorJson.detail.map((err: { msg?: string; message?: string } | string) => 
                  typeof err === 'string' ? err : (err.msg || err.message || 'Unknown error')).join(', ')
              : errorJson.detail;
          } else if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format: expected array of production records');
      }
      setProductionRecords(data);
      setActiveTab("production");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create production records');
      console.error(err);
    } finally {
      setCreatingProduction(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'selected': return 'outline';
      case 'in_production': return 'secondary';
      case 'completed': return 'default';
      case 'quality_check': return 'destructive';
      case 'delivered': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6 m-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Production Planning - New Flow</h1>
        <div className="flex gap-2">
          <Button 
            variant="default" 
            onClick={generatePlan}
            disabled={generating || selectedOrders.length === 0}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Plan...
              </>
            ) : 'Generate Plan'}
          </Button>
          {planResult && (
            <Button 
              variant="secondary" 
              onClick={handleCreateProductionRecords}
              disabled={creatingProduction || selectedCutRolls.length === 0}
            >
              {creatingProduction ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Production...
                </>
              ) : (
                <>
                  <Factory className="mr-2 h-4 w-4" />
                  Start Production ({selectedCutRolls.length} rolls)
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="cut-rolls" disabled={!planResult}>Cut Rolls</TabsTrigger>
          <TabsTrigger value="pending-inventory" disabled={!planResult}>Pending & Inventory</TabsTrigger>
          <TabsTrigger value="production" disabled={productionRecords.length === 0}>Production</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
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
                          checked={selectedOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Paper</TableHead>
                      <TableHead>Width (in)</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          <div className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading orders...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : orderTableData.length > 0 ? (
                      orderTableData.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={() => handleOrderSelect(order.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{order.id.split('-')[0]}</TableCell>
                          <TableCell>{order.client?.company_name || 'N/A'}</TableCell>
                          <TableCell>{order.aggregatedPaper}</TableCell>
                          <TableCell>{order.aggregatedWidths}</TableCell>
                          <TableCell>{order.totalQuantity} rolls</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {order.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          No pending orders found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cut-rolls">
          {planResult && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl">{planResult.selection_data.summary.total_cut_rolls}</CardTitle>
                    <CardDescription>Total Cut Rolls</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl">{planResult.selection_data.summary.total_individual_118_rolls}</CardTitle>
                    <CardDescription>Individual 118&quot; Rolls</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl">{planResult.selection_data.summary.jumbo_roll_sets_needed}</CardTitle>
                    <CardDescription>Jumbo Roll Sets (3×118&quot;)</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl">{planResult.selection_data.summary.pending_orders_count}</CardTitle>
                    <CardDescription>Pending Orders</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              {/* Cut Rolls Selection */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Cut Rolls Available for Production</CardTitle>
                      <CardDescription>Select which cut rolls to move to production phase</CardDescription>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCutRolls.length} of {planResult.selection_data.cut_rolls_available.length} selected
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox 
                              checked={selectedCutRolls.length > 0 && selectedCutRolls.length === planResult.selection_data.cut_rolls_available.length}
                              onCheckedChange={handleSelectAllCutRolls}
                            />
                          </TableHead>
                          <TableHead>Width (in)</TableHead>
                          <TableHead>Paper Spec</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Roll #</TableHead>
                          <TableHead>Trim Left</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {planResult.selection_data.cut_rolls_available.map((cutRoll, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedCutRolls.includes(index)}
                                onCheckedChange={() => handleCutRollSelect(index)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{cutRoll.width}&quot;</TableCell>
                            <TableCell>
                              {cutRoll.gsm}gsm, {cutRoll.bf}bf, {cutRoll.shade}
                            </TableCell>
                            <TableCell>
                              <Badge variant={cutRoll.source === 'cutting' ? 'default' : 'secondary'}>
                                {cutRoll.source}
                              </Badge>
                            </TableCell>
                            <TableCell>{cutRoll.individual_roll_number || '-'}</TableCell>
                            <TableCell>{cutRoll.trim_left ? `${cutRoll.trim_left}&quot;` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending-inventory">
          {planResult && (
            <div className="space-y-6">
              {/* Pending Orders */}
              {planResult.selection_data.pending_orders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Orders</CardTitle>
                    <CardDescription>Orders that could not be fulfilled in this plan</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Width (in)</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Paper Spec</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {planResult.selection_data.pending_orders.map((order, index) => (
                          <TableRow key={index}>
                            <TableCell>{order.width}&quot;</TableCell>
                            <TableCell>{order.quantity} rolls</TableCell>
                            <TableCell>{order.gsm}gsm, {order.bf}bf, {order.shade}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{order.reason}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Inventory Items to Add */}
              {planResult.selection_data.inventory_items_to_add.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Inventory Items to Add</CardTitle>
                    <CardDescription>20-25&quot; waste rolls that will be added to inventory for future use</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Width (in)</TableHead>
                          <TableHead>Paper Spec</TableHead>
                          <TableHead>Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {planResult.selection_data.inventory_items_to_add.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.width}&quot;</TableCell>
                            <TableCell>{item.gsm}gsm, {item.bf}bf, {item.shade}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.source}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="production">
          <ProductionRecordsErrorBoundary>
            {productionRecords.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Production Records</CardTitle>
                  <CardDescription>Cut rolls moved to production with QR codes generated</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>QR Code</TableHead>
                        <TableHead>Width (in)</TableHead>
                        <TableHead>Paper Spec</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Weight (kg)</TableHead>
                        <TableHead>Selected At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setQrModalLoading(true);
                                  setSelectedQRCode(record.qr_code);
                                  // Simulate loading time for QR code generation
                                  setTimeout(() => setQrModalLoading(false), 300);
                                }}
                                aria-label={`View QR code for ${record.qr_code}`}
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                              <code className="text-sm">{record.qr_code}</code>
                            </div>
                          </TableCell>
                          <TableCell>{record.width_inches}&quot;</TableCell>
                          <TableCell>{record.gsm}gsm, {record.bf}bf, {record.shade}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(record.status)}>
                              {record.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.actual_weight_kg || '-'}</TableCell>
                          <TableCell>{new Date(record.selected_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </ProductionRecordsErrorBoundary>
        </TabsContent>
      </Tabs>

      {planResult && (
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2">
              {planResult.next_steps.map((step, index) => (
                <li key={index} className="text-sm">{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* QR Code Display Modal */}
      {selectedQRCode && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedQRCode(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSelectedQRCode(null);
            }
          }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
        >
          <div className="bg-background p-4 rounded-lg max-w-sm w-full mx-4">
            {qrModalLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 id="qr-modal-title" className="text-lg font-semibold">Cut Roll QR Code</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedQRCode(null)}
                    aria-label="Close QR code modal"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <QRCodeDisplay
                  value={selectedQRCode}
                  title="Cut Roll QR Code"
                  description={`Production QR Code`}
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        title="Confirm Production Creation"
        message={`Are you sure you want to move ${selectedCutRolls.length} cut roll(s) to production? This action will generate QR codes and cannot be undone.`}
        onConfirm={createProductionRecords}
        onCancel={() => setShowConfirmDialog(false)}
        confirmText="Start Production"
      />
    </div>
  );
}