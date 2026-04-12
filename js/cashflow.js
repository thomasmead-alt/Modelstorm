const CashFlow = {

  renderProjectPicker() {
    const data = Storage.load();
    const app = document.getElementById('app');

    if (!data.projects.length) {
      app.innerHTML = `
        <div class="view-header">
          <div><h1 class="view-title">Cash Flow Mapper</h1></div>
        </div>
        <div class="empty-state">
          <h2 class="empty-title">No projects yet</h2>
          <p class="empty-desc">Create a project and define some measures first.</p>
          <button class="btn btn-primary" onclick="Router.navigate('projects')">Go to Projects</button>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Cash Flow Mapper</h1>
          <p class="view-subtitle">Map your measures to Cash Flow Statement lines across all projects</p>
        </div>
      </div>
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>What is Cash Flow Mapping?</strong> Each <em>How many</em> measure in your BEAM matrix can be
        assigned to a line on the Cash Flow Statement — Operating, Investing, or Financing activities.
        This reveals whether your data model supports cash flow reporting alongside P&amp;L.
        <br><strong>Cash Basis</strong> measures reflect actual cash timing.
        <strong>Accruals-based</strong> measures may need working capital adjustment to reconcile to cash.
      </div>
      <div class="project-picker">
        <h3 style="margin:0 0 12px">Select a project</h3>
        <div class="card-grid">
          ${data.projects.map(p => {
            const measures = p.events.flatMap(e => e.columns.filter(c => c.category === 'how_many'));
            const mapped = measures.filter(c => c.cashFlowLineId).length;
            const pct = measures.length ? Math.round(mapped / measures.length * 100) : 0;
            return `
              <div class="card" style="cursor:pointer" onclick="Router.navigate('cashflow/${p.id}')">
                <div class="card-body">
                  <h3 class="card-title">${this._esc(p.name)}</h3>
                  <div class="card-meta">
                    <span>${measures.length} measure${measures.length !== 1 ? 's' : ''}</span>
                    <span>${mapped} CF-mapped (${pct}%)</span>
                  </div>
                  <div class="pl-coverage-bar" style="margin-top:8px">
                    <div class="pl-coverage-fill" style="width:${pct}%"></div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  render(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('cashflow'); return; }

    const cfLines = Storage.getCashFlowLines(projectId);
    const allMeasures = project.events.flatMap(e =>
      e.columns.filter(c => c.category === 'how_many').map(c => ({ ...c, _eventId: e.id, _eventName: e.name }))
    );

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#cashflow">Cash Flow Mapper</a>
          <span class="bc-sep">›</span>
          <span>${this._esc(project.name)}</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('cashflow-coverage/${project.id}')">📊 Coverage &amp; Reconciliation</button>
        </div>
      </div>

      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        Map your measures to Cash Flow Statement lines. This shows whether your data model supports
        cash flow reporting alongside P&amp;L. Measures marked as <strong>Cash Basis</strong> reflect
        actual cash timing; unmarked measures are accruals-based and may need working capital adjustment
        to reconcile to cash.
        <br><span style="color:var(--text-muted);font-size:12px">
          Additive types: <span class="additive-badge additive-fa">FA</span> Fully Additive &nbsp;
          <span class="additive-badge additive-sa">SA</span> Semi-Additive &nbsp;
          <span class="additive-badge additive-na">NA</span> Non-Additive
        </span>
      </div>

      <div class="pl-layout">
        <div>
          <div class="pl-tree">
            <div class="pl-tree-header">Cash Flow Structure</div>
            ${this._renderCfTree(cfLines, allMeasures)}
          </div>
        </div>
        <div class="pl-assign-panel">
          <h3 style="margin:0 0 12px;font-size:14px;font-weight:600">Assign Measures to Cash Flow Lines</h3>
          ${allMeasures.length === 0
            ? '<p style="color:var(--text-muted);font-size:13px">No <em>How many</em> measures defined yet. Add measures in the BEAM matrix.</p>'
            : allMeasures.map(m => this._cfMeasureRow(m, cfLines, projectId)).join('')}
        </div>
      </div>
    `;
  },

  _renderCfTree(lines, allMeasures) {
    const byLine = {};
    allMeasures.forEach(m => {
      if (m.cashFlowLineId) {
        if (!byLine[m.cashFlowLineId]) byLine[m.cashFlowLineId] = [];
        byLine[m.cashFlowLineId].push(m);
      }
    });

    const roots = lines.filter(l => !l.parentId);
    return roots.map(l => this._renderCfLine(l, lines, byLine, 0)).join('');
  },

  _renderCfLine(line, allLines, byLine, depth) {
    const children = allLines.filter(l => l.parentId === line.id);
    const measures = byLine[line.id] || [];
    const typeClass = line.type === 'section' ? 'pl-section' : line.type === 'derived' ? 'pl-derived' : 'pl-child';

    const measureChips = measures.map(m => {
      const atKey = m.additiveType || 'fully_additive';
      const atInfo = ADDITIVE_TYPES?.[atKey] || { short: 'FA' };
      const adClass = atKey === 'non_additive' ? 'additive-na' : atKey === 'semi_additive' ? 'additive-sa' : 'additive-fa';
      const cashIcon = m.isCashBased ? ' 💵' : '';
      return `<span class="pl-measure-chip" title="${this._esc(m._eventName)}: ${this._esc(m.name)}">
        <span class="additive-badge ${adClass}">${atInfo.short}</span>
        ${this._esc(m.name)}${cashIcon}
        <span style="font-size:10px;color:var(--text-muted)"> · ${this._esc(m._eventName)}</span>
      </span>`;
    }).join('');

    const childrenHtml = children.map(c => this._renderCfLine(c, allLines, byLine, depth + 1)).join('');

    return `
      <div class="pl-line ${typeClass}" style="padding-left:${8 + depth * 16}px">
        <div class="pl-line-header">
          <span class="pl-line-name">${this._esc(line.name)}</span>
          ${line.sign ? `<span style="font-size:10px;color:var(--text-subtle);margin-left:4px">${line.sign > 0 ? '+' : '−'}</span>` : ''}
          ${measures.length ? `<span class="pl-line-count">${measures.length}</span>` : ''}
        </div>
        ${measureChips ? `<div class="pl-measure-chips">${measureChips}</div>` : ''}
      </div>
      ${childrenHtml}
    `;
  },

  _cfMeasureRow(m, cfLines, projectId) {
    const atKey = m.additiveType || 'fully_additive';
    const atInfo = ADDITIVE_TYPES?.[atKey] || { short: 'FA' };
    const adClass = atKey === 'non_additive' ? 'additive-na' : atKey === 'semi_additive' ? 'additive-sa' : 'additive-fa';

    const opts = cfLines.map(l =>
      `<option value="${l.id}" ${m.cashFlowLineId === l.id ? 'selected' : ''}>${'  '.repeat(l.parentId ? 1 : 0)}${this._esc(l.name)}</option>`
    ).join('');

    const cashChecked = m.isCashBased ? 'checked' : '';

    return `
      <div class="pl-measure-row">
        <div class="pl-measure-info">
          <span class="additive-badge ${adClass}">${atInfo.short}</span>
          <strong style="font-size:13px">${this._esc(m.name)}</strong>
          <span style="font-size:11px;color:var(--text-muted)"> · ${this._esc(m._eventName)}</span>
          <code style="font-size:10px;color:var(--text-subtle);margin-left:4px">${m.dataType || 'DECIMAL'}</code>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text-muted);cursor:pointer;white-space:nowrap">
            <input type="checkbox" ${cashChecked}
              onchange="CashFlow._toggleCashBased('${m._eventId}', '${m.id}', this.checked, '${projectId}')">
            Cash basis
          </label>
          <select class="form-input pl-line-select" style="flex:1"
            onchange="CashFlow._assignLine('${m._eventId}', '${m.id}', this.value, '${projectId}')">
            <option value="">— unassigned —</option>
            ${opts}
          </select>
        </div>
      </div>
    `;
  },

  _assignLine(eventId, colId, cfLineId, projectId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event } = found;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col.cashFlowLineId = cfLineId;
    Storage.saveEvent(projectId, event);
    // Refresh the tree panel only
    const project = Storage.getProject(projectId);
    const cfLines = Storage.getCashFlowLines(projectId);
    const allMeasures = project.events.flatMap(e =>
      e.columns.filter(c => c.category === 'how_many').map(c => ({ ...c, _eventId: e.id, _eventName: e.name }))
    );
    const treeEl = document.querySelector('.pl-tree');
    if (treeEl) {
      treeEl.innerHTML = `<div class="pl-tree-header">Cash Flow Structure</div>${this._renderCfTree(cfLines, allMeasures)}`;
    }
  },

  _toggleCashBased(eventId, colId, value, projectId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event } = found;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col.isCashBased = value;
    Storage.saveEvent(projectId, event);
  },

  renderCoverage(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('cashflow'); return; }

    const cfLines = Storage.getCashFlowLines(projectId);
    const plLines = Storage.getPlLines(projectId);
    const allMeasures = project.events.flatMap(e =>
      e.columns.filter(c => c.category === 'how_many').map(c => ({ ...c, _eventId: e.id, _eventName: e.name }))
    );

    const total = allMeasures.length;
    const mapped = allMeasures.filter(m => m.cashFlowLineId).length;
    const unmapped = total - mapped;
    const pct = total ? Math.round(mapped / total * 100) : 0;

    // Coverage by line
    const byLine = {};
    allMeasures.forEach(m => {
      if (m.cashFlowLineId) {
        if (!byLine[m.cashFlowLineId]) byLine[m.cashFlowLineId] = [];
        byLine[m.cashFlowLineId].push(m);
      }
    });

    // Reconciliation status classification
    const statusCounts = { fullyTraced: 0, accrualsOnly: 0, timingDiff: 0, cfOnly: 0, unmappedBoth: 0 };
    const reconRows = allMeasures.map(m => {
      const hasPlLine = !!m.plLineId;
      const hasCfLine = !!m.cashFlowLineId;

      let statusClass, statusLabel;
      if (hasPlLine && hasCfLine) {
        statusClass = 'fully-traced'; statusLabel = '✓ Fully traced';
        statusCounts.fullyTraced++;
      } else if (hasPlLine && !hasCfLine && !m.isCashBased) {
        statusClass = 'accruals-only'; statusLabel = 'Accruals only';
        statusCounts.accrualsOnly++;
      } else if (hasPlLine && !hasCfLine && m.isCashBased) {
        statusClass = 'timing-diff'; statusLabel = 'Timing diff';
        statusCounts.timingDiff++;
      } else if (!hasPlLine && hasCfLine) {
        statusClass = 'cf-only'; statusLabel = 'CF only';
        statusCounts.cfOnly++;
      } else {
        statusClass = 'unmapped'; statusLabel = 'Unmapped';
        statusCounts.unmappedBoth++;
      }

      const plLine = plLines.find(l => l.id === m.plLineId);
      const plLineName = plLine ? plLine.name : (m.plLineId ? m.plLineId : '—');
      const cfLine = cfLines.find(l => l.id === m.cashFlowLineId);
      const cfLineName = cfLine ? cfLine.name : (m.cashFlowLineId ? m.cashFlowLineId : '—');
      const basisLabel = m.isCashBased ? 'Cash' : 'Accrual';

      return `
        <tr>
          <td style="font-weight:500">${this._esc(m.name)}</td>
          <td style="color:var(--text-muted)">${this._esc(m._eventName)}</td>
          <td>${this._esc(plLineName)}</td>
          <td>${this._esc(cfLineName)}</td>
          <td><span style="font-size:11px">${basisLabel}</span></td>
          <td><span class="recon-status recon-${statusClass}">${statusLabel}</span></td>
        </tr>
      `;
    }).join('');

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#cashflow">Cash Flow Mapper</a>
          <span class="bc-sep">›</span>
          <a href="#cashflow/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <span>Coverage &amp; Reconciliation</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('cashflow/${project.id}')">← Assign Measures</button>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">Cash Flow Coverage &amp; Reconciliation</h1>
        <p class="view-subtitle">${this._esc(project.name)}</p>
      </div>

      <!-- Summary stats -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
        ${this._statCard('Total Measures', total, '#374151')}
        ${this._statCard('CF-Mapped', mapped, '#166534')}
        ${this._statCard('Unmapped', unmapped, unmapped > 0 ? '#b91c1c' : '#6b7280')}
        ${this._statCard('Coverage', pct + '%', pct === 100 ? '#166534' : pct > 50 ? '#92400e' : '#b91c1c')}
      </div>

      <!-- Overall bar -->
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:4px">
          <span>Overall Cash Flow Coverage</span>
          <span>${mapped} / ${total} measures (${pct}%)</span>
        </div>
        <div class="pl-coverage-bar" style="height:12px;border-radius:6px">
          <div class="pl-coverage-fill" style="width:${pct}%;border-radius:6px"></div>
        </div>
      </div>

      <!-- CF lines with coverage -->
      <h3 style="font-size:14px;font-weight:600;margin-bottom:10px">Coverage by Cash Flow Line</h3>
      <div class="pl-tree" style="margin-bottom:24px">
        ${cfLines.filter(l => !l.parentId).map(l => this._coverageLine(l, cfLines, byLine, allMeasures, 0)).join('')}
      </div>

      <!-- P&L Reconciliation panel -->
      <div style="margin-bottom:24px">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px">P&amp;L → Cash Flow Reconciliation</h3>
        <div class="info-banner" style="margin-bottom:12px">
          <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
          Measures that appear in both P&amp;L and Cash Flow mapping are fully traced.
          Measures mapped to P&amp;L but <strong>NOT</strong> to Cash Flow may represent timing differences
          (accruals) that need a working capital adjustment.
        </div>

        ${total === 0 ? '<p style="color:var(--text-muted);font-size:13px">No measures defined yet.</p>' : `
          <div style="overflow-x:auto">
            <table class="recon-table">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>Event</th>
                  <th>P&amp;L Line</th>
                  <th>Cash Flow Line</th>
                  <th>Basis</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${reconRows}
              </tbody>
            </table>
          </div>

          <!-- Status summary -->
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;font-size:12px">
            ${statusCounts.fullyTraced > 0 ? `
              <span style="display:flex;align-items:center;gap:5px">
                <span class="recon-status recon-fully-traced">✓ Fully traced</span>
                <span style="color:var(--text-muted)">${statusCounts.fullyTraced} — mapped to both P&amp;L and Cash Flow</span>
              </span>` : ''}
            ${statusCounts.accrualsOnly > 0 ? `
              <span style="display:flex;align-items:center;gap:5px">
                <span class="recon-status recon-accruals-only">Accruals only</span>
                <span style="color:var(--text-muted)">${statusCounts.accrualsOnly} — in P&amp;L, not CF; accruals-based (may need WC adjustment)</span>
              </span>` : ''}
            ${statusCounts.timingDiff > 0 ? `
              <span style="display:flex;align-items:center;gap:5px">
                <span class="recon-status recon-timing-diff">Timing diff</span>
                <span style="color:var(--text-muted)">${statusCounts.timingDiff} — in P&amp;L, not CF; cash-based (timing difference)</span>
              </span>` : ''}
            ${statusCounts.cfOnly > 0 ? `
              <span style="display:flex;align-items:center;gap:5px">
                <span class="recon-status recon-cf-only">CF only</span>
                <span style="color:var(--text-muted)">${statusCounts.cfOnly} — in Cash Flow only, not in P&amp;L</span>
              </span>` : ''}
            ${statusCounts.unmappedBoth > 0 ? `
              <span style="display:flex;align-items:center;gap:5px">
                <span class="recon-status recon-unmapped">Unmapped</span>
                <span style="color:var(--text-muted)">${statusCounts.unmappedBoth} — not assigned to P&amp;L or Cash Flow</span>
              </span>` : ''}
          </div>
        `}
      </div>

      <!-- Unmapped measures -->
      ${unmapped > 0 ? `
        <h3 style="font-size:14px;font-weight:600;margin-bottom:10px;color:#b91c1c">Unmapped Measures (${unmapped})</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
          ${allMeasures.filter(m => !m.cashFlowLineId).map(m => {
            const atKey = m.additiveType || 'fully_additive';
            const adClass = atKey === 'non_additive' ? 'additive-na' : atKey === 'semi_additive' ? 'additive-sa' : 'additive-fa';
            const atInfo = ADDITIVE_TYPES?.[atKey] || { short: 'FA' };
            return `<span class="pl-measure-chip" style="border:1px solid #fca5a5">
              <span class="additive-badge ${adClass}">${atInfo.short}</span>
              ${this._esc(m.name)}
              <span style="font-size:10px;color:var(--text-muted)"> · ${this._esc(m._eventName)}</span>
            </span>`;
          }).join('')}
        </div>
        <p style="font-size:12px;color:var(--text-muted)">
          <a href="#cashflow/${project.id}" style="color:var(--primary)">← Go to mapper</a> to assign these measures to Cash Flow lines.
        </p>
      ` : `
        <div style="text-align:center;padding:20px;color:#166534;font-weight:600">
          ✓ All measures are mapped to Cash Flow lines
        </div>
      `}
    `;
  },

  _coverageLine(line, allLines, byLine, allMeasures, depth) {
    const children = allLines.filter(l => l.parentId === line.id);
    const directMeasures = byLine[line.id] || [];

    const allDescendantLineIds = this._getAllDescendantIds(line.id, allLines);
    const totalInSubtree = allMeasures.filter(m =>
      m.cashFlowLineId && (m.cashFlowLineId === line.id || allDescendantLineIds.includes(m.cashFlowLineId))
    ).length;

    const typeClass = line.type === 'section' ? 'pl-section' : line.type === 'derived' ? 'pl-derived' : 'pl-child';

    const childrenHtml = children.map(c => this._coverageLine(c, allLines, byLine, allMeasures, depth + 1)).join('');

    return `
      <div class="pl-line ${typeClass}" style="padding-left:${8 + depth * 16}px">
        <div class="pl-line-header">
          <span class="pl-line-name">${this._esc(line.name)}</span>
          ${totalInSubtree > 0
            ? `<span class="pl-line-count" style="background:#dcfce7;color:#166534">${totalInSubtree} measure${totalInSubtree !== 1 ? 's' : ''}</span>`
            : (line.type !== 'derived' && children.length === 0 ? `<span style="font-size:10px;color:#9ca3af;margin-left:6px">no measures</span>` : '')
          }
        </div>
        ${directMeasures.map(m => {
          const atKey = m.additiveType || 'fully_additive';
          const adClass = atKey === 'non_additive' ? 'additive-na' : atKey === 'semi_additive' ? 'additive-sa' : 'additive-fa';
          const atInfo = ADDITIVE_TYPES?.[atKey] || { short: 'FA' };
          return `<span class="pl-measure-chip">
            <span class="additive-badge ${adClass}">${atInfo.short}</span>
            ${this._esc(m.name)}
            <span style="font-size:10px;color:var(--text-muted)"> · ${this._esc(m._eventName)}</span>
            ${m.isCashBased ? '💵' : ''}
          </span>`;
        }).join('')}
      </div>
      ${childrenHtml}
    `;
  },

  _getAllDescendantIds(lineId, allLines) {
    const ids = [];
    const children = allLines.filter(l => l.parentId === lineId);
    children.forEach(c => {
      ids.push(c.id);
      ids.push(...this._getAllDescendantIds(c.id, allLines));
    });
    return ids;
  },

  _statCard(label, value, color) {
    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px 14px">
        <div style="font-size:22px;font-weight:700;color:${color}">${value}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${label}</div>
      </div>
    `;
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
