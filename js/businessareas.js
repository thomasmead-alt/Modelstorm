const BusinessAreas = {

  DEFAULT_COLORS: ['#4a6cf7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],

  renderProjectPicker() {
    const data = Storage.load();
    const app = document.getElementById('app');

    if (!data.projects.length) {
      app.innerHTML = `
        <div class="view-header">
          <div><h1 class="view-title">Business Areas</h1></div>
        </div>
        <div class="empty-state">
          <h2 class="empty-title">No projects yet</h2>
          <p class="empty-desc">Create a project first to define business area ownership.</p>
          <button class="btn btn-primary" onclick="Router.navigate('projects')">Go to Projects</button>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Business Areas</h1>
          <p class="view-subtitle">Ownership matrix — which business areas consume which events</p>
        </div>
      </div>
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>What are Business Areas?</strong> A business area (BA) is an organisational unit or
        stakeholder group that owns or consumes the data in a fact table. Mapping BAs to events helps
        identify scope, prioritise delivery, and communicate the data model to the right people.
        Define your BAs here, then assign them to events in the BEAM matrix.
      </div>
      <div class="project-picker">
        <h3 style="margin:0 0 12px">Select a project</h3>
        <div class="card-grid">
          ${data.projects.map(p => {
            const baCount = (p.businessAreas || []).length;
            const evCount = p.events.length;
            return `
              <div class="card" style="cursor:pointer" onclick="Router.navigate('business-areas/${p.id}')">
                <div class="card-body">
                  <h3 class="card-title">${this._esc(p.name)}</h3>
                  <div class="card-meta">
                    <span>${evCount} event${evCount !== 1 ? 's' : ''}</span>
                    <span>${baCount} business area${baCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  render(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('business-areas'); return; }

    const bas = project.businessAreas || [];
    const events = project.events;

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#project/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <span>Business Areas</span>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">Business Areas</h1>
        <p class="view-subtitle">${this._esc(project.name)}</p>
      </div>

      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>Ownership Matrix</strong> — Define your business areas, then check which events each
        BA owns or consumes. This helps scope delivery, identify cross-BA dependencies, and communicate
        the data model to stakeholders. BAs can also be assigned to individual events from the
        <strong>BEAM Matrix</strong> event metadata panel.
      </div>

      <div style="display:grid;grid-template-columns:280px 1fr;gap:20px;align-items:start">

        <!-- BA Management sidebar -->
        <div class="ba-manage">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0;font-size:14px;font-weight:600">Business Areas</h3>
            <button class="btn btn-primary btn-sm" onclick="BusinessAreas.openAddBA('${project.id}')">+ Add</button>
          </div>

          ${bas.length === 0 ? `
            <div style="color:var(--text-muted);font-size:12px;text-align:center;padding:16px 0">
              No business areas yet.<br>Add your first BA above.
            </div>
          ` : `
            <div class="ba-list" id="baList">
              ${bas.map(ba => this._baItem(ba, project.id)).join('')}
            </div>
          `}

          <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
            <p style="font-size:11px;color:var(--text-muted);margin:0">
              Examples: Finance, Sales, Operations, HR, IT, Marketing, Supply Chain, Executive
            </p>
          </div>
        </div>

        <!-- Matrix -->
        <div>
          ${bas.length === 0 || events.length === 0
            ? this._emptyMatrix(bas, events, project.id)
            : this._renderMatrix(project, bas, events)}
        </div>
      </div>

      <!-- Coverage analysis (if data exists) -->
      ${bas.length > 0 && events.length > 0 ? this._renderCoverage(project, bas, events) : ''}
    `;
  },

  _baItem(ba, projectId) {
    return `
      <div class="ba-item" id="ba-${ba.id}">
        <span class="ba-color-dot" style="background:${ba.color || '#6b7280'}"></span>
        <span class="ba-item-name">${this._esc(ba.name)}</span>
        <button class="ba-item-del" title="Delete business area"
          onclick="BusinessAreas.confirmDeleteBA('${projectId}', '${ba.id}', '${this._esc(ba.name)}')">✕</button>
      </div>
    `;
  },

  _emptyMatrix(bas, events, projectId) {
    if (bas.length === 0 && events.length === 0) {
      return `<div style="color:var(--text-muted);font-size:13px;padding:20px 0">
        Add business areas and create events to see the ownership matrix.
      </div>`;
    }
    if (bas.length === 0) {
      return `<div style="color:var(--text-muted);font-size:13px;padding:20px 0">
        Add business areas on the left to build the ownership matrix.
      </div>`;
    }
    return `<div style="color:var(--text-muted);font-size:13px;padding:20px 0">
      <a href="#project/${projectId}" style="color:var(--primary)">Add events</a> to this project to see the ownership matrix.
    </div>`;
  },

  _renderMatrix(project, bas, events) {
    // Build set of (eventId, baId) pairs that are assigned
    const assigned = new Set();
    events.forEach(e => {
      (e.businessAreaIds || []).forEach(baId => assigned.add(`${e.id}|${baId}`));
    });

    return `
      <div class="ba-matrix-wrapper">
        <table class="ba-matrix">
          <thead>
            <tr>
              <th style="min-width:160px;text-align:left;padding:8px 10px;font-size:12px">Event</th>
              ${bas.map(ba => `
                <th style="padding:6px 10px;text-align:center;font-size:11px;max-width:80px">
                  <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
                    <span class="ba-color-dot" style="background:${ba.color || '#6b7280'}"></span>
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70px" title="${this._esc(ba.name)}">${this._esc(ba.name)}</span>
                  </div>
                </th>
              `).join('')}
              <th style="padding:6px 10px;font-size:11px;color:var(--text-muted)">Coverage</th>
            </tr>
          </thead>
          <tbody>
            ${events.map(e => {
              const grain = e.grain || 'transaction';
              const gi = GRAINS?.[grain] || { label: grain, color: '#6b7280', short: grain };
              const eventBaCount = (e.businessAreaIds || []).length;
              return `
                <tr>
                  <td style="padding:8px 10px;font-size:12px">
                    <a href="#event/${e.id}" style="font-weight:600;color:var(--text-primary);text-decoration:none">
                      ${this._esc(e.name)}
                    </a>
                    <span class="grain-badge" style="background:${gi.color}18;color:${gi.color};border:1px solid ${gi.color}40;margin-left:4px">${gi.short}</span>
                  </td>
                  ${bas.map(ba => {
                    const isAssigned = assigned.has(`${e.id}|${ba.id}`);
                    return `
                      <td style="text-align:center;padding:6px">
                        <button class="ba-toggle ${isAssigned ? 'ba-assigned' : ''}"
                          style="${isAssigned ? `background:${ba.color}20;border-color:${ba.color}` : ''}"
                          title="${isAssigned ? 'Remove' : 'Assign'} ${this._esc(ba.name)}"
                          onclick="BusinessAreas.toggleBA('${project.id}', '${e.id}', '${ba.id}')">
                          ${isAssigned ? `<span style="color:${ba.color}">✓</span>` : '<span style="color:var(--text-subtle)">·</span>'}
                        </button>
                      </td>
                    `;
                  }).join('')}
                  <td style="padding:6px 10px;font-size:11px;color:var(--text-muted)">
                    ${eventBaCount > 0
                      ? `<span style="color:var(--text-primary)">${eventBaCount}/${bas.length}</span>`
                      : `<span style="color:#b91c1c">Unassigned</span>`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-top:6px">
        Click a cell to toggle ownership. Changes are saved immediately.
      </p>
    `;
  },

  _renderCoverage(project, bas, events) {
    const unassignedEvents = events.filter(e => !(e.businessAreaIds || []).length);
    const unownedBAs = bas.filter(ba => !events.some(e => (e.businessAreaIds || []).includes(ba.id)));

    // BA load
    const baLoads = bas.map(ba => ({
      ...ba,
      count: events.filter(e => (e.businessAreaIds || []).includes(ba.id)).length
    })).sort((a, b) => b.count - a.count);

    return `
      <div style="margin-top:24px">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:12px">Coverage Summary</h3>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px">
            <div style="font-size:22px;font-weight:700;color:${unassignedEvents.length > 0 ? '#b91c1c' : '#166534'}">${events.length - unassignedEvents.length}/${events.length}</div>
            <div style="font-size:11px;color:var(--text-muted)">Events assigned</div>
          </div>
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px">
            <div style="font-size:22px;font-weight:700;color:${unownedBAs.length > 0 ? '#d97706' : '#166534'}">${bas.length - unownedBAs.length}/${bas.length}</div>
            <div style="font-size:11px;color:var(--text-muted)">BAs with events</div>
          </div>
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px">
            <div style="font-size:22px;font-weight:700;color:var(--text-primary)">${baLoads[0]?.count || 0}</div>
            <div style="font-size:11px;color:var(--text-muted)">Max events (${this._esc(baLoads[0]?.name || '—')})</div>
          </div>
        </div>

        <!-- BA event load bars -->
        <h4 style="font-size:13px;font-weight:600;margin-bottom:8px">Events per Business Area</h4>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
          ${baLoads.map(ba => {
            const pct = events.length ? Math.round(ba.count / events.length * 100) : 0;
            return `
              <div style="display:flex;align-items:center;gap:10px">
                <span class="ba-color-dot" style="background:${ba.color || '#6b7280'}"></span>
                <span style="font-size:12px;min-width:120px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._esc(ba.name)}</span>
                <div class="pl-coverage-bar" style="flex:1;height:8px;border-radius:4px">
                  <div class="pl-coverage-fill" style="width:${pct}%;background:${ba.color || 'var(--primary)'};border-radius:4px"></div>
                </div>
                <span style="font-size:11px;color:var(--text-muted);min-width:50px;text-align:right">${ba.count} event${ba.count !== 1 ? 's' : ''}</span>
              </div>
            `;
          }).join('')}
        </div>

        ${unassignedEvents.length > 0 ? `
          <div class="info-banner" style="border-left-color:#b91c1c">
            <strong>⚠ Unassigned Events (${unassignedEvents.length}):</strong>
            ${unassignedEvents.map(e => `<span style="font-weight:600">${this._esc(e.name)}</span>`).join(', ')}
            — assign at least one business area to each event.
          </div>
        ` : ''}

        ${unownedBAs.length > 0 ? `
          <div class="info-banner" style="border-left-color:#d97706;margin-top:8px">
            <strong>⚠ Inactive Business Areas (${unownedBAs.length}):</strong>
            ${unownedBAs.map(ba => `<span style="color:${ba.color};font-weight:600">${this._esc(ba.name)}</span>`).join(', ')}
            — not assigned to any event. Remove if no longer needed.
          </div>
        ` : ''}
      </div>
    `;
  },

  toggleBA(projectId, eventId, baId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event } = found;
    if (!event.businessAreaIds) event.businessAreaIds = [];
    const idx = event.businessAreaIds.indexOf(baId);
    if (idx === -1) {
      event.businessAreaIds.push(baId);
    } else {
      event.businessAreaIds.splice(idx, 1);
    }
    Storage.saveEvent(projectId, event);
    // Re-render
    BusinessAreas.render(projectId);
  },

  openAddBA(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const existingColors = (project.businessAreas || []).map(ba => ba.color);
    const nextColor = this.DEFAULT_COLORS.find(c => !existingColors.includes(c)) || this.DEFAULT_COLORS[0];

    Modal.show({
      title: 'Add Business Area',
      body: `
        <div class="form-group">
          <label class="form-label" for="baName">Name <span class="required">*</span></label>
          <input class="form-input" id="baName" type="text" placeholder="e.g. Finance, Sales, Operations" autofocus maxlength="60">
        </div>
        <div class="form-group">
          <label class="form-label">Colour</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="baColorPicker">
            ${this.DEFAULT_COLORS.map(c => `
              <button type="button" class="ba-color-btn" style="width:28px;height:28px;border-radius:50%;background:${c};border:3px solid ${c === nextColor ? '#fff' : c};box-shadow:${c === nextColor ? '0 0 0 2px ' + c : 'none'};cursor:pointer"
                data-color="${c}"
                onclick="BusinessAreas._selectColor(this, '${c}')"></button>
            `).join('')}
          </div>
          <input type="hidden" id="baColor" value="${nextColor}">
        </div>
      `,
      confirmLabel: 'Add Business Area',
      onConfirm() {
        const name = document.getElementById('baName').value.trim();
        const color = document.getElementById('baColor').value;
        if (!name) { Modal.shake(); return; }
        Storage.addBusinessArea(projectId, name, color);
        Modal.hide();
        BusinessAreas.render(projectId);
      }
    });
  },

  _selectColor(btn, color) {
    // Update hidden input
    document.getElementById('baColor').value = color;
    // Update button styles
    document.querySelectorAll('.ba-color-btn').forEach(b => {
      const c = b.dataset.color;
      b.style.border = `3px solid ${c}`;
      b.style.boxShadow = 'none';
    });
    btn.style.border = '3px solid #fff';
    btn.style.boxShadow = `0 0 0 2px ${color}`;
  },

  confirmDeleteBA(projectId, baId, name) {
    Modal.show({
      title: 'Delete Business Area',
      body: `<p>Remove <strong>${this._esc(name)}</strong>? This will also remove it from all events in this project.</p>`,
      confirmLabel: 'Delete',
      confirmDanger: true,
      onConfirm() {
        Storage.deleteBusinessArea(projectId, baId);
        Modal.hide();
        BusinessAreas.render(projectId);
      }
    });
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
