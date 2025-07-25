/**
 * Client API utilities
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Client {
  id: string;
  company_name: string;
  email: string;
  address: string;
  contact_person: string;
  phone: string;
  status: 'active' | 'inactive';
  created_by_id: string;
  created_at: string;
}

export interface CreateClientData {
  company_name: string;
  email: string;
  address: string;
  contact_person: string;
  phone: string;
  status: 'active' | 'inactive';
  created_by_id: string;
}

export interface CreateClientFormData {
  company_name: string;
  email: string;
  address: string;
  contact_person: string;
  phone: string;
}

/**
 * Fetch all clients from the API
 */
export async function fetchClients(skip: number = 0, status: string = 'active'): Promise<Client[]> {
  const response = await fetch(`${API_URL}/api/clients?skip=${skip}&status=${status}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch clients');
  }

  return response.json();
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

  const response = await fetch(`${API_URL}/api/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(clientDataWithUserId),
  });

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
          errorMessage = errorJson.detail.map((err: any) => `${err.loc?.join('.')}: ${err.msg}`).join(', ');
        } else {
          errorMessage = errorJson.detail;
        }
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch (e) {
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
  const response = await fetch(`${API_URL}/api/clients/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(clientData),
  });

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
  const response = await fetch(`${API_URL}/api/clients/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete client');
  }
}