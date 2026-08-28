# Entorno de desarrollo

## Requisitos

- Python 3.13 o compatible.
- Node.js LTS y npm.
- Chrome.
- Docker Desktop y Supabase CLI para el backend local.
- GitHub CLI para revisar Actions, reglas y secretos del repositorio.

## Primera instalación

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements-dev.txt
npm install
```

Abrir Docker Desktop antes de iniciar Supabase:

```powershell
npm run supabase:start
npm run supabase:status
```

El primer arranque descarga imágenes y puede tardar varios minutos. Los datos locales son descartables; producción no debe usarse para pruebas automáticas.

## Desarrollo y validación

```powershell
npm run dev
npm run validate
```

`npm run validate` compila los validadores Python y comprueba la sintaxis JavaScript sin escribir en producción. `npm run validate:live` es manual porque usa el Supabase configurado y modifica temporalmente estados compartidos.

## GitHub

Autenticar una vez desde una terminal interactiva:

```powershell
gh auth login
```

No guardar tokens en `.env` si GitHub CLI puede usar su almacén seguro.

## Desarrollo confidencial

El repositorio actual es público. Una rama subida a este mismo remoto también es pública. La experiencia reservada debe desarrollarse en un repositorio privado separado, con Supabase local o staging y sin despliegue público. El archivo `PLAN_CASITA_PRIVADO.md` está ignorado y no forma parte del repositorio.

La aplicación actual todavía confía en identidades de navegador y políticas anónimas. Antes de proteger contenido sensible se necesitan dos cuentas Supabase Auth, membresía basada en `auth.uid()`, RLS cerrada y una función push autenticada.
