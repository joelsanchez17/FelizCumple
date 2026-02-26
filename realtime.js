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
    console.log('📡 Sincronización de presencia:', newState);
    
    // Verificar si "Joel" está en la lista de conectados
    // newState devuelve un objeto con claves por usuario
    const users = Object.keys(newState);
    
    // Buscamos si alguna clave contiene la palabra 'Joel'
    const isJoelOnline = users.some(user => user.includes('Joel'));

    // Referencia al cartelito HTML
    const indicator = document.getElementById('presence-indicator');
    
    // Lógica visual:
    // Si NO soy Joel (soy ella) Y Joel está online -> Muestro el cartel
    if (!amIJoel && isJoelOnline && indicator) {
      indicator.style.display = 'block';
      // Vibración suave si el dispositivo lo soporta
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]); 
    } else if (indicator) {
      indicator.style.display = 'none';
    }
  })
  .subscribe(async (status) => {
    if (status !== 'SUBSCRIBED') { return; }
    
    // Una vez conectado exitosamente, enviamos nuestra señal de "Estoy aquí"
    await room.track({
      online_at: new Date().toISOString(),
      location: amIJoel ? 'Alemania 🇩🇪' : 'Ecuador 🇪🇨'
    });
  });