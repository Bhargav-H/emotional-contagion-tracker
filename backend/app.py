from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import time
from fastapi import FastAPI, HTTPException
# ──────────────────────────────
# IMPORTS (MODEL LOADED HERE FIRST)
# ──────────────────────────────
from supabase_client import supabase
from analytics.ml_model import load_model  # <-- ensure model loads first
from analytics.manager_analytics import run_full_analytics
from process_emotions import process_once   # runs AFTER model is loaded
# FORCE LOAD MODEL AT IMPORT TIME
print("⚡ Loading ML model before startup...")
load_model()       # <-- ensures model is ready BEFORE process_once() runs
# ──────────────────────────────
# FASTAPI APP
# ──────────────────────────────
app = FastAPI()
# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ──────────────────────────────
# STARTUP EVENT → RUN ONLY AFTER MODEL IS LOADED
# ──────────────────────────────
@app.on_event("startup")
def on_startup():
    print("⚡ Startup: loading ML model...")
    load_model()               # load model first
    print("⚡ ML model ready — now processing unprocessed rows (once).")
    process_once()            # then run processing that depends on the model
    print("✅ Startup processing done.")


# ──────────────────────────────
# IN-MEMORY CACHE
# ──────────────────────────────
_analytics_cache: dict = {}
CACHE_TTL = 600  # 10 minutes — recompute after 10 min


# ──────────────────────────────
# REQUEST MODELS
# ──────────────────────────────
class AnalyticsRequest(BaseModel):
    team_id: str | None = None
    manager_id: str | None = None
    days: int | None = None  # no longer used — all rows are returned


@app.get("/")
def home():
    return {"status": "OK", "message": "Analytics backend running"}

# ──────────────────────────────
# MAIN ANALYTICS ENDPOINT
# ──────────────────────────────
@app.post("/run-analytics")
def run_analytics(body: AnalyticsRequest):
    # Validate input
    if not body.team_id and not body.manager_id:
        raise HTTPException(status_code=400, detail="Provide team_id or manager_id")
    if body.team_id and body.manager_id:
        raise HTTPException(status_code=400, detail="Provide only one: team_id OR manager_id")

    # Check cache — return immediately if still fresh
    cache_key = body.manager_id or body.team_id
    cached = _analytics_cache.get(cache_key)
    if cached and (time.time() - cached["ts"]) < CACHE_TTL:
        print(f"✅ Cache hit for {cache_key}")
        return cached["data"]

    # ------------------------------
    # MANAGER MODE
    # ------------------------------
    if body.manager_id:
        teams = (
            supabase.table("teams")
            .select("id")
            .eq("manager_id", body.manager_id)
            .execute()
            .data
        )
        if not teams:
            return run_full_analytics(pd.DataFrame([]))
        team_ids = [t["id"] for t in teams]
        rows = (
            supabase.table("emotion_logs")
            .select("*")
            .in_("team_id", team_ids)
            .execute()
            .data
        )
    # ------------------------------
    # TEAM MODE
    # ------------------------------
    else:
        rows = (
            supabase.table("emotion_logs")
            .select("*")
            .eq("team_id", body.team_id)
            .execute()
            .data
        )

    if not rows:
        return run_full_analytics(pd.DataFrame([]))

    # final_label, ml_probs, rule_label etc. are already stored in emotion_logs
    # by process_once() at startup — no need to re-run the ML pipeline here
    df = pd.DataFrame(rows)

    result = run_full_analytics(df)

    # Store in cache
    _analytics_cache[cache_key] = {"ts": time.time(), "data": result}

    return result