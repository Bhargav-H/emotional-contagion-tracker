from collections import Counter

emotion_keywords = {
    'anger': [
        'angry','anger','furious','mad','irritated','annoyed','frustrated','hate','hated','rage','furious','resent','irate',
        'disapproval','disgusted','disgust','infuriated','hostile','offended','upset',
        # extra anger cues
        'pissed','irritating','annoying','enraged','mad at'
    ],
    'fear': [
        'fear','afraid','scared','terrified','anxious','nervous','worried','panic','panicked','alarmed','frightened',
        'apprehensive','hesitant','insecure','uncertain','trembling','shaken','nervousness',
        # extra fear cues
        'concerned','uneasy','paranoid','worried about','afraid of'
    ],
    'joy': [
        'joy','joyful','happy','happiness','delighted','glad','pleased','excited','amused','wonderful','great','good',
        'cheerful','smiling','content','relieved','grateful','thankful','fun','awesome','nice','fantastic','amazing'
    ],
    'sadness': [
        'sad','sadness','depressed','depressing','unhappy','sorrow','mourn','cry','cried','tears','hopeless','down',
        'blue','lonely','devastated','disappointed','miserable','heartbroken','grief','grieving','upset',
        # added contextual sadness indicators
        'hurt','empty','lost','drained','exhausted','low','crying',
        'burned out','broken','mentally tired','dejected','alone'
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
        'belief','optimism','optimistic','hope','hopeful','approval','approved','reliable','confident',
        # extra trust cues
        'loyalty','faith in','dependable','trusted you','count on you','count on him','count on her',
        'safe with','secure with'
    ]
}

# tightened positive lexicon
positive_words = set([
    'awesome','fantastic','amazing','love','happy','trust','secure','hope','grateful','wonderful','joy','joyful','excited'
])

negative_words = set([
    'bad','terrible','awful','hate','sad','angry','upset','frustrated','depressed','fear','worry','anxious','stressed','tired'
])


def rule_emotion_from_text_optimized(text):
    text = (text or "").lower()
    cnt = Counter()

    # keyword-based detection
    for emo, kwlist in emotion_keywords.items():
        for kw in kwlist:
            if kw in text:
                cnt[emo] += 1

    # fallback polarity-based rule
    if sum(cnt.values()) == 0:
        words = text.split()
        pos = sum(1 for w in words if w in positive_words)
        neg = sum(1 for w in words if w in negative_words)

        if neg > pos and neg > 0:

            # structured negative → anger / fear first
            if any(w in text for w in ['angry','hate','mad','pissed','furious','annoyed','irritated']):
                return {'rule_label':'anger','rule_confidence':0.65}

            if any(w in text for w in ['fear','worry','worried','scared','nervous','anxious','afraid','concerned']):
                return {'rule_label':'fear','rule_confidence':0.60}

            # otherwise sadness
            return {'rule_label':'sadness','rule_confidence':0.70}

        elif pos > neg and pos > 0:

            # Positive but emotion-specific first
            if any(w in text for w in ['love','caring','care','heart','hearts','romantic']):
                return {'rule_label':'love','rule_confidence':0.65}

            if any(w in text for w in ['trust','trusted','secure','safe','rely','depend','confident','loyal']):
                return {'rule_label':'trust','rule_confidence':0.60}

            if any(w in text for w in ['happy','joy','joyful','excited','glad','delighted']):
                return {'rule_label':'joy','rule_confidence':0.60}

            # Otherwise generic positivity → joy (weak)
            return {'rule_label':'joy','rule_confidence':0.50}

        # unclear → treat as neutral surprise
        return {'rule_label':'surprise','rule_confidence':0.40}

    # keyword hits found → pick the strongest match
    label, count = cnt.most_common(1)[0]

    # post-correction to fix joy misfiring instead of trust
    if label == 'joy':
        if any(w in text for w in [
            'trust','trusted','faith','faith in','rely','depend','secure','confident','loyal','safe with'
        ]):
            label = 'trust'

    # confidence computation
    if label == "sadness":
        conf = min(0.70 + 0.15 * count, 0.98)
    else:
        conf = min(0.55 + 0.12 * count, 0.98)

    return {'rule_label': label, 'rule_confidence': conf}
