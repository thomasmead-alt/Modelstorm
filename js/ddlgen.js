const DDLGen = {
  _dialect: 'standard',

  render(eventId) {
    const found = Storage.getEvent(eventId);
    if (!found) { Router.navigate('projects'); return; }
    const { event, project } = found;

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#project/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <a href="#event/${event.id}">${this._esc(event.name)}</a>
          <span class="bc-sep">›</span>
          <span>DDL Export</span>
        </div>
      </div>

      <div class="info-banner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'">✕</button>
        <strong>DDL Generation</strong> — Classify each dimension column with its
        <strong>Slowly Changing Dimension (SCD) type</strong> to determine how historical changes
        are tracked. Mark the <strong>Natural Key</strong> (source system identifier) and
        <strong>Surrogate Key</strong> (warehouse-generated PK). SCD Type 2 automatically
        adds <code>effective_from</code>, <code>effective_to</code>, and <code>is_current</code>
        columns to the generated DDL.
      </div>

      <div class="ddl-layout">
        <div class="ddl-left" id="scdPanel">
          ${this._renderSCDPanel(event)}
        </div>
        <div class="ddl-right">
          <div class="ddl-toolbar">
            <select class="form-input" id="dialectSelect" style="max-width:180px;font-size:12px"
              onchange="DDLGen._dialect=this.value; DDLGen._refreshPreview('${event.id}')">
              <option value="standard">Standard SQL</option>
              <option value="bigquery">BigQuery</option>
              <option value="snowflake">Snowflake</option>
              <option value="databricks">Databricks</option>
            </select>
            <button class="btn btn-ghost btn-sm" onclick="DDLGen._copySQL('${event.id}')">📋 Copy</button>
            <button class="btn btn-ghost btn-sm" onclick="DDLGen._downloadSQL('${event.id}')">⬇ Download .sql</button>
          </div>
          <pre class="ddl-preview" id="ddlPreview">${this._esc(this._generateSQL(event, this._dialect))}</pre>
        </div>
      </div>
    `;
  },

  _renderSCDPanel(event) {
    // Group dimension columns by category
    const dimCols = event.columns.filter(c => c.category !== 'how_many');
    const measureCols = event.columns.filter(c => c.category === 'how_many');
    const categories = [...new Set(dimCols.map(c => c.category))];

    const catSections = categories.map(cat => {
      const catInfo = (typeof CATEGORIES !== 'undefined' ? CATEGORIES[cat] : null) || { label: cat, color: '#6b7280' };
      const cols = dimCols.filter(c => c.category === cat);
      return `
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span class="badge-sm" style="background:${catInfo.color}">${catInfo.label}</span>
            <span style="font-size:11px;color:var(--text-muted)">${cols.length} column${cols.length !== 1 ? 's' : ''}</span>
          </div>
          <table class="scd-table">
            <thead>
              <tr>
                <th>Column</th><th>Type</th><th>NK</th><th>SK</th><th>SCD Type</th>
              </tr>
            </thead>
            <tbody>
              ${cols.map(col => `
                <tr>
                  <td style="font-size:12px;font-weight:500">${this._esc(col.name)}</td>
                  <td><code style="font-size:10px">${this._esc(col.dataType || 'VARCHAR')}</code></td>
                  <td title="Natural Key (source system identifier)">
                    <input type="checkbox" ${col.isNaturalKey ? 'checked' : ''}
                      onchange="DDLGen._updateColFlag('${event.id}','${col.id}','isNaturalKey',this.checked)">
                  </td>
                  <td title="Surrogate Key (warehouse-generated PK)">
                    <input type="checkbox" ${col.isSurrogateKey ? 'checked' : ''}
                      onchange="DDLGen._updateColFlag('${event.id}','${col.id}','isSurrogateKey',this.checked)">
                  </td>
                  <td>
                    <select class="form-input" style="font-size:11px;padding:2px 4px"
                      onchange="DDLGen._updateColFlag('${event.id}','${col.id}','scdType',this.value===''?null:parseInt(this.value))">
                      <option value="" ${col.scdType === null ? 'selected' : ''}>—</option>
                      ${Object.entries(typeof SCD_TYPES !== 'undefined' ? SCD_TYPES : {}).map(([k, s]) =>
                        `<option value="${k}" ${col.scdType == k ? 'selected' : ''}>${s.short}</option>`
                      ).join('')}
                    </select>
                    ${col.scdType !== null ? `<span class="scd-type-badge" style="background:${(typeof SCD_TYPES !== 'undefined' ? SCD_TYPES[col.scdType] : null)?.color || '#6b7280'}20;color:${(typeof SCD_TYPES !== 'undefined' ? SCD_TYPES[col.scdType] : null)?.color || '#6b7280'};border:1px solid ${(typeof SCD_TYPES !== 'undefined' ? SCD_TYPES[col.scdType] : null)?.color || '#6b7280'}40">${(typeof SCD_TYPES !== 'undefined' ? SCD_TYPES[col.scdType] : null)?.short || ''}</span>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    const measureSection = measureCols.length ? `
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">FACT TABLE MEASURES</div>
        <div style="font-size:12px;color:var(--text-muted)">
          ${measureCols.map(c => `
            <span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;padding:2px 8px;margin:2px">
              ${this._esc(c.name)} <code style="font-size:10px;color:var(--text-subtle)">${this._esc(c.dataType||'DECIMAL')}</code>
            </span>
          `).join('')}
        </div>
      </div>
    ` : '';

    return `
      <h3 style="font-size:14px;font-weight:600;margin-bottom:12px">SCD Classification</h3>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">
        <strong>NK</strong> = Natural Key (source ID) &nbsp; <strong>SK</strong> = Surrogate Key (warehouse PK)
      </div>
      ${catSections || '<p style="color:var(--text-muted);font-size:13px">No dimension columns in this event.</p>'}
      ${measureSection}

      <div class="info-banner" style="margin-top:16px;font-size:11px">
        <strong>SCD Types:</strong><br>
        ${Object.entries(typeof SCD_TYPES !== 'undefined' ? SCD_TYPES : {}).map(([k, s]) =>
          `<span class="scd-type-badge" style="background:${s.color}18;color:${s.color};border:1px solid ${s.color}40">${s.short}</span> ${s.description}<br>`
        ).join('')}
      </div>
    `;
  },

  _updateColFlag(eventId, colId, field, value) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const { event, project } = found;
    const col = event.columns.find(c => c.id === colId);
    if (!col) return;
    col[field] = value;
    Storage.saveEvent(project.id, event);
    this._refreshPreview(eventId);
  },

  _refreshPreview(eventId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const pre = document.getElementById('ddlPreview');
    if (pre) pre.textContent = this._generateSQL(found.event, this._dialect);
  },

  _generateSQL(event, dialect) {
    const slug = this._slugify(event.name);
    const dimCols = event.columns.filter(c => c.category !== 'how_many');
    const measureCols = event.columns.filter(c => c.category === 'how_many');
    const categories = [...new Set(dimCols.map(c => c.category))];
    const lines = [];
    const q = dialect === 'databricks' ? '`' : '';

    const identityExpr = {
      standard:   'BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
      bigquery:   'INT64',
      snowflake:  'BIGINT AUTOINCREMENT PRIMARY KEY',
      databricks: 'BIGINT GENERATED ALWAYS AS IDENTITY'
    }[dialect] || 'BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY';

    // Dimension tables
    for (const cat of categories) {
      const catInfo = (typeof CATEGORIES !== 'undefined' ? CATEGORIES[cat] : null) || { label: cat };
      const cols = dimCols.filter(c => c.category === cat);
      const hasSCD2 = cols.some(c => c.scdType == 2);
      const hasSCD3 = cols.some(c => c.scdType == 3);
      const dimSlug = `dim_${cat}_${slug}`;

      lines.push(`-- ──────────────────────────────────────────────────────`);
      lines.push(`-- ${catInfo.label} Dimension  (${cat})`);
      lines.push(`-- ──────────────────────────────────────────────────────`);
      lines.push(`CREATE TABLE ${q}${dimSlug}${q} (`);

      const colDefs = [];

      // Surrogate key
      const skCol = cols.find(c => c.isSurrogateKey) || null;
      const pkName = skCol ? this._slugify(skCol.name) : `${cat}_key`;
      if (dialect === 'bigquery') {
        colDefs.push(`  ${q}${pkName}${q} INT64  -- surrogate key (managed externally in BigQuery)`);
      } else {
        colDefs.push(`  ${q}${pkName}${q} ${identityExpr}  -- surrogate key`);
      }

      // Natural key(s)
      const nkCols = cols.filter(c => c.isNaturalKey);
      nkCols.forEach(c => {
        colDefs.push(`  ${q}${this._slugify(c.name)}${q} ${this._sqlType(c.dataType, dialect)} NOT NULL  -- natural key`);
      });

      // Other columns (not NK, not SK)
      const otherCols = cols.filter(c => !c.isNaturalKey && !c.isSurrogateKey);
      otherCols.forEach(c => {
        const scdComment = c.scdType !== null ? `  -- SCD Type ${c.scdType}` : '';
        colDefs.push(`  ${q}${this._slugify(c.name)}${q} ${this._sqlType(c.dataType, dialect)}${scdComment}`);
      });

      // SCD2 system columns
      if (hasSCD2) {
        colDefs.push(`  -- SCD Type 2: history tracking`);
        colDefs.push(`  ${q}effective_from${q} DATE NOT NULL`);
        colDefs.push(`  ${q}effective_to${q}   DATE`);
        colDefs.push(`  ${q}is_current${q}     ${dialect === 'bigquery' ? 'BOOL' : 'BOOLEAN'} NOT NULL DEFAULT ${dialect === 'bigquery' ? 'true' : 'TRUE'}`);
      }

      // SCD3 previous value columns
      if (hasSCD3) {
        const scd3Cols = cols.filter(c => c.scdType == 3);
        colDefs.push(`  -- SCD Type 3: previous value columns`);
        scd3Cols.forEach(c => {
          colDefs.push(`  ${q}previous_${this._slugify(c.name)}${q} ${this._sqlType(c.dataType, dialect)}`);
        });
      }

      lines.push(colDefs.join(',\n'));
      lines.push(dialect === 'bigquery' ? ');\n' : ');\n');
    }

    // Fact table
    lines.push(`-- ──────────────────────────────────────────────────────`);
    lines.push(`-- ${event.name} Fact Table`);
    const grain = event.grain || 'transaction';
    lines.push(`-- Grain: ${(typeof GRAINS !== 'undefined' ? GRAINS[grain]?.label : grain) || grain}`);
    lines.push(`-- ──────────────────────────────────────────────────────`);
    lines.push(`CREATE TABLE ${q}fact_${slug}${q} (`);

    const factCols = [];

    // Surrogate PK
    if (dialect === 'bigquery') {
      factCols.push(`  ${q}${slug}_key${q} INT64  -- surrogate key`);
    } else {
      factCols.push(`  ${q}${slug}_key${q} ${identityExpr}  -- surrogate key`);
    }

    // FK columns
    for (const cat of categories) {
      const cols = dimCols.filter(c => c.category === cat);
      const skCol = cols.find(c => c.isSurrogateKey);
      const fkName = skCol ? this._slugify(skCol.name) : `${cat}_key`;
      const dimSlug = `dim_${cat}_${slug}`;
      const fkType = dialect === 'bigquery' ? 'INT64' : 'BIGINT';
      if (dialect === 'bigquery' || dialect === 'databricks') {
        factCols.push(`  ${q}${fkName}${q} ${fkType} NOT NULL  -- FK → ${dimSlug}`);
      } else {
        factCols.push(`  ${q}${fkName}${q} ${fkType} NOT NULL REFERENCES ${q}${dimSlug}${q}(${q}${fkName}${q})`);
      }
    }

    // Measure columns
    measureCols.forEach(c => {
      const atKey = c.additiveType || 'fully_additive';
      const atShort = (typeof ADDITIVE_TYPES !== 'undefined' ? ADDITIVE_TYPES[atKey]?.short : null) || atKey.substring(0,2).toUpperCase();
      const bcFlag = c.budgetControl ? ' [BUDGET]' : '';
      factCols.push(`  ${q}${this._slugify(c.name)}${q} ${this._sqlType(c.dataType, dialect)}  -- [${atShort}]${bcFlag}`);
    });

    lines.push(factCols.join(',\n'));
    lines.push(');\n');

    // Indexes hint
    if (dialect !== 'bigquery') {
      lines.push(`-- Suggested indexes:`);
      categories.forEach(cat => {
        const cols = dimCols.filter(c => c.category === cat);
        const skCol = cols.find(c => c.isSurrogateKey);
        const fkName = skCol ? this._slugify(skCol.name) : `${cat}_key`;
        lines.push(`-- CREATE INDEX idx_fact_${slug}_${cat} ON ${q}fact_${slug}${q} (${q}${fkName}${q});`);
      });
    }

    return lines.join('\n');
  },

  _copySQL(eventId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const sql = this._generateSQL(found.event, this._dialect);
    navigator.clipboard.writeText(sql).then(() => showToast('SQL copied to clipboard'));
  },

  _downloadSQL(eventId) {
    const found = Storage.getEvent(eventId);
    if (!found) return;
    const sql = this._generateSQL(found.event, this._dialect);
    const slug = this._slugify(found.event.name);
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${slug}-${this._dialect}.sql`; a.click();
    URL.revokeObjectURL(url);
  },

  _slugify(str) {
    return String(str).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  },

  _sqlType(dataType, dialect) {
    const t = (dataType || 'VARCHAR').toUpperCase();
    const map = {
      'VARCHAR':  { standard: 'VARCHAR(255)', bigquery: 'STRING',       snowflake: 'VARCHAR(255)',  databricks: 'STRING'      },
      'TEXT':     { standard: 'TEXT',         bigquery: 'STRING',       snowflake: 'TEXT',          databricks: 'STRING'      },
      'INT':      { standard: 'INT',          bigquery: 'INT64',        snowflake: 'INT',            databricks: 'INT'         },
      'BIGINT':   { standard: 'BIGINT',       bigquery: 'INT64',        snowflake: 'BIGINT',         databricks: 'BIGINT'      },
      'DECIMAL':  { standard: 'DECIMAL(18,4)',bigquery: 'NUMERIC',      snowflake: 'NUMBER(18,4)',   databricks: 'DECIMAL(18,4)'},
      'FLOAT':    { standard: 'FLOAT',        bigquery: 'FLOAT64',      snowflake: 'FLOAT',          databricks: 'DOUBLE'      },
      'DATE':     { standard: 'DATE',         bigquery: 'DATE',         snowflake: 'DATE',           databricks: 'DATE'        },
      'DATETIME': { standard: 'DATETIME',     bigquery: 'TIMESTAMP',    snowflake: 'TIMESTAMP_NTZ',  databricks: 'TIMESTAMP'   },
      'BOOLEAN':  { standard: 'BOOLEAN',      bigquery: 'BOOL',         snowflake: 'BOOLEAN',        databricks: 'BOOLEAN'     },
      'UUID':     { standard: 'VARCHAR(36)',  bigquery: 'STRING',       snowflake: 'VARCHAR(36)',    databricks: 'STRING'      }
    };
    return (map[t] || {})[dialect] || map[t]?.standard || t;
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
