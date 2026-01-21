(function(){
  const STORAGE_KEY = 'cogproto_v1';
  const LANG_KEY = 'cogproto_lang';

  function safeJSONParse(s, fallback){
    try { return JSON.parse(s); } catch(e){ return fallback; }
  }

  const AppStorage = {
    loadAll(){
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? safeJSONParse(raw, {}) : {};
    },
    saveAll(obj){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj || {}));
    },
    loadPage(pageId){
      const all = this.loadAll();
      return all[pageId] || null;
    },
    savePage(pageId, payload){
      const all = this.loadAll();
      all[pageId] = payload;
      this.saveAll(all);
    },
    resetPage(pageId){
      const all = this.loadAll();
      delete all[pageId];
      this.saveAll(all);
    }
  };

  async function loadJSON(path){
    const res = await fetch(path, { cache: 'no-store' });
    if(!res.ok) throw new Error('Failed to load JSON: ' + path);
    return await res.json();
  }

  const App = {
    _uiPaths: null,
    _ui: {},
    _lang: null,

    init({ ui }){
      this._uiPaths = ui;
      this._lang = this.getLang();
      return this.reloadUI();
    },

    async reloadUI(){
      const lang = this.getLang();
      const uiPath = this._uiPaths && this._uiPaths[lang];
      if(!uiPath) throw new Error('Missing UI path for lang: ' + lang);
      this._ui = await loadJSON(uiPath);
    },

    getLang(){
      const v = localStorage.getItem(LANG_KEY);
      return (v === 'vi' || v === 'en') ? v : 'en';
    },

    async setLang(lang){
      if(lang !== 'en' && lang !== 'vi') return;
      localStorage.setItem(LANG_KEY, lang);
      this._lang = lang;
    },

    t(key, fallback){
      if(this._ui && Object.prototype.hasOwnProperty.call(this._ui, key)){
        return this._ui[key];
      }
      return fallback ?? key;
    },

    applyI18n(root){
      const nodes = (root || document).querySelectorAll('[data-i18n]');
      nodes.forEach(el => {
        const k = el.getAttribute('data-i18n');
        if(!k) return;
        el.textContent = this.t(k, el.textContent);
      });
    },

    el(tag, attrs, children){
      const node = document.createElement(tag);
      if(attrs){
        Object.entries(attrs).forEach(([k,v]) => {
          if(k === 'class') node.className = v;
          else if(k === 'text') node.textContent = v;
          else node.setAttribute(k, v);
        });
      }
      if(children){
        children.forEach(ch => node.appendChild(ch));
      }
      return node;
    },

    loadJSON,
    AppStorage
  };

  window.App = App;
  window.AppStorage = AppStorage;
})();
