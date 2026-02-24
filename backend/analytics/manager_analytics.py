# manager_analytics.py
# --------------------------------------------------------
# FULL JSON-based analytics module for Team Insights (final)
# --------------------------------------------------------

import re
import pandas as pd
import numpy as np
from datetime import timedelta
from sklearn.feature_extraction.text import TfidfVectorizer
from scipy.stats import entropy
import math

# --------------------------------------------------------
# JSON Sanitizer (robust)
# --------------------------------------------------------

def clean_json(obj):
    """Recursively sanitise any object into JSON-safe Python types."""
    # numpy scalar -> python scalar
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)

    # pandas NA
    if obj is pd.NA:
        return None

    # dict
    if isinstance(obj, dict):
        return {str(k): clean_json(v) for k, v in obj.items()}

    # list / tuple / set
    if isinstance(obj, (list, tuple, set)):
        return [clean_json(v) for v in obj]

    # pandas Series/DataFrame -> convert to list/dict
    if isinstance(obj, pd.Series):
        return clean_json(obj.tolist())
    if isinstance(obj, pd.DataFrame):
        return clean_json(obj.to_dict(orient="records"))

    # float (python)
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj

    # int, str, bool, None
    return obj

# --------------------------------------------------------
# Helpers
# --------------------------------------------------------

def safe_col(df, col, dtype=float, default=np.nan):
    if col in df.columns:
        # For dtype=str we avoid astype(float) errors; caller may pass dtype=str
        if dtype == str:
            return df[col].astype(str)
        try:
            return df[col].astype(dtype)
        except Exception:
            # fallback: return raw series (object) and let callers coerce
            return df[col]
    return pd.Series([default] * len(df), index=df.index)

def ensure_date(df, col="timestamp"):
    if "timestamp" in df.columns:
        use_col = "timestamp"
    elif "created_at" in df.columns:
        use_col = "created_at"
    else:
        df["date"] = pd.NaT
        return df

    df[use_col] = pd.to_datetime(df[use_col], errors="coerce")
    df["date"] = df[use_col].dt.floor("D")
    return df

def _to_numeric(series):
    return pd.to_numeric(series, errors="coerce")

# --------------------------------------------------------
# Time parsing utilities (convert human ranges to minutes)
# --------------------------------------------------------

def parse_time_spent(val):
    if val is None:
        return np.nan
    s = str(val).strip().lower()
    if s == "" or s in {"nan", "none", "n/a", "na"}:
        return np.nan

    s = s.replace(",", "").strip()

    # 1) range with units
    m = re.search(r'(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*(hours|hour|hrs|hr|h|minutes|mins|min|m)?', s)
    if m:
        a = float(m.group(1))
        b = float(m.group(2))
        unit = (m.group(3) or "").lower()
        midpoint = (a + b) / 2.0
        if unit.startswith("h") or (unit == "" and midpoint >= 1):
            return midpoint * 60.0
        else:
            return midpoint

    # single value with hours
    m = re.search(r'(\d+(?:\.\d+)?)\s*(hours|hour|hrs|hr|h)\b', s)
    if m:
        return float(m.group(1)) * 60.0

    # single value with minutes
    m = re.search(r'(\d+(?:\.\d+)?)\s*(minutes|mins|min|m)\b', s)
    if m:
        return float(m.group(1))

    # less than / under / < ...
    m = re.search(r'(?:less than|under|<)\s*(\d+(?:\.\d+)?)\s*(hours|hour|hrs|hr|h|minutes|mins|min|m)?', s)
    if m:
        bound = float(m.group(1))
        unit = (m.group(2) or "").lower()
        if unit.startswith("h") or (unit == "" and bound >= 1):
            return (bound / 2.0) * 60.0
        else:
            return bound / 2.0

    # more than / over / >
    m = re.search(r'(?:more than|over|>|>=)\s*(\d+(?:\.\d+)?)\s*(hours|hour|hrs|hr|h|minutes|mins|min|m)?', s)
    if m:
        bound = float(m.group(1))
        unit = (m.group(2) or "").lower()
        if unit.startswith("h") or (unit == "" and bound >= 1):
            return (bound * 1.25) * 60.0
        else:
            return bound * 1.25

    # pure number
    m = re.fullmatch(r'(\d+(?:\.\d+)?)', s)
    if m:
        v = float(m.group(1))
        if v >= 1:
            return v * 60.0
        return v

    # fallback: look for number and presence of 'hour'
    m = re.search(r'(\d+(?:\.\d+)?)', s)
    if m:
        v = float(m.group(1))
        if 'hour' in s or 'hr' in s or 'h ' in s:
            return v * 60.0
        if v > 6:
            return v
        return v * 60.0

    return np.nan

