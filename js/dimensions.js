const DimensionLibrary = {

  // ── In-memory state for the editor ───────────────────────
  _editorState: null,

  // ── List view ─────────────────────────────────────────────

  renderList() {
    const builtIns = typeof DEFAULT_PUBLIC_DIMENSIONS !== 'undefined' ? DEFAULT_PUBLIC_DIMENSIONS : [];
    const custom = Storage.load().customDimensions || [];
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Dimension Library</h1>
          <p class="view-subtitle">Conformed dimension templates — apply to any event or create your own</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" onclick="Router.navigate('dimension/new')">+ New Dimension</button>
        </div>
      </div>

      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>What are conformed dimensions?</strong> Conformed dimensions are shared across multiple
        fact tables, enabling <em>drill-across</em> analysis. For example, a <strong>Date</strong>
        dimension shared between Sales and Cost facts lets you compare revenue and cost side-by-side
        on the same time axis. Built-in templates are read-only — clone one to create an editable copy,
        or create a new custom dimension from scratch.
      </div>

      ${custom.length > 0 ? `
      <div class="dim-section-label">My Custom Dimensions</div>
      <div class="dim-library-grid">
        ${custom.map(d => this._customCard(d)).join('')}
      </div>
      ` : `
      <div class="dim-section-label">My Custom Dimensions</div>
      <div class="dim-empty-custom">
        No custom dimensions yet.
        <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="Router.navigate('dimension/new')">+ Create one</button>
      </div>
      `}

      <div class="dim-section-label" style="margin-top:24px">Built-in Templates</div>
      <div class="dim-library-grid">
        ${builtIns.map(d => this._card(d)).join('')}
      </div>
    `;
  },

  _card(dim) {
    const cat = CATEGORIES[dim.category] || {};
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
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); DimensionLibrary.cloneBuiltIn('${dim.id}')">Clone</button>
        </div>
      </div>
    `;
  },

  _customCard(dim) {
    const cat = CATEGORIES[dim.category] || {};
    const previewCols = dim.columns.slice(0, 5);
    return `
      <div class="dim-card dim-card-custom" onclick="Router.navigate('dimension/${dim.id}')">
        <div class="dim-card-header">
          <div class="dim-card-icon">${dim.icon || '📋'}</div>
          <div style="flex:1;min-width:0">
            <div class="dim-card-title">${this._esc(dim.name)}
              <span class="dim-card-custom-badge">Custom</span>
            </div>
            <div class="dim-card-category">
              <span class="badge-sm" style="background:${cat.color || '#6b7280'}">${cat.label || dim.category}</span>
            </div>
          </div>
        </div>
        <p class="dim-card-desc">${this._esc(dim.description || '')}</p>
        <div class="dim-card-cols">
          ${previewCols.map(c => `<span class="dim-col-pill ${c.isKey ? 'is-key' : ''}">${this._esc(c.name)}</span>`).join('')}
          ${dim.columns.length > 5 ? `<span class="dim-col-pill" style="color:var(--text-subtle)">+${dim.columns.length - 5} more</span>` : ''}
        </div>
        <div class="dim-card-actions">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); DimensionLibrary.openApplyModal('${dim.id}')">Apply to Event</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); Router.navigate('dimension/${dim.id}/edit')">Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="event.stopPropagation(); DimensionLibrary.confirmDelete('${dim.id}')">Delete</button>
        </div>
      </div>
    `;
  },

  // ── Detail / read-only view ───────────────────────────────

  renderTemplate(dimId) {
    const dim = Storage.getAllDimTemplates().find(d => d.id === dimId);
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
          ${dim.isCustom
            ? `<button class="btn btn-ghost" onclick="Router.navigate('dimension/${dim.id}/edit')">Edit →</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="DimensionLibrary.cloneBuiltIn('${dim.id}')">Clone to edit</button>`}
          <button class="btn btn-primary" onclick="DimensionLibrary.openApplyModal('${dim.id}')">Apply to Event</button>
        </div>
      </div>

      <div class="project-meta">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
          <span style="font-size:28px">${dim.icon || '📋'}</span>
          <h1 class="view-title" style="margin:0">${this._esc(dim.name)}</h1>
          <span class="badge-sm" style="background:${cat.color || '#6b7280'}">${cat.label || dim.category} dimension</span>
          ${dim.isCustom ? '<span class="dim-card-custom-badge">Custom</span>' : ''}
        </div>
        <p class="view-subtitle">${this._esc(dim.description || '')}</p>
      </div>

      <div class="info-banner" style="border-left-color:${cat.color || '#6b7280'}">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>7W Category: ${cat.label || dim.category}</strong> — ${cat.meaning || ''}.<br>
        ${cat.outcome || 'Becomes a dimension table'} in the star schema.
        When applied to an event, these columns are added to the BEAM matrix as
        <em>${cat.label || dim.category}</em> dimension attributes.
        ${dim.isCustom ? '' : ' This is a built-in template — <a href="javascript:void(0)" onclick="DimensionLibrary.cloneBuiltIn(\'' + dim.id + '\')">clone it</a> to create an editable copy.'}
      </div>

      <div class="dim-detail-cols">
        <table class="dim-detail-table">
          <thead>
            <tr>
              <th>Column Name</th>
              <th>Data Type</th>
              <th>Responsibility</th>
              <th>Hierarchy</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${dim.columns.map(c => {
              const rt = RESPONSIBILITY_TYPES[c.responsibilityType] || {};
              const hlevel = c.hierarchyLevel !== null && c.hierarchyLevel !== undefined ? c.hierarchyLevel : null;
              const hierCell = hlevel !== null
                ? `<span style="font-size:11px;font-weight:600;color:#7c3aed">L${hlevel}</span>${c.isParentKey ? ' <span title="Self-ref parent key" style="font-size:10px;color:#7c3aed">⇡ Parent</span>' : ''}`
                : (c.isParentKey ? '<span title="Self-ref parent key" style="font-size:10px;color:#7c3aed">⇡ Parent</span>' : '<span style="color:var(--text-subtle)">—</span>');
              return `
                <tr>
                  <td>
                    ${c.isKey ? '<span class="key-indicator">PK</span> ' : ''}
                    <code>${this._esc(c.name)}</code>
                  </td>
                  <td><code>${this._esc(c.dataType)}</code></td>
                  <td>${c.responsibilityType !== 'none' ? `<span style="color:${rt.color || '#9ca3af'};font-size:12px;font-weight:600">${rt.label || c.responsibilityType}</span>` : '<span style="color:var(--text-subtle)">—</span>'}</td>
                  <td>${hierCell}</td>
                  <td style="color:var(--text-muted)">${this._esc(c.description || '')}</td>
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

  // ── Full-page editor (create & edit) ──────────────────────

  renderEditor(dimId) {
    const isNew = !dimId;
    const existing = dimId ? Storage.getAllDimTemplates().find(d => d.id === dimId) : null;

    // Guard: built-ins cannot be edited
    if (existing && !existing.isCustom) { Router.navigate('dimensions'); return; }

    const dim = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: Storage.generateId(),
      isCustom: true,
      name: '',
      category: 'who',
      icon: '',
      description: '',
      createdAt: new Date().toISOString(),
      columns: []
    };

    // Store working copy
    this._editorState = { dim };

    const catOpts = Object.entries(CATEGORIES)
      .filter(([k]) => k !== 'how_many')
      .map(([k, c]) => `<option value="${k}" ${dim.category === k ? 'selected' : ''}>${c.label} — ${c.meaning || c.label}</option>`)
      .join('');

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#dimensions">Dimension Library</a>
          <span class="bc-sep">›</span>
          <span>${isNew ? 'New Custom Dimension' : 'Edit: ' + this._esc(dim.name)}</span>
        </div>
        ${!isNew ? `
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" style="color:#ef4444"
            onclick="DimensionLibrary.confirmDelete('${dim.id}')">Delete dimension</button>
        </div>` : ''}
      </div>

      <div class="project-meta" style="margin-bottom:20px">
        <div class="dim-editor-meta-grid">
          <div class="form-group" style="grid-column:1/3">
            <label class="form-label">Name <span class="required">*</span></label>
            <input class="form-input" id="dimName" value="${this._esc(dim.name)}"
              placeholder="e.g. Vendor / Supplier" maxlength="80">
          </div>
          <div class="form-group">
            <label class="form-label">Icon <span class="optional">(emoji)</span></label>
            <input class="form-input" id="dimIcon" value="${this._esc(dim.icon || '')}"
              placeholder="🏭" style="max-width:80px">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">7W Category <span class="required">*</span></label>
            <select class="form-input" id="dimCategory" style="max-width:400px">${catOpts}</select>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Description</label>
            <textarea class="form-input" id="dimDesc" rows="2"
              placeholder="What this dimension represents and when to use it">${this._esc(dim.description || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="dim-editor-section">
        <div class="dim-editor-section-header">
          <h3>Columns (${dim.columns.length})</h3>
          <button class="btn btn-ghost btn-sm" style="color:#e0e0f0"
            onclick="DimensionLibrary._addEditorCol()">+ Add Column</button>
        </div>
        <div class="dim-editor-cols-wrap">
          <table class="dim-editor-table">
            <thead>
              <tr>
                <th style="width:28px"></th>
                <th>Column Name</th>
                <th style="width:120px">Data Type</th>
                <th style="width:52px;text-align:center">Key</th>
                <th style="width:160px">Responsibility</th>
                <th>Description</th>
                <th style="width:80px;text-align:center" title="Hierarchy level (1 = top). Used for rollup/drill-down paths.">H.Level</th>
                <th style="width:56px;text-align:center" title="Mark as self-referencing parent key (generates recursive FK in DDL)">Parent</th>
                <th style="width:32px"></th>
              </tr>
            </thead>
            <tbody id="dimEditorBody">
              ${dim.columns.map(c => this._editorRow(c)).join('')}
            </tbody>
          </table>
          ${dim.columns.length === 0
            ? '<p class="dim-editor-empty">No columns yet — click <strong>+ Add Column</strong> to begin.</p>'
            : ''}
        </div>
      </div>

      <div class="dim-editor-footer">
        <button class="btn btn-primary" onclick="DimensionLibrary._saveEditor()">
          ${isNew ? 'Create Dimension' : 'Save Changes'}
        </button>
        <a href="${isNew ? '#dimensions' : '#dimension/' + dim.id}" class="btn btn-ghost">Cancel</a>
      </div>
    `;
  },

  // ── Column editor helpers ─────────────────────────────────

  _editorRow(col) {
    const typeOpts = ['VARCHAR','INT','BIGINT','DECIMAL','FLOAT','DATE','DATETIME','BOOLEAN','TEXT','UUID']
      .map(t => `<option value="${t}" ${col.dataType === t ? 'selected' : ''}>${t}</option>`).join('');
    const rtOpts = Object.entries(RESPONSIBILITY_TYPES)
      .map(([k, r]) => `<option value="${k}" ${col.responsibilityType === k ? 'selected' : ''}>${r.label}</option>`).join('');
    return `
      <tr data-col-id="${col.id}" class="dim-editor-row">
        <td class="col-drag" style="cursor:grab;color:var(--text-subtle);text-align:center;font-size:14px">⠿</td>
        <td><input class="cell-input" value="${this._esc(col.name)}" placeholder="column_name"
              onblur="DimensionLibrary._updateEditorCol('${col.id}','name',this.value)"></td>
        <td><select class="cell-select"
              onchange="DimensionLibrary._updateEditorCol('${col.id}','dataType',this.value)">${typeOpts}</select></td>
        <td style="text-align:center">
          <input type="checkbox" ${col.isKey ? 'checked' : ''}
            onchange="DimensionLibrary._updateEditorCol('${col.id}','isKey',this.checked)"
            title="Mark as primary / surrogate key">
        </td>
        <td><select class="cell-select"
              onchange="DimensionLibrary._updateEditorCol('${col.id}','responsibilityType',this.value)">${rtOpts}</select></td>
        <td><input class="cell-input" value="${this._esc(col.description || '')}" placeholder="What this column represents…"
              onblur="DimensionLibrary._updateEditorCol('${col.id}','description',this.value)"></td>
        <td style="text-align:center">
          <input type="number" class="cell-input" min="1" max="10" style="width:56px;font-size:12px;text-align:center"
            value="${col.hierarchyLevel !== null && col.hierarchyLevel !== undefined ? col.hierarchyLevel : ''}"
            placeholder="—"
            title="Hierarchy level: 1 = top/root, 2 = next level down, etc."
            onblur="DimensionLibrary._updateEditorCol('${col.id}','hierarchyLevel',this.value ? parseInt(this.value) : null)">
        </td>
        <td style="text-align:center">
          <input type="checkbox" ${col.isParentKey ? 'checked' : ''}
            onchange="DimensionLibrary._updateEditorCol('${col.id}','isParentKey',this.checked)"
            title="Self-referencing parent key — points to the parent row in the same dimension table">
        </td>
        <td><button class="btn-icon delete-row" title="Remove column"
              onclick="DimensionLibrary._deleteEditorCol('${col.id}')">✕</button></td>
      </tr>`;
  },

  _addEditorCol() {
    if (!this._editorState) return;
    const col = {
      id: Storage.generateId(),
      name: '',
      dataType: 'VARCHAR',
      isKey: false,
      responsibilityType: 'none',
      description: '',
      hierarchyLevel: null,
      hierarchyName: '',
      isParentKey: false,
      parentColumnId: ''
    };
    this._editorState.dim.columns.push(col);
    const tbody = document.getElementById('dimEditorBody');
    if (tbody) {
      tbody.insertAdjacentHTML('beforeend', this._editorRow(col));
      // Remove empty-state paragraph if present
      const empty = document.querySelector('.dim-editor-empty');
      if (empty) empty.remove();
    }
    // Update column count in header
    const hdr = document.querySelector('.dim-editor-section-header h3');
    if (hdr) hdr.textContent = `Columns (${this._editorState.dim.columns.length})`;
  },

  _updateEditorCol(colId, field, value) {
    if (!this._editorState) return;
    const col = this._editorState.dim.columns.find(c => c.id === colId);
    if (col) col[field] = value;
  },

  _deleteEditorCol(colId) {
    if (!this._editorState) return;
    this._editorState.dim.columns = this._editorState.dim.columns.filter(c => c.id !== colId);
    const row = document.querySelector(`tr[data-col-id="${colId}"]`);
    if (row) row.remove();
    // Update column count
    const hdr = document.querySelector('.dim-editor-section-header h3');
    if (hdr) hdr.textContent = `Columns (${this._editorState.dim.columns.length})`;
    if (this._editorState.dim.columns.length === 0) {
      const wrap = document.querySelector('.dim-editor-cols-wrap');
      if (wrap && !wrap.querySelector('.dim-editor-empty')) {
        wrap.insertAdjacentHTML('beforeend', '<p class="dim-editor-empty">No columns yet — click <strong>+ Add Column</strong> to begin.</p>');
      }
    }
  },

  _saveEditor() {
    if (!this._editorState) return;
    const dim = this._editorState.dim;

    // Flush DOM fields
    const nameEl = document.getElementById('dimName');
    dim.name = nameEl ? nameEl.value.trim() : dim.name;
    dim.icon = (document.getElementById('dimIcon') || {}).value || '';
    dim.category = (document.getElementById('dimCategory') || {}).value || dim.category;
    dim.description = (document.getElementById('dimDesc') || {}).value || '';

    // Validate
    if (!dim.name) {
      if (nameEl) { nameEl.classList.add('input-error'); nameEl.focus(); }
      showToast('Please enter a dimension name.');
      return;
    }
    if (dim.columns.length === 0) {
      showToast('Add at least one column before saving.');
      return;
    }

    Storage.saveCustomDimension(dim);
    showToast(`Dimension "${dim.name}" saved.`);
    Router.navigate('dimensions');
  },

  // ── Clone built-in as custom ──────────────────────────────

  cloneBuiltIn(dimId) {
    const builtIns = typeof DEFAULT_PUBLIC_DIMENSIONS !== 'undefined' ? DEFAULT_PUBLIC_DIMENSIONS : [];
    const src = builtIns.find(d => d.id === dimId);
    if (!src) return;
    const clone = {
      ...JSON.parse(JSON.stringify(src)),
      id: Storage.generateId(),
      isCustom: true,
      name: src.name + ' (copy)',
      createdAt: new Date().toISOString(),
      columns: src.columns.map(c => ({ ...c, id: Storage.generateId() }))
    };
    Storage.saveCustomDimension(clone);
    showToast(`Cloned "${src.name}" — edit it below.`);
    Router.navigate(`dimension/${clone.id}/edit`);
  },

  // ── Delete custom dimension ───────────────────────────────

  confirmDelete(dimId) {
    const dim = Storage.getAllDimTemplates().find(d => d.id === dimId);
    if (!dim || !dim.isCustom) return;
    Modal.show({
      title: `Delete "${dim.name}"?`,
      body: `<p>This will remove the dimension template. Any event columns that reference it will be unlinked — their data is kept.</p>`,
      confirmLabel: 'Delete',
      confirmDanger: true,
      onConfirm: () => {
        Storage.deleteCustomDimension(dimId);
        Modal.hide();
        showToast(`Deleted "${dim.name}"`);
        Router.navigate('dimensions');
      }
    });
  },

  // ── Apply modal ───────────────────────────────────────────

  openApplyModal(dimId) {
    const dim = Storage.getAllDimTemplates().find(d => d.id === dimId);
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
          <div id="applyColList" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:5px;padding:8px">
            ${dim.columns.map(c => `
              <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer">
                <input type="checkbox" checked value="${this._esc(c.name)}"
                  data-dtype="${c.dataType}" data-desc="${this._esc(c.description || '')}"
                  data-resp="${c.responsibilityType}" data-key="${c.isKey}">
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
