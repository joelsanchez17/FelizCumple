/* Nuestra casa, señales del corazón y diario compartido. */
(() => {
  'use strict';

  const PEOPLE = { joel: 'Joel', princesa: 'Princesa' };
  const ROOMS = {
    bedroom: { label:'dormitorio', title:'Dormitorio' },
    kitchen: { label:'cocina', title:'Cocina' },
    bathroom: { label:'baño', title:'Baño' },
    dining: { label:'comedor', title:'Comedor' }
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
  let diningTableSet = false;
  let diningBreakfastDay = null;
  let diningBreakfastBy = null;
  let diningTvOn = false;
  const lampStates = { joel: false, princesa: false };
  let activityStates = {};
  const ROOM_PLANTS = {
    bedroom: { device:'plant', element:'#housePlant', status:'#housePlantStatus', name:'plantita', article:'la' },
    kitchen: { device:'cactus', element:'#kitchenPlant', status:'#kitchenPlantStatus', name:'cactus', article:'el' },
    bathroom: { device:'orchid', element:'#bathroomPlant', status:'#bathroomPlantStatus', name:'orquídea', article:'la' }
  };
  const emptyPlantState = () => ({ watered_at:null, watered_by:null, watered_day:null, reference_at:null, growth:0 });
  const plantStates = {
    bedroom:emptyPlantState(),
    kitchen:emptyPlantState(),
    bathroom:emptyPlantState()
  };
  const avatarStates = {
    bedroom: { joel:{ rx:0.31, ry:0.58 }, princesa:{ rx:0.69, ry:0.58 } },
    kitchen: { joel:{ rx:0.31, ry:0.64 }, princesa:{ rx:0.69, ry:0.64 } },
    bathroom: { joel:{ rx:0.31, ry:0.65 }, princesa:{ rx:0.69, ry:0.65 } },
    dining: { joel:{ rx:0.31, ry:0.64 }, princesa:{ rx:0.69, ry:0.64 } }
  };
  let currentRoom = null;
  let latestPresence = window.lovePresenceState || { joel:false, princesa:false, locations:{} };
  let partnerPresenceGrace = null;
  let partnerDepartureTimer;
  let tableNote = null;
  const houseWeatherTemps = { joel: null, princesa: null };
  let conditionTimer;
  let houseMotionMessage = null;
  let houseMotionTimer;
  let bedMomentTimer;
  let bedMomentActive = false;
  let bedMomentCount = 0;
  let pupitoAttempts = 0;
  let showerMotionTimer;
  let showerPrivateTimer;
  let showerPrivateActive = false;
  let pendingTailFrom = null;
  let pendingTailTimer;
  const roomMotionTimers = new Map();
  const seenMotionIds = new Set();
  const refreshTables = new Set();
  let changesChannel = null;
  let changesReconnectTimer = null;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  function toast(message) {
    if (typeof window.mostrarMensaje === 'function') window.mostrarMensaje(message);
    else console.info(message);
  }

  function evaluateHouseConditions() {
    const conditions = [];
    if (houseMotionMessage) conditions.push(['house_motion', houseMotionMessage.emoji, houseMotionMessage.text]);
    const period = $('#loveHouse')?.dataset.time;
    const daytime = period === 'morning' || period === 'day';
    const localTemperature = houseWeatherTemps[identity];
    const bothInBed = isInBed('joel') && isInBed('princesa');
    const joelSleeping = isSleeping('joel');
    const princesaSleeping = isSleeping('princesa');
    if (daytime && bothInBed) {
      conditions.push(['daytime_bed', '😏', '¿Acostados de día? Primero cariñitos, después ya sabemos… y al final una siestita.']);
    } else if (joelSleeping && princesaSleeping) {
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

    Object.entries(plantStates).forEach(([roomId, state]) => {
      const reference = state.watered_at || state.reference_at;
      if (!reference) return;
      const dryHours = (Date.now() - new Date(reference).getTime()) / 3600000;
      if (roomId === 'bedroom' && dryHours >= 72) conditions.push(['plant_days', '🥀', 'La plantita dice que si hoy tampoco toma agua se muda.']);
      else if (roomId === 'bedroom' && dryHours >= 36) conditions.push(['plant_hours', '💧', 'Che, la plantita está pidiendo agüita hace rato. ¿Querés que termine como tu orquídea?']);
      else if (roomId === 'bathroom' && dryHours >= 36) conditions.push(['orchid_thirsty', '🌸', 'La orquídea del baño está esperando su recorrida de agüita.']);
      else if (roomId === 'kitchen' && dryHours >= 72) conditions.push(['cactus_thirsty', '🌵', 'Hasta el cactus de la cocina tiene sed… eso ya es mucho.']);
    });

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

  function showHouseMotionMessage(text, emoji = '👀') {
    houseMotionMessage = { text, emoji };
    clearTimeout(houseMotionTimer);
    queueHouseConditionCheck();
    houseMotionTimer = setTimeout(() => {
      houseMotionMessage = null;
      queueHouseConditionCheck();
    }, 5200);
  }

  function showRoomMotionMessage(roomId, text, emoji = '👀') {
    const panel = $(`[data-room-motion-message="${roomId}"]`);
    if (!panel) return showHouseMotionMessage(text, emoji);
    panel.hidden = false;
    const icon = panel.querySelector('[data-room-motion-emoji]');
    const copy = panel.querySelector('[data-room-motion-copy]');
    if (icon) icon.textContent = emoji;
    if (copy) copy.textContent = text;
    clearTimeout(roomMotionTimers.get(roomId));
    roomMotionTimers.set(roomId, setTimeout(() => {
      panel.hidden = true;
      roomMotionTimers.delete(roomId);
    }, 6200));
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
    updateRoomActionAvailability();
  }

  function renderAvatarPositions(roomId = currentRoom) {
    if (!ROOMS[roomId]) return;
    ['joel', 'princesa'].forEach(person => setAvatarState(person, avatarStates[roomId][person], roomId));
  }

  async function enterHouseRoom(roomId) {
    if (!ROOMS[roomId]) return;
    if (activityStates[identity] && activityStates[identity].room_id !== roomId) await clearActivity(identity, { announce:false });
    currentRoom = roomId;
    closeAvatarActions();
    $('#houseEntrance').hidden = true;
    $$('.house-room-view').forEach(view => { view.hidden = view.dataset.roomView !== roomId; });
    const layer = $('#houseAvatarLayer');
    const surface = $(`[data-room-surface="${roomId}"]`);
    if (layer && surface) surface.appendChild(layer);
    renderAvatarPositions(roomId);
    localStorage.setItem('love_last_house_room', roomId);
    await window.updateLoveLocation?.('house', roomId, true);
    renderPresence(latestPresence);
    $('#loveHouse')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  async function openHouseMap() {
    currentRoom = null;
    closeAvatarActions();
    $$('.house-room-view').forEach(view => { view.hidden = true; });
    if ($('#houseEntrance')) $('#houseEntrance').hidden = false;
    await window.updateLoveLocation?.('house', null, true);
    renderPresence(latestPresence);
    $('#loveHouse')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  async function leaveHouse() {
    currentRoom = null;
    closeAvatarActions();
    $$('.house-room-view').forEach(view => { view.hidden = true; });
    if ($('#houseEntrance')) $('#houseEntrance').hidden = false;
    await window.updateLoveLocation?.('app', null, true);
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
      void window.sendLoveRealtime?.('mensaje', { text:'Dejé una luz encendida para vos 💡', from:identity });
      toast(`Le avisaste a ${PEOPLE[target]} 🔔`);
      window.loveHaptic?.([12, 35, 12]);
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

  function localDayKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function setRoomPlantState(roomId, state = {}, announce = false) {
    const config = ROOM_PLANTS[roomId];
    if (!config) return;
    const previous = plantStates[roomId];
    const next = {
      watered_at:state.watered_at || null,
      watered_by:state.watered_by || null,
      watered_day:state.watered_day || (state.watered_at ? localDayKey(new Date(state.watered_at)) : null),
      reference_at:state.watered_at || state.reference_at || previous.reference_at || null,
      growth:Math.max(0, Math.min(4, Number(state.growth ?? previous.growth) || 0))
    };
    plantStates[roomId] = next;
    const plant = $(config.element);
    const status = $(config.status);
    const reference = next.watered_at || next.reference_at;
    const dryHours = reference ? (Date.now() - new Date(reference).getTime()) / 3600000 : 0;
    const stage = dryHours >= 72 ? 'wilted' : dryHours >= 36 ? 'thirsty' : next.growth >= 4 ? 'flower' : next.growth >= 2 ? 'grown' : 'sprout';
    const wateredToday = next.watered_day === localDayKey();
    ['sprout', 'grown', 'flower', 'thirsty', 'wilted'].forEach(name => plant?.classList.toggle(`plant-stage-${name}`, name === stage));
    [0, 1, 2, 3, 4].forEach(level => plant?.classList.toggle(`plant-growth-${level}`, level === next.growth));
    plant?.classList.toggle('is-watered', wateredToday);
    if (status) {
      if (stage === 'flower') status.textContent = `¡A ${config.article} ${config.name} le salió una flor!`;
      else if (wateredToday) status.textContent = `${PEOPLE[next.watered_by] || 'Alguien'} ${config.article} regó hoy`;
      else if (stage === 'thirsty' || stage === 'wilted') status.textContent = `${config.article === 'el' ? 'El' : 'La'} ${config.name} necesita agüita`;
      else status.textContent = `${config.article === 'el' ? 'El' : 'La'} ${config.name} espera su agüita de hoy`;
    }
    if (announce) queueHouseConditionCheck();
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
    updateAvatarInteractionState();
  }

  function applyHouseDevice(device, state, announce = false, roomId = 'bedroom') {
    if (device?.startsWith('motion_')) {
      const person = device.replace('motion_', '');
      const motion = state?.motion || state;
      const expiresAt = state?.expires_at ? new Date(state.expires_at).getTime() : 0;
      if (!expiresAt || expiresAt > Date.now()) animateAvatarMotion(person, motion, roomId);
      return;
    }
    const roomPlant = Object.entries(ROOM_PLANTS).find(([candidate, config]) => candidate === roomId && config.device === device);
    if (roomPlant) setRoomPlantState(roomId, state, announce);
    if (roomId === 'dining' && device === 'dining_table') setDiningTableState(state, announce);
    if (roomId === 'dining' && device === 'dining_tv') setDiningTvState(state?.on ?? state, announce);
    if (roomId !== 'bedroom') return;
    if (device === 'window') setWindowState(state?.open ?? state, announce);
    if (device === 'ac') setAcState(state?.on ?? state, announce);
    if (device === 'heater') setHeaterState(state?.on ?? state, announce);
    if (device === 'lamp_joel') setLampState('joel', state?.on ?? state, announce);
    if (device === 'lamp_princesa') setLampState('princesa', state?.on ?? state, announce);
    if (announce) queueHouseConditionCheck(true);
  }

  async function saveHouseDevice(device, state, roomId = 'bedroom') {
    const updatedAt = new Date().toISOString();
    window.markLoveActivity?.(true);
    const { error } = await client.from('house_device_states').upsert({
      room_id:roomId,
      device_id:device,
      state,
      updated_by: identity,
      updated_at: updatedAt
    }, { onConflict:'room_id,device_id' });
    if (error) {
      await loadHouseDevices();
      reportError(error, 'No se pudo guardar el estado de la casita');
      toast('No se pudo guardar. Revisá la conexión e intentá otra vez.');
      return false;
    }
    void window.sendLoveRealtime?.('house-action', { room:roomId, action:device, value:state, from:identity, updated_at:updatedAt });
    return true;
  }

  async function sendHouseMotion(roomId, motion) {
    const updatedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30000).toISOString();
    const payload = { room:roomId, action:`motion_${identity}`, value:motion, from:identity, updated_at:updatedAt };
    window.markLoveActivity?.(true);
    const { error } = await client.from('house_device_states').upsert({
      room_id:roomId,
      device_id:`motion_${identity}`,
      state:{ motion, expires_at:expiresAt },
      updated_by:identity,
      updated_at:updatedAt
    }, { onConflict:'room_id,device_id' });
    if (error) console.warn('No se pudo guardar el respaldo breve de la acción', error);
    void window.sendLoveRealtime?.('house-action', payload);
  }

  function setDiningTableState(state, announce = false) {
    const normalized = typeof state === 'object' && state !== null ? state : { set:Boolean(state) };
    diningTableSet = Boolean(normalized.set);
    diningBreakfastDay = normalized.breakfast_day || null;
    diningBreakfastBy = normalized.breakfast_by || null;
    const breakfastToday = diningBreakfastDay === localDayKey();
    const table = $('#diningTable');
    table?.classList.toggle('is-set', diningTableSet);
    table?.classList.toggle('is-breakfast', breakfastToday && diningTableSet);
    table?.setAttribute('aria-pressed', String(diningTableSet));
    const morning = new Date().getHours() < 12;
    table?.setAttribute('aria-label', diningTableSet
      ? 'Levantar la mesa del comedor'
      : morning && !breakfastToday ? 'Preparar el desayuno de hoy' : 'Poner la mesa del comedor');
    const label = $('#diningTableLabel');
    if (label) label.textContent = diningTableSet
      ? breakfastToday ? 'Desayuno listo' : 'Levantar la mesa'
      : morning && !breakfastToday ? 'Preparar desayuno' : breakfastToday ? `Desayuno por ${PEOPLE[diningBreakfastBy] || 'los dos'} ✓` : 'Poner la mesa';
    if (announce) showRoomMotionMessage('dining', diningTableSet
      ? breakfastToday
        ? `${PEOPLE[diningBreakfastBy] || 'Alguien'} preparó el desayuno. Ahora falta sentarnos juntos.`
        : 'Mesa puesta. Ahora falta decidir quién cocina 👀'
      : 'Mesa levantada. Milagro: nadie dejó el plato ahí.', breakfastToday && diningTableSet ? '☕' : diningTableSet ? '🍽️' : '✨');
  }

  async function toggleDiningTable() {
    if (currentRoom !== 'dining') return;
    const breakfastToday = diningBreakfastDay === localDayKey();
    const prepareBreakfast = new Date().getHours() < 12 && !breakfastToday;
    const state = {
      set:prepareBreakfast ? true : !diningTableSet,
      breakfast_day:prepareBreakfast ? localDayKey() : diningBreakfastDay,
      breakfast_by:prepareBreakfast ? identity : diningBreakfastBy
    };
    setDiningTableState(state, true);
    await saveHouseDevice('dining_table', state, 'dining');
  }

  function setDiningTvState(isOn, announce = false) {
    diningTvOn = Boolean(isOn);
    const tv = $('#diningTv');
    const sofa = $('#diningSofa');
    tv?.classList.toggle('is-on', diningTvOn);
    tv?.setAttribute('aria-label', diningTvOn ? 'Televisión encendida' : 'Televisión apagada');
    const screen = tv?.querySelector('span');
    if (screen) screen.textContent = diningTvOn ? 'NETFLIX' : '';
    sofa?.classList.toggle('is-watching', diningTvOn);
    sofa?.setAttribute('aria-pressed', String(diningTvOn));
    sofa?.setAttribute('aria-label', diningTvOn ? 'Apagar la televisión' : 'Encender la televisión');
    const label = $('#diningSofaLabel');
    if (label) label.textContent = diningTvOn ? 'Apagar la tele' : 'Ver televisión';
    if (announce) showRoomMotionMessage('dining', diningTvOn
      ? 'Tele prendida. Este sillón tiene lugar para dos y cero distancia.'
      : 'Tele apagada. Ahora sí, a conversar o hacer cariñitos.', diningTvOn ? '📺' : '♡');
  }

  async function toggleDiningTv() {
    if (currentRoom !== 'dining') return;
    setDiningTvState(!diningTvOn, true);
    await saveHouseDevice('dining_tv', { on:diningTvOn }, 'dining');
  }

  async function loadHouseDevices() {
    const { data, error } = await client.from('house_device_states').select('*');
    if (error) return reportError(error, 'No se pudo cargar el estado de la casita');
    (data || []).forEach(row => applyHouseDevice(row.device_id, ROOM_PLANTS[row.room_id]?.device === row.device_id
      ? { ...row.state, reference_at:row.state?.watered_at || row.updated_at }
      : row.state, false, row.room_id));
    Object.entries(plantStates).forEach(([roomId, state]) => setRoomPlantState(roomId, state));
  }

  async function loadAvatarPositions() {
    const { data, error } = await client.from('house_avatar_positions').select('*');
    if (error) return reportError(error, 'No se pudieron cargar las posiciones de la casa');
    (data || []).forEach(row => setAvatarState(row.identity, { rx:row.x, ry:row.y }, row.room_id));
    renderAvatarPositions();
  }

  function isInBed(person) {
    const activity = activityStates[person];
    if (!activity || !['lying', 'sleeping'].includes(activity.activity) || activity.room_id !== 'bedroom') return false;
    return !activity.expires_at || new Date(activity.expires_at).getTime() > Date.now();
  }

  function isSleeping(person) {
    return isInBed(person) && activityStates[person]?.activity === 'sleeping';
  }

  function isShowering(person) {
    const activity = activityStates[person];
    if (!activity || activity.activity !== 'showering' || activity.room_id !== 'bathroom') return false;
    return !activity.expires_at || new Date(activity.expires_at).getTime() > Date.now();
  }

  function hasFixedActivity(person) {
    return isInBed(person) || isShowering(person);
  }

  function setActivityState(person, activity) {
    if (!PEOPLE[person]) return;
    if (activity?.activity) activityStates[person] = activity;
    else delete activityStates[person];
    renderHouseActivities();
    queueHouseConditionCheck();
  }

  function renderHouseActivities() {
    const occupants = ['joel', 'princesa'].filter(isInBed);
    const sleepers = occupants.filter(isSleeping);
    const mineInBed = isInBed(identity);
    const mineSleeping = isSleeping(identity);
    const bed = $('#houseBed');
    bed?.classList.toggle('has-occupant', occupants.length > 0);
    bed?.classList.toggle('both-sleeping', sleepers.length === 2);
    bed?.setAttribute('aria-pressed', String(mineInBed));
    bed?.setAttribute('aria-label', mineInBed ? 'Ver las opciones de la cama' : 'Acostarse en la cama');
    const bedLabel = $('#houseBedLabel');
    if (bedLabel) bedLabel.textContent = mineSleeping ? 'Durmiendo 💤' : mineInBed ? '¿Qué hacemos?' : 'Acostarse';

    const actions = $('#houseBedActions');
    if (actions) actions.hidden = currentRoom !== 'bedroom' || !mineInBed;
    const actionText = $('#houseBedActionText');
    if (actionText) actionText.textContent = mineSleeping ? 'Estás durmiendo a lo koala.' : 'Ya estás en la cama.';
    const sleepButton = $('#houseBedSleep');
    if (sleepButton) sleepButton.textContent = mineSleeping ? 'Despertarme' : 'Dormir a lo 🐨';
    const intimateButton = $('#houseBedIntimate');
    const bothAwakeInBed = occupants.length === 2 && sleepers.length === 0;
    if (intimateButton) {
      intimateButton.disabled = !bothAwakeInBed;
      intimateButton.textContent = bothAwakeInBed
        ? (bedMomentActive ? 'Asomarnos de la sábana 👀' : 'Meternos bajo la sábana 😏')
        : 'Esperando al otro 😏';
    }
    if (!bothAwakeInBed) stopBedMoment();

    const showering = ['joel', 'princesa'].filter(isShowering);
    const shower = $('#bathroomShower');
    const mineShowering = isShowering(identity);
    shower?.classList.toggle('is-running', showering.length > 0);
    shower?.classList.toggle('has-two', showering.length === 2);
    shower?.setAttribute('aria-pressed', String(mineShowering));
    shower?.setAttribute('aria-label', mineShowering ? 'Salir de la ducha' : 'Entrar a la ducha');
    const showerLabel = shower?.querySelector('small');
    if (showerLabel) showerLabel.textContent = mineShowering ? 'Salir de la ducha' : 'Entrar a la ducha';
    const showerStatus = $('#bathroomShowerStatus');
    if (showerStatus) showerStatus.textContent = showering.length === 2
      ? 'Se metieron juntos a la ducha 😏'
      : showering.length === 1 ? `${PEOPLE[showering[0]]} está en la ducha.` : 'La ducha está libre.';
    const showerActions = $('#bathroomShowerActions');
    if (showerActions) showerActions.hidden = currentRoom !== 'bathroom' || !mineShowering;
    const bothShowering = showering.length === 2;
    const requestTail = $('#bathroomRequestTail');
    const washTail = $('#bathroomWashTail');
    const privateButton = $('#bathroomShowerPrivate');
    if (requestTail) requestTail.disabled = !bothShowering;
    if (washTail) washTail.hidden = !(bothShowering && pendingTailFrom === target);
    if (privateButton) {
      privateButton.disabled = !bothShowering;
      privateButton.textContent = showerPrivateActive ? 'Abrir la cortina 👀' : 'Cerrar la cortina 😏';
    }
    if (!bothShowering) stopShowerPrivateMoment();

    ['joel', 'princesa'].forEach(person => {
      const avatar = $(`[data-avatar-for="${person}"]`);
      if (!avatar) return;
      const inBed = isInBed(person);
      const sleeping = isSleeping(person);
      const canWake = person === target && sleeping && currentRoom === 'bedroom' && avatar.classList.contains('is-online');
      avatar.classList.toggle('is-in-bed', inBed && currentRoom === 'bedroom');
      avatar.classList.toggle('is-sleeping', sleeping && currentRoom === 'bedroom');
      avatar.classList.toggle('is-in-shower', isShowering(person) && currentRoom === 'bathroom');
      const activityVisible = (inBed && currentRoom === 'bedroom') || (isShowering(person) && currentRoom === 'bathroom');
      avatar.classList.toggle('is-activity-visible', activityVisible);
      if (activityVisible) {
        avatar.style.opacity = '1';
        avatar.style.transform = 'translate(-50%,-50%) scale(1)';
      } else {
        avatar.style.removeProperty('opacity');
        avatar.style.removeProperty('transform');
      }
      avatar.classList.toggle('can-wake', canWake);
      if (canWake) {
        avatar.tabIndex = 0;
        avatar.setAttribute('aria-label', `Despertar a ${PEOPLE[person]}`);
      } else if (person === identity && inBed) {
        avatar.setAttribute('aria-label', sleeping ? 'Estás durmiendo' : 'Estás acostado en la cama');
      } else {
        avatar.setAttribute('aria-label', person === identity ? `Mover a ${PEOPLE[person]}; doble toque para saltar` : PEOPLE[person]);
      }
    });
    updateAvatarInteractionState();
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
    const previous = activityStates[person];
    setActivityState(person, null);
    window.markLoveActivity?.(true);
    const payload = { room:previous.room_id || 'bedroom', action:`activity_${person}`, value:null, from:identity, updated_at:new Date().toISOString() };
    const { error } = await client.from('house_activities').delete().eq('identity', person);
    if (error) {
      loadHouseActivities();
      return reportError(error, 'No se pudo terminar la actividad');
    }
    void window.sendLoveRealtime?.('house-action', payload);
    if (announce) toast(previous.activity === 'showering'
      ? (person === identity ? 'Saliste de la ducha.' : `${PEOPLE[person]} salió de la ducha.`)
      : (person === identity ? 'Ya te levantaste' : `Arriba, ${gendered(person, 'dormilón', 'dormilona')}.`));
    if (notify && person === target) {
      void window.sendLoveRealtime?.('mensaje', { text:`${PEOPLE[identity]} te despertó. Parece que quería atención o cariñitos.`, from:identity });
      try {
        await window.sendLovePush(target, `${PEOPLE[identity]} te despertó ☀️`, 'Parece que quería atención o cariñitos.', { type:'house-wake', room:'bedroom' });
      } catch (error) {
        console.warn('No se pudo enviar el aviso para despertar', error);
      }
    }
  }

  async function saveActivity(person, activityName, state = {}, roomId = 'bedroom') {
    if (!PEOPLE[person]) return false;
    const now = new Date().toISOString();
    const activity = {
      identity:person,
      room_id:roomId,
      activity:activityName,
      state,
      started_at:activityStates[person]?.started_at || now,
      expires_at:null,
      updated_at:now
    };
    setActivityState(person, activity);
    window.markLoveActivity?.(true);
    const { error } = await client.from('house_activities').upsert(activity, { onConflict:'identity' });
    if (error) {
      await loadHouseActivities();
      reportError(error, 'No se pudo guardar la actividad en la casa');
      return false;
    }
    void window.sendLoveRealtime?.('house-action', { room:roomId, action:`activity_${person}`, value:activity, from:identity, updated_at:now });
    return true;
  }

  async function useBed() {
    if (currentRoom !== 'bedroom') return;
    if (isInBed(identity)) return $('#houseBedActions')?.scrollIntoView({ behavior:'smooth', block:'nearest' });
    if (await saveActivity(identity, 'lying', { style:'koala' })) {
      toast('Te acostaste un ratito.');
      window.loveHaptic?.([12, 30, 12]);
    }
  }

  async function toggleBedSleep() {
    if (currentRoom !== 'bedroom') return;
    if (!isInBed(identity)) return useBed();
    if (isSleeping(identity)) {
      if (await saveActivity(identity, 'lying', { style:'koala', woke_up:true })) toast(`Ya estás ${gendered(identity, 'despierto', 'despierta')}, pero seguís ${gendered(identity, 'acostado', 'acostada')}.`);
      return;
    }
    if (await saveActivity(identity, 'sleeping', { style:'koala' })) {
      toast('Te acomodaste en la cama. A mimir 😴 o qué 😏?');
      window.loveHaptic?.([12, 30, 12]);
    }
  }

  async function leaveBed() {
    if (isInBed(identity)) await clearActivity(identity);
  }

  function stopBedMoment() {
    clearTimeout(bedMomentTimer);
    bedMomentActive = false;
    $('#houseBed')?.classList.remove('is-private-moment');
    $$('[data-avatar-for]').forEach(avatar => avatar.classList.remove('is-under-blanket'));
    const button = $('#houseBedIntimate');
    if (button && !button.disabled) button.textContent = 'Meternos bajo la sábana 😏';
  }

  function animateBedMoment(roomId = currentRoom, motion = {}) {
    if (roomId !== 'bedroom' || currentRoom !== 'bedroom' || !isInBed('joel') || !isInBed('princesa') || isSleeping('joel') || isSleeping('princesa')) return;
    if (motion.active === false) {
      stopBedMoment();
      showHouseMotionMessage('Ah, aparecieron otra vez. Acá no pasó nada 👀', '👀');
      return;
    }
    stopBedMoment();
    bedMomentActive = true;
    $('#houseBed')?.classList.add('is-private-moment');
    $$('[data-avatar-for]').forEach(avatar => avatar.classList.add('is-under-blanket'));
    const messages = [
      'Bueno… cierro la puerta. Yo no vi nada 😏',
      '¿Otra vez abajo? Esa sábana ya sabe demasiado 👀',
      'Entraron dos y desaparecieron. La casa no hace preguntas 😏',
      'Shhh… parece que abajo de esa sábana está pasando algo.'
    ];
    showHouseMotionMessage(messages[Math.abs(Number(motion.sequence) || 0) % messages.length], '🫣');
    window.loveHaptic?.([15, 40, 15]);
    const button = $('#houseBedIntimate');
    if (button) button.textContent = 'Asomarnos de la sábana 👀';
    bedMomentTimer = setTimeout(stopBedMoment, 20000);
  }

  async function startBedMoment() {
    if (currentRoom !== 'bedroom' || !isInBed('joel') || !isInBed('princesa') || isSleeping('joel') || isSleeping('princesa')) return;
    const motion = { type:'bed_moment', active:!bedMomentActive, sequence:++bedMomentCount, id:`${identity}-${Date.now()}-${Math.random().toString(16).slice(2)}` };
    animateBedMoment('bedroom', motion);
    await sendHouseMotion('bedroom', motion);
  }

  function clearTailRequest() {
    clearTimeout(pendingTailTimer);
    pendingTailFrom = null;
    renderHouseActivities();
  }

  function stopShowerPrivateMoment() {
    clearTimeout(showerPrivateTimer);
    showerPrivateActive = false;
    $('#bathroomShower')?.classList.remove('is-private-moment');
    $$('[data-avatar-for]').forEach(avatar => avatar.classList.remove('is-under-shower-curtain'));
    const button = $('#bathroomShowerPrivate');
    if (button && !button.disabled) button.textContent = 'Cerrar la cortina 😏';
  }

  function showShowerEffect(emoji, className = '') {
    const shower = $('#bathroomShower');
    if (!shower) return;
    shower.querySelectorAll('.shower-action-effect').forEach(item => item.remove());
    const effect = document.createElement('b');
    effect.className = `shower-action-effect ${className}`.trim();
    effect.textContent = emoji;
    shower.appendChild(effect);
    clearTimeout(showerMotionTimer);
    showerMotionTimer = setTimeout(() => effect.remove(), 1800);
  }

  function animateShowerMotion(person, motion, roomId = currentRoom) {
    if (roomId !== 'bathroom' || currentRoom !== 'bathroom' || !isShowering(person) || !motion?.kind) return;
    if (motion.kind === 'soap') {
      showShowerEffect('🧼', 'is-soap');
      showRoomMotionMessage('bathroom', `${PEOPLE[person]} levantó el jabón. Yo no voy a preguntar por qué se cayó.`, '🧼');
      return;
    }
    if (motion.kind === 'request_tail') {
      pendingTailFrom = person;
      clearTimeout(pendingTailTimer);
      pendingTailTimer = setTimeout(clearTailRequest, 20000);
      showShowerEffect('🫧', 'is-bubbles');
      showRoomMotionMessage('bathroom', `${PEOPLE[person]} preguntó: “¿Te lavo el rabito?”`, '🫧');
      renderHouseActivities();
      return;
    }
    if (motion.kind === 'wash_tail') {
      clearTailRequest();
      showShowerEffect('🫧🫧', 'is-bubbles');
      showRoomMotionMessage('bathroom', 'Aceptado. Listo, rabito lavado. Qué servicio tiene esta casa 😂', '🫧');
      return;
    }
    if (motion.kind !== 'private') return;
    if (motion.active === false) {
      stopShowerPrivateMoment();
      showRoomMotionMessage('bathroom', 'Bueno, ya abrieron la cortina. Acá no pasó nada 👀', '👀');
      return;
    }
    if (!isShowering('joel') || !isShowering('princesa')) return;
    stopShowerPrivateMoment();
    showerPrivateActive = true;
    $('#bathroomShower')?.classList.add('is-private-moment');
    $$('[data-avatar-for]').forEach(avatar => avatar.classList.add('is-under-shower-curtain'));
    showRoomMotionMessage('bathroom', 'Se cerró la cortina… el baño no da declaraciones 😏', '🚿');
    const button = $('#bathroomShowerPrivate');
    if (button) button.textContent = 'Abrir la cortina 👀';
    showerPrivateTimer = setTimeout(stopShowerPrivateMoment, 15000);
  }

  async function sendShowerMotion(kind) {
    if (currentRoom !== 'bathroom' || !isShowering(identity)) return;
    const bothShowering = isShowering('joel') && isShowering('princesa');
    if (['request_tail', 'wash_tail', 'private'].includes(kind) && !bothShowering) return;
    if (kind === 'wash_tail' && pendingTailFrom !== target) return;
    const motion = { type:'shower', kind, id:`${identity}-${Date.now()}-${Math.random().toString(16).slice(2)}` };
    if (kind === 'private') motion.active = !showerPrivateActive;
    animateShowerMotion(identity, motion, 'bathroom');
    window.loveHaptic?.([10, 30, 10]);
    await sendHouseMotion('bathroom', motion);
  }

  function bothPeopleAreHere(roomId = currentRoom) {
    if (!roomId || roomId !== currentRoom) return false;
    const otherLocation = latestPresence.locations?.[target] || partnerPresenceGrace;
    return Boolean(otherLocation?.area === 'house' && otherLocation?.room === roomId);
  }

  function updateRoomActionAvailability() {
    const toastButton = $('#diningToast');
    if (toastButton) {
      const inDining = currentRoom === 'dining';
      const together = inDining && bothPeopleAreHere('dining');
      toastButton.disabled = !inDining;
      toastButton.textContent = together ? 'Brindar juntos 🥂' : 'Dejar un brindis 🥂';
    }
  }

  function restartObjectAnimation(element, className, duration = 1800) {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), duration);
  }

  function animateRoomObjectMotion(person, motion, roomId = currentRoom) {
    if (roomId !== currentRoom || !motion?.kind) return;
    if (motion.kind === 'coffee' && roomId === 'kitchen') {
      restartObjectAnimation($('#kitchenCoffee'), 'is-brewing', 2400);
      showRoomMotionMessage('kitchen', `${PEOPLE[person]} preparó cafecito. La casa ya huele a mañana juntos.`, '☕');
      return;
    }
    if (motion.kind === 'brush' && roomId === 'bathroom') {
      restartObjectAnimation($('#bathroomToothbrush'), 'is-brushing', 1900);
      restartObjectAnimation($(`[data-avatar-for="${person}"]`), 'is-brushing-teeth', 1500);
      showRoomMotionMessage('bathroom', `${PEOPLE[person]} se está cepillando. Dos minutitos, sin hacer trampa 🪥`, '🪥');
      return;
    }
    if (motion.kind === 'toast' && roomId === 'dining') {
      restartObjectAnimation($('#diningTable'), 'is-toasting', 2100);
      const message = motion.together
        ? 'Un brindis por esta casita y por todo lo que falta vivir juntos.'
        : `${PEOPLE[person]} dejó una copa levantada. El brindis queda esperando al otro.`;
      showRoomMotionMessage('dining', message, '🥂');
    }
  }

  async function sendRoomObjectMotion(kind, roomId = currentRoom) {
    if (roomId !== currentRoom || hasFixedActivity(identity)) return;
    const motion = { type:'room_object', kind, id:`${identity}-${Date.now()}-${Math.random().toString(16).slice(2)}` };
    if (kind === 'toast') motion.together = bothPeopleAreHere('dining');
    animateRoomObjectMotion(identity, motion, roomId);
    window.loveHaptic?.([10, 25, 10]);
    await sendHouseMotion(roomId, motion);
  }

  async function toggleShower() {
    if (currentRoom !== 'bathroom') return;
    if (isShowering(identity)) return clearActivity(identity);
    if (await saveActivity(identity, 'showering', { water:'warm' }, 'bathroom')) {
      toast('Entraste a la ducha 🚿');
      window.loveHaptic?.([12, 30, 12]);
    }
  }

  async function wakeSleepingPartner() {
    if (currentRoom !== 'bedroom' || !isSleeping(target)) return;
    const avatar = $(`[data-avatar-for="${target}"]`);
    if (!avatar?.classList.contains('is-online')) return;
    if (!await saveActivity(target, 'lying', { style:'koala', woken_by:identity })) return;
    toast(`Arriba, ${gendered(target, 'dormilón', 'dormilona')}.`);
    void window.sendLoveRealtime?.('mensaje', { text:`${PEOPLE[identity]} te despertó. Parece que quería atención o cariñitos.`, from:identity });
    try {
      await window.sendLovePush(target, `${PEOPLE[identity]} te despertó ☀️`, 'Parece que quería atención o cariñitos.', { type:'house-wake', room:'bedroom' });
    } catch (error) {
      console.warn('No se pudo enviar el aviso para despertar', error);
    }
  }

  async function saveAvatarPosition(person, roomId) {
    if (!ROOMS[roomId] || !PEOPLE[person]) return;
    const position = avatarStates[roomId][person];
    const updatedAt = new Date().toISOString();
    window.markLoveActivity?.(true);
    const { error } = await client.from('house_avatar_positions').upsert({
      identity:person,
      room_id:roomId,
      x:position.rx,
      y:position.ry,
      updated_at:updatedAt
    }, { onConflict:'identity,room_id' });
    if (error) reportError(error, 'No se pudo guardar tu lugar en la habitación');
    else void window.sendLoveRealtime?.('house-action', { room:roomId, action:`avatar_${person}`, value:position, from:identity, updated_at:updatedAt });
  }

  function avatarsAreClose(roomId = currentRoom) {
    if (!ROOMS[roomId]) return false;
    const mine = avatarStates[roomId]?.[identity];
    const theirs = avatarStates[roomId]?.[target];
    const otherAvatar = $(`[data-avatar-for="${target}"]`);
    if (!mine || !theirs || !otherAvatar?.classList.contains('is-online')) return false;
    return Math.hypot(mine.rx - theirs.rx, (mine.ry - theirs.ry) * 1.15) <= .24;
  }

  function showSharedEmoji(emoji = '💕', roomId = currentRoom) {
    const layer = $('#houseAvatarLayer');
    const mine = avatarStates[roomId]?.[identity];
    const theirs = avatarStates[roomId]?.[target];
    if (!layer || !mine || !theirs || roomId !== currentRoom) return;
    layer.querySelectorAll('.house-jump-heart').forEach(item => item.remove());
    const heart = document.createElement('span');
    heart.className = 'house-jump-heart';
    heart.textContent = emoji;
    heart.style.setProperty('--heart-x', `${(mine.rx + theirs.rx) * 50}%`);
    heart.style.setProperty('--heart-y', `${(mine.ry + theirs.ry) * 50}%`);
    layer.appendChild(heart);
    heart.addEventListener('animationend', () => heart.remove(), { once:true });
    setTimeout(() => heart.remove(), 1400);
  }

  function closeAvatarActions() {
    const panel = $('#houseAvatarActions');
    if (panel) panel.hidden = true;
  }

  function openAvatarActions(mode) {
    const together = mode === 'together';
    if (together && (!avatarsAreClose() || hasFixedActivity(identity) || hasFixedActivity(target))) return;
    if (!together && hasFixedActivity(identity)) return;
    const panel = $('#houseAvatarActions');
    if (!panel) return;
    panel.dataset.mode = mode;
    panel.hidden = false;
    $('#houseSelfActions').hidden = together;
    $('#houseTogetherActions').hidden = !together;
    if ($('#housePupitoAction')) $('#housePupitoAction').hidden = !(together && identity === 'princesa' && target === 'joel');
    $('#houseAvatarActionsTitle').textContent = together ? `¿Qué hacemos con ${PEOPLE[target]}?` : '¿Qué querés hacer?';
    panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  function updateAvatarInteractionState() {
    if (!identity || !target) return;
    const partner = $(`[data-avatar-for="${target}"]`);
    if (!partner) return;
    const canInteract = avatarsAreClose() && !hasFixedActivity(identity) && !hasFixedActivity(target);
    partner.classList.toggle('can-interact', canInteract);
    if (canInteract) {
      partner.tabIndex = 0;
      partner.setAttribute('aria-label', `Hacer algo con ${PEOPLE[target]}`);
    } else if (!partner.classList.contains('can-wake')) {
      partner.tabIndex = -1;
      partner.setAttribute('aria-label', PEOPLE[target]);
      if ($('#houseAvatarActions')?.dataset.mode === 'together') closeAvatarActions();
    }
  }

  function restartMotionClass(avatar, className, duration = 1300) {
    if (!avatar) return;
    avatar.classList.remove('is-jumping', 'is-jump-reacting', 'is-dancing', 'pupito-almost', 'pupito-caught', 'pupito-guard');
    [...avatar.classList].filter(name => /^is-(kiss|hug|caress|tickle|pupito)-(actor|receiver)$/.test(name)).forEach(name => avatar.classList.remove(name));
    void avatar.offsetWidth;
    avatar.classList.add(className);
    if (duration > 0) setTimeout(() => avatar.classList.remove(className), duration);
  }

  const TOGETHER_MOTIONS = {
    kiss: { emoji:'💋', message:'Bueno… ese besito sí lo vi.' },
    hug: { emoji:'🫂', message:'Ahí entran los dos. Apriétense bien.' },
    caress: { emoji:'🤍', message:'La casa se quedó calladita para no interrumpir.' },
    tickle: { emoji:'😂', message:'Che, sin romper nada con esas cosquillas.' },
    pupito: { emoji:'👉', message:'¡El pupito no! Agus activó el modo defensa otra vez 😂' }
  };

  const PUPITO_REACTIONS = [
    { receiver:'', message:'Agus vio venir esa mano y activó el modo defensa 😂' },
    { receiver:'pupito-almost', message:'Casi, Koalita. Ese pupito estuvo demasiado cerca 👀' },
    { receiver:'pupito-caught', message:'¡Lo tocó! Agus se distrajo un segundo 😳' },
    { receiver:'pupito-guard', message:'Ahora Agus está cuidando el pupito con las dos manos 😂' }
  ];

  function animateTogetherMotion(person, motion, roomId) {
    const meta = TOGETHER_MOTIONS[motion?.kind];
    if (!meta || roomId !== currentRoom || !avatarsAreClose(roomId) || isInBed('joel') || isInBed('princesa')) return;
    const otherPerson = person === 'joel' ? 'princesa' : 'joel';
    const actor = $(`[data-avatar-for="${person}"]`);
    const receiver = $(`[data-avatar-for="${otherPerson}"]`);
    if (!actor?.classList.contains('is-online') || !receiver?.classList.contains('is-online')) return;
    const direction = avatarStates[roomId][otherPerson].rx >= avatarStates[roomId][person].rx ? 1 : -1;
    actor.style.setProperty('--action-x', `${direction * 10}px`);
    receiver.style.setProperty('--action-x', `${direction * -10}px`);
    actor.dataset.lastMotion = motion.id;
    restartMotionClass(actor, `is-${motion.kind}-actor`);
    restartMotionClass(receiver, `is-${motion.kind}-receiver`);
    let message = meta.message;
    if (motion.kind === 'pupito') {
      const reaction = PUPITO_REACTIONS[(Math.max(1, Number(motion.attempt) || 1) - 1) % PUPITO_REACTIONS.length];
      if (reaction.receiver) receiver.classList.add(reaction.receiver);
      message = reaction.message;
      setTimeout(() => receiver.classList.remove('pupito-almost', 'pupito-caught', 'pupito-guard'), 1300);
    }
    showSharedEmoji(meta.emoji, roomId);
    showHouseMotionMessage(message, meta.emoji);
  }

  function animateAvatarMotion(person, motion, roomId = currentRoom) {
    if (!PEOPLE[person] || !motion?.type || roomId !== currentRoom) return;
    if (motion.id && seenMotionIds.has(motion.id)) return;
    if (motion.id) {
      seenMotionIds.add(motion.id);
      setTimeout(() => seenMotionIds.delete(motion.id), 45000);
    }
    if (motion.type === 'bed_moment') return animateBedMoment(roomId, motion);
    if (motion.type === 'shower') return animateShowerMotion(person, motion, roomId);
    if (motion.type === 'room_object') return animateRoomObjectMotion(person, motion, roomId);
    if (hasFixedActivity(person)) return;
    if (motion.type === 'together') return animateTogetherMotion(person, motion, roomId);
    const avatar = $(`[data-avatar-for="${person}"]`);
    if (!avatar?.classList.contains('is-online')) return;
    avatar.dataset.lastMotion = motion.id || String(Date.now());
    if (motion.type === 'dance') {
      restartMotionClass(avatar, 'is-dancing', 1500);
      showHouseMotionMessage(`${PEOPLE[person]} se armó su propio bailecito.`, '💃');
      return;
    }
    if (motion.type !== 'jump') return;
    restartMotionClass(avatar, 'is-jumping', 680);

    if (avatarsAreClose(roomId)) {
      const otherPerson = person === 'joel' ? 'princesa' : 'joel';
      const otherAvatar = $(`[data-avatar-for="${otherPerson}"]`);
      otherAvatar?.classList.remove('is-jump-reacting');
      void otherAvatar?.offsetWidth;
      otherAvatar?.classList.add('is-jump-reacting');
      setTimeout(() => otherAvatar?.classList.remove('is-jump-reacting'), 680);
      showSharedEmoji('💕', roomId);
      showHouseMotionMessage('¿Eso fue un saltito o están haciendo temblar la casa? Yo no vi nada.');
    }
  }

  async function jumpAvatar() {
    if (!currentRoom || hasFixedActivity(identity)) return;
    const motion = { type:'jump', id:`${identity}-${Date.now()}-${Math.random().toString(16).slice(2)}` };
    animateAvatarMotion(identity, motion, currentRoom);
    window.loveHaptic?.([10, 25, 10]);
    await sendHouseMotion(currentRoom, motion);
  }

  async function sendAvatarMotion(type, extra = {}) {
    if (!currentRoom || hasFixedActivity(identity)) return;
    if (type === 'together' && (!avatarsAreClose() || hasFixedActivity(target))) return;
    if (type === 'together' && extra.kind === 'pupito') extra.attempt = ++pupitoAttempts;
    const motion = { type, id:`${identity}-${Date.now()}-${Math.random().toString(16).slice(2)}`, ...extra };
    animateAvatarMotion(identity, motion, currentRoom);
    if (extra.kind !== 'pupito') closeAvatarActions();
    window.loveHaptic?.(type === 'together' ? [10, 35, 10] : 10);
    await sendHouseMotion(currentRoom, motion);
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

  async function waterRoomPlant(roomId) {
    const config = ROOM_PLANTS[roomId];
    if (!config) return;
    const current = plantStates[roomId];
    const today = localDayKey();
    const mayGrow = current.watered_day !== today;
    const state = {
      watered_at:new Date().toISOString(),
      watered_by:identity,
      watered_day:today,
      growth:Math.min(4, current.growth + (mayGrow ? 1 : 0))
    };
    setRoomPlantState(roomId, state, true);
    $(config.element)?.classList.add('is-watering');
    setTimeout(() => $(config.element)?.classList.remove('is-watering'), 900);
    await saveHouseDevice(config.device, state, roomId);
    queueHouseConditionCheck(false);
  }

  function bindAvatarDrag(avatar) {
    let drag = null;
    let lastTap = null;
    let singleTapTimer;
    avatar.addEventListener('pointerdown', event => {
      const person = avatar.dataset.avatarFor;
      if (person !== identity || !avatar.classList.contains('is-mine') || hasFixedActivity(person)) return;
      event.preventDefault();
      drag = { pointer:event.pointerId, startX:event.clientX, startY:event.clientY, moved:false };
      avatar.setPointerCapture?.(event.pointerId);
    });
    avatar.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointer) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7) return;
      drag.moved = true;
      avatar.classList.add('is-dragging');
      const room = $(`[data-room-surface="${currentRoom}"]`)?.getBoundingClientRect();
      if (!room?.width || !room?.height) return;
      setAvatarState(identity, { rx:(event.clientX - room.left) / room.width, ry:(event.clientY - room.top) / room.height }, currentRoom);
    });
    const finish = async event => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const completedDrag = drag;
      drag = null;
      avatar.classList.remove('is-dragging');
      if (completedDrag.moved) {
        clearTimeout(singleTapTimer);
        lastTap = null;
        closeAvatarActions();
        await saveAvatarPosition(identity, currentRoom);
        return;
      }
      const now = Date.now();
      const doubleTap = lastTap && now - lastTap.at <= 380
        && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= 28;
      if (doubleTap) {
        clearTimeout(singleTapTimer);
        lastTap = null;
        closeAvatarActions();
        await jumpAvatar();
      } else {
        lastTap = { at:now, x:event.clientX, y:event.clientY };
        clearTimeout(singleTapTimer);
        singleTapTimer = setTimeout(() => {
          if (lastTap?.at === now) {
            lastTap = null;
            openAvatarActions('self');
          }
        }, 400);
      }
    };
    avatar.addEventListener('pointerup', finish);
    avatar.addEventListener('pointercancel', finish);
    avatar.addEventListener('click', () => {
      if (avatar.classList.contains('can-wake')) wakeSleepingPartner();
      else if (avatar.classList.contains('can-interact')) openAvatarActions('together');
    });
    avatar.addEventListener('keydown', async event => {
      if (avatar.classList.contains('can-wake') && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        await wakeSleepingPartner();
        return;
      }
      if (avatar.classList.contains('can-interact') && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openAvatarActions('together');
        return;
      }
      if (hasFixedActivity(identity)) return;
      if (avatar.dataset.avatarFor === identity && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        await jumpAvatar();
        return;
      }
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
    window.loveHaptic?.(15);
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
        window.loveHaptic?.([20, 30, 20]);
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
    clearTimeout(changesReconnectTimer);
    const previousChannel = changesChannel;
    changesChannel = null;
    if (previousChannel) void client.removeChannel(previousChannel);
    const channel = client.channel(`together_${identity}_${Math.random().toString(36).slice(2)}`);
    changesChannel = channel;
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'heart_states' }, () => scheduleRefresh('heart_states'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_notes' }, () => scheduleRefresh('house_notes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'love_journal' }, () => scheduleRefresh('love_journal'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_device_states' }, () => scheduleRefresh('house_device_states'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_avatar_positions' }, () => scheduleRefresh('house_avatar_positions'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_activities' }, () => scheduleRefresh('house_activities'))
      .subscribe(status => {
        if (changesChannel !== channel) return;
        if (status === 'SUBSCRIBED') {
          loadHouseDevices();
          loadAvatarPositions();
          loadHouseActivities();
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && navigator.onLine) {
          clearTimeout(changesReconnectTimer);
          changesReconnectTimer = setTimeout(subscribeToChanges, 2500);
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
    $('#houseBed')?.addEventListener('click', useBed);
    $('#houseBedSleep')?.addEventListener('click', toggleBedSleep);
    $('#houseBedIntimate')?.addEventListener('click', startBedMoment);
    $('#houseBedLeave')?.addEventListener('click', leaveBed);
    $('#bathroomShower')?.addEventListener('click', toggleShower);
    $('#bathroomShowerActions')?.addEventListener('click', event => {
      const button = event.target.closest('[data-shower-action]');
      if (button && !button.disabled) sendShowerMotion(button.dataset.showerAction);
    });
    $('#kitchenCoffee')?.addEventListener('click', () => sendRoomObjectMotion('coffee', 'kitchen'));
    $('#bathroomToothbrush')?.addEventListener('click', () => sendRoomObjectMotion('brush', 'bathroom'));
    $('#diningTable')?.addEventListener('click', toggleDiningTable);
    $('#diningSofa')?.addEventListener('click', toggleDiningTv);
    $('#diningToast')?.addEventListener('click', () => sendRoomObjectMotion('toast', 'dining'));
    $('#houseAvatarActionsClose')?.addEventListener('click', closeAvatarActions);
    $('#houseSelfActions')?.addEventListener('click', event => {
      const button = event.target.closest('[data-house-motion]');
      if (button) sendAvatarMotion(button.dataset.houseMotion);
    });
    $('#houseTogetherActions')?.addEventListener('click', event => {
      const button = event.target.closest('[data-house-together]');
      if (button) sendAvatarMotion('together', { kind:button.dataset.houseTogether });
    });
    $$('[data-room-plant]').forEach(plant => plant.addEventListener('click', () => waterRoomPlant(plant.dataset.roomPlant)));
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
        window.updateLoveLocation?.('house', currentRoom, true);
        loadHouseDevices();
        loadAvatarPositions();
        loadHouseActivities();
      }
    });
    window.addEventListener('online', () => {
      subscribeToChanges();
      loadHouseDevices();
      loadAvatarPositions();
      loadHouseActivities();
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
      const motionPerson = event.detail?.action?.startsWith('motion_') ? event.detail.action.replace('motion_', '') : null;
      if (avatarPerson) setAvatarState(avatarPerson, event.detail?.value, roomId);
      else if (activityPerson) setActivityState(activityPerson, event.detail?.value);
      else if (motionPerson) animateAvatarMotion(motionPerson, event.detail?.value, roomId);
      else applyHouseDevice(event.detail?.action, event.detail?.value, true, roomId);
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
      Object.entries(plantStates).forEach(([roomId, state]) => setRoomPlantState(roomId, state));
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
