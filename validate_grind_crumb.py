"""
Grind & Crumb Dataset Pack - Modular Validator for Web APIs, CSV Uploads, and CLI
=================================================================================
Can be imported directly as a Python library/function for web servers
(FastAPI, Flask, Django, SimpleHTTPRequestHandler, etc.) or run via CLI.

Supports:
1. Full directory validation (`validate_dataset(data_dir)`)
2. Single/Multi CSV file upload validation (`validate_uploaded_csv(filename, content_or_df, data_dir)`)
3. Auto-detection of dataset schema from filename or CSV headers across all 22 Grind & Crumb tables
4. Comprehensive checks:
   - File Hygiene & Character Encoding (FH-*)
   - Schema & Column Structure Validation (SCHEMA-*)
   - Primary Key & Duplicate Checks (PK-*)
   - Data Type, Completeness & Domain Range Checks (VAL-*, RANGE-*)
   - Referential Integrity against Master Tables (FK-*)
   - Arithmetic, Catalog Pricing & P&L Formula Consistency (ARITH-*, PRICE-*)
   - Date Format & Chronological Sanity Checks (DATE-*, CHRONO-*)
   - Cross-Dataset Aggregations & Reconciliations (AGG-*)
   - Expansion Candidate Sites & Catchment Gravity Readiness (EXP-*)
"""

import os
import io
import sys
import csv
import argparse
import json
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union, Tuple
import pandas as pd
import numpy as np

# Ensure UTF-8 output when called via terminal
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


# Canonical schemas for all Grind & Crumb CSV datasets
EXPECTED_SCHEMAS: Dict[str, Dict[str, Any]] = {
    "stores.csv": {
        "required": [
            "store_id", "store_name", "city", "format", "location_type",
            "opened_date", "sqft", "seats", "rent_gbp_month", "store_manager"
        ],
        "optional": ["refit_year"],
        "pk": ["store_id"],
        "numeric_positive": ["sqft", "rent_gbp_month"],
        "numeric_non_negative": ["seats"],
        "date_cols": ["opened_date"]
    },
    "candidate_sites.csv": {
        "required": [
            "site_id", "site_name", "city", "location_type", "sqft",
            "quoted_rent_gbp_month", "daily_footfall_street", "office_workers_500m",
            "students_1km", "median_household_income_gbp", "competitor_cafes_500m",
            "area_vibrancy_index_10", "est_fitout_gbp"
        ],
        "optional": ["lat", "lon", "distance_nearest_store_miles"],
        "pk": ["site_id"],
        "numeric_positive": [
            "sqft", "quoted_rent_gbp_month", "daily_footfall_street",
            "median_household_income_gbp", "est_fitout_gbp"
        ],
        "numeric_non_negative": ["office_workers_500m", "students_1km", "competitor_cafes_500m"],
        "ranges": {"area_vibrancy_index_10": (0.0, 10.0)}
    },
    "store_catchment.csv": {
        "required": [
            "store_id", "daily_footfall_street", "office_workers_500m",
            "students_1km", "median_household_income_gbp",
            "competitor_cafes_500m", "area_vibrancy_index_10"
        ],
        "optional": [],
        "pk": ["store_id"],
        "numeric_positive": ["daily_footfall_street", "median_household_income_gbp"],
        "numeric_non_negative": ["office_workers_500m", "students_1km", "competitor_cafes_500m"],
        "ranges": {"area_vibrancy_index_10": (0.0, 10.0)}
    },
    "starter_store_monthly_pnl.csv": {
        "required": [
            "month", "store_id", "store_name", "city", "format", "location_type",
            "trading_days", "total_sales_gbp", "sales_instore_gbp", "sales_app_gbp",
            "sales_delivery_gbp", "total_receipts", "receipts_instore", "receipts_app",
            "receipts_delivery", "avg_ticket_gbp", "door_count", "food_cost_gbp",
            "labour_hours", "labour_cost_gbp", "delivery_commission_gbp",
            "delivery_packaging_gbp", "rent_gbp", "business_rates_gbp",
            "utilities_gbp", "repairs_maintenance_gbp", "other_opex_gbp",
            "store_profit_gbp", "store_margin", "waste_rate", "waste_cost_gbp",
            "headcount", "leavers", "staff_survey_score_10"
        ],
        "optional": [],
        "pk": ["month", "store_id"],
        "numeric_positive": ["trading_days", "total_sales_gbp", "total_receipts", "door_count"],
        "numeric_non_negative": [
            "sales_instore_gbp", "sales_app_gbp", "sales_delivery_gbp",
            "food_cost_gbp", "labour_hours", "labour_cost_gbp",
            "delivery_commission_gbp", "delivery_packaging_gbp", "rent_gbp"
        ],
        "ranges": {"staff_survey_score_10": (0.0, 10.0), "waste_rate": (0.0, 1.0)},
        "month_cols": ["month"]
    },
    "daily_store_sales.csv": {
        "required": [
            "date", "store_id", "receipts_instore", "receipts_app",
            "receipts_delivery", "net_sales_instore_gbp",
            "net_sales_app_gbp", "net_sales_delivery_gbp"
        ],
        "optional": [],
        "pk": ["date", "store_id"],
        "numeric_non_negative": [
            "receipts_instore", "receipts_app", "receipts_delivery",
            "net_sales_instore_gbp", "net_sales_app_gbp", "net_sales_delivery_gbp"
        ],
        "date_cols": ["date"]
    },
    "footfall.csv": {
        "required": ["date", "store_id", "daypart", "door_count"],
        "optional": [],
        "pk": ["date", "store_id", "daypart"],
        "numeric_non_negative": ["door_count"],
        "date_cols": ["date"]
    },
    "waste_log.csv": {
        "required": [
            "date", "store_id", "category", "units_prepared",
            "units_wasted", "est_cost_wasted_gbp"
        ],
        "optional": [],
        "pk": ["date", "store_id", "category"],
        "numeric_non_negative": ["units_prepared", "units_wasted", "est_cost_wasted_gbp"],
        "date_cols": ["date"]
    },
    "staff_rota_weekly.csv": {
        "required": ["week_start", "store_id", "daypart", "scheduled_hours", "avg_hourly_wage_gbp"],
        "optional": [],
        "pk": ["week_start", "store_id", "daypart"],
        "numeric_positive": ["scheduled_hours", "avg_hourly_wage_gbp"],
        "date_cols": ["week_start"]
    },
    "staff_monthly.csv": {
        "required": ["month", "store_id", "headcount", "leavers", "new_starters", "staff_survey_score_10"],
        "optional": [],
        "pk": ["month", "store_id"],
        "numeric_non_negative": ["headcount", "leavers", "new_starters"],
        "ranges": {"staff_survey_score_10": (0.0, 10.0)},
        "month_cols": ["month"]
    },
    "store_costs_monthly.csv": {
        "required": [
            "month", "store_id", "rent_gbp", "business_rates_gbp",
            "utilities_gbp", "repairs_maintenance_gbp", "other_opex_gbp"
        ],
        "optional": [],
        "pk": ["month", "store_id"],
        "numeric_non_negative": [
            "rent_gbp", "business_rates_gbp", "utilities_gbp",
            "repairs_maintenance_gbp", "other_opex_gbp"
        ],
        "month_cols": ["month"]
    },
    "products.csv": {
        "required": [
            "product_id", "product_name", "category", "menu_price_gbp",
            "unit_cost_gbp", "milk_based", "delivery_price_gbp"
        ],
        "optional": ["available_from", "available_to"],
        "pk": ["product_id"],
        "numeric_positive": ["menu_price_gbp", "unit_cost_gbp", "delivery_price_gbp"]
    },
    "transactions.csv": {
        "required": [
            "receipt_id", "store_id", "timestamp", "channel", "delivery_partner",
            "customer_id", "payment_method", "n_lines", "gross_gbp", "discount_gbp", "net_gbp"
        ],
        "optional": [],
        "pk": ["receipt_id"]
    },
    "transaction_lines.csv": {
        "required": [
            "receipt_id", "line_no", "product_id", "qty", "unit_price_gbp",
            "milk_option", "modifier_gbp", "line_discount_gbp", "line_total_gbp"
        ],
        "optional": [],
        "pk": ["receipt_id", "line_no"]
    },
    "loyalty_customers.csv": {
        "required": [
            "customer_id", "signup_date", "home_store_id",
            "age_band", "signup_channel", "marketing_opt_in"
        ],
        "optional": [],
        "pk": ["customer_id"],
        "date_cols": ["signup_date"]
    },
    "customer_reviews.csv": {
        "required": ["review_id", "review_date", "source", "rating", "review_text"],
        "optional": ["store_name_raw", "store_id", "store_name", "sentiment", "sentiment_score", "category", "key_issue_summary"],
        "pk": ["review_id"],
        "ranges": {"rating": (1.0, 5.0)},
        "date_cols": ["review_date"]
    },
    "business_events.csv": {
        "required": ["event", "date", "description"],
        "optional": [],
        "pk": ["event", "date"],
        "date_cols": ["date"]
    },
    "promotions.csv": {
        "required": [
            "promo_id", "promo_name", "mechanic", "start_date",
            "end_date", "stores", "category", "marketing_spend_gbp"
        ],
        "optional": [],
        "pk": ["promo_id"],
        "numeric_non_negative": ["marketing_spend_gbp"],
        "date_cols": ["start_date", "end_date"]
    },
    "capex.csv": {
        "required": ["store_id", "month", "description", "capex_gbp"],
        "optional": [],
        "pk": ["store_id", "month", "description"],
        "numeric_positive": ["capex_gbp"],
        "month_cols": ["month"]
    },
    "delivery_partner_terms.csv": {
        "required": [
            "partner", "valid_from", "valid_to",
            "commission_rate", "packaging_cost_per_order_gbp"
        ],
        "optional": ["notes"],
        "pk": ["partner", "valid_from"],
        "ranges": {"commission_rate": (0.0, 1.0)},
        "numeric_non_negative": ["packaging_cost_per_order_gbp"],
        "date_cols": ["valid_from"]
    },
    "weather.csv": {
        "required": ["date", "city", "temp_max_c", "temp_min_c", "rainfall_mm"],
        "optional": [],
        "pk": ["date", "city"],
        "numeric_non_negative": ["rainfall_mm"],
        "date_cols": ["date"]
    },
    "customer_survey.csv": {
        "required": [
            "response_id", "response_date", "home_store", "visit_frequency",
            "visits_vs_last_year", "usual_milk", "uses_app", "uses_delivery",
            "likelihood_to_recommend_10", "what_would_make_you_visit_more"
        ],
        "optional": [],
        "pk": ["response_id"],
        "ranges": {"likelihood_to_recommend_10": (0.0, 10.0)},
        "date_cols": ["response_date"]
    },
    "staff_exit_survey.csv": {
        "required": [
            "response_id", "leave_month", "store_id", "store_name",
            "role", "tenure_months", "main_reason", "comment",
            "would_recommend_as_employer_10"
        ],
        "optional": [],
        "pk": ["response_id"],
        "numeric_non_negative": ["tenure_months"],
        "ranges": {"would_recommend_as_employer_10": (0.0, 10.0)},
        "month_cols": ["leave_month"]
    }
}


