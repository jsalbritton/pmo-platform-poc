"""
PMO Platform — FastAPI Application Entry Point
================================================
This is the front door. Every request enters here.

Responsibilities:
1. Create the FastAPI app instance
2. Configure CORS (which domains can call us)
3. Mount route files (connect URL paths to handler functions)
4. Provide /health endpoint for Railway health checks

This file contains ZERO business logic and ZERO auth code.
It is pure wiring — connecting the pieces defined in other files.
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.predict import router as predict_router
from routes.briefing import router as briefing_router

# Load .env file for local development. In Railway, env vars are set in dashboard.
# load_dotenv() does nothing if no .env file exists — safe to call in production.
load_dotenv()

ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")

# --- App Instance ---
app = FastAPI(
    title="PMO Platform API",
    description="ML risk scoring and AI briefing service for the PMO Platform",
    version="0.1.0-scaffold",
    docs_url="/docs" if ENVIRONMENT == "development" else None,  # Disable Swagger in prod
    redoc_url=None,
)

# --- CORS Configuration ---
# Which domains are allowed to call this API from a browser.
# Without this, the browser blocks cross-origin requests (React on CF Pages → FastAPI on Railway).
#
# IMPORTANT: Update the CF Pages URL when your deployment URL is finalized.
# localhost:5173 is Vite's default dev server port.
allowed_origins = [
    "http://localhost:5173",            # Local Vite dev server
    "http://localhost:3000",            # Alternate local dev
    "https://pmo-platform.pages.dev",   # Cloudflare Pages production
]

# In development, allow all origins for easier testing
if ENVIRONMENT == "development":
    allowed_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Mount Routes ---
# Each router handles its own URL paths. The prefix groups them under /api.
# predict_router: POST /api/predict/{project_id}
# briefing_router: POST /api/briefing
app.include_router(predict_router, prefix="/api", tags=["ML Prediction"])
app.include_router(briefing_router, prefix="/api", tags=["AI Briefing"])


# --- Health Check ---
# Railway pings this endpoint to verify the service is alive.
# If it returns non-200, Railway restarts the container.
# No auth required — this is a public endpoint by design.
@app.get("/health", tags=["Infrastructure"])
async def health_check():
    return {
        "status": "healthy",
        "service": "pmo-platform-api",
        "version": "0.1.0-scaffold",
        "environment": ENVIRONMENT,
    }


# --- Root ---
@app.get("/", tags=["Infrastructure"])
async def root():
    return {
        "service": "PMO Platform API",
        "version": "0.1.0-scaffold",
        "docs": "/docs" if ENVIRONMENT == "development" else "disabled in production",
        "health": "/health",
        "endpoints": [
            "POST /api/predict/{project_id}",
            "POST /api/briefing",
        ],
    }
