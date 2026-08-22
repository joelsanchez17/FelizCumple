/* Nuestra casa, señales del corazón y diario compartido. */
(() => {
  'use strict';

  const PEOPLE = { joel: 'Joel', princesa: 'Princesa' };
  const ROOMS = {
    bedroom: { label:'dormitorio', title:'Dormitorio' },
    kitchen: { label:'cocina', title:'Cocina' },
    bathroom: { label:'baño', title:'Baño' }
  };
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
  let activityStates = {};
  let plantState = { watered_at: null, watered_by: null, reference_at: null, growth: 0 };
  const avatarStates = {
    bedroom: { joel:{ rx:0.31, ry:0.58 }, princesa:{ rx:0.69, ry:0.58 } },
    kitchen: { joel:{ rx:0.31, ry:0.64 }, princesa:{ rx:0.69, ry:0.64 } },
    bathroom: { joel:{ rx:0.31, ry:0.65 }, princesa:{ rx:0.69, ry:0.65 } }
  };
  let currentRoom = null;
  let latestPresence = window.lovePresenceState || { joel:false, princesa:false, locations:{} };
  let partnerPresenceGrace = null;
  let partnerDepartureTimer;
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
    const joelSleeping = isSleeping('joel');
    const princesaSleeping = isSleeping('princesa');
    if (joelSleeping && princesaSleeping) {
      conditions.push(['sleeping_together', '💤', 'Bueno, apago la luz. Modo cucharita activado.']);
    } else if (joelSleeping || princesaSleeping) {
      const sleeper = joelSleeping ? 'joel' : 'princesa';
      const sleepMessage = sleeper === identity
        ? `${PEOPLE[sleeper]} se quedó ${gendered(sleeper, 'mimido', 'mimida')}.`
        : `Shhh… ${PEOPLE[sleeper]} está durmiendo. Aunque podés ${sleeper === 'princesa' ? 'despertarla' : 'despertarlo'}.`;
      conditions.push(['sleeping', '🤫', sleepMessage]);
    }
    if (acOn && heaterOn) conditions.push(['ac_heater', '🌡️', 'Koalita, ¿el aire y la calefacción juntos? Decidite jajaja.']);
    if (windowOpen && acOn) conditions.push(['dubai', '🏜️', '¿Qué estamos en Dubái? Cerrá la ventana si vas a prender el aire 😂']);
    if (windowOpen && heaterOn) conditions.push(['window_heater', '🔥', 'Cielito, estás calentando todo el barrio con la ventana abierta.']);
    if (acOn && Number.isFinite(localTemperature) && localTemperature < 20) {
      conditions.push(['cold_ac', '🐧', `Hace ${Math.round(localTemperature)}° y prendés el aire… ¿vos querés que nos volvamos pingüinos?`]);
    }
    if (daytime && (lampStates.joel || lampStates.princesa)) {
      const plural = lampStates.joel && lampStates.princesa;
      conditions.push(['day_lights', '💡', `Será que en Ecuador regalan la luz… ${plural ? 'lámparas prendidas' : 'lámpara prendida'} y de día, camarada 💸`]);
    }

    const plantReference = plantState.watered_at || plantState.reference_at;
    if (plantReference) {
      const dryHours = (Date.now() - new Date(plantReference).getTime()) / 3600000;
      if (dryHours >= 72) conditions.push(['plant_days', '🥀', 'La plantita dice que si hoy tampoco toma agua se muda.']);
      else if (dryHours >= 36) conditions.push(['plant_hours', '💧', 'Che, la plantita está pidiendo agüita hace rato. ¿Querés que termine como tu orquídea?']);
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

  function renderPresence(detail = window.lovePresenceState || {}, forceDeparture = false) {
    latestPresence = detail;
    const rawTargetLocation = detail.locations?.[target] || null;
    if (rawTargetLocation) {
      clearTimeout(partnerDepartureTimer);
      partnerDepartureTimer = null;
      partnerPresenceGrace = rawTargetLocation;
    } else if (partnerPresenceGrace && !partnerDepartureTimer && !forceDeparture) {
      partnerDepartureTimer = setTimeout(() => {
        partnerDepartureTimer = null;
        partnerPresenceGrace = null;
        renderPresence(latestPresence, true);
      }, 45 * 1000);
    } else if (forceDeparture) {
      partnerPresenceGrace = null;
    }

    const targetLocation = rawTargetLocation || partnerPresenceGrace;
    const graceActive = !rawTargetLocation && Boolean(partnerPresenceGrace);
    const locations = { ...(detail.locations || {}) };
    locations[target] = targetLocation;
    locations[identity] = currentRoom
      ? { identity, area:'house', room:currentRoom }
      : { identity, area:document.body.classList.contains('together-active') ? 'house' : 'app', room:null };

    const visibleInRoom = person => Boolean(currentRoom && locations[person]?.area === 'house' && locations[person]?.room === currentRoom);
    const joelVisible = visibleInRoom('joel');
    const princesaVisible = visibleInRoom('princesa');
    const found = visibleInRoom(target);
    const targetOnline = Boolean(targetLocation);
    const targetAtHome = targetLocation?.area === 'house';

    $('#houseJoel')?.classList.toggle('is-online', joelVisible);
    $('#housePrincesa')?.classList.toggle('is-online', princesaVisible);
    const personStatus = person => {
      if (visibleInRoom(person)) return 'Está acá';
      if (locations[person]?.area === 'house') return 'Está en casa';
      if (person === identity || detail[person]) return 'Está en la app';
      return 'No está ahora';
    };
    if ($('#houseJoelPresence')) $('#houseJoelPresence').textContent = personStatus('joel');
    if ($('#housePrincesaPresence')) $('#housePrincesaPresence').textContent = personStatus('princesa');
    $('#loveHouse')?.classList.toggle('both-online', joelVisible && princesaVisible);
    $$('.house-room-view').forEach(view => view.classList.toggle('is-found', view.dataset.roomView === currentRoom && found));

    $$('[data-avatar-for]').forEach(avatar => {
      const mine = avatar.dataset.avatarFor === identity;
      const visible = visibleInRoom(avatar.dataset.avatarFor);
      avatar.classList.toggle('is-online', visible);
      avatar.classList.toggle('is-mine', mine && visible);
      avatar.tabIndex = mine && visible ? 0 : -1;
    });

    let message = 'Entraste a la casa.';
    if (currentRoom && found) message = graceActive ? 'Sigue acá; parece que su conexión va y viene.' : 'Se encontraron ♡';
    else if (currentRoom && targetAtHome) message = target === 'princesa'
      ? 'Princesa está en casa. Andá a buscarla 👀'
      : 'Agus está en casa. Buscalo👀';
    else if (currentRoom && targetOnline) message = `${PEOPLE[target]} está usando la app, pero todavía no entró a casa.`;
    else if (currentRoom) message = `Estás en ${ROOMS[currentRoom].label}. ${PEOPLE[target]} no está en casa ahora.`;

    if ($('#housePresenceMessage')) $('#housePresenceMessage').textContent = message;
    $$('[data-room-presence]').forEach(item => {
      if (item.dataset.roomPresence === currentRoom) item.textContent = message;
    });

    const homeStatus = $('#houseHomeStatus');
    const homeStatusText = homeStatus?.querySelector('strong');
    homeStatus?.classList.toggle('is-home', targetAtHome && !found);
    homeStatus?.classList.toggle('is-found', found);
    if (homeStatusText) {
      homeStatusText.textContent = found
        ? 'Están juntos en la misma habitación ♡'
        : targetAtHome ? (target === 'princesa' ? 'Princesa está en casa. Andá a buscarla 👀' : 'Agus está en casa. Buscalo👀')
        : targetOnline ? `${PEOPLE[target]} está por acá, pero todavía no entró a casa.`
        : 'La casa está tranquila.';
    }
    renderHouseActivities();
  }

  function renderAvatarPositions(roomId = currentRoom) {
    if (!ROOMS[roomId]) return;
    ['joel', 'princesa'].forEach(person => setAvatarState(person, avatarStates[roomId][person], roomId));
  }

  async function enterHouseRoom(roomId) {
    if (!ROOMS[roomId]) return;
    if (roomId !== 'bedroom' && isSleeping(identity)) await clearActivity(identity, { announce:false });
    currentRoom = roomId;
    $('#houseEntrance').hidden = true;
    $$('.house-room-view').forEach(view => { view.hidden = view.dataset.roomView !== roomId; });
    const layer = $('#houseAvatarLayer');
    const surface = $(`[data-room-surface="${roomId}"]`);
    if (layer && surface) surface.appendChild(layer);
    renderAvatarPositions(roomId);
    localStorage.setItem('love_last_house_room', roomId);
    await window.updateLoveLocation?.('house', roomId);
    renderPresence(latestPresence);
    $('#loveHouse')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  async function openHouseMap() {
    currentRoom = null;
    $$('.house-room-view').forEach(view => { view.hidden = true; });
    if ($('#houseEntrance')) $('#houseEntrance').hidden = false;
    await window.updateLoveLocation?.('house', null);
    renderPresence(latestPresence);
    $('#loveHouse')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  async function leaveHouse() {
    currentRoom = null;
    $$('.house-room-view').forEach(view => { view.hidden = true; });
    if ($('#houseEntrance')) $('#houseEntrance').hidden = false;
    await window.updateLoveLocation?.('app', null);
    renderPresence(latestPresence);
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

  function setAvatarState(person, state = {}, roomId = currentRoom || 'bedroom') {
    if (!PEOPLE[person] || !ROOMS[roomId]) return;
    const fallback = avatarStates[roomId][person];
    const next = {
      rx: Math.max(0.075, Math.min(0.925, Number.isFinite(Number(state.rx)) ? Number(state.rx) : fallback.rx)),
      ry: Math.max(0.10, Math.min(0.86, Number.isFinite(Number(state.ry)) ? Number(state.ry) : fallback.ry))
    };
    avatarStates[roomId][person] = next;
    if (roomId !== currentRoom) return;
    const avatar = $(`[data-avatar-for="${person}"]`);
    avatar?.style.setProperty('--avatar-left', `${next.rx * 100}%`);
    avatar?.style.setProperty('--avatar-top', `${next.ry * 100}%`);
  }

  function applyHouseDevice(device, state, announce = false) {
    if (device === 'window') setWindowState(state?.open ?? state, announce);
    if (device === 'ac') setAcState(state?.on ?? state, announce);
    if (device === 'heater') setHeaterState(state?.on ?? state, announce);
    if (device === 'lamp_joel') setLampState('joel', state?.on ?? state, announce);
    if (device === 'lamp_princesa') setLampState('princesa', state?.on ?? state, announce);
    if (device === 'plant') setPlantState(state, announce);
    if (announce) queueHouseConditionCheck(true);
  }

  async function saveHouseDevice(device, state) {
    const updatedAt = new Date().toISOString();
    await window._loveRoom?.send({ type:'broadcast', event:'house-action', payload:{ room:'bedroom', action:device, value:state, from:identity, updated_at:updatedAt } });
    const { error } = await client.from('house_device_states').upsert({
      room_id:'bedroom',
      device_id:device,
      state,
      updated_by: identity,
      updated_at: updatedAt
    }, { onConflict:'room_id,device_id' });
    if (error) reportError(error, 'No se pudo guardar el estado de la casita');
  }

  async function loadHouseDevices() {
    const { data, error } = await client.from('house_device_states').select('*').eq('room_id', 'bedroom');
    if (error) return reportError(error, 'No se pudo cargar el estado de la casita');
    (data || []).forEach(row => applyHouseDevice(row.device_id, row.device_id === 'plant'
      ? { ...row.state, reference_at:row.state?.watered_at || row.updated_at }
      : row.state));
  }

  async function loadAvatarPositions() {
    const { data, error } = await client.from('house_avatar_positions').select('*');
    if (error) return reportError(error, 'No se pudieron cargar las posiciones de la casa');
    (data || []).forEach(row => setAvatarState(row.identity, { rx:row.x, ry:row.y }, row.room_id));
    renderAvatarPositions();
  }

  function isSleeping(person) {
    const activity = activityStates[person];
    if (!activity || activity.activity !== 'sleeping' || activity.room_id !== 'bedroom') return false;
    return !activity.expires_at || new Date(activity.expires_at).getTime() > Date.now();
  }

  function setActivityState(person, activity) {
    if (!PEOPLE[person]) return;
    if (activity?.activity) activityStates[person] = activity;
    else delete activityStates[person];
    renderHouseActivities();
    queueHouseConditionCheck();
  }

  function renderHouseActivities() {
    const sleepers = ['joel', 'princesa'].filter(isSleeping);
    const mineSleeping = isSleeping(identity);
    const bed = $('#houseBed');
    bed?.classList.toggle('has-sleeper', sleepers.length > 0);
    bed?.classList.toggle('both-sleeping', sleepers.length === 2);
    bed?.setAttribute('aria-pressed', String(mineSleeping));
    bed?.setAttribute('aria-label', mineSleeping ? 'Levantarte de la cama' : 'Dormir a lo koala');
    const bedLabel = $('#houseBedLabel');
    if (bedLabel) bedLabel.textContent = mineSleeping ? 'Levantarme' : 'Dormir a lo 🐨';

    ['joel', 'princesa'].forEach(person => {
      const avatar = $(`[data-avatar-for="${person}"]`);
      if (!avatar) return;
      const sleeping = isSleeping(person);
      const canWake = person === target && sleeping && currentRoom === 'bedroom' && avatar.classList.contains('is-online');
      avatar.classList.toggle('is-sleeping', sleeping && currentRoom === 'bedroom');
      avatar.classList.toggle('can-wake', canWake);
      if (canWake) {
        avatar.tabIndex = 0;
        avatar.setAttribute('aria-label', `Despertar a ${PEOPLE[person]}`);
      } else if (person === identity && sleeping) {
        avatar.setAttribute('aria-label', 'Estás durmiendo. Tocá la cama para levantarte');
      } else {
        avatar.setAttribute('aria-label', person === identity ? `Mover a ${PEOPLE[person]} por la habitación` : PEOPLE[person]);
      }
    });
  }

  async function loadHouseActivities() {
    const { data, error } = await client.from('house_activities').select('*');
    if (error) return reportError(error, 'No se pudieron cargar las actividades de la casa');
    activityStates = Object.fromEntries((data || [])
      .filter(item => !item.expires_at || new Date(item.expires_at).getTime() > Date.now())
      .map(item => [item.identity, item]));
    renderHouseActivities();
    queueHouseConditionCheck();
  }

  async function clearActivity(person, { announce = true, notify = false } = {}) {
    if (!PEOPLE[person] || !activityStates[person]) return;
    setActivityState(person, null);
    await window._loveRoom?.send({
      type:'broadcast', event:'house-action',
      payload:{ room:'bedroom', action:`activity_${person}`, value:null, from:identity, updated_at:new Date().toISOString() }
    });
    const { error } = await client.from('house_activities').delete().eq('identity', person);
    if (error) {
      loadHouseActivities();
      return reportError(error, 'No se pudo terminar la actividad');
    }
    if (announce) toast(person === identity ? 'Ya te levantaste' : `Arriba, ${gendered(person, 'dormilón', 'dormilona')}.`);
    if (notify && person === target) {
      await window._loveRoom?.send({ type:'broadcast', event:'mensaje', payload:{ text:`${PEOPLE[identity]} te despertó. Parece que quería atención o cariñitos.`, from:identity } });
      try {
        await window.sendLovePush(target, `${PEOPLE[identity]} te despertó ☀️`, 'Parece que quería atención o cariñitos.', { type:'house-wake', room:'bedroom' });
      } catch (error) {
        console.warn('No se pudo enviar el aviso para despertar', error);
      }
    }
  }

  async function toggleSleep() {
    if (currentRoom !== 'bedroom') return;
    if (isSleeping(identity)) return clearActivity(identity);
    const now = new Date().toISOString();
    const activity = {
      identity,
      room_id:'bedroom',
      activity:'sleeping',
      state:{ style:'koala' },
      started_at:now,
      expires_at:null,
      updated_at:now
    };
    setActivityState(identity, activity);
    await window._loveRoom?.send({
      type:'broadcast', event:'house-action',
      payload:{ room:'bedroom', action:`activity_${identity}`, value:activity, from:identity, updated_at:now }
    });
    const { error } = await client.from('house_activities').upsert(activity, { onConflict:'identity' });
    if (error) {
      setActivityState(identity, null);
      return reportError(error, 'No se pudo guardar que estás durmiendo');
    }
    toast('Te acomodaste en la cama. A mimir 😴 o qué 😏?');
    navigator.vibrate?.([12, 30, 12]);
  }

  async function wakeSleepingPartner() {
    if (currentRoom !== 'bedroom' || !isSleeping(target)) return;
    const avatar = $(`[data-avatar-for="${target}"]`);
    if (!avatar?.classList.contains('is-online')) return;
    await clearActivity(target, { announce:true, notify:true });
  }

  async function saveAvatarPosition(person, roomId) {
    if (!ROOMS[roomId] || !PEOPLE[person]) return;
    const position = avatarStates[roomId][person];
    const updatedAt = new Date().toISOString();
    await window._loveRoom?.send({ type:'broadcast', event:'house-action', payload:{ room:roomId, action:`avatar_${person}`, value:position, from:identity, updated_at:updatedAt } });
    const { error } = await client.from('house_avatar_positions').upsert({
      identity:person,
      room_id:roomId,
      x:position.rx,
      y:position.ry,
      updated_at:updatedAt
    }, { onConflict:'identity,room_id' });
    if (error) reportError(error, 'No se pudo guardar tu lugar en la habitación');
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
      if (person !== identity || !avatar.classList.contains('is-mine') || isSleeping(person)) return;
      event.preventDefault();
      drag = { pointer:event.pointerId };
      avatar.setPointerCapture?.(event.pointerId);
      avatar.classList.add('is-dragging');
    });
    avatar.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const room = $(`[data-room-surface="${currentRoom}"]`)?.getBoundingClientRect();
      if (!room?.width || !room?.height) return;
      setAvatarState(identity, { rx:(event.clientX - room.left) / room.width, ry:(event.clientY - room.top) / room.height }, currentRoom);
    });
    const finish = async event => {
      if (!drag || event.pointerId !== drag.pointer) return;
      drag = null;
      avatar.classList.remove('is-dragging');
      await saveAvatarPosition(identity, currentRoom);
    };
    avatar.addEventListener('pointerup', finish);
    avatar.addEventListener('pointercancel', finish);
    avatar.addEventListener('click', () => {
      if (avatar.classList.contains('can-wake')) wakeSleepingPartner();
    });
    avatar.addEventListener('keydown', async event => {
      if (avatar.classList.contains('can-wake') && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        await wakeSleepingPartner();
        return;
      }
      if (isSleeping(identity)) return;
      if (avatar.dataset.avatarFor !== identity || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const delta = { ArrowLeft:[-.025,0], ArrowRight:[.025,0], ArrowUp:[0,-.025], ArrowDown:[0,.025] }[event.key];
      setAvatarState(identity, { rx:avatarStates[currentRoom][identity].rx + delta[0], ry:avatarStates[currentRoom][identity].ry + delta[1] }, currentRoom);
      await saveAvatarPosition(identity, currentRoom);
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
    tableNote = notes.find(note => (note.room_id || 'bedroom') === 'bedroom' && !note.is_read && (note.to_identity === identity || note.from_identity === identity)) || null;
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
      empty.textContent = 'Todavía no dejaron ninguna notita.';
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
    const noteRoom = currentRoom || 'bedroom';
    const { error } = await client.from('house_notes').insert({ from_identity: identity, to_identity: target, body, room_id:noteRoom });
    if (error) {
      button.disabled = false;
      reportError(error, 'No se pudo dejar la nota');
      return toast('La nota no pudo salir');
    }
    input.value = '';
    $('#houseNoteCount').textContent = '0 / 180';
    await loadNotes();
    try {
      await window.sendLovePush(target, 'Hay una nota esperando 💌', `${PEOPLE[identity]} te dejó algo en ${ROOMS[noteRoom]?.label || 'nuestra casa'}`, { type: 'house-note', room:noteRoom });
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
    // Los mimos son instantáneos: no deben tapar notas y dibujos en el diario.
    const { data, error } = await client.from('love_journal').select('*').neq('event_type', 'mimo').order('created_at', { ascending: false }).limit(journalLimit);
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
      empty.textContent = journalFilter === 'all' ? 'Todavía está vacío, pero no por mucho.' : 'Todavía no hay momentos en esta categoría.';
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
      if (pending.has('house_device_states')) loadHouseDevices();
      if (pending.has('house_avatar_positions')) loadAvatarPositions();
      if (pending.has('house_activities')) loadHouseActivities();
    }, 180);
  }

  function subscribeToChanges() {
    client.channel(`together_${identity}_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'heart_states' }, () => scheduleRefresh('heart_states'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_notes' }, () => scheduleRefresh('house_notes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'love_journal' }, () => scheduleRefresh('love_journal'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_device_states' }, () => scheduleRefresh('house_device_states'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_avatar_positions' }, () => scheduleRefresh('house_avatar_positions'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_activities' }, () => scheduleRefresh('house_activities'))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          loadHouseDevices();
          loadAvatarPositions();
          loadHouseActivities();
        }
      });
  }

  function openTogether() {
    const button = document.querySelector('.bottom-nav button[onclick*="together"]');
    if (button && typeof window.showTab === 'function') window.showTab(button, 'together');
  }

  function bindEvents() {
    $$('[data-avatar-for]').forEach(bindAvatarDrag);
    $$('[data-enter-room]').forEach(button => button.addEventListener('click', () => enterHouseRoom(button.dataset.enterRoom)));
    $$('[data-open-house-map]').forEach(button => button.addEventListener('click', openHouseMap));
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
    $('#houseBed')?.addEventListener('click', toggleSleep);
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
    window.addEventListener('lovetabchange', event => {
      if (event.detail?.tabId === 'together') {
        const lastRoom = localStorage.getItem('love_last_house_room');
        enterHouseRoom(ROOMS[lastRoom] ? lastRoom : 'bedroom');
      }
      else leaveHouse();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) window.updateLoveLocation?.('app', null);
      else if (document.body.classList.contains('together-active')) {
        window.updateLoveLocation?.('house', currentRoom);
        loadHouseDevices();
        loadAvatarPositions();
        loadHouseActivities();
      }
    });
    window.addEventListener('loverealtimeconnected', () => {
      loadHouseDevices();
      loadAvatarPositions();
      loadHouseActivities();
    });
    window.addEventListener('lovehouseaction', event => {
      const roomId = event.detail?.room || 'bedroom';
      const avatarPerson = event.detail?.action?.startsWith('avatar_') ? event.detail.action.replace('avatar_', '') : null;
      const activityPerson = event.detail?.action?.startsWith('activity_') ? event.detail.action.replace('activity_', '') : null;
      if (avatarPerson) setAvatarState(avatarPerson, event.detail?.value, roomId);
      else if (activityPerson) setActivityState(activityPerson, event.detail?.value);
      else if (roomId === 'bedroom') applyHouseDevice(event.detail?.action, event.detail?.value, true);
    });
    navigator.serviceWorker?.addEventListener('message', event => {
      if (event.data?.type === 'notification-click' && ['house-note', 'heart', 'house-light', 'house-wake'].includes(event.data?.data?.type)) openTogether();
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
    await Promise.all([loadHearts(), loadNotes(), loadJournal(), loadHouseDevices(), loadAvatarPositions(), loadHouseActivities()]);
    queueHouseConditionCheck(true);
    subscribeToChanges();
    if ($('#together')?.classList.contains('active')) {
      const lastRoom = localStorage.getItem('love_last_house_room');
      enterHouseRoom(ROOMS[lastRoom] ? lastRoom : 'bedroom');
    }
    if (location.hash === '#together') {
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(openTogether, 120);
    }
  }

  window.addEventListener('loveidentityready', event => init(event.detail));
  if (window.loveIdentity && window._loveClient) init({ identity: window.loveIdentity, target: window.loveTargetIdentity });
})();
