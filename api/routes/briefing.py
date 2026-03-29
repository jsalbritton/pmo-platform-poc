"""
PMO Platform — AI Risk Briefing Endpoint  (S1A-004)
====================================================
POST /api/briefing

Requires: JWT + ml_admin role (calls Anthropic API — costs money)
Returns:  AI-generated executive portfolio risk briefing

WHY ml_admin ONLY:
  Each call to Sonnet 4.6 costs ~$0.008. With 150 projects in the portfolio,
  the prompt is ~4K tokens. If any authenticated user could call this endpoint,
  one refresh loop in the React app could drain the $25 API credit quickly.
  ml_admin is the trusted role that initiates AI operations.

WHAT THIS ENDPOINT DOES:
  1. Fetch live portfolio data (all projects with health/pulse/risk data)
  2. Check system_config for model override (allows future model switching)
  3. Build a rich system prompt with portfolio context + PM domain knowledge
  4. Call Claude Sonnet 4.6 — structured JSON output mode
  5. Parse and validate the response
  6. Return briefing with top risks, recommendations, and portfolio snapshot

PRODUCTION NOTE (Azure):
  ANTHROPIC_API_KEY → Azure Key Vault reference
  system_config model override → supports A/B testing between model versions
  Logging → Azure Monitor (OpenTelemetry) instead of print()
"""

import os
import json
import logging
from datetime import datetime, timezone

import anthropic
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import create_client, Client

from auth import require_role

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Environment ───────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY        = os.environ.get("ANTHROPIC_API_KEY", "")
SUPABASE_URL             = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Default model — can be overridden by system_config table
DEFAULT_BRIEFING_MODEL   = "claude-sonnet-4-6"

# ── Supabase client ───────────────────────────────────────────────────────────

def _get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not configured.",
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ── Anthropic client ──────────────────────────────────────────────────────────

def _get_anthropic() -> anthropic.Anthropic:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ANTHROPIC_API_KEY not configured. Check Railway env vars.",
        )
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# ── Briefing prompt builder ───────────────────────────────────────────────────

def _build_briefing_prompt(projects: list, generated_at: str) -> str:
    """
    Build the portfolio briefing prompt.

    WHY A DETAILED SYSTEM CONTEXT:
      Claude has no memory of previous calls. Every briefing is stateless.
      The more domain context we provide (what these fields mean, what good
      looks like, what actions are relevant), the better the briefing quality.
      This prompt is the bridge between raw data and executive narrative.

    STRUCTURED OUTPUT:
      We request JSON directly in the prompt. This gives us machine-parseable
      output that the React component can render with proper formatting.
      In future (S2A), we'll use Sonnet's native structured output feature.
    """

    # Classify projects by pulse condition for the snapshot
    condition_counts = {"healthy": 0, "watch": 0, "elevated": 0, "critical": 0, "dormant": 0}
    for p in projects:
        cond = p.get("pulse_condition") or "watch"
        condition_counts[cond] = condition_counts.get(cond, 0) + 1

    # Top 10 worst projects for the prompt context (by health_score ascending)
    worst = sorted(
        [p for p in projects if p.get("health_score") is not None],
        key=lambda x: float(x.get("health_score", 50))
    )[:10]

    worst_summary = "\n".join([
        f"  - {p.get('name', 'Unknown')} | "
        f"health={p.get('health_score', '?')} | "
        f"condition={p.get('pulse_condition', '?')} | "
        f"momentum={p.get('pulse_momentum', '?')} | "
        f"vertical={p.get('vertical', '?')}"
        for p in worst
    ])

    total = len(projects)
    snapshot_text = (
        f"Total projects: {total} | "
        f"healthy: {condition_counts['healthy']} | "
        f"watch: {condition_counts['watch']} | "
        f"elevated: {condition_counts['elevated']} | "
        f"critical: {condition_counts['critical']} | "
        f"dormant: {condition_counts['dormant']}"
    )

    return f"""You are a senior program manager AI assistant for a global IT organization managing 20+ simultaneous projects across Transportation and Warehouse & Distribution business units.

Generate an executive risk briefing for this portfolio as of {generated_at}.

PORTFOLIO SNAPSHOT:
{snapshot_text}

TOP 10 PROJECTS BY RISK (worst health score first):
{worst_summary}

FIELD DEFINITIONS:
- health_score: 0-100 where HIGHER is healthier. Predicted by a GradientBoosting ML model (R²=0.993).
- pulse_condition: healthy (≥80) | watch (60-80) | elevated (40-60) | critical (20-40) | dormant (<20)
- pulse_momentum: recovering (improving) | stable | declining | volatile
- vertical: Transportation or Warehouse & Distribution

BRIEFING REQUIREMENTS:
Generate a JSON briefing with exactly this structure:
{{
  "executive_summary": "2-3 sentence narrative on overall portfolio health and most urgent theme",
  "top_risks": [
    {{
      "project_name": "string",
      "condition": "critical|elevated|watch",
      "momentum": "declining|stable|recovering|volatile",
      "vertical": "Transportation|Warehouse & Distribution",
      "risk_narrative": "1-2 sentence diagnosis of what is wrong",
      "recommended_action": "1 sentence specific action for the executive to take",
      "urgency": "immediate|this-sprint|this-month"
    }}
  ],
  "positive_signals": "1 sentence on what is going well across the portfolio",
  "recommended_leadership_actions": ["action 1", "action 2", "action 3"],
  "portfolio_snapshot": {{
    "total_projects": {total},
    "healthy": {condition_counts['healthy']},
    "watch": {condition_counts['watch']},
    "elevated": {condition_counts['elevated']},
    "critical": {condition_counts['critical']},
    "dormant": {condition_counts['dormant']}
  }}
}}

Include 3-5 top_risks. Be specific — name projects, cite data, give actionable recommendations.
Return ONLY valid JSON with no markdown code fences or preamble."""


# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.post("/briefing")
async def generate_briefing(
    user: dict = Depends(require_role("ml_admin")),
):
    """
    Generate an AI risk briefing for the entire portfolio.

    The require_role("ml_admin") dependency chain:
      1. HTTPBearer extracts Bearer token from Authorization header
      2. get_current_user() validates JWT signature + expiry
      3. require_role() checks role == "ml_admin" (403 if wrong role)
      4. THIS FUNCTION runs only if all three pass

    This is the dependency injection pattern — auth logic is completely
    decoupled from business logic. Clean separation of concerns.
    """

    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ANTHROPIC_API_KEY not configured.",
        )

    supabase  = _get_supabase()
    ai_client = _get_anthropic()
    now_utc   = datetime.now(timezone.utc)
    generated_at = now_utc.isoformat()

    # ── Step 1: Fetch portfolio data ─────────────────────────────────────────
    # We fetch all non-cancelled projects with their Pulse and health data.
    # This is the "read" side — querying the CQRS read model (projects table).
    try:
        proj_resp = supabase.table("projects").select(
            "id, name, vertical, health_score, risk_score, health_status, "
            "pulse_condition, pulse_momentum, pulse_signals, status, priority, category"
        ).neq("status", "cancelled").execute()
    except Exception as e:
        logger.error(f"[briefing] Portfolio fetch failed: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Portfolio fetch failed.")

    projects = proj_resp.data or []
    if not projects:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active projects found in portfolio.",
        )

    # ── Step 2: Check system_config for model override ───────────────────────
    # The system_config table stores key/value pairs for runtime configuration.
    # ml_admin can change the model via the ML Admin Panel (S2A) without
    # redeploying FastAPI. This is how we support model A/B testing.
    briefing_model = DEFAULT_BRIEFING_MODEL
    try:
        config_resp = (
            supabase.table("system_config")
            .select("value")
            .eq("key", "ai_briefing_model")
            .limit(1)
            .execute()
        )
        if config_resp.data:
            briefing_model = config_resp.data[0].get("value", DEFAULT_BRIEFING_MODEL)
    except Exception as e:
        logger.warning(f"[briefing] system_config fetch failed, using default model: {e}")

    logger.info(f"[briefing] Generating briefing for {len(projects)} projects using {briefing_model}")

    # ── Step 3: Build prompt ─────────────────────────────────────────────────
    prompt = _build_briefing_prompt(projects, generated_at)

    # ── Step 4: Call Anthropic ───────────────────────────────────────────────
    # WHY max_tokens=2048:
    #   The briefing JSON response is ~800-1200 tokens.
    #   2048 gives comfortable headroom for 5 detailed risk items.
    #   Higher = more cost. This is tuned for the 150-project POC scale.
    try:
        message = ai_client.messages.create(
            model=briefing_model,
            max_tokens=2048,
            messages=[
                {"role": "user", "content": prompt}
            ],
        )
        raw_content = message.content[0].text
    except anthropic.APIError as e:
        logger.error(f"[briefing] Anthropic API error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI briefing generation failed: {str(e)}",
        )

    # ── Step 5: Parse JSON response ──────────────────────────────────────────
    # Sonnet is reliable at returning valid JSON when explicitly instructed.
    # We strip any accidental markdown fences just in case.
    try:
        clean = raw_content.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        briefing_data = json.loads(clean)
    except json.JSONDecodeError as e:
        logger.error(f"[briefing] JSON parse failed. Raw: {raw_content[:200]}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI returned invalid JSON. This is a prompt engineering issue.",
        )

    # ── Step 6: Return structured response ───────────────────────────────────
    return {
        "briefing": {
            **briefing_data,
            "generated_at": generated_at,
            "model_used":   briefing_model,
            "projects_analyzed": len(projects),
            "input_tokens":  message.usage.input_tokens,
            "output_tokens": message.usage.output_tokens,
        },
        "requested_by": user.get("sub", "unknown"),
        "role":         user.get("role", "unknown"),
    }
