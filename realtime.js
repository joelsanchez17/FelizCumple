// realtime.js

// CONFIGURACIÓN (Tus credenciales siguen igual)
const SUPABASE_URL = 'https://xvdexhbasqbhvsuitucr.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGV4aGJhc3FiaHZzdWl0dWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjUxMjUsImV4cCI6MjA4NzY0MTEyNX0.mp1xMZ4NCxunOAQS82d2YEnweJi6ptNKReFZjQJDGmk'; 

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. IDENTIDAD BIDIRECCIONAL
const urlParams = new URLSearchParams(window.location.search);
const amIJoel = urlParams.get('user') === 'joel';

// Quién soy yo y a quién busco
const myIdentity = amIJoel ? 'Joel 👨🏻‍💻' : 'Princesa 👩🏻‍🔬';
const targetIdentity = amIJoel ? 'Princesa' : 'Joel'; // A quién espero

console.log(`👤 Soy: ${myIdentity} | 🔎 Buscando a: ${targetIdentity}`);

// Conectar al canal
const room = client.channel('room_amor', {
  config: { presence: { key: myIdentity } },
});

room
  // A. ESCUCHAR PRESENCIA (¿Está el otro?)
  .on('presence', { event: 'sync' }, () => {
    const state = room.presenceState();
    const users = Object.keys(state);
    
    // Verificamos si la persona que buscamos está online
    const isPartnerOnline = users.some(user => user.includes(targetIdentity));
    updateInterface(isPartnerOnline);
  })
  
  // B. ESCUCHAR MIMOS (Walkie-Talkie de amor)
  .on('broadcast', { event: 'mimo' }, ({ payload }) => {
    recibirMimo(payload.type);
  })
  
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await room.track({
        online_at: new Date().toISOString(),
        location: 'Misma Ciudad 🏠❤️' // Actualizado ;)
      });
    }
  });

// --- FUNCIONES DE INTERFAZ ---

function updateInterface(isOnline) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const toolbar = document.getElementById('mimos-toolbar');
    
    if (!dot || !text) return;

    if (isOnline) {
        // CONECTADOS (Verde + Botones)
        dot.style.background = '#4caf50';
        dot.style.boxShadow = '0 0 8px #4caf50';
        text.innerText = `${targetIdentity} está aquí ❤️`;
        text.style.color = '#2e7d32';
        text.style.fontWeight = 'bold';
        
        // Mostrar botonera mágica
        if(toolbar) toolbar.style.display = 'flex';
        
        // Vibrar suave al conectar
        if (window.lastState !== 'online') {
             if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        }
        window.lastState = 'online';
    } else {
        // DESCONECTADO (Gris)
        dot.style.background = '#ccc';
        dot.style.boxShadow = 'none';
        text.innerText = 'Esperando a tu amor...'; // Texto más romántico
        text.style.color = '#999';
        text.style.fontWeight = 'normal';
        
        if(toolbar) toolbar.style.display = 'none';
        window.lastState = 'offline';
    }
}

// --- ENVIAR MIMO (Tú tocas el botón) ---
window.enviarMimo = async (tipo) => {
    // 1. Enviar señal por internet
    await room.send({
        type: 'broadcast',
        event: 'mimo',
        payload: { type: tipo }
    });
    
    // 2. Feedback visual para ti (para que sepas que se envió)
    mostrarEfecto(tipo, true);
};

// --- RECIBIR MIMO (Te llega desde internet) ---
function recibirMimo(tipo) {
    // 1. Vibración especial según el tipo
    if (navigator.vibrate) {
        if (tipo === 'beso') navigator.vibrate([100, 50, 100]); // Dos toques
        if (tipo === 'abrazo') navigator.vibrate(500); // Un toque largo
    }
    
    // 2. Mostrar en pantalla
    mostrarEfecto(tipo, false);
}

// --- EFECTOS VISUALES FLOTANTES ---
function mostrarEfecto(tipo, esMio) {
    const emoji = tipo === 'beso' ? '💋' : '🐨';
    const cantidad = 15;
    
    for (let i = 0; i < cantidad; i++) {
        const el = document.createElement('div');
        el.innerText = emoji;
        el.style.position = 'fixed';
        el.style.zIndex = '10070';
        el.style.fontSize = (20 + Math.random() * 30) + 'px';
        el.style.pointerEvents = 'none';
        
        // Si es mío sale de abajo a la izq (mi botonera)
        // Si es recibido sale del centro o lluvia
        if (esMio) {
            el.style.left = (50 + Math.random() * 50) + 'px';
            el.style.bottom = '60px';
        } else {
            el.style.left = (Math.random() * window.innerWidth) + 'px';
            el.style.bottom = '-50px';
        }
        
        el.style.transition = `all ${1 + Math.random()}s ease-out`;
        document.body.appendChild(el);

        // Animar
        setTimeout(() => {
            el.style.transform = `translateY(-${window.innerHeight/2 + Math.random()*200}px) rotate(${Math.random()*360}deg)`;
            el.style.opacity = '0';
        }, 50);

        setTimeout(() => el.remove(), 2000);
    }
}