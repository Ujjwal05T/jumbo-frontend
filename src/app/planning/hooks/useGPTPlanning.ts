/**
 * Custom hook for GPT-powered smart planning functionality
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { GPT_PLANNING_ENDPOINTS, createRequestOptions } from '@/lib/api-config';

// Type definitions for GPT planning API
interface PlanningCriteria {
  prioritize_pending?: boolean;
  max_pending_days?: number;
  prefer_complete_orders?: boolean;
  client_priority_list?: string[];
}

interface SmartPlanRequest {
  candidate_order_ids: string[];
  include_pending?: boolean;
  max_batch_size?: number;
  planning_criteria?: PlanningCriteria;
}

interface GPTAnalysis {
  recommended_orders: string[];
  deferred_orders: string[];
  reasoning: string;
  confidence: number;
  expected_pending: number;
}

interface PerformanceMetrics {
  gpt_response_time: number;
  optimization_time: number;
  total_time: number;
}

interface SmartPlanResponse {
  status: string;
  gpt_analysis?: GPTAnalysis;
  optimization_result?: any;
  performance_metrics: PerformanceMetrics;
  error_message?: string;
}

interface GPTStatus {
  available: boolean;
  configured: boolean;
  model?: string;
  enabled: boolean;
}

export const useGPTPlanning = () => {
  const [isGeneratingSmartPlan, setIsGeneratingSmartPlan] = useState(false);
  const [gptStatus, setGptStatus] = useState<GPTStatus | null>(null);
  const [lastGptAnalysis, setLastGptAnalysis] = useState<GPTAnalysis | null>(null);

  // Check GPT service status
  const checkGPTStatus = useCallback(async (): Promise<GPTStatus | null> => {
    try {
      const response = await fetch(GPT_PLANNING_ENDPOINTS.STATUS, createRequestOptions('GET'));
      if (!response.ok) {
        throw new Error('Failed to check GPT status');
      }
      const status = await response.json();
      setGptStatus(status);
      return status;
    } catch (error) {
      console.error('Error checking GPT status:', error);
      const fallbackStatus = { available: false, configured: false, enabled: false };
      setGptStatus(fallbackStatus);
      return fallbackStatus;
    }
  }, []);

  // Generate smart plan using GPT + optimization
  const generateSmartPlan = useCallback(async (
    selectedOrderIds: string[],
    options?: {
      includePending?: boolean;
      maxBatchSize?: number;
      criteria?: PlanningCriteria;
    }
  ) => {
    if (selectedOrderIds.length === 0) {
      toast.error('Please select at least one order for smart planning');
      return null;
    }

    setIsGeneratingSmartPlan(true);
    
    try {
      const request: SmartPlanRequest = {
        candidate_order_ids: selectedOrderIds,
        include_pending: options?.includePending ?? true,
        max_batch_size: options?.maxBatchSize,
        planning_criteria: options?.criteria
      };

      const response = await fetch(GPT_PLANNING_ENDPOINTS.SMART_PLAN, createRequestOptions('POST', request));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const result: SmartPlanResponse = await response.json();
      
      if (result.status === 'success') {
        if (result.gpt_analysis) {
          setLastGptAnalysis(result.gpt_analysis);
          
          // Show success message with GPT insights
          toast.success(
            `Smart plan generated! GPT analyzed ${selectedOrderIds.length} orders and recommended ${result.gpt_analysis.recommended_orders.length} for optimal results.`,
            {
              description: `Confidence: ${(result.gpt_analysis.confidence * 100).toFixed(0)}% | Total time: ${result.performance_metrics.total_time.toFixed(2)}s`,
              duration: 5000,
            }
          );
        }
        
        return result;
      } else {
        // Handle error response
        throw new Error(result.error_message || 'Smart planning failed');
      }
      
    } catch (error) {
      console.error('Smart planning error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Smart planning failed';
      
      toast.error('Smart Planning Failed', {
        description: `${errorMessage}. Try using traditional "Generate Plan" instead.`,
        duration: 6000,
      });
      
      return null;
    } finally {
      setIsGeneratingSmartPlan(false);
    }
  }, []);

  // Generate smart plan with automatic fallback
  const generateSmartPlanWithFallback = useCallback(async (
    selectedOrderIds: string[],
    options?: {
      includePending?: boolean;
      maxBatchSize?: number;
      criteria?: PlanningCriteria;
    }
  ) => {
    if (selectedOrderIds.length === 0) {
      toast.error('Please select at least one order for planning');
      return null;
    }

    setIsGeneratingSmartPlan(true);
     
    try {
      const request: SmartPlanRequest = {
        candidate_order_ids: selectedOrderIds,
        include_pending: options?.includePending ?? true,
        max_batch_size: options?.maxBatchSize,
        planning_criteria: options?.criteria
      };

      const response = await fetch(GPT_PLANNING_ENDPOINTS.SMART_PLAN_WITH_FALLBACK, createRequestOptions('POST', request));

      if (!response.ok) {
        throw new Error(`Planning failed with status ${response.status}`);
      }

      const result: SmartPlanResponse = await response.json();
      
      if (result.gpt_analysis) {
        setLastGptAnalysis(result.gpt_analysis);
        toast.success(
          `Smart plan generated! GPT recommended ${result.gpt_analysis.recommended_orders.length} orders.`,
          {
            description: `Confidence: ${(result.gpt_analysis.confidence * 100).toFixed(0)}%`,
            duration: 4000,
          }
        );
      } else if (result.error_message?.includes('traditional')) {
        toast.info('GPT unavailable - used traditional optimization instead', {
          duration: 3000,
        });
      }
      
      return result;
      
    } catch (error) {
      console.error('Planning error:', error);
      toast.error('Planning failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      return null;
    } finally {
      setIsGeneratingSmartPlan(false);
    }
  }, []);

  // Get quick GPT analysis without optimization
  const getQuickGPTAnalysis = useCallback(async (
    selectedOrderIds: string[],
    options?: {
      includePending?: boolean;
      criteria?: PlanningCriteria;
    }
  ) => {
    try {
      const request: SmartPlanRequest = {
        candidate_order_ids: selectedOrderIds,
        include_pending: options?.includePending ?? true,
        planning_criteria: options?.criteria
      };

      const response = await fetch(GPT_PLANNING_ENDPOINTS.QUICK_ANALYSIS, createRequestOptions('POST', request));

      if (!response.ok) {
        throw new Error(`Analysis failed with status ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === 'success' && result.gpt_analysis) {
        setLastGptAnalysis(result.gpt_analysis);
        return result.gpt_analysis;
      }
      
      return null;
      
    } catch (error) {
      console.error('Quick GPT analysis error:', error);
      return null;
    }
  }, []);

  return {
    // State
    isGeneratingSmartPlan,
    gptStatus,
    lastGptAnalysis,
    
    // Actions
    checkGPTStatus,
    generateSmartPlan,
    generateSmartPlanWithFallback,
    getQuickGPTAnalysis,
    
    // Computed properties
    isGPTAvailable: gptStatus?.available ?? false,
    isGPTConfigured: gptStatus?.configured ?? false,
  };
};