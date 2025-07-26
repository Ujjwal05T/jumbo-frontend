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
  created_at: string;
  updated_at: string;
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
  status: 'pending' | 'processing' | 'partially_fulfilled' | 'completed' | 'cancelled';
  delivery_date: string | null;
  notes: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  client: {
    id: string;
    company_name: string;
    contact_person: string;
    email: string;
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
  notes?: string;
  created_by_id: string;
  order_items: any[]; // Allow flexible typing for order items
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

const API_URL = 'http://localhost:8000/api';

export const fetchOrders = async (): Promise<Order[]> => {
  const response = await fetch(`${API_URL}/orders`);
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

  const response = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...orderData,
      created_by_id: userId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to create order');
  }

  return response.json();
};

export const updateOrderStatus = async (id: string, status: Order['status']): Promise<void> => {
  const response = await fetch(`${API_URL}/orders/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to update order status');
  }
};

// Fetch clients and papers for dropdowns
export const fetchClients = async () => {
  const response = await fetch(`${API_URL}/clients`);
  if (!response.ok) throw new Error('Failed to fetch clients');
  return response.json();
};

export const fetchPapers = async () => {
  const response = await fetch(`${API_URL}/papers`);
  if (!response.ok) throw new Error('Failed to fetch papers');
  return response.json();
};

// Order Item API functions
export const addOrderItem = async (orderId: string, itemData: CreateOrderItemData): Promise<OrderItem> => {
  const response = await fetch(`${API_URL}/orders/${orderId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(itemData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to add order item');
  }

  return response.json();
};

export const updateOrderItem = async (itemId: string, updates: Partial<CreateOrderItemData>): Promise<OrderItem> => {
  const response = await fetch(`${API_URL}/order-items/${itemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to update order item');
  }

  return response.json();
};

export const deleteOrderItem = async (itemId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/order-items/${itemId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to delete order item');
  }
};

export const fulfillOrderItem = async (itemId: string, quantityFulfilled: number): Promise<void> => {
  const response = await fetch(`${API_URL}/order-items/${itemId}/fulfill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ quantity_fulfilled: quantityFulfilled }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to fulfill order item');
  }
};
