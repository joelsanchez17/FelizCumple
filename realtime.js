// realtime.js

// CONFIGURACIÓN
const SUPABASE_URL = 'https://xvdexhbasqbhvsuitucr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_seKLcc9W-48bDasah75j4A_fOm3yMxJ';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. IDENTIDAD
const urlParams = new URLSearchParams(window.location.search);
const amIJoel = urlParams.get('user') === 'joel';
const myIdentity = amIJoel ? 'Joel 👨🏻‍💻' : 'Princesa 👩🏻‍🔬';
const targetIdentity = amIJoel ? 'Princesa' : 'Joel';

// Variable global para saber el estado
window.partnerOnline = false;

// Conectar al canal
const room = client.channel('room_amor', {
  config: { presence: { key: myIdentity } },
});

// Exponer room globalmente para que otras features lo usen (ej: canvas de dibujo)
window._loveRoom = room;

room
  .on('presence', { event: 'sync' }, () => {
    const state = room.presenceState();
    const users = Object.keys(state);
    const isPartnerOnline = users.some(user => user.includes(targetIdentity));
    updateInterface(isPartnerOnline);
  })
  .on('broadcast', { event: 'mimo' }, ({ payload }) => {
    recibirMimo(payload.type);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await room.track({
        online_at: new Date().toISOString(),
        location: 'Misma Ciudad 🏠❤️'
      });
    }
  });

// --- FUNCIONES DE INTERFAZ ---

function updateInterface(isOnline) {
    window.partnerOnline = isOnline; // Guardamos estado global
    
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const capsule = document.getElementById('status-capsule');
    const toolbar = document.getElementById('mimos-toolbar');
    
    if (!dot || !text) return;

    if (isOnline) {
        // --- ONLINE ---
        dot.style.background = '#4caf50';
        dot.style.boxShadow = '0 0 8px #4caf50';
        
        // Mensaje cuando está conectado
        text.innerText = `${targetIdentity} está aquí ❤️`;
        text.style.color = '#2e7d32';
        text.style.fontWeight = 'bold';
        
        // Habilitar clic
        capsule.style.cursor = 'pointer';
        capsule.title = "Toca para interactuar";
        
        // Vibrar suave SOLO si acaba de conectarse
        if (window.lastState !== 'online') {
             if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        }
        window.lastState = 'online';

    } else {
        // --- OFFLINE (EL CAMBIO QUE PEDISTE) ---
        dot.style.background = '#ccc';
        dot.style.boxShadow = 'none';
        
        // Mensaje explícito
        text.innerText = `${targetIdentity} está desconectado`;
        text.style.color = '#999';
        text.style.fontWeight = 'normal';
        
        // Deshabilitar clic y ocultar toolbar si estaba abierta
        capsule.style.cursor = 'default';
        capsule.title = "";
        if(toolbar) toolbar.style.display = 'none';
        
        window.lastState = 'offline';
    }
}

// --- NUEVA FUNCIÓN: TOGGLE TOOLBAR ---
window.toggleToolbar = () => {
    if (!window.partnerOnline) return; // Si no está conectado, no hace nada

    const toolbar = document.getElementById('mimos-toolbar');
    if (toolbar) {
        // Alternar entre flex y none
        const isVisible = toolbar.style.display === 'flex';
        toolbar.style.display = isVisible ? 'none' : 'flex';
        
        // Feedback táctil al abrir
        if (!isVisible && navigator.vibrate) navigator.vibrate(10);
    }
};

// --- ENVIAR ---
window.enviarMimo = async (tipo) => {
    await room.send({
        type: 'broadcast',
        event: 'mimo',
        payload: { type: tipo }
    });
    mostrarEfecto(tipo, true);
    // Opcional: cerrar toolbar después de enviar para mantener limpieza
    // document.getElementById('mimos-toolbar').style.display = 'none';
};

// --- RECIBIR ---
function recibirMimo(tipo) {
    if (navigator.vibrate) {
        if (tipo === 'beso') navigator.vibrate([50, 50, 50]);
        if (tipo === 'ojos') navigator.vibrate([200]);
        if (tipo === 'toque') navigator.vibrate([30]); 
    }
    mostrarEfecto(tipo, false);
}

// --- EFECTOS VISUALES (ACTUALIZADOS) ---
function mostrarEfecto(tipo, esMio) {
    let emoji = '💋';
    if (tipo === 'ojos') emoji = '👀';
    if (tipo === 'toque') emoji = '👆';
    
    const cantidad = 12;
    
    for (let i = 0; i < cantidad; i++) {
        const el = document.createElement('div');
        el.innerText = emoji;
        el.style.position = 'fixed';
        el.style.zIndex = '10070';
        el.style.fontSize = (20 + Math.random() * 30) + 'px';
        el.style.pointerEvents = 'none';
        
        if (esMio) {
            el.style.left = '40px'; 
            el.style.bottom = '70px';
        } else {
            // Si recibo, aparecen aleatoriamente en pantalla
            el.style.left = (Math.random() * window.innerWidth) + 'px';
            el.style.bottom = (Math.random() * window.innerHeight/2) + 'px';
        }
        
        el.style.transition = `all ${1 + Math.random()}s ease-out`;
        document.body.appendChild(el);

        setTimeout(() => {
            // Animación diferente según el tipo
            if (tipo === 'toque') {
                el.style.transform = `scale(1.5)`; // El toque hace un "zoom"
                el.style.opacity = '0';
            } else {
                el.style.transform = `translateY(-100px) rotate(${Math.random()*30}deg)`;
                el.style.opacity = '0';
            }
        }, 50);

        setTimeout(() => el.remove(), 1500);
    }
}