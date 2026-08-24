# Plan de evolución: Nuestra Casita

## Visión

Transformar la habitación compartida actual en una casa pequeña que Joel y Princesa puedan recorrer en tiempo real.

La casa comenzará con:

- Dormitorio.
- Cocina.
- Baño.
- Una entrada o vista general de la casa.
- Espacios futuros que puedan agregarse sin reconstruir lo anterior.

Cada habitación tendrá su propio aspecto, objetos, estados compartidos, condiciones y actividades. La sensación buscada no es la de navegar entre pantallas, sino la de llegar a casa, recorrerla y encontrarse con el otro.

## Regla principal: hay que buscarse

El mapa de la casa **no mostrará la habitación exacta del otro**.

Cuando el otro esté conectado, solamente aparecerá un indicador general:

> Princesa está en casa.

Para encontrarla, Joel tendrá que entrar al dormitorio, cocina o baño. Si entra en la misma habitación, verá su foto y aparecerá un mensaje como:

> La encontraste ♡

No habrá un botón para teletransportarse directamente hasta la otra persona. El mapa sirve para caminar por la casa, no para revelar dónde está el otro.

Tampoco se enviarán notificaciones push cada vez que alguien cambie de habitación. Los movimientos serán silenciosos y naturales.

## Llegar a casa

La casita tendrá tres estados diferentes para cada persona:

1. **Fuera de la casa:** está desconectada o usando otra sección de la app.
2. **En casa:** entró en la sección de la casita, pero la habitación exacta permanece oculta para el otro.
3. **En la misma habitación:** ambos pueden verse, moverse y utilizar juntos los objetos del cuarto.

Al abrir la casita, cada persona aparecerá directamente en la última habitación que visitó desde ese dispositivo. Si todavía no existe una ubicación guardada, comenzará en el dormitorio. El mapa se abre únicamente al tocar el botón visible dentro de cada habitación.

Esto hace que la pestaña se sienta como una casa habitada y no como una pantalla de selección. La última habitación propia nunca se muestra al otro en el mapa.

Ejemplo:

1. Joel entra a la casa y reaparece en la cocina, donde estuvo la última vez.
2. Ve el mensaje `Princesa está en casa`.
3. Abre el mapa y prueba ir al baño, pero está vacío.
4. Vuelve al mapa y va al dormitorio.
5. La encuentra mirando televisión.
6. Joel mueve su foto y se sienta junto a ella.

## Qué ocurre al desconectarse

### Decisión recomendada

La foto debe desaparecer cuando alguien deja la casa. No conviene mantener visible su última ubicación porque parecería que sigue allí y eliminaría la diferencia entre presencia real y un recuerdo.

Reglas propuestas:

- Si la conexión se corta brevemente, esperar entre 30 y 60 segundos antes de hacerlo desaparecer para evitar parpadeos por mala conexión.
- Una vez desconectado, el mapa no muestra dónde estuvo por última vez.
- Opcionalmente, al visitar una habitación puede aparecer una pista suave como `Alguien estuvo acá hace un rato`, pero nunca en el mapa general.
- La última habitación se guarda localmente para volver allí al abrir `Casita`, pero no será pública ni visible para el otro.

### Excepción: actividades intencionales

Una actividad iniciada voluntariamente puede permanecer aunque la app pase a segundo plano.

Ejemplos:

- Dormir durante ocho horas.
- Mirar televisión durante treinta minutos.
- Bañarse durante diez minutos.
- Cocinar durante veinte minutos.

Estas actividades tendrán hora de inicio y finalización. Si Princesa selecciona `Dormir`, Joel puede encontrarla durmiendo aunque el teléfono haya bloqueado la PWA. No es una ubicación vieja: es una acción que ella eligió dejar activa.

La interfaz distinguirá claramente:

- `Princesa está acá` — presencia en vivo.
- `Princesa dejó indicado que está durmiendo` — actividad persistente.
- Sin foto — ya no está en la casa y no dejó una actividad.

