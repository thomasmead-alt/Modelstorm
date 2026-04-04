/* =========================================================
   sapmigration.js  –  SAP ECC → S/4HANA Migration Analyser
   ========================================================= */

const SapMigration = (() => {

  // ── Project Picker ──────────────────────────────────────────

  function renderProjectPicker() {
    const data  = Storage.load();
    const app   = document.getElementById('app');

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">SAP Migration Analyser</h1>
          <p class="view-subtitle">Track ECC→S/4HANA field migration status across your data models</p>
        </div>
      </div>

      ${data.projects.length === 0 ? `
        <div class="empty-state" style="max-width:520px">
          <h2 class="empty-title">No projects yet</h2>
          <p class="empty-desc">Create a project first, then return here to analyse SAP migration coverage.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
            <a href="#projects" class="btn btn-primary">Go to Projects</a>
            <button class="btn btn-secondary" onclick="loadSapExample()">Load SAP Example</button>
          </div>
        </div>
      ` : `
        <div class="card-grid">
          ${data.projects.map(p => {
            const allCols = p.events.flatMap(e => e.columns || []);
            const sapCols = allCols.filter(c => c.source === 'sap_ecc' || c.source === 'sap_s4');
            const tagged  = sapCols.filter(c => c.sapMigrationStatus && c.sapMigrationStatus !== '');
            const pct     = sapCols.length ? Math.round(tagged.length / sapCols.length * 100) : 0;
            return `
              <div class="card" onclick="Router.navigate('sap-migration/${p.id}')">
                <div class="card-body">
                  <h3 class="card-title">${esc(p.name)}</h3>
                  ${p.description ? `<p class="card-desc">${esc(p.description)}</p>` : ''}
                  <div style="margin-top:8px">
                    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-subtle);margin-bottom:4px">
                      <span>${sapCols.length} SAP column${sapCols.length !== 1 ? 's' : ''}</span>
                      <span>${pct}% tagged</span>
                    </div>
                    <div class="sap-coverage-bar"><div class="sap-coverage-fill" style="width:${pct}%"></div></div>
                  </div>
                </div>
                <div class="card-actions" onclick="event.stopPropagation()">
                  <button class="btn btn-ghost btn-sm" onclick="Router.navigate('sap-migration/${p.id}')">Analyse →</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  // ── Main View ───────────────────────────────────────────────

  function render(projectId) {
    const data    = Storage.load();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) { document.getElementById('app').innerHTML = '<p style="padding:32px">Project not found.</p>'; return; }

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div>
          <a href="#sap-migration" class="btn btn-ghost btn-sm" style="margin-bottom:6px">← All Projects</a>
          <h1 class="view-title">SAP Migration — ${esc(project.name)}</h1>
          <p class="view-subtitle">ECC→S/4HANA field coverage analysis</p>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:20px">
        <button class="btn btn-secondary sap-tab-btn active" id="tab-btn-dashboard"  onclick="SapMigration._showTab('dashboard')">Dashboard</button>
        <button class="btn btn-ghost sap-tab-btn"            id="tab-btn-fields"     onclick="SapMigration._showTab('fields')">Field Status</button>
        <button class="btn btn-ghost sap-tab-btn"            id="tab-btn-reference"  onclick="SapMigration._showTab('reference')">ECC→S/4 Reference</button>
      </div>

      <div id="sap-tab-dashboard">${_renderDashboard(project)}</div>
      <div id="sap-tab-fields"   style="display:none">${_renderFieldStatus(project)}</div>
      <div id="sap-tab-reference" style="display:none">${_renderReference()}</div>
    `;
  }

  function _showTab(name) {
    ['dashboard', 'fields', 'reference'].forEach(t => {
      const panel = document.getElementById(`sap-tab-${t}`);
      const btn   = document.getElementById(`tab-btn-${t}`);
      if (!panel || !btn) return;
      panel.style.display = t === name ? '' : 'none';
      btn.className = t === name ? 'btn btn-secondary sap-tab-btn active' : 'btn btn-ghost sap-tab-btn';
    });
  }

  // ── Dashboard Tab ───────────────────────────────────────────

  function _renderDashboard(project) {
    const allCols = project.events.flatMap(e => (e.columns || []).map(c => ({ ...c, _eventName: e.name })));
    const sapCols = allCols.filter(c => c.source === 'sap_ecc' || c.source === 'sap_s4');

    const counts = {};
    Object.keys(SAP_MIGRATION_STATUSES).forEach(k => counts[k] = 0);
    sapCols.forEach(c => {
      const k = c.sapMigrationStatus || '';
      if (counts[k] !== undefined) counts[k]++;
    });

    const tagged = sapCols.filter(c => c.sapMigrationStatus && c.sapMigrationStatus !== '').length;
    const pct    = sapCols.length ? Math.round(tagged / sapCols.length * 100) : 0;

    const statKeys = ['both', 's4_only', 'ecc_only', 'changed', 'deprecated'];

    const cards = statKeys.map(k => {
      const s = SAP_MIGRATION_STATUSES[k];
      return `
        <div class="sap-stat-card" style="border-top:3px solid ${s.color}">
          <div class="stat-value" style="color:${s.color}">${counts[k] || 0}</div>
          <div class="stat-label">${s.label}</div>
          <div style="font-size:10px;color:var(--text-subtle);margin-top:2px">${s.description}</div>
        </div>
      `;
    }).join('');

    const untagged = sapCols.length - tagged;

    const breakdown = project.events.map(e => {
      const eCols    = (e.columns || []).filter(c => c.source === 'sap_ecc' || c.source === 'sap_s4');
      if (!eCols.length) return '';
      const eTagged  = eCols.filter(c => c.sapMigrationStatus && c.sapMigrationStatus !== '').length;
      const ePct     = eCols.length ? Math.round(eTagged / eCols.length * 100) : 0;
      const statusBadges = statKeys.map(k => {
        const n = eCols.filter(c => c.sapMigrationStatus === k).length;
        if (!n) return '';
        const s = SAP_MIGRATION_STATUSES[k];
        return `<span class="sap-status-badge" style="background:${s.bg};color:${s.color}">${s.short} ${n}</span>`;
      }).join('');
      return `
        <tr>
          <td>${esc(e.name)}</td>
          <td>${eCols.length}</td>
          <td><div style="display:flex;gap:4px;flex-wrap:wrap">${statusBadges}</div></td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <div class="sap-coverage-bar" style="flex:1;max-width:80px"><div class="sap-coverage-fill" style="width:${ePct}%"></div></div>
              <span style="font-size:11px;color:var(--text-subtle)">${ePct}%</span>
            </div>
          </td>
        </tr>
      `;
    }).filter(Boolean).join('');

    return `
      <div class="sap-stat-cards">${cards}</div>

      <div class="card" style="margin-top:20px;padding:16px 20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:600">Overall Migration Coverage</div>
          <div style="font-size:13px;color:var(--text-subtle)">${tagged} / ${sapCols.length} SAP columns tagged</div>
        </div>
        <div class="sap-coverage-bar" style="height:12px">
          <div class="sap-coverage-fill" style="width:${pct}%;height:12px;border-radius:6px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-subtle);margin-top:4px">
          <span>${pct}% tagged</span>
          ${untagged > 0 ? `<span style="color:var(--warning)">${untagged} column${untagged !== 1 ? 's' : ''} still untagged</span>` : '<span style="color:var(--success)">All SAP columns tagged ✓</span>'}
        </div>
      </div>

      ${breakdown ? `
      <div class="card" style="margin-top:16px;padding:16px 20px">
        <div style="font-weight:600;margin-bottom:12px">Per-Event Breakdown</div>
        <div class="sap-event-breakdown">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="font-size:11px;color:var(--text-subtle);text-align:left">
                <th style="padding:4px 8px 8px 0">Event</th>
                <th style="padding:4px 8px 8px">SAP Columns</th>
                <th style="padding:4px 8px 8px">Status Breakdown</th>
                <th style="padding:4px 8px 8px">Coverage</th>
              </tr>
            </thead>
            <tbody>${breakdown}</tbody>
          </table>
        </div>
      </div>` : '<p style="color:var(--text-subtle);margin-top:16px">No SAP-sourced columns found in this project. Set column source to "SAP ECC" or "SAP S/4HANA" in the matrix to begin tracking.</p>'}
    `;
  }

  // ── Field Status Tab ────────────────────────────────────────

  function _renderFieldStatus(project) {
    const allCols = project.events.flatMap(e => (e.columns || []).map(c => ({ ...c, _eventName: e.name })));
    const sapCols = allCols.filter(c => c.source === 'sap_ecc' || c.source === 'sap_s4');

    if (!sapCols.length) return `<p style="color:var(--text-subtle);padding:16px 0">No SAP-sourced columns in this project.</p>`;

    const filters = ['', 'both', 's4_only', 'ecc_only', 'changed', 'deprecated'];

    const rows = sapCols.map(col => {
      const ms  = col.sapMigrationStatus || '';
      const s   = SAP_MIGRATION_STATUSES[ms] || SAP_MIGRATION_STATUSES[''];
      const src = SOURCES[col.source]?.label || col.source;
      const copa = col.category === 'how_many' ? (col.copaValueField || '') : (col.copaCharacteristic || '');
      return `
        <tr data-status="${ms}">
          <td style="padding:6px 8px;font-weight:500">${esc(col._eventName)}</td>
          <td style="padding:6px 8px">${esc(col.name)}</td>
          <td style="padding:6px 8px"><span style="font-size:11px;color:var(--text-subtle)">${esc(src)}</span></td>
          <td style="padding:6px 8px;font-family:monospace;font-size:12px">${esc(col.sapTable || '')}${col.sapField ? '.' + esc(col.sapField) : ''}</td>
          <td style="padding:6px 8px">
            <span class="sap-status-badge" style="background:${s.bg};color:${s.color}">${s.short || '—'}</span>
          </td>
          <td style="padding:6px 8px;font-family:monospace;font-size:12px;color:var(--text-subtle)">${esc(copa)}</td>
          <td style="padding:6px 8px;max-width:200px;font-size:12px;color:var(--text-subtle)">${esc(col.description || '')}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="sap-filter-bar" style="margin-bottom:12px">
        ${filters.map(k => {
          const s = SAP_MIGRATION_STATUSES[k];
          return `<button class="sap-filter-btn${k === '' ? ' active' : ''}"
            style="border-color:${k ? s.color : 'var(--border)'};${k ? `color:${s.color}` : ''}"
            data-filter="${k}"
            onclick="SapMigration._filterFields('${k}', this)"
          >${k ? s.label : 'All'}</button>`;
        }).join('')}
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <table id="sap-field-table" style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--bg-surface);font-size:11px;color:var(--text-subtle);text-align:left">
              <th style="padding:8px">Event</th>
              <th style="padding:8px">Column</th>
              <th style="padding:8px">Source</th>
              <th style="padding:8px">SAP Table.Field</th>
              <th style="padding:8px">Status</th>
              <th style="padding:8px">CO-PA Ref</th>
              <th style="padding:8px">Description</th>
            </tr>
          </thead>
          <tbody id="sap-field-tbody">${rows}</tbody>
        </table>
      </div>
    `;
  }

  function _filterFields(status, btn) {
    document.querySelectorAll('.sap-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const tbody = document.getElementById('sap-field-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(tr => {
      const match = !status || tr.dataset.status === status;
      tr.style.display = match ? '' : 'none';
    });
  }

  // ── ECC→S/4 Reference Tab ───────────────────────────────────

  function _renderReference() {
    const tableRows = (typeof ECC_TO_S4_TABLE_MAP !== 'undefined' ? ECC_TO_S4_TABLE_MAP : []).map(row => `
      <tr>
        <td class="ecc-col" style="padding:8px;font-family:monospace;font-weight:600">${esc(row.eccTable)}</td>
        <td class="s4-col"  style="padding:8px;font-family:monospace;font-weight:600">${esc(row.s4Table)}</td>
        <td style="padding:8px;font-size:12px;color:var(--text-subtle)">${esc(row.description)}</td>
        <td class="note-col" style="padding:8px;font-size:12px">${esc(row.note)}</td>
      </tr>
    `).join('');

    return `
      <div class="card" style="padding:20px;margin-bottom:16px">
        <h3 style="margin:0 0 4px;font-size:15px">Universal Journal — The Central Change</h3>
        <p style="margin:0;color:var(--text-subtle);font-size:13px">
          SAP S/4HANA introduces ACDOCA (the Universal Journal) as the single source of truth for all FI and CO postings.
          ECC maintained separate tables for each sub-ledger — BSEG (FI), COEP (CO), CE1XXXX (CO-PA), ANLP (FI-AA), MLHD/MLIT (ML).
          In S/4HANA all of these are written to a single wide table, eliminating reconciliation effort and enabling real-time reporting.
        </p>
        <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:180px;background:var(--bg-surface);border-radius:6px;padding:12px">
            <div style="font-size:11px;font-weight:600;color:#9a3412;margin-bottom:4px">ECC Architecture</div>
            <div style="font-size:12px;color:var(--text-subtle)">BSEG → COEP → CE1XXXX → ANLP → MLHD<br>Each sub-ledger has its own table with period-end reconciliation</div>
          </div>
          <div style="flex:1;min-width:180px;background:var(--bg-surface);border-radius:6px;padding:12px">
            <div style="font-size:11px;font-weight:600;color:#065f46;margin-bottom:4px">S/4HANA Architecture</div>
            <div style="font-size:12px;color:var(--text-subtle)">ACDOCA (Universal Journal)<br>Single source of truth — all postings in one wide table</div>
          </div>
          <div style="flex:1;min-width:180px;background:var(--bg-surface);border-radius:6px;padding:12px">
            <div style="font-size:11px;font-weight:600;color:#92400e;margin-bottom:4px">CO-PA Note</div>
            <div style="font-size:12px;color:var(--text-subtle)">Account-based CO-PA is now primary. Costing-based CO-PA (CE1XXXX value fields) is deprecated in SAP's roadmap.</div>
          </div>
        </div>
      </div>

      <div class="card" style="padding:20px">
        <h3 style="margin:0 0 12px;font-size:15px">ECC Table → S/4HANA Mapping</h3>
        <div class="sap-table-ref" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="font-size:11px;color:var(--text-subtle);text-align:left;background:var(--bg-surface)">
                <th class="ecc-col" style="padding:8px">ECC Table</th>
                <th class="s4-col"  style="padding:8px">S/4HANA Equivalent</th>
                <th style="padding:8px">Description</th>
                <th class="note-col" style="padding:8px">Migration Note</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>

      <div class="card" style="padding:20px;margin-top:16px">
        <h3 style="margin:0 0 12px;font-size:15px">Key S/4HANA Migration Considerations</h3>
        <ul style="margin:0;padding-left:20px;color:var(--text-subtle);font-size:13px;line-height:1.8">
          <li><strong>Business Partner (BP)</strong> — Customer (KNA1) and Vendor (LFA1) master records are replaced by the unified BP concept (BUT000). Custom extensions must be migrated to BP.</li>
          <li><strong>Material Ledger</strong> — Mandatory in S/4HANA. Actual costing is now the default. All material valuation documents are posted to ACDOCA.</li>
          <li><strong>Chart of Accounts</strong> — G/L accounts and CO cost elements are now unified. All primary cost elements must exist as G/L accounts (RACCT = HKONT).</li>
          <li><strong>Account-Based CO-PA</strong> — Primary in S/4HANA. Costing-based CO-PA can be operated in parallel but will be deprecated. Plan to migrate value fields to account-based equivalents.</li>
          <li><strong>New Asset Accounting</strong> — Parallel valuation areas are mandatory. Depreciation postings go directly to ACDOCA; old ANLP postings pattern no longer used.</li>
          <li><strong>Controlling Area Currency</strong> — Stored in ACDOCA.KSL (was COEP.WKGBTR). Field name changed; amounts may differ if transfer prices are activated.</li>
        </ul>
      </div>
    `;
  }

  // ── Public API ──────────────────────────────────────────────

  return { renderProjectPicker, render, _showTab, _filterFields };

})();
