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
      <div class="card event-card" onclick="Router.navigate('event/${event.id}')">
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
