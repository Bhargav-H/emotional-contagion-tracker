# analytics/ml_model.py
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import numpy as np
import os
from typing import List, Tuple, Dict, Any

MODEL_PATH = os.getenv("MODEL_PATH", "models/distilbert-multilabel-emotions")
LABEL_NAMES = ['anger','fear','joy','sadness','surprise','love','trust']

# Globals
_tokenizer = None
_model = None
_device = None

def load_model(force: bool = False) -> None:
    """
    Load tokenizer and model into module-level globals.
    safe to call multiple times (idempotent).
    """
    global _tokenizer, _model, _device

    if _model is not None and _tokenizer is not None and not force:
        return

    print(f"Loading ML model from: {MODEL_PATH}")
    # load tokenizer & model (local files)
    _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
    _model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH, local_files_only=True)
    _model.eval()

    # prefer cuda if available; but keep CPU as fallback
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    try:
        _model.to(_device)
    except Exception:
        # silently ignore device placement issues (will run on cpu)
        _device = torch.device("cpu")
        _model.to(_device)

    print(f"Model loaded on device: {_device}")

def _ensure_loaded():
    if _model is None or _tokenizer is None:
        load_model()

def predict_ml(texts: List[str], batch_size: int = 32) -> Tuple[List[str], List[float], List[Dict[str, float]]]:
    """
    Batch predict. Returns (labels, confidences, probs-dicts).
    Will call load_model() if model not loaded yet.
    """
    _ensure_loaded()
    global _tokenizer, _model, _device

    if len(texts) == 0:
        return [], [], []

    ml_labels, ml_confs, ml_probs = [], [], []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        enc = _tokenizer(batch, truncation=True, padding=True, max_length=128, return_tensors="pt")
        enc = {k: v.to(_device) for k, v in enc.items()}

        with torch.no_grad():
            logits = _model(**enc).logits

        probs = torch.sigmoid(logits).cpu().numpy()
        for p in probs:
            ml_labels.append(LABEL_NAMES[int(np.argmax(p))])
            ml_confs.append(float(np.max(p)))
            ml_probs.append(dict(zip(LABEL_NAMES, map(float, p))))

    return ml_labels, ml_confs, ml_probs
