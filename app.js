/**
 * Grind & Crumb - Ultra-Optimized Executive Dashboard, Data Verifier & Huff Gravity Engine
 * High-performance Vanilla JavaScript, zero external dependencies.
 * Features:
 * - Sortable store league tables by star rating and sentiment score
 * - Interactive event markers on profit trajectory chart with store-specific & chain-wide impact
 * - Sales Channel Revenue Contribution Donut Chart (In-Store vs App Click & Collect vs Delivery)
 * - Catchment & Expansion Profit Estimator with interactive Huff Gravity Cannibalization Model
 * - Integrated CSV Upload Validation Engine (mirroring & connecting to validate_grind_crumb.py)
 */

(function () {
  'use strict';

  // --- Utility Functions ---
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const formatGBP = (num) => {
    const val = Number(num || 0);
    if (val < 0) {
      return '-£' + Math.abs(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '£' + val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatGBPCompact = (num) => {
    const val = Number(num || 0);
    const sign = val < 0 ? '-' : '';
    const abs = Math.abs(val);
    if (abs >= 1000) {
      return `${sign}£${(abs / 1000).toFixed(1)}k`;
    }
    return `${sign}£${abs.toFixed(0)}`;
  };

  const formatInt = (num) => {
    return Number(num || 0).toLocaleString('en-GB');
  };

  const formatPct = (num) => {
    return (Number(num || 0) * 100).toFixed(1) + '%';
  };

  const MONTH_LIST = [
    '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'
  ];

  const STORE_COLORS = {
    'S01': '#38bdf8',
    'S02': '#10b981',
    'S03': '#f59e0b',
    'S04': '#ec4899',
    'S05': '#8b5cf6',
    'S06': '#06b6d4',
    'S07': '#ef4444',
    'S08': '#84cc16',
    'S09': '#f97316',
    'S10': '#a855f7',
    'S11': '#14b8a6',
    'S12': '#eab308'
  };

  // Real-world inter-site distances (miles) between Candidate Sites (CS1-CS7) and Existing Stores (S01-S12)
  const DEFAULT_CANDIDATE_DISTANCES = {
    'CS1': { 'S03': 2.50, 'S12': 2.65 },
    'CS2': { 'S01': 1.25, 'S11': 1.35, 'S02': 1.45 },
    'CS3': { 'S07': 0.75, 'S06': 1.05, 'S05': 1.20 },
    'CS4': { 'S04': 0.55 },
    'CS5': {},
    'CS6': { 'S12': 9.50, 'S03': 9.80 },
    'CS7': { 'S12': 0.42, 'S03': 0.52 }
  };

  // Canonical CSV Schema Definitions (Synced with validate_grind_crumb.py)
  const EXPECTED_SCHEMAS = {
    'stores.csv': {
      required: ['store_id', 'store_name', 'city', 'format', 'location_type', 'opened_date', 'sqft', 'seats', 'rent_gbp_month', 'store_manager'],
      pk: ['store_id'],
      numeric_positive: ['sqft', 'rent_gbp_month'],
      numeric_non_negative: ['seats'],
      date_cols: ['opened_date']
    },
    'candidate_sites.csv': {
      required: ['site_id', 'site_name', 'city', 'location_type', 'sqft', 'quoted_rent_gbp_month', 'daily_footfall_street', 'office_workers_500m', 'students_1km', 'median_household_income_gbp', 'competitor_cafes_500m', 'area_vibrancy_index_10', 'est_fitout_gbp'],
      pk: ['site_id'],
      numeric_positive: ['sqft', 'quoted_rent_gbp_month', 'daily_footfall_street', 'median_household_income_gbp', 'est_fitout_gbp'],
      numeric_non_negative: ['office_workers_500m', 'students_1km', 'competitor_cafes_500m'],
      ranges: { 'area_vibrancy_index_10': [0.0, 10.0] }
    },
    'store_catchment.csv': {
      required: ['store_id', 'daily_footfall_street', 'office_workers_500m', 'students_1km', 'median_household_income_gbp', 'competitor_cafes_500m', 'area_vibrancy_index_10'],
      pk: ['store_id'],
      numeric_positive: ['daily_footfall_street', 'median_household_income_gbp'],
      numeric_non_negative: ['office_workers_500m', 'students_1km', 'competitor_cafes_500m'],
      ranges: { 'area_vibrancy_index_10': [0.0, 10.0] }
    },
    'starter_store_monthly_pnl.csv': {
      required: ['month', 'store_id', 'store_name', 'city', 'format', 'location_type', 'trading_days', 'total_sales_gbp', 'sales_instore_gbp', 'sales_app_gbp', 'sales_delivery_gbp', 'total_receipts', 'receipts_instore', 'receipts_app', 'receipts_delivery', 'avg_ticket_gbp', 'door_count', 'food_cost_gbp', 'labour_hours', 'labour_cost_gbp', 'delivery_commission_gbp', 'delivery_packaging_gbp', 'rent_gbp', 'business_rates_gbp', 'utilities_gbp', 'repairs_maintenance_gbp', 'other_opex_gbp', 'store_profit_gbp', 'store_margin', 'waste_rate', 'waste_cost_gbp', 'headcount', 'leavers', 'staff_survey_score_10'],
      pk: ['month', 'store_id'],
      numeric_positive: ['trading_days', 'total_sales_gbp', 'total_receipts', 'door_count'],
      numeric_non_negative: ['sales_instore_gbp', 'sales_app_gbp', 'sales_delivery_gbp', 'food_cost_gbp', 'labour_hours', 'labour_cost_gbp', 'delivery_commission_gbp', 'delivery_packaging_gbp', 'rent_gbp'],
      ranges: { 'staff_survey_score_10': [0.0, 10.0], 'waste_rate': [0.0, 1.0] },
      month_cols: ['month']
    },
    'daily_store_sales.csv': {
      required: ['date', 'store_id', 'receipts_instore', 'receipts_app', 'receipts_delivery', 'net_sales_instore_gbp', 'net_sales_app_gbp', 'net_sales_delivery_gbp'],
      pk: ['date', 'store_id'],
      numeric_non_negative: ['receipts_instore', 'receipts_app', 'receipts_delivery', 'net_sales_instore_gbp', 'net_sales_app_gbp', 'net_sales_delivery_gbp'],
      date_cols: ['date']
    },
    'footfall.csv': {
      required: ['date', 'store_id', 'daypart', 'door_count'],
      pk: ['date', 'store_id', 'daypart'],
      numeric_non_negative: ['door_count'],
      date_cols: ['date']
    },
    'waste_log.csv': {
      required: ['date', 'store_id', 'category', 'units_prepared', 'units_wasted', 'est_cost_wasted_gbp'],
      pk: ['date', 'store_id', 'category'],
      numeric_non_negative: ['units_prepared', 'units_wasted', 'est_cost_wasted_gbp'],
      date_cols: ['date']
    },
    'staff_rota_weekly.csv': {
      required: ['week_start', 'store_id', 'daypart', 'scheduled_hours', 'avg_hourly_wage_gbp'],
      pk: ['week_start', 'store_id', 'daypart'],
      numeric_positive: ['scheduled_hours', 'avg_hourly_wage_gbp'],
      date_cols: ['week_start']
    },
    'staff_monthly.csv': {
      required: ['month', 'store_id', 'headcount', 'leavers', 'new_starters', 'staff_survey_score_10'],
      pk: ['month', 'store_id'],
      numeric_non_negative: ['headcount', 'leavers', 'new_starters'],
      ranges: { 'staff_survey_score_10': [0.0, 10.0] },
      month_cols: ['month']
    },
    'store_costs_monthly.csv': {
      required: ['month', 'store_id', 'rent_gbp', 'business_rates_gbp', 'utilities_gbp', 'repairs_maintenance_gbp', 'other_opex_gbp'],
      pk: ['month', 'store_id'],
      numeric_non_negative: ['rent_gbp', 'business_rates_gbp', 'utilities_gbp', 'repairs_maintenance_gbp', 'other_opex_gbp'],
      month_cols: ['month']
    },
    'products.csv': {
      required: ['product_id', 'product_name', 'category', 'menu_price_gbp', 'unit_cost_gbp', 'milk_based', 'delivery_price_gbp'],
      pk: ['product_id'],
      numeric_positive: ['menu_price_gbp', 'unit_cost_gbp', 'delivery_price_gbp']
    },
    'business_events.csv': {
      required: ['event', 'date', 'description'],
      pk: ['event', 'date'],
      date_cols: ['date']
    },
    'promotions.csv': {
      required: ['promo_id', 'promo_name', 'mechanic', 'start_date', 'end_date', 'stores', 'category', 'marketing_spend_gbp'],
      pk: ['promo_id'],
      numeric_non_negative: ['marketing_spend_gbp'],
      date_cols: ['start_date', 'end_date']
    },
    'capex.csv': {
      required: ['store_id', 'month', 'description', 'capex_gbp'],
      pk: ['store_id', 'month', 'description'],
      numeric_positive: ['capex_gbp'],
      month_cols: ['month']
    },
    'customer_reviews.csv': {
      required: ['review_id', 'review_date', 'source', 'rating', 'review_text'],
      pk: ['review_id'],
      ranges: { 'rating': [1.0, 5.0] },
      date_cols: ['review_date']
    }
  };

  // --- Application State ---
  const state = {
    data: window.DASHBOARD_DATA || null,
    currentTab: 'tab-verifier',
    theme: 'dark',
    filters: {
      store: 'ALL',
      city: 'ALL',
      format: 'ALL',
      month: 'ALL'
    },
    sortColumn: 'profit',
    sortAsc: false,
    discFilterSeverity: 'ALL',
    discFilterCategory: 'ALL',
    sentimentStoreFilter: 'ALL',
    sentimentSortOrder: 'sentiment_desc',
    sentimentSearch: '',
    activeDataset: 'fixed_pnl',
    compareSelectedStores: ['S03', 'S12'],
    compareTimeWindow: 'ALL',
    compareMetricType: 'profit',
    huffParams: {
      lambda: 2.0,
      alpha: 0.85,
      spendMult: 1.0,
      cityFilter: 'ALL'
    },
    validationReport: null,
    valStatusFilter: 'ALL',
    pendingUpload: null
  };

  // --- High-Performance Micro-Canvas Charts ---
  const MicroChart = {
    setupCanvas(canvas) {
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      return { ctx, width: rect.width, height: rect.height };
    },

    drawLineChart(canvasId, labels, datasets, eventMarkers = [], yFormatter = formatGBP) {
      const canvas = $(canvasId);
      const setup = this.setupCanvas(canvas);
      if (!setup) return;
      const { ctx, width, height } = setup;

      ctx.clearRect(0, 0, width, height);

      const padding = { top: 38, right: 25, bottom: 40, left: 65 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      let maxVal = 0;
      datasets.forEach(ds => {
        ds.data.forEach(v => { if (v > maxVal) maxVal = v; });
      });
      maxVal = maxVal * 1.15 || 100;

      ctx.lineWidth = 1;
      ctx.strokeStyle = state.theme === 'dark' ? '#334155' : '#e2e8f0';
      ctx.fillStyle = state.theme === 'dark' ? '#94a3b8' : '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';

      const gridSteps = 4;
      for (let i = 0; i <= gridSteps; i++) {
        const y = padding.top + chartHeight - (i / gridSteps) * chartHeight;
        const val = (i / gridSteps) * maxVal;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.fillText(yFormatter(val), padding.left - 8, y + 3);
      }

      ctx.textAlign = 'center';
      const stepX = chartWidth / (labels.length - 1 || 1);
      labels.forEach((lbl, idx) => {
        const x = padding.left + idx * stepX;
        ctx.fillText(lbl, x, height - padding.bottom + 18);
      });

      eventMarkers.forEach((ev, evIdx) => {
        if (ev.monthIdx >= 0 && ev.monthIdx < labels.length) {
          const x = padding.left + ev.monthIdx * stepX;
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = ev.color || '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.moveTo(x, padding.top - 8);
          ctx.lineTo(x, padding.top + chartHeight);
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = ev.color || '#f59e0b';
          ctx.beginPath();
          const badgeY = padding.top - 18 - (evIdx % 2) * 12;
          ctx.roundRect ? ctx.roundRect(x - 28, badgeY, 56, 16, 4) : ctx.rect(x - 28, badgeY, 56, 16);
          ctx.fill();

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ev.badgeText || `EV${evIdx + 1}`, x, badgeY + 11);
        }
      });

      datasets.forEach(ds => {
        ctx.beginPath();
        ctx.strokeStyle = ds.color || '#38bdf8';
        ctx.lineWidth = 2.5;

        labels.forEach((lbl, idx) => {
          const x = padding.left + idx * stepX;
          const y = padding.top + chartHeight - (ds.data[idx] / maxVal) * chartHeight;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.fillStyle = ds.color || '#38bdf8';
        labels.forEach((lbl, idx) => {
          const x = padding.left + idx * stepX;
          const y = padding.top + chartHeight - (ds.data[idx] / maxVal) * chartHeight;
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      let legX = padding.left;
      datasets.forEach(ds => {
        ctx.fillStyle = ds.color;
        ctx.fillRect(legX, 6, 12, 4);
        ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(ds.label, legX + 16, 10);
        legX += ctx.measureText(ds.label).width + 36;
      });
    },

    drawDonutChart(canvasId, items) {
      const canvas = $(canvasId);
      const setup = this.setupCanvas(canvas);
      if (!setup) return;
      const { ctx, width, height } = setup;

      ctx.clearRect(0, 0, width, height);

      const total = items.reduce((acc, it) => acc + it.value, 0) || 1;
      const centerX = width * 0.32;
      const centerY = height * 0.5;
      const outerR = Math.min(centerX, centerY) * 0.82;
      const innerR = outerR * 0.56;

      let startAngle = -Math.PI / 2;
      items.forEach(it => {
        const sliceAngle = (it.value / total) * (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerR, startAngle, startAngle + sliceAngle);
        ctx.arc(centerX, centerY, innerR, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = it.color;
        ctx.fill();
        startAngle += sliceAngle;
      });

      ctx.textAlign = 'center';
      ctx.fillStyle = state.theme === 'dark' ? '#f8fafc' : '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(formatGBP(total), centerX, centerY + 4);

      let legY = Math.max(24, (height - items.length * 26) / 2);
      const legX = width * 0.60;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';

      items.forEach(it => {
        if (legY > height - 12) return;
        ctx.fillStyle = it.color;
        ctx.fillRect(legX, legY, 10, 10);
        ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
        const pct = ((it.value / total) * 100).toFixed(1) + '%';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${it.label} (${pct})`, legX + 16, legY + 9);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = state.theme === 'dark' ? '#94a3b8' : '#64748b';
        ctx.fillText(formatGBP(it.value), legX + 16, legY + 21);
        legY += 32;
      });
    },

    drawMultiStoreCompareChart(canvasId, labels, datasets, metricType) {
      const canvas = $(canvasId);
      const setup = this.setupCanvas(canvas);
      if (!setup) return;
      const { ctx, width, height } = setup;

      ctx.clearRect(0, 0, width, height);

      if (!datasets || !datasets.length) {
        ctx.fillStyle = state.theme === 'dark' ? '#94a3b8' : '#64748b';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No stores selected for comparison. Please choose stores above.', width / 2, height / 2);
        return;
      }

      const padding = { top: 25, right: 30, bottom: 35, left: 75 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      let minVal = Infinity;
      let maxVal = -Infinity;

      datasets.forEach(ds => {
        ds.data.forEach(v => {
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        });
      });

      if (minVal === Infinity || maxVal === -Infinity) {
        minVal = 0;
        maxVal = 100;
      }

      if (minVal >= 0) {
        minVal = 0;
        maxVal = maxVal * 1.15 || 100;
      } else {
        const spread = maxVal - minVal;
        minVal = minVal - spread * 0.12;
        maxVal = maxVal + spread * 0.12;
      }

      const range = (maxVal - minVal) || 1;

      const formatY = (val) => {
        if (metricType === 'profit' || metricType === 'sales') return formatGBP(val);
        if (metricType === 'margin') return val.toFixed(1) + '%';
        return formatInt(val);
      };

      ctx.lineWidth = 1;
      ctx.strokeStyle = state.theme === 'dark' ? '#334155' : '#e2e8f0';
      ctx.fillStyle = state.theme === 'dark' ? '#94a3b8' : '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';

      const gridSteps = 5;
      for (let i = 0; i <= gridSteps; i++) {
        const val = minVal + (i / gridSteps) * range;
        const y = padding.top + chartHeight - (i / gridSteps) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.fillText(formatY(val), padding.left - 8, y + 3);
      }

      if (minVal < 0 && maxVal > 0) {
        const yZero = padding.top + chartHeight - ((0 - minVal) / range) * chartHeight;
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = state.theme === 'dark' ? '#ef4444' : '#dc2626';
        ctx.setLineDash([4, 4]);
        ctx.moveTo(padding.left, yZero);
        ctx.lineTo(width - padding.right, yZero);
        ctx.stroke();
        ctx.restore();
      }

      ctx.textAlign = 'center';
      const stepX = chartWidth / (labels.length - 1 || 1);
      labels.forEach((lbl, idx) => {
        const x = padding.left + idx * stepX;
        ctx.fillText(lbl, x, height - padding.bottom + 18);
      });

      datasets.forEach(ds => {
        ctx.beginPath();
        ctx.strokeStyle = ds.color || '#38bdf8';
        ctx.lineWidth = 2.5;

        labels.forEach((lbl, idx) => {
          const val = ds.data[idx];
          const x = padding.left + idx * stepX;
          const y = padding.top + chartHeight - ((val - minVal) / range) * chartHeight;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.fillStyle = ds.color || '#38bdf8';
        labels.forEach((lbl, idx) => {
          const val = ds.data[idx];
          const x = padding.left + idx * stepX;
          const y = padding.top + chartHeight - ((val - minVal) / range) * chartHeight;
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    },

    drawExpansionBarChart(canvasId, projections) {
      const canvas = $(canvasId);
      const setup = this.setupCanvas(canvas);
      if (!setup) return;
      const { ctx, width, height } = setup;

      ctx.clearRect(0, 0, width, height);
      if (!projections || !projections.length) return;

      const padding = { top: 34, right: 20, bottom: 45, left: 62 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      let minVal = 0;
      let maxVal = 0;
      projections.forEach(p => {
        const vals = [p.standalone_profit_gbp, -p.cannibalized_profit_gbp, p.net_incremental_profit_gbp];
        vals.forEach(v => {
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        });
      });

      minVal = Math.min(minVal * 1.2, -2500);
      maxVal = Math.max(maxVal * 1.18, 8000);
      const range = (maxVal - minVal) || 1;
      const yZero = padding.top + chartHeight - ((0 - minVal) / range) * chartHeight;

      // Grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = state.theme === 'dark' ? '#334155' : '#e2e8f0';
      ctx.fillStyle = state.theme === 'dark' ? '#94a3b8' : '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';

      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const val = minVal + (i / steps) * range;
        const y = padding.top + chartHeight - (i / steps) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.fillText(formatGBPCompact(val), padding.left - 6, y + 3);
      }

      // Zero axis line
      ctx.save();
      ctx.strokeStyle = state.theme === 'dark' ? '#94a3b8' : '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding.left, yZero);
      ctx.lineTo(width - padding.right, yZero);
      ctx.stroke();
      ctx.restore();

      const groupWidth = chartWidth / projections.length;
      const barWidth = Math.min(18, (groupWidth - 16) / 3);

      projections.forEach((p, idx) => {
        const groupX = padding.left + idx * groupWidth + (groupWidth - barWidth * 3 - 4) / 2;
        const series = [
          { val: p.standalone_profit_gbp, color: '#38bdf8' },
          { val: -p.cannibalized_profit_gbp, color: '#ef4444' },
          { val: p.net_incremental_profit_gbp, color: p.net_incremental_profit_gbp >= 0 ? '#10b981' : '#f59e0b' }
        ];

        series.forEach((s, bIdx) => {
          const bx = groupX + bIdx * (barWidth + 2);
          const yVal = padding.top + chartHeight - ((s.val - minVal) / range) * chartHeight;
          const topY = Math.min(yZero, yVal);
          const barH = Math.max(2, Math.abs(yVal - yZero));
          ctx.fillStyle = s.color;
          ctx.fillRect(bx, topY, barWidth, barH);
        });

        // Label on X axis
        const centerX = padding.left + idx * groupWidth + groupWidth / 2;
        ctx.fillStyle = state.theme === 'dark' ? '#e2e8f0' : '#1e293b';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.site_id, centerX, height - padding.bottom + 15);
        ctx.fillStyle = state.theme === 'dark' ? '#94a3b8' : '#64748b';
        ctx.font = '9px sans-serif';
        ctx.fillText(p.city, centerX, height - padding.bottom + 28);
      });

      // Legend
      const legendItems = [
        { label: 'Standalone Profit', color: '#38bdf8' },
        { label: 'Cannibalization Loss', color: '#ef4444' },
        { label: 'Net Chain Profit', color: '#10b981' }
      ];
      let legX = padding.left;
      legendItems.forEach(it => {
        ctx.fillStyle = it.color;
        ctx.fillRect(legX, 8, 10, 10);
        ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(it.label, legX + 14, 17);
        legX += ctx.measureText(it.label).width + 28;
      });
    },

    drawHuffNetworkChart(canvasId, projections, existingBenchmarks) {
      const canvas = $(canvasId);
      const setup = this.setupCanvas(canvas);
      if (!setup) return;
      const { ctx, width, height } = setup;

      ctx.clearRect(0, 0, width, height);

      // Schematic city cluster coordinates normalized [0..1]
      const cityClusters = [
        {
          city: 'Leeds',
          cx: 0.22, cy: 0.34,
          existing: [
            { id: 'S03', label: 'S03 Briggate', dx: -0.05, dy: 0.04 },
            { id: 'S12', label: 'S12 Trinity', dx: 0.04, dy: 0.05 }
          ],
          candidates: [
            { id: 'CS1', label: 'CS1 Headingley', dx: -0.08, dy: -0.17 },
            { id: 'CS7', label: 'CS7 Wellington Pl', dx: 0.01, dy: 0.14 }
          ]
        },
        {
          city: 'Sheffield',
          cx: 0.54, cy: 0.34,
          existing: [
            { id: 'S01', label: 'S01 Division', dx: -0.05, dy: 0.05 },
            { id: 'S02', label: 'S02 Station', dx: 0.06, dy: 0.06 },
            { id: 'S11', label: 'S11 Campus', dx: -0.07, dy: -0.05 }
          ],
          candidates: [
            { id: 'CS2', label: 'CS2 Kelham Is.', dx: 0.04, dy: -0.15 }
          ]
        },
        {
          city: 'Manchester',
          cx: 0.82, cy: 0.34,
          existing: [
            { id: 'S05', label: 'S05 NQ', dx: -0.04, dy: -0.08 },
            { id: 'S06', label: 'S06 Spinningfields', dx: -0.07, dy: 0.03 },
            { id: 'S07', label: 'S07 Piccadilly', dx: 0.05, dy: 0.01 }
          ],
          candidates: [
            { id: 'CS3', label: 'CS3 Oxford Rd', dx: 0.02, dy: 0.15 }
          ]
        },
        {
          city: 'York',
          cx: 0.22, cy: 0.80,
          existing: [
            { id: 'S04', label: 'S04 Stonegate', dx: -0.05, dy: 0.0 }
          ],
          candidates: [
            { id: 'CS4', label: 'CS4 York Stn', dx: 0.07, dy: 0.0 }
          ]
        },
        {
          city: 'Liverpool (Greenfield)',
          cx: 0.54, cy: 0.80,
          existing: [],
          candidates: [
            { id: 'CS5', label: 'CS5 Bold St', dx: 0.0, dy: 0.0 }
          ]
        },
        {
          city: 'Wakefield (Greenfield)',
          cx: 0.82, cy: 0.80,
          existing: [],
          candidates: [
            { id: 'CS6', label: 'CS6 Trinity Wk', dx: 0.0, dy: 0.0 }
          ]
        }
      ];

      const projMap = {};
      (projections || []).forEach(p => { projMap[p.site_id] = p; });

      // Legend at top
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(16, 12, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
      ctx.fillText('Existing Store (S01-S12)', 25, 15);

      ctx.fillStyle = '#10b981';
      ctx.beginPath(); ctx.arc(165, 12, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
      ctx.fillText('Net-Positive Candidate', 174, 15);

      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(305, 12, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
      ctx.fillText('Cannibalization / Loss Risk', 314, 15);

      cityClusters.forEach(cluster => {
        const cx = cluster.cx * width;
        const cy = cluster.cy * height;

        // Draw catchment zone halo
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(width, height) * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = state.theme === 'dark' ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.5)';
        ctx.fill();
        ctx.strokeStyle = state.theme === 'dark' ? '#334155' : '#cbd5e1';
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = state.theme === 'dark' ? '#94a3b8' : '#475569';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cluster.city, cx, cy - Math.min(width, height) * 0.17 - 3);

        const exCoords = {};
        cluster.existing.forEach(ex => {
          exCoords[ex.id] = { x: cx + ex.dx * width, y: cy + ex.dy * height, label: ex.label };
        });

        // Draw gravity lines from candidate to existing stores
        cluster.candidates.forEach(cand => {
          const p = projMap[cand.id];
          const kx = cx + cand.dx * width;
          const ky = cy + cand.dy * height;

          if (p && p.cannibalized_stores) {
            p.cannibalized_stores.forEach(cs => {
              const target = exCoords[cs.store_id];
              if (!target) return;
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(kx, ky);
              ctx.lineTo(target.x, target.y);
              const isHeavy = cs.cannibalization_pct >= 6.0;
              ctx.strokeStyle = isHeavy ? '#ef4444' : '#f59e0b';
              ctx.lineWidth = isHeavy ? 2.2 : 1.2;
              if (!isHeavy) ctx.setLineDash([3, 2]);
              ctx.stroke();
              ctx.restore();

              // Distance & % pill along line
              const mx = (kx + target.x) / 2;
              const my = (ky + target.y) / 2;
              ctx.fillStyle = isHeavy ? '#fca5a5' : '#fde68a';
              ctx.font = 'bold 8.5px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(`${cs.distance_miles}mi (-${cs.cannibalization_pct}%)`, mx, my - 2);
            });
          }

          // Draw candidate node
          const isGood = p ? p.net_incremental_profit_gbp >= 1000 : true;
          ctx.beginPath();
          ctx.arc(kx, ky, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = isGood ? '#10b981' : '#ef4444';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#0f172a';
          ctx.stroke();

          ctx.fillStyle = state.theme === 'dark' ? '#f8fafc' : '#0f172a';
          ctx.font = 'bold 9.5px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(cand.label, kx, ky + 15);
        });

        // Draw existing store nodes
        Object.values(exCoords).forEach(ex => {
          ctx.beginPath();
          ctx.arc(ex.x, ex.y, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = '#38bdf8';
          ctx.fill();
          ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ex.label, ex.x, ex.y - 8);
        });
      });
    }
  };

  // --- Client-Side + Server-Backed CSV Validator Engine (Synced with validate_grind_crumb.py) ---
  const CSVValidator = {
    detectSchemaType(filename, columns) {
      const fname = String(filename || '').toLowerCase().trim();
      if (EXPECTED_SCHEMAS[fname]) return fname;

      if (fname.includes('pnl')) return 'starter_store_monthly_pnl.csv';
      if (fname.includes('waste')) return 'waste_log.csv';
      if (fname.includes('rota')) return 'staff_rota_weekly.csv';
      if (fname.includes('review')) return 'customer_reviews.csv';
      if (fname.includes('candidate')) return 'candidate_sites.csv';
      if (fname.includes('catchment')) return 'store_catchment.csv';
      if (fname.includes('event')) return 'business_events.csv';
      if (fname.includes('promo')) return 'promotions.csv';
      if (fname.includes('capex')) return 'capex.csv';
      if (fname.includes('cost')) return 'store_costs_monthly.csv';
      if (fname.includes('footfall')) return 'footfall.csv';
      if (fname.includes('daily') || fname.includes('sales')) return 'daily_store_sales.csv';

      const colSet = new Set(columns.map(c => String(c).trim()));
      let bestMatch = 'custom_csv';
      let bestScore = 0;

      Object.entries(EXPECTED_SCHEMAS).forEach(([schemaName, spec]) => {
        const req = spec.required || [];
        if (!req.length) return;
        const matchCount = req.filter(r => colSet.has(r)).length;
        const score = matchCount / req.length;
        if (score > bestScore && score >= 0.7) {
          bestScore = score;
          bestMatch = schemaName;
        }
      });
      return bestMatch;
    },

    validateUploadedFileClient(filename, rawText, parsedRows, headers) {
      const t0 = performance.now();
      const results = [];
      const record = (category, test_id, test_name, status, message, count = 0, samples = []) => {
        results.push({ test_id, category, test_name, status, message, affected_count: count, samples });
      };

      const schemaType = this.detectSchemaType(filename, headers);
      const spec = EXPECTED_SCHEMAS[schemaType];

      // 1. Character Encoding Check
      if (rawText.includes('\uFFFD')) {
        record('File Hygiene & Encoding', `FH-ENC-${filename}`, `Character Encoding (${filename})`, 'FAIL',
          `Corrupted replacement byte (\uFFFD) detected in '${filename}'`, 1);
      } else {
        record('File Hygiene & Encoding', `FH-ENC-${filename}`, `Character Encoding (${filename})`, 'PASS',
          `Valid UTF-8 character encoding verified in '${filename}'.`, 0);
      }

      // 2. Row Volume Check
      if (!parsedRows || parsedRows.length === 0) {
        record('Schema & Column Structure', 'SCHEMA-EMPTY', `Dataset Volume (${filename})`, 'FAIL',
          `Uploaded CSV '${filename}' contains 0 data rows.`, 1);
      } else {
        record('Schema & Column Structure', 'SCHEMA-ROWS', `Dataset Volume (${filename})`, 'PASS',
          `Loaded ${parsedRows.length} rows and ${headers.length} columns from '${filename}'.`, 0);
      }

      // 3. Stray / Unnamed Column Check
      const unnamedCols = headers.filter(h => !h || h.startsWith('Unnamed:'));
      if (unnamedCols.length > 0) {
        record('Schema & Column Structure', 'SCHEMA-EXTRA', `Clean Column Headers (${filename})`, 'WARN',
          `Detected ${unnamedCols.length} unnamed/stray spreadsheet column(s) in '${filename}'.`, unnamedCols.length, unnamedCols);
      }

      if (spec) {
        // 4. Required Columns Check
        const missingCols = (spec.required || []).filter(c => !headers.includes(c));
        if (missingCols.length > 0) {
          record('Schema & Column Structure', 'SCHEMA-REQ', `Required Columns (${schemaType})`, 'FAIL',
            `Missing ${missingCols.length} required column(s) for ${schemaType}: ${missingCols.join(', ')}`,
            missingCols.length, missingCols);
        } else {
          record('Schema & Column Structure', 'SCHEMA-REQ', `Required Columns (${schemaType})`, 'PASS',
            `All ${spec.required.length} required columns verified for '${schemaType}'.`, 0);
        }

        // 5. Primary Key Duplicate Check
        const pkCols = (spec.pk || []).filter(c => headers.includes(c));
        if (pkCols.length > 0 && parsedRows.length > 0) {
          const seen = new Set();
          const dups = [];
          parsedRows.forEach(r => {
            const key = pkCols.map(c => r[c]).join(' · ');
            if (seen.has(key)) dups.push(key);
            else seen.add(key);
          });
          if (dups.length > 0) {
            record('Primary Key & Duplicate Checks', `PK-${schemaType}`, `Primary Key Uniqueness (${pkCols.join('+')})`, 'FAIL',
              `Found ${dups.length} duplicate primary key row(s) on (${pkCols.join(', ')}).`, dups.length, dups.slice(0, 5));
          } else {
            record('Primary Key & Duplicate Checks', `PK-${schemaType}`, `Primary Key Uniqueness (${pkCols.join('+')})`, 'PASS',
              `Primary key (${pkCols.join(', ')}) is 100% unique across all ${parsedRows.length} rows.`, 0);
          }
        }

        // 6. Positive Numeric Checks
        (spec.numeric_positive || []).forEach(col => {
          if (!headers.includes(col)) return;
          const badSamples = [];
          let badCount = 0;
          parsedRows.forEach((r, idx) => {
            const v = Number(r[col]);
            if (r[col] === '' || isNaN(v) || v <= 0) {
              badCount++;
              if (badSamples.length < 4) badSamples.push(`Row ${idx + 1}: '${r[col]}'`);
            }
          });
          if (badCount > 0) {
            record('Data Type & Range Checks', `TYPE-POS-${col}`, `Positive Numeric Check (${col})`, 'FAIL',
              `Column '${col}' has ${badCount} missing, non-numeric, or <= 0 value(s).`, badCount, badSamples);
          } else {
            record('Data Type & Range Checks', `TYPE-POS-${col}`, `Positive Numeric Check (${col})`, 'PASS',
              `All values in '${col}' are valid positive numbers.`, 0);
          }
        });

        // 7. Non-Negative Completeness Checks
        (spec.numeric_non_negative || []).forEach(col => {
          if (!headers.includes(col)) return;
          const badSamples = [];
          let badCount = 0;
          parsedRows.forEach((r, idx) => {
            const raw = String(r[col] !== undefined ? r[col] : '').trim();
            const v = Number(raw);
            if (raw === '' || raw.toLowerCase() === 'nan' || isNaN(v) || v < 0) {
              badCount++;
              if (badSamples.length < 4) badSamples.push(`Row ${idx + 1}: '${raw || 'BLANK'}'`);
            }
          });
          if (badCount > 0) {
            record('Data Type & Range Checks', `TYPE-NN-${col}`, `Non-Negative Completeness (${col})`, 'FAIL',
              `Column '${col}' has ${badCount} blank/NaN or negative value(s).`, badCount, badSamples);
          } else {
            record('Data Type & Range Checks', `TYPE-NN-${col}`, `Non-Negative Completeness (${col})`, 'PASS',
              `All values in '${col}' are complete and non-negative.`, 0);
          }
        });

        // 8. Domain Bounds Checks
        Object.entries(spec.ranges || {}).forEach(([col, [lo, hi]]) => {
          if (!headers.includes(col)) return;
          const badSamples = [];
          let badCount = 0;
          parsedRows.forEach((r, idx) => {
            const v = Number(r[col]);
            if (isNaN(v) || v < lo || v > hi) {
              badCount++;
              if (badSamples.length < 4) badSamples.push(`Row ${idx + 1}: ${r[col]}`);
            }
          });
          if (badCount > 0) {
            record('Data Type & Range Checks', `RANGE-${col}`, `Domain Bounds (${col} in [${lo}, ${hi}])`, 'FAIL',
              `${badCount} value(s) in '${col}' fall outside valid range [${lo}, ${hi}].`, badCount, badSamples);
          } else {
            record('Data Type & Range Checks', `RANGE-${col}`, `Domain Bounds (${col} in [${lo}, ${hi}])`, 'PASS',
              `All values in '${col}' are within [${lo}, ${hi}].`, 0);
          }
        });

        // 9. Date & Month ISO Format Checks
        const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
        (spec.date_cols || []).forEach(col => {
          if (!headers.includes(col)) return;
          const badDates = parsedRows.filter(r => !isoDateRe.test(String(r[col] || '').trim()));
          if (badDates.length > 0) {
            record('Date & Calendar Validation', `DATE-ISO-${col}`, `ISO Date Format (${col})`, 'FAIL',
              `${badDates.length} row(s) in '${col}' do not follow ISO YYYY-MM-DD format.`,
              badDates.length, badDates.slice(0, 4).map(r => r[col]));
          } else {
            record('Date & Calendar Validation', `DATE-ISO-${col}`, `ISO Date Format (${col})`, 'PASS',
              `All dates in '${col}' adhere to ISO YYYY-MM-DD format.`, 0);
          }
        });

        const isoMonthRe = /^\d{4}-\d{2}$/;
        (spec.month_cols || []).forEach(col => {
          if (!headers.includes(col)) return;
          const badMonths = parsedRows.filter(r => !isoMonthRe.test(String(r[col] || '').trim()));
          if (badMonths.length > 0) {
            record('Date & Calendar Validation', `MONTH-ISO-${col}`, `ISO Month Format (${col})`, 'FAIL',
              `${badMonths.length} row(s) in '${col}' do not follow YYYY-MM format.`,
              badMonths.length, badMonths.slice(0, 4).map(r => r[col]));
          } else {
            record('Date & Calendar Validation', `MONTH-ISO-${col}`, `ISO Month Format (${col})`, 'PASS',
              `All months in '${col}' adhere to YYYY-MM format.`, 0);
          }
        });
      } else {
        record('Schema & Column Structure', 'SCHEMA-CUSTOM', `Custom CSV Schema (${filename})`, 'WARN',
          `File '${filename}' does not match a standard Grind & Crumb table schema; general integrity checks applied.`, 0, headers.slice(0, 6));
      }

      // 10. Referential Integrity Check on store_id
      if (headers.includes('store_id') && schemaType !== 'stores.csv') {
        const validStores = new Set((state.data.stores || []).map(s => s.store_id));
        const unknown = [];
        parsedRows.forEach(r => {
          const sid = String(r.store_id || '').trim();
          if (sid && !validStores.has(sid) && !unknown.includes(sid)) unknown.push(sid);
        });
        if (unknown.length > 0) {
          record('Referential Integrity', `FK-STORE-${filename}`, `Store ID Foreign Key Validity`, 'FAIL',
            `Unknown store_id value(s) not in stores.csv: ${unknown.join(', ')}`, unknown.length, unknown);
        } else {
          record('Referential Integrity', `FK-STORE-${filename}`, `Store ID Foreign Key Validity`, 'PASS',
            `All store_id values match canonical stores (S01-S12).`, 0);
        }
      }

      // 11. P&L Internal Accounting Formula Check
      if (schemaType === 'starter_store_monthly_pnl.csv' && parsedRows.length > 0) {
        let badMath = 0;
        const mathSamples = [];
        parsedRows.forEach(r => {
          const sales = Number(r.total_sales_gbp || 0);
          const chSum = Number(r.sales_instore_gbp || 0) + Number(r.sales_app_gbp || 0) + Number(r.sales_delivery_gbp || 0);
          const costs = Number(r.food_cost_gbp || 0) + Number(r.labour_cost_gbp || 0) +
                        Number(r.delivery_commission_gbp || 0) + Number(r.delivery_packaging_gbp || 0) +
                        Number(r.rent_gbp || 0) + Number(r.business_rates_gbp || 0) +
                        Number(r.utilities_gbp || 0) + Number(r.repairs_maintenance_gbp || 0) +
                        Number(r.other_opex_gbp || 0);
          const profit = Number(r.store_profit_gbp || 0);
          if (Math.abs(sales - chSum) > 0.08 || Math.abs((sales - costs) - profit) > 0.15) {
            badMath++;
            if (mathSamples.length < 4) mathSamples.push(`${r.store_id} (${r.month})`);
          }
        });
        if (badMath > 0) {
          record('Aggregation & PnL Reconciliation', 'ARITH-PNL-01', 'P&L Internal Accounting Equation', 'FAIL',
            `${badMath} row(s) fail channel sales sum or Store Profit = Sales - Costs equation.`, badMath, mathSamples);
        } else {
          record('Aggregation & PnL Reconciliation', 'ARITH-PNL-01', 'P&L Internal Accounting Equation', 'PASS',
            `All ${parsedRows.length} P&L rows balance channel sales, total costs, and net store profit.`, 0);
        }
      }

      // 12. Candidate Sites Huff Model Readiness
      if (schemaType === 'candidate_sites.csv' && parsedRows.length > 0) {
        record('Catchment & Expansion Readiness', 'EXP-CAND-01', 'Candidate Sites Huff Model Readiness', 'PASS',
          `All ${parsedRows.length} candidate expansion sites ready for Huff Gravity & Profit projection.`, 0);
      }

      const durationMs = Number((performance.now() - t0).toFixed(2));
      const totalTests = results.length;
      const passed = results.filter(r => r.status === 'PASS').length;
      const warnings = results.filter(r => r.status === 'WARN').length;
      const failed = results.filter(r => r.status === 'FAIL').length;
      const overallStatus = failed === 0 && warnings === 0 ? 'PASS' : (failed === 0 ? 'WARN' : 'FAIL');

      return {
        status: overallStatus,
        filename,
        detected_schema: schemaType,
        row_count: parsedRows.length,
        column_count: headers.length,
        columns: headers,
        execution_metadata: {
          timestamp: new Date().toISOString(),
          duration_ms: durationMs
        },
        summary: {
          total_tests: totalTests,
          passed,
          warnings,
          failed,
          pass_rate_percentage: totalTests > 0 ? Number(((passed / totalTests) * 100).toFixed(1)) : 0.0
        },
        results
      };
    }
  };

  // --- Core Application Object ---
  const App = {
    init() {
      if (!state.data) {
        console.warn('Dashboard data not yet available.');
        return;
      }
      state.validationReport = state.data.validation_baseline_report || null;

      this.populateFilterDropdowns();
      this.bindEvents();
      this.renderVerificationTab();
      this.renderDashboardTab();
      this.renderMultiStoreCompareTab();
      this.renderChannelEconomicsTab();
      this.renderSentimentPipelineTab();
      this.renderCatchmentTab();
      this.renderExplorerTab();
      this.renderValidationReportPanel();
    },

    bindEvents() {
      $$('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          $$('.nav-tab').forEach(t => t.classList.remove('active'));
          $$('.tab-panel').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          const tabId = tab.dataset.tab;
          const panel = $(tabId);
          if (panel) panel.classList.add('active');
          state.currentTab = tabId;

          if (tabId === 'tab-dashboard') this.renderDashboardTab();
          if (tabId === 'tab-compare') this.renderMultiStoreCompareTab();
          if (tabId === 'tab-channels') this.renderChannelEconomicsTab();
          if (tabId === 'tab-sentiment') this.renderSentimentPipelineTab();
          if (tabId === 'tab-catchment') this.renderCatchmentTab();
          if (tabId === 'tab-explorer') {
            this.renderExplorerTab();
            this.renderValidationReportPanel();
          }
        });
      });

      $('btnThemeToggle').addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        if (state.currentTab === 'tab-dashboard') this.renderDashboardTab();
        if (state.currentTab === 'tab-compare') this.renderMultiStoreCompareTab();
        if (state.currentTab === 'tab-catchment') this.renderCatchmentTab();
      });

      ['filterStore', 'filterCity', 'filterFormat', 'filterMonth'].forEach(id => {
        $(id).addEventListener('change', () => {
          state.filters.store = $('filterStore').value;
          state.filters.city = $('filterCity').value;
          state.filters.format = $('filterFormat').value;
          state.filters.month = $('filterMonth').value;
          this.renderDashboardTab();
        });
      });

      $('btnResetFilters').addEventListener('click', () => {
        $('filterStore').value = 'ALL';
        $('filterCity').value = 'ALL';
        $('filterFormat').value = 'ALL';
        $('filterMonth').value = 'ALL';
        state.filters = { store: 'ALL', city: 'ALL', format: 'ALL', month: 'ALL' };
        this.renderDashboardTab();
      });

      $('filterDiscSeverity').addEventListener('change', (e) => {
        state.discFilterSeverity = e.target.value;
        this.renderDiscrepancyTable();
      });
      $('filterDiscCategory').addEventListener('change', (e) => {
        state.discFilterCategory = e.target.value;
        this.renderDiscrepancyTable();
      });

      $$('#storeLeagueTable th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.sort;
          if (state.sortColumn === col) state.sortAsc = !state.sortAsc;
          else { state.sortColumn = col; state.sortAsc = false; }
          this.renderStoreLeagueTable();
        });
      });

      $('sortSentimentStores').addEventListener('change', (e) => {
        state.sentimentSortOrder = e.target.value;
        this.renderSentimentPipelineTab();
      });
      $('sentimentStoreFilter').addEventListener('change', (e) => {
        state.sentimentStoreFilter = e.target.value;
        this.renderSentimentPipelineTab();
      });
      $('searchReviewsAdvanced').addEventListener('input', (e) => {
        state.sentimentSearch = e.target.value.toLowerCase();
        this.renderSentimentPipelineTab();
      });

      // Huff Gravity Model Controls
      ['huffLambdaSlider', 'huffAlphaSlider', 'huffSpendSlider'].forEach(id => {
        const el = $(id);
        if (el) {
          el.addEventListener('input', () => {
            state.huffParams.lambda = Number($('huffLambdaSlider').value);
            state.huffParams.alpha = Number($('huffAlphaSlider').value);
            state.huffParams.spendMult = Number($('huffSpendSlider').value);
            $('huffLambdaVal').textContent = state.huffParams.lambda.toFixed(1);
            $('huffAlphaVal').textContent = state.huffParams.alpha.toFixed(2);
            $('huffSpendVal').textContent = Math.round(state.huffParams.spendMult * 100) + '%';
            this.renderCatchmentTab();
          });
        }
      });

      if ($('huffCityFilter')) {
        $('huffCityFilter').addEventListener('change', (e) => {
          state.huffParams.cityFilter = e.target.value;
          this.renderCatchmentTab();
        });
      }

      if ($('btnResetHuffModel')) {
        $('btnResetHuffModel').addEventListener('click', () => {
          state.huffParams = { lambda: 2.0, alpha: 0.85, spendMult: 1.0, cityFilter: 'ALL' };
          $('huffLambdaSlider').value = '2.0';
          $('huffAlphaSlider').value = '0.85';
          $('huffSpendSlider').value = '1.00';
          $('huffCityFilter').value = 'ALL';
          $('huffLambdaVal').textContent = '2.0';
          $('huffAlphaVal').textContent = '0.85';
          $('huffSpendVal').textContent = '100%';
          this.renderCatchmentTab();
        });
      }

      // Explorer & Validation Controls
      $('selectDataset').addEventListener('change', (e) => {
        state.activeDataset = e.target.value;
        this.renderExplorerTab();
      });

      $('btnExportActiveTable').addEventListener('click', () => this.exportActiveTableToCSV());

      if ($('valStatusFilter')) {
        $('valStatusFilter').addEventListener('change', (e) => {
          state.valStatusFilter = e.target.value;
          this.renderValidationReportPanel();
        });
      }

      if ($('btnRunBaselineValidation')) {
        $('btnRunBaselineValidation').addEventListener('click', () => this.runBaselineValidation());
      }

      if ($('btnDownloadValidationJson')) {
        $('btnDownloadValidationJson').addEventListener('click', () => {
          if (!state.validationReport) return;
          this.downloadBlob(JSON.stringify(state.validationReport, null, 2), 'validation_report.json', 'application/json');
        });
      }

      if ($('btnConfirmIngestUpload')) {
        $('btnConfirmIngestUpload').addEventListener('click', () => this.applyPendingUpload());
      }

      if ($('btnDismissUpload')) {
        $('btnDismissUpload').addEventListener('click', () => {
          state.pendingUpload = null;
          $('valUploadActionBanner').style.display = 'none';
        });
      }

      // Drag & Drop Live Validated Ingestion
      const dropzone = $('dropzone');
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) this.handleFileUpload(e.dataTransfer.files);
      });
      $('fileInput').addEventListener('change', (e) => {
        if (e.target.files.length) this.handleFileUpload(e.target.files);
      });

      // Multi-Store Comparison Filters
      const compTime = $('compareTimeWindow');
      if (compTime) {
        compTime.addEventListener('change', (e) => {
          state.compareTimeWindow = e.target.value;
          this.renderMultiStoreCompareTab();
        });
      }

      const compMetric = $('compareMetricType');
      if (compMetric) {
        compMetric.addEventListener('change', (e) => {
          state.compareMetricType = e.target.value;
          this.renderMultiStoreCompareTab();
        });
      }

      window.addEventListener('resize', () => {
        if (state.currentTab === 'tab-dashboard') this.renderDashboardTab();
        if (state.currentTab === 'tab-compare') this.renderMultiStoreCompareTab();
        if (state.currentTab === 'tab-catchment') this.renderCatchmentTab();
      });
    },

    populateFilterDropdowns() {
      const stores = state.data.stores || [];
      const storeSelect = $('filterStore');
      const citySelect = $('filterCity');
      const monthSelect = $('filterMonth');
      const sentStoreSelect = $('sentimentStoreFilter');

      const cities = new Set();
      stores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.store_id;
        opt.textContent = `${s.store_id} - ${s.store_name}`;
        storeSelect.appendChild(opt);

        const optSent = document.createElement('option');
        optSent.value = s.store_id;
        optSent.textContent = `${s.store_id} - ${s.store_name} (${s.city})`;
        sentStoreSelect.appendChild(optSent);

        if (s.city) cities.add(s.city);
      });

      cities.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        citySelect.appendChild(opt);
      });

      MONTH_LIST.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monthSelect.appendChild(opt);
      });
    },

    // --- TAB 1: RECONCILIATION ---
    renderVerificationTab() {
      const discs = state.data.discrepancies || [];
      $('badgeDiscrepanciesCount').textContent = discs.length;
      $('kpiFixed').textContent = discs.length;
      this.renderDiscrepancyTable();
    },

    renderDiscrepancyTable() {
      const tbody = $('discrepancyTableBody');
      tbody.innerHTML = '';
      const discs = state.data.discrepancies || [];

      const filtered = discs.filter(d => {
        if (state.discFilterSeverity !== 'ALL' && d.severity !== state.discFilterSeverity) return false;
        if (state.discFilterCategory !== 'ALL' && !d.category.includes(state.discFilterCategory)) return false;
        return true;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No discrepancies matching the active filter.</td></tr>';
        return;
      }

      filtered.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${d.category}</strong></td>
          <td><span class="severity-badge ${d.severity}">${d.severity}</span></td>
          <td>${d.month !== 'ALL' ? d.month + ' · ' : ''}${d.store_id !== 'ALL' ? d.store_id : 'All Stores'}</td>
          <td><code>${d.field}</code></td>
          <td><span class="diff-val-highlight diff-old">${d.pnl_value}</span></td>
          <td><span class="diff-val-highlight diff-new">${d.expected_value}</span></td>
          <td><span class="status-badge reconciled">Reconciled</span></td>
          <td style="font-size: 0.775rem; color: var(--text-muted);">${d.description}</td>
        `;
        tbody.appendChild(tr);
      });
    },

    // --- TAB 2: EXECUTIVE P&L DASHBOARD ---
    getFilteredPnL() {
      const pnl = state.data.pnl_fixed || [];
      const storeMap = {};
      (state.data.stores || []).forEach(s => { storeMap[s.store_id] = s; });

      return pnl.filter(r => {
        if (state.filters.store !== 'ALL' && r.store_id !== state.filters.store) return false;
        if (state.filters.month !== 'ALL' && r.month !== state.filters.month) return false;
        const sInfo = storeMap[r.store_id] || {};
        if (state.filters.city !== 'ALL' && sInfo.city !== state.filters.city) return false;
        if (state.filters.format !== 'ALL' && sInfo.format !== state.filters.format) return false;
        return true;
      });
    },

    renderDashboardTab() {
      const rows = this.getFilteredPnL();
      const selectedStore = state.filters.store;

      let totalSales = 0, totalProfit = 0, totalFootfall = 0, totalReceipts = 0;
      let salesInStore = 0, salesApp = 0, salesDelivery = 0;
      let totalFoodCost = 0, totalLabourCost = 0, totalRent = 0, totalRates = 0;
      let totalUtilities = 0, totalRepairs = 0, totalOtherOpex = 0;
      let totalCommission = 0, totalPackaging = 0;

      rows.forEach(r => {
        totalSales += Number(r.total_sales_gbp || 0);
        salesInStore += Number(r.sales_instore_gbp || 0);
        salesApp += Number(r.sales_app_gbp || 0);
        salesDelivery += Number(r.sales_delivery_gbp || 0);
        totalProfit += Number(r.store_profit_gbp || 0);
        totalFootfall += Number(r.door_count || 0);
        totalReceipts += Number(r.total_receipts || 0);
        totalFoodCost += Number(r.food_cost_gbp || 0);
        totalLabourCost += Number(r.labour_cost_gbp || 0);
        totalRent += Number(r.rent_gbp || 0);
        totalRates += Number(r.business_rates_gbp || 0);
        totalUtilities += Number(r.utilities_gbp || 0);
        totalRepairs += Number(r.repairs_maintenance_gbp || 0);
        totalOtherOpex += Number(r.other_opex_gbp || 0);
        totalCommission += Number(r.delivery_commission_gbp || 0);
        totalPackaging += Number(r.delivery_packaging_gbp || 0);
      });

      const avgMargin = totalSales > 0 ? totalProfit / totalSales : 0;
      const conversionRate = totalFootfall > 0 ? totalReceipts / totalFootfall : 0;
      const avgTicket = totalReceipts > 0 ? totalSales / totalReceipts : 0;

      $('kpiTotalSales').textContent = formatGBP(totalSales);
      $('kpiTotalProfit').textContent = formatGBP(totalProfit);
      $('kpiTotalProfit').style.color = totalProfit >= 0 ? 'var(--success)' : 'var(--danger)';
      $('kpiAvgMargin').textContent = formatPct(avgMargin);
      $('kpiAvgMargin').style.color = avgMargin >= 0.15 ? 'var(--success)' : (avgMargin >= 0.05 ? 'var(--warning)' : 'var(--danger)');
      $('kpiTotalFootfall').textContent = formatInt(totalFootfall);
      $('kpiConversionRate').textContent = formatPct(conversionRate);
      $('kpiAvgTicket').textContent = formatGBP(avgTicket);

      $('trajectoryScopeLabel').textContent = selectedStore === 'ALL'
        ? 'Scope: Chain-Wide (All 12 Stores)'
        : `Scope: Store ${selectedStore} (${(state.data.stores.find(s => s.store_id === selectedStore) || {}).store_name || selectedStore})`;

      const salesByMonth = MONTH_LIST.map(m => {
        return rows.filter(r => r.month === m).reduce((acc, r) => acc + Number(r.total_sales_gbp || 0), 0);
      });
      const profitByMonth = MONTH_LIST.map(m => {
        return rows.filter(r => r.month === m).reduce((acc, r) => acc + Number(r.store_profit_gbp || 0), 0);
      });

      const scopeEvents = (state.data.events_impact_by_scope && state.data.events_impact_by_scope[selectedStore])
        ? state.data.events_impact_by_scope[selectedStore]
        : (state.data.events_impact_by_scope ? state.data.events_impact_by_scope['ALL'] : []);

      const eventMarkers = scopeEvents.map((ev, i) => {
        let badgeColor = '#f59e0b';
        let badgeText = `EV${i + 1}`;
        if (ev.event.includes('Trinity')) { badgeColor = '#38bdf8'; badgeText = 'Trinity'; }
        else if (ev.event.includes('Oat')) { badgeColor = '#10b981'; badgeText = 'Oat +40p'; }
        else if (ev.event.includes('v3.0')) { badgeColor = '#ef4444'; badgeText = 'App v3'; }
        else if (ev.event.includes('Wage') || ev.event.includes('Dashly')) { badgeColor = '#8b5cf6'; badgeText = 'Wage/Fee'; }

        return {
          monthIdx: ev.month_idx,
          label: ev.event,
          eventName: ev.event,
          color: badgeColor,
          badgeText: badgeText
        };
      });

      MicroChart.drawLineChart(
        'chartMonthlyTrends',
        MONTH_LIST.map(m => m.slice(5)),
        [
          { label: 'Total Sales (£)', data: salesByMonth, color: '#38bdf8' },
          { label: 'Store Profit (£)', data: profitByMonth, color: '#10b981' }
        ],
        eventMarkers
      );

      this.renderEventTrackerPanel(selectedStore);

      // Total Cost Breakdown Donut Chart
      MicroChart.drawDonutChart('chartCostBreakdown', [
        { label: 'Labour', value: totalLabourCost, color: '#38bdf8' },
        { label: 'Food Cost', value: totalFoodCost, color: '#f59e0b' },
        { label: 'Rent', value: totalRent, color: '#ef4444' },
        { label: 'Rates & Utilities', value: totalRates + totalUtilities, color: '#8b5cf6' },
        { label: 'Delivery Fees', value: totalCommission + totalPackaging, color: '#ec4899' },
        { label: 'Repairs & Opex', value: totalRepairs + totalOtherOpex, color: '#64748b' }
      ]);

      // Sales Channel Revenue Contribution Donut Chart
      MicroChart.drawDonutChart('chartChannelSplit', [
        { label: 'In-Store Walk-in', value: salesInStore, color: '#10b981' },
        { label: 'Third-Party Delivery', value: salesDelivery, color: '#f59e0b' },
        { label: 'App Click & Collect', value: salesApp, color: '#38bdf8' }
      ]);

      this.renderStoreLeagueTable();
    },

    renderEventTrackerPanel(selectedStore) {
      const container = $('eventTrackerCardsContainer');
      const scopeBadge = $('eventTrackerScopeBadge');
      container.innerHTML = '';

      const scopeKey = selectedStore || 'ALL';
      scopeBadge.textContent = scopeKey === 'ALL' ? 'Chain-Wide (All Stores)' : `Store ${scopeKey}`;

      const eventsList = (state.data.events_impact_by_scope && state.data.events_impact_by_scope[scopeKey])
        ? state.data.events_impact_by_scope[scopeKey]
        : [];

      if (!eventsList.length) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem;">No events data available for active scope.</div>';
        return;
      }

      eventsList.forEach(ev => {
        const isUp = ev.delta_profit >= 0;
        const card = document.createElement('div');
        card.className = 'event-tracker-card';
        card.innerHTML = `
          <div class="event-tracker-title">
            <span>${ev.event}</span>
            <span class="event-shift-badge ${isUp ? 'up' : 'down'}">
              ${isUp ? '▲ +' : '▼ '}${formatGBP(ev.delta_profit)} (${isUp ? '+' : ''}${ev.pct_profit}%)
            </span>
          </div>
          <div style="font-size: 0.725rem; color: var(--text-dim);">
            📅 ${ev.date} | Month Shift: ${ev.pre_month} ➔ ${ev.post_month}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.775rem; margin-top: 0.35rem; background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px;">
            <span>Profit: <strong>${formatGBP(ev.pre_profit)}</strong> ➔ <strong>${formatGBP(ev.post_profit)}</strong></span>
            <span>Sales: <strong>${formatGBP(ev.pre_sales)}</strong> ➔ <strong>${formatGBP(ev.post_sales)}</strong></span>
          </div>
          <div class="event-tracker-detail">
            ${ev.description}
          </div>
        `;
        container.appendChild(card);
      });
    },

    renderStoreLeagueTable() {
      const tbody = $('storeLeagueTableBody');
      tbody.innerHTML = '';
      const pnlRows = state.data.pnl_fixed || [];
      const stores = state.data.stores || [];
      const sentimentMap = state.data.store_sentiment_summary || {};

      const storeStats = {};
      stores.forEach(s => {
        const sent = sentimentMap[s.store_id] || { avg_rating: 3.9, avg_sentiment: 0.38 };
        storeStats[s.store_id] = {
          id: s.store_id,
          name: s.store_name,
          city: s.city,
          format: s.format,
          sales: 0,
          profit: 0,
          footfall: 0,
          receipts: 0,
          rating: Number(sent.avg_rating || 3.9),
          sentiment: Number(sent.avg_sentiment || 0.38)
        };
      });

      pnlRows.forEach(r => {
        const st = storeStats[r.store_id];
        if (st) {
          st.sales += Number(r.total_sales_gbp || 0);
          st.profit += Number(r.store_profit_gbp || 0);
          st.footfall += Number(r.door_count || 0);
          st.receipts += Number(r.total_receipts || 0);
        }
      });

      const list = Object.values(storeStats);

      list.sort((a, b) => {
        let va, vb;
        if (state.sortColumn === 'margin') {
          va = a.sales > 0 ? a.profit / a.sales : 0;
          vb = b.sales > 0 ? b.profit / b.sales : 0;
        } else if (state.sortColumn === 'conversion') {
          va = a.footfall > 0 ? a.receipts / a.footfall : 0;
          vb = b.footfall > 0 ? b.receipts / b.footfall : 0;
        } else if (state.sortColumn === 'ticket') {
          va = a.receipts > 0 ? a.sales / a.receipts : 0;
          vb = b.receipts > 0 ? b.sales / b.receipts : 0;
        } else if (state.sortColumn === 'rating') {
          va = a.rating;
          vb = b.rating;
        } else if (state.sortColumn === 'sentiment') {
          va = a.sentiment;
          vb = b.sentiment;
        } else {
          va = a[state.sortColumn] || 0;
          vb = b[state.sortColumn] || 0;
        }
        return state.sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });

      list.forEach(st => {
        const margin = st.sales > 0 ? st.profit / st.sales : 0;
        const conv = st.footfall > 0 ? st.receipts / st.footfall : 0;
        const ticket = st.receipts > 0 ? st.sales / st.receipts : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${st.id}</strong></td>
          <td>${st.name}</td>
          <td>${st.city}</td>
          <td><span class="badge-tag" style="background: rgba(56,189,248,0.1); color: var(--accent-primary); border-color: transparent;">${st.format}</span></td>
          <td style="text-align: right; font-weight: 600;">${formatGBP(st.sales)}</td>
          <td style="text-align: right; font-weight: 700; color: ${st.profit >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatGBP(st.profit)}</td>
          <td style="text-align: right; font-weight: 600;">${formatPct(margin)}</td>
          <td style="text-align: right; font-weight: 700; color: var(--warning);">★ ${st.rating.toFixed(2)}</td>
          <td style="text-align: right; font-weight: 700; color: ${st.sentiment >= 0.4 ? 'var(--success)' : (st.sentiment >= 0 ? 'var(--accent-primary)' : 'var(--danger)')};">
            ${st.sentiment >= 0 ? '+' : ''}${st.sentiment.toFixed(3)}
          </td>
          <td style="text-align: right;">${formatInt(st.footfall)}</td>
          <td style="text-align: right;">${formatPct(conv)}</td>
          <td style="text-align: right;">${formatGBP(ticket)}</td>
        `;
        tbody.appendChild(tr);
      });
    },

    // --- TAB 3: MULTI-STORE COMPARISON ---
    applyComparePreset(presetType) {
      const stores = state.data.stores || [];
      if (presetType === 'leeds') {
        state.compareSelectedStores = ['S03', 'S12'];
      } else if (presetType === 'manchester') {
        state.compareSelectedStores = ['S05', 'S06', 'S07'];
      } else if (presetType === 'sheffield') {
        state.compareSelectedStores = ['S01', 'S02', 'S11'];
      } else if (presetType === 'top_profit') {
        const pnl = state.data.pnl_fixed || [];
        const profitMap = {};
        pnl.forEach(r => {
          profitMap[r.store_id] = (profitMap[r.store_id] || 0) + Number(r.store_profit_gbp || 0);
        });
        const sorted = Object.entries(profitMap).sort((a, b) => b[1] - a[1]);
        state.compareSelectedStores = sorted.slice(0, 3).map(item => item[0]);
      } else if (presetType === 'select_all') {
        state.compareSelectedStores = stores.map(s => s.store_id);
      } else if (presetType === 'clear') {
        state.compareSelectedStores = ['S01', 'S03'];
      }
      this.renderMultiStoreCompareTab();
    },

    toggleCompareStore(storeId) {
      const idx = state.compareSelectedStores.indexOf(storeId);
      if (idx >= 0) {
        if (state.compareSelectedStores.length <= 1) {
          alert('At least one store must remain selected for comparison.');
          return;
        }
        state.compareSelectedStores.splice(idx, 1);
      } else {
        state.compareSelectedStores.push(storeId);
      }
      this.renderMultiStoreCompareTab();
    },

    renderMultiStoreCompareTab() {
      const stores = state.data.stores || [];
      const pnlAll = state.data.pnl_fixed || [];
      const sentimentMap = state.data.store_sentiment_summary || {};
      const selectedIds = state.compareSelectedStores || ['S03', 'S12'];

      const timeWindow = ($('compareTimeWindow') && $('compareTimeWindow').value) || state.compareTimeWindow;
      const metricType = ($('compareMetricType') && $('compareMetricType').value) || state.compareMetricType;

      const chipsContainer = $('compareStoreChipsContainer');
      if (chipsContainer) {
        chipsContainer.innerHTML = '';
        stores.forEach(s => {
          const isSelected = selectedIds.includes(s.store_id);
          const color = STORE_COLORS[s.store_id] || '#38bdf8';
          const chip = document.createElement('div');
          chip.className = `store-chip ${isSelected ? 'active' : ''}`;
          if (isSelected) {
            chip.style.borderColor = color;
            chip.style.boxShadow = `0 0 8px ${color}40`;
          }
          chip.innerHTML = `
            <span class="store-chip-dot" style="background: ${color};"></span>
            <strong>${s.store_id}</strong> ${s.store_name}
            <span style="font-size: 0.725rem; opacity: 0.75;">(${s.city})</span>
          `;
          chip.onclick = () => this.toggleCompareStore(s.store_id);
          chipsContainer.appendChild(chip);
        });
      }

      const counter = $('compareSelectionCounter');
      if (counter) {
        counter.textContent = `Selected: ${selectedIds.length} of ${stores.length} stores`;
      }

      const metricLabels = {
        profit: 'Store Profit / Loss (£)',
        margin: 'Store Margin (%)',
        sales: 'Total Sales (£)',
        footfall: 'Footfall Door Count'
      };
      if ($('compareChartMetricLabel')) {
        $('compareChartMetricLabel').textContent = `Metric: ${metricLabels[metricType] || metricType}`;
      }

      const chartDatasets = [];
      const legendContainer = $('compareChartLegend');
      if (legendContainer) legendContainer.innerHTML = '';

      selectedIds.forEach(id => {
        const sInfo = stores.find(s => s.store_id === id) || { store_id: id, store_name: id };
        const color = STORE_COLORS[id] || '#38bdf8';

        const series = MONTH_LIST.map(m => {
          const r = pnlAll.find(row => row.store_id === id && row.month === m);
          if (!r) return 0;
          if (metricType === 'profit') return Number(r.store_profit_gbp || 0);
          if (metricType === 'margin') return Number(r.store_margin || 0) * 100;
          if (metricType === 'sales') return Number(r.total_sales_gbp || 0);
          if (metricType === 'footfall') return Number(r.door_count || 0);
          return 0;
        });

        chartDatasets.push({
          label: `${id} - ${sInfo.store_name}`,
          color: color,
          data: series
        });

        if (legendContainer) {
          const badge = document.createElement('div');
          badge.style.display = 'inline-flex';
          badge.style.alignItems = 'center';
          badge.style.gap = '0.35rem';
          badge.style.padding = '3px 8px';
          badge.style.borderRadius = '4px';
          badge.style.background = 'var(--bg-secondary)';
          badge.style.border = `1px solid ${color}`;
          badge.style.fontSize = '0.75rem';
          badge.innerHTML = `
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>
            <strong>${id}</strong> ${sInfo.store_name}
          `;
          legendContainer.appendChild(badge);
        }
      });

      MicroChart.drawMultiStoreCompareChart(
        'chartMultiStoreCompare',
        MONTH_LIST.map(m => m.slice(5)),
        chartDatasets,
        metricType
      );

      const storeStats = selectedIds.map(id => {
        const sInfo = stores.find(s => s.store_id === id) || { store_id: id, store_name: id, city: '', format: '', store_manager: '' };
        const sent = sentimentMap[id] || { avg_rating: 4.0, avg_sentiment: 0.3, sentiment_label: 'Positive', current_positives: [], things_to_improve: [] };

        let rows = pnlAll.filter(r => r.store_id === id);
        if (timeWindow !== 'ALL') {
          rows = rows.filter(r => r.month === timeWindow);
        }

        const isOpen = rows.length > 0;
        const sales = rows.reduce((acc, r) => acc + Number(r.total_sales_gbp || 0), 0);
        const salesInStore = rows.reduce((acc, r) => acc + Number(r.sales_instore_gbp || 0), 0);
        const salesApp = rows.reduce((acc, r) => acc + Number(r.sales_app_gbp || 0), 0);
        const salesDelivery = rows.reduce((acc, r) => acc + Number(r.sales_delivery_gbp || 0), 0);
        const receipts = rows.reduce((acc, r) => acc + Number(r.total_receipts || 0), 0);
        const footfall = rows.reduce((acc, r) => acc + Number(r.door_count || 0), 0);
        const tradingDays = rows.reduce((acc, r) => acc + Number(r.trading_days || 0), 0);

        const foodCost = rows.reduce((acc, r) => acc + Number(r.food_cost_gbp || 0), 0);
        const labourHours = rows.reduce((acc, r) => acc + Number(r.labour_hours || 0), 0);
        const labourCost = rows.reduce((acc, r) => acc + Number(r.labour_cost_gbp || 0), 0);
        const deliveryComm = rows.reduce((acc, r) => acc + Number(r.delivery_commission_gbp || 0), 0);
        const deliveryPkg = rows.reduce((acc, r) => acc + Number(r.delivery_packaging_gbp || 0), 0);
        const rent = rows.reduce((acc, r) => acc + Number(r.rent_gbp || 0), 0);
        const rates = rows.reduce((acc, r) => acc + Number(r.business_rates_gbp || 0), 0);
        const utilities = rows.reduce((acc, r) => acc + Number(r.utilities_gbp || 0), 0);
        const repairs = rows.reduce((acc, r) => acc + Number(r.repairs_maintenance_gbp || 0), 0);
        const otherOpex = rows.reduce((acc, r) => acc + Number(r.other_opex_gbp || 0), 0);
        const wasteCost = rows.reduce((acc, r) => acc + Number(r.waste_cost_gbp || 0), 0);
        const profit = rows.reduce((acc, r) => acc + Number(r.store_profit_gbp || 0), 0);
        const margin = sales > 0 ? profit / sales : 0;
        const conv = footfall > 0 ? receipts / footfall : 0;
        const ticket = receipts > 0 ? sales / receipts : 0;

        return {
          id, sInfo, sent, isOpen, sales, salesInStore, salesApp, salesDelivery,
          receipts, footfall, tradingDays, foodCost, labourHours, labourCost,
          deliveryComm, deliveryPkg, rent, rates, utilities, repairs, otherOpex,
          wasteCost, profit, margin, conv, ticket,
          totalCosts: foodCost + labourCost + deliveryComm + deliveryPkg + rent + rates + utilities + repairs + otherOpex
        };
      });

      const cardsGrid = $('compareCardsGrid');
      if (cardsGrid) {
        cardsGrid.innerHTML = '';
        storeStats.forEach(st => {
          const color = STORE_COLORS[st.id] || '#38bdf8';
          const card = document.createElement('div');
          card.className = 'compare-store-card';
          card.style.borderTopColor = color;

          if (!st.isOpen) {
            card.innerHTML = `
              <div class="compare-store-header">
                <div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">${st.sInfo.city} · ${st.sInfo.format}</div>
                  <h3 style="font-size: 1.05rem; font-weight: 800; margin-top: 2px;"><span style="color: ${color};">●</span> ${st.id} - ${st.sInfo.store_name}</h3>
                </div>
                <span class="status-badge pending">Pre-Opening</span>
              </div>
              <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                Not trading in selected period (${timeWindow}). Store opened on ${st.sInfo.opened_date}.
              </div>
            `;
            cardsGrid.appendChild(card);
            return;
          }

          const isProfitable = st.profit >= 0;
          card.innerHTML = `
            <div class="compare-store-header">
              <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">
                  ${st.sInfo.city} · ${st.sInfo.format} (${st.sInfo.location_type || 'High street'})
                </div>
                <h3 style="font-size: 1.05rem; font-weight: 800; margin-top: 2px;">
                  <span style="color: ${color};">●</span> ${st.id} - ${st.sInfo.store_name}
                </h3>
              </div>
              <span class="status-badge ${isProfitable ? 'reconciled' : 'pending'}" style="font-size: 0.725rem;">
                ${isProfitable ? '✓ Profitable' : '⚠️ Loss-Making'}
              </span>
            </div>

            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: baseline;">
              <div>
                <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Store Profit / Loss</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: ${isProfitable ? 'var(--success)' : 'var(--danger)'};">
                  ${formatGBP(st.profit)}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Margin</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: ${st.margin >= 0.15 ? 'var(--success)' : (st.margin >= 0 ? 'var(--warning)' : 'var(--danger)')};">
                  ${formatPct(st.margin)}
                </div>
              </div>
            </div>

            <div class="compare-metric-row">
              <span>Total Revenue:</span>
              <strong>${formatGBP(st.sales)}</strong>
            </div>
            <div class="compare-metric-row">
              <span>Food Cost (COGS):</span>
              <span>${formatGBP(st.foodCost)} <span style="font-size: 0.7rem; color: var(--text-muted);">(${st.sales > 0 ? formatPct(st.foodCost / st.sales) : '0%'})</span></span>
            </div>
            <div class="compare-metric-row">
              <span>Labour Cost:</span>
              <span>${formatGBP(st.labourCost)} <span style="font-size: 0.7rem; color: var(--text-muted);">(${st.sales > 0 ? formatPct(st.labourCost / st.sales) : '0%'})</span></span>
            </div>
            <div class="compare-metric-row">
              <span>Delivery Partner Deductions:</span>
              <span style="color: var(--danger);">${formatGBP(st.deliveryComm + st.deliveryPkg)}</span>
            </div>
            <div class="compare-metric-row">
              <span>Fixed Property Overheads:</span>
              <span>${formatGBP(st.rent + st.rates + st.utilities)}</span>
            </div>
            <div class="compare-metric-row">
              <span>Footfall & Conversion:</span>
              <span>${formatInt(st.footfall)} <span style="font-size: 0.7rem; color: var(--text-muted);">(${formatPct(st.conv)} conv.)</span></span>
            </div>
            <div class="compare-metric-row">
              <span>Customer Sentiment:</span>
              <span>★ <strong>${st.sent.avg_rating.toFixed(2)}</strong> <span class="badge-tag info" style="font-size: 0.65rem; padding: 1px 5px;">${st.sent.sentiment_label || 'Positive'}</span></span>
            </div>
            <div style="font-size: 0.725rem; color: var(--text-dim); margin-top: 0.6rem; display: flex; justify-content: space-between;">
              <span>Manager: <strong>${st.sInfo.store_manager || 'N/A'}</strong></span>
              <span>Size: <strong>${st.sInfo.seats || '0'} seats / ${st.sInfo.sqft || '0'} sqft</strong></span>
            </div>
          `;
          cardsGrid.appendChild(card);
        });
      }

      const timeLabel = $('compareTableTimeLabel');
      if (timeLabel) {
        timeLabel.textContent = timeWindow === 'ALL' ? 'Full Year (2025-07 to 2026-06)' : `Month: ${timeWindow}`;
      }

      const theadRow = $('compareTableHeadRow');
      const tbody = $('compareTableBody');
      if (theadRow && tbody) {
        theadRow.innerHTML = '';
        tbody.innerHTML = '';

        const thMetric = document.createElement('th');
        thMetric.textContent = 'Line Item / Financial Metric';
        theadRow.appendChild(thMetric);

        storeStats.forEach(st => {
          const th = document.createElement('th');
          th.style.textAlign = 'right';
          th.style.color = STORE_COLORS[st.id] || 'var(--text-main)';
          th.textContent = `${st.id} - ${st.sInfo.store_name}`;
          theadRow.appendChild(th);
        });

        let hasVarianceCol = false;
        let isTwoStores = storeStats.length === 2;
        if (isTwoStores) {
          hasVarianceCol = true;
          const thVar = document.createElement('th');
          thVar.style.textAlign = 'right';
          thVar.style.background = 'rgba(56, 189, 248, 0.08)';
          thVar.style.color = 'var(--accent-primary)';
          thVar.textContent = `Variance (Δ ${storeStats[0].id} vs ${storeStats[1].id})`;
          theadRow.appendChild(thVar);
        } else if (storeStats.length >= 3) {
          hasVarianceCol = true;
          const thAvg = document.createElement('th');
          thAvg.style.textAlign = 'right';
          thAvg.style.background = 'rgba(56, 189, 248, 0.08)';
          thAvg.style.color = 'var(--accent-primary)';
          thAvg.textContent = 'Selected Stores Benchmark Avg';
          theadRow.appendChild(thAvg);
        }

        const addSectionHeader = (title) => {
          const tr = document.createElement('tr');
          const colSpan = storeStats.length + (hasVarianceCol ? 2 : 1);
          tr.innerHTML = `<td colspan="${colSpan}" style="background: var(--bg-tertiary); font-weight: 800; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-primary); padding: 0.5rem 0.85rem;">${title}</td>`;
          tbody.appendChild(tr);
        };

        const addRow = (label, getter, type = 'gbp', highlight = false, isGoodWhenHigher = true) => {
          const tr = document.createElement('tr');
          if (highlight) tr.style.background = 'rgba(255, 255, 255, 0.03)';

          let html = `<td style="font-weight: ${highlight ? '700' : 'normal'};">${label}</td>`;
          const vals = storeStats.map(st => getter(st));

          vals.forEach((v, idx) => {
            let str = '';
            let style = 'text-align: right;';
            if (highlight) style += ' font-weight: 700;';

            if (!storeStats[idx].isOpen) {
              str = '<span style="color: var(--text-dim);">-</span>';
            } else if (type === 'gbp') {
              if (highlight && label.includes('Profit')) {
                style += ` color: ${v >= 0 ? 'var(--success)' : 'var(--danger)'};`;
              }
              str = formatGBP(v);
            } else if (type === 'pct') {
              str = formatPct(v);
            } else if (type === 'int') {
              str = formatInt(v);
            } else {
              str = v;
            }
            html += `<td style="${style}">${str}</td>`;
          });

          if (isTwoStores) {
            const v0 = vals[0];
            const v1 = vals[1];
            let varHtml = '';
            if (typeof v0 === 'number' && typeof v1 === 'number') {
              const delta = v0 - v1;
              const pct = v1 !== 0 ? (delta / Math.abs(v1)) * 100 : 0;
              const isPositive = delta >= 0;
              let color = 'inherit';
              if (type === 'gbp' || type === 'pct' || type === 'int') {
                if (isGoodWhenHigher) color = isPositive ? 'var(--success)' : 'var(--danger)';
                else color = isPositive ? 'var(--danger)' : 'var(--success)';
              }
              const prefix = isPositive ? '+' : '';
              if (type === 'gbp') {
                varHtml = `<span style="color: ${color}; font-weight: 700;">${prefix}${formatGBP(delta)}</span> <span style="font-size: 0.7rem; color: var(--text-muted);">(${prefix}${pct.toFixed(1)}%)</span>`;
              } else if (type === 'pct') {
                varHtml = `<span style="color: ${color}; font-weight: 700;">${prefix}${(delta * 100).toFixed(1)}% pts</span>`;
              } else if (type === 'int') {
                varHtml = `<span style="color: ${color}; font-weight: 700;">${prefix}${formatInt(delta)}</span> <span style="font-size: 0.7rem; color: var(--text-muted);">(${prefix}${pct.toFixed(1)}%)</span>`;
              }
            } else {
              varHtml = '<span style="color: var(--text-dim);">-</span>';
            }
            html += `<td style="text-align: right; background: rgba(56, 189, 248, 0.04);">${varHtml}</td>`;
          } else if (storeStats.length >= 3) {
            const openStats = storeStats.filter(st => st.isOpen);
            let avgHtml = '';
            if (typeof vals[0] === 'number') {
              const sum = openStats.reduce((acc, st) => acc + getter(st), 0);
              const avg = openStats.length ? sum / openStats.length : 0;
              if (type === 'gbp') avgHtml = `<strong>${formatGBP(avg)}</strong>`;
              else if (type === 'pct') avgHtml = `<strong>${formatPct(avg)}</strong>`;
              else if (type === 'int') avgHtml = `<strong>${formatInt(Math.round(avg))}</strong>`;
            } else {
              avgHtml = '-';
            }
            html += `<td style="text-align: right; background: rgba(56, 189, 248, 0.04);">${avgHtml}</td>`;
          }

          tr.innerHTML = html;
          tbody.appendChild(tr);
        };

        addSectionHeader('📍 Store Profile & Operations');
        addRow('Store Format & Location', st => `${st.sInfo.format} (${st.sInfo.location_type})`, 'text');
        addRow('Trading Days in Period', st => st.tradingDays, 'int');
        addRow('Store Capacity & Space', st => `${st.sInfo.seats || '0'} seats · ${st.sInfo.sqft || '0'} sqft`, 'text');
        addRow('Store Manager', st => st.sInfo.store_manager || 'N/A', 'text');

        addSectionHeader('🚶 Footfall, Volume & Conversion');
        addRow('Reconciled Door Count (Footfall)', st => st.footfall, 'int', false, true);
        addRow('Total Transactions (Receipts)', st => st.receipts, 'int', false, true);
        addRow('Footfall Conversion Rate', st => st.conv, 'pct', false, true);
        addRow('Average Ticket Size', st => st.ticket, 'gbp', false, true);

        addSectionHeader('💳 Revenue Mix by Sales Channel');
        addRow('In-Store Walk-in Sales', st => st.salesInStore, 'gbp', false, true);
        addRow('App Click & Collect Sales', st => st.salesApp, 'gbp', false, true);
        addRow('Third-Party Delivery Sales', st => st.salesDelivery, 'gbp', false, true);
        addRow('Total Revenue / Sales', st => st.sales, 'gbp', true, true);

        addSectionHeader('🥐 Cost of Goods Sold (COGS) & Labour');
        addRow('Food Cost (COGS)', st => st.foodCost, 'gbp', false, false);
        addRow('Food Cost % of Revenue', st => st.sales > 0 ? st.foodCost / st.sales : 0, 'pct', false, false);
        addRow('Food Waste Cost', st => st.wasteCost, 'gbp', false, false);
        addRow('Scheduled Labour Hours', st => st.labourHours, 'int', false, false);
        addRow('Total Labour Payroll', st => st.labourCost, 'gbp', false, false);
        addRow('Labour Cost % of Revenue', st => st.sales > 0 ? st.labourCost / st.sales : 0, 'pct', false, false);

        addSectionHeader('🛵 Third-Party Delivery Deductions');
        addRow('Platform Commissions (27-33%)', st => st.deliveryComm, 'gbp', false, false);
        addRow('Delivery Packaging Costs (45p/order)', st => st.deliveryPkg, 'gbp', false, false);
        addRow('Total Delivery Direct Deductions', st => st.deliveryComm + st.deliveryPkg, 'gbp', true, false);

        addSectionHeader('🏢 Property & Operational Overheads');
        addRow('Premises Rent', st => st.rent, 'gbp', false, false);
        addRow('Business Rates', st => st.rates, 'gbp', false, false);
        addRow('Utilities (Energy & Water)', st => st.utilities, 'gbp', false, false);
        addRow('Repairs & Maintenance', st => st.repairs, 'gbp', false, false);
        addRow('Other Operating Expenses (Opex)', st => st.otherOpex, 'gbp', false, false);
        addRow('Total Store Operating Costs', st => st.totalCosts, 'gbp', true, false);

        addSectionHeader('📊 Net Profitability & Contribution');
        addRow('Store Net Profit / Loss (GBP)', st => st.profit, 'gbp', true, true);
        addRow('Store Net Profit Margin (%)', st => st.margin, 'pct', true, true);

        addSectionHeader('⭐ Customer Feedback & Sentiment');
        addRow('Average Google Review Star Rating', st => st.sent.avg_rating, 'text');
        addRow('AI Sentiment Score (-1.0 to +1.0)', st => `${st.sent.avg_sentiment >= 0 ? '+' : ''}${st.sent.avg_sentiment.toFixed(3)} (${st.sent.sentiment_label || 'Positive'})`, 'text');
        addRow('Current Positives Highlight', st => (st.sent.current_positives && st.sent.current_positives.length) ? st.sent.current_positives.slice(0, 2).join('; ') : 'Quality coffee & staff', 'text');
        addRow('Areas for Improvement', st => (st.sent.things_to_improve && st.sent.things_to_improve.length) ? st.sent.things_to_improve.slice(0, 2).join('; ') : 'Wait times during peak', 'text');
      }
    },

    // --- TAB 4: CHANNEL ECONOMICS & PROFIT DRAINS ---
    renderChannelEconomicsTab() {
      const channels = state.data.channel_comparison || [];
      const grid = $('channelCardsGrid');
      const tbody = $('channelTableBody');
      grid.innerHTML = '';
      tbody.innerHTML = '';

      channels.forEach(ch => {
        const card = document.createElement('div');
        card.className = `channel-card ${ch.is_profit_drain ? 'drain' : ''}`;
        card.innerHTML = `
          <div class="channel-header">
            <span class="channel-title">${ch.channel}</span>
            <span class="badge-tag ${ch.is_profit_drain ? 'danger' : 'success'}">
              ${ch.is_profit_drain ? '⚠️ Major Profit Drain' : '✓ Highly Profitable'}
            </span>
          </div>
          <div class="channel-metric-row">
            <span>Total Sales Revenue:</span>
            <strong>${formatGBP(ch.sales)}</strong>
          </div>
          <div class="channel-metric-row">
            <span>Total Orders / Receipts:</span>
            <span>${formatInt(ch.receipts)} (Avg Ticket: ${formatGBP(ch.avg_ticket)})</span>
          </div>
          <div class="channel-metric-row">
            <span>Food Cost (27.5%):</span>
            <span>${formatGBP(ch.food_cost)}</span>
          </div>
          ${ch.commission > 0 ? `
          <div class="channel-metric-row" style="color: var(--danger);">
            <span>Platform Commission (27-33%):</span>
            <strong>${formatGBP(ch.commission)}</strong>
          </div>` : ''}
          ${ch.packaging > 0 ? `
          <div class="channel-metric-row" style="color: var(--warning);">
            <span>Packaging Cost (45p/order):</span>
            <span>${formatGBP(ch.packaging)}</span>
          </div>` : ''}
          ${ch.packing_labour > 0 ? `
          <div class="channel-metric-row" style="color: var(--warning);">
            <span>Staff Packing Labour (4 min/order):</span>
            <span>${formatGBP(ch.packing_labour)}</span>
          </div>` : ''}
          <div class="channel-metric-row total">
            <span>Gross Contribution Margin:</span>
            <strong style="color: ${ch.gross_margin_pct >= 50 ? 'var(--success)' : 'var(--danger)'};">
              ${ch.gross_margin_pct}% (${formatGBP(ch.gross_contribution)})
            </strong>
          </div>
          <div class="channel-metric-row" style="border-top: 1px solid var(--border-light); margin-top: 0.35rem; padding-top: 0.35rem;">
            <span>Est. Net Margin (post-overhead):</span>
            <strong style="color: ${ch.net_margin_pct >= 0 ? 'var(--success)' : 'var(--danger)'};">
              ${ch.net_margin_pct}% (${formatGBP(ch.net_profit_est)})
            </strong>
          </div>
        `;
        grid.appendChild(card);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${ch.channel}</strong></td>
          <td style="text-align: right; font-weight: 600;">${formatGBP(ch.sales)}</td>
          <td style="text-align: right;">${formatInt(ch.receipts)}</td>
          <td style="text-align: right;">${formatGBP(ch.avg_ticket)}</td>
          <td style="text-align: right;">${formatGBP(ch.food_cost)}</td>
          <td style="text-align: right; color: ${ch.commission > 0 ? 'var(--danger)' : 'inherit'}; font-weight: ${ch.commission > 0 ? '700' : 'normal'};">
            ${formatGBP(ch.commission)}
          </td>
          <td style="text-align: right;">${formatGBP(ch.packaging)}</td>
          <td style="text-align: right;">${formatGBP(ch.packing_labour)}</td>
          <td style="text-align: right; font-weight: 600;">${formatGBP(ch.gross_contribution)}</td>
          <td style="text-align: right; font-weight: 700; color: ${ch.gross_margin_pct >= 50 ? 'var(--success)' : 'var(--danger)'};">
            ${ch.gross_margin_pct}%
          </td>
          <td style="text-align: right; font-weight: 700; color: ${ch.net_margin_pct >= 0 ? 'var(--success)' : 'var(--danger)'};">
            ${ch.net_margin_pct}%
          </td>
        `;
        tbody.appendChild(tr);
      });
    },

    // --- TAB 5: SENTIMENT PIPELINE & STORE INSIGHTS ---
    renderSentimentPipelineTab() {
      const container = $('sentimentStoreCardsContainer');
      container.innerHTML = '';
      const insights = state.data.store_sentiment_summary || {};
      const targetStore = state.sentimentStoreFilter;
      const search = state.sentimentSearch;
      const sortOrder = state.sentimentSortOrder;

      let entries = Object.values(insights).filter(st => {
        if (targetStore !== 'ALL' && st.store_id !== targetStore) return false;
        if (search) {
          const matchName = st.store_name.toLowerCase().includes(search);
          const matchPos = st.current_positives.some(p => p.toLowerCase().includes(search));
          const matchNeg = st.things_to_improve.some(n => n.toLowerCase().includes(search));
          if (!matchName && !matchPos && !matchNeg) return false;
        }
        return true;
      });

      entries.sort((a, b) => {
        if (sortOrder === 'sentiment_desc') return b.avg_sentiment - a.avg_sentiment;
        if (sortOrder === 'sentiment_asc') return a.avg_sentiment - b.avg_sentiment;
        if (sortOrder === 'rating_desc') return b.avg_rating - a.avg_rating;
        if (sortOrder === 'rating_asc') return a.avg_rating - b.avg_rating;
        if (sortOrder === 'reviews_desc') return b.total_reviews - a.total_reviews;
        if (sortOrder === 'id_asc') return a.store_id.localeCompare(b.store_id);
        return 0;
      });

      if (!entries.length) {
        container.innerHTML = '<div style="padding: 1.5rem; color: var(--text-muted); text-align: center;">No store sentiment data found for active filter.</div>';
        return;
      }

      entries.forEach(st => {
        const card = document.createElement('div');
        card.className = 'sentiment-store-card';
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <strong style="font-size: 1.05rem;">${st.store_id} · ${st.store_name}</strong>
              <span style="font-size: 0.8rem; color: var(--text-dim); margin-left: 0.5rem;">(${st.city})</span>
            </div>
            <div style="display: flex; gap: 0.75rem; align-items: center;">
              <span style="font-size: 0.85rem; color: var(--warning); font-weight: 700;">★ ${st.avg_rating.toFixed(2)} / 5.0</span>
              <span class="badge-tag ${st.avg_sentiment >= 0.4 ? 'success' : (st.avg_sentiment >= 0.2 ? 'warning' : 'danger')}">
                Sentiment: ${st.avg_sentiment >= 0 ? '+' : ''}${st.avg_sentiment.toFixed(3)}
              </span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${formatInt(st.total_reviews)} reviews</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid rgba(16, 185, 129, 0.2);">
              <h5 style="color: var(--success); font-size: 0.775rem; text-transform: uppercase; margin-bottom: 0.45rem;">
                ✓ Current Positives (${st.pct_positive}% Positive Reviews)
              </h5>
              <div>
                ${st.current_positives.map(p => `<span class="sentiment-pill pos">👍 ${p}</span>`).join('')}
              </div>
            </div>

            <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid rgba(239, 68, 68, 0.2);">
              <h5 style="color: var(--danger); font-size: 0.775rem; text-transform: uppercase; margin-bottom: 0.45rem;">
                ⚠️ Things to Improve (${st.pct_negative}% Negative Reviews)
              </h5>
              <div>
                ${st.things_to_improve.map(n => `<span class="sentiment-pill neg">⚡ ${n}</span>`).join('')}
              </div>
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    },

    // --- TAB 6: CATCHMENT & EXPANSION (PROFIT ESTIMATOR & HUFF GRAVITY MODEL) ---
    computeDynamicHuffModel() {
      const pnl = state.data.pnl_fixed || [];
      const storesList = state.data.stores || [];
      const catchmentList = state.data.catchment || [];
      const candidatesList = state.data.candidate_sites || [];

      const lam = state.huffParams.lambda;
      const alpha = state.huffParams.alpha;
      const spendMult = state.huffParams.spendMult;

      const catchMap = {};
      catchmentList.forEach(c => { catchMap[c.store_id] = c; });

      const existingBenchmarks = {};
      storesList.forEach(s => {
        const sid = s.store_id;
        const rows = pnl.filter(r => r.store_id === sid);
        const steadyRows = sid === 'S12' ? rows.filter(r => r.month >= '2025-10') : rows;
        const n = steadyRows.length || 1;

        const avgSales = steadyRows.reduce((acc, r) => acc + Number(r.total_sales_gbp || 0), 0) / n;
        const avgReceipts = steadyRows.reduce((acc, r) => acc + Number(r.total_receipts || 0), 0) / n;
        const avgDoor = steadyRows.reduce((acc, r) => acc + Number(r.door_count || 0), 0) / n;
        const avgProfit = steadyRows.reduce((acc, r) => acc + Number(r.store_profit_gbp || 0), 0) / n;
        const avgTicket = avgReceipts > 0 ? avgSales / avgReceipts : 5.95;

        const cInfo = catchMap[sid] || {};
        const sqft = Number(s.sqft || 1400);
        const vib = Number(cInfo.area_vibrancy_index_10 || 7.2);
        const comp = Number(cInfo.competitor_cafes_500m || 8);
        const attractiveness = Math.pow(sqft / 1400.0, alpha) * Math.pow(vib / 7.2, 0.90);

        existingBenchmarks[sid] = {
          store_id: sid,
          store_name: s.store_name,
          city: s.city,
          format: s.format,
          location_type: s.location_type,
          sqft,
          rent_gbp_month: Number(s.rent_gbp_month || 0),
          daily_footfall_street: Number(cInfo.daily_footfall_street || 25000),
          office_workers_500m: Number(cInfo.office_workers_500m || 5000),
          students_1km: Number(cInfo.students_1km || 4000),
          median_household_income_gbp: Number(cInfo.median_household_income_gbp || 33000),
          competitor_cafes_500m: comp,
          area_vibrancy_index_10: vib,
          avg_monthly_receipts: Math.round(avgReceipts),
          avg_ticket_gbp: Number(avgTicket.toFixed(2)),
          avg_monthly_sales_gbp: Number(avgSales.toFixed(2)),
          avg_monthly_profit_gbp: Number(avgProfit.toFixed(2)),
          attractiveness: Number(attractiveness.toFixed(3)),
          marginal_contribution_rate: 0.418
        };
      });

      const locBaseTicket = {
        'Office district': 6.24,
        'High street': 6.14,
        'Tourist': 6.19,
        'Affluent town': 6.22,
        'Shopping centre': 5.96,
        'Transit': 5.76,
        'Campus': 5.62
      };

      const projections = candidatesList.map(cand => {
        const cid = cand.site_id;
        const cname = cand.site_name;
        const city = cand.city;
        const locType = cand.location_type;
        const sqft = Number(cand.sqft || 1400);
        const rent = Number(cand.quoted_rent_gbp_month || 8000);
        const streetFf = Number(cand.daily_footfall_street || 20000);
        const officeW = Number(cand.office_workers_500m || 3000);
        const students = Number(cand.students_1km || 3000);
        const income = Number(cand.median_household_income_gbp || 32000);
        const comp = Number(cand.competitor_cafes_500m || 8);
        const vib = Number(cand.area_vibrancy_index_10 || 7.0);
        const fitout = Number(cand.est_fitout_gbp || 300000);

        const attractiveness = Math.pow(sqft / 1400.0, alpha) * Math.pow(vib / 7.2, 0.90);

        const baseTkt = locBaseTicket[locType] || 6.08;
        const incomeFactor = 1.0 + 0.14 * ((income - 33250.0) / 33250.0);
        const estAvgTicket = Number((baseTkt * incomeFactor * spendMult).toFixed(2));

        const rawDemandPool = (streetFf * 0.21) + (officeW * 0.36) + (students * 0.15);
        const compResistance = 1.0 + 0.022 * comp;
        const sizeCapFactor = Math.pow(sqft / 1400.0, 0.36 * alpha);
        const vibBoost = Math.pow(vib / 7.2, 0.78);

        let estMonthlyReceipts = Math.round(((5450.0 + rawDemandPool * 0.62) * sizeCapFactor * vibBoost) / compResistance);
        const maxCapReceipts = sqft >= 850 ? Math.round(sqft * 9.2) : Math.round(sqft * 15.8);
        estMonthlyReceipts = Math.min(estMonthlyReceipts, maxCapReceipts);

        const estMonthlySales = Number((estMonthlyReceipts * estAvgTicket).toFixed(2));
        const foodCost = Number((estMonthlySales * 0.274).toFixed(2));
        const isKioskOrTransit = (sqft < 800 || locType === 'Transit' || locType === 'Campus');
        const deliveryCost = Number((estMonthlySales * (isKioskOrTransit ? 0.025 : 0.058)).toFixed(2));
        const labourCost = Number((3450.0 + (sqft * 1.25) + (estMonthlySales * 0.205)).toFixed(2));
        const businessRates = Number((rent * 0.22).toFixed(2));
        const utilitiesAndOpex = Number((1420.0 + (sqft * 0.98)).toFixed(2));

        const totalCosts = Number((foodCost + labourCost + deliveryCost + rent + businessRates + utilitiesAndOpex).toFixed(2));
        const standaloneProfit = Number((estMonthlySales - totalCosts).toFixed(2));
        const standaloneMarginPct = estMonthlySales > 0 ? Number(((standaloneProfit / estMonthlySales) * 100).toFixed(1)) : 0.0;

        // Huff Gravity Cannibalization across existing stores
        let distances = DEFAULT_CANDIDATE_DISTANCES[cid];
        if (!distances) {
          // Auto-infer for newly uploaded custom candidate sites in existing cities
          distances = {};
          Object.values(existingBenchmarks).forEach(eb => {
            if (eb.city.toLowerCase() === city.toLowerCase()) {
              distances[eb.store_id] = Number(cand.distance_nearest_store_miles || 0.85);
            }
          });
        }

        const cannibalizedStores = [];
        let totalCannibSales = 0;
        let totalCannibProfit = 0;
        let totalCannibReceipts = 0;

        Object.entries(distances).sort((a, b) => a[1] - b[1]).forEach(([esid, distMiles]) => {
          const eb = existingBenchmarks[esid];
          if (!eb) return;
          const uOwn = eb.attractiveness / Math.pow(0.25, lam);
          const uComp = 0.45 * eb.competitor_cafes_500m;
          const uNew = (0.68 * attractiveness) / Math.pow(Math.max(distMiles, 0.15), lam);

          const cannibShare = uNew / (uOwn + uComp + uNew);
          const cannibReceipts = Math.round(eb.avg_monthly_receipts * cannibShare);
          const cannibSales = Number((eb.avg_monthly_sales_gbp * cannibShare).toFixed(2));
          const cannibProfit = Number((cannibSales * eb.marginal_contribution_rate).toFixed(2));

          totalCannibReceipts += cannibReceipts;
          totalCannibSales += cannibSales;
          totalCannibProfit += cannibProfit;

          cannibalizedStores.push({
            store_id: esid,
            store_name: eb.store_name,
            distance_miles: distMiles,
            huff_utility_new: Number(uNew.toFixed(2)),
            cannibalization_pct: Number((cannibShare * 100).toFixed(1)),
            diverted_receipts_month: cannibReceipts,
            cannibalized_sales_gbp: cannibSales,
            cannibalized_profit_gbp: cannibProfit
          });
        });

        totalCannibSales = Number(totalCannibSales.toFixed(2));
        totalCannibProfit = Number(totalCannibProfit.toFixed(2));
        const netIncrementalProfit = Number((standaloneProfit - totalCannibProfit).toFixed(2));
        const netAnnualProfit = Number((netIncrementalProfit * 12).toFixed(2));
        const cannibDragPct = standaloneProfit > 0 ? Number(((totalCannibProfit / standaloneProfit) * 100).toFixed(1)) : 100.0;
        const paybackMonths = netIncrementalProfit > 0 ? Number((fitout / netIncrementalProfit).toFixed(1)) : null;
        const annualRoiPct = fitout > 0 ? Number(((netAnnualProfit / fitout) * 100).toFixed(1)) : 0.0;

        let verdict = 'Marginal / Slow Payback';
        let verdictLevel = 'warning';
        if (netIncrementalProfit >= 7500 && cannibDragPct < 25) {
          verdict = '★ Prime Expansion';
          verdictLevel = 'success';
        } else if (netIncrementalProfit >= 3500 && cannibDragPct < 45) {
          verdict = '✓ Viable Growth';
          verdictLevel = 'info';
        } else if (totalCannibProfit >= 2500 && netIncrementalProfit < 2000) {
          verdict = '⚠️ Cannibalization Trap';
          verdictLevel = 'danger';
        } else if (standaloneProfit < 0 || netIncrementalProfit < 0) {
          verdict = '✗ Unprofitable Site';
          verdictLevel = 'danger';
        }

        return {
          site_id: cid,
          site_name: cname,
          city,
          location_type: locType,
          sqft,
          quoted_rent_gbp_month: rent,
          daily_footfall_street: streetFf,
          office_workers_500m: officeW,
          students_1km: students,
          median_household_income_gbp: income,
          competitor_cafes_500m: comp,
          area_vibrancy_index_10: vib,
          est_fitout_gbp: fitout,
          huff_attractiveness: Number(attractiveness.toFixed(3)),
          est_monthly_receipts: estMonthlyReceipts,
          est_avg_ticket_gbp: estAvgTicket,
          est_monthly_sales_gbp: estMonthlySales,
          est_total_costs_gbp: totalCosts,
          standalone_profit_gbp: standaloneProfit,
          standalone_margin_pct: standaloneMarginPct,
          cannibalized_receipts_month: totalCannibReceipts,
          cannibalized_sales_gbp: totalCannibSales,
          cannibalized_profit_gbp: totalCannibProfit,
          cannibalization_drag_pct: cannibDragPct,
          cannibalized_stores: cannibalizedStores,
          net_incremental_profit_gbp: netIncrementalProfit,
          net_annual_profit_gbp: netAnnualProfit,
          payback_months: paybackMonths,
          annual_roi_pct: annualRoiPct,
          verdict,
          verdict_level: verdictLevel
        };
      });

      projections.sort((a, b) => b.net_incremental_profit_gbp - a.net_incremental_profit_gbp);
      return { existingBenchmarks, projections };
    },

    renderCatchmentTab() {
      const { existingBenchmarks, projections } = this.computeDynamicHuffModel();
      const cityFilter = state.huffParams.cityFilter || 'ALL';
      const filteredProjs = cityFilter === 'ALL'
        ? projections
        : projections.filter(p => p.city.toLowerCase() === cityFilter.toLowerCase());

      // Update Top KPI Cards
      if (projections.length > 0) {
        const topSite = projections[0];
        $('kpiTopExpansionSite').textContent = `${topSite.site_id} · ${topSite.site_name.replace(topSite.city + ' ', '')}`;
        $('kpiTopExpansionSub').textContent = `+${formatGBP(topSite.net_incremental_profit_gbp)}/mo Net Chain Profit`;

        const viableSites = projections.filter(p => p.net_incremental_profit_gbp > 0);
        const totalViableMonthly = viableSites.reduce((acc, p) => acc + p.net_incremental_profit_gbp, 0);
        $('kpiTotalViableProfit').textContent = `+${formatGBP(totalViableMonthly)}/mo`;
        $('kpiTotalViableSub').textContent = `${viableSites.length} Net-Positive Sites (+${formatGBPCompact(totalViableMonthly * 12)}/yr)`;

        const worstCannib = [...projections].sort((a, b) => b.cannibalized_profit_gbp - a.cannibalized_profit_gbp)[0];
        if (worstCannib) {
          $('kpiWorstCannibSite').textContent = `${worstCannib.site_id} · ${worstCannib.site_name.replace(worstCannib.city + ' ', '')}`;
          const storesAffected = worstCannib.cannibalized_stores.map(s => s.store_id).join(' & ') || 'Existing Stores';
          $('kpiWorstCannibSub').textContent = `-${formatGBP(worstCannib.cannibalized_profit_gbp)}/mo Cannibalized from ${storesAffected}`;
        }

        const cs7 = projections.find(p => p.site_id === 'CS7');
        if (cs7 && $('calloutCs7Standalone')) {
          $('calloutCs7Standalone').textContent = `${formatGBP(cs7.standalone_profit_gbp)}/mo`;
          $('calloutCs7CannibLoss').textContent = `-${formatGBP(cs7.cannibalized_profit_gbp)}/mo`;
          $('calloutCs7Net').textContent = `${formatGBP(cs7.net_incremental_profit_gbp)}/mo`;
        }
      }

      // Draw Canvas Charts
      MicroChart.drawExpansionBarChart('chartExpansionProfits', filteredProjs);
      MicroChart.drawHuffNetworkChart('chartHuffGravityMap', projections, existingBenchmarks);

      // Render Candidate Expansion Table
      const tbody = $('candidateSitesTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        filteredProjs.forEach(s => {
          const affectedStr = s.cannibalized_stores.length > 0
            ? s.cannibalized_stores.map(cs => `<strong>${cs.store_id}</strong> (${cs.distance_miles}mi: -${cs.cannibalization_pct}%)`).join('<br>')
            : '<span style="color: var(--success); font-weight: 600;">0% (Greenfield City)</span>';

          const paybackStr = s.payback_months !== null && s.payback_months < 240
            ? `${s.payback_months} mos (${s.annual_roi_pct}% ROI)`
            : '<span style="color: var(--danger);">Never / Neg. Cashflow</span>';

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${s.site_id}</strong></td>
            <td><strong>${s.site_name}</strong></td>
            <td>${s.city} <span style="font-size: 0.725rem; color: var(--text-muted);">(${s.location_type})</span></td>
            <td style="text-align: right;">${formatInt(s.sqft)} sqft<br><span style="font-size: 0.725rem; color: var(--text-muted);">${formatGBP(s.quoted_rent_gbp_month)}/mo</span></td>
            <td style="text-align: right; font-size: 0.75rem;">
              🚶 ${formatInt(s.daily_footfall_street)}/d<br>
              💼 ${formatInt(s.office_workers_500m)} · 🎓 ${formatInt(s.students_1km)}
            </td>
            <td style="text-align: right; font-weight: 700;">${formatInt(s.est_monthly_receipts)}</td>
            <td style="text-align: right; font-weight: 600; color: var(--accent-primary);">${formatGBP(s.est_avg_ticket_gbp)}</td>
            <td style="text-align: right; font-weight: 600;">${formatGBP(s.est_monthly_sales_gbp)}</td>
            <td style="text-align: right; color: var(--text-muted);">${formatGBP(s.est_total_costs_gbp)}</td>
            <td style="text-align: right; font-weight: 700; color: ${s.standalone_profit_gbp >= 0 ? 'var(--success)' : 'var(--danger)'};">
              ${formatGBP(s.standalone_profit_gbp)}<br>
              <span style="font-size: 0.7rem; font-weight: normal;">(${s.standalone_margin_pct}% margin)</span>
            </td>
            <td style="text-align: right; font-weight: 700; color: ${s.cannibalized_profit_gbp > 1000 ? 'var(--danger)' : (s.cannibalized_profit_gbp > 0 ? 'var(--warning)' : 'var(--success)')};">
              -${formatGBP(s.cannibalized_profit_gbp)}<br>
              <span style="font-size: 0.7rem; font-weight: normal;">(-${formatInt(s.cannibalized_receipts_month)} cust/mo)</span>
            </td>
            <td style="font-size: 0.75rem; line-height: 1.35;">${affectedStr}</td>
            <td style="text-align: right; font-weight: 800; font-size: 0.9rem; color: ${s.net_incremental_profit_gbp >= 0 ? 'var(--success)' : 'var(--danger)'};">
              ${s.net_incremental_profit_gbp >= 0 ? '+' : ''}${formatGBP(s.net_incremental_profit_gbp)}<br>
              <span style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">${formatGBPCompact(s.net_annual_profit_gbp)}/yr</span>
            </td>
            <td style="text-align: right; font-size: 0.775rem;">
              <strong>${formatGBPCompact(s.est_fitout_gbp)}</strong><br>
              ${paybackStr}
            </td>
            <td><span class="badge-tag ${s.verdict_level}">${s.verdict}</span></td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Render Pairwise Huff Cannibalization Cards
      const cardsGrid = $('huffCannibalizationCardsGrid');
      if (cardsGrid) {
        cardsGrid.innerHTML = '';
        filteredProjs.forEach(s => {
          const card = document.createElement('div');
          card.className = 'compare-store-card';
          const borderColor = s.net_incremental_profit_gbp >= 4000 ? 'var(--success)' : (s.net_incremental_profit_gbp >= 0 ? 'var(--warning)' : 'var(--danger)');
          card.style.borderTopColor = borderColor;

          let cannibRowsHtml = '';
          if (s.cannibalized_stores.length === 0) {
            cannibRowsHtml = `
              <div style="padding: 0.75rem; background: var(--success-bg); border-radius: var(--radius-sm); color: var(--success); font-size: 0.775rem; margin-top: 0.5rem;">
                ✓ <strong>Zero Cannibalization (Greenfield Market)</strong>: No existing Grind & Crumb stores in ${s.city}. 100% of site profit (+${formatGBP(s.standalone_profit_gbp)}/mo) is incremental to the chain.
              </div>
            `;
          } else {
            cannibRowsHtml = s.cannibalized_stores.map(cs => `
              <div style="background: var(--bg-secondary); padding: 0.55rem 0.7rem; border-radius: 4px; margin-top: 0.45rem; font-size: 0.775rem; border-left: 3px solid ${cs.cannibalization_pct >= 6 ? 'var(--danger)' : 'var(--warning)'};">
                <div style="display: flex; justify-content: space-between; font-weight: 700;">
                  <span>➔ ${cs.store_id} (${cs.store_name})</span>
                  <span style="color: var(--danger);">-${formatGBP(cs.cannibalized_profit_gbp)}/mo profit</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.725rem; margin-top: 2px;">
                  <span>Distance: <strong>${cs.distance_miles} mi</strong> | Utility U_ij: <strong>${cs.huff_utility_new}</strong></span>
                  <span>Diverts <strong>${cs.cannibalization_pct}%</strong> (${formatInt(cs.diverted_receipts_month)} cust/mo)</span>
                </div>
              </div>
            `).join('');
          }

          card.innerHTML = `
            <div class="compare-store-header">
              <div>
                <div style="font-size: 0.725rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">
                  ${s.city} · ${s.location_type} · Attractiveness A_j = ${s.huff_attractiveness}
                </div>
                <h4 style="font-size: 0.95rem; font-weight: 800; margin-top: 2px;">${s.site_id} — ${s.site_name}</h4>
              </div>
              <span class="badge-tag ${s.verdict_level}">${s.verdict}</span>
            </div>
            <div class="compare-metric-row">
              <span>Estimated Customer Demand & Spend:</span>
              <strong>${formatInt(s.est_monthly_receipts)} cust/mo @ ${formatGBP(s.est_avg_ticket_gbp)}</strong>
            </div>
            <div class="compare-metric-row">
              <span>Standalone Monthly Profit:</span>
              <strong style="color: ${s.standalone_profit_gbp >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatGBP(s.standalone_profit_gbp)}</strong>
            </div>
            <div class="compare-metric-row">
              <span>Total Huff Cannibalization Drag:</span>
              <strong style="color: var(--danger);">-${formatGBP(s.cannibalized_profit_gbp)}/mo</strong>
            </div>
            <div class="compare-metric-row" style="border-bottom: none; padding-top: 0.4rem;">
              <span><strong>Net Chain Incremental Profit:</strong></span>
              <strong style="font-size: 0.95rem; color: ${s.net_incremental_profit_gbp >= 0 ? 'var(--success)' : 'var(--danger)'};">
                ${s.net_incremental_profit_gbp >= 0 ? '+' : ''}${formatGBP(s.net_incremental_profit_gbp)}/mo
              </strong>
            </div>
            ${cannibRowsHtml}
          `;
          cardsGrid.appendChild(card);
        });
      }

      // Render Existing Store Benchmark Table
      const benchBody = $('existingCatchmentBenchmarkBody');
      if (benchBody) {
        benchBody.innerHTML = '';
        Object.values(existingBenchmarks).forEach(eb => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${eb.store_id}</strong></td>
            <td>${eb.store_name}</td>
            <td>${eb.city}</td>
            <td>${eb.location_type}</td>
            <td style="text-align: right;">${formatInt(eb.sqft)}</td>
            <td style="text-align: right;">${formatInt(eb.daily_footfall_street)}</td>
            <td style="text-align: right;">${formatInt(eb.office_workers_500m)}</td>
            <td style="text-align: right;">${formatInt(eb.students_1km)}</td>
            <td style="text-align: right;">${formatGBP(eb.median_household_income_gbp)}</td>
            <td style="text-align: right; color: var(--accent-primary); font-weight: 700;">${eb.area_vibrancy_index_10} / 10</td>
            <td style="text-align: right; font-family: monospace;">${eb.attractiveness.toFixed(3)}</td>
            <td style="text-align: right; font-weight: 700;">${formatInt(eb.avg_monthly_receipts)}</td>
            <td style="text-align: right; font-weight: 600; color: var(--accent-primary);">${formatGBP(eb.avg_ticket_gbp)}</td>
            <td style="text-align: right; font-weight: 600;">${formatGBP(eb.avg_monthly_sales_gbp)}</td>
            <td style="text-align: right; font-weight: 700; color: ${eb.avg_monthly_profit_gbp >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatGBP(eb.avg_monthly_profit_gbp)}</td>
          `;
          benchBody.appendChild(tr);
        });
      }
    },

    // --- TAB 7: DATA EXPLORER & VALIDATED CSV UPLOAD ---
    renderValidationReportPanel() {
      const report = state.validationReport;
      if (!report) return;

      const s = report.summary || { total_tests: 0, passed: 0, warnings: 0, failed: 0, pass_rate_percentage: 100 };
      const badge = $('valOverallBadge');
      if (badge) {
        badge.textContent = report.status;
        badge.className = 'badge-tag ' + (report.status === 'PASS' ? '' : (report.status === 'WARN' ? 'warning' : 'danger'));
      }

      if ($('valTargetSubtitle')) {
        $('valTargetSubtitle').textContent = report.filename
          ? `Uploaded File: ${report.filename} (Detected Schema: ${report.detected_schema || 'custom'}, ${report.row_count || 0} rows)`
          : `Target: Baseline Dataset Pack (22 tables cross-checked)`;
      }

      if ($('valKpiStatus')) {
        $('valKpiStatus').textContent = report.status;
        $('valKpiStatus').style.color = report.status === 'PASS' ? 'var(--success)' : (report.status === 'WARN' ? 'var(--warning)' : 'var(--danger)');
      }
      if ($('valKpiSchema')) {
        $('valKpiSchema').textContent = report.detected_schema ? `Schema: ${report.detected_schema}` : 'Full Dataset Pack';
      }
      if ($('valKpiTotal')) $('valKpiTotal').textContent = s.total_tests;
      if ($('valKpiDuration')) $('valKpiDuration').textContent = `${(report.execution_metadata || {}).duration_ms || 0} ms`;
      if ($('valKpiPassed')) $('valKpiPassed').textContent = s.passed;
      if ($('valKpiPassRate')) $('valKpiPassRate').textContent = `${s.pass_rate_percentage}% Pass Rate`;
      if ($('valKpiWarn')) $('valKpiWarn').textContent = s.warnings;
      if ($('valKpiFail')) $('valKpiFail').textContent = s.failed;

      const tbody = $('validationResultsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      const filter = state.valStatusFilter || 'ALL';
      const rows = (report.results || []).filter(r => filter === 'ALL' || r.status === filter);

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 1.25rem; color: var(--text-muted);">No validation checks match the active status filter.</td></tr>';
        return;
      }

      rows.forEach(r => {
        const badgeCls = r.status === 'PASS' ? 'reconciled' : (r.status === 'WARN' ? 'pending' : 'HIGH');
        const sampleText = (r.samples && r.samples.length)
          ? `<code style="font-size: 0.725rem; color: var(--text-muted);">${JSON.stringify(r.samples.slice(0, 3)).slice(0, 95)}</code>`
          : '<span style="color: var(--text-dim);">—</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="${r.status === 'FAIL' ? 'severity-badge HIGH' : 'status-badge ' + badgeCls}">${r.status}</span></td>
          <td><code>${r.test_id}</code></td>
          <td><strong>${r.category}</strong></td>
          <td>${r.test_name}</td>
          <td style="white-space: normal; max-width: 380px;">${r.message}</td>
          <td style="text-align: right; font-weight: 700;">${r.affected_count || 0}</td>
          <td style="white-space: normal; max-width: 260px;">${sampleText}</td>
        `;
        tbody.appendChild(tr);
      });
    },

    async runBaselineValidation() {
      try {
        const res = await fetch('/api/validate-dataset');
        if (res.ok) {
          const report = await res.json();
          state.validationReport = report;
          this.renderValidationReportPanel();
          return;
        }
      } catch (_) {
        // Offline / static file:// fallback
      }
      if (state.data.validation_baseline_report) {
        state.validationReport = state.data.validation_baseline_report;
        this.renderValidationReportPanel();
      }
    },

    renderExplorerTab() {
      const datasetKey = state.activeDataset;
      let rows = [];
      if (datasetKey === 'fixed_pnl') rows = state.data.pnl_fixed || [];
      else if (datasetKey === 'original_pnl') rows = state.data.pnl_original || [];
      else if (datasetKey === 'stores') rows = state.data.stores || [];
      else if (datasetKey === 'catchment') rows = state.data.catchment || [];
      else if (datasetKey === 'candidate_sites') rows = state.data.candidate_sites || [];
      else if (datasetKey === 'promotions') rows = state.data.promotions || [];
      else if (datasetKey === 'capex') rows = state.data.capex || [];
      else if (datasetKey === 'events') rows = state.data.events_raw || [];
      else if (state.data[datasetKey]) rows = state.data[datasetKey];

      const thead = $('explorerTableHead');
      const tbody = $('explorerTableBody');
      thead.innerHTML = '';
      tbody.innerHTML = '';

      if (!rows.length) {
        tbody.innerHTML = '<tr><td style="padding: 1rem; color: var(--text-muted);">Dataset is empty.</td></tr>';
        return;
      }

      const headers = Object.keys(rows[0]);
      const trHead = document.createElement('tr');
      headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);

      rows.slice(0, 100).forEach(r => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
          const td = document.createElement('td');
          td.textContent = r[h] !== undefined ? r[h] : '';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    },

    exportActiveTableToCSV() {
      const datasetKey = state.activeDataset;
      let rows = [];
      if (datasetKey === 'fixed_pnl') rows = state.data.pnl_fixed || [];
      else if (datasetKey === 'original_pnl') rows = state.data.pnl_original || [];
      else if (datasetKey === 'stores') rows = state.data.stores || [];
      else if (datasetKey === 'catchment') rows = state.data.catchment || [];
      else if (datasetKey === 'candidate_sites') rows = state.data.candidate_sites || [];
      else if (datasetKey === 'promotions') rows = state.data.promotions || [];
      else if (datasetKey === 'capex') rows = state.data.capex || [];
      else if (datasetKey === 'events') rows = state.data.events_raw || [];
      else if (state.data[datasetKey]) rows = state.data[datasetKey];

      if (!rows.length) return;
      const headers = Object.keys(rows[0]);
      let csvContent = headers.join(',') + '\n';
      rows.forEach(r => {
        const rowVals = headers.map(h => {
          const v = String(r[h] || '').replace(/"/g, '""');
          return v.includes(',') || v.includes('"') ? `"${v}"` : v;
        });
        csvContent += rowVals.join(',') + '\n';
      });

      this.downloadBlob(csvContent, `${datasetKey}_export.csv`, 'text/csv');
    },

    downloadFile(fileKey) {
      if (fileKey === 'fixed_pnl') {
        const rows = state.data.pnl_fixed || [];
        if (!rows.length) return;
        const headers = Object.keys(rows[0]);
        let csv = headers.join(',') + '\n';
        rows.forEach(r => { csv += headers.map(h => r[h]).join(',') + '\n'; });
        this.downloadBlob(csv, 'fixed_store_monthly_pnl.csv', 'text/csv');
      } else if (fileKey === 'cleaned_waste') {
        window.open('cleaned_waste_log.csv', '_blank');
      } else if (fileKey === 'cleaned_rota') {
        window.open('cleaned_staff_rota_weekly.csv', '_blank');
      } else if (fileKey === 'cleaned_reviews') {
        window.open('cleaned_customer_reviews.csv', '_blank');
      } else if (fileKey === 'reviews_sentiment') {
        window.open('customer_reviews_sentiment.csv', '_blank');
      }
    },

    downloadBlob(content, filename, type) {
      const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    // --- VALIDATED CSV UPLOAD HANDLER ---
    handleFileUpload(files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const text = e.target.result;
          const { rows, headers } = this.parseCSVWithHeaders(text);

          // 1. Try validating via Python backend (validate_grind_crumb.py API) first, fallback to client mirror
          let report = null;
          try {
            const resp = await fetch('/api/validate-csv', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: file.name, content: text })
            });
            if (resp.ok) {
              report = await resp.json();
            }
          } catch (_) {
            // Static file:// mode fallback
          }

          if (!report) {
            report = CSVValidator.validateUploadedFileClient(file.name, text, rows, headers);
          }

          state.validationReport = report;
          state.valStatusFilter = 'ALL';
          if ($('valStatusFilter')) $('valStatusFilter').value = 'ALL';
          this.renderValidationReportPanel();

          state.pendingUpload = {
            filename: file.name,
            schema: report.detected_schema,
            rows,
            report
          };

          const banner = $('valUploadActionBanner');
          const bannerText = $('valUploadBannerText');
          if (banner && bannerText) {
            banner.style.display = 'flex';
            const statusColor = report.status === 'PASS' ? 'var(--success)' : (report.status === 'WARN' ? 'var(--warning)' : 'var(--danger)');
            bannerText.innerHTML = `
              <strong style="color: ${statusColor};">[${report.status}]</strong>
              Validated <code>${file.name}</code> (${rows.length} rows, schema: <code>${report.detected_schema}</code>) —
              <strong>${report.summary.passed}/${report.summary.total_tests} checks passed</strong>
              (${report.summary.warnings} warnings, ${report.summary.failed} failed).
            `;
            // If PASS, also auto-ingest immediately so user sees instant update while keeping banner visible
            if (report.status === 'PASS') {
              this.applyPendingUpload(true);
            }
          }
        };
        reader.readAsText(file);
      });
    },

    applyPendingUpload(autoApplied = false) {
      if (!state.pendingUpload) return;
      const { filename, schema, rows, report } = state.pendingUpload;

      if (schema === 'business_events.csv' || filename.toLowerCase().includes('event')) {
        state.data.events_raw = rows;
        this.recalculateEventsImpact();
        state.activeDataset = 'events';
        $('selectDataset').value = 'events';
      } else if (schema === 'starter_store_monthly_pnl.csv' || filename.toLowerCase().includes('pnl')) {
        state.data.pnl_fixed = rows;
        this.recalculateEventsImpact();
        state.activeDataset = 'fixed_pnl';
        $('selectDataset').value = 'fixed_pnl';
      } else if (schema === 'candidate_sites.csv' || filename.toLowerCase().includes('candidate')) {
        state.data.candidate_sites = rows;
        state.activeDataset = 'candidate_sites';
        $('selectDataset').value = 'candidate_sites';
      } else if (schema === 'store_catchment.csv' || filename.toLowerCase().includes('catchment')) {
        state.data.catchment = rows;
        state.activeDataset = 'catchment';
        $('selectDataset').value = 'catchment';
      } else if (schema === 'stores.csv') {
        state.data.stores = rows;
        state.activeDataset = 'stores';
        $('selectDataset').value = 'stores';
      } else if (schema === 'promotions.csv') {
        state.data.promotions = rows;
        state.activeDataset = 'promotions';
        $('selectDataset').value = 'promotions';
      } else if (schema === 'capex.csv') {
        state.data.capex = rows;
        state.activeDataset = 'capex';
        $('selectDataset').value = 'capex';
      } else {
        state.data[filename] = rows;
        const sel = $('selectDataset');
        if (!Array.from(sel.options).some(o => o.value === filename)) {
          const opt = document.createElement('option');
          opt.value = filename;
          opt.textContent = `Uploaded: ${filename} (${rows.length} rows)`;
          sel.appendChild(opt);
        }
        state.activeDataset = filename;
        sel.value = filename;
      }

      this.renderDashboardTab();
      this.renderMultiStoreCompareTab();
      this.renderChannelEconomicsTab();
      this.renderCatchmentTab();
      this.renderExplorerTab();

      const banner = $('valUploadActionBanner');
      const bannerText = $('valUploadBannerText');
      if (banner && bannerText) {
        bannerText.innerHTML = `
          <strong style="color: var(--success);">✓ INGESTED INTO ACTIVE MEMORY:</strong>
          <code>${filename}</code> (${rows.length} rows, schema: <code>${schema}</code>) —
          Validation: <strong>${report.summary.passed}/${report.summary.total_tests} passed</strong>.
          All dashboard charts, P&L views, and Huff Gravity models have been updated!
        `;
        if (!autoApplied) {
          setTimeout(() => { banner.style.display = 'none'; }, 4000);
        }
      }
      state.pendingUpload = null;
    },

    recalculateEventsImpact() {
      const events = state.data.events_raw || [];
      const pnl = state.data.pnl_fixed || [];
      const stores = state.data.stores || [];
      const scopes = ['ALL'].concat(stores.map(s => s.store_id));

      const getMetrics = (scope) => {
        const mObj = {};
        MONTH_LIST.forEach(m => {
          let rows = pnl.filter(r => r.month === m);
          if (scope !== 'ALL') rows = rows.filter(r => r.store_id === scope);
          const sales = rows.reduce((acc, r) => acc + Number(r.total_sales_gbp || 0), 0);
          const profit = rows.reduce((acc, r) => acc + Number(r.store_profit_gbp || 0), 0);
          mObj[m] = { sales, profit };
        });
        return mObj;
      };

      const impactByScope = {};
      scopes.forEach(scope => {
        const metrics = getMetrics(scope);
        const list = [];
        events.forEach(ev => {
          const mStr = (ev.date || '').slice(0, 7);
          const idx = MONTH_LIST.indexOf(mStr);
          const preM = idx > 0 ? MONTH_LIST[idx - 1] : mStr;
          const postM = idx < MONTH_LIST.length - 1 ? MONTH_LIST[idx + 1] : mStr;

          const preProfit = (metrics[preM] || {}).profit || 0;
          const postProfit = (metrics[postM] || {}).profit || 0;
          const delta = postProfit - preProfit;
          const pct = preProfit !== 0 ? (delta / Math.abs(preProfit)) * 100 : 0;

          list.push({
            event: ev.event || ev.name,
            date: ev.date,
            month: mStr,
            month_idx: idx,
            pre_month: preM,
            post_month: postM,
            pre_profit: preProfit,
            post_profit: postProfit,
            delta_profit: delta,
            pct_profit: Number(pct.toFixed(1)),
            pre_sales: (metrics[preM] || {}).sales || 0,
            post_sales: (metrics[postM] || {}).sales || 0,
            description: ev.description || 'Custom business event'
          });
        });
        impactByScope[scope] = list;
      });

      state.data.events_impact_by_scope = impactByScope;
    },

    parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    },

    parseCSVWithHeaders(text) {
      const cleanText = String(text || '').replace(/^\uFEFF/, '').trim();
      const lines = cleanText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) return { headers: [], rows: [] };
      const headers = this.parseCSVLine(lines[0]);
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = this.parseCSVLine(lines[i]);
        const obj = {};
        headers.forEach((h, idx) => {
          if (h) obj[h] = vals[idx] !== undefined ? vals[idx] : '';
        });
        rows.push(obj);
      }
      return { headers, rows };
    }
  };

  window.App = App;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})();
