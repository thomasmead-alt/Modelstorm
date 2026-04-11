const Diagram = {
  // Box layout constants
  BOX_WIDTH: 200,
  BOX_HEADER_H: 34,
  BOX_ROW_H: 22,
  BOX_PADDING: 12,
  FACT_RADIUS_MULTIPLIER: 1.0,

  render(event) {
    const app = document.getElementById('app');

    // Dimension template lookup for conformed dim names
    const dimTemplates = (typeof Storage !== 'undefined' && Storage.getAllDimTemplates)
      ? Storage.getAllDimTemplates() : [];

    // Group columns by category
    const byCategory = {};
    event.columns.forEach(col => {
      if (!byCategory[col.category]) byCategory[col.category] = [];
      byCategory[col.category].push(col);
    });

    const measures = byCategory['how_many'] || [];
    const dimEntries = Object.entries(byCategory).filter(([cat]) => cat !== 'how_many');

    // --- Build fact table rows ---
    const grain = event.grain || 'transaction';
    const grainInfo = (typeof GRAINS !== 'undefined' && GRAINS[grain]) || { label: grain, short: 'TXN', color: '#6b7280' };
    const purpose = event.eventPurpose || 'actuals';
    const purposeInfo = (typeof EVENT_PURPOSES !== 'undefined' && EVENT_PURPOSES[purpose]) || null;
    const factLabel = `${event.name} Fact`;

    const factRows = [];
    factRows.push({ text: 'event_key (PK)', key: true });
    factRows.push({ text: `Grain: ${grainInfo.label}`, grain: true, color: grainInfo.color });
    if (purposeInfo && purpose !== 'actuals') {
      factRows.push({ text: `Purpose: ${purposeInfo.label}`, grain: true, color: purposeInfo.color });
    }

    // FK rows — use actual column names and dim template names where available
    dimEntries.forEach(([cat, cols]) => {
      // Find the primary FK column for this category (natural key or surrogate key, else first col)
      const fkCol = cols.find(c => c.isNaturalKey || c.isFinancialAnchor) || cols[0];
      const colName = (fkCol && fkCol.name) ? fkCol.name : `${cat}_key`;
      const anchorFlag = fkCol && fkCol.isFinancialAnchor ? ' ⚓' : '';

      // Determine target dim name
      let dimTargetName;
      if (fkCol && fkCol.publicDimensionId) {
        const tmpl = dimTemplates.find(d => d.id === fkCol.publicDimensionId);
        dimTargetName = tmpl ? tmpl.name : (CATEGORIES[cat]?.label || cat) + ' Dim';
      } else {
        dimTargetName = (CATEGORIES[cat]?.label || cat) + ' Dim';
      }

      const dateRole = (fkCol && fkCol.dateKeyRole && typeof DATE_KEY_ROLES !== 'undefined' && DATE_KEY_ROLES[fkCol.dateKeyRole])
        ? ` [${DATE_KEY_ROLES[fkCol.dateKeyRole].label}]` : '';

      factRows.push({
        text: `${colName}${anchorFlag} → ${dimTargetName}${dateRole}`,
        fk: true,
        isAnchor: !!(fkCol && fkCol.isFinancialAnchor),
        cat
      });
    });

    measures.forEach(m => {
      const at = m.additiveType || 'fully_additive';
      const atInfo = (typeof ADDITIVE_TYPES !== 'undefined' && ADDITIVE_TYPES[at]) || { short: 'FA', color: '#166534' };
      const bcFlag = m.budgetControl ? ' 💰' : '';
      const glTag = m.glAccount ? ` [GL:${m.glAccount}]` : (m.glAccountRangeFrom ? ` [GL:${m.glAccountRangeFrom}–${m.glAccountRangeTo}]` : '');
      factRows.push({ text: `${m.name} [${m.dataType}]${bcFlag}${glTag}`, measure: true, additiveShort: atInfo.short, additiveColor: atInfo.color });
    });

    // --- SVG canvas size ---
    const W = 960, H = 680;
    const cx = W / 2, cy = H / 2;

    // Radius: push dims out based on count
    const numDims = dimEntries.length;
    const orbitR = Math.max(240, numDims * 45);

    // --- Build dimension table boxes ---
    const dimBoxes = dimEntries.map(([cat, cols], i) => {
      const angle = (2 * Math.PI * i) / numDims - Math.PI / 2;
      const bx = cx + orbitR * Math.cos(angle);
      const by = cy + orbitR * Math.sin(angle);
      const catInfo = CATEGORIES[cat] || { label: cat, color: '#6b7280' };

      // Use template name if all columns share a publicDimensionId
      const sharedTemplateId = cols.every(c => c.publicDimensionId && c.publicDimensionId === cols[0].publicDimensionId)
        ? cols[0].publicDimensionId : null;
      const tmpl = sharedTemplateId ? dimTemplates.find(d => d.id === sharedTemplateId) : null;
      const boxTitle = tmpl ? tmpl.name : (catInfo.label + ' Dim');
      const isConformed = !!tmpl;

      // Rows: show actual column names with data types and anchor flag
      const rows = cols.map(c => {
        const anchorFlag = c.isFinancialAnchor ? ' ⚓' : '';
        const roleTag = (c.dateKeyRole && typeof DATE_KEY_ROLES !== 'undefined' && DATE_KEY_ROLES[c.dateKeyRole])
          ? ` (${DATE_KEY_ROLES[c.dateKeyRole].label})` : '';
        return `${c.name}${anchorFlag} [${c.dataType}]${roleTag}`;
      });
      // Add a PK row using the first key column name if available, or cat_key
      const pkCol = cols.find(c => c.isSurrogateKey || c.isNaturalKey);
      const pkName = pkCol ? `${pkCol.name} (PK)` : `${cat}_key (PK)`;
      rows.unshift(pkName);

      return { cat, catInfo, bx, by, rows, angle, boxTitle, isConformed };
    });

    // --- Fact box height ---
    const factBoxH = this.BOX_HEADER_H + factRows.length * this.BOX_ROW_H + this.BOX_PADDING;
    const factBoxW = this.BOX_WIDTH + 20; // slightly wider
    const factX = cx - factBoxW / 2;
    const factY = cy - factBoxH / 2;

    // --- Render ---
    const infoText = event.description
      ? `<p class="diagram-desc">${this._esc(event.description)}</p>` : '';

    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb" id="breadcrumb"></div>
        <div class="view-actions">
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('event/${event.id}')">← Back to Matrix</button>
        </div>
      </div>

      <div class="info-banner" id="diagramBanner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'" title="Dismiss">✕</button>
        <strong>Star Schema</strong> — This diagram is auto-derived from your BEAM matrix.
        The central <strong>fact table</strong> contains your measures (<em>How many</em>) and foreign keys
        linking to each surrounding <strong>dimension table</strong>.
        Each dimension captures descriptive context from the other 7Ws.
      </div>

      ${infoText}

      <div class="diagram-toolbar">
        <button class="btn btn-ghost btn-sm" id="zoomIn">+ Zoom In</button>
        <button class="btn btn-ghost btn-sm" id="zoomOut">− Zoom Out</button>
        <button class="btn btn-ghost btn-sm" id="zoomReset">Reset</button>
        <span class="diagram-hint">Drag to pan &nbsp;·&nbsp; Scroll to zoom</span>
      </div>

      <div class="diagram-container" id="diagramContainer">
        <svg id="diagramSvg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"></svg>
      </div>

      <div class="diagram-legend">
        <div class="legend-item"><span class="legend-swatch fact-swatch"></span> Fact table (measures + foreign keys)</div>
        <div class="legend-item"><span class="legend-swatch dim-swatch"></span> Dimension table (descriptive context)</div>
        <div class="legend-item"><span class="legend-line"></span> Foreign key relationship</div>
        <div class="legend-item"><span class="additive-badge additive-fa">FA</span> Fully Additive — safe to SUM at any grain</div>
        <div class="legend-item"><span class="additive-badge additive-sa">SA</span> Semi-Additive — cannot SUM across time</div>
        <div class="legend-item"><span class="additive-badge additive-na">NA</span> Non-Additive — must recalculate from components</div>
        <div class="legend-item"><span style="font-size:13px">💰</span> Budget-controlled measure</div>
      </div>
    `;

    // Fill breadcrumb
    this._setBreadcrumb(event);

    const svg = document.getElementById('diagramSvg');

    // --- Draw connector lines first (behind boxes) ---
    dimBoxes.forEach(dim => {
      const dimBoxH = this.BOX_HEADER_H + dim.rows.length * this.BOX_ROW_H + this.BOX_PADDING;
      const dimBoxX = dim.bx - this.BOX_WIDTH / 2;
      const dimBoxY = dim.by - dimBoxH / 2;

      // Line from fact edge to dim edge
      const line = this._svgEl('line', {
        x1: cx, y1: cy,
        x2: dim.bx, y2: dim.by,
        stroke: '#9ca3af',
        'stroke-width': '1.5',
        'stroke-dasharray': '5,4',
        class: 'connector'
      });
      svg.appendChild(line);
    });

    // --- Draw dimension boxes ---
    dimBoxes.forEach(dim => {
      const dimBoxH = this.BOX_HEADER_H + dim.rows.length * this.BOX_ROW_H + this.BOX_PADDING;
      this._drawBox(svg, {
        x: dim.bx - this.BOX_WIDTH / 2,
        y: dim.by - dimBoxH / 2,
        w: this.BOX_WIDTH,
        h: dimBoxH,
        title: dim.boxTitle,
        titleColor: dim.catInfo.color,
        rows: dim.rows,
        rowClass: 'dim-row',
        cat: dim.cat,
        isConformed: dim.isConformed
      });
    });

    // --- Draw fact box ---
    this._drawBox(svg, {
      x: factX,
      y: factY,
      w: factBoxW,
      h: factBoxH,
      title: factLabel,
      titleColor: '#e85d04',
      rows: factRows.map(r => r.text),
      rowClass: 'fact-row',
      isFact: true,
      factRows
    });

    // Empty state
    if (numDims === 0 && measures.length === 0) {
      const txt = this._svgEl('text', {
        x: cx, y: cy,
        'text-anchor': 'middle',
        fill: '#9ca3af',
        'font-size': '15',
        class: 'empty-diagram-msg'
      });
      txt.textContent = 'Add columns to the BEAM matrix to generate a diagram.';
      svg.appendChild(txt);
    }

    // --- Pan & zoom ---
    this._initPanZoom(document.getElementById('diagramContainer'), svg);
  },

  _drawBox(svg, { x, y, w, h, title, titleColor, rows, isFact, factRows, isConformed }) {
    const g = this._svgEl('g', { class: isFact ? 'fact-box' : 'dim-box' });

    // Drop shadow
    g.appendChild(this._svgEl('rect', {
      x: x + 3, y: y + 3, width: w, height: h,
      rx: 6, fill: 'rgba(0,0,0,0.08)'
    }));

    // Background — conformed dim boxes get a subtle tinted border
    const strokeColor = isFact ? '#e85d04' : (isConformed ? titleColor : '#d1d5db');
    const strokeWidth = isFact ? '2' : (isConformed ? '2' : '1.5');
    g.appendChild(this._svgEl('rect', {
      x, y, width: w, height: h,
      rx: 6, fill: '#ffffff',
      stroke: strokeColor, 'stroke-width': strokeWidth
    }));

    // Header background
    const headerH = this.BOX_HEADER_H;
    g.appendChild(this._svgEl('rect', { x, y, width: w, height: headerH, rx: 6, fill: titleColor }));
    // Cover bottom-rounded corners of header
    g.appendChild(this._svgEl('rect', { x, y: y + headerH - 6, width: w, height: 6, fill: titleColor }));

    // Title text (truncate to fit)
    const truncTitle = title.length > 24 ? title.slice(0, 22) + '…' : title;
    const titleEl = this._svgEl('text', {
      x: x + (isConformed && !isFact ? w / 2 - 8 : w / 2),
      y: y + headerH / 2 + 5,
      'text-anchor': 'middle',
      fill: '#ffffff', 'font-size': '12', 'font-weight': '600'
    });
    titleEl.textContent = truncTitle;
    g.appendChild(titleEl);

    // Conformed badge (⊛) in header for dimension boxes
    if (isConformed && !isFact) {
      const badge = this._svgEl('text', {
        x: x + w - 10, y: y + headerH / 2 + 5,
        'text-anchor': 'end', fill: 'rgba(255,255,255,0.85)',
        'font-size': '11', 'font-weight': '700'
      });
      badge.textContent = '⊛';
      g.appendChild(badge);
    }

    // Divider
    g.appendChild(this._svgEl('line', {
      x1: x, y1: y + headerH, x2: x + w, y2: y + headerH,
      stroke: '#e5e7eb', 'stroke-width': '1'
    }));

    // Rows
    rows.forEach((row, i) => {
      const rowY0 = y + headerH + this.BOX_PADDING / 2 + i * this.BOX_ROW_H;
      const ry = rowY0 + this.BOX_ROW_H * 0.72;

      // Alternate row background
      if (i % 2 === 0) {
        g.appendChild(this._svgEl('rect', {
          x: x + 1, y: rowY0, width: w - 2, height: this.BOX_ROW_H, fill: '#f9fafb'
        }));
      }

      // Determine row styling
      let rowFill = '#374151', prefix = '', rowBgOverride = null;
      if (isFact && factRows) {
        const fr = factRows[i];
        if (fr?.key)     { rowFill = '#6b7280'; prefix = '🔑 '; }
        else if (fr?.grain)   { rowFill = fr.color || '#6b7280'; prefix = '⊕ '; rowBgOverride = `${fr.color}15`; }
        else if (fr?.fk)     {
          rowFill = fr.isAnchor ? '#065f46' : '#4a6cf7';
          prefix = fr.isAnchor ? '⚓ ' : '🔗 ';
          if (fr.isAnchor) rowBgOverride = '#d1fae5';
        }
        else if (fr?.measure) {
          rowFill = fr.additiveColor || '#e85d04';
          prefix = `[${fr.additiveShort || 'FA'}] `;
          rowBgOverride = `${fr.additiveColor || '#e85d04'}12`;
        }
      } else if (i === 0) {
        rowFill = '#6b7280'; prefix = '🔑 ';
      }

      if (rowBgOverride) {
        g.appendChild(this._svgEl('rect', {
          x: x + 1, y: rowY0, width: w - 2, height: this.BOX_ROW_H, fill: rowBgOverride
        }));
      }

      // Left colour stripe for measures
      if (isFact && factRows && factRows[i]?.measure) {
        g.appendChild(this._svgEl('rect', {
          x: x + 1, y: rowY0, width: 3, height: this.BOX_ROW_H,
          fill: factRows[i].additiveColor || '#e85d04'
        }));
      }

      const txt = this._svgEl('text', {
        x: x + 12, y: ry,
        fill: rowFill, 'font-size': '11', 'font-family': 'monospace'
      });
      const fullText = prefix + row;
      txt.textContent = fullText.length > 30 ? fullText.slice(0, 28) + '…' : fullText;
      g.appendChild(txt);
    });

    svg.appendChild(g);
  },

  _setBreadcrumb(event) {
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;
    const found = Storage.getEvent(event.id);
    if (!found) return;
    const { project } = found;
    bc.innerHTML = `
      <a href="#projects">Projects</a>
      <span class="bc-sep">›</span>
      <a href="#project/${project.id}">${this._esc(project.name)}</a>
      <span class="bc-sep">›</span>
      <a href="#event/${event.id}">${this._esc(event.name)}</a>
      <span class="bc-sep">›</span>
      <span>Diagram</span>
    `;
  },

  _initPanZoom(container, svg) {
    let scale = 1, panX = 0, panY = 0;
    let dragging = false, startX, startY, startPanX, startPanY;

    const apply = () => {
      svg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      svg.style.transformOrigin = '50% 50%';
    };

    container.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      scale = Math.min(3, Math.max(0.3, scale + delta));
      apply();
    }, { passive: false });

    container.addEventListener('mousedown', e => {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startPanX = panX; startPanY = panY;
      container.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      apply();
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
      container.style.cursor = 'grab';
    });

    document.getElementById('zoomIn').onclick = () => { scale = Math.min(3, scale + 0.15); apply(); };
    document.getElementById('zoomOut').onclick = () => { scale = Math.max(0.3, scale - 0.15); apply(); };
    document.getElementById('zoomReset').onclick = () => { scale = 1; panX = 0; panY = 0; apply(); };
  },

  _svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  },

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
