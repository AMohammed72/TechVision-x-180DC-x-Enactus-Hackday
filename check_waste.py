import os
import csv

DATA_DIR = r"C:\Users\gotta\Downloads\Data verifier\grind_and_crumb_data"

with open(os.path.join(DATA_DIR, "waste_log.csv"), mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    bad_rows = []
    for idx, r in enumerate(reader, start=2):
        d = r.get('date', '').strip()
        w = r.get('units_wasted', '').strip()
        p = r.get('units_prepared', '').strip()
        c = r.get('est_cost_wasted_gbp', '').strip()
        if not d.startswith("202") or not w or not p or not c:
            bad_rows.append((idx, r))

print(f"Total bad/anomalous rows in waste_log.csv: {len(bad_rows)}")
for idx, r in bad_rows[:20]:
    print(f"Row {idx}: {r}")
