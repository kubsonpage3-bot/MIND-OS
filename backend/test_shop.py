import os
import django
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mind_os.settings")
django.setup()

from api.models import User, UserProfile, Item, InventoryItem
from rest_framework.test import APIClient

user = User.objects.first()
client = APIClient()
client.force_authenticate(user=user)

print(f"Testing for user {user.username} with gold {user.profile.gold}")

# 1. Test what frontend sends:
print("\n--- Test 1: Frontend payload ---")
payload1 = {
    "item_id": {
        "item_id": "health_potion",
        "cost": 50,
        "heal_amount": 50,
        "is_consumable": True,
    }
}
response1 = client.post("/api/shop/buy/", payload1, format="json")
print("Status:", response1.status_code)
print("Data:", response1.data)

# 2. Test correct payload:
print("\n--- Test 2: Correct payload ---")
payload2 = {"item_id": "health_potion"}
response2 = client.post("/api/shop/buy/", payload2, format="json")
print("Status:", response2.status_code)
print("Data:", response2.data)
