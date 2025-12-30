'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  trackRollHierarchy,
  getWastageAllocationByReelNo,
  type HierarchyTrackingResponse,
  type JumboHierarchy,
  type SetHierarchy,
  type CutRollHierarchy,
  type WastageAllocationResponse,
  type ManualRollInfo
} from '@/lib/roll-tracking';
import {
  Search,
  Package,
  Layers,
  Scissors,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Barcode
} from 'lucide-react';

export default function BarcodeLookupPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString().slice(-2));
  const [isSearching, setIsSearching] = useState(false);
  const [hierarchyData, setHierarchyData] = useState<HierarchyTrackingResponse | null>(null);
  const [wastageData, setWastageData] = useState<WastageAllocationResponse | null>(null);
  const [searchType, setSearchType] = useState<'barcode' | 'reel_no' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  // Generate dynamic year options (current year ± 2 years)
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -2; i <= 2; i++) {
      const year = currentYear + i;
      years.push({
        value: year.toString().slice(-2),
        label: year.toString()
      });
    }
    return years;
  };

  const detectSearchType = (query: string): 'barcode' | 'reel_no' => {
    // If it starts with standard barcode prefixes, it's a barcode
    if (query.startsWith('JR_') || query.startsWith('SET_') || query.startsWith('CR_') ||
        query.startsWith('WCR_') || query.startsWith('SCR_')) {
      return 'barcode';
    }
    // Otherwise, treat it as a reel number
    return 'reel_no';
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setHierarchyData(null);
    setWastageData(null);
    setSearchType(null);

    const query = searchQuery.trim();
    const type = detectSearchType(query);
    setSearchType(type);

    try {
      if (type === 'reel_no') {
        // Search by reel number for wastage allocation
        const data = await getWastageAllocationByReelNo(query);
        setWastageData(data);
      } else {
        // Search by barcode for hierarchy
        // Append year suffix if not already present
        // const barcodeWithYear = query.includes('-') ? query : `${query}-${selectedYear}`;
        //for old backend compatibility
        const barcodeWithYear = query
        const data = await trackRollHierarchy(barcodeWithYear);
        setHierarchyData(data);
        // Expand all sets by default
        if (data.roll_type === 'jumbo') {
          const allSetIds = ((data.hierarchy as JumboHierarchy).intermediate_rolls || []).map(set => set.id);
          setExpandedSets(new Set(allSetIds));
        }
      }
    } catch (err: any) {
      if (type === 'reel_no') {
        setError(err.response?.data?.detail || 'Failed to find reel number. Please check and try again.');
      } else {
        setError(err.response?.data?.detail || 'Failed to find barcode. Please check and try again.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSetExpansion = (setId: string) => {
    const newExpanded = new Set(expandedSets);
    if (newExpanded.has(setId)) {
      newExpanded.delete(setId);
    } else {
      newExpanded.add(setId);
    }
    setExpandedSets(newExpanded);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return 'default';
      case 'allocated':
        return 'secondary';
      case 'dispatched':
        return 'outline';
      case 'consumed':
        return 'destructive';
      case 'cutting':
        return 'secondary';
      case 'used':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusDisplayText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'cutting':
        return 'Not in Stock (Planned)';
      case 'available':
        return 'In Stock';
      case 'used':
        return 'Dispatched';
      default:
        return status;
    }
  };

  const renderJumboHierarchy = (hierarchy: JumboHierarchy) => {
    const { jumbo_roll, intermediate_rolls, total_cut_rolls, total_sets } = hierarchy;

    return (
      <div className="space-y-6">
        {/* Jumbo Roll Card with Summary */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-blue-600" />
                <div>
                  <CardTitle className="text-xl">Jumbo Roll</CardTitle>
                  <CardDescription className="font-mono">{jumbo_roll.barcode_id}</CardDescription>
                </div>
              </div>
              <Badge variant={getStatusBadgeVariant(jumbo_roll.status)} className="text-sm px-3 py-1">{getStatusDisplayText(jumbo_roll.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Width</p>
                <p className="font-semibold">{jumbo_roll.width_inches}"</p>
              </div>
              <div>
                <p className="text-muted-foreground">Weight</p>
                <p className="font-semibold">{jumbo_roll.weight_kg} kg</p>
              </div>
              <div>
                <p className="text-muted-foreground">Location</p>
                <p className="font-semibold">{jumbo_roll.location || 'N/A'}</p>
              </div>
              {jumbo_roll.paper_specs && (
                <div>
                  <p className="text-muted-foreground">Paper</p>
                  <p className="font-semibold">{jumbo_roll.paper_specs.gsm}gsm, {jumbo_roll.paper_specs.bf}BF</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-bold text-lg">{total_sets}</p>
                  <p className="text-xs text-muted-foreground">SETs</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Scissors className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-bold text-lg">{total_cut_rolls}</p>
                  <p className="text-xs text-muted-foreground">Cuts</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SET Rolls and Cut Rolls */}
        <Card>
          <CardHeader>
            <CardTitle>Production Breakdown</CardTitle>
            <CardDescription>SET rolls and their cut rolls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {intermediate_rolls.map((setRoll, index) => {
                const isExpanded = expandedSets.has(setRoll.id);
                return (
                  <div key={setRoll.id} className="border rounded-lg">
                    {/* SET Header */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleSetExpansion(setRoll.id)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Layers className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="font-semibold text-sm">{setRoll.barcode_id}</p>
                          <p className="text-xs text-muted-foreground">
                            Set #{setRoll.individual_roll_number || index + 1} • {setRoll.cut_rolls_count} cuts
                          </p>
                        </div>
                      </div>
                      <Badge variant={getStatusBadgeVariant(setRoll.status)} className="text-sm px-3 py-1">{getStatusDisplayText(setRoll.status)}</Badge>
                    </div>

                    {/* Cut Rolls Table */}
                    {isExpanded && setRoll.cut_rolls.length > 0 && (
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Barcode</TableHead>
                              <TableHead className="text-xs">Width</TableHead>
                              <TableHead className="text-xs">Weight</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {setRoll.cut_rolls.map((cutRoll) => (
                              <TableRow key={cutRoll.id}>
                                <TableCell className="font-mono text-xs">{cutRoll.barcode_id}</TableCell>
                                <TableCell className="text-xs">{cutRoll.width_inches}"</TableCell>
                                <TableCell className="text-xs">{cutRoll.weight_kg} kg</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSetHierarchy = (hierarchy: SetHierarchy) => {
    const { parent_jumbo_roll, current_set_roll, cut_rolls_from_this_set, sibling_sets, total_cut_rolls } = hierarchy;

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        {parent_jumbo_roll && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle className="text-lg">Parent Jumbo Roll</CardTitle>
                  <CardDescription className="font-mono">{parent_jumbo_roll.barcode_id}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Width</p>
                  <p className="font-semibold">{parent_jumbo_roll.width_inches}"</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Weight</p>
                  <p className="font-semibold">{parent_jumbo_roll.weight_kg} kg</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={getStatusBadgeVariant(parent_jumbo_roll.status)} className="text-sm px-3 py-1">{getStatusDisplayText(parent_jumbo_roll.status)}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-semibold">{parent_jumbo_roll.location}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current SET Roll */}
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers className="h-6 w-6 text-purple-600" />
                <div>
                  <CardTitle className="text-xl">Current SET Roll (118")</CardTitle>
                  <CardDescription className="font-mono">{current_set_roll.barcode_id}</CardDescription>
                </div>
              </div>
              <Badge variant={getStatusBadgeVariant(current_set_roll.status)} className="text-sm px-3 py-1">{getStatusDisplayText(current_set_roll.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Set Number</p>
                <p className="font-semibold">Set #{current_set_roll.individual_roll_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cut Rolls</p>
                <p className="font-semibold">{total_cut_rolls}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Width</p>
                <p className="font-semibold">{current_set_roll.width_inches}"</p>
              </div>
              <div>
                <p className="text-muted-foreground">Weight</p>
                <p className="font-semibold">{current_set_roll.weight_kg} kg</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sibling SETs */}
        {sibling_sets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sibling SET Rolls</CardTitle>
              <CardDescription>Other SETs from the same jumbo roll</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {sibling_sets.map((sibling) => (
                  <div key={sibling.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-mono text-sm">{sibling.barcode_id}</p>
                      <p className="text-xs text-muted-foreground">Set #{sibling.individual_roll_number}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(sibling.status)} className="text-sm px-3 py-1">
                      {getStatusDisplayText(sibling.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cut Rolls from this SET */}
        <Card>
          <CardHeader>
            <CardTitle>Cut Rolls from this SET</CardTitle>
            <CardDescription>{total_cut_rolls} cut rolls</CardDescription>
          </CardHeader>
          <CardContent>
            {cut_rolls_from_this_set.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Width</TableHead>
                    <TableHead>Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cut_rolls_from_this_set.map((cutRoll) => (
                    <TableRow key={cutRoll.id}>
                      <TableCell className="font-mono text-xs">{cutRoll.barcode_id}</TableCell>
                      <TableCell>{cutRoll.width_inches}"</TableCell>
                      <TableCell>{cutRoll.weight_kg} kg</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No cut rolls found</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderWastageAllocation = (data: WastageAllocationResponse) => {
    return (
      <div className="space-y-6">
        {/* Wastage Allocation Card */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-orange-600" />
                <div>
                  <CardTitle className="text-xl">Stock Allocation</CardTitle>
                  <CardDescription className="font-mono">{data.barcode_id || data.frontend_id}</CardDescription>
                </div>
              </div>
              <Badge variant={getStatusBadgeVariant(data.status)} className="text-sm px-3 py-1">
                {getStatusDisplayText(data.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Width</p>
                <p className="font-semibold">{data.width_inches}"</p>
              </div>
              <div>
                <p className="text-muted-foreground">Weight</p>
                <p className="font-semibold">{data.weight_kg} kg</p>
              </div>
              <div>
                <p className="text-muted-foreground">Roll Type</p>
                <p className="font-semibold">{data.roll_type.toUpperCase()}</p>
              </div>
             
            </div>
            
          </CardContent>
        </Card>

        {/* Allocation Details - Combined Card */}
        <Card>
          <CardHeader>
            <CardTitle>Allocation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Paper Specifications Section */}
            {data.paper && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Paper Specifications</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-semibold">{data.paper.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GSM</p>
                    <p className="font-semibold">{data.paper.gsm}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">BF</p>
                    <p className="font-semibold">{data.paper.bf}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Shade</p>
                    <p className="font-semibold">{data.paper.shade}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Order Information Section */}
            {data.order_info && data.order_info.order_frontend_id && (
              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Order Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Order ID</p>
                    <p className="font-semibold font-mono">{data.order_info.order_frontend_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Client Name</p>
                    <p className="font-semibold">{data.order_info.client_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stock Roll</p>
                    <Badge variant={data.is_wastage_roll ? 'default' : 'outline'}>
                      {data.is_wastage_roll ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Plan Information Section */}
            {data.plan_info && data.plan_info.plan_frontend_id && (
              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Source Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Plan ID</p>
                    <p className="font-semibold font-mono">{data.plan_info.plan_frontend_id}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Information */}
        {/* <Card>
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Frontend ID</p>
                <p className="font-semibold font-mono">{data.frontend_id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Production Date</p>
                <p className="font-semibold">{new Date(data.production_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created At</p>
                <p className="font-semibold">{new Date(data.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card> */}
      </div>
    );
  };

  const renderCutRollHierarchy = (hierarchy: CutRollHierarchy) => {
    const { parent_jumbo_roll, parent_set_roll, current_cut_roll, sibling_cut_rolls, all_sets_from_jumbo } = hierarchy;

    return (
      <div className="space-y-6">
        {/* Breadcrumb Trail */}
        {parent_jumbo_roll && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle className="text-lg">Parent Jumbo Roll</CardTitle>
                  <CardDescription className="font-mono">{parent_jumbo_roll.barcode_id}</CardDescription>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                {parent_set_roll && (
                  <>
                    <Layers className="h-5 w-5 text-purple-600" />
                    <div>
                      <CardTitle className="text-lg">Parent SET</CardTitle>
                      <CardDescription className="font-mono">{parent_set_roll.barcode_id}</CardDescription>
                    </div>
                  </>
                )}
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Current Cut Roll */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Scissors className="h-6 w-6 text-green-600" />
                <div>
                  <CardTitle className="text-xl">Current Cut Roll</CardTitle>
                  <CardDescription className="font-mono">{current_cut_roll.barcode_id}</CardDescription>
                </div>
              </div>
              <Badge variant={getStatusBadgeVariant(current_cut_roll.status)} className="text-sm px-3 py-1">{getStatusDisplayText(current_cut_roll.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Width</p>
                <p className="font-semibold">{current_cut_roll.width_inches}"</p>
              </div>
              <div>
                <p className="text-muted-foreground">Weight</p>
                <p className="font-semibold">{current_cut_roll.weight_kg} kg</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-semibold">{getStatusDisplayText(current_cut_roll.status)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Wastage Roll</p>
                <p className="font-semibold">{current_cut_roll.is_wastage_roll ? 'Yes' : 'No'}</p>
              </div>
            </div>
            {current_cut_roll.paper_specs && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Paper Specifications</p>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">GSM</p>
                    <p className="font-semibold">{current_cut_roll.paper_specs.gsm}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">BF</p>
                    <p className="font-semibold">{current_cut_roll.paper_specs.bf}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Shade</p>
                    <p className="font-semibold">{current_cut_roll.paper_specs.shade}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-semibold">{current_cut_roll.paper_specs.name}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sibling Cut Rolls */}
        {sibling_cut_rolls.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sibling Cut Rolls</CardTitle>
              <CardDescription>Other cut rolls from the same SET</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Width</TableHead>
                    <TableHead>Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sibling_cut_rolls.map((sibling) => (
                    <TableRow key={sibling.id}>
                      <TableCell className="font-mono text-xs">{sibling.barcode_id}</TableCell>
                      <TableCell>{sibling.width_inches}"</TableCell>
                      <TableCell>{sibling.weight_kg} kg</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* All SETs from Jumbo */}
        {all_sets_from_jumbo.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>All SET Rolls from Parent Jumbo</CardTitle>
              <CardDescription>{all_sets_from_jumbo.length} SETs total</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {all_sets_from_jumbo.map((setRoll) => (
                  <div
                    key={setRoll.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      setRoll.is_current_parent ? 'border-purple-500 bg-purple-50' : ''
                    }`}
                  >
                    <div>
                      <p className="font-mono text-sm">{setRoll.barcode_id}</p>
                      <p className="text-xs text-muted-foreground">
                        Set #{setRoll.individual_roll_number} • {setRoll.cut_rolls_count} cuts
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={getStatusBadgeVariant(setRoll.status)} className="text-sm px-3 py-1">
                        {getStatusDisplayText(setRoll.status)}
                      </Badge>
                      {setRoll.is_current_parent && (
                        <Badge variant="outline" className="text-xs">Current</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderManualCutRoll = (rollInfo: ManualRollInfo) => {
    return (
      <div className="space-y-6">
        {/* Manual Cut Roll Card */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Scissors className="h-6 w-6 text-orange-600" />
                <div>
                  <CardTitle className="text-xl">Manual Cut Roll</CardTitle>
                  <CardDescription className="font-mono">{rollInfo.barcode_id}</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-sm px-3 py-1 bg-orange-100 border-orange-400">
                  Manual Entry
                </Badge>
                <Badge variant={getStatusBadgeVariant(rollInfo.status)} className="text-sm px-3 py-1">
                  {getStatusDisplayText(rollInfo.status)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">            
              <div>
                <p className="text-muted-foreground">Reel Number</p>
                <p className="font-semibold">{rollInfo.reel_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Width</p>
                <p className="font-semibold">{rollInfo.width_inches}"</p>
              </div>
              <div>
                <p className="text-muted-foreground">Weight</p>
                <p className="font-semibold">{rollInfo.weight_kg} kg</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-4">
              <div>
                <p className="text-muted-foreground">Location</p>
                <p className="font-semibold">{rollInfo.location || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created At</p>
                <p className="font-semibold">{new Date(rollInfo.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Information */}
        {rollInfo.client && (
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Company Name</p>
                  <p className="font-semibold">{rollInfo.client.company_name}</p>
                </div>
                {rollInfo.client.contact_person && (
                  <div>
                    <p className="text-muted-foreground">Contact Person</p>
                    <p className="font-semibold">{rollInfo.client.contact_person}</p>
                  </div>
                )}
                {rollInfo.client.phone && (
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-semibold">{rollInfo.client.phone}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Paper Specifications */}
        {rollInfo.paper && (
          <Card>
            <CardHeader>
              <CardTitle>Paper Specifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-semibold">{rollInfo.paper.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">GSM</p>
                  <p className="font-semibold">{rollInfo.paper.gsm}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">BF</p>
                  <p className="font-semibold">{rollInfo.paper.bf}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Shade</p>
                  <p className="font-semibold">{rollInfo.paper.shade}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-semibold">{rollInfo.paper.type}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Barcode Lookup</h1>
          <p className="text-muted-foreground mt-1">
            Track production hierarchy by entering any barcode (Jumbo, SET, Cut Roll, or Manual Roll)
          </p>
        </div>
      </div>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>Enter Barcode or Reel Number</CardTitle>
          <CardDescription>Search for barcodes (JR_, SET_, CR_) or reel numbers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter barcode (JR_00001, SET_00040, CR_12345) or reel number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="appearance-none px-4 py-2 pr-10 border border-gray-300 rounded-md bg-white font-semibold text-blue-600 cursor-pointer hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[100px] h-10"
                >
                  {getYearOptions().map(year => (
                    <option key={year.value} value={year.value}>{year.label}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? (
                  <>Searching...</>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {searchType && !error && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                Search Type: <span className="font-semibold">{searchType === 'reel_no' ? 'Reel Number' : 'Barcode'}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {wastageData && (
        <div className="space-y-6">
          {renderWastageAllocation(wastageData)}
        </div>
      )}

      {hierarchyData && (
        <div className="space-y-6">
          {/* Render hierarchy based on roll type */}
          {hierarchyData.roll_type === 'manual_cut' && hierarchyData.manual_roll_info && renderManualCutRoll(hierarchyData.manual_roll_info)}
          {hierarchyData.roll_type === 'jumbo' && renderJumboHierarchy(hierarchyData.hierarchy as JumboHierarchy)}
          {hierarchyData.roll_type === '118' && renderSetHierarchy(hierarchyData.hierarchy as SetHierarchy)}
          {hierarchyData.roll_type === 'cut' && renderCutRollHierarchy(hierarchyData.hierarchy as CutRollHierarchy)}
        </div>
      )}
    </div>
  );
}
