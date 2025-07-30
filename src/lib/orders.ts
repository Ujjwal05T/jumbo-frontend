export interface OrderItem {
  id: string;
  order_id: string;
  paper_id: string;
  width_inches: number;
  quantity_rolls: number;
  quantity_kg: number;
  rate: number;
  amount: number;
  quantity_fulfilled: number;
  item_status: 'created' | 'in_process' | 'in_warehouse' | 'completed';
  created_at: string;
  updated_at: string;
  started_production_at?: string;
  moved_to_warehouse_at?: string;
  dispatched_at?: string;
  paper?: {
    id: string;
    name: string;
    gsm: number;
    bf: number;
    shade: string;
    type: string;
  };
}

export interface Order {
  id: string;
  client_id: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  payment_type: 'bill' | 'cash';
  status: 'created' | 'in_process' | 'completed' | 'cancelled';
  delivery_date: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  started_production_at?: string;
  moved_to_warehouse_at?: string;
  dispatched_at?: string;
  client: {
    id: string;
    company_name: string;
    contact_person: string;
    email?: string;
    gst_number?: string;
    phone: string;
    address: string;
    status: string;
  };
  order_items: OrderItem[];
}

export interface CreateOrderItemData {
  paper_id: string;
  width_inches: string | number;
  quantity_rolls?: string | number;
  quantity_kg?: string | number;
  rate: string | number;
  amount?: string | number;
}

export interface CreateOrderData {
  client_id: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  payment_type: 'bill' | 'cash';
  delivery_date?: string;
  created_by_id: string;
  order_items: CreateOrderItemData[]; // Properly typed order items
}

// Helper functions for calculations
export const calculateQuantityKg = (widthInches: number, quantityRolls: number): number => {
  return widthInches * quantityRolls * 13;
};

export const calculateQuantityRolls = (widthInches: number, quantityKg: number): number => {
  if (widthInches <= 0) return 0;
  return Math.round(quantityKg / (widthInches * 13));
};

export const calculateAmount = (quantityKg: number, rate: number): number => {
  return quantityKg * rate;
};

import { MASTER_ENDPOINTS, createRequestOptions } from './api-config';

export const fetchOrders = async (): Promise<Order[]> => {
  const response = await fetch(MASTER_ENDPOINTS.ORDERS, createRequestOptions('GET'));
  if (!response.ok) {
    throw new Error('Failed to fetch orders');
  }
  return response.json();
};

export const createOrder = async (orderData: Omit<CreateOrderData, 'created_by_id'>): Promise<Order> => {
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    throw new Error('User not authenticated');
  }

  // Validate that order_items is provided and not empty
  if (!orderData.order_items || orderData.order_items.length === 0) {
    throw new Error('At least one order item is required');
  }

  const response = await fetch(MASTER_ENDPOINTS.ORDERS, createRequestOptions('POST', {
    ...orderData,
    created_by_id: userId,
  }));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to create order');
  }

  return response.json();
};

export const updateOrderStatus = async (id: string, status: Order['status']): Promise<void> => {
  const response = await fetch(`${MASTER_ENDPOINTS.ORDERS}/${id}/status`, createRequestOptions('PATCH', { status }));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to update order status');
  }
};

// Fetch clients and papers for dropdowns
export const fetchClients = async () => {
  const response = await fetch(MASTER_ENDPOINTS.CLIENTS, createRequestOptions('GET'));
  if (!response.ok) throw new Error('Failed to fetch clients');
  return response.json();
};

export const fetchPapers = async () => {
  const response = await fetch(MASTER_ENDPOINTS.PAPERS, createRequestOptions('GET'));
  if (!response.ok) throw new Error('Failed to fetch papers');
  return response.json();
};

// Order Item API functions
export const addOrderItem = async (orderId: string, itemData: CreateOrderItemData): Promise<OrderItem> => {
  const response = await fetch(`${MASTER_ENDPOINTS.ORDERS}/${orderId}/items`, createRequestOptions('POST', itemData));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to add order item');
  }

  return response.json();
};

export const updateOrderItem = async (itemId: string, updates: Partial<CreateOrderItemData>): Promise<OrderItem> => {
  const response = await fetch(`${MASTER_ENDPOINTS.ORDERS.replace('/orders', '/order-items')}/${itemId}`, createRequestOptions('PUT', updates));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to update order item');
  }

  return response.json();
};

export const deleteOrderItem = async (itemId: string): Promise<void> => {
  const response = await fetch(`${MASTER_ENDPOINTS.ORDERS.replace('/orders', '/order-items')}/${itemId}`, createRequestOptions('DELETE'));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to delete order item');
  }
};

export const fulfillOrderItem = async (itemId: string, quantityFulfilled: number): Promise<void> => {
  const response = await fetch(`${MASTER_ENDPOINTS.ORDERS.replace('/orders', '/order-items')}/${itemId}/fulfill`, createRequestOptions('POST', { quantity_fulfilled: quantityFulfilled }));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to fulfill order item');
  }
};
