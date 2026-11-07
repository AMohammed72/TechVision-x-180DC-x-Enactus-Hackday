import os
import csv

DATA_DIR = r"C:\Users\gotta\Downloads\Data verifier\grind_and_crumb_data"

with open(os.path.join(DATA_DIR, "footfall.csv"), mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    s09_dec = [r for r in reader if r['store_id'] == 'S09' and r['date'].startswith('2025-12')]

tot = sum(int(r['door_count']) for r in s09_dec)
print(f"Total door count for S09 in Dec 2025: {tot}")
print(f"Number of rows: {len(s09_dec)}")
for r in s09_dec[:15]:
    print(r)
