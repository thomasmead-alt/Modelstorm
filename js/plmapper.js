const PLMapper = {

  renderProjectPicker() {
    const data = Storage.load();
    const app = document.getElementById('app');

    if (!data.projects.length) {
      app.innerHTML = `
        <div class="view-header">
          <div><h1 class="view-title">P&amp;L / I&amp;E Mapper</h1></div>
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
          <h1 class="view-title">P&amp;L / I&amp;E Mapper</h1>
          <p class="view-subtitle">Map your measures to Income &amp; Expenditure lines across all projects</p>
        </div>
      </div>
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>What is P&amp;L Mapping?</strong> Each <em>How many</em> measure in your BEAM matrix can be
        assigned to a line on the Income &amp; Expenditure statement — Revenue, Cost of Sales, Operating
        Expenditure, etc. This reveals which financial lines have model coverage and which are gaps.
        <br><strong>Fully Additive</strong> measures can be safely aggregated to any P&amp;L line.
        <strong>Semi-Additive</strong> measures (e.g. balances) require care with time dimensions.
        <strong>Non-Additive</strong> measures (e.g. percentages) must be recalculated from components.
      </div>
      <div class="project-picker">
        <h3 style="margin:0 0 12px">Select a project</h3>
        <div class="card-grid">
          ${data.projects.map(p => {
            const measures = p.events.flatMap(e => e.columns.filter(c => c.category === 'how_many'));
            const mapped = measures.filter(c => c.plLineId).length;
            const pct = measures.length ? Math.round(mapped / measures.length * 100) : 0;
            return `
              <div class="card" style="cursor:pointer" onclick="Router.navigate('pl-mapper/${p.id}')">
                <div class="card-body">
                  <h3 class="card-title">${this._esc(p.name)}</h3>
                  <div class="card-meta">
                    <span>${measures.length} measure${measures.length !== 1 ? 's' : ''}</span>
                    <span>${mapped} mapped (${pct}%)</span>
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
    if (!project) { Router.navigate('pl-mapper'); return; }

    const plLines = Storage.getPlLines(projectId);
    const allMeasures = project.events.flatMap(e =>
      e.columns.filter(c => c.category === 'how_many').map(c => ({ ...c, _eventId: e.id, _eventName: e.name }))
    );

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#project/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <span>P&amp;L Mapper</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('pl-coverage/${project.id}')">📊 Coverage Report</button>
        </div>
      </div>

      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>P&amp;L / Income &amp; Expenditure Mapper</strong> — Drag or assign each measure to a line
        on the I&amp;E statement. The tree on the left shows the hierarchy from Revenue down to Net Profit.
        Use the <strong>Coverage Report</strong> to see which lines are unmodelled.
        <br><span style="color:var(--text-muted);font-size:12px">
          Additive types: <span class="additive-badge additive-fa">FA</span> Fully Additive &nbsp;
          <span class="additive-badge additive-sa">SA</span> Semi-Additive &nbsp;
          <span class="additive-badge additive-na">NA</span> Non-Additive
        </span>
      </div>

      <div class="pl-layout">
        <div>
          <div class="pl-tree">
            <div class="pl-tree-header">I&amp;E Structure</div>
            ${this._renderPlTree(plLines, allMeasures)}
          </div>
        </div>
        <div class="pl-assign-panel">
          <h3 style="margin:0 0 12px;font-size:14px;font-weight:600">Assign Measures to P&amp;L Lines</h3>
          ${allMeasures.length === 0
            ? '<p style="color:var(--text-muted);font-size:13px">No <em>How many</em> measures defined yet. Add measures in the BEAM matrix.</p>'
            : allMeasures.map(m => this._measureRow(m, plLines, projectId)).join('')}
        </div>
      </div>
    `;
  },

  _renderPlTree(lines, allMeasures) {
    // Build a lookup of measures per line
    const byLine = {};
    allMeasures.forEach(m => {
      if (m.plLineId) {
        if (!byLine[m.plLineId]) byLine[m.plLineId] = [];
        byLine[m.plLineId].push(m);
      }
    });

    // Top-level lines (no parent)
    const roots = lines.filter(l => !l.parentId);
    return roots.map(l => this._renderPlLine(l, lines, byLine, 0)).join('');
  },

  _renderPlLine(line, allLines, byLine, depth) {
    const children = allLines.filter(l => l.parentId === line.id);
    const measures = byLine[line.id] || [];
    const typeClass = line.type === 'section' ? 'pl-section' : line.type === 'derived' ? 'pl-derived' : 'pl-child';

    const measureChips = measures.map(m => {
      const atInfo = ADDITIVE_TYPES?.[m.additiveType] || { short: 'FA', color: '#166534' };
      const bcIcon = m.budgetControl ? ' 💰' : '';
      return `<span class="pl-measure-chip" title="${this._esc(m._eventName)}: ${this._esc(m.name)}">
        <span class="additive-badge additive-${(m.additiveType || 'fully_additive').replace('_additive','').replace('_','')}">
          ${atInfo.short}
        </span>
        ${this._esc(m.name)}${bcIcon}
        <span style="font-size:10px;color:var(--text-muted)"> · ${this._esc(m._eventName)}</span>
      </span>`;
    }).join('');

    const childrenHtml = children.map(c => this._renderPlLine(c, allLines, byLine, depth + 1)).join('');

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

  _measureRow(m, plLines, projectId) {
    const atKey = m.additiveType || 'fully_additive';
    const atInfo = ADDITIVE_TYPES?.[atKey] || { short: 'FA', color: '#166534' };
    const adClass = atKey === 'non_additive' ? 'additive-na' : atKey === 'semi_additive' ? 'additive-sa' : 'additive-fa';
    const bcIcon = m.budgetControl ? '<span title="Budget controlled">💰</span>' : '';

    const opts = plLines.map(l =>
      `<option value="${l.id}" ${m.plLineId === l.id ? 'selected' : ''}>${'  '.repeat(l.parentId ? 1 : 0)}${this._esc(l.name)}</option>`
    ).join('');

    return `
      <div class="pl-measure-row">
        <div class="pl-measure-info">
          <span class="additive-badge ${adClass}">${atInfo.short}</span>
          ${bcIcon}
          <strong style="font-size:13px">${this._esc(m.name)}</strong>
          <span style="font-size:11px;color:var(--text-muted)"> · ${this._esc(m._eventName)}</span>
          <code style="font-size:10px;color:var(--text-subtle);margin-left:4px">${m.dataType || 'DECIMAL'}</code>
        </div>
        <select class="form-input pl-line-select" onchange="PLMapper._assignLine('${m._eventId}', '${m.id}', this.value, '${projectId}')">
          <option value="">— unassigned —</option>
          ${opts}
        </select>
      </div>
    `;
  },

  _assignLine(eventId, colId, plLineId, projectId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event } = found;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col.plLineId = plLineId;
    Storage.saveEvent(projectId, event);
    // Refresh the tree panel only
    const project = Storage.getProject(projectId);
    const plLines = Storage.getPlLines(projectId);
    const allMeasures = project.events.flatMap(e =>
      e.columns.filter(c => c.category === 'how_many').map(c => ({ ...c, _eventId: e.id, _eventName: e.name }))
    );
    const treeEl = document.querySelector('.pl-tree');
    if (treeEl) {
      treeEl.innerHTML = `<div class="pl-tree-header">I&amp;E Structure</div>${this._renderPlTree(plLines, allMeasures)}`;
    }
  },

  renderCoverage(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('pl-mapper'); return; }

    const plLines = Storage.getPlLines(projectId);
    const allMeasures = project.events.flatMap(e =>
      e.columns.filter(c => c.category === 'how_many').map(c => ({ ...c, _eventId: e.id, _eventName: e.name }))
    );

    const total = allMeasures.length;
    const mapped = allMeasures.filter(m => m.plLineId).length;
    const unmapped = total - mapped;
    const pct = total ? Math.round(mapped / total * 100) : 0;

    // Coverage by line
    const byLine = {};
    allMeasures.forEach(m => {
      if (m.plLineId) {
        if (!byLine[m.plLineId]) byLine[m.plLineId] = [];
        byLine[m.plLineId].push(m);
      }
    });

    // Additivity summary
    const faCount = allMeasures.filter(m => (m.additiveType || 'fully_additive') === 'fully_additive').length;
    const saCount = allMeasures.filter(m => m.additiveType === 'semi_additive').length;
    const naCount = allMeasures.filter(m => m.additiveType === 'non_additive').length;
    const bcCount = allMeasures.filter(m => m.budgetControl).length;

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#project/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <a href="#pl-mapper/${project.id}">P&amp;L Mapper</a>
          <span class="bc-sep">›</span>
          <span>Coverage Report</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('pl-mapper/${project.id}')">← Assign Measures</button>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">P&amp;L Coverage Report</h1>
        <p class="view-subtitle">${this._esc(project.name)}</p>
      </div>

      <!-- Summary stats -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
        ${this._statCard('Total Measures', total, '#374151')}
        ${this._statCard('Mapped to P&L', mapped, '#166534')}
        ${this._statCard('Unmapped', unmapped, unmapped > 0 ? '#b91c1c' : '#6b7280')}
        ${this._statCard('Coverage', pct + '%', pct === 100 ? '#166534' : pct > 50 ? '#92400e' : '#b91c1c')}
        ${this._statCard('Fully Additive', faCount, '#166534')}
        ${this._statCard('Semi-Additive', saCount, saCount > 0 ? '#92400e' : '#6b7280')}
        ${this._statCard('Non-Additive', naCount, naCount > 0 ? '#b91c1c' : '#6b7280')}
        ${this._statCard('Budget Ctrl', bcCount, '#7c3aed')}
      </div>

      <!-- Overall bar -->
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:4px">
          <span>Overall P&amp;L Coverage</span>
          <span>${mapped} / ${total} measures (${pct}%)</span>
        </div>
        <div class="pl-coverage-bar" style="height:12px;border-radius:6px">
          <div class="pl-coverage-fill" style="width:${pct}%;border-radius:6px"></div>
        </div>
      </div>

      <!-- Non-additive warning -->
      ${naCount > 0 ? `
        <div class="info-banner" style="border-left-color:#b91c1c;margin-bottom:16px">
          <strong>⚠ Non-Additive Measures (${naCount})</strong> — These measures cannot be summed directly.
          They must be recalculated from their component measures at reporting time.
          Typical examples: margins %, ratios, averages, headcount percentages.
          Ensure the underlying additive components are also modelled and mapped.
        </div>
      ` : ''}

      ${saCount > 0 ? `
        <div class="info-banner" style="border-left-color:#d97706;margin-bottom:16px">
          <strong>⚠ Semi-Additive Measures (${saCount})</strong> — These measures can be summed across
          some dimensions but not time. Typical examples: inventory balances, headcount, account balances.
          Use period-end snapshots and avoid naive SUM across time periods.
        </div>
      ` : ''}

      <!-- P&L lines with coverage -->
      <h3 style="font-size:14px;font-weight:600;margin-bottom:10px">Coverage by P&amp;L Line</h3>
      <div class="pl-tree" style="margin-bottom:20px">
        ${plLines.filter(l => !l.parentId).map(l => this._coverageLine(l, plLines, byLine, allMeasures, 0)).join('')}
      </div>

      <!-- Unmapped measures -->
      ${unmapped > 0 ? `
        <h3 style="font-size:14px;font-weight:600;margin-bottom:10px;color:#b91c1c">Unmapped Measures (${unmapped})</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
          ${allMeasures.filter(m => !m.plLineId).map(m => {
            const atKey = m.additiveType || 'fully_additive';
            const adClass = atKey === 'non_additive' ? 'additive-na' : atKey === 'semi_additive' ? 'additive-sa' : 'additive-fa';
            const atInfo = ADDITIVE_TYPES?.[atKey] || { short: 'FA' };
            return `<span class="pl-measure-chip" style="border:1px solid #fca5a5">
              <span class="additive-badge ${adClass}">${atInfo.short}</span>
              ${this._esc(m.name)}
              <span style="font-size:10px;color:var(--text-muted)"> · ${this._esc(m._eventName)}</span>
              ${m.budgetControl ? '💰' : ''}
            </span>`;
          }).join('')}
        </div>
        <p style="font-size:12px;color:var(--text-muted)">
          <a href="#pl-mapper/${project.id}" style="color:var(--primary)">← Go to mapper</a> to assign these measures to P&amp;L lines.
        </p>
      ` : `
        <div style="text-align:center;padding:20px;color:#166534;font-weight:600">
          ✓ All measures are mapped to P&amp;L lines
        </div>
      `}
    `;
  },

  _coverageLine(line, allLines, byLine, allMeasures, depth) {
    const children = allLines.filter(l => l.parentId === line.id);
    const directMeasures = byLine[line.id] || [];

    // Count all descendants
    const allDescendantLineIds = this._getAllDescendantIds(line.id, allLines);
    const totalInSubtree = allMeasures.filter(m => m.plLineId && (m.plLineId === line.id || allDescendantLineIds.includes(m.plLineId))).length;

    const typeClass = line.type === 'section' ? 'pl-section' : line.type === 'derived' ? 'pl-derived' : 'pl-child';
    const hasAny = totalInSubtree > 0;

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
            ${m.budgetControl ? '💰' : ''}
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
