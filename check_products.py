import os
import csv

DATA_DIR = r"C:\Users\gotta\Downloads\Data verifier\grind_and_crumb_data"

with open(os.path.join(DATA_DIR, "products.csv"), mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    print("Products:")
    for r in reader:
        print(f"  {r['product_id']}: {r['product_name']} ({r['category']}) menu=£{r['menu_price_gbp']} cost=£{r['unit_cost_gbp']} delivery=£{r['delivery_price_gbp']}")

with open(os.path.join(DATA_DIR, "loyalty_customers.csv"), mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    custs = list(reader)
    print(f"\nLoyalty customers: {len(custs)} rows")
    bad_custs = [r for r in custs if not r['customer_id'] or not r['signup_date']]
    print(f"Bad customer rows: {len(bad_custs)}")
