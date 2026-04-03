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

    // Category ordering from CATEGORIES object
    const catOrder = Object.keys(CATEGORIES).filter(k => k !== 'how_many');

    // All dim categories that appear across ANY event
    const allCats = catOrder.filter(cat =>
      events.some(e => (e.columns || []).some(c => c.category === cat))
    );

    // For each category, which events use it?
    const catEventCount = {};
    allCats.forEach(cat => {
      catEventCount[cat] = events.filter(e =>
        (e.columns || []).some(c => c.category === cat)
      ).length;
    });

    // Conformed = used in >=2 events
    const conformedCats = new Set(allCats.filter(cat => catEventCount[cat] >= 2));

    // Grain order
    const grainOrder = ['transaction', 'daily', 'weekly', 'monthly', 'quarterly', 'annual'];
    const sortedEvents = [...events].sort((a, b) => {
      const ai = grainOrder.indexOf(a.grain || 'transaction');
      const bi = grainOrder.indexOf(b.grain || 'transaction');
      return ai - bi;
    });

    // Build table header
    const headerCells = allCats.map(cat => {
      const catInfo = CATEGORIES[cat] || { label: cat, color: '#6b7280' };
      return `<th class="bus-cat-header">
        <a href="#dimensions" title="View dimension library">
          <span class="bus-cat-badge" style="background:${catInfo.color}20;color:${catInfo.color};border:1px solid ${catInfo.color}40;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap">${this._esc(catInfo.label)}</span>
        </a>
      </th>`;
    }).join('');

    // Build rows
    const rows = sortedEvents.map(event => {
      const grainKey = event.grain || 'transaction';
      const grainInfo = GRAINS[grainKey] || { label: grainKey, short: grainKey.toUpperCase(), color: '#6b7280', bg: '#f9fafb' };
      const eventCats = new Set((event.columns || []).filter(c => c.category !== 'how_many').map(c => c.category));

      const cells = allCats.map(cat => {
        if (eventCats.has(cat)) {
          if (conformedCats.has(cat)) {
            return `<td class="bus-cell-td"><span class="bus-cell bus-conformed" title="Conformed — shared by ${catEventCount[cat]} events">✓</span></td>`;
          } else {
            return `<td class="bus-cell-td"><span class="bus-cell bus-private" title="Private — only used by this event">○</span></td>`;
          }
        } else {
          return `<td class="bus-cell-td"><span class="bus-cell bus-empty"></span></td>`;
        }
      }).join('');

      return `<tr>
        <th class="bus-event-header">
          <a href="#event/${event.id}" style="color:inherit;text-decoration:none;font-weight:600">${this._esc(event.name)}</a>
          <span class="grain-badge" style="background:${grainInfo.bg};color:${grainInfo.color};margin-left:6px;font-size:10px">${grainInfo.short}</span>
        </th>
        ${cells}
      </tr>`;
    }).join('');

    // Summary row
    const summaryCells = allCats.map(cat => {
      const count = catEventCount[cat];
      return `<td class="bus-cell-td" style="text-align:center;font-size:12px;font-weight:600;color:${conformedCats.has(cat) ? '#4a6cf7' : '#9ca3af'}">${count}</td>`;
    }).join('');

    // Conformed / private summary
    const conformedList = allCats.filter(cat => conformedCats.has(cat));
    const privateList   = allCats.filter(cat => !conformedCats.has(cat));

    const conformedBadges = conformedList.map(cat => {
      const catInfo = CATEGORIES[cat] || { label: cat, color: '#4a6cf7' };
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:${catInfo.color}18;color:${catInfo.color};border:1px solid ${catInfo.color}40;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;margin:3px">
        ${this._esc(catInfo.label)}
        <span style="background:${catInfo.color};color:#fff;border-radius:8px;padding:0 5px;font-size:10px">${catEventCount[cat]}</span>
      </span>`;
    }).join('');

    const privateBadges = privateList.map(cat => {
      const catInfo = CATEGORIES[cat] || { label: cat, color: '#9ca3af' };
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;padding:3px 10px;border-radius:12px;font-size:12px;margin:3px">
        ${this._esc(catInfo.label)}
      </span>`;
    }).join('');

    return `
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>The Kimball Bus Matrix</strong> shows which events (fact tables) use which dimension
        categories. A <span style="color:#4a6cf7;font-weight:700">✓</span> (blue) means the dimension
        is <em>conformed</em> — shared by 2+ events, making drill-across queries possible.
        A <span style="color:#9ca3af;font-weight:700">○</span> (grey) means the dimension is
        <em>private</em> to that event only.
      </div>

      <div class="bus-matrix-wrapper">
        <table class="bus-matrix">
          <thead>
            <tr>
              <th class="bus-corner">Event / Dimension</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr class="bus-summary-row">
              <th class="bus-event-header" style="font-size:11px;color:var(--text-muted)">Events using dim</th>
              ${summaryCells}
            </tr>
          </tfoot>
        </table>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px">
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:16px">
          <h4 style="margin:0 0 10px;font-size:13px;font-weight:600;color:#4a6cf7">
            ✓ Conformed Dimensions (${conformedList.length})
          </h4>
          ${conformedList.length
            ? `<div style="display:flex;flex-wrap:wrap">${conformedBadges}</div>`
            : `<p style="font-size:12px;color:var(--text-muted);margin:0">No conformed dimensions yet — add the same category to 2+ events.</p>`
          }
        </div>
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:16px">
          <h4 style="margin:0 0 10px;font-size:13px;font-weight:600;color:#6b7280">
            ○ Private Dimensions (${privateList.length})
          </h4>
          ${privateList.length
            ? `<div style="display:flex;flex-wrap:wrap">${privateBadges}</div>`
            : `<p style="font-size:12px;color:var(--text-muted);margin:0">No private dimensions.</p>`
          }
        </div>
      </div>
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

    const catOrder = Object.keys(CATEGORIES).filter(k => k !== 'how_many');

    // All dim categories per event
    const eventCatMap = events.map(e => ({
      event: e,
      cats: [...new Set((e.columns || []).filter(c => c.category !== 'how_many').map(c => c.category))]
    }));

    // All dim categories across all events
    const allCats = catOrder.filter(cat =>
      events.some(e => (e.columns || []).some(c => c.category === cat))
    );

    // Conformed = used in >=2 events
    const catEventCount = {};
    allCats.forEach(cat => {
      catEventCount[cat] = events.filter(e =>
        (e.columns || []).some(c => c.category === cat)
      ).length;
    });
    const conformedCats = allCats.filter(cat => catEventCount[cat] >= 2);
    const privateCats   = allCats.filter(cat => catEventCount[cat] < 2);

    // ── Layout ──
    const W = 960, H = 600;

    // Fact nodes: spread horizontally at y=80
    const factY = 80;
    const factW = 180, factH = 60;
    const factSpacing = Math.max(factW + 40, W / Math.max(events.length, 1));
    const factStartX = (W - (events.length - 1) * factSpacing) / 2;

    const factNodes = events.map((event, i) => {
      const grainKey = event.grain || 'transaction';
      const grainInfo = GRAINS[grainKey] || { label: grainKey, short: grainKey.toUpperCase(), color: '#6b7280' };
      return {
        id: event.id,
        label: event.name,
        grainShort: grainInfo.short,
        grainColor: grainInfo.color,
        x: factStartX + i * factSpacing,
        y: factY,
        w: factW,
        h: factH,
        type: 'fact'
      };
    });

    // Conformed dim nodes: spread horizontally at y=300
    const conformedY = 300;
    const conformedW = 140, conformedH = 50;
    const confSpacing = Math.max(conformedW + 30, W / Math.max(conformedCats.length, 1));
    const confStartX = conformedCats.length > 0
      ? (W - (conformedCats.length - 1) * confSpacing) / 2
      : W / 2;

    const conformedNodes = conformedCats.map((cat, i) => {
      const catInfo = CATEGORIES[cat] || { label: cat, color: '#4a6cf7' };
      return {
        id: `conf_${cat}`,
        cat,
        label: catInfo.label,
        color: catInfo.color,
        x: confStartX + i * confSpacing,
        y: conformedY,
        w: conformedW,
        h: conformedH,
        type: 'conformed'
      };
    });

    // Private dim nodes: place near the fact table that uses them
    const privateY = 480;
    const privateW = 120, privateH = 40;

    // Build a map: factIdx → list of private cats for that fact
    const factPrivateCats = factNodes.map(fn => {
      const event = events.find(e => e.id === fn.id);
      const ec = eventCatMap.find(m => m.event.id === fn.id);
      return (ec ? ec.cats : []).filter(c => privateCats.includes(c));
    });

    const privateNodes = [];
    factPrivateCats.forEach((cats, fi) => {
      const factX = factNodes[fi].x;
      const total = cats.length;
      cats.forEach((cat, ci) => {
        const catInfo = CATEGORIES[cat] || { label: cat, color: '#9ca3af' };
        const offset = (ci - (total - 1) / 2) * (privateW + 16);
        privateNodes.push({
          id: `priv_${fi}_${cat}`,
          cat,
          label: catInfo.label,
          color: catInfo.color,
          factId: factNodes[fi].id,
          x: factX + offset,
          y: privateY,
          w: privateW,
          h: privateH,
          type: 'private'
        });
      });
    });

    // ── SVG elements ──
    const svgParts = [];

    // Defs: arrowhead
    svgParts.push(`<defs>
      <marker id="arrowhead-conf" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#4a6cf7" opacity="0.7"/>
      </marker>
      <marker id="arrowhead-priv" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" opacity="0.7"/>
      </marker>
    </defs>`);

    // Edges: fact → conformed dims
    conformedNodes.forEach(cn => {
      factNodes.forEach(fn => {
        const ec = eventCatMap.find(m => m.event.id === fn.id);
        if (ec && ec.cats.includes(cn.cat)) {
          const x1 = fn.x, y1 = fn.y + fn.h;
          const x2 = cn.x, y2 = cn.y;
          const midY = (y1 + y2) / 2;
          svgParts.push(`<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}"
            fill="none" stroke="#4a6cf7" stroke-width="2"
            marker-end="url(#arrowhead-conf)"/>`);
        }
      });
    });

    // Edges: fact → private dims
    privateNodes.forEach(pn => {
      const fn = factNodes.find(f => f.id === pn.factId);
      if (!fn) return;
      const x1 = fn.x, y1 = fn.y + fn.h;
      const x2 = pn.x, y2 = pn.y;
      const midY = (y1 + y2) / 2;
      svgParts.push(`<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}"
        fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="5,3"
        marker-end="url(#arrowhead-priv)"/>`);
    });

    // Fact nodes
    factNodes.forEach(fn => {
      const rx = fn.x - fn.w / 2, ry = fn.y - fn.h / 2;
      svgParts.push(`<g class="arch-fact-node">
        <rect x="${rx}" y="${ry}" width="${fn.w}" height="${fn.h}" rx="6"
          fill="#fff7ed" stroke="#e85d04" stroke-width="2"/>
        <text x="${fn.x}" y="${ry + 22}" text-anchor="middle"
          font-size="12" font-weight="700" fill="#9a3412">${this._esc(fn.label.slice(0, 22) + (fn.label.length > 22 ? '…' : ''))}</text>
        <text x="${fn.x}" y="${ry + 42}" text-anchor="middle"
          font-size="10" fill="${fn.grainColor}" font-weight="600">${this._esc(fn.grainShort)}</text>
      </g>`);
    });

    // Conformed dim nodes
    conformedNodes.forEach(cn => {
      const rx = cn.x - cn.w / 2, ry = cn.y - cn.h / 2;
      svgParts.push(`<g class="arch-conformed-node">
        <rect x="${rx}" y="${ry}" width="${cn.w}" height="${cn.h}" rx="8"
          fill="${cn.color}18" stroke="${cn.color}" stroke-width="2"/>
        <text x="${cn.x}" y="${cn.y + 5}" text-anchor="middle"
          font-size="11" font-weight="700" fill="${cn.color}">${this._esc(cn.label)}</text>
      </g>`);
    });

    // Private dim nodes
    privateNodes.forEach(pn => {
      const rx = pn.x - pn.w / 2, ry = pn.y - pn.h / 2;
      svgParts.push(`<g class="arch-private-node">
        <rect x="${rx}" y="${ry}" width="${pn.w}" height="${pn.h}" rx="5"
          fill="#f9fafb" stroke="#d1d5db" stroke-width="1.5"/>
        <text x="${pn.x}" y="${pn.y + 4}" text-anchor="middle"
          font-size="10" fill="#6b7280">${this._esc(pn.label)}</text>
      </g>`);
    });

    // Row labels
    if (factNodes.length) {
      svgParts.push(`<text x="8" y="${factY + 5}" font-size="10" fill="#9ca3af" font-style="italic">Fact Tables</text>`);
    }
    if (conformedNodes.length) {
      svgParts.push(`<text x="8" y="${conformedY + 5}" font-size="10" fill="#9ca3af" font-style="italic">Conformed Dims</text>`);
    }
    if (privateNodes.length) {
      svgParts.push(`<text x="8" y="${privateY + 5}" font-size="10" fill="#9ca3af" font-style="italic">Private Dims</text>`);
    }

    return `
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>Architecture Diagram</strong> — This diagram shows all fact tables (events) connected
        through their shared and private dimensions.
        <strong>Solid lines</strong> connect to conformed (shared) dimensions.
        <strong>Dashed lines</strong> connect to private dimensions.
      </div>

      <div class="diagram-toolbar">
        <button class="btn btn-ghost btn-sm" id="archZoomIn">+ Zoom In</button>
        <button class="btn btn-ghost btn-sm" id="archZoomOut">− Zoom Out</button>
        <button class="btn btn-ghost btn-sm" id="archZoomReset">Reset</button>
        <span class="diagram-hint">Drag to pan &nbsp;·&nbsp; Scroll to zoom</span>
      </div>

      <div class="diagram-container" id="archDiagramContainer" style="cursor:grab">
        <svg id="archDiagramSvg" viewBox="0 0 ${W} ${H}"
          xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
          ${svgParts.join('\n          ')}
        </svg>
      </div>

      <div class="diagram-legend" style="margin-top:12px">
        <div class="legend-item">
          <span style="display:inline-block;width:16px;height:16px;background:#fff7ed;border:2px solid #e85d04;border-radius:3px;vertical-align:middle;margin-right:4px"></span>
          Fact Table (event)
        </div>
        <div class="legend-item">
          <span style="display:inline-block;width:16px;height:16px;background:#4a6cf718;border:2px solid #4a6cf7;border-radius:4px;vertical-align:middle;margin-right:4px"></span>
          Conformed Dimension (shared ≥ 2 facts)
        </div>
        <div class="legend-item">
          <span style="display:inline-block;width:16px;height:16px;background:#f9fafb;border:1.5px solid #d1d5db;border-radius:3px;vertical-align:middle;margin-right:4px"></span>
          Private Dimension (1 fact only)
        </div>
        <div class="legend-item">
          <span style="display:inline-block;width:28px;height:2px;background:#4a6cf7;vertical-align:middle;margin-right:4px"></span>
          Shared / conformed relationship
        </div>
        <div class="legend-item">
          <span style="display:inline-block;width:28px;height:0;border-top:2px dashed #9ca3af;vertical-align:middle;margin-right:4px"></span>
          Private relationship
        </div>
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

  // ─── HTML escape helper ───────────────────────────────────────────────────

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
