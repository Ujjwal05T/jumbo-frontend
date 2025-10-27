/**
 * Plan Deletion Logs API Service
 * Handles fetching and filtering plan deletion audit logs
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface PlanDeletionLog {
  id: string;
  plan_id: string | null;
  plan_frontend_id: string;
  plan_name: string | null;
  deleted_at: string;
  deleted_by_id: string;
  deletion_reason: string;
  rollback_stats?: any;
  rollback_duration_seconds?: number;
  success_status: string;
  error_message?: string;
  deleted_by_user?: {
    id: string;
    name: string;
    username: string;
  };
}

export interface DeletionLogsFilter {
  plan_id?: string;
  user_id?: string;
  deletion_reason?: string;
  start_date?: string;
  end_date?: string;
  success_status?: string;
}

export interface DeletionLogsResponse {
  logs: PlanDeletionLog[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Get plan deletion logs with optional filtering and pagination
 */
export async function getDeletionLogs(
  filter?: DeletionLogsFilter,
  page: number = 1,
  pageSize: number = 20
): Promise<DeletionLogsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  // Add filter parameters
  if (filter) {
    if (filter.plan_id) params.append('plan_id', filter.plan_id);
    if (filter.user_id) params.append('user_id', filter.user_id);
    if (filter.deletion_reason) params.append('deletion_reason', filter.deletion_reason);
    if (filter.start_date) params.append('start_date', filter.start_date);
    if (filter.end_date) params.append('end_date', filter.end_date);
    if (filter.success_status) params.append('success_status', filter.success_status);
  }

  const response = await fetch(`${API_BASE}/deletion-logs?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch deletion logs');
  }

  return response.json();
}

/**
 * Get deletion logs for a specific plan
 */
export async function getDeletionLogsByPlan(planId: string): Promise<PlanDeletionLog[]> {
  const response = await fetch(`${API_BASE}/deletion-logs/plan/${planId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch plan deletion logs');
  }

  return response.json();
}

/**
 * Get deletion logs for a specific user
 */
export async function getDeletionLogsByUser(userId: string): Promise<PlanDeletionLog[]> {
  const response = await fetch(`${API_BASE}/deletion-logs/user/${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch user deletion logs');
  }

  return response.json();
}

/**
 * Get recent deletion logs
 */
export async function getRecentDeletionLogs(limit: number = 10): Promise<PlanDeletionLog[]> {
  const response = await fetch(`${API_BASE}/deletion-logs/recent?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch recent deletion logs');
  }

  return response.json();
}

/**
 * Format deletion reason for display
 */
export function formatDeletionReason(reason: string): string {
  switch (reason) {
    case 'rollback':
      return 'Rollback';
    case 'manual':
      return 'Manual Deletion';
    case 'system':
      return 'System Cleanup';
    default:
      return reason.charAt(0).toUpperCase() + reason.slice(1);
  }
}

/**
 * Format success status for display
 */
export function formatSuccessStatus(status: string): string {
  switch (status) {
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'partial':
      return 'Partial Success';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Get status color for display
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'success':
      return 'text-green-600 bg-green-100';
    case 'failed':
      return 'text-red-600 bg-red-100';
    case 'partial':
      return 'text-yellow-600 bg-yellow-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * Format duration for display
 */
export function formatDuration(seconds?: number): string {
  if (!seconds) return 'N/A';

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}