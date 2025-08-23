/**
 * Wastage calculation utilities for production planning
 */

import { CutRoll } from './new-flow';
import { WastageData } from './production';

export interface WastageCalculationResult {
  wastageItems: WastageData[];
  totalWastageCount: number;
  totalWastageInches: number;
  wastageByPaper: Map<string, number>;
}

/**
 * Calculate wastage from cut rolls and group by individual roll number
 * Only includes wastage >= 9 inches for inventory tracking
 */
export function calculateWastageFromCutRolls(
  cutRolls: CutRoll[],
  planId: string
): WastageCalculationResult {
  const wastageItems: WastageData[] = [];
  const wastageByPaper = new Map<string, number>();
  let totalWastageInches = 0;

  // Group cut rolls by individual_roll_number and paper specs
  const rollGroups = new Map<string, CutRoll[]>();
  
  for (const cutRoll of cutRolls) {
    console.log("🔍 WASTAGE DEBUG: Cut roll data:", cutRoll);
    console.log("🔍 WASTAGE DEBUG: individual_roll_number:", cutRoll.individual_roll_number);
    console.log("🔍 WASTAGE DEBUG: trim_left:", cutRoll.trim_left);
    
    if (!cutRoll.individual_roll_number || !cutRoll.trim_left) {
      console.log("🔍 WASTAGE DEBUG: Skipping cut roll - missing individual_roll_number or trim_left");
      continue;
    }
    
    // Create unique key for each 118" roll (individual_roll_number + paper specs)
    const rollKey = `${cutRoll.individual_roll_number}-${cutRoll.gsm}-${cutRoll.bf}-${cutRoll.shade}`;
    
    if (!rollGroups.has(rollKey)) {
      rollGroups.set(rollKey, []);
    }
    rollGroups.get(rollKey)!.push(cutRoll);
  }

  // Calculate wastage for each 118" roll group
  for (const [rollKey, rolls] of rollGroups) {
    if (rolls.length === 0) continue;
    
    // Get trim value - should be same for all rolls in the group since they come from same 118" roll
    const trimValue = rolls[0].trim_left || 0;
    
    // Only track wastage >= 9 inches
    if (trimValue >= 9) {
      const firstRoll = rolls[0];
      
      // Find a roll with valid paper_id, fallback to first roll's data
      const rollWithPaperId = rolls.find(r => r.paper_id) || firstRoll;
      
      console.log("🔍 PAPER_ID DEBUG: firstRoll.paper_id:", firstRoll.paper_id);
      console.log("🔍 PAPER_ID DEBUG: rollWithPaperId.paper_id:", rollWithPaperId.paper_id);
      console.log("🔍 PAPER_ID DEBUG: Full rollWithPaperId:", rollWithPaperId);
      
      const wastageItem: WastageData = {
        width_inches: trimValue,
        paper_id: rollWithPaperId.paper_id || '',
        gsm: firstRoll.gsm,
        bf: firstRoll.bf,
        shade: firstRoll.shade,
        individual_roll_number: firstRoll.individual_roll_number,
        source_plan_id: planId,
        source_jumbo_roll_id: undefined, // Will be set by backend
        notes: `Trim waste from 118" roll #${firstRoll.individual_roll_number} (${rolls.length} cut rolls)`
      };
      
      wastageItems.push(wastageItem);
      totalWastageInches += trimValue;
      
      // Track wastage by paper type
      const paperKey = `${firstRoll.gsm}gsm ${firstRoll.shade} BF${firstRoll.bf}`;
      wastageByPaper.set(paperKey, (wastageByPaper.get(paperKey) || 0) + trimValue);
    }
  }

  console.log(`🗑️ WASTAGE CALCULATION: Found ${wastageItems.length} wastage items >= 9 inches`);
  console.log(`🗑️ WASTAGE DETAILS:`, wastageItems);

  return {
    wastageItems,
    totalWastageCount: wastageItems.length,
    totalWastageInches,
    wastageByPaper
  };
}

/**
 * Format wastage summary for display
 */
export function formatWastageSummary(result: WastageCalculationResult): string {
  if (result.totalWastageCount === 0) {
    return "No wastage >= 9 inches detected";
  }
  
  const paperBreakdown = Array.from(result.wastageByPaper.entries())
    .map(([paper, inches]) => `${paper}: ${inches.toFixed(1)}"`)
    .join(', ');
  
  return `${result.totalWastageCount} wastage items (${result.totalWastageInches.toFixed(1)}" total) - ${paperBreakdown}`;
}

/**
 * Validate wastage data before sending to backend
 */
export function validateWastageData(wastageData: WastageData[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (let i = 0; i < wastageData.length; i++) {
    const item = wastageData[i];
    
    if (item.width_inches < 9) {
      errors.push(`Item ${i + 1}: Width ${item.width_inches}" is below 9" minimum`);
    }
    
    if (item.width_inches > 21) {
      errors.push(`Item ${i + 1}: Width ${item.width_inches}" exceeds 21" maximum`);
    }
    
    if (!item.paper_id) {
      errors.push(`Item ${i + 1}: Missing paper_id`);
    }
    
    if (!item.source_plan_id) {
      errors.push(`Item ${i + 1}: Missing source_plan_id`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}