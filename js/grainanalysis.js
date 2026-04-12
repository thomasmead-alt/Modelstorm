const GrainAnalysis = {

  // Grain order for comparison (finer → coarser)
  GRAIN_ORDER: ['transaction', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'fiscal_period'],

  renderProjectPicker() {
    const data = Storage.load();
    const app = document.getElementById('app');

    if (!data.projects.length) {
      app.innerHTML = `
        <div class="view-header">
          <div><h1 class="view-title">Grain Analysis</h1></div>
        </div>
        <div class="empty-state">
          <h2 class="empty-title">No projects yet</h2>
          <p class="empty-desc">Create a project with at least two events to compare grains.</p>
          <button class="btn btn-primary" onclick="Router.navigate('projects')">Go to Projects</button>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Grain Analysis</h1>
          <p class="view-subtitle">Detect aggregation and disaggregation needs across your events</p>
        </div>
      </div>
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>What is Grain Analysis?</strong> When two fact tables operate at different grains
        (e.g. Transaction vs Monthly Budget), you cannot join them directly without an aggregation bridge.
        This view highlights which event pairs need <strong>aggregation UP</strong> (roll up fine data to coarser)
        or <strong>disaggregation DOWN</strong> (allocate coarse data to finer grain) — a common pattern
        in financial planning vs actuals comparisons.
      </div>
      <div class="project-picker">
        <h3 style="margin:0 0 12px">Select a project</h3>
        <div class="card-grid">
          ${data.projects.map(p => {
            const events = p.events;
            const hasMultiple = events.length >= 2;
            const grains = [...new Set(events.map(e => e.grain || 'transaction'))];
            const mixed = grains.length > 1;
            return `
              <div class="card" style="cursor:pointer;${!hasMultiple ? 'opacity:0.6' : ''}"
                onclick="${hasMultiple ? `Router.navigate('grain-analysis/${p.id}')` : ''}">
                <div class="card-body">
                  <h3 class="card-title">${this._esc(p.name)}</h3>
                  <div class="card-meta">
                    <span>${events.length} event${events.length !== 1 ? 's' : ''}</span>
                    ${mixed
                      ? `<span style="color:#d97706;font-weight:600">⚡ Mixed grains</span>`
                      : `<span style="color:var(--text-muted)">Uniform grain</span>`}
                  </div>
                  ${!hasMultiple ? '<p style="font-size:11px;color:var(--text-muted);margin-top:4px">Need ≥ 2 events to compare</p>' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  render(projectId, activeTab) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('grain-analysis'); return; }

    const events = project.events;
    if (events.length < 2) {
      const app = document.getElementById('app');
      app.innerHTML = `
        <div class="view-header">
          <div class="breadcrumb">
            <a href="#projects">Projects</a>
            <span class="bc-sep">›</span>
            <a href="#project/${project.id}">${this._esc(project.name)}</a>
            <span class="bc-sep">›</span>
            <span>Grain Analysis</span>
          </div>
        </div>
        <div class="empty-state">
          <h2 class="empty-title">Need at least 2 events</h2>
          <p class="empty-desc">Add more events to this project to compare their grains.</p>
          <button class="btn btn-primary" onclick="Projects.openNewEventModal('${project.id}')">+ Add Event</button>
        </div>
      `;
      return;
    }

    // Default to ladder if ≥3 events
    const tab = activeTab || (events.length >= 3 ? 'ladder' : 'pairs');

    // Build compatibility matrix
    const pairs = [];
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        pairs.push(this._comparePair(events[i], events[j]));
      }
    }
    pairs.sort((a, b) => {
      const score = { error: 2, warn: 1, ok: 0 };
      return (score[b.severity] || 0) - (score[a.severity] || 0);
    });

    const sharedDims = this._findSharedDimensions(events);

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#project/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <span>Grain Analysis</span>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">Grain Analysis</h1>
        <p class="view-subtitle">${this._esc(project.name)}</p>
      </div>

      <div class="grain-tab-strip">
        <button class="${tab === 'ladder' ? 'active' : ''}"
          onclick="GrainAnalysis.render('${project.id}', 'ladder')">Ladder Diagram</button>
        <button class="${tab === 'pairs' ? 'active' : ''}"
          onclick="GrainAnalysis.render('${project.id}', 'pairs')">Pair Analysis</button>
      </div>

      ${tab === 'ladder'
        ? this._renderLadderTab(project, pairs)
        : this._renderPairsTab(project, events, pairs, sharedDims)}
    `;
  },

  // ── Ladder Diagram tab ────────────────────────────────────

  _renderLadderTab(project, pairs) {
    const svgContent = this._buildLadderSVG(project);
    return `
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>Grain Ladder Diagram</strong> — Events are positioned on the Y-axis at their grain level.
        Arrows show relationships: <span style="color:#166534">green = same grain (drill-across)</span>,
        <span style="color:#d97706">amber = aggregate up</span>,
        <span style="color:#dc2626">red = disaggregate down</span>.
        Dotted blue lines show shared conformed dimensions.
      </div>
      <div class="grain-diagram-toolbar">
        <button class="btn btn-ghost btn-sm" onclick="GrainAnalysis._downloadDiagram('${project.id}')">⬇ Download SVG</button>
      </div>
      <div class="grain-diagram-container">
        ${svgContent}
      </div>
    `;
  },

  _buildLadderSVG(project) {
    const events = project.events;
    const LABEL_W = 110;  // width of grain label column
    const BOX_W   = 150;  // event box width
    const BOX_H   = 44;   // event box height
    const ROW_H   = 80;   // vertical spacing per grain row
    const COL_GAP = 20;   // horizontal gap between event boxes
    const PAD_T   = 20;   // top padding
    const PAD_B   = 24;   // bottom padding

    // Only include grains that have at least one event
    const usedGrains = this.GRAIN_ORDER.filter(g =>
      events.some(e => (e.grain || 'transaction') === g)
    );

    if (usedGrains.length === 0) return '<p style="color:var(--text-muted);font-size:12px;padding:16px">No events with grain information.</p>';

    // Assign each event a column position within its grain row
    const byGrain = {};
    usedGrains.forEach(g => { byGrain[g] = []; });
    events.forEach(e => {
      const g = e.grain || 'transaction';
      if (byGrain[g]) byGrain[g].push(e);
    });

    const maxCols = Math.max(...usedGrains.map(g => byGrain[g].length), 1);
    const svgW = LABEL_W + maxCols * (BOX_W + COL_GAP) + PAD_T;
    const svgH = PAD_T + usedGrains.length * ROW_H + PAD_B;

    // Map event id → centre position {cx, cy}
    const eventPos = {};
    usedGrains.forEach((grain, rowIdx) => {
      const cy = PAD_T + rowIdx * ROW_H + ROW_H / 2;
      byGrain[grain].forEach((e, colIdx) => {
        const cx = LABEL_W + colIdx * (BOX_W + COL_GAP) + BOX_W / 2;
        eventPos[e.id] = { cx, cy, grain, rowIdx };
      });
    });

    // Build grain label rows (horizontal guide lines)
    const grainRows = usedGrains.map((grain, rowIdx) => {
      const gi = (typeof GRAINS !== 'undefined' && GRAINS[grain]) || { label: grain, color: '#6b7280' };
      const cy = PAD_T + rowIdx * ROW_H + ROW_H / 2;
      return `
        <line x1="${LABEL_W - 8}" y1="${cy}" x2="${svgW - PAD_T}" y2="${cy}"
          stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,4"/>
        <text x="4" y="${cy + 4}" class="grain-label"
          style="fill:${gi.color};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">${this._esc(gi.label || grain)}</text>
      `;
    }).join('');

    // Build arrows between every event pair
    const arrows = [];
    const drillLines = [];
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const eA = events[i], eB = events[j];
        const posA = eventPos[eA.id], posB = eventPos[eB.id];
        if (!posA || !posB) continue;

        const pair = this._comparePair(eA, eB);
        const { severity, direction } = pair;

        // Check shared conformed dims by publicDimensionId
        const dimsA = new Set((eA.columns || []).filter(c => c.publicDimensionId).map(c => c.publicDimensionId));
        const dimsB = new Set((eB.columns || []).filter(c => c.publicDimensionId).map(c => c.publicDimensionId));
        const hasSharedConformed = [...dimsA].some(d => dimsB.has(d));

        // Dotted blue line for shared conformed dims at same grain
        if (hasSharedConformed && direction === 'same') {
          drillLines.push(`
            <line x1="${posA.cx}" y1="${posA.cy - BOX_H / 2 - 4}"
                  x2="${posB.cx}" y2="${posB.cy - BOX_H / 2 - 4}"
              stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="5,3"
              opacity="0.7"/>
            <text x="${(posA.cx + posB.cx) / 2}" y="${posA.cy - BOX_H / 2 - 8}"
              style="fill:#3b82f6;font-size:9px;text-anchor:middle">conformed</text>
          `);
        }

        const color = severity === 'ok' ? '#16a34a' : severity === 'warn' ? '#d97706' : '#dc2626';
        const label = direction === 'up' ? '↑ agg' : direction === 'down' ? '↓ disagg' : '↔';

        // Arrow path between event boxes
        const x1 = posA.cx, y1 = posA.cy;
        const x2 = posB.cx, y2 = posB.cy;

        // Avoid drawing inside the box — offset from edge
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ox = (dx / len) * (BOX_W / 2 + 4);
        const oy = (dy / len) * (BOX_H / 2 + 4);

        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;

        arrows.push(`
          <defs>
            <marker id="arr-${i}-${j}" markerWidth="6" markerHeight="6"
              refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="${color}"/>
            </marker>
          </defs>
          <line x1="${x1 + ox}" y1="${y1 + oy}" x2="${x2 - ox}" y2="${y2 - oy}"
            stroke="${color}" stroke-width="1.5" opacity="0.75"
            marker-end="url(#arr-${i}-${j})"/>
          <text x="${mx}" y="${my - 4}"
            style="fill:${color};font-size:9px;text-anchor:middle;font-weight:600">${label}</text>
        `);
      }
    }

    // Build event boxes
    const boxes = events.map(e => {
      const pos = eventPos[e.id];
      if (!pos) return '';
      const grain = e.grain || 'transaction';
      const gi = (typeof GRAINS !== 'undefined' && GRAINS[grain]) || { color: '#6b7280', short: grain };
      const bx = pos.cx - BOX_W / 2;
      const by = pos.cy - BOX_H / 2;
      const label = e.name.length > 18 ? e.name.substring(0, 16) + '…' : e.name;
      const measures = (e.columns || []).filter(c => c.category === 'how_many').length;
      return `
        <g class="event-box-group" onclick="Router.navigate('event/${e.id}')" style="cursor:pointer">
          <rect x="${bx}" y="${by}" width="${BOX_W}" height="${BOX_H}"
            rx="6" ry="6" fill="white" stroke="${gi.color}" stroke-width="2"
            filter="url(#shadow)"/>
          <text x="${pos.cx}" y="${by + 16}"
            style="fill:#111827;font-size:11px;font-weight:600;text-anchor:middle">${this._esc(label)}</text>
          <rect x="${bx + 6}" y="${by + 24}" width="42" height="13"
            rx="4" ry="4" fill="${gi.color}22"/>
          <text x="${bx + 27}" y="${by + 34}"
            style="fill:${gi.color};font-size:9px;font-weight:700;text-anchor:middle">${this._esc(gi.short || grain)}</text>
          <text x="${bx + BOX_W - 6}" y="${by + 34}"
            style="fill:#9ca3af;font-size:9px;text-anchor:end">${measures}m</text>
        </g>
      `;
    }).join('');

    return `
      <svg xmlns="http://www.w3.org/2000/svg" id="grain-ladder-svg"
        width="${svgW}" height="${svgH}" class="grain-diagram-svg"
        style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        <defs>
          <filter id="shadow" x="-5%" y="-10%" width="110%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.08"/>
          </filter>
        </defs>
        <!-- Grain guide lines and labels -->
        ${grainRows}
        <!-- Drill-across conformed dim connectors -->
        ${drillLines.join('')}
        <!-- Relationship arrows -->
        ${arrows.join('')}
        <!-- Event boxes (on top) -->
        ${boxes}
      </svg>
    `;
  },

  _downloadDiagram(projectId) {
    const svg = document.getElementById('grain-ladder-svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const project = Storage.getProject(projectId);
    a.href = url;
    a.download = (project ? project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'grain') + '-ladder.svg';
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Pair Analysis tab ─────────────────────────────────────

  _renderPairsTab(project, events, pairs, sharedDims) {
    return `
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>Reading this analysis:</strong>
        <span class="compat-badge compat-ok">✓ Compatible</span> same grain — can join directly.
        <span class="compat-badge compat-warn">⚡ Aggregation needed</span> coarser target — roll up the finer fact.
        <span class="compat-badge compat-error">⚠ Disaggregation</span> finer target — allocation or assumption needed.
        <br>
        <strong>Semi-Additive</strong> measures (<span class="additive-badge additive-sa">SA</span>) cannot be
        aggregated across time — flag these for special handling in any aggregation bridge.
      </div>

      <!-- Grain summary per event -->
      <h3 style="font-size:14px;font-weight:600;margin-bottom:10px">Event Grains</h3>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px">
        ${events.map(e => {
          const grain = e.grain || 'transaction';
          const gi = (typeof GRAINS !== 'undefined' && GRAINS[grain]) || { label: grain, color: '#6b7280', short: grain };
          const measures = e.columns.filter(c => c.category === 'how_many');
          const naCount = measures.filter(c => c.additiveType === 'non_additive').length;
          const saCount = measures.filter(c => c.additiveType === 'semi_additive').length;
          return `
            <div style="background:var(--bg-card);border:1.5px solid ${gi.color}40;border-left:4px solid ${gi.color};border-radius:8px;padding:10px 14px;min-width:180px">
              <div style="font-weight:600;font-size:13px">${this._esc(e.name)}</div>
              <div style="margin-top:4px">
                <span class="grain-badge" style="background:${gi.color}18;color:${gi.color};border:1px solid ${gi.color}40">${gi.short || gi.label}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:6px">${gi.label}</span>
              </div>
              <div style="margin-top:6px;font-size:11px;color:var(--text-muted)">
                ${measures.length} measure${measures.length !== 1 ? 's' : ''}
                ${saCount > 0 ? `<span class="additive-badge additive-sa" style="margin-left:4px">${saCount} SA</span>` : ''}
                ${naCount > 0 ? `<span class="additive-badge additive-na" style="margin-left:4px">${naCount} NA</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Pair compatibility -->
      <h3 style="font-size:14px;font-weight:600;margin-bottom:10px">Event Pair Compatibility</h3>
      <div class="compare-layout" style="margin-bottom:24px">
        ${pairs.map(p => this._renderPairCard(p)).join('')}
      </div>

      <!-- Shared dimensions -->
      ${sharedDims.length > 0 ? `
        <h3 style="font-size:14px;font-weight:600;margin-bottom:10px">Conformed Dimension Candidates</h3>
        <div class="info-banner" style="border-left-color:#4a6cf7">
          These dimension categories appear in <strong>multiple events</strong> — they are candidates for
          <strong>conformed (shared) dimensions</strong>, enabling drill-across analysis between events.
          Apply a template from the <a href="#dimensions" style="color:var(--primary)">Dimension Library</a>
          to pre-fill these with standard columns.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px">
          ${sharedDims.map(d => {
            const cat = (typeof CATEGORIES !== 'undefined' && CATEGORIES[d.category]) || { label: d.category, color: '#6b7280' };
            return `
              <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px 14px">
                <span class="badge-sm" style="background:${cat.color}">${cat.label}</span>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
                  Used in: ${d.events.map(n => this._esc(n)).join(', ')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      <!-- Aggregation guide -->
      <h3 style="font-size:14px;font-weight:600;margin-bottom:10px">Aggregation Patterns</h3>
      <div class="agg-guide">
        <div class="compare-panel">
          <div style="font-weight:600;margin-bottom:8px;color:#166534">Aggregation UP ↑</div>
          <p style="font-size:12px;color:var(--text-muted)">When a fine-grain fact (e.g. Transaction) needs to be compared with a coarser-grain fact (e.g. Monthly Budget), aggregate the fine fact to the coarser level first.</p>
          <div class="agg-up" style="font-size:12px;margin-top:8px">Transaction → Daily → Monthly → Quarterly</div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
            ⚠ <strong>Semi-Additive (SA)</strong> measures cannot be simply summed across time.
            Use period-end snapshots or last-value logic instead.
          </p>
        </div>
        <div class="compare-panel">
          <div style="font-weight:600;margin-bottom:8px;color:#b91c1c">Disaggregation DOWN ↓</div>
          <p style="font-size:12px;color:var(--text-muted)">When a coarse-grain fact (e.g. Monthly Budget) needs to be compared with a finer-grain fact (e.g. Daily Actuals), allocate the coarse fact to the finer level using a driver.</p>
          <div class="agg-down" style="font-size:12px;margin-top:8px">Annual → Quarterly → Monthly → Daily</div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
            <strong>Common drivers:</strong> Equal split · Working days · Historical actuals ratio · Volume-based
          </p>
        </div>
        <div class="compare-panel">
          <div style="font-weight:600;margin-bottom:8px;color:#4a6cf7">Drill-Across 🔗</div>
          <p style="font-size:12px;color:var(--text-muted)">When two same-grain facts share a conformed dimension (e.g. Date, Product), query both separately and join results on the shared dimension key.</p>
          <div class="agg-same" style="font-size:12px;margin-top:8px">Event A ←→ Shared Dim ←→ Event B</div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
            Use the <strong>Dimension Library</strong> to apply standard conformed dimension templates
            and ensure consistent key names across events.
          </p>
        </div>
      </div>
    `;
  },

  _comparePair(eventA, eventB) {
    const grainA = eventA.grain || 'transaction';
    const grainB = eventB.grain || 'transaction';
    const idxA = this.GRAIN_ORDER.indexOf(grainA);
    const idxB = this.GRAIN_ORDER.indexOf(grainB);

    let severity, direction, label, guidance;

    if (idxA === idxB) {
      severity = 'ok';
      direction = 'same';
      label = 'Compatible — same grain';
      guidance = 'These events can be joined directly on shared dimension keys (drill-across pattern).';
    } else if (idxA < idxB) {
      // A is finer than B — to compare, aggregate A up to B's grain
      severity = 'warn';
      direction = 'up';
      label = `Aggregate ${eventA.name} UP to ${GRAINS?.[grainB]?.label || grainB}`;
      guidance = `Roll up ${this._esc(eventA.name)} from ${GRAINS?.[grainA]?.label || grainA} to ${GRAINS?.[grainB]?.label || grainB} grain before joining.`;
    } else {
      // A is coarser than B — to compare, disaggregate A down or aggregate B up
      severity = 'error';
      direction = 'down';
      label = `Disaggregate or aggregate to reconcile`;
      guidance = `${this._esc(eventA.name)} (${GRAINS?.[grainA]?.label || grainA}) is coarser than ${this._esc(eventB.name)} (${GRAINS?.[grainB]?.label || grainB}). Choose: aggregate ${this._esc(eventB.name)} UP, or allocate ${this._esc(eventA.name)} DOWN using a driver.`;
    }

    // SA measures that can't be aggregated across time
    const saMeasuresA = eventA.columns.filter(c => c.category === 'how_many' && c.additiveType === 'semi_additive');
    const saMeasuresB = eventB.columns.filter(c => c.category === 'how_many' && c.additiveType === 'semi_additive');

    // Shared dimension categories
    const catsA = new Set(eventA.columns.filter(c => c.category !== 'how_many').map(c => c.category));
    const catsB = new Set(eventB.columns.filter(c => c.category !== 'how_many').map(c => c.category));
    const shared = [...catsA].filter(c => catsB.has(c));

    return { eventA, eventB, grainA, grainB, severity, direction, label, guidance, saMeasuresA, saMeasuresB, shared };
  },

  _renderPairCard(pair) {
    const { eventA, eventB, grainA, grainB, severity, direction, label, guidance, saMeasuresA, saMeasuresB, shared } = pair;
    const giA = GRAINS?.[grainA] || { label: grainA, color: '#6b7280', short: grainA };
    const giB = GRAINS?.[grainB] || { label: grainB, color: '#6b7280', short: grainB };

    const severityColors = { ok: '#166534', warn: '#92400e', error: '#b91c1c' };
    const sevColor = severityColors[severity] || '#6b7280';

    const arrowSymbol = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '↔';
    const arrowClass = direction === 'up' ? 'agg-up' : direction === 'down' ? 'agg-down' : 'agg-same';

    const saBothEmpty = saMeasuresA.length === 0 && saMeasuresB.length === 0;

    return `
      <div class="compare-panel" style="border-left:4px solid ${sevColor}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <strong style="font-size:13px">${this._esc(eventA.name)}</strong>
          <span class="grain-badge" style="background:${giA.color}18;color:${giA.color};border:1px solid ${giA.color}40">${giA.short}</span>
          <span class="grain-diff-arrow ${arrowClass}">${arrowSymbol}</span>
          <strong style="font-size:13px">${this._esc(eventB.name)}</strong>
          <span class="grain-badge" style="background:${giB.color}18;color:${giB.color};border:1px solid ${giB.color}40">${giB.short}</span>
        </div>
        <span class="compat-badge compat-${severity}">${label}</span>
        <p style="font-size:12px;color:var(--text-muted);margin-top:8px">${guidance}</p>
        ${!saBothEmpty ? `
          <div style="font-size:11px;color:#92400e;margin-top:6px">
            ⚠ Semi-Additive measures requiring special handling:
            ${[...saMeasuresA, ...saMeasuresB].map(m =>
              `<span class="pl-measure-chip" style="font-size:11px"><span class="additive-badge additive-sa">SA</span>${this._esc(m.name)}</span>`
            ).join(' ')}
          </div>
        ` : ''}
        ${shared.length > 0 ? `
          <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">
            Shared dimensions:
            ${shared.map(c => {
              const cat = CATEGORIES?.[c] || { label: c, color: '#6b7280' };
              return `<span class="badge-sm" style="background:${cat.color};font-size:10px">${cat.label}</span>`;
            }).join(' ')}
          </div>
        ` : ''}
      </div>
    `;
  },

  _findSharedDimensions(events) {
    // Find dimension categories that appear in 2+ events
    const catEventMap = {};
    events.forEach(e => {
      const cats = new Set(e.columns.filter(c => c.category !== 'how_many').map(c => c.category));
      cats.forEach(cat => {
        if (!catEventMap[cat]) catEventMap[cat] = [];
        catEventMap[cat].push(e.name);
      });
    });
    return Object.entries(catEventMap)
      .filter(([, names]) => names.length >= 2)
      .map(([category, events]) => ({ category, events }));
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
