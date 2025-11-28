import numpy as np

semantic_pairs = {
    'love':['trust','joy','caring'],
    'trust':['love','joy','optimism'],
    'joy':['surprise','love'],
    'sadness':['fear','anger'],
    'fear':['sadness','surprise'],
    'anger':['disgust','fear'],
    'surprise':['joy','fear']
}

def fusion_label_multilabel_enhanced(ml_probs_dict, rule_label, rule_conf, threshold=0.5):
    boosted = ml_probs_dict.copy()

    # fusion weighting (sadness gets special heavier rule influence)
    if rule_label == "sadness":
        boosted[rule_label] = 0.4 * boosted.get(rule_label,0) + 0.6 * rule_conf
    else:
        boosted[rule_label] = 0.7 * boosted.get(rule_label,0) + 0.3 * rule_conf

    # semantic similarity propagation
    for rel in semantic_pairs.get(rule_label,[]):
        boosted[rel] = min(boosted.get(rel,0) + 0.15 * rule_conf, 1.0)

    # normalize
    max_prob = max(boosted.values()) or 1e-6
    boosted = {k: min(v/max_prob,1.0) for k,v in boosted.items()}

    # threshold-based multilabel activation
    active = [k for k,v in boosted.items() if v >= threshold]

    if not active:
        final = max(boosted.items(), key=lambda x: x[1])[0]
        conf = boosted[final]
        return [final], conf, conf < 0.6

    avg_conf = np.mean([boosted[k] for k in active])
    return active, avg_conf, avg_conf < 0.6