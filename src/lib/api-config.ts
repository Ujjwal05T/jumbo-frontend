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
  BASE: API_BASE_URL,
  BASE_URL: API_BASE_URL,
  CLIENTS: `${API_BASE_URL}/clients`,
  PAPERS: `${API_BASE_URL}/papers`,
  USERS: `${API_BASE_URL}/users`,
  ORDERS: `${API_BASE_URL}/orders`,
  ORDERS_WITH_SUMMARY: `${API_BASE_URL}/orders/with-summary`,
  PENDING_ORDERS: `${API_BASE_URL}/pending-order-items`,
  PENDING_ORDER_ITEMS: `${API_BASE_URL}/pending-order-items`,
  PLANS: `${API_BASE_URL}/plans`,
  PLAN_ORDER_ITEMS: (planId: string) => `${API_BASE_URL}/plans/${planId}/order-items`,
  MANUAL_CUT_ROLLS: `${API_BASE_URL}/manual-cut-rolls`,
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
  START_PRODUCTION_WITH_BACKUP: (planId: string) => `${API_BASE_URL}/plans/${planId}/start-production-with-backup`,
  COMPLETE_PLAN: (planId: string) => `${API_BASE_URL}/optimizer/plans/${planId}/complete`,

  // Rollback endpoints
  ROLLBACK_STATUS: (planId: string) => `${API_BASE_URL}/plans/${planId}/rollback-status`,
  ROLLBACK_PLAN: (planId: string) => `${API_BASE_URL}/plans/${planId}/rollback`,
  CLEANUP_SNAPSHOTS: `${API_BASE_URL}/cleanup-expired-snapshots`,
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
  WASTAGE_INVENTORY_ITEMS: `${API_BASE_URL}/dispatch/wastage-inventory-items`,  // NEW: Wastage items
  PREVIEW_DISPATCH_NUMBER: `${API_BASE_URL}/dispatch/preview-number`,  // NEW: Preview dispatch number
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

// Reports endpoints
export const REPORTS_ENDPOINTS = {
  PAPER_WISE: `${API_BASE_URL}/reports/paper-wise`,
  CLIENT_WISE: `${API_BASE_URL}/reports/client-wise`,
  DATE_WISE: `${API_BASE_URL}/reports/date-wise`,
  SUMMARY: `${API_BASE_URL}/reports/summary`,

  // Order Analysis endpoints
  ORDER_ANALYSIS: {
    STATUS_DISTRIBUTION: `${API_BASE_URL}/reports/order-analysis/status-distribution`,
    FULFILLMENT_PROGRESS: `${API_BASE_URL}/reports/order-analysis/fulfillment-progress`,
    TIMELINE: `${API_BASE_URL}/reports/order-analysis/timeline`,
    PENDING_ORDERS: `${API_BASE_URL}/reports/order-analysis/pending-orders`,
    DISPATCH_TRACKING: `${API_BASE_URL}/reports/order-analysis/dispatch-tracking`,
    OVERDUE_ORDERS: `${API_BASE_URL}/reports/order-analysis/overdue-orders`,
    DETAILED_BREAKDOWN: `${API_BASE_URL}/reports/order-analysis/detailed-breakdown`,
    ORDERS_LIST: `${API_BASE_URL}/reports/order-analysis/orders-list`,
    ORDER_DETAILS: (orderId: string) => `${API_BASE_URL}/reports/order-analysis/order-details/${orderId}`,
  },

  // Order Tracking and Mismatch Detection endpoints
  ORDER_TRACKING: `${API_BASE_URL}/reports/order-tracking`,
  ORDER_TRACKING_FIX: `${API_BASE_URL}/reports/order-tracking/fix-allocation`,
  ORDER_TRACKING_BATCH_FIX: `${API_BASE_URL}/reports/order-tracking/batch-fix`,
  ORDER_TRACKING_SYSTEM_HEALTH: `${API_BASE_URL}/reports/order-tracking/system-health`,

  // Client Orders with Plans endpoint
  CLIENT_ORDERS_WITH_PLANS: `${API_BASE_URL}/reports/client-orders-with-plans`,

  // Order Plan Execution Report endpoint (merged report)
  ORDER_PLAN_EXECUTION: `${API_BASE_URL}/reports/order-plan-execution`,

  // Client Order Summary Report endpoints (new report)
  CLIENT_ORDER_SUMMARY: `${API_BASE_URL}/reports/client-order-summary`,
  CLIENT_ORDER_CUT_ROLLS: (orderFrontendId: string) => `${API_BASE_URL}/reports/client-order-summary/${orderFrontendId}/cut-rolls`,

  // Cut Rolls Weight Update Report endpoint (new report)
  CUT_ROLLS_WEIGHT_UPDATE: (fromDate: string, toDate: string) => `${API_BASE_URL}/reports/cut-rolls-weight-update?from_date=${fromDate}&to_date=${toDate}`,
};

// Order Edit Logs endpoints
export const ORDER_EDIT_LOG_ENDPOINTS = {
  ORDER_EDIT_LOGS: `${API_BASE_URL}/order-edit-logs`,
  ORDER_EDIT_LOGS_BY_ORDER: (orderId: string) => `${API_BASE_URL}/order-edit-logs/order/${orderId}`,
  RECENT_ORDER_EDIT_LOGS: `${API_BASE_URL}/order-edit-logs/recent`,
  ORDER_EDIT_LOG_ACTIONS: `${API_BASE_URL}/order-edit-logs/actions`,
};

// Material Management endpoints
export const MATERIAL_ENDPOINTS = {
  MATERIALS: `${API_BASE_URL}/materials`,
  MATERIAL_BY_ID: (materialId: string) => `${API_BASE_URL}/materials/${materialId}`,
  INWARD_CHALLANS: `${API_BASE_URL}/inward-challans`,
  INWARD_CHALLAN_BY_ID: (challanId: string) => `${API_BASE_URL}/inward-challans/${challanId}`,
  OUTWARD_CHALLANS: `${API_BASE_URL}/outward-challans`,
  OUTWARD_CHALLAN_BY_ID: (challanId: string) => `${API_BASE_URL}/outward-challans/${challanId}`,
};

// Roll Tracking endpoints
export const ROLL_TRACKING_ENDPOINTS = {
  TRACK_ROLL: (identifier: string) => `${API_BASE_URL}/track/roll/${encodeURIComponent(identifier)}`,
  SEARCH_ROLLS: `${API_BASE_URL}/track/search`,
  SEARCH_BY_SPECS: `${API_BASE_URL}/track/search-by-specs`,
  TRACK_HIERARCHY: (barcode: string) => `${API_BASE_URL}/track/hierarchy/${encodeURIComponent(barcode)}`,
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