/**
 * NEW FLOW: 3-input/4-output optimization workflow
 * This file handles the new flow API calls and interfaces
 */

import { UUID } from 'crypto';
import { WORKFLOW_ENDPOINTS, CUTTING_ENDPOINTS, createRequestOptions } from './api-config';

// NEW FLOW: Input interfaces
export interface OrderRequirement {
  width: number;
  quantity: number;
  gsm: number;
  bf: number;
  shade: string;
  min_length?: number;
  order_id?: string;
  client_id?: string;
  paper_id?: string;
}

export interface PendingOrder {
  width: number;
  quantity: number;
  gsm: number;
  bf: number;
  shade: string;
  reason: string;
  pending_order_id?: string;
  original_order_id?: string;
}

export interface AvailableInventory {
  id: string;
  frontend_id?: string; // Human-readable inventory ID (e.g., INV-001)
  width: number;
  gsm: number;
  bf: number;
  shade: string;
  source?: string;
  inventory_id?: string;
}

// NEW FLOW: Output interfaces
export interface CutRoll {
  width: number;
  quantity: number;
  gsm: number;
  bf: number;
  shade: string;
  source: "cutting" | "inventory";
  individual_roll_number?: number;
  trim_left?: number;
  inventory_id?: string;
  order_id?: string;
  client_id?: string;
  paper_id?: string;
  source_type?: string;
  source_pending_id?: string | UUID; // For pending orders
  
  // Enhanced jumbo roll hierarchy fields
  jumbo_roll_id?: string;
  jumbo_roll_frontend_id?: string;
  parent_118_roll_id?: string;
  roll_sequence?: number; // Position within jumbo (1, 2, 3)
}

// InventoryRemaining interface removed - no more waste inventory creation

// Enhanced jumbo roll detail interface
export interface JumboRollDetail {
  jumbo_id: string;
  jumbo_frontend_id: string;
  paper_spec: string;
  roll_count: number;
  total_cuts: number;
  total_used_width: number;
  efficiency_percentage: number;
  is_complete: boolean;
  roll_numbers: number[];
}

export interface OptimizationSummary {
  total_cut_rolls: number;
  total_individual_118_rolls: number;
  total_jumbo_rolls_needed: number; // CORRECTED: 1 jumbo = 3×118" rolls
  total_pending_orders: number;
  total_pending_quantity: number;
  specification_groups_processed: number;
  high_trim_patterns: number;
  algorithm_note: string;
  
  // Enhanced jumbo roll statistics
  complete_jumbos?: number;
  partial_jumbos?: number;
  jumbo_roll_width?: number;
}

// NEW FLOW: Main optimization result (updated - removed inventory_remaining)
export interface OptimizationResult {
  cut_rolls_generated: CutRoll[];
  jumbo_rolls_needed: number; // CORRECTED calculation
  pending_orders: PendingOrder[];
  summary: OptimizationSummary;
  jumbo_roll_details?: JumboRollDetail[]; // Enhanced jumbo hierarchy details
  high_trim_approved?: Array<{
    combo: number[];
    trim: number;
    waste_percentage: number;
    paper_spec: {
      gsm: number;
      bf: number;
      shade: string;
    };
  }>;
}

// NEW FLOW: Workflow request
export interface WorkflowProcessRequest {
  order_ids: string[];
  user_id: string;
  include_pending_orders?: boolean;
  include_available_inventory?: boolean;
  jumbo_roll_width?: number; // Dynamic roll width from wastage calculation
}

// NEW FLOW: Direct cutting request
export interface CuttingPlanRequest {
  order_requirements: OrderRequirement[];
  pending_orders?: PendingOrder[];
  available_inventory?: AvailableInventory[];
  interactive?: boolean;
}

// NEW FLOW: API Functions

/**
 * Process multiple orders using the NEW FLOW 3-input/4-output algorithm
 */
