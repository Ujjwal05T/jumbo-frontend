/**
 * API functions for Gupta Publishing House completion orders
 */

import { API_BASE_URL } from './api-config';

export interface RequiredRoll {
  width_inches: number;
  paper_id: string;
  rate: number;
}

export interface CreateGuptaOrderRequest {
  required_rolls: RequiredRoll[];
  created_by_id: string;
  notes?: string;
}

export interface GuptaOrderResponse {
  order: {
    id: string;
    frontend_id: string;
    client_id: string;
    client_name: string;
    status: string;
    priority: string;
    payment_type: string;
    created_at: string;
    total_items: number;
    total_amount: number;
  };
  order_items: Array<{
    id: string;
    paper_id: string;
    width_inches: number;
    quantity_rolls: number;
    quantity_kg: number;
    rate: number;
    amount: number;
  }>;
  message: string;
}

export const createGuptaCompletionOrder = async (
  request: CreateGuptaOrderRequest
): Promise<GuptaOrderResponse> => {
  const url = `${API_BASE_URL}/orders/create-gupta-completion-order`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gupta order creation error:', errorText);
      
      if (errorText.includes('<!DOCTYPE') || errorText.includes('<html>')) {
        throw new Error(`API endpoint not found. Backend may not be running.`);
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Expected JSON response but got ${contentType}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Gupta order API error:', error);
    throw error;
  }
};

// Convert Gupta order response to cut_rolls format for production
export const convertGuptaOrderToCutRolls = (
  guptaOrder: GuptaOrderResponse,
  partialJumboSpecs: {
    gsm: number;
    bf: number;
    shade: string;
    maxRollNumber: number;
  }
) => {
  return guptaOrder.order_items.map((item, index) => ({
    width_inches: item.width_inches,
    gsm: partialJumboSpecs.gsm,
    bf: partialJumboSpecs.bf,
    shade: partialJumboSpecs.shade,
    individual_roll_number: partialJumboSpecs.maxRollNumber + 1 + index,
    paper_id: item.paper_id,
    order_id: guptaOrder.order.id,
    order_item_id: item.id,
    source_type: "regular_order",
    completion_context: {
      purpose: "partial_jumbo_completion",
      gupta_order_id: guptaOrder.order.frontend_id,
      created_at: new Date().toISOString()
    }
  }));
};