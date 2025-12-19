import { createRequestOptions, ROLL_TRACKING_ENDPOINTS, WASTAGE_ENDPOINTS } from './api-config';

export interface RollInfo {
  inventory_id: string;
  frontend_id?: string;
  barcode_id?: string;
  qr_code?: string;
  width_inches: number;
  weight_kg: number;
  roll_type: string;
  status: string;
  location?: string;
  production_date?: string;
  is_wastage_roll: boolean;
  created_at: string;
  paper_specifications?: {
    paper_id: string;
    paper_frontend_id?: string;
    name: string;
    gsm: number;
    bf: number;
    shade: string;
    type?: string;
  };
}

export interface OrderInfo {
  order_id: string;
  order_frontend_id?: string;
  status: string;
  priority: string;
  payment_type: string;
  delivery_date?: string;
  created_at: string;
  client?: {
    client_id: string;
    client_name: string;
    contact_person?: string;
    phone?: string;
  };
  order_item?: {
    order_item_id: string;
    order_item_frontend_id?: string;
    quantity_rolls: number;
    quantity_fulfilled: number;
    quantity_kg: number;
    rate: number;
    item_status: string;
    remaining_quantity: number;
    is_fully_fulfilled: boolean;
  };
}

export interface PlanInfo {
  plan_id: string;
  plan_frontend_id?: string;
  name?: string;
  status: string;
  expected_waste_percentage: number;
  actual_waste_percentage?: number;
  created_at: string;
  executed_at?: string;
  completed_at?: string;
  created_by?: string;
}

export interface DispatchInfo {
  dispatch_id: string;
  dispatch_frontend_id?: string;
  dispatch_number: string;
  reference_number?: string;
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  dispatch_date?: string;
  status: string;
  client?: {
    client_name: string;
  };
}

export interface ProductionInfo {
  created_by?: string;
  created_by_role?: string;
  created_at: string;
  jumbo_hierarchy: {
    parent_jumbo_id?: string;
    parent_jumbo_frontend_id?: string;
    parent_118_roll_id?: string;
    parent_118_roll_frontend_id?: string;
    roll_sequence?: number;
    individual_roll_number?: number;
  };
}

export interface WeightInfo {
  current_weight_kg: number;
  has_weight: boolean;
  weight_status: string;
}

export interface StatusTimeline {
  event: string;
  timestamp: string;
  description: string;
  type: 'production' | 'quality' | 'status' | 'dispatch';
}

export interface RelatedRoll {
  inventory_id: string;
  frontend_id?: string;
  barcode_id?: string;
  width_inches: number;
  weight_kg: number;
  status: string;
  relationship: string;
}

export interface RollTrackingResponse {
  roll_info: RollInfo;
  order_info?: OrderInfo;
  plan_info?: PlanInfo;
  dispatch_info?: DispatchInfo;
  production_info: ProductionInfo;
  weight_info: WeightInfo;
  status_timeline: StatusTimeline[];
  related_rolls: RelatedRoll[];
  pending_order_info?: {
    pending_order_id: string;
    pending_order_frontend_id?: string;
    status: string;
    quantity_pending: number;
    quantity_fulfilled: number;
    reason: string;
    original_order_id: string;
    resolved_at?: string;
  };
}

export interface SearchResult {
  inventory_id: string;
  frontend_id?: string;
  barcode_id?: string;
  qr_code?: string;
  width_inches: number;
  weight_kg: number;
  roll_type: string;
  status: string;
  location?: string;
  paper_name?: string;
  created_at: string;
}

export interface SpecificationSearchResult extends SearchResult {
  paper_specifications?: {
    gsm: number;
    bf: number;
    shade: string;
    type?: string;
  };
  width_difference: number;
  match_score: number;
  order_info?: {
    order_id: string;
    order_frontend_id: string;
    status: string;
  };
  plan_info?: {
    plan_id: string;
    plan_frontend_id: string;
    status: string;
    name?: string;
  };
}

export interface SearchResponse {
  query: string;
  search_type: string;
  results: SearchResult[];
  total: number;
}

export interface MatchingOrder {
  type: 'regular_order';
  order_id: string;
  order_frontend_id: string;
  client_name: string;
  order_item_id: string;
  order_item_frontend_id: string;
  quantity_rolls: number;
  quantity_fulfilled: number;
  remaining_quantity: number;
  width_inches: number;
  rate: number;
  status: string;
  item_status: string;
  delivery_date?: string;
  created_at: string;
}

export interface PendingOrderResult {
  type: 'pending_order';
  pending_order_id: string;
  pending_order_frontend_id: string;
  original_order_id?: string;
  original_order_frontend_id?: string;
  client_name: string;
  quantity_pending: number;
  quantity_fulfilled: number;
  width_inches: number;
  status: string;
  reason: string;
  resolved_at?: string;
  created_at: string;
}

export interface SpecificationSearchResponse {
  search_criteria: {
    width_inches: number;
    gsm: number;
    bf: number;
    shade: string;
    tolerance: number;
  };
  inventory_results: SpecificationSearchResult[];
  inventory_total: number;
  matching_orders: MatchingOrder[];
  matching_orders_total: number;
  pending_orders: PendingOrderResult[];
  pending_orders_total: number;
  message: string;
}

