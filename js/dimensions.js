const DimensionLibrary = {

  renderList() {
    const dims = DEFAULT_PUBLIC_DIMENSIONS;
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Public Dimension Library</h1>
          <p class="view-subtitle">Standard conformed dimension templates — apply to any event to pre-populate the BEAM matrix</p>
        </div>
      </div>

      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>What are conformed dimensions?</strong> Conformed dimensions are shared across multiple
        fact tables, enabling <em>drill-across</em> analysis. For example, a <strong>Date</strong>
        dimension shared between Sales and Cost facts lets you compare revenue and cost side-by-side
        on the same time axis. Applying a template here pre-fills the BEAM matrix rows — you can
        always edit or remove individual columns before saving.
      </div>

      <div class="dim-library-grid">
        ${dims.map(d => this._card(d)).join('')}
      </div>
    `;
  },

  _card(dim) {
    const cat = CATEGORIES[dim.category] || {};
    const keyCol = dim.columns.find(c => c.isKey);
    const previewCols = dim.columns.slice(0, 5);
    return `
      <div class="dim-card" onclick="Router.navigate('dimension/${dim.id}')">
        <div class="dim-card-header">
          <div class="dim-card-icon">${dim.icon || '📋'}</div>
          <div>
            <div class="dim-card-title">${this._esc(dim.name)}</div>
            <div class="dim-card-category">
              <span class="badge-sm" style="background:${cat.color || '#6b7280'}">${cat.label || dim.category}</span>
            </div>
          </div>
        </div>
        <p class="dim-card-desc">${this._esc(dim.description)}</p>
        <div class="dim-card-cols">
          ${previewCols.map(c => `<span class="dim-col-pill ${c.isKey ? 'is-key' : ''}">${this._esc(c.name)}</span>`).join('')}
          ${dim.columns.length > 5 ? `<span class="dim-col-pill" style="color:var(--text-subtle)">+${dim.columns.length - 5} more</span>` : ''}
        </div>
        <div class="dim-card-actions">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); DimensionLibrary.openApplyModal('${dim.id}')">Apply to Event</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); Router.navigate('dimension/${dim.id}')">View columns</button>
        </div>
      </div>
    `;
  },

  renderTemplate(dimId) {
    const dim = DEFAULT_PUBLIC_DIMENSIONS.find(d => d.id === dimId);
    if (!dim) { Router.navigate('dimensions'); return; }
    const cat = CATEGORIES[dim.category] || {};
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#dimensions">Dimension Library</a>
          <span class="bc-sep">›</span>
          <span>${this._esc(dim.name)}</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" onclick="DimensionLibrary.openApplyModal('${dim.id}')">Apply to Event</button>
        </div>
      </div>

      <div class="project-meta">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="font-size:28px">${dim.icon || '📋'}</span>
          <h1 class="view-title" style="margin:0">${this._esc(dim.name)}</h1>
          <span class="badge-sm" style="background:${cat.color || '#6b7280'}">${cat.label || dim.category} dimension</span>
        </div>
        <p class="view-subtitle">${this._esc(dim.description)}</p>
      </div>

      <div class="info-banner" style="border-left-color:${cat.color || '#6b7280'}">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>7W Category: ${cat.label || dim.category}</strong> — ${cat.meaning || ''}.<br>
        ${cat.outcome || 'Becomes a dimension table'} in the star schema.
        When applied to an event, these columns are added to the BEAM matrix as
        <em>${cat.label || dim.category}</em> dimension attributes.
      </div>

      <div class="dim-detail-cols">
        <table class="dim-detail-table">
          <thead>
            <tr>
              <th>Column Name</th>
              <th>Data Type</th>
              <th>Responsibility</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${dim.columns.map(c => {
              const rt = RESPONSIBILITY_TYPES[c.responsibilityType] || {};
              return `
                <tr>
                  <td>
                    ${c.isKey ? '<span class="key-indicator">PK</span> ' : ''}
                    <code>${this._esc(c.name)}</code>
                  </td>
                  <td><code>${this._esc(c.dataType)}</code></td>
                  <td>${c.responsibilityType !== 'none' ? `<span style="color:${rt.color || '#9ca3af'};font-size:12px;font-weight:600">${rt.label || c.responsibilityType}</span>` : '<span style="color:var(--text-subtle)">—</span>'}</td>
                  <td style="color:var(--text-muted)">${this._esc(c.description)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:8px">
        <button class="btn btn-primary" onclick="DimensionLibrary.openApplyModal('${dim.id}')">Apply to Event →</button>
        <a href="#dimensions" class="btn btn-ghost" style="margin-left:8px">← Back to Library</a>
      </div>
    `;
  },

  openApplyModal(dimId) {
    const dim = DEFAULT_PUBLIC_DIMENSIONS.find(d => d.id === dimId);
    if (!dim) return;
    const data = Storage.load();

    if (!data.projects.length) {
      Modal.show({
        title: 'No Projects',
        body: '<p>Create a project and at least one event before applying a dimension template.</p>',
        confirmLabel: 'Go to Projects',
        onConfirm() { Modal.hide(); Router.navigate('projects'); }
      });
      return;
    }

    const projectOpts = data.projects.map(p =>
      `<option value="${p.id}">${this._esc(p.name)}</option>`).join('');

    Modal.show({
      title: `Apply "${dim.name}" to Event`,
      body: `
        <div class="form-group">
          <label class="form-label">Project</label>
          <select class="form-input" id="applyProject" onchange="DimensionLibrary._updateEventSelect(this.value)">
            ${projectOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Event <span class="required">*</span></label>
          <select class="form-input" id="applyEvent"></select>
        </div>
        <div class="form-group">
          <label class="form-label">Columns to apply</label>
          <div id="applyColList" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:5px;padding:8px">
            ${dim.columns.map(c => `
              <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer">
                <input type="checkbox" checked value="${this._esc(c.name)}" data-dtype="${c.dataType}" data-desc="${this._esc(c.description)}" data-resp="${c.responsibilityType}" data-key="${c.isKey}">
                <code style="font-size:12px">${this._esc(c.name)}</code>
                <span style="font-size:11px;color:var(--text-muted)">${c.dataType}</span>
                ${c.isKey ? '<span class="key-indicator">PK</span>' : ''}
              </label>`).join('')}
          </div>
        </div>
        <p class="form-hint">Selected columns will be added to the event's BEAM matrix. Existing columns are not affected.</p>
      `,
      confirmLabel: 'Apply Template',
      onConfirm: () => {
        const projectId = document.getElementById('applyProject').value;
        const eventId = document.getElementById('applyEvent').value;
        if (!eventId) { Modal.shake(); return; }
        const checked = [...document.querySelectorAll('#applyColList input:checked')];
        if (!checked.length) { Modal.shake(); return; }
        const found = Storage.getEvent(eventId);
        if (!found) return;
        const { event, project } = found;
        checked.forEach(inp => {
          event.columns.push({
            id: Storage.generateId(),
            name: inp.value,
            category: dim.category,
            source: 'source_system',
            dataType: inp.dataset.dtype || 'VARCHAR',
            format: '',
            description: inp.dataset.desc || '',
            notes: '',
            additiveType: 'fully_additive',
            requiredGrain: null,
            formula: '',
            budgetControl: false,
            plLineId: '',
            responsibilityType: inp.dataset.resp || 'none',
            publicDimensionId: dim.id,
            isConformed: true
          });
        });
        Storage.saveEvent(projectId, event);
        Modal.hide();
        showToast(`Applied ${checked.length} column${checked.length !== 1 ? 's' : ''} from "${dim.name}"`);
        Router.navigate(`event/${eventId}`);
      }
    });

    // Populate events for first project
    const firstProject = data.projects[0];
    if (firstProject) this._updateEventSelect(firstProject.id);
  },

  _updateEventSelect(projectId) {
    const project = Storage.getProject(projectId);
    const sel = document.getElementById('applyEvent');
    if (!sel || !project) return;
    if (!project.events.length) {
      sel.innerHTML = '<option value="">No events in this project</option>';
      return;
    }
    sel.innerHTML = project.events.map(e =>
      `<option value="${e.id}">${this._esc(e.name)}</option>`).join('');
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
