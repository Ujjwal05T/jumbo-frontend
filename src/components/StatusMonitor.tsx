/**
 * Status Monitor Component - Real-time system status monitoring
 */
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Activity,
  TrendingUp,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  getStatusSummary,
  validateStatusIntegrity,
  triggerAutoStatusUpdate,
  StatusSummary,
  StatusValidationResult,
  getStatusDisplayText,
} from "@/lib/production";

interface StatusMonitorProps {
  refreshInterval?: number; // in milliseconds
  showValidation?: boolean;
  showAutoUpdate?: boolean;
}

export function StatusMonitor({
  refreshInterval = 30000, // 30 seconds default
  showValidation = true,
  showAutoUpdate = true,
}: StatusMonitorProps) {
  const [statusSummary, setStatusSummary] = useState<StatusSummary | null>(null);
  const [validationResult, setValidationResult] = useState<StatusValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadStatusSummary = async () => {
    try {
      const summary = await getStatusSummary();
      setStatusSummary(summary);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load status summary';
      setError(errorMessage);
      console.error('Status summary error:', err);
    }
  };

  const validateStatus = async () => {
    try {
      setValidating(true);
      const result = await validateStatusIntegrity();
      setValidationResult(result);
      
      if (result.issues_found > 0) {
        toast.warning(`Found ${result.issues_found} status issues that need attention`);
      } else {
        toast.success("System status validation passed - no issues found");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate status';
      toast.error(errorMessage);
      console.error('Status validation error:', err);
    } finally {
      setValidating(false);
    }
  };

  const triggerAutoUpdate = async () => {
    try {
      setUpdating(true);
      const result = await triggerAutoStatusUpdate();
      
      if (result.result.count > 0) {
        toast.success(`Auto-updated ${result.result.count} order statuses`);
        // Refresh the summary after update
        await loadStatusSummary();
      } else {
        toast.info("No status updates needed - system is consistent");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to trigger auto update';
      toast.error(errorMessage);
      console.error('Auto update error:', err);
    } finally {
      setUpdating(false);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    await loadStatusSummary();
    if (showValidation) {
      await validateStatus();
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshData();

    // Set up auto-refresh interval
    const interval = setInterval(loadStatusSummary, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getStatusColor = (entityType: string, status: string, count: number) => {
    if (count === 0) return "text-gray-400";
    
    const criticalStatuses = {
      orders: ['cancelled'],
      order_items: [],
      inventory: ['damaged'],
      pending_orders: ['cancelled']
    };

    const warningStatuses = {
      orders: ['in_process'],
      order_items: ['in_process', 'in_warehouse'],
      inventory: ['cutting'],
      pending_orders: ['pending', 'included_in_plan']
    };

    if (criticalStatuses[entityType as keyof typeof criticalStatuses]?.includes(status)) {
      return "text-red-600 font-semibold";
    }
    
    if (warningStatuses[entityType as keyof typeof warningStatuses]?.includes(status)) {
      return "text-orange-600";
    }
    
    return "text-green-600";
  };

  if (loading && !statusSummary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Status Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2">Loading status data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                System Status Monitor
              </CardTitle>
              <CardDescription>
                Real-time overview of order, inventory, and production statuses
                {lastRefresh && (
                  <span className="block text-xs mt-1">
                    Last updated: {lastRefresh.toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {showAutoUpdate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerAutoUpdate}
                  disabled={updating}
                >
                  {updating ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  )}
                  Auto Update
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-red-600 text-center py-4">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              {error}
            </div>
          ) : statusSummary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Orders */}
              <div>
                <h3 className="font-semibold mb-3 text-blue-600">Orders</h3>
                <div className="space-y-2">
                  {Object.entries(statusSummary.orders).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-sm">{getStatusDisplayText(status)}</span>
                      <span className={`text-sm font-medium ${getStatusColor('orders', status, count)}`}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-semibold mb-3 text-green-600">Order Items</h3>
                <div className="space-y-2">
                  {Object.entries(statusSummary.order_items).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-sm">{getStatusDisplayText(status)}</span>
                      <span className={`text-sm font-medium ${getStatusColor('order_items', status, count)}`}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inventory */}
              <div>
                <h3 className="font-semibold mb-3 text-purple-600">Inventory</h3>
                <div className="space-y-2">
                  {Object.entries(statusSummary.inventory).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-sm">{getStatusDisplayText(status)}</span>
                      <span className={`text-sm font-medium ${getStatusColor('inventory', status, count)}`}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending Orders */}
              <div>
                <h3 className="font-semibold mb-3 text-orange-600">Pending Orders</h3>
                <div className="space-y-2">
                  {Object.entries(statusSummary.pending_orders).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-sm">{getStatusDisplayText(status)}</span>
                      <span className={`text-sm font-medium ${getStatusColor('pending_orders', status, count)}`}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {showValidation && validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.status === 'healthy' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              Status Validation
              <Badge variant={validationResult.status === 'healthy' ? 'default' : 'destructive'}>
                {validationResult.status === 'healthy' ? 'Healthy' : `${validationResult.issues_found} Issues`}
              </Badge>
            </CardTitle>
            <CardDescription>
              System integrity check completed at {new Date(validationResult.validation_completed_at).toLocaleString()}
            </CardDescription>
          </CardHeader>
          {validationResult.issues_found > 0 && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResult.issues.map((issue, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Badge variant="outline">{issue.type.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {issue.order_id || issue.order_item_id || issue.inventory_id || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">{issue.issue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}