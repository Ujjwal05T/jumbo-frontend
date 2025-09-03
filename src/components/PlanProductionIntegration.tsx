/**
 * Example integration of PartialJumboCompleter with existing plan/production workflow
 * This shows how to integrate the partial jumbo completion into your existing pages
 */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayCircle, Package, CheckCircle } from "lucide-react";
import PartialJumboCompleter from "@/components/PartialJumboCompleter";

interface PlanProductionIntegrationProps {
  planId: string;
  initialPlanData: any;
  currentUserId: string;
  onStartProduction: (planData: any) => Promise<void>;
}

export default function PlanProductionIntegration({
  planId,
  initialPlanData,
  currentUserId,
  onStartProduction
}: PlanProductionIntegrationProps) {
  const [planData, setPlanData] = useState(initialPlanData);
  const [isStartingProduction, setIsStartingProduction] = useState(false);

  const handlePlanUpdate = (updatedPlanData: any) => {
    setPlanData(updatedPlanData);
    toast.success("Plan updated with additional rolls");
  };

  const handleStartProduction = async () => {
    try {
      setIsStartingProduction(true);
      await onStartProduction(planData);
      toast.success("Production started successfully!");
    } catch (error) {
      console.error('Error starting production:', error);
      toast.error("Failed to start production");
    } finally {
      setIsStartingProduction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Plan Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Plan Summary
          </CardTitle>
          <CardDescription>
            Review plan details and complete partial jumbos before starting production
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {planData?.selected_cut_rolls?.length || 0}
              </div>
              <div className="text-sm text-blue-600">Total Cut Rolls</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">
                {Math.ceil((planData?.selected_cut_rolls?.length || 0) / 3)}
              </div>
              <div className="text-sm text-green-600">Jumbos Needed</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">
                {planData?.selected_cut_rolls?.reduce((sum: number, roll: any) => 
                  sum + (roll.width_inches * 13), 0)?.toFixed(0) || 0}
              </div>
              <div className="text-sm text-purple-600">Total Weight (kg)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Partial Jumbo Completion */}
      <PartialJumboCompleter
        planData={planData}
        onPlanUpdate={handlePlanUpdate}
        currentUserId={currentUserId}
      />

      {/* Production Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5" />
            Start Production
          </CardTitle>
          <CardDescription>
            Ready to begin production? This will create inventory and update order statuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Production Ready</div>
              <div className="text-sm text-muted-foreground">
                All jumbos are complete and ready for production
              </div>
            </div>
            <Button
              onClick={handleStartProduction}
              disabled={isStartingProduction}
              size="lg"
              className="min-w-32"
            >
              {isStartingProduction ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Starting...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Start Production
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Example usage in your existing plan page:
/*
export default function PlanDetailsPage({ planId }: { planId: string }) {
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleStartProduction = async (finalPlanData: any) => {
    // Call your existing start production API
    await fetch(`/api/plans/${planId}/start-production`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPlanData)
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Plan Details</h1>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <PlanProductionIntegration
            planId={planId}
            initialPlanData={planData}
            currentUserId="current-user-id"
            onStartProduction={handleStartProduction}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
*/