## Mapa de la casa

Habrá un pequeño botón con forma de casa en una esquina de cada habitación. Al tocarlo se abrirá un plano compacto:

```text
┌──────────────────────────┐
│       Nuestra casa       │
│                          │
│  🛏 Dormitorio   🚿 Baño  │
│                          │
│  🍳 Cocina       ＋ Futuro │
│                          │
│  ● Princesa está en casa │
└──────────────────────────┘
```

El plano mostrará:

- Las habitaciones disponibles.
- La habitación en la que está el usuario actual.
- Si el otro está en casa, fuera de casa o desconectado.
- Habitaciones futuras como espacios cerrados o en construcción.

No mostrará un avatar del otro dentro del plano.

El cambio de habitación tendrá una transición corta, parecida a atravesar una puerta. No habrá recargas completas de página.

## Habitaciones y primeras funciones

### Dormitorio

La habitación actual se convertirá en el dormitorio sin perder sus estados.

Funciones iniciales:

- Moverse libremente.
- Acostarse o dormir.
- Encender lámparas.
- Abrir la ventana.
- Aire acondicionado y calefacción.
- Notas sobre la mesa.
- Planta compartida.
- Escena cómplice bajo la sábana cuando ambos están acostados y despiertos; dura unos segundos, se comparte en vivo y no llena el diario.

Posibles situaciones:

- Ambos seleccionan dormir y aparecen juntos en la cama.
- Alguien deja una nota en la mesa de noche.

### Living

El living será una habitación propia y concentrará las acciones de descanso fuera de la cama.

Funciones iniciales propuestas:

- Televisión compartida.
- Sillón con dos lugares reales.
- Tocar un lugar del sillón para sentarse allí.
- Levantarse tocando nuevamente el sillón o moviendo el avatar.
- Sentarse al lado del otro sin moverlo automáticamente.
- Mirar televisión, hacer cariñitos o quedarse dormidos en el sillón.

`Sentarse` no será una acción genérica del avatar: existirá solamente al tocar el sillón y ocupar uno de sus lugares.

### Cocina

Funciones iniciales propuestas:

- Preparar café para el otro.
- Cocinar algo juntos.
- Sentarse en la mesa.
- Abrir la heladera.
- Dejar una nota o un imán.
- Encender y apagar luces o electrodomésticos.
- Cuidar el cactus: necesita su recorrida diaria, crece con los días y puede florecer.
- Tener un cuadrito real de Joel y Princesa en la pared.

### Baño

Funciones iniciales propuestas:

- Bañarse.
- Cepillarse los dientes.
- Dejar un mensaje en el espejo empañado.
- Preparar una toalla para el otro.
- Encender o apagar la luz.
- Cuidar la orquídea con el mismo ciclo diario de crecimiento, sed y floración que las otras plantas.

Las acciones del baño serán tiernas y cotidianas, sin convertirlo en una lista de botones. Se iniciarán tocando los objetos correspondientes: ducha, espejo, cepillos o toalla.

## Actividades compartidas

Las actividades se comportarán como pequeños estados con duración:

```text
persona + habitación + actividad + inicio + finalización
```

Ejemplos:

- `princesa / living / watching_tv / hasta 22:30`
- `joel / baño / brushing_teeth / hasta 22:05`
- `joel / dormitorio / sleeping / hasta 07:00`

Reglas:

- Cada persona puede tener una sola actividad personal activa.
- Cambiar de habitación termina las actividades cortas incompatibles.
- Dormir puede continuar con la aplicación cerrada.
- Las actividades vencidas se eliminan automáticamente al cargarse.
- Si ambos ejecutan una actividad compatible, la escena cambia para mostrarlos juntos.

## Presencia y privacidad de ubicación

Supabase Presence enviará datos similares a:

```js
{
  identity: "joel",
  area: "house",
  room: "bedroom",
  room_changed_at: "...",
  session_id: "..."
}
```

