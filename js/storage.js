const Storage = {
  KEY: 'beam_app',
  LIB_KEY: 'beam_lib',

  // ── Core load/save ────────────────────────────────────────

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      const data = raw ? JSON.parse(raw) : { projects: [] };
      return this._migrate(data);
    } catch (e) {
      return { projects: [] };
    }
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  },

  // ── Backward-compatible migration ────────────────────────
  // Adds new fields with safe defaults to any existing data

  _migrate(data) {
    data.projects = (data.projects || []).map(p => {
      // Project-level new fields
      if (!p.businessAreas) p.businessAreas = [];
      if (!p.plLines) p.plLines = null;
      // Phase 3: responsibility register
      if (!p.responsibilityRegister) p.responsibilityRegister = [];

      p.events = (p.events || []).map(e => {
        // Event-level new fields
        if (!e.grain) e.grain = 'transaction';
        if (!e.businessAreaIds) e.businessAreaIds = [];

        e.columns = (e.columns || []).map(col => {
          // Phase 2: additivity, budget, responsibility, conformed dims
          if (!col.additiveType) col.additiveType = 'fully_additive';
          if (col.requiredGrain === undefined) col.requiredGrain = null;
          if (!col.formula) col.formula = '';
          if (col.budgetControl === undefined) col.budgetControl = false;
          if (!col.plLineId) col.plLineId = '';
          if (!col.responsibilityType) col.responsibilityType = 'none';
          if (!col.publicDimensionId) col.publicDimensionId = '';
          if (col.isConformed === undefined) col.isConformed = false;
          if (!col.notes) col.notes = '';
          // Phase 3: responsibility owner, cash flow, ML tag, SCD
          if (!col.ownerId) col.ownerId = '';
          if (!col.cashFlowLineId) col.cashFlowLineId = '';
          if (col.isCashBased === undefined) col.isCashBased = false;
          if (!col.mlTag) col.mlTag = 'none';
          if (col.scdType === undefined) col.scdType = null;
          if (col.isNaturalKey === undefined) col.isNaturalKey = false;
          if (col.isSurrogateKey === undefined) col.isSurrogateKey = false;
          return col;
        });
        return e;
      });
      return p;
    });
    return data;
  },

  // ── Project helpers ───────────────────────────────────────

  getProject(id) {
    return this.load().projects.find(p => p.id === id) || null;
  },

  saveProject(project) {
    const data = this.load();
    const idx = data.projects.findIndex(p => p.id === project.id);
    if (idx >= 0) data.projects[idx] = project;
    else data.projects.push(project);
    this.save(data);
  },

  deleteProject(id) {
    const data = this.load();
    data.projects = data.projects.filter(p => p.id !== id);
    this.save(data);
  },

  // ── Event helpers ─────────────────────────────────────────

  getEvent(eventId) {
    const data = this.load();
    for (const project of data.projects) {
      const evt = project.events.find(e => e.id === eventId);
      if (evt) return { event: evt, project };
    }
    return null;
  },

  saveEvent(projectId, event) {
    const data = this.load();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return;
    const idx = project.events.findIndex(e => e.id === event.id);
    if (idx >= 0) project.events[idx] = event;
    else project.events.push(event);
    this.save(data);
  },

  deleteEvent(projectId, eventId) {
    const data = this.load();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return;
    project.events = project.events.filter(e => e.id !== eventId);
    this.save(data);
  },

  // ── Business area helpers ─────────────────────────────────

  addBusinessArea(projectId, name, color) {
    const data = this.load();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return null;
    const ba = { id: this.generateId(), name, color: color || '#6b7280' };
    project.businessAreas.push(ba);
    this.save(data);
    return ba;
  },

  deleteBusinessArea(projectId, baId) {
    const data = this.load();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return;
    project.businessAreas = project.businessAreas.filter(b => b.id !== baId);
    // Remove the area from all event assignments
    project.events.forEach(e => {
      e.businessAreaIds = (e.businessAreaIds || []).filter(id => id !== baId);
    });
    this.save(data);
  },

  // ── P&L line helpers ──────────────────────────────────────

  getPlLines(projectId) {
    const project = this.getProject(projectId);
    if (!project) return [];
    // Use project-specific lines if customised, else return DEFAULT_PL_LINES
    return project.plLines || (typeof DEFAULT_PL_LINES !== 'undefined' ? DEFAULT_PL_LINES : []);
  },

  // ── Grain analysis helpers ────────────────────────────────

  // Returns all measures (how_many columns) for an event, enriched with additivity info
  getMeasures(event) {
    return event.columns.filter(c => c.category === 'how_many');
  },

  // Returns all dimension columns for an event
  getDimensions(event) {
    return event.columns.filter(c => c.category !== 'how_many');
  },

  // Returns columns shared by name between two events (potential conformed dimensions)
  getSharedDimensions(eventA, eventB) {
    const dimsA = this.getDimensions(eventA).map(c => c.name.toLowerCase().trim());
    const dimsB = this.getDimensions(eventB);
    return dimsB.filter(c => dimsA.includes(c.name.toLowerCase().trim()));
  },

  // Returns P&L coverage: which plLine IDs have at least one measure assigned
  getPlCoverage(project) {
    const assigned = new Set();
    (project.events || []).forEach(e => {
      (e.columns || []).forEach(c => {
        if (c.plLineId) assigned.add(c.plLineId);
      });
    });
    return assigned;
  },

  // ── Responsibility register helpers ───────────────────────

  addResponsibleParty(projectId, name, role, color, responsibilityType) {
    const data = this.load();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return null;
    const person = { id: this.generateId(), name, role: role || '', color: color || '#4a6cf7', responsibilityType: responsibilityType || 'none' };
    if (!project.responsibilityRegister) project.responsibilityRegister = [];
    project.responsibilityRegister.push(person);
    this.save(data);
    return person;
  },

  deleteResponsibleParty(projectId, personId) {
    const data = this.load();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return;
    project.responsibilityRegister = (project.responsibilityRegister || []).filter(p => p.id !== personId);
    // Remove ownerId from all columns that referenced this person
    (project.events || []).forEach(e => {
      (e.columns || []).forEach(col => { if (col.ownerId === personId) col.ownerId = ''; });
    });
    this.save(data);
  },

  // ── Cash flow line helpers ────────────────────────────────

  getCashFlowLines(projectId) {
    const project = this.getProject(projectId);
    if (!project) return [];
    return project.cashFlowLines || (typeof DEFAULT_CASHFLOW_LINES !== 'undefined' ? DEFAULT_CASHFLOW_LINES : []);
  }
};
