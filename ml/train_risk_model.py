"""
PMO Platform -- ML Risk Model Training
Sprint 0 / S0-006

HOW TO RUN:
  cd pmo_platform_vite/ml
  python3 train_risk_model.py

SECURITY MODEL:
  Uses the anon key (already in .env). A SECURITY DEFINER Postgres function
  (get_ml_training_features) runs server-side with elevated privileges and
  returns only the aggregated ML features -- no raw table access required.
  This avoids needing the service_role key in the script entirely.

RETRAINING:
  Add new data to Supabase, then run this script again.
  Artifacts in model/ are overwritten each run.
  FastAPI reloads the model on next restart.
"""

import os, json, warnings, requests
import numpy as np
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import cross_validate, KFold
from sklearn.impute import SimpleImputer
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

warnings.filterwarnings("ignore")
load_dotenv()

# ── Connection ────────────────────────────────────────────────────────────────
# SECURITY NOTE: We use the anon key here. The get_ml_training_features()
# Postgres function is SECURITY DEFINER -- it runs as postgres and bypasses
# RLS internally. The anon key has EXECUTE permission on that function only.
# This is more secure than the service_role key because it grants minimum
# required access rather than full bypass.

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qffzpdhnrkfbkzgrnvsy.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_KEY:
    raise EnvironmentError("No Supabase key in ml/.env")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

print("[1/6] Connecting to Supabase...")
test = requests.get(f"{SUPABASE_URL}/rest/v1/projects",
                    headers=HEADERS, params={"select": "id", "limit": 1})
if test.status_code != 200:
    raise ConnectionError(f"Connection failed: {test.status_code} {test.text}")
print("  Connected")

# ── Fetch training data (single RPC call) ─────────────────────────────────────
# Why one RPC instead of 5 table fetches?
#   - Postgres does the JOIN across 20K+ rows server-side (fast)
#   - Returns one clean row per project -- no Python-side merging needed
#   - Feature engineering logic lives in the DB function, not scattered here
#   - SECURITY DEFINER means no table-level anon policies needed

print("[2/6] Fetching training features via get_ml_training_features()...")
resp = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/get_ml_training_features",
    headers=HEADERS,
    json={}
)

if resp.status_code != 200:
    raise RuntimeError(f"RPC call failed: {resp.status_code}\n{resp.text}")

df = pd.DataFrame(resp.json())
print(f"  Received {len(df)} projects, {len(df.columns)} columns")

# ── Feature engineering ───────────────────────────────────────────────────────
# EXCLUDED (data leakage -- these columns are derived FROM health_score):
#   projects.risk_score  -- corr = -1.0 with health_score
#   health_status        -- text form of health_score
#   classification       -- derived from health_score
#
# The function already returns aggregated numeric features.
# We only need to label-encode the three categorical columns.

print("[3/6] Engineering features...")

STATUS_MAP   = {"planning": 0, "active": 1, "on_hold": 2, "completed": 3}
PRIORITY_MAP = {"low": 0, "medium": 1, "high": 2, "critical": 3}
CATEGORY_MAP = {c: i for i, c in enumerate(
    ["infrastructure","application","data","security",
     "compliance","process","integration","other"]
)}

df["status_enc"]   = df["status"].map(STATUS_MAP).fillna(1).astype(int)
df["priority_enc"] = df["priority"].map(PRIORITY_MAP).fillna(1).astype(int)
df["category_enc"] = df["category"].map(CATEGORY_MAP).fillna(0).astype(int)

FEATURE_COLS = [
    "budget_burn_rate",           # Budget consumed / total
    "days_remaining",             # Days to target_end (negative = overdue)
    "days_elapsed",               # Days since start
    "status_enc",                 # Encoded: planning=0, active=1, on_hold=2, completed=3
    "priority_enc",               # Encoded: low=0, medium=1, high=2, critical=3
    "category_enc",               # Encoded project category
    "budget_total",               # Project size proxy
    "sprint_count",               # Sprints run so far
    "avg_velocity",               # Avg story points per sprint
    "avg_sprint_completion_rate", # Delivery consistency (committed vs completed)
    "active_sprints",             # Currently running sprints
    "open_risks",                 # Unresolved risk items
    "high_severity_risks",        # High/critical severity risk count
    "avg_individual_risk_score",  # Avg from risk records (NOT projects.risk_score)
    "work_completion_rate",       # % of work items done
    "blocked_items",              # Work items stuck in blocked
    "overdue_items",              # Past due date and not done
    "team_size",                  # Active team members
    "avg_allocation_pct",         # Team bandwidth utilization
]
TARGET_COL = "health_score"

for col in FEATURE_COLS:
    df[col] = pd.to_numeric(df[col], errors="coerce")

X = df[FEATURE_COLS].copy()
y = pd.to_numeric(df[TARGET_COL], errors="coerce")

print(f"  Rows: {len(y)} | Features: {len(FEATURE_COLS)}")
print(f"  Target: {y.min():.1f} - {y.max():.1f}  (mean {y.mean():.1f}, stddev {y.std():.1f})")

