# backend/process_emotions.py

import pandas as pd
from supabase_client import supabase
from analytics.ml_model import load_model, predict_ml
from analytics.rule_based import rule_emotion_from_text_optimized
from analytics.fusion import fusion_label_multilabel_enhanced


def process_once(batch_size: int = 200):
    """
    Runs ML + Rule + Fusion only on rows where final_label is NULL.
    Safe version — uses UPDATE (not UPSERT) to avoid NULL overwrites.
    """

    print("🔍 Checking for unprocessed emotion_logs rows...")

    # Fetch only rows missing final_label
    result = (
        supabase.table("emotion_logs")
        .select("*")
        .is_("final_label", None)
        .execute()
    )

    rows = result.data

    if not rows:
        print("✅ No unprocessed rows found. Nothing to do.")
        return

    print(f"⚡ Found {len(rows)} unprocessed rows. Beginning batch processing...")

    df = pd.DataFrame(rows)

    # Ensure column exists
    if "key_event" not in df.columns:
        df["key_event"] = ""

    # Load ML model once
    load_model()

    # ------------------------------
    # ML PREDICTION (BATCHED)
    # ------------------------------
    texts = df["key_event"].astype(str).tolist()
    ml_labels, ml_confs, ml_probs = predict_ml(texts)

    df["ml_label"] = ml_labels
    df["ml_confidence"] = ml_confs
    df["ml_probs"] = ml_probs

    # ------------------------------
    # RULE-BASED
    # ------------------------------
    rb_series = df["key_event"].apply(rule_emotion_from_text_optimized)
    df["rule_label"] = rb_series.apply(lambda x: x["rule_label"])
    df["rule_confidence"] = rb_series.apply(lambda x: x["rule_confidence"])

    # ------------------------------
    # FUSION
    # ------------------------------
    fusion_out = df.apply(
        lambda row: fusion_label_multilabel_enhanced(
            row["ml_probs"],
            row["rule_label"],
            row["rule_confidence"]
        ),
        axis=1,
    )

    df["final_label"] = fusion_out.apply(
        lambda x: x[0][0] if isinstance(x[0], list) else x[0]
    )
    df["final_confidence"] = fusion_out.apply(lambda x: float(x[1]))
    df["final_low_confidence"] = fusion_out.apply(lambda x: bool(x[2]))

    # Alias class col
    df["class"] = df["final_label"]

    # ------------------------------
    # SAFE WRITE BACK (UPDATE ONLY)
    # ------------------------------
    print("📝 Writing updates to Supabase (safe update mode)…")

    updated_count = 0
    for _, r in df.iterrows():

        update_payload = {
            "ml_label": r["ml_label"],
            "ml_confidence": r["ml_confidence"],
            "ml_probs": r["ml_probs"],
            "rule_label": r["rule_label"],
            "rule_confidence": r["rule_confidence"],
            "final_label": r["final_label"],
            "final_confidence": r["final_confidence"],
            "final_low_confidence": r["final_low_confidence"],
            "class": r["final_label"]
        }

        # UPDATE only this row — SAFE, won't null other fields
        supabase.table("emotion_logs").update(update_payload).eq("id", r["id"]).execute()
        updated_count += 1

        if updated_count % batch_size == 0:
            print(f"🔄 Processed {updated_count} rows...")

    print(f"✅ Finished processing all {updated_count} rows safely.")
