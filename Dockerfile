FROM node:20-slim AS runner

# Install build essentials for native packages (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build Vite frontend assets
RUN npm run build

# Volume directory for persistent SQLite database
VOLUME /app/data
ENV DATABASE_PATH=/app/data/confessions.db
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
