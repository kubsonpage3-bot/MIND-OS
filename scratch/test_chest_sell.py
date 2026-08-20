import os
import sys
import django
import random

# Add backend to Python path
sys.path.insert(0, r"c:\coder\mindos\backend")

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from django.contrib.auth.models import User
from api.models import UserProfile, Item, InventoryItem, LootChest
from api.services.chest_service import open_chest
from api.services.shop_service import sell_item

def run_audit():
    # 1. Fetch or create a test user
    username = "chest_audit_user"
    user, created = User.objects.get_or_create(username=username, defaults={"email": "audit@mindos.com"})
    if created:
        user.set_password("audit_pass_123")
        user.save()
        
    profile = user.profile
    profile.gold = 10000  # Give plenty of gold for testing
    profile.save()
    
    print(f"Test user: '{username}' | Initial Gold: {profile.gold}G")
    
    # 2. Get chests
    chests = list(LootChest.objects.all())
    print(f"Available chests in DB: {[c.chest_type for c in chests]}")
    if not chests:
        print("Error: No chests found in DB! Seeding may have failed.")
        return
        
    # We will test opening 'standard_cache'
    chest_type = "standard_cache"
    chest = LootChest.objects.get(chest_type=chest_type)
    print(f"\n--- Testing Chest Open: {chest.name} (Cost: {chest.cost_gold}G) ---")
    
    # Clean inventory first
    InventoryItem.objects.filter(user_profile=profile).delete()
    
    # Open chest
    success, msg, result = open_chest(user, chest_type)
    print(f"Success: {success} | Message: {msg}")
    
    # Verify profile gold deduction
    profile.refresh_from_db()
    print(f"Gold after opening: {profile.gold}G (Expected: {10000 - chest.cost_gold}G)")
    
    # 3. Check inventory contents
    inventory = InventoryItem.objects.filter(user_profile=profile)
    print(f"\n--- Testing Inventory Display ---")
    print(f"Items in inventory count: {inventory.count()}")
    for inv in inventory:
        print(f"  - Item: {inv.item.name} (Code: {inv.item.code})")
        print(f"    Quantity: {inv.quantity}")
        print(f"    Slot Type: {inv.item.slot_type}")
        print(f"    Gear Class: {inv.item.gear_class}")
        print(f"    Base Cost: {inv.item.cost}G")
        print(f"    Icon URL: {inv.item.icon_url}")
        
    if inventory.count() == 0:
        print("Error: Won item was not found in inventory!")
        return
        
    inv_item = inventory.first()
    won_item_code = inv_item.item.code
    won_item_cost = inv_item.item.cost
    
    # 4. Sell item
    print(f"\n--- Testing Item Sale: {inv_item.item.name} (Base Cost: {won_item_cost}G) ---")
    pre_sell_gold = profile.gold
    
    success_sell, msg_sell, profile_after = sell_item(user, won_item_code, quantity=1)
    print(f"Success Sell: {success_sell} | Message: {msg_sell}")
    
    profile.refresh_from_db()
    expected_gains = int(won_item_cost * 0.3)
    print(f"Gold after sale: {profile.gold}G (Expected: {pre_sell_gold + expected_gains}G)")
    
    # Verify item quantity decremented
    try:
        inv_item_after = InventoryItem.objects.get(user_profile=profile, item__code=won_item_code)
        print(f"Inventory item quantity after sale: {inv_item_after.quantity}")
    except InventoryItem.DoesNotExist:
        print("Inventory item was successfully removed (quantity hit 0)")
        
    # Clean up test user's inventory
    InventoryItem.objects.filter(user_profile=profile).delete()
    print("\nAudit completed successfully.")

if __name__ == "__main__":
    run_audit()
