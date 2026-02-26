// realtime.js

// --- CONFIGURACIÓN ---
const SUPABASE_URL = 'https://xvdexhbasqbhvsuitucr.supabase.co'; 
// Tu Key pública (anon)
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGV4aGJhc3FiaHZzdWl0dWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjUxMjUsImV4cCI6MjA4NzY0MTEyNX0.mp1xMZ4NCxunOAQS82d2YEnweJi6ptNKReFZjQJDGmk'; 

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- LÓGICA DE PRESENCIA ---

const urlParams = new URLSearchParams(window.location.search);
const amIJoel = urlParams.get('user') === 'joel';
const myIdentity = amIJoel ? 'Joel 👨🏻‍💻' : 'Princesa 👩🏻‍🔬';

console.log('Iniciando como:', myIdentity);

const room = client.channel('room_amor', {
  config: {
    presence: {
      key: myIdentity,
    },
  },
});

room.on('presence', { event: 'sync' }, () => {
    const newState = room.presenceState();
    const users = Object.keys(newState);
    
    // Verificamos si Joel está conectado
    const isJoelOnline = users.some(user => user.includes('Joel'));
    
    updateIndicator(isJoelOnline);
});

// ESTA ERA LA PARTE QUE FALTABA:
room.subscribe(async (status) => {
    if (status !== 'SUBSCRIBED') { return; }
    
    // Enviar señal de presencia inicial
    await room.track({
      online_at: new Date().toISOString(),
      location: amIJoel ? 'Alemania 🇩🇪' : 'Ecuador 🇪🇨'
    });
});

// Función para controlar el diseño minimalista
function updateIndicator(isOnline) {
    const indicator = document.getElementById('presence-indicator');
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    
    if (!indicator || !dot || !text) return;

    if (isOnline) {
        // --- MODO ONLINE ---
        // Punto verde brillante
        dot.style.background = '#4caf50'; 
        dot.style.boxShadow = '0 0 8px #4caf50';
        // Texto discreto
        text.innerText = 'Joel está conectado';
        text.style.color = '#2e7d32';
        
        // Vibración suave solo una vez cuando entra
        if (!amIJoel && window.lastState !== 'online') {
             if (navigator.vibrate) navigator.vibrate([30]);
        }
        window.lastState = 'online';

    } else {
        // --- MODO OFFLINE ---
        // Punto gris
        dot.style.background = '#ccc';
        dot.style.boxShadow = 'none';
        // Texto apagado
        text.innerText = 'Joel desconectado';
        text.style.color = '#999';
        window.lastState = 'offline';
    }
}