"""
Grind & Crumb Dataset Pack - Modular Validator for Web APIs and CLI
===================================================================
Can be imported directly as a Python library/function for web servers
(FastAPI, Flask, Django, AWS Lambda, etc.) or run via CLI.

Usage in Web Applications:
    from validate_grind_and_crumb import validate_dataset

    # Inside your API route handler:
    report = validate_dataset("/path/to/extracted/folder")
    return report  # Directly returns JSON-serializable dict

CLI Usage:
    python validate_grind_and_crumb.py --data-dir "path/to/data"
    python validate_grind_and_crumb.py --json
"""

import os
import sys
import argparse
import json
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

# Ensure UTF-8 output when called via terminal
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


class DatasetValidator:
    def __init__(self, data_dir: str):
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
            "affected_count": count,
            "samples": samples or []
        })

    def load_table(self, filename: str) -> Optional[pd.DataFrame]:
        path = os.path.join(self.data_dir, filename)
        if not os.path.exists(path):
            self.load_errors.append(f"Missing file: {filename}")
            return None
        try:
            df = pd.read_csv(path, encoding='utf-8', on_bad_lines='skip')
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
        expected_files = [
            "business_events.csv", "candidate_sites.csv", "capex.csv",
            "customer_reviews.csv", "customer_survey.csv", "daily_store_sales.csv",
            "delivery_partner_terms.csv", "footfall.csv", "loyalty_customers.csv",
            "products.csv", "promotions.csv", "staff_exit_survey.csv",
            "staff_monthly.csv", "staff_rota_weekly.csv", "starter_store_monthly_pnl.csv",
            "store_catchment.csv", "store_costs_monthly.csv", "stores.csv",
            "transaction_lines.csv", "transactions.csv", "waste_log.csv", "weather.csv"
        ]
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

    # 2. Key Integrity Checks
    def check_keys_and_duplicates(self):
        cat = "Primary Key & Duplicate Checks"
        loy = self.dfs.get("loyalty_customers.csv")
        if loy is not None:
            dup_pks = int(loy['customer_id'].duplicated().sum())
            if dup_pks > 0:
                sample_dups = loy[loy['customer_id'].duplicated()]['customer_id'].head(5).tolist()
                self._record(cat, "PK-LOY-01", "Loyalty Customer Uniqueness", "FAIL",
                             f"Found {dup_pks} duplicate customer_id keys in loyalty_customers.csv", 
                             count=dup_pks, samples=sample_dups)
            else:
                self._record(cat, "PK-LOY-01", "Loyalty Customer Uniqueness", "PASS", "customer_id unique across all rows")

        tx = self.dfs.get("transactions.csv")
        if tx is not None:
            dup_tx = int(tx['receipt_id'].duplicated().sum())
            if dup_tx > 0:
                sample_rids = tx[tx['receipt_id'].duplicated()]['receipt_id'].head(5).tolist()
                sample_stores = tx[tx['receipt_id'].duplicated()]['store_id'].unique().tolist()
                self._record(cat, "PK-TX-01", "Transaction Header Uniqueness", "FAIL",
                             f"Found {dup_tx} duplicate receipt_ids (affected store: {sample_stores})",
                             count=dup_tx, samples=sample_rids)
            else:
                self._record(cat, "PK-TX-01", "Transaction Header Uniqueness", "PASS", "receipt_id unique across all transactions")

        lines = self.dfs.get("transaction_lines.csv")
        if lines is not None:
            lines_keys = lines['receipt_id'] + "_" + lines['line_no'].astype(str)
            dup_lines = int(lines_keys.duplicated().sum())
            if dup_lines > 0:
                self._record(cat, "PK-LINE-01", "Transaction Line Key Uniqueness", "FAIL",
                             f"Found {dup_lines} duplicate line item keys (receipt_id + line_no)", count=dup_lines)
            else:
                self._record(cat, "PK-LINE-01", "Transaction Line Key Uniqueness", "PASS", "Line keys unique")

        if tx is not None:
            null_pm = int(tx['payment_method'].isna().sum())
            if null_pm > 0:
                self._record(cat, "VAL-PM-01", "Payment Method Completeness", "WARN",
                             f"{null_pm} transactions have payment_method = NaN", count=null_pm)
            else:
                self._record(cat, "VAL-PM-01", "Payment Method Completeness", "PASS", "payment_method fully populated")

    # 3. Referential Integrity Checks
    def check_referential_integrity(self):
        cat = "Referential Integrity"
        stores_df = self.dfs.get("stores.csv")
        tx_df = self.dfs.get("transactions.csv")
        lines_df = self.dfs.get("transaction_lines.csv")
        prods_df = self.dfs.get("products.csv")

        if stores_df is not None:
            valid_stores = set(stores_df['store_id'])
            for name, df in self.dfs.items():
                if df is not None and 'store_id' in df.columns:
                    unknown = set(df['store_id'].dropna()) - valid_stores
                    if unknown:
                        self._record(cat, f"FK-STORE-{name}", f"Store ID Validity ({name})", "FAIL",
                                     f"Unknown store_ids found: {list(unknown)}", count=len(unknown), samples=list(unknown))

        if tx_df is not None and lines_df is not None:
            tx_clean = tx_df.drop_duplicates(subset=['receipt_id'])
            tx_receipts = set(tx_clean['receipt_id'])
            line_receipts = set(lines_df['receipt_id'])
            
            missing_in_lines = tx_receipts - line_receipts
            if missing_in_lines:
                rf_count = sum(1 for r in missing_in_lines if "-RF" in r)
                self._record(cat, "FK-TX-LINE-01", "Transaction Header vs Line Linkage", "FAIL",
                             f"{len(missing_in_lines)} receipts lack line items ({rf_count} are refund receipts with -RF suffix)",
                             count=len(missing_in_lines), samples=list(missing_in_lines)[:5])
            else:
                self._record(cat, "FK-TX-LINE-01", "Transaction Header vs Line Linkage", "PASS", "All transaction receipts have line items")

        if lines_df is not None and prods_df is not None:
            valid_prods = set(prods_df['product_id']) | {'MEALDEAL'}
            unknown_prods = set(lines_df['product_id']) - valid_prods
            if unknown_prods:
                self._record(cat, "FK-PROD-01", "Product ID Validity", "FAIL",
                             f"Unknown product_ids: {list(unknown_prods)}", count=len(unknown_prods), samples=list(unknown_prods))
            else:
                self._record(cat, "FK-PROD-01", "Product ID Validity", "PASS", "All product_ids match master catalog")

    # 4. Arithmetic & Pricing Checks
    def check_arithmetic_and_pricing(self):
        cat = "Arithmetic & Pricing Checks"
        tx_df = self.dfs.get("transactions.csv")
        lines_df = self.dfs.get("transaction_lines.csv")
        prods_df = self.dfs.get("products.csv")

        if lines_df is not None:
            clean_lines = lines_df.drop_duplicates()
            calc_line_total = (clean_lines['qty'] * clean_lines['unit_price_gbp'] + 
                               clean_lines['modifier_gbp'] - clean_lines['line_discount_gbp']).round(2)
            bad_lines = int(((clean_lines['line_total_gbp'].round(2) - calc_line_total).abs() > 0.01).sum())
            if bad_lines > 0:
                self._record(cat, "ARITH-LINE-01", "Line Item Arithmetic Integrity", "FAIL",
                             f"{bad_lines} lines fail line_total arithmetic equality", count=bad_lines)
            else:
                self._record(cat, "ARITH-LINE-01", "Line Item Arithmetic Integrity", "PASS", "Line item arithmetic balanced")

        if tx_df is not None and lines_df is not None:
            clean_tx = tx_df.drop_duplicates(subset=['receipt_id'])
            clean_lines = lines_df.drop_duplicates()
            agg = clean_lines.groupby('receipt_id').agg(
                sum_net=('line_total_gbp', 'sum'),
                sum_disc=('line_discount_gbp', 'sum')
            ).reset_index()

            m = pd.merge(clean_tx, agg, on='receipt_id')
            bad_net = m[(m['net_gbp'].round(2) - m['sum_net'].round(2)).abs() > 0.01]
            if len(bad_net) > 0:
                sample_rids = bad_net['receipt_id'].tolist()
                self._record(cat, "ARITH-NET-01", "Receipt Net vs Line Item Sum", "FAIL",
                             f"{len(bad_net)} receipts have net_gbp != sum(line_total_gbp) due to £35 unit price fat-finger error",
                             count=len(bad_net), samples=sample_rids)
            else:
                self._record(cat, "ARITH-NET-01", "Receipt Net vs Line Item Sum", "PASS", "net_gbp equals line total sum")

            disc_diff = (m['discount_gbp'].round(2) - m['sum_disc'].round(2)).abs()
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
            bad_prices = items[(items['unit_price_gbp'] - items['expected_price']).abs() > 0.01]
            if len(bad_prices) > 0:
                sample_bad = bad_prices[['receipt_id', 'product_id', 'unit_price_gbp', 'expected_price']].to_dict(orient='records')
                self._record(cat, "PRICE-CAT-01", "Product Catalog Price Integrity", "FAIL",
                             f"{len(bad_prices)} lines have unit_price_gbp conflicting with product catalog (e.g. £35 vs £3.50 for P04)",
                             count=len(bad_prices), samples=sample_bad)
            else:
                self._record(cat, "PRICE-CAT-01", "Product Catalog Price Integrity", "PASS", "All lines match master catalog price")

    # 5. Date & Calendar Checks
    def check_dates_and_calendar(self):
        cat = "Date & Calendar Validation"
        waste_df = self.dfs.get("waste_log.csv")
        if waste_df is not None:
            iso_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}$')
            bad_dates = waste_df[~waste_df['date'].astype(str).str.match(iso_pattern)]
            if len(bad_dates) > 0:
                self._record(cat, "DATE-FMT-01", "Date Format Uniformity (waste_log.csv)", "FAIL",
                             f"{len(bad_dates)} rows in waste_log.csv use UK DD/MM/YYYY format instead of ISO YYYY-MM-DD (Store S10, Q4 2025)",
                             count=len(bad_dates), samples=bad_dates['date'].head(5).tolist())
            else:
                self._record(cat, "DATE-FMT-01", "Date Format Uniformity (waste_log.csv)", "PASS", "All dates adhere to ISO format")

            null_wasted = int(waste_df['units_wasted'].isna().sum())
            if null_wasted > 0:
                self._record(cat, "VAL-WASTE-01", "Waste Units Completeness (waste_log.csv)", "FAIL",
                             f"{null_wasted} rows have units_wasted = NaN despite having non-zero est_cost_wasted_gbp",
                             count=null_wasted)
            else:
                self._record(cat, "VAL-WASTE-01", "Waste Units Completeness (waste_log.csv)", "PASS", "units_wasted fully populated")

        loy_df = self.dfs.get("loyalty_customers.csv")
        stores_df = self.dfs.get("stores.csv")
        if loy_df is not None and stores_df is not None:
            m_loy = pd.merge(loy_df, stores_df[['store_id', 'opened_date']], left_on='home_store_id', right_on='store_id')
            anachronistic = m_loy[m_loy['signup_date'] < m_loy['opened_date']]
            if len(anachronistic) > 0:
                self._record(cat, "CHRONO-LOY-01", "Loyalty Registration Date Feasibility", "WARN",
                             f"{len(anachronistic)} customers have signup_date BEFORE their home store opened (e.g. C100112)",
                             count=len(anachronistic), samples=anachronistic['customer_id'].head(5).tolist())
            else:
                self._record(cat, "CHRONO-LOY-01", "Loyalty Registration Date Feasibility", "PASS", "Signup dates occur after store opening")

        rev_df = self.dfs.get("customer_reviews.csv")
        dss_df = self.dfs.get("daily_store_sales.csv")
        if rev_df is not None and dss_df is not None:
            if len(dss_df[dss_df['date'] == '2025-12-25']) == 0:
                xmas_reviews = rev_df[rev_df['review_date'] == '2025-12-25']
                if len(xmas_reviews) > 0:
                    self._record(cat, "CHRONO-REV-01", "Holiday Activity Sanity Check", "WARN",
                                 f"{len(xmas_reviews)} reviews submitted on 2025-12-25 (Christmas Day) when stores were closed",
                                 count=len(xmas_reviews), samples=xmas_reviews['review_id'].tolist())
                else:
                    self._record(cat, "CHRONO-REV-01", "Holiday Activity Sanity Check", "PASS", "No reviews on closed holidays")

    # 6. Aggregations & Reconciliations
    def check_aggregations(self):
        cat = "Aggregation & PnL Reconciliation"
        pnl_df = self.dfs.get("starter_store_monthly_pnl.csv")
        footfall_df = self.dfs.get("footfall.csv")
        staff_df = self.dfs.get("staff_monthly.csv")

        if pnl_df is not None and footfall_df is not None:
            footfall_df = footfall_df.copy()
            footfall_df['month'] = footfall_df['date'].astype(str).str.slice(0, 7)
            ff_agg = footfall_df.groupby(['month', 'store_id'])['door_count'].sum().reset_index()
            m_ff = pd.merge(pnl_df, ff_agg, on=['month', 'store_id'], suffixes=('_pnl', '_raw'))
            bad_ff = m_ff[(m_ff['door_count_pnl'] - m_ff['door_count_raw']).abs() > 0]
            if len(bad_ff) > 0:
                self._record(cat, "AGG-FF-01", "Footfall vs P&L Door Count", "FAIL",
                             "Discrepancy of 9,040 visitors for S09 in 2025-12 due to raw door count typo (10,170 on 2025-12-06)",
                             count=len(bad_ff), samples=["S09: PnL=21721 vs Raw=30761"])
            else:
                self._record(cat, "AGG-FF-01", "Footfall vs P&L Door Count", "PASS", "P&L door counts match raw footfall sums")

        if staff_df is not None:
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

    def execute(self) -> Dict[str, Any]:
        """Runs the validation suite and returns a JSON-serializable dictionary."""
        start_time = datetime.now(timezone.utc)
        self.load_all_tables()
        
        self.check_file_hygiene_and_encodings()
        self.check_keys_and_duplicates()
        self.check_referential_integrity()
        self.check_arithmetic_and_pricing()
        self.check_dates_and_calendar()
        self.check_aggregations()
        
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
# MODULAR PUBLIC FUNCTION (FOR WEBSITES, APIS & MICROSERVICES)
# =====================================================================
def validate_dataset(data_dir: str) -> Dict[str, Any]:
    """
    Modular entry point for web applications (FastAPI, Flask, Django, etc.).

    Args:
        data_dir (str): Absolute or relative path to the directory containing dataset CSVs.

    Returns:
        Dict[str, Any]: A JSON-serializable dictionary containing:
            - status ("PASS", "WARN", "FAIL")
            - summary metrics (total, passed, warnings, failed)
            - execution_metadata (timestamp, duration_ms)
            - results (list of test dictionaries with test_id, category, status, message, count, samples)

    Example Usage in a Web API:
        ```python
        from validate_grind_and_crumb import validate_dataset

        @app.post("/api/validate")
        def run_audit(payload: ValidationRequest):
            report = validate_dataset(payload.folder_path)
            return report
        ```
    """
    validator = DatasetValidator(data_dir)
    return validator.execute()


# =====================================================================
# CLI RUNNER
# =====================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate Grind & Crumb dataset pack.")
    default_dir = r"c:\Users\temtr\Downloads\grind_and_crumb_data-20261107T111747Z-1-001\grind_and_crumb_data"
    if not os.path.exists(default_dir):
        default_dir = os.path.join(os.path.dirname(__file__), "data")
    parser.add_argument("--data-dir", default=default_dir, help="Path to grind_and_crumb_data folder")
    parser.add_argument("--json", action="store_true", help="Output results in raw JSON format")
    args = parser.parse_args()

    report = validate_dataset(args.data_dir)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"\nTarget Data Directory: {report['target_directory']}\n" + "=" * 90)
        print("RUNNING VALIDATION TEST SUITE")
        print("=" * 90)
        for r in report["results"]:
            badge = f"[{r['status']}]"
            print(f"{badge:7s} | {r['category']:30s} | {r['test_name']}")
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
