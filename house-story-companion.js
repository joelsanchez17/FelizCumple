/* Habitante privado persistente: presencia por cuarto, nombre, descanso y vida dentro de la casa. */
(() => {
  'use strict';

  const ASSET_BASE = new URL('./assets/story/', document.currentScript?.src || location.href).href;
  const ROOM_LABELS = { bedroom:'el dormitorio', kitchen:'la cocina', bathroom:'el baño', dining:'el comedor' };
  const ROOM_MOMENTS = {
    bedroom:{ kind:'blanket', label:'A la mantita' },
    kitchen:null,
    bathroom:{ kind:'paws', label:'Patitas limpias' },
    dining:{ kind:'sofa', label:'Al sillón' }
  };
  const MOTION_KINDS = ['pet','play','hold','blanket','water','paws','sofa'];
  const MOTION_CLASSES = MOTION_KINDS.map(kind => `is-${kind === 'pet' ? 'petted' : kind === 'hold' ? 'held' : kind}`);
  const FOLLOW_KEY = 'house_story_companion_follows_me';
  const BESIDE_KEY = 'house_story_companion_beside';
  let companion = { revealed:false };
  let currentRoom = null;
  let editingName = false;
  let panelOpen = false;
  let booted = false;
  let arriving = false;
  let arrivingActor = null;
  let reactionTimer = null;
  let motionTimer = null;
  let followMovePending = false;
  let besideVisibleLast = false;
  let besideIdentity = sessionStorage.getItem(BESIDE_KEY) || null;
  let avatarObserver = null;

  const engine = () => window.HouseStoryEngine;
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const followsMe = () => sessionStorage.getItem(FOLLOW_KEY) === window.loveIdentity;

  function visibleRoom() {
    return document.querySelector('.house-room-view:not([hidden])')?.dataset.roomView || null;
  }

  function clearUi() {
    clearTimeout(reactionTimer);
    clearTimeout(motionTimer);
    avatarObserver?.disconnect();
    avatarObserver = null;
    document.querySelectorAll('.house-story-room-puppy,.house-story-companion-bed,.house-story-companion-panel,.house-story-companion-reaction,.house-story-companion-prop').forEach(node => node.remove());
  }

  function name() {
    return companion.name || 'El cachorrito';
  }

  function actorName(actor) {
    return actor === 'joel' ? 'Joel' : actor === 'princesa' ? 'Princesa' : 'El otro';
  }

  function careScore(timestamp, healthyHours, fallback = 100) {
    if (!timestamp) return fallback;
    const elapsedHours = Math.max(0, (Date.now() - new Date(timestamp).getTime()) / 3600000);
    return Math.max(0, Math.min(100, Math.round(100 - (elapsedHours / healthyHours) * 100)));
  }

  function careState() {
    const saved = companion.care || {};
    const hydration = careScore(saved.lastWateredAt, 30, Number(saved.hydration ?? 100));
    const affection = careScore(saved.lastPettedAt, 48, Number(saved.affection ?? 100));
    const play = careScore(saved.lastPlayedAt, 36, Number(saved.play ?? 100));
    const mood = companion.isSleeping ? 'sleeping'
      : hydration < 25 ? 'thirsty'
      : affection < 25 ? 'needs-cuddles'
      : play < 25 ? 'bored'
      : Math.min(hydration, affection, play) >= 75 ? 'happy' : 'calm';
    return { hydration, affection, play, mood };
  }

  function moodText(mood) {
    return ({
      sleeping:'Está mimido',
      thirsty:'Tiene sed',
      'needs-cuddles':'Está pidiendo mimos',
      bored:'Quiere jugar',
      happy:'Está contentísimo',
      calm:'Está tranquilo'
    })[mood] || 'Está tranquilo';
  }

  function besidePersonIsHere() {
    return Boolean(besideIdentity && document.querySelector(`[data-avatar-for="${besideIdentity}"].is-online`));
  }

  function reactionText(kind, actor) {
    const safeName = escapeHtml(name());
    const bothHere = document.querySelector('#loveHouse')?.classList.contains('both-online');
    const mine = actor === window.loveIdentity;
    if (kind === 'call') {
      if (bothHere) return `${safeName} vino corriendo y los encontró a los dos.`;
      return mine ? `${safeName} vino corriendo apenas lo llamaste.` : `${actorName(actor)} lo llamó y ${safeName} vino corriendo.`;
    }
    if (kind === 'come') return mine
      ? `${safeName} vino y se quedó al lado tuyo.`
      : `${actorName(actor)} le dijo “vení conmigo” y ${safeName} fue a su lado.`;
    if (kind === 'follow') return mine
      ? `${safeName} entendió: ahora te sigue por la casa.`
      : `${actorName(actor)} le dijo “seguime” y ${safeName} se puso a su lado.`;
    if (kind === 'stay') return `${safeName} entendió “quedate acá” y se acomodó en este rincón.`;
    if (kind === 'hold') {
      if (bothHere) return `${actorName(actor)} lo alzó y ${safeName} estiró las patitas hacia el otro.`;
      return mine ? `${safeName} se acomodó en tus brazos y no parece tener apuro por bajar.` : `${actorName(actor)} lo alzó y ${safeName} se quedó muy cómodo.`;
    }
    if (kind === 'blanket') return mine
      ? `${safeName} se metió bajo la mantita y dejó apenas las orejas afuera.`
      : `${actorName(actor)} lo tapó y ${safeName} escondió apenas las orejas.`;
    if (kind === 'water') return mine
      ? `${safeName} tomó agüita y dejó medio hocico dentro del platito.`
      : `${actorName(actor)} le dio agüita y ${safeName} tomó hasta la última gotita.`;
    if (kind === 'play') return mine
      ? `${safeName} fue corriendo por la pelotita y volvió orgullosísimo.`
      : `${actorName(actor)} jugó con ${safeName} y ahora no para de mover la colita.`;
    if (kind === 'paws') return mine
      ? `${safeName} salió con las patitas limpias… por unos segundos.`
      : `${actorName(actor)} le limpió las patitas. A ver cuánto le dura.`;
    if (kind === 'sofa') return mine
      ? `${safeName} se subió al sillón y ocupó el mejor lugar.`
      : `${actorName(actor)} lo subió al sillón y ya se adueñó de su lugar.`;
    if (bothHere) return `${safeName} cerró los ojitos y movió la colita entre los dos.`;
    return mine ? `${safeName} cerró los ojitos y movió la colita con tus cariñitos.` : `${actorName(actor)} lo acarició y ${safeName} movió la colita.`;
  }

  function reactionDuration(kind) {
    return ['call','hold','come','follow','stay','blanket','water','play','paws','sofa'].includes(kind) ? 2800 : 1900;
  }

  function showReaction(surface, kind, actor) {
    document.querySelector('.house-story-companion-reaction')?.remove();
    const reaction = document.createElement('div');
    reaction.className = `house-story-companion-reaction is-${kind}`;
    reaction.innerHTML = `<span aria-hidden="true">♡</span><strong>${reactionText(kind, actor)}</strong>`;
    if (actor && actor !== window.loveIdentity) reaction.classList.add('is-remote');
    surface.appendChild(reaction);
    requestAnimationFrame(() => {
      const puppy = surface.querySelector('.house-story-room-puppy');
      if (!puppy) return;
      const puppyBox = puppy.getBoundingClientRect();
      const surfaceBox = surface.getBoundingClientRect();
      const reactionBox = reaction.getBoundingClientRect();
      const left = puppyBox.left - surfaceBox.left + puppyBox.width / 2 - reactionBox.width / 2;
      const top = puppyBox.top - surfaceBox.top - reactionBox.height - 7;
      reaction.style.left = `${Math.max(5, Math.min(surfaceBox.width - reactionBox.width - 5, left))}px`;
      reaction.style.top = `${Math.max(5, top)}px`;
    });
    clearTimeout(reactionTimer);
    reactionTimer = setTimeout(() => reaction.remove(), reactionDuration(kind));
  }

  function renderCareMeters(care) {
    return `<div class="house-story-companion-needs" aria-label="Cuidados de ${escapeHtml(name())}">
      <span title="Agüita"><i>💧</i><b><em style="width:${care.hydration}%"></em></b></span>
      <span title="Cariño"><i>♡</i><b><em style="width:${care.affection}%"></em></b></span>
      <span title="Juego"><i>●</i><b><em style="width:${care.play}%"></em></b></span>
    </div>`;
  }

  function positionPanelNearPuppy(panel, puppy, surface) {
    if (!panel || !puppy || !surface || !panel.classList.contains('is-here')) return;
    const puppyBox = puppy.getBoundingClientRect();
    const surfaceBox = surface.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const puppyCenter = puppyBox.left - surfaceBox.left + puppyBox.width / 2;
    const putLeft = puppyCenter > surfaceBox.width * .53;
    const idealLeft = putLeft
      ? puppyBox.left - surfaceBox.left - panelBox.width - 9
      : puppyBox.right - surfaceBox.left + 9;
    const idealTop = puppyBox.top - surfaceBox.top + puppyBox.height / 2 - panelBox.height / 2;
    panel.style.left = `${Math.max(6, Math.min(surfaceBox.width - panelBox.width - 6, idealLeft))}px`;
    panel.style.top = `${Math.max(6, Math.min(surfaceBox.height - panelBox.height - 6, idealTop))}px`;
    panel.classList.toggle('is-left-of-puppy', putLeft);
    panel.classList.toggle('is-right-of-puppy', !putLeft);
  }

  function repositionPanel() {
    const surface = document.querySelector(`[data-room-surface="${currentRoom}"]`);
    positionPanelNearPuppy(
      document.querySelector('.house-story-companion-panel.is-here'),
      document.querySelector('.house-story-room-puppy'),
      surface
    );
  }

  function renderPanel(roomView, surface, isHere) {
    // En el mismo cuarto, los cuidados son un menú contextual del cachorro.
    if (isHere && !panelOpen) return;
    const safeName = escapeHtml(name());
    const care = careState();
    const panel = document.createElement('aside');
    panel.className = `house-story-companion-panel ${isHere ? 'is-here' : 'is-away'} ${panelOpen ? 'is-expanded' : 'is-collapsed'} is-care-${care.mood} ${followsMe() ? 'is-following' : ''} ${besideIdentity ? 'is-beside' : ''}`;
    panel.setAttribute('aria-live', 'polite');
    if (!isHere) {
      panel.innerHTML = `<div><small>POR ALGÚN RINCÓN DE LA CASA</small><strong>${safeName} está en ${ROOM_LABELS[companion.currentRoom] || 'otro cuarto'}.</strong></div><button type="button" data-companion-call>Vení conmigo</button>`;
    } else {
      const moment = ROOM_MOMENTS[currentRoom];
      const awakeActions = companion.isSleeping ? '' : [
        '<button type="button" class="is-care-action" data-companion-care="water">Agüita</button>',
        '<button type="button" class="is-care-action" data-companion-care="affection">Caricias</button>',
        '<button type="button" class="is-care-action" data-companion-care="play">Pelotita</button>',
        '<button type="button" data-companion-motion="hold">A upa</button>',
        moment ? `<button type="button" class="is-house-moment" data-companion-motion="${moment.kind}">${moment.label}</button>` : '',
        `<button type="button" class="is-person-moment" data-companion-come>Vení conmigo</button>`,
        `<button type="button" data-companion-follow>${followsMe() ? 'Quedate acá' : 'Seguime'}</button>`
      ].join('');
      const status = followsMe() ? 'TE SIGUE' : besideIdentity ? `CON ${actorName(besideIdentity).toUpperCase()}` : 'CERQUITA TUYO';
      panel.innerHTML = `<button type="button" class="house-story-companion-summary" data-companion-panel-toggle aria-expanded="${panelOpen}"><span class="house-story-companion-copy"><small>${status}</small><strong>${safeName}</strong><span>${moodText(care.mood)}</span></span><i aria-hidden="true">${panelOpen ? '−' : '+'}</i></button>${renderCareMeters(care)}<div class="house-story-companion-actions">${awakeActions}<button type="button" data-companion-sleep>${companion.isSleeping ? 'Despertate' : 'A mimir'}</button><button type="button" class="is-quiet" data-companion-rename>${companion.name ? 'Tu nombre' : 'Elegir nombre'}</button></div>${editingName ? `<form data-companion-name-form><label for="houseCompanionName">Su nombre</label><div><input id="houseCompanionName" name="name" maxlength="30" value="${escapeHtml(companion.name || '')}" required><button type="submit">Guardar</button></div></form>` : ''}`;
    }
    (isHere ? surface : roomView).appendChild(panel);
    if (isHere) requestAnimationFrame(() => positionPanelNearPuppy(panel, document.querySelector('.house-story-room-puppy'), surface));
  }

  function render() {
    clearUi();
    if (!companion.revealed) return;
    currentRoom ||= visibleRoom();
    if (!currentRoom) return;
    const roomView = document.querySelector(`[data-room-view="${currentRoom}"]`);
    const surface = document.querySelector(`[data-room-surface="${currentRoom}"]`);
    if (!roomView || !surface) return;
    besideVisibleLast = besidePersonIsHere();
    const isHere = companion.currentRoom === currentRoom;
    if (isHere) {
      if (companion.isSleeping) {
        const bed = document.createElement('img');
        bed.className = 'house-story-companion-bed';
        bed.src = `${ASSET_BASE}companion-tiny-bed.png`;
        bed.alt = '';
        bed.dataset.companionRoom = currentRoom;
        bed.setAttribute('aria-hidden','true');
        surface.appendChild(bed);
      }
      const puppy = document.createElement('button');
      const care = careState();
      puppy.type = 'button';
      puppy.className = `house-story-room-puppy ${companion.isSleeping ? 'is-sleeping' : 'is-awake'} is-care-${care.mood} ${arriving ? 'is-arriving' : ''}`;
      puppy.dataset.companionOpen = '';
      puppy.dataset.companionRoom = currentRoom;
      puppy.setAttribute('aria-label', `${name()} ${companion.isSleeping ? 'está durmiendo' : 'está en este cuarto'}`);
      puppy.innerHTML = `<span aria-hidden="true"></span><img src="${ASSET_BASE}${companion.isSleeping ? 'companion-tiny-sleep.png' : 'companion-tiny-sit.png'}" alt=""><b class="house-story-companion-mood" aria-hidden="true"></b><small>${escapeHtml(name())}</small>`;
      surface.appendChild(puppy);
      if (!companion.isSleeping && besideIdentity && placeBesideIdentity(puppy, surface, besideIdentity)) {
        puppy.classList.add('is-beside-person');
        watchBesideAvatar(puppy, surface, besideIdentity);
      }
      if (arriving) {
        showReaction(surface, 'call', arrivingActor);
        setTimeout(() => { arriving = false; arrivingActor = null; puppy.classList.remove('is-arriving'); }, 1100);
      }
    }
    renderPanel(roomView, surface, isHere);
  }

  function addMomentProp(puppy, kind) {
    if (!['blanket','water','play','paws'].includes(kind)) return;
    const prop = document.createElement('i');
    prop.className = `house-story-companion-prop is-${kind}`;
    prop.setAttribute('aria-hidden','true');
    puppy.appendChild(prop);
  }

  function placeAtRoomObject(puppy, surface, selector, options = {}) {
    const target = document.querySelector(selector);
    if (!target) return false;
    const targetBox = target.getBoundingClientRect();
    const surfaceBox = surface.getBoundingClientRect();
    const x = targetBox.left - surfaceBox.left + targetBox.width * (options.xRatio ?? .5);
    const y = targetBox.top - surfaceBox.top + targetBox.height * (options.yRatio ?? .45);
    puppy.classList.remove('is-beside-person');
    puppy.classList.add('is-room-object-position');
    puppy.style.left = `${x}px`;
    puppy.style.top = `${y}px`;
    puppy.style.right = 'auto';
    puppy.style.bottom = 'auto';
    return true;
  }

  function placeBesideIdentity(puppy, surface, identity) {
    const avatar = document.querySelector(`[data-avatar-for="${identity}"].is-online`);
    if (!avatar) return false;
    const avatarBox = avatar.getBoundingClientRect();
    const surfaceBox = surface.getBoundingClientRect();
    const avatarCenter = avatarBox.left - surfaceBox.left + avatarBox.width / 2;
    const direction = avatarCenter < surfaceBox.width / 2 ? 1 : -1;
    const x = Math.max(34, Math.min(surfaceBox.width - 34, avatarCenter + direction * 42));
    const y = Math.max(42, Math.min(surfaceBox.height - 32, avatarBox.top - surfaceBox.top + avatarBox.height / 2 + 10));
    puppy.style.left = `${x}px`;
    puppy.style.top = `${y}px`;
    puppy.style.right = 'auto';
    puppy.style.bottom = 'auto';
    return true;
  }

  function watchBesideAvatar(puppy, surface, identity) {
    avatarObserver?.disconnect();
    const avatar = document.querySelector(`[data-avatar-for="${identity}"].is-online`);
    if (!avatar) return;
    avatarObserver = new MutationObserver(() => {
      placeBesideIdentity(puppy, surface, identity);
      positionPanelNearPuppy(document.querySelector('.house-story-companion-panel.is-here'), puppy, surface);
    });
    avatarObserver.observe(avatar, { attributes:true, attributeFilter:['style','class'] });
  }

  function resetMotion(puppy) {
    MOTION_CLASSES.forEach(className => puppy.classList.remove(className));
    document.querySelectorAll('.house-story-companion-prop').forEach(node => node.remove());
    const surface = document.querySelector(`[data-room-surface="${currentRoom}"]`);
    puppy.classList.remove('is-room-object-position');
    if (besideIdentity && surface && placeBesideIdentity(puppy, surface, besideIdentity)) {
      puppy.classList.add('is-beside-person');
    } else {
      puppy.classList.remove('is-beside-person','is-coming');
      puppy.style.removeProperty('left');
      puppy.style.removeProperty('top');
      puppy.style.removeProperty('right');
      puppy.style.removeProperty('bottom');
    }
    positionPanelNearPuppy(document.querySelector('.house-story-companion-panel.is-here'), puppy, surface);
  }

  function setBeside(identity, kind = 'come', announce = true) {
    besideIdentity = identity;
    if (identity === window.loveIdentity) sessionStorage.setItem(BESIDE_KEY, identity);
    render();
    const puppy = document.querySelector('.house-story-room-puppy');
    const surface = document.querySelector(`[data-room-surface="${currentRoom}"]`);
    if (puppy) {
      puppy.classList.add('is-coming');
      setTimeout(() => puppy.classList.remove('is-coming'), 720);
    }
    if (announce && surface) showReaction(surface, kind, identity);
  }

  function clearBeside(actor = window.loveIdentity, announce = true) {
    besideIdentity = null;
    sessionStorage.removeItem(BESIDE_KEY);
    sessionStorage.removeItem(FOLLOW_KEY);
    render();
    const surface = document.querySelector(`[data-room-surface="${currentRoom}"]`);
    if (announce && surface) showReaction(surface, 'stay', actor);
  }

  function animateMotion(kind, actor = window.loveIdentity) {
    if (kind === 'come' || kind === 'follow') return setBeside(actor, kind);
    if (kind === 'stay') return clearBeside(actor);
    if (!MOTION_KINDS.includes(kind) || companion.isSleeping || companion.currentRoom !== currentRoom) return;
    const puppy = document.querySelector('.house-story-room-puppy');
    const surface = document.querySelector(`[data-room-surface="${currentRoom}"]`);
    if (!puppy || !surface) return;
    clearTimeout(motionTimer);
    resetMotion(puppy);
    void puppy.offsetWidth;
    const className = kind === 'pet' ? 'is-petted' : kind === 'hold' ? 'is-held' : `is-${kind}`;
    if (kind === 'sofa') placeAtRoomObject(puppy, surface, '#diningSofa', { yRatio:.42 });
    puppy.classList.add(className);
    addMomentProp(puppy, kind);
    positionPanelNearPuppy(document.querySelector('.house-story-companion-panel.is-here'), puppy, surface);
    showReaction(surface, kind, actor);
    motionTimer = setTimeout(() => resetMotion(puppy), reactionDuration(kind));
  }

  async function sendMotion(kind, button) {
    button.disabled = true;
    animateMotion(kind);
    const motion = { kind, actor:window.loveIdentity, at:new Date().toISOString() };
    await window.sendLoveRealtime?.('house-action', { room:currentRoom, action:'companion_motion', value:motion, from:window.loveIdentity, updated_at:motion.at });
    setTimeout(() => { button.disabled = false; }, 650);
  }

  async function careCompanion(kind, button) {
    const motionKind = kind === 'affection' ? 'pet' : kind;
    button.disabled = true;
    button.dataset.previousLabel = button.textContent;
    button.textContent = 'Ya voy…';
    try {
      const next = await engine().updateCompanion('care', { kind });
      if (next.pending || !next.storyData) throw new Error('offline');
      companion = next.storyData;
      window.dispatchEvent(new CustomEvent('housecompanionchange', { detail:companion }));
      void window.sendLoveRealtime?.('house-action', { room:currentRoom, action:'companion_update', value:companion, from:window.loveIdentity, updated_at:companion.updatedAt });
      render();
      animateMotion(motionKind);
      broadcastCommand(motionKind);
    } catch (_error) {
      if (button.isConnected) button.textContent = 'Reintentar';
    } finally {
      setTimeout(() => {
        button.disabled = false;
        if (button.isConnected) button.textContent = button.dataset.previousLabel;
      }, 650);
    }
  }

  function broadcastCommand(kind) {
    const motion = { kind, actor:window.loveIdentity, at:new Date().toISOString() };
    void window.sendLoveRealtime?.('house-action', { room:currentRoom, action:'companion_motion', value:motion, from:window.loveIdentity, updated_at:motion.at });
  }

  async function persist(action, payload, button) {
    if (button) { button.disabled = true; button.dataset.previousLabel = button.textContent; button.textContent = 'Guardando…'; }
    try {
      const next = await engine().updateCompanion(action, payload);
      if (next.pending || !next.storyData) throw new Error('offline');
      companion = next.storyData;
      editingName = false;
      arriving = action === 'move';
      arrivingActor = arriving ? window.loveIdentity : null;
      window.dispatchEvent(new CustomEvent('housecompanionchange', { detail:companion }));
      void window.sendLoveRealtime?.('house-action', { room:companion.currentRoom, action:'companion_update', value:companion, from:window.loveIdentity, updated_at:companion.updatedAt });
      render();
      if (action === 'move' && besideIdentity === window.loveIdentity) broadcastCommand(followsMe() ? 'follow' : 'come');
    } catch (_error) {
      if (button) { button.disabled = false; button.textContent = 'Intentar otra vez'; }
    } finally {
      followMovePending = false;
    }
  }

  function toggleFollowing(button) {
    button.disabled = true;
    if (followsMe()) {
      clearBeside(window.loveIdentity);
      broadcastCommand('stay');
      return;
    }
    sessionStorage.setItem(FOLLOW_KEY, window.loveIdentity);
    sessionStorage.setItem(BESIDE_KEY, window.loveIdentity);
    setBeside(window.loveIdentity, 'follow');
    broadcastCommand('follow');
  }

  function callCompanion(button) {
    besideIdentity = window.loveIdentity;
    sessionStorage.setItem(BESIDE_KEY, window.loveIdentity);
    void persist('move', { room:currentRoom }, button);
  }

  async function refresh() {
    try {
      const next = await engine().loadCompanion();
      if (next?.revealed) { companion = next; render(); }
    } catch (_error) { /* Todavía no fue revelado para esta casa. */ }
  }

  function followIntoRoom(roomId) {
    if (!roomId || !followsMe() || companion.isSleeping || companion.currentRoom === roomId || followMovePending) return;
    followMovePending = true;
    void persist('move', { room:roomId });
  }

  function bind() {
    document.addEventListener('click', event => {
      if (event.target.closest('[data-companion-open]')) {
        panelOpen = !panelOpen;
        render();
        return;
      }
      if (event.target.closest('[data-companion-panel-toggle]')) {
        panelOpen = !panelOpen;
        render();
        return;
      }
      const call = event.target.closest('[data-companion-call]');
      if (call) return callCompanion(call);
      const sleep = event.target.closest('[data-companion-sleep]');
      if (sleep) {
        if (!companion.isSleeping) clearBeside(window.loveIdentity, false);
        return void persist('sleep', { sleeping:!companion.isSleeping }, sleep);
      }
      const come = event.target.closest('[data-companion-come]');
      if (come) return void sendMotion('come', come);
      const care = event.target.closest('[data-companion-care]');
      if (care) return void careCompanion(care.dataset.companionCare, care);
      const motion = event.target.closest('[data-companion-motion]');
      if (motion) return void sendMotion(motion.dataset.companionMotion, motion);
      const follow = event.target.closest('[data-companion-follow]');
      if (follow) return toggleFollowing(follow);
      if (event.target.closest('[data-companion-rename]')) { editingName = !editingName; render(); }
    }, true);
    document.addEventListener('submit', event => {
      const form = event.target.closest('[data-companion-name-form]');
      if (!form) return;
      event.preventDefault();
      const nextName = form.elements.name.value.trim();
      if (nextName) void persist('name', { name:nextName }, form.querySelector('button'));
    }, true);
    window.addEventListener('lovehouseroomchange', event => {
      currentRoom = event.detail?.roomId || null;
      editingName = false;
      panelOpen = false;
      render();
      followIntoRoom(currentRoom);
    });
    window.addEventListener('lovepresencechange', () => setTimeout(() => {
      const next = besidePersonIsHere();
      if (next !== besideVisibleLast) render();
    }, 0));
    window.addEventListener('housecompanionchange', event => { if (event.detail?.revealed) { companion = event.detail; render(); } });
    window.addEventListener('lovehouseaction', event => {
      if (event.detail?.action === 'companion_motion') {
        return animateMotion(event.detail?.value?.kind, event.detail?.value?.actor || event.detail?.from);
      }
      if (event.detail?.action === 'companion_update' && event.detail?.value?.revealed) {
        const next = event.detail.value;
        if (next.isSleeping) {
          besideIdentity = null;
          sessionStorage.removeItem(BESIDE_KEY);
          sessionStorage.removeItem(FOLLOW_KEY);
        }
        arriving = companion.currentRoom !== next.currentRoom && next.currentRoom === currentRoom && !next.isSleeping;
        arrivingActor = arriving ? event.detail?.from : null;
        companion = next;
        render();
      }
    });
    window.addEventListener('online', refresh);
    window.addEventListener('resize', () => requestAnimationFrame(repositionPanel));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  }

  async function boot() {
    if (booted || !engine() || !document.querySelector('#loveHouse')) return;
    booted = true;
    currentRoom = visibleRoom();
    bind();
    await refresh();
  }

  window.addEventListener('loveidentityready', boot);
  if (window.loveIdentity && window.HouseStoryEngine) void boot();
})();
