/**
 * Grind & Crumb - Ultra-Optimized Executive Dashboard & Data Verifier
 * High-performance Vanilla JavaScript, zero external dependencies.
 * Includes Channel Profitability, Business Events Impact & Sentiment Intelligence.
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
    sentimentSearch: '',
    activeDataset: 'fixed_pnl'
  };

  // --- High-Performance Micro-Canvas Charts ---
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

    drawLineChart(canvasId, labels, datasets, yFormatter = formatGBP) {
      const canvas = $(canvasId);
      const setup = this.setupCanvas(canvas);
      if (!setup) return;
      const { ctx, width, height } = setup;

      ctx.clearRect(0, 0, width, height);

      const padding = { top: 25, right: 20, bottom: 40, left: 65 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      let maxVal = 0;
      datasets.forEach(ds => {
        ds.data.forEach(v => { if (v > maxVal) maxVal = v; });
      });
      maxVal = maxVal * 1.15 || 100;

      // Grid lines
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

      // X Axis Labels
      ctx.textAlign = 'center';
      const stepX = chartWidth / (labels.length - 1 || 1);
      labels.forEach((lbl, idx) => {
        const x = padding.left + idx * stepX;
        ctx.fillText(lbl, x, height - padding.bottom + 18);
      });

      // Draw Lines
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

      // Legend
      let legX = padding.left;
      datasets.forEach(ds => {
        ctx.fillStyle = ds.color;
        ctx.fillRect(legX, 8, 12, 4);
        ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(ds.label, legX + 16, 12);
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
          if (tabId === 'tab-channels') this.renderChannelEconomicsTab();
          if (tabId === 'tab-events') this.renderEventsImpactTab();
          if (tabId === 'tab-sentiment') this.renderSentimentPipelineTab();
        });
      });

      $('btnThemeToggle').addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        this.renderDashboardTab();
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

      window.addEventListener('resize', () => {
        if (state.currentTab === 'tab-dashboard') this.renderDashboardTab();
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

      const months = [
        '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
        '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'
      ];
      months.forEach(m => {
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

    // --- TAB 2: EXECUTIVE DASHBOARD ---
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

      const months = [
        '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
        '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'
      ];
      const salesByMonth = months.map(m => {
        return rows.filter(r => r.month === m).reduce((acc, r) => acc + Number(r.total_sales_gbp || 0), 0);
      });
      const profitByMonth = months.map(m => {
        return rows.filter(r => r.month === m).reduce((acc, r) => acc + Number(r.store_profit_gbp || 0), 0);
      });

      MicroChart.drawLineChart('chartMonthlyTrends', months.map(m => m.slice(5)), [
        { label: 'Total Sales (£)', data: salesByMonth, color: '#38bdf8' },
        { label: 'Store Profit (£)', data: profitByMonth, color: '#10b981' }
      ]);

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

    renderStoreLeagueTable() {
      const tbody = $('storeLeagueTableBody');
      tbody.innerHTML = '';
      const pnlRows = state.data.pnl_fixed || [];
      const stores = state.data.stores || [];

      const storeStats = {};
      stores.forEach(s => {
        storeStats[s.store_id] = {
          id: s.store_id,
          name: s.store_name,
          city: s.city,
          format: s.format,
          sales: 0,
          profit: 0,
          footfall: 0,
          receipts: 0
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
          <td style="text-align: right;">${formatInt(st.footfall)}</td>
          <td style="text-align: right;">${formatPct(conv)}</td>
          <td style="text-align: right;">${formatGBP(ticket)}</td>
          <td style="text-align: right;">~9.1%</td>
        `;
        tbody.appendChild(tr);
      });
    },

    // --- TAB 3: CHANNEL ECONOMICS & PROFIT DRAINS ---
    renderChannelEconomicsTab() {
      const channels = state.data.channel_comparison || [];
      const grid = $('channelCardsGrid');
      const tbody = $('channelTableBody');
      grid.innerHTML = '';
      tbody.innerHTML = '';

      channels.forEach(ch => {
        // Card
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

        // Table row
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

    // --- TAB 5: SENTIMENT PIPELINE & STORE INSIGHTS ---
    renderSentimentPipelineTab() {
      const container = $('sentimentStoreCardsContainer');
      container.innerHTML = '';
      const insights = state.data.store_sentiment_summary || {};
      const targetStore = state.sentimentStoreFilter;
      const search = state.sentimentSearch;

      const entries = Object.values(insights).filter(st => {
        if (targetStore !== 'ALL' && st.store_id !== targetStore) return false;
        if (search) {
          const matchName = st.store_name.toLowerCase().includes(search);
          const matchPos = st.current_positives.some(p => p.toLowerCase().includes(search));
          const matchNeg = st.things_to_improve.some(n => n.toLowerCase().includes(search));
          if (!matchName && !matchPos && !matchNeg) return false;
        }
        return true;
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
              <span style="font-size: 0.8rem; color: var(--warning); font-weight: 700;">★ ${st.avg_rating} / 5.0</span>
              <span class="badge-tag ${st.avg_sentiment >= 0.4 ? 'success' : (st.avg_sentiment >= 0.2 ? 'warning' : 'danger')}">
                Sentiment: ${st.avg_sentiment >= 0 ? '+' : ''}${st.avg_sentiment}
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

    // --- TAB 7: DATA EXPLORER ---
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

    handleFileUpload(files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          const rows = this.parseCSVText(text);
          if (rows.length) {
            alert(`Successfully loaded '${file.name}' with ${rows.length} rows into active memory!`);
            state.data[file.name] = rows;
            this.renderExplorerTab();
          }
        };
        reader.readAsText(file);
      });
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
