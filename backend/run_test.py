import os
import django
import sys
import json

# Setup Django environment
sys.path.append("c:\\coder\\mind-os-growth\\backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from django.conf import settings

settings.ALLOWED_HOSTS.append("testserver")

from api.models import User, UserProfile, Item, InventoryItem
from rest_framework.test import APIClient

user = User.objects.first()
if not user:
    print("No user found")
    sys.exit(1)

client = APIClient()
client.force_authenticate(user=user)

# Let's give user enough gold for tests
profile = user.profile
profile.gold = 500
profile.save()

print(f"Testing for user {user.username} with gold {profile.gold}")


def print_db_state():
    prof = UserProfile.objects.get(user=user)
    print(f"  -> Gold: {prof.gold}")
    for inv_item in InventoryItem.objects.filter(user_profile=prof):
        print(f"  -> Inventory: {inv_item.quantity}x {inv_item.item.code}")


print("\n--- Initial DB State ---")
print_db_state()

cheap_items = list(Item.objects.exclude(cost=0).order_by("cost")[:3])
items_to_buy = [
    (item.code, getattr(item, "category", "Item"), item.cost) for item in cheap_items
]

for item_code, category, cost in items_to_buy:
    print(f"\n=== Attempting to buy {category} ({item_code}) cost: {cost}G ===")

    # Check if item exists in db
    try:
        Item.objects.get(code=item_code)
    except Item.DoesNotExist:
        print(f"Item {item_code} does not exist in DB, skipping.")
        continue

    payload = {"item_id": item_code}
    response = client.post("/api/shop/buy/", payload, format="json")

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("Success! Data:", response.json().get("detail"))
    else:
        print("Failed! Data:", response.content)

    print_db_state()
