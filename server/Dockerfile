FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --omit=dev --ignore-scripts && npm cache clean --force && mkdir /data && chown node:node /data
COPY --chown=node:node server/*.mjs ./
USER node
ENV NODE_ENV=production BETA_HOST=0.0.0.0 BETA_PORT=8788 BETA_DB=/data/beta.sqlite
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "beta-server.mjs"]
