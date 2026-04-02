const Storage = {
  KEY: 'beam_app',

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : { projects: [] };
    } catch (e) {
      return { projects: [] };
    }
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  },

  // Project helpers
  getProject(id) {
    return this.load().projects.find(p => p.id === id) || null;
  },

  saveProject(project) {
    const data = this.load();
    const idx = data.projects.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      data.projects[idx] = project;
    } else {
      data.projects.push(project);
    }
    this.save(data);
  },

  deleteProject(id) {
    const data = this.load();
    data.projects = data.projects.filter(p => p.id !== id);
    this.save(data);
  },

  // Event helpers
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
    if (idx >= 0) {
      project.events[idx] = event;
    } else {
      project.events.push(event);
    }
    this.save(data);
  },

  deleteEvent(projectId, eventId) {
    const data = this.load();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return;
    project.events = project.events.filter(e => e.id !== eventId);
    this.save(data);
  }
};
