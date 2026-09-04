FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_SITE_URL=https://gate-rank.com
ARG VITE_API_BASE=
ARG PUBLIC_FRONTEND_ASSET_VERSION=
ENV VITE_SITE_URL=$VITE_SITE_URL
ENV VITE_API_BASE=$VITE_API_BASE
ENV PUBLIC_FRONTEND_ASSET_VERSION=$PUBLIC_FRONTEND_ASSET_VERSION
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
