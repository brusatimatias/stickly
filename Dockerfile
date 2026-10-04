# Local development image only: runs `next dev` with hot reload against the
# code mounted from the host. Not used for production (Vercel builds the app).
FROM node:24.15.0-bookworm-slim

WORKDIR /app
# Run as the image's `node` user (uid 1000) so files `next dev` writes into the
# mounted code aren't owned by root on the host.
RUN mkdir -p .next src/generated/prisma && chown -R node:node /app
USER node

# Dependency manifests first, so `npm ci` stays cached until they change. The
# Prisma schema and config are needed by the `prisma generate` postinstall.
COPY --chown=node:node package.json package-lock.json prisma7.config.ts ./
COPY --chown=node:node prisma ./prisma
RUN npm ci

COPY --chown=node:node . .

EXPOSE 3000
# Regenerates the Prisma client on every start, so a schema change only needs a restart.
CMD ["sh", "-c", "npx prisma generate && npm run dev -- --hostname 0.0.0.0"]