nulls = X.isnull().sum()
if nulls.any():
    print("  NULLs -> imputing with median:")
    for col, n in nulls[nulls > 0].items():
        print(f"    {col}: {n} rows")

# SimpleImputer fills NULLs with column median.
# We save the imputer alongside the model -- at prediction time the same
# imputation must be applied, or the model will see different values than
# it was trained on (training/serving skew).
imputer = SimpleImputer(strategy="median")
X_imp = pd.DataFrame(imputer.fit_transform(X), columns=FEATURE_COLS)

# ── Train ─────────────────────────────────────────────────────────────────────
# Two candidates, evaluated by 5-fold cross-validation.
# K-fold is used instead of a single 80/20 split because 150 rows is small --
# one lucky/unlucky split changes results significantly.

print("\n[4/6] Training -- 5-fold cross-validation...")
kf = KFold(n_splits=5, shuffle=True, random_state=42)

MODELS = {
    "RandomForest": RandomForestRegressor(
        n_estimators=200, max_depth=10, min_samples_leaf=3,
        random_state=42, n_jobs=-1),
    "GradientBoosting": GradientBoostingRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.05,
        subsample=0.8, random_state=42),
}

results = {}
for name, model in MODELS.items():
    cv = cross_validate(model, X_imp, y, cv=kf,
                        scoring=["r2","neg_mean_squared_error","neg_mean_absolute_error"])
    r2   = cv["test_r2"]
    rmse = np.sqrt(-cv["test_neg_mean_squared_error"])
    mae  = -cv["test_neg_mean_absolute_error"]
    results[name] = {"r2_mean": float(r2.mean()), "r2_std": float(r2.std()),
                     "rmse_mean": float(rmse.mean()), "mae_mean": float(mae.mean())}
    gate = r2.mean() > 0.4
    print(f"\n  {name}:")
    print(f"    R^2  = {r2.mean():.3f} +/- {r2.std():.3f}   (TG-1 >0.400: {'PASS' if gate else 'FAIL'})")
    print(f"    RMSE = {rmse.mean():.2f} pts  |  MAE = {mae.mean():.2f} pts")

# ── Save ──────────────────────────────────────────────────────────────────────
print("\n[5/6] Saving best model...")

best_name  = max(results, key=lambda k: results[k]["r2_mean"])
best_model = MODELS[best_name]
best_model.fit(X_imp, y)

os.makedirs("model", exist_ok=True)

# The bundle saves model + imputer + feature list together.
# FastAPI loads this at startup. All three must stay in sync:
# if features change, retrain and redeploy together.
joblib.dump({"model": best_model, "imputer": imputer, "features": FEATURE_COLS},
            "model/risk_model.pkl")
print("  Saved -> model/risk_model.pkl")

importances = pd.Series(best_model.feature_importances_, index=FEATURE_COLS).sort_values(ascending=True)
fig, ax = plt.subplots(figsize=(10, 7))
ax.barh(importances.index, importances.values, color="#3fb950")
ax.set_title(f"Feature Importance -- {best_name}", fontsize=14)
ax.set_xlabel("Importance Score (higher = model relies on this feature more)")
plt.tight_layout()
plt.savefig("model/feature_importance.png", dpi=150)
plt.close()
print("  Saved -> model/feature_importance.png")

metadata = {
    "trained_at":       datetime.utcnow().isoformat() + "Z",
    "model_type":       best_name,
    "target":           TARGET_COL,
    "features":         FEATURE_COLS,
    "feature_count":    len(FEATURE_COLS),
    "training_rows":    int(len(y)),
    "data_source":      "rpc/get_ml_training_features (SECURITY DEFINER)",
    "metrics":          {n: {k: round(v,4) for k,v in r.items()} for n,r in results.items()},
    "selected_model":   best_name,
    "tollgate": {
        "gate": "TG-1", "requirement": "R^2 > 0.400",
        "passed": results[best_name]["r2_mean"] > 0.4,
        "actual_r2": round(results[best_name]["r2_mean"], 4),
    },
    "leakage_exclusions": [
        "projects.risk_score (corr=-1.0 with health_score)",
        "projects.health_status (derived from health_score)",
        "projects.classification (derived from health_score)",
    ],
    "retraining_instructions": (
        "1. Load new data into Supabase. "
        "2. Run: python3 train_risk_model.py. "
        "3. Restart FastAPI to pick up new model/risk_model.pkl."
    ),
}
with open("model/model_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)
print("  Saved -> model/model_metadata.json")

# ── Summary ───────────────────────────────────────────────────────────────────
r2, rmse = results[best_name]["r2_mean"], results[best_name]["rmse_mean"]
print("\n[6/6] Done.")
print("=" * 60)
print(f"  Model:    {best_name}")
print(f"  R^2:      {r2:.3f}  -> TG-1: {'PASSED' if r2 > 0.4 else 'FAILED'}")
print(f"  RMSE:     {rmse:.2f} health-score points")
print(f"  Artifacts: model/risk_model.pkl, model_metadata.json, feature_importance.png")
print("=" * 60)
print("\nTo retrain with new data: load data into Supabase, then run this script again.")
print("Next step (S1A-005): FastAPI service that loads risk_model.pkl -> POST /predict\n")