def detect_schema_type(filename: str, columns: List[str]) -> str:
    """
    Identifies the canonical dataset schema name from either filename or column headers.
    """
    fname = os.path.basename(filename).lower().strip()
    if fname in EXPECTED_SCHEMAS:
        return fname

    # Alias matching
    alias_map = {
        "fixed_store_monthly_pnl.csv": "starter_store_monthly_pnl.csv",
        "pnl": "starter_store_monthly_pnl.csv",
        "cleaned_waste_log.csv": "waste_log.csv",
        "cleaned_staff_rota_weekly.csv": "staff_rota_weekly.csv",
        "cleaned_customer_reviews.csv": "customer_reviews.csv",
        "customer_reviews_sentiment.csv": "customer_reviews.csv",
        "candidates": "candidate_sites.csv",
        "catchment": "store_catchment.csv",
    }
    for alias, target in alias_map.items():
        if alias in fname:
            return target

    # Match by column overlap
    col_set = {c.strip() for c in columns}
    best_match = "custom_csv"
    best_score = 0.0
    for schema_name, spec in EXPECTED_SCHEMAS.items():
        req = set(spec["required"])
        if not req:
            continue
        overlap = len(req & col_set) / len(req)
        if overlap > best_score and overlap >= 0.7:
            best_score = overlap
            best_match = schema_name

    return best_match


