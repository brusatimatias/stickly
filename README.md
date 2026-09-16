# Sticly

App de notas/recordatorios organizadas en un tablero semanal estilo pizarra, con integración a Google Calendar para convertir cualquier nota en un evento con un click.

## Funcionalidad

- Login con Google (único método de autenticación).
- Tablero semanal basado en semanas de calendario reales, con navegación entre semanas y salto a una semana específica.
- Notas como pegatinas por día y hora (título, ubicación opcional, fecha/hora exacta), movibles por drag & drop.
- Nota borrador: una única nota por usuario, sin fecha, como espacio de scratch.
- Botón por nota para crear un evento en Google Calendar, vinculado a la nota vía `googleEventId`.

## Stack

- Next.js (App Router) + TypeScript
- Auth.js (Google provider, sesiones JWT)
- PostgreSQL + Prisma (driver adapter `@prisma/adapter-pg`)
- dnd-kit para drag & drop
- `googleapis` para la integración con Calendar
- Vercel para el deploy

## Desarrollo local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar `.env.example` a `.env` y completar:
   - `DATABASE_URL`: conexión a tu Postgres local.
   - `AUTH_SECRET`: generar con `openssl rand -base64 32`.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: credenciales OAuth de Google Cloud Console, con la Calendar API habilitada y el scope `https://www.googleapis.com/auth/calendar.events`.

3. Aplicar las migraciones de Prisma:

   ```bash
   npx prisma migrate dev
   ```

4. Levantar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000).

## Modelo de datos

Ver `prisma/schema.prisma`. Decisiones relevantes:

- `scheduledAt` es un único `DateTime` (fecha + hora juntas) para poder armar el evento de Calendar sin combinar campos.
- `scheduledAt` es nullable; el único caso válido con `null` es la nota borrador (`isDraft: true`).
- La regla de "una sola nota borrador por usuario" se controla a nivel aplicación, no en el schema.
- Índice compuesto `[userId, scheduledAt]` para la query de notas de una semana.
