# Minimal image for the llm-platform service in docker-compose.yml.
# Not meant to be a hardened production image yet — just enough to run
# tests/typecheck/benchmark against a real Ollama container on Light
# One's Linux server.
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Overridable per docker-compose service/`docker run ... npm run test` etc.
CMD ["npm", "run", "benchmark:ses"]
