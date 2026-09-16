# Canonical (key, label, icon) catalog of built-in Training activities.
# MUST mirror the keys of ACTIVITIES in frontend/src/lib/cognitiveEngine.js —
# that file (label/icon/description/coefficients) is the real source of
# truth for the Training tab; this is the backend-only subset (label/icon)
# needed to build the extension's Linked-Pomodoro activity picker without a
# second, independently-drifting hand-maintained copy. Cognitive coefficients
# for XP/stat-gain math live separately in
# api.services.mechanics.COGNITIVE_COEFFICIENTS (a superset — it also covers
# non-linkable categories like sleep/nutrition/social that aren't pickable
# activities here).
ACTIVITY_CATALOG = [
    {"key": "mathematics", "label": "Mathematics", "icon": "∑"},
    {"key": "physics", "label": "Physics", "icon": "⚛"},
    {"key": "history", "label": "History", "icon": "📜"},
    {"key": "english", "label": "English", "icon": "✍"},
    {"key": "philosophy", "label": "Philosophy", "icon": "φ"},
    {"key": "vocabulary", "label": "Vocabulary", "icon": "Aa"},
    {"key": "chess", "label": "Chess / Logic", "icon": "♟"},
    {"key": "coding", "label": "Coding", "icon": "</>"},
    {"key": "creative_answers", "label": "Creative Answers", "icon": "💡"},
    {"key": "exercise", "label": "Exercise", "icon": "⚡"},
    {"key": "prayer", "label": "Prayer / Meditation", "icon": "🕊️"},
    {"key": "running", "label": "Running", "icon": "🏃"},
    {"key": "reading", "label": "Reading", "icon": "📖"},
    {"key": "german", "label": "German", "icon": "🇩🇪"},
    {"key": "languages", "label": "Other Languages", "icon": "🌐"},
]

ACTIVITY_CATALOG_KEYS = {a["key"] for a in ACTIVITY_CATALOG}
