const Matrix = {
  _dragSrc: null,

  renderEvent(eventId) {
    const found = Storage.getEvent(eventId);
    if (!found) { Router.navigate('projects'); return; }
    const { event, project } = found;

    const sourceSummary = this._sourceSummary(event.columns);

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb" id="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#project/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <span>${this._esc(event.name)}</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" onclick="Matrix.openRenameModal('${project.id}', '${event.id}')">Rename Event</button>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('datagen/${event.id}')">⚡ Generate Sample Data</button>
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('diagram/${event.id}')">View Diagram →</button>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">${this._esc(event.name)}</h1>
        ${event.description ? `<p class="view-subtitle">${this._esc(event.description)}</p>` : ''}
      </div>

      <div class="info-banner" id="matrixBanner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'" title="Dismiss">✕</button>
        <strong>BEAM Matrix</strong> — Describe each attribute of this business event. Assign a
        <strong>7W category</strong> and mark whether it comes from the <strong>source system</strong>
        or will be <strong>derived</strong> in the data layer. For measures, set the
        <strong>additivity type</strong> so the tool can flag which KPIs require specific grain context.
        <a href="#" class="info-link" onclick="Matrix.show7WGuide(event)">See the 7W guide →</a>
      </div>

      ${this._eventMetaPanel(event, project)}

      ${sourceSummary}

      <div class="matrix-toolbar">
        <div class="matrix-toolbar-left">
          <button class="btn btn-primary btn-sm" onclick="Matrix.addRow('${event.id}')">+ Add Column</button>
          <span class="col-count" id="colCount">${event.columns.length} column${event.columns.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="matrix-toolbar-right">
          <button class="btn btn-ghost btn-sm" onclick="Export.eventToCSV(Storage.getEvent('${event.id}').event)">⬇ CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="Export.printEvent(Storage.getEvent('${event.id}').event, '${this._esc(project.name)}')">🖨 Print</button>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('ddl/${event.id}')">⚙ DDL</button>
        </div>
      </div>

      <div class="matrix-wrapper">
        <table class="matrix-table" id="matrixTable">
          <thead>
            <tr>
              <th class="col-drag" title="Drag to reorder"></th>
              <th class="col-name">
                Column Name
                <div class="th-hint">The attribute or field name</div>
              </th>
              <th class="col-cat">
                7W Category
                <div class="th-hint">Who · What · When · Where · How · Why · How many</div>
              </th>
              <th class="col-source">
                Origin
                <div class="th-hint">Source system or derived in data layer</div>
              </th>
              <th class="col-classify">
                Classification
                <div class="th-hint">Additivity (measures) · Responsibility (dimensions)</div>
              </th>
              <th class="col-type">
                Data Type
                <div class="th-hint">SQL / logical data type</div>
              </th>
              <th class="col-format">
                Format / Examples
                <div class="th-hint">Example values or range — used to generate sample data</div>
              </th>
              <th class="col-desc">
                Description
                <div class="th-hint">What this attribute represents</div>
              </th>
              <th class="col-del"></th>
            </tr>
          </thead>
          <tbody id="matrixBody">
            ${event.columns.length === 0 ? this._emptyMatrixRow() : event.columns.map((col, i) => this._row(col, i, project)).join('')}
          </tbody>
        </table>
      </div>

      ${event.columns.length === 0 ? '' : `
        <div class="matrix-footer">
          <button class="btn btn-ghost btn-sm" onclick="Matrix.addRow('${event.id}')">+ Add another column</button>
        </div>
      `}

      <div class="origin-guide">
        <h3 class="ref-title">Origin Guide</h3>
        <div class="origin-guide-grid">
          ${Object.entries(SOURCES).map(([key, s]) => `
            <div class="origin-card">
              <span class="source-badge source-${key}">${s.label}</span>
              <div class="origin-desc">${s.description}</div>
              <div class="origin-example">${s.formatHint}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="sevenw-reference" id="sevenWRef">
        <h3 class="ref-title">7W Quick Reference</h3>
        <div class="ref-grid">
          ${Object.entries(CATEGORIES).map(([key, cat]) => `
            <div class="ref-card">
              <div class="ref-badge" style="background:${cat.color}">${cat.label}</div>
              <div class="ref-meaning"><strong>${cat.meaning}</strong></div>
              <div class="ref-example">e.g. ${cat.example}</div>
              <div class="ref-outcome">→ ${cat.outcome}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this._attachDragHandlers(event.id);
  },

  _sourceSummary(columns) {
    if (!columns.length) return '';
    const counts = {};
    columns.forEach(c => {
      const s = c.source || 'source_system';
      counts[s] = (counts[s] || 0) + 1;
    });
    const chips = Object.entries(counts).map(([key, n]) => {
      const s = SOURCES[key] || { label: key };
      return `<span class="source-chip source-${key}">${s.label}: <strong>${n}</strong></span>`;
    }).join('');
    return `<div class="source-summary">${chips}</div>`;
  },

  _row(col, index, project) {
    const catOptions = Object.entries(CATEGORIES).map(([key, c]) =>
      `<option value="${key}" ${col.category === key ? 'selected' : ''} style="color:${c.color}">${c.label} — ${c.meaning}</option>`
    ).join('');

    const typeOptions = ['VARCHAR', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DATE', 'DATETIME', 'BOOLEAN', 'TEXT', 'UUID'].map(t =>
      `<option value="${t}" ${col.dataType === t ? 'selected' : ''}>${t}</option>`
    ).join('');

    const sourceOptions = Object.entries(SOURCES).map(([key, s]) =>
      `<option value="${key}" ${(col.source || 'source_system') === key ? 'selected' : ''}>${s.label}</option>`
    ).join('');

    const cat = CATEGORIES[col.category] || {};
    const src = col.source || 'source_system';
    return `
      <tr data-col-id="${col.id}" draggable="true" class="matrix-row">
        <td class="col-drag">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
        </td>
        <td class="col-name">
          <input class="cell-input name-input" type="text" value="${this._esc(col.name)}"
            placeholder="Column name…"
            onchange="Matrix.updateField('${col.id}', 'name', this.value)"
            onblur="Matrix.updateField('${col.id}', 'name', this.value)">
        </td>
        <td class="col-cat">
          <div class="cat-wrapper">
            <span class="cat-dot" style="background:${cat.color || '#6b7280'}"></span>
            <select class="cell-select cat-select"
              onchange="Matrix.updateCategory('${col.id}', this.value, this.closest('tr'))">
              ${catOptions}
            </select>
          </div>
          <div class="cat-tooltip" id="tooltip-${col.id}">${cat.meaning || ''}</div>
        </td>
        <td class="col-source">
          <select class="cell-select source-select source-select-${src}"
            onchange="Matrix.updateSource('${col.id}', this.value, this)">
            ${sourceOptions}
          </select>
        </td>
        <td class="col-classify">
          ${this._classifyCell(col, project)}
        </td>
        <td class="col-type">
          <select class="cell-select"
            onchange="Matrix.updateField('${col.id}', 'dataType', this.value)">
            ${typeOptions}
          </select>
        </td>
        <td class="col-format">
          <input class="cell-input format-input" type="text" value="${this._esc(col.format || '')}"
            placeholder="${this._formatPlaceholder(col.dataType)}"
            title="Used for synthetic data generation"
            onblur="Matrix.updateField('${col.id}', 'format', this.value)">
        </td>
        <td class="col-desc">
          <input class="cell-input" type="text" value="${this._esc(col.description || '')}"
            placeholder="What this represents…"
            onblur="Matrix.updateField('${col.id}', 'description', this.value)">
        </td>
        <td class="col-del">
          <button class="btn-icon delete-row" title="Delete row"
            onclick="Matrix.deleteRow('${col.id}')">✕</button>
          <button class="btn-icon" title="${col.notes || col.formula || col.sapTable || col.publicDimensionId ? 'Has notes / refs' : 'Add notes'}"
            style="font-size:11px;opacity:${col.notes || col.formula || col.sapTable || col.publicDimensionId ? '1' : '0.4'};color:${col.notes || col.formula || col.sapTable || col.publicDimensionId ? 'var(--primary)' : 'inherit'}"
            onclick="Matrix._toggleNotes('${col.id}')">✎</button>
        </td>
      </tr>
      <tr class="notes-row" id="notes-${col.id}" style="display:${col.notes || col.formula || col.sapTable || col.sapField || col.publicDimensionId ? 'table-row' : 'none'}">
        <td colspan="2"></td>
        <td colspan="6" style="padding:4px 8px 8px">
          <div style="display:flex;gap:8px">
            <div style="flex:1">
              <div style="font-size:10px;color:var(--text-subtle);margin-bottom:2px">NOTES</div>
              <textarea class="cell-input" rows="2" style="width:100%;resize:vertical;font-size:12px"
                placeholder="Additional context, data quality notes, known issues…"
                onblur="Matrix.updateField('${col.id}', 'notes', this.value)">${this._esc(col.notes || '')}</textarea>
            </div>
            ${col.source === 'derived' ? `
            <div style="flex:1">
              <div style="font-size:10px;color:var(--text-subtle);margin-bottom:2px">FORMULA / DERIVATION</div>
              <textarea class="cell-input" rows="2" style="width:100%;resize:vertical;font-size:12px;font-family:monospace"
                placeholder="= source_column * factor  or  CASE WHEN … END"
                onblur="Matrix.updateField('${col.id}', 'formula', this.value)">${this._esc(col.formula || '')}</textarea>
            </div>` : ''}
          </div>
          ${(col.source === 'sap_ecc' || col.source === 'sap_s4') ? `
          <div class="sap-tech-ref">
            <div class="sap-tech-ref-header">SAP Technical Reference</div>
            <div class="sap-tech-ref-grid">
              <div>
                <div style="font-size:10px;color:var(--text-subtle);margin-bottom:2px">SAP TABLE</div>
                <input list="sap-table-list-${col.id}" class="cell-input" style="width:100%;font-size:12px;font-family:monospace"
                  value="${this._esc(col.sapTable || '')}" placeholder="e.g. ACDOCA"
                  onblur="Matrix.updateField('${col.id}', 'sapTable', this.value)">
                <datalist id="sap-table-list-${col.id}">
                  <option value="ACDOCA"><option value="BSEG"><option value="BKPF">
                  <option value="COEP"><option value="COSP"><option value="COSS">
                  <option value="CE1XXXX"><option value="ANLP"><option value="KNA1">
                  <option value="LFA1"><option value="MARA"><option value="CSKS"><option value="CEPC">
                </datalist>
              </div>
              <div>
                <div style="font-size:10px;color:var(--text-subtle);margin-bottom:2px">SAP FIELD</div>
                <input class="cell-input" style="width:100%;font-size:12px;font-family:monospace"
                  value="${this._esc(col.sapField || '')}" placeholder="e.g. DMBTR"
                  onblur="Matrix.updateField('${col.id}', 'sapField', this.value)">
              </div>
              <div>
                <div style="font-size:10px;color:var(--text-subtle);margin-bottom:2px">MIGRATION STATUS</div>
                <select class="cell-input" style="width:100%;font-size:12px"
                  onchange="Matrix.updateField('${col.id}', 'sapMigrationStatus', this.value)">
                  ${typeof SAP_MIGRATION_STATUSES !== 'undefined'
                    ? Object.entries(SAP_MIGRATION_STATUSES).map(([k, s]) =>
                        `<option value="${k}" ${(col.sapMigrationStatus || '') === k ? 'selected' : ''}>${s.label}</option>`
                      ).join('')
                    : ''}
                </select>
              </div>
              <div>
                <div style="font-size:10px;color:var(--text-subtle);margin-bottom:2px">${col.category === 'how_many' ? 'CO-PA VALUE FIELD' : 'CO-PA CHARACTERISTIC'}</div>
                <input class="cell-input" style="width:100%;font-size:12px;font-family:monospace"
                  value="${this._esc(col.category === 'how_many' ? (col.copaValueField || '') : (col.copaCharacteristic || ''))}"
                  placeholder="${col.category === 'how_many' ? 'e.g. VVB01' : 'e.g. WW001'}"
                  onblur="Matrix.updateField('${col.id}', '${col.category === 'how_many' ? 'copaValueField' : 'copaCharacteristic'}', this.value)">
              </div>
            </div>
          </div>` : ''}
          ${col.category !== 'how_many' ? `
          <div class="dim-link-panel">
            <div style="font-size:10px;color:var(--text-subtle);margin:6px 0 3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">Conformed Dimension</div>
            <div style="display:flex;align-items:center;gap:8px">
              <select class="cell-input" style="flex:1;font-size:12px"
                onchange="Matrix._linkDimension('${col.id}', this.value)">
                <option value="">— Unlinked —</option>
                ${Storage.getAllDimTemplates().map(d =>
                  `<option value="${d.id}" ${col.publicDimensionId === d.id ? 'selected' : ''}>${d.isCustom ? '★ ' : ''}${this._esc(d.name)}</option>`
                ).join('')}
              </select>
              ${col.isConformed ? '<span class="conformed-badge">Conformed ✓</span>' : ''}
            </div>
          </div>` : ''}
        </td>
        <td colspan="2"></td>
      </tr>
    `;
  },

  _toggleNotes(colId) {
    const row = document.getElementById(`notes-${colId}`);
    if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
  },

  _linkDimension(colId, dimId) {
    const found = Storage.getEvent(this._getEventIdForCol(colId));
    if (!found) return;
    const { event, project } = found;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col.publicDimensionId = dimId;
    col.isConformed = !!dimId;
    Storage.saveEvent(project.id, event);
    // Refresh badge in the notes row without full re-render
    const badge = document.querySelector(`#notes-${colId} .conformed-badge`);
    const panel = document.querySelector(`#notes-${colId} .dim-link-panel`);
    if (panel) {
      const existing = panel.querySelector('.conformed-badge');
      if (dimId && !existing) {
        panel.querySelector('div').insertAdjacentHTML('beforeend', '<span class="conformed-badge">Conformed ✓</span>');
      } else if (!dimId && existing) {
        existing.remove();
      }
    }
    // Update pencil button indicator
    const btn = document.querySelector(`button[onclick*="_toggleNotes('${colId}')"]`);
    if (btn) {
      btn.style.opacity = (dimId || col.notes || col.formula || col.sapTable) ? '1' : '0.4';
      btn.style.color  = (dimId || col.notes || col.formula || col.sapTable) ? 'var(--primary)' : 'inherit';
    }
  },

  _formatPlaceholder(dataType) {
    switch (dataType) {
      case 'VARCHAR': case 'TEXT': return 'e.g. Value1, Value2, Value3';
      case 'INT': case 'BIGINT': return 'e.g. 1..1000';
      case 'DECIMAL': case 'FLOAT': return 'e.g. 0.00..50000.00';
      case 'DATE': return 'e.g. 2023-01-01..2024-12-31';
      case 'DATETIME': return 'e.g. 2023-01-01..2024-12-31';
      case 'BOOLEAN': return 'true, false';
      default: return 'Example values or range…';
    }
  },

  _emptyMatrixRow() {
    return `
      <tr class="empty-matrix-row">
        <td colspan="9">
          <div class="empty-matrix">
            <p>No columns yet. Click <strong>+ Add Column</strong> to start describing this event's attributes.</p>
            <p class="hint-text">Start with key <em>Who</em> (person/org), <em>What</em> (product/item),
            and <em>When</em> (date/time) dimensions, then add your <em>How many</em> measures.
            Mark each as <em>Source System</em> or <em>Derived</em> to track data lineage.</p>
          </div>
        </td>
      </tr>
    `;
  },

  // ── Event metadata panel ──────────────────────────────────

  _eventMetaPanel(event, project) {
    const grain = event.grain || 'transaction';
    const grainInfo = (typeof GRAINS !== 'undefined' && GRAINS[grain]) || { label: grain };
    const grainOpts = typeof GRAINS !== 'undefined'
      ? Object.entries(GRAINS).map(([k, g]) =>
          `<option value="${k}" ${grain === k ? 'selected' : ''}>${g.label}</option>`).join('')
      : '';

    const allBAs = project.businessAreas || [];
    const assignedIds = event.businessAreaIds || [];
    const assignedTags = allBAs.filter(b => assignedIds.includes(b.id)).map(b =>
      `<span class="ba-tag" style="background:${b.color}" title="Remove"
        onclick="Matrix.removeBA('${event.id}', '${b.id}')">
        ${this._esc(b.name)} <span class="ba-tag-remove">✕</span>
      </span>`
    ).join('');
    const unassigned = allBAs.filter(b => !assignedIds.includes(b.id));
    const addMenu = unassigned.length
      ? unassigned.map(b =>
          `<option value="${b.id}">${this._esc(b.name)}</option>`).join('')
      : '';

    const naBAs = !allBAs.length
      ? `<span style="font-size:11px;color:var(--text-subtle)">No business areas —
           <a href="#business-areas/${project.id}" style="color:var(--info)">add them in Business Areas →</a>
         </span>`
      : '';

    // Quick stats
    const measures = event.columns.filter(c => c.category === 'how_many');
    const naCount = measures.filter(c => c.additiveType === 'non_additive').length;
    const saCount = measures.filter(c => c.additiveType === 'semi_additive').length;
    const bcCount = event.columns.filter(c => c.budgetControl).length;

    return `
      <div class="event-meta-panel">
        <div class="meta-field">
          <label>Event Grain</label>
          <select onchange="Matrix.updateGrain('${event.id}', this.value)">
            ${grainOpts}
          </select>
          <span style="font-size:10px;color:var(--text-subtle);margin-top:2px">
            ${(typeof GRAINS !== 'undefined' && GRAINS[grain]) ? GRAINS[grain].description : ''}
          </span>
        </div>
        <div class="meta-field">
          <label>Business Areas</label>
          <div class="ba-tags">
            ${assignedTags}
            ${naBAs}
            ${unassigned.length ? `
              <select class="ba-tag-add" onchange="Matrix.addBA('${event.id}', this.value); this.value=''">
                <option value="">+ Add area</option>
                ${addMenu}
              </select>` : ''}
          </div>
        </div>
        <div class="meta-field" style="margin-left:auto;text-align:right">
          <label>KPI Notes</label>
          <div style="font-size:12px;color:var(--text-muted);line-height:1.8">
            ${naCount > 0 ? `<span class="additive-badge additive-na" style="margin-right:4px">${naCount} Non-Additive</span>` : ''}
            ${saCount > 0 ? `<span class="additive-badge additive-sa" style="margin-right:4px">${saCount} Semi-Additive</span>` : ''}
            ${bcCount > 0 ? `<span style="font-size:11px;color:#7c3aed">💰 ${bcCount} budget-controlled</span>` : ''}
            ${naCount === 0 && saCount === 0 && bcCount === 0 ? '<span style="color:var(--text-subtle);font-size:11px">All measures fully additive</span>' : ''}
          </div>
        </div>
      </div>
    `;
  },

  _classifyCell(col, project) {
    if (col.category === 'how_many') {
      const at = col.additiveType || 'fully_additive';
      const atInfo = (typeof ADDITIVE_TYPES !== 'undefined' && ADDITIVE_TYPES[at]) || { short: at, label: at };
      const atOpts = typeof ADDITIVE_TYPES !== 'undefined'
        ? Object.entries(ADDITIVE_TYPES).map(([k, a]) =>
            `<option value="${k}" ${at === k ? 'selected' : ''}>${a.label}</option>`).join('')
        : '';
      const bcChecked = col.budgetControl ? 'checked' : '';
      // Owner picker from responsibility register
      const register = (project && project.responsibilityRegister) || [];
      const ownerOpts = register.map(p =>
        `<option value="${p.id}" ${col.ownerId === p.id ? 'selected' : ''}>${this._esc(p.name)}</option>`
      ).join('');
      const ownerPicker = register.length ? `
        <select class="cell-select" style="font-size:11px;padding:2px 4px;margin-top:3px"
          title="Responsible party for this measure"
          onchange="Matrix.updateField('${col.id}', 'ownerId', this.value)">
          <option value="">— Owner —</option>
          ${ownerOpts}
        </select>` : '';
      return `<div class="classify-cell">
        <select class="cell-select" style="font-size:11px;padding:2px 4px"
          onchange="Matrix.updateField('${col.id}', 'additiveType', this.value); Matrix.renderEvent(Matrix._getEventIdForCol('${col.id}'))"
          title="${atInfo.description || ''}">
          ${atOpts}
        </select>
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-muted);cursor:pointer;margin-top:3px" title="Mark as budget-controlled measure">
          <input type="checkbox" ${bcChecked}
            onchange="Matrix.updateField('${col.id}', 'budgetControl', this.checked)">
          💰 Budget ctrl
        </label>
        ${ownerPicker}
      </div>`;
    } else {
      const rt = col.responsibilityType || 'none';
      const rtInfo = (typeof RESPONSIBILITY_TYPES !== 'undefined' && RESPONSIBILITY_TYPES[rt]) || { label: rt };
      const rtOpts = typeof RESPONSIBILITY_TYPES !== 'undefined'
        ? Object.entries(RESPONSIBILITY_TYPES).map(([k, r]) =>
            `<option value="${k}" ${rt === k ? 'selected' : ''}>${r.label}</option>`).join('')
        : '';
      const scdType = col.scdType;
      const scdOpts = typeof SCD_TYPES !== 'undefined'
        ? `<option value="">— SCD —</option>` + Object.entries(SCD_TYPES).map(([k, s]) =>
            `<option value="${k}" ${scdType == k ? 'selected' : ''}>${s.short}</option>`).join('')
        : '';
      return `<div class="classify-cell">
        <select class="cell-select" style="font-size:11px;padding:2px 4px"
          onchange="Matrix.updateField('${col.id}', 'responsibilityType', this.value)"
          title="${rtInfo.description || ''}">
          ${rtOpts}
        </select>
        ${typeof SCD_TYPES !== 'undefined' ? `
        <select class="cell-select" style="font-size:11px;padding:2px 4px;margin-top:3px"
          title="Slowly Changing Dimension type"
          onchange="Matrix.updateField('${col.id}', 'scdType', this.value===''?null:parseInt(this.value))">
          ${scdOpts}
        </select>` : ''}
      </div>`;
    }
  },

  updateGrain(eventId, grain) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event, project } = found;
    event.grain = grain;
    Storage.saveEvent(project.id, event);
    this.renderEvent(eventId);
  },

  addBA(eventId, baId) {
    if (!baId) return;
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event, project } = found;
    if (!event.businessAreaIds) event.businessAreaIds = [];
    if (!event.businessAreaIds.includes(baId)) event.businessAreaIds.push(baId);
    Storage.saveEvent(project.id, event);
    this.renderEvent(eventId);
  },

  removeBA(eventId, baId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event, project } = found;
    event.businessAreaIds = (event.businessAreaIds || []).filter(id => id !== baId);
    Storage.saveEvent(project.id, event);
    this.renderEvent(eventId);
  },

  addRow(eventId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event, project } = found;

    const col = {
      id: Storage.generateId(),
      name: '',
      category: 'who',
      source: 'source_system',
      dataType: 'VARCHAR',
      format: '',
      description: '',
      notes: '',
      additiveType: 'fully_additive',
      requiredGrain: null,
      formula: '',
      budgetControl: false,
      plLineId: '',
      responsibilityType: 'none',
      publicDimensionId: '',
      isConformed: false
    };
    event.columns.push(col);
    Storage.saveEvent(project.id, event);

    this.renderEvent(eventId);

    requestAnimationFrame(() => {
      const rows = document.querySelectorAll('.matrix-row');
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const input = lastRow.querySelector('.name-input');
        if (input) input.focus();
      }
    });
  },

  updateField(colId, field, value) {
    const found = Storage.getEvent(this._getEventIdForCol(colId));
    if (!found) return;
    const { event, project } = found;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col[field] = value;
    Storage.saveEvent(project.id, event);
    this._updateColCount(event.columns.length);
  },

  updateCategory(colId, newCat, row) {
    const found = Storage.getEvent(this._getEventIdForCol(colId));
    if (!found) return;
    const { event, project } = found;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col.category = newCat;
    Storage.saveEvent(project.id, event);

    const cat = CATEGORIES[newCat] || {};
    const dot = row.querySelector('.cat-dot');
    if (dot) dot.style.background = cat.color || '#6b7280';
    const tooltip = document.getElementById(`tooltip-${colId}`);
    if (tooltip) tooltip.textContent = cat.meaning || '';
  },

  updateSource(colId, newSource, selectEl) {
    const found = Storage.getEvent(this._getEventIdForCol(colId));
    if (!found) return;
    const { event, project } = found;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col.source = newSource;
    Storage.saveEvent(project.id, event);

    // Update select colour class
    selectEl.className = selectEl.className.replace(/source-select-\w+/, '');
    selectEl.classList.add(`source-select-${newSource}`);

    // Update source summary chips
    const summary = document.querySelector('.source-summary');
    if (summary) {
      const updated = Storage.getEvent(this._getEventIdForCol(colId));
      if (updated) summary.outerHTML = this._sourceSummary(updated.event.columns);
    }
  },

  deleteRow(colId) {
    const eventId = this._getEventIdForCol(colId);
    if (!eventId) return;
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event, project } = found;
    event.columns = event.columns.filter(c => c.id !== colId);
    Storage.saveEvent(project.id, event);
    this.renderEvent(eventId);
  },

  openRenameModal(projectId, eventId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event } = found;
    Modal.show({
      title: 'Rename Event',
      body: `
        <div class="form-group">
          <label class="form-label" for="evtName">Event name <span class="required">*</span></label>
          <input class="form-input" id="evtName" type="text" value="${this._esc(event.name)}" autofocus maxlength="80">
        </div>
        <div class="form-group">
          <label class="form-label" for="evtDesc">Description</label>
          <textarea class="form-input" id="evtDesc" rows="2">${this._esc(event.description || '')}</textarea>
        </div>
      `,
      confirmLabel: 'Save',
      onConfirm() {
        const name = document.getElementById('evtName').value.trim();
        const desc = document.getElementById('evtDesc').value.trim();
        if (!name) { Modal.shake(); return; }
        event.name = name;
        event.description = desc;
        Storage.saveEvent(projectId, event);
        Modal.hide();
        Matrix.renderEvent(eventId);
      }
    });
  },

  show7WGuide(e) {
    e.preventDefault();
    const ref = document.getElementById('sevenWRef');
    if (ref) ref.scrollIntoView({ behavior: 'smooth' });
  },

  // ── Drag-to-reorder ───────────────────────────────────────

  _attachDragHandlers(eventId) {
    const tbody = document.getElementById('matrixBody');
    if (!tbody) return;

    tbody.addEventListener('dragstart', e => {
      const row = e.target.closest('tr[data-col-id]');
      if (!row) return;
      this._dragSrc = row;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    tbody.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const row = e.target.closest('tr[data-col-id]');
      if (row && row !== this._dragSrc) {
        const rect = row.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        document.querySelectorAll('.drop-above,.drop-below').forEach(r => r.classList.remove('drop-above','drop-below'));
        row.classList.add(e.clientY < mid ? 'drop-above' : 'drop-below');
      }
    });

    tbody.addEventListener('dragleave', e => {
      const row = e.target.closest('tr[data-col-id]');
      if (row) row.classList.remove('drop-above', 'drop-below');
    });

    tbody.addEventListener('drop', e => {
      e.preventDefault();
      document.querySelectorAll('.drop-above,.drop-below,.dragging').forEach(r =>
        r.classList.remove('drop-above','drop-below','dragging'));

      const target = e.target.closest('tr[data-col-id]');
      if (!target || target === this._dragSrc) return;

      const found = Storage.getEvent(eventId);
      if (!found) return;
      const { event, project } = found;

      const srcId = this._dragSrc.dataset.colId;
      const tgtId = target.dataset.colId;
      const srcIdx = event.columns.findIndex(c => c.id === srcId);
      const tgtIdx = event.columns.findIndex(c => c.id === tgtId);
      if (srcIdx < 0 || tgtIdx < 0) return;

      const [moved] = event.columns.splice(srcIdx, 1);
      const rect = target.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;
      const newIdx = insertBefore ? tgtIdx : tgtIdx + (srcIdx < tgtIdx ? 0 : 1);
      event.columns.splice(Math.max(0, newIdx > srcIdx ? newIdx - 1 : newIdx), 0, moved);

      Storage.saveEvent(project.id, event);
      this.renderEvent(eventId);
    });

    tbody.addEventListener('dragend', () => {
      document.querySelectorAll('.drop-above,.drop-below,.dragging').forEach(r =>
        r.classList.remove('drop-above','drop-below','dragging'));
    });
  },

  // ── Helpers ───────────────────────────────────────────────

  _getEventIdForCol(colId) {
    const data = Storage.load();
    for (const project of data.projects) {
      for (const event of project.events) {
        if (event.columns.some(c => c.id === colId)) return event.id;
      }
    }
    return null;
  },

  _updateColCount(n) {
    const el = document.getElementById('colCount');
    if (el) el.textContent = `${n} column${n !== 1 ? 's' : ''}`;
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
