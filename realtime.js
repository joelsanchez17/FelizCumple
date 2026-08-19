const SUPABASE_URL = 'https://xvdexhbasqbhvsuitucr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_seKLcc9W-48bDasah75j4A_fOm3yMxJ';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const LABEL = { joel: 'Joel 👨🏻‍💻', princesa: 'Princesa 👩🏻‍🔬' };

window._loveClient = client;
window.partnerOnline = false;
window.toggleToolbar = () => {};
window.enviarMimo = () => {};

function decodeVapidKey(value) {
  const base64 = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}

async function subscribeToPush(identity) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  try {
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') return;
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
    // Si este mismo dispositivo cambió de identidad, quitamos la asociación anterior.
    await client.from('push_subscriptions').delete().eq('endpoint', push.endpoint).neq('identity', identity);
    const { error } = await client.from('push_subscriptions').upsert({
      identity, endpoint: push.endpoint, p256dh: push.keys?.p256dh, auth: push.keys?.auth,
      updated_at: new Date().toISOString()
    }, { onConflict: 'identity' });
    if (error) throw error;
  } catch (error) { console.warn('No se pudieron activar las notificaciones:', error); }
}

async function sendPush(to, title, body, data = {}) {
  try {
    const { error } = await client.functions.invoke('send-push', { body: { to, title, body, data } });
    if (error) throw error;
  } catch (error) { console.warn('No se pudo enviar la notificación:', error); }
}
window.sendLovePush = sendPush;

async function startLoveRoom() {
  const identity = await window.requestLoveIdentity();
  const target = identity === 'joel' ? 'princesa' : 'joel';
  const targetName = target === 'joel' ? 'Joel' : 'Princesa';
  window.loveIdentity = identity;
  window.loveTargetIdentity = target;
  window.dispatchEvent(new CustomEvent('loveidentityready', { detail: { identity, target } }));
  subscribeToPush(identity);

  const room = client.channel('room_amor', { config: { presence: { key: identity } } });
  window._loveRoom = room;
  room
    .on('presence', { event: 'sync' }, () => {
      const state = room.presenceState();
      const online = Object.keys(state).includes(target) || Object.values(state).flat().some(item => item?.identity === target);
      updateInterface(online);
    })
    .on('broadcast', { event: 'mimo' }, ({ payload }) => recibirMimo(payload.type))
    .on('broadcast', { event: 'drawing' }, ({ payload }) => {
      window.dispatchEvent(new CustomEvent('lovedrawingreceived', { detail: payload }));
    })
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') await room.track({ identity, label: LABEL[identity], online_at: new Date().toISOString() });
    });

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
    if (online && window.lastState !== 'online') navigator.vibrate?.([50, 50, 50]);
    window.lastState = online ? 'online' : 'offline';
  }

  window.toggleToolbar = () => {
    const toolbar = document.getElementById('mimos-toolbar');
    if (!toolbar) return;
    const visible = toolbar.style.display === 'flex';
    toolbar.style.display = visible ? 'none' : 'flex';
    if (!visible) navigator.vibrate?.(10);
  };

  window.enviarMimo = async type => {
    await room.send({ type: 'broadcast', event: 'mimo', payload: { type, from: identity } });
    mostrarEfecto(type, true);
    const emoji = type === 'beso' ? '💋' : type === 'ojos' ? '👀' : '👆';
    await sendPush(target, 'Un mimo para vos 💌', `${identity === 'joel' ? 'Joel' : 'Princesa'} te mandó un mimo ${emoji}`, { type: 'mimo' });
  };
}

function recibirMimo(type) {
  const patterns = { beso: [50, 50, 50], ojos: [200], toque: [30] };
  navigator.vibrate?.(patterns[type] || [30]);
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
