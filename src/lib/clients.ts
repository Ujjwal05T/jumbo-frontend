/**
 * Client API utilities
 */

import { MASTER_ENDPOINTS, createRequestOptions } from './api-config';

export interface Client {
  id: string;
  frontend_id?: string; // Human-readable client ID (e.g., CL-001)
  company_name: string;
  email?: string;
  gst_number?: string;
  address: string;
  contact_person: string;
  phone?: string;
  status: 'active' | 'inactive';
  created_by_id: string;
  created_at: string;
}

export interface CreateClientData {
  company_name: string;
  email?: string;
  gst_number?: string;
  address: string;
  contact_person: string;
  phone?: string;
  status: 'active' | 'inactive';
  created_by_id: string;
}

export interface CreateClientFormData {
  company_name: string;
  email?: string;
  gst_number?: string;
  address: string;
  contact_person: string;
  phone?: string;
}

/**
 * Fetch all clients from the API
 */
export async function fetchClients(skip: number = 0, status: string = 'active'): Promise<Client[]> {
  const url = `${MASTER_ENDPOINTS.CLIENTS}?skip=${skip}&status=${status}`;
  console.log('Fetching clients from URL:', url);
  
  const response = await fetch(url, createRequestOptions('GET'));
  
  console.log('Clients API response:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    url: response.url,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Clients API error:', errorText);
    throw new Error(`Failed to fetch clients: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Clients data received:', data.length, 'clients');
  return data;
}

/**
 * Create a new client
 */
export async function createClient(clientData: CreateClientFormData): Promise<Client> {
  // Get the current user ID from localStorage

  const userId = localStorage.getItem('user_id');
  const username = localStorage.getItem('username');

  
  console.log('Available localStorage keys:', Object.keys(localStorage));
  console.log('Retrieved user_id:', userId);

  console.log('Retrieved username:', username);

  if (!userId || userId === 'undefined' || userId === 'null') {


    throw new Error('User not authenticated - please log in again. No valid user ID found in localStorage.');
  }

  const clientDataWithUserId: CreateClientData = {
    ...clientData,
    status: 'active', // Default to active
    created_by_id: userId
  };

  console.log('Sending client data:', clientDataWithUserId);

  const response = await fetch(MASTER_ENDPOINTS.CLIENTS, createRequestOptions('POST', clientDataWithUserId));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error Response:', errorText);
    console.error('Response status:', response.status);
    
    let errorMessage = 'Failed to create client';
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail) {
        if (Array.isArray(errorJson.detail)) {
          // Handle validation errors
          errorMessage = errorJson.detail.map((err: { loc?: string[]; msg: string }) => `${err.loc?.join('.')}: ${err.msg}`).join(', ');
        } else {
          errorMessage = errorJson.detail;
        }
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Update a client
 */
export async function updateClient(id: string, clientData: Partial<CreateClientFormData>): Promise<Client> {
  const response = await fetch(`${MASTER_ENDPOINTS.CLIENTS}/${id}`, createRequestOptions('PUT', clientData));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update client');
  }

  return response.json();
}

/**
 * Delete a client
 */
export async function deleteClient(id: string): Promise<void> {
  const response = await fetch(`${MASTER_ENDPOINTS.CLIENTS}/${id}`, createRequestOptions('DELETE'));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete client');
  }
}