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

const API_URL = 'https://c997dd342fc6.ngrok-free.app/api';

export const fetchPapers = async (): Promise<Paper[]> => {
  const response = await fetch(`${API_URL}/papers`,{
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  }
  );
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

  const response = await fetch(`${API_URL}/papers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({
      ...paperData,
      created_by_id: userId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create paper');
  }

  return response.json();
};

export const deletePaper = async (id: string): Promise<void> => {
  const response = await fetch(`${API_URL}/papers/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete paper');
  }
};
