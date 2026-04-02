const Matrix = {
  // Track drag state
  _dragSrc: null,

  renderEvent(eventId) {
    const found = Storage.getEvent(eventId);
    if (!found) { Router.navigate('projects'); return; }
    const { event, project } = found;

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
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('diagram/${event.id}')">View Diagram →</button>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">${this._esc(event.name)}</h1>
        ${event.description ? `<p class="view-subtitle">${this._esc(event.description)}</p>` : ''}
      </div>

      <div class="info-banner" id="matrixBanner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'" title="Dismiss">✕</button>
        <strong>BEAM Matrix</strong> — Describe each attribute of this business event by assigning a
        <strong>7W category</strong>. Non-measure categories (Who, What, When, Where, How, Why) become
        <em>dimension tables</em>; <em>How many</em> columns become <em>facts</em> in the central fact table.
        <a href="#" class="info-link" onclick="Matrix.show7WGuide(event)">See the 7W guide →</a>
      </div>

      <div class="matrix-toolbar">
        <div class="matrix-toolbar-left">
          <button class="btn btn-primary btn-sm" onclick="Matrix.addRow('${event.id}')">+ Add Column</button>
          <span class="col-count" id="colCount">${event.columns.length} column${event.columns.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="matrix-toolbar-right">
          <button class="btn btn-ghost btn-sm" onclick="Export.eventToCSV(Storage.getEvent('${event.id}').event)">⬇ CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="Export.printEvent(Storage.getEvent('${event.id}').event, '${this._esc(project.name)}')">🖨 Print</button>
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
              <th class="col-type">
                Data Type
                <div class="th-hint">SQL/logical data type</div>
              </th>
              <th class="col-desc">
                Description
                <div class="th-hint">What this attribute represents</div>
              </th>
              <th class="col-notes">
                Notes
                <div class="th-hint">Example values, constraints, source</div>
              </th>
              <th class="col-del"></th>
            </tr>
          </thead>
          <tbody id="matrixBody">
            ${event.columns.length === 0 ? this._emptyMatrixRow() : event.columns.map((col, i) => this._row(col, i)).join('')}
          </tbody>
        </table>
      </div>

      ${event.columns.length === 0 ? '' : `
        <div class="matrix-footer">
          <button class="btn btn-ghost btn-sm" onclick="Matrix.addRow('${event.id}')">+ Add another column</button>
        </div>
      `}

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

  _row(col, index) {
    const catOptions = Object.entries(CATEGORIES).map(([key, c]) =>
      `<option value="${key}" ${col.category === key ? 'selected' : ''} style="color:${c.color}">${c.label} — ${c.meaning}</option>`
    ).join('');

    const typeOptions = ['VARCHAR', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DATE', 'DATETIME', 'BOOLEAN', 'TEXT', 'UUID'].map(t =>
      `<option value="${t}" ${col.dataType === t ? 'selected' : ''}>${t}</option>`
    ).join('');

    const cat = CATEGORIES[col.category] || {};
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
        <td class="col-type">
          <select class="cell-select"
            onchange="Matrix.updateField('${col.id}', 'dataType', this.value)">
            ${typeOptions}
          </select>
        </td>
        <td class="col-desc">
          <input class="cell-input" type="text" value="${this._esc(col.description || '')}"
            placeholder="What this represents…"
            onblur="Matrix.updateField('${col.id}', 'description', this.value)">
        </td>
        <td class="col-notes">
          <input class="cell-input" type="text" value="${this._esc(col.notes || '')}"
            placeholder="Examples, constraints…"
            onblur="Matrix.updateField('${col.id}', 'notes', this.value)">
        </td>
        <td class="col-del">
          <button class="btn-icon delete-row" title="Delete row"
            onclick="Matrix.deleteRow('${col.id}')">✕</button>
        </td>
      </tr>
    `;
  },

  _emptyMatrixRow() {
    return `
      <tr class="empty-matrix-row">
        <td colspan="7">
          <div class="empty-matrix">
            <p>No columns yet. Click <strong>+ Add Column</strong> to start describing this event's attributes.</p>
            <p class="hint-text">Start by adding the key <em>Who</em> (person/org), <em>What</em> (product/item),
            and <em>When</em> (date/time) dimensions, then add your <em>How many</em> measures.</p>
          </div>
        </td>
      </tr>
    `;
  },

  addRow(eventId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event, project } = found;

    const col = {
      id: Storage.generateId(),
      name: '',
      category: 'who',
      dataType: 'VARCHAR',
      description: '',
      notes: ''
    };
    event.columns.push(col);
    Storage.saveEvent(project.id, event);

    // Re-render the view (simplest approach for correctness)
    this.renderEvent(eventId);

    // Focus the new name input
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

    // Update dot colour and tooltip
    const cat = CATEGORIES[newCat] || {};
    const dot = row.querySelector('.cat-dot');
    if (dot) dot.style.background = cat.color || '#6b7280';
    const tooltip = document.getElementById(`tooltip-${colId}`);
    if (tooltip) tooltip.textContent = cat.meaning || '';
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
