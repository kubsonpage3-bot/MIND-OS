import os
import django

# Setup Django if not running via manage.py shell
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from api.models import Item, ItemEffect  # noqa: E402

items_data = [
    # HEADWARE
    {
        "id": "neural_cap",
        "slot": "headware",
        "name": "Neural Cap",
        "tier": "Common",
        "cost": 80,
        "stats": {"foc": 2},
    },
    {
        "id": "sync_visor",
        "slot": "headware",
        "name": "Sync Visor",
        "tier": "Uncommon",
        "cost": 200,
        "stats": {"foc": 2, "mem": 1},
    },
    {
        "id": "cognitive_crown",
        "slot": "headware",
        "name": "Cognitive Crown",
        "tier": "Rare",
        "cost": 500,
        "stats": {"foc": 2, "pwr": 2},
    },
    {
        "id": "transcendence_helm",
        "slot": "headware",
        "name": "Transcendence Helm",
        "tier": "Epic",
        "cost": 1500,
        "stats": {"foc": 5, "mem": 2},
    },
    # NEURAL LINK
    {
        "id": "basic_cortex",
        "slot": "neural_link",
        "name": "Basic Cortex Link",
        "tier": "Common",
        "cost": 60,
        "stats": {"mem": 2},
    },
    {
        "id": "dual_channel",
        "slot": "neural_link",
        "name": "Dual-Channel Adapter",
        "tier": "Uncommon",
        "cost": 180,
        "stats": {"mem": 2, "lck": 1},
    },
    {
        "id": "quantum_sync",
        "slot": "neural_link",
        "name": "Quantum Sync",
        "tier": "Rare",
        "cost": 450,
        "stats": {"mem": 4},
    },
    {
        "id": "void_bridge",
        "slot": "neural_link",
        "name": "Void Bridge",
        "tier": "Legendary",
        "cost": 2000,
        "stats": {"mem": 5, "foc": 2},
    },
    # CORE
    {
        "id": "carbon_vest",
        "slot": "core",
        "name": "Carbon Vest",
        "tier": "Common",
        "cost": 90,
        "stats": {"def": 2},
    },
    {
        "id": "reactive_shell",
        "slot": "core",
        "name": "Reactive Shell",
        "tier": "Uncommon",
        "cost": 220,
        "stats": {"def": 2, "pwr": 1},
    },
    {
        "id": "resonance_core",
        "slot": "core",
        "name": "Resonance Core",
        "tier": "Rare",
        "cost": 480,
        "stats": {"def": 4},
    },
    {
        "id": "singularity_engine",
        "slot": "core",
        "name": "Singularity Engine",
        "tier": "Legendary",
        "cost": 2200,
        "stats": {"def": 5, "pwr": 2},
    },
    # ARMS
    {
        "id": "training_implants",
        "slot": "arms",
        "name": "Training Implants",
        "tier": "Common",
        "cost": 70,
        "stats": {"pwr": 2},
    },
    {
        "id": "force_amplifiers",
        "slot": "arms",
        "name": "Force Amplifiers",
        "tier": "Uncommon",
        "cost": 190,
        "stats": {"pwr": 2, "def": 1},
    },
    {
        "id": "synaptic_boosters",
        "slot": "arms",
        "name": "Synaptic Boosters",
        "tier": "Rare",
        "cost": 420,
        "stats": {"pwr": 2, "spd": 2},
    },
    # LEGS
    {
        "id": "mobility_frame",
        "slot": "legs",
        "name": "Mobility Frame",
        "tier": "Common",
        "cost": 75,
        "stats": {"spd": 2},
    },
    {
        "id": "overdrive_chassis",
        "slot": "legs",
        "name": "Overdrive Chassis",
        "tier": "Uncommon",
        "cost": 210,
        "stats": {"spd": 2, "lck": 1},
    },
    {
        "id": "phase_legs",
        "slot": "legs",
        "name": "Phase Legs",
        "tier": "Rare",
        "cost": 460,
        "stats": {"spd": 4},
    },
    # RINGS
    {
        "id": "data_ring",
        "slot": "ring1",
        "name": "Data Ring",
        "tier": "Common",
        "cost": 50,
        "stats": {"lck": 2},
    },
    {
        "id": "echo_ring",
        "slot": "ring1",
        "name": "Echo Ring",
        "tier": "Uncommon",
        "cost": 140,
        "stats": {"lck": 2, "mem": 1},
    },
    {
        "id": "null_ring",
        "slot": "ring2",
        "name": "Null Ring",
        "tier": "Rare",
        "cost": 380,
        "stats": {"lck": 2, "foc": 2},
    },
    # CONSUMABLES
    {
        "id": "focus_stim",
        "slot": "consumable",
        "name": "Focus Stim",
        "description": "Grants +30% Focus multiplier for your next Focus Session.",
        "tier": "Common",
        "cost": 30,
    },
    {
        "id": "memory_patch",
        "slot": "consumable",
        "name": "Memory Patch",
        "description": "Instantly boosts your Growth Coefficient (Gc) by +0.2.",
        "tier": "Common",
        "cost": 35,
    },
    {
        "id": "xp_booster",
        "slot": "consumable",
        "name": "XP Booster",
        "description": "Grants +50% XP from all sources for 24 hours.",
        "tier": "Uncommon",
        "cost": 80,
    },
    {
        "id": "streak_shield",
        "slot": "consumable",
        "name": "Streak Shield",
        "description": "Automatically protects your daily streak from breaking once if you miss a day.",
        "tier": "Rare",
        "cost": 200,
    },
    {
        "id": "boss_damage_plus",
        "slot": "consumable",
        "name": "Boss Damage+",
        "description": "Deals +50% damage to the boss in your next Focus Session.",
        "tier": "Uncommon",
        "cost": 60,
    },
    # Heal potions
    {
        "id": "small_heal",
        "slot": "consumable",
        "name": "Small Health Potion",
        "description": "Restores 20 HP instantly.",
        "tier": "Common",
        "cost": 25,
        "hp_boost": 20,
    },
    {
        "id": "medium_heal",
        "slot": "consumable",
        "name": "Health Potion",
        "description": "Restores 50 HP instantly.",
        "tier": "Uncommon",
        "cost": 60,
        "hp_boost": 50,
    },
    {
        "id": "large_heal",
        "slot": "consumable",
        "name": "Mega Health Potion",
        "description": "Restores 100 HP instantly.",
        "tier": "Rare",
        "cost": 150,
        "hp_boost": 100,
    },
    {
        "id": "elixir",
        "slot": "consumable",
        "name": "Elixir of Life",
        "description": "Restores HP to 100% and grants 10 minutes of complete damage immunity.",
        "tier": "Epic",
        "cost": 500,
        "hp_boost": 9999,
    },
    # BOSS DROPS
    {
        "id": "wanderers_hood",
        "slot": "headware",
        "name": "Wanderer's Hood",
        "tier": "Rare",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "misted_hood",
        "slot": "headware",
        "name": "Misted Wanderer's Hood",
        "tier": "Rare",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "bone_bracelet",
        "slot": "arms",
        "name": "Bone Bracelet",
        "tier": "Rare",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "heralds_fang",
        "slot": "core",
        "name": "Herald's Fang",
        "tier": "Rare",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "wardens_quill",
        "slot": "arms",
        "name": "Warden's Quill",
        "tier": "Rare",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "echo_bell",
        "slot": "ring1",
        "name": "Echo Bell",
        "tier": "Epic",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "frostbite_blade",
        "slot": "arms",
        "name": "Frostbite Blade",
        "tier": "Epic",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "silk_mantle",
        "slot": "core",
        "name": "Silk Mantle",
        "tier": "Epic",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "ember_gauntlet",
        "slot": "arms",
        "name": "Ember Gauntlet",
        "tier": "Epic",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "glass_tear",
        "slot": "ring2",
        "name": "Glass Tear",
        "tier": "Epic",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "leviathan_scale",
        "slot": "core",
        "name": "Leviathan Scale",
        "tier": "Epic",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "crown_of_ash",
        "slot": "headware",
        "name": "Crown of Ash",
        "tier": "Legendary",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "golems_grip",
        "slot": "arms",
        "name": "Golem's Grip",
        "tier": "Legendary",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "scar_shard",
        "slot": "core",
        "name": "Scar Shard",
        "tier": "Legendary",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "forgotten_score",
        "slot": "neural_link",
        "name": "Forgotten Score",
        "tier": "Legendary",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "abyssal_purse",
        "slot": "ring1",
        "name": "Abyssal Purse",
        "tier": "Legendary",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "winter_plate",
        "slot": "core",
        "name": "Winter Plate",
        "tier": "Legendary",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "throne_seal",
        "slot": "ring2",
        "name": "Throne Seal",
        "tier": "Mythic",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "eclipse_eye",
        "slot": "neural_link",
        "name": "Eclipse Eye",
        "tier": "Mythic",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "mask_nameless",
        "slot": "headware",
        "name": "Mask of the Nameless",
        "tier": "Mythic",
        "cost": 0,
        "source": "boss_drop",
    },
    {
        "id": "blade_final_dusk",
        "slot": "arms",
        "name": "Blade of Final Dusk",
        "tier": "Mythic",
        "cost": 0,
        "source": "boss_drop",
    },
]

