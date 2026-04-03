const Export = {
  // Download a Blob as a file
  _download(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Export full project as JSON
  toJSON(project) {
    const filename = `${this._slug(project.name)}.json`;
    this._download(filename, JSON.stringify(project, null, 2), 'application/json');
  },

  // Export a single event's BEAM matrix as CSV
  eventToCSV(event) {
    const headers = [
      'Column Name', 'Category', 'Category Label', '7W Meaning',
      'Origin', 'Origin Label', 'Data Type', 'Format / Examples',
      'Additivity', 'Budget Control', 'Owner', 'Responsibility Type', 'SCD Type',
      'P&L Line', 'Cash Flow Line', 'ML Tag', 'Conformed Dimension',
      'Formula', 'Description', 'Notes'
    ];
    const rows = event.columns.map(col => [
      col.name,
      col.category,
      CATEGORIES[col.category]?.label || col.category,
      CATEGORIES[col.category]?.meaning || '',
      col.source || 'source_system',
      SOURCES[col.source || 'source_system']?.label || col.source || 'Source System',
      col.dataType,
      col.format || '',
      col.category === 'how_many' ? (ADDITIVE_TYPES?.[col.additiveType || 'fully_additive']?.label || col.additiveType || '') : '',
      col.category === 'how_many' ? (col.budgetControl ? 'Yes' : 'No') : '',
      col.ownerId || '',
      col.category !== 'how_many' ? (RESPONSIBILITY_TYPES?.[col.responsibilityType || 'none']?.label || col.responsibilityType || '') : '',
      col.scdType !== null && col.scdType !== undefined ? `SCD${col.scdType}` : '',
      col.plLineId || '',
      col.cashFlowLineId || '',
      ML_TAGS?.[col.mlTag || 'none']?.label || col.mlTag || '',
      col.isConformed ? (col.publicDimensionId || 'Yes') : 'No',
      col.formula || '',
      col.description || '',
      col.notes || ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const filename = `${this._slug(event.name)}-beam-matrix.csv`;
    this._download(filename, csv, 'text/csv');
  },

  // Export all events in a project as CSV (multi-sheet-style, separated by blank lines)
  projectToCSV(project) {
    const sections = project.events.map(event => {
      const grain = event.grain || 'transaction';
      const grainLabel = GRAINS?.[grain]?.label || grain;
      const headers = [
        'Event', 'Event Grain',
        'Column Name', 'Category', 'Category Label', 'Origin', 'Origin Label',
        'Data Type', 'Format / Examples',
        'Additivity', 'Budget Control', 'Responsibility Type',
        'P&L Line', 'Conformed Dimension',
        'Description', 'Notes'
      ];
      const rows = event.columns.map(col => [
        event.name,
        grainLabel,
        col.name,
        col.category,
        CATEGORIES[col.category]?.label || col.category,
        col.source || 'source_system',
        SOURCES[col.source || 'source_system']?.label || col.source || 'Source System',
        col.dataType,
        col.format || '',
        col.category === 'how_many' ? (ADDITIVE_TYPES?.[col.additiveType || 'fully_additive']?.label || col.additiveType || '') : '',
        col.category === 'how_many' ? (col.budgetControl ? 'Yes' : 'No') : '',
        col.category !== 'how_many' ? (RESPONSIBILITY_TYPES?.[col.responsibilityType || 'none']?.label || col.responsibilityType || '') : '',
        col.plLineId || '',
        col.isConformed ? (col.publicDimensionId || 'Yes') : 'No',
        col.description || '',
        col.notes || ''
      ]);
      return [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    });

    const csv = sections.join('\n\n');
    const filename = `${this._slug(project.name)}-beam-matrices.csv`;
    this._download(filename, csv, 'text/csv');
  },

  // Open a print-friendly window for an event
  printEvent(event, projectName) {
    const categoryRows = event.columns.map(col => {
      const cat = CATEGORIES[col.category] || {};
      return `
        <tr>
          <td>${this._escape(col.name)}</td>
          <td><span class="badge" style="background:${cat.color || '#888'}">${cat.label || col.category}</span></td>
          <td>${this._escape(col.dataType)}</td>
          <td>${this._escape(col.description || '')}</td>
          <td>${this._escape(col.notes || '')}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BEAM Matrix – ${this._escape(event.name)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; color: #111; }
    h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th { background: #1e1e2e; color: #fff; padding: 8px 12px; text-align: left; }
    td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; color: #fff; font-size: 0.78rem; font-weight: 600; }
    .info { background: #f0f4ff; border-left: 4px solid #4a6cf7; padding: 10px 14px; margin-bottom: 1.5rem; border-radius: 4px; font-size: 0.88rem; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>BEAM Matrix: ${this._escape(event.name)}</h1>
  <div class="meta">Project: ${this._escape(projectName)} &nbsp;|&nbsp; ${event.columns.length} attribute${event.columns.length !== 1 ? 's' : ''}</div>
  ${event.description ? `<div class="info">${this._escape(event.description)}</div>` : ''}
  <table>
    <thead>
      <tr>
        <th>Column Name</th><th>7W Category</th><th>Data Type</th><th>Description</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${categoryRows}
    </tbody>
  </table>
  <p class="no-print" style="margin-top:2rem;"><button onclick="window.print()">Print / Save as PDF</button></p>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  },

  _slug(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
  },

  _escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
