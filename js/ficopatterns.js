/* =========================================================
   ficopatterns.js  –  FI/CO event patterns:
     • Archetypes (group events by FI/CO process pattern)
     • Similar events (overlap detection within an archetype)
     • Gaps register (cross-event view of solutionGaps[])
   ========================================================= */

const FiCoPatterns = (() => {

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Project picker ──────────────────────────────────────────

  function renderProjectPicker() {
    const data = Storage.load();
    const app  = document.getElementById('app');

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">FI/CO Patterns</h1>
          <p class="view-subtitle">Group events by SAP FI/CO archetype, spot duplicates, track where standard SAP falls short</p>
        </div>
      </div>

      ${data.projects.length === 0 ? `
        <div class="empty-state" style="max-width:520px">
          <h2 class="empty-title">No projects yet</h2>
          <p class="empty-desc">Create a project first, then return here to classify its events.</p>
          <a href="#projects" class="btn btn-primary">Go to Projects</a>
        </div>
      ` : `
        <div class="info-banner">
          <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
          <strong>What is this?</strong> Each event in a project can be tagged with an SAP FI/CO
          <strong>archetype</strong> (billing, assessment, settlement, accrual, depreciation run…).
          That tag drives three views here: a grouping by archetype, a similar-event detector that
          flags potential duplicates, and a register of <strong>solution gaps</strong> — places
          where standard SAP doesn't deliver and a workaround or custom development is needed.
        </div>
        <div class="card-grid">
          ${data.projects.map(p => {
            const evCount   = (p.events || []).length;
            const tagged    = (p.events || []).filter(e => e.archetypeId).length;
            const gapCount  = (p.events || []).reduce((n, e) => n + (e.solutionGaps || []).length, 0);
            const openGaps  = (p.events || []).reduce((n, e) => n + (e.solutionGaps || []).filter(g => g.status === 'open' || g.status === 'designing').length, 0);
            const pct       = evCount ? Math.round(tagged / evCount * 100) : 0;
            return `
              <div class="card" style="cursor:pointer" onclick="Router.navigate('ficopatterns/${p.id}')">
                <div class="card-body">
                  <h3 class="card-title">${esc(p.name)}</h3>
                  ${p.description ? `<p class="card-desc">${esc(p.description)}</p>` : ''}
                  <div style="margin-top:8px">
                    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-subtle);margin-bottom:4px">
                      <span>${evCount} event${evCount !== 1 ? 's' : ''} · ${tagged} classified</span>
                      <span>${pct}%</span>
                    </div>
                    <div class="sap-coverage-bar"><div class="sap-coverage-fill" style="width:${pct}%"></div></div>
                  </div>
                  <div style="margin-top:8px;font-size:11px;color:var(--text-subtle)">
                    ${gapCount} solution gap${gapCount !== 1 ? 's' : ''}
                    ${openGaps > 0 ? `<span class="additive-badge gap-open-badge" style="margin-left:6px">${openGaps} open</span>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  // ── Project view (3 tabs) ───────────────────────────────────

  function render(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('ficopatterns'); return; }

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#ficopatterns">FI/CO Patterns</a>
          <span class="bc-sep">›</span>
          <span>${esc(project.name)}</span>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">${esc(project.name)} — FI/CO Patterns</h1>
        <p class="view-subtitle">Archetypes · Similar events · Gaps register</p>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:20px">
        <button class="btn btn-secondary fico-tab-btn active" id="fico-tab-btn-archetypes" onclick="FiCoPatterns._showTab('${project.id}','archetypes')">Archetypes</button>
        <button class="btn btn-ghost fico-tab-btn"             id="fico-tab-btn-similar"    onclick="FiCoPatterns._showTab('${project.id}','similar')">Similar events</button>
        <button class="btn btn-ghost fico-tab-btn"             id="fico-tab-btn-gaps"       onclick="FiCoPatterns._showTab('${project.id}','gaps')">Gaps register</button>
      </div>

      <div id="fico-tab-archetypes">${_renderArchetypes(project)}</div>
      <div id="fico-tab-similar"    style="display:none">${_renderSimilar(project)}</div>
      <div id="fico-tab-gaps"       style="display:none">${_renderGaps(project)}</div>
    `;
  }

  function _showTab(projectId, name) {
    ['archetypes', 'similar', 'gaps'].forEach(t => {
      const panel = document.getElementById(`fico-tab-${t}`);
      const btn   = document.getElementById(`fico-tab-btn-${t}`);
      if (!panel || !btn) return;
      panel.style.display = t === name ? '' : 'none';
      btn.classList.toggle('active', t === name);
      btn.classList.toggle('btn-secondary', t === name);
      btn.classList.toggle('btn-ghost',    t !== name);
    });
  }

  // ── Tab 1: Archetypes ───────────────────────────────────────

  function _renderArchetypes(project) {
    const archetypes = Storage.getAllArchetypes(project);
    const events     = project.events || [];

    // Group events by archetype id (plus an 'unclassified' bucket)
    const groups = new Map();
    archetypes.forEach(a => groups.set(a.id, []));
    groups.set('__unclassified', []);
    events.forEach(e => {
      const key = e.archetypeId && groups.has(e.archetypeId) ? e.archetypeId : '__unclassified';
      groups.get(key).push(e);
    });

    const archetypeCard = (a) => {
      const list = groups.get(a.id) || [];
      const swatch = a.color || '#94a3b8';
      return `
        <div class="card archetype-card" style="border-left:4px solid ${swatch}">
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div>
                <h3 class="card-title" style="margin:0">${esc(a.label)}</h3>
                <div style="font-size:11px;color:var(--text-subtle);margin-top:2px">
                  ${a.module ? `<strong>${esc(a.module)}</strong> · ` : ''}
                  ${a.typicalDocType ? `Doc <code>${esc(a.typicalDocType)}</code> · ` : ''}
                  ${list.length} event${list.length !== 1 ? 's' : ''}
                  ${a.isCustom ? ' · <em>custom</em>' : ''}
                </div>
              </div>
              ${a.isCustom ? `
                <button class="btn-icon" title="Delete custom archetype" style="color:var(--danger)"
                  onclick="FiCoPatterns._deleteCustomArchetype('${project.id}', '${a.id}')">✕</button>
              ` : ''}
            </div>
            ${a.description ? `<p class="card-desc" style="margin-top:6px">${esc(a.description)}</p>` : ''}
            ${a.typicalTables ? `<div style="font-size:11px;color:var(--text-subtle);margin-top:4px"><em>Typical tables:</em> <code>${esc(a.typicalTables)}</code></div>` : ''}
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
              ${list.length === 0 ? `<span style="font-size:11px;color:var(--text-subtle)">No events tagged with this archetype.</span>` : list.map(e => `
                <a href="#event/${e.id}" style="font-size:12px;color:var(--info);text-decoration:none">
                  → ${esc(e.name)} <span style="color:var(--text-subtle)">(${esc(e.grain || 'transaction')}, ${(e.columns || []).length} col${(e.columns || []).length !== 1 ? 's' : ''})</span>
                </a>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    };

    const unclassified = groups.get('__unclassified') || [];
    const unclassifiedCard = `
      <div class="card archetype-card" style="border-left:4px solid #cbd5e1">
        <div class="card-body">
          <h3 class="card-title" style="margin:0">Unclassified</h3>
          <div style="font-size:11px;color:var(--text-subtle);margin-top:2px">${unclassified.length} event${unclassified.length !== 1 ? 's' : ''} without an archetype</div>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
            ${unclassified.length === 0 ? `<span style="font-size:11px;color:var(--text-subtle)">All events classified — nice.</span>` : unclassified.map(e => `
              <a href="#event/${e.id}" style="font-size:12px;color:var(--info);text-decoration:none">
                → ${esc(e.name)} <span style="color:var(--text-subtle)">(${esc(e.grain || 'transaction')})</span>
              </a>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px;flex-wrap:wrap">
        <div style="font-size:12px;color:var(--text-subtle)">
          ${archetypes.length} archetype${archetypes.length !== 1 ? 's' : ''}
          (${archetypes.filter(a => !a.isCustom).length} built-in, ${archetypes.filter(a => a.isCustom).length} custom) ·
          ${events.length} event${events.length !== 1 ? 's' : ''} ·
          ${unclassified.length} unclassified
        </div>
        <button class="btn btn-primary btn-sm" onclick="FiCoPatterns._addCustomArchetype('${project.id}')">+ Add custom archetype</button>
      </div>
      <div class="card-grid">
        ${archetypes.map(archetypeCard).join('')}
        ${unclassifiedCard}
      </div>
    `;
  }

  function _addCustomArchetype(projectId) {
    const label = prompt('Custom archetype label (e.g. "Intercompany cost recharge"):');
    if (!label) return;
    const module = prompt('SAP module (FI, CO-OM, CO-PA, …) — leave blank if none:') || '';
    const description = prompt('Short description:') || '';
    Storage.addCustomArchetype(projectId, { label: label.trim(), module: module.trim(), description: description.trim() });
    render(projectId);
  }

  function _deleteCustomArchetype(projectId, archetypeId) {
    const result = Storage.deleteCustomArchetype(projectId, archetypeId);
    if (!result.ok) {
      if (result.reason === 'in_use') {
        const names = result.usedBy.map(e => '• ' + e.name).join('\n');
        alert('Cannot delete — this archetype is still used by:\n\n' + names + '\n\nReassign those events first.');
      } else {
        alert('Could not delete archetype.');
      }
      return;
    }
    render(projectId);
  }

  // ── Tab 2: Similar events ───────────────────────────────────

  // For each archetype with ≥2 events, cluster events whose grain matches and
  // whose column-name overlap (Jaccard) ≥ 0.5. Surface as candidate duplicates.
  function _renderSimilar(project) {
    const archetypes = Storage.getAllArchetypes(project);
    const events     = project.events || [];

    const colNames = (e) => new Set((e.columns || []).map(c => (c.name || '').toLowerCase().trim()).filter(Boolean));
    const overlap  = (a, b) => {
      if (!a.size || !b.size) return 0;
      let inter = 0;
      a.forEach(n => { if (b.has(n)) inter++; });
      const union = a.size + b.size - inter;
      return union ? inter / union : 0;
    };

    const clusters = [];
    archetypes.forEach(a => {
      const inGroup = events.filter(e => e.archetypeId === a.id);
      if (inGroup.length < 2) return;
      const used = new Set();
      for (let i = 0; i < inGroup.length; i++) {
        if (used.has(inGroup[i].id)) continue;
        const seed = inGroup[i];
        const seedCols = colNames(seed);
        const matches = [seed];
        for (let j = i + 1; j < inGroup.length; j++) {
          const other = inGroup[j];
          if (other.grain !== seed.grain) continue;
          const sim = overlap(seedCols, colNames(other));
          if (sim >= 0.5) {
            matches.push(other);
            used.add(other.id);
          }
        }
        if (matches.length >= 2) {
          clusters.push({ archetype: a, members: matches });
        }
      }
    });

    if (clusters.length === 0) {
      return `
        <div class="empty-state" style="max-width:520px">
          <h2 class="empty-title">No similar events detected</h2>
          <p class="empty-desc">A cluster needs ≥2 events sharing the same archetype, the same grain
          and ≥50% column-name overlap. Tag more events with archetypes (or add columns) to surface
          potential duplicates.</p>
        </div>
      `;
    }

    return `
      <div style="font-size:12px;color:var(--text-subtle);margin-bottom:12px">
        Heuristic: same archetype + same grain + ≥50% column-name overlap (Jaccard).
        Use this to merge duplicates, promote the winner, or distinguish the events with
        a clearer name / archetype.
      </div>
      ${clusters.map(c => `
        <div class="card" style="margin-bottom:12px;border-left:4px solid ${c.archetype.color || '#94a3b8'}">
          <div class="card-body">
            <h3 class="card-title" style="margin:0 0 4px">${esc(c.archetype.label)} — ${c.members.length} similar events</h3>
            <div style="font-size:11px;color:var(--text-subtle);margin-bottom:8px">
              Grain: <strong>${esc(c.members[0].grain || 'transaction')}</strong>
              ${c.archetype.module ? ` · Module: <strong>${esc(c.archetype.module)}</strong>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${c.members.map(e => {
                const measureCount = (e.columns || []).filter(c => c.category === 'how_many').length;
                const dimCount     = (e.columns || []).filter(c => c.category !== 'how_many').length;
                return `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--bg-alt);border-radius:6px">
                    <div>
                      <a href="#event/${e.id}" style="font-size:13px;color:var(--info);text-decoration:none;font-weight:500">${esc(e.name)}</a>
                      <div style="font-size:11px;color:var(--text-subtle);margin-top:2px">
                        ${dimCount} dim${dimCount !== 1 ? 's' : ''} · ${measureCount} measure${measureCount !== 1 ? 's' : ''}
                        ${e.sapModule ? ` · ${esc(e.sapModule)}` : ''}
                        ${e.sapProcess ? ` · ${esc(e.sapProcess)}` : ''}
                      </div>
                    </div>
                    <a href="#event/${e.id}" class="btn btn-ghost btn-sm">Open →</a>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    `;
  }

  // ── Tab 3: Gaps register ────────────────────────────────────

  function _renderGaps(project) {
    const events = project.events || [];
    const rows = [];
    events.forEach(e => {
      (e.solutionGaps || []).forEach(g => rows.push({ event: e, gap: g }));
    });

    if (rows.length === 0) {
      return `
        <div class="empty-state" style="max-width:520px">
          <h2 class="empty-title">No solution gaps recorded</h2>
          <p class="empty-desc">Add gaps from the event metadata panel to flag where standard SAP
          doesn't deliver — missing CO-PA characteristics, BADI/BTE requirements, custom developments,
          performance workarounds, etc. They'll appear here as a cross-event register.</p>
        </div>
      `;
    }

    const kindDict   = (typeof GAP_KINDS    !== 'undefined') ? GAP_KINDS    : {};
    const statusDict = (typeof GAP_STATUSES !== 'undefined') ? GAP_STATUSES : {};

    // Counts for filter chips
    const byStatus = {};
    Object.keys(statusDict).forEach(k => byStatus[k] = 0);
    rows.forEach(r => { byStatus[r.gap.status] = (byStatus[r.gap.status] || 0) + 1; });

    return `
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;font-size:11px">
        <span style="color:var(--text-subtle);margin-right:6px">${rows.length} gap${rows.length !== 1 ? 's' : ''} —</span>
        ${Object.entries(statusDict).map(([k, v]) => byStatus[k] > 0
          ? `<span class="additive-badge" style="background:${v.bg};color:${v.color}">${v.label}: ${byStatus[k]}</span>`
          : '').join('')}
      </div>
      <div class="matrix-wrapper">
        <table class="matrix-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Module</th>
              <th>Kind</th>
              <th>SAP object</th>
              <th>Current workaround</th>
              <th>Target solution</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(({ event, gap }) => {
              const k = kindDict[gap.kind]   || { label: gap.kind,   color: '#475569', bg: '#f1f5f9' };
              const s = statusDict[gap.status] || { label: gap.status, color: '#475569', bg: '#f1f5f9' };
              return `
                <tr>
                  <td><a href="#event/${event.id}" style="color:var(--info);text-decoration:none">${esc(event.name)}</a></td>
                  <td style="font-size:12px">${esc(event.sapModule || '—')}</td>
                  <td><span class="additive-badge" style="background:${k.bg};color:${k.color}">${esc(k.label)}</span></td>
                  <td style="font-size:12px">${esc(gap.sapObject || '')}</td>
                  <td style="font-size:12px;color:var(--text-muted)">${esc(gap.currentWorkaround || '')}</td>
                  <td style="font-size:12px;color:var(--text-muted)">${esc(gap.targetSolution || '')}</td>
                  <td><span class="additive-badge" style="background:${s.bg};color:${s.color}">${esc(s.label)}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Public API ──────────────────────────────────────────────

  return {
    renderProjectPicker,
    render,
    _showTab,
    _addCustomArchetype,
    _deleteCustomArchetype
  };

})();
