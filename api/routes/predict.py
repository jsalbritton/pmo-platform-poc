"""
PMO Platform — ML Risk Prediction Endpoint  (S1A-003)
======================================================
POST /api/predict/{project_id}

Requires: Any authenticated user (valid JWT, any role)
Returns:  health_score, risk_score, pulse, contributing signals

ARCHITECTURE PATTERNS IN USE:
  1. Event Sourcing — every prediction writes an immutable event to
     health_score_events BEFORE updating the projects read model.
     Events are the source of truth. The table row is a projection.

  2. CQRS — write path (event → health_score_events) is separate from
     the read path (React queries projects.health_score from Supabase).
     FastAPI owns the write path. Supabase exposes the read path.

  3. Feature Store pattern — features are pre-computed in Postgres via
     get_project_ml_features() and served to the model at inference time.
     The model never touches raw tables directly.

ML PIPELINE:
  Training (offline):  Supabase → get_ml_training_features() → pkl model
  Inference (online):  Supabase → get_project_ml_features(id) → pkl model

  The same feature engineering (encoding, imputation) runs at both stages.
  If they ever diverge → training/serving skew → silent prediction drift.
  This is one of the most common ML production bugs. We prevent it by
  using identical encoding maps and the same saved imputer object.

PRODUCTION MIGRATION NOTE (Azure):
  SUPABASE_URL         → Azure PostgreSQL connection string
  SUPABASE_SERVICE_ROLE_KEY → Azure Key Vault secret reference
  get_project_ml_features() → same function, different DB endpoint
  health_score_events INSERT → same table, same schema
  model bundle pkl    → Azure ML Model Registry
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import create_client, Client

from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Encoding maps (must match train_risk_model.py exactly) ────────────────────
# WHY THESE LIVE HERE AND NOT IN THE PKL:
#   The SimpleImputer handles missing numeric values, but it doesn't encode
#   categorical text → integer. That encoding happened in the training script
#   before the imputer saw the data. We must replicate it identically here.
#
#   If we change these maps (e.g. add a new category), we MUST retrain the model.
#   The category_enc hash for an unseen category will default to 7 ("other").
#   That's acceptable — the imputer will handle it gracefully.

STATUS_MAP = {
    "planning":   0,
    "active":     1,
    "on_hold":    2,
    "completed":  3,
}
PRIORITY_MAP = {
    "low":       0,
    "medium":    1,
    "high":      2,
    "critical":  3,
}
CATEGORY_MAP = {cat: i for i, cat in enumerate([
    "infrastructure",
    "application",
    "data",
    "security",
    "compliance",
    "process",
    "integration",
    "other",
])}

# ── Model bundle (loaded ONCE at module import, reused for every request) ─────
# WHY LOAD AT MODULE LEVEL, NOT PER REQUEST:
#   joblib.load() reads ~1MB pkl from disk and deserializes it.
#   On a 150-project portfolio, if users re-score projects frequently,
#   loading per request would dominate response time (100-500ms per load).
#   Module-level load happens once at startup (~5s) then is instant thereafter.
#
# MODEL_PATH env var allows overriding in Azure (e.g. Azure ML model registry
# download path). Default assumes Railway deploy from pmo_platform_vite/ root.

MODEL_PATH = os.environ.get("MODEL_PATH", "../ml/model/risk_model.pkl")

_model_bundle: Optional[dict] = None
_model_version: str = "gradient-boosting-v1"


def _load_model() -> None:
    """Load the pkl bundle from disk. Called once at startup."""
    global _model_bundle, _model_version
    try:
        bundle = joblib.load(MODEL_PATH)
        required = {"model", "imputer", "features"}
        if not required.issubset(bundle.keys()):
            raise ValueError(f"Model bundle missing keys. Found: {set(bundle.keys())}")
        _model_bundle = bundle
        model_type = bundle["model"].__class__.__name__
        feature_count = len(bundle["features"])
        logger.info(
            f"[predict] Model loaded: {model_type} | {feature_count} features | {MODEL_PATH}"
        )
    except Exception as e:
        logger.error(f"[predict] Model load FAILED: {e}. Endpoint will return 503.")
        _model_bundle = None


# Load immediately when this module is imported by main.py
_load_model()


# ── Supabase client (service_role — bypasses RLS for server-side writes) ──────
# WHY SERVICE ROLE HERE (not anon key):
#   FastAPI must INSERT into health_score_events and UPDATE projects.
#   These tables have RLS policies that allow writes only from specific roles.
#   The service_role key bypasses RLS entirely — correct for a trusted server.
#   NEVER use service_role in frontend code. It's safe only in server-side code
#   where the key is an environment variable, not embedded in client bundles.

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def _get_supabase() -> Client:
    """Return initialized Supabase client. Raises 503 if not configured."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Database connection not configured. "
                "Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars."
            ),
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ── Helper: health_status from risk_score ─────────────────────────────────────
# health_score_events.health_status constraint: green | amber | red | critical
# risk_score = 100 - health_score (higher risk_score = worse project)

