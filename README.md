# Grind & Crumb — Operational Data Verifier, P&L & Huff Gravity Expansion Suite

An end-to-end operational analytics, cross-dataset verification, and spatial expansion modeling platform engineered for **Grind & Crumb** (a 12-store UK specialty café chain).

The application audits and reconciles 18+ raw operational CSV datasets, quantifies financial performance across stores and sales channels, synthesizes customer review and survey sentiment, and projects net profit and cannibalization for candidate expansion sites using an empirically calibrated **Huff Spatial Gravity Model**.

---

## Table of Contents

1. [System Architecture & Key Capabilities](#1-system-architecture--key-capabilities)
2. [Project Structure](#2-project-structure)
3. [Quick Start & Installation](#3-quick-start--installation)
4. [Guide to Main Application Modules](#4-guide-to-main-application-modules)
   - [Data & Integrity: Reconciliation & Errors](#41-data--integrity-reconciliation--errors)
   - [Data & Integrity: Data Explorer & Live CSV Upload](#42-data--integrity-data-explorer--live-csv-upload)
   - [Financial Performance: Executive P&L Dashboard](#43-financial-performance-executive-pl-dashboard)
   - [Financial Performance: Multi-Store Comparison](#44-financial-performance-multi-store-comparison)
   - [Financial Performance: Channel Economics & Profit Drains](#45-financial-performance-channel-economics--profit-drains)
   - [Customer & Sentiment: Review & Survey Sentiment Pipeline](#46-customer--sentiment-review--survey-sentiment-pipeline)
   - [Catchment & Expansion: Huff Gravity Cannibalization Engine](#47-catchment--expansion-huff-gravity-cannibalization-engine)
5. [Command-Line Pipelines & Scripts](#5-command-line-pipelines--scripts)
6. [Accessibility, Navigation & Design System](#6-accessibility-navigation--design-system)

---

## 1. System Architecture & Key Capabilities

The suite is designed with a **dual-mode execution architecture** so it runs seamlessly either via the local Python validation server (`launch_dashboard.py`) or directly as a zero-dependency standalone web application (`index.html` + `dashboard_data.js` + `app.js`):

- **Automated Cross-Dataset Verification & Auto-Fix Engine (`validate_grind_crumb.py`):** Runs 29+ cross-table relational, arithmetic, chronological, and schema checks alongside per-column domain checks. Any anomalies detected in baseline or user-uploaded CSV files are automatically fixed/imputed and logged to the **Reconciliation & Errors** dashboard with their affected CSV files.
- **Dynamic P&L, Event & Promotion Campaign Impact Engine (`generate_advanced_insights.py` & `app.js`):** Tracks monthly revenue, store profit, margins, footfall conversion, and pre/post profit shifts around major business events (`business_events.csv`) and marketing promotion campaigns (`promotions.csv`, such as *PR01 Pastry BOGO*, *PR02 Lunch Meal Deal*, *PR03 Festive Menu*, *PR04 App Double Stamps*, *PR05 Student 20% Off*, and *PR06 Matcha Launch*).
- **Unified Customer Review & Survey NLP Pipeline (`review_sentiment_pipeline.py`):** Processes both `customer_reviews.csv` (3,030 reviews) and `customer_survey.csv` (650 survey responses) using either the Google Gemini API (`gemini-2.5-flash`) or an offline rule-based domain NLP classifier to generate store-by-store ratings, NPS, sentiment scores (`-1.0` to `+1.0`), operational positives, and areas to improve.
- **Huff Spatial Gravity Expansion Model:** Estimates monthly customer volume, average ticket spend, standalone P&L, and spatial cannibalization (`P_ij = (A_j / d_ij^λ) / Σ(A_k / d_ik^λ)`) for candidate sites (`CS1`–`CS7`) against existing stores (`S01`–`S12`).

---

## 2. Project Structure

```text
├── grind_and_crumb_data/             # Raw source CSV datasets (18 tables)
│   ├── starter_store_monthly_pnl.csv # Unreconciled monthly store P&L
│   ├── stores.csv                    # Canonical store master (S01–S12)
│   ├── store_catchment.csv           # Catchment demographics for existing stores
│   ├── candidate_sites.csv           # Candidate expansion locations (CS1–CS7)
│   ├── customer_reviews.csv          # Raw customer reviews
│   ├── customer_survey.csv           # Customer survey responses & NPS
│   ├── footfall.csv                  # Granular daily/daypart door counts
│   ├── transactions.csv              # POS transaction headers
│   ├── transaction_lines.csv         # POS line items
│   ├── products.csv                  # Master product catalog & pricing
│   ├── waste_log.csv                 # Daily food waste records
│   ├── staff_rota_weekly.csv         # Weekly scheduled labour hours & wages
│   ├── staff_monthly.csv             # Monthly headcount, starters & leavers
│   ├── business_events.csv           # Key operational & commercial events
│   └── promotions.csv                # Marketing promotion campaigns (PR01–PR06)
├── index.html                        # Main dashboard UI & categorized navigation
├── style.css                         # Design system tokens, layout & responsive styles
├── app.js                            # Client-side analytics, interactive charts & validator
├── dashboard_data.js                 # Pre-compiled JSON dataset bundle for instant load
├── launch_dashboard.py               # Local HTTP server + /api/validate-csv endpoints
├── launch_dashboard.bat              # One-click Windows launcher
├── validate_grind_crumb.py           # Cross-dataset & single-file CSV validation engine
├── review_sentiment_pipeline.py      # Review & survey NLP sentiment pipeline
├── generate_advanced_insights.py     # Builds Huff model, sentiment & validation into dashboard_data.js
├── verify_and_reconcile.py           # Reconciles raw CSVs into cleaned output files
├── fixed_store_monthly_pnl.csv       # Reconciled master P&L output
├── cleaned_waste_log.csv             # Reconciled waste log (ISO dates & imputed units)
├── cleaned_staff_rota_weekly.csv     # Deduplicated & stripped rota table
├── cleaned_customer_reviews.csv      # Deduplicated reviews mapped to canonical store_ids
└── customer_reviews_sentiment.csv    # Enriched review sentiment output
```

---

## 3. Quick Start & Installation

### Prerequisites
- **Modern Web Browser:** Chrome, Edge, Firefox, or Safari.
- **Python 3.9+** *(optional for static viewing, required for running the backend validation API or regenerating data scripts)* with `pandas` and `numpy`:
  ```bash
  pip install pandas numpy
  ```

### Option A: Launch with Local Server & Python Validation API (Recommended)
1. Run the launcher script from the project root:
   ```bash
   python launch_dashboard.py
   ```
   *(On Windows, you can also double-click `launch_dashboard.bat`.)*
2. Your browser will automatically open `http://localhost:8080/index.html`.
3. In this mode, live CSV uploads in the **Data Explorer & Upload** tab automatically call `POST /api/validate-csv` (powered by `validate_grind_crumb.py`), with automatic client-side fallback if offline.

### Option B: Zero-Server Standalone Mode
1. Open `index.html` directly in any web browser (`file:///...`).
2. Because `dashboard_data.js` pre-bundles the reconciled tables and `app.js` includes a full client-side mirror of the validation, sentiment, and Huff Gravity engines, all interactive features—including drag-and-drop CSV validation and dashboard regeneration—work offline without a backend server.

---

## 4. Guide to Main Application Modules

The application uses a **Categorized Primary Navigation Bar** paired with a **Quick Switch** bar so every module is reachable in one or two clicks without horizontal scrolling. All major tables and store card lists default to a **3-item preview** and can be expanded or collapsed using the bottom toggle bar (`▼ Show All ...` / `▲ Collapse to Preview`).

### 4.1 Data & Integrity: Reconciliation & Errors
- **Purpose:** Provides an audit trail of every data quality defect discovered across the raw CSV files and how the engine automatically resolved it.
- **How to Use:**
  - Filter discrepancies by **Severity** (`High / Critical`, `Medium`, `Low`) or **Category** (`Footfall`, `Waste Quality`, `Staff Rota`, `Reviews Mapping`, `Validation & Schema`).
  - Inspect the **Affected CSV File(s)** column to see which source and target files are impacted by each check.
  - Review the **Deep-Dive Diff Inspector** at the bottom of the page for a side-by-side comparison of the original malformed record versus the reconciled ground truth (such as Store `S09` Harrogate's December 2025 `door_count` undercount of `21,721` vs. true `30,761` in `footfall.csv`).
  - Click any of the **Reconciled Output Files** buttons (`fixed_store_monthly_pnl.csv`, `cleaned_waste_log.csv`, `cleaned_staff_rota_weekly.csv`, `cleaned_customer_reviews.csv`, `customer_reviews_sentiment.csv`) to download the cleaned datasets.

### 4.2 Data & Integrity: Data Explorer & Live CSV Upload
- **Purpose:** Allows you to upload new or modified CSV files, validate them against all schema and cross-dataset rules, auto-fix anomalies, and immediately regenerate every chart and strategic callout across the dashboard.
- **How to Use:**
  1. **Drag & Drop or Select CSV Files:** Drop one or more `.csv` files into the upload zone (e.g., `candidate_sites.csv`, `customer_survey.csv`, `starter_store_monthly_pnl.csv`, `waste_log.csv`).
  2. **Unified Validation Suite:** The validator runs all column-level checks on each uploaded file (encoding, required columns, stray `Unnamed:` columns, primary key uniqueness, positive/non-negative numeric bounds, domain ranges, ISO `YYYY-MM-DD` date normalization, foreign key `store_id` checks, and P&L accounting equations) **plus** the full cross-dataset test suite across all files.
  3. **Auto-Reconciliation & Live Ingestion:** Any errors found are automatically repaired, logged to the **Reconciliation & Errors** tab, and applied to the active dashboard state. Click **✓ Apply Reconciled Data to Dashboard** (or **Dismiss Banner**) to close the confirmation banner.
  4. **Browse & Export Tables:** Use the **Active Dataset** dropdown to inspect any table in the system and click **Export Table to CSV** to download the active view.

### 4.3 Financial Performance: Executive P&L Dashboard
- **Purpose:** High-level financial and operational monitoring across the 12-store estate from `2025-07` to `2026-06`.
- **How to Use:**
  - Use the top filter bar to slice by **Store**, **City**, **Format** (`Flagship`, `Standard`, `Kiosk`), or **Month**.
  - Hover over data points on the **Monthly Sales & Profit Trajectory with Integrated Events & Promotion Campaigns** line chart to inspect exact monthly figures, operational events (`⚡ Event`), and active promotion campaigns (`🏷️ Promo`, including campaign mechanic, participating stores, and marketing spend).
  - Review the **Business Events & Promotion Campaigns Impact Tracker** directly below the trajectory chart:
    - Combines major operational events (`business_events.csv`) and marketing campaigns (`promotions.csv`) filtered dynamically for the selected store or chain-wide scope.
    - Generates dynamic campaign descriptions from `promotions.csv` and active P&L metrics (detailing campaign category, offer mechanic, active date range, targeted stores, marketing spend, sales shift, and net profit vs. spend ratio).
    - Defaults to a **3-card preview** and can be expanded or collapsed using the bottom toggle bar (`▼ Show All ... events & promotion campaigns` / `▲ Collapse to Preview`).
  - Hover over slices of the **Total Cost Breakdown** and **Sales Channel Revenue Contribution** donut charts for exact GBP values and percentage shares.
  - Click any column header in the **Store Performance League Table** to sort stores by Total Sales, Store Profit, Margin %, ★ Rating, Sentiment Score, Footfall, Conversion, or Avg Ticket.

### 4.4 Financial Performance: Multi-Store Comparison
- **Purpose:** Head-to-head financial and operational benchmarking for two or more stores over any time window.
- **How to Use:**
  - Click the **Quick Presets** (e.g., *Leeds: S03 vs S12*, *Manchester: S05 vs S06 vs S07*, *Sheffield: S01 vs S02 vs S11*, *Top 3 Profit Leaders*) or toggle individual store chips to select stores.
  - Choose a **Time Window / Month** and **Trajectory Metric** (`Store Profit / Loss (£)`, `Profit Margin (%)`, `Total Sales (£)`, or `Footfall Door Count`).
  - Inspect the **Side-by-Side Profit / Loss Timeline**, the **Head-to-Head Summary Cards**, and the **Detailed Financial Comparison Table** (which automatically calculates exact `Δ Variance` when comparing 2 stores, or the `Selected Stores Benchmark Avg` when comparing 3+ stores).

### 4.5 Financial Performance: Channel Economics & Profit Drains
- **Purpose:** Audits profitability across **In-Store Walk-in**, **App (Click & Collect)**, and **Third-Party Delivery**.
- **How to Use:**
  - Compare gross contribution and estimated net margin across all three channels, calculated dynamically from the active P&L dataset.
  - Review the **Controllable Profit Drain Analysis** callout, which quantifies how third-party platform commissions (27%–33%), packaging costs (£0.45/order), and staff packing labour (~4 min/order) compress delivery margins compared to In-Store and App Click & Collect.

### 4.6 Customer & Sentiment: Review & Survey Sentiment Pipeline
- **Purpose:** Combines unstructured feedback from online customer reviews (`customer_reviews.csv`) and structured + free-text responses from the customer survey (`customer_survey.csv`) for every store.
- **How to Use:**
  - Filter by **Store**, sort by sentiment score, star rating, or review volume, or search keywords (e.g., `oat milk`, `app`, `queue`, `seating`).
  - Within each store card, inspect two stacked summaries using identical sentiment logic and visual layout:
    1. **Customer Review Sentiment Summary:** Shows review count, average star rating (`/ 5.0`), sentiment score, `✓ Current Positives`, and `⚠️ Areas to Improve`.
    2. **Customer Survey Sentiment Summary:** Shows survey response count, 5-star equivalent rating & NPS (`/ 10`), survey sentiment score, `✓ Current Positives`, and `⚠️ Areas to Improve`.
  - Click any individual store card header to collapse/expand its details, or use the bottom preview toggle bar to expand all 12 stores.

### 4.7 Catchment & Expansion: Huff Gravity Cannibalization Engine
- **Purpose:** Evaluates candidate expansion sites (`CS1`–`CS7`) by estimating customer demand, average ticket spend, standalone store profit, and spatial cannibalization against existing stores.
- **How to Use:**
  - Adjust the interactive model sliders to run sensitivity scenarios in real time:
    - **Distance Decay (`λ`, default `2.0`):** Controls how rapidly a new site's gravitational pull decays with distance (`d_ij^λ`).
    - **Size Attractiveness (`α`, default `0.85`):** Controls how strongly store square footage influences site utility (`A_j`).
    - **Customer Spend Sensitivity (`85%`–`115%`):** Stress-tests estimated average customer ticket size.
  - **Standalone Profit vs. Cannibalization Loss vs. Net Chain Profit Bar Chart:** Hover over any candidate site's grouped bars to compare its standalone profit against cannibalized profit and net incremental chain profit.
  - **Spatial Huff Gravity & Cannibalization Network:** Select a city from the **City** dropdown (`Leeds`, `Sheffield`, `Manchester`, `York`, `Liverpool`, `Wakefield`) to view a clean single-city network graph. Hover over any connection line or node to inspect inter-site distance (miles), Huff utility pull (`U_ij`), percentage of traffic diverted, and monthly profit cannibalized.
  - Review the dynamically generated **Huff Gravity Strategic Insight** callout and the **Candidate Expansion Sites Matrix** to distinguish **Prime Expansion / Viable Growth** sites (such as `CS1 Leeds Headingley`, `CS5 Liverpool Bold Street`, and `CS2 Sheffield Kelham Island`) from **Cannibalization Traps** (such as `CS7 Leeds Wellington Place`, located 0.42 miles from `S12` and 0.52 miles from `S03`).

---

## 5. Command-Line Pipelines & Scripts

If you modify the underlying Python logic or raw CSV files in `grind_and_crumb_data/`, you can run the backend pipelines directly from the terminal:

1. **Run the Full Dataset or Single-File Validator:**
   ```bash
   # Validate all 18+ tables in grind_and_crumb_data/
   python validate_grind_crumb.py

   # Validate a specific CSV file and output JSON
   python validate_grind_crumb.py --file grind_and_crumb_data/customer_survey.csv --json
   ```

2. **Run the Customer Review & Survey Sentiment Pipeline:**
   ```bash
   # Uses local rule-based NLP by default, or Gemini API if GEMINI_API_KEY is set
   python review_sentiment_pipeline.py
   ```

3. **Regenerate `dashboard_data.js` (Huff Model, Events, Sentiment & Validation Report):**
   ```bash
   python generate_advanced_insights.py
   ```

---

## 6. Accessibility, Navigation & Design System

- **Keyboard Navigation & ARIA Support:**
  - Use `Tab` / `Shift+Tab` to move across primary category triggers (`.nav-group-trigger`), direct links, and quick-switch pills (`.nav-pill`).
  - Press `Enter`, `Space`, or `ArrowDown` on a category dropdown (`Data & Integrity` or `Financial Performance`) to open the menu and focus the first item.
  - Use `ArrowDown` and `ArrowUp` to cycle through dropdown items, and press `Escape` at any time to close open dropdowns or the mobile drawer and return focus to the trigger.
- **Responsive Mobile Drawer:** On viewports `≤ 900px`, the navigation automatically switches to a compact **Menu** hamburger toggle (`#mobileNavToggle`) with an expandable vertical accordion drawer.
- **Typography & Color Tokens:** Built with crisp high-contrast off-white surfaces (`#F8FAFC` / `#FFFFFF`), charcoal typography (`#0F172A`), rich espresso brown (`#4A2E2B`) primary accents, warm amber (`#B45309`) alerts, *Instrument Serif* / *Playfair Display* headings, and *Plus Jakarta Sans* (`tabular-nums`) for all financial tables.
