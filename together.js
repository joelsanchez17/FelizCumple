/* Nuestra casa, señales del corazón y diario compartido. */
(() => {
  'use strict';

  const PEOPLE = { joel: 'Joel', princesa: 'Princesa' };
  const gendered = (person, masculine, feminine) => person === 'princesa' ? feminine : masculine;
  const MOODS = {
    happy: { emoji: '☀️', label: 'Feliz', house: () => 'Hoy está feliz', push: name => `${name} está feliz hoy ☀️` },
    tired: { emoji: '🌙', label: 'Cansado/a', house: person => `Hoy está ${gendered(person, 'cansado', 'cansada')}`, push: (name, person) => `${name} está un poquito ${gendered(person, 'cansado', 'cansada')} 🌙` },
    miss_you: { emoji: '💭', label: 'Te extraño', house: () => 'Te está extrañando', push: name => `${name} te extraña un poquito 💜` },
    need_hug: { emoji: '🫂', label: 'Necesito un mimo', house: () => 'Necesita un mimo', push: name => `${name} necesita un mimo 🫂` },
    talk: { emoji: '🪟', label: 'Quiero hablar', house: () => 'Quiere hablar con vos', push: name => `${name} quiere hablar con vos` },
    proud: { emoji: '✨', label: 'Estoy orgulloso/a', house: person => `Está ${gendered(person, 'orgulloso', 'orgullosa')} de vos`, push: (name, person) => `${name} está ${gendered(person, 'orgulloso', 'orgullosa')} de vos ✨` }
  };
  const TYPE_META = {
    drawing: { label: 'DIBUJO', emoji: '🎨' },
    mimo: { label: 'MIMO', emoji: '💋' },
    note: { label: 'NOTA', emoji: '💌' },
    heart: { label: 'CORAZÓN', emoji: '♡' }
  };

  let client;
  let identity;
  let target;
  let heartStates = {};
  let currentHeart = null;
  let journalEntries = [];
  let journalFilter = 'all';
  let journalLimit = 20;
  let initialized = false;
  let setupErrorShown = false;
  let refreshTimer;
  const refreshTables = new Set();

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  function toast(message) {
    if (typeof window.mostrarMensaje === 'function') window.mostrarMensaje(message);
    else console.info(message);
  }

  function reportError(error, fallback) {
    console.warn(fallback, error);
    const missingTable = error?.code === '42P01' || /does not exist|schema cache/i.test(error?.message || '');
    if (missingTable && !setupErrorShown) {
      setupErrorShown = true;
      const box = document.createElement('p');
      box.className = 'together-error';
      box.textContent = 'Falta ejecutar la migración de “Juntos” en Supabase.';
      $('#together')?.prepend(box);
    }
  }

  function relativeTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const now = new Date();
    const difference = now - date;
    if (difference < 60 * 60 * 1000) return 'Hace un ratito';
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const days = Math.round((startToday - startDate) / 86400000);
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(date);
  }

  function applyLocalTime() {
    const hour = new Date().getHours();
    const period = hour < 6 || hour >= 21 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'day' : 'evening';
    const labels = { morning: 'Mañana', day: 'Tarde', evening: 'Atardecer', night: 'Noche' };
    const house = $('#loveHouse');
    if (house) house.dataset.time = period;
    if ($('#houseTimeLabel')) $('#houseTimeLabel').textContent = labels[period];
  }

  function renderPresence(detail = window.lovePresenceState || {}) {
    const joelOnline = detail.joel === true || (identity === 'joel' && initialized);
    const princesaOnline = detail.princesa === true || (identity === 'princesa' && initialized);
    $('#houseJoel')?.classList.toggle('is-online', joelOnline);
    $('#housePrincesa')?.classList.toggle('is-online', princesaOnline);
    if ($('#houseJoelPresence')) $('#houseJoelPresence').textContent = joelOnline ? 'Está por acá' : 'No está ahora';
    if ($('#housePrincesaPresence')) $('#housePrincesaPresence').textContent = princesaOnline ? 'Está por acá' : 'No está ahora';
    $('#loveHouse')?.classList.toggle('both-online', joelOnline && princesaOnline);
    const message = joelOnline && princesaOnline
      ? 'Están juntos acá.'
      : joelOnline ? 'Joel está por acá.'
      : princesaOnline ? 'Princesa está por acá.'
      : 'Ahora la casa está descansando.';
    if ($('#housePresenceMessage')) $('#housePresenceMessage').textContent = message;
  }

  function renderHeartStates() {
    ['joel', 'princesa'].forEach(person => {
      const state = heartStates[person];
      const targetEl = person === 'joel' ? $('#houseJoelHeart') : $('#housePrincesaHeart');
      if (!targetEl) return;
      if (!state || !MOODS[state.mood]) targetEl.textContent = 'Sin señal todavía';
      else targetEl.textContent = `${MOODS[state.mood].emoji} ${MOODS[state.mood].house(person)} · ${relativeTime(state.updated_at).toLowerCase()}`;
    });
    const mine = heartStates[identity];
    currentHeart = mine || null;
    $$('#heartChoices [data-mood]').forEach(button => button.classList.toggle('active', button.dataset.mood === mine?.mood));
    if ($('#heartClear')) $('#heartClear').hidden = !mine;
    if (!mine) {
      if ($('#heartActions')) $('#heartActions').hidden = true;
      return;
    }
    if ($('#heartActions')) $('#heartActions').hidden = false;
    if ($('#heartSavedText')) $('#heartSavedText').textContent = `${MOODS[mine.mood].emoji} Tu señal quedó encendida.`;
    const notify = $('#heartNotify');
    const remember = $('#heartRemember');
    if (notify) {
      notify.textContent = mine.notified_at ? 'Ya le avisaste' : `Avisarle a ${PEOPLE[target]}`;
      notify.disabled = Boolean(mine.notified_at);
    }
    if (remember) {
      remember.textContent = mine.journaled_at ? 'Guardado en el diario' : 'Guardar en el diario';
      remember.disabled = Boolean(mine.journaled_at);
    }
  }

  async function loadHearts() {
    const { data, error } = await client.from('heart_states').select('*');
    if (error) return reportError(error, 'No se pudieron cargar los estados del corazón');
    heartStates = Object.fromEntries((data || []).map(item => [item.identity, item]));
    renderHeartStates();
  }

  async function chooseMood(mood) {
    if (!MOODS[mood]) return;
    $$('#heartChoices button').forEach(button => { button.disabled = true; });
    const updatedAt = new Date().toISOString();
    const { data, error } = await client.from('heart_states').upsert({
      identity,
      mood,
      updated_at: updatedAt,
      notified_at: null,
      journaled_at: null
    }, { onConflict: 'identity' }).select().single();
    $$('#heartChoices button').forEach(button => { button.disabled = false; });
    if (error) return reportError(error, 'No se pudo guardar tu señal');
    heartStates[identity] = data;
    renderHeartStates();
    navigator.vibrate?.(15);
    toast('Tu señal quedó encendida');
  }

  async function clearMood() {
    const { error } = await client.from('heart_states').delete().eq('identity', identity);
    if (error) return reportError(error, 'No se pudo quitar tu señal');
    delete heartStates[identity];
    currentHeart = null;
    renderHeartStates();
    toast('Tu señal se apagó');
  }

  async function notifyHeart() {
    if (!currentHeart || currentHeart.notified_at) return;
    const button = $('#heartNotify');
    button.disabled = true;
    try {
      const mood = MOODS[currentHeart.mood];
      await window.sendLovePush(target, 'Una señal desde casa 💜', mood.push(PEOPLE[identity], identity), { type: 'heart' });
      const notifiedAt = new Date().toISOString();
      const { error } = await client.from('heart_states').update({ notified_at: notifiedAt }).eq('identity', identity).eq('updated_at', currentHeart.updated_at);
      if (error) throw error;
      currentHeart.notified_at = notifiedAt;
      heartStates[identity] = currentHeart;
      renderHeartStates();
      toast(`Le avisamos a ${PEOPLE[target]}`);
    } catch (error) {
      button.disabled = false;
      reportError(error, 'No se pudo enviar la señal');
      toast('No se pudo enviar la señal');
    }
  }

  async function rememberHeart() {
    if (!currentHeart || currentHeart.journaled_at) return;
    const button = $('#heartRemember');
    button.disabled = true;
    const mood = MOODS[currentHeart.mood];
    const { error } = await client.from('love_journal').insert({
      event_key: `heart:${identity}:${currentHeart.updated_at}`,
      from_identity: identity,
      event_type: 'heart',
      title: `${PEOPLE[identity]} dejó una señal de su corazón`,
      body: `${mood.emoji} ${mood.label}`,
      created_at: currentHeart.updated_at
    });
    if (error && error.code !== '23505') {
      button.disabled = false;
      return reportError(error, 'No se pudo guardar el estado en el diario');
    }
    const journaledAt = new Date().toISOString();
    await client.from('heart_states').update({ journaled_at: journaledAt }).eq('identity', identity).eq('updated_at', currentHeart.updated_at);
    currentHeart.journaled_at = journaledAt;
    heartStates[identity] = currentHeart;
    renderHeartStates();
    loadJournal();
    toast('Este momento quedó en el diario');
  }

  function noteElement(note) {
    const mine = note.from_identity === identity;
    const unread = !mine && !note.is_read;
    const article = document.createElement('article');
    article.className = `house-note-item${mine ? ' mine' : ''}`;

    const meta = document.createElement('div');
    meta.className = 'house-note-meta';
    const author = document.createElement('span');
    author.textContent = mine ? `Tu nota para ${PEOPLE[target]}` : `${PEOPLE[note.from_identity]} dejó esto para vos`;
    const time = document.createElement('time');
    time.dateTime = note.created_at;
    time.textContent = relativeTime(note.created_at);
    meta.append(author, time);

    const body = document.createElement('p');
    body.className = `house-note-body${unread ? ' sealed' : ''}`;
    body.textContent = note.body;

    const actions = document.createElement('div');
    actions.className = 'house-note-actions';
    if (unread) {
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = 'Abrir la nota';
      open.addEventListener('click', async () => {
        open.disabled = true;
        const { error } = await client.from('house_notes').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', note.id);
        if (error) return reportError(error, 'No se pudo abrir la nota');
        note.is_read = true;
        body.classList.remove('sealed');
        open.remove();
        navigator.vibrate?.([20, 30, 20]);
      });
      actions.appendChild(open);
    }
    if (!note.saved) {
      const save = document.createElement('button');
      save.type = 'button';
      save.textContent = '♡ Guardar como recuerdo';
      save.addEventListener('click', async () => {
        save.disabled = true;
        const [{ error: noteError }, { error: journalError }] = await Promise.all([
          client.from('house_notes').update({ saved: true }).eq('id', note.id),
          client.from('love_journal').update({ is_favorite: true }).eq('note_id', note.id)
        ]);
        if (noteError || journalError) {
          save.disabled = false;
          return reportError(noteError || journalError, 'No se pudo guardar la nota');
        }
        note.saved = true;
        save.textContent = '♥ Guardada';
        toast('La nota quedó en sus recuerdos');
        loadJournal();
      });
      actions.appendChild(save);
    } else {
      const saved = document.createElement('span');
      saved.textContent = '♥ Guardada';
      actions.appendChild(saved);
    }

    article.append(meta, body, actions);
    return article;
  }

  async function loadNotes() {
    const { data, error } = await client.from('house_notes').select('*').order('created_at', { ascending: false }).limit(8);
    if (error) return reportError(error, 'No se pudieron cargar las notas');
    const container = $('#houseNotes');
    if (!container) return;
    container.replaceChildren();
    if (!data?.length) {
      const empty = document.createElement('div');
      empty.className = 'together-empty';
      empty.textContent = 'La mesa está libre para la primera nota.';
      container.appendChild(empty);
      return;
    }
    data.forEach(note => container.appendChild(noteElement(note)));
  }

  async function sendNote() {
    const input = $('#houseNoteInput');
    const button = $('#houseNoteSend');
    const body = input?.value.trim();
    if (!body) return;
    button.disabled = true;
    const { error } = await client.from('house_notes').insert({ from_identity: identity, to_identity: target, body });
    if (error) {
      button.disabled = false;
      reportError(error, 'No se pudo dejar la nota');
      return toast('La nota no pudo salir');
    }
    input.value = '';
    $('#houseNoteCount').textContent = '0 / 180';
    await loadNotes();
    try {
      await window.sendLovePush(target, 'Hay una nota sobre la mesa 💌', `${PEOPLE[identity]} te dejó algo en nuestra casa`, { type: 'house-note' });
      toast(`La nota quedó esperando a ${PEOPLE[target]}`);
    } catch {
      toast('La nota quedó guardada, pero no pudimos avisarle');
    } finally {
      button.disabled = false;
    }
  }

  function journalEntryElement(entry, drawings) {
    const metaInfo = TYPE_META[entry.event_type] || { label: 'MOMENTO', emoji: '♡' };
    const article = document.createElement('article');
    article.className = 'journal-entry';
    article.dataset.type = entry.event_type;

    const top = document.createElement('div');
    top.className = 'journal-entry-top';
    const type = document.createElement('span');
    type.className = 'journal-entry-type';
    type.textContent = `${metaInfo.emoji} ${metaInfo.label}`;
    const time = document.createElement('time');
    time.dateTime = entry.created_at;
    time.textContent = relativeTime(entry.created_at);
    top.append(type, time);

    const title = document.createElement('h3');
    title.textContent = entry.title;
    article.append(top, title);
    if (entry.body) {
      const body = document.createElement('p');
      body.textContent = entry.body;
      article.appendChild(body);
    }
    const drawing = entry.drawing_id ? drawings.get(entry.drawing_id) : null;
    if (drawing?.data) {
      const image = document.createElement('img');
      image.className = 'journal-drawing';
      image.src = drawing.data;
      image.alt = `Dibujo guardado por ${PEOPLE[entry.from_identity]}`;
      image.addEventListener('click', () => window.openLight?.(drawing.data, entry.title));
      article.appendChild(image);
    }

    const actions = document.createElement('div');
    actions.className = 'journal-entry-actions';
    const favorite = document.createElement('button');
    favorite.type = 'button';
    favorite.className = entry.is_favorite ? 'is-favorite' : '';
    favorite.setAttribute('aria-label', entry.is_favorite ? 'Quitar de favoritos' : 'Guardar como favorito');
    favorite.textContent = entry.is_favorite ? '♥' : '♡';
    favorite.addEventListener('click', async () => {
      const nextValue = !entry.is_favorite;
      favorite.disabled = true;
      const { error } = await client.from('love_journal').update({ is_favorite: nextValue }).eq('id', entry.id);
      favorite.disabled = false;
      if (error) return reportError(error, 'No se pudo cambiar el favorito');
      entry.is_favorite = nextValue;
      renderJournal(drawings);
    });

    const commentWrap = document.createElement('div');
    commentWrap.className = 'journal-comment-wrap';
    const comment = document.createElement('input');
    comment.maxLength = 180;
    comment.value = entry.comment || '';
    comment.placeholder = 'Agregar unas palabras…';
    comment.setAttribute('aria-label', `Comentario para ${entry.title}`);
    const saveComment = document.createElement('button');
    saveComment.type = 'button';
    saveComment.textContent = '✓';
    saveComment.setAttribute('aria-label', 'Guardar comentario');
    saveComment.addEventListener('click', async () => {
      saveComment.disabled = true;
      const value = comment.value.trim() || null;
      const { error } = await client.from('love_journal').update({ comment: value }).eq('id', entry.id);
      saveComment.disabled = false;
      if (error) return reportError(error, 'No se pudo guardar el comentario');
      entry.comment = value;
      toast('Comentario guardado');
    });
    commentWrap.append(comment, saveComment);
    actions.append(favorite, commentWrap);
    article.appendChild(actions);
    return article;
  }

  async function loadJournal() {
    const { data, error } = await client.from('love_journal').select('*').order('created_at', { ascending: false }).limit(journalLimit);
    if (error) return reportError(error, 'No se pudo cargar el diario');
    journalEntries = data || [];
    const drawingIds = [...new Set(journalEntries.map(entry => entry.drawing_id).filter(Boolean))];
    const drawingMap = new Map();
    if (drawingIds.length) {
      const { data: drawings, error: drawingError } = await client.from('drawings').select('id,data,date').in('id', drawingIds);
      if (drawingError) reportError(drawingError, 'No se pudieron cargar los dibujos del diario');
      (drawings || []).forEach(drawing => drawingMap.set(drawing.id, drawing));
      // Algunas instalaciones antiguas no permiten leer `drawings` con la clave pública.
      // La Edge Function ya ofrece una lectura segura; ambos perfiles cubren los dos autores.
      if (drawingMap.size < drawingIds.length) {
        const responses = await Promise.all(['joel', 'princesa'].map(person =>
          client.functions.invoke('send-push', { body: { action: 'get-drawings', identity: person } })
        ));
        responses.forEach(({ data, error: functionError }) => {
          if (functionError) return reportError(functionError, 'No se pudieron recuperar los dibujos del diario');
          (data?.drawings || []).forEach(drawing => {
            if (drawingIds.includes(drawing.id)) drawingMap.set(drawing.id, drawing);
          });
        });
      }
    }
    renderJournal(drawingMap);
    const more = $('#journalMore');
    if (more) more.hidden = journalEntries.length < journalLimit;
  }

  function renderJournal(drawingMap = new Map()) {
    const container = $('#loveJournal');
    if (!container) return;
    container.replaceChildren();
    const visible = journalEntries.filter(entry => journalFilter === 'all'
      || (journalFilter === 'favorite' ? entry.is_favorite : entry.event_type === journalFilter));
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'together-empty';
      empty.textContent = journalFilter === 'all' ? 'El próximo gesto lindo va a empezar esta historia.' : 'Todavía no hay momentos en esta categoría.';
      container.appendChild(empty);
      return;
    }
    visible.forEach(entry => container.appendChild(journalEntryElement(entry, drawingMap)));
  }

  function scheduleRefresh(table) {
    refreshTables.add(table);
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const pending = new Set(refreshTables);
      refreshTables.clear();
      if (pending.has('heart_states')) loadHearts();
      if (pending.has('house_notes')) loadNotes();
      if (pending.has('love_journal') || pending.has('house_notes')) loadJournal();
    }, 180);
  }

  function subscribeToChanges() {
    client.channel(`together_${identity}_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'heart_states' }, () => scheduleRefresh('heart_states'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_notes' }, () => scheduleRefresh('house_notes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'love_journal' }, () => scheduleRefresh('love_journal'))
      .subscribe();
  }

  function openTogether() {
    const button = document.querySelector('.bottom-nav button[onclick*="together"]');
    if (button && typeof window.showTab === 'function') window.showTab(button, 'together');
  }

  function bindEvents() {
    $('#heartChoices')?.addEventListener('click', event => {
      const button = event.target.closest('[data-mood]');
      if (button) chooseMood(button.dataset.mood);
    });
    $('#heartClear')?.addEventListener('click', clearMood);
    $('#heartNotify')?.addEventListener('click', notifyHeart);
    $('#heartRemember')?.addEventListener('click', rememberHeart);
    $('#houseNoteInput')?.addEventListener('input', event => {
      $('#houseNoteCount').textContent = `${event.target.value.length} / 180`;
    });
    $('#houseNoteSend')?.addEventListener('click', sendNote);
    $('#journalFilters')?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      journalFilter = button.dataset.filter;
      $$('#journalFilters button').forEach(item => item.classList.toggle('active', item === button));
      loadJournal();
    });
    $('#journalMore')?.addEventListener('click', () => { journalLimit += 20; loadJournal(); });
    window.addEventListener('lovepresencechange', event => renderPresence(event.detail));
    navigator.serviceWorker?.addEventListener('message', event => {
      if (event.data?.type === 'notification-click' && ['house-note', 'heart'].includes(event.data?.data?.type)) openTogether();
    });
  }

  async function init(detail) {
    if (initialized) return;
    client = window._loveClient;
    identity = detail?.identity || window.loveIdentity || localStorage.getItem('love_identity');
    target = detail?.target || (identity === 'joel' ? 'princesa' : 'joel');
    if (!client || !PEOPLE[identity]) return;
    initialized = true;
    $('#romantic-update-surprise')?.remove();
    bindEvents();
    applyLocalTime();
    setInterval(applyLocalTime, 10 * 60 * 1000);
    renderPresence();
    if ($('#heartNotify')) $('#heartNotify').textContent = `Avisarle a ${PEOPLE[target]}`;
    await Promise.all([loadHearts(), loadNotes(), loadJournal()]);
    subscribeToChanges();
    if (location.hash === '#together') {
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(openTogether, 120);
    }
  }

  window.addEventListener('loveidentityready', event => init(event.detail));
  if (window.loveIdentity && window._loveClient) init({ identity: window.loveIdentity, target: window.loveTargetIdentity });
})();