export const processMultipleOrders = async (request: WorkflowProcessRequest): Promise<OptimizationResult> => {
  const response = await fetch(
    WORKFLOW_ENDPOINTS.PROCESS_ORDERS,
    createRequestOptions('POST', request)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to process orders');
  }

  return response.json();
};

/**
 * Generate cutting plan using the NEW FLOW algorithm directly
 */
export const generateCuttingPlan = async (request: CuttingPlanRequest): Promise<OptimizationResult> => {
  const response = await fetch(
    CUTTING_ENDPOINTS.GENERATE_PLAN,
    createRequestOptions('POST', request)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to generate cutting plan');
  }

  return response.json();
};

/**
 * Validate a cutting plan against constraints
 */
export const validateCuttingPlan = async (planData: any): Promise<{
  is_valid: boolean;
  violations: Array<{
    jumbo_number?: number;
    issue: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  warnings: Array<{
    jumbo_number?: number;
    issue: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  summary: {
    total_jumbo_rolls: number;
    average_waste_per_roll: number;
    overall_waste_percentage: number;
  };
}> => {
  const response = await fetch(
    CUTTING_ENDPOINTS.VALIDATE_PLAN,
    createRequestOptions('POST', planData)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to validate cutting plan');
  }

  return response.json();
};

/**
 * Get information about available cutting algorithms
 */
export const getCuttingAlgorithms = async (): Promise<{
  available_algorithms: Array<{
    name: string;
    description: string;
    inputs: string[];
    outputs: string[];
    parameters: Record<string, any>;
    features: string[];
  }>;
  constraints: Record<string, string>;
  algorithm_version: string;
  last_updated: string;
}> => {
  const response = await fetch(
    CUTTING_ENDPOINTS.ALGORITHMS,
    createRequestOptions('GET')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to get algorithm information');
  }

  return response.json();
};

/**
 * Get workflow status and metrics
 */
export const getWorkflowStatus = async (): Promise<{
  current_orders: number;
  pending_orders: number;
  active_plans: number;
  completed_plans: number;
  inventory_items: number;
  last_optimization: string;
}> => {
  const response = await fetch(
    WORKFLOW_ENDPOINTS.STATUS,
    createRequestOptions('GET')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to get workflow status');
  }

  return response.json();
};

/**
 * Get orders with their relationships for planning
 */
export const getOrdersWithRelationships = async (): Promise<{
  total_orders: number;
  orders: Array<{
    order_id: string;
    client_name: string;
    status: string;
    total_quantity: number;
    width_inches: number;
    created_at: string;
    order_items: Array<{
      item_id: string;
      width_inches: number;
      quantity: number;
      item_status: string;
    }>;
    paper_specs: {
      gsm: number;
      bf: number;
      shade: string;
      paper_type: string;
    } | null;
  }>;
}> => {
  const response = await fetch(
    WORKFLOW_ENDPOINTS.ORDERS_WITH_RELATIONSHIPS,
    createRequestOptions('GET')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to get orders with relationships');
  }

  return response.json();
};

// Helper functions for NEW FLOW

/**
 * Convert order data to NEW FLOW format
 */
export const convertOrdersToRequirements = (orders: any[]): OrderRequirement[] => {
  const requirements: OrderRequirement[] = [];

  orders.forEach(order => {
    if (order.order_items && Array.isArray(order.order_items)) {
      order.order_items.forEach((item: any) => {
        if (item.paper) {
          requirements.push({
            width: parseFloat(item.width_inches),
            quantity: parseInt(item.quantity_rolls),
            gsm: item.paper.gsm,
            bf: parseFloat(item.paper.bf),
            shade: item.paper.shade,
            min_length: 1600, // Default min length
            order_id: order.id,
            client_id: order.client_id,
            paper_id: item.paper_id
          });
        }
      });
    }
  });

  return requirements;
};

/**
 * Group cut rolls by specification for better display
 */
export const groupCutRollsBySpec = (cutRolls: CutRoll[]): Record<string, CutRoll[]> => {
  return cutRolls.reduce((groups, roll) => {
    const key = `${roll.gsm}gsm-${roll.bf}bf-${roll.shade}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(roll);
    return groups;
  }, {} as Record<string, CutRoll[]>);
};

/**
 * Group cut rolls by jumbo roll hierarchy for enhanced display
 */
export const groupCutRollsByJumbo = (cutRolls: CutRoll[]): Record<string, Record<string, CutRoll[]>> => {
  const jumboGroups: Record<string, Record<string, CutRoll[]>> = {};
  
  cutRolls.forEach(roll => {
    if (roll.source !== 'cutting' || !roll.jumbo_roll_id) {
      // Handle inventory rolls or rolls without jumbo hierarchy
      const inventoryKey = 'inventory-items';
      if (!jumboGroups[inventoryKey]) {
        jumboGroups[inventoryKey] = {};
      }
      const specKey = `${roll.gsm}gsm-${roll.bf}bf-${roll.shade}`;
      if (!jumboGroups[inventoryKey][specKey]) {
        jumboGroups[inventoryKey][specKey] = [];
      }
      jumboGroups[inventoryKey][specKey].push(roll);
      return;
    }
    
    const jumboKey = roll.jumbo_roll_frontend_id || roll.jumbo_roll_id || 'unknown-jumbo';
    if (!jumboGroups[jumboKey]) {
      jumboGroups[jumboKey] = {};
    }
    
    const roll118Key = roll.parent_118_roll_id || `roll-${roll.individual_roll_number || 0}`;
    if (!jumboGroups[jumboKey][roll118Key]) {
      jumboGroups[jumboKey][roll118Key] = [];
    }
    
    jumboGroups[jumboKey][roll118Key].push(roll);
  });
  
  return jumboGroups;
};

/**
 * Calculate efficiency metrics for a set of cut rolls
 */
export const calculateEfficiencyMetrics = (cutRolls: CutRoll[]): {
  totalRolls: number;
  totalWidth: number;
  averageEfficiency: number;
  totalWaste: number;
  jumboRollsNeeded: number;
} => {
  const grouped = groupCutRollsBySpec(cutRolls);
  let totalWaste = 0;
  let totalRolls = 0;
  let totalUsedWidth = 0;

  Object.values(grouped).forEach(rolls => {
    // Group by individual roll number
    const rollsByNumber = rolls.reduce((rollGroups, roll) => {
      const rollNum = roll.individual_roll_number || 0;
      if (!rollGroups[rollNum]) {
        rollGroups[rollNum] = [];
      }
      rollGroups[rollNum].push(roll);
      return rollGroups;
    }, {} as Record<number, CutRoll[]>);

    Object.values(rollsByNumber).forEach(rollGroup => {
      const usedWidth = rollGroup.reduce((sum, roll) => sum + roll.width, 0);
      const waste = 118 - usedWidth;
      totalWaste += waste;
      totalRolls += 1;
      totalUsedWidth += usedWidth;
    });
  });

  const averageEfficiency = totalRolls > 0 ? (totalUsedWidth / (totalRolls * 118)) * 100 : 0;
  const jumboRollsNeeded = Math.ceil(totalRolls / 3); // CORRECTED: 1 jumbo = 3×118" rolls

  return {
    totalRolls,
    totalWidth: totalUsedWidth,
    averageEfficiency,
    totalWaste,
    jumboRollsNeeded
  };
};

/**
 * Format paper specification for display
 */
export const formatPaperSpec = (gsm: number, bf: number, shade: string): string => {
  return `${gsm}gsm, ${bf}bf, ${shade}`;
};

/**
 * Get status badge variant for different statuses
 */
export const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status.toLowerCase()) {
    case "created":
    case "pending":
      return "outline";
    case "in_process":
    case "in_progress":
      return "secondary";
    case "completed":
      return "default";
    case "cancelled":
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
};