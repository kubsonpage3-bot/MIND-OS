import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from api.models import Item  # noqa: E402

# 1. Run migration
updated = Item.objects.filter(source__in=["boss_drop", "quest_reward"]).update(
    is_purchasable=False
)
print(f"Migration updated {updated} items.")

# 2. Verify boss drops
print("\n--- Boss Drops ---")
boss_drops = Item.objects.filter(source="boss_drop")
for item in boss_drops:
    print(
        f"[{item.code}] is_purchasable: {item.is_purchasable}, "
        f"source: {item.source}"
    )

# 3. Verify non-boss drops
print("\n--- Non-Boss Drops (Sample) ---")
non_boss_drops = Item.objects.exclude(
    source__in=["boss_drop", "quest_reward"]
).filter(is_purchasable=False)
if non_boss_drops.exists():
    print("WARNING: Found non-boss drops that are NOT purchasable!")
    for item in non_boss_drops:
        print(
            f"[{item.code}] is_purchasable: {item.is_purchasable}, "
            f"source: {item.source}, cost: {item.cost}"
        )
else:
    print(
        "SUCCESS: All non-boss drops are properly purchasable "
        "(or no unintended non-purchasable items exist)."
    )
