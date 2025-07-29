import { MASTER_ENDPOINTS, createRequestOptions } from './api-config';

export interface Paper {
  id: string;
  name: string;
  type: string;
  gsm: number;
  bf: number;
  shade: string;
  status: "active" | "inactive";
  created_by_id: string;
  created_at: string;
}

export interface CreatePaperData {
  name: string;
  gsm: number;
  bf: number;
  shade: string;
  type: string;
  created_by_id: string;
}

export const fetchPapers = async (): Promise<Paper[]> => {
  const response = await fetch(MASTER_ENDPOINTS.PAPERS, createRequestOptions('GET'));
  if (!response.ok) {
    throw new Error('Failed to fetch papers');
  }
  return response.json();
};

export const createPaper = async (paperData: Omit<CreatePaperData, 'created_by_id'>): Promise<Paper> => {
  // Get user ID from localStorage (assuming it's stored there after login)
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(MASTER_ENDPOINTS.PAPERS, createRequestOptions('POST', {
    ...paperData,
    created_by_id: userId,
  }));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create paper');
  }

  return response.json();
};

export const updatePaper = async (id: string, paperData: Partial<Omit<CreatePaperData, 'created_by_id'>>): Promise<Paper> => {
  const response = await fetch(`${MASTER_ENDPOINTS.PAPERS}/${id}`, createRequestOptions('PUT', paperData));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to update paper');
  }

  return response.json();
};

export const deletePaper = async (id: string): Promise<void> => {
  const response = await fetch(`${MASTER_ENDPOINTS.PAPERS}/${id}`, createRequestOptions('DELETE'));

  if (!response.ok) {
    throw new Error('Failed to delete paper');
  }
};
