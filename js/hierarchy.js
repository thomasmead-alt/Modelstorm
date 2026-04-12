// ── Hierarchy Editor ─────────────────────────────────────────────────────────
// Manages hierarchies for conformed dimensions.
// Each hierarchy has a type (SAP | Tool | Custom), levels, and optional
// SAP/BI-tool-specific configuration.
// Storage: root-level data.hierarchies[]  (cross-project, cross-dim)

const HierarchyEditor = {

  _state: { selectedHierarchyId: null },

  // ── List View: all dimensions with hierarchy counts ───────

  renderList() {
    const allDims = typeof Storage.getAllDimTemplates === 'function'
      ? Storage.getAllDimTemplates()
      : (typeof DEFAULT_PUBLIC_DIMENSIONS !== 'undefined' ? DEFAULT_PUBLIC_DIMENSIONS : []);
    const data = Storage.load();
    const hierarchies = data.hierarchies || [];

    const hCount = {};
    hierarchies.forEach(h => { hCount[h.dimId] = (hCount[h.dimId] || 0) + 1; });

    const catOrder = ['who', 'what', 'when', 'where', 'how', 'why'];
    const catGroups = {};
    catOrder.forEach(c => { catGroups[c] = []; });
    allDims.forEach(d => {
      const key = catOrder.includes(d.category) ? d.category : 'who';
      catGroups[key].push(d);
    });

    const sections = catOrder
      .filter(c => catGroups[c].length > 0)
      .map(c => {
        const catInfo = (typeof CATEGORIES !== 'undefined' && CATEGORIES[c]) || { label: c, color: '#6b7280' };
        const cards = catGroups[c].map(d => {
          const count = hCount[d.id] || 0;
          return `
            <div class="card dim-card" style="cursor:pointer" onclick="Router.navigate('hierarchy-editor/${d.id}')">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <span style="font-size:24px">${d.icon || '📦'}</span>
                <div>
                  <div style="display:flex;align-items:center;gap:6px">
                    <h3 class="card-title" style="margin:0">${this._esc(d.name)}</h3>
                    ${d.isCustom ? '<span class="dim-card-custom-badge">Custom</span>' : ''}
                  </div>
                  <div style="font-size:11px;color:${catInfo.color};font-weight:600">${catInfo.label}</div>
                </div>
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">${(d.columns || []).length} column${(d.columns||[]).length !== 1 ? 's' : ''}</div>
              <div class="hier-count-badge${count > 0 ? ' hier-count-badge-active' : ''}">
                ${count > 0 ? `${count} hierarch${count !== 1 ? 'ies' : 'y'} defined` : 'No hierarchies — click to add'}
              </div>
            </div>`;
        }).join('');
        return `
          <div style="margin-bottom:28px">
            <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${catInfo.color};margin-bottom:12px;padding-bottom:4px;border-bottom:2px solid ${catInfo.color}20">${catInfo.label}</h3>
            <div class="card-grid">${cards}</div>
          </div>`;
      }).join('');

    const totalHier = hierarchies.length;

    document.getElementById('app').innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Hierarchy Library</h1>
          <p class="view-subtitle">Define roll-up hierarchies for conformed dimensions — SAP standard, BI-tool, or custom</p>
        </div>
        <div class="view-actions">
          <span style="font-size:12px;color:var(--text-muted)">${totalHier} hierarch${totalHier !== 1 ? 'ies' : 'y'} defined</span>
        </div>
      </div>

      <div class="info-banner" id="hierBanner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'" title="Dismiss">✕</button>
        <strong>Dimension Hierarchies</strong> define how members roll up for reporting and aggregation.
        Mark each as <strong>SAP</strong> (H-table / BW InfoObject), <strong>Tool</strong> (BI-layer hierarchy in Power BI, Tableau, etc.),
        or <strong>Custom</strong>. Levels map to dimension columns and define the aggregation path.
      </div>

      ${sections || '<div class="empty-state"><h2 class="empty-title">No dimension templates found</h2></div>'}
    `;
  },

  // ── Editor View: two-panel for a specific dimension ───────

  render(dimId) {
    const allDims = typeof Storage.getAllDimTemplates === 'function'
      ? Storage.getAllDimTemplates()
      : (typeof DEFAULT_PUBLIC_DIMENSIONS !== 'undefined' ? DEFAULT_PUBLIC_DIMENSIONS : []);
    const dim = allDims.find(d => d.id === dimId);
    if (!dim) { Router.navigate('hierarchies'); return; }

    const data = Storage.load();
    const hierarchies = (data.hierarchies || []).filter(h => h.dimId === dimId);

    let selHId = this._state.selectedHierarchyId;
    if (!selHId || !hierarchies.find(h => h.id === selHId)) {
      selHId = hierarchies.length > 0 ? hierarchies[0].id : null;
    }
    this._state.selectedHierarchyId = selHId;

    const catInfo = (typeof CATEGORIES !== 'undefined' && CATEGORIES[dim.category]) || { label: dim.category, color: '#6b7280' };
    const selH = hierarchies.find(h => h.id === selHId) || null;

    document.getElementById('app').innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#hierarchies">Hierarchy Library</a>
          <span class="bc-sep">›</span>
          <span>${dim.icon ? dim.icon + ' ' : ''}${this._esc(dim.name)}</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary btn-sm" onclick="HierarchyEditor.openAddModal('${dimId}')">+ Add Hierarchy</button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:12px;color:var(--text-muted)">
        <span style="color:${catInfo.color};font-weight:600">${catInfo.label}</span>
        <span>·</span>
        <span>${(dim.columns || []).length} column${(dim.columns||[]).length !== 1 ? 's' : ''}</span>
        ${dim.isCustom
          ? '<span class="dim-card-custom-badge">Custom</span>'
          : '<span style="font-size:10px;color:var(--text-subtle);border:1px solid var(--border);border-radius:3px;padding:0 5px">Built-in</span>'}
        <span>·</span>
        <span>${hierarchies.length} hierarch${hierarchies.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      <div class="event-detail-layout" style="min-height:520px">
        <div class="col-list-panel">
          <div class="col-list-header">
            <span>Hierarchies <span class="col-group-count">${hierarchies.length}</span></span>
            <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 7px;text-transform:none;letter-spacing:0"
              onclick="HierarchyEditor.openAddModal('${dimId}')">+ Add</button>
          </div>
          <div class="col-list-body">
            ${hierarchies.length === 0
              ? `<div class="col-list-empty">No hierarchies yet.<br>Click <strong>+ Add</strong> to begin.</div>`
              : hierarchies.map(h => this._hierListItem(h, selHId, dimId)).join('')}
          </div>
        </div>

        <div class="col-detail-panel">
          ${selH
            ? this._hierDetail(selH, dim, dimId)
            : `<div class="col-detail-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:.3">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                </svg>
                <span>Select a hierarchy to edit its levels</span>
                <button class="btn btn-primary btn-sm" onclick="HierarchyEditor.openAddModal('${dimId}')">+ Add first hierarchy</button>
              </div>`}
        </div>
      </div>
    `;
  },

  // ── Left panel list item ──────────────────────────────────

  _hierListItem(h, selectedId, dimId) {
    const ti = this._typeInfo(h.type);
    const isActive = h.id === selectedId;
    const levelCount = (h.levels || []).length;
    return `
      <div class="col-list-item${isActive ? ' active' : ''}"
        onclick="HierarchyEditor._selectHierarchy('${h.id}','${dimId}')">
        <div class="col-cat-dot" style="background:${ti.color}"></div>
        <span class="col-item-name" title="${this._esc(h.name)}">${this._esc(h.name) || '<em style="color:var(--text-subtle)">unnamed</em>'}</span>
        <span class="hier-type-badge" style="background:${ti.bg};color:${ti.color}">${ti.short}</span>
        <span class="col-item-type">${levelCount} lvl${levelCount !== 1 ? 's' : ''}</span>
      </div>`;
  },

  _typeInfo(type) {
    const MAP = {
      sap:    { label: 'SAP',    short: 'SAP',  color: '#065f46', bg: '#d1fae5' },
      tool:   { label: 'Tool',   short: 'TOOL', color: '#1d4ed8', bg: '#eff6ff' },
      custom: { label: 'Custom', short: 'CUS',  color: '#7c3aed', bg: '#f3e8ff' },
    };
    return MAP[type] || MAP.custom;
  },

  _selectHierarchy(hId, dimId) {
    this._state.selectedHierarchyId = hId;
    this.render(dimId);
  },

  // ── Right panel: hierarchy detail ────────────────────────

  _hierDetail(h, dim, dimId) {
    const ti = this._typeInfo(h.type);
    const typeOpts = ['sap', 'tool', 'custom'].map(k =>
      `<option value="${k}" ${h.type === k ? 'selected' : ''}>${this._typeInfo(k).label}</option>`
    ).join('');

    // SAP-specific section
    const sapSection = h.type === 'sap' ? `
      <div class="cd-section">
        <div class="cd-section-title">SAP Configuration</div>
        <div class="cd-grid g2">
          <div class="cd-field">
            <label>Hierarchy Object</label>
            <input type="text" value="${this._esc(h.sapObject || '')}"
              placeholder="e.g. KOSTH, PROPH, GLPCT, SKB1"
              onchange="HierarchyEditor.saveField('${h.id}','sapObject',this.value,'${dimId}')">
            <span class="src-origin-hint">SAP standard hierarchy table name</span>
          </div>
          <div class="cd-field">
            <label>SAP Characteristic / Field</label>
            <input type="text" value="${this._esc(h.sapCharacteristic || '')}"
              placeholder="e.g. KOSTL, PRCTR, RACCT, MATNR"
              onchange="HierarchyEditor.saveField('${h.id}','sapCharacteristic',this.value,'${dimId}')">
            <span class="src-origin-hint">Technical field name in SAP master data</span>
          </div>
          <div class="cd-field">
            <label>BW InfoObject (optional)</label>
            <input type="text" value="${this._esc(h.bwInfoObject || '')}"
              placeholder="e.g. 0COSTCENTER, 0PROFIT_CTR"
              onchange="HierarchyEditor.saveField('${h.id}','bwInfoObject',this.value,'${dimId}')">
          </div>
          <div class="cd-field">
            <label>SAP Module</label>
            <input type="text" value="${this._esc(h.sapModule || '')}"
              placeholder="e.g. CO-CCA, FI-GL, PS"
              onchange="HierarchyEditor.saveField('${h.id}','sapModule',this.value,'${dimId}')">
          </div>
        </div>
      </div>` : '';

    // Tool-specific section
    const toolSection = h.type === 'tool' ? `
      <div class="cd-section">
        <div class="cd-section-title">BI Tool Configuration</div>
        <div class="cd-grid g2">
          <div class="cd-field">
            <label>Tool / Platform</label>
            <input type="text" value="${this._esc(h.toolName || '')}"
              placeholder="e.g. Power BI, Tableau, Looker, Qlik"
              onchange="HierarchyEditor.saveField('${h.id}','toolName',this.value,'${dimId}')">
          </div>
          <div class="cd-field">
            <label>Object / Path</label>
            <input type="text" value="${this._esc(h.toolObject || '')}"
              placeholder="e.g. Dataset > Table > Hierarchy name"
              onchange="HierarchyEditor.saveField('${h.id}','toolObject',this.value,'${dimId}')">
          </div>
        </div>
      </div>` : '';

    // Levels table
    const levels = (h.levels || []).slice().sort((a, b) => (a.levelNum || 0) - (b.levelNum || 0));
    const levelsSection = `
      <div class="cd-section">
        <div class="cd-section-title" style="display:flex;align-items:center;justify-content:space-between">
          <span>Levels <span class="col-group-count">${levels.length}</span></span>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px;text-transform:none;letter-spacing:0"
            onclick="HierarchyEditor.addLevel('${h.id}','${dimId}')">+ Add Level</button>
        </div>
        ${levels.length === 0 ? `
          <div style="padding:16px;text-align:center;color:var(--text-subtle);font-size:12px;border:1px dashed var(--border);border-radius:6px">
            No levels defined. Click <strong>+ Add Level</strong> to define the hierarchy structure.
          </div>` : `
        <div class="hier-levels-table">
          <div class="hier-levels-head">
            <span style="width:36px;flex-shrink:0">#</span>
            <span style="flex:1.2">Level Name</span>
            <span style="flex:1">Column Mapping</span>
            <span style="flex:1.5">Description</span>
            <span style="width:32px;flex-shrink:0"></span>
          </div>
          ${levels.map(l => `
          <div class="hier-level-row">
            <span style="width:36px;flex-shrink:0;color:var(--text-subtle);font-size:11px;font-weight:700">${l.levelNum}</span>
            <div style="flex:1.2">
              <input class="cell-input" type="text" value="${this._esc(l.name || '')}"
                placeholder="e.g. Controlling Area"
                style="font-size:12px;width:100%"
                onchange="HierarchyEditor.saveLevelField('${h.id}','${l.id}','name',this.value,'${dimId}')">
            </div>
            <div style="flex:1">
              <select class="cell-input" style="font-size:12px;width:100%"
                onchange="HierarchyEditor.saveLevelField('${h.id}','${l.id}','columnRef',this.value,'${dimId}')">
                <option value="">— Not mapped —</option>
                ${(dim.columns || []).map(c =>
                  `<option value="${c.name}" ${l.columnRef === c.name ? 'selected' : ''}>${this._esc(c.name)}</option>`
                ).join('')}
              </select>
            </div>
            <div style="flex:1.5">
              <input class="cell-input" type="text" value="${this._esc(l.description || '')}"
                placeholder="What this level represents"
                style="font-size:12px;width:100%"
                onchange="HierarchyEditor.saveLevelField('${h.id}','${l.id}','description',this.value,'${dimId}')">
            </div>
            <button class="btn btn-ghost btn-sm" style="width:28px;padding:2px 4px;color:var(--danger);flex-shrink:0"
              onclick="HierarchyEditor.deleteLevel('${h.id}','${l.id}','${dimId}')">✕</button>
          </div>`).join('')}
        </div>`}
      </div>`;

    return `
      <div class="col-detail-body">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div>
            <h2 style="font-size:15px;font-weight:600;margin:0 0 4px">${this._esc(h.name)}</h2>
            <span class="hier-type-badge" style="background:${ti.bg};color:${ti.color}">${ti.label} hierarchy</span>
            ${h.isActive === false ? '<span style="margin-left:6px;font-size:10px;color:#9ca3af;font-weight:600">INACTIVE</span>' : ''}
          </div>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)"
            onclick="HierarchyEditor.confirmDelete('${h.id}','${dimId}')">Delete</button>
        </div>

        <div class="cd-section">
          <div class="cd-section-title">Identity</div>
          <div class="cd-grid g2">
            <div class="cd-field" style="grid-column:1/-1">
              <label>Hierarchy Name</label>
              <input type="text" value="${this._esc(h.name)}"
                onchange="HierarchyEditor.saveField('${h.id}','name',this.value,'${dimId}')">
            </div>
            <div class="cd-field">
              <label>Type</label>
              <select onchange="HierarchyEditor.saveField('${h.id}','type',this.value,'${dimId}')">${typeOpts}</select>
            </div>
            <div class="cd-toggle">
              <input type="checkbox" id="ha-${h.id}" ${h.isActive !== false ? 'checked' : ''}
                onchange="HierarchyEditor.saveField('${h.id}','isActive',this.checked,'${dimId}')">
              <label for="ha-${h.id}">Available for reporting</label>
            </div>
            <div class="cd-field" style="grid-column:1/-1">
              <label>Description</label>
              <textarea placeholder="Purpose, usage, or notes about this hierarchy…"
                onchange="HierarchyEditor.saveField('${h.id}','description',this.value,'${dimId}')">${this._esc(h.description || '')}</textarea>
            </div>
          </div>
        </div>

        ${sapSection}
        ${toolSection}
        ${levelsSection}
      </div>`;
  },

  // ── Actions ───────────────────────────────────────────────

  openAddModal(dimId) {
    Modal.show({
      title: 'Add Hierarchy',
      body: `
        <div class="form-group">
          <label class="form-label" for="hierName">Hierarchy Name <span class="required">*</span></label>
          <input class="form-input" id="hierName" type="text"
            placeholder="e.g. Standard Cost Centre Hierarchy" autofocus maxlength="120">
        </div>
        <div class="form-group">
          <label class="form-label" for="hierType">Type</label>
          <select class="form-input" id="hierType">
            <option value="sap">SAP — H-table / BW InfoObject / CDS hierarchy</option>
            <option value="tool">Tool — BI-layer hierarchy (Power BI, Tableau, etc.)</option>
            <option value="custom">Custom — manually defined roll-up</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="hierDesc">Description <span class="optional">(optional)</span></label>
          <textarea class="form-input" id="hierDesc" rows="2"
            placeholder="Purpose or usage notes for this hierarchy"></textarea>
        </div>
      `,
      confirmLabel: 'Add Hierarchy',
      onConfirm() {
        const name = document.getElementById('hierName')?.value.trim();
        if (!name) { Modal.shake(); return; }
        const h = {
          id: Storage.generateId(),
          dimId,
          name,
          type: document.getElementById('hierType')?.value || 'sap',
          description: document.getElementById('hierDesc')?.value.trim() || '',
          isActive: true,
          sapObject: '', sapCharacteristic: '', bwInfoObject: '', sapModule: '',
          toolName: '', toolObject: '',
          levels: []
        };
        Storage.saveHierarchy(h);
        HierarchyEditor._state.selectedHierarchyId = h.id;
        Modal.hide();
        HierarchyEditor.render(dimId);
      }
    });
  },

  saveField(hId, field, value, dimId) {
    Storage.saveHierarchyField(hId, field, value);
    // Re-render when type or active changes (affects visible sections)
    if (field === 'type' || field === 'isActive') {
      this._state.selectedHierarchyId = hId;
      const data = Storage.load();
      const h = (data.hierarchies || []).find(x => x.id === hId);
      if (h) this.render(h.dimId);
    }
  },

  addLevel(hId, dimId) {
    const data = Storage.load();
    const h = (data.hierarchies || []).find(x => x.id === hId);
    if (!h) return;
    const maxLevel = (h.levels || []).reduce((m, l) => Math.max(m, l.levelNum || 0), 0);
    if (!h.levels) h.levels = [];
    h.levels.push({ id: Storage.generateId(), levelNum: maxLevel + 1, name: '', columnRef: '', description: '' });
    Storage.saveHierarchy(h);
    this._state.selectedHierarchyId = hId;
    this.render(dimId);
  },

  deleteLevel(hId, levelId, dimId) {
    const data = Storage.load();
    const h = (data.hierarchies || []).find(x => x.id === hId);
    if (!h) return;
    h.levels = (h.levels || []).filter(l => l.id !== levelId);
    // Re-number
    h.levels.forEach((l, i) => { l.levelNum = i + 1; });
    Storage.saveHierarchy(h);
    this._state.selectedHierarchyId = hId;
    this.render(dimId);
  },

  saveLevelField(hId, levelId, field, value, dimId) {
    const data = Storage.load();
    const h = (data.hierarchies || []).find(x => x.id === hId);
    if (!h) return;
    const level = (h.levels || []).find(l => l.id === levelId);
    if (!level) return;
    level[field] = value;
    Storage.saveHierarchy(h);
    // No re-render needed — inline inputs keep their own state
  },

  confirmDelete(hId, dimId) {
    const data = Storage.load();
    const h = (data.hierarchies || []).find(x => x.id === hId);
    if (!h) return;
    Modal.show({
      title: 'Delete Hierarchy',
      body: `<p>Are you sure you want to delete <strong>${HierarchyEditor._esc(h.name)}</strong>?
        This will remove all ${(h.levels || []).length} level${(h.levels||[]).length !== 1 ? 's' : ''}.
        This cannot be undone.</p>`,
      confirmLabel: 'Delete',
      confirmDanger: true,
      onConfirm() {
        Storage.deleteHierarchy(hId);
        HierarchyEditor._state.selectedHierarchyId = null;
        Modal.hide();
        HierarchyEditor.render(dimId);
      }
    });
  },

  _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
