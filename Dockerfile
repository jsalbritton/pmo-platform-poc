# ============================================================
# Dockerfile — PMO Platform FastAPI Service
# ============================================================
# This file builds the Python FastAPI ML service only.
# The Vite frontend is deployed separately to Cloudflare Pages.
#
# Railway detects this Dockerfile and skips Nixpacks entirely,
# avoiding confusion from package.json (the Vite frontend root).
#
# Production (Azure): this Dockerfile becomes the Container App image.
# Same pattern — replace Railway's $PORT with Azure's 8000 default.

FROM python:3.11-slim

# Install system deps needed by some ML packages (e.g. numpy C extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python deps first (layer caching — deps change rarely)
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI application
COPY api/ .

# PORT is injected by Railway at runtime. Uvicorn binds to it.
# Default 8000 for local docker run / Azure Container Apps.
ENV PORT=8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
