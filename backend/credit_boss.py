import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from django.contrib.auth import get_user_model
from api.models import UserProfile, BossEncounter, UserStats, UserActivityLog, InventoryItem, Item, Boss

User = get_user_model()

# Ink Mark (ink_warden, Level 2, Rank D):
# Real canonical rewards: Gold: +280 G, XP: +45, SP: +5, Unique drop: wardens_quill ("Warden's Quill")
# Today's completed habits: +15 G
# Accurate total gold = 295 G.

# DEPRECATED: This script was an emergency one-time reconciliation.
# It is permanently disabled to prevent overwriting user progression, boss defeats, or gold.
print("credit_boss.py is deprecated and deactivated.")

