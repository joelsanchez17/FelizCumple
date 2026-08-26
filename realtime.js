const SUPABASE_URL = 'https://xvdexhbasqbhvsuitucr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_seKLcc9W-48bDasah75j4A_fOm3yMxJ';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const LABEL = { joel: 'Joel 👨🏻‍💻', princesa: 'Princesa 👩🏻‍🔬' };

window._loveClient = client;
window.partnerOnline = false;
window.lovePresenceState = { joel: false, princesa: false, locations: {} };
window.toggleToolbar = () => {};
window.enviarMimo = () => {};
window.enviarMensaje = () => {};
window.enviarMensajePersonalizado = () => {};
window.activarNotificaciones = () => {};

function updatePushPrompt(state, message = '', announce = false) {
  const prompt = document.getElementById('pushPrompt');
  const text = document.getElementById('pushPromptText');
  const button = document.getElementById('pushEnableButton');
  if (!prompt) return;
  if (state === 'ready') {
    prompt.hidden = true;
    if (announce) mostrarMensaje('Notificaciones activadas');
    return;
  }
  prompt.hidden = false;
  if (text && message) text.textContent = message;
  if (button) button.disabled = state === 'working';
  if (button) button.textContent = state === 'working' ? 'Activando…' : 'Activar notificaciones';
}

function decodeVapidKey(value) {
  const base64 = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}

async function subscribeToPush(identity, fromUserGesture = false) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    updatePushPrompt('error', 'Las notificaciones requieren instalar la app desde Safari.');
    return false;
  }
  try {
    if (Notification.permission === 'default' && !fromUserGesture) {
      updatePushPrompt('waiting', 'Activá las notificaciones para recibir dibujos y mensajes.');
      return false;
    }
    if (fromUserGesture || Notification.permission !== 'granted') updatePushPrompt('working');
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') {
      updatePushPrompt('error', 'Están bloqueadas. Activalas en Ajustes → Notificaciones → KoalaApp.');
      return false;
    }
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (!response.ok) throw new Error('No se pudo obtener la clave VAPID pública');
      const { publicKey } = await response.json();
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey)
      });
    }
    const push = subscription.toJSON();
    const { error } = await client.functions.invoke('send-push', {
      body: {
        action: 'subscribe',
        identity,
        subscription: {
          endpoint: push.endpoint,
          p256dh: push.keys?.p256dh,
          auth: push.keys?.auth
        }
      }
    });
    if (error) throw error;
    localStorage.setItem('love_push_registered', identity);
    console.info('Notificaciones activadas para', identity);
    updatePushPrompt('ready', '', fromUserGesture);
    return true;
  } catch (error) {
    localStorage.removeItem('love_push_registered');
    updatePushPrompt('error', 'No se pudieron activar. Cerrá la app, abrila e intentá otra vez.');
    console.warn('No se pudieron activar las notificaciones:', error);
    return false;
  }
}

async function sendPush(to, title, body, data = {}, drawing = null) {
  try {
    const notificationId = data.notification_id || crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const { data:result, error } = await client.functions.invoke('send-push', {
      body: { action: 'send', to, title, body, data:{ ...data, notification_id:notificationId }, drawing }
    });
    if (error) throw error;
    if (result?.delivered === false) throw new Error(result.reason || 'La notificación no llegó a ningún dispositivo');
    return result;
  } catch (error) {
    console.warn('No se pudo enviar la notificación:', error);
    throw error;
  }
}
window.sendLovePush = sendPush;

