# Build client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Build server
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --production
COPY server/ ./

# Copy client build output
COPY --from=client-build /app/client/dist ./public

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3000
ENV NODE_ENV=production

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/index.js"]
