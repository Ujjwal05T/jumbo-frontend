/**
 * Material Management API utilities
 */

import { MATERIAL_ENDPOINTS, createRequestOptions } from './api-config';

// Types
export interface Material {
  id: string;
  name: string;
  unit_of_measure: string;
  current_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialData {
  name: string;
  unit_of_measure: string;
  current_quantity: number;
}

export interface InwardChallan {
  id: string;
  serial_no?: string;
  date: string;
  party_id: string;
  vehicle_number?: string;
  material_id: string;
  slip_no?: string;
  rst_no?: string;
  gross_weight?: number;
  report?: number;
  net_weight?: number;
  final_weight?: number;
  rate?: number;
  bill_no?: string;
  cash?: number;
  time_in?: string;
  time_out?: string;
  created_at: string;
}

export interface CreateInwardChallanData {
  party_id: string;
  vehicle_number?: string;
  material_id: string;
  slip_no?: string;
  rst_no?: string;
  gross_weight?: number;
  report?: number;
  net_weight?: number;
  final_weight?: number;
  rate?: number;
  bill_no?: string;
  cash?: number;
  time_in?: string;
  time_out?: string;
  payment_type?: 'bill' | 'cash'; // Made truly optional, removed string union
}

export interface OutwardChallan {
  id: string;
  serial_no?: string;
  date: string;
  vehicle_number?: string;
  driver_name?: string;
  rst_no?: string;
  purpose?: string;
  time_in?: string;
  time_out?: string;
  party_name?: string;
  gross_weight?: number;
  net_weight?: number;
  bill_no?: string;
  created_at: string;
}

export interface CreateOutwardChallanData {
  vehicle_number?: string;
  driver_name?: string;
  rst_no?: string;
  purpose?: string;
  time_in?: string;
  time_out?: string;
  party_name?: string;
  gross_weight?: number;
  net_weight?: number;
  bill_no?: string;
}

// ============================================================================
// MATERIAL MASTER API FUNCTIONS
// ============================================================================

/**
 * Fetch all materials from the API
 */
export async function fetchMaterials(skip: number = 0, limit: number = 100): Promise<Material[]> {
  const url = `${MATERIAL_ENDPOINTS.MATERIALS}?skip=${skip}&limit=${limit}`;
  console.log('Fetching materials from URL:', url);
  
  const response = await fetch(url, createRequestOptions('GET'));
  
  console.log('Materials API response:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    url: response.url,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Materials API error:', errorText);
    throw new Error(`Failed to fetch materials: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Materials data received:', data.length, 'materials');
  return data;
}

/**
 * Fetch a single material by ID
 */
export async function fetchMaterial(materialId: string): Promise<Material> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.MATERIAL_BY_ID(materialId), 
    createRequestOptions('GET')
  );

  if (!response.ok) {
    throw new Error('Failed to fetch material');
  }

  return response.json();
}

/**
 * Create a new material
 */
export async function createMaterial(materialData: CreateMaterialData): Promise<Material> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.MATERIALS, 
    createRequestOptions('POST', materialData)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create material');
  }

  return response.json();
}

/**
 * Update a material
 */
export async function updateMaterial(materialId: string, materialData: Partial<CreateMaterialData>): Promise<Material> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.MATERIAL_BY_ID(materialId), 
    createRequestOptions('PUT', materialData)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update material');
  }

  return response.json();
}

/**
 * Delete a material
 */
export async function deleteMaterial(materialId: string): Promise<{ message: string }> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.MATERIAL_BY_ID(materialId), 
    createRequestOptions('DELETE')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete material');
  }

  return response.json();
}

// ============================================================================
// INWARD CHALLAN API FUNCTIONS
// ============================================================================

/**
 * Fetch all inward challans from the API
 */
export async function fetchInwardChallans(skip: number = 0, limit: number = 100, materialId?: string): Promise<InwardChallan[]> {
  let url = `${MATERIAL_ENDPOINTS.INWARD_CHALLANS}?skip=${skip}&limit=${limit}`;
  if (materialId) {
    url += `&material_id=${materialId}`;
  }
  
  const response = await fetch(url, createRequestOptions('GET'));

  if (!response.ok) {
    throw new Error('Failed to fetch inward challans');
  }

  return response.json();
}

/**
 * Fetch a single inward challan by ID
 */
export async function fetchInwardChallan(challanId: string): Promise<InwardChallan> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.INWARD_CHALLAN_BY_ID(challanId), 
    createRequestOptions('GET')
  );

  if (!response.ok) {
    throw new Error('Failed to fetch inward challan');
  }

  return response.json();
}

/**
 * Create a new inward challan
 */
export async function createInwardChallan(challanData: CreateInwardChallanData): Promise<InwardChallan> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.INWARD_CHALLANS, 
    createRequestOptions('POST', challanData)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create inward challan');
  }

  return response.json();
}

/**
 * Update an inward challan
 */
export async function updateInwardChallan(challanId: string, challanData: Partial<CreateInwardChallanData>): Promise<InwardChallan> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.INWARD_CHALLAN_BY_ID(challanId), 
    createRequestOptions('PUT', challanData)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update inward challan');
  }

  return response.json();
}

/**
 * Delete an inward challan
 */
export async function deleteInwardChallan(challanId: string): Promise<{ message: string }> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.INWARD_CHALLAN_BY_ID(challanId), 
    createRequestOptions('DELETE')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete inward challan');
  }

  return response.json();
}

// ============================================================================
// OUTWARD CHALLAN API FUNCTIONS
// ============================================================================

/**
 * Fetch all outward challans from the API
 */
export async function fetchOutwardChallans(skip: number = 0, limit: number = 100): Promise<OutwardChallan[]> {
  const response = await fetch(
    `${MATERIAL_ENDPOINTS.OUTWARD_CHALLANS}?skip=${skip}&limit=${limit}`, 
    createRequestOptions('GET')
  );

  if (!response.ok) {
    throw new Error('Failed to fetch outward challans');
  }

  return response.json();
}

/**
 * Fetch a single outward challan by ID
 */
export async function fetchOutwardChallan(challanId: string): Promise<OutwardChallan> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.OUTWARD_CHALLAN_BY_ID(challanId), 
    createRequestOptions('GET')
  );

  if (!response.ok) {
    throw new Error('Failed to fetch outward challan');
  }

  return response.json();
}

/**
 * Create a new outward challan
 */
export async function createOutwardChallan(challanData: CreateOutwardChallanData): Promise<OutwardChallan> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.OUTWARD_CHALLANS, 
    createRequestOptions('POST', challanData)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create outward challan');
  }

  return response.json();
}

/**
 * Update an outward challan
 */
export async function updateOutwardChallan(challanId: string, challanData: Partial<CreateOutwardChallanData>): Promise<OutwardChallan> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.OUTWARD_CHALLAN_BY_ID(challanId), 
    createRequestOptions('PUT', challanData)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update outward challan');
  }

  return response.json();
}

/**
 * Delete an outward challan
 */
export async function deleteOutwardChallan(challanId: string): Promise<{ message: string }> {
  const response = await fetch(
    MATERIAL_ENDPOINTS.OUTWARD_CHALLAN_BY_ID(challanId), 
    createRequestOptions('DELETE')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete outward challan');
  }

  return response.json();
}

// ============================================================================
// SERIAL NUMBER API FUNCTIONS
// ============================================================================

/**
 * Fetch next available serial number for inward challans
 */
export async function fetchNextInwardSerialNumber(): Promise<string> {
  const response = await fetch(
    `${MATERIAL_ENDPOINTS.INWARD_CHALLANS}/next-serial`,
    createRequestOptions('GET')
  );

  if (!response.ok) {
    // Fallback to manual generation if API doesn't support it yet
    console.warn('Next serial API not available, using fallback');
    const challans = await fetchInwardChallans(0, 1);
    const lastSerial = challans.length > 0 ? challans[0].serial_no : '00000';
    const nextNumber = lastSerial ? parseInt(lastSerial) + 1 : 1;
    return nextNumber.toString().padStart(5, '0');
  }

  const data = await response.json();
  return data.next_serial || '00001';
}

/**
 * Fetch next available serial number for outward challans
 */
export async function fetchNextOutwardSerialNumber(): Promise<string> {
  const response = await fetch(
    `${MATERIAL_ENDPOINTS.OUTWARD_CHALLANS}/next-serial`,
    createRequestOptions('GET')
  );

  if (!response.ok) {
    // Fallback to manual generation if API doesn't support it yet
    console.warn('Next serial API not available, using fallback');
    const challans = await fetchOutwardChallans(0, 1);
    const lastSerial = challans.length > 0 ? challans[0].serial_no : '00000';
    const nextNumber = lastSerial ? parseInt(lastSerial) + 1 : 1;
    return nextNumber.toString().padStart(5, '0');
  }

  const data = await response.json();
  return data.next_serial || '00001';
}