import os
import csv
from collections import defaultdict
from datetime import datetime, date

DATA_DIR = r"C:\Users\gotta\Downloads\Data verifier\grind_and_crumb_data"

def load_csv(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        return list(reader)

def safe_float(val, default=0.0):
    try:
        val_str = str(val).strip()
        if not val_str:
            return default
        return float(val_str)
    except:
        return default

def safe_int(val, default=0):
    try:
        val_str = str(val).strip()
        if not val_str:
            return default
        return int(float(val_str))
    except:
        return default

def run_deep_audit():
    print("Loading data...")
    pnl = load_csv("starter_store_monthly_pnl.csv")
    stores = {r['store_id']: r for r in load_csv("stores.csv")}
    costs = load_csv("store_costs_monthly.csv")
    staff_monthly = load_csv("staff_monthly.csv")
    daily_sales = load_csv("daily_store_sales.csv")
    footfall = load_csv("footfall.csv")
    waste_log = load_csv("waste_log.csv")
    rota = load_csv("staff_rota_weekly.csv")
    products = {r['product_id']: r for r in load_csv("products.csv")}
    terms = load_csv("delivery_partner_terms.csv")
    
    discrepancies = []

    # 1. Store metadata
    print("\n--- 1. Store Metadata ---")
    for row in pnl:
        sid = row['store_id']
        m = row['month']
        if sid in stores:
            st = stores[sid]
            for field in ['store_name', 'city', 'format', 'location_type']:
                if row[field] != st[field]:
                    discrepancies.append({
                        'category': 'Store Metadata',
                        'month': m,
                        'store_id': sid,
                        'field': field,
                        'pnl_value': row[field],
                        'expected_value': st[field],
                        'description': f"Mismatch in {field}"
                    })

    # 2. Daily Sales
    print("\n--- 2. Daily Sales Aggregations ---")
    sales_agg = defaultdict(lambda: {
        'days': set(),
        'net_sales_instore': 0.0,
        'net_sales_app': 0.0,
        'net_sales_delivery': 0.0,
        'receipts_instore': 0,
        'receipts_app': 0,
        'receipts_delivery': 0
    })
    for r in daily_sales:
        d = r['date']
        m = d[:7]
        sid = r['store_id']
        agg = sales_agg[(m, sid)]
        agg['days'].add(d)
        agg['net_sales_instore'] += safe_float(r['net_sales_instore_gbp'])
        agg['net_sales_app'] += safe_float(r['net_sales_app_gbp'])
        agg['net_sales_delivery'] += safe_float(r['net_sales_delivery_gbp'])
        agg['receipts_instore'] += safe_int(r['receipts_instore'])
        agg['receipts_app'] += safe_int(r['receipts_app'])
        agg['receipts_delivery'] += safe_int(r['receipts_delivery'])

    for row in pnl:
        key = (row['month'], row['store_id'])
        m, sid = key
        if key in sales_agg:
            agg = sales_agg[key]
            # trading days
            actual_days = len(agg['days'])
            pnl_days = safe_int(row['trading_days'])
            if actual_days != pnl_days:
                discrepancies.append({
                    'category': 'Trading Days',
                    'month': m,
                    'store_id': sid,
                    'field': 'trading_days',
                    'pnl_value': pnl_days,
                    'expected_value': actual_days,
                    'description': f"Trading days count mismatch"
                })
            
            # channel sales
            for f_pnl, f_agg in [('sales_instore_gbp', 'net_sales_instore'), 
                                 ('sales_app_gbp', 'net_sales_app'), 
                                 ('sales_delivery_gbp', 'net_sales_delivery')]:
                pnl_val = safe_float(row[f_pnl])
                agg_val = round(agg[f_agg], 2)
                if abs(pnl_val - agg_val) > 0.05:
                    discrepancies.append({
                        'category': 'Sales',
                        'month': m,
                        'store_id': sid,
                        'field': f_pnl,
                        'pnl_value': pnl_val,
                        'expected_value': agg_val,
                        'description': f"Channel sales mismatch"
                    })
            
            # total sales
            pnl_tot = safe_float(row['total_sales_gbp'])
            agg_tot = round(agg['net_sales_instore'] + agg['net_sales_app'] + agg['net_sales_delivery'], 2)
            if abs(pnl_tot - agg_tot) > 0.05:
                discrepancies.append({
                    'category': 'Sales',
                    'month': m,
                    'store_id': sid,
                    'field': 'total_sales_gbp',
                    'pnl_value': pnl_tot,
                    'expected_value': agg_tot,
                    'description': f"Total sales sum mismatch"
                })

            # receipts
            for r_pnl, r_agg in [('receipts_instore', 'receipts_instore'),
                                 ('receipts_app', 'receipts_app'),
                                 ('receipts_delivery', 'receipts_delivery')]:
                p_r = safe_int(row[r_pnl])
                a_r = agg[r_agg]
                if p_r != a_r:
                    discrepancies.append({
                        'category': 'Receipts',
                        'month': m,
                        'store_id': sid,
                        'field': r_pnl,
                        'pnl_value': p_r,
                        'expected_value': a_r,
                        'description': f"Channel receipts mismatch"
                    })
            
            pnl_r_tot = safe_int(row['total_receipts'])
            agg_r_tot = agg['receipts_instore'] + agg['receipts_app'] + agg['receipts_delivery']
            if pnl_r_tot != agg_r_tot:
                discrepancies.append({
                    'category': 'Receipts',
                    'month': m,
                    'store_id': sid,
                    'field': 'total_receipts',
                    'pnl_value': pnl_r_tot,
                    'expected_value': agg_r_tot,
                    'description': f"Total receipts sum mismatch"
                })

            # avg ticket
            if agg_r_tot > 0:
                exp_ticket = round(agg_tot / agg_r_tot, 2)
                pnl_ticket = safe_float(row['avg_ticket_gbp'])
                if abs(pnl_ticket - exp_ticket) > 0.02:
                    discrepancies.append({
                        'category': 'Avg Ticket',
                        'month': m,
                        'store_id': sid,
                        'field': 'avg_ticket_gbp',
                        'pnl_value': pnl_ticket,
                        'expected_value': exp_ticket,
                        'description': f"Avg ticket calculation discrepancy"
                    })

    # 3. Footfall
    print("\n--- 3. Footfall ---")
    footfall_agg = defaultdict(int)
    for r in footfall:
        m = r['date'][:7]
        sid = r['store_id']
        footfall_agg[(m, sid)] += safe_int(r['door_count'])
    
    for row in pnl:
        key = (row['month'], row['store_id'])
        m, sid = key
        if key in footfall_agg:
            actual = footfall_agg[key]
            pnl_val = safe_int(row['door_count'])
            if actual != pnl_val:
                discrepancies.append({
                    'category': 'Footfall',
                    'month': m,
                    'store_id': sid,
                    'field': 'door_count',
                    'pnl_value': pnl_val,
                    'expected_value': actual,
                    'description': f"Door count mismatch with footfall log (diff: {actual - pnl_val})"
                })

    # 4. Waste Log
    print("\n--- 4. Waste Log ---")
    waste_agg = defaultdict(lambda: {'prep': 0.0, 'waste': 0.0, 'cost': 0.0, 'missing_waste': 0})
    for r in waste_log:
        m = r['date'][:7]
        sid = r['store_id']
        w = waste_agg[(m, sid)]
        u_prep = safe_float(r['units_prepared'])
        w['prep'] += u_prep
        
        raw_waste = str(r.get('units_wasted', '')).strip()
        if not raw_waste:
            w['missing_waste'] += 1
        else:
            w['waste'] += safe_float(raw_waste)
            
        w['cost'] += safe_float(r.get('est_cost_wasted_gbp', 0))

    waste_issues = 0
    for key, w in waste_agg.items():
        if w['missing_waste'] > 0:
            waste_issues += 1
            discrepancies.append({
                'category': 'Waste Data Quality',
                'month': key[0],
                'store_id': key[1],
                'field': 'units_wasted',
                'pnl_value': f"{w['missing_waste']} missing rows",
                'expected_value': "Complete numeric values",
                'description': f"Found {w['missing_waste']} rows with blank/missing units_wasted in waste_log.csv"
            })

    for row in pnl:
        key = (row['month'], row['store_id'])
        m, sid = key
        if key in waste_agg:
            w = waste_agg[key]
            exp_cost = round(w['cost'], 2)
            pnl_cost = safe_float(row['waste_cost_gbp'])
            if abs(pnl_cost - exp_cost) > 1.0: # allow minor rounding
                discrepancies.append({
                    'category': 'Waste Cost',
                    'month': m,
                    'store_id': sid,
                    'field': 'waste_cost_gbp',
                    'pnl_value': pnl_cost,
                    'expected_value': exp_cost,
                    'description': f"Waste cost mismatch with waste log"
                })
            
            exp_rate = round(w['waste'] / w['prep'], 3) if w['prep'] > 0 else 0.0
            pnl_rate = safe_float(row['waste_rate'])
            if abs(pnl_rate - exp_rate) > 0.01:
                discrepancies.append({
                    'category': 'Waste Rate',
                    'month': m,
                    'store_id': sid,
                    'field': 'waste_rate',
                    'pnl_value': pnl_rate,
                    'expected_value': exp_rate,
                    'description': f"Waste rate mismatch (expected {exp_rate:.3f} vs PnL {pnl_rate:.3f})"
                })

    # 5. Staff Rota & Labour
    print("\n--- 5. Staff Rota & Labour ---")
    # Date in rota: DD/MM/YYYY
    # Prorated by day into months
    labour_month = defaultdict(lambda: {'hours': 0.0, 'cost': 0.0, 'wage': 0.0, 'wage_count': 0})
    for r in rota:
        ws_str = r['week_start'].strip()
        try:
            ws_date = datetime.strptime(ws_str, "%d/%m/%Y").date()
        except Exception:
            continue
        sid = r['store_id']
        hrs = safe_float(r['scheduled_hours'])
        wage = safe_float(r['avg_hourly_wage_gbp'])
        daily_hrs = hrs / 7.0
        daily_cost = daily_hrs * wage * 1.13
        
        for day_offset in range(7):
            cur_date = date.fromordinal(ws_date.toordinal() + day_offset)
            m_str = cur_date.strftime("%Y-%m")
            # Only consider 2025-07 to 2026-06
            if "2025-07" <= m_str <= "2026-06":
                lm = labour_month[(m_str, sid)]
                lm['hours'] += daily_hrs
                lm['cost'] += daily_cost
                lm['wage'] += wage
                lm['wage_count'] += 1

    for row in pnl:
        key = (row['month'], row['store_id'])
        m, sid = key
        if key in labour_month:
            lm = labour_month[key]
            exp_hrs = round(lm['hours'], 2)
            pnl_hrs = safe_float(row['labour_hours'])
            if abs(pnl_hrs - exp_hrs) > 0.1:
                discrepancies.append({
                    'category': 'Labour Hours',
                    'month': m,
                    'store_id': sid,
                    'field': 'labour_hours',
                    'pnl_value': pnl_hrs,
                    'expected_value': exp_hrs,
                    'description': f"Labour hours mismatch (diff: {round(exp_hrs - pnl_hrs, 2)} hrs)"
                })
                
            exp_cost = round(lm['cost'], 2)
            pnl_cost = safe_float(row['labour_cost_gbp'])
            if abs(pnl_cost - exp_cost) > 1.0:
                discrepancies.append({
                    'category': 'Labour Cost',
                    'month': m,
                    'store_id': sid,
                    'field': 'labour_cost_gbp',
                    'pnl_value': pnl_cost,
                    'expected_value': exp_cost,
                    'description': f"Labour cost mismatch (diff: £{round(exp_cost - pnl_cost, 2)})"
                })

    # 6. Delivery Packaging and Commission
    print("\n--- 6. Delivery Costs ---")
    for row in pnl:
        m = row['month']
        sid = row['store_id']
        del_receipts = safe_int(row['receipts_delivery'])
        exp_pkg = round(del_receipts * 0.45, 2)
        pnl_pkg = safe_float(row['delivery_packaging_gbp'])
        if abs(pnl_pkg - exp_pkg) > 0.05:
            discrepancies.append({
                'category': 'Delivery Packaging',
                'month': m,
                'store_id': sid,
                'field': 'delivery_packaging_gbp',
                'pnl_value': pnl_pkg,
                'expected_value': exp_pkg,
                'description': f"Packaging cost mismatch: {del_receipts} orders × £0.45 = £{exp_pkg}"
            })

    # 7. Internal Mathematical Consistency in PnL
    print("\n--- 7. Internal PnL Formula Consistency ---")
    for row in pnl:
        m = row['month']
        sid = row['store_id']
        sales = safe_float(row['total_sales_gbp'])
        costs_sum = (
            safe_float(row['food_cost_gbp']) +
            safe_float(row['labour_cost_gbp']) +
            safe_float(row['delivery_commission_gbp']) +
            safe_float(row['delivery_packaging_gbp']) +
            safe_float(row['rent_gbp']) +
            safe_float(row['business_rates_gbp']) +
            safe_float(row['utilities_gbp']) +
            safe_float(row['repairs_maintenance_gbp']) +
            safe_float(row['other_opex_gbp'])
        )
        exp_profit = round(sales - costs_sum, 2)
        pnl_profit = safe_float(row['store_profit_gbp'])
        if abs(exp_profit - pnl_profit) > 0.1:
            discrepancies.append({
                'category': 'Math / Formula',
                'month': m,
                'store_id': sid,
                'field': 'store_profit_gbp',
                'pnl_value': pnl_profit,
                'expected_value': exp_profit,
                'description': f"Profit math mismatch: Sales £{sales:.2f} - Costs £{costs_sum:.2f} = £{exp_profit:.2f} (diff: £{round(exp_profit - pnl_profit, 2)})"
            })
            
        if sales > 0:
            exp_margin = round(pnl_profit / sales, 3)
            pnl_margin = safe_float(row['store_margin'])
            if abs(exp_margin - pnl_margin) > 0.005:
                discrepancies.append({
                    'category': 'Math / Formula',
                    'month': m,
                    'store_id': sid,
                    'field': 'store_margin',
                    'pnl_value': pnl_margin,
                    'expected_value': exp_margin,
                    'description': f"Margin math mismatch: Profit/Sales = {exp_margin:.3f} vs PnL {pnl_margin:.3f}"
                })

    print(f"\nAUDIT COMPLETE. Total discrepancies found: {len(discrepancies)}")
    
    # Save discrepancies to CSV and JSON
    import json
    out_csv = os.path.join(r"C:\Users\gotta\Downloads\Data verifier", "discrepancies_report.csv")
    out_json = os.path.join(r"C:\Users\gotta\Downloads\Data verifier", "discrepancies_report.json")
    
    with open(out_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['category', 'month', 'store_id', 'field', 'pnl_value', 'expected_value', 'description'])
        writer.writeheader()
        writer.writerows(discrepancies)
        
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(discrepancies, f, indent=2)
        
    print(f"Saved reports to '{out_csv}' and '{out_json}'")
    
    # Print summary by category
    summary = defaultdict(int)
    for d in discrepancies:
        summary[d['category']] += 1
    for cat, count in summary.items():
        print(f"  - {cat}: {count} issues")

if __name__ == '__main__':
    run_deep_audit()
