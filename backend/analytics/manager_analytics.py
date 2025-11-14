# manager_analytics.py
# --------------------------------------------------------
# FULL JSON-based analytics module for Team Insights
# --------------------------------------------------------

import pandas as pd
import numpy as np
from datetime import timedelta
from sklearn.feature_extraction.text import TfidfVectorizer
from scipy.stats import entropy
import math

# --------------------------------------------------------
# JSON Sanitizer (fixes NaN/Inf crash)
# --------------------------------------------------------

def clean_json(obj):
    """Recursively replace NaN/Inf with safe JSON values."""
    if isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_json(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0
    return obj

# --------------------------------------------------------
# Helpers
# --------------------------------------------------------

def safe_col(df, col, dtype=float, default=np.nan):
    if col in df.columns:
        return df[col].astype(dtype)
    return pd.Series([default] * len(df), index=df.index)

def ensure_date(df, col="timestamp"):
    # prefer 'timestamp' if present, else try 'created_at', else fallback
    use_col = None
    if "timestamp" in df.columns:
        use_col = "timestamp"
    elif "created_at" in df.columns:
        use_col = "created_at"

    if use_col:
        df[use_col] = pd.to_datetime(df[use_col], errors="coerce")
        df["date"] = df[use_col].dt.floor("D")
    else:
        df["date"] = pd.NaT
    return df


# --------------------------------------------------------
# 1) Emotion Distribution
# --------------------------------------------------------

def compute_emotion_distribution(df):
    if "final_label" not in df.columns:
        return {}
    vc = df["final_label"].value_counts(normalize=True)
    return vc.to_dict()

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

    return out.to_dict(orient="records")

# --------------------------------------------------------
# 3) TF-IDF Negative Trigger Terms
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
    except:
        return []

    scores = np.asarray(X.sum(axis=0)).ravel()
    terms = sorted(zip(vocab, scores), key=lambda x: x[1], reverse=True)
    return terms[:10]

# --------------------------------------------------------
# 4) Interaction Mode → Avg Mood
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
    cols = ["overall_mood", "stress", "workload", "productivity",
            "absorb_frequency", "transmit_frequency"]
    available = [c for c in cols if c in df.columns]

    if len(available) < 2:
        return {}

    corr = df[available].corr().fillna(0).round(3)
    return corr.to_dict()

# --------------------------------------------------------
# Research Metrics
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
                        "recovery_days": rec
                    })
    return records

def compute_ecp(df):
    tf = safe_col(df, "transmit_frequency").fillna(0)
    tv = safe_col(df, "transmit_valence", dtype=str).fillna("")

    def vf(s):
        s = str(s).lower()
        if "pos" in s: return 1.0
        if "neutral" in s or s.strip() == "": return 0.5
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
# FULL PIPELINE
# --------------------------------------------------------

def run_full_analytics(df):
    df = df.copy()
    df = ensure_date(df)

    # Basic metrics
    emotion_distribution = compute_emotion_distribution(df)
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
    erv_records = compute_erv(df)

    research_summary = {
        "ERI_mean": float(df["ERI"].mean(skipna=True)),
        "ETE_mean": float(df["ETE"].mean(skipna=True)),
        "TEDI_median": float(df["TEDI"].median(skipna=True)),
        "TSI_mean": float(df["TSI"].mean(skipna=True)),
        "ECP_mean": float(df["ECP"].mean(skipna=True)),
        "ERI2_mean": float(df["ERI2"].mean(skipna=True)),
        "ERV_count": len(erv_records),
    }

    # Final JSON (cleaned)
    return clean_json({
        "emotion_distribution": emotion_distribution,
        "contagion_events": contagion_events,
        "top_trigger_terms": top_trigger_terms,
        "interaction_mode_summary": interaction_summary,
        "correlation_matrix": corr_matrix,
        "research_summary": research_summary,

        "eri_series": df["ERI"].fillna(0).tolist(),
        "ete_series": df["ETE"].fillna(0).tolist(),
        "tedi_series": df["TEDI"].fillna(0).tolist(),
        "tsi_series": df["TSI"].fillna(0).tolist(),
        "ecp_series": df["ECP"].fillna(0).tolist(),
        "eri2_series": df["ERI2"].fillna(0).tolist(),

        "erv_records": erv_records
    })
