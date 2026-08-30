# Google Auth (Sign in with Google) — DIVINITTYS

## Resumen de la implementación

Se integró **Auth.js (NextAuth v5)** únicamente para el flujo OAuth de Google.
Después del login exitoso se emiten las **mismas cookies JWT** (`access_token` / `refresh_token`) que usa el resto de la aplicación, por lo que:

- `useAuthStore` (Zustand)
- APIs protegidas (`getAuthUser`, `requireAuth`)
- Admin y rutas de cuenta

siguen funcionando **sin cambios**.

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `auth.ts` | Configuración Auth.js + Google provider |
| `src/app/api/auth/[...nextauth]/route.ts` | Handlers GET/POST de NextAuth |
| `src/app/api/auth/google-callback/route.ts` | Emite JWT propios + setea cookies + redirect |
| `src/components/auth/GoogleSignInButton.tsx` | Botón UI |
| `src/app/cuenta/login/LoginForm.tsx` | Botón "Iniciar sesión con Google" |
| `src/app/cuenta/registro/page.tsx` | Botón "Registrarse con Google" |
| `prisma/schema.prisma` | `passwordHash` opcional + modelo `Account` |

## Variables de entorno

```bash
AUTH_SECRET=...                    # openssl rand -base64 32
AUTH_GOOGLE_ID=...                 # Client ID de Google
AUTH_GOOGLE_SECRET=...             # Client Secret de Google
# Alias también aceptados:
# GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
```

## Configurar Google Cloud Console

1. Ir a [Google Cloud Console](https://console.cloud.google.com/) → crear o seleccionar proyecto.
2. **APIs & Services → OAuth consent screen**
   - User Type: External (o Internal si es Workspace).
   - App name: DIVINITTYS
   - Support email y developer contact: tu email.
   - Scopes: `openid`, `email`, `profile` (los por defecto bastan).
3. **Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: DIVINITTYS Web
   - **Authorized JavaScript origins**:
     - `http://localhost:3000`
     - `https://prep.divinittys.cl`
     - `https://divinittys.cl` (cuando exista)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://prep.divinittys.cl/api/auth/callback/google`
     - `https://divinittys.cl/api/auth/callback/google`
4. Copiar **Client ID** y **Client Secret** a `.env` / `.env.production`.

## Migración de base de datos

```bash
# En local o en el contenedor (Prisma 6.2.1)
npx prisma migrate dev --name add_google_oauth_account
# o en prod:
npx prisma migrate deploy
```

Cambios:
- `users.password_hash` pasa a ser **nullable** (usuarios solo-Google).
- Nueva tabla `accounts` (provider, tokens OAuth).

## Flujo de usuario

1. Click en "Iniciar sesión con Google" / "Registrarse con Google".
2. `signIn('google')` → Google → callback de NextAuth (`/api/auth/callback/google`).
3. Redirect a `/api/auth/google-callback`.
4. Ese endpoint:
   - Verifica la sesión de Auth.js.
   - Busca/crea el `User` (role = CUSTOMER).
   - Emite `access_token` + `refresh_token`.
   - Crea registro en `sessions`.
   - Setea cookies httpOnly.
   - Redirige a `/cuenta` (o `?callbackUrl=`).
5. El cliente hidrata `useAuthStore` vía `/api/auth?action=me`.

## Notas de seguridad / UX

- Si un usuario se registró solo con Google e intenta login con email/password → mensaje claro: *"Esta cuenta se registró con Google…"*.
- `allowDangerousEmailAccountLinking: true` permite vincular una cuenta Google a un email ya existente (útil si primero se registró con email).
- En producción `AUTH_SECRET` y las credenciales de Google son obligatorias.

## Checklist de deploy (prep / prod)

- [ ] Añadir `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` a `.env.production`
- [ ] Configurar redirect URIs en Google Cloud Console para el dominio real
- [ ] `npm install` (o rebuild de la imagen Docker)
- [ ] `prisma migrate deploy`
- [ ] Probar login y registro con Google
- [ ] Verificar que las cookies `access_token` / `refresh_token` se setean
- [ ] Verificar que `/cuenta` y el carrito reconocen al usuario
