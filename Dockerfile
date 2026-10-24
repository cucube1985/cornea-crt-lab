FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node auth ./auth
COPY --chown=node:node dist ./dist
RUN mkdir -p /app/.private && chown node:node /app/.private
ENV NODE_ENV=production PORT=4173 AUTH_DATA_DIR=/app/.private
USER node
EXPOSE 4173
VOLUME ["/app/.private"]
HEALTHCHECK --interval=30s --timeout=5s CMD ["node","-e","fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node","server.mjs"]
