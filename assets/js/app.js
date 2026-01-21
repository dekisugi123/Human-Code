(function(){
  const STORAGE_KEY = 'cog_proto_v1';

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { pages: {} };
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object') return { pages: {} };
      if(!parsed.pages) parsed.pages = {};
      return parsed;
    }catch(e){
      return { pages: {} };
    }
  }

  function saveState(state){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function savePage(pageId, pageData){
    const state = loadState();
    state.pages = state.pages || {};
    state.pages[pageId] = pageData;
    saveState(state);
  }

  function loadPage(pageId){
    const state = loadState();
    return (state.pages && state.pages[pageId]) ? state.pages[pageId] : null;
  }

  function resetAll(){
    localStorage.removeItem(STORAGE_KEY);
  }

  function resetPage(pageId){
    const state = loadState();
    if(state.pages && state.pages[pageId]){
      delete state.pages[pageId];
      saveState(state);
    }
  }

  window.AppStorage = { loadState, saveState, savePage, loadPage, resetAll, resetPage };
})();