export async function trackRoll(identifier: string): Promise<RollTrackingResponse> {
  const response = await fetch(ROLL_TRACKING_ENDPOINTS.TRACK_ROLL(identifier), createRequestOptions('GET'));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to track roll: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function searchRolls(
  query: string,
  searchType: 'all' | 'barcode' | 'qr' | 'frontend_id' = 'all',
  limit: number = 10
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    query,
    search_type: searchType,
    limit: limit.toString(),
  });

  const response = await fetch(`${ROLL_TRACKING_ENDPOINTS.SEARCH_ROLLS}?${params}`, createRequestOptions('GET'));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to search rolls: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function searchRollsBySpecifications(
  widthInches: number,
  gsm: number,
  bf: number,
  shade: string,
  tolerance: number = 0.1,
  limit: number = 20
): Promise<SpecificationSearchResponse> {
  const params = new URLSearchParams({
    width_inches: widthInches.toString(),
    gsm: gsm.toString(),
    bf: bf.toString(),
    shade: shade.trim(),
    tolerance: tolerance.toString(),
    limit: limit.toString(),
  });

  const response = await fetch(`${ROLL_TRACKING_ENDPOINTS.SEARCH_BY_SPECS}?${params}`, createRequestOptions('GET'));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to search rolls by specifications: ${response.status} ${errorText}`);
  }

  return response.json();
}

// Hierarchy tracking interfaces
export interface CutRollInfo {
  id: string;
  barcode_id: string;
  width_inches: number;
  weight_kg: number;
  status: string;
  location: string;
  is_wastage_roll: boolean;
  created_at: string;
  paper_specs?: {
    name: string;
    gsm: number;
    bf: number;
    shade: string;
  };
}

export interface IntermediateRollInfo {
  id: string;
  barcode_id: string;
  frontend_id?: string;
  individual_roll_number?: number;
  roll_sequence?: number;
  width_inches: number;
  weight_kg: number;
  status: string;
  location: string;
  cut_rolls: CutRollInfo[];
  cut_rolls_count: number;
}

export interface JumboRollInfo {
  id: string;
  barcode_id: string;
  frontend_id?: string;
  width_inches: number;
  weight_kg: number;
  status: string;
  location: string;
  paper_specs?: {
    name: string;
    gsm: number;
    bf: number;
    shade: string;
  };
}

export interface SetRollInfo {
  id: string;
  barcode_id: string;
  individual_roll_number?: number;
  roll_sequence?: number;
  status: string;
  cut_rolls_count?: number;
  is_current_parent?: boolean;
}

export interface JumboHierarchy {
  jumbo_roll: JumboRollInfo;
  intermediate_rolls: IntermediateRollInfo[];
  total_cut_rolls: number;
  total_sets: number;
}

export interface SetHierarchy {
  parent_jumbo_roll: JumboRollInfo | null;
  current_set_roll: IntermediateRollInfo;
  cut_rolls_from_this_set: CutRollInfo[];
  sibling_sets: SetRollInfo[];
  total_cut_rolls: number;
}

export interface CutRollHierarchy {
  parent_jumbo_roll: JumboRollInfo | null;
  parent_set_roll: SetRollInfo | null;
  current_cut_roll: CutRollInfo;
  sibling_cut_rolls: CutRollInfo[];
  all_sets_from_jumbo: SetRollInfo[];
}

export interface HierarchyTrackingResponse {
  searched_barcode: string;
  roll_type: 'jumbo' | '118' | 'cut';
  hierarchy: JumboHierarchy | SetHierarchy | CutRollHierarchy;
  searched_roll_info: {
    id: string;
    barcode_id: string;
    qr_code?: string;
    frontend_id?: string;
    width_inches: number;
    weight_kg: number;
    roll_type: string;
    status: string;
    location: string;
    individual_roll_number?: number;
    roll_sequence?: number;
    is_wastage_roll: boolean;
    created_at: string;
    paper_specs?: {
      paper_id: string;
      name: string;
      gsm: number;
      bf: number;
      shade: string;
      type: string;
    };
  };
}

export async function trackRollHierarchy(barcode: string): Promise<HierarchyTrackingResponse> {
  const response = await fetch(ROLL_TRACKING_ENDPOINTS.TRACK_HIERARCHY(barcode), createRequestOptions('GET'));

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw { response: { status: response.status, data: errorData } };
  }

  return response.json();
}

// Wastage allocation interfaces
export interface WastageAllocationOrderInfo {
  order_id: string | null;
  order_frontend_id: string | null;
  client_name: string | null;
}

export interface WastageAllocationPlanInfo {
  plan_id: string | null;
  plan_frontend_id: string | null;
}

export interface WastageAllocationResponse {
  id: string;
  frontend_id: string | null;
  paper_id: string;
  width_inches: number;
  weight_kg: number;
  roll_type: string;
  location: string | null;
  status: string;
  qr_code: string | null;
  barcode_id: string | null;
  production_date: string;
  allocated_to_order_id: string | null;
  is_wastage_roll: boolean;
  wastage_source_order_id: string | null;
  wastage_source_plan_id: string | null;
  parent_jumbo_id: string | null;
  parent_118_roll_id: string | null;
  roll_sequence: number | null;
  individual_roll_number: number | null;
  created_at: string;
  created_by_id: string;
  paper: {
    id: string;
    name: string;
    gsm: number;
    bf: number;
    shade: string;
    type?: string;
  } | null;
  order_info: WastageAllocationOrderInfo | null;
  plan_info: WastageAllocationPlanInfo | null;
}

export async function getWastageAllocationByReelNo(reelNo: string): Promise<WastageAllocationResponse> {
  const response = await fetch(WASTAGE_ENDPOINTS.GET_WASTAGE_ALLOCATION_BY_REEL(reelNo), createRequestOptions('GET'));

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw { response: { status: response.status, data: errorData } };
  }

  return response.json();
}