El navegador necesita conocer internamente la habitación para decidir si debe mostrar a la otra persona. Sin embargo, la interfaz del mapa no revelará ese dato.

Si una misma identidad abre la app en varios dispositivos, se utilizará la sesión con el cambio de habitación más reciente. Así se evita que Joel aparezca simultáneamente en la cocina desde Windows y en el dormitorio desde el teléfono.

## Modelo de datos propuesto

### Estados de objetos por habitación

Crear una tabla escalable en lugar de continuar agregando nombres a la restricción actual:

```text
house_device_states
- room_id
- device_id
- state (jsonb)
- updated_by
- updated_at
- clave primaria: room_id + device_id
```

Los objetos actuales se migrarán al dormitorio.

### Posiciones

```text
house_avatar_positions
- identity
- room_id
- x
- y
- updated_at
- clave primaria: identity + room_id
```

Cada persona conservará una posición diferente en cada habitación y las coordenadas seguirán siendo proporcionales para funcionar en celular y computadora.

### Actividades

```text
house_activities
- identity
- room_id
- activity
- state (jsonb)
- started_at
- expires_at
- updated_at
```

### Notas

La tabla `house_notes` recibirá un campo `room_id`. Las notas actuales se asignarán al dormitorio. Una nota podrá aparecer sobre la mesa de noche, mesa de cocina o espejo según la habitación.

## Organización del código

Antes de sumar varias habitaciones conviene separar la lógica actualmente concentrada en `together.js`:

- `house.js`: entrada, mapa, navegación y presencia.
- `house-state.js`: lectura, escritura y sincronización con Supabase.
- `house-rooms.js`: configuración de habitaciones, objetos y condiciones.
- `together.js`: notas, estados del corazón y diario compartido.
- `house.css`: estructura general y estilos compartidos de la casa.
- Archivos o secciones CSS independientes para dormitorio, cocina y baño.

La app seguirá siendo HTML, CSS y JavaScript sin agregar un framework pesado.

## Ejecución por etapas

### Parte 1 — Cimientos y búsqueda

- Crear las nuevas tablas y migrar los objetos existentes.
- Convertir la habitación actual en `Dormitorio`.
- Implementar la entrada y el mapa.
- Incorporar presencia por habitación.
- Ocultar la ubicación exacta del otro.
- Mostrar `Está en casa` y `La encontraste`.
- Crear Cocina y Baño como habitaciones transitables pero todavía vacías.
- Mantener todas las funciones actuales del dormitorio.

Resultado: ya será posible entrar a distintos cuartos y buscarse de verdad.

### Parte 2 — Dormitorio completo

- **2A — Cama (completada):** tocar `Acostarse` lleva el avatar a la cama; desde ahí se puede `Dormir a lo 🐨`, despertarse o levantarse. El estado se conserva al cerrar la app, `zzz` aparece solamente al dormir, ambos pueden acostarse juntos y tocar al otro dormido lo despierta sin sacarlo de la cama. Si ambos están despiertos pueden meterse y asomarse manualmente bajo la sábana todas las veces que quieran; la escena se comparte en vivo y la casa alterna comentarios cómplices.
- **2B — Movimiento vivo (completada):** doble toque para saltar, reacciones compartidas al saltar junto al otro y una acción propia para bailar, todo visible en vivo sin persistir animaciones pasajeras. `Sentarse` queda reservado exclusivamente para el sillón del living.
- **2C — Cercanía (completada):** al tocar al otro cuando está cerca aparecen beso, abrazo, cariñitos y cosquillas con animaciones breves por Realtime. Princesa tiene además el minijuego privado `Tocar el pupito`: puede insistir sin cerrar el panel y Agus reacciona con defensa, un casi, una distracción y guardia reforzada. Nada de esto llena el diario ni envía notificaciones.
- **2D — Actividades compartidas:** invitaciones que el otro acepta para acostarse juntos, dormir abrazados o comenzar un momento íntimo discreto, con puerta cerrada y luces bajas.
- Adaptar las posiciones y objetos actuales al nuevo diseño.
- Agregar mensajes y combinaciones del dormitorio usando la voz real de la pareja: cómplice, graciosa y breve.

