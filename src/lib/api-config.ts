/**
 * Centralized API configuration
 */

// Base API URL from environment variable
/* eslint-disable */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Common headers for API requests
export const API_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

// Auth endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
};

// Master endpoints
export const MASTER_ENDPOINTS = {
  CLIENTS: `${API_BASE_URL}/clients`,
  PAPERS: `${API_BASE_URL}/papers`,
  USERS: `${API_BASE_URL}/users`,
  ORDERS: `${API_BASE_URL}/orders`,
  PENDING_ORDERS: `${API_BASE_URL}/pending-order-items`,
  PLANS: `${API_BASE_URL}/plans`,
};

// Production endpoints
export const PRODUCTION_ENDPOINTS = {
  GENERATE_PLAN: `${API_BASE_URL}/plans/generate-with-selection`,
  SELECT_FOR_PRODUCTION: `${API_BASE_URL}/cut-rolls/select-for-production`,
  QR_SCAN: `${API_BASE_URL}/qr-scan`,
  UPDATE_WEIGHT: `${API_BASE_URL}/qr-scan/update-weight`,
  CUT_ROLLS_PLAN: (planId: string) => `${API_BASE_URL}/cut-rolls/plan/${planId}`,
  PLAN_STATUS: (planId: string) => `${API_BASE_URL}/plans/${planId}/status`,
};

/**
 * Helper function to create API request options
 */
export const createRequestOptions = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: any,
  additionalHeaders?: Record<string, string>
): RequestInit => {
  const options: RequestInit = {
    method,
    headers: { 
      ...API_HEADERS, 
      ...additionalHeaders 
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  return options;
};