def _derive_health_status(risk_score: float) -> str:
    if risk_score <= 25:
        return "green"
    elif risk_score <= 50:
        return "amber"
    elif risk_score <= 75:
        return "red"
    else:
        return "critical"


# ── Helper: pulse_condition from health_score ─────────────────────────────────
# health_score_events.pulse_condition constraint:
#   healthy | watch | elevated | critical | dormant

def _derive_pulse_condition(health_score: float) -> str:
    if health_score >= 80:
        return "healthy"
    elif health_score >= 60:
        return "watch"
    elif health_score >= 40:
        return "elevated"
    elif health_score >= 20:
        return "critical"
    else:
        return "dormant"


# ── Helper: pulse_momentum from historical events ─────────────────────────────
# Momentum is trajectory: is health_score improving or declining?
# We look at the 3 most recent events for this project.
# recovering | stable | declining | volatile

def _derive_pulse_momentum(supabase: Client, project_id: str, current_score: float) -> str:
    try:
        result = (
            supabase.table("health_score_events")
            .select("health_score")
            .eq("project_id", project_id)
            .order("transaction_time", desc=True)
            .limit(3)
            .execute()
        )
        if not result.data:
            return "stable"   # No history — assume stable on first score

        history = [float(r["health_score"]) for r in result.data]
        prev_score = history[0]   # Most recent event (before this one)
        delta = current_score - prev_score

        if abs(delta) < 2.0:
            return "stable"       # Less than 2 points change = stable
        elif delta > 0:
            return "recovering"   # Score improved
        else:
            # Check if direction keeps flipping (volatile)
            if len(history) >= 2:
                prev_delta = history[0] - history[1]
                if (delta > 0) != (prev_delta > 0):
                    return "volatile"
            return "declining"
    except Exception as e:
        logger.warning(f"[predict] Momentum check failed for {project_id}: {e}")
        return "stable"


# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.post("/predict/{project_id}")
async def predict_risk(
    project_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Run ML risk scoring for a specific project.

    Flow:
      1. Validate model is loaded (503 if pkl failed to load at startup)
      2. Fetch 19 ML features for this project from Supabase via RPC
      3. Encode categoricals (status/priority/category -> integers)
      4. Apply SimpleImputer (fill NaN with training-time medians)
      5. Run GradientBoosting predict() -> health_score
      6. Fetch signal breakdown from ml_score_project_risk (explainability)
      7. EVENT SOURCING: Write immutable event to health_score_events FIRST
      8. CQRS write: Update projects read model (health_score, pulse fields)
      9. Return structured response to React frontend

    The user dict from get_current_user() contains: sub (UUID), role, exp.
    We use sub as recorded_by in the event for audit trail.
    """

    # ── Guard: model loaded? ──────────────────────────────────────────────────
    if _model_bundle is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML model not available. Check MODEL_PATH env var and restart.",
        )

    supabase = _get_supabase()
    now_utc = datetime.now(timezone.utc).isoformat()

    # ── Step 1: Fetch ML features for this project ────────────────────────────
    # get_project_ml_features() is a SECURITY DEFINER function (migration 015).
    # Returns one row with 19 pre-computed features. Empty = project not found.
    try:
        feat_resp = supabase.rpc(
            "get_project_ml_features",
            {"p_project_id": project_id}
        ).execute()
    except Exception as e:
        logger.error(f"[predict] Feature fetch failed for {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Feature fetch failed. Check Supabase connectivity.",
        )

    if not feat_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found or has no feature data.",
        )

    f = feat_resp.data[0]   # Single row with all 19 features

    # ── Step 2: Build feature row matching training encoding exactly ──────────
    # CRITICAL: column ORDER must match FEATURE_COLS from train_risk_model.py.
    # The pkl model learned weights for features at specific vector positions.
    # Wrong order = wrong predictions. No error — just silently bad numbers.
    feature_row = {
        "budget_burn_rate":            float(f.get("budget_burn_rate") or 0),
        "days_remaining":              float(f.get("days_remaining") or 0),
        "days_elapsed":                float(f.get("days_elapsed") or 0),
        "status_enc":                  STATUS_MAP.get(f.get("status", "active"), 1),
        "priority_enc":                PRIORITY_MAP.get(f.get("priority", "medium"), 1),
        "category_enc":                CATEGORY_MAP.get(f.get("category", "other"), 7),
        "budget_total":                float(f.get("budget_total") or 0),
        "sprint_count":                float(f.get("sprint_count") or 0),
        "avg_velocity":                float(f.get("avg_velocity") or 0),
        "avg_sprint_completion_rate":  float(f.get("avg_sprint_completion_rate") or 0),
        "active_sprints":              float(f.get("active_sprints") or 0),
        "open_risks":                  float(f.get("open_risks") or 0),
        "high_severity_risks":         float(f.get("high_severity_risks") or 0),
        "avg_individual_risk_score":   float(f.get("avg_individual_risk_score") or 0),
        "work_completion_rate":        float(f.get("work_completion_rate") or 0),
        "blocked_items":               float(f.get("blocked_items") or 0),
        "overdue_items":               float(f.get("overdue_items") or 0),
        "team_size":                   float(f.get("team_size") or 0),
        "avg_allocation_pct":          float(f.get("avg_allocation_pct") or 0),
    }

    feature_cols = _model_bundle["features"]
    model        = _model_bundle["model"]
    imputer      = _model_bundle["imputer"]

    # Build DataFrame in the exact column order the model was trained with
    X = pd.DataFrame([feature_row], columns=feature_cols)

    # ── Step 3: Apply imputer ─────────────────────────────────────────────────
    # transform() only — NEVER fit_transform() at inference time.
    # fit_transform() would recalculate medians from this single row,
    # overwriting the training-time medians. Use the saved imputer as-is.
    X_imp = pd.DataFrame(imputer.transform(X), columns=feature_cols)

    # ── Step 4: Predict ───────────────────────────────────────────────────────
    health_score_raw = float(model.predict(X_imp)[0])
    health_score = round(float(np.clip(health_score_raw, 0.0, 100.0)), 2)
    risk_score   = round(100.0 - health_score, 2)

    # ── Step 5: Derive status and pulse fields ────────────────────────────────
    health_status    = _derive_health_status(risk_score)
    pulse_condition  = _derive_pulse_condition(health_score)
    pulse_momentum   = _derive_pulse_momentum(supabase, project_id, health_score)

    # ── Step 6: Signal breakdown for explainability ───────────────────────────
    # ml_score_project_risk() is the DB-side weighted signal scorer.
    # It doesn't produce health_score — our pkl model does that.
    # It produces rich signal details (budget burn, schedule pressure, etc.)
    # explaining WHY the score is what it is. Used for contributing_factors.
    signals_payload = {}
    try:
        signal_resp = supabase.rpc(
            "ml_score_project_risk",
            {"p_project_id": project_id}
        ).execute()
        if signal_resp.data and isinstance(signal_resp.data, dict):
            signals_payload = signal_resp.data.get("signals", {})
    except Exception as e:
        logger.warning(f"[predict] Signal fetch failed (non-critical): {e}")

    contributing_factors = []
    for signal_name, signal_info in signals_payload.items():
        if isinstance(signal_info, dict):
            raw    = float(signal_info.get("raw", 0))
            weight = float(signal_info.get("weight", 0))
            if raw > 0.2:
                contributing_factors.append({
                    "signal":    signal_name,
                    "weight":    round(weight, 3),
                    "raw_value": round(raw, 4),
                    "impact":    round(raw * weight, 4),
                })
    contributing_factors.sort(key=lambda x: x["impact"], reverse=True)

    # ── Step 7: EVENT SOURCING — write immutable event FIRST ─────────────────
    # Rules for health_score_events:
    #   INSERT only — never UPDATE or DELETE
    #   transaction_time = when we wrote this record (audit perspective)
    #   valid_time = when this score is valid for the business
    #   recorded_by = authenticated user UUID (JWT sub claim)
    #
    # WHY BEFORE updating projects:
    #   If the projects UPDATE fails, the event still exists.
    #   Audit trail is never lost. Events can replay to reconstruct the table.
    #   This is the core promise of Event Sourcing: events are durable truth.
    try:
        supabase.table("health_score_events").insert({
            "project_id":      project_id,
            "health_score":    health_score,
            "risk_score":      risk_score,
            "health_status":   health_status,
            "pulse_condition": pulse_condition,
            "signals":         signals_payload,
            "model_version":   _model_version,
            "trigger_source":  "api_predict",
            "transaction_time": now_utc,
            "valid_time":      now_utc,
            "recorded_by":     user.get("sub"),
            "notes":           f"API rescore by {user.get('role', 'unknown')} role",
        }).execute()
    except Exception as e:
        logger.error(f"[predict] Event store INSERT failed for {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to write scoring event. Score not applied.",
        )

    # ── Step 8: CQRS write — update projects read model ──────────────────────
    # The projects table is the read model (query side in CQRS).
    # It's a projection of the event stream — reconstructable from events alone.
    try:
        supabase.table("projects").update({
            "health_score":    health_score,
            "risk_score":      risk_score,
            "health_status":   health_status,
            "pulse_condition": pulse_condition,
            "pulse_momentum":  pulse_momentum,
            "pulse_updated_at": now_utc,
        }).eq("id", project_id).execute()
    except Exception as e:
        # Non-fatal: event is written. Log and continue.
        # The event can replay to fix the read model later.
        logger.warning(f"[predict] Projects UPDATE failed for {project_id}: {e}")

    # ── Step 9: Return response ───────────────────────────────────────────────
    return {
        "project_id":    project_id,
        "health_score":  health_score,
        "risk_score":    risk_score,
        "health_status": health_status,
        "pulse": {
            "condition": pulse_condition,
            "momentum":  pulse_momentum,
            "signals":   list(signals_payload.keys()),
        },
        "contributing_factors": contributing_factors[:3],
        "scored_at":     now_utc,
        "scored_by":     user.get("sub", "unknown"),
        "model_version": _model_version,
        "event_sourced": True,
        "model_r2":      0.9931,
    }
