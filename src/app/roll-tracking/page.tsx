'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  trackRoll,
  searchRolls,
  searchRollsBySpecifications,
  type RollTrackingResponse,
  type SearchResult,
  type SpecificationSearchResult,
  type SpecificationSearchResponse,
  type MatchingOrder,
  type PendingOrderResult
} from '@/lib/roll-tracking';
import { PaperSpecSelector, type PaperSpecification } from '@/components/paper-spec-selector';
import {
  Search,
  Package,
  Truck,
  Factory,
  Scale,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  FileText,
  Settings,
  Ruler,
  ShoppingCart,
  Calendar,
  DollarSign
} from 'lucide-react';

export default function RollTrackingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [trackingData, setTrackingData] = useState<RollTrackingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<(SearchResult | SpecificationSearchResult)[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [specSearchResults, setSpecSearchResults] = useState<SpecificationSearchResponse | null>(null);

  // Specification search state
  const [searchMode, setSearchMode] = useState<'barcode' | 'specs'>('barcode');
  const [selectedPaperSpec, setSelectedPaperSpec] = useState<PaperSpecification | null>(null);
  const [specForm, setSpecForm] = useState({
    widthInches: '',
    gsm: '',
    bf: '',
    shade: '',
    tolerance: '0.1'
  });

  const handleSearch = async () => {
    if (searchMode === 'barcode') {
      if (!searchQuery.trim()) return;

      setIsSearching(true);
      setError(null);
      setTrackingData(null);

      try {
        const data = await trackRoll(searchQuery.trim());
        setTrackingData(data);
        setShowSearchResults(false);
      } catch (err: any) {
        if (err.response?.status === 404) {
          // If exact match not found, try search
          try {
            const searchResponse = await searchRolls(searchQuery.trim(), 'all', 10);
            setSearchResults(searchResponse.results);
            setShowSearchResults(true);
            setError('Roll not found. Here are similar results:');
          } catch (searchErr) {
            setError('Roll not found and search failed. Please check the barcode/QR code.');
          }
        } else {
          setError(err.response?.data?.detail || 'Failed to track roll. Please try again.');
        }
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleSpecSearch = async () => {
    // Validate form
    if (!specForm.widthInches || !specForm.gsm || !specForm.bf || !specForm.shade) {
      setError('Please fill in all specification fields');
      return;
    }

    setIsSearching(true);
    setError(null);
    setTrackingData(null);
    setShowSearchResults(false);

    try {
      const results = await searchRollsBySpecifications(
        parseFloat(specForm.widthInches),
        parseInt(specForm.gsm),
        parseFloat(specForm.bf),
        specForm.shade,
        parseFloat(specForm.tolerance),
        20
      );

      setSpecSearchResults(results);
      setShowSearchResults(true);
      setError(results.message);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to search rolls by specifications. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePaperSpecChange = (spec: PaperSpecification | null) => {
    setSelectedPaperSpec(spec);

    if (spec) {
      // Auto-fill the form with selected paper specifications
      setSpecForm(prev => ({
        ...prev,
        gsm: spec.gsm.toString(),
        bf: spec.bf.toString(),
        shade: spec.shade
      }));
    } else {
      // Clear the paper spec fields
      setSpecForm(prev => ({
        ...prev,
        gsm: '',
        bf: '',
        shade: ''
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (searchMode === 'barcode') {
        handleSearch();
      } else {
        handleSpecSearch();
      }
    }
  };

  const handleSpecFormChange = (field: string, value: string) => {
    setSpecForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResultClick = (result: SearchResult | SpecificationSearchResult) => {
    const identifier = result.barcode_id || result.qr_code || result.frontend_id;
    if (identifier) {
      setSearchQuery(identifier);
      setSearchMode('barcode');
      handleSearch();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'dispatched':
        return 'bg-blue-100 text-blue-800';
      case 'in_dispatch':
        return 'bg-yellow-100 text-yellow-800';
      case 'allocated':
        return 'bg-purple-100 text-purple-800';
      case 'cutting':
        return 'bg-orange-100 text-orange-800';
      case 'used':
        return 'bg-gray-100 text-gray-800';
      case 'damaged':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'dispatched':
        return <Truck className="h-4 w-4" />;
      case 'in_process':
        return <Factory className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roll Tracking</h1>
          <p className="text-muted-foreground">
            Track complete lifecycle of any roll by barcode, QR code, or roll number
          </p>
        </div>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Track Roll
          </CardTitle>
          <CardDescription>
            Search by barcode/QR code or roll specifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={searchMode === 'barcode' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchMode('barcode')}
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Barcode/QR Search
            </Button>
            <Button
              variant={searchMode === 'specs' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchMode('specs')}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Specification Search
            </Button>
          </div>

          {/* Barcode Search */}
          {searchMode === 'barcode' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter barcode, QR code, or roll number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                  {isSearching ? 'Searching...' : 'Track'}
                </Button>
              </div>
            </div>
          )}

          {/* Specification Search */}
          {searchMode === 'specs' && (
            <div className="space-y-4">
              {/* Paper Specification Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Paper Specification (Optional)
                </label>
                <PaperSpecSelector
                  value={selectedPaperSpec?.id || ''}
                  onValueChange={handlePaperSpecChange}
                  placeholder="Select paper specification to auto-fill details..."
                />
              </div>

              {/* Divider */}
              {selectedPaperSpec && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or manually enter specifications
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Width (inches)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="30.0"
                    value={specForm.widthInches}
                    onChange={(e) => handleSpecFormChange('widthInches', e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    GSM
                  </label>
                  <Input
                    type="number"
                    placeholder="120"
                    value={specForm.gsm}
                    onChange={(e) => handleSpecFormChange('gsm', e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!!selectedPaperSpec}
                  />
                  {selectedPaperSpec && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-filled from paper specification
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Burst Factor
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="18.0"
                    value={specForm.bf}
                    onChange={(e) => handleSpecFormChange('bf', e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!!selectedPaperSpec}
                  />
                  {selectedPaperSpec && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-filled from paper specification
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Shade/Color
                  </label>
                  <Input
                    placeholder="Natural"
                    value={specForm.shade}
                    onChange={(e) => handleSpecFormChange('shade', e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!!selectedPaperSpec}
                  />
                  {selectedPaperSpec && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-filled from paper specification
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Tolerance (±inches)
                  </label>
                  <Input
                    type="number"
                    step="0.05"
                    placeholder="0.1"
                    value={specForm.tolerance}
                    onChange={(e) => handleSpecFormChange('tolerance', e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              </div>

              {/* Search Summary */}
              {(selectedPaperSpec || specForm.gsm || specForm.bf || specForm.shade) && (
                <div className="p-3 bg-muted/30 rounded-md">
                  <div className="text-sm font-medium mb-1">Search Summary:</div>
                  <div className="text-xs text-muted-foreground">
                    {specForm.widthInches && <span>Width: {specForm.widthInches}" (±{specForm.tolerance || '0.1'})</span>}
                    {(specForm.gsm || selectedPaperSpec) && <span> • GSM: {specForm.gsm || selectedPaperSpec?.gsm}</span>}
                    {(specForm.bf || selectedPaperSpec) && <span> • BF: {specForm.bf || selectedPaperSpec?.bf}</span>}
                    {(specForm.shade || selectedPaperSpec) && <span> • Shade: {specForm.shade || selectedPaperSpec?.shade}</span>}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleSpecSearch}
                  disabled={isSearching || !specForm.widthInches || !specForm.gsm || !specForm.bf || !specForm.shade}
                >
                  {isSearching ? 'Searching...' : 'Search by Specifications'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant={showSearchResults ? "default" : "destructive"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Enhanced Search Results */}
      {showSearchResults && specSearchResults && (
        <div className="space-y-4">
          {/* Inventory Results */}
          {specSearchResults.inventory_total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Available Inventory Rolls ({specSearchResults.inventory_total})
                </CardTitle>
                <CardDescription>
                  Click on any roll to view complete details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {specSearchResults.inventory_results.map((result) => (
                    <div
                      key={result.inventory_id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">
                            {result.barcode_id || result.frontend_id}
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {Math.round(result.match_score * 100)}% match
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {result.width_inches}" • {result.weight_kg}kg • {result.paper_name}
                            {result.width_difference > 0 && (
                              <span className="ml-2">
                                (±{result.width_difference}" diff)
                              </span>
                            )}
                          </div>
                          {result.paper_specifications && (
                            <div className="text-xs text-muted-foreground mt-1">
                              GSM: {result.paper_specifications.gsm} •
                              BF: {result.paper_specifications.bf} •
                              Shade: {result.paper_specifications.shade}
                            </div>
                          )}
                          {/* Order and Plan Information */}
                          {(result.order_info || result.plan_info) && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                              {result.order_info && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  Order: {result.order_info.order_frontend_id}
                                </span>
                              )}
                              {result.plan_info && (
                                <span className="flex items-center gap-1">
                                  <Settings className="h-3 w-3" />
                                  Plan: {result.plan_info.plan_frontend_id}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(result.status)}>
                          {result.status}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          <Ruler className="h-3 w-3 inline mr-1" />
                          {result.width_inches}"
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Matching Orders */}
          {specSearchResults.matching_orders_total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Matching Order Items ({specSearchResults.matching_orders_total})
                </CardTitle>
                <CardDescription>
                  Orders that require rolls with these specifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {specSearchResults.matching_orders.map((order) => (
                    <div key={order.order_item_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{order.order_frontend_id}</span>
                          <Badge variant="outline">{order.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <User className="h-3 w-3 inline mr-1" />
                          {order.client_name}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Width:</span>
                          <span className="ml-1 font-medium">{order.width_inches}"</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Quantity:</span>
                          <span className="ml-1 font-medium">{order.quantity_rolls} rolls</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fulfilled:</span>
                          <span className="ml-1 font-medium">{order.quantity_fulfilled}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Remaining:</span>
                          <span className="ml-1 font-medium">{order.remaining_quantity}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-sm">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ₹{order.rate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'No date'}
                          </span>
                        </div>
                        <Badge variant={order.item_status === 'completed' ? 'default' : 'secondary'}>
                          {order.item_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Orders */}
          {specSearchResults.pending_orders_total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Pending Order Items ({specSearchResults.pending_orders_total})
                </CardTitle>
                <CardDescription>
                  Pending orders that require rolls with these specifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {specSearchResults.pending_orders.map((pending) => (
                    <div key={pending.pending_order_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{pending.pending_order_frontend_id}</span>
                          <Badge variant="outline">{pending.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <User className="h-3 w-3 inline mr-1" />
                          {pending.client_name}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Width:</span>
                          <span className="ml-1 font-medium">{pending.width_inches}"</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pending:</span>
                          <span className="ml-1 font-medium">{pending.quantity_pending} rolls</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fulfilled:</span>
                          <span className="ml-1 font-medium">{pending.quantity_fulfilled}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Reason:</span>
                        <span className="ml-1">{pending.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legacy Search Results (for barcode search fallback) */}
          {!specSearchResults && searchResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>
                  Click on any result to view details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.inventory_id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">
                            {result.barcode_id || result.frontend_id}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {result.width_inches}" • {result.weight_kg}kg • {result.paper_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(result.status)}>
                          {result.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tracking Results */}
      {trackingData && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="order">Order</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Basic Roll Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Roll Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Barcode/QR:</span>
                    <span className="font-medium">{trackingData.roll_info.barcode_id || trackingData.roll_info.qr_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Frontend ID:</span>
                    <span className="font-medium">{trackingData.roll_info.frontend_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Width:</span>
                    <span className="font-medium">{trackingData.roll_info.width_inches}"</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Weight:</span>
                    <span className="font-medium">{trackingData.roll_info.weight_kg} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Type:</span>
                    <span className="font-medium">{trackingData.roll_info.roll_type}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge className={getStatusColor(trackingData.roll_info.status)}>
                      {getStatusIcon(trackingData.roll_info.status)}
                      {trackingData.roll_info.status}
                    </Badge>
                  </div>
                  {trackingData.roll_info.location && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Location:</span>
                      <span className="font-medium">{trackingData.roll_info.location}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Created:</span>
                    <span className="font-medium">{formatDateTime(trackingData.roll_info.created_at)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Paper Specifications */}
              {trackingData.roll_info.paper_specifications && (
                <Card>
                  <CardHeader>
                    <CardTitle>Paper Specifications</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Paper Name:</span>
                      <span className="font-medium">{trackingData.roll_info.paper_specifications.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">GSM:</span>
                      <span className="font-medium">{trackingData.roll_info.paper_specifications.gsm} g/m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">BF:</span>
                      <span className="font-medium">{trackingData.roll_info.paper_specifications.bf}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Shade:</span>
                      <span className="font-medium">{trackingData.roll_info.paper_specifications.shade}</span>
                    </div>
                    {trackingData.roll_info.paper_specifications.type && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Type:</span>
                        <span className="font-medium">{trackingData.roll_info.paper_specifications.type}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Weight Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5" />
                    Weight Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Current Weight:</span>
                    <span className="font-medium">{trackingData.weight_info.current_weight_kg} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={trackingData.weight_info.has_weight ? "default" : "secondary"}>
                      {trackingData.weight_info.weight_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Measured:</span>
                    <span className="font-medium">
                      {trackingData.weight_info.has_weight ? 'Yes' : 'No'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Related Rolls */}
              {trackingData.related_rolls.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Related Rolls</CardTitle>
                    <CardDescription>
                      Other rolls from the same parent
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {trackingData.related_rolls.map((relatedRoll) => (
                        <div
                          key={relatedRoll.inventory_id}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{relatedRoll.barcode_id}</span>
                            <span className="text-sm text-muted-foreground">
                              {relatedRoll.width_inches}" • {relatedRoll.weight_kg}kg
                            </span>
                          </div>
                          <Badge className={getStatusColor(relatedRoll.status)}>
                            {relatedRoll.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Order Tab */}
          <TabsContent value="order">
            {trackingData.order_info ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Order Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Order ID:</span>
                      <span className="font-medium">{trackingData.order_info.order_frontend_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge className={getStatusColor(trackingData.order_info.status)}>
                        {getStatusIcon(trackingData.order_info.status)}
                        {trackingData.order_info.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Priority:</span>
                      <span className="font-medium">{trackingData.order_info.priority}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Payment Type:</span>
                      <span className="font-medium">{trackingData.order_info.payment_type}</span>
                    </div>
                    {trackingData.order_info.delivery_date && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Delivery Date:</span>
                        <span className="font-medium">{formatDateTime(trackingData.order_info.delivery_date)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Created:</span>
                      <span className="font-medium">{formatDateTime(trackingData.order_info.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Client Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {trackingData.order_info.client ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Client Name:</span>
                          <span className="font-medium">{trackingData.order_info.client.client_name}</span>
                        </div>
                        {trackingData.order_info.client.contact_person && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Contact Person:</span>
                            <span className="font-medium">{trackingData.order_info.client.contact_person}</span>
                          </div>
                        )}
                        {trackingData.order_info.client.phone && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Phone:</span>
                            <span className="font-medium">{trackingData.order_info.client.phone}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">No client information available</p>
                    )}
                  </CardContent>
                </Card>

                {trackingData.order_info.order_item && (
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Order Item Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <span className="text-sm text-muted-foreground">Quantity Rolls</span>
                          <p className="font-medium">{trackingData.order_info.order_item.quantity_rolls}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Fulfilled</span>
                          <p className="font-medium">{trackingData.order_info.order_item.quantity_fulfilled}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Weight</span>
                          <p className="font-medium">{trackingData.order_info.order_item.quantity_kg} kg</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Rate</span>
                          <p className="font-medium">₹{trackingData.order_info.order_item.rate}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Item Status</span>
                          <Badge className={getStatusColor(trackingData.order_info.order_item.item_status)}>
                            {trackingData.order_info.order_item.item_status}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Remaining</span>
                          <p className="font-medium">{trackingData.order_info.order_item.remaining_quantity}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Fully Fulfilled</span>
                          <p className="font-medium">
                            {trackingData.order_info.order_item.is_fully_fulfilled ? 'Yes' : 'No'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">No order information available for this roll</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Production Tab */}
          <TabsContent value="production">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Factory className="h-5 w-5" />
                    Production Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Created By:</span>
                    <span className="font-medium">{trackingData.production_info.created_by || 'Unknown'}</span>
                  </div>
                  {trackingData.production_info.created_by_role && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Role:</span>
                      <span className="font-medium">{trackingData.production_info.created_by_role}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Created At:</span>
                    <span className="font-medium">{formatDateTime(trackingData.production_info.created_at)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Jumbo Roll Hierarchy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {trackingData.production_info.jumbo_hierarchy.parent_jumbo_id && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Parent Jumbo:</span>
                        <span className="font-medium">
                          {trackingData.production_info.jumbo_hierarchy.parent_jumbo_frontend_id}
                        </span>
                      </div>
                    </>
                  )}
                  {trackingData.production_info.jumbo_hierarchy.parent_118_roll_id && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Parent 118" Roll:</span>
                      <span className="font-medium">
                        {trackingData.production_info.jumbo_hierarchy.parent_118_roll_frontend_id}
                      </span>
                    </div>
                  )}
                  {trackingData.production_info.jumbo_hierarchy.roll_sequence && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Roll Sequence:</span>
                      <span className="font-medium">
                        #{trackingData.production_info.jumbo_hierarchy.roll_sequence}
                      </span>
                    </div>
                  )}
                  {trackingData.production_info.jumbo_hierarchy.individual_roll_number && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Individual Roll Number:</span>
                      <span className="font-medium">
                        {trackingData.production_info.jumbo_hierarchy.individual_roll_number}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Plan Tab */}
          <TabsContent value="plan">
            {trackingData.plan_info ? (
              <Card>
                <CardHeader>
                  <CardTitle>Plan Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Plan ID:</span>
                      <p className="font-medium">{trackingData.plan_info.plan_frontend_id}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Plan Name:</span>
                      <p className="font-medium">{trackingData.plan_info.name || 'Unnamed Plan'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge className={getStatusColor(trackingData.plan_info.status)}>
                        {trackingData.plan_info.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Created By:</span>
                      <p className="font-medium">{trackingData.plan_info.created_by || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Expected Waste:</span>
                      <p className="font-medium">{trackingData.plan_info.expected_waste_percentage}%</p>
                    </div>
                    {trackingData.plan_info.actual_waste_percentage && (
                      <div>
                        <span className="text-sm text-muted-foreground">Actual Waste:</span>
                        <p className="font-medium">{trackingData.plan_info.actual_waste_percentage}%</p>
                      </div>
                    )}
                    <div>
                      <span className="text-sm text-muted-foreground">Created At:</span>
                      <p className="font-medium">{formatDateTime(trackingData.plan_info.created_at)}</p>
                    </div>
                    {trackingData.plan_info.executed_at && (
                      <div>
                        <span className="text-sm text-muted-foreground">Executed At:</span>
                        <p className="font-medium">{formatDateTime(trackingData.plan_info.executed_at)}</p>
                      </div>
                    )}
                    {trackingData.plan_info.completed_at && (
                      <div>
                        <span className="text-sm text-muted-foreground">Completed At:</span>
                        <p className="font-medium">{formatDateTime(trackingData.plan_info.completed_at)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">No plan information available for this roll</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Dispatch Tab */}
          <TabsContent value="dispatch">
            {trackingData.dispatch_info ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Dispatch Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Dispatch Number:</span>
                      <p className="font-medium">{trackingData.dispatch_info.dispatch_number}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Reference Number:</span>
                      <p className="font-medium">{trackingData.dispatch_info.reference_number || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Vehicle Number:</span>
                      <p className="font-medium">{trackingData.dispatch_info.vehicle_number}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Driver Name:</span>
                      <p className="font-medium">{trackingData.dispatch_info.driver_name}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Driver Mobile:</span>
                      <p className="font-medium">{trackingData.dispatch_info.driver_mobile}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge className={getStatusColor(trackingData.dispatch_info.status)}>
                        {trackingData.dispatch_info.status}
                      </Badge>
                    </div>
                    {trackingData.dispatch_info.client && (
                      <div>
                        <span className="text-sm text-muted-foreground">Client:</span>
                        <p className="font-medium">{trackingData.dispatch_info.client.client_name}</p>
                      </div>
                    )}
                    {trackingData.dispatch_info.dispatch_date && (
                      <div>
                        <span className="text-sm text-muted-foreground">Dispatch Date:</span>
                        <p className="font-medium">{formatDateTime(trackingData.dispatch_info.dispatch_date)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">This roll has not been dispatched yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Status Timeline
                </CardTitle>
                <CardDescription>
                  Complete journey of this roll through the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto">
                  <div className="space-y-4">
                    {trackingData.status_timeline.map((event, index) => (
                      <div key={index} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            event.type === 'production' ? 'bg-blue-100' :
                            event.type === 'quality' ? 'bg-green-100' :
                            event.type === 'dispatch' ? 'bg-purple-100' :
                            'bg-gray-100'
                          }`}>
                            {getStatusIcon(event.event)}
                          </div>
                          {index < trackingData.status_timeline.length - 1 && (
                            <div className="w-0.5 h-16 bg-border mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-8">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{event.event}</h4>
                            <span className="text-sm text-muted-foreground">
                              {formatDateTime(event.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}