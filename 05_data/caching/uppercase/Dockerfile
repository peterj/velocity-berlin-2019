FROM node:10-alpine

COPY package*.json /app/
RUN cd /app && npm ci

WORKDIR /app
COPY . .

RUN npm prune --production
CMD [ "node", "server.js"]