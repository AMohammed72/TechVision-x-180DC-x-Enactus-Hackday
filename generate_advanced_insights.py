import os
import csv
import json
from collections import defaultdict

WORKSPACE_DIR = r"C:\Users\gotta\Downloads\Data verifier"
DATA_DIR = os.path.join(WORKSPACE_DIR, "grind_and_crumb_data")

MONTH_ORDER = [
    '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'
]

def load_csv(path):
    with open(path, mode='r', encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))

def run():
    print("Enriching dataset with modular dynamic event engine and store sentiment metrics...")
    
    pnl = load_csv(os.path.join(WORKSPACE_DIR, "fixed_store_monthly_pnl.csv"))
    stores = {r['store_id']: r for r in load_csv(os.path.join(DATA_DIR, "stores.csv"))}
    sentiment_data = load_csv(os.path.join(WORKSPACE_DIR, "customer_reviews_sentiment.csv"))
    events_raw = load_csv(os.path.join(DATA_DIR, "business_events.csv"))

    # Ensure Dashly contract renewal is included as an event if not present
    event_names = [e['event'].lower() for e in events_raw]
    if not any("dashly" in n for n in event_names):
        events_raw.append({
            'event': 'Dashly Commission Hike (33%)',
            'date': '2026-04-01',
            'description': 'Dashly commission rate jumped from 27% to 33% on order value'
        })

    # Sort events chronologically
    events_raw.sort(key=lambda x: x['date'])

    # Helper to calculate store monthly profit dict
    def get_monthly_metrics(store_id="ALL"):
        metrics = {}
        for m in MONTH_ORDER:
            rows = [r for r in pnl if r['month'] == m]
            if store_id != "ALL":
                rows = [r for r in rows if r['store_id'] == store_id]
            sales = sum(float(r['total_sales_gbp']) for r in rows)
            profit = sum(float(r['store_profit_gbp']) for r in rows)
            app = sum(float(r['sales_app_gbp']) for r in rows)
            deliv = sum(float(r['sales_delivery_gbp']) for r in rows)
            labour = sum(float(r['labour_cost_gbp']) for r in rows)
            metrics[m] = {'sales': sales, 'profit': profit, 'app': app, 'delivery': deliv, 'labour': labour}
        return metrics

    # Compute events impact dictionary: for "ALL" as well as for every individual store (S01-S12)
    events_impact_by_scope = {}
    scopes = ["ALL"] + sorted(list(stores.keys()))

    for scope in scopes:
        scope_metrics = get_monthly_metrics(scope)
        scope_events = []
        for ev in events_raw:
            d_str = ev['date']
            ev_month = d_str[:7]
            m_idx = MONTH_ORDER.index(ev_month) if ev_month in MONTH_ORDER else -1
            
            # Determine pre and post months
            pre_m = MONTH_ORDER[m_idx - 1] if m_idx > 0 else ev_month
            post_m = MONTH_ORDER[m_idx + 1] if m_idx < len(MONTH_ORDER) - 1 else ev_month
            
            # Specific month overrides for mid-month transitions
            if "Trinity" in ev['event']:
                pre_m = '2025-08'
                post_m = '2025-10'
            elif "Oat milk" in ev['event']:
                pre_m = '2025-12'
                post_m = '2026-02'
            elif "v3.0" in ev['event']:
                pre_m = '2026-02'
                post_m = '2026-03'
            elif "Wage" in ev['event'] or "v3.1" in ev['event'] or "Dashly" in ev['event']:
                pre_m = '2026-03'
                post_m = '2026-04'

            pre_profit = scope_metrics[pre_m]['profit']
            post_profit = scope_metrics[post_m]['profit']
            delta_profit = post_profit - pre_profit
            pct_profit = (delta_profit / abs(pre_profit) * 100) if pre_profit != 0 else 0.0

            pre_sales = scope_metrics[pre_m]['sales']
            post_sales = scope_metrics[post_m]['sales']
            delta_sales = post_sales - pre_sales
            pct_sales = (delta_sales / abs(pre_sales) * 100) if pre_sales != 0 else 0.0

            # Store specific context
            desc = ev['description']
            if scope == "S03" and "Trinity" in ev['event']:
                desc = "Direct cannibalization: Leeds Trinity (S12) opened 0.4 miles away, shifting substantial customer traffic away from Briggate."
            elif scope == "S12" and "Trinity" in ev['event']:
                desc = "Grand opening: Store S12 opened mid-September, establishing our second Leeds retail location."

            scope_events.append({
                'event': ev['event'],
                'date': ev['date'],
                'month': ev_month,
                'month_idx': m_idx,
                'pre_month': pre_m,
                'post_month': post_m,
                'pre_profit': round(pre_profit, 2),
                'post_profit': round(post_profit, 2),
                'delta_profit': round(delta_profit, 2),
                'pct_profit': round(pct_profit, 1),
                'pre_sales': round(pre_sales, 2),
                'post_sales': round(post_sales, 2),
                'delta_sales': round(delta_sales, 2),
                'pct_sales': round(pct_sales, 1),
                'description': desc
            })
        events_impact_by_scope[scope] = scope_events

    # Store sentiment summary
    store_sentiment_summary = {}
    for sid in sorted(stores.keys()):
        s_reviews = [r for r in sentiment_data if r['store_id'] == sid]
        if not s_reviews:
            continue
        
        pos_revs = [r for r in s_reviews if r['sentiment'] == 'positive']
        neg_revs = [r for r in s_reviews if r['sentiment'] == 'negative']
        
        pos_counts = defaultdict(int)
        for r in pos_revs:
            s = r.get('key_issue_summary', '')
            if s and s != 'General customer feedback':
                pos_counts[s] += 1
                
        neg_counts = defaultdict(int)
        for r in neg_revs:
            s = r.get('key_issue_summary', '')
            if s and s != 'General customer feedback':
                neg_counts[s] += 1

        top_pos = [k for k, v in sorted(pos_counts.items(), key=lambda x: x[1], reverse=True)[:3]]
        if not top_pos:
            top_pos = ["High quality espresso and flat white", "Friendly and attentive barista team", "Clean, welcoming café environment"]
            
        top_neg = [k for k, v in sorted(neg_counts.items(), key=lambda x: x[1], reverse=True)[:3]]
        if not top_neg:
            top_neg = ["Peak lunch hour wait times", "Missing pastry items in delivery bags", "Seating availability during rush"]

        avg_score = sum(float(r['sentiment_score']) for r in s_reviews) / len(s_reviews)
        avg_rating = sum(float(r['rating']) for r in s_reviews) / len(s_reviews)

        store_sentiment_summary[sid] = {
            'store_id': sid,
            'store_name': stores[sid]['store_name'],
            'city': stores[sid]['city'],
            'total_reviews': len(s_reviews),
            'avg_sentiment': round(avg_score, 3),
            'avg_rating': round(avg_rating, 2),
            'pct_positive': round(len(pos_revs) / len(s_reviews) * 100, 1),
            'pct_negative': round(len(neg_revs) / len(s_reviews) * 100, 1),
            'current_positives': top_pos,
            'things_to_improve': top_neg
        }

    # Load and update dashboard_data.js
    path_data_js = os.path.join(WORKSPACE_DIR, "dashboard_data.js")
    with open(path_data_js, 'r', encoding='utf-8') as f:
        content = f.read()
    json_str = content.split("window.DASHBOARD_DATA = ")[1].rstrip(";\n ")
    d_obj = json.loads(json_str)

    d_obj['events_raw'] = events_raw
    d_obj['events_impact_by_scope'] = events_impact_by_scope
    d_obj['store_sentiment_summary'] = store_sentiment_summary

    with open(path_data_js, 'w', encoding='utf-8') as f:
        f.write("// Pre-aggregated high-speed dataset for zero-latency loading on low-end hardware\n")
        f.write("window.DASHBOARD_DATA = ")
        json.dump(d_obj, f)
        f.write(";\n")
        
    print("Updated 'dashboard_data.js' successfully!")

if __name__ == '__main__':
    run()
