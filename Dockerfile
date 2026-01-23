FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package.json and prisma schema first
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies (without postinstall running prisma generate)
RUN npm install --ignore-scripts

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
