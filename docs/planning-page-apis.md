# Planning Page API Documentation

This document describes the APIs associated with the **Generate Plan** and **Start Production** buttons in both:
- **Auto Planning Page** (`planning/page.tsx`)
- **Manual Planning Page** (`planning/manual/page.tsx`)

---

# Auto Planning (`planning/page.tsx`)

## 1. Generate Plan Button

The Generate Plan button triggers the `generatePlan` function which calls the workflow optimization API.

### API Endpoint

```
POST {API_BASE_URL}/workflow/process-orders
```

### Request Structure

**Interface**: `WorkflowProcessRequest`

```typescript
interface WorkflowProcessRequest {
  order_ids: string[];                    // Array of selected order IDs
  user_id: string;                        // User ID from localStorage
  include_pending_orders?: boolean;       // Whether to include pending orders
  include_available_inventory?: boolean;  // Whether to include available inventory
  include_wastage_allocation?: boolean;   // Whether to include wastage allocation
  jumbo_roll_width?: number;              // Dynamic roll width (e.g., 118, 123)
}
```

**Example Request**:
```json
{
  "order_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "user_id": "user-uuid",
  "include_pending_orders": true,
  "include_available_inventory": true,
  "include_wastage_allocation": true,
  "jumbo_roll_width": 118
}
```

### Response Structure

**Interface**: `OptimizationResult`

```typescript
interface OptimizationResult {
  cut_rolls_generated: CutRoll[];         // Array of generated cut rolls
  jumbo_rolls_needed: number;             // Number of jumbo rolls required
  pending_orders: PendingOrder[];         // Orders that couldn't be fulfilled
  summary: OptimizationSummary;           // Summary statistics
  jumbo_roll_details?: JumboRollDetail[]; // Detailed jumbo hierarchy info
  wastage_allocations?: any;              // Wastage allocation data
  high_trim_approved?: HighTrimPattern[]; // High trim patterns that were approved
}
```

**Sub-Interfaces**:

```typescript
interface CutRoll {
  width: number;
  quantity: number;
  gsm: number;
  bf: number;
  shade: string;
  source: "cutting" | "inventory";
  individual_roll_number?: number;
  trim_left?: number;
  inventory_id?: string;
  order_id?: string;
  client_id?: string;
  paper_id?: string;
  source_type?: string;
  jumbo_id?: string;
  source_pending_id?: string;
  jumbo_roll_id?: string;
  jumbo_roll_frontend_id?: string;
  parent_118_roll_id?: string;
  roll_sequence?: number;
}

interface PendingOrder {
  source_order_id: string;
  width: number;
  quantity: number;
  gsm: number;
  bf: number;
  shade: string;
  reason: string;
  pending_order_id?: string;
  original_order_id?: string;
  client_name?: string;
}

interface OptimizationSummary {
  total_cut_rolls: number;
  total_individual_118_rolls: number;
  total_jumbo_rolls_needed: number;
  total_pending_orders: number;
  total_pending_quantity: number;
  specification_groups_processed: number;
  high_trim_patterns: number;
  algorithm_note: string;
  complete_jumbos?: number;
  partial_jumbos?: number;
  jumbo_roll_width?: number;
}
```

### Validation API (Called After Generate)

After generating the plan, a validation call is made:

```
POST {API_BASE_URL}/cutting/validate-plan
```

**Response**:
```typescript
{
  is_valid: boolean;
  violations: Array<{
    jumbo_number?: number;
    issue: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  warnings: Array<{
    jumbo_number?: number;
    issue: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  summary: {
    total_jumbo_rolls: number;
    average_waste_per_roll: number;
    overall_waste_percentage: number;
  };
}
```

---

## 2. Start Production Button

The Start Production button triggers `createProductionRecords` which involves **two API calls**:

### 2.1 Create Plan API

First, a plan record is created in the database.

#### API Endpoint

```
POST {API_BASE_URL}/plans
```

#### Request Headers

```
Content-Type: application/json
X-Idempotency-Key: plan-{user_id}-{timestamp}-{random_string}
ngrok-skip-browser-warning: true
```

#### Request Structure

```typescript
{
  name: string;                           // e.g., "Production Plan - 2024-01-15"
  cut_pattern: Array<{
    width: number;
    gsm: number;
    bf: number;
    shade: string;
    individual_roll_number: number;
    source: string;
    order_id: string;
    selected: boolean;
    source_type: string;
    source_pending_id: string | null;
    company_name: string;
  }>;
  wastage_allocations: any[];             // Wastage allocation data
  expected_waste_percentage: number;      // Calculated waste percentage
  created_by_id: string;                  // User ID
  order_ids: string[];                    // Selected order IDs
  pending_orders: PendingOrder[];         // Pending orders from algorithm
}
```

#### Response Structure

```typescript
{
  id: string;        // The created plan ID (UUID)
  name: string;
  status: string;
  created_at: string;
  // ... other plan fields
}
```

---

### 2.2 Start Production API

After the plan is created, production is started with the selected rolls.

#### API Endpoint

```
POST {API_BASE_URL}/plans/{planId}/start-production
```

#### Request Structure

