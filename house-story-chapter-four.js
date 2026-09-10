/* Cuarto capítulo privado: formar la llave y abrir la caja final. */
(() => {
  'use strict';
  const ASSET_BASE = new URL('./assets/story/', document.currentScript?.src || location.href).href;
  const ROOM_DESTINATIONS = { bedroom:'el dormitorio', kitchen:'la cocina', bathroom:'el baño', dining:'el comedor' };
  let state = { available:false };
  let doorState = { opened:false, openedAt:null };
  let companionState = { revealed:false, growthStage:0, stageName:'tiny' };
  let root = null;
  let booted = false;
  let transitionTimer = null;
  let arrivalTimer = null;

  const engine = () => window.HouseStoryEngine;
  const house = () => document.querySelector('#loveHouse');
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

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

  function renderKey() {
    const panel = ensureRoot();
    panel.dataset.storyView = 'chapter-four-key';
    panel.innerHTML = `<article class="house-story-final house-story-key-scene" aria-labelledby="houseStoryFinalTitle">
      <small>LAS TRES PARTES SE ENCONTRARON</small>
      <h3 id="houseStoryFinalTitle">La casa está armando algo…</h3>
      <div class="house-story-key" aria-label="Tres piezas formando una llave"><i></i><i></i><i></i><b></b></div>
      <p>Un poquito de curiosidad, otro de cuidado y un lugar preparado por vos.</p>
    </article>`;
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      sessionStorage.setItem('house_story_chapter_four_key_ready','1');
      renderBox(false);
    }, 1900);
  }

  function renderBox(opened = doorState.opened) {
    const panel = ensureRoot();
    panel.dataset.storyView = opened ? 'chapter-four-open' : 'chapter-four-box';
    panel.innerHTML = `<article class="house-story-final house-story-box-scene ${opened ? 'is-open' : ''}" aria-labelledby="houseStoryFinalTitle">
      <small>${opened ? 'LA CAJA QUEDÓ ABIERTA' : 'LA LLAVE ENCAJÓ'}</small>
      <h3 id="houseStoryFinalTitle">${opened ? 'Creo que ya encontró lo que buscaba.' : 'Hay algo esperando adentro.'}</h3>
      <div class="house-story-box-wrap">
        <span class="house-story-box-glow" aria-hidden="true"></span>
        <img src="${ASSET_BASE}${opened ? 'final-box-open.png' : 'final-box-closed.png'}" alt="${opened ? 'Una caja de regalo abierta con una luz cálida adentro' : 'Una caja de regalo cerrada con flores y un lazo'}">
      </div>
      ${opened
        ? `<p>Hay alguien muy chiquito escondido adentro.</p><button type="button" data-story-reveal-companion>Ver quién llegó</button>`
        : `<p>La casa bajó la voz. Abrila cuando estés lista.</p><button type="button" data-story-open-box>Abrir despacito</button>`}
    </article>`;
    panel.querySelector('[data-story-open-box],[data-story-reveal-companion]')?.focus?.();
    panel.querySelector('.house-story-final')?.scrollIntoView({ block:'start', behavior:'smooth' });
  }

  function renderArrival(settled = true) {
    const panel = ensureRoot();
    const puppyName = companionState.name ? escapeHtml(companionState.name) : '';
    panel.dataset.storyView = settled ? 'chapter-four-home' : 'chapter-four-arrival';
    panel.innerHTML = `<article class="house-story-final house-story-arrival ${settled ? 'is-settled' : 'is-arriving'}" aria-labelledby="houseStoryFinalTitle">
      <small>${settled ? 'YA ESTÁ EN CASA' : 'UN NUEVO HABITANTE'}</small>
      <h3 id="houseStoryFinalTitle">${settled ? (puppyName ? `${puppyName} encontró su hogar. Y te eligió a vos ♡` : 'Parece que encontró su hogar. Y te eligió a vos ♡') : 'Alguien viene caminando despacito…'}</h3>
      <div class="house-story-puppy-scene" aria-label="Un cachorro Braco de Weimar muy pequeño llega a la casita">
        ${settled ? '' : `<img class="house-story-arrival-box" src="${ASSET_BASE}final-box-open.png" alt="Caja de regalo abierta">`}
        ${settled ? `<img class="house-story-puppy-blanket" src="${ASSET_BASE}corner-blanket.png" alt=""><img class="house-story-puppy-cushion" src="${ASSET_BASE}corner-cushion.png" alt="">` : ''}
        <span class="house-story-puppy-glow" aria-hidden="true"></span>
        <img class="house-story-puppy ${settled ? 'is-sitting' : 'is-walking'}" src="${ASSET_BASE}${settled ? 'companion-tiny-sit.png' : 'companion-tiny-walk.png'}" alt="Cachorro Braco de Weimar gris plateado, muy pequeño y de orejas largas">
      </div>
      <p class="house-story-puppy-stage">Recién llegado · todavía muy chiquito</p>
      ${settled ? `<div class="house-story-reveal-message"><p>Hoy llega a nuestra casita. Y algún día, cuando podamos cuidarlo como merece, me encantaría que llegue también a la nuestra de verdad.</p><span>Va a crecer muy despacito con el tiempo.</span></div>${puppyName ? `<div class="house-story-puppy-named"><strong>Se llama ${puppyName}</strong><span>Ya podés encontrarlo dentro de la casita.</span><button type="button" data-story-enter-home>Entrar a la casita</button></div>` : `<form class="house-story-name-form" data-story-name-form><label for="houseStoryPuppyName">Ahora falta algo importante… ¿cómo se llama?</label><div><input id="houseStoryPuppyName" name="puppyName" maxlength="30" autocomplete="off" required placeholder="Elegí su nombre"><button type="submit">Guardar nombre</button></div><small>Podés cambiarlo después.</small></form>`}` : `<p>Primero asomó las orejas. Después, esas patas enormes.</p>`}
    </article>`;
    panel.querySelector('.house-story-final')?.scrollIntoView({ block:'start', behavior:'smooth' });
    clearTimeout(arrivalTimer);
    if (!settled) arrivalTimer = setTimeout(() => renderArrival(true), 2800);
  }

  function renderHomeBadge() {
    const panel = ensureRoot();
    const puppyName = escapeHtml(companionState.name || 'El cachorrito');
    const roomName = ROOM_DESTINATIONS[companionState.currentRoom] || 'la casita';
    panel.dataset.storyView = 'chapter-four-home-badge';
    panel.innerHTML = `<article class="house-story-home-badge"><img src="${ASSET_BASE}companion-tiny-sleep.png" alt=""><div><small>UN NUEVO RINCÓN DE LA CASA</small><h3>${puppyName} ya vive acá.</h3><p>Ahora está en ${roomName}.</p></div><div class="house-story-home-actions"><button type="button" class="is-primary" data-story-visit-companion>Ir a verlo en ${roomName}</button><button type="button" data-story-open-memory>Volver a ver su llegada</button></div></article>`;
  }

  function visitCompanion() {
    const room = ROOM_DESTINATIONS[companionState.currentRoom] ? companionState.currentRoom : 'bedroom';
    sessionStorage.setItem('house_story_companion_home','1');
    renderHomeBadge();
    document.querySelector(`[data-enter-room="${room}"]`)?.click();
    setTimeout(() => {
      const puppy = document.querySelector('.house-story-room-puppy');
      const panel = document.querySelector('.house-story-companion-panel');
      (puppy || panel || document.querySelector(`[data-room-view="${room}"]`))?.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 180);
  }

  async function openDoor(button) {
    button.disabled = true;
    button.textContent = 'Abriendo…';
    try {
      const next = await engine().openDoor();
      state = next;
      doorState = next.storyData || { opened:true };
      renderBox(true);
    } catch (_error) {
      button.disabled = false;
      button.textContent = 'Intentar abrir otra vez';
    }
  }

  async function revealCompanion(button) {
    button.disabled = true;
    button.textContent = 'Esperando…';
    try {
      const next = await engine().revealCompanion();
      state = next;
      companionState = next.storyData || { revealed:true, growthStage:0, stageName:'tiny' };
      renderArrival(false);
    } catch (_error) {
      button.disabled = false;
      button.textContent = 'Intentar otra vez';
    }
  }

  async function saveName(form) {
    const input = form.elements.puppyName;
    const button = form.querySelector('button');
    const name = input.value.trim();
    if (!name) return input.focus();
    button.disabled = true;
    button.textContent = 'Guardando…';
    try {
      const next = await engine().updateCompanion('name', { name });
      if (next.pending) throw new Error('offline');
      companionState = next.storyData;
      window.dispatchEvent(new CustomEvent('housecompanionchange', { detail:companionState }));
      renderArrival(true);
    } catch (_error) {
      button.disabled = false;
      button.textContent = 'Intentar otra vez';
    }
  }

  function render() {
    if (!state.available || !['active','completed'].includes(state.status) || state.chapter !== 4) return;
    if (companionState.revealed) {
      if (companionState.name && sessionStorage.getItem('house_story_companion_home') === '1') renderHomeBadge();
      else renderArrival(true);
    }
    else if (doorState.opened) renderBox(true);
    else if (sessionStorage.getItem('house_story_chapter_four_key_ready') === '1') renderBox(false);
    else renderKey();
  }

  function bind() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-story-open-box]');
      if (button) openDoor(button);
      const revealButton = event.target.closest('[data-story-reveal-companion]');
      if (revealButton) revealCompanion(revealButton);
      if (event.target.closest('[data-story-enter-home]')) {
        visitCompanion();
      }
      if (event.target.closest('[data-story-visit-companion]')) visitCompanion();
      if (event.target.closest('[data-story-open-memory]')) {
        clearTimeout(arrivalTimer);
        renderBox(false);
      }
    }, true);
    document.addEventListener('submit', event => {
      const form = event.target.closest('[data-story-name-form]');
      if (!form) return;
      event.preventDefault();
      saveName(form);
    }, true);
  }

  async function boot() {
    if (booted || !house() || !engine()) return;
    booted = true;
    bind();
    try {
      state = await engine().load();
      if (state.chapter === 4) {
        doorState = await engine().loadDoor();
        if (doorState.opened) companionState = await engine().loadCompanion();
      }
      render();
    } catch (_error) { booted = false; }
  }

  window.addEventListener('housestorychange', async event => {
    state = event.detail || {available:false};
    if (state.storyData?.revealed !== undefined) companionState = state.storyData;
    else if (state.storyData?.opened !== undefined) doorState = state.storyData;
    else if (state.chapter === 4) {
      try {
        doorState = await engine().loadDoor();
        if (doorState.opened) companionState = await engine().loadCompanion();
      } catch (_error) { doorState = {opened:false}; }
    }
    render();
  });
  window.addEventListener('loveidentityready', boot);
  if (window.loveIdentity && window.HouseStoryEngine) boot();
})();
