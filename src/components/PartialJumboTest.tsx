/**
 * Simple test component to debug partial jumbo detection
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PartialJumboCompleter from "@/components/PartialJumboCompleter";

export default function PartialJumboTest() {
  // Mock plan data with a partial jumbo (5 rolls = 1 full jumbo + 2 partial)
  const [planData] = useState({
    selected_cut_rolls: [
      {
        width_inches: 36,
        gsm: 90,
        bf: 18,
        shade: "White",
        individual_roll_number: 1,
        paper_id: "test-paper-id",
        order_id: "test-order-1",
        source_type: "regular_order"
      },
      {
        width_inches: 30,
        gsm: 90,
        bf: 18,
        shade: "White", 
        individual_roll_number: 2,
        paper_id: "test-paper-id",
        order_id: "test-order-1",
        source_type: "regular_order"
      },
      {
        width_inches: 42,
        gsm: 90,
        bf: 18,
        shade: "White",
        individual_roll_number: 3,
        paper_id: "test-paper-id",
        order_id: "test-order-1", 
        source_type: "regular_order"
      },
      // These 2 rolls create a partial jumbo (need 1 more to complete)
      {
        width_inches: 38,
        gsm: 90,
        bf: 18,
        shade: "White",
        individual_roll_number: 4,
        paper_id: "test-paper-id",
        order_id: "test-order-2",
        source_type: "regular_order"
      },
      {
        width_inches: 34,
        gsm: 90,
        bf: 18,
        shade: "White",
        individual_roll_number: 5,
        paper_id: "test-paper-id",
        order_id: "test-order-2",
        source_type: "regular_order"
      }
    ]
  });

  const handlePlanUpdate = (newPlanData: any) => {
    console.log("Plan updated:", newPlanData);
  };

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Partial Jumbo Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Test Data:</strong></p>
            <p>• Paper Spec: 90GSM, 18BF, White</p>
            <p>• Total Rolls: {planData.selected_cut_rolls.length}</p>
            <p>• Expected: 1 complete jumbo (3 rolls) + 1 partial jumbo (2 rolls)</p>
            <p>• Should show "Add Rolls" option for the partial jumbo</p>
          </div>
        </CardContent>
      </Card>

      <PartialJumboCompleter
        planData={planData}
        onPlanUpdate={handlePlanUpdate}
        currentUserId="test-user-id"
      />
    </div>
  );
}