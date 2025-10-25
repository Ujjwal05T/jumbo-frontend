import { PRODUCTION_ENDPOINTS, createRequestOptions } from './api-config';

export interface RollbackStatus {
  rollback_available: boolean;
  expires_at?: string;
  remaining_minutes?: number;
  created_at?: string;
  safety_check?: {
    safe: boolean;
    reason?: string;
    suggestion?: string;
    changes_detected?: string[];
  };
  plan_status?: string;
  plan_name?: string;
  reason?: string;
  suggestion?: string;
}

export interface RollbackRequest {
  user_id: string;
}

export interface RollbackResponse {
  success: boolean;
  message: string;
  rollback_stats: {
    inventory_deleted: number;
    wastage_deleted: number;
    orders_restored: number;
    order_items_restored: number;
    pending_orders_restored: number;
    links_deleted: number;
  };
  snapshot_used_at?: string;
}

export interface ProductionResponse {
  // Your existing StartProductionResponse fields
  plan_id: string;
  status: string;
  summary: any;
  // Add rollback info
  rollback_info?: {
    rollback_available: boolean;
    expires_at?: string;
    minutes_remaining: number;
  };
}

export class RollbackApiService {
  // Get rollback status for a plan
  static async getRollbackStatus(planId: string): Promise<RollbackStatus> {
    try {
      const response = await fetch(
        PRODUCTION_ENDPOINTS.ROLLBACK_STATUS(planId),
        createRequestOptions('GET')
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to get rollback status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting rollback status:', error);
      throw error;
    }
  }

  // Execute rollback for a plan
  static async rollbackPlan(planId: string, userId: string): Promise<RollbackResponse> {
    try {
      const request: RollbackRequest = { user_id: userId };

      const response = await fetch(
        PRODUCTION_ENDPOINTS.ROLLBACK_PLAN(planId),
        createRequestOptions('POST', request)
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to rollback plan');
      }

      return await response.json();
    } catch (error) {
      console.error('Error rolling back plan:', error);
      throw error;
    }
  }

  // Start production with backup creation
  static async startProductionWithBackup(
    planId: string,
    requestData: any
  ): Promise<ProductionResponse> {
    try {
      const response = await fetch(
        PRODUCTION_ENDPOINTS.START_PRODUCTION_WITH_BACKUP(planId),
        createRequestOptions('POST', requestData)
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to start production with backup');
      }

      return await response.json();
    } catch (error) {
      console.error('Error starting production with backup:', error);
      throw error;
    }
  }

  // Clean up expired snapshots
  static async cleanupExpiredSnapshots(): Promise<{
    success: boolean;
    cleaned_snapshots: number;
    message: string;
  }> {
    try {
      const response = await fetch(
        PRODUCTION_ENDPOINTS.CLEANUP_SNAPSHOTS,
        createRequestOptions('POST')
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to cleanup snapshots');
      }

      return await response.json();
    } catch (error) {
      console.error('Error cleaning up snapshots:', error);
      throw error;
    }
  }

  // Format time remaining for display
  static formatTimeRemaining(minutes: number): string {
    if (minutes <= 0) return 'Expired';

    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  }

  // Check if rollback is available and not expired
  static isRollbackAvailable(status: RollbackStatus): boolean {
    return status.rollback_available &&
           status.remaining_minutes !== undefined &&
           status.remaining_minutes > 0;
  }

  // Get progress color based on remaining time
  static getProgressColor(minutesRemaining: number): 'success' | 'warning' | 'error' {
    if (minutesRemaining > 7) return 'success';
    if (minutesRemaining > 3) return 'warning';
    return 'error';
  }

  // Get progress value for timer bar
  static getProgressValue(minutesRemaining: number): number {
    return Math.max(0, Math.min(100, (minutesRemaining / 10) * 100));
  }
}