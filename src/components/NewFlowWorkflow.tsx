/**
 * NEW FLOW: 3-input/4-output Workflow Component
 * Dynamic interface for the new optimization workflow
 */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Package, 
  Scissors, 
  Archive,
  TrendingUp,
  Clock,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

import {
  processMultipleOrders,
  generateCuttingPlan,
  validateCuttingPlan,
  getCuttingAlgorithms,
  getWorkflowStatus,
  getOrdersWithRelationships,
  convertOrdersToRequirements,
  groupCutRollsBySpec,
  calculateEfficiencyMetrics,
  formatPaperSpec,
  getStatusBadgeVariant,
  OptimizationResult,
  WorkflowProcessRequest,
  CuttingPlanRequest,
  OrderRequirement,
  PendingOrder,
  AvailableInventory,
  CutRoll
} from '@/lib/new-flow';

interface WorkflowStepProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  isActive: boolean;
  isCompleted: boolean;
  onClick: () => void;
}

function WorkflowStep({ title, description, icon, isActive, isCompleted, onClick }: WorkflowStepProps) {
  return (
    <div 
      className={`p-4 border rounded-lg cursor-pointer transition-all ${
        isActive ? 'border-primary bg-primary/5' : 
        isCompleted ? 'border-green-500 bg-green-50' : 
        'border-border hover:border-primary/50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${
          isActive ? 'bg-primary text-primary-foreground' :
          isCompleted ? 'bg-green-500 text-white' :
          'bg-muted text-muted-foreground'
        }`}>
          {isCompleted ? <CheckCircle className="h-4 w-4" /> : icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

interface OptimizationSummaryProps {
  result: OptimizationResult;
}

function OptimizationSummary({ result }: OptimizationSummaryProps) {
  const efficiency = calculateEfficiencyMetrics(result.cut_rolls_generated);
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl text-primary">{result.summary.total_cut_rolls}</CardTitle>
          <CardDescription>Cut Rolls Generated</CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl text-blue-600">{result.jumbo_rolls_needed}</CardTitle>
          <CardDescription>Jumbo Rolls Needed</CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl text-green-600">{efficiency.averageEfficiency.toFixed(1)}%</CardTitle>
          <CardDescription>Material Efficiency</CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl text-orange-600">{result.summary.total_pending_orders}</CardTitle>
          <CardDescription>Pending Orders</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

interface CutRollsVisualizationProps {
  cutRolls: CutRoll[];
  onRollSelect?: (rollIndex: number) => void;
  selectedRolls?: number[];
}

function CutRollsVisualization({ cutRolls, onRollSelect, selectedRolls = [] }: CutRollsVisualizationProps) {
  const groupedRolls = groupCutRollsBySpec(cutRolls);
  
  return (
    <div className="space-y-6">
      {Object.entries(groupedRolls).map(([specKey, rolls]) => {
        const [gsm, bf, shade] = specKey.split('-');
        
        // Group by individual roll number
        const rollsByNumber = rolls.reduce((acc, roll, originalIndex) => {
          const rollNum = roll.individual_roll_number || 0;
          if (!acc[rollNum]) {
            acc[rollNum] = [];
          }
          acc[rollNum].push({ ...roll, originalIndex });
          return acc;
        }, {} as Record<number, Array<CutRoll & { originalIndex: number }>>);
        
        return (
          <Card key={specKey} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{specKey.replace(/-/g, ', ')}</h3>
              <Badge variant="outline">{rolls.length} rolls</Badge>
            </div>
            
            <div className="space-y-4">
              {Object.entries(rollsByNumber).map(([rollNumber, rollGroup]) => {
                const totalWidth = rollGroup.reduce((sum, roll) => sum + roll.width, 0);
                const waste = 118 - totalWidth;
                const efficiency = (totalWidth / 118) * 100;
                
                return (
                  <div key={rollNumber} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Roll #{rollNumber}</span>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{rollGroup.length} cuts</Badge>
                        <Badge variant={efficiency > 90 ? "default" : efficiency > 80 ? "secondary" : "destructive"}>
                          {efficiency.toFixed(1)}% efficiency
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Visual representation */}
                    <div className="relative h-8 bg-muted rounded border mb-2">
                      {(() => {
                        let currentPos = 0;
                        return rollGroup.map((roll, idx) => {
                          const widthPercent = (roll.width / 118) * 100;
                          const leftPercent = (currentPos / 118) * 100;
                          currentPos += roll.width;
                          
                          const isSelected = selectedRolls.includes(roll.originalIndex);
                          
                          return (
                            <div
                              key={idx}
                              className={`absolute h-full border-r-2 border-white cursor-pointer transition-all ${
                                isSelected ? 'bg-primary' : 'bg-blue-500 hover:bg-blue-600'
                              }`}
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`
                              }}
                              onClick={() => onRollSelect?.(roll.originalIndex)}
                              title={`${roll.width}" - Click to ${isSelected ? 'deselect' : 'select'}`}
                            >
                              <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                                {roll.width}"
                              </div>
                            </div>
                          );
                        });
                      })()}
                      
                      {/* Waste area */}
                      {waste > 0 && (
                        <div
                          className="absolute h-full bg-red-400"
                          style={{
                            right: '0%',
                            width: `${(waste / 118) * 100}%`
                          }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                            {waste.toFixed(1)}"
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      Used: {totalWidth}" | Waste: {waste.toFixed(1)}" | Efficiency: {efficiency.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default function NewFlowWorkflow() {
  const [currentStep, setCurrentStep] = useState<'input' | 'processing' | 'results' | 'production'>('input');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  
  // Input state
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [includePending, setIncludePending] = useState(true);
  const [includeInventory, setIncludeInventory] = useState(true);
  const [customRequirements, setCustomRequirements] = useState<OrderRequirement[]>([]);
  
  // Data state
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState<any>(null);
  const [algorithmInfo, setAlgorithmInfo] = useState<any>(null);
  
  // Results state
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [selectedCutRolls, setSelectedCutRolls] = useState<number[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [orders, status, algorithms] = await Promise.all([
          getOrdersWithRelationships(),
          getWorkflowStatus(),
          getCuttingAlgorithms()
        ]);
        
        setAvailableOrders(orders.orders.filter(order => order.status === 'created'));
        setWorkflowStatus(status);
        setAlgorithmInfo(algorithms);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load initial data';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  const handleProcessOrders = async () => {
    if (selectedOrders.length === 0 && customRequirements.length === 0) {
      toast.error('Please select orders or add custom requirements');
      return;
    }
    
    try {
      setLoading(true);
      setCurrentStep('processing');
      setError(null);
      
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      if (selectedOrders.length > 0) {
        // Use workflow processing for selected orders
        const request: WorkflowProcessRequest = {
          order_ids: selectedOrders,
          user_id: userId,
          include_pending_orders: includePending,
          include_available_inventory: includeInventory
        };
        
        const result = await processMultipleOrders(request);
        setOptimizationResult(result);
      } else {
        // Use direct cutting plan for custom requirements
        const request: CuttingPlanRequest = {
          order_requirements: customRequirements,
          interactive: false
        };
        
        const result = await generateCuttingPlan(request);
        setOptimizationResult(result);
      }
      
      setCurrentStep('results');
      setCompletedSteps(prev => new Set([...prev, 'input', 'processing']));
      toast.success('Optimization completed successfully!');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process orders';
      setError(errorMessage);
      toast.error(errorMessage);
      setCurrentStep('input');
    } finally {
      setLoading(false);
    }
  };
  
  const handleValidatePlan = async () => {
    if (!optimizationResult) return;
    
    try {
      setLoading(true);
      const validation = await validateCuttingPlan(optimizationResult);
      setValidationResult(validation);
      
      if (validation.is_valid) {
        toast.success('Plan validation passed!');
      } else {
        toast.warning(`Plan has ${validation.violations.length} violations`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate plan';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCutRollSelect = (rollIndex: number) => {
    setSelectedCutRolls(prev => 
      prev.includes(rollIndex) 
        ? prev.filter(i => i !== rollIndex)
        : [...prev, rollIndex]
    );
  };
  
  const handleSelectAllCutRolls = (selected: boolean) => {
    if (!optimizationResult) return;
    
    setSelectedCutRolls(selected 
      ? optimizationResult.cut_rolls_generated.map((_, index) => index)
      : []
    );
  };
  
  const workflowSteps = [
    {
      key: 'input',
      title: 'Input Selection',
      description: 'Select orders and configure inputs',
      icon: <Package className="h-4 w-4" />
    },
    {
      key: 'processing',
      title: 'Optimization',
      description: 'Generate cutting plan with NEW FLOW',
      icon: <Scissors className="h-4 w-4" />
    },
    {
      key: 'results',
      title: 'Results Review',
      description: 'Review and validate results',
      icon: <TrendingUp className="h-4 w-4" />
    },
    {
      key: 'production',
      title: 'Production Setup',
      description: 'Configure production parameters',
      icon: <Archive className="h-4 w-4" />
    }
  ];
  
  if (loading && !optimizationResult) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading NEW FLOW Workflow...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">NEW FLOW: Workflow Management</h1>
          <p className="text-muted-foreground">3-input/4-output optimization system</p>
        </div>
        
        {algorithmInfo && (
          <Badge variant="outline" className="text-sm">
            Algorithm: {algorithmInfo.algorithm_version}
          </Badge>
        )}
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Workflow Steps */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {workflowSteps.map((step, index) => (
          <WorkflowStep
            key={step.key}
            title={step.title}
            description={step.description}
            icon={step.icon}
            isActive={currentStep === step.key}
            isCompleted={completedSteps.has(step.key)}
            onClick={() => setCurrentStep(step.key as any)}
          />
        ))}
      </div>
      
      {/* Main Content */}
      <Card>
        <CardContent className="p-6">
          {currentStep === 'input' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Configure Inputs</h2>
                <div className="flex gap-2">
                  <Button
                    onClick={handleProcessOrders}
                    disabled={loading || (selectedOrders.length === 0 && customRequirements.length === 0)}
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                    ) : (
                      'Generate Plan'
                    )}
                  </Button>
                </div>
              </div>
              
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                  <TabsTrigger value="options">Options</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  {workflowStatus && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{workflowStatus.current_orders}</CardTitle>
                          <CardDescription>Current Orders</CardDescription>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{workflowStatus.pending_orders}</CardTitle>
                          <CardDescription>Pending Orders</CardDescription>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{workflowStatus.inventory_items}</CardTitle>
                          <CardDescription>Inventory Items</CardDescription>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{workflowStatus.active_plans}</CardTitle>
                          <CardDescription>Active Plans</CardDescription>
                        </CardHeader>
                      </Card>
                    </div>
                  )}
                  
                  {algorithmInfo && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Algorithm Information</AlertTitle>
                      <AlertDescription>
                        <div className="mt-2 space-y-2">
                          <p><strong>Version:</strong> {algorithmInfo.algorithm_version}</p>
                          <p><strong>Features:</strong> {algorithmInfo.available_algorithms[0]?.features.join(', ')}</p>
                          <p><strong>Jumbo Roll Width:</strong> {algorithmInfo.constraints.jumbo_roll_width}</p>
                          <p><strong>Max Acceptable Trim:</strong> {algorithmInfo.constraints.maximum_acceptable_trim}</p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
                
                <TabsContent value="orders" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Available Orders</h3>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {selectedOrders.length} of {availableOrders.length} selected
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedOrders(availableOrders.map(o => o.order_id))}
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedOrders([])}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {availableOrders.map(order => (
                      <div
                        key={order.order_id}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          selectedOrders.includes(order.order_id) 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedOrders(prev => 
                            prev.includes(order.order_id)
                              ? prev.filter(id => id !== order.order_id)
                              : [...prev, order.order_id]
                          );
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              checked={selectedOrders.includes(order.order_id)}
                              readOnly
                            />
                            <div>
                              <p className="font-medium">{order.client_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {order.width_inches}" × {order.total_quantity} rolls
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {order.paper_specs && (
                              <Badge variant="outline">
                                {formatPaperSpec(order.paper_specs.gsm, order.paper_specs.bf, order.paper_specs.shade)}
                              </Badge>
                            )}
                            <Badge variant={getStatusBadgeVariant(order.status)}>
                              {order.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="options" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="include-pending"
                        checked={includePending}
                        onCheckedChange={setIncludePending}
                      />
                      <Label htmlFor="include-pending">Include Pending Orders</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="include-inventory"
                        checked={includeInventory}
                        onCheckedChange={setIncludeInventory}
                      />
                      <Label htmlFor="include-inventory">Include Available Inventory (20-25" waste)</Label>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
          
          {currentStep === 'processing' && (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Processing with NEW FLOW Algorithm</h3>
              <p className="text-muted-foreground">
                Running 3-input/4-output optimization...
              </p>
            </div>
          )}
          
          {currentStep === 'results' && optimizationResult && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Optimization Results</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleValidatePlan}
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating...</>
                    ) : (
                      'Validate Plan'
                    )}
                  </Button>
                  <Button
                    onClick={() => setCurrentStep('production')}
                    disabled={selectedCutRolls.length === 0}
                  >
                    Setup Production ({selectedCutRolls.length} rolls)
                  </Button>
                </div>
              </div>
              
              <OptimizationSummary result={optimizationResult} />
              
              {validationResult && (
                <Alert variant={validationResult.is_valid ? "default" : "destructive"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    Validation {validationResult.is_valid ? 'Passed' : 'Failed'}
                  </AlertTitle>
                  <AlertDescription>
                    {validationResult.is_valid ? (
                      <p>Plan meets all constraints and is ready for production.</p>
                    ) : (
                      <div>
                        <p>{validationResult.violations.length} violations found:</p>
                        <ul className="list-disc list-inside mt-2">
                          {validationResult.violations.map((violation: any, index: number) => (
                            <li key={index} className="text-sm">
                              {violation.issue} (Severity: {violation.severity})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Cut Rolls Selection</CardTitle>
                      <CardDescription>
                        Select rolls to move to production phase
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectAllCutRolls(true)}
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectAllCutRolls(false)}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CutRollsVisualization
                    cutRolls={optimizationResult.cut_rolls_generated}
                    onRollSelect={handleCutRollSelect}
                    selectedRolls={selectedCutRolls}
                  />
                </CardContent>
              </Card>
              
              {optimizationResult.pending_orders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Orders</CardTitle>
                    <CardDescription>
                      Orders that could not be fulfilled in this optimization cycle
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {optimizationResult.pending_orders.map((order, index) => (
                        <div key={index} className="flex justify-between items-center p-2 border rounded">
                          <span>{order.width}" × {order.quantity} rolls</span>
                          <div className="flex gap-2">
                            <Badge variant="outline">
                              {formatPaperSpec(order.gsm, order.bf, order.shade)}
                            </Badge>
                            <Badge variant="destructive">{order.reason}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          {currentStep === 'production' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Production Setup</h2>
              <p className="text-muted-foreground">
                Configure production parameters for {selectedCutRolls.length} selected cut rolls.
              </p>
              
              {/* Production setup content would go here */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Production Ready</AlertTitle>
                <AlertDescription>
                  Selected cut rolls are ready for production setup. Use the production management interface to proceed.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}