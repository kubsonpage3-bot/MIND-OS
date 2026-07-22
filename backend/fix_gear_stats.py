import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from api.models import InventoryItem, Item, ItemEffect

# Dictionary of items missing stat effects and their allocation
GEAR_STAT_ALLOCATIONS = {
    "misted_hood": {"foc": 3, "mem": 2},
    "wanderers_hood": {"foc": 2, "spd": 1},
    "bone_bracelet": {"pwr": 3, "foc": 2},
    "heralds_fang": {"pwr": 3, "def": 2},
    "wardens_quill": {"lck": 3, "mem": 2},
    "echo_bell": {"mem": 3, "foc": 2},
    "silk_mantle": {"def": 4, "lck": 3},
    "frostbite_blade": {"pwr": 4, "spd": 3},
    "ember_gauntlet": {"pwr": 4, "def": 3},
    "glass_tear": {"lck": 4, "mem": 3},
    "leviathan_scale": {"def": 5, "pwr": 2},
    "crown_of_ash": {"foc": 4, "pwr": 4, "mem": 3},
    "golems_grip": {"def": 5, "pwr": 4, "lck": 2},
    "scar_shard": {"pwr": 5, "def": 4, "spd": 2},
    "forgotten_score": {"mem": 4, "spd": 4, "lck": 3},
    "abyssal_purse": {"lck": 5, "mem": 3, "spd": 3},
    "winter_plate": {"def": 6, "pwr": 3, "foc": 2},
    "throne_seal": {"lck": 6, "pwr": 5, "def": 4},
    "eclipse_eye": {"foc": 6, "mem": 5, "spd": 4},
    "mask_nameless": {"foc": 6, "pwr": 5, "def": 4},
    "blade_final_dusk": {"pwr": 6, "spd": 5, "lck": 4},
}


def fix_gear():
    print("=== SEEDING GEAR STAT EFFECTS & RETROACTIVE INVENTORY UPDATE ===")
    updated_items = 0
    updated_inv = 0

    for code, stats in GEAR_STAT_ALLOCATIONS.items():
        try:
            item = Item.objects.get(code=code)
        except Item.DoesNotExist:
            print(f"Warning: Item '{code}' not found in DB!")
            continue

        # Add ItemEffect objects if missing
        for stat_name, stat_val in stats.items():
            effect, created = ItemEffect.objects.get_or_create(
                item=item,
                effect_name=stat_name,
                defaults={"effect_value": float(stat_val)},
            )
            if not created and effect.effect_value != float(stat_val):
                effect.effect_value = float(stat_val)
                effect.save(update_fields=["effect_value"])

        updated_items += 1
        print(f"Updated Item [{item.gear_class}] {item.code} ('{item.name}') -> {stats}")

        # Update InventoryItem stat_bonuses for existing inventory items
        inv_qs = InventoryItem.objects.filter(item=item)
        for inv in inv_qs:
            inv.stat_bonuses = stats
            inv.save(update_fields=["stat_bonuses"])
            updated_inv += 1

    print("=" * 60)
    print(f"Successfully updated {updated_items} Items and {updated_inv} InventoryItems.")


if __name__ == "__main__":
    fix_gear()
