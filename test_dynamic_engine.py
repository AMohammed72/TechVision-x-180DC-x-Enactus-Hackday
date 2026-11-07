import os
import csv
from collections import defaultdict

WORKSPACE_DIR = r"C:\Users\gotta\Downloads\Data verifier"
DATA_DIR = os.path.join(WORKSPACE_DIR, "grind_and_crumb_data")

pnl = list(csv.DictReader(open(os.path.join(WORKSPACE_DIR, "fixed_store_monthly_pnl.csv"), encoding="utf-8-sig")))
events = list(csv.DictReader(open(os.path.join(DATA_DIR, "business_events.csv"), encoding="utf-8-sig")))

print("Events in business_events.csv:")
for ev in events:
    print(f"  - {ev['event']} ({ev['date']}): {ev['description']}")

# Compute event impacts for each store and chain-wide
MONTH_ORDER = [
    '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'
]

def get_store_monthly_metrics(store_id="ALL"):
    res = {}
    for m in MONTH_ORDER:
        rows = [r for r in pnl if r['month'] == m]
        if store_id != "ALL":
            rows = [r for r in rows if r['store_id'] == store_id]
        sales = sum(float(r['total_sales_gbp']) for r in rows)
        profit = sum(float(r['store_profit_gbp']) for r in rows)
        labour = sum(float(r['labour_cost_gbp']) for r in rows)
        app = sum(float(r['sales_app_gbp']) for r in rows)
        res[m] = {'sales': sales, 'profit': profit, 'labour': labour, 'app': app}
    return res

chain_metrics = get_store_monthly_metrics("ALL")
print("\nChain-Wide Monthly Profit Trajectory:")
for m in MONTH_ORDER:
    print(f"  {m}: Sales=£{chain_metrics[m]['sales']:,.2f} | Profit=£{chain_metrics[m]['profit']:,.2f}")

s03_metrics = get_store_monthly_metrics("S03")
print("\nS03 (Leeds Briggate) Monthly Profit Trajectory:")
for m in MONTH_ORDER:
    print(f"  {m}: Sales=£{s03_metrics[m]['sales']:,.2f} | Profit=£{s03_metrics[m]['profit']:,.2f}")
