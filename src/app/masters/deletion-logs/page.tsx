"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  Filter,
  RefreshCw,
  Calendar,
  User,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Download,
} from "lucide-react";
import {
  getDeletionLogs,
  type PlanDeletionLog,
  type DeletionLogsFilter,
  type DeletionLogsResponse,
  formatDeletionReason,
  formatSuccessStatus,
  getStatusColor,
  formatDuration,
  formatDate,
} from "@/lib/deletion-logs-api";

export default function PlanDeletionLogsPage() {
  const [logs, setLogs] = useState<PlanDeletionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DeletionLogsFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<PlanDeletionLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const pageSize = 20;

  // Fetch deletion logs
  const fetchLogs = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const response: DeletionLogsResponse = await getDeletionLogs(filter, page, pageSize);
      setLogs(response.logs);
      setTotalPages(response.total_pages);
      setTotalCount(response.total_count);
      setCurrentPage(response.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deletion logs');
      toast.error('Failed to fetch deletion logs');
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchLogs(1);
  }, []);

  // Refetch when filter changes
  useEffect(() => {
    if (currentPage === 1) {
      fetchLogs(1);
    } else {
      setCurrentPage(1); // Reset to first page when filter changes
    }
  }, [filter]);

  // Handle search
  const handleSearch = () => {
    const newFilter = { ...filter };

    if (searchTerm.trim()) {
      // Search by plan frontend ID or plan name
      newFilter.plan_id = searchTerm.trim();
    } else {
      delete newFilter.plan_id;
    }

    setFilter(newFilter);
  };

  // Handle filter change
  const handleFilterChange = (key: keyof DeletionLogsFilter, value: string) => {
    const newFilter = { ...filter };
    if (value) {
      newFilter[key] = value;
    } else {
      delete newFilter[key];
    }
    setFilter(newFilter);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    fetchLogs(page);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchLogs(currentPage);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setFilter({});
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Export data (simple CSV export)
  const handleExport = () => {
    const headers = [
      'Date', 'Plan ID', 'Plan Name', 'Deleted By', 'Reason',
      'Status', 'Duration', 'Items Deleted'
    ];

    const csvData = logs.map(log => [
      formatDate(log.deleted_at),
      log.plan_frontend_id,
      log.plan_name || 'N/A',
      log.deleted_by_user?.name || 'Unknown',
      formatDeletionReason(log.deletion_reason),
      formatSuccessStatus(log.success_status),
      formatDuration(log.rollback_duration_seconds),
      log.rollback_stats?.inventory_deleted || 0,
    ]);

    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan-deletion-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Deletion logs exported successfully');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plan Deletion Logs</h1>
          <p className="text-muted-foreground">
            Audit trail for all plan deletions and rollbacks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={logs.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Search & Filters</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by Plan ID or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Deletion Reason</Label>
                <Select
                  value={filter.deletion_reason || ''}
                  onValueChange={(value) => handleFilterChange('deletion_reason', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All reasons" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All reasons</SelectItem>
                    <SelectItem value="rollback">Rollback</SelectItem>
                    <SelectItem value="manual">Manual Deletion</SelectItem>
                    <SelectItem value="system">System Cleanup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filter.success_status || ''}
                  onValueChange={(value) => handleFilterChange('success_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="partial">Partial Success</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={filter.start_date || ''}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={filter.end_date || ''}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {logs.length} of {totalCount} deletion logs
        </p>
        {Object.keys(filter).length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Clear all filters
          </Button>
        )}
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Deletion Logs</CardTitle>
          <CardDescription>
            Detailed audit trail of all plan deletions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>Loading deletion logs...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-500">{error}</p>
              <Button variant="outline" onClick={handleRefresh} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No deletion logs found</p>
              <p className="text-sm text-muted-foreground">
                {Object.keys(filter).length > 0
                  ? 'Try adjusting your filters'
                  : 'No plans have been deleted yet'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Plan ID</TableHead>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Deleted By</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Items Deleted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {formatDate(log.deleted_at)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.plan_frontend_id}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {log.plan_name || 'Unnamed Plan'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{log.deleted_by_user?.name || 'Unknown User'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {formatDeletionReason(log.deletion_reason)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(log.success_status)}>
                          <div className="flex items-center gap-1">
                            {log.success_status === 'success' && <CheckCircle className="w-3 h-3" />}
                            {log.success_status === 'failed' && <XCircle className="w-3 h-3" />}
                            {log.success_status === 'partial' && <AlertCircle className="w-3 h-3" />}
                            {formatSuccessStatus(log.success_status)}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatDuration(log.rollback_duration_seconds)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono">
                          {log.rollback_stats?.inventory_deleted || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Activity className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Rollback Details</DialogTitle>
                              <DialogDescription>
                                Detailed information about this plan deletion
                              </DialogDescription>
                            </DialogHeader>
                            {selectedLog && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-medium">Plan ID</Label>
                                    <p className="text-sm">{selectedLog.plan_frontend_id}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Plan Name</Label>
                                    <p className="text-sm">{selectedLog.plan_name || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Deleted By</Label>
                                    <p className="text-sm">
                                      {selectedLog.deleted_by_user?.name || 'Unknown'}
                                      (@{selectedLog.deleted_by_user?.username || 'unknown'})
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Deleted At</Label>
                                    <p className="text-sm">{formatDate(selectedLog.deleted_at)}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Reason</Label>
                                    <p className="text-sm">{formatDeletionReason(selectedLog.deletion_reason)}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Status</Label>
                                    <Badge className={getStatusColor(selectedLog.success_status)}>
                                      {formatSuccessStatus(selectedLog.success_status)}
                                    </Badge>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Duration</Label>
                                    <p className="text-sm">{formatDuration(selectedLog.rollback_duration_seconds)}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Plan ID (Internal)</Label>
                                    <p className="text-sm font-mono">{selectedLog.plan_id || 'N/A'}</p>
                                  </div>
                                </div>

                                {selectedLog.error_message && (
                                  <div>
                                    <Label className="text-sm font-medium">Error Message</Label>
                                    <div className="bg-red-50 border border-red-200 rounded p-3 mt-1">
                                      <p className="text-sm text-red-700">{selectedLog.error_message}</p>
                                    </div>
                                  </div>
                                )}

                                {selectedLog.rollback_stats && (
                                  <div>
                                    <Label className="text-sm font-medium">Rollback Statistics</Label>
                                    <div className="bg-gray-50 border rounded p-3 mt-1">
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>• Inventory deleted: {selectedLog.rollback_stats.inventory_deleted || 0}</div>
                                        <div>• Wastage deleted: {selectedLog.rollback_stats.wastage_deleted || 0}</div>
                                        <div>• Wastage restored: {selectedLog.rollback_stats.wastage_restored || 0}</div>
                                        <div>• Orders restored: {selectedLog.rollback_stats.orders_restored || 0}</div>
                                        <div>• Order items restored: {selectedLog.rollback_stats.order_items_restored || 0}</div>
                                        <div>• Pending orders deleted: {selectedLog.rollback_stats.pending_orders_deleted || 0}</div>
                                        <div>• Pending orders restored: {selectedLog.rollback_stats.pending_orders_restored || 0}</div>
                                        <div>• Links deleted: {selectedLog.rollback_stats.links_deleted || 0}</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNumber = i + 1;
                const isCurrentPage = pageNumber === currentPage;

                return (
                  <Button
                    key={pageNumber}
                    variant={isCurrentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNumber)}
                    disabled={isCurrentPage}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="px-2 text-sm text-muted-foreground">...</span>
                  <Button
                    variant={currentPage === totalPages ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}