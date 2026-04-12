const Responsibility = {

  DEFAULT_COLORS: ['#1d4ed8', '#065f46', '#7c3aed', '#c2410c', '#0369a1', '#6b7280', '#166534', '#92400e'],

  // ── Project picker ────────────────────────────────────────

  renderProjectPicker() {
    const data = Storage.load();
    const app = document.getElementById('app');

    if (!data.projects.length) {
      app.innerHTML = `
        <div class="view-header">
          <div><h1 class="view-title">Responsibility Register</h1></div>
        </div>
        <div class="empty-state">
          <h2 class="empty-title">No projects yet</h2>
          <p class="empty-desc">Create a project first to define SAP cost object ownership.</p>
          <button class="btn btn-primary" onclick="Router.navigate('projects')">Go to Projects</button>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Responsibility Register</h1>
          <p class="view-subtitle">SAP cost object register — accountability by Cost Centre, Profit Centre, Internal Order, WBS</p>
        </div>
      </div>
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>What is the Responsibility Register?</strong> In SAP-aligned data models, accountability
        is held by <strong>cost objects</strong> (Cost Centres, Profit Centres, Internal Orders, WBS Elements,
        Company Codes, Controlling Areas) — not individual people. Add cost objects to the register, then
        assign them as owners of P&amp;L lines in the Accountability Matrix.
      </div>
      <div class="project-picker">
        <h3 style="margin:0 0 12px">Select a project</h3>
        <div class="card-grid">
          ${data.projects.map(p => {
            const costObjects = p.costObjects || [];
            const measures = p.events.flatMap(e => e.columns.filter(c => c.category === 'how_many'));
            const owned = measures.filter(c => c.ownerId).length;
            const total = measures.length;
            const pct = total ? Math.round(owned / total * 100) : 0;
            return `
              <div class="card" style="cursor:pointer" onclick="Router.navigate('responsibility/${p.id}')">
                <div class="card-body">
                  <h3 class="card-title">${this._esc(p.name)}</h3>
                  <div class="card-meta">
                    <span>${costObjects.length} cost object${costObjects.length !== 1 ? 's' : ''}</span>
                    <span>${total} measure${total !== 1 ? 's' : ''}</span>
                    <span>${owned} owned (${pct}%)</span>
                  </div>
                  <div class="pl-coverage-bar" style="margin-top:8px">
                    <div class="pl-coverage-fill" style="width:${pct}%"></div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // ── Two-tab layout ────────────────────────────────────────

  render(projectId, activeTab) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('responsibility'); return; }

    const tab = activeTab || 'register';
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#responsibility">Responsibility</a>
          <span class="bc-sep">›</span>
          <span>${this._esc(project.name)}</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('responsibility-gaps/${project.id}')">📊 Gap Analysis</button>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">Responsibility Register</h1>
        <p class="view-subtitle">${this._esc(project.name)}</p>
      </div>

      <div class="tab-bar">
        <button class="tab-btn ${tab === 'register' ? 'active' : ''}"
          onclick="Responsibility.render('${project.id}', 'register')">Cost Object Register</button>
        <button class="tab-btn ${tab === 'accountability' ? 'active' : ''}"
          onclick="Responsibility.render('${project.id}', 'accountability')">Accountability Matrix</button>
      </div>

      <div id="tab-content">
        ${tab === 'register'
          ? this._renderRegister(project)
          : this._renderAccountability(project)}
      </div>
    `;
  },

  // ── Register tab ──────────────────────────────────────────

  _renderRegister(project) {
    const costObjects = project.costObjects || [];
    this._filterType = this._filterType || 'all';

    const types = Object.keys(typeof SAP_COST_OBJECT_TYPES !== 'undefined' ? SAP_COST_OBJECT_TYPES : {});
    const filterTabs = [
      `<button class="cost-obj-filter-tab ${this._filterType === 'all' ? 'active' : ''}" onclick="Responsibility._setFilter('${project.id}', 'all')">All (${costObjects.length})</button>`,
      ...types.map(t => {
        const info = SAP_COST_OBJECT_TYPES[t];
        const count = costObjects.filter(o => o.type === t).length;
        return `<button class="cost-obj-filter-tab ${this._filterType === t ? 'active' : ''}"
          onclick="Responsibility._setFilter('${project.id}', '${t}')">${this._esc(info.label)} (${count})</button>`;
      })
    ].join('');

    const visible = this._filterType === 'all'
      ? costObjects
      : costObjects.filter(o => o.type === this._filterType);

    const cards = visible.map(obj => {
      const info = (typeof SAP_COST_OBJECT_TYPES !== 'undefined' && SAP_COST_OBJECT_TYPES[obj.type])
        || { label: obj.type, icon: '⬡', color: '#6b7280', bg: '#f3f4f6' };
      return `
        <div class="cost-obj-card">
          <span class="cost-obj-color-dot" style="background:${obj.color || info.color}"></span>
          <span class="cost-obj-type-badge" style="background:${info.bg};color:${info.color}">${this._esc(info.label)}</span>
          <strong style="font-size:13px">${this._esc(obj.objectId)}</strong>
          <span style="font-size:12px;color:var(--text-muted);flex:1">${this._esc(obj.description || '')}</span>
          ${obj.controllingArea ? `<span style="font-size:10px;color:var(--text-subtle)">${this._esc(obj.controllingArea)}</span>` : ''}
          <button class="btn btn-ghost btn-sm" style="color:#ef4444;flex-shrink:0;padding:2px 6px"
            onclick="Responsibility.confirmDeleteCostObject('${project.id}', '${obj.id}', '${this._esc(obj.objectId)}')"
            title="Delete">✕</button>
        </div>
      `;
    }).join('');

    return `
      <div class="info-banner" style="margin-top:16px">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        SAP cost objects define <strong>accountability</strong> in management accounting. A Cost Centre owns
        overheads; a Profit Centre owns revenue and margin; an Internal Order or WBS Element owns project spend.
        Register your key objects here, then assign them as owners of P&amp;L lines.
      </div>

      <div id="co-form-container"></div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin:20px 0 10px">
        <h3 style="margin:0;font-size:14px;font-weight:600">
          SAP Cost Objects (${costObjects.length})
        </h3>
        <button class="btn btn-primary btn-sm"
          onclick="Responsibility.openAddCostObject('${project.id}')">+ Add Cost Object</button>
      </div>

      <div class="cost-obj-filter-tabs">${filterTabs}</div>

      ${visible.length === 0 ? `
        <div class="empty-state">
          <h2 class="empty-title">${this._filterType === 'all' ? 'No cost objects yet' : 'No ' + (SAP_COST_OBJECT_TYPES?.[this._filterType]?.label || this._filterType) + ' objects'}</h2>
          <p class="empty-desc">Add SAP Cost Centres, Profit Centres, Internal Orders, WBS Elements, Company Codes, or Controlling Areas.</p>
          <button class="btn btn-primary" onclick="Responsibility.openAddCostObject('${project.id}')">Add first cost object</button>
        </div>
      ` : `
        <div>${cards}</div>
      `}
    `;
  },

  _setFilter(projectId, type) {
    this._filterType = type;
    const project = Storage.getProject(projectId);
    if (!project) return;
    const content = document.getElementById('tab-content');
    if (content) content.innerHTML = this._renderRegister(project);
  },

  // ── Add Cost Object ───────────────────────────────────────

  openAddCostObject(projectId) {
    const typeOptions = Object.entries(typeof SAP_COST_OBJECT_TYPES !== 'undefined' ? SAP_COST_OBJECT_TYPES : {})
      .map(([key, val]) => `<option value="${key}">${this._esc(val.label)}</option>`).join('');

    const project = Storage.getProject(projectId);
    const existingColors = (project?.costObjects || []).map(o => o.color);
    const nextColor = this.DEFAULT_COLORS.find(c => !existingColors.includes(c)) || this.DEFAULT_COLORS[0];

    Modal.show({
      title: 'Add SAP Cost Object',
      body: `
        <div class="form-group">
          <label class="form-label">Type <span class="required">*</span></label>
          <select class="form-input" id="coType">
            ${typeOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Object ID <span class="required">*</span></label>
          <input class="form-input" id="coObjectId" type="text" placeholder="e.g. CC-MKTG-001, PC-EMEA, IO-12345" autofocus maxlength="40">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input class="form-input" id="coDesc" type="text" placeholder="e.g. Marketing Cost Centre" maxlength="120">
        </div>
        <div class="form-group">
          <label class="form-label">Controlling Area</label>
          <input class="form-input" id="coCa" type="text" placeholder="e.g. 1000" maxlength="10">
        </div>
        <div class="form-group">
          <label class="form-label">Colour</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="coColorPicker">
            ${this.DEFAULT_COLORS.map(c => `
              <button type="button" class="co-color-btn"
                style="width:28px;height:28px;border-radius:50%;background:${c};border:3px solid ${c === nextColor ? '#fff' : c};box-shadow:${c === nextColor ? '0 0 0 2px ' + c : 'none'};cursor:pointer"
                data-color="${c}"
                onclick="Responsibility._selectColor(this, 'coColor', '${c}')"></button>
            `).join('')}
          </div>
          <input type="hidden" id="coColor" value="${nextColor}">
        </div>
      `,
      confirmLabel: 'Add Cost Object',
      onConfirm() {
        const type = document.getElementById('coType').value;
        const objectId = document.getElementById('coObjectId').value.trim();
        const description = document.getElementById('coDesc').value.trim();
        const controllingArea = document.getElementById('coCa').value.trim();
        const color = document.getElementById('coColor').value;
        if (!objectId) { Modal.shake(); return; }
        const obj = {
          id: Storage.generateId(),
          type, objectId, description, controllingArea, color
        };
        Storage.saveCostObject(projectId, obj);
        Modal.hide();
        Responsibility.render(projectId, 'register');
      }
    });
  },

  _selectColor(btn, inputId, color) {
    document.getElementById(inputId).value = color;
    btn.closest('div').querySelectorAll('button[data-color]').forEach(b => {
      const c = b.dataset.color;
      b.style.border = `3px solid ${c}`;
      b.style.boxShadow = 'none';
    });
    btn.style.border = '3px solid #fff';
    btn.style.boxShadow = `0 0 0 2px ${color}`;
  },

  // ── Delete Cost Object ────────────────────────────────────

  confirmDeleteCostObject(projectId, objId, label) {
    Modal.show({
      title: 'Remove Cost Object',
      body: `<p>Remove <strong>${this._esc(label)}</strong> from the register? This will remove it as owner from any P&amp;L lines it owns.</p>`,
      confirmLabel: 'Remove',
      confirmDanger: true,
      onConfirm() {
        Storage.deleteCostObject(projectId, objId);
        Modal.hide();
        Responsibility.render(projectId, 'register');
      }
    });
  },

  // ── Accountability Matrix tab ─────────────────────────────

  _renderAccountability(project) {
    const plLines = Storage.getPlLines(project.id);
    const costObjects = project.costObjects || [];

    const dataLines = plLines.filter(l => l.type !== 'section' && l.type !== 'derived');
    const projectPlLines = project.plLines || (typeof DEFAULT_PL_LINES !== 'undefined' ? DEFAULT_PL_LINES : []);

    if (costObjects.length === 0) {
      return `
        <div class="info-banner" style="margin-top:16px">
          <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
          <strong>Accountability Matrix</strong> — This matrix shows which SAP cost objects own which
          P&amp;L lines. Toggle cells to assign accountability. Lines with no owner are highlighted in red.
        </div>
        <div class="empty-state" style="margin-top:24px">
          <h2 class="empty-title">No cost objects in the register</h2>
          <p class="empty-desc">Add SAP cost objects to the register first, then assign them to P&amp;L lines here.</p>
          <button class="btn btn-primary" onclick="Responsibility.render('${project.id}', 'register')">Go to Register</button>
        </div>
      `;
    }

    const headerCols = costObjects.map(obj => {
      const info = (typeof SAP_COST_OBJECT_TYPES !== 'undefined' && SAP_COST_OBJECT_TYPES[obj.type])
        || { label: obj.type, color: '#6b7280', bg: '#f3f4f6' };
      return `
        <th style="padding:6px 8px;text-align:center;font-size:10px;font-weight:600;max-width:90px;vertical-align:bottom">
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span class="cost-obj-color-dot" style="background:${obj.color || info.color}"></span>
            <span class="cost-obj-type-badge" style="background:${info.bg};color:${info.color};font-size:9px;padding:1px 4px">${this._esc(info.label.substring(0,4))}</span>
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;font-size:10px" title="${this._esc(obj.objectId)}">${this._esc(obj.objectId)}</span>
          </div>
        </th>
      `;
    }).join('');

    const rows = dataLines.map(line => {
      const plLine = projectPlLines.find(l => l.id === line.id) || line;
      const hasOwner = !!plLine.ownerId;
      const indent = line.parentId ? 16 : 0;

      const cells = costObjects.map(obj => {
        const isAssigned = plLine.ownerId === obj.id;
        const info = (typeof SAP_COST_OBJECT_TYPES !== 'undefined' && SAP_COST_OBJECT_TYPES[obj.type])
          || { color: '#6b7280' };
        return `
          <td style="text-align:center;padding:4px">
            <button class="acc-toggle ${isAssigned ? 'acc-assigned' : ''}"
              style="${isAssigned ? `background:${obj.color || info.color}20;border-color:${obj.color || info.color}` : ''}"
              title="${isAssigned ? 'Remove' : 'Assign'} ${this._esc(obj.objectId)}"
              onclick="Responsibility._togglePlLineOwner('${project.id}', '${line.id}', '${obj.id}')">
              ${isAssigned ? `<span style="color:${obj.color || info.color};font-weight:700">✓</span>` : '<span style="color:var(--text-subtle)">·</span>'}
            </button>
          </td>
        `;
      }).join('');

      return `
        <tr style="${!hasOwner ? 'background:rgba(185,28,28,0.04)' : ''}">
          <td class="acc-line-name" style="padding:7px 10px;font-size:12px;padding-left:${10 + indent}px;${!hasOwner ? 'color:#b91c1c;font-weight:500' : ''}">
            ${this._esc(line.name)}
          </td>
          ${cells}
          <td style="padding:5px 8px;font-size:11px;white-space:nowrap">
            ${hasOwner
              ? `<span style="color:#166534">Assigned</span>`
              : `<span style="color:#b91c1c">Unassigned</span>`}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="info-banner" style="margin-top:16px">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>Accountability Matrix</strong> — Which SAP cost object is accountable for each P&amp;L line?
        Toggle cells to assign. Each P&amp;L line can have one cost object owner. Changes save immediately.
      </div>

      <div style="overflow-x:auto;margin-top:16px">
        <table class="accountability-table" style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;min-width:160px">P&amp;L Line</th>
              ${headerCols}
              <th style="padding:8px 10px;font-size:11px;color:var(--text-muted);white-space:nowrap">Coverage</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-top:8px">
        Click a cell to toggle ownership. Each P&amp;L line can have one owner. Changes are saved immediately.
      </p>
    `;
  },

  // ── Toggle P&L line owner ─────────────────────────────────

  _togglePlLineOwner(projectId, plLineId, ownerId) {
    const data = Storage.load();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return;

    if (!project.plLines) {
      project.plLines = JSON.parse(JSON.stringify(
        typeof DEFAULT_PL_LINES !== 'undefined' ? DEFAULT_PL_LINES : []
      ));
    }

    const line = project.plLines.find(l => l.id === plLineId);
    if (!line) return;

    line.ownerId = (line.ownerId === ownerId) ? '' : ownerId;

    Storage.save(data);

    const freshProject = Storage.getProject(projectId);
    const tabContent = document.getElementById('tab-content');
    if (tabContent && freshProject) {
      tabContent.innerHTML = this._renderAccountability(freshProject);
    }
  },

  // ── Gap analysis view ─────────────────────────────────────

  renderGaps(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('responsibility'); return; }

    const plLines = Storage.getPlLines(projectId);
    const costObjects = project.costObjects || [];
    const projectPlLines = project.plLines || (typeof DEFAULT_PL_LINES !== 'undefined' ? DEFAULT_PL_LINES : []);

    const allMeasures = project.events.flatMap(e =>
      e.columns.filter(c => c.category === 'how_many').map(c => ({
        ...c, _eventId: e.id, _eventName: e.name
      }))
    );

    const total = allMeasures.length;
    const owned = allMeasures.filter(m => m.ownerId).length;
    const unowned = total - owned;
    const pct = total ? Math.round(owned / total * 100) : 0;

    const unownedByEvent = {};
    allMeasures.filter(m => !m.ownerId).forEach(m => {
      if (!unownedByEvent[m._eventId]) {
        unownedByEvent[m._eventId] = { name: m._eventName, measures: [] };
      }
      unownedByEvent[m._eventId].measures.push(m);
    });

    const coveredLineIds = new Set(allMeasures.filter(m => m.plLineId).map(m => m.plLineId));
    const unownedPlLines = plLines.filter(l => {
      const projectLine = projectPlLines.find(pl => pl.id === l.id) || l;
      return !projectLine.ownerId && coveredLineIds.has(l.id);
    });

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#responsibility">Responsibility</a>
          <span class="bc-sep">›</span>
          <a href="#responsibility/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <span>Gap Analysis</span>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">Responsibility Gap Analysis</h1>
        <p class="view-subtitle">${this._esc(project.name)}</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
        ${this._statCard('Cost Objects', costObjects.length, '#374151')}
        ${this._statCard('Total Measures', total, '#374151')}
        ${this._statCard('Owned', owned, owned === total ? '#166534' : '#374151')}
        ${this._statCard('Unowned', unowned, unowned > 0 ? '#b91c1c' : '#166534')}
        ${this._statCard('Coverage', pct + '%', pct === 100 ? '#166534' : pct > 50 ? '#92400e' : '#b91c1c')}
      </div>

      <div style="margin-bottom:20px">
        <h3 style="font-size:14px;font-weight:600;color:${unowned > 0 ? '#b91c1c' : '#166534'};margin-bottom:10px">
          ${unowned > 0 ? '⚠' : '✓'} Unowned Measures (${unowned})
        </h3>
        ${unowned === 0 ? `
          <div style="color:#166534;font-size:13px;padding:12px 0">All measures have an owner assigned.</div>
        ` : `
          ${Object.entries(unownedByEvent).map(([eventId, group]) => `
            <div style="margin-bottom:12px;padding:12px;background:rgba(185,28,28,0.04);border:1px solid rgba(185,28,28,0.2);border-radius:8px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <strong style="font-size:13px">${this._esc(group.name)}</strong>
                <a href="#event/${eventId}" style="font-size:12px;color:var(--primary)">Go to matrix →</a>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${group.measures.map(m => `
                  <span style="font-size:12px;background:var(--bg-card);border:1px solid #fca5a5;border-radius:6px;padding:3px 8px">
                    ${this._esc(m.name)}
                  </span>
                `).join('')}
              </div>
            </div>
          `).join('')}
        `}
      </div>

      <div style="margin-bottom:20px">
        <h3 style="font-size:14px;font-weight:600;color:${unownedPlLines.length > 0 ? '#92400e' : '#166534'};margin-bottom:10px">
          ${unownedPlLines.length > 0 ? '⚠' : '✓'} P&amp;L Lines Without an Owner (${unownedPlLines.length})
        </h3>
        ${unownedPlLines.length === 0 ? `
          <div style="color:#166534;font-size:13px;padding:12px 0">All modelled P&amp;L lines have an owner.</div>
        ` : `
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${unownedPlLines.map(l => `
              <span style="font-size:12px;background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.3);border-radius:6px;padding:4px 10px;color:#92400e">
                ${this._esc(l.name)}
              </span>
            `).join('')}
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
            <a href="#responsibility/${project.id}" style="color:var(--primary)">Go to Accountability Matrix →</a>
            to assign cost objects to these lines.
          </p>
        `}
      </div>

      <div>
        <h3 style="font-size:14px;font-weight:600;margin-bottom:12px">Cost Object Summary</h3>
        ${this._costObjectSummary(project)}
      </div>
    `;
  },

  _costObjectSummary(project) {
    if (!project.costObjects || !project.costObjects.length) {
      return `<p style="font-size:12px;color:var(--text-muted)">No cost objects registered. <a href="#responsibility/${project.id}" style="color:var(--primary)">Add cost objects →</a></p>`;
    }
    const byType = {};
    (project.costObjects || []).forEach(o => {
      if (!byType[o.type]) byType[o.type] = [];
      byType[o.type].push(o);
    });
    return `<div style="display:flex;flex-wrap:wrap;gap:8px">
      ${Object.entries(byType).map(([type, objs]) => {
        const info = (typeof SAP_COST_OBJECT_TYPES !== 'undefined' && SAP_COST_OBJECT_TYPES[type])
          || { label: type, color: '#6b7280', bg: '#f3f4f6' };
        return `<div style="border:1px solid var(--border);border-radius:8px;padding:10px 14px;min-width:140px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${info.color};margin-bottom:6px">${this._esc(info.label)} (${objs.length})</div>
          ${objs.map(o => `<div style="font-size:11px;display:flex;align-items:center;gap:4px;margin-bottom:2px">
            <span style="width:6px;height:6px;border-radius:50%;background:${o.color || info.color};flex-shrink:0"></span>
            ${this._esc(o.objectId)}
          </div>`).join('')}
        </div>`;
      }).join('')}
    </div>`;
  },

  // ── Legacy helpers kept for backwards compat ──────────────

  openAddPerson(projectId) { this.openAddCostObject(projectId); },

  confirmDeletePerson(projectId, personId, name) {
    Modal.show({
      title: 'Remove from Register',
      body: `<p>Remove <strong>${this._esc(name)}</strong>? Their ownership assignments will be cleared.</p>`,
      confirmLabel: 'Remove', confirmDanger: true,
      onConfirm() {
        Storage.deleteResponsibleParty(projectId, personId);
        Modal.hide();
        Responsibility.render(projectId, 'register');
      }
    });
  },

  // ── Helpers ───────────────────────────────────────────────

  _statCard(label, value, color) {
    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px 14px">
        <div style="font-size:22px;font-weight:700;color:${color}">${value}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${label}</div>
      </div>
    `;
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
