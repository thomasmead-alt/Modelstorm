const SapFlow = {

  // ── Project Picker ────────────────────────────────────────

  renderProjectPicker() {
    const data = Storage.load();
    const app = document.getElementById('app');

    if (!data.projects.length) {
      app.innerHTML = `
        <div class="view-header">
          <div><h1 class="view-title">CO Flow</h1></div>
        </div>
        <div class="empty-state">
          <h2 class="empty-title">No projects yet</h2>
          <p class="empty-desc">Create a project and add cost objects first.</p>
          <button class="btn btn-primary" onclick="Router.navigate('projects')">Go to Projects</button>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">CO Flow</h1>
          <p class="view-subtitle">SAP Controlling flow — how responsibility objects absorb costs and flow to profitability</p>
        </div>
      </div>
      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>CO Flow Diagram</strong> — Shows how cost objects are structured: overhead cost centres assessed
        to production, service centres recharged, internal orders settled, and everything ultimately flowing to
        <strong>CO-PA (Profitability Analysis)</strong> at the top. Set cost centre sub-types and absorption
        methods in the <a href="#responsibility" style="color:var(--info)">Responsibility Register</a> to see the full flow.
      </div>
      <div class="project-picker">
        <h3 style="margin:0 0 12px">Select a project</h3>
        <div class="card-grid">
          ${data.projects.map(p => {
            const costObjects = p.costObjects || [];
            const classified = costObjects.filter(o => o.ccType || o.absorptionMethod).length;
            const events = p.events || [];
            const recharges = events.filter(e => e.ficoScope === 'recharge').length;
            return `
              <div class="card" style="cursor:pointer" onclick="Router.navigate('sap-flow/${p.id}')">
                <div class="card-body">
                  <h3 class="card-title">${this._esc(p.name)}</h3>
                  <div class="card-meta">
                    <span>${costObjects.length} cost object${costObjects.length !== 1 ? 's' : ''}</span>
                    <span>${classified} classified</span>
                    <span>${recharges} recharge event${recharges !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // ── Main render ───────────────────────────────────────────

  render(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('sap-flow'); return; }

    const app = document.getElementById('app');
    const flowData = this._buildFlowData(project);

    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#sap-flow">CO Flow</a>
          <span class="bc-sep">›</span>
          <span>${this._esc(project.name)}</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('responsibility/${project.id}')">Responsibility Register →</button>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('ficopatterns/${project.id}')">FI/CO Patterns →</button>
        </div>
      </div>

      <div class="info-banner" style="margin-bottom:16px">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>Reading the diagram:</strong> Profitability (CO-PA) sits at the top and absorbs everything.
        Arrows show the absorption flow: overhead CCs are <em>assessed</em> to production CCs, service CCs
        are <em>recharged</em> to consumers, and production CCs / profit centres / internal orders are
        <em>settled</em> up to CO-PA. Each box shows the cost object and events linked to it.
      </div>

      ${this._renderDiagram(flowData, project)}

      ${this._renderEventTable(project, flowData)}

      ${this._renderLegend()}
    `;
  },

  // ── Build structured flow data from project ───────────────

  _buildFlowData(project) {
    const costObjects = project.costObjects || [];
    const events = project.events || [];

    // Map event counts per cost object (any column ownerId reference)
    const eventsByOwner = {};
    events.forEach(ev => {
      const ownerIds = new Set((ev.columns || []).map(c => c.ownerId).filter(Boolean));
      ownerIds.forEach(oid => {
        if (!eventsByOwner[oid]) eventsByOwner[oid] = [];
        eventsByOwner[oid].push(ev);
      });
    });

    const classify = (type) => costObjects.filter(o => o.type === type);

    const costCentres = costObjects.filter(o => o.type === 'cost_centre');
    const ccByType = {
      overhead:    costCentres.filter(o => o.ccType === 'overhead'),
      production:  costCentres.filter(o => o.ccType === 'production'),
      service:     costCentres.filter(o => o.ccType === 'service'),
      admin:       costCentres.filter(o => o.ccType === 'admin'),
      unclassified: costCentres.filter(o => !o.ccType)
    };

    // Which columns in each event are real CO receivers vs statistical?
    const receiverRolesByEvent = {};
    events.forEach(ev => {
      const realReceivers  = (ev.columns || []).filter(c => c.coReceiverRole === 'real_receiver');
      const statistical    = (ev.columns || []).filter(c => c.coReceiverRole === 'statistical');
      receiverRolesByEvent[ev.id] = { realReceivers, statistical };
    });

    const rechargeLinks = events
      .filter(e => e.ficoScope === 'recharge' && e.rechargeFromId && e.rechargeToId)
      .map(e => ({ from: e.rechargeFromId, to: e.rechargeToId, eventName: e.name, eventId: e.id }));

    return {
      profitCentres:     classify('profit_centre'),
      internalOrders:    classify('internal_order'),
      wbsElements:       classify('wbs_element'),
      equipment:         classify('equipment'),
      functionalLocs:    classify('functional_location'),
      reBusinessEntities: classify('re_business_entity'),
      reBuildings:       classify('re_building'),
      reRentalUnits:     classify('re_rental_unit'),
      companyCodes:      classify('company_code'),
      controllingAreas:  classify('controlling_area'),
      ccByType,
      eventsByOwner,
      receiverRolesByEvent,
      rechargeLinks,
      project
    };
  },

  // ── Render the flow diagram ───────────────────────────────

  _renderDiagram(flowData, project) {
    const { ccByType, profitCentres, internalOrders, wbsElements, eventsByOwner, rechargeLinks } = flowData;

    const renderObj = (obj, borderColor) => {
      const evs = eventsByOwner[obj.id] || [];
      const ccTypeInfo = obj.ccType && typeof COST_CENTRE_TYPES !== 'undefined' ? COST_CENTRE_TYPES[obj.ccType] : null;
      const absInfo = obj.absorptionMethod && typeof ABSORPTION_METHODS !== 'undefined' ? ABSORPTION_METHODS[obj.absorptionMethod] : null;
      return `
        <div class="sap-flow-node" style="border-left-color:${borderColor}">
          <div class="sap-flow-node-id">${this._esc(obj.objectId)}</div>
          ${obj.description ? `<div class="sap-flow-node-desc">${this._esc(obj.description)}</div>` : ''}
          <div class="sap-flow-node-meta">
            ${ccTypeInfo ? `<span class="sap-flow-badge" style="background:${ccTypeInfo.bg};color:${ccTypeInfo.color}">${ccTypeInfo.label}</span>` : ''}
            ${absInfo ? `<span class="sap-flow-badge" style="background:#f3f4f6;color:#374151">${absInfo.label}</span>` : ''}
            ${evs.length ? `<span class="sap-flow-badge" style="background:#e0f2fe;color:#0369a1">${evs.length} event${evs.length > 1 ? 's' : ''}</span>` : ''}
          </div>
          ${rechargeLinks.filter(r => r.from === obj.id || r.to === obj.id).map(r => {
            const dir = r.from === obj.id ? '→ recharges to' : '← recharged from';
            const other = project.costObjects.find(o => o.id === (r.from === obj.id ? r.to : r.from));
            return `<div class="sap-flow-recharge-tag">↔ recharge: ${this._esc(r.eventName)}</div>`;
          }).join('')}
        </div>
      `;
    };

    const renderGroup = (label, objects, borderColor, arrowHint) => {
      if (!objects.length) return '';
      return `
        <div class="sap-flow-group">
          <div class="sap-flow-group-label">${label}</div>
          <div class="sap-flow-group-nodes">
            ${objects.map(o => renderObj(o, borderColor)).join('')}
          </div>
          ${arrowHint ? `<div class="sap-flow-arrow-hint">${arrowHint}</div>` : ''}
        </div>
      `;
    };

    const hasAnything = ccByType.overhead.length || ccByType.production.length ||
      ccByType.service.length || ccByType.admin.length || ccByType.unclassified.length ||
      profitCentres.length || internalOrders.length || wbsElements.length ||
      equipment.length || functionalLocs.length ||
      reBusinessEntities.length || reBuildings.length || reRentalUnits.length;

    if (!hasAnything) {
      return `
        <div class="empty-state" style="max-width:600px;margin:24px auto">
          <h2 class="empty-title">No cost objects registered</h2>
          <p class="empty-desc">Add SAP cost objects in the Responsibility Register and classify them (overhead, production, service, admin) to see the CO flow diagram.</p>
          <button class="btn btn-primary" onclick="Router.navigate('responsibility/${project.id}')">Go to Responsibility Register</button>
        </div>
      `;
    }

    return `
      <div class="sap-flow-container">

        <!-- Tier 1: CO-PA — the terminal absorber -->
        <div class="sap-flow-tier sap-flow-tier-copa">
          <div class="sap-flow-copa-bar">
            <div>
              <div class="sap-flow-copa-title">CO-PA — Profitability Analysis</div>
              <div class="sap-flow-copa-sub">Terminal absorber — all costs and revenues flow here</div>
            </div>
            <div class="sap-flow-copa-modules">
              <span class="sap-flow-badge" style="background:#dcfce7;color:#166534">CO-PA</span>
              <span class="sap-flow-badge" style="background:#dcfce7;color:#166534">ACDOCA / CE1XXXX</span>
            </div>
          </div>
        </div>

        <!-- Tier 2: Profit Centres — direct to CO-PA -->
        ${renderGroup('Profit Centres', profitCentres, '#065f46', '↑ direct to CO-PA')}

        <!-- Tier 3: Cost Centres by type -->
        ${ccByType.production.length ? `
        <div class="sap-flow-tier">
          <div class="sap-flow-tier-label">Production Cost Centres <span class="sap-flow-tier-hint">settle costs directly to CO-PA</span></div>
          <div class="sap-flow-tier-row">
            ${ccByType.production.map(o => renderObj(o, '#065f46')).join('')}
          </div>
          <div class="sap-flow-flow-arrow" style="color:#065f46">↑ settlement → CO-PA</div>
        </div>` : ''}

        ${ccByType.overhead.length ? `
        <div class="sap-flow-tier">
          <div class="sap-flow-tier-label">Overhead Cost Centres <span class="sap-flow-tier-hint">assessed / distributed to production or other receivers</span></div>
          <div class="sap-flow-tier-row">
            ${ccByType.overhead.map(o => renderObj(o, '#7c3aed')).join('')}
          </div>
          <div class="sap-flow-flow-arrow" style="color:#7c3aed">↓ assessment / distribution → production CCs</div>
        </div>` : ''}

        ${ccByType.service.length ? `
        <div class="sap-flow-tier">
          <div class="sap-flow-tier-label">Service Cost Centres <span class="sap-flow-tier-hint">recharged to consumers via activity allocation or intercompany</span></div>
          <div class="sap-flow-tier-row">
            ${ccByType.service.map(o => renderObj(o, '#0369a1')).join('')}
          </div>
          <div class="sap-flow-flow-arrow" style="color:#0369a1">↔ recharge → consuming entities</div>
        </div>` : ''}

        ${ccByType.admin.length ? `
        <div class="sap-flow-tier">
          <div class="sap-flow-tier-label">Admin Cost Centres <span class="sap-flow-tier-hint">distributed by percentage into group results</span></div>
          <div class="sap-flow-tier-row">
            ${ccByType.admin.map(o => renderObj(o, '#d97706')).join('')}
          </div>
          <div class="sap-flow-flow-arrow" style="color:#d97706">↑ distribution → overhead pool / CO-PA</div>
        </div>` : ''}

        ${ccByType.unclassified.length ? `
        <div class="sap-flow-tier">
          <div class="sap-flow-tier-label">Cost Centres — Unclassified <span class="sap-flow-tier-hint">set sub-type in Responsibility Register to show flow position</span></div>
          <div class="sap-flow-tier-row">
            ${ccByType.unclassified.map(o => renderObj(o, '#9ca3af')).join('')}
          </div>
        </div>` : ''}

        <!-- Tier 4: Orders / WBS settle to CCs or CO-PA -->
        ${(internalOrders.length || wbsElements.length) ? `
        <div class="sap-flow-tier">
          <div class="sap-flow-tier-label">Internal Orders &amp; WBS Elements <span class="sap-flow-tier-hint">settled to cost centres or directly to CO-PA (KO88 / CJ88)</span></div>
          <div class="sap-flow-tier-row">
            ${internalOrders.map(o => renderObj(o, '#7c3aed')).join('')}
            ${wbsElements.map(o => renderObj(o, '#c2410c')).join('')}
          </div>
          <div class="sap-flow-flow-arrow" style="color:#7c3aed">↑ settlement → cost centre or CO-PA</div>
        </div>` : ''}

        <!-- Tier 5: PM technical objects — Equipment and Functional Locations -->
        ${(equipment.length || functionalLocs.length) ? `
        <div class="sap-flow-tier">
          <div class="sap-flow-tier-label">PM Technical Objects <span class="sap-flow-tier-hint">Equipment (EQUI) and Functional Locations (FLOC) — maintenance orders settle to CC, IO, or WBS</span></div>
          <div class="sap-flow-tier-row">
            ${equipment.map(o => renderObj(o, '#0369a1')).join('')}
            ${functionalLocs.map(o => renderObj(o, '#4d7c0f')).join('')}
          </div>
          <div class="sap-flow-flow-arrow" style="color:#0369a1">↑ PM order settlement → CO receiver (CC / IO / WBS — depends on order type config)</div>
        </div>` : ''}

        <!-- Tier 6: RE-FX real estate objects -->
        ${(reBusinessEntities.length || reBuildings.length || reRentalUnits.length) ? `
        <div class="sap-flow-tier">
          <div class="sap-flow-tier-label">RE-FX Real Estate Objects <span class="sap-flow-tier-hint">postings generated by lease/rental agreements — flow to profit centre or CO-PA via FI</span></div>
          <div class="sap-flow-tier-row">
            ${reBusinessEntities.map(o => renderObj(o, '#0891b2')).join('')}
            ${reBuildings.map(o => renderObj(o, '#0891b2')).join('')}
            ${reRentalUnits.map(o => renderObj(o, '#0369a1')).join('')}
          </div>
          <div class="sap-flow-flow-arrow" style="color:#0891b2">↑ FI postings → profit centre / CO-PA</div>
        </div>` : ''}

      </div>
    `;
  },

  // ── Event attachment table ────────────────────────────────

  _renderEventTable(project, flowData) {
    const { eventsByOwner } = flowData;
    const archetypes = (typeof Storage !== 'undefined' && Storage.getAllArchetypes)
      ? Storage.getAllArchetypes(project) : [];

    const relevantEvents = (project.events || []).filter(e =>
      e.ficoScope || e.archetypeId || e.sapModule || (e.sapModules && e.sapModules.length) ||
      (e.columns || []).some(c => c.ownerId || c.coReceiverRole)
    );

    if (!relevantEvents.length) return '';

    const rows = relevantEvents.map(e => {
      const archetype = archetypes.find(a => a.id === e.archetypeId);
      const ownerCols = (e.columns || []).filter(c => c.ownerId || c.coReceiverRole);
      const realReceivers = ownerCols.filter(c => c.coReceiverRole === 'real_receiver').map(c => {
        const obj = (project.costObjects || []).find(o => o.id === c.ownerId);
        return `<span class="sap-flow-badge" style="background:#d1fae5;color:#065f46">${this._esc(c.name)}${obj ? ' → ' + this._esc(obj.objectId) : ''}</span>`;
      }).join(' ');
      const statistical = ownerCols.filter(c => c.coReceiverRole === 'statistical').map(c =>
        `<span class="sap-flow-badge" style="background:#f3e8ff;color:#7c3aed">${this._esc(c.name)} (stat)</span>`
      ).join(' ');
      const modules = (e.sapModules && e.sapModules.length ? e.sapModules : (e.sapModule ? [e.sapModule] : []));
      const scopeInfo = e.ficoScope && typeof FICO_SCOPES !== 'undefined' ? FICO_SCOPES[e.ficoScope] : null;
      const openGaps = (e.solutionGaps || []).filter(g => g.status === 'open' || g.status === 'designing').length;

      return `
        <tr onclick="Projects.renderEventDetail('${project.id}','${e.id}',null,null)" style="cursor:pointer">
          <td style="font-weight:600">${this._esc(e.name)}</td>
          <td>${scopeInfo ? `<span class="sap-flow-badge" style="background:${scopeInfo.bg};color:${scopeInfo.color}">${scopeInfo.label}</span>` : '—'}</td>
          <td>${archetype ? `<span style="font-size:11px">${this._esc(archetype.label)}</span>` : '—'}</td>
          <td>${modules.map(m => `<code style="font-size:10px;margin-right:3px">${this._esc(m)}</code>`).join('') || '—'}</td>
          <td style="font-size:11px;display:flex;flex-wrap:wrap;gap:3px">${realReceivers || statistical || '—'}</td>
          <td>${openGaps ? `<span class="additive-badge gap-open-badge">${openGaps} open</span>` : '—'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="margin-top:24px">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px">
          Events with FI/CO classification (${relevantEvents.length})
        </h3>
        <div style="overflow-x:auto">
          <table class="matrix-table" style="font-size:12px">
            <thead>
              <tr>
                <th>Event</th>
                <th>FI/CO Scope</th>
                <th>Archetype</th>
                <th>SAP Module</th>
                <th>Responsible Objects</th>
                <th>Open Gaps</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ── Legend ────────────────────────────────────────────────

  _renderLegend() {
    const ccTypes = typeof COST_CENTRE_TYPES !== 'undefined' ? COST_CENTRE_TYPES : {};
    const absMethods = typeof ABSORPTION_METHODS !== 'undefined' ? ABSORPTION_METHODS : {};
    const scopes = typeof FICO_SCOPES !== 'undefined' ? FICO_SCOPES : {};

    return `
      <div class="sap-flow-legend">
        <div class="sap-flow-legend-section">
          <div class="sap-flow-legend-title">Cost Centre Sub-types</div>
          ${Object.entries(ccTypes).map(([k, v]) => `
            <div class="sap-flow-legend-item">
              <span class="sap-flow-badge" style="background:${v.bg};color:${v.color}">${v.label}</span>
              <span>${v.description}</span>
            </div>`).join('')}
        </div>
        <div class="sap-flow-legend-section">
          <div class="sap-flow-legend-title">Absorption Methods</div>
          ${Object.entries(absMethods).map(([k, v]) => `
            <div class="sap-flow-legend-item">
              <span class="sap-flow-badge" style="background:#f3f4f6;color:#374151">${v.label}</span>
              <span>${v.description}</span>
            </div>`).join('')}
        </div>
        <div class="sap-flow-legend-section">
          <div class="sap-flow-legend-title">FI/CO Event Scope</div>
          ${Object.entries(scopes).map(([k, v]) => `
            <div class="sap-flow-legend-item">
              <span class="sap-flow-badge" style="background:${v.bg};color:${v.color}">${v.label}</span>
              <span>${v.description}</span>
            </div>`).join('')}
        </div>
      </div>
    `;
  },

  _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};
