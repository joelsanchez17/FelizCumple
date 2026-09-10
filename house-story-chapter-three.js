/* Tercer capítulo privado: preparar y personalizar un rincón seguro. */
(() => {
  'use strict';
  const STORY_ASSET_BASE = new URL('./assets/story/', document.currentScript?.src || location.href).href;
  const CORNERS = {
    bed:{ label:'Cerca de la cama', room:'bedroom', short:'La cama' },
    sofa:{ label:'Junto al sillón', room:'dining', short:'El sillón' },
    window:{ label:'Cerca de la ventana', room:'bedroom', short:'La ventana' }
  };
  const ITEM_ORDER = ['blanket','cushion','light'];
  const ITEMS = {
    blanket:{ label:'Mantita', asset:`${STORY_ASSET_BASE}corner-blanket.png`, heading:'Primero, algo calentito', action:'Extender la mantita', hint:'Suave y abrigadita', feedback:'La mantita ya quedó lista para recibirlo.', slots:['left','center','right'] },
    cushion:{ label:'Almohadón', asset:`${STORY_ASSET_BASE}corner-cushion.png`, heading:'Ahora, un lugar cómodo', action:'Acomodar el almohadón', hint:'Para apoyar esas orejitas', feedback:'Mucho mejor. Ya parece un rincón para quedarse.', slots:['left','center','right'] },
    light:{ label:'Luz cálida', asset:`${STORY_ASSET_BASE}corner-lamp.png`, heading:'El último detalle', action:'Encender la luz cálida', hint:'Una lucecita para que no esté solito', feedback:'Listo. La luz quedó prendida para cuando llegue.', slots:['left','right'] }
  };
  const CURATED_SLOTS = {
    bed:{ blanket:'left', cushion:'center', light:'right' },
    sofa:{ blanket:'left', cushion:'center', light:'right' },
    window:{ blanket:'center', cushion:'right', light:'left' }
  };
  let state = { available:false };
  let cornerState = { corner:null, placedItems:[], placements:{} };
  let activeItem = null;
  let root = null;
  let booted = false;
  let transitionTimer = null;
  let lastPlaced = null;

  const engine = () => window.HouseStoryEngine;
  const house = () => document.querySelector('#loveHouse');
  const placed = item => cornerState.placedItems?.includes(item) && ITEMS[item].slots.includes(cornerState.placements?.[item]);
  const slotFor = item => cornerState.placements?.[item] || 'center';

  function normalizeCorner(data) {
    return { corner:data?.corner || null, placedItems:data?.placedItems || [], placements:data?.placements || {} };
  }

  function ensureRoot() {
    root = document.querySelector('#houseStoryChapter');
    if (root) { root.hidden = false; return root; }
    root = document.createElement('section');
    root.id = 'houseStoryChapter';
    root.className = 'house-story-chapter';
    root.setAttribute('aria-live','polite');
    house()?.prepend(root);
    return root;
  }

  function visitCorner(corner) {
    const room = CORNERS[corner]?.room;
    document.querySelector(`[data-enter-room="${room}"]`)?.click();
  }

  function miniCorner(key, corner) {
    return `<span class="house-story-corner-mini" data-corner="${key}" aria-hidden="true"><i></i><b></b></span><strong>${corner.short}</strong><small>${corner.room === 'dining' ? 'Comedor' : 'Dormitorio'}</small>`;
  }

  function cornerScene({ complete = false } = {}) {
    const corner = cornerState.corner || 'bed';
    const props = ITEM_ORDER.filter(placed).map(item => `<span class="house-story-image-prop house-story-image-${item} ${lastPlaced === item ? 'is-new' : ''}" data-slot="${slotFor(item)}" aria-hidden="true"><img src="${ITEMS[item].asset}" alt=""></span>`).join('');
    return `<div class="house-story-corner-scene ${complete ? 'is-complete' : ''} ${placed('cushion') ? 'has-cushion' : ''}" data-corner="${corner}" aria-label="Rincón ${CORNERS[corner].label.toLowerCase()}">
      <div class="house-story-scene-wall"><span></span><span></span><span></span></div>
      <div class="house-story-scene-furniture"><i></i><b></b></div>
      ${props}
    </div>`;
  }

  function renderChoose() {
    const panel = ensureRoot();
    panel.dataset.storyView = 'chapter-three-choose';
    panel.innerHTML = `<article class="house-story-hud house-story-corner" aria-labelledby="houseStoryCornerTitle">
      <div class="house-story-hud-head"><div><small>PASO 1 · ELEGIR EL RINCÓN</small><h3 id="houseStoryCornerTitle">¿Dónde lo preparamos?</h3></div></div>
      <p class="house-story-feedback">Elegí el lugar que te guste más. Después lo vamos a preparar paso a paso.</p>
      <div class="house-story-corner-options">${Object.entries(CORNERS).map(([key,value]) => `<button type="button" data-story-corner="${key}">${miniCorner(key,value)}</button>`).join('')}</div>
    </article>`;
  }

  function renderArrange() {
    const panel = ensureRoot();
    const count = ITEM_ORDER.filter(placed).length;
    if (!activeItem) activeItem = ITEM_ORDER.find(item => !placed(item)) || 'blanket';
    const item = ITEMS[activeItem];
    const prior = count ? ITEMS[ITEM_ORDER[Math.min(count - 1, ITEM_ORDER.length - 1)]].feedback : `Elegiste ${CORNERS[cornerState.corner].label.toLowerCase()}. Empecemos despacito.`;
    panel.dataset.storyView = 'chapter-three-arrange';
    panel.innerHTML = `<article class="house-story-hud house-story-corner" aria-labelledby="houseStoryCornerTitle">
      <div class="house-story-hud-head"><div><small>PASO ${count + 1} DE 3</small><h3 id="houseStoryCornerTitle">${item.heading}</h3></div><strong>${count}/3</strong></div>
      <p class="house-story-feedback">${prior}</p>
      <div class="house-story-step-progress" aria-label="Paso ${count + 1} de 3">${ITEM_ORDER.map((entry,index) => `<i class="${placed(entry) ? 'is-done' : index === count ? 'is-current' : ''}"></i>`).join('')}</div>
      ${cornerScene()}
      <button type="button" class="house-story-place-card" data-story-place-item="${activeItem}">
        <span class="house-story-place-image"><img src="${item.asset}" alt="${item.label}"></span>
        <span class="house-story-place-copy"><small>${item.hint}</small><strong>${item.action}</strong></span>
        <span class="house-story-place-arrow" aria-hidden="true">›</span>
      </button>
      <button type="button" class="house-story-change-link" data-story-change-corner>Cambiar el rincón</button>
    </article>`;
  }

  function renderReview() {
    const panel = ensureRoot();
    activeItem = null;
    panel.dataset.storyView = 'chapter-three-review';
    panel.innerHTML = `<article class="house-story-hud house-story-corner" aria-labelledby="houseStoryCornerTitle">
      <div class="house-story-hud-head"><div><small>REVISÁ TU RINCÓN</small><h3 id="houseStoryCornerTitle">¿Te gusta cómo quedó?</h3></div><strong>3/3</strong></div>
      <p class="house-story-feedback">Fuiste sumando cada detalle. Así quedó el rincón que preparaste.</p>
      ${cornerScene()}
      <div class="house-story-review-confirm"><span>Cuando quede como te gusta, guardalo para seguir.</span><button type="button" class="house-story-finish-button" data-story-finish-corner>Así me gusta</button></div>
      <button type="button" class="house-story-change-link" data-story-change-corner>Cambiar el rincón</button>
    </article>`;
    requestAnimationFrame(() => {
      const confirm = panel.querySelector('.house-story-review-confirm');
      confirm?.scrollIntoView({ block:'nearest', behavior:'smooth' });
      panel.querySelector('[data-story-finish-corner]')?.focus({ preventScroll:true });
    });
  }

  function renderComplete() {
    const panel = ensureRoot();
    activeItem = null;
    panel.dataset.storyView = 'chapter-complete';
    panel.innerHTML = `<article class="house-story-complete house-story-corner-finish" tabindex="-1">
      <small>TERMINASTE ESTA PARTE</small>
      <h3>El rincón quedó preparado por vos.</h3>
      <p>Fuiste agregando cada detalle y la casa lo guardó así. No era una prueba: estabas haciendo lugar para alguien que todavía no llegó.</p>
      ${cornerScene({ complete:true })}
      <p class="house-story-next-note"><strong>¿Qué sigue?</strong> La próxima parte va a abrir lo que la casa estuvo cuidando. Todavía está en construcción en esta vista previa.</p>
      <button type="button" data-story-return-room>Volver a recorrer la casa</button>
    </article>`;
    const finish = panel.querySelector('.house-story-complete');
    finish?.focus();
    finish?.scrollIntoView({ block:'start', behavior:'smooth' });
  }

  function render() {
    if (!state.available || state.status !== 'active') return;
    if (state.storyData) cornerState = normalizeCorner(state.storyData);
    if (state.chapter > 3) {
      if (root) root.innerHTML = '';
      return;
    }
    if (state.chapter === 3) {
      if (sessionStorage.getItem('house_story_chapter_two_closed') === '1') {
        if (!cornerState.corner) renderChoose();
        else if (ITEM_ORDER.every(placed) && !activeItem) renderReview();
        else renderArrange();
      } else {
        clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => {
          sessionStorage.setItem('house_story_chapter_two_closed','1');
          render();
        }, 1400);
      }
    }
  }

  async function choose(corner, button) {
    button.disabled = true;
    try {
      const next = await engine().chooseCorner(corner);
      state = next;
      if (next.storyData) cornerState = normalizeCorner(next.storyData);
      if (!next.pending) { activeItem = ITEM_ORDER.find(item => !placed(item)) || null; lastPlaced = null; render(); }
    } catch (_error) { button.disabled = false; button.textContent = 'Intentar otra vez'; }
  }

  async function place(item, button) {
    if (!item || item !== activeItem || state.chapter !== 3) return;
    const slot = CURATED_SLOTS[cornerState.corner]?.[item] || 'center';
    button.disabled = true;
    try {
      const next = await engine().placeCornerItem(item, slot);
      state = next;
      if (next.storyData) cornerState = normalizeCorner(next.storyData);
      lastPlaced = item;
      activeItem = ITEM_ORDER.find(candidate => !placed(candidate)) || null;
      render();
    } catch (_error) {
      button.disabled = false;
      button.querySelector('.house-story-place-copy strong').textContent = 'Intentar otra vez';
    }
  }

  async function finish(button) {
    button.disabled = true;
    button.textContent = 'Guardando…';
    try {
      const next = await engine().finishCorner();
      state = next;
      if (next.storyData) cornerState = normalizeCorner(next.storyData);
      render();
    } catch (_error) {
      button.disabled = false;
      button.textContent = 'Intentar guardar otra vez';
    }
  }

  function bind() {
    document.addEventListener('click', event => {
      const corner = event.target.closest('[data-story-corner]');
      if (corner) return void choose(corner.dataset.storyCorner, corner);
      const item = event.target.closest('[data-story-place-item]');
      if (item) return void place(item.dataset.storyPlaceItem, item);
      if (event.target.closest('[data-story-finish-corner]')) return void finish(event.target.closest('[data-story-finish-corner]'));
      if (event.target.closest('[data-story-change-corner]')) { activeItem = null; lastPlaced = null; renderChoose(); return; }
      if (event.target.closest('[data-story-return-room]')) { ensureRoot().hidden = true; visitCorner(cornerState.corner); }
    }, true);
  }

  async function boot() {
    if (booted || !house() || !engine()) return;
    booted = true;
    bind();
    try {
      state = await engine().load();
      if (state.chapter >= 3) cornerState = normalizeCorner(await engine().loadCorner());
      render();
    } catch (_error) { booted = false; }
  }

  window.addEventListener('housestorychange', event => { state = event.detail || {available:false}; render(); });
  window.addEventListener('loveidentityready', boot);
  if (window.loveIdentity && window.HouseStoryEngine) boot();
})();
