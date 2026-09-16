# Sticly

App de notas/recordatorios organizadas en un tablero semanal estilo pizarra, con integración a Google Calendar (ver README.md para la descripción funcional y de stack).

## Decisiones de diseño a respetar

- `scheduledAt` es un único campo `DateTime` (fecha + hora juntas), no separado en dos campos, para armar el evento de Calendar directo sin combinar valores.
- `title` y `location` van separados porque la API de Calendar acepta `location` como campo propio del evento.
- `scheduledAt` es nullable; el único caso válido con `null` es la nota borrador (`isDraft: true`).
- La regla de "una sola nota borrador por usuario" se controla a nivel aplicación (no hay unique parcial en Prisma): antes de crear una nota borrador, verificar con `findFirst({ userId, isDraft: true })` si ya existe y actualizar esa en vez de crear una nueva.
- Índice compuesto `[userId, scheduledAt]` pensado para la query más frecuente: notas de un usuario entre el inicio y el fin de una semana dada.
- La navegación por semana se resuelve por query (`scheduledAt >= weekStart AND scheduledAt < weekEnd`), no se persiste ningún número de semana en la nota — se deriva de la fecha en cada consulta.
- No se usa `@auth/prisma-adapter`: el schema no tiene modelos `Account`/`Session`. Las sesiones son JWT (`src/auth.ts`), y los tokens de Google (access/refresh) se guardan en el JWT, no en la base de datos. El `User` propio se sincroniza (upsert) en el callback `jwt` de Auth.js.
- Postgres corre en el servidor local del usuario (no Docker). La base de desarrollo es `stickly-development`, siguiendo la convención `<app>-development`/`<app>-test` de sus otros proyectos.

## Contexto del plan general

Este proyecto se desarrolla en paralelo a otro proyecto personal más grande (una red social, con API en Rails, cliente en React, y un servicio de mensajería en Node.js), pensado también como pieza de portfolio. Sticly funciona como bloque de "victoria rápida": un proyecto más chico y acotado para avanzar en momentos de menor disponibilidad de tiempo o energía.
