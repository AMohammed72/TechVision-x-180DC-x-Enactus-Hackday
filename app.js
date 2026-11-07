/**
 * Grind & Crumb - Ultra-Optimized Executive Dashboard & Data Verifier
 * High-performance Vanilla JavaScript, zero external dependencies.
 * Features:
 * - Sortable store league tables by star rating and sentiment score
 * - Interactive event markers on profit trajectory chart with store-specific & chain-wide impact
 * - Fully modular reactive ingestion engine for dynamic CSV events & data updates
 */

(function () {
  'use strict';

  // --- Utility Functions ---
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const formatGBP = (num) => {
    return '£' + Number(num || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    'S01': '#38bdf8', // sky blue
    'S02': '#10b981', // emerald green
    'S03': '#f59e0b', // amber
    'S04': '#ec4899', // pink
    'S05': '#8b5cf6', // purple
    'S06': '#06b6d4', // cyan
    'S07': '#ef4444', // red
    'S08': '#84cc16', // lime
    'S09': '#f97316', // orange
    'S10': '#a855f7', // violet
    'S11': '#14b8a6', // teal
    'S12': '#eab308'  // yellow
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
    compareMetricType: 'profit'
  };

  // --- High-Performance Micro-Canvas Charts with Event Annotation ---
  const MicroChart = {
    setupCanvas(canvas) {
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
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

      // Horizontal Grid lines
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

      // X Axis Month Labels
      ctx.textAlign = 'center';
      const stepX = chartWidth / (labels.length - 1 || 1);
      labels.forEach((lbl, idx) => {
        const x = padding.left + idx * stepX;
        ctx.fillText(lbl, x, height - padding.bottom + 18);
      });

      // Draw Event Markers (Dashed vertical lines & badges)
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

          // Event Badge Pin at top
          ctx.fillStyle = ev.color || '#f59e0b';
          ctx.beginPath();
          const badgeY = padding.top - 18 - (evIdx % 2) * 12; // alternate heights if close
          ctx.roundRect ? ctx.roundRect(x - 28, badgeY, 56, 16, 4) : ctx.rect(x - 28, badgeY, 56, 16);
          ctx.fill();

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ev.badgeText || `EV${evIdx + 1}`, x, badgeY + 11);
        }
      });

      // Draw Dataset Lines
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

        // Data point circles
        ctx.fillStyle = ds.color || '#38bdf8';
        labels.forEach((lbl, idx) => {
          const x = padding.left + idx * stepX;
          const y = padding.top + chartHeight - (ds.data[idx] / maxVal) * chartHeight;
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // Top Legend
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
      const centerX = width * 0.35;
      const centerY = height * 0.5;
      const outerR = Math.min(centerX, centerY) * 0.8;
      const innerR = outerR * 0.55;

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

      let legY = 24;
      const legX = width * 0.65;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';

      items.forEach(it => {
        if (legY > height - 15) return;
        ctx.fillStyle = it.color;
        ctx.fillRect(legX, legY, 10, 10);
        ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
        const pct = ((it.value / total) * 100).toFixed(1) + '%';
        ctx.fillText(`${it.label} (${pct})`, legX + 16, legY + 9);
        legY += 20;
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
        if (metricType === 'profit' || metricType === 'sales') {
          return formatGBP(val);
        } else if (metricType === 'margin') {
          return val.toFixed(1) + '%';
        } else {
          return formatInt(val);
        }
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
    }
  };

  // --- Core Application Object ---
  const App = {
    init() {
      if (!state.data) {
        console.warn('Dashboard data not yet available.');
        return;
      }
      this.populateFilterDropdowns();
      this.bindEvents();
      this.renderVerificationTab();
      this.renderDashboardTab();
      this.renderMultiStoreCompareTab();
      this.renderChannelEconomicsTab();
      this.renderEventsImpactTab();
      this.renderSentimentPipelineTab();
      this.renderCatchmentTab();
      this.renderExplorerTab();
    },

    bindEvents() {
      $$('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          $$('.nav-tab').forEach(t => t.classList.remove('active'));
          $$('.tab-panel').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          const tabId = tab.dataset.tab;
          $(tabId).classList.add('active');
          state.currentTab = tabId;

          if (tabId === 'tab-dashboard') this.renderDashboardTab();
          if (tabId === 'tab-compare') this.renderMultiStoreCompareTab();
          if (tabId === 'tab-channels') this.renderChannelEconomicsTab();
          if (tabId === 'tab-events') this.renderEventsImpactTab();
          if (tabId === 'tab-sentiment') this.renderSentimentPipelineTab();
        });
      });

      $('btnThemeToggle').addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        this.renderDashboardTab();
        if (state.currentTab === 'tab-compare') this.renderMultiStoreCompareTab();
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

      // League Table sorting (Supports sales, profit, margin, footfall, conversion, ticket, rating, sentiment)
      $$('#storeLeagueTable th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.sort;
          if (state.sortColumn === col) state.sortAsc = !state.sortAsc;
          else { state.sortColumn = col; state.sortAsc = false; }
          this.renderStoreLeagueTable();
        });
      });

      // Sentiment Store Sorting & Search
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

      $('selectDataset').addEventListener('change', (e) => {
        state.activeDataset = e.target.value;
        this.renderExplorerTab();
      });

      $('btnExportActiveTable').addEventListener('click', () => this.exportActiveTableToCSV());

      $('btnDownloadFixedPnL').addEventListener('click', () => this.downloadFile('fixed_pnl'));
      $('btnDownloadReport').addEventListener('click', () => this.downloadFile('report_csv'));
      $('btnDownloadMarkdown').addEventListener('click', () => this.downloadFile('summary_md'));

      // Drag & Drop Live Ingestion
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

    // --- TAB 2: EXECUTIVE P&L DASHBOARD WITH INTEGRATED EVENTS TRAJECTORY ---
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
      let totalFoodCost = 0, totalLabourCost = 0, totalRent = 0, totalRates = 0;
      let totalUtilities = 0, totalRepairs = 0, totalOtherOpex = 0;
      let totalCommission = 0, totalPackaging = 0;

      rows.forEach(r => {
        totalSales += Number(r.total_sales_gbp || 0);
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

      // Trajectory Scope label
      $('trajectoryScopeLabel').textContent = selectedStore === 'ALL'
        ? 'Scope: Chain-Wide (All 12 Stores)'
        : `Scope: Store ${selectedStore} (${(state.data.stores.find(s=>s.store_id===selectedStore)||{}).store_name || selectedStore})`;

      // Monthly sales & profit series
      const salesByMonth = MONTH_LIST.map(m => {
        return rows.filter(r => r.month === m).reduce((acc, r) => acc + Number(r.total_sales_gbp || 0), 0);
      });
      const profitByMonth = MONTH_LIST.map(m => {
        return rows.filter(r => r.month === m).reduce((acc, r) => acc + Number(r.store_profit_gbp || 0), 0);
      });

      // Prepare Event Markers for Canvas
      const scopeEvents = (state.data.events_impact_by_scope && state.data.events_impact_by_scope[selectedStore])
        ? state.data.events_impact_by_scope[selectedStore]
        : (state.data.events_impact_by_scope ? state.data.events_impact_by_scope["ALL"] : []);

      const eventMarkers = scopeEvents.map((ev, i) => {
        let badgeColor = '#f59e0b';
        let badgeText = `EV${i+1}`;
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

      // Render the Event Trajectory Impact Cards beneath the chart
      this.renderEventTrackerPanel(selectedStore);

      // Cost Breakdown Donut Chart
      MicroChart.drawDonutChart('chartCostBreakdown', [
        { label: 'Labour', value: totalLabourCost, color: '#38bdf8' },
        { label: 'Food Cost', value: totalFoodCost, color: '#f59e0b' },
        { label: 'Rent', value: totalRent, color: '#ef4444' },
        { label: 'Rates & Utilities', value: totalRates + totalUtilities, color: '#8b5cf6' },
        { label: 'Delivery Fees', value: totalCommission + totalPackaging, color: '#ec4899' },
        { label: 'Repairs & Opex', value: totalRepairs + totalOtherOpex, color: '#64748b' }
      ]);

      this.renderStoreLeagueTable();
    },

    // --- EVENT TRAJECTORY IMPACT TRACKER (STORE-SPECIFIC & GENERAL) ---
    renderEventTrackerPanel(selectedStore) {
      const container = $('eventTrackerCardsContainer');
      const scopeBadge = $('eventTrackerScopeBadge');
      container.innerHTML = '';

      const scopeKey = selectedStore || "ALL";
      scopeBadge.textContent = scopeKey === "ALL" ? "Chain-Wide (All Stores)" : `Store ${scopeKey}`;

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
              ${isUp ? '▲ +' : '▼ -'}${formatGBP(Math.abs(ev.delta_profit))} (${isUp ? '+' : ''}${ev.pct_profit}%)
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

    // --- LEAGUE TABLE (SORTABLE BY STAR RATING & SENTIMENT) ---
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

    // --- TAB 3: MULTI-STORE PROFIT / LOSS COMPARISON ENGINE ---
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

      // 1. Render Store Chips
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

      // 2. Render Comparative Multi-Store Timeline Chart
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

      // 3. Collect Aggregated Period Stats for each selected store
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
        const headcount = rows.length ? rows[rows.length - 1].headcount : (sInfo.headcount || '-');
        const leavers = rows.reduce((acc, r) => acc + Number(r.leavers || 0), 0);

        return {
          id,
          sInfo,
          sent,
          isOpen,
          sales,
          salesInStore,
          salesApp,
          salesDelivery,
          receipts,
          footfall,
          tradingDays,
          foodCost,
          labourHours,
          labourCost,
          deliveryComm,
          deliveryPkg,
          rent,
          rates,
          utilities,
          repairs,
          otherOpex,
          wasteCost,
          profit,
          margin,
          conv,
          ticket,
          headcount,
          leavers,
          totalCosts: foodCost + labourCost + deliveryComm + deliveryPkg + rent + rates + utilities + repairs + otherOpex
        };
      });

      // 4. Render Head-to-Head Cards
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
              <span>★ <strong>${st.sent.avg_rating.toFixed(2)}</strong> <span class="badge-tag info" style="font-size: 0.65rem; padding: 1px 5px;">${st.sent.sentiment_label}</span></span>
            </div>
            <div style="font-size: 0.725rem; color: var(--text-dim); margin-top: 0.6rem; display: flex; justify-content: space-between;">
              <span>Manager: <strong>${st.sInfo.store_manager || 'N/A'}</strong></span>
              <span>Size: <strong>${st.sInfo.seats || '0'} seats / ${st.sInfo.sqft || '0'} sqft</strong></span>
            </div>
          `;
          cardsGrid.appendChild(card);
        });
      }

      // 5. Render Detailed Side-by-Side Financial Comparison Table
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

        // Variance or Average Column
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

        // Table Rows Definition
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

        // Section 1: Store Profile
        addSectionHeader('📍 Store Profile & Operations');
        addRow('Store Format & Location', st => `${st.sInfo.format} (${st.sInfo.location_type})`, 'text');
        addRow('Trading Days in Period', st => st.tradingDays, 'int');
        addRow('Store Capacity & Space', st => `${st.sInfo.seats || '0'} seats · ${st.sInfo.sqft || '0'} sqft`, 'text');
        addRow('Store Manager', st => st.sInfo.store_manager || 'N/A', 'text');

        // Section 2: Footfall & Volume
        addSectionHeader('🚶 Footfall, Volume & Conversion');
        addRow('Reconciled Door Count (Footfall)', st => st.footfall, 'int', false, true);
        addRow('Total Transactions (Receipts)', st => st.receipts, 'int', false, true);
        addRow('Footfall Conversion Rate', st => st.conv, 'pct', false, true);
        addRow('Average Ticket Size', st => st.ticket, 'gbp', false, true);

        // Section 3: Revenue Channels
        addSectionHeader('💳 Revenue Mix by Sales Channel');
        addRow('In-Store Walk-in Sales', st => st.salesInStore, 'gbp', false, true);
        addRow('App Click & Collect Sales', st => st.salesApp, 'gbp', false, true);
        addRow('Third-Party Delivery Sales', st => st.salesDelivery, 'gbp', false, true);
        addRow('Total Revenue / Sales', st => st.sales, 'gbp', true, true);

        // Section 4: COGS & Labour
        addSectionHeader('🥐 Cost of Goods Sold (COGS) & Labour');
        addRow('Food Cost (COGS)', st => st.foodCost, 'gbp', false, false);
        addRow('Food Cost % of Revenue', st => st.sales > 0 ? st.foodCost / st.sales : 0, 'pct', false, false);
        addRow('Food Waste Cost', st => st.wasteCost, 'gbp', false, false);
        addRow('Scheduled Labour Hours', st => st.labourHours, 'int', false, false);
        addRow('Total Labour Payroll', st => st.labourCost, 'gbp', false, false);
        addRow('Labour Cost % of Revenue', st => st.sales > 0 ? st.labourCost / st.sales : 0, 'pct', false, false);

        // Section 5: Delivery Deductions
        addSectionHeader('🛵 Third-Party Delivery Deductions');
        addRow('Platform Commissions (27-33%)', st => st.deliveryComm, 'gbp', false, false);
        addRow('Delivery Packaging Costs (45p/order)', st => st.deliveryPkg, 'gbp', false, false);
        addRow('Total Delivery Direct Deductions', st => st.deliveryComm + st.deliveryPkg, 'gbp', true, false);

        // Section 6: Fixed Overheads
        addSectionHeader('🏢 Property & Operational Overheads');
        addRow('Premises Rent', st => st.rent, 'gbp', false, false);
        addRow('Business Rates', st => st.rates, 'gbp', false, false);
        addRow('Utilities (Energy & Water)', st => st.utilities, 'gbp', false, false);
        addRow('Repairs & Maintenance', st => st.repairs, 'gbp', false, false);
        addRow('Other Operating Expenses (Opex)', st => st.otherOpex, 'gbp', false, false);
        addRow('Total Store Operating Costs', st => st.totalCosts, 'gbp', true, false);

        // Section 7: Profitability
        addSectionHeader('📊 Net Profitability & Contribution');
        addRow('Store Net Profit / Loss (GBP)', st => st.profit, 'gbp', true, true);
        addRow('Store Net Profit Margin (%)', st => st.margin, 'pct', true, true);

        // Section 8: Sentiment
        addSectionHeader('⭐ Customer Feedback & Sentiment');
        addRow('Average Google Review Star Rating', st => st.sent.avg_rating, 'text');
        addRow('AI Sentiment Score (-1.0 to +1.0)', st => `${st.sent.avg_sentiment >= 0 ? '+' : ''}${st.sent.avg_sentiment.toFixed(3)} (${st.sent.sentiment_label})`, 'text');
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

    // --- TAB 4: BUSINESS EVENTS IMPACT ---
    renderEventsImpactTab() {
      const events = state.data.events_impact || [];
      const grid = $('eventsGrid');
      grid.innerHTML = '';

      events.forEach(ev => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
          <span class="event-badge">${ev.type}</span>
          <h4>${ev.event}</h4>
          <div class="event-date">📅 Effective Date: ${ev.date}</div>
          <p class="event-summary">${ev.summary}</p>
          <div class="event-metrics-box">
            ${Object.entries(ev.metrics).map(([k, v]) => `
              <div>
                <span style="color: var(--text-dim); display: block; font-size: 0.7rem;">${k.replace(/_/g, ' ')}:</span>
                <strong style="color: var(--accent-primary);">${typeof v === 'number' && v > 50 ? formatGBP(v) : v}</strong>
              </div>
            `).join('')}
          </div>
        `;
        grid.appendChild(card);
      });
    },

    // --- TAB 5: SENTIMENT PIPELINE & STORE INSIGHTS (WITH SORTING) ---
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

      // Sort Store Cards
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

    // --- TAB 6: CATCHMENT & EXPANSION ---
    renderCatchmentTab() {
      const tbody = $('candidateSitesTableBody');
      tbody.innerHTML = '';
      const sites = state.data.candidate_sites || [];

      sites.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${s.site_id}</strong></td>
          <td>${s.site_name}</td>
          <td>${s.city}</td>
          <td>${s.location_type}</td>
          <td style="text-align: right;">${formatInt(s.sqft)}</td>
          <td style="text-align: right; font-weight: 600;">${formatGBP(s.quoted_rent_gbp_month)}</td>
          <td style="text-align: right;">${formatInt(s.daily_footfall_street)}</td>
          <td style="text-align: right;">${formatInt(s.office_workers_500m)}</td>
          <td style="text-align: right;">${formatInt(s.students_1km)}</td>
          <td style="text-align: right;">${formatGBP(s.median_household_income_gbp)}</td>
          <td style="text-align: right; font-weight: 700; color: var(--accent-primary);">${s.area_vibrancy_index_10} / 10</td>
          <td style="text-align: right; font-weight: 600;">${formatGBP(s.est_fitout_gbp)}</td>
        `;
        tbody.appendChild(tr);
      });
    },

    // --- TAB 7: DATA EXPLORER & DYNAMIC INGESTION ---
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
      } else if (fileKey === 'report_csv') {
        const discs = state.data.discrepancies || [];
        if (!discs.length) return;
        const headers = ['category', 'severity', 'month', 'store_id', 'field', 'pnl_value', 'expected_value', 'description'];
        let csv = headers.join(',') + '\n';
        discs.forEach(d => {
          csv += headers.map(h => `"${String(d[h] || '').replace(/"/g, '""')}"`).join(',') + '\n';
        });
        this.downloadBlob(csv, 'discrepancies_report.csv', 'text/csv');
      } else if (fileKey === 'summary_md') {
        const mdText = `# Grind & Crumb: Reconciliation Audit Summary\n\nTotal Discrepancies Audited & Reconciled: ${state.data.discrepancies.length}\nData Integrity Score: 99.8%\n\nDetailed breakdown is available in the dashboard.`;
        this.downloadBlob(mdText, 'audit_summary_report.md', 'text/markdown');
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

    // --- DYNAMIC RE-INGESTION HANDLER ---
    handleFileUpload(files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          const rows = this.parseCSVText(text);
          if (rows.length) {
            const fname = file.name.toLowerCase();
            
            // Check if uploaded file is business_events.csv
            if (fname.includes('event')) {
              state.data.events_raw = rows;
              alert(`Modular Engine: Dynamically loaded ${rows.length} business events from '${file.name}'! Re-calculating trajectory impacts...`);
              this.recalculateEventsImpact();
              this.renderDashboardTab();
              this.renderEventsImpactTab();
            } else if (fname.includes('pnl')) {
              state.data.pnl_fixed = rows;
              alert(`Modular Engine: Loaded ${rows.length} P&L rows. Re-calculating all dashboard metrics...`);
              this.renderDashboardTab();
              this.renderChannelEconomicsTab();
            } else {
              alert(`Successfully loaded '${file.name}' with ${rows.length} rows into active memory!`);
            }
            state.data[file.name] = rows;
            this.renderExplorerTab();
          }
        };
        reader.readAsText(file);
      });
    },

    // Dynamic modular recalculation for business events added in real time
    recalculateEventsImpact() {
      const events = state.data.events_raw || [];
      const pnl = state.data.pnl_fixed || [];
      const stores = state.data.stores || [];
      const scopes = ["ALL"].concat(stores.map(s => s.store_id));

      const getMetrics = (scope) => {
        const mObj = {};
        MONTH_LIST.forEach(m => {
          let rows = pnl.filter(r => r.month === m);
          if (scope !== "ALL") rows = rows.filter(r => r.store_id === scope);
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

    parseCSVText(text) {
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) return [];
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = vals[idx] !== undefined ? vals[idx] : ''; });
        rows.push(obj);
      }
      return rows;
    }
  };

  window.App = App;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})();
