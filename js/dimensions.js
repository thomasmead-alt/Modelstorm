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
    const gapCounts = this._gapCounts(dim);
    const sa = dim.sapAlignment || {};
    const hasSapObjects = ['existing','target','bw'].some(e => (sa[e] || {}).objectName);
    const sapBadge = hasSapObjects
      ? `<span class="dim-sap-linked-badge" title="Linked to SAP objects">SAP</span>`
      : '';
    const gapBadge = gapCounts.issues > 0
      ? `<span class="dim-gap-pill gap-issue" style="font-size:10px">${gapCounts.issues} gap${gapCounts.issues !== 1 ? 's' : ''}</span>`
      : gapCounts.ok > 0
        ? `<span class="dim-gap-pill gap-ok" style="font-size:10px">${gapCounts.ok} aligned</span>`
        : '';
    return `
      <div class="dim-card dim-card-custom" onclick="Router.navigate('dimension/${dim.id}')">
        <div class="dim-card-header">
          <div class="dim-card-icon">${dim.icon || '📋'}</div>
          <div style="flex:1;min-width:0">
            <div class="dim-card-title">${this._esc(dim.name)}
              <span class="dim-card-custom-badge">Custom</span>
              ${sapBadge}
            </div>
            <div class="dim-card-category" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span class="badge-sm" style="background:${cat.color || '#6b7280'}">${cat.label || dim.category}</span>
              ${gapBadge}
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

      ${dim.isCustom ? this._renderAlignmentReadOnly(dim) : ''}
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

    // Store working copy with two-panel state
    this._editorState = {
      dim,
      selectedColId: dim.columns.length > 0 ? dim.columns[0].id : null,
      activeColTab: 'definition'
    };

    const catOpts = Object.entries(CATEGORIES)
      .filter(([k]) => k !== 'how_many')
      .map(([k, c]) => `<option value="${k}" ${dim.category === k ? 'selected' : ''}>${c.label} — ${c.meaning || c.label}</option>`)
      .join('');

    const colListHTML = this._dimColListHTML(dim, this._editorState.selectedColId);

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

      <div class="project-meta" style="margin-bottom:16px">
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
          <div class="form-group">
            <label class="form-label">7W Category <span class="required">*</span></label>
            <select class="form-input" id="dimCategory">${catOpts}</select>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Description</label>
            <textarea class="form-input" id="dimDesc" rows="2"
              placeholder="What this dimension represents and when to use it">${this._esc(dim.description || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="event-detail-layout dim-editor-two-panel">
        <div class="col-list-panel">
          <div class="col-list-header">
            <span>Columns</span>
          </div>
          <div class="col-list-body" id="dim-col-list-body">
            ${colListHTML}
          </div>
          <div style="padding:8px 10px;border-top:1px solid var(--border);flex-shrink:0">
            <button class="btn btn-ghost btn-sm" style="width:100%;font-size:12px"
              onclick="DimensionLibrary._addEditorCol()">+ Add Column</button>
          </div>
        </div>

        <div class="col-detail-panel" id="dim-col-detail-panel">
          ${this._editorState.selectedColId
            ? (() => {
                const col = dim.columns.find(c => c.id === this._editorState.selectedColId);
                if (!col) return '<div class="col-detail-empty"><span>Select a column to edit</span></div>';
                const isSAP = col.source === 'sap_ecc' || col.source === 'sap_s4';
                return DimensionLibrary._dimColDetailHTML(col, isSAP, 'definition');
              })()
            : '<div class="col-detail-empty"><span>Select a column to edit</span></div>'
          }
        </div>
      </div>

      ${this._renderSapAlignmentSection(dim)}

      <div class="dim-editor-footer">
        <button class="btn btn-primary" onclick="DimensionLibrary._saveEditor()">
          ${isNew ? 'Create Dimension' : 'Save Changes'}
        </button>
        <a href="${isNew ? '#dimensions' : '#dimension/' + dim.id}" class="btn btn-ghost">Cancel</a>
      </div>
    `;
  },

  // ── Two-panel helpers ─────────────────────────────────────

  _dimColListHTML(dim, selectedColId) {
    if (dim.columns.length === 0) {
      return '<div class="col-list-empty">No columns yet.<br>Click <strong>+ Add Column</strong> to begin.</div>';
    }
    return dim.columns.map(col => {
      const isActive = col.id === selectedColId;
      return `
        <div class="col-list-item${isActive ? ' active' : ''}" data-col-id="${col.id}"
          onclick="DimensionLibrary.selectDimCol('${col.id}')">
          <div class="col-cat-dot" style="background:#6b7280"></div>
          ${col.isKey ? '<span style="font-size:9px;font-weight:700;background:#f59e0b;color:#fff;padding:1px 4px;border-radius:3px;flex-shrink:0">PK</span>' : ''}
          <span class="col-item-name" title="${this._esc(col.name)}">${this._esc(col.name) || '<em style="color:var(--text-subtle)">unnamed</em>'}</span>
          <span class="col-item-type">${this._esc(col.dataType || 'VARCHAR')}</span>
        </div>`;
    }).join('');
  },

  selectDimCol(colId) {
    if (!this._editorState) return;
    this._editorState.selectedColId = colId;
    this._renderDimColDetail();
  },

  selectDimColTab(tab) {
    if (!this._editorState) return;
    this._editorState.activeColTab = tab;
    this._renderDimColDetail();
  },

  _renderDimColDetail() {
    const panel = document.getElementById('dim-col-detail-panel');
    const listBody = document.getElementById('dim-col-list-body');
    if (!panel || !this._editorState) return;

    const { dim, selectedColId, activeColTab } = this._editorState;

    // Update active state in list
    if (listBody) {
      listBody.querySelectorAll('.col-list-item').forEach(el => {
        el.classList.toggle('active', el.dataset.colId === selectedColId);
      });
    }

    const col = dim.columns.find(c => c.id === selectedColId);
    if (!col) {
      panel.innerHTML = '<div class="col-detail-empty"><span>Select a column to edit</span></div>';
      return;
    }

    const isSAP = col.source === 'sap_ecc' || col.source === 'sap_s4';
    panel.innerHTML = DimensionLibrary._dimColDetailHTML(col, isSAP, activeColTab || 'definition');
  },

  _dimColDetailHTML(col, isSAP, tab) {
    const cId = col.id;
    // Same tab set as event detail view (no Conformed — dims ARE the templates)
    const tabs = [
      { id: 'summary',   label: 'Summary',     show: true },
      { id: 'technical', label: 'SAP Tech',     show: isSAP },
      { id: 'hierarchy', label: 'Hierarchy',    show: true },
      { id: 'stage',     label: 'Stage Mapping',show: true },
      { id: 'notes',     label: 'Notes',        show: true },
    ].filter(t => t.show);

    // Ensure active tab is valid
    if (!tabs.find(t => t.id === tab)) tab = 'summary';

    const tabButtons = tabs.map(t =>
      `<button class="col-detail-tab${tab === t.id ? ' active' : ''}" data-tab="${t.id}"
        onclick="DimensionLibrary.selectDimColTab('${t.id}')">${t.label}</button>`
    ).join('');

    // ── helpers ──
    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const up  = (f,v) => `DimensionLibrary._updateEditorCol('${cId}','${f}',${v})`;
    const upStr = f => `onchange="DimensionLibrary._updateEditorCol('${cId}','${f}',this.value)"`;
    const upChk = f => `onchange="DimensionLibrary._updateEditorCol('${cId}','${f}',this.checked)"`;

    // ── options ──
    const typeOpts = ['VARCHAR','INT','BIGINT','DECIMAL','FLOAT','DATE','DATETIME','TIMESTAMP','BOOLEAN','UUID','JSON','TEXT']
      .map(t => `<option value="${t}" ${col.dataType===t?'selected':''}>${t}</option>`).join('');
    const srcOpts  = Object.entries(typeof SOURCES!=='undefined'?SOURCES:{})
      .map(([k,s]) => `<option value="${k}" ${(col.source||'source_system')===k?'selected':''}>${s.label}</option>`).join('');
    const rtOpts   = Object.entries(typeof RESPONSIBILITY_TYPES!=='undefined'?RESPONSIBILITY_TYPES:{})
      .map(([k,r]) => `<option value="${k}" ${(col.responsibilityType||'none')===k?'selected':''}>${r.label}</option>`).join('');
    const scdOpts  = `<option value="" ${!col.scdType&&col.scdType!==0?'selected':''}>None</option>`
      + [0,1,2,3,4,6].map(n=>`<option value="${n}" ${col.scdType===n?'selected':''}>SCD${n}</option>`).join('');
    const srcInfo  = typeof SOURCES!=='undefined'&&col.source ? (SOURCES[col.source]||SOURCES.source_system) : null;

    let body = '';

    if (tab === 'summary') {
      body = `
        <div class="cd-section">
          <div class="cd-section-title">Origin</div>
          <div class="cd-grid g1">
            <div class="cd-field">
              <label>Source / Origin</label>
              <select onchange="DimensionLibrary._updateEditorCol('${cId}','source',this.value);DimensionLibrary._renderDimColDetail()">${srcOpts}</select>
              ${srcInfo ? `<span class="src-origin-hint">${esc(srcInfo.description||'')}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="cd-section">
          <div class="cd-section-title">Identity</div>
          <div class="cd-grid g2">
            <div class="cd-field" style="grid-column:1/-1">
              <label>Column Name</label>
              <input type="text" value="${esc(col.name)}" placeholder="column_name" ${upStr('name')}>
            </div>
            <div class="cd-field">
              <label>Data Type</label>
              <select ${upStr('dataType')}>${typeOpts}</select>
            </div>
            <div class="cd-field">
              <label>Format / Examples</label>
              <input type="text" value="${esc(col.format||'')}" placeholder="e.g. YYYY-MM-DD" ${upStr('format')}>
            </div>
            <div class="cd-field" style="grid-column:1/-1">
              <label>Description</label>
              <textarea placeholder="What this column represents…" ${upStr('description')}>${esc(col.description||'')}</textarea>
            </div>
          </div>
        </div>
        <div class="cd-section">
          <div class="cd-section-title">Classification</div>
          <div class="cd-grid g2">
            <div class="cd-field">
              <label>Responsibility Type</label>
              <select ${upStr('responsibilityType')}>${rtOpts}</select>
            </div>
            <div class="cd-field">
              <label>SCD Type</label>
              <select onchange="DimensionLibrary._updateEditorCol('${cId}','scdType',this.value===''?null:parseInt(this.value))">${scdOpts}</select>
            </div>
          </div>
          <div class="cd-toggle" style="margin-top:8px">
            <input type="checkbox" id="isKey-${cId}" ${col.isKey?'checked':''} ${upChk('isKey')}>
            <label for="isKey-${cId}">Is primary / surrogate key (PK)</label>
          </div>
          <div class="cd-toggle">
            <input type="checkbox" id="isNK-${cId}" ${col.isNaturalKey?'checked':''} ${upChk('isNaturalKey')}>
            <label for="isNK-${cId}">Natural Key</label>
          </div>
        </div>
        <div style="padding-top:4px">
          <button class="btn btn-ghost btn-sm" style="color:#ef4444;font-size:12px"
            onclick="DimensionLibrary._deleteEditorCol('${cId}')">Remove column</button>
        </div>`;

    } else if (tab === 'technical') {
      const migOpts = typeof SAP_MIGRATION_STATUSES!=='undefined'
        ? `<option value="" ${!col.sapMigrationStatus?'selected':''}>— Untagged —</option>`
          + Object.entries(SAP_MIGRATION_STATUSES).filter(([k])=>k!=='').map(([k,v])=>
              `<option value="${k}" ${col.sapMigrationStatus===k?'selected':''}>${v.label}</option>`).join('')
        : '';
      const gapOpts = Object.entries(typeof FIELD_GAP_STATUSES!=='undefined'?FIELD_GAP_STATUSES:{})
        .map(([k,s])=>`<option value="${k}" ${(col.fieldGapStatus||'')===k?'selected':''}>${s.label}</option>`).join('');
      const selMig = typeof SAP_MIGRATION_STATUSES!=='undefined'&&col.sapMigrationStatus
        ? SAP_MIGRATION_STATUSES[col.sapMigrationStatus] : null;
      body = `
        <div class="cd-section">
          <div class="cd-section-title">SAP Source</div>
          <div class="cd-grid g2">
            <div class="cd-field">
              <label>SAP Existing Field <span style="font-weight:400;color:var(--text-subtle)">(ECC)</span></label>
              <input type="text" value="${esc(col.sapExistingField||'')}" placeholder="e.g. KUNNR" style="font-family:monospace" ${upStr('sapExistingField')}>
            </div>
            <div class="cd-field">
              <label>SAP Target Field <span style="font-weight:400;color:var(--text-subtle)">(S/4)</span></label>
              <input type="text" value="${esc(col.sapTargetField||'')}" placeholder="e.g. PARTNER" style="font-family:monospace" ${upStr('sapTargetField')}>
            </div>
            <div class="cd-field">
              <label>SAP BW Object</label>
              <input type="text" value="${esc(col.sapBwObject||'')}" placeholder="e.g. 0CUSTOMER" style="font-family:monospace" ${upStr('sapBwObject')}>
            </div>
            <div class="cd-field">
              <label>Migration Status</label>
              <select ${upStr('sapMigrationStatus')}>${migOpts}</select>
              ${selMig ? `<span class="sap-module-badge" style="background:${selMig.bg};color:${selMig.color}">${selMig.short||selMig.label}</span>` : ''}
            </div>
            <div class="cd-field" style="grid-column:1/-1">
              <label>Field Gap Status</label>
              <select ${upStr('fieldGapStatus')}>${gapOpts}</select>
            </div>
          </div>
        </div>`;

    } else if (tab === 'hierarchy') {
      // parent col options within this dim
      const dimCols = this._editorState ? this._editorState.dim.columns : [];
      const parentOpts = `<option value="" ${!col.parentColumnId?'selected':''}>— None —</option>`
        + dimCols.filter(c=>c.id!==cId).map(c=>
            `<option value="${c.id}" ${col.parentColumnId===c.id?'selected':''}>${esc(c.name||c.id)}</option>`).join('');
      body = `
        <div class="cd-section">
          <div class="cd-section-title">Hierarchy Structure</div>
          <div class="cd-grid g2">
            <div class="cd-field">
              <label>Hierarchy Name</label>
              <input type="text" value="${esc(col.hierarchyName||'')}" placeholder="e.g. org_hierarchy" ${upStr('hierarchyName')}>
            </div>
            <div class="cd-field">
              <label>Hierarchy Level <span style="font-weight:400;color:var(--text-subtle)">(1 = top)</span></label>
              <input type="number" min="1" max="20" value="${col.hierarchyLevel!=null?col.hierarchyLevel:''}" placeholder="—"
                onchange="DimensionLibrary._updateEditorCol('${cId}','hierarchyLevel',this.value?parseInt(this.value):null)">
            </div>
            <div class="cd-field" style="grid-column:1/-1">
              <label>Parent Column</label>
              <select ${upStr('parentColumnId')}>${parentOpts}</select>
            </div>
          </div>
          <div class="cd-toggle" style="margin-top:8px">
            <input type="checkbox" id="pk-${cId}" ${col.isParentKey?'checked':''} ${upChk('isParentKey')}>
            <label for="pk-${cId}">Is parent key (self-referencing hierarchy)</label>
          </div>
        </div>`;

    } else if (tab === 'stage') {
      const transformOpts = ['','direct','derived','lookup','calculated','defaulted','truncated','sign_reversed','aggregated']
        .map(k=>`<option value="${k}" ${col.transformType===k?'selected':''}>${k?k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'— Not set —'}</option>`).join('');
      const nullOpts = ['','allow','default','reject']
        .map(k=>`<option value="${k}" ${col.nullHandling===k?'selected':''}>${k?k.charAt(0).toUpperCase()+k.slice(1):'— Not set —'}</option>`).join('');
      body = `
        <div class="cd-section">
          <div class="cd-section-title">Source Extraction</div>
          <div class="cd-grid g2">
            <div class="cd-field">
              <label>Source Table / Path</label>
              <input type="text" value="${esc(col.stageSource||'')}" placeholder="e.g. staging.customers" ${upStr('stageSource')}>
            </div>
            <div class="cd-field">
              <label>Target Field</label>
              <input type="text" value="${esc(col.stageTarget||'')}" placeholder="e.g. dim_customer.customer_key" ${upStr('stageTarget')}>
            </div>
          </div>
        </div>
        <div class="cd-section">
          <div class="cd-section-title">Transformation</div>
          <div class="cd-grid g2">
            <div class="cd-field">
              <label>Transform Type</label>
              <select ${upStr('transformType')}>${transformOpts}</select>
            </div>
            <div class="cd-field">
              <label>Null Handling</label>
              <select ${upStr('nullHandling')}>${nullOpts}</select>
            </div>
            <div class="cd-field">
              <label>Default Value</label>
              <input type="text" value="${esc(col.defaultValue||'')}" placeholder="e.g. 'UNKNOWN'" ${upStr('defaultValue')}>
            </div>
            <div class="cd-field">
              <label>Data Quality Rule</label>
              <input type="text" value="${esc(col.dataQualityRule||'')}" placeholder="e.g. NOT NULL; must match master" ${upStr('dataQualityRule')}>
            </div>
            <div class="cd-field" style="grid-column:1/-1">
              <label>Mapping / Derivation Rule</label>
              <textarea style="min-height:65px;font-family:monospace;font-size:12px"
                placeholder="e.g. LOOKUP(dim_customer, src_id = KUNNR)" ${upStr('formula')}>${esc(col.formula||'')}</textarea>
            </div>
          </div>
        </div>
        <div class="cd-section">
          <div class="cd-section-title">Notes</div>
          <div class="cd-grid g1">
            <div class="cd-field">
              <textarea style="min-height:70px" placeholder="Migration caveats, special handling…" ${upStr('stagingNote')}>${esc(col.stagingNote||'')}</textarea>
            </div>
          </div>
        </div>`;

    } else if (tab === 'notes') {
      body = `
        <div class="cd-section">
          <div class="cd-section-title">Notes</div>
          <div class="cd-grid g1">
            <div class="cd-field">
              <textarea style="min-height:140px" placeholder="Business rules, context, data quality…" ${upStr('notes')}>${esc(col.notes||'')}</textarea>
            </div>
          </div>
        </div>`;
    }

    return `<div class="col-detail-tabs">${tabButtons}</div><div class="col-detail-body">${body}</div>`;
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
      source: 'source_system',
      responsibilityType: 'none',
      description: '',
      hierarchyLevel: null,
      hierarchyName: '',
      isParentKey: false,
      parentColumnId: '',
      sapExistingField: '',
      sapTargetField: '',
      sapBwObject: '',
      fieldGapStatus: ''
    };
    this._editorState.dim.columns.push(col);

    // Update left panel list
    const listBody = document.getElementById('dim-col-list-body');
    if (listBody) {
      listBody.innerHTML = this._dimColListHTML(this._editorState.dim, col.id);
    }

    // Auto-select the new column in the right panel
    this.selectDimCol(col.id);
  },

  _updateEditorCol(colId, field, value) {
    if (!this._editorState) return;
    const col = this._editorState.dim.columns.find(c => c.id === colId);
    if (col) col[field] = value;
  },

  _deleteEditorCol(colId) {
    if (!this._editorState) return;
    this._editorState.dim.columns = this._editorState.dim.columns.filter(c => c.id !== colId);

    // If the deleted column was selected, clear selection or pick the first remaining
    if (this._editorState.selectedColId === colId) {
      this._editorState.selectedColId = this._editorState.dim.columns.length > 0
        ? this._editorState.dim.columns[0].id
        : null;
    }

    // Update the left panel list
    const listBody = document.getElementById('dim-col-list-body');
    if (listBody) {
      listBody.innerHTML = this._dimColListHTML(this._editorState.dim, this._editorState.selectedColId);
    }

    // Re-render the right panel
    this._renderDimColDetail();
  },

  // ── SAP Alignment section (editor) ───────────────────

  _renderSapAlignmentSection(dim) {
    const sa = dim.sapAlignment || {};
    const envs = [
      { key: 'existing', label: 'Existing SAP',    badge: 'sap-env-existing', defaultType: 'table',      hint: 'e.g. KNA1, CSKS, LFA1' },
      { key: 'target',   label: 'Target S/4HANA',  badge: 'sap-env-target',   defaultType: 'table',      hint: 'e.g. BUT000, ACDOCA, CDS View' },
      { key: 'bw',       label: 'SAP BW / BW4',    badge: 'sap-env-bw',       defaultType: 'infoobject', hint: 'e.g. 0CUSTOMER, ZMAT_ATTR' }
    ];
    const typeOpts = (selected) => Object.entries(
      typeof DIM_SAP_OBJECT_TYPES !== 'undefined' ? DIM_SAP_OBJECT_TYPES : {}
    ).map(([k, v]) => `<option value="${k}" ${selected === k ? 'selected' : ''}>${v}</option>`).join('');

    const gapOpts = (selected) => Object.entries(
      typeof FIELD_GAP_STATUSES !== 'undefined' ? FIELD_GAP_STATUSES : {}
    ).map(([k, s]) => `<option value="${k}" ${selected === k ? 'selected' : ''}>${s.label}</option>`).join('');

    const objRows = envs.map(env => {
      const obj = sa[env.key] || {};
      return `<tr>
        <td><span class="sap-env-badge ${env.badge}">${env.label}</span></td>
        <td>
          <select class="cell-select" style="font-size:12px;width:100%"
            onchange="DimensionLibrary._updateSapObject('${env.key}','objectType',this.value)">
            <option value="">— Select type —</option>
            ${typeOpts(obj.objectType || env.defaultType)}
          </select>
        </td>
        <td>
          <input class="cell-input" style="font-family:monospace;font-size:12px;width:100%"
            value="${this._esc(obj.objectName || '')}" placeholder="${env.hint}"
            onblur="DimensionLibrary._updateSapObject('${env.key}','objectName',this.value)">
        </td>
        <td>
          <input class="cell-input" style="font-size:12px;width:100%"
            value="${this._esc(obj.description || '')}" placeholder="Short description…"
            onblur="DimensionLibrary._updateSapObject('${env.key}','description',this.value)">
        </td>
      </tr>`;
    }).join('');

    const fieldRows = dim.columns.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:var(--text-subtle);font-size:12px;padding:12px">Add columns first, then map them to SAP fields here.</td></tr>`
      : dim.columns.map(col => {
          const gapKey = col.fieldGapStatus || '';
          const gapInfo = (typeof FIELD_GAP_STATUSES !== 'undefined' && FIELD_GAP_STATUSES[gapKey]) || { color: '#9ca3af', bg: '#f3f4f6' };
          return `<tr id="sap-row-${col.id}">
            <td>
              <code style="font-size:12px">${this._esc(col.name || '(unnamed)')}</code>
              ${col.isKey ? ' <span class="key-indicator">PK</span>' : ''}
              <div style="font-size:10px;color:var(--text-subtle)">${col.dataType}</div>
            </td>
            <td>
              <input class="cell-input" style="font-family:monospace;font-size:12px;width:100%"
                value="${this._esc(col.sapExistingField || '')}" placeholder="e.g. KUNNR"
                onblur="DimensionLibrary._updateEditorCol('${col.id}','sapExistingField',this.value)">
            </td>
            <td>
              <input class="cell-input" style="font-family:monospace;font-size:12px;width:100%"
                value="${this._esc(col.sapTargetField || '')}" placeholder="e.g. PARTNER"
                onblur="DimensionLibrary._updateEditorCol('${col.id}','sapTargetField',this.value)">
            </td>
            <td>
              <input class="cell-input" style="font-family:monospace;font-size:12px;width:100%"
                value="${this._esc(col.sapBwObject || '')}" placeholder="e.g. 0CUSTOMER"
                onblur="DimensionLibrary._updateEditorCol('${col.id}','sapBwObject',this.value)">
            </td>
            <td>
              <select class="cell-select" style="font-size:11px;width:100%"
                onchange="DimensionLibrary._updateEditorCol('${col.id}','fieldGapStatus',this.value)">
                ${gapOpts(gapKey)}
              </select>
              ${gapKey && gapKey !== 'ok' ? `<span class="field-gap-dot" style="background:${gapInfo.color}" title="${gapInfo.label || gapKey}"></span>` : ''}
            </td>
          </tr>`;
        }).join('');

    // Gap summary counts
    const gapCounts = this._gapCounts(dim);
    const hasSapData = envs.some(e => (sa[e.key] || {}).objectName);

    return `
      <div class="dim-editor-section" style="margin-top:16px">
        <div class="dim-editor-section-header">
          <h3>SAP Object Alignment</h3>
          <span style="font-size:11px;color:#a0a0c0">Link this dimension to existing SAP, target S/4HANA, and BW objects</span>
        </div>

        <div style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.06)">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px">Object-Level Mapping</div>
          <table class="dim-sap-obj-table">
            <thead>
              <tr>
                <th style="width:140px">Environment</th>
                <th style="width:200px">Object Type</th>
                <th style="width:180px">Object Name</th>
                <th>Description / Notes</th>
              </tr>
            </thead>
            <tbody>${objRows}</tbody>
          </table>
        </div>

        <div style="padding:12px 14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;letter-spacing:.04em;text-transform:uppercase">Column Field Mapping</div>
            ${gapCounts.total > 0 ? `<div class="dim-gap-pill-row">${this._gapPills(gapCounts)}</div>` : ''}
          </div>
          <div style="overflow-x:auto">
            <table class="dim-sap-field-table">
              <thead>
                <tr>
                  <th style="min-width:140px">BEAM Column</th>
                  <th style="min-width:120px">Existing SAP Field</th>
                  <th style="min-width:120px">Target S/4 Field</th>
                  <th style="min-width:120px">BW InfoObject</th>
                  <th style="min-width:160px">Gap Status</th>
                </tr>
              </thead>
              <tbody id="dimSapFieldBody">${fieldRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  _renderAlignmentReadOnly(dim) {
    const sa = dim.sapAlignment || {};
    const envs = [
      { key: 'existing', label: 'Existing SAP',   badge: 'sap-env-existing' },
      { key: 'target',   label: 'Target S/4HANA', badge: 'sap-env-target' },
      { key: 'bw',       label: 'SAP BW / BW4',   badge: 'sap-env-bw' }
    ];
    const hasObjects = envs.some(e => (sa[e.key] || {}).objectName);
    const hasMappings = (dim.columns || []).some(c => c.sapExistingField || c.sapTargetField || c.sapBwObject || c.fieldGapStatus);

    if (!hasObjects && !hasMappings) {
      return `<div class="dim-detail-sap-empty">
        <div style="font-size:13px;color:var(--text-muted)">No SAP alignment data yet.</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:8px"
          onclick="Router.navigate('dimension/${dim.id}/edit')">Add SAP mapping →</button>
      </div>`;
    }

    const objRows = envs.map(env => {
      const obj = sa[env.key] || {};
      if (!obj.objectName) return `<tr>
        <td><span class="sap-env-badge ${env.badge}">${env.label}</span></td>
        <td colspan="3" style="color:var(--text-subtle);font-size:12px;font-style:italic">Not mapped</td>
      </tr>`;
      const objTypeLabel = (typeof DIM_SAP_OBJECT_TYPES !== 'undefined' && DIM_SAP_OBJECT_TYPES[obj.objectType]) || obj.objectType || '';
      return `<tr>
        <td><span class="sap-env-badge ${env.badge}">${env.label}</span></td>
        <td style="font-size:12px;color:var(--text-muted)">${this._esc(objTypeLabel)}</td>
        <td><code style="font-size:13px;font-weight:700">${this._esc(obj.objectName)}</code></td>
        <td style="font-size:12px;color:var(--text-muted)">${this._esc(obj.description || '')}</td>
      </tr>`;
    }).join('');

    const gapCounts = this._gapCounts(dim);
    const fieldRows = (dim.columns || []).map(col => {
      const gapKey = col.fieldGapStatus || '';
      const gapInfo = (typeof FIELD_GAP_STATUSES !== 'undefined' && FIELD_GAP_STATUSES[gapKey]) || { label: '—', color: '#9ca3af', bg: '#f3f4f6' };
      return `<tr>
        <td>
          <code>${this._esc(col.name || '(unnamed)')}</code>
          ${col.isKey ? ' <span class="key-indicator">PK</span>' : ''}
        </td>
        <td><code style="font-size:12px;color:var(--text-muted)">${this._esc(col.sapExistingField || '—')}</code></td>
        <td><code style="font-size:12px;color:var(--text-muted)">${this._esc(col.sapTargetField || '—')}</code></td>
        <td><code style="font-size:12px;color:var(--text-muted)">${this._esc(col.sapBwObject || '—')}</code></td>
        <td>
          ${gapKey
            ? `<span class="field-gap-badge" style="background:${gapInfo.bg};color:${gapInfo.color}">${gapInfo.label}</span>`
            : '<span style="color:var(--text-subtle);font-size:11px">—</span>'}
        </td>
      </tr>`;
    }).join('');

    return `
      <div style="margin-top:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h3 style="font-size:14px;font-weight:700;margin:0">SAP Object Alignment</h3>
          <div class="dim-gap-pill-row">${this._gapPills(gapCounts)}</div>
        </div>

        ${hasObjects ? `
        <table class="dim-sap-obj-table dim-sap-obj-table-readonly" style="margin-bottom:16px">
          <thead>
            <tr>
              <th style="width:140px">Environment</th>
              <th style="width:160px">Type</th>
              <th style="width:180px">Object Name</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>${objRows}</tbody>
        </table>` : ''}

        ${hasMappings ? `
        <div style="overflow-x:auto">
          <table class="dim-sap-field-table dim-sap-field-table-readonly">
            <thead>
              <tr>
                <th>BEAM Column</th>
                <th>Existing SAP Field</th>
                <th>Target S/4 Field</th>
                <th>BW InfoObject</th>
                <th>Gap Status</th>
              </tr>
            </thead>
            <tbody>${fieldRows}</tbody>
          </table>
        </div>` : ''}
      </div>
    `;
  },

  _updateSapObject(env, field, value) {
    if (!this._editorState) return;
    const dim = this._editorState.dim;
    if (!dim.sapAlignment) dim.sapAlignment = {};
    if (!dim.sapAlignment[env]) dim.sapAlignment[env] = { objectType: '', objectName: '', description: '' };
    dim.sapAlignment[env][field] = value;
  },

  _gapCounts(dim) {
    const counts = { ok: 0, issues: 0, unassessed: 0, total: 0 };
    (dim.columns || []).forEach(col => {
      counts.total++;
      const s = col.fieldGapStatus || '';
      if (!s) counts.unassessed++;
      else if (s === 'ok') counts.ok++;
      else counts.issues++;
    });
    return counts;
  },

  _gapPills(counts) {
    const pills = [];
    if (counts.ok > 0)         pills.push(`<span class="dim-gap-pill gap-ok">${counts.ok} aligned</span>`);
    if (counts.issues > 0)     pills.push(`<span class="dim-gap-pill gap-issue">${counts.issues} gap${counts.issues !== 1 ? 's' : ''}</span>`);
    if (counts.unassessed > 0) pills.push(`<span class="dim-gap-pill gap-unassessed">${counts.unassessed} unassessed</span>`);
    return pills.join('');
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
