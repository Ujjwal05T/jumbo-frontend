/**
 * Dispatch API utilities
 */

import { DISPATCH_ENDPOINTS, createRequestOptions } from './api-config';

export interface WarehouseItem {
  id: string;
  order_id: string;
  width_inches: number;
  quantity_rolls: number;
  quantity_fulfilled: number;
  item_status: 'in_warehouse';
  paper: {
    id: string;
    name: string;
    gsm: number;
    bf: number;
    shade: string;
  };
  order: {
    id: string;
    client: {
      company_name: string;
      contact_person: string;
      phone: string;
      address: string;
    };
    priority: string;
    delivery_date: string | null;
  };
  moved_to_warehouse_at: string;
}

export interface PendingItem {
  id: string;
  original_order_id: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  quantity_pending: number;
  reason: string;
  status: 'included_in_plan';
  created_at: string;
  original_order?: {
    id: string;
    client: {
      company_name: string;
      contact_person: string;
      phone: string;
      address: string;
    };
  };
}

export interface DispatchFormData {
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  locket_no?: string;
  payment_type: string;
  dispatch_number: string;
  reference_number?: string;
  client_id: string;
  primary_order_id?: string;
  inventory_ids: string[];
  wastage_ids?: string[];  // NEW: Wastage inventory IDs
  manual_cut_roll_ids?: string[];  // NEW: Manual cut roll IDs
}

export interface CompletePendingItemRequest {
  pending_item_id: string;
  completed_by_id: string;
}

/**
 * Fetch warehouse items (order items with 'in_warehouse' status)
 */
export async function fetchWarehouseItems(): Promise<WarehouseItem[]> {
  const response = await fetch(DISPATCH_ENDPOINTS.WAREHOUSE_ITEMS, createRequestOptions('GET'));

  if (!response.ok) {
    throw new Error('Failed to fetch warehouse items');
  }

  return response.json();
}

/**
 * Create dispatch record with vehicle/driver details and complete items
 * Supports regular inventory, wastage items, and manual cut rolls
 */
export async function createDispatchRecord(dispatchData: {
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  locket_no?: string;
  payment_type: string;
  dispatch_number: string;
  reference_number?: string;
  client_id: string;
  primary_order_id?: string;
  inventory_ids: string[];
  wastage_ids?: string[];  // NEW: Wastage inventory IDs
  manual_cut_roll_ids?: string[];  // NEW: Manual cut roll IDs
}): Promise<{
  dispatch_id: string;
  dispatch_number: string;
  message: string;
  summary: {
    dispatched_items: number;
    regular_items?: number;
    wastage_items?: number;
    manual_cut_rolls?: number;
    orders_completed: number;
    total_weight: number;
  };
}> {
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    throw new Error('User not authenticated');
  }

  // Format the request to match backend schema
  const request = {
    vehicle_number: dispatchData.vehicle_number.trim(),
    driver_name: dispatchData.driver_name.trim(),
    driver_mobile: dispatchData.driver_mobile.trim(),
    locket_no: dispatchData.locket_no?.trim() || null,
    payment_type: dispatchData.payment_type,
    dispatch_date: new Date().toISOString(),
    dispatch_number: dispatchData.dispatch_number.trim(),
    reference_number: dispatchData.reference_number?.trim() || null,
    client_id: dispatchData.client_id,
    primary_order_id: dispatchData.primary_order_id || null,
    order_date: null,
    inventory_ids: dispatchData.inventory_ids || [],
    wastage_ids: dispatchData.wastage_ids || [],  // NEW: Include wastage IDs
    manual_cut_roll_ids: dispatchData.manual_cut_roll_ids || [],  // NEW: Include manual cut roll IDs
    created_by_id: userId
  };

  console.log('Sending dispatch request:', request);

  const response = await fetch(DISPATCH_ENDPOINTS.CREATE_DISPATCH, createRequestOptions('POST', request));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Dispatch creation failed:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      request
    });
    throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}: Failed to create dispatch record`);
  }

  return response.json();
}

/**
 * Fetch pending items ready for dispatch
 */
export async function fetchPendingItems(): Promise<PendingItem[]> {
  const response = await fetch(DISPATCH_ENDPOINTS.PENDING_ITEMS, createRequestOptions('GET'));

  if (!response.ok) {
    throw new Error('Failed to fetch pending items');
  }

  return response.json();
}

/**
 * Complete a pending order item
 */
export async function completePendingItem(pendingItemId: string): Promise<void> {
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const request: CompletePendingItemRequest = {
    pending_item_id: pendingItemId,
    completed_by_id: userId
  };

  const response = await fetch(DISPATCH_ENDPOINTS.COMPLETE_PENDING_ITEM, createRequestOptions('POST', request));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to complete pending item');
  }
}

/**
 * Dispatch details interface
 */
export interface DispatchDetails {
  id: string;
  frontend_id: string;
  dispatch_number: string;
  reference_number: string | null;
  dispatch_date: string;
  order_date: string | null;
  client: {
    id: string;
    company_name: string;
    contact_person: string;
    mobile: string;
    email: string;
    address: string;
  };
  primary_order: {
    id: string;
    order_number: string;
    status: string;
    payment_type: string;
  } | null;
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  locket_no: string | null;
  payment_type: string;
  status: string;
  total_items: number;
  total_weight_kg: number;
  created_by: {
    id: string;
    name: string;
    username: string;
  } | null;
  created_at: string;
  delivered_at: string | null;
  items: DispatchItemDetails[];
}

export interface DispatchItemDetails {
  id: string;
  frontend_id: string;
  qr_code: string;
  barcode_id: string;
  width_inches: number;
  weight_kg: number;
  paper_spec: string;
  status: string;
  dispatched_at: string;
  inventory: {
    id: string;
    location: string;
    roll_type: string;
  } | null;
}

/**
 * Fetch dispatch details by ID
 */
export async function fetchDispatchDetails(dispatchId: string): Promise<DispatchDetails> {
  const response = await fetch(
    DISPATCH_ENDPOINTS.GET_DISPATCH_DETAILS(dispatchId),
    createRequestOptions('GET')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to fetch dispatch details');
  }

  return response.json();
}

/**
 * Update dispatch record interface
 */
export interface UpdateDispatchData {
  vehicle_number?: string;
  driver_name?: string;
  driver_mobile?: string;
  locket_no?: string;
  payment_type?: string;
  dispatch_date?: string;
  reference_number?: string;
  inventory_ids?: string[];
  wastage_ids?: string[];
  manual_cut_roll_ids?: string[];
}

/**
 * Update an existing dispatch record
 */
export async function updateDispatchRecord(
  dispatchId: string,
  updateData: UpdateDispatchData
): Promise<{
  message: string;
  dispatch_id: string;
  dispatch_number: string;
  total_items: number;
  total_weight_kg: number;
  updated_fields: {
    vehicle_details: boolean;
    items_changed: boolean;
  };
}> {
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const request = {
    ...updateData,
    updated_by_id: userId,
  };

  console.log('Sending dispatch update request:', request);

  const response = await fetch(
    DISPATCH_ENDPOINTS.UPDATE_DISPATCH(dispatchId),
    createRequestOptions('PUT', request)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Dispatch update failed:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      request,
    });
    throw new Error(
      errorData.detail ||
        errorData.message ||
        `HTTP ${response.status}: Failed to update dispatch record`
    );
  }

  return response.json();
}