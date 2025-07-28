/**
 * API functions for pending order items
 */
/* eslint-disable */
export interface PendingOrderItem {
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
}

export interface PendingOrderItemCreate {
  original_order_id: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  quantity_pending: number;
  reason?: string;
  created_by_id?: string;
}

export interface PendingOrderItemUpdate {
  status?: "pending" | "in_production" | "resolved" | "cancelled";
  production_order_id?: string;
  resolved_at?: string;
}

import { MASTER_ENDPOINTS, createRequestOptions } from './api-config';

// Get all pending order items
export async function getPendingOrderItems(
  status: string = 'pending',
  skip: number = 0,
  limit: number = 100
): Promise<PendingOrderItem[]> {
  const params = new URLSearchParams({
    status,
    skip: skip.toString(),
    limit: limit.toString(),
  });

  // Try new endpoint first, fallback to legacy
  try {
    const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}?${params}`, createRequestOptions('GET'));
    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.warn('New endpoint failed, trying legacy:', error);
  }

  // Fallback to legacy endpoint
  const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS.replace('pending-order-items', 'pending-orders')}?${params}`, createRequestOptions('GET'));
  if (!response.ok) {
    throw new Error(`Failed to fetch pending order items: ${response.status}`);
  }
  return response.json();
}

// Get a single pending order item
export async function getPendingOrderItem(itemId: string): Promise<PendingOrderItem> {
  const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/${itemId}`, createRequestOptions('GET'));
  if (!response.ok) {
    throw new Error(`Failed to fetch pending order item: ${response.status}`);
  }
  return response.json();
}

// Create a new pending order item
export async function createPendingOrderItem(item: PendingOrderItemCreate): Promise<PendingOrderItem> {
  const response = await fetch(MASTER_ENDPOINTS.PENDING_ORDERS, createRequestOptions('POST', item));

  if (!response.ok) {
    throw new Error(`Failed to create pending order item: ${response.status}`);
  }
  return response.json();
}

// Update a pending order item
export async function updatePendingOrderItem(
  itemId: string,
  updates: PendingOrderItemUpdate
): Promise<PendingOrderItem> {
  const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/${itemId}`, createRequestOptions('PUT', updates));

  if (!response.ok) {
    throw new Error(`Failed to update pending order item: ${response.status}`);
  }
  return response.json();
}

// Get pending items summary
export async function getPendingItemsSummary(): Promise<any> {
  const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/summary`, createRequestOptions('GET'));
  if (!response.ok) {
    throw new Error(`Failed to fetch pending items summary: ${response.status}`);
  }
  return response.json();
}

// Get consolidation opportunities
export async function getConsolidationOpportunities(): Promise<any> {
  const response = await fetch(`${MASTER_ENDPOINTS.PENDING_ORDERS}/consolidation`, createRequestOptions('GET'));
  if (!response.ok) {
    throw new Error(`Failed to fetch consolidation opportunities: ${response.status}`);
  }
  return response.json();
}