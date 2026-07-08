import json
import os
from django.conf import settings

# Path to the shared mutators JSON config
MUTATORS_JSON_PATH = os.path.join(
    settings.BASE_DIR, "..", "shared", "data", "mutators.json"
)


def load_mutators_config():
    """
    Loads and returns the mutators config as a dictionary keyed by mutator ID.
    """
    try:
        with open(MUTATORS_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {item["id"]: item for item in data}
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Failed to load shared mutators config: {e}")
        return {}


# Loaded once at startup. Requires a server restart to pick up changes.
MUTATORS_CONFIG = load_mutators_config()
