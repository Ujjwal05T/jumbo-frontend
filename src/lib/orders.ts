export interface OrderItem {
  id: string;
  frontend_id?: string; // Human-readable order item ID (e.g., ORI-001)
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
  frontend_id?: string; // Human-readable order ID (e.g., ORD-2025-001)
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
  width_inches: any;
  quantity_rolls?: any;
  quantity_kg?: any;
  rate: any;
  amount?: any;
}

export interface CreateOrderData {
  client_id: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  payment_type: 'bill' | 'cash';
  delivery_date?: string;
  created_by_id: string;
  order_items: CreateOrderItemData[]; // Properly typed order items
}

// Helper function to get weight multiplier based on GSM
export const getWeightMultiplier = (gsm: number): number => {
  if (gsm <= 70) return 10;
  if (gsm <= 80) return 11;
  if (gsm <= 100) return 12.7;
  if (gsm <= 120) return 13;
  return 13.3; // 140 gsm and above
};

// Helper functions for calculations using GSM-based weight multipliers
export const calculateQuantityKg = (widthInches: number, quantityRolls: number, gsm: number): number => {
  const weightMultiplier = getWeightMultiplier(gsm);
  return widthInches * quantityRolls * weightMultiplier;
};

export const calculateQuantityRolls = (widthInches: number, quantityKg: number, gsm: number): number => {
  if (widthInches <= 0) return 0;
  const weightMultiplier = getWeightMultiplier(gsm);
  return Math.round(quantityKg / (widthInches * weightMultiplier));
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

export const fetchOrder = async (id: string): Promise<Order> => {
  const response = await fetch(`${MASTER_ENDPOINTS.ORDERS}/${id}`, createRequestOptions('GET'));
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to fetch order');
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

export const updateOrder = async (id: string, orderData: {
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  payment_type?: 'bill' | 'cash';
  delivery_date?: string | null;
  order_items: CreateOrderItemData[];
}): Promise<Order> => {
  const response = await fetch(`${MASTER_ENDPOINTS.ORDERS}/${id}/with-items`, createRequestOptions('PUT', orderData));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to update order');
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

export const deleteOrder = async (id: string): Promise<void> => {
  const response = await fetch(`${MASTER_ENDPOINTS.ORDERS}/${id}`, createRequestOptions('DELETE'));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to delete order');
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
