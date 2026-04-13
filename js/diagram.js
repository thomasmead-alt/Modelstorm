const Diagram = {
  BOX_HEADER_H: 32,
  BOX_ROW_H: 22,
  BOX_PADDING: 10,

  render(event) {
    const app = document.getElementById('app');
    const dimTemplates = (typeof Storage !== 'undefined' && Storage.getAllDimTemplates)
      ? Storage.getAllDimTemplates() : [];
    const measures = (event.columns || []).filter(c => c.category === 'how_many');

    // ── Build dimension entries ─────────────────────────────
    // Pass 1: conformed FK columns → one box per unique dimension template (snowflake)
    const dimEntries = [];
    const seenDimIds = new Set();

    (event.columns || [])
      .filter(c => c.category !== 'how_many' && c.isConformed && c.publicDimensionId)
      .forEach(col => {
        if (seenDimIds.has(col.publicDimensionId)) return;
        seenDimIds.add(col.publicDimensionId);
        const tmpl = dimTemplates.find(d => d.id === col.publicDimensionId);
        const catInfo = (typeof CATEGORIES !== 'undefined' && CATEGORIES[col.category])
          || { label: col.category, color: '#6b7280' };
        const boxTitle = tmpl ? tmpl.name : col.name;
        const rows = tmpl && (tmpl.columns || []).length > 0
          ? (tmpl.columns || []).map(c => ({
              text: `${c.name}  ${c.dataType || 'VARCHAR'}`,
              full: `${c.name} [${c.dataType || 'VARCHAR'}]`,
              isKey: !!(c.isKey || c.isSurrogateKey)
            }))
          : [{ text: `${col.name}  ${col.dataType || 'INT'}`, full: col.name, isKey: true }];
        dimEntries.push({ cat: col.category, catInfo, boxTitle, isConformed: true, fkCol: col, rows });
      });

    // Pass 2: non-conformed columns → group by category
    const nonConformed = {};
    (event.columns || [])
      .filter(c => c.category !== 'how_many' && !(c.isConformed && c.publicDimensionId))
      .forEach(col => {
        if (!nonConformed[col.category]) nonConformed[col.category] = [];
        nonConformed[col.category].push(col);
      });

    Object.entries(nonConformed).forEach(([cat, cols]) => {
      const catInfo = (typeof CATEGORIES !== 'undefined' && CATEGORIES[cat])
        || { label: cat, color: '#6b7280' };
      const pkCol = cols.find(c => c.isSurrogateKey || c.isNaturalKey);
      const pkName = pkCol ? pkCol.name : `${cat}_key`;
      const rows = [
        { text: pkName, full: `${pkName} (PK)`, isKey: true },
        ...cols.map(c => {
          const roleTag = (c.dateKeyRole && typeof DATE_KEY_ROLES !== 'undefined' && DATE_KEY_ROLES[c.dateKeyRole])
            ? ` (${DATE_KEY_ROLES[c.dateKeyRole].label})` : '';
          return {
            text: `${c.name}  ${c.dataType || 'VARCHAR'}${roleTag}`,
            full: `${c.name} [${c.dataType || 'VARCHAR'}]${roleTag}`,
            isKey: false,
            isAnchor: !!c.isFinancialAnchor,
            catColor: catInfo.color
          };
        })
      ];
      dimEntries.push({ cat, catInfo, boxTitle: catInfo.label, isConformed: false, fkCol: cols[0], rows });
    });

    // ── Build fact table rows ───────────────────────────────
    const grain = event.grain || 'transaction';
    const grainInfo = (typeof GRAINS !== 'undefined' && GRAINS[grain])
      || { label: grain, color: '#6b7280' };
    const purpose = event.eventPurpose || 'actuals';
    const purposeInfo = (typeof EVENT_PURPOSES !== 'undefined' && EVENT_PURPOSES[purpose]) || null;

    const factRows = [];
    factRows.push({ text: 'event_key', full: 'event_key (surrogate PK)', key: true });
    factRows.push({ text: `Grain: ${grainInfo.label}`, full: `Grain: ${grainInfo.label}`, grain: true, color: grainInfo.color });
    if (purposeInfo && purpose !== 'actuals') {
      factRows.push({ text: `Purpose: ${purposeInfo.label}`, full: `Purpose: ${purposeInfo.label}`, grain: true, color: purposeInfo.color });
    }

    dimEntries.forEach(entry => {
      const fkCol = entry.fkCol;
      const colName = (fkCol && fkCol.name) ? fkCol.name : `${entry.cat}_key`;
      const dateRole = (fkCol && fkCol.dateKeyRole && typeof DATE_KEY_ROLES !== 'undefined' && DATE_KEY_ROLES[fkCol.dateKeyRole])
        ? ` [${DATE_KEY_ROLES[fkCol.dateKeyRole].label}]` : '';
      factRows.push({
        text: `${colName}${dateRole}`,
        full: `${colName} → ${entry.boxTitle}${dateRole}`,
        fk: true,
        isAnchor: !!(fkCol && fkCol.isFinancialAnchor),
        catColor: entry.catInfo.color
      });
    });

    measures.forEach(m => {
      const at = m.additiveType || 'fully_additive';
      const atInfo = (typeof ADDITIVE_TYPES !== 'undefined' && ADDITIVE_TYPES[at])
        || { short: 'FA', color: '#166534' };
      const glTag = m.glAccount ? ` GL:${m.glAccount}` : '';
      factRows.push({
        text: `${m.name}${glTag}`,
        full: `${m.name} [${m.dataType || 'DECIMAL'}]${glTag}`,
        measure: true,
        additiveShort: atInfo.short,
        additiveColor: atInfo.color,
        budgetControl: !!m.budgetControl
      });
    });

    // ── Two-zone layout sizing ──────────────────────────────
    const conformedEntries = dimEntries.filter(e => e.isConformed);
    const catEntries       = dimEntries.filter(e => !e.isConformed);
    const hasBothZones = conformedEntries.length > 0 && catEntries.length > 0;

    const outerOrbit = hasBothZones
      ? Math.max(310, conformedEntries.length * 65)
      : Math.max(250, dimEntries.length * 58);
    const innerOrbit = hasBothZones
      ? Math.max(185, catEntries.length * 52)
      : outerOrbit;

    const W = Math.max(920, 2 * outerOrbit + 520);
    const H = Math.max(620, 2 * outerOrbit + 420);
    const cx = W / 2, cy = H / 2;

    // Position entries on their respective orbits
    const place = (entries, radius, angleOffset) =>
      entries.map((entry, i) => {
        const angle = (2 * Math.PI * i / entries.length) - Math.PI / 2 + angleOffset;
        return { ...entry, bx: cx + radius * Math.cos(angle), by: cy + radius * Math.sin(angle) };
      });

    // Stagger inner-ring angle so boxes don't overlap with outer ring
    const innerOffset = hasBothZones && conformedEntries.length > 0
      ? Math.PI / conformedEntries.length : 0;
    const dimBoxes = [
      ...place(conformedEntries, outerOrbit, 0),
      ...place(catEntries, innerOrbit, innerOffset)
    ];

    // ── Adaptive box widths ─────────────────────────────────
    const estW = (rows, minW) => {
      const maxLen = rows.reduce((m, r) => Math.max(m, (r.text || r).length), 0);
      return Math.min(290, Math.max(minW, maxLen * 7 + 60));
    };

    // ── Fact box ────────────────────────────────────────────
    const factBoxW = estW(factRows, 240);
    const factBoxH = this.BOX_HEADER_H + factRows.length * this.BOX_ROW_H + this.BOX_PADDING;
    const factX = cx - factBoxW / 2;
    const factY = cy - factBoxH / 2;

    // ── Render HTML shell ───────────────────────────────────
    const hasConformed = conformedEntries.length > 0;
    const bannerText = hasConformed
      ? `<strong>Snowflake Schema</strong> — Conformed dimensions (outer ring, coloured halo) are shared tables linked by FK. Inner ring shows event-specific category groups. Hover rows to see full names.`
      : `<strong>Star Schema</strong> — The fact table holds your measures and foreign keys. Each dimension ring captures descriptive context. Hover rows for full column names.`;

    app.innerHTML = `
      <div class="view-header">
        <div class="breadcrumb" id="breadcrumb"></div>
        <div class="view-actions">
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('event/${event.id}')">← Back to Matrix</button>
        </div>
      </div>

      <div class="info-banner" id="diagramBanner">
        <button class="info-banner-close" onclick="this.parentElement.style.display='none'" title="Dismiss">✕</button>
        ${bannerText}
      </div>

      ${event.description ? `<p class="diagram-desc">${this._esc(event.description)}</p>` : ''}

      <div class="diagram-toolbar">
        <button class="btn btn-ghost btn-sm" id="zoomIn">+ Zoom In</button>
        <button class="btn btn-ghost btn-sm" id="zoomOut">− Zoom Out</button>
        <button class="btn btn-ghost btn-sm" id="zoomReset">Reset</button>
        <span class="diagram-hint">Drag to pan · Scroll to zoom</span>
      </div>

      <div class="diagram-container" id="diagramContainer">
        <svg id="diagramSvg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"></svg>
      </div>
    `;

    this._setBreadcrumb(event);
    const svg = document.getElementById('diagramSvg');

    // ── Draw connectors first (behind boxes) ────────────────
    dimBoxes.forEach(dim => {
      const dimW = estW(dim.rows, dim.isConformed ? 220 : 190);
      const dimH = this.BOX_HEADER_H + dim.rows.length * this.BOX_ROW_H + this.BOX_PADDING;
      const dx = dim.bx - cx, dy = dim.by - cy;
      const p1 = this._edgePoint(cx, cy, factBoxW / 2, factBoxH / 2, dx, dy);
      const p2 = this._edgePoint(dim.bx, dim.by, dimW / 2, dimH / 2, -dx, -dy);

      svg.appendChild(this._svgEl('line', {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: dim.isConformed ? dim.catInfo.color : '#9ca3af',
        'stroke-width': dim.isConformed ? '2.5' : '1.5',
        'stroke-dasharray': dim.isConformed ? 'none' : '5,4',
        'stroke-opacity': dim.isConformed ? '0.8' : '1',
        class: 'connector'
      }));
    });

    // ── Draw dim boxes ──────────────────────────────────────
    dimBoxes.forEach(dim => {
      const dimW = estW(dim.rows, dim.isConformed ? 220 : 190);
      const dimH = this.BOX_HEADER_H + dim.rows.length * this.BOX_ROW_H + this.BOX_PADDING;
      this._drawBox(svg, {
        x: dim.bx - dimW / 2, y: dim.by - dimH / 2,
        w: dimW, h: dimH,
        title: dim.boxTitle,
        titleColor: dim.catInfo.color,
        rows: dim.rows,
        isConformed: dim.isConformed,
        isFact: false
      });
    });

    // ── Draw fact box ───────────────────────────────────────
    this._drawBox(svg, {
      x: factX, y: factY, w: factBoxW, h: factBoxH,
      title: event.name,
      titleColor: '#1c1c28',
      rows: factRows,
      isFact: true, factRows
    });

    // ── Inline legend ───────────────────────────────────────
    this._drawLegend(svg, W, H, hasConformed);

    // ── Empty state ─────────────────────────────────────────
    if (dimEntries.length === 0 && measures.length === 0) {
      const txt = this._svgEl('text', {
        x: cx, y: cy, 'text-anchor': 'middle', fill: '#9ca3af', 'font-size': '14'
      });
      txt.textContent = 'Add columns to the BEAM matrix to generate a diagram.';
      svg.appendChild(txt);
    }

    this._initPanZoom(document.getElementById('diagramContainer'), svg);
  },

  // Returns the point on a box edge (centred at boxCX,boxCY, half-dims hw×hh)
  // in the direction (dx,dy).
  _edgePoint(boxCX, boxCY, hw, hh, dx, dy) {
    if (dx === 0 && dy === 0) return { x: boxCX, y: boxCY };
    const t = dx === 0 ? hh / Math.abs(dy)
            : dy === 0 ? hw / Math.abs(dx)
            : Math.min(hw / Math.abs(dx), hh / Math.abs(dy));
    return { x: boxCX + dx * t, y: boxCY + dy * t };
  },

  _drawBox(svg, { x, y, w, h, title, titleColor, rows, isFact, factRows, isConformed }) {
    const g = this._svgEl('g', { class: isFact ? 'fact-box' : (isConformed ? 'conformed-box' : 'dim-box') });
    const hH = this.BOX_HEADER_H;

    // Outer halo for conformed dims — signals "shared external table"
    if (isConformed) {
      g.appendChild(this._svgEl('rect', {
        x: x - 5, y: y - 5, width: w + 10, height: h + 10,
        rx: 10, fill: titleColor, opacity: '0.15'
      }));
    }

    // Drop shadow
    const sOff = isConformed ? 4 : 3;
    const sOpa = isFact ? '0.10' : (isConformed ? '0.10' : '0.06');
    g.appendChild(this._svgEl('rect', {
      x: x + sOff, y: y + sOff, width: w, height: h,
      rx: 6, fill: `rgba(0,0,0,${sOpa})`
    }));

    // Box background + border
    const strokeColor = isFact ? '#e85d04' : (isConformed ? titleColor : '#d1d5db');
    const strokeWidth = (isFact || isConformed) ? '2' : '1.5';
    g.appendChild(this._svgEl('rect', {
      x, y, width: w, height: h, rx: 6, fill: '#ffffff',
      stroke: strokeColor, 'stroke-width': strokeWidth
    }));

    // Header bar
    g.appendChild(this._svgEl('rect', { x, y, width: w, height: hH, rx: 6, fill: titleColor }));
    g.appendChild(this._svgEl('rect', { x, y: y + hH - 6, width: w, height: 6, fill: titleColor }));

    // Title text — leave room for "◈ shared" badge on conformed
    const reservedRight = isConformed ? 52 : 0;
    const maxTitleChars = Math.floor((w - 16 - reservedRight) / 7);
    const truncTitle = title.length > maxTitleChars ? title.slice(0, maxTitleChars - 1) + '…' : title;
    const titleEl = this._svgEl('text', {
      x: x + 8, y: y + hH / 2 + 5,
      fill: '#ffffff', 'font-size': '12', 'font-weight': '600',
      'font-family': 'system-ui, -apple-system, sans-serif'
    });
    titleEl.textContent = truncTitle;
    if (title !== truncTitle) titleEl.appendChild(this._mkTitle(title));
    g.appendChild(titleEl);

    // "◈ shared" label for conformed dims
    if (isConformed) {
      const sharedEl = this._svgEl('text', {
        x: x + w - 6, y: y + hH / 2 + 5,
        'text-anchor': 'end', fill: 'rgba(255,255,255,0.75)',
        'font-size': '9', 'font-style': 'italic',
        'font-family': 'system-ui, -apple-system, sans-serif'
      });
      sharedEl.textContent = '◈ shared';
      g.appendChild(sharedEl);
    }

    // Divider
    g.appendChild(this._svgEl('line', {
      x1: x, y1: y + hH, x2: x + w, y2: y + hH,
      stroke: '#e5e7eb', 'stroke-width': '1'
    }));

    // Rows
    rows.forEach((row, i) => {
      const rowY0 = y + hH + this.BOX_PADDING / 2 + i * this.BOX_ROW_H;
      const ry    = rowY0 + this.BOX_ROW_H * 0.72;
      const fr    = (isFact && factRows) ? factRows[i] : null;

      // Semantics
      const isKey     = fr ? !!fr.key     : !!row.isKey;
      const isGrain   = fr ? !!fr.grain   : false;
      const isFKRow   = fr ? !!fr.fk      : false;
      const isMeasure = fr ? !!fr.measure : false;
      const isAnchor  = fr ? !!fr.isAnchor : !!row.isAnchor;
      const catColor  = fr ? fr.catColor  : row.catColor;

      // Row background
      let rowBg = i % 2 === 0 ? '#f9fafb' : null;
      let rowFill = '#374151';

      if (isKey)     { rowFill = '#6b7280'; }
      if (isGrain)   { rowFill = fr.color || '#6b7280'; rowBg = `${fr.color}1a`; }
      if (isFKRow)   { rowFill = isAnchor ? '#065f46' : (catColor || '#4a6cf7'); rowBg = isAnchor ? '#d1fae5' : null; }
      if (isMeasure) { rowFill = fr.additiveColor || '#e85d04'; rowBg = `${fr.additiveColor || '#e85d04'}12`; }

      if (rowBg) {
        g.appendChild(this._svgEl('rect', {
          x: x + 1, y: rowY0, width: w - 2, height: this.BOX_ROW_H, fill: rowBg
        }));
      }

      // Left colour stripe for FK rows and measures
      const stripeColor = isMeasure ? (fr.additiveColor || '#e85d04')
        : isFKRow ? (isAnchor ? '#065f46' : (catColor || '#4a6cf7'))
        : null;
      if (stripeColor) {
        g.appendChild(this._svgEl('rect', {
          x: x + 1, y: rowY0, width: 3, height: this.BOX_ROW_H, fill: stripeColor
        }));
      }

      // Text
      const rawText  = fr ? fr.text  : (row.text  || row);
      const fullText = fr ? fr.full  : (row.full  || row.text || row);
      const xOff     = stripeColor ? 10 : 7;
      const maxChars = Math.floor((w - xOff - 45) / 7); // leave room for right badge
      const dispText = rawText && rawText.length > maxChars
        ? rawText.slice(0, maxChars - 1) + '…' : (rawText || '');

      const txt = this._svgEl('text', {
        x: x + xOff, y: ry,
        fill: rowFill, 'font-size': '11',
        'font-family': 'system-ui, -apple-system, sans-serif'
      });
      txt.textContent = dispText;
      if (fullText && fullText !== dispText) txt.appendChild(this._mkTitle(fullText));
      g.appendChild(txt);

      // Right-aligned badge: PK label or FA/SA/NA
      const badgeRightX = x + w - 4;
      if (isKey) {
        this._drawBadge(g, badgeRightX, rowY0, 'PK', '#e5e7eb', '#6b7280');
      } else if (isMeasure && fr) {
        const s = fr.additiveShort || 'FA';
        const bg = s === 'FA' ? '#dcfce7' : s === 'SA' ? '#fef3c7' : '#fee2e2';
        const fg = s === 'FA' ? '#166534' : s === 'SA' ? '#92400e' : '#991b1b';
        this._drawBadge(g, badgeRightX, rowY0, s, bg, fg);
      }
    });

    svg.appendChild(g);
  },

  // Draw a small right-aligned badge chip
  _drawBadge(g, rightX, rowY0, text, bgColor, textColor) {
    const bw = text.length * 6 + 8;
    const bh = 14;
    const bx = rightX - bw;
    const by = rowY0 + (this.BOX_ROW_H - bh) / 2;
    g.appendChild(this._svgEl('rect', { x: bx, y: by, width: bw, height: bh, rx: 3, fill: bgColor }));
    const t = this._svgEl('text', {
      x: bx + bw / 2, y: by + 10, 'text-anchor': 'middle',
      fill: textColor, 'font-size': '9', 'font-weight': '700',
      'font-family': 'system-ui, -apple-system, sans-serif'
    });
    t.textContent = text;
    g.appendChild(t);
  },

  // Inline legend drawn inside the SVG canvas
  _drawLegend(svg, W, H, hasConformed) {
    const items = [
      { type: 'rect', fill: '#1c1c28', stroke: '#e85d04', label: 'Fact table' },
      ...(hasConformed ? [{ type: 'halo', color: '#4a6cf7', label: 'Conformed dim' }] : []),
      { type: 'rect', fill: '#fff', stroke: '#d1d5db', label: 'Category group' },
      ...(hasConformed ? [{ type: 'line', dash: false, color: '#4a6cf7', label: 'Snowflake FK' }] : []),
      { type: 'line', dash: true, color: '#9ca3af', label: 'Category FK' }
    ];

    const ITEM_W = 118;
    const lw = items.length * ITEM_W + 16;
    const lh = 30;
    const lx = 12;
    const ly = H - lh - 12;

    svg.appendChild(this._svgEl('rect', {
      x: lx, y: ly, width: lw, height: lh,
      rx: 4, fill: 'rgba(255,255,255,0.92)', stroke: '#e5e7eb', 'stroke-width': '1'
    }));

    items.forEach((item, i) => {
      const ix = lx + 10 + i * ITEM_W;
      const midY = ly + lh / 2;

      if (item.type === 'rect') {
        svg.appendChild(this._svgEl('rect', {
          x: ix, y: midY - 7, width: 14, height: 14, rx: 2,
          fill: item.fill, stroke: item.stroke, 'stroke-width': '1.5'
        }));
      } else if (item.type === 'halo') {
        svg.appendChild(this._svgEl('rect', {
          x: ix - 3, y: midY - 10, width: 20, height: 20, rx: 5,
          fill: item.color, opacity: '0.18'
        }));
        svg.appendChild(this._svgEl('rect', {
          x: ix, y: midY - 7, width: 14, height: 14, rx: 2,
          fill: '#fff', stroke: item.color, 'stroke-width': '2'
        }));
      } else {
        svg.appendChild(this._svgEl('line', {
          x1: ix, y1: midY, x2: ix + 18, y2: midY,
          stroke: item.color, 'stroke-width': '2',
          'stroke-dasharray': item.dash ? '4,3' : 'none'
        }));
      }

      const lbl = this._svgEl('text', {
        x: ix + (item.type === 'line' ? 23 : 20), y: midY + 4,
        fill: '#6b7280', 'font-size': '10',
        'font-family': 'system-ui, -apple-system, sans-serif'
      });
      lbl.textContent = item.label;
      svg.appendChild(lbl);
    });
  },

  // SVG <title> for hover tooltip
  _mkTitle(text) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = text;
    return t;
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
      <a href="#" onclick="event.preventDefault();Projects.renderEventDetail('${project.id}','${event.id}')">${this._esc(event.name)}</a>
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
      scale = Math.min(3, Math.max(0.3, scale + (e.deltaY > 0 ? -0.1 : 0.1)));
      apply();
    }, { passive: false });
    container.addEventListener('mousedown', e => {
      dragging = true; startX = e.clientX; startY = e.clientY;
      startPanX = panX; startPanY = panY; container.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      apply();
    });
    window.addEventListener('mouseup', () => { dragging = false; container.style.cursor = 'grab'; });
    document.getElementById('zoomIn').onclick    = () => { scale = Math.min(3, scale + 0.15); apply(); };
    document.getElementById('zoomOut').onclick   = () => { scale = Math.max(0.3, scale - 0.15); apply(); };
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
