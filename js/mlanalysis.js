// ─── MLAnalysis module ────────────────────────────────────────────────────────
// ML_TAGS and ML_PATTERNS are defined as globals in index.html
const MLAnalysis = {

  // ── Project picker ──────────────────────────────────────────────────────────
  renderProjectPicker() {
    const data = Storage.load();
    const app = document.getElementById('app');

    if (!data.projects.length) {
      app.innerHTML = `
        <div class="view-header">
          <div>
            <h1 class="view-title">ML Opportunities</h1>
            <p class="view-subtitle">Detect machine learning opportunities in your data models</p>
          </div>
        </div>
        <div class="empty-state">
          <h2 class="empty-title">No projects yet</h2>
          <p class="empty-desc">Create a project with events and measures to detect ML opportunities.</p>
          <button class="btn btn-primary" onclick="Router.navigate('projects')">Go to Projects</button>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">ML Opportunities</h1>
          <p class="view-subtitle">Detect machine learning opportunities in your data models</p>
        </div>
      </div>
      <div class="card-grid">
        ${data.projects.map(p => {
          const measures = [];
          (p.events || []).forEach(e =>
            (e.columns || []).forEach(col => {
              if (col.category === 'how_many') measures.push({ col, event: e });
            })
          );
          const taggedCount = measures.filter(({ col }) => col.mlTag && col.mlTag !== 'none').length;
          const patterns = this._detectAllPatterns(p);
          const patternCount = patterns.length;

          return `
            <div class="card" style="cursor:pointer"
                 onclick="Router.navigate('ml-opportunities/${p.id}')">
              <div class="card-body">
                <h3 class="card-title">${this._esc(p.name)}</h3>
                <div style="margin-top:8px;font-size:12px;color:var(--text-muted)">
                  ${(p.events || []).length} event${(p.events || []).length !== 1 ? 's' : ''}
                  &nbsp;·&nbsp;
                  ${measures.length} measure${measures.length !== 1 ? 's' : ''}
                  &nbsp;·&nbsp;
                  ${taggedCount} tagged
                </div>
                <div style="margin-top:10px">
                  <span class="ml-tag-badge" style="background:${patternCount > 0 ? '#7c3aed18' : '#f3f4f6'};color:${patternCount > 0 ? '#7c3aed' : '#9ca3af'};border:1px solid ${patternCount > 0 ? '#7c3aed40' : '#e5e7eb'}">
                    ${patternCount > 0 ? '✦' : '○'} ${patternCount} pattern${patternCount !== 1 ? 's' : ''} detected
                  </span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // ── Main ML opportunities view ──────────────────────────────────────────────
  render(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) { Router.navigate('ml-opportunities'); return; }

    const detectedPatterns = this._detectAllPatterns(project);

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#ml-opportunities">ML Opportunities</a>
          <span class="bc-sep">›</span>
          <span>${this._esc(project.name)}</span>
        </div>
      </div>

      <!-- Section 1: Auto-Detected Patterns -->
      <section style="margin-bottom:32px">
        <h2 style="font-size:15px;font-weight:700;margin-bottom:12px">Auto-Detected Patterns</h2>
        <div class="info-banner" style="margin-bottom:16px">
          <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
          <strong>How pattern detection works:</strong> Modelstorm automatically detects ML opportunities
          in your data model based on structural patterns. Confirm or override these suggestions by
          tagging individual measures below.
        </div>
        ${detectedPatterns.length === 0
          ? `<div class="empty-state" style="padding:32px;border:1px dashed var(--border);border-radius:var(--radius);text-align:center">
               <div style="font-size:24px;margin-bottom:8px">🔍</div>
               <h3 style="font-size:14px;font-weight:600;margin-bottom:4px">No patterns detected</h3>
               <p style="font-size:13px;color:var(--text-muted)">Add more events with measures and dimensions to enable ML pattern detection.</p>
             </div>`
          : `<div class="card-grid">
               ${detectedPatterns.map(p => this._renderPatternCard(p)).join('')}
             </div>`
        }
      </section>

      <!-- Section 2: Measure ML Tag Editor -->
      <section style="margin-bottom:32px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h2 style="font-size:15px;font-weight:700;margin:0">Assign ML Tags to Measures</h2>
          <button class="btn btn-ghost btn-sm" onclick="MLAnalysis._autoTagFromPatterns('${project.id}')">
            ✦ Auto-tag from patterns
          </button>
        </div>
        <div class="info-banner" style="margin-bottom:16px">
          <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
          Tag each measure with its machine learning role.
          <strong>Forecast Target</strong> = what you're predicting.
          <strong>Regression Feature</strong> = an input variable.
          <strong>Anomaly Signal</strong> = monitor for outliers.
        </div>
        ${this._renderMlTagTable(project, detectedPatterns)}
      </section>

      <!-- Section 3: Feature Store View -->
      <section id="ml-feature-store">
        <h2 style="font-size:15px;font-weight:700;margin-bottom:12px">Feature Store View</h2>
        ${this._renderFeatureStore(project)}
      </section>
    `;
  },

  // ── Pattern detection helpers ───────────────────────────────────────────────
  _detectAllPatterns(project) {
    const results = [];
    (project.events || []).forEach(event => {
      const cols = event.columns || [];
      const measures     = cols.filter(c => c.category === 'how_many');
      const saM          = measures.filter(c => c.additiveType === 'semi_additive');
      const naM          = measures.filter(c => c.additiveType === 'non_additive');
      const budgetM      = measures.filter(c => c.budgetControl);
      const hasWho       = cols.some(c => c.category === 'who');
      const hasWhat      = cols.some(c => c.category === 'what');
      const hasWhen      = cols.some(c => c.category === 'when');

      // time_series
      if (saM.length >= 1 && hasWhen) {
        results.push({
          patternKey: 'time_series',
          event,
          triggers: [`${saM.length} semi-additive measure${saM.length !== 1 ? 's' : ''}`, 'when dimension']
        });
      }
      // churn
      if (hasWho && measures.length >= 2) {
        results.push({
          patternKey: 'churn',
          event,
          triggers: ['who dimension', `${measures.length} measures`]
        });
      }
      // recommendation
      if (hasWho && hasWhat && measures.length >= 1) {
        results.push({
          patternKey: 'recommendation',
          event,
          triggers: ['who dimension', 'what dimension', `${measures.length} measure${measures.length !== 1 ? 's' : ''}`]
        });
      }
      // anomaly
      if (naM.length >= 1 && budgetM.length >= 1) {
        results.push({
          patternKey: 'anomaly',
          event,
          triggers: [`${naM.length} non-additive measure${naM.length !== 1 ? 's' : ''}`, `${budgetM.length} budget-controlled measure${budgetM.length !== 1 ? 's' : ''}`]
        });
      }
      // segmentation
      if (hasWho && measures.length >= 3) {
        results.push({
          patternKey: 'segmentation',
          event,
          triggers: ['who dimension', `${measures.length} measures (≥3)`]
        });
      }
      // demand
      if (hasWhat && (event.grain || 'transaction') === 'transaction' && measures.length >= 1) {
        results.push({
          patternKey: 'demand',
          event,
          triggers: ['what dimension', 'transaction grain', `${measures.length} measure${measures.length !== 1 ? 's' : ''}`]
        });
      }
    });
    return results;
  },

  _renderPatternCard(p) {
    const pattern = ML_PATTERNS[p.patternKey];
    return `
      <div class="ml-pattern-card card">
        <div class="card-body">
          <div class="ml-pattern-icon">${pattern.icon}</div>
          <div style="font-size:13px;font-weight:700;color:${pattern.color};margin-bottom:2px">
            ${this._esc(pattern.label)}
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
            in <strong>${this._esc(p.event.name)}</strong>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">
            <span style="font-weight:600">Triggered by:</span>
            ${p.triggers.map(t => `<span class="badge-sm" style="background:${pattern.color}18;color:${pattern.color};border:1px solid ${pattern.color}30">${this._esc(t)}</span>`).join(' ')}
          </div>
          <p style="font-size:12px;color:var(--text-muted);line-height:1.5;margin:0">${this._esc(pattern.description)}</p>
        </div>
      </div>
    `;
  },

  // ── ML Tag table ────────────────────────────────────────────────────────────
  _renderMlTagTable(project, detectedPatterns) {
    // Build a lookup: eventId → patternKeys detected for that event
    const eventPatterns = {};
    detectedPatterns.forEach(dp => {
      if (!eventPatterns[dp.event.id]) eventPatterns[dp.event.id] = [];
      eventPatterns[dp.event.id].push(dp.patternKey);
    });

    const rows = [];
    (project.events || []).forEach(event => {
      (event.columns || []).filter(c => c.category === 'how_many').forEach(col => {
        const addType = ADDITIVE_TYPES[col.additiveType] || ADDITIVE_TYPES.fully_additive;
        const patternsForEvent = (eventPatterns[event.id] || [])
          .map(k => ML_PATTERNS[k])
          .filter(Boolean);

        rows.push(`
          <tr>
            <td style="font-size:12px;color:var(--text-muted)">${this._esc(event.name)}</td>
            <td style="font-size:13px;font-weight:500">${this._esc(col.name)}</td>
            <td>
              <span class="additive-badge additive-${col.additiveType === 'semi_additive' ? 'sa' : col.additiveType === 'non_additive' ? 'na' : 'fa'}"
                    title="${this._esc(addType.label)}">
                ${addType.short}
              </span>
            </td>
            <td>
              <select class="form-input" style="font-size:12px;padding:4px 8px"
                      onchange="MLAnalysis._onTagChange('${project.id}', '${event.id}', '${col.id}', this.value)">
                ${Object.entries(ML_TAGS).map(([key, tag]) =>
                  `<option value="${key}" ${col.mlTag === key ? 'selected' : ''}>${this._esc(tag.label)}</option>`
                ).join('')}
              </select>
            </td>
            <td>
              ${patternsForEvent.length
                ? patternsForEvent.map(pat =>
                    `<span class="ml-tag-badge" style="background:${pat.color}15;color:${pat.color};border:1px solid ${pat.color}30">
                       ${pat.icon} ${this._esc(pat.label)}
                     </span>`
                  ).join(' ')
                : `<span style="color:var(--text-subtle);font-size:11px">—</span>`
              }
            </td>
          </tr>
        `);
      });
    });

    if (!rows.length) {
      return `<p style="font-size:13px;color:var(--text-muted)">No measures found. Add how_many columns to your events to tag them here.</p>`;
    }

    return `
      <div style="overflow-x:auto">
        <table class="ml-tag-table" style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:2px solid var(--border)">
              <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--text-muted);font-weight:600;white-space:nowrap">Event</th>
              <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--text-muted);font-weight:600">Measure</th>
              <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--text-muted);font-weight:600">Additivity</th>
              <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--text-muted);font-weight:600">ML Tag</th>
              <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--text-muted);font-weight:600">Auto-detected Pattern</th>
            </tr>
          </thead>
          <tbody id="ml-tag-tbody">
            ${rows.join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ── Tag change handler ──────────────────────────────────────────────────────
  _onTagChange(projectId, eventId, colId, newTag) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event, project } = found;
    const col = (event.columns || []).find(c => c.id === colId);
    if (!col) return;
    col.mlTag = newTag;
    Storage.saveEvent(projectId, event);
    this._reRenderFeatureStore(projectId);
  },

  // ── Re-render only the feature store section ────────────────────────────────
  _reRenderFeatureStore(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const el = document.getElementById('ml-feature-store');
    if (!el) return;
    el.querySelector('section, div.ml-feature-store-inner, [data-feature-store]');
    // Replace just the content below the heading
    const heading = el.querySelector('h2');
    if (heading) {
      // Remove everything after heading
      while (heading.nextSibling) heading.nextSibling.remove();
      const div = document.createElement('div');
      div.innerHTML = this._renderFeatureStore(project);
      while (div.firstChild) el.appendChild(div.firstChild);
    } else {
      el.innerHTML = `<h2 style="font-size:15px;font-weight:700;margin-bottom:12px">Feature Store View</h2>${this._renderFeatureStore(project)}`;
    }
  },

  // ── Auto-tag from patterns ──────────────────────────────────────────────────
  _autoTagFromPatterns(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) return;
    const detectedPatterns = this._detectAllPatterns(project);

    // Build per-event pattern lookup
    const eventPatternMap = {};
    detectedPatterns.forEach(dp => {
      if (!eventPatternMap[dp.event.id]) eventPatternMap[dp.event.id] = new Set();
      eventPatternMap[dp.event.id].add(dp.patternKey);
    });

    let changed = 0;
    (project.events || []).forEach(event => {
      const patterns = eventPatternMap[event.id] || new Set();
      let eventModified = false;

      (event.columns || []).forEach(col => {
        let newTag = null;

        if (col.category === 'how_many') {
          // SA measures in time_series events → forecast_target
          if (patterns.has('time_series') && col.additiveType === 'semi_additive') {
            newTag = 'forecast_target';
          }
          // NA + budgetControl → anomaly_signal
          if (patterns.has('anomaly') && col.additiveType === 'non_additive' && col.budgetControl) {
            newTag = 'anomaly_signal';
          }
        } else {
          // who/what columns in recommendation events → clustering_dimension
          if (patterns.has('recommendation') && (col.category === 'who' || col.category === 'what')) {
            newTag = 'clustering_dimension';
          }
        }

        if (newTag && col.mlTag !== newTag) {
          col.mlTag = newTag;
          eventModified = true;
          changed++;
        }
      });

      if (eventModified) {
        Storage.saveEvent(projectId, event);
      }
    });

    showToast(changed > 0 ? `Auto-tagged ${changed} column${changed !== 1 ? 's' : ''}` : 'No tags to auto-apply');
    MLAnalysis.render(projectId);
  },

  // ── Feature store view ──────────────────────────────────────────────────────
  _renderFeatureStore(project) {
    // Collect ALL columns (not just measures) grouped by mlTag
    const groups = {};
    Object.keys(ML_TAGS).forEach(key => { groups[key] = []; });

    (project.events || []).forEach(event => {
      (event.columns || []).forEach(col => {
        const tag = col.mlTag && ML_TAGS[col.mlTag] ? col.mlTag : 'none';
        groups[tag].push({ col, event });
      });
    });

    const nonEmpty = Object.entries(groups).filter(([, items]) => items.length > 0);

    if (nonEmpty.length === 0) {
      return `<p style="font-size:13px;color:var(--text-muted)">No columns yet. Add events with columns to see the feature store.</p>`;
    }

    return nonEmpty.map(([tagKey, items]) => {
      const tag = ML_TAGS[tagKey];
      return `
        <div class="ml-feature-group" style="margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <span class="ml-tag-badge"
                  style="background:${tag.bg};color:${tag.color};border:1px solid ${tag.color}40;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px">
              ${this._esc(tag.label)}
            </span>
            <span style="font-size:12px;color:var(--text-muted)">${items.length} column${items.length !== 1 ? 's' : ''}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${items.map(({ col, event }) => `
              <div class="pl-measure-chip" style="border-color:${tag.color}40">
                <span style="font-weight:500;font-size:12px">${this._esc(col.name)}</span>
                <span class="chip-event" style="font-size:10px;color:var(--text-muted);display:block">${this._esc(event.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  // ── Utility ─────────────────────────────────────────────────────────────────
  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
