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
  let pendingLightTarget = null;
  let windowOpen = false;
  let acOn = false;
  let heaterOn = false;
  const lampStates = { joel: false, princesa: false };
  let plantState = { watered_at: null, watered_by: null, reference_at: null, growth: 0 };
  const avatarStates = { joel: { x: 0, y: 0 }, princesa: { x: 0, y: 0 } };
  let tableNote = null;
  const houseWeatherTemps = { joel: null, princesa: null };
  let conditionTimer;
  const refreshTables = new Set();

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  function toast(message) {
    if (typeof window.mostrarMensaje === 'function') window.mostrarMensaje(message);
    else console.info(message);
  }

  function evaluateHouseConditions() {
    const conditions = [];
    const period = $('#loveHouse')?.dataset.time;
    const daytime = period === 'morning' || period === 'day';
    const localTemperature = houseWeatherTemps[identity];
    if (acOn && heaterOn) conditions.push(['ac_heater', '🌡️', '¿Aire y calefacción juntos? Elegí un clima, mi amor.']);
    if (windowOpen && acOn) conditions.push(['dubai', '🏜️', '¿Qué estamos, en Dubái? El aire prendido y la ventana abierta.']);
    if (windowOpen && heaterOn) conditions.push(['window_heater', '🔥', 'La calefacción con la ventana abierta está intentando calentar el barrio.']);
    if (acOn && Number.isFinite(localTemperature) && localTemperature < 20) {
      conditions.push(['cold_ac', '🐧', `${Math.round(localTemperature)}° y el aire prendido… ¿queremos guardar pingüinos?`]);
    }
    if (daytime && (lampStates.joel || lampStates.princesa)) {
      const plural = lampStates.joel && lampStates.princesa;
      conditions.push(['day_lights', '💡', `No sabía que acá regalaban la luz. ${plural ? 'Lámparas prendidas' : 'Lámpara prendida'} y de día… la factura está llorando.`]);
    }

    const plantReference = plantState.watered_at || plantState.reference_at;
    if (plantReference) {
      const dryHours = (Date.now() - new Date(plantReference).getTime()) / 3600000;
      if (dryHours >= 72) conditions.push(['plant_days', '🥀', 'La plantita ya está preparando una denuncia por abandono.']);
      else if (dryHours >= 36) conditions.push(['plant_hours', '💧', 'La plantita mira el vaso de agua como si fuera un espejismo.']);
    }

    const panel = $('#houseConditionMessages');
    const list = $('#houseConditionList');
    if (!panel || !list) return;
    list.replaceChildren(...conditions.map(([key, emoji, message]) => {
      const item = document.createElement('p');
      item.dataset.condition = key;
      const icon = document.createElement('span');
      icon.textContent = emoji;
      item.append(icon, document.createTextNode(message));
      return item;
    }));
    panel.hidden = conditions.length === 0;
  }

  function queueHouseConditionCheck() {
    clearTimeout(conditionTimer);
    conditionTimer = setTimeout(evaluateHouseConditions, 80);
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

  function updateHouseClocks() {
    const now = new Date();
    const updateClock = (selector, timeZone, city) => {
      const clock = $(selector);
      if (!clock) return;
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
      const hourAngle = ((parts.hour % 12) + parts.minute / 60) * 30;
      const minuteAngle = (parts.minute + parts.second / 60) * 6;
      clock.style.setProperty('--hour-angle', `${hourAngle}deg`);
      clock.style.setProperty('--minute-angle', `${minuteAngle}deg`);
      clock.setAttribute('aria-label', `${city}: ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`);
    };
    updateClock('#houseClockGermany', 'Europe/Berlin', 'Kaiserslautern');
    updateClock('#houseClockEcuador', 'America/Guayaquil', 'Quito');
  }

  function weatherSymbol(code, isDay) {
    if (code === 0) return isDay ? '☀️' : '🌙';
    if ([1, 2].includes(code)) return isDay ? '🌤️' : '☁️';
    if (code === 3) return '☁️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
    if ([95, 96, 99].includes(code)) return '⛈️';
    return '🌡️';
  }

  async function loadHouseWeather() {
    const locations = [
      { person:'joel', element:'#houseWeatherGermany', latitude:49.44, longitude:7.77 },
      { person:'princesa', element:'#houseWeatherEcuador', latitude:-0.18, longitude:-78.47 }
    ];
    await Promise.all(locations.map(async location => {
      const output = $(location.element);
      if (!output) return;
      try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.search = new URLSearchParams({
          latitude:String(location.latitude),
          longitude:String(location.longitude),
          current:'temperature_2m,weather_code,is_day',
          timezone:'auto',
          forecast_days:'1'
        });
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
        const weather = (await response.json()).current;
        houseWeatherTemps[location.person] = Number(weather.temperature_2m);
        output.textContent = `${weatherSymbol(weather.weather_code, weather.is_day === 1)} ${Math.round(weather.temperature_2m)}°`;
        output.title = `${Math.round(weather.temperature_2m)} °C`;
      } catch (error) {
        console.warn('No se pudo cargar el clima de la casita', error);
        output.textContent = 'Clima —';
      }
    }));
    queueHouseConditionCheck(true);
  }

  function renderPresence(detail = window.lovePresenceState || {}) {
    const joelOnline = detail.joel === true || (identity === 'joel' && initialized);
    const princesaOnline = detail.princesa === true || (identity === 'princesa' && initialized);
    $('#houseJoel')?.classList.toggle('is-online', joelOnline);
    $('#housePrincesa')?.classList.toggle('is-online', princesaOnline);
    if ($('#houseJoelPresence')) $('#houseJoelPresence').textContent = joelOnline ? 'Está por acá' : 'No está ahora';
    if ($('#housePrincesaPresence')) $('#housePrincesaPresence').textContent = princesaOnline ? 'Está por acá' : 'No está ahora';
    $('#loveHouse')?.classList.toggle('both-online', joelOnline && princesaOnline);
    $$('[data-avatar-for]').forEach(avatar => {
      const mine = avatar.dataset.avatarFor === identity;
      const online = avatar.dataset.avatarFor === 'joel' ? joelOnline : princesaOnline;
      avatar.classList.toggle('is-mine', mine && online);
      avatar.tabIndex = mine && online ? 0 : -1;
    });
    const message = joelOnline && princesaOnline
      ? 'Están juntos acá.'
      : joelOnline ? 'Joel está por acá.'
      : princesaOnline ? 'Princesa está por acá.'
      : 'Ahora la casa está descansando.';
    if ($('#housePresenceMessage')) $('#housePresenceMessage').textContent = message;
  }

  function requestHouseLight(person) {
    if (person !== target) {
      toast('Esa es tu propia lámpara ♡');
      return;
    }
    pendingLightTarget = person;
    const confirm = $('#houseLightConfirm');
    if ($('#houseLightConfirmText')) $('#houseLightConfirmText').textContent = `¿Mandarle una luz a ${PEOPLE[person]}?`;
    if (confirm) confirm.hidden = false;
    $('#houseLightSend')?.focus();
  }

  function closeHouseLightConfirm() {
    pendingLightTarget = null;
    if ($('#houseLightConfirm')) $('#houseLightConfirm').hidden = true;
  }

  async function sendHouseLight() {
    const person = pendingLightTarget;
    if (!person || person !== target) return closeHouseLightConfirm();
    const send = $('#houseLightSend');
    if (send) { send.disabled = true; send.textContent = 'Enviando…'; }
    try {
      await window.sendLovePush(target, 'Te dejaron una luz encendida 💡', `${PEOPLE[identity]} dejó una luz esperándote en la casita`, { type: 'house-light' });
      await window._loveRoom?.send({ type:'broadcast', event:'mensaje', payload:{ text:'Dejé una luz encendida para vos 💡', from:identity } });
      toast(`Le avisaste a ${PEOPLE[target]} 🔔`);
      navigator.vibrate?.([12, 35, 12]);
    } catch (error) {
      toast('No pudimos avisarle, probá otra vez');
    } finally {
      closeHouseLightConfirm();
      if (send) { send.disabled = false; send.textContent = 'Enviar luz 💡'; }
    }
  }

  function setWindowState(open, announce = false) {
    windowOpen = Boolean(open);
    $('#houseWindow')?.classList.toggle('is-open', windowOpen);
    $('#houseWindow')?.setAttribute('aria-pressed', String(windowOpen));
    $('#houseWindow')?.setAttribute('aria-label', windowOpen ? 'Cerrar la ventana' : 'Abrir la ventana');
  }

  function setAcState(on, announce = false) {
    acOn = Boolean(on);
    $('.house-interior')?.classList.toggle('ac-on', acOn);
    const ac = $('#houseAc');
    if (ac) {
      ac.setAttribute('aria-pressed', String(acOn));
      ac.setAttribute('aria-label', acOn ? 'Apagar el aire acondicionado' : 'Encender el aire acondicionado');
      const status = ac.querySelector('small');
      if (status) status.textContent = acOn ? 'encendido' : 'apagado';
    }
  }

  function setHeaterState(on, announce = false) {
    heaterOn = Boolean(on);
    $('.house-interior')?.classList.toggle('heater-on', heaterOn);
    const heater = $('#houseHeater');
    if (heater) {
      heater.setAttribute('aria-pressed', String(heaterOn));
      heater.setAttribute('aria-label', heaterOn ? 'Apagar la calefacción' : 'Encender la calefacción');
      const status = heater.querySelector('small');
      if (status) status.textContent = heaterOn ? 'encendida' : 'apagada';
    }
  }

  function setLampState(person, on, announce = false) {
    if (!PEOPLE[person]) return;
    lampStates[person] = Boolean(on);
    const lamp = $(`[data-lamp-for="${person}"]`);
    lamp?.classList.toggle('is-lit', lampStates[person]);
    lamp?.setAttribute('aria-pressed', String(lampStates[person]));
    lamp?.setAttribute('aria-label', `${lampStates[person] ? 'Apagar' : 'Encender'} la lámpara de ${PEOPLE[person]}`);
  }

  function setPlantState(state = {}, announce = false) {
    plantState = {
      watered_at: state.watered_at || null,
      watered_by: state.watered_by || null,
      reference_at: state.watered_at || state.reference_at || plantState.reference_at || null,
      growth: Math.max(0, Math.min(4, Number(state.growth ?? plantState.growth) || 0))
    };
    const plant = $('#housePlant');
    const status = $('#housePlantStatus');
    const sprout = plant?.querySelector('span');
    const reference = plantState.watered_at || plantState.reference_at;
    const dryHours = reference ? (Date.now() - new Date(reference).getTime()) / 3600000 : Infinity;
    const stage = dryHours >= 72 ? 'wilted' : dryHours >= 36 ? 'thirsty' : plantState.growth >= 4 ? 'flower' : plantState.growth >= 2 ? 'grown' : 'sprout';
    ['sprout', 'grown', 'flower', 'thirsty', 'wilted'].forEach(name => plant?.classList.toggle(`plant-stage-${name}`, name === stage));
    if (sprout) sprout.textContent = stage === 'wilted' ? '🥀' : stage === 'thirsty' ? '🍂' : stage === 'flower' ? '🌷' : stage === 'grown' ? '🌿' : '🌱';
    if (plantState.watered_at) {
      plant?.classList.add('is-watered');
      if (status) status.textContent = stage === 'flower'
        ? `¡Le salió una flor! · ${relativeTime(plantState.watered_at).toLowerCase()}`
        : `${PEOPLE[plantState.watered_by] || 'Alguien'} la regó · ${relativeTime(plantState.watered_at).toLowerCase()}`;
    } else {
      plant?.classList.remove('is-watered');
      if (status) status.textContent = 'Nuestra plantita';
    }
  }

  function setAvatarState(person, state = {}) {
    if (!PEOPLE[person]) return;
    const next = {
      x: Math.max(-34, Math.min(34, Math.round(Number(state.x) || 0))),
      y: Math.max(-34, Math.min(8, Math.round(Number(state.y) || 0)))
    };
    avatarStates[person] = next;
    const avatar = $(`[data-avatar-for="${person}"]`);
    avatar?.style.setProperty('--avatar-x', `${next.x}px`);
    avatar?.style.setProperty('--avatar-y', `${next.y}px`);
  }

  function applyHouseDevice(device, state, announce = false) {
    if (device === 'window') setWindowState(state?.open ?? state, announce);
    if (device === 'ac') setAcState(state?.on ?? state, announce);
    if (device === 'heater') setHeaterState(state?.on ?? state, announce);
    if (device === 'lamp_joel') setLampState('joel', state?.on ?? state, announce);
    if (device === 'lamp_princesa') setLampState('princesa', state?.on ?? state, announce);
    if (device === 'plant') setPlantState(state, announce);
    if (device === 'avatar_joel') setAvatarState('joel', state);
    if (device === 'avatar_princesa') setAvatarState('princesa', state);
    if (announce) queueHouseConditionCheck(true);
  }

  async function saveHouseDevice(device, state) {
    const updatedAt = new Date().toISOString();
    await window._loveRoom?.send({ type:'broadcast', event:'house-action', payload:{ action:device, value:state, from:identity, updated_at:updatedAt } });
    const { error } = await client.from('house_devices').upsert({
      device,
      state,
      updated_by: identity,
      updated_at: updatedAt
    }, { onConflict:'device' });
    if (error) reportError(error, 'No se pudo guardar el estado de la casita');
  }

  async function loadHouseDevices() {
    const { data, error } = await client.from('house_devices').select('*');
    if (error) return reportError(error, 'No se pudo cargar el estado de la casita');
    (data || []).forEach(row => applyHouseDevice(row.device, row.device === 'plant'
      ? { ...row.state, reference_at:row.state?.watered_at || row.updated_at }
      : row.state));
  }

  async function toggleHouseWindow() {
    setWindowState(!windowOpen, true);
    await saveHouseDevice('window', { open:windowOpen });
    queueHouseConditionCheck(true);
  }

  async function toggleHouseAc() {
    setAcState(!acOn, true);
    await saveHouseDevice('ac', { on:acOn });
    queueHouseConditionCheck(true);
  }

  async function toggleHouseHeater() {
    setHeaterState(!heaterOn, true);
    await saveHouseDevice('heater', { on:heaterOn });
    queueHouseConditionCheck(true);
  }

  async function toggleHouseLamp(person) {
    if (!PEOPLE[person]) return;
    setLampState(person, !lampStates[person], true);
    await saveHouseDevice(`lamp_${person}`, { on:lampStates[person] });
    queueHouseConditionCheck(true);
  }

  async function waterHousePlant() {
    const lastWatered = plantState.watered_at ? new Date(plantState.watered_at).getTime() : 0;
    const mayGrow = !lastWatered || Date.now() - lastWatered >= 6 * 3600000;
    const state = {
      watered_at:new Date().toISOString(),
      watered_by:identity,
      growth:Math.min(4, plantState.growth + (mayGrow ? 1 : 0))
    };
    setPlantState(state, true);
    $('#housePlant')?.classList.add('is-watering');
    setTimeout(() => $('#housePlant')?.classList.remove('is-watering'), 900);
    await saveHouseDevice('plant', state);
    queueHouseConditionCheck(false);
  }

  function bindAvatarDrag(avatar) {
    let drag = null;
    avatar.addEventListener('pointerdown', event => {
      const person = avatar.dataset.avatarFor;
      if (person !== identity || !avatar.classList.contains('is-mine')) return;
      event.preventDefault();
      drag = { pointer:event.pointerId, startX:event.clientX, startY:event.clientY, x:avatarStates[person].x, y:avatarStates[person].y };
      avatar.setPointerCapture?.(event.pointerId);
      avatar.classList.add('is-dragging');
    });
    avatar.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointer) return;
      setAvatarState(identity, { x:drag.x + event.clientX - drag.startX, y:drag.y + event.clientY - drag.startY });
    });
    const finish = async event => {
      if (!drag || event.pointerId !== drag.pointer) return;
      drag = null;
      avatar.classList.remove('is-dragging');
      await saveHouseDevice(`avatar_${identity}`, avatarStates[identity]);
    };
    avatar.addEventListener('pointerup', finish);
    avatar.addEventListener('pointercancel', finish);
    avatar.addEventListener('keydown', async event => {
      if (avatar.dataset.avatarFor !== identity || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const delta = { ArrowLeft:[-5,0], ArrowRight:[5,0], ArrowUp:[0,-5], ArrowDown:[0,5] }[event.key];
      setAvatarState(identity, { x:avatarStates[identity].x + delta[0], y:avatarStates[identity].y + delta[1] });
      await saveHouseDevice(`avatar_${identity}`, avatarStates[identity]);
    });
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
        await loadNotes();
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

  function renderTableNote(notes = []) {
    const noteButton = $('#houseTableNote');
    if (!noteButton) return;
    tableNote = notes.find(note => !note.is_read && (note.to_identity === identity || note.from_identity === identity)) || null;
    noteButton.hidden = !tableNote;
    noteButton.classList.toggle('is-mine', tableNote?.from_identity === identity);
    if (tableNote) noteButton.setAttribute('aria-label', tableNote.from_identity === identity
      ? `Tu nota está esperando a ${PEOPLE[target]}`
      : `${PEOPLE[tableNote.from_identity]} dejó una nota sobre la mesa`);
  }

  async function loadNotes() {
    const { data, error } = await client.from('house_notes').select('*').order('created_at', { ascending: false }).limit(8);
    if (error) return reportError(error, 'No se pudieron cargar las notas');
    const container = $('#houseNotes');
    if (!container) return;
    renderTableNote(data || []);
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
      if (pending.has('house_devices')) loadHouseDevices();
    }, 180);
  }

  function subscribeToChanges() {
    client.channel(`together_${identity}_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'heart_states' }, () => scheduleRefresh('heart_states'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_notes' }, () => scheduleRefresh('house_notes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'love_journal' }, () => scheduleRefresh('love_journal'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_devices' }, () => scheduleRefresh('house_devices'))
      .subscribe();
  }

  function openTogether() {
    const button = document.querySelector('.bottom-nav button[onclick*="together"]');
    if (button && typeof window.showTab === 'function') window.showTab(button, 'together');
  }

  function bindEvents() {
    $$('[data-avatar-for]').forEach(bindAvatarDrag);
    $('.house-interior')?.addEventListener('click', event => {
      const lamp = event.target.closest('[data-lamp-for]');
      if (lamp) toggleHouseLamp(lamp.dataset.lampFor);
    });
    $('#houseLightNotify')?.addEventListener('click', () => requestHouseLight(target));
    $('#houseLightSend')?.addEventListener('click', sendHouseLight);
    $('#houseLightCancel')?.addEventListener('click', closeHouseLightConfirm);
    $('#houseWindow')?.addEventListener('click', toggleHouseWindow);
    $('#houseAc')?.addEventListener('click', toggleHouseAc);
    $('#houseHeater')?.addEventListener('click', toggleHouseHeater);
    $('#housePlant')?.addEventListener('click', waterHousePlant);
    $('#houseTableNote')?.addEventListener('click', () => {
      document.querySelector('.note-card')?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
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
    window.addEventListener('lovehouseaction', event => {
      if (event.detail?.from === identity) return;
      applyHouseDevice(event.detail?.action, event.detail?.value, true);
    });
    navigator.serviceWorker?.addEventListener('message', event => {
      if (event.data?.type === 'notification-click' && ['house-note', 'heart', 'house-light'].includes(event.data?.data?.type)) openTogether();
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
    updateHouseClocks();
    loadHouseWeather();
    setInterval(applyLocalTime, 10 * 60 * 1000);
    setInterval(updateHouseClocks, 30 * 1000);
    setInterval(loadHouseWeather, 15 * 60 * 1000);
    setInterval(() => {
      setPlantState(plantState);
      queueHouseConditionCheck(true);
    }, 60 * 60 * 1000);
    renderPresence();
    if ($('#heartNotify')) $('#heartNotify').textContent = `Avisarle a ${PEOPLE[target]}`;
    if ($('#houseLightNotify')) $('#houseLightNotify').textContent = `Avisarle a ${PEOPLE[target]} 🔔`;
    await Promise.all([loadHearts(), loadNotes(), loadJournal(), loadHouseDevices()]);
    queueHouseConditionCheck(true);
    subscribeToChanges();
    if (location.hash === '#together') {
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(openTogether, 120);
    }
  }

  window.addEventListener('loveidentityready', event => init(event.detail));
  if (window.loveIdentity && window._loveClient) init({ identity: window.loveIdentity, target: window.loveTargetIdentity });
})();