async function startLoveRoom() {
  const identity = await window.requestLoveIdentity();
  const target = identity === 'joel' ? 'princesa' : 'joel';
  const targetName = target === 'joel' ? 'Joel' : 'Princesa';
  window.loveIdentity = identity;
  window.loveTargetIdentity = target;
  // Debe ser único por pestaña y carga. sessionStorage puede clonarse al abrir
  // otra pestaña y provocar que dos sesiones compartan la misma clave.
  const sessionId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.loveSessionId = sessionId;
  const onlineAt = new Date().toISOString();
  let roomSubscribed = false;
  let room = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let lastActivityAt = onlineAt;
  let lastActivityTrackedAt = 0;
  let presenceLocation = { area:'app', room:null, room_changed_at:onlineAt };

  const presencePayload = () => ({
    identity,
    label:LABEL[identity],
    session_id:sessionId,
    online_at:onlineAt,
    tracked_at:new Date().toISOString(),
    last_activity_at:lastActivityAt,
    ...presenceLocation
  });

  async function trackPresence() {
    if (!roomSubscribed || !room) return false;
    try {
      return await room.track(presencePayload()) === 'ok';
    } catch (error) {
      console.warn('No se pudo actualizar la presencia', error);
      return false;
    }
  }

  window.markLoveActivity = (force = false) => {
    const now = Date.now();
    if (!force && now - lastActivityTrackedAt < 5000) return;
    lastActivityTrackedAt = now;
    lastActivityAt = new Date(now).toISOString();
    void trackPresence();
  };

  window.updateLoveLocation = async (area = 'app', roomId = null, markActive = false) => {
    const nextArea = area === 'house' ? 'house' : 'app';
    const nextRoom = nextArea === 'house' && typeof roomId === 'string' ? roomId : null;
    if (presenceLocation.area !== nextArea || presenceLocation.room !== nextRoom) {
      presenceLocation = { area:nextArea, room:nextRoom, room_changed_at:new Date().toISOString() };
    }
    if (markActive) {
      lastActivityTrackedAt = Date.now();
      lastActivityAt = new Date(lastActivityTrackedAt).toISOString();
    }
    return trackPresence();
  };
  window.getLoveLocation = () => ({ ...presenceLocation });
  window.isLoveRealtimeConnected = () => roomSubscribed;
  window.sendLoveRealtime = async (event, payload) => {
    if (!roomSubscribed || !room) return false;
    try {
      return await room.send({ type:'broadcast', event, payload }) === 'ok';
    } catch (error) {
      console.warn(`No se pudo emitir ${event} por Realtime`, error);
      return false;
    }
  };
  window.dispatchEvent(new CustomEvent('loveidentityready', { detail: { identity, target } }));
  window.activarNotificaciones = () => subscribeToPush(identity, true);
  subscribeToPush(identity);

  function applyPresenceState() {
      const state = room.presenceState();
      const metas = Object.values(state).flat().filter(Boolean);
      const latestFor = person => {
        return metas.filter(item => item?.identity === person)
          .sort((a, b) => new Date(b.last_activity_at || b.tracked_at || b.online_at || 0) - new Date(a.last_activity_at || a.tracked_at || a.online_at || 0))[0] || null;
      };
      const locations = { joel:latestFor('joel'), princesa:latestFor('princesa') };
      const presence = { joel:Boolean(locations.joel), princesa:Boolean(locations.princesa), locations };
      window.lovePresenceState = presence;
      const online = presence[target];
      updateInterface(online);
      window.dispatchEvent(new CustomEvent('lovepresencechange', { detail: presence }));
  }

  function scheduleReconnect(immediate = false) {
    if (!navigator.onLine) return;
    clearTimeout(reconnectTimer);
    const delay = immediate ? 0 : Math.min(30000, 1500 * (2 ** reconnectAttempt++));
    reconnectTimer = setTimeout(() => void connectRoom(), delay);
  }

  function showConnectionStatus(status) {
    if (status === 'SUBSCRIBED') return;
    window.partnerOnline = false;
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (dot) {
      dot.style.background = status === 'OFFLINE' ? '#aaa' : '#f0a34a';
      dot.style.boxShadow = 'none';
    }
    if (text) {
      text.innerText = status === 'OFFLINE' ? 'Sin conexión' : 'Reconectando…';
      text.style.color = '#8a6b45';
      text.style.fontWeight = '600';
    }
  }

  async function connectRoom() {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    roomSubscribed = false;
    const previousRoom = room;
    room = null;
    if (previousRoom) {
      try { await client.removeChannel(previousRoom); } catch (error) { console.warn('No se pudo limpiar el canal anterior', error); }
    }
    const channel = client.channel('room_amor', { config: { presence: { key: `${identity}:${sessionId}` } } });
    room = channel;
    window._loveRoom = channel;
    channel
      .on('presence', { event: 'sync' }, applyPresenceState)
      .on('broadcast', { event: 'mimo' }, ({ payload }) => recibirMimo(payload.type))
    .on('broadcast', { event: 'mensaje' }, ({ payload }) => mostrarMensaje(payload.text))
    .on('broadcast', { event: 'house-action' }, ({ payload }) => {
      window.dispatchEvent(new CustomEvent('lovehouseaction', { detail: payload }));
    })
    .on('broadcast', { event: 'drawing' }, ({ payload }) => {
      window.dispatchEvent(new CustomEvent('lovedrawingreceived', { detail: payload }));
    })
      .subscribe(async status => {
        if (room !== channel) return;
        roomSubscribed = status === 'SUBSCRIBED';
        window.dispatchEvent(new CustomEvent('loverealtimestatus', { detail:{ status } }));
        if (roomSubscribed) {
          reconnectAttempt = 0;
          await trackPresence();
          window.dispatchEvent(new CustomEvent('loverealtimeconnected'));
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          showConnectionStatus(status);
          scheduleReconnect();
        }
      });
  }

  ['pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach(type => {
    window.addEventListener(type, () => window.markLoveActivity(), { capture:true, passive:true });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      window.markLoveActivity(true);
      if (!roomSubscribed) scheduleReconnect(true);
    }
  });
  window.addEventListener('online', () => scheduleReconnect(true));
  window.addEventListener('pageshow', () => {
    window.markLoveActivity(true);
    if (!roomSubscribed) scheduleReconnect(true);
  });
  window.addEventListener('offline', () => {
    roomSubscribed = false;
    showConnectionStatus('OFFLINE');
    window.dispatchEvent(new CustomEvent('loverealtimestatus', { detail:{ status:'OFFLINE' } }));
  });

  await connectRoom();

  function updateInterface(online) {
    window.partnerOnline = online;
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const capsule = document.getElementById('status-capsule');
    const toolbar = document.getElementById('mimos-toolbar');
    if (!dot || !text || !capsule) return;
    dot.style.background = online ? '#4caf50' : '#ccc';
    dot.style.boxShadow = online ? '0 0 8px #4caf50' : 'none';
    text.innerText = online ? `${targetName} está aquí` : `${targetName} no está ahora`;
    text.style.color = online ? '#2e7d32' : '#999';
    text.style.fontWeight = online ? 'bold' : 'normal';
    capsule.style.cursor = 'pointer';
    capsule.title = 'Tocá para enviarle algo. Mantené presionado para cambiar quién sos.';
    if (online && window.lastState !== 'online') window.loveHaptic?.([50, 50, 50]);
    window.lastState = online ? 'online' : 'offline';
  }

  window.toggleToolbar = () => {
    const toolbar = document.getElementById('mimos-toolbar');
    if (!toolbar) return;
    const visible = toolbar.style.display === 'flex';
    toolbar.style.display = visible ? 'none' : 'flex';
    if (!visible) window.loveHaptic?.(10);
  };

  window.enviarMimo = async type => {
    window.markLoveActivity(true);
    void window.sendLoveRealtime('mimo', { type, from: identity });
    mostrarEfecto(type, true);
    const emoji = type === 'beso' ? '💋' : type === 'ojos' ? '👀' : '👆';
    try {
      await sendPush(target, 'Un mimo para vos 💌', `${identity === 'joel' ? 'Joel' : 'Princesa'} te mandó un mimo ${emoji}`, { type: 'mimo' });
    } catch { mostrarMensaje('No se pudo enviar el mimo'); }
  };

  window.enviarMensaje = async text => {
    window.markLoveActivity(true);
    void window.sendLoveRealtime('mensaje', { text, from:identity });
    mostrarMensaje(text, true);
    try {
      await sendPush(target, `Un mensajito de ${identity === 'joel' ? 'Joel' : 'Princesa'} 💌`, text, { type:'mensaje', text });
    } catch { mostrarMensaje('No se pudo enviar el mensaje'); }
  };
  window.enviarMensajePersonalizado = () => {
    const input = document.getElementById('quickMessageInput');
    const text = input?.value.trim();
    if (!text) return;
    input.value = '';
    window.enviarMensaje(text);
  };
}