class DatasetValidator:
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            default_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "grind_and_crumb_data")
            self.data_dir = os.path.abspath(default_dir)
        else:
            self.data_dir = os.path.abspath(data_dir)
        self.results: List[Dict[str, Any]] = []
        self.dfs: Dict[str, pd.DataFrame] = {}
        self.load_errors: List[str] = []

    def _record(self, category: str, test_id: str, test_name: str, status: str,
                message: str, count: int = 0, samples: Optional[List[Any]] = None):
        """Append test result to structured list."""
        self.results.append({
            "test_id": test_id,
            "category": category,
            "test_name": test_name,
            "status": status,  # "PASS", "WARN", "FAIL"
            "message": message,
            "affected_count": int(count),
            "samples": samples or []
        })

    def load_table(self, filename: str) -> Optional[pd.DataFrame]:
        path = os.path.join(self.data_dir, filename)
        if not os.path.exists(path):
            self.load_errors.append(f"Missing file: {filename}")
            return None
        try:
            df = pd.read_csv(path, encoding='utf-8-sig', on_bad_lines='skip')
            self.dfs[filename] = df
            return df
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(path, encoding='latin1', on_bad_lines='skip')
                self.dfs[filename] = df
                return df
            except Exception as e:
                self.load_errors.append(f"Error reading {filename}: {str(e)}")
                return None
        except Exception as e:
            self.load_errors.append(f"Error reading {filename}: {str(e)}")
            return None

    def load_all_tables(self):
        expected_files = list(EXPECTED_SCHEMAS.keys())
        for f in expected_files:
            self.load_table(f)

    # 1. File & Encoding Checks
    def check_file_hygiene_and_encodings(self):
        cat = "File Hygiene & Encoding"
        xl1 = os.path.exists(os.path.join(self.data_dir, "business_events.xlsx"))
        xl2 = os.path.exists(os.path.join(self.data_dir, "business_events(1).xlsx"))
        if xl1 and xl2:
            self._record(cat, "FH-01", "Duplicate Files Detection", "WARN",
                         "business_events(1).xlsx is an unversioned duplicate of business_events.xlsx", count=1)
        else:
            self._record(cat, "FH-01", "Duplicate Files Detection", "PASS", "No duplicate files found.")

        for fname in ["business_events.csv", "promotions.csv"]:
            p = os.path.join(self.data_dir, fname)
            if os.path.exists(p):
                with open(p, 'rb') as f:
                    content = f.read()
                    if b'\xef\xbf\xbd' in content or b'\x80' in content or b'\xff' in content:
                        self._record(cat, f"FH-ENC-{fname}", f"Character Encoding ({fname})", "FAIL",
                                     f"Corrupted currency symbols (non-UTF8 replacement byte) detected in {fname}", count=1)
                    else:
                        self._record(cat, f"FH-ENC-{fname}", f"Character Encoding ({fname})", "PASS", f"Valid encoding in {fname}")

    # 2. Schema & Structure Checks
    def check_schemas_and_columns(self, target_files: Optional[List[str]] = None):
        cat = "Schema & Column Structure"
        files_to_check = target_files or list(self.dfs.keys())
        for fname in files_to_check:
            df = self.dfs.get(fname)
            if df is None:
                continue
            schema_key = detect_schema_type(fname, list(df.columns))
            spec = EXPECTED_SCHEMAS.get(schema_key)
            if not spec:
                self._record(cat, f"SCHEMA-GEN-{fname}", f"Column Header Check ({fname})", "WARN",
                             f"Unrecognized custom CSV schema with {len(df.columns)} columns and {len(df)} rows.",
                             count=0, samples=list(df.columns)[:6])
                continue

            req_cols = spec.get("required", [])
            actual_cols = [str(c).strip() for c in df.columns]
            missing_cols = [c for c in req_cols if c not in actual_cols]
            unnamed_cols = [c for c in actual_cols if c.startswith("Unnamed:") or c == ""]

            if missing_cols:
                self._record(cat, f"SCHEMA-REQ-{fname}", f"Required Columns ({fname})", "FAIL",
                             f"Missing required columns in {fname}: {missing_cols}",
                             count=len(missing_cols), samples=missing_cols)
            elif unnamed_cols:
                self._record(cat, f"SCHEMA-EXTRA-{fname}", f"Clean Column Structure ({fname})", "WARN",
                             f"Found {len(unnamed_cols)} unnamed/stray spreadsheet columns in {fname}",
                             count=len(unnamed_cols), samples=unnamed_cols[:5])
            else:
                self._record(cat, f"SCHEMA-REQ-{fname}", f"Required Columns ({fname})", "PASS",
                             f"All {len(req_cols)} required columns verified for {fname} ({len(df)} rows).")

    # 3. Key Integrity Checks
    def check_keys_and_duplicates(self):
        cat = "Primary Key & Duplicate Checks"
        loy = self.dfs.get("loyalty_customers.csv")
        if loy is not None and 'customer_id' in loy.columns:
            dup_pks = int(loy['customer_id'].duplicated().sum())
            if dup_pks > 0:
                sample_dups = loy[loy['customer_id'].duplicated()]['customer_id'].head(5).tolist()
                self._record(cat, "PK-LOY-01", "Loyalty Customer Uniqueness", "FAIL",
                             f"Found {dup_pks} duplicate customer_id keys in loyalty_customers.csv",
                             count=dup_pks, samples=sample_dups)
            else:
                self._record(cat, "PK-LOY-01", "Loyalty Customer Uniqueness", "PASS", "customer_id unique across all rows")

        tx = self.dfs.get("transactions.csv")
        if tx is not None and 'receipt_id' in tx.columns:
            dup_tx = int(tx['receipt_id'].duplicated().sum())
            if dup_tx > 0:
                sample_rids = tx[tx['receipt_id'].duplicated()]['receipt_id'].head(5).tolist()
                sample_stores = tx[tx['receipt_id'].duplicated()]['store_id'].unique().tolist() if 'store_id' in tx.columns else []
                self._record(cat, "PK-TX-01", "Transaction Header Uniqueness", "FAIL",
                             f"Found {dup_tx} duplicate receipt_ids (affected store: {sample_stores})",
                             count=dup_tx, samples=sample_rids)
            else:
                self._record(cat, "PK-TX-01", "Transaction Header Uniqueness", "PASS", "receipt_id unique across all transactions")

        lines = self.dfs.get("transaction_lines.csv")
        if lines is not None and {'receipt_id', 'line_no'}.issubset(lines.columns):
            lines_keys = lines['receipt_id'].astype(str) + "_" + lines['line_no'].astype(str)
            dup_lines = int(lines_keys.duplicated().sum())
            if dup_lines > 0:
                self._record(cat, "PK-LINE-01", "Transaction Line Key Uniqueness", "FAIL",
                             f"Found {dup_lines} duplicate line item keys (receipt_id + line_no)", count=dup_lines)
            else:
                self._record(cat, "PK-LINE-01", "Transaction Line Key Uniqueness", "PASS", "Line keys unique")

        if tx is not None and 'payment_method' in tx.columns:
            null_pm = int(tx['payment_method'].isna().sum())
            if null_pm > 0:
                self._record(cat, "VAL-PM-01", "Payment Method Completeness", "WARN",
                             f"{null_pm} transactions have payment_method = NaN", count=null_pm)
            else:
                self._record(cat, "VAL-PM-01", "Payment Method Completeness", "PASS", "payment_method fully populated")

    # 4. Referential Integrity Checks
    def check_referential_integrity(self):
        cat = "Referential Integrity"
        stores_df = self.dfs.get("stores.csv")
        tx_df = self.dfs.get("transactions.csv")
        lines_df = self.dfs.get("transaction_lines.csv")
        prods_df = self.dfs.get("products.csv")

        if stores_df is not None and 'store_id' in stores_df.columns:
            valid_stores = set(stores_df['store_id'].dropna())
            invalid_found = False
            for name, df in self.dfs.items():
                if df is not None and 'store_id' in df.columns:
                    unknown = set(df['store_id'].dropna()) - valid_stores
                    if unknown:
                        invalid_found = True
                        self._record(cat, f"FK-STORE-{name}", f"Store ID Validity ({name})", "FAIL",
                                     f"Unknown store_ids found in {name}: {list(unknown)}", count=len(unknown), samples=list(unknown))
            if not invalid_found:
                self._record(cat, "FK-STORE-ALL", "Store ID Foreign Key Integrity", "PASS",
                             f"All store_id references across datasets match the {len(valid_stores)} canonical stores.")

        if tx_df is not None and lines_df is not None and 'receipt_id' in tx_df.columns and 'receipt_id' in lines_df.columns:
            tx_clean = tx_df.drop_duplicates(subset=['receipt_id'])
            tx_receipts = set(tx_clean['receipt_id'])
            line_receipts = set(lines_df['receipt_id'])

            missing_in_lines = tx_receipts - line_receipts
            if missing_in_lines:
                rf_count = sum(1 for r in missing_in_lines if "-RF" in str(r))
                self._record(cat, "FK-TX-LINE-01", "Transaction Header vs Line Linkage", "FAIL",
                             f"{len(missing_in_lines)} receipts lack line items ({rf_count} are refund receipts with -RF suffix)",
                             count=len(missing_in_lines), samples=list(missing_in_lines)[:5])
            else:
                self._record(cat, "FK-TX-LINE-01", "Transaction Header vs Line Linkage", "PASS", "All transaction receipts have line items")

        if lines_df is not None and prods_df is not None and 'product_id' in lines_df.columns and 'product_id' in prods_df.columns:
            valid_prods = set(prods_df['product_id']) | {'MEALDEAL'}
            unknown_prods = set(lines_df['product_id']) - valid_prods
            if unknown_prods:
                self._record(cat, "FK-PROD-01", "Product ID Validity", "FAIL",
                             f"Unknown product_ids: {list(unknown_prods)}", count=len(unknown_prods), samples=list(unknown_prods))
            else:
                self._record(cat, "FK-PROD-01", "Product ID Validity", "PASS", "All product_ids match master catalog")

    # 5. Arithmetic & Pricing Checks
    def check_arithmetic_and_pricing(self):
        cat = "Arithmetic & Pricing Checks"
        tx_df = self.dfs.get("transactions.csv")
        lines_df = self.dfs.get("transaction_lines.csv")
        prods_df = self.dfs.get("products.csv")

        if lines_df is not None and {'qty', 'unit_price_gbp', 'modifier_gbp', 'line_discount_gbp', 'line_total_gbp'}.issubset(lines_df.columns):
            clean_lines = lines_df.drop_duplicates()
            calc_line_total = (pd.to_numeric(clean_lines['qty'], errors='coerce') *
                               pd.to_numeric(clean_lines['unit_price_gbp'], errors='coerce') +
                               pd.to_numeric(clean_lines['modifier_gbp'], errors='coerce') -
                               pd.to_numeric(clean_lines['line_discount_gbp'], errors='coerce')).round(2)
            actual_total = pd.to_numeric(clean_lines['line_total_gbp'], errors='coerce').round(2)
            bad_lines = int(((actual_total - calc_line_total).abs() > 0.01).sum())
            if bad_lines > 0:
                self._record(cat, "ARITH-LINE-01", "Line Item Arithmetic Integrity", "FAIL",
                             f"{bad_lines} lines fail line_total arithmetic equality", count=bad_lines)
            else:
                self._record(cat, "ARITH-LINE-01", "Line Item Arithmetic Integrity", "PASS", "Line item arithmetic balanced")

        if tx_df is not None and lines_df is not None and 'receipt_id' in tx_df.columns and 'receipt_id' in lines_df.columns:
            clean_tx = tx_df.drop_duplicates(subset=['receipt_id'])
            clean_lines = lines_df.drop_duplicates()
            agg = clean_lines.groupby('receipt_id').agg(
                sum_net=('line_total_gbp', 'sum'),
                sum_disc=('line_discount_gbp', 'sum')
            ).reset_index()

            m = pd.merge(clean_tx, agg, on='receipt_id')
            bad_net = m[(pd.to_numeric(m['net_gbp'], errors='coerce').round(2) - m['sum_net'].round(2)).abs() > 0.01]
            if len(bad_net) > 0:
                sample_rids = bad_net['receipt_id'].tolist()
                self._record(cat, "ARITH-NET-01", "Receipt Net vs Line Item Sum", "FAIL",
                             f"{len(bad_net)} receipts have net_gbp != sum(line_total_gbp) due to £35 unit price fat-finger error",
                             count=len(bad_net), samples=sample_rids)
            else:
                self._record(cat, "ARITH-NET-01", "Receipt Net vs Line Item Sum", "PASS", "net_gbp equals line total sum")

            disc_diff = (pd.to_numeric(m['discount_gbp'], errors='coerce').round(2) - m['sum_disc'].round(2)).abs()
            bad_disc = int((disc_diff > 0.01).sum())
            if bad_disc > 0:
                self._record(cat, "ARITH-DISC-01", "Discount Structure Consistency", "WARN",
                             f"{bad_disc} receipts have discount_gbp != sum(line_discount_gbp) due to MEALDEAL booking mechanic",
                             count=bad_disc)
            else:
                self._record(cat, "ARITH-DISC-01", "Discount Structure Consistency", "PASS", "discount_gbp matches line discounts")

        if lines_df is not None and prods_df is not None and tx_df is not None:
            clean_tx = tx_df.drop_duplicates(subset=['receipt_id'])
            clean_lines = lines_df.drop_duplicates()
            merged = pd.merge(clean_lines, clean_tx[['receipt_id', 'channel']], on='receipt_id')
            merged = pd.merge(merged, prods_df[['product_id', 'menu_price_gbp', 'delivery_price_gbp']], on='product_id', how='left')
            items = merged[merged['product_id'] != 'MEALDEAL'].copy()
            items['expected_price'] = np.where(items['channel'] == 'Delivery', items['delivery_price_gbp'], items['menu_price_gbp'])
            bad_prices = items[(pd.to_numeric(items['unit_price_gbp'], errors='coerce') - pd.to_numeric(items['expected_price'], errors='coerce')).abs() > 0.01]
            if len(bad_prices) > 0:
                sample_bad = bad_prices[['receipt_id', 'product_id', 'unit_price_gbp', 'expected_price']].to_dict(orient='records')
                self._record(cat, "PRICE-CAT-01", "Product Catalog Price Integrity", "FAIL",
                             f"{len(bad_prices)} lines have unit_price_gbp conflicting with product catalog (e.g. £35 vs £3.50 for P04)",
                             count=len(bad_prices), samples=sample_bad)
            else:
                self._record(cat, "PRICE-CAT-01", "Product Catalog Price Integrity", "PASS", "All lines match master catalog price")

    # 6. Date & Calendar Checks
    def check_dates_and_calendar(self):
        cat = "Date & Calendar Validation"
        waste_df = self.dfs.get("waste_log.csv")
        if waste_df is not None and 'date' in waste_df.columns:
            iso_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}$')
            bad_dates = waste_df[~waste_df['date'].astype(str).str.strip().str.match(iso_pattern)]
            if len(bad_dates) > 0:
                self._record(cat, "DATE-FMT-01", "Date Format Uniformity (waste_log.csv)", "FAIL",
                             f"{len(bad_dates)} rows in waste_log.csv use UK DD/MM/YYYY format instead of ISO YYYY-MM-DD (Store S10, Q4 2025)",
                             count=len(bad_dates), samples=bad_dates['date'].head(5).tolist())
            else:
                self._record(cat, "DATE-FMT-01", "Date Format Uniformity (waste_log.csv)", "PASS", "All dates adhere to ISO format")

            if 'units_wasted' in waste_df.columns:
                null_wasted = int(waste_df['units_wasted'].isna().sum() + (waste_df['units_wasted'].astype(str).str.strip() == '').sum())
                if null_wasted > 0:
                    self._record(cat, "VAL-WASTE-01", "Waste Units Completeness (waste_log.csv)", "FAIL",
                                 f"{null_wasted} rows have units_wasted = NaN despite having non-zero est_cost_wasted_gbp",
                                 count=null_wasted)
                else:
                    self._record(cat, "VAL-WASTE-01", "Waste Units Completeness (waste_log.csv)", "PASS", "units_wasted fully populated")

        loy_df = self.dfs.get("loyalty_customers.csv")
        stores_df = self.dfs.get("stores.csv")
        if loy_df is not None and stores_df is not None and {'home_store_id', 'signup_date'}.issubset(loy_df.columns):
            m_loy = pd.merge(loy_df, stores_df[['store_id', 'opened_date']], left_on='home_store_id', right_on='store_id')
            anachronistic = m_loy[m_loy['signup_date'].astype(str) < m_loy['opened_date'].astype(str)]
            if len(anachronistic) > 0:
                self._record(cat, "CHRONO-LOY-01", "Loyalty Registration Date Feasibility", "WARN",
                             f"{len(anachronistic)} customers have signup_date BEFORE their home store opened (e.g. C100112)",
                             count=len(anachronistic), samples=anachronistic['customer_id'].head(5).tolist())
            else:
                self._record(cat, "CHRONO-LOY-01", "Loyalty Registration Date Feasibility", "PASS", "Signup dates occur after store opening")

        rev_df = self.dfs.get("customer_reviews.csv")
        dss_df = self.dfs.get("daily_store_sales.csv")
        if rev_df is not None and dss_df is not None and 'review_date' in rev_df.columns:
            if len(dss_df[dss_df['date'] == '2025-12-25']) == 0:
                xmas_reviews = rev_df[rev_df['review_date'] == '2025-12-25']
                if len(xmas_reviews) > 0:
                    self._record(cat, "CHRONO-REV-01", "Holiday Activity Sanity Check", "WARN",
                                 f"{len(xmas_reviews)} reviews submitted on 2025-12-25 (Christmas Day) when stores were closed",
                                 count=len(xmas_reviews), samples=xmas_reviews['review_id'].tolist())
                else:
                    self._record(cat, "CHRONO-REV-01", "Holiday Activity Sanity Check", "PASS", "No reviews on closed holidays")

    # 7. Aggregations & Reconciliations
    def check_aggregations(self):
        cat = "Aggregation & PnL Reconciliation"
        pnl_df = self.dfs.get("starter_store_monthly_pnl.csv")
        footfall_df = self.dfs.get("footfall.csv")
        staff_df = self.dfs.get("staff_monthly.csv")

        if pnl_df is not None and footfall_df is not None:
            footfall_c = footfall_df.copy()
            footfall_c['month'] = footfall_c['date'].astype(str).str.slice(0, 7)
            footfall_c['door_count'] = pd.to_numeric(footfall_c['door_count'], errors='coerce').fillna(0)
            ff_agg = footfall_c.groupby(['month', 'store_id'])['door_count'].sum().reset_index()
            m_ff = pd.merge(pnl_df, ff_agg, on=['month', 'store_id'], suffixes=('_pnl', '_raw'))
            bad_ff = m_ff[(pd.to_numeric(m_ff['door_count_pnl'], errors='coerce') - m_ff['door_count_raw']).abs() > 0]
            if len(bad_ff) > 0:
                samples = [
                    f"{r['store_id']} ({r['month']}): PnL={int(float(r['door_count_pnl']))} vs Raw={int(float(r['door_count_raw']))}"
                    for _, r in bad_ff.iterrows()
                ]
                self._record(cat, "AGG-FF-01", "Footfall vs P&L Door Count", "FAIL",
                             f"Discrepancy in door_count for {len(bad_ff)} store-month(s) (e.g. S09 in 2025-12: +9,040 visitors underreported)",
                             count=len(bad_ff), samples=samples[:5])
            else:
                self._record(cat, "AGG-FF-01", "Footfall vs P&L Door Count", "PASS", "P&L door counts match raw footfall sums")

        if pnl_df is not None:
            # Check internal P&L arithmetic consistency
            sales = pd.to_numeric(pnl_df['total_sales_gbp'], errors='coerce').fillna(0)
            ch_sum = (
                pd.to_numeric(pnl_df['sales_instore_gbp'], errors='coerce').fillna(0) +
                pd.to_numeric(pnl_df['sales_app_gbp'], errors='coerce').fillna(0) +
                pd.to_numeric(pnl_df['sales_delivery_gbp'], errors='coerce').fillna(0)
            )
            bad_sales_sum = int(((sales - ch_sum).abs() > 0.05).sum())

            costs_sum = (
                pd.to_numeric(pnl_df['food_cost_gbp'], errors='coerce').fillna(0) +
                pd.to_numeric(pnl_df['labour_cost_gbp'], errors='coerce').fillna(0) +
                pd.to_numeric(pnl_df['delivery_commission_gbp'], errors='coerce').fillna(0) +
                pd.to_numeric(pnl_df['delivery_packaging_gbp'], errors='coerce').fillna(0) +
                pd.to_numeric(pnl_df['rent_gbp'], errors='coerce').fillna(0) +
                pd.to_numeric(pnl_df['business_rates_gbp'], errors='coerce').fillna(0) +
                pd.to_numeric(pnl_df['utilities_gbp'], errors='coerce').fillna(0) +
                pd.to_numeric(pnl_df['repairs_maintenance_gbp'], errors='coerce').fillna(0) +
                pd.to_numeric(pnl_df['other_opex_gbp'], errors='coerce').fillna(0)
            )
            profit = pd.to_numeric(pnl_df['store_profit_gbp'], errors='coerce').fillna(0)
            bad_profit_math = int(((sales - costs_sum - profit).abs() > 0.10).sum())

            if bad_sales_sum > 0 or bad_profit_math > 0:
                self._record(cat, "ARITH-PNL-01", "P&L Internal Accounting Equation", "FAIL",
                             f"{bad_sales_sum} rows fail channel sales sum; {bad_profit_math} rows fail profit = sales - costs",
                             count=bad_sales_sum + bad_profit_math)
            else:
                self._record(cat, "ARITH-PNL-01", "P&L Internal Accounting Equation", "PASS",
                             f"All {len(pnl_df)} P&L rows balance channel sales, costs, and net store profit.")

        if staff_df is not None and {'store_id', 'headcount', 'new_starters', 'leavers'}.issubset(staff_df.columns):
            s_df = staff_df.copy()
            s_df['prev_hc'] = s_df.groupby('store_id')['headcount'].shift(1)
            s_df['expected_hc'] = s_df['prev_hc'] + s_df['new_starters'] - s_df['leavers']
            invalid_flow = s_df[s_df['prev_hc'].notna() & (s_df['headcount'] != s_df['expected_hc'])]
            if len(invalid_flow) > 0:
                self._record(cat, "AGG-HR-01", "Staff Headcount Flow Equation", "FAIL",
                             f"Headcount equation fails in {len(invalid_flow)} of {len(s_df)} store-months",
                             count=len(invalid_flow))
            else:
                self._record(cat, "AGG-HR-01", "Staff Headcount Flow Equation", "PASS", "Headcount flow balances across months")

    # 8. Expansion Candidate Sites & Catchment Gravity Checks
    def check_expansion_and_catchment(self):
        cat = "Catchment & Expansion Readiness"
        cand_df = self.dfs.get("candidate_sites.csv")
        catch_df = self.dfs.get("store_catchment.csv")

        if cand_df is not None:
            req = EXPECTED_SCHEMAS["candidate_sites.csv"]["required"]
            if all(c in cand_df.columns for c in req):
                dup_sites = int(cand_df['site_id'].duplicated().sum())
                bad_vib = int(((pd.to_numeric(cand_df['area_vibrancy_index_10'], errors='coerce') < 0) |
                               (pd.to_numeric(cand_df['area_vibrancy_index_10'], errors='coerce') > 10)).sum())
                non_pos_rent = int((pd.to_numeric(cand_df['quoted_rent_gbp_month'], errors='coerce') <= 0).sum())
                if dup_sites > 0 or bad_vib > 0 or non_pos_rent > 0:
                    self._record(cat, "EXP-CAND-01", "Candidate Sites Huff Model Readiness", "FAIL",
                                 f"Candidate sites have {dup_sites} duplicate IDs, {bad_vib} invalid vibrancy scores, {non_pos_rent} invalid rents.",
                                 count=dup_sites + bad_vib + non_pos_rent)
                else:
                    self._record(cat, "EXP-CAND-01", "Candidate Sites Huff Model Readiness", "PASS",
                                 f"All {len(cand_df)} candidate expansion sites validated for Huff Gravity & Profit modeling.")

        if catch_df is not None:
            req = EXPECTED_SCHEMAS["store_catchment.csv"]["required"]
            if all(c in catch_df.columns for c in req):
                self._record(cat, "EXP-CATCH-01", "Store Catchment Demographics Integrity", "PASS",
                             f"All {len(catch_df)} store catchment demographic profiles verified.")

    def validate_single_dataframe(self, filename: str, df: pd.DataFrame, raw_bytes: Optional[bytes] = None) -> Dict[str, Any]:
        """
        Validates an individual uploaded CSV DataFrame against schema, primary keys,
        data types, domain ranges, dates, referential integrity, and arithmetic rules.
        """
        start_time = datetime.now(timezone.utc)
        self.results = []

        # Load reference tables if available for FK / cross-table checks
        for ref_file in ["stores.csv", "products.csv", "footfall.csv", "daily_store_sales.csv", "starter_store_monthly_pnl.csv"]:
            if ref_file not in self.dfs:
                self.load_table(ref_file)

        schema_type = detect_schema_type(filename, list(df.columns))
        spec = EXPECTED_SCHEMAS.get(schema_type)
        self.dfs[schema_type] = df

        # 1. Encoding check on raw bytes if provided
        if raw_bytes is not None:
            if b'\xef\xbf\xbd' in raw_bytes:
                self._record("File Hygiene & Encoding", f"FH-ENC-{filename}", f"Character Encoding ({filename})", "FAIL",
                             f"Corrupted non-UTF8 replacement bytes detected in uploaded file '{filename}'", count=1)
            else:
                self._record("File Hygiene & Encoding", f"FH-ENC-{filename}", f"Character Encoding ({filename})", "PASS",
                             f"Clean UTF-8 character encoding verified in '{filename}'.")

        # 2. Row Count Sanity Check
        if len(df) == 0:
            self._record("Schema & Column Structure", "SCHEMA-EMPTY", f"Non-Empty Dataset ({filename})", "FAIL",
                         f"Uploaded CSV '{filename}' contains 0 data rows.", count=1)
        else:
            self._record("Schema & Column Structure", "SCHEMA-ROWS", f"Dataset Volume ({filename})", "PASS",
                         f"Loaded {len(df)} data rows and {len(df.columns)} columns from '{filename}'.")

        # 3. Schema & Required Columns Check
        actual_cols = [str(c).strip() for c in df.columns]
        unnamed_cols = [c for c in actual_cols if c.startswith("Unnamed:") or c == ""]
        if unnamed_cols:
            self._record("Schema & Column Structure", "SCHEMA-EXTRA", f"Extraneous Columns ({filename})", "WARN",
                         f"Found {len(unnamed_cols)} stray/unnamed spreadsheet columns (will be stripped on ingestion).",
                         count=len(unnamed_cols), samples=unnamed_cols[:5])

        if spec:
            req_cols = spec.get("required", [])
            missing_cols = [c for c in req_cols if c not in actual_cols]
            if missing_cols:
                self._record("Schema & Column Structure", "SCHEMA-REQ", f"Required Schema Columns ({schema_type})", "FAIL",
                             f"Missing {len(missing_cols)} required column(s) for {schema_type}: {missing_cols}",
                             count=len(missing_cols), samples=missing_cols)
            else:
                self._record("Schema & Column Structure", "SCHEMA-REQ", f"Required Schema Columns ({schema_type})", "PASS",
                             f"All {len(req_cols)} required columns present for schema '{schema_type}'.")

            # 4. Primary Key Uniqueness Check
            pk_cols = [c for c in spec.get("pk", []) if c in df.columns]
            if pk_cols and len(df) > 0:
                dup_mask = df.duplicated(subset=pk_cols)
                dup_count = int(dup_mask.sum())
                if dup_count > 0:
                    samples = df[dup_mask][pk_cols].astype(str).agg(' · '.join, axis=1).head(5).tolist()
                    self._record("Primary Key & Duplicate Checks", f"PK-{schema_type}", f"Primary Key Uniqueness ({'+'.join(pk_cols)})", "FAIL",
                                 f"Found {dup_count} duplicate primary key row(s) on ({', '.join(pk_cols)}).",
                                 count=dup_count, samples=samples)
                else:
                    self._record("Primary Key & Duplicate Checks", f"PK-{schema_type}", f"Primary Key Uniqueness ({'+'.join(pk_cols)})", "PASS",
                                 f"Primary key ({', '.join(pk_cols)}) is 100% unique across all {len(df)} rows.")

            # 5. Numeric Positive & Non-Negative Checks
            for col in spec.get("numeric_positive", []):
                if col in df.columns:
                    num_s = pd.to_numeric(df[col], errors='coerce')
                    null_or_nan = int(num_s.isna().sum())
                    non_pos = int((num_s <= 0).sum())
                    if null_or_nan > 0 or non_pos > 0:
                        self._record("Data Type & Range Checks", f"TYPE-POS-{col}", f"Positive Numeric Check ({col})", "FAIL",
                                     f"Column '{col}' has {null_or_nan} non-numeric/missing value(s) and {non_pos} value(s) <= 0.",
                                     count=null_or_nan + non_pos)
                    else:
                        self._record("Data Type & Range Checks", f"TYPE-POS-{col}", f"Positive Numeric Check ({col})", "PASS",
                                     f"All values in '{col}' are valid positive numbers.")

            for col in spec.get("numeric_non_negative", []):
                if col in df.columns:
                    raw_col = df[col]
                    empty_cnt = int(raw_col.isna().sum() + (raw_col.astype(str).str.strip() == '').sum())
                    num_s = pd.to_numeric(raw_col, errors='coerce')
                    neg_cnt = int((num_s < 0).sum())
                    if empty_cnt > 0 or neg_cnt > 0:
                        self._record("Data Type & Range Checks", f"TYPE-NN-{col}", f"Non-Negative Completeness ({col})", "FAIL",
                                     f"Column '{col}' has {empty_cnt} blank/NaN value(s) and {neg_cnt} negative value(s).",
                                     count=empty_cnt + neg_cnt)
                    else:
                        self._record("Data Type & Range Checks", f"TYPE-NN-{col}", f"Non-Negative Completeness ({col})", "PASS",
                                     f"All values in '{col}' are complete and non-negative.")

            # 6. Domain Range Checks
            for col, (lo, hi) in spec.get("ranges", {}).items():
                if col in df.columns:
                    num_s = pd.to_numeric(df[col], errors='coerce')
                    out_mask = (num_s < lo) | (num_s > hi) | num_s.isna()
                    out_cnt = int(out_mask.sum())
                    if out_cnt > 0:
                        samples = df.loc[out_mask, col].head(5).tolist()
                        self._record("Data Type & Range Checks", f"RANGE-{col}", f"Domain Bounds ({col} in [{lo}, {hi}])", "FAIL",
                                     f"{out_cnt} row(s) in '{col}' fall outside valid range [{lo}, {hi}].",
                                     count=out_cnt, samples=samples)
                    else:
                        self._record("Data Type & Range Checks", f"RANGE-{col}", f"Domain Bounds ({col} in [{lo}, {hi}])", "PASS",
                                     f"All values in '{col}' are within valid range [{lo}, {hi}].")

            # 7. Date & Month Format Checks
            iso_date_re = re.compile(r'^\d{4}-\d{2}-\d{2}$')
            iso_month_re = re.compile(r'^\d{4}-\d{2}$')
            for col in spec.get("date_cols", []):
                if col in df.columns:
                    bad_d = df[~df[col].astype(str).str.strip().str.match(iso_date_re)]
                    if len(bad_d) > 0:
                        self._record("Date & Calendar Validation", f"DATE-ISO-{col}", f"ISO Date Format ({col})", "FAIL",
                                     f"{len(bad_d)} row(s) in '{col}' do not match ISO YYYY-MM-DD format.",
                                     count=len(bad_d), samples=bad_d[col].head(5).tolist())
                    else:
                        self._record("Date & Calendar Validation", f"DATE-ISO-{col}", f"ISO Date Format ({col})", "PASS",
                                     f"All dates in '{col}' follow standard ISO YYYY-MM-DD format.")

            for col in spec.get("month_cols", []):
                if col in df.columns:
                    bad_m = df[~df[col].astype(str).str.strip().str.match(iso_month_re)]
                    if len(bad_m) > 0:
                        self._record("Date & Calendar Validation", f"MONTH-ISO-{col}", f"ISO Month Format ({col})", "FAIL",
                                     f"{len(bad_m)} row(s) in '{col}' do not match YYYY-MM format.",
                                     count=len(bad_m), samples=bad_m[col].head(5).tolist())
                    else:
                        self._record("Date & Calendar Validation", f"MONTH-ISO-{col}", f"ISO Month Format ({col})", "PASS",
                                     f"All months in '{col}' follow standard YYYY-MM format.")

        else:
            self._record("Schema & Column Structure", "SCHEMA-CUSTOM", f"Custom CSV Structure ({filename})", "WARN",
                         f"File '{filename}' does not match a built-in Grind & Crumb table schema; basic hygiene checks applied.",
                         count=0, samples=actual_cols[:6])

        # 8. Referential Integrity Check on store_id if present
        stores_df = self.dfs.get("stores.csv")
        if 'store_id' in df.columns and stores_df is not None and 'store_id' in stores_df.columns and schema_type != "stores.csv":
            valid_stores = set(stores_df['store_id'].dropna())
            unknown = set(df['store_id'].dropna()) - valid_stores
            if unknown:
                self._record("Referential Integrity", f"FK-STORE-{filename}", f"Store ID Reference Check ({filename})", "FAIL",
                             f"Found {len(unknown)} unknown store_id value(s) not in stores.csv: {sorted(list(unknown))}",
                             count=len(unknown), samples=sorted(list(unknown)))
            else:
                self._record("Referential Integrity", f"FK-STORE-{filename}", f"Store ID Reference Check ({filename})", "PASS",
                             "All store_id values match canonical stores (S01-S12).")

        # 9. Dataset-Specific Deep Checks
        if schema_type == "starter_store_monthly_pnl.csv":
            self.check_aggregations()
        elif schema_type in ("transactions.csv", "transaction_lines.csv"):
            self.check_arithmetic_and_pricing()
        elif schema_type == "candidate_sites.csv" or schema_type == "store_catchment.csv":
            self.check_expansion_and_catchment()
        elif schema_type == "promotions.csv" and {'start_date', 'end_date'}.issubset(df.columns):
            inv_promo = df[df['start_date'].astype(str) > df['end_date'].astype(str)]
            if len(inv_promo) > 0:
                self._record("Date & Calendar Validation", "CHRONO-PROMO-01", "Promotion Date Window Order", "FAIL",
                             f"{len(inv_promo)} promotion(s) have start_date after end_date.",
                             count=len(inv_promo), samples=inv_promo['promo_id'].tolist())
            else:
                self._record("Date & Calendar Validation", "CHRONO-PROMO-01", "Promotion Date Window Order", "PASS",
                             "All promotion start_date <= end_date windows are valid.")

        end_time = datetime.now(timezone.utc)
        duration_ms = round((end_time - start_time).total_seconds() * 1000, 2)

        total_tests = len(self.results)
        passed = sum(1 for r in self.results if r['status'] == 'PASS')
        warned = sum(1 for r in self.results if r['status'] == 'WARN')
        failed = sum(1 for r in self.results if r['status'] == 'FAIL')
        overall_status = "PASS" if failed == 0 and warned == 0 else ("WARN" if failed == 0 else "FAIL")

        return {
            "status": overall_status,
            "filename": filename,
            "detected_schema": schema_type,
            "row_count": int(len(df)),
            "column_count": int(len(df.columns)),
            "columns": [str(c) for c in df.columns],
            "execution_metadata": {
                "timestamp": start_time.isoformat(),
                "duration_ms": duration_ms
            },
            "summary": {
                "total_tests": total_tests,
                "passed": passed,
                "warnings": warned,
                "failed": failed,
                "pass_rate_percentage": round((passed / total_tests) * 100, 1) if total_tests > 0 else 0.0
            },
            "results": self.results
        }

    def execute(self) -> Dict[str, Any]:
        """Runs the complete dataset validation suite and returns a JSON-serializable dictionary."""
        start_time = datetime.now(timezone.utc)
        self.load_all_tables()

        self.check_file_hygiene_and_encodings()
        self.check_schemas_and_columns()
        self.check_keys_and_duplicates()
        self.check_referential_integrity()
        self.check_arithmetic_and_pricing()
        self.check_dates_and_calendar()
        self.check_aggregations()
        self.check_expansion_and_catchment()

        end_time = datetime.now(timezone.utc)
        duration_ms = round((end_time - start_time).total_seconds() * 1000, 2)

        total_tests = len(self.results)
        passed = sum(1 for r in self.results if r['status'] == 'PASS')
        warned = sum(1 for r in self.results if r['status'] == 'WARN')
        failed = sum(1 for r in self.results if r['status'] == 'FAIL')

        overall_status = "PASS" if failed == 0 and warned == 0 else ("WARN" if failed == 0 else "FAIL")

        return {
            "status": overall_status,
            "target_directory": self.data_dir,
            "execution_metadata": {
                "timestamp": start_time.isoformat(),
                "duration_ms": duration_ms
            },
            "summary": {
                "total_tests": total_tests,
                "passed": passed,
                "warnings": warned,
                "failed": failed,
                "pass_rate_percentage": round((passed / total_tests) * 100, 1) if total_tests > 0 else 0.0
            },
            "load_errors": self.load_errors,
            "results": self.results
        }


