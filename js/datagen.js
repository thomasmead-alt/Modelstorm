const DataGen = {
  _currentData: [],
  _currentEvent: null,

  render(event, project) {
    this._currentEvent = event;
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb" id="breadcrumb">
          <a href="#projects">Projects</a>
          <span class="bc-sep">›</span>
          <a href="#project/${project.id}">${this._esc(project.name)}</a>
          <span class="bc-sep">›</span>
          <a href="#event/${event.id}">${this._esc(event.name)}</a>
          <span class="bc-sep">›</span>
          <span>Generate Sample Data</span>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('event/${event.id}')">← Back to Matrix</button>
        </div>
      </div>

      <div class="project-meta">
        <h1 class="view-title">Generate Sample Data</h1>
        <p class="view-subtitle">Synthetic rows for: <strong>${this._esc(event.name)}</strong></p>
      </div>

      <div class="info-banner" id="datagenBanner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'" title="Dismiss">✕</button>
        <strong>How sample data is generated:</strong> Each column uses its <em>Format / Examples</em>
        value from the BEAM matrix to produce realistic synthetic data.
        <ul style="margin:8px 0 0 16px;line-height:1.9">
          <li><strong>Enum list</strong> (<code>Val1, Val2, Val3</code>) — picks randomly from the list</li>
          <li><strong>Numeric range</strong> (<code>100..50000</code>) — generates a random number in range</li>
          <li><strong>Date range</strong> (<code>2023-01-01..2024-12-31</code>) — picks a random date</li>
          <li><strong>No format set</strong> — generates a type-appropriate placeholder value</li>
        </ul>
        <strong>Derived</strong> columns are highlighted differently so you can see which values your data layer must compute.
      </div>

      <div class="datagen-config">
        <div class="datagen-field">
          <label for="genRows">Rows to generate</label>
          <input type="number" id="genRows" min="1" max="500" value="10">
        </div>
        <div class="datagen-field">
          <label for="genSeed">Random seed <span style="font-weight:400;color:var(--text-subtle)">(optional)</span></label>
          <input type="number" id="genSeed" placeholder="e.g. 42">
        </div>
        <div class="datagen-field">
          <label>&nbsp;</label>
          <button class="btn btn-primary" onclick="DataGen.generate()">⚡ Generate</button>
        </div>
        <div class="datagen-field" id="downloadButtons" style="display:none">
          <label>&nbsp;</label>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="DataGen.downloadCSV()">⬇ CSV</button>
            <button class="btn btn-ghost btn-sm" onclick="DataGen.downloadJSON()">⬇ JSON</button>
          </div>
        </div>
      </div>

      <div class="datagen-legend">
        <div class="datagen-legend-item">
          <span class="datagen-legend-swatch" style="background:#f0fdf4;border-color:#bbf7d0"></span>
          Source System — available in source
        </div>
        <div class="datagen-legend-item">
          <span class="datagen-legend-swatch" style="background:#fff7ed;border-color:#fed7aa"></span>
          Derived — computed in data layer
        </div>
        <div class="datagen-legend-item">
          <span class="datagen-legend-swatch" style="background:#eff6ff;border-color:#bfdbfe"></span>
          Lookup — from reference table
        </div>
      </div>

      <div id="datagenOutput">
        <div class="datagen-empty">Click <strong>Generate</strong> to create sample rows.</div>
      </div>
    `;
  },

  generate() {
    const event = this._currentEvent;
    if (!event) return;

    const rowCount = Math.min(500, Math.max(1, parseInt(document.getElementById('genRows').value) || 10));
    const seedInput = document.getElementById('genSeed').value.trim();
    const seed = seedInput ? parseInt(seedInput) : null;

    const rng = seed !== null ? this._seededRng(seed) : Math.random.bind(Math);

    const cols = event.columns;
    if (!cols.length) {
      document.getElementById('datagenOutput').innerHTML =
        '<div class="datagen-empty">This event has no columns. Add columns to the BEAM matrix first.</div>';
      return;
    }

    const rows = [];
    for (let i = 0; i < rowCount; i++) {
      const row = {};
      cols.forEach(col => { row[col.name || col.id] = this._generateValue(col, i, rng); });
      rows.push(row);
    }
    this._currentData = rows;

    // Build table
    const headers = cols.map(col => {
      const src = col.source || 'source_system';
      const srcInfo = SOURCES[src] || {};
      return `<th class="th-${src}" title="${this._esc(srcInfo.description || src)}">
        ${this._esc(col.name || '(unnamed)')}<br>
        <span style="font-weight:400;font-size:10px;opacity:0.75">${col.dataType} · ${srcInfo.label || src}</span>
      </th>`;
    }).join('');

    const bodyRows = rows.map((row, i) => {
      const cells = cols.map(col => {
        const val = row[col.name || col.id];
        const src = col.source || 'source_system';
        return `<td class="td-${src}">${this._esc(String(val ?? ''))}</td>`;
      }).join('');
      return `<tr><td class="datagen-row-num">${i + 1}</td>${cells}</tr>`;
    }).join('');

    document.getElementById('datagenOutput').innerHTML = `
      <div class="datagen-results">
        <table class="datagen-table">
          <thead><tr><th style="background:#f9fafb;color:var(--text-subtle);width:36px">#</th>${headers}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      <p style="font-size:12px;color:var(--text-subtle)">${rowCount} row${rowCount !== 1 ? 's' : ''} generated · ${cols.length} column${cols.length !== 1 ? 's' : ''}</p>
    `;

    document.getElementById('downloadButtons').style.display = 'flex';
  },

  // ── Value generation ──────────────────────────────────────

  _generateValue(col, rowIndex, rng) {
    const fmt = (col.format || '').trim();
    const dtype = col.dataType || 'VARCHAR';

    // 1. Enum list: "Val1, Val2, Val3" (commas, no "..")
    if (fmt && fmt.includes(',') && !fmt.includes('..')) {
      const values = fmt.split(',').map(v => v.trim()).filter(Boolean);
      if (values.length) return values[Math.floor(rng() * values.length)];
    }

    // 2. Range: "min..max"
    if (fmt && fmt.includes('..')) {
      const parts = fmt.split('..').map(s => s.trim());
      const minStr = parts[0], maxStr = parts[1] || parts[0];

      // Date range
      if (/^\d{4}-\d{2}-\d{2}/.test(minStr)) {
        const minTs = new Date(minStr).getTime();
        const maxTs = new Date(maxStr).getTime();
        const ts = minTs + rng() * (maxTs - minTs);
        const d = new Date(ts);
        const iso = d.toISOString().slice(0, 10);
        return dtype === 'DATETIME'
          ? `${iso} ${String(Math.floor(rng() * 24)).padStart(2,'0')}:${String(Math.floor(rng() * 60)).padStart(2,'0')}:00`
          : iso;
      }

      // Numeric range
      const min = parseFloat(minStr);
      const max = parseFloat(maxStr);
      if (!isNaN(min) && !isNaN(max)) {
        const val = min + rng() * (max - min);
        return (dtype === 'INT' || dtype === 'BIGINT') ? Math.round(val) : parseFloat(val.toFixed(2));
      }
    }

    // 3. Single explicit value (no commas, no range)
    if (fmt && !fmt.includes(',') && !fmt.includes('..')) {
      return fmt;
    }

    // 4. Type defaults
    return this._typeDefault(col, rowIndex, rng);
  },

  _typeDefault(col, rowIndex, rng) {
    const name = (col.name || '').toLowerCase().replace(/\s+/g, '_');
    switch (col.dataType) {
      case 'INT':
      case 'BIGINT':
        return Math.floor(rng() * 9000) + 1000;

      case 'DECIMAL':
      case 'FLOAT': {
        // Heuristic: if name contains "pct", "percent", "margin_%", "%" → 0–100
        if (/%|pct|percent/.test(name)) return parseFloat((rng() * 100).toFixed(1));
        return parseFloat((rng() * 50000).toFixed(2));
      }

      case 'DATE': {
        const d = new Date(2023, 0, 1);
        d.setDate(d.getDate() + Math.floor(rng() * 730));
        return d.toISOString().slice(0, 10);
      }

      case 'DATETIME': {
        const d = new Date(2023, 0, 1);
        d.setDate(d.getDate() + Math.floor(rng() * 730));
        const hh = String(Math.floor(rng() * 24)).padStart(2, '0');
        const mm = String(Math.floor(rng() * 60)).padStart(2, '0');
        return `${d.toISOString().slice(0, 10)} ${hh}:${mm}:00`;
      }

      case 'BOOLEAN':
        return rng() > 0.5 ? 'true' : 'false';

      case 'UUID':
        return this._uuid(rng);

      default:
        // VARCHAR / TEXT — generate a plausible placeholder
        return `${this._titleCase(col.name || 'Value')}_${Math.floor(rng() * 900) + 100}`;
    }
  },

  // ── Export helpers ────────────────────────────────────────

  downloadCSV() {
    if (!this._currentData.length) return;
    const headers = Object.keys(this._currentData[0]);
    const rows = this._currentData.map(row =>
      headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    this._download(
      `${this._slug(this._currentEvent?.name || 'event')}-sample-data.csv`,
      csv, 'text/csv'
    );
  },

  downloadJSON() {
    if (!this._currentData.length) return;
    this._download(
      `${this._slug(this._currentEvent?.name || 'event')}-sample-data.json`,
      JSON.stringify(this._currentData, null, 2),
      'application/json'
    );
  },

  _download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  // ── Utilities ─────────────────────────────────────────────

  // Simple seeded PRNG (mulberry32)
  _seededRng(seed) {
    let s = seed >>> 0;
    return function() {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  },

  _uuid(rng) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.floor(rng() * 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  _titleCase(str) {
    return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  },

  _slug(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'data';
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