for data in items_data:
    icon_path = f"/static/items/{data['id']}.webp"

    is_consumable = data["slot"] == "consumable"
    item_type = Item.ItemType.CONSUMABLE if is_consumable else Item.ItemType.EQUIPMENT
    slot_type = None if is_consumable else data["slot"]

    # 1. Store or update Item
    is_purchasable = data.get("source", "shop") == "shop"

    item, created = Item.objects.get_or_create(
        code=data["id"],
        defaults={
            "name": data["name"],
            "description": data.get("description", data["name"]),
            "item_type": item_type,
            "slot_type": slot_type,
            "icon_url": icon_path,
            "cost": data["cost"],
            "hp_boost": data.get("hp_boost", 0),
            "is_purchasable": is_purchasable,
        },
    )

    if not created:
        item.name = str(data["name"])
        item.description = str(data.get("description", data["name"]))
        item.item_type = str(item_type)
        item.slot_type = str(slot_type) if slot_type else None
        item.icon_url = str(icon_path)
        item.cost = int(data["cost"])  # type: ignore
        item.hp_boost = int(data.get("hp_boost", 0))  # type: ignore
        item.is_purchasable = bool(is_purchasable)
        item.save()

    # 2. Store ItemEffect entries for stats
    # Clear existing effects first to avoid duplicates or stale stats
    item.effects.all().delete()  # type: ignore

    stats = data.get("stats", {})
    if isinstance(stats, dict):
        for stat_name, stat_val in stats.items():
            ItemEffect.objects.create(
                item=item, effect_name=stat_name, effect_value=float(stat_val)
            )

print(f"Seeding complete! {len(items_data)} items processed.")