### Parte 3 — Living

- Agregar el living al mapa de la casa.
- Diseñar el sillón con dos lugares independientes.
- Hacer que `Sentarse` sea una acción del sillón, no del avatar.
- Agregar la televisión y la actividad persistente `Mirar televisión`.
- Permitir sentarse juntos, hacer cariñitos o dormirse frente a la televisión.
- Incorporar control remoto, luz ambiental y mensajes propios del living.

### Parte 4 — Cocina

- Diseñar la cocina completa.
- Base implementada: cuadrito real de ambos y cactus persistente, sincronizado y con crecimiento diario.
- Agregar mesa, cafetera, heladera y luces.
- Implementar café, cocinar, sentarse y notas/imanes.
- Crear condiciones y mensajes propios de la cocina.

### Parte 5 — Baño

- Diseñar el baño completo.
- Base implementada: la ducha se toca para entrar o salir, muestra a uno o a ambos dentro y sincroniza el estado; la orquídea tiene cuidado diario compartido. Dentro de la ducha se puede levantar el jabón, ofrecer `¿Te lavo el rabito?`, aceptar la propuesta y cerrar o abrir la cortina para un momento íntimo discreto compartido en vivo.
- Agregar ducha, espejo, cepillos, toallas y luz.
- Implementar bañarse y cepillarse los dientes.
- Permitir invitar al otro a ducharse juntos; el otro debe aceptar antes de que comience la actividad.
- Agregar salpicarse, empañar el espejo, escribir con el dedo y robarle la toalla al otro.
- Agregar mensajes en el espejo y actividades sincronizadas.

### Parte 6 — Vida de toda la casa

- Historial de actividades importantes en el diario.
- Objetos que interactúen entre habitaciones.
- Sonido o señal sutil cuando alguien llega a casa.
- Sorpresas que solo aparecen cuando ambos coinciden.
- Acción `Vení conmigo`: manda una señal o push, pero no revela la habitación para conservar el juego de buscarse.
- Pedido de llamada que pueda abrir WhatsApp cuando ambos lo decidan.
- Motor único para que la casa hable con prioridades, combinaciones y tiempo de espera, sin ventanas emergentes.
- Preparar habitaciones futuras.

## Voz de la casa

La casa es cómplice, un poco chismosa y habla con frases cortas. Puede usar con moderación palabras propias de la pareja como `koalita`, `camarada`, `cielito`, `jefecita`, `mimir` y `cariñitos`. No narrará cada toque ni repetirá mensajes constantemente.

Reglas:

- Los mensajes permanecen visibles mientras la condición continúe.
- Si coinciden varias condiciones, se muestran juntas por prioridad sin taparse entre sí.
- Las acciones instantáneas viajan por Realtime y no se guardan en el diario.
- Dormir, ducharse o mirar televisión sí son estados persistentes en `house_activities`.
- Las actividades íntimas o compartidas requieren aceptación del otro.

## Validación obligatoria por etapa

Cada parte se probará con:

- Una sesión como Joel y otra como Princesa.
- Ambos en habitaciones diferentes.
- Ambos encontrándose en la misma habitación.
- Cambio rápido de habitaciones.
- Desconexión, reconexión y app en segundo plano.
- Dos dispositivos con la misma identidad.
- iPhone 14 Pro.
- Android de 360 px de ancho.
- Escritorio Windows.
- Persistencia de objetos, posiciones y actividades.
- Ausencia de superposiciones y desplazamiento horizontal.

## Estado actual

La **Parte 1 — Cimientos y búsqueda**, la **Parte 2A — Cama**, la **Parte 2B — Movimiento vivo** y la **Parte 2C — Cercanía** ya fueron implementadas. El próximo paso es la **Parte 2D — Actividades compartidas**, comenzando por invitaciones que el otro debe aceptar.