```typescript
{
  selected_cut_rolls: Array<{
    paper_id: string;
    width_inches: number;
    qr_code: string;                      // Generated unique QR code
    barcode_id: string;                   // e.g., "CR_00001"
    gsm: number;
    bf: number;
    shade: string;
    individual_roll_number: number;
    trim_left: number;
    order_id: string;
    source_type: string;                  // 'regular_order' | 'pending_order'
    source_pending_id: string | null;
  }>;
  all_available_cuts: Array<{             // All cuts from algorithm (same structure)
    paper_id: string;
    width_inches: number;
    qr_code: string;
    barcode_id: string;
    gsm: number;
    bf: number;
    shade: string;
    individual_roll_number: number;
    trim_left: number;
    order_id: string;
    source_type: string;
    source_pending_id: string | null;
  }>;
  wastage_data: Array<{                   // Wastage items to create
    width_inches: number;
    gsm: number;
    bf: number;
    shade: string;
    source_plan_id: string;
    // ... other wastage fields
  }>;
  added_rolls_data: Record<string, any>;  // Added rolls for partial jumbo completion
  created_by_id: string;                  // User ID
  jumbo_roll_width: number;               // Roll width (e.g., 118)
}
```

#### Response Structure

```typescript
{
  production_hierarchy: Array<{
    jumbo_roll: {
      id: string;
      barcode_id: string;
      // ... jumbo roll details
    };
    cut_rolls: Array<{
      id: string;
      barcode_id: string;
      width_inches: number;
      paper_spec: string;
      status: string;
      // ... cut roll details
    }>;
  }>;
  wastage_items: Array<{
    id: string;
    width_inches: number;
    gsm: number;
    bf: number;
    shade: string;
    // ... wastage item details
  }>;
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

# Manual Planning (`planning/manual/page.tsx`)

## 3. Create Plan Button

The Manual Planning page (`planning/manual/page.tsx`) allows users to manually define paper specs, jumbo rolls, roll sets, and cut rolls. It uses a **single API call** that creates the plan and starts production simultaneously.

### API Endpoint

```
POST {API_BASE_URL}/plans/manual/create
```

### Request Structure

```typescript
{
  wastage: number;                        // Applied wastage value (e.g., 1, 2, 5)
  planning_width: number;                 // Calculated width (124 - wastage)
  created_by_id: string;                  // User ID from localStorage
  paper_specs: Array<{
    gsm: number;
    bf: number;
    shade: string;
    jumbo_rolls: Array<{
      jumbo_number: number;               // Sequential jumbo number (1, 2, 3...)
      roll_sets: Array<{
        set_number: number;               // Roll set number (1, 2, or 3)
        cut_rolls: Array<{
          width_inches: number;
          quantity: number;
          client_name: string;
        }>;
      }>;
    }>;
  }>;
}
```

**Example Request**:
```json
{
  "wastage": 6,
  "planning_width": 118,
  "created_by_id": "user-uuid",
  "paper_specs": [
    {
      "gsm": 120,
      "bf": 18,
      "shade": "Natural",
      "jumbo_rolls": [
        {
          "jumbo_number": 1,
          "roll_sets": [
            {
              "set_number": 1,
              "cut_rolls": [
                { "width_inches": 24, "quantity": 2, "client_name": "ABC Corp" },
                { "width_inches": 36, "quantity": 1, "client_name": "XYZ Ltd" }
              ]
            },
            {
              "set_number": 2,
              "cut_rolls": [
                { "width_inches": 48, "quantity": 1, "client_name": "ABC Corp" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Response Structure

The response has the same `production_hierarchy` structure as the regular Start Production API:

```typescript
{
  plan_frontend_id: string;               // Generated plan ID (e.g., "PLN-00123")
  summary: {
    jumbo_rolls_created: number;
    intermediate_118_rolls_created: number;
    cut_rolls_created: number;
    planning_width: number;
  };
  production_hierarchy: Array<{
    jumbo_roll: {
      id: string;
      barcode_id: string;
      paper_spec: string;                 // e.g., "120gsm, 18bf, Natural"
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
      status: string;                     // e.g., "cutting"
      parent_118_barcode: string;
    }>;
  }>;
}
```

**Example Response**:
```json
{
  "plan_frontend_id": "PLN-00045",
  "summary": {
    "jumbo_rolls_created": 2,
    "intermediate_118_rolls_created": 6,
    "cut_rolls_created": 15,
    "planning_width": 118
  },
  "production_hierarchy": [
    {
      "jumbo_roll": {
        "id": "uuid-jumbo-1",
        "barcode_id": "JR-00123",
        "paper_spec": "120gsm, 18bf, Natural",
        "width_inches": 354
      },
      "intermediate_rolls": [
        {
          "barcode_id": "IR-00456",
          "roll_sequence": 1,
          "width_inches": 118,
          "paper_spec": "120gsm, 18bf, Natural"
        }
      ],
      "cut_rolls": [
        {
          "id": "uuid-cut-1",
          "barcode_id": "CR-00789",
          "width_inches": 24,
          "client_name": "ABC Corp",
          "status": "cutting",
          "parent_118_barcode": "IR-00456"
        }
      ]
    }
  ]
}
```

---

## API Base URL Configuration

The base URL is configured in `src/lib/api-config.ts`:

```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
```

## Related Endpoints

| Endpoint | Description | Used By |
|----------|-------------|---------|
| `POST /workflow/process-orders` | Main optimization algorithm | Auto Planning, Hybrid Planning |
| `POST /cutting/validate-plan` | Validate cutting plan constraints | Auto Planning |
| `POST /plans` | Create a new plan record | Auto Planning, Hybrid Planning |
| `POST /plans/{id}/start-production` | Start production with selected rolls | Auto Planning, Hybrid Planning |
| `POST /plans/manual/create` | Create plan and start production in one call | Manual Planning |

---

## Error Handling

All endpoints return error responses in the format:

```typescript
{
  detail?: string;
  message?: string;
}
```

Common error scenarios:
- `401`: User not authenticated
- `400`: Invalid request parameters
- `422`: Validation errors
- `500`: Server errors
