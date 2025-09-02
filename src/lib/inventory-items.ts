/**
 * API functions for inventory items management
 */

import { API_BASE_URL } from './api-config';

export interface InventoryItem {
  stock_id: number;
  sno_from_file?: number;
  reel_no?: string;
  gsm?: number;
  bf?: number;
  size?: string;
  weight_kg?: number;
  grade?: string;
  stock_date?: string;
  record_imported_at: string;
}

export interface InventoryItemsResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface InventoryStats {
  total_items: number;
  total_weight_kg: number;
  average_weight_kg: number;
  unique_gsm_values: number;
  unique_bf_values: number;
  unique_grades: number;
  date_range: {
    earliest: string | null;
    latest: string | null;
  };
}

export interface FilterOptions {
  gsm_options: number[];
  bf_options: number[];
  grade_options: string[];
}

export interface InventoryFilters {
  page?: number;
  per_page?: number;
  search?: string;
  gsm?: number;
  bf?: number;
  grade?: string;
  start_date?: string;
  end_date?: string;
  min_weight?: number;
  max_weight?: number;
}

const API_BASE = `${API_BASE_URL}/inventory-items`;

export const fetchInventoryItems = async (filters: InventoryFilters = {}): Promise<InventoryItemsResponse> => {
  const params = new URLSearchParams();
  
  // Add filters to params
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value.toString());
    }
  });
  
  const url = `${API_BASE}/?${params.toString()}`;
  console.log('Fetching inventory items from:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      // Check if we got HTML instead of JSON
      if (errorText.includes('<!DOCTYPE') || errorText.includes('<html>')) {
        throw new Error(`API endpoint not found. Backend may not be running or endpoint missing.`);
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Expected JSON but got ${contentType}. Check if backend is running.`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API fetch error:', error);
    throw error;
  }
};

export const fetchInventoryStats = async (): Promise<InventoryStats> => {
  try {
    const response = await fetch(`${API_BASE}/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes('<!DOCTYPE') || errorText.includes('<html>')) {
        throw new Error(`Stats API endpoint not found. Backend may not be running.`);
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Expected JSON response for stats`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Stats API error:', error);
    throw error;
  }
};

export const fetchFilterOptions = async (): Promise<FilterOptions> => {
  try {
    const response = await fetch(`${API_BASE}/filters`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes('<!DOCTYPE') || errorText.includes('<html>')) {
        throw new Error(`Filters API endpoint not found. Backend may not be running.`);
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Expected JSON response for filters`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Filters API error:', error);
    throw error;
  }
};

export const fetchInventoryItem = async (stockId: number): Promise<InventoryItem> => {
  const response = await fetch(`${API_BASE}/${stockId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

export const updateInventoryItem = async (stockId: number, data: Partial<InventoryItem>): Promise<InventoryItem> => {
  const response = await fetch(`${API_BASE}/${stockId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

export const deleteInventoryItem = async (stockId: number): Promise<void> => {
  const response = await fetch(`${API_BASE}/${stockId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
};