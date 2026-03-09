# Multi-stage build for Interface

# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies and update npm
RUN npm install -g npm@11 && npm install

# Copy source files
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Python Backend
FROM python:3.11-slim AS backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Stage 3: Production Image
FROM python:3.11-slim AS production

WORKDIR /app

# Install system dependencies for ML and serving
RUN apt-get update && apt-get install -y \
    nginx \
    libgomp1 \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from backend stage
COPY --from=backend /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend /usr/local/bin /usr/local/bin

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /app/frontend/dist ./static/

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Create startup script with proper process management and auto-seeding
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Start nginx in background\n\
nginx -g "daemon off;" &\n\
NGINX_PID=$!\n\
\n\
# Start FastAPI\n\
cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 8000 &\n\
UVICORN_PID=$!\n\
\n\
# Wait for backend to be healthy, then auto-seed if DB is empty\n\
(\n\
  for i in $(seq 1 30); do\n\
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then\n\
      # Get admin token\n\
      TOKEN=$(curl -sf -X POST http://localhost:8000/api/auth/login \\\n\
        -H "Content-Type: application/json" \\\n\
        -d '"'"'{"email":"admin@interface.app","password":"admin123"}'"'"' \\\n\
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('"'"'token'"'"','"'"''"'"'))" 2>/dev/null)\n\
      if [ -n "$TOKEN" ]; then\n\
        COUNT=$(curl -sf http://localhost:8000/api/admin/data-summary \\\n\
          -H "Authorization: Bearer $TOKEN" \\\n\
          | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('"'"'data'"'"',{}).get('"'"'employees'"'"',0))" 2>/dev/null)\n\
        if [ "$COUNT" = "0" ]; then\n\
          echo "[auto-seed] Database is empty — seeding now..."\n\
          curl -sf -X POST http://localhost:8000/api/admin/seed-full \\\n\
            -H "Authorization: Bearer $TOKEN" \\\n\
            -H "Content-Type: application/json" > /dev/null 2>&1 && \\\n\
          echo "[auto-seed] Database seeded successfully."\n\
          # Initialize compensation and workforce plans\n\
          PERIOD=$(curl -sf http://localhost:8000/api/planning/periods \\\n\
            -H "Authorization: Bearer $TOKEN" \\\n\
            | python3 -c "import sys,json; ps=json.load(sys.stdin).get('"'"'periods'"'"',[]); print(ps[0]['"'"'id'"'"'] if ps else '"'"''"'"')" 2>/dev/null)\n\
          if [ -n "$PERIOD" ]; then\n\
            curl -sf -X POST "http://localhost:8000/api/planning/periods/$PERIOD/initialize" \\\n\
              -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" > /dev/null 2>&1\n\
            curl -sf -X POST "http://localhost:8000/api/compensation/plans/initialize?period_id=$PERIOD" \\\n\
              -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" > /dev/null 2>&1\n\
            echo "[auto-seed] Plans initialized for period $PERIOD"\n\
          fi\n\
        else\n\
          echo "[auto-seed] Database already has $COUNT employees — skipping seed."\n\
        fi\n\
      fi\n\
      break\n\
    fi\n\
    sleep 2\n\
  done\n\
) &\n\
\n\
# Handle shutdown\n\
trap "kill $NGINX_PID $UVICORN_PID 2>/dev/null" SIGTERM SIGINT\n\
\n\
# Wait for main services (not the seeding subprocess)\n\
wait $NGINX_PID $UVICORN_PID\n\
exit $?\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose ports
EXPOSE 80 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the application
CMD ["/app/start.sh"]
