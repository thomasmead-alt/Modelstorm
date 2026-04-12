const Projects = {
  renderList() {
    const data = Storage.load();
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Projects</h1>
          <p class="view-subtitle">Your data warehouse design workspaces</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary" onclick="Export.fromFile()">Import JSON</button>
          <button class="btn btn-primary" onclick="Projects.openNewModal()">+ New Project</button>
        </div>
      </div>

      <div class="info-banner" id="projectsBanner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'" title="Dismiss">✕</button>
        <strong>What is a project?</strong> A project represents a single data warehouse or data mart.
        Each project contains one or more <strong>business events</strong> — things that happen in the
        business that you want to track and analyse using the BEAM methodology.
      </div>

      <div id="projectsGrid" class="card-grid">
        ${data.projects.length === 0 ? this._emptyState() : data.projects.map(p => this._projectCard(p)).join('')}
      </div>
    `;
  },

  _projectCard(project) {
    const eventCount = project.events.length;
    const date = new Date(project.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <div class="card project-card" onclick="Router.navigate('project/${project.id}')">
        <div class="card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        </div>
        <div class="card-body">
          <h3 class="card-title">${this._esc(project.name)}</h3>
          ${project.description ? `<p class="card-desc">${this._esc(project.description)}</p>` : ''}
          <div class="card-meta">
            <span>${eventCount} event${eventCount !== 1 ? 's' : ''}</span>
            <span>Created ${date}</span>
          </div>
        </div>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('project/${project.id}')">Open</button>
          <button class="btn btn-danger btn-sm" onclick="Projects.confirmDelete('${project.id}', '${this._esc(project.name)}')">Delete</button>
        </div>
      </div>
    `;
  },

  _emptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="8" width="56" height="40" rx="4" stroke-width="2"/>
            <path d="M20 56h24M32 48v8"/>
            <path d="M16 24h8M16 32h16M16 40h12" stroke-linecap="round"/>
          </svg>
        </div>
        <h2 class="empty-title">No projects yet</h2>
        <p class="empty-desc">
          Start by creating your first data warehouse project.<br>
          Each project holds your BEAM event models and generates star schema diagrams.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="Projects.openNewModal()">+ Create your first project</button>
          <button class="btn btn-secondary" onclick="Export.fromFile()">Import JSON</button>
          <button class="btn btn-secondary" onclick="loadExample()">Load example: Financial Margin Reporting</button>
          <button class="btn btn-secondary" onclick="loadSapExample()">Load example: SAP FI/CO Analytics Bridge</button>
        </div>
        <p style="font-size:11px;color:var(--text-subtle);margin-top:12px">
          The example includes a pre-built BEAM matrix for a financial margin reporting data warehouse.
        </p>
      </div>
    `;
  },

  renderProject(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('projects'); return; }

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb" id="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <span>${this._esc(project.name)}</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" onclick="Projects.openRenameModal('${project.id}')">Rename</button>
          <button class="btn btn-primary btn-sm" onclick="Projects.openNewEventModal('${project.id}')">+ New Event</button>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">${this._esc(project.name)}</h1>
        ${project.description ? `<p class="view-subtitle">${this._esc(project.description)}</p>` : ''}
      </div>

      <div class="info-banner" id="projectBanner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'" title="Dismiss">✕</button>
        <strong>What is an event?</strong> An event is something meaningful that happens in the business
        (e.g. a <em>Sale</em>, a <em>Login</em>, a <em>Shipment</em>). For each event you'll describe
        <em>who</em> was involved, <em>what</em> they interacted with, <em>when</em> and <em>where</em>
        it happened, <em>how</em> and <em>why</em> it occurred, and <em>how many</em> measures to record.
      </div>

      <div id="eventsGrid" class="card-grid">
        ${project.events.length === 0 ? this._emptyEventsState(project.id) : project.events.map(e => this._eventCard(e, project.id)).join('')}
      </div>

      <div class="export-section">
        <h3>Analysis</h3>
        <div class="export-actions">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('pl-mapper/${project.id}')">$ P&amp;L Mapper</button>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('business-areas/${project.id}')">🏢 Business Areas</button>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('grain-analysis/${project.id}')">⚡ Grain Analysis</button>
        </div>
      </div>
      <div class="export-section" style="margin-top:8px">
        <h3>Export Project</h3>
        <div class="export-actions">
          <button class="btn btn-ghost btn-sm" onclick="Export.toJSON(Storage.getProject('${project.id}'))">⬇ Export JSON</button>
          <button class="btn btn-ghost btn-sm" onclick="Export.projectToCSV(Storage.getProject('${project.id}'))">⬇ Export CSV (all events)</button>
        </div>
      </div>
    `;
  },

  _eventCard(event, projectId) {
    const colCount = event.columns.length;
    const catCounts = {};
    event.columns.forEach(c => { catCounts[c.category] = (catCounts[c.category] || 0) + 1; });
    const badges = Object.entries(catCounts).map(([cat, n]) => {
      const c = CATEGORIES[cat];
      return `<span class="badge-sm" style="background:${c?.color || '#6b7280'}" title="${c?.label || cat}: ${c?.meaning || ''}">${c?.label || cat} ×${n}</span>`;
    }).join('');

    // Grain badge
    const grain = event.grain || 'transaction';
    const grainInfo = (typeof GRAINS !== 'undefined' && GRAINS[grain]) || { label: grain, color: '#6b7280', short: grain.slice(0,3).toUpperCase() };
    const grainBadge = `<span class="grain-badge" style="background:${grainInfo.color}18;color:${grainInfo.color};border:1px solid ${grainInfo.color}40">${grainInfo.short || grainInfo.label}</span>`;

    // Additivity warnings
    const measures = event.columns.filter(c => c.category === 'how_many');
    const naCount = measures.filter(c => c.additiveType === 'non_additive').length;
    const saCount = measures.filter(c => c.additiveType === 'semi_additive').length;
    const bcCount = event.columns.filter(c => c.budgetControl).length;
    const warnings = [
      naCount > 0 ? `<span class="additive-badge additive-na">${naCount} NA</span>` : '',
      saCount > 0 ? `<span class="additive-badge additive-sa">${saCount} SA</span>` : '',
      bcCount > 0 ? `<span style="font-size:10px;color:#7c3aed">💰${bcCount}</span>` : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="card event-card" onclick="Projects.renderEventDetail('${projectId}', '${event.id}')">
        <div class="card-icon event-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 12h6M9 16h4"/></svg>
        </div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <h3 class="card-title" style="margin:0">${this._esc(event.name)}</h3>
            ${grainBadge}
          </div>
          ${event.description ? `<p class="card-desc">${this._esc(event.description)}</p>` : ''}
          <div class="card-badges">${badges || '<span class="muted">No columns yet</span>'}</div>
          <div class="card-meta" style="align-items:center">
            <span>${colCount} column${colCount !== 1 ? 's' : ''}</span>
            ${warnings ? `<span>${warnings}</span>` : ''}
          </div>
        </div>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('event/${event.id}')">Edit Matrix</button>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('diagram/${event.id}')">Diagram</button>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('pl-mapper/${projectId}')">P&amp;L</button>
          <button class="btn btn-danger btn-sm" onclick="Projects.confirmDeleteEvent('${projectId}', '${event.id}', '${this._esc(event.name)}')">Delete</button>
        </div>
      </div>
    `;
  },

  _emptyEventsState(projectId) {
    return `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 12h48v40H8z" rx="2" stroke-width="2"/>
            <path d="M20 28h24M20 36h16M32 12V6M32 52v6" stroke-linecap="round"/>
          </svg>
        </div>
        <h2 class="empty-title">No events yet</h2>
        <p class="empty-desc">
          Add your first business event to start building the BEAM matrix.<br>
          Think about the key things that <em>happen</em> in your business domain.
        </p>
        <button class="btn btn-primary" onclick="Projects.openNewEventModal('${projectId}')">+ Add first event</button>
      </div>
    `;
  },

  // ── Event Detail: Two-Panel View ─────────────────────────

  renderEventDetail(projectId, eventId, colId, tab) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('projects'); return; }
    const event = project.events.find(e => e.id === eventId);
    if (!event) { Router.navigate(`project/${projectId}`); return; }

    tab = tab || 'summary';
    if (!colId && event.columns.length > 0) colId = event.columns[0].id;
    const selectedCol = event.columns.find(c => c.id === colId) || null;

    // If selected tab is not valid for this column, reset to summary
    if (selectedCol) {
      const validTabs = this._validTabs(selectedCol);
      if (!validTabs.find(t => t.id === tab)) tab = 'summary';
    }

    const grain = event.grain || 'transaction';
    const grainInfo = (typeof GRAINS !== 'undefined' && GRAINS[grain]) || { label: grain, color: '#6b7280' };
    const grainOpts = typeof GRAINS !== 'undefined'
      ? Object.entries(GRAINS).map(([k, g]) => `<option value="${k}" ${grain === k ? 'selected' : ''}>${g.label}</option>`).join('')
      : `<option value="${grain}">${grain}</option>`;
    const grainSelect = `<select class="event-meta-select"
      style="background:${grainInfo.color}18;color:${grainInfo.color};border:1px solid ${grainInfo.color}40"
      title="Grain — edit event grain"
      onchange="Projects.updateEventField('${projectId}','${eventId}','grain',this.value);Projects.renderEventDetail('${projectId}','${eventId}',null,null)">${grainOpts}</select>`;

    const purpose = event.eventPurpose || 'actuals';
    const purposeInfo = typeof EVENT_PURPOSES !== 'undefined' ? (EVENT_PURPOSES[purpose] || {}) : {};
    const purposeOpts = typeof EVENT_PURPOSES !== 'undefined'
      ? Object.entries(EVENT_PURPOSES).map(([k, p]) => `<option value="${k}" ${purpose === k ? 'selected' : ''}>${p.label}</option>`).join('')
      : `<option value="${purpose}">${purpose}</option>`;
    const purposeSelect = `<select class="event-meta-select"
      style="background:${purposeInfo.bg||'#f3f4f6'};color:${purposeInfo.color||'#6b7280'};border:1px solid ${purposeInfo.color||'#6b7280'}40"
      title="Purpose — edit event purpose"
      onchange="Projects.updateEventField('${projectId}','${eventId}','eventPurpose',this.value);Projects.renderEventDetail('${projectId}','${eventId}',null,null)">${purposeOpts}</select>`;

    const completeness = this._completenessStats(event);

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#project/${projectId}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <span>${this._esc(event.name)}</span>
        </div>
        <div class="view-actions" style="gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="Export.eventToCSV(Storage.getProject('${projectId}').events.find(e=>e.id==='${eventId}'))">Export CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="Export.printEvent(Storage.getProject('${projectId}').events.find(e=>e.id==='${eventId}'),'${this._esc(project.name)}')">Print</button>
          <button class="btn btn-ghost btn-sm" onclick="Projects.generateSampleData('${projectId}','${eventId}')">Sample Data</button>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('event/${eventId}')">Edit Matrix</button>
          <button class="btn btn-primary btn-sm" onclick="Projects.openAddColumnModal('${projectId}', '${eventId}')">+ Add Column</button>
        </div>
      </div>

      <div class="event-detail-wrap">
        <div class="event-detail-meta">
          ${grainSelect}
          ${purposeSelect}
          ${event.description ? `<span class="event-meta-desc">${this._esc(event.description)}</span>` : ''}
          <div style="margin-left:auto;display:flex;align-items:center;gap:12px;flex-shrink:0">
            <div class="event-completeness-wrap" title="${completeness.filled}/${completeness.total} 7W categories covered">
              ${completeness.dots}
              <span style="font-size:10px;color:var(--text-subtle)">${completeness.filled}/${completeness.total}</span>
            </div>
            <span style="font-size:11px;color:var(--text-subtle)">${event.columns.length} col${event.columns.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        ${event.notes !== undefined ? `
        <div class="event-notes-strip">
          <textarea class="event-notes-input" placeholder="KPI context, business rules, event-level notes…" rows="1"
            onchange="Projects.updateEventField('${projectId}','${eventId}','notes',this.value)"
            oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
            style="height:auto">${this._esc(event.notes||'')}</textarea>
        </div>` : ''}

        <div class="event-detail-layout">
          <div class="col-list-panel">
            <div class="col-list-header">
              <span>Columns</span>
              <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 7px;text-transform:none;letter-spacing:0" onclick="Projects.openAddColumnModal('${projectId}', '${eventId}')">+ Add</button>
            </div>
            <div class="col-list-body">
              ${event.columns.length === 0
                ? `<div class="col-list-empty">No columns yet.<br>Click <strong>+ Add</strong> to begin.</div>`
                : this._buildGroupedColList(event.columns, colId, projectId, eventId, tab)
              }
            </div>
          </div>

          <div class="col-detail-panel">
            ${selectedCol
              ? this._colDetailPanel(selectedCol, event, project, tab)
              : `<div class="col-detail-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:.3"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  <span>Select a column to view details</span>
                  ${event.columns.length === 0 ? `<button class="btn btn-primary btn-sm" onclick="Projects.openAddColumnModal('${projectId}', '${eventId}')">+ Add first column</button>` : ''}
                </div>`
            }
          </div>
        </div>
      </div>
    `;
    // Auto-resize event notes textarea
    const ta = document.querySelector('.event-notes-input');
    if (ta && ta.value) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  },

  _completenessStats(event) {
    const cats = Object.keys(typeof CATEGORIES !== 'undefined' ? CATEGORIES : {});
    const filled = cats.filter(cat => (event.columns || []).some(c => c.category === cat));
    const dots = cats.map(cat => {
      const info = (typeof CATEGORIES !== 'undefined' && CATEGORIES[cat]) || {};
      const has = filled.includes(cat);
      return `<span class="completeness-dot" title="${info.label || cat}" style="background:${has ? (info.color || '#6b7280') : '#e5e7eb'}"></span>`;
    }).join('');
    return { filled: filled.length, total: cats.length, dots };
  },

  _buildGroupedColList(columns, selectedColId, projectId, eventId, tab) {
    const ORDER = ['who','what','when','where','how','why','how_many'];
    const groups = {};
    ORDER.forEach(k => { groups[k] = []; });
    columns.forEach(c => {
      const key = ORDER.includes(c.category) ? c.category : 'who';
      groups[key].push(c);
    });
    return ORDER.filter(k => groups[k].length > 0).map(k => {
      const info = (typeof CATEGORIES !== 'undefined' && CATEGORIES[k]) || { label: k, color: '#6b7280' };
      const items = groups[k].map(c => this._colListItem(c, selectedColId, projectId, eventId, tab)).join('');
      return `<div class="col-group-header" style="border-left:3px solid ${info.color}">${this._esc(info.label)} <span class="col-group-count">${groups[k].length}</span></div>${items}`;
    }).join('');
  },

  _colListItem(col, selectedColId, projectId, eventId, tab) {
    const cat = (typeof CATEGORIES !== 'undefined' && CATEGORIES[col.category]) || { color: '#6b7280' };
    // Conformed columns: show a dim badge instead of source badge
    let badge = '';
    if (col.isConformed && col.publicDimensionId) {
      badge = `<span class="col-conformed-badge" title="Conformed dimension">⊞</span>`;
    } else {
      const SRC_SHORT = { source_system: null, derived: 'DER', lookup: 'LKP', sap_ecc: 'ECC', sap_s4: 'S/4' };
      const srcShort = SRC_SHORT[col.source];
      const srcDef = srcShort && typeof SOURCES !== 'undefined' ? (SOURCES[col.source] || null) : null;
      badge = srcDef
        ? `<span class="col-src-badge" title="${srcDef.label}" style="color:${srcDef.color};background:${srcDef.bg}">${srcShort}</span>`
        : '';
    }
    const isActive = col.id === selectedColId;
    // Conformed columns don't use tabs — navTab not used but kept for consistency
    const navTab = col.isConformed ? 'summary' : (this._validTabs(col).find(t => t.id === tab) ? tab : 'summary');
    return `
      <div class="col-list-item${isActive ? ' active' : ''}${col.isConformed ? ' col-list-item-conformed' : ''}"
        onclick="Projects.renderEventDetail('${projectId}', '${eventId}', '${col.id}', '${navTab}')">
        <div class="col-cat-dot" style="background:${cat.color}${col.isConformed ? '' : ''}"></div>
        <span class="col-item-name" title="${this._esc(col.name)}">${this._esc(col.name) || '<em style="color:var(--text-subtle)">unnamed</em>'}</span>
        ${badge}
        <span class="col-item-type">${this._esc(col.dataType || 'VARCHAR')}</span>
      </div>
    `;
  },

  _validTabs(col) {
    const isSAP = col.source === 'sap_ecc' || col.source === 'sap_s4';
    const isMeasure = col.category === 'how_many';
    return [
      { id: 'summary',   label: 'Summary',      show: true },
      { id: 'technical', label: 'SAP Tech',      show: isSAP },
      { id: 'hierarchy', label: 'Hierarchy',     show: !isMeasure },
      { id: 'stage',     label: 'Stage Mapping', show: true },
      { id: 'notes',     label: 'Notes',         show: true },
    ].filter(t => t.show);
  },

  _colDetailPanel(col, event, project, tab) {
    const pId = project.id;
    const eId = event.id;
    const cId = col.id;

    // Conformed columns: read-only inherited view — no editable tabs
    if (col.isConformed && col.publicDimensionId) {
      return this._conformedReadOnlyPanel(col, event, project);
    }

    const tabs = this._validTabs(col);
    const tabButtons = tabs.map(t =>
      `<button class="col-detail-tab${tab === t.id ? ' active' : ''}" data-tab="${t.id}"
        onclick="Projects.renderEventDetail('${pId}', '${eId}', '${cId}', '${t.id}')">${t.label}</button>`
    ).join('');

    let body = '';
    if      (tab === 'summary')   body = this._tabSummary(col, event, project);
    else if (tab === 'technical') body = this._tabTechnical(col, event, project);
    else if (tab === 'hierarchy') body = this._tabHierarchy(col, event, project);
    else if (tab === 'stage')     body = this._tabStage(col, event, project);
    else if (tab === 'notes')     body = this._tabNotes(col, event, project);
    else                          body = this._tabSummary(col, event, project);

    return `<div class="col-detail-tabs">${tabButtons}</div><div class="col-detail-body">${body}</div>`;
  },

  // ── Conformed column: read-only inherited view ────────────

  _conformedReadOnlyPanel(col, event, project) {
    const pId = project.id; const eId = event.id; const cId = col.id;
    const allDims = typeof Storage.getAllDimTemplates === 'function' ? Storage.getAllDimTemplates() : [];
    const dim = allDims.find(d => d.id === col.publicDimensionId);
    const catInfo = (typeof CATEGORIES !== 'undefined' && CATEGORIES[col.category]) || { label: col.category, color: '#6b7280' };

    // Dimension attributes available via JOIN (all columns except the key)
    const dimCols = dim ? (dim.columns || []) : [];
    const dimAttrs = dimCols.filter(c => !(c.isKey || c.isSurrogateKey) && c.id !== col.publicDimensionColId);

    return `
      <div class="conformed-readonly-panel">
        <div class="conformed-readonly-header">
          <div>
            <div class="conformed-readonly-source">
              Foreign key →
              ${dim
                ? `<a href="#dimension/${dim.id}" style="color:var(--info);font-weight:600">${dim.icon ? dim.icon + ' ' : ''}${this._esc(dim.name)}</a>`
                : `<span style="color:var(--text-muted)">Dimension (template removed)</span>`}
            </div>
            <div class="conformed-readonly-name" style="display:flex;align-items:center;gap:8px">
              🔑 <span>${this._esc(col.name || '—')}</span>
              <span style="font-size:12px;font-weight:400;color:var(--text-muted)">${this._esc(col.dataType || 'INT')}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;align-items:flex-start">
            ${dim ? `<button class="btn btn-ghost btn-sm" onclick="Projects.syncFromDimTemplate('${pId}','${eId}','${cId}')" title="Re-sync key column name and type from template">↻ Sync</button>` : ''}
            <button class="btn btn-ghost btn-sm" style="color:var(--danger)"
              title="Make this an independent editable column"
              onclick="Projects.detachConformed('${pId}','${eId}','${cId}')">Detach</button>
          </div>
        </div>

        <div class="conformed-readonly-body">
          <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
            <span style="padding:2px 10px;border-radius:4px;font-size:11px;font-weight:600;background:${catInfo.color}18;color:${catInfo.color};border:1px solid ${catInfo.color}30">${catInfo.label}</span>
            <span style="padding:2px 10px;border-radius:4px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e;border:1px solid #fde68a">FK — Snowflake ref</span>
          </div>

          ${col.description ? `
          <div class="conformed-description" style="margin-bottom:16px">
            <div class="conformed-field-label" style="margin-bottom:4px">Description</div>
            <div style="font-size:13px;color:var(--text);line-height:1.6">${this._esc(col.description)}</div>
          </div>` : ''}

          ${dim && dimCols.length > 0 ? `
          <div>
            <div class="conformed-field-label" style="margin-bottom:8px">
              Dimension attributes available via JOIN
              <span style="font-size:9px;font-weight:400;color:var(--text-subtle);margin-left:4px">(${dimCols.length} column${dimCols.length !== 1 ? 's' : ''} in ${this._esc(dim.name)})</span>
            </div>
            <div class="conformed-dim-attr-list">
              ${dimCols.map(c => {
                const isKey = c.isKey || c.isSurrogateKey || c.id === col.publicDimensionColId;
                const atCatInfo = (typeof CATEGORIES !== 'undefined' && CATEGORIES[c.category]) || null;
                return `<div class="conformed-dim-attr-row${isKey ? ' conformed-dim-attr-row-key' : ''}">
                  <span class="conformed-dim-attr-key">${isKey ? '🔑' : ''}</span>
                  <span class="conformed-dim-attr-name">${this._esc(c.name)}</span>
                  <span class="conformed-dim-attr-type">${c.dataType || 'VARCHAR'}</span>
                  ${atCatInfo ? `<span class="conformed-dim-attr-cat" style="color:${atCatInfo.color}">${atCatInfo.label}</span>` : ''}
                  ${c.description ? `<span class="conformed-dim-attr-desc" title="${this._esc(c.description)}">— ${this._esc(c.description)}</span>` : ''}
                </div>`;
              }).join('')}
            </div>
          </div>` : ''}
        </div>

        <div class="conformed-readonly-footer">
          Snowflake model — only this foreign key lives in the event.
          ${dim
            ? `Join to <a href="#dimension/${dim.id}" style="color:var(--info)">${this._esc(dim.name)}</a> to access dimension attributes.`
            : ''}
          Use <strong>Detach</strong> to convert this to an independent column.
        </div>
      </div>
    `;
  },

  // ── Tab: Summary ──────────────────────────────────────────

  _tabSummary(col, event, project) {
    const pId = project.id; const eId = event.id; const cId = col.id;
    const isMeasure = col.category === 'how_many';
    // Note: conformed columns never reach here — they go to _conformedReadOnlyPanel instead

    // Source/Origin options
    const srcOpts = typeof SOURCES !== 'undefined'
      ? Object.entries(SOURCES).map(([k, v]) =>
          `<option value="${k}" ${(col.source || 'source_system') === k ? 'selected' : ''}>${v.label}</option>`).join('')
      : `<option value="source_system">Source System</option>`;
    const srcInfo = typeof SOURCES !== 'undefined' && col.source ? (SOURCES[col.source] || SOURCES.source_system) : null;

    // Category options
    const catOpts = typeof CATEGORIES !== 'undefined'
      ? Object.entries(CATEGORIES).map(([k, c]) =>
          `<option value="${k}" ${col.category === k ? 'selected' : ''}>${c.label} (${c.meaning || k})</option>`).join('')
      : '';

    // Data type options
    const dtOpts = ['VARCHAR','INT','BIGINT','DECIMAL','FLOAT','DATE','DATETIME','TIMESTAMP','BOOLEAN','UUID','JSON','TEXT']
      .map(t => `<option value="${t}" ${col.dataType === t ? 'selected' : ''}>${t}</option>`).join('');

    // SCD type options
    const scdOpts = `<option value="" ${!col.scdType && col.scdType !== 0 ? 'selected' : ''}>None</option>
      ${[0,1,2,3,4,6].map(n => `<option value="${n}" ${col.scdType === n ? 'selected' : ''}>SCD${n}</option>`).join('')}`;

    // Additivity options (measures only)
    const addOpts = typeof ADDITIVE_TYPES !== 'undefined'
      ? Object.entries(ADDITIVE_TYPES).map(([k, v]) =>
          `<option value="${k}" ${(col.additiveType || 'fully_additive') === k ? 'selected' : ''}>${v.label}</option>`).join('')
      : '';

    // Responsibility type options (non-measures)
    const respOpts = typeof RESPONSIBILITY_TYPES !== 'undefined'
      ? Object.entries(RESPONSIBILITY_TYPES).map(([k, v]) =>
          `<option value="${k}" ${(col.responsibilityType || 'none') === k ? 'selected' : ''}>${v.label}</option>`).join('')
      : '';

    // P&L line options (measures only)
    const plLines = project.plLines || (typeof DEFAULT_PL_LINES !== 'undefined' ? DEFAULT_PL_LINES : []);
    const plOpts = `<option value="" ${!col.plLineId ? 'selected' : ''}>— Unassigned —</option>`
      + plLines.map(l => `<option value="${l.id}" ${col.plLineId === l.id ? 'selected' : ''}>${this._esc(l.label)}</option>`).join('');

    // Owner options (from project cost objects)
    const costObjects = project.costObjects || [];
    const ownerOpts = `<option value="" ${!col.ownerId ? 'selected' : ''}>— Unassigned —</option>`
      + costObjects.map(o => `<option value="${o.id}" ${col.ownerId === o.id ? 'selected' : ''}>${this._esc(o.objectId || o.description || o.id)}</option>`).join('');

    const roAttr = ''; // conformed columns no longer reach this tab
    const conformedBanner = '';

    return `
      ${conformedBanner}
      <div class="cd-section">
        <div class="cd-section-title">Origin</div>
        <div class="cd-grid g2">
          <div class="cd-field">
            <label>Source / Origin</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','source',this.value,true)">${srcOpts}</select>
            ${srcInfo ? `<span class="src-origin-hint">${this._esc(srcInfo.description || '')}</span>` : ''}
          </div>
          <div class="cd-field">
            <label>7W Category</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','category',this.value,true)">${catOpts}</select>
          </div>
        </div>
      </div>

      <div class="cd-section">
        <div class="cd-section-title">Identity</div>
        <div class="cd-grid g2">
          <div class="cd-field" style="grid-column:1/-1">
            <label>Column Name</label>
            <input type="text" value="${this._esc(col.name)}" ${roAttr}
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','name',this.value,true)">
          </div>
          <div class="cd-field">
            <label>Data Type</label>
            <select ${roAttr} onchange="Projects.updateColField('${pId}','${eId}','${cId}','dataType',this.value,false)">${dtOpts}</select>
          </div>
          <div class="cd-field">
            <label>Format / Examples</label>
            <input type="text" value="${this._esc(col.format || '')}" placeholder="e.g. YYYY-MM-DD, max 255 chars"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','format',this.value,false)">
          </div>
          <div class="cd-field" style="grid-column:1/-1">
            <label>Description</label>
            <textarea ${roAttr} onchange="Projects.updateColField('${pId}','${eId}','${cId}','description',this.value,false)"
              placeholder="What does this column represent?">${this._esc(col.description || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="cd-section">
        <div class="cd-section-title">Classification</div>
        <div class="cd-grid g2">
          ${isMeasure ? `
          <div class="cd-field">
            <label>Additivity</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','additiveType',this.value,false)">${addOpts}</select>
          </div>
          <div class="cd-field">
            <label>P&amp;L Line</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','plLineId',this.value,false)">${plOpts}</select>
          </div>
          <div class="cd-toggle" style="grid-column:1/-1">
            <input type="checkbox" id="bc-${cId}" ${col.budgetControl ? 'checked' : ''}
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','budgetControl',this.checked,false)">
            <label for="bc-${cId}">Budget-controlled measure</label>
          </div>
          ` : `
          <div class="cd-field">
            <label>Responsibility Type</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','responsibilityType',this.value,false)">${respOpts}</select>
          </div>
          <div class="cd-field">
            <label>SCD Type</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','scdType',this.value === '' ? null : parseInt(this.value),false)">${scdOpts}</select>
          </div>
          `}
          <div class="cd-toggle">
            <input type="checkbox" id="nk-${cId}" ${col.isNaturalKey ? 'checked' : ''}
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','isNaturalKey',this.checked,false)">
            <label for="nk-${cId}">Natural Key</label>
          </div>
          <div class="cd-toggle">
            <input type="checkbox" id="sk-${cId}" ${col.isSurrogateKey ? 'checked' : ''}
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','isSurrogateKey',this.checked,false)">
            <label for="sk-${cId}">Surrogate Key</label>
          </div>
        </div>
      </div>

      ${costObjects.length > 0 ? `
      <div class="cd-section">
        <div class="cd-section-title">Ownership</div>
        <div class="cd-grid g1">
          <div class="cd-field">
            <label>Owner (Cost Object)</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','ownerId',this.value,false)">${ownerOpts}</select>
          </div>
        </div>
      </div>` : ''}
    `;
  },

  // ── Tab: Technical References ─────────────────────────────

  _tabTechnical(col, event, project) {
    const pId = project.id; const eId = event.id; const cId = col.id;
    const isMeasure = col.category === 'how_many';
    const isWhen = col.category === 'when';

    // SAP Migration Status options
    const migOpts = typeof SAP_MIGRATION_STATUSES !== 'undefined'
      ? `<option value="" ${!col.sapMigrationStatus ? 'selected' : ''}>— Untagged —</option>`
        + Object.entries(SAP_MIGRATION_STATUSES).filter(([k]) => k !== '').map(([k, v]) =>
            `<option value="${k}" ${col.sapMigrationStatus === k ? 'selected' : ''}>${v.label}</option>`).join('')
      : '';

    // SAP Module options
    const moduleOpts = typeof SAP_SUBLEDGERS !== 'undefined'
      ? `<option value="" ${!col.sapModule ? 'selected' : ''}>— Unlinked —</option>`
        + Object.entries(SAP_SUBLEDGERS).map(([k, v]) =>
            `<option value="${k}" ${col.sapModule === k ? 'selected' : ''}>${v.label} — ${v.desc}</option>`).join('')
      : '';

    // Date key role options
    const dkrOpts = typeof DATE_KEY_ROLES !== 'undefined'
      ? `<option value="" ${!col.dateKeyRole ? 'selected' : ''}>— None —</option>`
        + Object.entries(DATE_KEY_ROLES).filter(([k]) => k !== '').map(([k, v]) =>
            `<option value="${k}" ${col.dateKeyRole === k ? 'selected' : ''}>${v.label || k}</option>`).join('')
      : '';

    const selMig = typeof SAP_MIGRATION_STATUSES !== 'undefined' && col.sapMigrationStatus
      ? SAP_MIGRATION_STATUSES[col.sapMigrationStatus] : null;
    const selMod = typeof SAP_SUBLEDGERS !== 'undefined' && col.sapModule
      ? SAP_SUBLEDGERS[col.sapModule] : null;

    return `
      <div class="cd-section">
        <div class="cd-section-title">SAP Source</div>
        <div class="cd-grid g3">
          <div class="cd-field">
            <label>SAP Table</label>
            <input type="text" list="sap-tables-list-proj" value="${this._esc(col.sapTable || '')}" placeholder="e.g. ACDOCA, BSEG"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','sapTable',this.value,false)">
            <datalist id="sap-tables-list-proj">
              <option value="ACDOCA"><option value="BSEG"><option value="BKPF">
              <option value="COEP"><option value="CE1XXXX"><option value="ANLP">
              <option value="MARA"><option value="CSKS"><option value="CEPC">
              <option value="KNA1"><option value="LFA1"><option value="MKPF">
            </datalist>
          </div>
          <div class="cd-field">
            <label>SAP Field</label>
            <input type="text" value="${this._esc(col.sapField || '')}" placeholder="e.g. HKONT, KOSTL"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','sapField',this.value,false)">
          </div>
          <div class="cd-field">
            <label>Migration Status</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','sapMigrationStatus',this.value,false)">${migOpts}</select>
            ${selMig ? `<span class="sap-module-badge" style="background:${selMig.bg};color:${selMig.color}">${selMig.short || selMig.label}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="cd-section">
        <div class="cd-section-title">SAP Module</div>
        <div class="cd-grid g1">
          <div class="cd-field">
            <label>Source Module</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','sapModule',this.value,false)">${moduleOpts}</select>
            ${selMod ? `<span class="sap-module-badge" style="background:${selMod.bg};color:${selMod.color}">${this._esc(selMod.label)} — ${this._esc(selMod.desc)}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="cd-section">
        <div class="cd-section-title">CO-PA</div>
        <div class="cd-grid g2">
          ${isMeasure ? `
          <div class="cd-field">
            <label>CO-PA Value Field</label>
            <input type="text" value="${this._esc(col.copaValueField || '')}" placeholder="e.g. VKE001"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','copaValueField',this.value,false)">
          </div>` : `
          <div class="cd-field">
            <label>CO-PA Characteristic</label>
            <input type="text" value="${this._esc(col.copaCharacteristic || '')}" placeholder="e.g. KDGRP, ARTNR"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','copaCharacteristic',this.value,false)">
          </div>`}
          ${isMeasure ? `
          <div class="cd-field">
            <label>GL Account</label>
            <input type="text" value="${this._esc(col.glAccount || '')}" placeholder="e.g. 400000"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','glAccount',this.value,false)">
          </div>` : ''}
        </div>
      </div>

      <div class="cd-section">
        <div class="cd-section-title">Dimensional</div>
        <div class="cd-grid g2">
          ${isWhen ? `
          <div class="cd-field">
            <label>Date Key Role</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','dateKeyRole',this.value,false)">${dkrOpts}</select>
          </div>` : ''}
          <div class="cd-field">
            <label>Joins To Dimension</label>
            <input type="text" value="${this._esc(col.joinDimension || '')}" placeholder="e.g. dim_customer"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','joinDimension',this.value,false)">
          </div>
          <div class="cd-toggle" style="grid-column:1/-1">
            <input type="checkbox" id="fa-${cId}" ${col.isFinancialAnchor ? 'checked' : ''}
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','isFinancialAnchor',this.checked,false)">
            <label for="fa-${cId}">Financial Anchor (primary GL-mapped measure)</label>
          </div>
        </div>
      </div>
    `;
  },

  // ── Tab: Hierarchy ────────────────────────────────────────

  _tabHierarchy(col, event, project) {
    const pIdReal = project.id;
    const eId = event.id; const cId = col.id;

    // Parent column options (columns other than self)
    const parentOpts = `<option value="" ${!col.parentColumnId ? 'selected' : ''}>— None —</option>`
      + event.columns.filter(c => c.id !== cId).map(c =>
          `<option value="${c.id}" ${col.parentColumnId === c.id ? 'selected' : ''}>${this._esc(c.name || c.id)}</option>`).join('');

    return `
      <div class="cd-section">
        <div class="cd-section-title">Hierarchy Structure</div>
        <div class="cd-grid g2">
          <div class="cd-field">
            <label>Hierarchy Name</label>
            <input type="text" value="${this._esc(col.hierarchyName || '')}" placeholder="e.g. product_hierarchy"
              onchange="Projects.updateColField('${pIdReal}','${eId}','${cId}','hierarchyName',this.value,false)">
          </div>
          <div class="cd-field">
            <label>Hierarchy Level</label>
            <input type="number" min="1" max="20" value="${col.hierarchyLevel || ''}" placeholder="1 = top level"
              onchange="Projects.updateColField('${pIdReal}','${eId}','${cId}','hierarchyLevel',this.value ? parseInt(this.value) : null,false)">
          </div>
          <div class="cd-field" style="grid-column:1/-1">
            <label>Parent Column</label>
            <select onchange="Projects.updateColField('${pIdReal}','${eId}','${cId}','parentColumnId',this.value,false)">${parentOpts}</select>
          </div>
          <div class="cd-toggle" style="grid-column:1/-1">
            <input type="checkbox" id="pk-${cId}" ${col.isParentKey ? 'checked' : ''}
              onchange="Projects.updateColField('${pIdReal}','${eId}','${cId}','isParentKey',this.checked,false)">
            <label for="pk-${cId}">Is Parent Key (references parent row's key)</label>
          </div>
        </div>
      </div>
    `;
  },

  // ── Tab: Notes ────────────────────────────────────────────

  _tabNotes(col, event, project) {
    const pId = project.id; const eId = event.id; const cId = col.id;
    const isMeasure = col.category === 'how_many';
    return `
      <div class="cd-section">
        <div class="cd-section-title">Notes</div>
        <div class="cd-grid g1">
          <div class="cd-field">
            <label>Notes</label>
            <textarea style="min-height:120px" placeholder="Any additional context, business rules, or data quality notes..."
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','notes',this.value,false)">${this._esc(col.notes || '')}</textarea>
          </div>
        </div>
      </div>
      ${isMeasure ? `
      <div class="cd-section">
        <div class="cd-section-title">Formula / Derivation</div>
        <div class="cd-grid g1">
          <div class="cd-field">
            <label>Formula</label>
            <textarea style="min-height:80px;font-family:monospace;font-size:12px" placeholder="e.g. revenue - cost_of_goods_sold"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','formula',this.value,false)">${this._esc(col.formula || '')}</textarea>
          </div>
        </div>
      </div>` : ''}
    `;
  },

  // ── Tab: Stage Mapping ────────────────────────────────────

  _tabStage(col, event, project) {
    const pId = project.id; const eId = event.id; const cId = col.id;
    const isMeasure = col.category === 'how_many';

    const transformOpts = ['','direct','derived','lookup','calculated','defaulted','truncated','sign_reversed','aggregated']
      .map(k => `<option value="${k}" ${col.transformType === k ? 'selected' : ''}>${k ? k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : '— Not set —'}</option>`).join('');

    const nullOpts = ['','allow','default','reject']
      .map(k => `<option value="${k}" ${col.nullHandling === k ? 'selected' : ''}>${k ? k.charAt(0).toUpperCase()+k.slice(1) : '— Not set —'}</option>`).join('');

    return `
      <div class="cd-section">
        <div class="cd-section-title">Source Extraction</div>
        <div class="cd-grid g2">
          <div class="cd-field">
            <label>Source Table / Path</label>
            <input type="text" value="${this._esc(col.stageSource||'')}" placeholder="e.g. staging.gl_line_items or BSEG.HKONT"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','stageSource',this.value,false)">
          </div>
          <div class="cd-field">
            <label>Source Field / Expression</label>
            <input type="text" value="${this._esc(col.sapField||'')}" placeholder="e.g. HKONT or s.gl_account"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','sapField',this.value,false)">
          </div>
        </div>
      </div>

      <div class="cd-section">
        <div class="cd-section-title">Transformation</div>
        <div class="cd-grid g2">
          <div class="cd-field">
            <label>Transform Type</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','transformType',this.value,false)">${transformOpts}</select>
          </div>
          <div class="cd-field">
            <label>Target Field</label>
            <input type="text" value="${this._esc(col.stageTarget||'')}" placeholder="e.g. fact_gl.gl_account_key"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','stageTarget',this.value,false)">
          </div>
          <div class="cd-field" style="grid-column:1/-1">
            <label>Mapping / Derivation Rule</label>
            <textarea style="min-height:70px;font-family:monospace;font-size:12px"
              placeholder="e.g. LOOKUP(dim_gl_account, source_gl_code = HKONT)"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','formula',this.value,false)">${this._esc(col.formula||'')}</textarea>
          </div>
          ${isMeasure ? `
          <div class="cd-toggle">
            <input type="checkbox" id="sr-${cId}" ${col.signReversal?'checked':''}
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','signReversal',this.checked,false)">
            <label for="sr-${cId}">Sign Reversal (multiply by −1)</label>
          </div>
          <div class="cd-field">
            <label>Unit Conversion</label>
            <input type="text" value="${this._esc(col.unitConversion||'')}" placeholder="e.g. USD → EUR × 0.92"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','unitConversion',this.value,false)">
          </div>` : ''}
        </div>
      </div>

      <div class="cd-section">
        <div class="cd-section-title">Data Quality &amp; Nulls</div>
        <div class="cd-grid g2">
          <div class="cd-field">
            <label>Null Handling</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','nullHandling',this.value,false)">${nullOpts}</select>
          </div>
          <div class="cd-field">
            <label>Default Value</label>
            <input type="text" value="${this._esc(col.defaultValue||'')}" placeholder="e.g. 0 or 'UNKNOWN'"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','defaultValue',this.value,false)">
          </div>
          <div class="cd-field" style="grid-column:1/-1">
            <label>Data Quality Rule</label>
            <input type="text" value="${this._esc(col.dataQualityRule||'')}" placeholder="e.g. Must match GL master; NOT NULL; range 0–9999"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','dataQualityRule',this.value,false)">
          </div>
          <div class="cd-field" style="grid-column:1/-1">
            <label>Stage / Migration Notes</label>
            <textarea style="min-height:70px"
              placeholder="Any special handling, caveats, or migration-specific notes for this field…"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','stagingNote',this.value,false)">${this._esc(col.stagingNote||'')}</textarea>
          </div>
        </div>
      </div>
    `;
  },

  // ── Tab: Conformed Dimensions ─────────────────────────────

  _tabConformed(col, event, project) {
    const pId = project.id; const eId = event.id; const cId = col.id;

    const allDims = typeof Storage.getAllDimTemplates === 'function'
      ? Storage.getAllDimTemplates()
      : (typeof DEFAULT_PUBLIC_DIMENSIONS !== 'undefined' ? DEFAULT_PUBLIC_DIMENSIONS : []);

    const dimOpts = `<option value="" ${!col.publicDimensionId ? 'selected' : ''}>— Unlinked —</option>`
      + allDims.map(d =>
          `<option value="${d.id}" ${col.publicDimensionId === d.id ? 'selected' : ''}>${d.isCustom ? '★ ' : ''}${this._esc(d.name)}</option>`
        ).join('');

    const linked = allDims.find(d => d.id === col.publicDimensionId);

    // Dim column picker — only shown when a dim is selected
    const dimColOpts = linked
      ? `<option value="" ${!col.publicDimensionColId ? 'selected' : ''}>— Select matching column —</option>`
        + (linked.columns || []).map(c =>
            `<option value="${c.id}" ${col.publicDimensionColId === c.id ? 'selected' : ''}>${this._esc(c.name)} (${c.dataType})</option>`
          ).join('')
      : '';

    const linkedDimCol = linked && col.publicDimensionColId
      ? (linked.columns || []).find(c => c.id === col.publicDimensionColId) : null;

    return `
      <div class="cd-section">
        <div class="cd-section-title">Conformed Dimension Link</div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
          Link to a shared dimension template — the column will inherit the template's name, type and description.
          Conformed dimensions enable drill-across analysis between fact tables.
        </p>
        <div class="cd-grid g1">
          <div class="cd-field">
            <label>Dimension Template</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','publicDimensionId',this.value,true)">${dimOpts}</select>
          </div>
          ${linked ? `
          <div class="cd-field">
            <label>Matching Column in ${this._esc(linked.name)}</label>
            <select onchange="Projects.conformToColId('${pId}','${eId}','${cId}',this.value)">${dimColOpts}</select>
          </div>` : ''}
        </div>
        ${col.isConformed && linked ? `
        <div class="conformed-link-badge" style="margin-top:12px">
          <svg viewBox="0 0 16 16" fill="currentColor" style="width:13px;height:13px"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.2 5.5l-3.7 3.7a.75.75 0 01-1.06 0L4.8 8.5a.75.75 0 011.06-1.06l1.1 1.1 3.18-3.18a.75.75 0 111.06 1.06z"/></svg>
          Conformed — ${this._esc(linked.name)}${linkedDimCol ? ' › ' + this._esc(linkedDimCol.name) : ''}
          <a href="#dimension/${linked.id}" style="margin-left:6px;font-size:11px;font-weight:400;color:var(--info)">View template →</a>
          <button class="btn btn-ghost btn-sm" style="padding:1px 6px;font-size:11px;margin-left:auto"
            onclick="Projects.syncFromDimTemplate('${pId}','${eId}','${cId}')">Sync from template</button>
        </div>` : ''}
      </div>
      <div style="font-size:11px;color:var(--text-subtle);margin-top:16px;line-height:1.6">
        <strong>Built-in templates</strong> are read-only.
        Use the <a href="#dimensions" style="color:var(--info)">Dimension Library</a> to create custom dimensions or clone a built-in.
      </div>
    `;
  },

  // ── Event-level field update ──────────────────────────────

  updateEventField(projectId, eventId, field, value) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const event = project.events.find(e => e.id === eventId);
    if (!event) return;
    event[field] = value;
    Storage.saveEvent(projectId, event);
  },

  // ── Conformed dimension helpers ───────────────────────────

  // Select which dim column this column maps to, and auto-fill Summary fields
  conformToColId(projectId, eventId, colId, dimColId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const event = project.events.find(e => e.id === eventId);
    if (!event) return;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col.publicDimensionColId = dimColId;
    col.isConformed = !!(col.publicDimensionId && dimColId);
    if (col.isConformed) {
      const allDims = typeof Storage.getAllDimTemplates === 'function' ? Storage.getAllDimTemplates() : [];
      const dim = allDims.find(d => d.id === col.publicDimensionId);
      const dimCol = dim ? (dim.columns || []).find(c => c.id === dimColId) : null;
      if (dimCol) {
        col.name = dimCol.name;
        col.dataType = dimCol.dataType || col.dataType;
        col.description = dimCol.description || col.description;
        col.responsibilityType = dimCol.responsibilityType || col.responsibilityType;
      }
    }
    Storage.saveEvent(projectId, event);
    const activeTab = document.querySelector('.col-detail-tab.active')?.dataset.tab || 'conformed';
    Projects.renderEventDetail(projectId, eventId, colId, activeTab);
  },

  // Detach a conformed column — makes it a standalone editable column
  detachConformed(projectId, eventId, colId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const event = project.events.find(e => e.id === eventId);
    if (!event) return;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col.isConformed = false;
    col.publicDimensionId = '';
    col.publicDimensionColId = '';
    Storage.saveEvent(projectId, event);
    Projects.renderEventDetail(projectId, eventId, colId, 'summary');
  },

  // Re-sync from the linked dim col (e.g. after template was updated)
  syncFromDimTemplate(projectId, eventId, colId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const event = project.events.find(e => e.id === eventId);
    if (!event) return;
    const col = event.columns.find(c => c.id === colId);
    if (!col || !col.publicDimensionId || !col.publicDimensionColId) return;
    const allDims = typeof Storage.getAllDimTemplates === 'function' ? Storage.getAllDimTemplates() : [];
    const dim = allDims.find(d => d.id === col.publicDimensionId);
    const dimCol = dim ? (dim.columns || []).find(c => c.id === col.publicDimensionColId) : null;
    if (!dimCol) { showToast('Linked column no longer exists in the template', 'error'); return; }
    col.name = dimCol.name;
    col.dataType = dimCol.dataType || col.dataType;
    col.description = dimCol.description || col.description;
    col.responsibilityType = dimCol.responsibilityType || col.responsibilityType;
    Storage.saveEvent(projectId, event);
    showToast('Synced from template');
    Projects.renderEventDetail(projectId, eventId, colId, 'summary');
  },

  // ── Sample Data Generator ─────────────────────────────────

  generateSampleData(projectId, eventId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const event = project.events.find(e => e.id === eventId);
    if (!event || event.columns.length === 0) { showToast('No columns to generate data for', 'error'); return; }

    const ROWS = 5;
    const sample = (col, rowIdx) => {
      const seed = rowIdx + 1;
      const dt = col.dataType || 'VARCHAR';
      if (col.format) {
        // Use format hint examples — pick first token
        const ex = col.format.split(/[,;|]/)[rowIdx % col.format.split(/[,;|]/).length];
        if (ex && ex.trim()) return ex.trim();
      }
      if (dt === 'UUID') return `xxxxxxxx-${String(1000+seed).padStart(4,'0')}-4xxx-yxxx-${String(100000+seed*7).padStart(12,'0')}`.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&0x3|0x8)).toString(16);});
      if (dt === 'BOOLEAN') return seed % 3 === 0 ? 'false' : 'true';
      if (dt === 'DATE') { const d=new Date(2024,0,seed*5+1); return d.toISOString().slice(0,10); }
      if (dt === 'DATETIME' || dt === 'TIMESTAMP') { const d=new Date(2024,0,seed*5+1,seed%24,seed*7%60); return d.toISOString().slice(0,16).replace('T',' '); }
      if (dt === 'INT' || dt === 'BIGINT') return String(seed * 1000 + rowIdx * 37);
      if (dt === 'DECIMAL' || dt === 'FLOAT') return (seed * 1234.56 + rowIdx * 99.99).toFixed(2);
      // VARCHAR — use category hints
      const cat = col.category;
      const names = {
        who: ['CUST-001','CUST-002','SUPPLIER-A','EMP-0042','ORG-99'],
        what: ['PROD-100','SKU-200A','SERVICE-FIN','MAT-300','ITEM-X'],
        when: ['2024-01-01','2024-03-15','2024-06-30','2024-09-01','2024-12-31'],
        where: ['CC-1000','CC-2100','PC-EMEA','BA-RETAIL','ORG-DE01'],
        how: ['TYPE-A','DOC-STD','METHOD-1','PROCESS-2','CHANNEL-3'],
        why: ['REASON-01','COST-CTR','PROJECT-X','WBS-100','ALLOC-01'],
        how_many: ['0','100.00','250.00','1500.00','-99.50']
      };
      const arr = names[cat] || names.what;
      return arr[seed % arr.length];
    };

    const cols = event.columns;
    const thead = `<tr>${cols.map(c => `<th style="padding:6px 10px;text-align:left;white-space:nowrap;font-size:11px;background:#1c1c28;color:#e0e0f0">${this._esc(c.name||c.id)}</th>`).join('')}</tr>`;
    const tbody = Array.from({length:ROWS},(_,i) =>
      `<tr>${cols.map(c => `<td style="padding:5px 10px;font-size:12px;border-bottom:1px solid #f0f1f3;font-family:monospace">${this._esc(sample(c,i))}</td>`).join('')}</tr>`
    ).join('');

    const copyCSV = () => {
      const header = cols.map(c => c.name||c.id).join(',');
      const rows = Array.from({length:ROWS},(_,i) => cols.map(c => `"${sample(c,i).replace(/"/g,'""')}"`).join(','));
      navigator.clipboard?.writeText([header,...rows].join('\n')).then(() => showToast('Copied to clipboard'));
    };

    Modal.show({
      title: `Sample Data — ${event.name}`,
      body: `
        <div style="overflow-x:auto;max-height:340px;border:1px solid var(--border);border-radius:6px">
          <table style="border-collapse:collapse;width:100%">
            <thead>${thead}</thead><tbody>${tbody}</tbody>
          </table>
        </div>
        <p style="font-size:11px;color:var(--text-subtle);margin-top:8px">
          Illustrative values only. Dates start Jan 2024; IDs are sequential.
        </p>`,
      confirmLabel: 'Copy as CSV',
      onConfirm() { copyCSV(); Modal.hide(); }
    });
  },

  // ── Column field update ───────────────────────────────────

  updateColField(projectId, eventId, colId, field, value, refreshList) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const event = project.events.find(e => e.id === eventId);
    if (!event) return;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col[field] = value;
    if (field === 'publicDimensionId') {
      col.isConformed = !!value;
      if (!value) col.publicDimensionColId = '';
    }
    // Changing source triggers tab visibility changes — always refresh
    if (field === 'source') refreshList = true;
    Storage.saveEvent(projectId, event);
    if (refreshList) {
      // Re-render to update left panel (name/category changed)
      const activeTabs = document.querySelectorAll('.col-detail-tab.active');
      const activeTab = activeTabs.length > 0 ? activeTabs[0].dataset.tab : 'summary';
      Projects.renderEventDetail(projectId, eventId, colId, activeTab);
    }
  },

  // ── Add Column Modal ──────────────────────────────────────

  openAddColumnModal(projectId, eventId) {
    const catOpts = typeof CATEGORIES !== 'undefined'
      ? Object.entries(CATEGORIES).map(([k, c]) =>
          `<option value="${k}">${c.label}</option>`).join('')
      : '';
    const dtOpts = ['VARCHAR','INT','DECIMAL','DATE','DATETIME','BOOLEAN','UUID']
      .map(t => `<option value="${t}">${t}</option>`).join('');
    const srcOpts = typeof SOURCES !== 'undefined'
      ? Object.entries(SOURCES).map(([k, s]) =>
          `<option value="${k}">${s.label}</option>`).join('')
      : '<option value="source_system">Source System</option>';

    const allDims = typeof Storage.getAllDimTemplates === 'function'
      ? Storage.getAllDimTemplates()
      : (typeof DEFAULT_PUBLIC_DIMENSIONS !== 'undefined' ? DEFAULT_PUBLIC_DIMENSIONS : []);
    const dimOpts = allDims.map(d =>
      `<option value="${d.id}">${d.isCustom ? '★ ' : ''}${d.name}</option>`).join('');

    Modal.show({
      title: 'Add Column',
      body: `
        <div class="add-col-mode-strip">
          <label class="add-col-mode-btn active" id="modeNewLbl">
            <input type="radio" name="addColMode" value="new" checked
              onchange="document.getElementById('addColNewSec').style.display='';document.getElementById('addColTplSec').style.display='none';document.getElementById('modeNewLbl').classList.add('active');document.getElementById('modeTplLbl').classList.remove('active')">
            New Column
          </label>
          <label class="add-col-mode-btn" id="modeTplLbl">
            <input type="radio" name="addColMode" value="template"
              onchange="document.getElementById('addColNewSec').style.display='none';document.getElementById('addColTplSec').style.display='';document.getElementById('modeTplLbl').classList.add('active');document.getElementById('modeNewLbl').classList.remove('active');document.getElementById('colName').removeAttribute('required')">
            From Dimension Template
          </label>
        </div>

        <div id="addColNewSec">
          <div class="form-group">
            <label class="form-label" for="colName">Column name <span class="required">*</span></label>
            <input class="form-input" id="colName" type="text" placeholder="e.g. customer_id" autofocus maxlength="80">
          </div>
          <div class="form-group">
            <label class="form-label" for="colCat">7W Category</label>
            <select class="form-input" id="colCat">${catOpts}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="colType">Data Type</label>
            <select class="form-input" id="colType">${dtOpts}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="colSource">Source / Origin</label>
            <select class="form-input" id="colSource" onchange="Projects._onSourceHintChange(this.value)">${srcOpts}</select>
            <div id="colSourceHint" class="src-origin-hint" style="margin-top:5px"></div>
          </div>
        </div>

        <div id="addColTplSec" style="display:none">
          <div class="form-group">
            <label class="form-label" for="colDimId">Dimension Template</label>
            <select class="form-input" id="colDimId" onchange="Projects._onDimTemplateChange(this.value)">
              <option value="">— Choose a template —</option>
              ${dimOpts}
            </select>
          </div>
          <div id="colDimPreview" style="margin-top:4px"></div>
        </div>
      `,
      confirmLabel: 'Add Column',
      onConfirm() {
        const mode = document.querySelector('input[name="addColMode"]:checked')?.value || 'new';
        let col;
        const base = {
          id: Storage.generateId(),
          source: 'source_system',
          description: '', notes: '', formula: '',
          additiveType: 'fully_additive', budgetControl: false,
          responsibilityType: 'none', scdType: null,
          isNaturalKey: false, isSurrogateKey: false,
          plLineId: '', ownerId: '', cashFlowLineId: '',
          publicDimensionId: '', isConformed: false, publicDimensionColId: '',
          sapTable: '', sapField: '', sapMigrationStatus: '', sapModule: '',
          copaCharacteristic: '', copaValueField: '',
          hierarchyName: '', hierarchyLevel: null, isParentKey: false, parentColumnId: '',
          dateKeyRole: '', joinDimension: '', isFinancialAnchor: false,
          glAccount: '', glAccountRangeFrom: '', glAccountRangeTo: '',
          format: '', mlTag: 'none', isCashBased: false,
          stageSource: '', stageTarget: '', transformType: '', nullHandling: '',
          defaultValue: '', signReversal: false, unitConversion: '',
          dataQualityRule: '', stagingNote: ''
        };

        if (mode === 'template') {
          const dimId = document.getElementById('colDimId')?.value;
          if (!dimId) { Modal.shake(); return; }
          const allDims2 = typeof Storage.getAllDimTemplates === 'function' ? Storage.getAllDimTemplates() : [];
          const dim = allDims2.find(d => d.id === dimId);
          if (!dim || !(dim.columns || []).length) { Modal.shake(); return; }
          // Snowflake model — only the key (FK) column lives in the event
          const keyCol = (dim.columns || []).find(c => c.isKey || c.isSurrogateKey)
            || (dim.columns || [])[0];
          const newCol = {
            ...base,
            id: Storage.generateId(),
            name: keyCol.name,
            category: dim.category || keyCol.category || 'who',
            dataType: keyCol.dataType || 'INT',
            description: `Foreign key to ${dim.name}`,
            responsibilityType: keyCol.responsibilityType || 'none',
            publicDimensionId: dimId,
            publicDimensionColId: keyCol.id,
            isConformed: true
          };
          const project2 = Storage.getProject(projectId);
          const event2 = project2.events.find(e => e.id === eventId);
          if (!event2) return;
          event2.columns.push(newCol);
          Storage.saveEvent(projectId, event2);
          Modal.hide();
          Projects.renderEventDetail(projectId, eventId, newCol.id, 'summary');
          return;
        } else {
          const name = document.getElementById('colName')?.value.trim();
          if (!name) { Modal.shake(); return; }
          col = {
            ...base,
            name,
            category: document.getElementById('colCat')?.value || 'who',
            dataType: document.getElementById('colType')?.value || 'VARCHAR',
            source: document.getElementById('colSource')?.value || 'source_system',
          };
        }

        const project = Storage.getProject(projectId);
        const event = project.events.find(e => e.id === eventId);
        if (!event) return;
        event.columns.push(col);
        Storage.saveEvent(projectId, event);
        Modal.hide();
        Projects.renderEventDetail(projectId, eventId, col.id, 'summary');
      }
    });
  },

  // Called when user picks a dimension template in the add-column modal
  // Shows the FK key that will be added + the dim attributes available via JOIN
  _onDimTemplateChange(dimId) {
    const preview = document.getElementById('colDimPreview');
    if (!preview) return;
    if (!dimId) { preview.innerHTML = ''; return; }
    const allDims = typeof Storage.getAllDimTemplates === 'function' ? Storage.getAllDimTemplates() : [];
    const dim = allDims.find(d => d.id === dimId);
    if (!dim) { preview.innerHTML = ''; return; }
    const cols = dim.columns || [];
    const keyCol = cols.find(c => c.isKey || c.isSurrogateKey) || cols[0];
    const attrCols = cols.filter(c => c !== keyCol);
    preview.innerHTML = `
      <div style="background:#f0f9ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;margin-top:6px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#1d4ed8;margin-bottom:8px">FK column added to event</div>
        <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:#dbeafe;border-radius:4px;margin-bottom:10px">
          <span style="font-size:13px">🔑</span>
          <span style="font-weight:600;color:#1e3a8a;font-size:13px">${keyCol ? Projects._esc(keyCol.name) : '—'}</span>
          <span style="color:#3b82f6;font-size:11px">${keyCol ? (keyCol.dataType || 'INT') : ''}</span>
        </div>
        ${attrCols.length > 0 ? `
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:6px">
          ${attrCols.length} attribute${attrCols.length !== 1 ? 's' : ''} available via JOIN
        </div>
        ${attrCols.map(c => `
          <div style="display:flex;align-items:center;gap:8px;padding:2px 4px;font-size:11px;color:#6b7280">
            <span style="width:6px;height:6px;border-radius:50%;background:#d1d5db;flex-shrink:0"></span>
            <span style="color:#374151">${Projects._esc(c.name)}</span>
            <span style="color:#9ca3af">${c.dataType || 'VARCHAR'}</span>
          </div>`).join('')}` : ''}
        <div style="font-size:10px;color:#9ca3af;margin-top:8px;padding-top:6px;border-top:1px solid #bfdbfe">
          Snowflake model — only the foreign key lives in the event. Attributes are available via JOIN to the dimension table.
        </div>
      </div>`;
  },

  // Called when origin select changes in Add Column modal
  _onSourceHintChange(srcKey) {
    const hint = document.getElementById('colSourceHint');
    if (!hint) return;
    const src = typeof SOURCES !== 'undefined' && srcKey ? SOURCES[srcKey] : null;
    if (src && src.description) {
      hint.innerHTML = `<span style="color:${src.color}">${this._esc(src.description)}</span>`
        + (src.formatHint ? `<br><em style="color:var(--text-subtle);font-size:10px">${this._esc(src.formatHint)}</em>` : '');
    } else {
      hint.innerHTML = '';
    }
  },

  // ── Modals ────────────────────────────────────────────────

  openNewModal() {
    Modal.show({
      title: 'New Project',
      body: `
        <div class="form-group">
          <label class="form-label" for="projName">Project name <span class="required">*</span></label>
          <input class="form-input" id="projName" type="text" placeholder="e.g. Retail Sales DW" autofocus maxlength="80">
        </div>
        <div class="form-group">
          <label class="form-label" for="projDesc">Description <span class="optional">(optional)</span></label>
          <textarea class="form-input" id="projDesc" rows="3" placeholder="What data warehouse or subject area does this project cover?"></textarea>
        </div>
      `,
      confirmLabel: 'Create Project',
      onConfirm() {
        const name = document.getElementById('projName').value.trim();
        const desc = document.getElementById('projDesc').value.trim();
        if (!name) { Modal.shake(); return; }
        const project = {
          id: Storage.generateId(),
          name,
          description: desc,
          createdAt: new Date().toISOString(),
          events: []
        };
        Storage.saveProject(project);
        Modal.hide();
        Router.navigate(`project/${project.id}`);
      }
    });
  },

  openRenameModal(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    Modal.show({
      title: 'Rename Project',
      body: `
        <div class="form-group">
          <label class="form-label" for="projName">Project name <span class="required">*</span></label>
          <input class="form-input" id="projName" type="text" value="${this._esc(project.name)}" autofocus maxlength="80">
        </div>
        <div class="form-group">
          <label class="form-label" for="projDesc">Description</label>
          <textarea class="form-input" id="projDesc" rows="3">${this._esc(project.description || '')}</textarea>
        </div>
      `,
      confirmLabel: 'Save',
      onConfirm() {
        const name = document.getElementById('projName').value.trim();
        const desc = document.getElementById('projDesc').value.trim();
        if (!name) { Modal.shake(); return; }
        project.name = name;
        project.description = desc;
        Storage.saveProject(project);
        Modal.hide();
        Projects.renderProject(projectId);
      }
    });
  },

  openNewEventModal(projectId) {
    Modal.show({
      title: 'New Business Event',
      body: `
        <div class="form-group">
          <label class="form-label" for="evtName">Event name <span class="required">*</span></label>
          <input class="form-input" id="evtName" type="text" placeholder="e.g. Sale, Shipment, Login" autofocus maxlength="80">
          <p class="form-hint">Use a noun or noun phrase describing something that <em>happens</em> in the business.</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="evtDesc">Description <span class="optional">(optional)</span></label>
          <textarea class="form-input" id="evtDesc" rows="2" placeholder="e.g. A product is sold to a customer at a store"></textarea>
        </div>
      `,
      confirmLabel: 'Create Event',
      onConfirm() {
        const name = document.getElementById('evtName').value.trim();
        const desc = document.getElementById('evtDesc').value.trim();
        if (!name) { Modal.shake(); return; }
        const event = {
          id: Storage.generateId(),
          name,
          description: desc,
          columns: []
        };
        Storage.saveEvent(projectId, event);
        Modal.hide();
        Router.navigate(`event/${event.id}`);
      }
    });
  },

  confirmDelete(projectId, name) {
    Modal.show({
      title: 'Delete Project',
      body: `<p>Are you sure you want to delete <strong>${this._esc(name)}</strong>? This will remove all events and columns. This cannot be undone.</p>`,
      confirmLabel: 'Delete',
      confirmDanger: true,
      onConfirm() {
        Storage.deleteProject(projectId);
        Modal.hide();
        Projects.renderList();
      }
    });
  },

  confirmDeleteEvent(projectId, eventId, name) {
    Modal.show({
      title: 'Delete Event',
      body: `<p>Are you sure you want to delete the event <strong>${this._esc(name)}</strong> and all its columns?</p>`,
      confirmLabel: 'Delete',
      confirmDanger: true,
      onConfirm() {
        Storage.deleteEvent(projectId, eventId);
        Modal.hide();
        Projects.renderProject(projectId);
      }
    });
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
