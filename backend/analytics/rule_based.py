from collections import Counter

emotion_keywords = {
    'anger': [
        'angry','anger','furious','mad','irritated','annoyed','frustrated','hate','hated','rage','resent','irate',
        'disapproval','disgusted','disgust','infuriated','hostile','offended','upset',
        'pissed','irritating','annoying','enraged','mad at'
    ],
    'fear': [
        'fear','afraid','scared','terrified','anxious','nervous','worried','panic','panicked','alarmed','frightened',
        'apprehensive','hesitant','insecure','uncertain','trembling','shaken','nervousness',
        'concerned','uneasy','paranoid','worried about','afraid of'
    ],
    'joy': [
        'joy','joyful','happy','happiness','delighted','glad','pleased','excited','amused','wonderful','great','good',
        'cheerful','smiling','content','relieved','grateful','thankful','fun','awesome','nice','fantastic','amazing'
    ],
    'sadness': [
        'sad','sadness','depressed','depressing','unhappy','sorrow','mourn','cry','cried','tears','hopeless','down',
        'blue','lonely','devastated','disappointed','miserable','heartbroken','grief','grieving','upset',
        'hurt','empty','lost','drained','exhausted','low','crying',
        'burned out','broken','mentally tired','dejected','alone'
    ],
    'surprise': [
        'surprise','surprised','shocked','astonished','amazed','startled','wow','unexpected','suddenly','unbelievable',
        'realized','realization','confused','confusion'
    ],
    'love': [
        'love','loved','loving','affection','affectionate','caring','care','fond','fondness','heart','hearts','romantic',
        'admire','admiration','adore','adorable','beautiful','kind','compassion','empathy','sentimental',
        # additions
        'dear','cherish','meaningful','deep connection','close bond','loved ones'
    ],
    'trust': [
        'trust','trusted','trusting','confidence','faith','faithful','secure','assured','loyal','depend','rely','believe',
        'belief','optimism','optimistic','hope','hopeful','approval','approved','reliable','confident',
        'loyalty','faith in','dependable','trusted you','count on you','count on him','count on her',
        'safe with','secure with'
    ]
}

positive_words = set([
    'awesome','fantastic','amazing','love','happy','trust','secure','hope','grateful','wonderful','joy','joyful','excited'
])

negative_words = set([
    'bad','terrible','awful','hate','sad','angry','upset','frustrated','depressed','fear','worry','anxious','stressed','tired'
])

def rule_emotion_from_text_optimized(text):
    text = (text or "").lower()
    cnt = Counter()

    # -------------------------------------
    # Keyword-based detection
    # -------------------------------------
    for emo, kwlist in emotion_keywords.items():
        for kw in kwlist:
            if kw in text:
                cnt[emo] += 1

    # -------------------------------------
    # No keyword hits → fallback to valence
    # -------------------------------------
    if sum(cnt.values()) == 0:
        words = text.split()
        pos = sum(1 for w in words if w in positive_words)
        neg = sum(1 for w in words if w in negative_words)

        if neg > pos:
            return {'rule_label': 'sadness', 'rule_confidence': 0.55}
        elif pos > neg:
            return {'rule_label': 'joy', 'rule_confidence': 0.55}
        else:
            return {'rule_label': 'surprise', 'rule_confidence': 0.40}

    # -------------------------------------
    # Pick the dominant keyword emotion
    # -------------------------------------
    label, count = cnt.most_common(1)[0]

    # optional semantic heuristic: joy vs trust
    if label == "joy":
        if any(w in text for w in ['trust','trusted','faith','faith in','rely','depend','secure','confident','loyal','safe with']):
            label = 'trust'

    # -------------------------------------
    # Base confidence proportional to count
    # -------------------------------------
    conf = min(0.40 + 0.15 * count, 0.95)  # small, fair, consistent

    return {'rule_label': label, 'rule_confidence': conf}