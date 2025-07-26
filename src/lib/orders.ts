export interface Order {
  id: string;
  client_id: string;
  paper_id: string;
  width_inches: number;
  quantity_rolls: number;
  quantity_fulfilled: number;
  min_length?: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
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
  paper: {
    id: string;
    name: string;
    gsm: number;
    bf: number;
    shade: string;
    type: string;
  };
}

export interface CreateOrderData {
  client_id: string;
  paper_id: string;
  width_inches: number;
  quantity_rolls: number;
  min_length: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_by_id: string;
}

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
    throw new Error(errorData.message || 'Failed to create order');
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
