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

    const grain = event.grain || 'transaction';
    const grainInfo = (typeof GRAINS !== 'undefined' && GRAINS[grain]) || { label: grain, color: '#6b7280' };
    const grainBadge = `<span class="grain-badge" style="background:${grainInfo.color}18;color:${grainInfo.color};border:1px solid ${grainInfo.color}40">${this._esc(grainInfo.label)}</span>`;

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
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('event/${eventId}')">Edit Matrix</button>
          <button class="btn btn-primary btn-sm" onclick="Projects.openAddColumnModal('${projectId}', '${eventId}')">+ Add Column</button>
        </div>
      </div>

      <div class="event-detail-wrap">
        <div class="event-detail-meta">
          ${grainBadge}
          ${event.description ? `<span>${this._esc(event.description)}</span>` : ''}
          <span style="margin-left:auto;color:var(--text-subtle)">${event.columns.length} column${event.columns.length !== 1 ? 's' : ''}</span>
        </div>

        <div class="event-detail-layout">
          <div class="col-list-panel">
            <div class="col-list-header">
              <span>Columns</span>
              <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 7px;text-transform:none;letter-spacing:0" onclick="Projects.openAddColumnModal('${projectId}', '${eventId}')">+ Add</button>
            </div>
            <div class="col-list-body">
              ${event.columns.length === 0
                ? `<div class="col-list-empty">No columns yet.<br>Click <strong>+ Add</strong> to begin.</div>`
                : event.columns.map(c => this._colListItem(c, colId, projectId, eventId, tab)).join('')
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
  },

  _colListItem(col, selectedColId, projectId, eventId, tab) {
    const cat = (typeof CATEGORIES !== 'undefined' && CATEGORIES[col.category]) || { color: '#6b7280' };
    const isActive = col.id === selectedColId;
    return `
      <div class="col-list-item${isActive ? ' active' : ''}"
        onclick="Projects.renderEventDetail('${projectId}', '${eventId}', '${col.id}', '${tab}')">
        <div class="col-cat-dot" style="background:${cat.color}"></div>
        <span class="col-item-name" title="${this._esc(col.name)}">${this._esc(col.name) || '<em style="color:var(--text-subtle)">unnamed</em>'}</span>
        <span class="col-item-type">${this._esc(col.dataType || 'VARCHAR')}</span>
      </div>
    `;
  },

  _colDetailPanel(col, event, project, tab) {
    const pId = project.id;
    const eId = event.id;
    const cId = col.id;
    const tabDefs = [
      { id: 'summary',   label: 'Summary' },
      { id: 'technical', label: 'Technical' },
      { id: 'hierarchy', label: 'Hierarchy' },
      { id: 'notes',     label: 'Notes' },
      { id: 'conformed', label: 'Conformed' },
    ];
    const tabButtons = tabDefs.map(t =>
      `<button class="col-detail-tab${tab === t.id ? ' active' : ''}" data-tab="${t.id}"
        onclick="Projects.renderEventDetail('${pId}', '${eId}', '${cId}', '${t.id}')">${t.label}</button>`
    ).join('');

    let body = '';
    if      (tab === 'summary')   body = this._tabSummary(col, event, project);
    else if (tab === 'technical') body = this._tabTechnical(col, event, project);
    else if (tab === 'hierarchy') body = this._tabHierarchy(col, event, project);
    else if (tab === 'notes')     body = this._tabNotes(col, event, project);
    else if (tab === 'conformed') body = this._tabConformed(col, event, project);

    return `<div class="col-detail-tabs">${tabButtons}</div><div class="col-detail-body">${body}</div>`;
  },

  // ── Tab: Summary ──────────────────────────────────────────

  _tabSummary(col, event, project) {
    const pId = project.id; const eId = event.id; const cId = col.id;
    const isMeasure = col.category === 'how_many';

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

    return `
      <div class="cd-section">
        <div class="cd-section-title">Identity</div>
        <div class="cd-grid g2">
          <div class="cd-field" style="grid-column:1/-1">
            <label>Column Name</label>
            <input type="text" value="${this._esc(col.name)}"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','name',this.value,true)">
          </div>
          <div class="cd-field">
            <label>7W Category</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','category',this.value,true)">${catOpts}</select>
          </div>
          <div class="cd-field">
            <label>Data Type</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','dataType',this.value,false)">${dtOpts}</select>
          </div>
          <div class="cd-field" style="grid-column:1/-1">
            <label>Format / Examples</label>
            <input type="text" value="${this._esc(col.format || '')}" placeholder="e.g. YYYY-MM-DD, max 255 chars"
              onchange="Projects.updateColField('${pId}','${eId}','${cId}','format',this.value,false)">
          </div>
          <div class="cd-field" style="grid-column:1/-1">
            <label>Description</label>
            <textarea onchange="Projects.updateColField('${pId}','${eId}','${cId}','description',this.value,false)"
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
            <label>Owner</label>
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

    return `
      <div class="cd-section">
        <div class="cd-section-title">Conformed Dimension Link</div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
          Link this column to a shared dimension template to mark it as a conformed reference.
          Conformed dimensions ensure consistent data meaning across multiple events and marts.
        </p>
        <div class="cd-grid g1">
          <div class="cd-field">
            <label>Dimension Template</label>
            <select onchange="Projects.updateColField('${pId}','${eId}','${cId}','publicDimensionId',this.value,false)">${dimOpts}</select>
          </div>
        </div>
        ${col.isConformed && linked ? `
        <div class="conformed-link-badge" style="margin-top:12px">
          <svg viewBox="0 0 16 16" fill="currentColor" style="width:13px;height:13px"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.2 5.5l-3.7 3.7a.75.75 0 01-1.06 0L4.8 8.5a.75.75 0 011.06-1.06l1.1 1.1 3.18-3.18a.75.75 0 111.06 1.06z"/></svg>
          Conformed — ${this._esc(linked.name)}
          <a href="#dimension/${linked.id}" style="margin-left:6px;font-size:11px;font-weight:400;color:var(--info)">View template →</a>
        </div>` : ''}
      </div>
      <div style="font-size:11px;color:var(--text-subtle);margin-top:16px;line-height:1.6">
        <strong>Built-in templates</strong> provide a standard structure but are read-only.
        Use the <a href="#dimensions" style="color:var(--info)">Dimension Library</a> to create custom dimensions or clone a built-in.
      </div>
    `;
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
    if (field === 'publicDimensionId') col.isConformed = !!value;
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
    Modal.show({
      title: 'Add Column',
      body: `
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
      `,
      confirmLabel: 'Add Column',
      onConfirm() {
        const name = document.getElementById('colName')?.value.trim();
        if (!name) { Modal.shake(); return; }
        const col = {
          id: Storage.generateId(),
          name,
          category: document.getElementById('colCat')?.value || 'who',
          dataType: document.getElementById('colType')?.value || 'VARCHAR',
          source: 'source_system',
          description: '', notes: '', formula: '',
          additiveType: 'fully_additive', budgetControl: false,
          responsibilityType: 'none', scdType: null,
          isNaturalKey: false, isSurrogateKey: false,
          plLineId: '', ownerId: '', cashFlowLineId: '',
          publicDimensionId: '', isConformed: false,
          sapTable: '', sapField: '', sapMigrationStatus: '', sapModule: '',
          copaCharacteristic: '', copaValueField: '',
          hierarchyName: '', hierarchyLevel: null, isParentKey: false, parentColumnId: '',
          dateKeyRole: '', joinDimension: '', isFinancialAnchor: false,
          glAccount: '', glAccountRangeFrom: '', glAccountRangeTo: '',
          format: '', mlTag: 'none', isCashBased: false
        };
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
