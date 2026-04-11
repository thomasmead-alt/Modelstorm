const Architecture = {

  // ─── Project Picker ───────────────────────────────────────────────────────

  renderProjectPicker() {
    const data = Storage.load();
    const app = document.getElementById('app');

    if (!data.projects.length) {
      app.innerHTML = `
        <div class="view-header">
          <div><h1 class="view-title">Architecture</h1></div>
        </div>
        <div class="empty-state">
          <h2 class="empty-title">No projects yet</h2>
          <p class="empty-desc">Create a project and define some events first.</p>
          <button class="btn btn-primary" onclick="Router.navigate('projects')">Go to Projects</button>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Architecture</h1>
          <p class="view-subtitle">Bus Matrix and Architecture Diagrams for your data warehouse projects</p>
        </div>
      </div>
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>Kimball Bus Matrix &amp; Architecture Diagrams</strong> — Select a project to view its
        Bus Matrix (which events share which dimension categories) and an Architecture Diagram showing
        how fact tables connect through conformed and private dimensions.
      </div>
      <div class="project-picker">
        <h3 style="margin:0 0 12px">Select a project</h3>
        <div class="card-grid">
          ${data.projects.map(p => {
            const events = p.events || [];
            // Collect all dim categories (excluding how_many) across all events
            const catsByEvent = events.map(e =>
              [...new Set((e.columns || []).filter(c => c.category !== 'how_many').map(c => c.category))]
            );
            const allCats = [...new Set(catsByEvent.flat())];
            // Shared = category that appears in >=2 events
            const sharedCats = allCats.filter(cat =>
              catsByEvent.filter(eventCats => eventCats.includes(cat)).length >= 2
            );
            return `
              <div class="card" style="cursor:pointer" onclick="Router.navigate('architecture/${p.id}')">
                <div class="card-body">
                  <h3 class="card-title">${this._esc(p.name)}</h3>
                  <div class="card-meta">
                    <span>${events.length} event${events.length !== 1 ? 's' : ''}</span>
                    <span>${allCats.length} dimension categor${allCats.length !== 1 ? 'ies' : 'y'}</span>
                    <span>${sharedCats.length} shared dim${sharedCats.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // ─── Main Render: two-tab layout ─────────────────────────────────────────

  render(projectId, activeTab) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('architecture'); return; }

    const tab = activeTab || 'matrix';
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#project/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <span>Architecture</span>
        </div>
      </div>

      <div class="tab-bar">
        <button class="tab-btn${tab === 'matrix' ? ' active' : ''}"
          onclick="Architecture.render('${project.id}', 'matrix')">Bus Matrix</button>
        <button class="tab-btn${tab === 'diagram' ? ' active' : ''}"
          onclick="Architecture.render('${project.id}', 'diagram')">Architecture Diagram</button>
      </div>

      <div id="architecture-tab-content">
        ${tab === 'matrix'
          ? this._renderBusMatrix(project)
          : this._renderDiagram(project)
        }
      </div>
    `;

    // Initialise pan/zoom after DOM is ready (diagram tab)
    if (tab === 'diagram') {
      this._initDiagramPanZoom();
    }
    // Initialise bus matrix column highlight after DOM is ready
    if (tab === 'matrix') {
      requestAnimationFrame(() => this._initBusInteraction());
    }
  },

  // ─── Bus Matrix ───────────────────────────────────────────────────────────

  _renderBusMatrix(project) {
    const events = project.events || [];

    if (!events.length) {
      return `<div class="empty-state" style="max-width:500px;margin-top:24px">
        <h2 class="empty-title">No events yet</h2>
        <p class="empty-desc">Add business events to this project to generate a Bus Matrix.</p>
      </div>`;
    }

    // Dimension templates lookup (for conformed template names)
    const dimTemplates = (typeof Storage !== 'undefined' && Storage.getAllDimTemplates)
      ? Storage.getAllDimTemplates() : [];

    const catOrder = Object.keys(CATEGORIES).filter(k => k !== 'how_many');

    // ── Build dimension key map ─────────────────────────────────────────────
    // Each unique dimension gets a key; grouped by publicDimensionId or (cat + name)
    const dimMap = new Map();

    events.forEach(event => {
      (event.columns || []).forEach(col => {
        if (col.category === 'how_many' || !col.category) return;
        let key, label, isTemplate = false;
        if (col.publicDimensionId) {
          key = `tmpl:${col.publicDimensionId}`;
          const tmpl = dimTemplates.find(d => d.id === col.publicDimensionId);
          label = tmpl ? tmpl.name : (col.name || col.publicDimensionId);
          isTemplate = true;
        } else {
          const norm = (col.name || col.category).toLowerCase().trim().replace(/\s+/g, '_');
          key = `raw:${col.category}:${norm}`;
          label = col.name || (CATEGORIES[col.category]?.label || col.category);
        }
        if (!dimMap.has(key)) {
          dimMap.set(key, {
            key, label, isTemplate,
            category: col.category,
            catInfo: CATEGORIES[col.category] || { label: col.category, color: '#6b7280' },
            eventIds: new Set(),
            colNames: new Set()
          });
        }
        dimMap.get(key).eventIds.add(event.id);
        dimMap.get(key).colNames.add(col.name);
      });
    });

    // Sort: category order first, then alphabetically within category
    const dims = [...dimMap.values()].sort((a, b) => {
      const ai = catOrder.indexOf(a.category), bi = catOrder.indexOf(b.category);
      if (ai !== bi) return ai - bi;
      return a.label.localeCompare(b.label);
    });
    dims.forEach(d => { d.isConformed = d.eventIds.size >= 2; });

    // ── Sort events ─────────────────────────────────────────────────────────
    const purposeOrder = ['actuals', 'budget', 'forecast', 'financial_plan', 'operational_plan'];
    const grainOrder = ['transaction', 'daily', 'weekly', 'monthly', 'quarterly', 'annual',
      'fiscal_period', 'plan_period', 'plan_range'];
    const sortedEvents = [...events].sort((a, b) => {
      const ap = purposeOrder.indexOf(a.eventPurpose || 'actuals');
      const bp = purposeOrder.indexOf(b.eventPurpose || 'actuals');
      if (ap !== bp) return ap - bp;
      const ag = grainOrder.indexOf(a.grain || 'transaction');
      const bg = grainOrder.indexOf(b.grain || 'transaction');
      return ag - bg;
    });

    // ── Two-level header: category band row + dimension name row ────────────
    const catGroups = [];
    let lastCat = null;
    dims.forEach(d => {
      if (d.category !== lastCat) {
        catGroups.push({ cat: d.category, span: 1 });
        lastCat = d.category;
      } else {
        catGroups[catGroups.length - 1].span++;
      }
    });

    const catBandRow = catGroups.map(g => {
      const ci = CATEGORIES[g.cat] || { label: g.cat, color: '#6b7280' };
      return `<th colspan="${g.span}" class="bus-cat-band"
        style="background:${ci.color}12;border-bottom:2px solid ${ci.color};color:${ci.color}">
        ${this._esc(ci.label)}
      </th>`;
    }).join('');

    const dimHeaderRow = dims.map((d, i) => {
      const borderColor = d.isConformed ? '#4a6cf7' : '#e5e7eb';
      const tooltip = (d.isConformed ? `Conformed — shared by ${d.eventIds.size} events` : 'Private — 1 event')
        + '\nColumns: ' + [...d.colNames].join(', ');
      return `<th class="bus-dim-header" data-dim-idx="${i}" title="${this._esc(tooltip)}"
        style="border-top:3px solid ${borderColor}">
        <div class="bus-dim-name">${this._esc(d.label)}</div>
        ${d.isConformed && d.isTemplate
          ? `<span class="bus-tmpl-tag">⊛</span>`
          : d.isConformed ? `<span class="bus-shared-tag">${d.eventIds.size}×</span>` : ''}
      </th>`;
    }).join('');

    // ── Event rows ───────────────────────────────────────────────────────────
    const rows = sortedEvents.map(event => {
      const grainKey   = event.grain || 'transaction';
      const grainInfo  = (typeof GRAINS !== 'undefined' && GRAINS[grainKey]) || { short: grainKey, color: '#6b7280', bg: '#f9fafb' };
      const purpose    = event.eventPurpose || 'actuals';
      const purposeInfo = (typeof EVENT_PURPOSES !== 'undefined' && EVENT_PURPOSES[purpose])
        || { short: purpose[0]?.toUpperCase() || 'A', color: '#166534', bg: '#dcfce7' };
      const measureCount  = (event.columns || []).filter(c => c.category === 'how_many').length;
      const anchorCount   = (event.columns || []).filter(c => c.isFinancialAnchor).length;
      const glMappings    = (event.glMappings || []).length;

      const cells = dims.map((d, idx) => {
        if (!d.eventIds.has(event.id)) return `<td class="bus-cell-td bus-cell-empty" data-dim-idx="${idx}"></td>`;
        return d.isConformed
          ? `<td class="bus-cell-td" data-dim-idx="${idx}"><span class="bus-cell bus-conformed" title="Conformed — shared by ${d.eventIds.size} events">✓</span></td>`
          : `<td class="bus-cell-td" data-dim-idx="${idx}"><span class="bus-cell bus-private" title="Private to this event">○</span></td>`;
      }).join('');

      return `<tr>
        <th class="bus-event-header">
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
            <a href="#event/${event.id}" class="bus-event-link">${this._esc(event.name)}</a>
            <span class="grain-badge" style="background:${grainInfo.bg};color:${grainInfo.color}">${grainInfo.short}</span>
            ${purpose !== 'actuals'
              ? `<span class="purpose-badge" style="background:${purposeInfo.bg};color:${purposeInfo.color}">${purposeInfo.short}</span>`
              : ''}
            ${anchorCount ? `<span class="bus-anchor-flag" title="Has financial anchor date">⚓</span>` : ''}
            ${glMappings  ? `<span class="bus-gl-flag" title="${glMappings} GL mapping${glMappings !== 1 ? 's' : ''}">GL</span>` : ''}
          </div>
          <div class="bus-event-meta">${measureCount} measure${measureCount !== 1 ? 's' : ''} · ${(event.columns || []).filter(c => c.category !== 'how_many').length} dims</div>
        </th>
        ${cells}
      </tr>`;
    }).join('');

    // ── Summary footer ──────────────────────────────────────────────────────
    const summaryCells = dims.map((d, idx) =>
      `<td class="bus-cell-td" data-dim-idx="${idx}" style="text-align:center;font-size:12px;font-weight:700;color:${d.isConformed ? '#4a6cf7' : '#9ca3af'}">${d.eventIds.size}</td>`
    ).join('');

    const conformedDims = dims.filter(d => d.isConformed);
    const privateDims   = dims.filter(d => !d.isConformed);
    const tmplDims      = dims.filter(d => d.isTemplate && d.isConformed);

    return `
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>Kimball Bus Matrix</strong> — Each column is a specific dimension, grouped by 7W category.
        <span style="color:#4a6cf7;font-weight:700">✓</span> blue = <em>conformed</em> (shared by 2+ events, enables drill-across).
        <span style="color:#9ca3af;font-weight:700">○</span> grey = <em>private</em> (1 event only).
        <strong>⊛</strong> = formally conformed via a shared dimension template.
        Link columns to a <a href="#dimensions" style="color:var(--primary)">dimension template →</a> to register formal conformance.
      </div>

      <div class="bus-stats-row">
        <span>${events.length} event${events.length !== 1 ? 's' : ''}</span>
        <span class="bus-stats-sep">·</span>
        <span><strong style="color:#4a6cf7">${conformedDims.length}</strong> conformed dim${conformedDims.length !== 1 ? 's' : ''}</span>
        <span class="bus-stats-sep">·</span>
        <span>${privateDims.length} private</span>
        <span class="bus-stats-sep">·</span>
        <span><strong>${tmplDims.length}</strong> via shared template</span>
        <span style="margin-left:auto;display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="Architecture._exportBusMatrixCSV('${project.id}')">⬇ CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="Architecture._printBusMatrix('${project.id}')">🖨 Print</button>
        </span>
      </div>

      <div class="bus-matrix-wrapper">
        <table class="bus-matrix">
          <thead>
            <tr>
              <th class="bus-corner" rowspan="2">Event</th>
              ${catBandRow}
            </tr>
            <tr>
              ${dimHeaderRow}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="bus-summary-row">
              <th class="bus-event-header bus-summary-label">Events using</th>
              ${summaryCells}
            </tr>
          </tfoot>
        </table>
      </div>

      ${conformedDims.length === 0 ? `
      <div class="bus-hint-panel">
        <strong>No conformed dimensions yet.</strong>
        Link the same <a href="#dimensions">dimension template</a> to columns in 2+ events,
        or give the same column name to a dimension across 2+ events — it will appear as conformed.
      </div>` : ''}
    `;
  },

  // ─── Architecture Diagram ─────────────────────────────────────────────────

  _renderDiagram(project) {
    const events = project.events || [];

    if (!events.length) {
      return `<div class="empty-state" style="max-width:500px;margin-top:24px">
        <h2 class="empty-title">No events yet</h2>
        <p class="empty-desc">Add business events to this project to generate an Architecture Diagram.</p>
      </div>`;
    }

    // Reuse the same dimMap logic as the bus matrix — specific dimensions, not categories
    const dimTemplates = (typeof Storage !== 'undefined' && Storage.getAllDimTemplates)
      ? Storage.getAllDimTemplates() : [];
    const catOrder = Object.keys(CATEGORIES).filter(k => k !== 'how_many');

    const dimMap = new Map();
    events.forEach(event => {
      (event.columns || []).forEach(col => {
        if (col.category === 'how_many' || !col.category) return;
        let key, label, isTemplate = false;
        if (col.publicDimensionId) {
          key = `tmpl:${col.publicDimensionId}`;
          const tmpl = dimTemplates.find(d => d.id === col.publicDimensionId);
          label = tmpl ? tmpl.name : (col.name || col.publicDimensionId);
          isTemplate = true;
        } else {
          const norm = (col.name || col.category).toLowerCase().trim().replace(/\s+/g, '_');
          key = `raw:${col.category}:${norm}`;
          label = col.name || (CATEGORIES[col.category]?.label || col.category);
        }
        if (!dimMap.has(key)) {
          dimMap.set(key, { key, label, isTemplate, category: col.category,
            catInfo: CATEGORIES[col.category] || { label: col.category, color: '#6b7280' },
            eventIds: new Set() });
        }
        dimMap.get(key).eventIds.add(event.id);
      });
    });

    const allDims = [...dimMap.values()].sort((a, b) => {
      const ai = catOrder.indexOf(a.category), bi = catOrder.indexOf(b.category);
      return ai !== bi ? ai - bi : a.label.localeCompare(b.label);
    });
    allDims.forEach(d => { d.isConformed = d.eventIds.size >= 2; });

    const conformedDims = allDims.filter(d => d.isConformed);
    const privateDims   = allDims.filter(d => !d.isConformed);

    // ── Layout ──────────────────────────────────────────────────────────────
    const NODE_W = 150, FACT_H = 60, DIM_H = 46;
    const HGAP = 20, FACT_Y = 70, CONF_Y = 250, PRIV_Y = 420;

    const totalFactW = events.length * (NODE_W + HGAP) - HGAP;
    const totalConfW = conformedDims.length * (NODE_W + HGAP) - HGAP;
    const totalPrivW = privateDims.length  * (NODE_W + HGAP) - HGAP;
    const W = Math.max(960, Math.max(totalFactW, totalConfW, totalPrivW) + 80);
    const H = privateDims.length ? 530 : 380;

    const cx = W / 2;
    const factStartX  = cx - totalFactW / 2 + NODE_W / 2;
    const confStartX  = conformedDims.length ? cx - totalConfW / 2 + NODE_W / 2 : cx;
    const privStartX  = privateDims.length  ? cx - totalPrivW  / 2 + NODE_W / 2 : cx;

    const factNodes = events.map((event, i) => {
      const grainInfo = (typeof GRAINS !== 'undefined' && GRAINS[event.grain || 'transaction'])
        || { short: 'TXN', color: '#6b7280', bg: '#f9fafb' };
      const purpose = event.eventPurpose || 'actuals';
      const purposeInfo = (typeof EVENT_PURPOSES !== 'undefined' && EVENT_PURPOSES[purpose]) || null;
      return { id: event.id, label: event.name, grainShort: grainInfo.short, grainColor: grainInfo.color,
        purposeColor: purposeInfo && purpose !== 'actuals' ? purposeInfo.color : null,
        x: factStartX + i * (NODE_W + HGAP), y: FACT_Y, w: NODE_W, h: FACT_H };
    });

    const conformedNodes = conformedDims.map((d, i) => ({
      ...d, x: confStartX + i * (NODE_W + HGAP), y: CONF_Y, w: NODE_W, h: DIM_H
    }));

    // Private dims: cluster near their owning fact
    const privateNodes = privateDims.map(d => {
      // Place near the single event that uses it
      const eventId = [...d.eventIds][0];
      const fn = factNodes.find(f => f.id === eventId);
      return { ...d, ownerFactId: eventId, anchorX: fn ? fn.x : cx };
    });
    // Sort by anchorX then spread horizontally at PRIV_Y
    privateNodes.sort((a, b) => a.anchorX - b.anchorX);
    privateNodes.forEach((pn, i) => {
      pn.x = privStartX + i * (NODE_W + HGAP);
      pn.y = PRIV_Y;
      pn.w = NODE_W;
      pn.h = DIM_H;
    });

    // ── SVG ─────────────────────────────────────────────────────────────────
    const parts = [];

    parts.push(`<defs>
      <marker id="ah-conf" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
        <polygon points="0 0,7 2.5,0 5" fill="#4a6cf7" opacity="0.8"/>
      </marker>
      <marker id="ah-priv" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
        <polygon points="0 0,7 2.5,0 5" fill="#9ca3af" opacity="0.7"/>
      </marker>
    </defs>`);

    // Row labels
    parts.push(`<text x="14" y="${FACT_Y - 10}" font-size="10" fill="#9ca3af" font-style="italic" font-family="sans-serif">Fact Tables</text>`);
    if (conformedNodes.length)
      parts.push(`<text x="14" y="${CONF_Y - 10}" font-size="10" fill="#9ca3af" font-style="italic" font-family="sans-serif">Conformed Dimensions</text>`);
    if (privateNodes.length)
      parts.push(`<text x="14" y="${PRIV_Y - 10}" font-size="10" fill="#9ca3af" font-style="italic" font-family="sans-serif">Private Dimensions</text>`);

    // Edges: fact → conformed (solid, coloured by dim category)
    conformedNodes.forEach(cn => {
      factNodes.forEach(fn => {
        if (!cn.eventIds.has(fn.id)) return;
        const y1 = fn.y + fn.h, y2 = cn.y, mid = (y1 + y2) / 2;
        parts.push(`<path d="M${fn.x},${y1} C${fn.x},${mid} ${cn.x},${mid} ${cn.x},${y2}"
          fill="none" stroke="${cn.catInfo.color}" stroke-width="1.8" opacity="0.6"
          marker-end="url(#ah-conf)"/>`);
      });
    });

    // Edges: fact → private (dashed grey)
    privateNodes.forEach(pn => {
      const fn = factNodes.find(f => f.id === pn.ownerFactId);
      if (!fn) return;
      const y1 = fn.y + fn.h, y2 = pn.y, mid = (y1 + y2) / 2;
      parts.push(`<path d="M${fn.x},${y1} C${fn.x},${mid} ${pn.x},${mid} ${pn.x},${y2}"
        fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4,3"
        marker-end="url(#ah-priv)"/>`);
    });

    // Fact nodes
    factNodes.forEach(fn => {
      const rx = fn.x - fn.w / 2, ry = fn.y;
      const lbl = fn.label.length > 20 ? fn.label.slice(0, 18) + '…' : fn.label;
      parts.push(`<g class="arch-fact-node" style="cursor:pointer" onclick="Router.navigate('event/${fn.id}')">
        <rect x="${rx}" y="${ry}" width="${fn.w}" height="${fn.h}" rx="6"
          fill="#fff7ed" stroke="#e85d04" stroke-width="2"/>
        <text x="${fn.x}" y="${ry + 20}" text-anchor="middle"
          font-size="11" font-weight="700" fill="#9a3412" font-family="sans-serif">${this._esc(lbl)}</text>
        <text x="${fn.x}" y="${ry + 36}" text-anchor="middle"
          font-size="10" fill="${fn.grainColor}" font-weight="600" font-family="sans-serif">${this._esc(fn.grainShort)}</text>
        ${fn.purposeColor ? `<text x="${fn.x}" y="${ry + 52}" text-anchor="middle"
          font-size="9" fill="${fn.purposeColor}" font-family="sans-serif">plan</text>` : ''}
      </g>`);
    });

    // Conformed dim nodes — coloured by category, ⊛ if template-linked
    conformedNodes.forEach(cn => {
      const rx = cn.x - cn.w / 2, ry = cn.y;
      const usageCount = cn.eventIds.size;
      const lbl = cn.label.length > 19 ? cn.label.slice(0, 17) + '…' : cn.label;
      parts.push(`<g class="arch-conformed-node">
        <rect x="${rx}" y="${ry}" width="${cn.w}" height="${cn.h}" rx="8"
          fill="${cn.catInfo.color}15" stroke="${cn.catInfo.color}" stroke-width="2"/>
        <text x="${cn.x - (cn.isTemplate ? 8 : 0)}" y="${ry + 18}" text-anchor="middle"
          font-size="11" font-weight="700" fill="${cn.catInfo.color}" font-family="sans-serif">${this._esc(lbl)}</text>
        <text x="${cn.x}" y="${ry + 34}" text-anchor="middle"
          font-size="9" fill="${cn.catInfo.color}99" font-family="sans-serif">${usageCount} events</text>
        ${cn.isTemplate ? `<text x="${rx + cn.w - 8}" y="${ry + 18}" text-anchor="middle"
          font-size="11" fill="${cn.catInfo.color}" font-weight="700" font-family="sans-serif">⊛</text>` : ''}
      </g>`);
    });

    // Private dim nodes — grey, labelled with dim name
    privateNodes.forEach(pn => {
      const rx = pn.x - pn.w / 2, ry = pn.y;
      const lbl = pn.label.length > 19 ? pn.label.slice(0, 17) + '…' : pn.label;
      parts.push(`<g class="arch-private-node">
        <rect x="${rx}" y="${ry}" width="${pn.w}" height="${pn.h}" rx="6"
          fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
        <text x="${pn.x}" y="${ry + 17}" text-anchor="middle"
          font-size="10" font-weight="600" fill="#64748b" font-family="sans-serif">${this._esc(lbl)}</text>
        <text x="${pn.x}" y="${ry + 32}" text-anchor="middle"
          font-size="9" fill="#94a3b8" font-family="sans-serif">${this._esc(pn.catInfo.label)}</text>
      </g>`);
    });

    return `
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>Architecture Diagram</strong> — Each node is a specific dimension (same resolution as the Bus Matrix).
        Edge colour matches the dimension's 7W category. <strong>Solid</strong> = conformed (≥2 facts).
        <strong>Dashed</strong> = private. <strong>⊛</strong> = linked to a shared template.
        Click a fact node to open its matrix.
      </div>

      <div class="diagram-toolbar">
        <button class="btn btn-ghost btn-sm" id="archZoomIn">+ Zoom In</button>
        <button class="btn btn-ghost btn-sm" id="archZoomOut">− Zoom Out</button>
        <button class="btn btn-ghost btn-sm" id="archZoomReset">Reset</button>
        <button class="btn btn-ghost btn-sm" onclick="Architecture._downloadSVG()">⬇ SVG</button>
        <span class="diagram-hint">Drag to pan · Scroll to zoom · Click fact to open</span>
      </div>

      <div class="diagram-container" id="archDiagramContainer" style="cursor:grab">
        <svg id="archDiagramSvg" viewBox="0 0 ${W} ${H}"
          xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
          ${parts.join('\n          ')}
        </svg>
      </div>

      <div class="diagram-legend" style="margin-top:12px">
        <div class="legend-item">
          <span style="display:inline-block;width:16px;height:16px;background:#fff7ed;border:2px solid #e85d04;border-radius:3px;vertical-align:middle;margin-right:4px"></span>Fact Table
        </div>
        <div class="legend-item">
          <span style="display:inline-block;width:16px;height:16px;background:#4a6cf715;border:2px solid #4a6cf7;border-radius:4px;vertical-align:middle;margin-right:4px"></span>Conformed Dimension
        </div>
        <div class="legend-item">
          <span style="display:inline-block;width:16px;height:16px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:3px;vertical-align:middle;margin-right:4px"></span>Private Dimension
        </div>
        <div class="legend-item"><strong>⊛</strong> &nbsp;Linked to shared template</div>
      </div>
    `;
  },

  // ─── Diagram pan/zoom init (called after DOM is ready) ────────────────────

  _initDiagramPanZoom() {
    const container = document.getElementById('archDiagramContainer');
    const svg = document.getElementById('archDiagramSvg');
    if (!container || !svg) return;

    let scale = 1, panX = 0, panY = 0;
    let dragging = false, startX, startY, startPanX, startPanY;

    const apply = () => {
      svg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      svg.style.transformOrigin = '50% 50%';
    };

    container.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      scale = Math.min(3, Math.max(0.3, scale + delta));
      apply();
    }, { passive: false });

    container.addEventListener('mousedown', e => {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startPanX = panX; startPanY = panY;
      container.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      apply();
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
      container.style.cursor = 'grab';
    });

    const zoomIn    = document.getElementById('archZoomIn');
    const zoomOut   = document.getElementById('archZoomOut');
    const zoomReset = document.getElementById('archZoomReset');
    if (zoomIn)    zoomIn.onclick    = () => { scale = Math.min(3, scale + 0.15); apply(); };
    if (zoomOut)   zoomOut.onclick   = () => { scale = Math.max(0.3, scale - 0.15); apply(); };
    if (zoomReset) zoomReset.onclick = () => { scale = 1; panX = 0; panY = 0; apply(); };
  },

  // ─── Bus matrix column highlight on click ────────────────────────────────

  _initBusInteraction() {
    const headers = document.querySelectorAll('.bus-dim-header[data-dim-idx]');
    headers.forEach(th => {
      th.style.cursor = 'pointer';
      th.setAttribute('title', (th.getAttribute('title') || '') + '\nClick to highlight column');
      th.addEventListener('click', () => {
        const idx = th.dataset.dimIdx;
        const isActive = th.classList.contains('bus-col-active');
        // Clear all existing highlights
        document.querySelectorAll('.bus-col-active').forEach(el => el.classList.remove('bus-col-active'));
        if (!isActive) {
          th.classList.add('bus-col-active');
          document.querySelectorAll(`.bus-cell-td[data-dim-idx="${idx}"]`).forEach(td => td.classList.add('bus-col-active'));
        }
      });
    });
  },

  // ─── SVG download for architecture diagram ────────────────────────────────

  _downloadSVG() {
    const svg = document.getElementById('archDiagramSvg');
    if (!svg) return;
    const ser = new XMLSerializer();
    let src = ser.serializeToString(svg);
    if (!src.includes('xmlns="http://www.w3.org/2000/svg"'))
      src = src.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    src = '<?xml version="1.0" encoding="UTF-8"?>\n' + src;
    const blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'architecture-diagram.svg'; a.click();
    URL.revokeObjectURL(url);
  },

  // ─── Print bus matrix ─────────────────────────────────────────────────────

  _printBusMatrix(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const table = document.querySelector('.bus-matrix');
    if (!table) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bus Matrix — ${this._esc(project.name)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 1.5rem; color: #111; }
    h1 { font-size: 1.2rem; margin-bottom: 0.5rem; }
    .meta { color: #666; font-size: 0.8rem; margin-bottom: 1rem; }
    table { border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: center; }
    thead th { background: #1c1c28; color: #fff; }
    th:first-child, td:first-child { text-align: left; min-width: 160px; }
    tbody tr:nth-child(even) td { background: #f9fafb; }
    tfoot td, tfoot th { background: #f3f4f6; font-weight: 700; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>Kimball Bus Matrix: ${this._esc(project.name)}</h1>
  <div class="meta">Generated ${new Date().toLocaleString()}</div>
  ${table.outerHTML}
  <p style="margin-top:1.5rem"><button onclick="window.print()">Print / Save as PDF</button></p>
</body>
</html>`);
    win.document.close();
  },

  // ─── CSV export of bus matrix ─────────────────────────────────────────────

  _exportBusMatrixCSV(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const events = project.events || [];
    const dimTemplates = (typeof Storage !== 'undefined' && Storage.getAllDimTemplates)
      ? Storage.getAllDimTemplates() : [];
    const catOrder = Object.keys(CATEGORIES).filter(k => k !== 'how_many');
    const dimMap = new Map();
    events.forEach(event => {
      (event.columns || []).forEach(col => {
        if (col.category === 'how_many' || !col.category) return;
        let key, label;
        if (col.publicDimensionId) {
          key = `tmpl:${col.publicDimensionId}`;
          const tmpl = dimTemplates.find(d => d.id === col.publicDimensionId);
          label = tmpl ? tmpl.name : (col.name || col.publicDimensionId);
        } else {
          const norm = (col.name || col.category).toLowerCase().trim().replace(/\s+/g, '_');
          key = `raw:${col.category}:${norm}`;
          label = col.name || (CATEGORIES[col.category]?.label || col.category);
        }
        if (!dimMap.has(key)) {
          dimMap.set(key, { key, label, category: col.category, eventIds: new Set() });
        }
        dimMap.get(key).eventIds.add(event.id);
      });
    });
    const dims = [...dimMap.values()].sort((a, b) => {
      const ai = catOrder.indexOf(a.category), bi = catOrder.indexOf(b.category);
      return ai !== bi ? ai - bi : a.label.localeCompare(b.label);
    });
    dims.forEach(d => { d.isConformed = d.eventIds.size >= 2; });

    const q = s => `"${String(s).replace(/"/g, '""')}"`;
    const header = ['Event', 'Grain', 'Purpose', ...dims.map(d => d.label)];
    const rows = events.map(event => {
      const grain = (typeof GRAINS !== 'undefined' && GRAINS[event.grain || 'transaction'])?.label || event.grain || '';
      const purpose = (typeof EVENT_PURPOSES !== 'undefined' && EVENT_PURPOSES[event.eventPurpose || 'actuals'])?.label || event.eventPurpose || 'Actuals';
      const cells = dims.map(d => d.eventIds.has(event.id) ? (d.isConformed ? 'Conformed' : 'Private') : '');
      return [event.name, grain, purpose, ...cells];
    });

    const csv = [header, ...rows].map(row => row.map(q).join(',')).join('\n');
    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${slug}-bus-matrix.csv`; a.click();
    URL.revokeObjectURL(url);
  },

  // ─── HTML escape helper ───────────────────────────────────────────────────

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
