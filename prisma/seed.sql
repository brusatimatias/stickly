-- stickly: development seed data.
-- Idempotent: removes and re-creates the seed users (emails @stickly.test) and their notes.
-- Dates are relative to the current week (Monday start), so the board always has data.
-- Run with `npm run db:seed`.
--
-- Seed users can't sign in with Google (their googleId is fake); use email + password:
--   ana@stickly.test   / stickly-demo-123
--   bruno@stickly.test / stickly-demo-123

BEGIN;

DELETE FROM "Note" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" LIKE '%@stickly.test');
DELETE FROM "WebChatUsage" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" LIKE '%@stickly.test');
DELETE FROM "User" WHERE "email" LIKE '%@stickly.test';

-- password hash = bcrypt (cost 10) of "stickly-demo-123" for both users. googleId is required and unique, so seed users get fake ones.
INSERT INTO "User" ("id", "googleId", "email", "name", "password", "timeZone", "createdAt") VALUES
  ('seed_user_ana',   'seed-google-ana',   'ana@stickly.test',   'Ana Gómez',   '$2b$10$XWnW42mY.pyLX4ztlCv96u5NSJW9mt96Ese54VdhFhG1BBEKYKwdi', 'America/Argentina/Cordoba', now() - interval '30 days'),
  ('seed_user_bruno', 'seed-google-bruno', 'bruno@stickly.test', 'Bruno Díaz',  '$2b$10$XWnW42mY.pyLX4ztlCv96u5NSJW9mt96Ese54VdhFhG1BBEKYKwdi', 'America/Argentina/Cordoba', now() - interval '10 days');

-- week: 0 = current week, -1 = previous, 1 = next. day: 0 = Monday ... 6 = Sunday.
-- time NULL = note without time (ALL_DAY, stored as the day at 00:00 UTC). Notes with a
-- time (TIMED) are stored as the instant that time is in the seed users' zone.
WITH params AS (
  -- The current week as seen from the seed users' time zone.
  SELECT date_trunc('week', (now() AT TIME ZONE 'America/Argentina/Cordoba'))::date AS week_start
),
data ("userId", week, day, time, title, location, description, "isDone") AS (
  VALUES
    -- Ana: previous week (mostly done)
    ('seed_user_ana', -1, 0, '09:00'::time, 'Reunión de planificación', 'Oficina', 'Revisar objetivos del sprint', true),
    ('seed_user_ana', -1, 2, '18:30'::time, 'Gimnasio', 'SportClub Centro', NULL, true),
    ('seed_user_ana', -1, 3, NULL,          'Pagar expensas', NULL, 'Vencen el 10', true),
    ('seed_user_ana', -1, 4, '21:00'::time, 'Cena con Laura', 'La Parrilla de Juan', NULL, false),
    -- Ana: current week
    ('seed_user_ana',  0, 0, '08:30'::time, 'Daily standup', NULL, NULL, true),
    ('seed_user_ana',  0, 0, '14:00'::time, 'Entrevista técnica', 'Google Meet', 'Candidato para frontend, llevar preguntas de React', false),
    ('seed_user_ana',  0, 0, NULL,          'Comprar regalo para mamá', NULL, NULL, false),
    ('seed_user_ana',  0, 1, '10:00'::time, 'Turno dentista', 'Consultorio Dr. Pérez, Av. Colón 1200', 'Llevar la orden', false),
    ('seed_user_ana',  0, 1, '19:00'::time, 'Clase de inglés', NULL, NULL, false),
    ('seed_user_ana',  0, 2, NULL,          'Llamar al plomero', NULL, 'Pérdida en la canilla de la cocina', false),
    ('seed_user_ana',  0, 2, '18:30'::time, 'Gimnasio', 'SportClub Centro', NULL, false),
    ('seed_user_ana',  0, 3, '12:30'::time, 'Almuerzo con el equipo', 'Café Martínez', NULL, false),
    ('seed_user_ana',  0, 4, '16:00'::time, 'Demo del sprint', 'Sala 3', 'Mostrar el tablero semanal', false),
    ('seed_user_ana',  0, 4, NULL,          'Enviar informe mensual', NULL, NULL, false),
    ('seed_user_ana',  0, 5, '11:00'::time, 'Feria del libro', 'Complejo Forja', NULL, false),
    ('seed_user_ana',  0, 6, '13:00'::time, 'Asado familiar', 'Casa de los abuelos', 'Llevar ensalada y postre', false),
    -- Ana: next week
    ('seed_user_ana',  1, 0, '09:00'::time, 'Retro del sprint', 'Oficina', NULL, false),
    ('seed_user_ana',  1, 2, '17:00'::time, 'Renovar DNI', 'Registro Civil', 'Sacar turno antes', false),
    ('seed_user_ana',  1, 5, NULL,          'Cumpleaños de Sofi', NULL, 'Comprar torta', false),
    -- Bruno: current week (lighter account)
    ('seed_user_bruno', 0, 1, '07:00'::time, 'Salir a correr', 'Parque Sarmiento', '5 km', true),
    ('seed_user_bruno', 0, 1, '15:00'::time, 'Llevar el auto al taller', 'Taller Rodríguez', 'Cambio de aceite y filtros', false),
    ('seed_user_bruno', 0, 3, NULL,          'Estudiar para el parcial', NULL, 'Capítulos 4 a 6', false),
    ('seed_user_bruno', 0, 4, '22:00'::time, 'Partido de fútbol 5', 'Complejo La Cancha', NULL, false)
)
INSERT INTO "Note" ("id", "title", "location", "description", "kind", "startsAt", "isDraft", "isDone", "position", "userId", "createdAt", "updatedAt")
SELECT
  'seed_note_' || row_number() OVER (),
  d.title,
  d.location,
  d.description,
  CASE WHEN d.time IS NULL THEN 'ALL_DAY'::"NoteKind" ELSE 'TIMED'::"NoteKind" END,
  CASE
    WHEN d.time IS NULL THEN (p.week_start + d.week * 7 + d.day)::timestamp AT TIME ZONE 'UTC'
    ELSE (p.week_start + d.week * 7 + d.day + d.time) AT TIME ZONE 'America/Argentina/Cordoba'
  END,
  false,
  d."isDone",
  -- Positions are contiguous per user and day; done notes go last, as the board shows them.
  (row_number() OVER (PARTITION BY d."userId", d.week, d.day ORDER BY d."isDone", d.time NULLS LAST) - 1)::int,
  d."userId",
  now(),
  now()
FROM data d CROSS JOIN params p;

-- Draft notes: at most one per user, no schedule.
INSERT INTO "Note" ("id", "title", "location", "description", "startsAt", "isDraft", "isDone", "position", "userId", "createdAt", "updatedAt") VALUES
  ('seed_note_draft_ana', 'Ideas para las vacaciones', NULL, 'Bariloche o Salta', NULL, true, false, 0, 'seed_user_ana', now(), now());

COMMIT;
