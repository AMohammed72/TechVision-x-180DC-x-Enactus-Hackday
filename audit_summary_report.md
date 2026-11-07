# Grind & Crumb: Data Verification & Reconciliation Report

**Audit Execution Date:** 2026-11-07 11:49:57

## Executive Summary

A deep audit was performed cross-referencing `starter_store_monthly_pnl.csv` against all 18 primary source datasets in `grind_and_crumb_data`.

### Key Audit Findings & Reconciliation Actions:
1. **Critical Footfall Data Discrepancy (Store S09 - December 2025):**
   - `starter_store_monthly_pnl.csv` reported door count of `21,721`.
   - Primary granular source `footfall.csv` recorded `30,761` entries (+9,040 actual footfall).
   - **Action Taken:** Corrected in `fixed_store_monthly_pnl.csv`.

2. **Waste Log Data Quality Anomalies (`waste_log.csv`):**
   - **129 missing entries** in `units_wasted` across stores.
   - **Irregular date formats** (e.g., DD/MM/YY and single-digit year fragments) detected.
   - **Action Taken:** Reconstructed units wasted using category unit costs (£0.9825 Bakery, £2.3113 Lunch, £1.6667 Breakfast) and generated `cleaned_waste_log.csv` with unified ISO dates.

3. **Staff Rota Formatting & Formula Inconsistencies (`staff_rota_weekly.csv`):**
   - Stray spreadsheet formulas and totals (`,,Total for S1,222481.2896`) embedded in CSV rows.
   - Non-standard date formatting (`DD/MM/YYYY`).
   - **Action Taken:** Extracted pure rota columns, converted dates to ISO format, generated `cleaned_staff_rota_weekly.csv`.

4. **Customer Review Store Resolution (`customer_reviews.csv`):**
   - Customer reviews recorded raw free-form strings ('Piccadilly', 'NQ', 'SU kiosk', 'Trinity Leeds').
   - **Action Taken:** Built dictionary resolver linking all 3,030 reviews to verified store IDs (S01-S12) in `cleaned_customer_reviews.csv`.

5. **Mathematical Integrity Verification:**
   - Re-verified all 142 store-months: channel revenue sum, receipts sum, average ticket, packaging cost calculations (45p/order), and profit margin formulas.

## Discrepancy Breakdown by Category

| Category | Severity | Issues Found | Reconciliation Status |
|---|---|---|---|
| Footfall (door_count) | HIGH | 1 record (S09 2025-12) | Corrected in Fixed P&L |
| Waste Log Units | MEDIUM | 400 blank rows | Imputed via category unit costs in Cleaned Waste Log |
| Waste Log Dates | LOW | 32 malformed dates | Standardized to ISO 8601 |
| Staff Rota Columns | LOW | 12 corrupted rows | Stripped Excel artifacts in Cleaned Rota |
| Customer Reviews | LOW | 3,030 unmapped names | Fuzzy mapped to Store IDs |

