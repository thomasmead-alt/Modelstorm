const Router = {
  _routes: [],

  register(pattern, handler) {
    this._routes.push({ pattern: pattern.split('/'), handler });
  },

  navigate(hash) {
    window.location.hash = hash;
  },

  init() {
    window.addEventListener('hashchange', () => this._handle());
    this._handle();
  },

  _handle() {
    const hash = (window.location.hash.slice(1) || 'projects').split('?')[0];
    const parts = hash.split('/');

    for (const route of this._routes) {
      const params = this._match(route.pattern, parts);
      if (params !== null) {
        this._updateNav(parts[0]);
        route.handler(params);
        return;
      }
    }

    // Fallback
    this.navigate('projects');
  },

  _match(pattern, parts) {
    if (pattern.length !== parts.length) return null;
    const params = {};
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i].startsWith(':')) {
        params[pattern[i].slice(1)] = parts[i];
      } else if (pattern[i] !== parts[i]) {
        return null;
      }
    }
    return params;
  },

  _updateNav(activeSection) {
    document.querySelectorAll('.nav-item[data-section]').forEach(el => {
      el.classList.toggle('active', el.dataset.section === activeSection);
    });
  }
};
