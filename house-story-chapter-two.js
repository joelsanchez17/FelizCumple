/* Segundo capítulo privado. Reconoce solamente estados confirmados por Supabase. */
(() => {
  'use strict';

  const TASKS = [
    { step:'care_plant', label:'Cuidar una planta', route:'bedroom', description:'Elegí cualquiera de las plantas de la casa.' },
    { step:'prepare_breakfast', label:'Preparar algo juntos', route:'dining', description:'La mesa del comedor puede empezar la mañana.' },
    { step:'warm_light', label:'Dejar una luz cálida', route:'bedroom', description:'Una de las lámparas del dormitorio alcanza.' }
  ];
  const PLANT_DEVICES = new Set(['plant', 'cactus', 'orchid', 'jasmine']);
  const pending = new Set();
  const feedback = new Map();
  let state = { available:false };
  let root = null;
  let booted = false;
  let transitionTimer = null;

  const engine = () => window.HouseStoryEngine;
  const house = () => document.querySelector('#loveHouse');
  const solved = step => Array.isArray(state.solvedSteps) && state.solvedSteps.includes(step);
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  };
  const localDay = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  };

  function ensureRoot() {
    root = document.querySelector('#houseStoryChapter');
    if (root) return root;
    root = document.createElement('section');
    root.id = 'houseStoryChapter';
    root.className = 'house-story-chapter';
    root.setAttribute('aria-live', 'polite');
    house()?.prepend(root);
    return root;
  }

  function clearDecorations() {
    document.querySelectorAll('.house-story-care-target').forEach(target => {
      target.classList.remove('house-story-care-target', 'is-story-solved', 'is-story-pending');
      target.removeAttribute('data-story-care-step');
      target.removeAttribute('aria-describedby');
    });
  }

  function decorateTargets() {
    clearDecorations();
    if (state.status !== 'active' || state.chapter !== 2) return;
    const groups = {
      care_plant:document.querySelectorAll('[data-room-plant]'),
      prepare_breakfast:document.querySelectorAll('#diningTable'),
      warm_light:document.querySelectorAll('[data-lamp-for]')
    };
    Object.entries(groups).forEach(([step, targets]) => targets.forEach(target => {
      target.dataset.storyCareStep = step;
      target.classList.add('house-story-care-target');
      target.classList.toggle('is-story-solved', solved(step));
      target.classList.toggle('is-story-pending', pending.has(step));
      target.setAttribute('aria-describedby', 'houseStoryCareProgress');
    }));
  }

  function goTo(room, step) {
    document.querySelector(`[data-enter-room="${room}"]`)?.click();
    const selector = step === 'prepare_breakfast' ? '#diningTable' : step === 'warm_light' ? '[data-lamp-for]' : '[data-room-plant="bedroom"]';
    setTimeout(() => document.querySelector(selector)?.focus(), 250);
  }

  function renderChapter() {
    const panel = ensureRoot();
    const count = TASKS.filter(task => solved(task.step)).length;
    const hint = Number(state.hintsUsed?.['2'] || 0);
    panel.dataset.storyView = 'chapter-two';
    panel.innerHTML = `
      <article class="house-story-hud house-story-care" aria-labelledby="houseStoryCareTitle">
        <div class="house-story-hud-head"><div><small>LA CASA QUIERE SABER ALGO</small><h3 id="houseStoryCareTitle">Saber cuidar</h3></div>
          <strong id="houseStoryCareProgress">Completaste ${count} de 3 cuidados</strong></div>
        <p class="house-story-feedback">No se trata de hacerlo perfecto. Se trata de hacer lugar para cuidar.</p>
        <div class="house-story-care-list">
          ${TASKS.map(task => `<article class="${solved(task.step) ? 'is-found' : ''}">
            <span aria-hidden="true">${solved(task.step) ? '✓' : '·'}</span><div><strong>${task.label}</strong><small>${feedback.get(task.step) || task.description}</small></div>
            <button type="button" data-story-care-route="${task.route}" data-story-care-step="${task.step}" ${solved(task.step) ? 'disabled' : ''}>${solved(task.step) ? 'Listo' : 'Ir'}</button>
          </article>`).join('')}
        </div>
        ${hint ? '<p class="house-story-hint">Probá con algo que tenga sed, algo para compartir en la mesa y algo que haga sentir el cuarto más cálido.</p>' : ''}
        <button class="house-story-hint-button" type="button" data-story-care-hint ${hint ? 'disabled' : ''}>${hint ? 'Pista encontrada' : 'Necesito una pista'}</button>
      </article>`;
    decorateTargets();
  }

  function renderComplete() {
    clearDecorations();
    const panel = ensureRoot();
    panel.dataset.storyView = 'chapter-complete';
    panel.innerHTML = `<article class="house-story-complete" tabindex="-1"><span aria-hidden="true">✦</span><div>
      <small>LA SEGUNDA PARTE APARECIÓ</small><h3>Esto necesita paciencia, juego y compañía.</h3></div></article>`;
    panel.querySelector('.house-story-complete')?.focus();
  }

  function render() {
    if (!state.available || state.status !== 'active') return;
    if (state.chapter === 2) {
      if (sessionStorage.getItem('house_story_chapter_one_closed') === '1') renderChapter();
      else {
        clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => {
          sessionStorage.setItem('house_story_chapter_one_closed', '1');
          renderChapter();
          reconcileExistingState();
        }, 1400);
      }
    } else if (state.chapter === 3) renderComplete();
    else if (state.chapter > 3) clearDecorations();
  }

  async function completeStep(step, message) {
    if (solved(step) || pending.has(step) || state.chapter !== 2) return;
    pending.add(step);
    decorateTargets();
    try {
      const next = await engine().completeStep(step);
      state = next;
      if (!next?.pending) pending.delete(step);
      if (message) feedback.set(step, message);
      render();
    } catch (_error) {
      feedback.set(step, 'Quedó pendiente. La casa lo guardará cuando vuelva internet.');
      renderChapter();
    }
  }

  function classify(detail) {
    if (!detail || detail.updatedBy !== window.loveIdentity) return null;
    if (PLANT_DEVICES.has(detail.device) && detail.state?.watered_day === today()) return 'care_plant';
    if (detail.roomId === 'dining' && detail.device === 'dining_table' && detail.state?.set) return 'prepare_breakfast';
    if (detail.roomId === 'bedroom' && detail.device?.startsWith('lamp_') && detail.state?.on) return 'warm_light';
    return null;
  }

  async function reconcileExistingState() {
    if (state.chapter !== 2 || !window._loveClient) return;
    const { data, error } = await window._loveClient.from('house_device_states').select('*');
    if (error || state.chapter !== 2) return;
    const rows = data || [];
    const plantReady = rows.some(row => PLANT_DEVICES.has(row.device_id) && row.state?.watered_day === today());
    const breakfastReady = rows.some(row => row.room_id === 'dining' && row.device_id === 'dining_table' && row.state?.set && (row.state?.breakfast_day === today() || localDay(row.updated_at) === today()));
    const lightReady = rows.some(row => row.room_id === 'bedroom' && row.device_id?.startsWith('lamp_') && row.state?.on);
    if (plantReady) await completeStep('care_plant', 'Esta ya está contenta. Parece que sabías lo que hacía falta.');
    if (state.chapter === 2 && breakfastReady) await completeStep('prepare_breakfast', 'Bueno, alguien se adelantó. La casa aprueba.');
    if (state.chapter === 2 && lightReady) await completeStep('warm_light', 'La luz ya estaba esperando.');
  }

  function bind() {
    document.addEventListener('click', event => {
      const route = event.target.closest('[data-story-care-route]');
      if (route && !route.disabled) goTo(route.dataset.storyCareRoute, route.dataset.storyCareStep);
      const hint = event.target.closest('[data-story-care-hint]');
      if (hint && !hint.disabled) engine().useHint(1).catch(() => {});
    }, true);
    window.addEventListener('lovehousedevicepersisted', event => {
      const step = classify(event.detail);
      if (!step || state.chapter !== 2) return;
      const messages = {
        care_plant:'Listo, ya tiene su agüita.',
        prepare_breakfast:'Hay algo preparado para compartir.',
        warm_light:'Ahora el cuarto se siente más cálido.'
      };
      completeStep(step, messages[step]);
    });
  }

  async function boot() {
    if (booted || !house() || !engine()) return;
    booted = true;
    bind();
    try {
      state = await engine().load();
      render();
      if (state.chapter === 2 && sessionStorage.getItem('house_story_chapter_one_closed') === '1') await reconcileExistingState();
    } catch (_error) { booted = false; }
  }

  window.addEventListener('housestorychange', event => { state = event.detail || { available:false }; render(); });
  window.addEventListener('loveidentityready', boot);
  if (window.loveIdentity && window.HouseStoryEngine) boot();
})();