def time_series_to_minutes(series):
    return series.apply(parse_time_spent)

# --------------------------------------------------------
# 1) Emotion Distribution
# --------------------------------------------------------

def compute_emotion_distribution(df):
    if "final_label" not in df.columns:
        return {}
    vc = df["final_label"].value_counts(normalize=True)
    return {str(k): float(v) for k, v in vc.to_dict().items()}

# --------------------------------------------------------
# 1B) Soft ML probability-based Emotion Distribution (new)
# --------------------------------------------------------

def compute_emotion_distribution_soft(df):
    """
    Returns a full 7-way emotion distribution by summing ml_probs.
    Ensures love and sadness appear even if final_label does not.
    """
    if "ml_probs" not in df.columns:
        # fallback to final_label distribution
        return compute_emotion_distribution(df)

    emotions = ["anger", "fear", "joy", "sadness", "surprise", "love", "trust"]
    totals = {e: 0.0 for e in emotions}

    for _, row in df.iterrows():
        probs = row.get("ml_probs", None)
        # handle if ml_probs stored as string (JSON) by attempting to parse
        if isinstance(probs, str):
            try:
                import json
                probs_parsed = json.loads(probs)
                probs = probs_parsed if isinstance(probs_parsed, dict) else None
            except Exception:
                probs = None
        if isinstance(probs, dict):
            for e, p in probs.items():
                if e in totals:
                    try:
                        totals[e] += float(p)
                    except Exception:
                        continue

    total_sum = sum(totals.values()) or 1.0
    return {e: totals[e] / total_sum for e in emotions}

# --------------------------------------------------------
# 2) Contagion Events
# --------------------------------------------------------

def compute_contagion_events(df, contagion_threshold=0.50, contagion_delta=0.20):
    if "final_label" not in df.columns or "class" not in df.columns:
        return []

    df = df.copy()
    df = ensure_date(df)

    neg_set = {"anger", "fear", "sadness"}

    grp = df.groupby(["class", "date"]).agg(
        neg_share=("final_label", lambda s: s.isin(neg_set).mean()),
        n=("final_label", "size")
    ).reset_index().sort_values(["class", "date"])

    grp["neg_prev"] = grp.groupby("class")["neg_share"].shift(1)
    grp["delta_neg"] = grp["neg_share"] - grp["neg_prev"]

    grp["contagion_event"] = (
        (grp["neg_share"] >= contagion_threshold) &
        (grp["delta_neg"] >= contagion_delta)
    )

    flagged = grp[grp["contagion_event"]]
    out = flagged[["class", "date", "n", "neg_share", "delta_neg"]].copy()
    out["date"] = out["date"].astype(str)
    recs = []
    for _, r in out.iterrows():
        recs.append({
            "class": r["class"],
            "date": str(r["date"]),
            "n": int(r["n"]),
            "neg_share": float(r["neg_share"]),
            "delta_neg": float(r["delta_neg"])
        })
    return recs

# --------------------------------------------------------
# 3) TF-IDF Trigger Terms
# --------------------------------------------------------

