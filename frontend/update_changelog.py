import json
import os

changelog_path = "src/data/changelog.json"
with open(changelog_path, "r", encoding="utf-8") as f:
    changelog = json.load(f)

new_entry = {
    "version": "1.4.94",
    "date": "2026-07-14",
    "changes": [
        {
            "type": "feature",
            "text": "Completely revamped the mobile dashboard with a fluid, Habitica-style swipeable carousel for seamless navigation between tabs.",
        },
        {
            "type": "fix",
            "text": "Fixed a mobile 'micro-jump' issue when swiping horizontally across nested scrollable lists like Tasks.",
        },
    ],
}

changelog.insert(0, new_entry)

with open(changelog_path, "w", encoding="utf-8") as f:
    json.dump(changelog, f, indent=4)
