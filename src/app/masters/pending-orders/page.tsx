/**
 * Pending Order Items page - Manage pending order items
 */
"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Clock, 
  Search, 
  AlertTriangle,
  Calendar,
  DollarSign,
  Package,
  Settings,
  Target,
  FileDown
} from "lucide-react";

interface PendingOrderItem {
  id: string;
  original_order_id: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  quantity_pending: number;
  reason: string;
  status: "pending" | "in_production" | "resolved" | "cancelled";
  production_order_id?: string;
  created_at: string;
  resolved_at?: string;
  // Related data
  original_order?: {
    id: string;
    client?: {
      company_name: string;
    };
  };
  created_by?: {
    name: string;
  };
  frontend_id?: string; // Human-readable ID for display
}

interface SuggestionResult {
  status: string;
  target_width: number;
  wastage: number;
  roll_suggestions: Array<{
    suggestion_id: string;
    paper_specs: {
      gsm: number;
      bf: number;
      shade: string;
    };
    existing_width: number;
    needed_width: number;
    description: string;
  }>;
  summary: {
    total_pending_input: number;
    unique_widths: number;
    suggested_rolls: number;
  };
}

export default function PendingOrderItemsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingItems, setPendingItems] = useState<PendingOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Roll suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionResult, setSuggestionResult] = useState<SuggestionResult | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showWastageDialog, setShowWastageDialog] = useState(false);
  const [wastageInput, setWastageInput] = useState<string>("");

  // Fetch pending order items from API
  useEffect(() => {
    const fetchPendingItems = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Call backend API directly
        let response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}?status=pending`, createRequestOptions('GET'));
        if (!response.ok) {
          response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS.replace('pending-order-items', 'pending-orders')}?status=pending`, createRequestOptions('GET'));
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch pending order items: ${response.status}`);
        }
        
        const data = await response.json();
        setPendingItems(Array.isArray(data) ? data : []);
        
        console.log('Fetched pending order items:', {
          count: Array.isArray(data) ? data.length : 0,
          data: data,
          isArray: Array.isArray(data)
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        toast.error(errorMessage);
        console.error('Error fetching pending items:', err);
        
        // No fallback data - show empty state instead
        setPendingItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingItems();
  }, []);


  // Use real data only - no fallback to sample data
  const displayItems = pendingItems;

  const filteredItems = displayItems.filter(item =>
    item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.original_order?.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.shade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case "in_production":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Production</Badge>;
      case "resolved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Resolved</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case "no_suitable_jumbo":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">No Suitable Jumbo</Badge>;
      case "waste_too_high":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Waste Too High</Badge>;
      case "inventory_shortage":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Inventory Shortage</Badge>;
      default:
        return <Badge variant="secondary">{reason.replace(/_/g, ' ')}</Badge>;
    }
  };

  const getDaysWaiting = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  };

  const totalPendingQuantity = displayItems.reduce((sum, item) => sum + item.quantity_pending, 0);
  const highPriorityItems = displayItems.filter(item => {
    const daysWaiting = getDaysWaiting(item.created_at);
    return daysWaiting >= 3; // Consider items waiting 3+ days as high priority
  }).length;
  const averageWaitTime = displayItems.length > 0 ? Math.round(
    displayItems.reduce((sum, item) => sum + getDaysWaiting(item.created_at), 0) / displayItems.length
  ) : 0;


  // Roll suggestions functions
  const handleGetSuggestions = () => {
    setWastageInput("");
    setShowWastageDialog(true);
  };

  const handleWastageSubmit = async () => {
    const wastage = parseFloat(wastageInput);
    if (isNaN(wastage) || wastage < 0) {
      toast.error('Please enter a valid wastage value');
      return;
    }

    try {
      setSuggestionsLoading(true);
      setShowWastageDialog(false);
      
      const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/roll-suggestions`, 
        createRequestOptions('POST', { wastage })
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get suggestions: ${response.status}`);
      }
      
      const result = await response.json();
      setSuggestionResult(result);
      setShowSuggestions(true);
      const suggestionsCount = result.roll_suggestions?.length || 0;
      toast.success(`Generated ${suggestionsCount} roll suggestions for ${result.target_width}" rolls`);
    } catch (error) {
      toast.error('Failed to get roll suggestions');
      console.error('Suggestions error:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handlePrintPDF = () => {
    if (!suggestionResult) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 30;

    pdf.setFontSize(20);
    pdf.text('Roll Suggestions Report', margin, yPosition);
    
    yPosition += 15;
    pdf.setFontSize(12);
    pdf.text(`Target Width: ${suggestionResult.target_width}" (119" - ${suggestionResult.wastage}" wastage)`, margin, yPosition);
    
    yPosition += 10;
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, yPosition);
    
    yPosition += 20;
    pdf.setFontSize(16);
    pdf.text('Summary Statistics', margin, yPosition);
    
    yPosition += 15;
    pdf.setFontSize(12);
    pdf.text(`Target Width: ${suggestionResult.target_width}"`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Unique Widths: ${suggestionResult.summary.unique_widths}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Suggested Rolls: ${suggestionResult.summary.suggested_rolls}`, margin, yPosition);
    
    yPosition += 20;
    pdf.setFontSize(16);
    pdf.text('Roll Completion Suggestions', margin, yPosition);
    yPosition += 10;

    suggestionResult.roll_suggestions.forEach((suggestion, index) => {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 30;
      }
      
      yPosition += 15;
      pdf.setFontSize(14);
      pdf.text(`${index + 1}. ${suggestion.paper_specs.shade} ${suggestion.paper_specs.gsm}GSM Paper (BF: ${suggestion.paper_specs.bf})`, margin, yPosition);
      
      yPosition += 10;
      pdf.setFontSize(11);
      pdf.text(suggestion.description, margin, yPosition);
      
      yPosition += 10;
      pdf.text(`Available: ${suggestion.existing_width}" | Required: ${suggestion.needed_width}"`, margin, yPosition);
      
      const barWidth = pageWidth - (2 * margin);
      const barHeight = 12;
      const barY = yPosition + 5;
      
      const availablePercentage = (suggestion.existing_width / suggestionResult.target_width);
      const requiredPercentage = (suggestion.needed_width / suggestionResult.target_width);
      
      pdf.setFillColor(34, 197, 94);
      pdf.rect(margin, barY, barWidth * availablePercentage, barHeight, 'F');
      
      pdf.setFillColor(251, 146, 60);
      pdf.rect(margin + (barWidth * availablePercentage), barY, barWidth * requiredPercentage, barHeight, 'F');
      
      pdf.setDrawColor(0);
      pdf.rect(margin, barY, barWidth, barHeight);
      
      yPosition += 25;
    });

    pdf.save(`roll-suggestions-${suggestionResult.target_width}inch-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF downloaded successfully');
  };


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="w-8 h-8 text-primary" />
              Pending Order Items
            </h1>
            <p className="text-muted-foreground">
              Manage order items that couldn&apos;t be fulfilled immediately
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handleGetSuggestions}
              disabled={suggestionsLoading || displayItems.length === 0}
            >
              <Target className="w-4 h-4" />
              {suggestionsLoading ? 'Loading...' : 'Get Suggestions'}
            </Button>
            {suggestionResult && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={handlePrintPDF}
              >
                <FileDown className="w-4 h-4" />
                Print PDF
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Items</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayItems.length}</div>
              <p className="text-xs text-muted-foreground">
                Items awaiting fulfillment
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{highPriorityItems}</div>
              <p className="text-xs text-muted-foreground">
                Items waiting 3+ days
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageWaitTime} days</div>
              <p className="text-xs text-muted-foreground">
                Average processing delay
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPendingQuantity.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Rolls pending fulfillment
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Wastage Input Dialog */}
        <Dialog open={showWastageDialog} onOpenChange={setShowWastageDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Enter Wastage</DialogTitle>
              <DialogDescription>
                Enter the wastage amount to subtract from 119 inches for roll suggestions.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="wastage" className="text-right">
                  Wastage (inches)
                </Label>
                <Input
                  id="wastage"
                  type="number"
                  min="0"
                  max="50"
                  value={wastageInput}
                  onChange={(e) => setWastageInput(e.target.value)}
                  className="col-span-3"
                />
              </div>
              {wastageInput && !isNaN(parseFloat(wastageInput)) && (
                <div className="text-sm text-muted-foreground text-center">
                  Target width: {119 - parseFloat(wastageInput)}" (119 - {wastageInput})
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWastageDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleWastageSubmit}>
                Get Suggestions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Roll Suggestions Results */}
        {showSuggestions && suggestionResult && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Roll Suggestions
                </CardTitle>
                <CardDescription>
                  Suggestions for completing {suggestionResult.target_width}" rolls (119" - {suggestionResult.wastage}" wastage)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{suggestionResult.target_width}"</div>
                    <div className="text-sm text-blue-800">Target Width</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{suggestionResult.summary.unique_widths}</div>
                    <div className="text-sm text-green-800">Unique Widths</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{suggestionResult.summary.suggested_rolls}</div>
                    <div className="text-sm text-purple-800">Suggestions</div>
                  </div>
                </div>

                {/* Roll Suggestions */}
                {suggestionResult.roll_suggestions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Roll Completion Suggestions</h3>
                    <div className="space-y-3">
                      {suggestionResult.roll_suggestions.map((suggestion) => (
                        <Card key={suggestion.suggestion_id} className="bg-gray-50">
                          <CardContent className="pt-4">
                            <div className="space-y-4">
                              <div className="font-medium">
                                {suggestion.paper_specs.shade} {suggestion.paper_specs.gsm}GSM Paper (BF: {suggestion.paper_specs.bf})
                              </div>
                              <div className="text-sm font-medium">
                                {suggestion.description}
                              </div>
                              
                              {/* Visual Pattern for Available/Required */}
                              <div>
                                <div className="text-sm font-medium text-muted-foreground mb-2">
                                  {suggestionResult.target_width}" Roll Completion Pattern:
                                </div>
                                <div className="relative h-12 bg-muted rounded-lg border overflow-hidden">
                                  {(() => {
                                    const availableWidth = suggestion.existing_width;
                                    const requiredWidth = suggestion.needed_width;
                                    const targetWidth = suggestionResult.target_width;
                                    const availablePercentage = (availableWidth / targetWidth) * 100;
                                    const requiredPercentage = (requiredWidth / targetWidth) * 100;

                                    return (
                                      <>
                                        {/* Available section (green) */}
                                        <div
                                          className="absolute h-full border-r-2 border-white bg-gradient-to-r from-green-400 to-green-500"
                                          style={{
                                            left: "0%",
                                            width: `${availablePercentage}%`,
                                          }}>
                                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                            Available: {availableWidth}"
                                          </div>
                                        </div>

                                        {/* Required section (orange) */}
                                        <div
                                          className="absolute h-full bg-gradient-to-r from-orange-400 to-orange-500 border-l-2 border-white"
                                          style={{
                                            left: `${availablePercentage}%`,
                                            width: `${requiredPercentage}%`,
                                          }}>
                                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                            Required: {requiredWidth}"
                                          </div>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowSuggestions(false)}
                  >
                    Close Suggestions
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleGetSuggestions}
                  >
                    New Suggestions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Order Items Queue</CardTitle>
            <CardDescription>
              Review and process order items that couldn&apos;t be fulfilled immediately
              {loading && " (Loading...)"}
              {error && ` (Error: ${error} - showing sample data)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pending items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline">Priority Filter</Button>
              <Button variant="outline">Sort by Wait Time</Button>
            </div>

            {/* Pending Orders Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pending ID</TableHead>
                    <TableHead>Paper Specification</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Wait Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => {
                    const daysWaiting = getDaysWaiting(item.created_at);
                    return (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm font-medium">
                        {item.frontend_id || 'Generating...'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.width_inches}&quot; x {item.shade}</div>
                          <div className="text-sm text-muted-foreground">
                            GSM: {item.gsm}, BF: {item.bf}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.original_order?.client?.company_name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            Created by: {item.created_by?.name || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.quantity_pending} rolls</div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item.status)}
                      </TableCell>
                      <TableCell>
                        {getReasonBadge(item.reason)}
                      </TableCell>
                      <TableCell>
                        <Badge className={daysWaiting >= 5 ? "bg-red-100 text-red-800" : daysWaiting >= 3 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
                          {daysWaiting} days
                        </Badge>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No pending order items found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  All order items are currently being processed or completed.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}