def compute_top_trigger_terms(df):
    neg_texts = df[df["final_label"].isin(["anger", "fear", "sadness"])]
    texts = neg_texts["key_event"].fillna("").astype(str)
    texts = texts[texts.str.strip() != ""]

    if texts.empty:
        return []

    try:
        tf = TfidfVectorizer(stop_words="english", max_features=30)
        X = tf.fit_transform(texts)
        vocab = tf.get_feature_names_out()
        if len(vocab) == 0:
            return []
    except Exception:
        return []

    scores = np.asarray(X.sum(axis=0)).ravel()
    terms = sorted(zip(vocab, scores), key=lambda x: x[1], reverse=True)
    return [{"term": t, "score": float(s)} for t, s in terms[:10]]

# --------------------------------------------------------
# 4) Interaction Mode Summary
# --------------------------------------------------------

def compute_interaction_mode_summary(df):
    if "team_interaction_mode" not in df.columns or "overall_mood" not in df.columns:
        return []

    group = df.groupby("team_interaction_mode").agg(
        avg_mood=("overall_mood", "mean"),
        count=("overall_mood", "size")
    ).reset_index()

    return group.to_dict(orient="records")

# --------------------------------------------------------
# 5) Wellbeing Correlation Matrix
# --------------------------------------------------------

def compute_correlation_matrix(df):
    cols = [
        "overall_mood", "stress", "workload", "productivity",
        "absorb_frequency", "transmit_frequency"
    ]
    available = [c for c in cols if c in df.columns]

    if len(available) < 2:
        return {}

    corr = df[available].corr().fillna(0).round(3)
    return corr.to_dict()

# --------------------------------------------------------
# Research Metrics (existing)
# --------------------------------------------------------

def compute_eri(df):
    mood = safe_col(df, "overall_mood")
    stress = safe_col(df, "stress")
    workload = safe_col(df, "workload")
    denom = ((stress + workload) / 2).replace(0, np.nan)
    return (mood / denom).replace([np.inf, -np.inf], np.nan)

def compute_ete(df):
    trans = safe_col(df, "transmit_frequency").astype(float)
    absorb = safe_col(df, "absorb_frequency").astype(float).replace(0, np.nan)
    return (trans / absorb).replace([np.inf, -np.inf], np.nan).fillna(0)

def compute_tedi(df):
    if "class" not in df.columns:
        return pd.Series([np.nan] * len(df), index=df.index)

    out = []
    for g, sub in df.groupby("class"):
        mood = safe_col(sub, "overall_mood").dropna()
        if mood.empty:
            entropy_val = np.nan
        else:
            counts, _ = np.histogram(mood, bins=np.arange(1, 7))
            entropy_val = entropy(counts + 1e-9)
        out.extend([entropy_val] * len(sub))

    return pd.Series(out, index=df.index)

def compute_tsi(df):
    m = safe_col(df, "overall_mood")
    tm = safe_col(df, "perceived_team_mood")
    return (m - tm).abs()

def compute_erv(df, window_days=7):
    if "timestamp" not in df.columns or "overall_mood" not in df.columns:
        return []

    df = df[["timestamp", "class", "overall_mood"]].dropna().copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.sort_values("timestamp")

    records = []
    for g, sub in df.groupby("class"):
        baseline = sub["overall_mood"].median()
        if np.isnan(baseline):
            continue

        for _, row in sub.iterrows():
            if row["overall_mood"] < baseline:
                start = row["timestamp"]
                end = start + timedelta(days=window_days)

                future = sub[(sub["timestamp"] > start) & (sub["timestamp"] <= end)]
                recovered = future[future["overall_mood"] >= baseline]

                if not recovered.empty:
                    rec = (recovered.iloc[0]["timestamp"] - start).total_seconds() / 86400.0
                    records.append({
                        "class": g,
                        "start": str(start),
                        "recovery_days": float(rec)
                    })
    return records

def compute_ecp(df):
    tf = safe_col(df, "transmit_frequency").fillna(0)
    tv = safe_col(df, "transmit_valence", dtype=str).fillna("")

    def vf(s):
        s = str(s).lower()
        if "pos" in s:
            return 1.0
        if "neutral" in s or s.strip() == "":
            return 0.5
        return -0.5

    val_factors = tv.apply(vf)

    mode = safe_col(df, "team_interaction_mode", dtype=str).fillna("")
    w = mode.apply(lambda s: 1.2 if "offline" in s.lower()
                   else (1.1 if "both" in s.lower() else 1.0))

    return tf * val_factors * w

