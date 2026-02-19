# Jumbo Reel App — Frontend Feature Documentation

**Application Name:** Reels Automation (JumboReelApp)
**Tech Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · Radix UI / shadcn-ui · Material React Table · Recharts · jsPDF · JSBarcode · ZXing
**Purpose:** End-to-end paper roll manufacturing management — from order capture through cutting plan generation, production, inventory, dispatch, and billing.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [User Roles & Access Control](#2-user-roles--access-control)
3. [Authentication](#3-authentication)
4. [Navigation & Layout](#4-navigation--layout)
5. [Masters Module](#5-masters-module)
   - 5.1 Client Master
   - 5.2 Order Master
   - 5.3 Paper Master
   - 5.4 Material Master
   - 5.5 Plan Master
   - 5.6 Manual Cut Rolls
   - 5.7 Pending Orders
   - 5.8 Deletion Logs / Edit Logs
   - 5.9 User Master
6. [Production Planning](#6-production-planning)
   - 6.1 AI-Assisted Planning
   - 6.2 Hybrid Plan
   - 6.3 Manual Plan
   - 6.4 Set Jumbo Roll (Current Jumbo)
7. [Inventory Management](#7-inventory-management)
   - 7.1 Past Inventory
   - 7.2 Stock / Wastage Inventory
   - 7.3 Weight Update
   - 7.4 QR Scanner
8. [Dispatch Module](#8-dispatch-module)
   - 8.1 Weight-Updated Rolls (Dispatch Ready)
   - 8.2 Current Dispatch / Dispatch History
   - 8.3 Past Dispatch
   - 8.4 Outward Challan
9. [MOU Module](#9-mou-module)
   - 9.1 MOU Entry
   - 9.2 MOU Reports
10. [Bills & Finance](#10-bills--finance)
    - 10.1 Bill Management (Challan)
    - 10.2 Added Bills
11. [Reports & Analytics](#11-reports--analytics)
    - 11.1 Analytics Dashboard
    - 11.2 Client-Order Analysis
    - 11.3 Plan Report
    - 11.4 Order-Plan Execution
    - 11.5 Client Order Summary
    - 11.6 Cut Rolls Report
    - 11.7 Filter Cut Rolls
    - 11.8 Plan Weights
    - 11.9 Order Tracking
12. [Barcode & QR Tools](#12-barcode--qr-tools)
    - 12.1 Barcode Lookup
    - 12.2 Roll Tracking
13. [Security & In/Out Management](#13-security--inout-management)
14. [Hour Calculator](#14-hour-calculator)
15. [Quality Check](#15-quality-check)
16. [Settings (TOTP / 2FA)](#16-settings-totp--2fa)
17. [Roll Hierarchy & Barcode Naming](#17-roll-hierarchy--barcode-naming)
18. [PDF Generation Features](#18-pdf-generation-features)
19. [Key Reusable Components](#19-key-reusable-components)

---

## 1. Architecture Overview

The frontend is a **Next.js 15 App Router** application with client-side rendering for interactive pages. It communicates with two backend services:

| Backend | Purpose |
|---------|---------|
| Python/FastAPI (ngrok tunnel) | Core production logic — orders, plans, cut rolls, dispatch |
| .NET 8 (ASP.NET Core) | Supplementary features — MOU/wastage reports, inward challans, image uploads |

**Key architectural patterns:**
- Role-based routing — authenticated users are automatically redirected to the appropriate starting page based on their role.
- Cookie + localStorage auth — username and role stored in both; cookies used by middleware for server-side route protection.
- Component library — Radix UI primitives wrapped with Tailwind (shadcn/ui pattern) for all UI elements.
- Toast notifications via **Sonner** (`richColors` enabled globally in root layout).

---

## 2. User Roles & Access Control

The application uses a flat role system stored in `localStorage` (`user_role`) and cookies. Navigation items and pages are filtered per role at runtime.

| Role | Default Landing Page | Key Permissions |
|------|---------------------|-----------------|
| `admin` | `/dashboard` | Full access to all features |
| `co_admin` | `/dashboard` | Dashboard, Masters (limited), Dispatch |
| `production` | `/dashboard` | Planning, QR Scanner, Pending Orders, Reports |
| `order_puncher` | `/masters/orders` | Create/view orders, Client Master, Paper Master |
| `weight_update` | `/weight-update` | Only weight update scanner |
| `security` | `/in-out` | In/Out gate management, Client & Material Master |
| `accountant` / `accountant2` | `/masters/orders` | Orders, Stock, Weight Update, MOU, Dispatch, Bills, Reports |
| `mou` | `/mou` | MOU entry and MOU reports only |
| `dispatch` | `/dispatch/history` | Dispatch, Outward Challan, Plan Weights, Barcode Lookup |
| `sales_person` | `/masters/orders` | Orders, Pending Orders, Current Dispatch |
| `qc` | `/quality-check` | Hour Calculator, Quality Check |

---

## 3. Authentication

### Pages
- **`/auth/register`** — New user registration form.
- **`/auth/login`** — Username/password login.
- **`/access-denied`** — Shown when a user navigates to a route their role does not permit.
- **`/settings/totp`** — TOTP (Time-based One-Time Password) two-factor authentication setup.

### How it works
1. On login, the API returns a JWT token + user info including `user_role`.
2. `AuthContext` stores `username` in `localStorage` and mirrors it to a browser cookie (`max-age: 7 days`).
3. `user_role` is stored in `localStorage` and cookie for middleware route-guard checks.
4. On logout, both `localStorage` keys and cookies are cleared, and the user is redirected to `/login`.

---

## 4. Navigation & Layout

All authenticated pages render inside **`DashboardLayout`**, which provides:

- **Left sidebar** — collapsible, shows role-filtered navigation items with expandable sub-menus (Masters, Dispatch, Bills, MOU, Reports).
- **Top bar** — shows the current user's avatar, username, and a logout button with confirmation dialog.
- **Inline barcode search** — a quick barcode query field in the sidebar header that navigates directly to Barcode Lookup results.
- **Mobile support** — sidebar is hidden by default on mobile and toggled via a hamburger menu.

### Navigation structure (admin view, full access)

```
Dashboard
Masters ▼
  Client Master
  Order Master
  Order Edit Logs
  Pending Orders
  Plan Master
  Deletion Logs
  User Master
  Paper Master
  Material Master
  Manual Cut Rolls
Inventory
Planning
Hybrid Plan
Manual Plan
Stock
Weight Update
In/Out
Outward Challan
MOU ▼
  MOU Entry
  MOU Reports
Dispatch ▼
  Current Dispatch
  Past Dispatch
Bills ▼
  Bill Management
  Added Bills
Set Jumbo Roll
QR Scanner
Barcode Lookup
New Data
New Data Report
Reports ▼
  Analytics Dashboard
  Client-Order Analysis
  Plan Report
  Order-Plan Execution
  Client Order Summary
  Cut Rolls Report
  Filter Cut Rolls
  Plan Weights
Hour Calculator
Quality Check
```

---

## 5. Masters Module

### 5.1 Client Master — `/masters/clients`

Manages the customer/client database.

**Features:**
- **Stats bar** — Total clients, Active clients, Clients added in last 30 days, Clients with complete info.
- **Search** — Real-time filter by contact person name, company name, or email.
- **Table columns** — Client ID (frontend_id), Contact person, Company name, Email, Phone, Address, Status (Active/Inactive), Created date.
- **Add Client** — Opens `ClientForm` modal (company name, contact person, email, phone, address, status).
- **Edit Client** — Opens `ClientForm` modal pre-filled.
- **Delete Client** — Confirmation dialog before deletion; removes client and all associated data.
- Clients are assigned sequential human-readable IDs (`frontend_id`) generated by the backend.

---

### 5.2 Order Master — `/masters/orders`

Central order management page.

**Features:**
- **Stats bar** — Total Orders, Created, In Process, Completed.
- **Search** — Filter by client name, contact person, or paper name.
- **Table columns** — Order ID (e.g., `ORD-25-06-0001`), Client, Papers, Widths, Items count, Total Amount (₹), Payment type + created date, Progress bar (rolls fulfilled / total), Priority badge, Status badge.
- **Status badges** — Created (clock), In Process (truck), Completed (checkmark), Cancelled (X).
- **Priority levels** — Low, Normal, High, Urgent (color-coded badges).
- **Actions per order** — View Details, Edit Order (only when `created`), Delete Order (only when `created`).
- **New Order** button navigates to order creation wizard.
- Orders are sorted by frontend_id descending (newest first) using multi-format ID parsing (`ORD-YY-MM-NNNN`, `ORD-YYYY-NNNNN`).

**Order Item structure:** Each order contains multiple items — each item specifies:
- Paper type (linked to Paper Master)
- Width in inches
- Quantity (number of rolls)
- Amount (₹)
- Quantity fulfilled (tracked as production progresses)

---

### 5.3 Paper Master — `/masters/papers`

Manages paper type definitions used in orders and plans.

**Fields per paper:** Name, GSM (grams per square metre), BF (burst factor), Shade, Type (e.g., Kraft, Duplex).

---

### 5.4 Material Master — `/masters/materials`

Manages raw materials used in the factory (e.g., Kraft paper reels, chemicals).

**Features:**
- **Table** — Name, Unit of Measure, Current Quantity, Created date.
- **Add / Edit / Delete** with confirmation dialogs.
- Quantity tracking (current stock level).

---

### 5.5 Plan Master — `/masters/plans`

Displays all production cutting plans and provides plan management.

**Features:**
- **Filters** — Search by plan name or creator, Status (planned / in_progress / completed / failed), Client, Date range (today / last 7 days / last 30 days). All filters are combined and sent to the backend as query parameters.
- **Table columns** — Plan ID, Plan Name, Status badge, Expected Waste %, Created By (name + username), Created date, Actions.
- **View Details** — Navigates to `/masters/plans/[id]` for full hierarchical plan view.
- **Download Report (PDF)** — Generates a multi-page PDF including:
  - Plan metadata (ID, status, expected waste, created by)
  - Client list
  - Paper specifications with roll counts and calculated weights
  - Total weight summary (regular rolls + stock-sourced rolls + grand total)
  - Cut rolls summary by status
  - SCR (stock cut rolls) allocation summary
  - Per-jumbo-roll cutting pattern visualization (graphical bar diagram showing each cut segment, width, barcode, and waste)
  - SET grouping within each jumbo roll
  - Page numbering
- **Print Labels (PDF)** — Generates barcode label sheets:
  - Labels grouped by jumbo roll and SET
  - Each label: "Satguru Paper Mill Pvt. Ltd." header, barcode image (CODE128), roll dimensions and paper specs
  - 8 labels per page; page numbers on all pages
- **Print PDF Summary** — Prints a summary table of all filtered plans.

---

### 5.6 Manual Cut Rolls — `/masters/cut-rolls` and `/masters/cut-rolls/manual`

Allows manual creation and management of cut rolls outside of the automated production flow.

**Features:**
- List of manually created cut rolls with barcode, width, paper spec, status.
- Manual entry form at `/masters/cut-rolls/manual`.

---

### 5.7 Pending Orders — `/masters/pending-orders` and `/masters/pending-orders/allocation`

Shows orders that have been placed but not yet assigned to a production plan.

**Features:**
- List of pending order items with client, paper spec, width, quantity needed.
- Allocation page for assigning pending orders to production plans.

---

### 5.8 Deletion Logs — `/masters/deletion-logs`

Audit trail of all deleted records — shows what was deleted, by whom, and when. Admin-only.

### Order Edit Logs — `/masters/orders/edit-logs`

Tracks every edit made to orders — shows original vs. updated values, editor, and timestamp. Admin/co_admin only.

---

### 5.9 User Master — `/masters/users`

Admin-only page for creating and managing system user accounts and assigning roles.

---

## 6. Production Planning

### 6.1 AI-Assisted Planning — `/planning`

The primary cutting plan creation interface.

**What it does:**
- Takes the current jumbo roll width (typically 123") as input.
- Uses an optimization algorithm to generate a cutting pattern that satisfies pending orders while minimizing waste.
- Displays the proposed cutting layout visually.
- Allows the planner to review expected waste percentage before executing.
- On execution, the plan creates `Jumbo Roll → SET Rolls → Cut Rolls` records in the system.

**Integration component:** `PlanProductionIntegration` — bridges planning UI with the backend plan execution API.

---

### 6.2 Hybrid Plan — `/planning/hybrid`

A hybrid mode that combines automated optimization with manual overrides. Allows the planner to start from an AI-generated plan and adjust individual cuts before finalizing.

---

### 6.3 Manual Plan — `/planning/manual`

Fully manual plan creation where the planner directly specifies which widths to cut from which jumbo rolls without AI assistance. Uses a drag-and-drop or form-based interface.

---

### 6.4 Set Jumbo Roll (Current Jumbo) — `/current-jumbo`

Manages the "active" jumbo roll on the production line.

**Features (`CurrentJumboRoll` component):**
- Set the current jumbo roll by scanning its barcode.
- View current jumbo specifications (width, GSM, BF, shade).
- Mark the current jumbo as partially consumed via `PartialJumboCompleter` component.
- Track which plans have used which jumbo rolls.

---

## 7. Inventory Management

### 7.1 Past Inventory — `/inventory/past-inventory`

Displays historical inventory records imported from previous systems or produced in past periods.

**Features:**
- Pagination with configurable page size.
- Filters: date range, status, paper spec, client.
- Summary stats: total items, total weight, filter options dynamically loaded.
- Export functionality.

---

### 7.2 Stock / Wastage Inventory — `/wastage`

Manages stock rolls — cut roll remnants and manually created stock entries that are available for reuse.

**Features:**
- **Stats bar** — Available rolls, Total rolls, Total width (inches), Average width.
- **Omni search** — Fuzzy search across reel number, frontend ID, and barcode ID with exact → starts-with → contains → multi-word match priority.
- **Filters** — Status (Available / Used), paper type.
- **Table columns** — Reel Number, Stock ID, Barcode (code block), Width, Paper Specs (GSM, BF, Shade, Type), Status badge, Created date, Edit action.
- **Create Wastage** — `CreateWastageModal`: input reel number, width, paper spec (GSM/BF/shade), status.
- **Edit Wastage** — `EditWastageModal`: update reel number, width, paper spec, status.
- Results sorted by GSM.
- Used in planning — stock rolls (SCR barcodes) can be allocated to plans to fulfil order items from existing stock without cutting new jumbo rolls.

---

### 7.3 Weight Update — `/weight-update`

A barcode/QR scanner-based tool primarily for the weighing station operator.

**Component: `WeightUpdateScanner`**
- Scans a cut roll barcode (via camera using ZXing or manual input).
- Fetches the roll details and allows the operator to enter the actual weighed value in kg.
- Submits the weight and transitions the roll status to `in_warehouse` (ready for dispatch).
- Optimized for tablet/mobile use at the weighing station.

---

### 7.4 QR Scanner — `/qr-scanner`

**Component: `QRScanner`**
- Camera-based QR code scanner using ZXing browser library.
- Scans roll QR codes to look up roll details.
- Primarily used by production staff to verify rolls.

---

## 8. Dispatch Module

### 8.1 Weight-Updated Rolls (Dispatch Ready) — `/dispatch`

Shows all rolls that have been weighed and are ready for dispatch.

**Features:**
- **Stats** — Total items, Filtered items, Total weight (kg), Heavy rolls (>10 kg count).
- **Search** — By QR code, client name, order ID, or paper spec; with yellow highlight on matches.
- **Show/Hide Filters panel:**
  - Client filter (searchable dropdown)
  - Paper Spec filter (searchable dropdown)
  - Min/Max weight range
  - Roll type (Stock/Non-Stock)
- **Table columns** — S.No, QR Code (barcode + created by), Client & Order, Paper Specs (with Stock badge if wastage roll), Dimensions (width in inches), Weight (kg), Status.
- **Print** — Opens browser print dialog with a formatted HTML table report.

---

### 8.2 Current Dispatch / Dispatch History — `/dispatch/history`

Manages active and recent dispatch transactions.

**Features:**
- List of dispatch records with client, dispatch date, vehicle, driver info.
- Create new dispatch via `CreateDispatchModal`:
  - Select client
  - Select rolls from warehouse items (search and multi-select)
  - Enter vehicle number, driver name, driver mobile
  - Payment type selection
  - OTP verification before dispatch confirmation (`OTPVerificationModal`)
- Edit dispatch via `EditDispatchModal`.
- `DispatchSuccessModal` shown after successful dispatch with a summary.
- Generate packing slip PDFs.

---

### 8.3 Past Dispatch — `/past-dispatch`

Historical record of all completed dispatch transactions.

**Features:**
- Paginated list (20 per page) with server-side filtering.
- **Filters** — Search, Client, Paper Spec, Status, Date range (from/to).
- **Table columns** — Dispatch ID, Dispatch number, Date, Client, Vehicle, Driver, Payment type, Status, Items count, Total weight.
- **View Details** at `/past-dispatch/[id]` — full dispatch detail with line items.
- **Download Packing Slip PDF** — generates a printable packing slip using `generatePackingSlipPDF`.
- **Create Dispatch** shortcut to `/past-dispatch/create`.

---

### 8.4 Outward Challan — `/outward-challan`

Dedicated to the `dispatch` role for generating outward gate pass challans.

**Features:**
- Generate challan documents for vehicles leaving the premises.
- Associated with dispatch records.

---

## 9. MOU Module

MOU (Memorandum of Understanding) refers to wastage weight measurement and documentation for inward raw material deliveries.

### 9.1 MOU Entry — `/mou`

Links to the .NET backend for wastage reports on raw material deliveries.

**Features:**
- **Stats** — Pending challans, Active parties, Total material types.
- **Pending Inward Challans table** (desktop) / Card list (mobile) — shows challans without a `time_out` (i.e., vehicle still on premises).
- **Add Wastage** button per challan — opens a dialog form:
  - Party Name (pre-filled from client)
  - Vehicle Number (pre-filled from challan)
  - Date/Time (auto-set to now, disabled)
  - MOU Report Values — dynamic array of decimal values (add/remove fields)
  - Image Upload — drag-and-drop or camera capture; multiple images; preview with remove option
  - **Submit** — posts multipart form data (PascalCase fields for .NET API)
  - Once submitted, the button changes to **Print PDF** and downloads the wastage report PDF.
- Reports are immutable after submission (no edit capability).

---

### 9.2 MOU Reports — `/mou-reports`

List of all submitted MOU wastage reports.

**Features:**
- Searchable/filterable list of reports.
- **View Detail** at `/mou-reports/[id]` — shows full report with MOU values and attached images.
- **Download PDF** — uses `downloadWastageReportPDF` utility.

---

## 10. Bills & Finance

### 10.1 Bill Management (Challan) — `/challan`

Creates and manages inward/outward challans for material movements.

**Features:**
- Record material inward entries (party, vehicle, material type, quantity, time in/time out).
- Linked to MOU module for wastage reporting.

---

### 10.2 Added Bills — `/bills`

View and print generated payment slips.

**Features:**
- **Two types of payment slips:**
  - **Bill Invoice (BI-XXXXX)** — formal tax invoices
  - **Cash Invoice (CI-XXXXX)** — cash payment records
- Tabs to switch between invoice types.
- **Filters** — Search, Client, Date range, Status.
- **Table columns** — Payment Slip ID, Bill No., Slip date, Payment type, Client name, Phone, Amount, Status.
- **Actions per bill** — Print (generates PDF using `generateCashChallanPDF` or `generateBillInvoicePDF`), Edit, Delete.
- Bills can be in `pending` or `completed` status.

---

## 11. Reports & Analytics

### 11.1 Analytics Dashboard — `/reports`

Comprehensive analytics view using Recharts visualization library.

**Tab 1: Paper Report**
- Material React Table with advanced sorting/filtering.
- Columns: Paper name, GSM, BF, Shade, Type, Total orders, Total quantity (rolls + kg), Total value (₹), Unique clients, Avg order value, Completed orders, Pending orders, Completion rate, Fulfillment rate.
- Charts: Bar chart (orders by paper type), Pie chart (value distribution).

**Tab 2: Client Report**
- Material React Table per client.
- Charts: Bar chart (orders by client), Line chart (trends).

**Tab 3: Summary**
- KPI cards, aggregate statistics.

**Export:** All tabs support PDF export via jsPDF + autotable.

**Filters:** Date range picker (MUI X DatePickers), client selector.

---

### 11.2 Client-Order Analysis — `/reports/client-orders`

Breaks down orders by client showing order counts, quantities, amounts, fulfillment rates, and trends.

---

### 11.3 Plan Report — `/reports/client-orders-plans`

Shows how cutting plans relate to client orders — which plans serve which clients and their completion status.

---

### 11.4 Order-Plan Execution — `/reports/order-plan-execution`

Cross-references orders against executed plans to show:
- Which order items were fulfilled by which plan.
- Remaining unfulfilled quantities.
- Over-fulfillment cases.

---

### 11.5 Client Order Summary — `/reports/client-order-summary`

A condensed per-client summary showing total ordered, total delivered, outstanding quantities, and payment status.

---

### 11.6 Cut Rolls Report — `/reports/cut-rolls-weight`

Weight analysis of cut rolls:
- Total weight produced per plan.
- Weight by paper spec and width.
- Comparison between expected and actual weights.

---

### 11.7 Filter Cut Rolls — `/reports/all-cut-rolls` and `/reports/all-cut-rolls-filtered`

Browse the full cut roll inventory with advanced filters:
- Plan ID, client, paper spec, width, status, date range.
- Paginated results.
- Export to CSV/PDF.

---

### 11.8 Plan Weights — `/plan-weights`

Shows total weight breakdown per production plan grouped by paper specification and width. Used by dispatch role to understand expected weights before loading.

---

### 11.9 Order Tracking — `/reports/order-tracking`

Tracks the lifecycle of a specific order from creation through planning, production, and dispatch.

---

## 12. Barcode & QR Tools

### 12.1 Barcode Lookup — `/barcode-lookup`

Universal roll search tool.

**Features:**
- **Search input** — Enter any barcode ID (JR_, SET_, CR_, WCR_, SCR_) or reel number.
- **Auto-detect search type** — if input starts with a recognized barcode prefix, searches by barcode; otherwise searches by reel number.
- **Year selector** — filters results by year (±2 years from current).
- **Hierarchy display** — for barcode searches, shows the complete hierarchy:
  - **Jumbo Roll** → **SET Rolls** (expandable) → **Cut Rolls** per SET
  - Each level shows: barcode, width, weight, status, paper specs, client, location
  - SET rows are collapsible via ChevronDown/ChevronRight toggles
- **Wastage allocation display** — for reel number searches, shows stock roll details.
- Status badges and location information at each level.
- Error handling for not-found cases.

---

### 12.2 Roll Tracking — `/roll-tracking`

Track a roll's complete journey through the system:
- Current status and location.
- Which plan it was produced under.
- Dispatch history if dispatched.

---

## 13. Security & In/Out Management

### In/Out Gate Management — `/in-out`

Designed for the `security` role at factory gates.

**Features:**
- Log vehicle arrivals (time in) and departures (time out).
- Link vehicle to a party/client and material.
- Serial number tracking per entry.
- View all pending entries (vehicles on premises — no time out yet).
- View historical entries.
- Mobile-friendly card layout.

---

## 14. Hour Calculator

### `/hour-calculator`

A utility tool for calculating working hours, overtime, or shift durations. Used by QC and admin roles for labour management.

---

## 15. Quality Check

### `/quality-check`

QC (Quality Control) inspection module for the `qc` role.

**Features:**
- Log quality inspection results per roll or batch.
- Pass/Fail marking.
- Defect categorization.

---

## 16. Settings (TOTP / 2FA)

### `/settings/totp`

Two-factor authentication setup using **TOTP** (Time-based One-Time Password).

**Component: `TOTPSetup`**
- Generates a TOTP secret and QR code for scanning with an authenticator app (Google Authenticator, Authy, etc.).
- User scans QR code and enters the 6-digit code to verify and activate 2FA.
- On subsequent logins, OTP is verified via `OTPVerificationModal` before completing dispatch operations.

---

## 17. Roll Hierarchy & Barcode Naming

The system tracks paper rolls through a strict 3-level hierarchy:

```
Jumbo Roll (JR_XXXXX)
  └── Intermediate / SET Roll (SET_XXXXX)   [~118" width after first cut]
        └── Cut Roll (CR_XXXXX)             [final width cuts for client orders]
```

**Special barcode prefixes:**

| Prefix | Meaning |
|--------|---------|
| `JR_XXXXX` | Jumbo Roll — raw material input |
| `SET_XXXXX` | Intermediate roll — after first lengthwise cut to ~118" |
| `CR_XXXXX` | Cut Roll — final product cut to ordered width |
| `WCR_XXXXX` | Wastage Cut Roll — offcut/trim from production |
| `SCR_XXXXX` | Stock Cut Roll — roll sourced from existing stock inventory |

**Roll statuses (production lifecycle):**
- `cutting` — currently being processed
- `in_warehouse` — weight updated, ready for dispatch
- `dispatched` — sent to customer
- `available` (for SCR/WCR) — in stock, available for allocation

---

## 18. PDF Generation Features

The frontend generates multiple PDF document types entirely client-side using **jsPDF** and **jspdf-autotable**:

| PDF Type | Where Used | Contents |
|----------|-----------|---------|
| Plan Report PDF | Plan Master → Download Report | Plan metadata, client list, paper specs, weight calculations, cutting pattern diagrams per jumbo roll |
| Barcode Labels PDF | Plan Master → Print Labels | Barcode images per cut roll, grouped by jumbo roll and SET |
| Plan Summary PDF | Plan Master → Print PDF | Summary table of filtered plans |
| Packing Slip PDF | Past Dispatch | Dispatch details, item list, weights |
| Cash Challan PDF | Bills | Cash payment receipt |
| Bill Invoice PDF | Bills | Formal invoice |
| MOU Wastage Report PDF | MOU Module | Party name, vehicle, MOU values, images |
| Warehouse Report (HTML print) | Dispatch Ready page | Browser-native print of warehouse item table |

**Cutting pattern diagram (Plan Report):**
The PDF visually renders each SET of cuts as a horizontal bar where each cut roll segment is drawn proportionally to its width. Each segment shows the client name, width, and barcode. The remaining waste is shown in red. Below the bar, efficiency statistics are printed (used inches, waste inches, efficiency %).

---

## 19. Key Reusable Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DashboardLayout` | `src/components/DashboardLayout.tsx` | Sidebar + topbar layout with role-based nav |
| `ClientForm` | `src/components/ClientForm.tsx` | Create/edit client modal |
| `MaterialForm` | `src/components/MaterialForm.tsx` | Create/edit material modal |
| `PaperForm` | `src/components/PaperForm.tsx` | Create/edit paper spec modal |
| `DispatchForm` | `src/components/DispatchForm.tsx` | Dispatch creation form |
| `CreateDispatchModal` | `src/components/CreateDispatchModal.tsx` | Full dispatch creation dialog |
| `EditDispatchModal` | `src/components/EditDispatchModal.tsx` | Edit existing dispatch |
| `DispatchSuccessModal` | `src/components/DispatchSuccessModal.tsx` | Post-dispatch confirmation |
| `CreateWastageModal` | `src/components/CreateWastageModal.tsx` | Add new stock/wastage roll |
| `EditWastageModal` | `src/components/EditWastageModal.tsx` | Edit stock/wastage roll |
| `QRScanner` | `src/components/QRScanner.tsx` | Camera QR scanning via ZXing |
| `WeightUpdateScanner` | `src/components/WeightUpdateScanner.tsx` | Scan + weigh roll workflow |
| `CurrentJumboRoll` | `src/components/CurrentJumboRoll.tsx` | Active jumbo roll management |
| `PartialJumboCompleter` | `src/components/PartialJumboCompleter.tsx` | Mark jumbo as partially used |
| `PlanProductionIntegration` | `src/components/PlanProductionIntegration.tsx` | Planning ↔ production bridge |
| `BarcodeDisplay` | `src/components/BarcodeDisplay.tsx` | Render CODE128 barcode image |
| `QRCodeDisplay` | `src/components/QRCodeDisplay.tsx` | Render QR code image |
| `BarcodeDetailsModal` | `src/components/BarcodeDetailsModal.tsx` | Roll detail popup on barcode scan |
| `OrderDetailsModal` | `src/components/OrderDetailsModal.tsx` | Order detail popup |
| `PlanDetailsModal` | `src/components/PlanDetailsModal.tsx` | Plan detail popup |
| `OTPVerificationModal` | `src/components/OTPVerificationModal.tsx` | TOTP verification before dispatch |
| `TOTPSetup` | `src/components/TOTPSetup.tsx` | 2FA setup flow |
| `ConfirmDialog` | `src/components/ConfirmDialog.tsx` | Generic confirmation dialog (used for delete actions) |
| `WastageIndicator` | `src/components/WastageIndicator.tsx` | Badge indicating a roll is a stock roll |
| `paper-spec-selector` | `src/components/paper-spec-selector.tsx` | Dropdown to select paper GSM/BF/shade |
| `NewFlowWorkflow` | `src/components/NewFlowWorkflow.tsx` | Visual production workflow diagram |
| `RollbackPlanDialog` | `src/components/RollbackPlanDialog.tsx` | Dialog to rollback/undo a plan execution |
| `LogoutButton` | `src/components/LogoutButton.tsx` | Standalone logout trigger |

---

## Appendix: Status Values Reference

### Order Status
| Value | Display | Description |
|-------|---------|-------------|
| `created` | Created | Order received, awaiting planning |
| `in_process` | In Process | Plan assigned and executing |
| `completed` | Completed | All rolls produced and dispatched |
| `cancelled` | Cancelled | Order voided |

### Plan Status
| Value | Display | Description |
|-------|---------|-------------|
| `planned` | Planned | Plan created, not yet started |
| `in_progress` | In Progress | Cutting actively underway |
| `completed` | Completed | All cuts done |
| `failed` | Failed | Plan execution encountered an error |

### Priority Levels (Orders)
| Value | Badge Color |
|-------|------------|
| `low` | Outline (grey) |
| `normal` | Default (blue) |
| `high` | Secondary (purple) |
| `urgent` | Destructive (red) |

### Wastage/Stock Status
| Value | Badge |
|-------|-------|
| `available` | Secondary (green-ish) |
| `used` | Default |
| `damaged` | Destructive (red) |
