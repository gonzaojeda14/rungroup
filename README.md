# RunGroup 🏃

App PWA para gestión de carreras y participaciones de un grupo de running.

---

## Stack
- **React + Vite** — frontend
- **Supabase** — base de datos (PostgreSQL) + autenticación
- **Vercel** — deploy gratuito
- **vite-plugin-pwa** — instalable en el celu

---

## Instrucciones de deploy (paso a paso)

### 1. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Elegí un nombre (ej: `rungroup`) y una contraseña fuerte
3. Una vez creado, ir a **SQL Editor** y pegar todo el contenido de `supabase_schema.sql` → **Run**
4. Ir a **Project Settings > API** y copiar:
   - `Project URL` → es tu `VITE_SUPABASE_URL`
   - `anon public` key → es tu `VITE_SUPABASE_ANON_KEY`

### 2. Crear tu usuario admin

1. En Supabase → **Authentication > Users > Add user**
2. Poné tu email y contraseña
3. Volvé al **SQL Editor** y ejecutá:
   ```sql
   update public.profiles set role = 'admin' where email = 'TU_EMAIL_AQUI';
   ```

### 3. Subir el código a GitHub

```bash
cd rungroup
git init
git add .
git commit -m "Initial commit"
# Crear repo en github.com y seguir las instrucciones para push
```

### 4. Deploy en Vercel

1. Ir a [vercel.com](https://vercel.com) → **Add New Project**
2. Importar el repo de GitHub que acabás de crear
3. En **Environment Variables** agregar:
   - `VITE_SUPABASE_URL` = tu URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = tu anon key
4. Click **Deploy** → en 2 minutos tenés la URL

### 5. Agregar corredores

Una vez desplegado, entrás con tu cuenta admin y desde la pestaña **Corredores** podés crear las cuentas de cada alumno (nombre, email, contraseña inicial que les comunicás por el grupo de WhatsApp).

---

## Instalar en el celu (PWA)

**iPhone:** Abrí la URL en Safari → botón compartir → "Agregar a pantalla de inicio"

**Android:** Abrí en Chrome → menú (⋮) → "Agregar a pantalla de inicio" o el banner automático

---

## Estructura del proyecto

```
src/
  lib/
    supabase.js     # cliente de Supabase
    auth.jsx        # contexto de autenticación
  pages/
    Login.jsx
    Carreras.jsx
    Participaciones.jsx
    Resumen.jsx
    Corredores.jsx
  App.jsx           # routing + nav
  index.css         # estilos globales
supabase_schema.sql # ejecutar en Supabase SQL Editor
```

---

## Roles

| Acción | Corredor | Admin |
|--------|----------|-------|
| Ver carreras | ✓ | ✓ |
| Crear/borrar carreras | — | ✓ |
| Ver propia participación | ✓ | ✓ |
| Ver todas las participaciones | — | ✓ |
| Cambiar estado propio | ✓ | ✓ |
| Cambiar estado de cualquiera | — | ✓ |
| Ver resumen | ✓ | ✓ |
| Ver/crear corredores | — | ✓ |
