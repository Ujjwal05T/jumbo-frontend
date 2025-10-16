import { createRequestOptions, ROLL_TRACKING_ENDPOINTS } from './api-config';

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

export interface SpecificationSearchResponse {
  search_criteria: {
    width_inches: number;
    gsm: number;
    bf: number;
    shade: string;
    tolerance: number;
  };
  results: SpecificationSearchResult[];
  total: number;
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