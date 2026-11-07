import os
import csv
from collections import Counter

DATA_DIR = r"C:\Users\gotta\Downloads\Data verifier\grind_and_crumb_data"

with open(os.path.join(DATA_DIR, "customer_reviews.csv"), mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    counts = Counter(r['store_name_raw'] for r in reader)

print("Distinct store names in customer_reviews.csv:")
for name, cnt in counts.most_common():
    print(f"  '{name}': {cnt}")