function mostrarMensaje(text, mine = false) {
  const toast = document.createElement('div');
  toast.className = 'love-message-toast';
  toast.textContent = mine ? `Enviado: ${text}` : text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  window.loveHaptic?.([25, 35, 25]);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 250); }, 2400);
}

function recibirMimo(type) {
  const patterns = { beso: [50, 50, 50], ojos: [200], toque: [30] };
  window.loveHaptic?.(patterns[type] || [30]);
  mostrarEfecto(type, false);
}

function mostrarEfecto(type, mine) {
  const emoji = type === 'ojos' ? '👀' : type === 'toque' ? '👆' : '💋';
  for (let i = 0; i < 12; i++) {
    const el = document.createElement('div');
    el.innerText = emoji;
    Object.assign(el.style, { position: 'fixed', zIndex: '10070', fontSize: `${20 + Math.random() * 30}px`, pointerEvents: 'none', left: mine ? '40px' : `${Math.random() * innerWidth}px`, bottom: mine ? '70px' : `${Math.random() * innerHeight / 2}px`, transition: `all ${1 + Math.random()}s ease-out` });
    document.body.appendChild(el);
    setTimeout(() => { el.style.transform = type === 'toque' ? 'scale(1.5)' : `translateY(-100px) rotate(${Math.random() * 30}deg)`; el.style.opacity = '0'; }, 50);
    setTimeout(() => el.remove(), 1500);
  }
}

startLoveRoom().catch(error => console.error('No se pudo iniciar la conexión:', error));