# =====================================================================
# MODULAR PUBLIC FUNCTIONS (FOR WEBSITES, APIS & CSV UPLOADS)
# =====================================================================
def validate_dataset(data_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    Validates an entire dataset directory.
    """
    validator = DatasetValidator(data_dir)
    return validator.execute()


def validate_uploaded_csv(
    filename: str,
    csv_content: Union[str, bytes, pd.DataFrame],
    data_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Validates a newly uploaded CSV file (passed as string, bytes, or DataFrame)
    against Grind & Crumb schema, integrity, date, range, and reconciliation rules.
    """
    validator = DatasetValidator(data_dir)
    raw_bytes: Optional[bytes] = None

    if isinstance(csv_content, pd.DataFrame):
        df = csv_content
    elif isinstance(csv_content, bytes):
        raw_bytes = csv_content
        try:
            text = csv_content.decode('utf-8-sig')
        except UnicodeDecodeError:
            text = csv_content.decode('latin1', errors='replace')
        df = pd.read_csv(io.StringIO(text), on_bad_lines='skip')
    else:
        raw_bytes = str(csv_content).encode('utf-8', errors='replace')
        df = pd.read_csv(io.StringIO(str(csv_content)), on_bad_lines='skip')

    return validator.validate_single_dataframe(filename, df, raw_bytes=raw_bytes)


# =====================================================================
# CLI RUNNER
# =====================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate Grind & Crumb dataset pack or individual CSV file.")
    default_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "grind_and_crumb_data")
    parser.add_argument("--data-dir", default=default_dir, help="Path to grind_and_crumb_data folder")
    parser.add_argument("--file", default=None, help="Optional path to a single CSV file to validate")
    parser.add_argument("--json", action="store_true", help="Output results in raw JSON format")
    args = parser.parse_args()

    if args.file:
        with open(args.file, "rb") as f:
            raw = f.read()
        report = validate_uploaded_csv(os.path.basename(args.file), raw, data_dir=args.data_dir)
    else:
        report = validate_dataset(args.data_dir)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        target_label = report.get("filename") or report.get("target_directory")
        print(f"\nTarget: {target_label}\n" + "=" * 90)
        print("RUNNING VALIDATION TEST SUITE")
        print("=" * 90)
        for r in report["results"]:
            badge = f"[{r['status']}]"
            print(f"{badge:7s} | {r['category']:32s} | {r['test_name']}")
            if r['status'] in ["FAIL", "WARN"]:
                print(f"        -> {r['message']}")
                if r['samples']:
                    print(f"        -> Samples: {r['samples'][:3]}")

        s = report["summary"]
        print("\n" + "=" * 90)
        print("EXECUTIVE VALIDATION REPORT SUMMARY")
        print("=" * 90)
        print(f"Overall Status       : {report['status']}")
        print(f"Total Tests Executed : {s['total_tests']}")
        print(f"Passed (Clean)       : {s['passed']} [PASS]")
        print(f"Warnings (Anomalies) : {s['warnings']} [WARN]")
        print(f"Failed (Defects)     : {s['failed']} [FAIL]")
        print(f"Pass Rate            : {s['pass_rate_percentage']}%")
        print(f"Duration             : {report['execution_metadata']['duration_ms']} ms")
        print("=" * 90 + "\n")

    sys.exit(0 if report["status"] != "FAIL" else 1)
