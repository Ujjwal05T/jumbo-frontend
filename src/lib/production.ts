/**
 * Production API utilities - Enhanced for NEW FLOW
 */

import { PRODUCTION_ENDPOINTS, STATUS_ENDPOINTS, DISPATCH_ENDPOINTS, createRequestOptions } from './api-config';

export interface ProductionStartRequest {
  plan_id: string;
  selected_cut_rolls: CutRollSelection[];
  user_id: string;
}

export interface CutRollSelection {
  width: number;
  gsm: number;
  bf: number;
  shade: string;
  paper_id?: string;
  order_id?: string;
  client_id?: string;
  individual_roll_number?: number;
  trim_left?: number;
}

export interface ProductionStartResponse {
  message: string;
  plan_id: string;
  plan_status: string;
  started_at: string;
  summary: {
    orders_updated: number;
    order_items_updated: number;
    inventory_created: number;
    pending_orders_updated: number;
  };
  details: {
    updated_orders: string[];
    updated_order_items: string[];
    created_inventory: InventoryItem[];
    updated_pending_orders: string[];
  };
}

export interface InventoryItem {
  id: string;
  frontend_id?: string; // Human-readable inventory ID (e.g., INV-001)
  width: number;
  qr_code: string;
  barcode_id?: string;
  status: string;
}

export interface StatusSummary {
  orders: Record<string, number>;
  order_items: Record<string, number>;
  inventory: Record<string, number>;
  pending_orders: Record<string, number>;
  generated_at: string;
}

export interface StatusValidationResult {
  validation_completed_at: string;
  issues_found: number;
  issues: StatusIssue[];
  status: 'healthy' | 'issues_detected';
}

export interface StatusIssue {
  type: string;
  order_id?: string;
  order_item_id?: string;
  inventory_id?: string;
  issue: string;
  incomplete_items?: string[];
}

/**
 * Start production for a plan using the new enhanced endpoint
 */
export async function startProduction(request: ProductionStartRequest): Promise<ProductionStartResponse> {
  const response = await fetch(
    PRODUCTION_ENDPOINTS.START_PRODUCTION(request.plan_id),
    createRequestOptions('POST', {
      selected_cut_rolls: request.selected_cut_rolls,
      user_id: request.user_id
    })
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to start production');
  }

  return response.json();
}

/**
 * Get comprehensive status summary for monitoring
 */
export async function getStatusSummary(): Promise<StatusSummary> {
  const response = await fetch(
    STATUS_ENDPOINTS.SUMMARY,
    createRequestOptions('GET')
  );

  if (!response.ok) {
    throw new Error('Failed to fetch status summary');
  }

  return response.json();
}

/**
 * Validate system status integrity
 */
export async function validateStatusIntegrity(): Promise<StatusValidationResult> {
  const response = await fetch(
    STATUS_ENDPOINTS.VALIDATE,
    createRequestOptions('GET')
  );

  if (!response.ok) {
    throw new Error('Failed to validate status integrity');
  }

  return response.json();
}

/**
 * Trigger automatic status updates
 */
export async function triggerAutoStatusUpdate(): Promise<{ message: string; result: any }> {
  const response = await fetch(
    STATUS_ENDPOINTS.AUTO_UPDATE,
    createRequestOptions('POST')
  );

  if (!response.ok) {
    throw new Error('Failed to trigger auto status update');
  }

  return response.json();
}

/**
 * Get warehouse items (items ready for dispatch)
 */
export async function getWarehouseItems(skip: number = 0, limit: number = 100) {
  const response = await fetch(
    `${DISPATCH_ENDPOINTS.WAREHOUSE_ITEMS}?skip=${skip}&limit=${limit}`,
    createRequestOptions('GET')
  );

  if (!response.ok) {
    throw new Error('Failed to fetch warehouse items');
  }

  return response.json();
}

/**
 * Complete order items (dispatch)
 */
export async function completeOrderItems(itemIds: string[], userId: string) {
  const response = await fetch(
    DISPATCH_ENDPOINTS.COMPLETE_ITEMS,
    createRequestOptions('POST', {
      item_ids: itemIds,
      user_id: userId
    })
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to complete order items');
  }

  return response.json();
}

/**
 * Status badge helper for consistent UI
 */
export function getStatusBadgeVariant(status: string, entityType: 'order' | 'order_item' | 'inventory' | 'pending_order' = 'order') {
  const statusMappings = {
    order: {
      'created': 'outline',
      'in_process': 'secondary',
      'completed': 'default',
      'cancelled': 'destructive'
    },
    order_item: {
      'created': 'outline',
      'in_process': 'secondary', 
      'in_warehouse': 'default',
      'completed': 'default'
    },
    inventory: {
      'cutting': 'secondary',
      'available': 'default',
      'allocated': 'outline',
      'used': 'outline',
      'damaged': 'destructive'
    },
    pending_order: {
      'pending': 'outline',
      'included_in_plan': 'secondary',
      'resolved': 'default',
      'cancelled': 'destructive'
    }
  };

  return statusMappings[entityType]?.[status] || 'outline';
}

/**
 * Status display helper for consistent UI text
 */
