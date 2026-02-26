// realtime.js

// --- CONFIGURACIÓN ---
// Pega aquí la URL que sacamos de la imagen 2
const SUPABASE_URL = 'https://xvdexhbasqbhvsuitucr.supabase.co'; 

// Pega aquí la Key completa que empieza con 'sb_publishable_...' de la imagen 1
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGV4aGJhc3FiaHZzdWl0dWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjUxMjUsImV4cCI6MjA4NzY0MTEyNX0.mp1xMZ4NCxunOAQS82d2YEnweJi6ptNKReFZjQJDGmk'; 

// Inicializar cliente
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- LÓGICA DE PRESENCIA (¿QUIÉN ESTÁ CONECTADO?) ---

// 1. Identificar quién soy basado en la URL (?user=joel)
const urlParams = new URLSearchParams(window.location.search);
const amIJoel = urlParams.get('user') === 'joel';
const myIdentity = amIJoel ? 'Joel 👨🏻‍💻' : 'Princesa 👩🏻‍🔬';

console.log('Iniciando conexión como:', myIdentity);

// 2. Conectar al canal "room_amor"
const room = client.channel('room_amor', {
  config: {
    presence: {
      key: myIdentity,
    },
  },
});

// 3. Escuchar cambios de estado
room
  .on('presence', { event: 'sync' }, () => {
    const newState = room.presenceState();
    console.log('📡 Estado sala:', newState);
    
    const users = Object.keys(newState);
    // Buscamos si "Joel" (tú) estás en la lista
    const isJoelOnline = users.some(user => user.includes('Joel'));

    const indicator = document.getElementById('presence-indicator');
    
    if (indicator) {
        if (isJoelOnline) {
            // --- MODO: JOEL ESTÁ ONLINE ---
            indicator.innerHTML = '🟢 Joel está aquí contigo ahora ❤️';
            indicator.style.background = 'linear-gradient(45deg, #ff9a9e, #fad0c4)';
            indicator.style.color = '#c2185b';
            indicator.style.border = '2px solid #fff';
            indicator.style.boxShadow = '0 4px 15px rgba(233, 30, 99, 0.4)';
            indicator.style.transform = 'translateX(-50%) scale(1.05)'; // Un poquito más grande
            
            // Vibrar solo cuando entras
            if (!amIJoel && navigator.vibrate) navigator.vibrate([50, 50, 50]); 

        } else {
            // --- MODO: JOEL ESTÁ OFFLINE ---
            // Volvemos al estado "apagado" pero visible
            indicator.innerHTML = '⚪ Joel está desconectado (pero te piensa 💭)';
            indicator.style.background = '#f0f0f0';
            indicator.style.color = '#888';
            indicator.style.border = '1px solid #ccc';
            indicator.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';
            indicator.style.transform = 'translateX(-50%) scale(1)';
        }
    }
  })