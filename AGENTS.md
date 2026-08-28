# Reglas de trabajo: Nuestra Casita

## Protección de la sorpresa

- El repositorio público no puede contener código, texto, assets, rutas, migraciones ni nombres que revelen la experiencia privada.
- No subir ramas secretas al remoto público. El desarrollo confidencial debe vivir en un repositorio privado separado y sin GitHub Pages público.
- No confiar en CSS, `hidden`, parámetros de URL, `localStorage` ni la identidad cliente como barrera de seguridad.
- No agregar recursos confidenciales al service worker: podrían permanecer en caché después de retirarlos.
- Los planes privados pertenecen a `.private/` o a archivos `PLAN_*_PRIVADO.md`, ambos ignorados.

## Datos y servicios

- Las pruebas automáticas no deben escribir en Supabase de producción salvo que el usuario pida explícitamente una validación live.
- Nunca imprimir claves, tokens, secretos VAPID, service-role keys ni contenido personal en logs.
- Preferir Supabase local; usar staging separado para pruebas multidispositivo.
- Migraciones aditivas y recuperables. No borrar datos ni tablas sin autorización explícita.

## Comandos

- Crear entorno: `python -m venv .venv` y `.venv\\Scripts\\python -m pip install -r requirements-dev.txt`.
- Servir: `npm run dev` o `.venv\\Scripts\\python scripts/dev_server.py`.
- Validación local segura: `npm run validate`.
- Validación live opt-in: `npm run validate:live`.
- Supabase local: `npm run supabase:start`, `npm run supabase:reset`, `npm run supabase:stop`.

## Antes de entregar cambios

- Ejecutar `npm run validate` y `git diff --check`.
- Confirmar que no haya secretos o archivos privados staged.
- Mantener actualizados los estados de `PLAN_CASITA.md` sin copiar detalles confidenciales.
