# analytics/ml_model.py

import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import List, Tuple, Dict

# ----------------------------------------------------------
# Ensemble model paths and weights (macro F1 scores)
# ----------------------------------------------------------
ENSEMBLE_MODELS = {
    "deberta": (
        "models/deberta-v3-large-multilabel-emotions",
        0.749286
    ),
    "roberta_large": (
        "models/roberta-large-multilabel-emotions",
        0.749199
    ),
    "electra": (
        "models/electra-base-multilabel-emotions",
        0.730499
    ),
    "distilbert": (
        "models/distilbert-multilabel-emotions",
        0.719245
    ),
    "minilm": (
        "models/my_emotion_classifier_minilm",
        0.710000
    )
}

# Emotion labels (ordered)
LABEL_NAMES = ["anger", "fear", "joy", "sadness", "surprise", "love", "trust"]

# ----------------------------------------------------------
# Globals (models + tokenizers + device)
# ----------------------------------------------------------
_models: Dict[str, torch.nn.Module] = {}
_tokenizers: Dict[str, AutoTokenizer] = {}
_device = None


# ----------------------------------------------------------
# Load ensemble models
# ----------------------------------------------------------
def load_model(force: bool = False) -> None:
    """
    Load all ensemble models and tokenizers into memory.
    """
    global _models, _tokenizers, _device

    if _models and not force:
        return

    # Select device
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Loading ensemble models on device: {_device}")

    _models = {}
    _tokenizers = {}

    for name, (path, _) in ENSEMBLE_MODELS.items():
        print(f" → Loading {name} from {path}")

        tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True)
        model = AutoModelForSequenceClassification.from_pretrained(path, local_files_only=True)

        model.eval()
        try:
            model.to(_device)
        except Exception:
            print(f"GPU OOM — loading {name} on CPU instead")
            _device = torch.device("cpu")
            model.to(_device)

        _models[name] = model
        _tokenizers[name] = tokenizer

    print("All 5 ensemble models loaded.")


def _ensure_loaded():
    if not _models:
        load_model()


# ----------------------------------------------------------
# Ensemble prediction
# ----------------------------------------------------------
def predict_ml(
    texts: List[str],
    batch_size: int = 32
) -> Tuple[List[str], List[float], List[Dict[str, float]]]:
    """
    Run multilabel emotion prediction using a 5-model weighted ensemble.
    Returns:
        predicted_label: List[str]        → top predicted label per text
        confidences: List[float]          → confidence score for top label
        full_probs: List[Dict[str, float]]→ per-label probabilities
    """
    _ensure_loaded()
    global _models, _tokenizers, _device

    if len(texts) == 0:
        return [], [], []

    num_labels = len(LABEL_NAMES)

    # Storage for each model's probability outputs
    model_probs: Dict[str, List[np.ndarray]] = {name: [] for name in ENSEMBLE_MODELS}

    # ----------------------------------------------------------
    # Run inference model-by-model
    # ----------------------------------------------------------
    for name, (_, weight) in ENSEMBLE_MODELS.items():
        tokenizer = _tokenizers[name]
        model = _models[name]

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            enc = tokenizer(
                batch,
                truncation=True,
                padding=True,
                max_length=64,  # matches training
                return_tensors="pt"
            )

            enc = {k: v.to(_device) for k, v in enc.items()}

            with torch.no_grad():
                logits = model(**enc).logits
                probs = torch.sigmoid(logits).cpu().numpy()

            model_probs[name].append(probs)

        model_probs[name] = np.vstack(model_probs[name])

    # ----------------------------------------------------------
    # Weighted ensemble averaging
    # ----------------------------------------------------------
    total_weight = sum(weight for _, weight in ENSEMBLE_MODELS.values()) or 1.0

    ensemble_probs = np.zeros_like(next(iter(model_probs.values())))

    for name, (_, weight) in ENSEMBLE_MODELS.items():
        ensemble_probs += model_probs[name] * (weight / total_weight)

    # ----------------------------------------------------------
    # Final outputs (argmax label + probability dict)
    # ----------------------------------------------------------
    final_labels = []
    final_confs = []
    final_probs = []

    for probs in ensemble_probs:
        top_idx = int(np.argmax(probs))
        final_labels.append(LABEL_NAMES[top_idx])
        final_confs.append(float(probs[top_idx]))
        final_probs.append(
            {LABEL_NAMES[i]: float(probs[i]) for i in range(num_labels)}
        )

    return final_labels, final_confs, final_probs
