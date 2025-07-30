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

export interface CompleteBatchRequest {
  order_item_ids: string[];
  completed_by_id: string;
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
 * Complete multiple order items in batch
 */
export async function completeOrderItems(orderItemIds: string[]): Promise<void> {
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const request: CompleteBatchRequest = {
    order_item_ids: orderItemIds,
    completed_by_id: userId
  };

  const response = await fetch(DISPATCH_ENDPOINTS.COMPLETE_ITEMS, createRequestOptions('POST', request));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to complete order items');
  }
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