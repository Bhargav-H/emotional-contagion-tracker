
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
from fastapi import FastAPI, HTTPException
from datetime import datetime, timedelta
# ──────────────────────────────
# IMPORTS (MODEL LOADED HERE FIRST)
# ──────────────────────────────
from supabase_client import supabase
from analytics.rule_based import rule_emotion_from_text_optimized
from analytics.fusion import fusion_label_multilabel_enhanced
from analytics.ml_model import predict_ml, load_model  # <-- ensure model loads first
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
from analytics.ml_model import load_model  # new import
@app.on_event("startup")
def on_startup():
    print("⚡ Startup: loading ML model...")
    load_model()               # load model first
    print("⚡ ML model ready — now processing unprocessed rows (once).")
    process_once()            # then run processing that depends on the model
    print("✅ Startup processing done.")


# ──────────────────────────────
# REQUEST MODELS
# ──────────────────────────────
class AnalyticsRequest(BaseModel):
    team_id: str | None = None
    manager_id: str | None = None
    days: int = 30
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
    # Compute date window
    start_date = (datetime.utcnow() - timedelta(days=body.days)).isoformat()
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
    # Convert to DataFrame
    df = pd.DataFrame(rows)
    if "key_event" not in df.columns:
        df["key_event"] = ""
    # ML predictions
    texts = df["key_event"].astype(str).tolist()
    ml_labels, ml_confs, ml_probs = predict_ml(texts)
    df["ml_label"] = ml_labels
    df["ml_confidence"] = ml_confs
    df["ml_probs"] = ml_probs
    # Rule
    rule_outs = df["key_event"].apply(rule_emotion_from_text_optimized)
    df["rule_label"] = rule_outs.apply(lambda x: x["rule_label"])
    df["rule_confidence"] = rule_outs.apply(lambda x: x["rule_confidence"])
    # Fusion
    fusion_out = df.apply(
        lambda row: fusion_label_multilabel_enhanced(
            row["ml_probs"], row["rule_label"], row["rule_confidence"]
        ),
        axis=1,
    )
    df["final_label"] = fusion_out.apply(
        lambda x: x[0][0] if isinstance(x[0], list) else x[0]
    )
    df["final_confidence"] = fusion_out.apply(lambda x: float(x[1]))
    df["final_low_confidence"] = fusion_out.apply(lambda x: bool(x[2]))
    # Analytics engine (unchanged)
    return run_full_analytics(df)
