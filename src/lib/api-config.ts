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

// Production endpoints - Updated for new flow
export const PRODUCTION_ENDPOINTS = {
  GENERATE_PLAN: `${API_BASE_URL}/cutting/generate-with-selection`,
  SELECT_FOR_PRODUCTION: `${API_BASE_URL}/cut-rolls/select`,
  QR_SCAN: (qrCode: string) => `${API_BASE_URL}/qr/${qrCode}`,
  UPDATE_WEIGHT: `${API_BASE_URL}/qr/update-weight`,
  GENERATE_QR: `${API_BASE_URL}/qr/generate`,
  CUT_ROLLS_PLAN: (planId: string) => `${API_BASE_URL}/cut-rolls/production/${planId}`,
  PLAN_STATUS: (planId: string) => `${API_BASE_URL}/optimizer/plans/${planId}/status`,
  START_PRODUCTION: (planId: string) => `${API_BASE_URL}/plans/${planId}/start-production`,
  COMPLETE_PLAN: (planId: string) => `${API_BASE_URL}/optimizer/plans/${planId}/complete`,
};

// NEW FLOW: Workflow optimization endpoints
export const WORKFLOW_ENDPOINTS = {
  PROCESS_ORDERS: `${API_BASE_URL}/workflow/process-orders`,
  GENERATE_PLAN: `${API_BASE_URL}/workflow/generate-plan`,
  STATUS: `${API_BASE_URL}/workflow/status`,
  ORDERS_WITH_RELATIONSHIPS: `${API_BASE_URL}/optimizer/orders-with-relationships`,
};

// NEW FLOW: Cutting algorithm endpoints
export const CUTTING_ENDPOINTS = {
  GENERATE_PLAN: `${API_BASE_URL}/cutting/generate-plan`,
  VALIDATE_PLAN: `${API_BASE_URL}/cutting/validate-plan`,
  ALGORITHMS: `${API_BASE_URL}/cutting/algorithms`,
  GENERATE_WITH_SELECTION: `${API_BASE_URL}/cutting/generate-with-selection`,
};

// Status monitoring endpoints
export const STATUS_ENDPOINTS = {
  SUMMARY: `${API_BASE_URL}/status/summary`,
  VALIDATE: `${API_BASE_URL}/status/validate`,
  AUTO_UPDATE: `${API_BASE_URL}/status/auto-update`,
};

// Dispatch endpoints
export const DISPATCH_ENDPOINTS = {
  WAREHOUSE_ITEMS: `${API_BASE_URL}/dispatch/warehouse-items`,
  CREATE_DISPATCH: `${API_BASE_URL}/dispatch/create-dispatch`,
  CLIENTS: `${API_BASE_URL}/dispatch/clients`,
  PENDING_ITEMS: `${API_BASE_URL}/dispatch/pending-items`,
  COMPLETE_PENDING_ITEM: `${API_BASE_URL}/dispatch/complete-pending-item`,
  COMPLETE_ITEMS: `${API_BASE_URL}/dispatch/complete-items`,
};

// Dashboard endpoints
export const DASHBOARD_ENDPOINTS = {
  SUMMARY: `${API_BASE_URL}/dashboard/summary`,
  RECENT_ACTIVITY: `${API_BASE_URL}/dashboard/recent-activity`,
  ALERTS: `${API_BASE_URL}/dashboard/alerts`,
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