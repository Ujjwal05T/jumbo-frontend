/**
 * Wastage API functions - Handle wastage inventory operations
 */

export interface WastageInventory {
  id: string;
  reel_no: string;
  frontend_id: string;
  barcode_id: string;
  width_inches: number;
  paper_id: string;
  paper?: {
    id: string;
    type: string;
    gsm: number;
    bf: number;
    shade: string;
  };
  individual_roll_number?: number;
  source_plan_id: string;
  source_jumbo_roll_id?: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WastageResponse {
  items: WastageInventory[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface WastageStats {
  total_rolls: number;
  total_width_inches: number;
  avg_width_inches: number;
  available_rolls: number;
  used_rolls: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function fetchWastageInventory(
  page: number = 1,
  per_page: number = 20,
  search?: string
): Promise<WastageResponse> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: per_page.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    const response = await fetch(`${BASE_URL}/wastage?${params}`,
      { headers: { 'ngrok-skip-browser-warning': 'true' } }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching wastage inventory:', error);
    throw error;
  }
}

export async function fetchWastageStats(): Promise<WastageStats> {
  try {
    const response = await fetch(`${BASE_URL}/wastage/stats/summary`,
      { headers: { 'ngrok-skip-browser-warning': 'true' } }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching wastage stats:', error);
    throw error;
  }
}

export async function updateWastageStatus(
  wastage_id: string,
  status: string
): Promise<WastageInventory> {
  try {
    const response = await fetch(`${BASE_URL}/wastage/${wastage_id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating wastage status:', error);
    throw error;
  }
}

export async function deleteWastageItem(wastage_id: string): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/wastage/${wastage_id}`, {
      method: 'DELETE',
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting wastage item:', error);
    throw error;
  }
}

export interface CreateWastageRequest {
  width_inches: number;
  paper_id: string;
  weight_kg?: number;
  status?: string;
  location?: string;
  notes?: string;
  source_plan_id?: string;
  source_jumbo_roll_id?: string;
  individual_roll_number?: number;
  reel_no?: string;
}

export interface PaperMaster {
  id: string;
  frontend_id: string;
  name: string;
  gsm: number;
  bf: number;
  shade: string;
  type: string;
}

export async function fetchPapersForWastage(): Promise<PaperMaster[]> {
  try {
    const response = await fetch(`${BASE_URL}/papers`,
      { headers: { 'ngrok-skip-browser-warning': 'true' } }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching papers for wastage:', error);
    throw error;
  }
}

export async function createManualWastage(wastageData: CreateWastageRequest): Promise<WastageInventory> {
  try {
    const response = await fetch(`${BASE_URL}/wastage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(wastageData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating manual wastage:', error);
    throw error;
  }
}

export async function createTestWastageData(): Promise<WastageInventory[]> {
  try {
    const response = await fetch(`${BASE_URL}/wastage/test-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating test wastage data:', error);
    throw error;
  }
}