def compute_eri2(df, scale=5.0):
    a = safe_col(df, "absorb_frequency").fillna(0)
    t = safe_col(df, "transmit_frequency").fillna(0)
    return (1 - (abs(a - t) / scale)).clip(lower=0)

# --------------------------------------------------------
# NEW METRIC 1: ACS — Absorption Contagion Susceptibility (fixed mapping)
# --------------------------------------------------------

def compute_acs(df):
    freq = safe_col(df, "absorb_frequency").fillna(0)
    val = safe_col(df, "absorb_valence", dtype=str).fillna("")

    def vf(s):
        s = str(s).lower()
        # positive
        if "pos" in s or "positive" in s:
            return 1.0
        # mixed -> treat as neutral-ish
        if "mix" in s or "mixed" in s:
            return 0.5
        # neutral explicit
        if "neutral" in s or s.strip() == "":
            return 0.5
        # negative explicit
        if "neg" in s or "negative" in s:
            return -1.0
        # fallback: neutral
        return 0.5

    factors = val.apply(vf)
    acs = freq * factors
    acs.name = "ACS"
    return acs

# --------------------------------------------------------
# NEW METRIC 2: Time Summary (global & per-team) using parser — MINIMAL
# --------------------------------------------------------

def compute_time_summary(df):
    col = "time_spent_with_team_today"
    if col not in df.columns:
        return {}

    t_minutes = time_series_to_minutes(df[col].astype(str))
    total = int(len(t_minutes))
    present = int(t_minutes.dropna().shape[0])
    if present == 0:
        return {
            "count": total,
            "mean_hours": None,
            "median_hours": None,
            "p25_hours": None,
            "p75_hours": None
        }

    mean_hours = float(t_minutes.mean(skipna=True) / 60.0)
    median_hours = float(t_minutes.median(skipna=True) / 60.0)
    p25_hours = float(t_minutes.quantile(0.25) / 60.0)
    p75_hours = float(t_minutes.quantile(0.75) / 60.0)

    return {
        "count": total,
        "mean_hours": mean_hours,
        "median_hours": median_hours,
        "p25_hours": p25_hours,
        "p75_hours": p75_hours
    }

def compute_time_summary_by_team(df):
    col = "time_spent_with_team_today"
    group_col = "class"
    if col not in df.columns or group_col not in df.columns:
        return {}

    out = {}
    for g, sub in df.groupby(group_col):
        t = time_series_to_minutes(sub[col].astype(str)).dropna()
        if t.empty:
            out[str(g)] = {"count": 0, "mean_hours": None, "median_hours": None}
        else:
            out[str(g)] = {
                "count": int(len(t)),
                "mean_hours": float(t.mean() / 60.0),
                "median_hours": float(t.median() / 60.0)
            }
    return out

# --------------------------------------------------------
# NEW METRIC 3: Time -> Mood/Wellbeing Correlations (percent integers)
# --------------------------------------------------------

def compute_time_correlations(df):
    col = "time_spent_with_team_today"
    if col not in df.columns:
        return {}

    t_minutes = time_series_to_minutes(df[col].astype(str))
    metrics = ["overall_mood", "stress", "productivity", "perceived_team_mood"]
    out = {}
    for m in metrics:
        if m in df.columns:
            s = _to_numeric(df[m])
            pair = pd.concat([t_minutes, s], axis=1).dropna()
            if len(pair) < 3:
                out[m] = None
            else:
                corr = pair.corr().iloc[0,1]
                if pd.isna(corr):
                    out[m] = None
                else:
                    # convert to whole-percent (e.g., 0.301 -> 30)
                    out[m] = int(round(float(corr) * 100.0))
        else:
            out[m] = None
    return out

