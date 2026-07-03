# Onion Loop Memory Guard — zero-dependency demo image.
FROM node:20-alpine
WORKDIR /app
# No dependencies to install — the whole thing runs on the Node stdlib.
COPY package.json ./
COPY src ./src
COPY server ./server
COPY web ./web
COPY scenarios ./scenarios
COPY scripts ./scripts
EXPOSE 4173
ENV PORT=4173
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://localhost:4173/api/health || exit 1
CMD ["node", "server/server.js"]
