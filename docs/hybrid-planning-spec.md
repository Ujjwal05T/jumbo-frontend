# Hybrid Planning - Feature Specification

This document describes the complete specification for the Hybrid Planning page, which combines auto-generated plans with manual editing capabilities.

---

## Overview

**Purpose**: Allow users to generate an optimized cutting plan automatically, then manually edit, reorder, add, or remove rolls before starting production.

**Location**: `planning/hybrid/page.tsx`

**Key Principle**: After plan generation, the UI behaves like Manual Planning but preserves order linkages from the algorithm.

---

## User Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HYBRID PLANNING FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. ORDER SELECTION                                                     │
│     ├─ Select orders (same as auto planning)                            │
│     ├─ Set wastage / planning width                                     │
│     └─ Click [Generate Plan]                                            │
│              │                                                          │
│              ▼                                                          │
│  2. API CALL: POST /workflow/process-orders                             │
│     └─ Returns: cut_rolls_generated[] (flat array)                      │
│              │                                                          │
│              ▼                                                          │
│  3. DATA TRANSFORMATION                                                 │
│     └─ Flat array → Nested structure (spec → jumbo → set → cuts)        │
│              │                                                          │
│              ▼                                                          │
│  4. EDIT MODE (Manual-style UI)                                         │
│     ├─ View/edit rolls in hierarchical layout                           │
│     ├─ Drag & drop between sets                                         │
│     ├─ Select/unselect, delete, add rolls                               │
│     ├─ Add new jumbos/sets                                              │
│     └─ Orphaned rolls panel                                             │
│              │                                                          │
│              ▼                                                          │
│  5. START PRODUCTION                                                    │
│     ├─ API CALL: POST /plans (create plan record)                       │
│     ├─ API CALL: POST /plans/{id}/start-production                      │
│     ├─ Selected rolls → production                                      │
│     ├─ Unselected + orphaned rolls → pending items                      │
│     └─ Redirect to production view                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Hybrid Planning                              [Generate Plan] [Start Prod]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─ Order Selection ─────────────────────────────────────────────────────┐   │
│ │ [Wastage: 6"] [Planning Width: 118"]  [Include Pending: ☑]            │   │
│ │ Selected Orders: ORD-001, ORD-002, ORD-003                            │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ ┌─ Plan Editor ─────────────────────────────────┐ ┌─ Orphaned Rolls ─────┐  │
│ │                                               │ │                      │  │
│ │ ▼ 120gsm, 18bf, Natural                       │ │ 24" - ABC Corp       │  │
│ │   ▼ Jumbo #1                                  │ │ [algo] ORD-001       │  │
│ │     ▼ Set #1 (96" / 118") ███████████░░░      │ │ [Add to Set ▼]       │  │
│ │       ┌──────────────────────────────────┐    │ │                      │  │
│ │       │ ☑ 24" × 2  ABC Corp  [algo]  ✎ 🗑 │    │ │ 36" - XYZ Ltd        │  │
│ │       │ ☑ 48" × 1  XYZ Ltd   [algo]  ✎ 🗑 │    │ │ [algo] ORD-002       │  │
│ │       │ [+ Add Cut Roll]                 │    │ │ [Add to Set ▼]       │  │
│ │       └──────────────────────────────────┘    │ │                      │  │
│ │     ▼ Set #2 (72" / 118") ██████░░░░░░░░      │ │                      │  │
│ │       ┌──────────────────────────────────┐    │ │ ──────────────────   │  │
│ │       │ ☑ 36" × 2  ABC Corp  [algo]  ✎ 🗑 │    │ │ Orphaned: 2 rolls    │  │
│ │       │ [+ Add Cut Roll]                 │    │ │ Will go to pending   │  │
│ │       └──────────────────────────────────┘    │ │ if not reassigned    │  │
│ │     ▼ Set #3 (0" / 118") ░░░░░░░░░░░░░░░      │ │                      │  │
│ │       [+ Add Cut Roll]                        │ └──────────────────────┘  │
│ │     [+ Add Set]                               │                           │
│ │   [+ Add Jumbo #2]                            │                           │
│ │                                               │                           │
│ │ ▶ 100gsm, 22bf, Cream (collapsed)             │                           │
│ │                                               │                           │
│ └───────────────────────────────────────────────┘                           │
│                                                                             │
│ ┌─ Summary ─────────────────────────────────────────────────────────────┐   │
│ │ Total Jumbos: 3 │ Total Sets: 9 │ Total Cuts: 24 │ Efficiency: 94.2%  │   │
│ │ Selected: 22    │ Unselected: 0 │ Orphaned: 2    │ Will Pend: 2       │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Edit Actions

| Action | UI Element | Behavior | Order Link |
|--------|------------|----------|------------|
| **Select/Unselect** | Checkbox ☑ | Unselected → pending on start | Preserved |
| **Delete** | 🗑 button | → Orphaned panel, must reassign or → pending | Preserved |
| **Edit** | ✎ button | Edit width, quantity in dialog | Preserved |
| **Drag & Drop** | Drag handle | Move roll between sets (validate width) | Preserved |
| **Reorder** | Drag within set | Change cut sequence | Preserved |
| **Add Cut** | [+ Add Cut Roll] | Opens dialog, no order link | `source: 'manual'` |
| **Add Set** | [+ Add Set] | Creates empty set (max 3 per jumbo) | N/A |
| **Add Jumbo** | [+ Add Jumbo] | Creates jumbo with 3 empty sets | N/A |
| **Reassign Orphan** | [Add to Set ▼] | Dropdown to select target set | Preserved |

---

## Frontend Data Structures

### Algorithm Output (Flat)

```typescript
// Response from POST /workflow/process-orders
interface OptimizationResult {
  cut_rolls_generated: CutRoll[];
  jumbo_rolls_needed: number;
  pending_orders: PendingOrder[];
  summary: OptimizationSummary;
  wastage_allocations?: any;
}

interface CutRoll {
  width: number;
  quantity: number;
  gsm: number;
  bf: number;
  shade: string;
  source: "cutting" | "inventory";
  individual_roll_number?: number;      // Used to group into sets (1, 2, 3)
  trim_left?: number;
  order_id?: string;                    // Link to order
  source_pending_id?: string;           // Link to pending order
  source_type?: string;                 // 'regular_order' | 'pending_order'
  client_id?: string;
  paper_id?: string;
}
```

### Transformed State (Nested)

```typescript
interface HybridPlanState {
  // Configuration
  wastage: number;
  planningWidth: number;
  selectedOrderIds: string[];

  // Nested plan structure
  paperSpecs: PaperSpecGroup[];

  // Orphaned rolls (deleted but not reassigned)
  orphanedRolls: EditableCutRoll[];

  // Tracking
  isGenerated: boolean;
  isModified: boolean;
}

interface PaperSpecGroup {
  id: string;                           // Frontend-generated ID
  gsm: number;
  bf: number;
  shade: string;
  jumbos: JumboRollGroup[];
  isExpanded: boolean;
}

interface JumboRollGroup {
  id: string;                           // Frontend-generated ID
  jumboNumber: number;                  // 1, 2, 3...
  sets: RollSetGroup[];
}

interface RollSetGroup {
  id: string;                           // Frontend-generated ID
  setNumber: number;                    // 1, 2, or 3
  cuts: EditableCutRoll[];
}

interface EditableCutRoll {
  id: string;                           // Frontend-generated unique ID
  width: number;
  quantity: number;
  clientName: string;

  // Source tracking
  source: 'algorithm' | 'manual';
  order_id?: string;                    // Preserved from algorithm
  source_pending_id?: string;           // Preserved from algorithm
  source_type?: 'regular_order' | 'pending_order';
  client_id?: string;
  paper_id?: string;

  // Edit state
  selected: boolean;                    // Checkbox state
  trimLeft?: number;

  // Original values (for reset)
  originalWidth?: number;
  originalQuantity?: number;
}
```

### Transformation Function

```typescript
function transformToNestedStructure(
  result: OptimizationResult,
  planningWidth: number
): HybridPlanState {
  const paperSpecMap = new Map<string, PaperSpecGroup>();

  result.cut_rolls_generated.forEach((roll, index) => {
    const specKey = `${roll.gsm}-${roll.bf}-${roll.shade}`;

    // Get or create paper spec group
    if (!paperSpecMap.has(specKey)) {
      paperSpecMap.set(specKey, {
        id: `spec-${Date.now()}-${index}`,
        gsm: roll.gsm,
        bf: roll.bf,
        shade: roll.shade,
        jumbos: [],
        isExpanded: true,
      });
    }
    const spec = paperSpecMap.get(specKey)!;

    // Determine jumbo and set from individual_roll_number
    // Algorithm outputs: individual_roll_number 1,2,3 = Jumbo 1 Sets 1,2,3
    //                    individual_roll_number 4,5,6 = Jumbo 2 Sets 1,2,3
    const rollNum = roll.individual_roll_number || 1;
    const jumboNumber = Math.ceil(rollNum / 3);
    const setNumber = ((rollNum - 1) % 3) + 1;

    // Get or create jumbo
    let jumbo = spec.jumbos.find(j => j.jumboNumber === jumboNumber);
    if (!jumbo) {
      jumbo = {
        id: `jumbo-${Date.now()}-${jumboNumber}`,
        jumboNumber,
        sets: [
          { id: `set-${Date.now()}-1`, setNumber: 1, cuts: [] },
          { id: `set-${Date.now()}-2`, setNumber: 2, cuts: [] },
          { id: `set-${Date.now()}-3`, setNumber: 3, cuts: [] },
        ],
      };
      spec.jumbos.push(jumbo);
    }

    // Add cut to appropriate set
    const set = jumbo.sets.find(s => s.setNumber === setNumber)!;
    set.cuts.push({
      id: `cut-${Date.now()}-${index}`,
      width: roll.width,
      quantity: roll.quantity || 1,
      clientName: '', // Will be resolved from order data
      source: 'algorithm',
      order_id: roll.order_id,
      source_pending_id: roll.source_pending_id,
      source_type: roll.source_type as 'regular_order' | 'pending_order',
      client_id: roll.client_id,
      paper_id: roll.paper_id,
      selected: true,
      trimLeft: roll.trim_left,
      originalWidth: roll.width,
      originalQuantity: roll.quantity || 1,
    });
  });

  return {
    wastage: 124 - planningWidth,
    planningWidth,
    selectedOrderIds: [],
    paperSpecs: Array.from(paperSpecMap.values()),
    orphanedRolls: [],
    isGenerated: true,
    isModified: false,
  };
}
```

---

## API Flow

### Step 1: Generate Plan

**Endpoint**: `POST {API_BASE_URL}/workflow/process-orders`

**Request**:
```typescript
{
  order_ids: string[];
  user_id: string;
  include_pending_orders: boolean;
  include_available_inventory: boolean;
  include_wastage_allocation: boolean;
  jumbo_roll_width: number;
}
```

**Response**: `OptimizationResult` (see above)

---

### Step 2: Start Production

#### 2.1 Create Plan Record

**Endpoint**: `POST {API_BASE_URL}/plans`

**Request**:
```typescript
{
  name: string;                         // "Hybrid Plan - 2024-01-15"
  cut_pattern: Array<{
    width: number;
    gsm: number;
    bf: number;
    shade: string;
    individual_roll_number: number;
    source: string;
    order_id: string | null;            // null for manual rolls
    selected: boolean;
    source_type: string;
    source_pending_id: string | null;
    company_name: string;
  }>;
  wastage_allocations: any[];
  expected_waste_percentage: number;
  created_by_id: string;
  order_ids: string[];
  pending_orders: PendingOrder[];
}
```

**Response**:
```typescript
{
  id: string;                           // Plan UUID
  // ... other plan fields
}
```

---

#### 2.2 Start Production

**Endpoint**: `POST {API_BASE_URL}/plans/{planId}/start-production`

**Request**:
```typescript
{
  selected_cut_rolls: Array<{           // Only selected rolls
    paper_id: string;
    width_inches: number;
    qr_code: string;
    barcode_id: string;
    gsm: number;
    bf: number;
    shade: string;
    individual_roll_number: number;
    trim_left: number;
    order_id: string | null;            // null for manual rolls
    source_type: string;
    source_pending_id: string | null;
  }>;
  all_available_cuts: Array<{           // All rolls (for pending creation)
    // Same structure as above
  }>;
  wastage_data: Array<{
    width_inches: number;
    gsm: number;
    bf: number;
    shade: string;
    source_plan_id: string;
  }>;
  added_rolls_data: Record<string, any>;
  created_by_id: string;
  jumbo_roll_width: number;
}
```

**Response**:
```typescript
{
  production_hierarchy: Array<{
    jumbo_roll: {
      id: string;
      barcode_id: string;
      paper_spec: string;
      width_inches: number;
    };
    intermediate_rolls: Array<{
      barcode_id: string;
      roll_sequence: number;
      width_inches: number;
      paper_spec: string;
    }>;
    cut_rolls: Array<{
      id: string;
      barcode_id: string;
      width_inches: number;
      client_name: string;
      status: string;
      parent_118_barcode: string;
    }>;
  }>;
  wastage_items: Array<{...}>;
  summary: {
    orders_updated: number;
    order_items_updated: number;
    pending_items_created: number;
    pending_orders_updated: number;
    wastage_items_created: number;
    inventory_created: number;
  };
}
```

---

## Validation Rules

### Width Constraints
```typescript
function validateSet(set: RollSetGroup, planningWidth: number): boolean {
  const totalWidth = set.cuts.reduce((sum, cut) => sum + (cut.width * cut.quantity), 0);
  return totalWidth <= planningWidth;
}

function getRemainingWidth(set: RollSetGroup, planningWidth: number): number {
  const usedWidth = set.cuts.reduce((sum, cut) => sum + (cut.width * cut.quantity), 0);
  return planningWidth - usedWidth;
}
```

### Drag & Drop Validation
```typescript
function canDropInSet(
  roll: EditableCutRoll,
  targetSet: RollSetGroup,
  planningWidth: number
): boolean {
  const currentWidth = targetSet.cuts.reduce(
    (sum, cut) => sum + (cut.width * cut.quantity), 0
  );
  const newWidth = currentWidth + (roll.width * roll.quantity);
  return newWidth <= planningWidth;
}
```

### Before Start Production
```typescript
function validateBeforeStart(state: HybridPlanState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check all sets are within width limit
  state.paperSpecs.forEach(spec => {
    spec.jumbos.forEach(jumbo => {
      jumbo.sets.forEach(set => {
        if (!validateSet(set, state.planningWidth)) {
          errors.push(`Set #${set.setNumber} in Jumbo #${jumbo.jumboNumber} exceeds width`);
        }
      });
    });
  });

  // Warn about orphaned rolls
  if (state.orphanedRolls.length > 0) {
    warnings.push(`${state.orphanedRolls.length} orphaned rolls will be moved to pending`);
  }

  // Warn about unselected rolls
  const unselectedCount = countUnselected(state);
  if (unselectedCount > 0) {
    warnings.push(`${unselectedCount} unselected rolls will be moved to pending`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}
```

---

## Component Structure

```
src/app/planning/hybrid/
├── page.tsx                            # Main page component
├── components/
│   ├── OrderSelectionPanel.tsx         # Order selection (reuse from auto)
│   ├── PlanEditor.tsx                  # Main editor container
│   ├── PaperSpecCard.tsx               # Collapsible paper spec group
│   ├── JumboRollCard.tsx               # Jumbo roll container
│   ├── RollSetCard.tsx                 # Individual set with cuts
│   ├── CutRollRow.tsx                  # Single cut roll row (draggable)
│   ├── OrphanedRollsPanel.tsx          # Sidebar for orphaned rolls
│   ├── AddCutRollDialog.tsx            # Dialog for adding manual rolls
│   ├── EditCutRollDialog.tsx           # Dialog for editing rolls
│   └── PlanSummary.tsx                 # Bottom summary bar
├── hooks/
│   ├── useHybridPlan.ts                # Main state management hook
│   ├── useDragAndDrop.ts               # Drag & drop logic
│   └── useValidation.ts                # Validation logic
├── utils/
│   ├── transformData.ts                # Flat → Nested transformation
│   ├── prepareApiPayload.ts            # Nested → API payload
│   └── calculations.ts                 # Width, efficiency calculations
└── types.ts                            # TypeScript interfaces
```

---

## State Management

Using React useState + useReducer for complex state:

```typescript
type HybridPlanAction =
  | { type: 'SET_GENERATED_PLAN'; payload: OptimizationResult }
  | { type: 'TOGGLE_SELECT'; payload: { cutId: string } }
  | { type: 'DELETE_CUT'; payload: { cutId: string } }
  | { type: 'EDIT_CUT'; payload: { cutId: string; updates: Partial<EditableCutRoll> } }
  | { type: 'ADD_CUT'; payload: { setId: string; cut: EditableCutRoll } }
  | { type: 'MOVE_CUT'; payload: { cutId: string; fromSetId: string; toSetId: string } }
  | { type: 'REORDER_CUTS'; payload: { setId: string; cutIds: string[] } }
  | { type: 'ADD_SET'; payload: { jumboId: string } }
  | { type: 'ADD_JUMBO'; payload: { specId: string } }
  | { type: 'REASSIGN_ORPHAN'; payload: { cutId: string; targetSetId: string } }
  | { type: 'TOGGLE_SPEC_EXPAND'; payload: { specId: string } }
  | { type: 'RESET' };

function hybridPlanReducer(
  state: HybridPlanState,
  action: HybridPlanAction
): HybridPlanState {
  switch (action.type) {
    case 'DELETE_CUT': {
      // Find and move cut to orphaned
      const cut = findCutById(state, action.payload.cutId);
      if (!cut) return state;

      return {
        ...state,
        paperSpecs: removeCutFromSpecs(state.paperSpecs, action.payload.cutId),
        orphanedRolls: [...state.orphanedRolls, cut],
        isModified: true,
      };
    }
    // ... other cases
  }
}
```

---

## Key Differences from Other Pages

| Feature | Auto Planning | Manual Planning | Hybrid Planning |
|---------|---------------|-----------------|-----------------|
| Generate plan | Algorithm | N/A | Algorithm |
| Edit rolls | Select only | Full edit | Full edit |
| Order linkage | Preserved | None | Preserved for algo rolls |
| Add manual rolls | No | Yes | Yes (no order link) |
| Drag & drop | No | No | Yes |
| Orphaned rolls | N/A | N/A | Yes |
| API for production | 2 calls | 1 call | 2 calls |

---

## Future Considerations

1. **Undo/Redo**: Track action history for undo support
2. **Auto-save draft**: Save state to localStorage periodically
3. **Collaboration**: Lock plan while editing (multi-user)
4. **Templates**: Save common manual additions as templates
5. **Bulk operations**: Select multiple rolls for batch operations
