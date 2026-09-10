/* Primer capítulo privado. Este archivo no se enlaza antes del lanzamiento atómico. */
(() => {
  'use strict';

  const SIGNALS = [
    { step:'signal_bedroom', room:'bedroom', target:'#houseBed', roomLabel:'Dormitorio', destination:'al dormitorio', objectLabel:'la cama' },
    { step:'signal_kitchen', room:'kitchen', target:'#kitchenCoffee', roomLabel:'Cocina', destination:'a la cocina', objectLabel:'la cafetera' },
    { step:'signal_bathroom', room:'bathroom', target:'#bathroomShower', roomLabel:'Baño', destination:'al baño', objectLabel:'la ducha' }
  ];
  const timers = [];
  const pending = new Set();
  let state = { available:false };
  let root = null;
  let booted = false;

  const engine = () => window.HouseStoryEngine;
  const house = () => document.querySelector('#loveHouse');

  function clearTimers() {
    while (timers.length) clearTimeout(timers.pop());
  }

  function ensureRoot() {
    if (root?.isConnected) return root;
    root = document.createElement('section');
    root.id = 'houseStoryChapter';
    root.className = 'house-story-chapter';
    root.setAttribute('aria-live', 'polite');
    house()?.prepend(root);
    return root;
  }

  function solved(step) {
    return Array.isArray(state.solvedSteps) && state.solvedSteps.includes(step);
  }

  function routeTo(room) {
    document.querySelector(`[data-enter-room="${room}"]`)?.click();
    setTimeout(() => {
      const target = document.querySelector(SIGNALS.find(signal => signal.room === room)?.target);
      target?.scrollIntoView({ behavior:'smooth', block:'center' });
      target?.focus({ preventScroll:true });
    }, 250);
  }

  function removeSignalDecorations() {
    SIGNALS.forEach(signal => {
      const target = document.querySelector(signal.target);
      if (!target) return;
      target.classList.remove('house-story-signal', 'is-story-solved', 'is-story-pending');
      target.removeAttribute('data-story-step');
      target.removeAttribute('aria-describedby');
    });
  }

  function renderSignalDecorations() {
    removeSignalDecorations();
    if (!state.available || state.status !== 'active' || state.chapter !== 1) return;
    SIGNALS.forEach(signal => {
      const target = document.querySelector(signal.target);
      if (!target) return;
      if (solved(signal.step)) pending.delete(signal.step);
      target.dataset.storyStep = signal.step;
      target.classList.add('house-story-signal');
      target.classList.toggle('is-story-solved', solved(signal.step));
      target.classList.toggle('is-story-pending', pending.has(signal.step));
      target.setAttribute('aria-describedby', 'houseStoryProgress');
    });
  }

  function foundCount() {
    return SIGNALS.filter(signal => solved(signal.step)).length;
  }

  function renderLetter(collapsed = false) {
    const panel = ensureRoot();
    panel.dataset.storyView = collapsed ? 'letter-collapsed' : 'letter';
    panel.innerHTML = collapsed ? `
      <button class="house-story-letter-small" type="button" data-story-open-letter>
        <span aria-hidden="true">💌</span><strong>La carta sigue acá</strong>
      </button>` : `
      <article class="house-story-letter" aria-labelledby="houseStoryLetterTitle">
        <span class="house-story-seal" aria-hidden="true">♡</span>
        <div><small>LA CASITA ENCONTRÓ ALGO</small>
          <h3 id="houseStoryLetterTitle">Hay una carta para vos</h3>
          <p>Cielito, la casa encontró algo raro. Creo que quiere que lo veas vos.</p>
        </div>
        <div class="house-story-letter-actions">
          <button type="button" data-story-later>Ahora no</button>
          <button type="button" data-story-start>Voy a mirar</button>
        </div>
      </article>`;
  }

  function renderChapterOne() {
    const panel = ensureRoot();
    const count = foundCount();
    const hintLevel = Number(state.hintsUsed?.['1'] || 0);
    const next = SIGNALS.find(signal => !solved(signal.step)) || SIGNALS[SIGNALS.length - 1];
    panel.dataset.storyView = 'chapter-one';
    panel.innerHTML = `
      <article class="house-story-hud" aria-labelledby="houseStoryTitle">
        <div class="house-story-hud-head">
          <div><small>PREPARANDO SU LLEGADA</small><h3 id="houseStoryTitle">Seguí las tres señales</h3></div>
          <strong id="houseStoryProgress">Paso ${Math.min(count + 1, 3)} de 3</strong>
        </div>
        <div class="house-story-progress" role="progressbar" aria-label="Señales encontradas" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${count}">
          ${SIGNALS.map(signal => `<i class="${solved(signal.step) ? 'is-found' : ''}" aria-hidden="true"></i>`).join('')}
        </div>
        <p id="houseStoryFeedback" class="house-story-feedback"><strong>Ahora andá ${next.destination}.</strong> Cuando llegues, tocá ${next.objectLabel} que está brillando.</p>
        ${hintLevel >= 1 ? `<p class="house-story-hint">Primero tocá “Ir ${next.destination}” y después tocá ${next.objectLabel}.</p>` : ''}
        ${hintLevel >= 2 ? `<p class="house-story-hint house-story-hint-direct">No hay nada que adivinar: te llevamos directamente al objeto correcto.</p>` : ''}
        <nav class="house-story-routes" aria-label="Ir al siguiente paso">
          <button type="button" data-story-room="${next.room}">Ir ${next.destination}</button>
        </nav>
        <p class="house-story-step-summary" aria-label="Progreso del recorrido">
          ${SIGNALS.map(signal => `<span class="${solved(signal.step) ? 'is-found' : signal === next ? 'is-current' : ''}">${solved(signal.step) ? '✓' : '·'} ${signal.roomLabel}</span>`).join('')}
        </p>
        <button class="house-story-hint-button" type="button" data-story-hint>${hintLevel < 2 ? 'Mostrame qué hacer' : 'Llevarme al objeto'}</button>
      </article>`;
    document.querySelector('.house-map')?.classList.toggle('house-story-map-hint', hintLevel >= 2);
    clearTimers();
    if (hintLevel < 1) timers.push(setTimeout(() => panel.querySelector('[data-story-hint]')?.classList.add('is-ready'), 45_000));
    if (hintLevel < 2) timers.push(setTimeout(() => panel.querySelector('[data-story-hint]')?.classList.add('is-ready'), 90_000));
  }

  function renderChapterComplete() {
    clearTimers();
    removeSignalDecorations();
    document.querySelector('.house-map')?.classList.remove('house-story-map-hint');
    const panel = ensureRoot();
    panel.dataset.storyView = 'chapter-complete';
    panel.innerHTML = `
      <article class="house-story-complete" tabindex="-1">
        <span aria-hidden="true">✦</span><div><small>LAS TRES PARTES ENCAJARON</small>
        <h3>Hay alguien buscando su lugar favorito.</h3></div>
      </article>`;
    panel.querySelector('.house-story-complete')?.focus();
  }

  function render() {
    if (!state.available) {
      clearTimers();
      removeSignalDecorations();
      root?.remove();
      root = null;
      return;
    }
    if (state.status === 'not_started') renderLetter(sessionStorage.getItem('house_story_letter_later') === '1');
    else if (state.status === 'active' && state.chapter === 1) renderChapterOne();
    else if (state.chapter >= 2) renderChapterComplete();
    renderSignalDecorations();
  }

  async function run(button, action) {
    if (button) button.disabled = true;
    try {
      state = await action();
      render();
      return state;
    } catch (_error) {
      if (button) button.disabled = false;
      const feedback = document.querySelector('#houseStoryFeedback');
      if (feedback) feedback.textContent = 'La casa perdió la señal. Lo va a guardar apenas vuelva internet.';
      return null;
    }
  }

  async function collectSignal(signal, target) {
    if (solved(signal.step) || pending.has(signal.step)) return;
    pending.add(signal.step);
    target.classList.add('is-story-pending');
    const next = await run(null, () => engine().completeStep(signal.step));
    if (next && !next.pending) pending.delete(signal.step);
    renderSignalDecorations();
  }

  function bind() {
    document.addEventListener('click', event => {
      const start = event.target.closest('[data-story-start]');
      if (start) {
        sessionStorage.removeItem('house_story_letter_later');
        run(start, () => engine().start());
        return;
      }
      if (event.target.closest('[data-story-later]')) {
        sessionStorage.setItem('house_story_letter_later', '1');
        renderLetter(true);
        return;
      }
      if (event.target.closest('[data-story-open-letter]')) {
        sessionStorage.removeItem('house_story_letter_later');
        renderLetter(false);
        return;
      }
      const route = event.target.closest('[data-story-room]');
      if (route) {
        routeTo(route.dataset.storyRoom);
        return;
      }
      const hint = event.target.closest('[data-story-hint]');
      if (hint && !hint.disabled) {
        const currentLevel = Number(state.hintsUsed?.['1'] || 0);
        if (currentLevel >= 2) {
          const next = SIGNALS.find(signal => !solved(signal.step));
          if (next) routeTo(next.room);
        } else {
          const level = Math.min(2, currentLevel + 1);
          run(hint, () => engine().useHint(level));
        }
        return;
      }
      const signalTarget = event.target.closest('[data-story-step]');
      const signal = SIGNALS.find(item => item.step === signalTarget?.dataset.storyStep);
      if (signal && state.status === 'active' && state.chapter === 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        collectSignal(signal, signalTarget);
      }
    }, true);
  }

  async function boot() {
    if (booted || !house() || !engine()) return;
    booted = true;
    bind();
    try {
      state = await engine().flush();
      render();
    } catch (_error) {
      booted = false;
    }
  }

  window.addEventListener('housestorychange', event => { state = event.detail || { available:false }; render(); });
  window.addEventListener('loveidentityready', boot);
  if (window.loveIdentity && window.HouseStoryEngine) boot();
})();
