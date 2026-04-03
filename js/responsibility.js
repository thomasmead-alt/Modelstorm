const Responsibility = {

  DEFAULT_COLORS: ['#4a6cf7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],

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
          <p class="empty-desc">Create a project first to define responsibility ownership.</p>
          <button class="btn btn-primary" onclick="Router.navigate('projects')">Go to Projects</button>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Responsibility Register</h1>
          <p class="view-subtitle">Assign owners to measures and map accountability to P&amp;L lines</p>
        </div>
      </div>
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>What is the Responsibility Register?</strong> The register lists the people or roles
        accountable for delivering each measure in the plan. Assign each <em>How-many</em> measure
        an owner, then use the Accountability Matrix to see how those owners map to P&amp;L lines.
      </div>
      <div class="project-picker">
        <h3 style="margin:0 0 12px">Select a project</h3>
        <div class="card-grid">
          ${data.projects.map(p => {
            const register = p.responsibilityRegister || [];
            const measures = p.events.flatMap(e => e.columns.filter(c => c.category === 'how_many'));
            const owned = measures.filter(c => c.ownerId).length;
            const total = measures.length;
            const pct = total ? Math.round(owned / total * 100) : 0;
            return `
              <div class="card" style="cursor:pointer" onclick="Router.navigate('responsibility/${p.id}')">
                <div class="card-body">
                  <h3 class="card-title">${this._esc(p.name)}</h3>
                  <div class="card-meta">
                    <span>${register.length} person${register.length !== 1 ? 's' : ''}</span>
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
          <a href="#project/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <span>Responsibility</span>
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
          onclick="Responsibility.render('${project.id}', 'register')">Register</button>
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
    const register = project.responsibilityRegister || [];
    const measures = project.events.flatMap(e => e.columns.filter(c => c.category === 'how_many'));

    const cards = register.map(r => {
      const ownedCount = measures.filter(m => m.ownerId === r.id).length;
      const typeInfo = (RESPONSIBILITY_TYPES && RESPONSIBILITY_TYPES[r.responsibilityType])
        || { label: '—', color: '#9ca3af' };
      return `
        <div class="resp-card card">
          <div class="resp-card-header card-body" style="padding-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
              <span class="ba-color-dot" style="background:${r.color || '#6b7280'};flex-shrink:0"></span>
              <div style="min-width:0">
                <div class="card-title" style="margin:0">${this._esc(r.name)}</div>
                ${r.role ? `<div class="card-meta" style="margin:2px 0 0">${this._esc(r.role)}</div>` : ''}
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" style="color:#ef4444;flex-shrink:0"
              onclick="Responsibility.confirmDeletePerson('${project.id}', '${r.id}', '${this._esc(r.name)}')"
              title="Delete person">✕</button>
          </div>
          <div class="card-body" style="padding-top:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px">
              <span class="additive-badge" style="background:${typeInfo.color}18;color:${typeInfo.color};border:1px solid ${typeInfo.color}40;padding:2px 7px;border-radius:10px;font-size:11px">
                ${this._esc(typeInfo.label)}
              </span>
              <span style="font-size:12px;color:var(--text-muted)">${ownedCount} measure${ownedCount !== 1 ? 's' : ''} owned</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="info-banner" style="margin-top:16px">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        The <strong>Responsibility Register</strong> lists the people or roles accountable for delivering
        each measure in the plan. Assign each <em>How-many</em> measure an owner. The
        <strong>Accountability Matrix</strong> tab shows how these align to P&amp;L lines.
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin:20px 0 12px">
        <h3 style="margin:0;font-size:14px;font-weight:600">
          Responsible Parties (${register.length})
        </h3>
        <button class="btn btn-primary btn-sm"
          onclick="Responsibility.openAddPerson('${project.id}')">+ Add person</button>
      </div>

      ${register.length === 0 ? `
        <div class="empty-state">
          <h2 class="empty-title">No responsible parties yet</h2>
          <p class="empty-desc">Add people or roles to the register, then assign them as owners of measures in the Accountability Matrix.</p>
          <button class="btn btn-primary" onclick="Responsibility.openAddPerson('${project.id}')">Add first person</button>
        </div>
      ` : `
        <div class="resp-register-grid card-grid">
          ${cards}
        </div>
      `}
    `;
  },

  // ── Accountability Matrix tab ─────────────────────────────

  _renderAccountability(project) {
    const plLines = Storage.getPlLines(project.id);
    const register = project.responsibilityRegister || [];

    // Only non-section, non-derived lines
    const dataLines = plLines.filter(l => l.type !== 'section' && l.type !== 'derived');

    // Get current plLines from project (may be customised) for ownerId state
    const projectPlLines = project.plLines || DEFAULT_PL_LINES;

    if (register.length === 0) {
      return `
        <div class="info-banner" style="margin-top:16px">
          <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
          <strong>Accountability Matrix</strong> — This matrix shows which responsible parties own which
          P&amp;L lines. Toggle cells to assign accountability. Lines with no owner are highlighted in red.
        </div>
        <div class="empty-state" style="margin-top:24px">
          <h2 class="empty-title">No people in the register</h2>
          <p class="empty-desc">Add people to the register first, then assign them to P&amp;L lines here.</p>
          <button class="btn btn-primary" onclick="Responsibility.render('${project.id}', 'register')">Go to Register</button>
        </div>
      `;
    }

    const headerCols = register.map(r => `
      <th style="padding:8px 10px;text-align:center;font-size:11px;font-weight:600;max-width:90px;vertical-align:bottom">
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          <span class="ba-color-dot" style="background:${r.color || '#6b7280'}"></span>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px" title="${this._esc(r.name)}">${this._esc(r.name)}</span>
        </div>
      </th>
    `).join('');

    const rows = dataLines.map(line => {
      const plLine = projectPlLines.find(l => l.id === line.id) || line;
      const hasOwner = !!plLine.ownerId;
      const indent = line.parentId ? 16 : 0;

      const cells = register.map(r => {
        const isAssigned = plLine.ownerId === r.id;
        return `
          <td style="text-align:center;padding:5px">
            <button class="acc-toggle ${isAssigned ? 'acc-assigned' : ''}"
              style="${isAssigned ? `background:${r.color}20;border-color:${r.color}` : ''}"
              title="${isAssigned ? 'Remove' : 'Assign'} ${this._esc(r.name)}"
              onclick="Responsibility._togglePlLineOwner('${project.id}', '${line.id}', '${r.id}')">
              ${isAssigned ? `<span style="color:${r.color}">✓</span>` : '<span style="color:var(--text-subtle)">·</span>'}
            </button>
          </td>
        `;
      }).join('');

      return `
        <tr style="${!hasOwner ? 'background:rgba(185,28,28,0.04)' : ''}">
          <td class="acc-line-name" style="padding:8px 10px;font-size:12px;padding-left:${10 + indent}px;${!hasOwner ? 'color:#b91c1c;font-weight:500' : ''}">
            ${this._esc(line.name)}
          </td>
          ${cells}
          <td style="padding:6px 10px;font-size:11px;white-space:nowrap">
            ${hasOwner
              ? `<span style="color:#166534" class="ba-assigned">Assigned</span>`
              : `<span style="color:#b91c1c">Unassigned</span>`}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="info-banner" style="margin-top:16px">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>Accountability Matrix</strong> — This matrix shows which responsible parties own which
        P&amp;L lines. Toggle cells to assign accountability. Lines with no owner are highlighted in red.
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

  // ── Gap analysis view ─────────────────────────────────────

  renderGaps(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('responsibility'); return; }

    const plLines = Storage.getPlLines(projectId);
    const register = project.responsibilityRegister || [];
    const projectPlLines = project.plLines || DEFAULT_PL_LINES;

    // All how_many measures across all events
    const allMeasures = project.events.flatMap(e =>
      e.columns.filter(c => c.category === 'how_many').map(c => ({
        ...c, _eventId: e.id, _eventName: e.name
      }))
    );

    const total = allMeasures.length;
    const owned = allMeasures.filter(m => m.ownerId).length;
    const unowned = total - owned;
    const pct = total ? Math.round(owned / total * 100) : 0;

    // Unowned measures grouped by event
    const unownedByEvent = {};
    allMeasures.filter(m => !m.ownerId).forEach(m => {
      if (!unownedByEvent[m._eventId]) {
        unownedByEvent[m._eventId] = { name: m._eventName, measures: [] };
      }
      unownedByEvent[m._eventId].measures.push(m);
    });

    // P&L lines without an owner that have at least one measure mapped to them
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
          <a href="#project/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <a href="#responsibility/${project.id}">Responsibility</a>
          <span class="bc-sep">›</span>
          <span>Gap Analysis</span>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">Responsibility Gap Analysis</h1>
        <p class="view-subtitle">${this._esc(project.name)}</p>
      </div>

      <!-- Stat cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
        ${this._statCard('Total Measures', total, '#374151')}
        ${this._statCard('Owned', owned, owned === total ? '#166534' : '#374151')}
        ${this._statCard('Unowned', unowned, unowned > 0 ? '#b91c1c' : '#166534')}
        ${this._statCard('Coverage', pct + '%', pct === 100 ? '#166534' : pct > 50 ? '#92400e' : '#b91c1c')}
      </div>

      <!-- Red: Unowned Measures -->
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

      <!-- Amber: P&L Lines without an owner -->
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
            to assign owners to these lines.
          </p>
        `}
      </div>

      <!-- Green: Org Cascade -->
      <div>
        <h3 style="font-size:14px;font-weight:600;color:#166534;margin-bottom:12px">
          Org Cascade
        </h3>
        ${this._orgCascade(project, allMeasures)}
      </div>
    `;
  },

  // ── Add person modal ──────────────────────────────────────

  openAddPerson(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const existingColors = (project.responsibilityRegister || []).map(r => r.color);
    const nextColor = this.DEFAULT_COLORS.find(c => !existingColors.includes(c)) || this.DEFAULT_COLORS[0];

    const typeOptions = Object.entries(RESPONSIBILITY_TYPES).map(([key, val]) =>
      `<option value="${key}">${this._esc(val.label)}</option>`
    ).join('');

    Modal.show({
      title: 'Add Person / Role',
      body: `
        <div class="form-group">
          <label class="form-label" for="respName">Name <span class="required">*</span></label>
          <input class="form-input" id="respName" type="text" placeholder="e.g. Jane Smith" autofocus maxlength="80">
        </div>
        <div class="form-group">
          <label class="form-label" for="respRole">Role <span style="color:var(--text-muted)">(optional)</span></label>
          <input class="form-input" id="respRole" type="text" placeholder="e.g. Regional Director" maxlength="80">
        </div>
        <div class="form-group">
          <label class="form-label" for="respType">Responsibility Type</label>
          <select class="form-input" id="respType">
            ${typeOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Colour</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="respColorPicker">
            ${this.DEFAULT_COLORS.map(c => `
              <button type="button" class="resp-color-btn"
                style="width:28px;height:28px;border-radius:50%;background:${c};border:3px solid ${c === nextColor ? '#fff' : c};box-shadow:${c === nextColor ? '0 0 0 2px ' + c : 'none'};cursor:pointer"
                data-color="${c}"
                onclick="Responsibility._selectColor(this, '${c}')"></button>
            `).join('')}
          </div>
          <input type="hidden" id="respColor" value="${nextColor}">
        </div>
      `,
      confirmLabel: 'Add Person',
      onConfirm() {
        const name = document.getElementById('respName').value.trim();
        const role = document.getElementById('respRole').value.trim();
        const color = document.getElementById('respColor').value;
        const respType = document.getElementById('respType').value;
        if (!name) { Modal.shake(); return; }
        Storage.addResponsibleParty(projectId, name, role, color, respType);
        Modal.hide();
        Responsibility.render(projectId, 'register');
      }
    });
  },

  _selectColor(btn, color) {
    document.getElementById('respColor').value = color;
    document.querySelectorAll('.resp-color-btn').forEach(b => {
      const c = b.dataset.color;
      b.style.border = `3px solid ${c}`;
      b.style.boxShadow = 'none';
    });
    btn.style.border = '3px solid #fff';
    btn.style.boxShadow = `0 0 0 2px ${color}`;
  },

  // ── Delete person modal ───────────────────────────────────

  confirmDeletePerson(projectId, personId, name) {
    Modal.show({
      title: 'Remove from Register',
      body: `<p>Remove <strong>${this._esc(name)}</strong> from the register? This will remove them as owner from all assigned measures.</p>`,
      confirmLabel: 'Remove',
      confirmDanger: true,
      onConfirm() {
        Storage.deleteResponsibleParty(projectId, personId);
        Modal.hide();
        Responsibility.render(projectId, 'register');
      }
    });
  },

  // ── Toggle P&L line owner ─────────────────────────────────

  _togglePlLineOwner(projectId, plLineId, personId) {
    const data = Storage.load();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return;

    // Copy DEFAULT_PL_LINES into project if not yet customised
    if (!project.plLines) {
      project.plLines = JSON.parse(JSON.stringify(
        typeof DEFAULT_PL_LINES !== 'undefined' ? DEFAULT_PL_LINES : []
      ));
    }

    const line = project.plLines.find(l => l.id === plLineId);
    if (!line) return;

    // Toggle: same person → clear; different or empty → set
    if (line.ownerId === personId) {
      line.ownerId = '';
    } else {
      line.ownerId = personId;
    }

    Storage.save(data);

    // Re-render accountability tab only (re-read fresh project)
    const freshProject = Storage.getProject(projectId);
    const tabContent = document.getElementById('tab-content');
    if (tabContent && freshProject) {
      tabContent.innerHTML = this._renderAccountability(freshProject);
    }
  },

  // ── Org cascade HTML ──────────────────────────────────────

  _orgCascade(project, allMeasures) {
    const register = project.responsibilityRegister || [];
    // If called from render context without allMeasures, compute them
    if (!allMeasures) {
      allMeasures = project.events.flatMap(e =>
        e.columns.filter(c => c.category === 'how_many').map(c => ({ ...c, _eventId: e.id }))
      );
    }

    const levels = ['budget_holder', 'cost_centre', 'profit_centre', 'org_hierarchy'];
    const levelNames = {
      budget_holder:  'Budget Holders',
      cost_centre:    'Cost Centres',
      profit_centre:  'Profit Centres',
      org_hierarchy:  'Org Hierarchy'
    };
    const levelColors = {
      budget_holder:  '#059669',
      cost_centre:    '#7c3aed',
      profit_centre:  '#0891b2',
      org_hierarchy:  '#d97706'
    };

    const sections = levels.map((level, idx) => {
      const people = register.filter(r => r.responsibilityType === level);
      const color = levelColors[level];

      const peopleHtml = people.length === 0
        ? `<span style="color:var(--text-muted);font-size:12px;font-style:italic">none defined</span>`
        : people.map(r => {
            const count = allMeasures.filter(m => m.ownerId === r.id).length;
            return `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
                <span class="ba-color-dot" style="background:${r.color || '#6b7280'}"></span>
                <span style="font-size:13px;font-weight:500">${this._esc(r.name)}</span>
                ${r.role ? `<span style="font-size:11px;color:var(--text-muted)">${this._esc(r.role)}</span>` : ''}
                <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${count} measure${count !== 1 ? 's' : ''}</span>
              </div>
            `;
          }).join('');

      const arrow = idx < levels.length - 1
        ? `<div class="cascade-arrow" style="text-align:center;font-size:18px;color:var(--text-muted);padding:4px 0">↓</div>`
        : '';

      return `
        <div class="cascade-section" style="border-left:3px solid ${color};padding:10px 14px;background:${color}08;border-radius:0 8px 8px 0;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.04em">${levelNames[level]}</span>
            <span style="font-size:11px;color:var(--text-muted)">(${people.length})</span>
          </div>
          ${peopleHtml}
        </div>
        ${arrow}
      `;
    }).join('');

    return `<div style="max-width:560px">${sections}</div>`;
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