# --------------------------------------------------------
# Build manager-friendly insights from correlations
# --------------------------------------------------------

def make_time_insights(corr_dict):
    # corr_dict values are percent ints or None
    insights = []
    mapping = {
        "overall_mood": "Mood",
        "stress": "Stress",
        "productivity": "Productivity",
        "perceived_team_mood": "Perceived team mood"
    }
    for k, v in (corr_dict or {}).items():
        if v is None:
            continue
        sign = "+" if v > 0 else ""
        # keep whole-number percentage text
        insights.append(f"{mapping.get(k, k)} {sign}{v}% (correlation with time spent)")
    return insights

# --------------------------------------------------------
# FULL PIPELINE
# --------------------------------------------------------

def run_full_analytics(df):
    df = df.copy()
    df = ensure_date(df)

    # Basic metrics
    # use soft ML-prob distribution so all 7 emotions are visible in analytics
    emotion_distribution = compute_emotion_distribution_soft(df)
    contagion_events = compute_contagion_events(df)
    top_trigger_terms = compute_top_trigger_terms(df)
    interaction_summary = compute_interaction_mode_summary(df)
    corr_matrix = compute_correlation_matrix(df)

    # Research metrics
    df["ERI"] = compute_eri(df)
    df["ETE"] = compute_ete(df)
    df["TEDI"] = compute_tedi(df)
    df["TSI"] = compute_tsi(df)
    df["ECP"] = compute_ecp(df)
    df["ERI2"] = compute_eri2(df)
    df["ACS"] = compute_acs(df)

    erv_records = compute_erv(df)

    # NEW TIME METRICS
    time_summary = compute_time_summary(df)
    time_summary_by_team = compute_time_summary_by_team(df)
    time_correlations = compute_time_correlations(df)
    time_insights = make_time_insights(time_correlations)

    # research_summary — do NOT include time_summary/time_correlations here (per request)
    research_summary = {
        "ERI_mean": float(df["ERI"].mean(skipna=True)) if "ERI" in df.columns else None,
        "ETE_mean": float(df["ETE"].mean(skipna=True)) if "ETE" in df.columns else None,
        "TEDI_median": float(df["TEDI"].median(skipna=True)) if "TEDI" in df.columns else None,
        "TSI_mean": float(df["TSI"].mean(skipna=True)) if "TSI" in df.columns else None,
        "ECP_mean": float(df["ECP"].mean(skipna=True)) if "ECP" in df.columns else None,
        "ERI2_mean": float(df["ERI2"].mean(skipna=True)) if "ERI2" in df.columns else None,
        "ACS_mean": float(df["ACS"].mean(skipna=True)) if "ACS" in df.columns else None,
        "ERV_count": len(erv_records),
    }

    # Final JSON payload
    payload = {
        "emotion_distribution": emotion_distribution,
        "contagion_events": contagion_events,
        "top_trigger_terms": top_trigger_terms,
        "interaction_mode_summary": interaction_summary,
        "correlation_matrix": corr_matrix,
        "research_summary": research_summary,

        "eri_series": df["ERI"].fillna(0).tolist() if "ERI" in df.columns else [],
        "ete_series": df["ETE"].fillna(0).tolist() if "ETE" in df.columns else [],
        "tedi_series": df["TEDI"].fillna(0).tolist() if "TEDI" in df.columns else [],
        "tsi_series": df["TSI"].fillna(0).tolist() if "TSI" in df.columns else [],
        "ecp_series": df["ECP"].fillna(0).tolist() if "ECP" in df.columns else [],
        "eri2_series": df["ERI2"].fillna(0).tolist() if "ERI2" in df.columns else [],
        "acs_series": df["ACS"].fillna(0).tolist() if "ACS" in df.columns else [],

        # Time outputs (minimal)
        "time_summary": time_summary,
        "time_summary_by_team": time_summary_by_team,
        "time_correlations": time_correlations,   # percent ints (whole numbers) or None
        "time_insights": time_insights,          # manager-friendly sentences

        "erv_records": erv_records
    }

    return clean_json(payload)
