const GrainAnalysis = {

  // Grain order for comparison (finer → coarser)
  GRAIN_ORDER: ['transaction', 'daily', 'weekly', 'monthly', 'quarterly', 'annual'],

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

  render(projectId) {
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

    // Build compatibility matrix
    const pairs = [];
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        pairs.push(this._comparePair(events[i], events[j]));
      }
    }

    // Sort: most severe first (error > warn > ok)
    pairs.sort((a, b) => {
      const score = { error: 2, warn: 1, ok: 0 };
      return (score[b.severity] || 0) - (score[a.severity] || 0);
    });

    // Shared dimensions across all events
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
          const gi = GRAINS?.[grain] || { label: grain, color: '#6b7280', short: grain };
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
            const cat = CATEGORIES?.[d.category] || { label: d.category, color: '#6b7280' };
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
          <div class="agg-up" style="font-size:12px;margin-top:8px">
            Transaction → Daily → Monthly → Quarterly
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
            ⚠ <strong>Semi-Additive (SA)</strong> measures cannot be simply summed across time.
            Use period-end snapshots or last-value logic instead.
          </p>
          <p style="font-size:12px;color:var(--text-muted)">
            ⚠ <strong>Non-Additive (NA)</strong> measures (%, ratios) must be recalculated
            from their numerator/denominator components at the target grain.
          </p>
        </div>
        <div class="compare-panel">
          <div style="font-weight:600;margin-bottom:8px;color:#b91c1c">Disaggregation DOWN ↓</div>
          <p style="font-size:12px;color:var(--text-muted)">When a coarse-grain fact (e.g. Monthly Budget) needs to be compared with a finer-grain fact (e.g. Daily Actuals), allocate the coarse fact to the finer level using a driver.</p>
          <div class="agg-down" style="font-size:12px;margin-top:8px">
            Annual → Quarterly → Monthly → Daily
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
            <strong>Common allocation drivers:</strong>
          </p>
          <ul style="font-size:12px;color:var(--text-muted);padding-left:16px;margin:4px 0">
            <li>Equal split (1/N periods)</li>
            <li>Working days in period</li>
            <li>Historical actuals ratio</li>
            <li>Volume-based (units, headcount)</li>
          </ul>
          <p style="font-size:12px;color:var(--text-muted)">
            Budget vs Actuals variance analysis is the classic case: budget at monthly grain vs
            daily transaction actuals.
          </p>
        </div>
        <div class="compare-panel">
          <div style="font-weight:600;margin-bottom:8px;color:#4a6cf7">Drill-Across 🔗</div>
          <p style="font-size:12px;color:var(--text-muted)">When two same-grain facts share a conformed dimension (e.g. Date, Product), you can query both fact tables separately and join the results on the shared dimension key.</p>
          <div class="agg-same" style="font-size:12px;margin-top:8px">
            Event A ←→ Shared Dim ←→ Event B
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
            Example: Sales fact and Cost fact both link to the same Date and Product dimensions,
            enabling Gross Margin calculation without a direct join between the two facts.
          </p>
          <p style="font-size:12px;color:var(--text-muted)">
            Use the <strong>Dimension Library</strong> to apply standard conformed dimension
            templates and ensure consistent key names across events.
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
