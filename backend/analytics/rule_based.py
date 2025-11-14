from collections import Counter


emotion_keywords = {
    'anger': [
        'angry','anger','furious','mad','irritated','annoyed','frustrated','hate','hated','rage','furious','resent','irate',
        'disapproval','disgusted','disgust','infuriated','hostile','offended','upset'
    ],
    'fear': [
        'fear','afraid','scared','terrified','anxious','nervous','worried','panic','panicked','alarmed','frightened',
        'apprehensive','hesitant','insecure','uncertain','trembling','shaken','nervousness'
    ],
    'joy': [
        'joy','joyful','happy','happiness','delighted','glad','pleased','excited','amused','wonderful','great','good',
        'cheerful','smiling','content','relieved','grateful','thankful','fun','awesome','nice','fantastic','amazing'
    ],
    'sadness': [
        'sad','sadness','depressed','depressing','unhappy','sorrow','mourn','cry','cried','tears','hopeless','down',
        'blue','lonely','devastated','disappointed','miserable','heartbroken','grief','grieving','upset'
    ],
    'surprise': [
        'surprise','surprised','shocked','astonished','amazed','startled','wow','unexpected','suddenly','unbelievable',
        'realized','realization','confused','confusion'
    ],
    'love': [
        'love','loved','loving','affection','affectionate','caring','care','fond','fondness','heart','hearts','romantic',
        'admire','admiration','adore','adorable','beautiful','kind','compassion','empathy','sentimental'
    ],
    'trust': [
        'trust','trusted','trusting','confidence','faith','faithful','secure','assured','loyal','depend','rely','believe',
        'belief','optimism','optimistic','hope','hopeful','approval','approved','reliable','confident'
    ]
}

positive_words = set([
    'good','great','awesome','fantastic','amazing','well','nice','love','happy','trust','secure','hope','grateful','wonderful'
])
negative_words = set([
    'bad','terrible','awful','hate','sad','angry','upset','frustrated','depressed','fear','worry','anxious','stressed','tired'
])

def rule_emotion_from_text_optimized(text):
    text = (text or "").lower()
    cnt = Counter()

    for emo, kwlist in emotion_keywords.items():
        for kw in kwlist:
            if kw in text:
                cnt[emo] += 1

    if sum(cnt.values()) == 0:
        words = text.split()
        pos = sum(1 for w in words if w in positive_words)
        neg = sum(1 for w in words if w in negative_words)

        if neg > pos and neg > 0:
            if any(w in text for w in ['angry','hate','mad','frustrat']):
                return {'rule_label':'anger','rule_confidence':0.65}
            elif any(w in text for w in ['fear','worry','scared','nervous','anxious']):
                return {'rule_label':'fear','rule_confidence':0.6}
            return {'rule_label':'sadness','rule_confidence':0.55}

        elif pos > neg:
            if any(w in text for w in ['love','care','trust','heart','hope','kind']):
                return {'rule_label':'love','rule_confidence':0.65}
            return {'rule_label':'joy','rule_confidence':0.6}

        return {'rule_label':'surprise','rule_confidence':0.4}

    label, count = cnt.most_common(1)[0]
    conf = min(0.55 + 0.12 * count, 0.98)
    return {'rule_label':label, 'rule_confidence':conf}
