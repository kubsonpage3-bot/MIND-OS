import json
import datetime

with open("frontend/src/data/changelog.json", "r", encoding="utf-8") as f:
    data = json.load(f)

new_entry = {
    "version": "1.4.12",
    "date": datetime.datetime.now().strftime("%Y-%m-%d"),
    "changes": [
        {
            "type": "feature",
            "text": "Added Party Member Profiles! You can now tap on any party member's card to view their detailed stats, recruited allies, and activity history.",
        }
    ],
}

data.insert(0, new_entry)

with open("frontend/src/data/changelog.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