export function getStatusDisplayText(status: string): string {
  return status.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// NEW FLOW: Cut Roll Production interfaces
export interface CutRollProductionRequest {
  plan_id?: string;
  selected_rolls: Array<{
    paper_id: string;
    width_inches: number;
    qr_code?: string;
    cutting_pattern?: string;
  }>;
  created_by_id: string;
}

export interface CutRollProductionResponse {
  plan_id: string | null;
  selected_rolls: Array<{
    inventory_id: string;
    width_inches: number;
    paper_id: string;
    qr_code: string;
    status: string;
    expected_pattern: string;
  }>;
  production_summary: {
    total_rolls_selected: number;
    total_inventory_items_created: number;
    production_status: string;
    next_steps: string[];
  };
  message: string;
}

export interface PlanStatusUpdateRequest {
  status: string;
  actual_waste_percentage?: number;
}

export interface PlanStatusUpdateResponse {
  plan_id: string;
  name: string;
  status: string;
  expected_waste_percentage: number | null;
  actual_waste_percentage: number | null;
  executed_at: string | null;
  completed_at: string | null;
  message: string;
}

export interface ProductionSummaryResponse {
  plan_id: string;
  plan_name: string;
  plan_status: string;
  executed_at: string | null;
  production_summary: {
    total_cut_rolls: number;
    total_weight_kg: number;
    average_weight_per_roll: number;
    status_breakdown: Record<string, {
      count: number;
      total_weight: number;
      widths: number[];
    }>;
    paper_specifications: Array<{
      gsm: number;
      bf: number;
      shade: string;
      roll_count: number;
    }>;
  };
  detailed_items: Array<{
    inventory_id: string;
    width_inches: number;
    weight_kg: number;
    status: string;
    location: string;
    qr_code: string;
    created_at: string;
    paper_specs: {
      gsm: number;
      bf: number;
      shade: string;
    } | null;
  }>;
}

// NEW FLOW: Production API Functions

/**
 * Select cut rolls for production (NEW FLOW)
 */
export async function selectCutRollsForProduction(request: CutRollProductionRequest): Promise<CutRollProductionResponse> {
  const response = await fetch(
    PRODUCTION_ENDPOINTS.SELECT_FOR_PRODUCTION,
    createRequestOptions('POST', request)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to select cut rolls for production');
  }

  return response.json();
}

/**
 * Get production summary for a plan (NEW FLOW)
 */
export async function getProductionSummary(planId: string): Promise<ProductionSummaryResponse> {
  const response = await fetch(
    PRODUCTION_ENDPOINTS.CUT_ROLLS_PLAN(planId),
    createRequestOptions('GET')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to get production summary');
  }

  return response.json();
}

/**
 * Update plan status and waste percentage (NEW FLOW)
 */
export async function updatePlanStatus(planId: string, updateData: PlanStatusUpdateRequest): Promise<PlanStatusUpdateResponse> {
  const response = await fetch(
    PRODUCTION_ENDPOINTS.PLAN_STATUS(planId),
    createRequestOptions('PUT', updateData)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to update plan status');
  }

  return response.json();
}

/**
 * Execute a cutting plan (NEW FLOW)
 */
export async function executePlan(planId: string): Promise<PlanStatusUpdateResponse> {
  const response = await fetch(
    PRODUCTION_ENDPOINTS.START_PRODUCTION(planId),
    createRequestOptions('POST')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to execute plan');
  }

  return response.json();
}

/**
 * Complete a cutting plan (NEW FLOW)
 */
export async function completePlan(planId: string): Promise<PlanStatusUpdateResponse> {
  const response = await fetch(
    PRODUCTION_ENDPOINTS.COMPLETE_PLAN(planId),
    createRequestOptions('POST')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to complete plan');
  }

  return response.json();
}

// NEW FLOW: Helper functions

/**
 * Calculate production efficiency metrics
 */
export function calculateProductionEfficiency(summary: ProductionSummaryResponse): {
  overallEfficiency: number;
  wastePercentage: number;
  averageRollUtilization: number;
} {
  const { production_summary } = summary;
  
  // Calculate based on 118" standard roll width
  const standardWidth = 118;
  const totalStandardRolls = production_summary.total_cut_rolls;
  const averageWeight = production_summary.average_weight_per_roll;
  
  // Estimate utilization based on status breakdown
  const completedRolls = production_summary.status_breakdown['completed']?.count || 0;
  const totalRolls = production_summary.total_cut_rolls;
  
  const overallEfficiency = totalRolls > 0 ? (completedRolls / totalRolls) * 100 : 0;
  
  // Calculate waste percentage (simplified)
  const wastePercentage = overallEfficiency > 0 ? 100 - overallEfficiency : 0;
  
  // Average roll utilization based on weight
  const averageRollUtilization = averageWeight > 0 ? Math.min(averageWeight / 50, 100) : 0; // Assume 50kg is optimal
  
  return {
    overallEfficiency: Math.round(overallEfficiency * 100) / 100,
    wastePercentage: Math.round(wastePercentage * 100) / 100,
    averageRollUtilization: Math.round(averageRollUtilization * 100) / 100
  };
}

/**
 * Group production items by specification
 */
export function groupProductionBySpec(items: ProductionSummaryResponse['detailed_items']): Record<string, typeof items> {
  return items.reduce((groups, item) => {
    if (!item.paper_specs) return groups;
    
    const key = `${item.paper_specs.gsm}gsm-${item.paper_specs.bf}bf-${item.paper_specs.shade}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, typeof items>);
}

/**
 * Get production status statistics
 */
export function getProductionStats(summary: ProductionSummaryResponse): {
  totalItems: number;
  byStatus: Record<string, number>;
  bySpecification: Record<string, number>;
  totalWeight: number;
}  {
  const { detailed_items, production_summary } = summary;
  
  const byStatus = detailed_items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const bySpecification = detailed_items.reduce((acc, item) => {
    if (item.paper_specs) {
      const key = `${item.paper_specs.gsm}gsm-${item.paper_specs.bf}bf-${item.paper_specs.shade}`;
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalItems: detailed_items.length,
    byStatus,
    bySpecification,
    totalWeight: production_summary.total_weight_kg
  };
}