import numpy as np

semantic_pairs = {
    'love':     ['trust', 'joy', 'caring'],
    'trust':    ['love', 'joy', 'optimism'],
    'joy':      ['surprise', 'love'],
    'sadness':  ['fear', 'anger'],
    'fear':     ['sadness', 'surprise'],
    'anger':    ['disgust', 'fear'],
    'surprise': ['joy', 'fear']
}

def fusion_label_multilabel_enhanced(ml_probs_dict, rule_label, rule_conf, threshold=0.5):
    """
    Pure, unbiased fusion:
    - rule influences ml by fixed 30%
    - semantic pairs get small boost
    - no sadness/love bias
    - no override rules
    """
    boosted = ml_probs_dict.copy()

    # -----------------------------
    # Regular fusion (no biases)
    # -----------------------------
    if rule_label is not None:
        # ML has 70% say, rule has 30% say
        boosted[rule_label] = 0.7 * boosted.get(rule_label, 0.0) + 0.3 * rule_conf

        # semantic propagation (light)
        for rel in semantic_pairs.get(rule_label, []):
            boosted[rel] = min(boosted.get(rel, 0.0) + 0.10 * rule_conf, 1.0)

    # -----------------------------
    # Normalize
    # -----------------------------
    max_prob = max(boosted.values()) if boosted else 1e-6
    boosted = {k: v / max_prob for k, v in boosted.items()}

    # -----------------------------
    # Multilabel activation
    # -----------------------------
    active = [k for k, v in boosted.items() if v >= threshold]

    # If none active, fallback on max
    if not active:
        final = max(boosted.items(), key=lambda x: x[1])[0]
        conf = boosted[final]
        return [final], conf, conf < 0.6

    avg_conf = float(np.mean([boosted[k] for k in active]))
    return active, avg_conf, avg_conf < 0.6
