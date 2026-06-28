from django.core.management.base import BaseCommand
from api.models import Boss

SCROLLS = [
  { "id": "misted_wanderer", "rank": "E", "name": "Misted Wanderer", "reward": {"gold": 100, "xp": 50}, "bossHP": 500, "uniqueItem": "wanderers_hood" },
  { "id": "nameless_bones", "rank": "E", "name": "Nameless Skeleton", "reward": {"gold": 120, "xp": 60}, "bossHP": 600, "uniqueItem": "bone_bracelet" },
  { "id": "herald_jackal", "rank": "D", "name": "Herald Jackal", "reward": {"gold": 250, "xp": 150}, "bossHP": 1500, "uniqueItem": "heralds_fang" },
  { "id": "ink_warden", "rank": "D", "name": "Ink Warden", "reward": {"gold": 280, "xp": 180}, "bossHP": 1800, "uniqueItem": "wardens_quill" },
  { "id": "abyssal_bellringer", "rank": "C", "name": "Abyssal Bellringer", "reward": {"gold": 500, "xp": 300}, "bossHP": 3500, "uniqueItem": "echo_bell" },
  { "id": "frost_executioner", "rank": "C", "name": "Frost Executioner", "reward": {"gold": 550, "xp": 350}, "bossHP": 4000, "uniqueItem": "frostbite_blade" },
  { "id": "weaving_shade", "rank": "C", "name": "Weaving Shade", "reward": {"gold": 480, "xp": 280}, "bossHP": 3200, "uniqueItem": "silk_mantle" },
  { "id": "ember_smith", "rank": "B", "name": "Ember Smith", "reward": {"gold": 900, "xp": 600}, "bossHP": 8000, "uniqueItem": "ember_gauntlet" },
  { "id": "sanctuary_weeper", "rank": "B", "name": "Sanctuary Weeper", "reward": {"gold": 950, "xp": 650}, "bossHP": 9000, "uniqueItem": "glass_tear" },
  { "id": "shallow_leviathan", "rank": "B", "name": "Shallow Leviathan", "reward": {"gold": 1000, "xp": 700}, "bossHP": 10000, "uniqueItem": "leviathan_scale" },
  { "id": "faceless_king", "rank": "A", "name": "Faceless King", "reward": {"gold": 2000, "xp": 1500}, "bossHP": 20000, "uniqueItem": "crown_of_ash" },
  { "id": "ore_golem", "rank": "A", "name": "Ore Golem", "reward": {"gold": 2200, "xp": 1600}, "bossHP": 22000, "uniqueItem": "golems_grip" },
  { "id": "wounded_moon", "rank": "A", "name": "Wounded Moon", "reward": {"gold": 2500, "xp": 1800}, "bossHP": 25000, "uniqueItem": "scar_shard" },
  { "id": "choir_forgotten", "rank": "S", "name": "Choir of the Forgotten", "reward": {"gold": 5000, "xp": 4000}, "bossHP": 60000, "uniqueItem": "forgotten_score" },
  { "id": "bottomless_miser", "rank": "S", "name": "Bottomless Miser", "reward": {"gold": 6000, "xp": 4500}, "bossHP": 70000, "uniqueItem": "abyssal_purse" },
  { "id": "winter_thorn", "rank": "S", "name": "Winter Thorn", "reward": {"gold": 7000, "xp": 5000}, "bossHP": 80000, "uniqueItem": "winter_plate" },
  { "id": "king_ashen_throne", "rank": "SS", "name": "King of the Ashen Throne", "reward": {"gold": 15000, "xp": 12000}, "bossHP": 180000, "uniqueItem": "throne_seal" },
  { "id": "eclipse_warden", "rank": "SS", "name": "Eclipse Warden", "reward": {"gold": 18000, "xp": 14000}, "bossHP": 200000, "uniqueItem": "eclipse_eye" },
  { "id": "nameless_god", "rank": "SSS", "name": "Nameless Machine-God", "reward": {"gold": 50000, "xp": 40000}, "bossHP": 600000, "uniqueItem": "mask_nameless" },
  { "id": "final_dusk", "rank": "SSS", "name": "The Final Dusk", "reward": {"gold": 60000, "xp": 50000}, "bossHP": 700000, "uniqueItem": "blade_final_dusk" },
]

RANK_TO_LEVEL = {
    "E": 1,
    "D": 2,
    "C": 3,
    "B": 4,
    "A": 5,
    "S": 6,
    "SS": 7,
    "SSS": 8,
}

class Command(BaseCommand):
    help = "Seeds initial boss templates"

    def handle(self, *args, **kwargs):
        created_count = 0
        for b in SCROLLS:
            boss, created = Boss.objects.update_or_create(
                id_name=b["id"],
                defaults={
                    "name": b["name"],
                    "hp_max": b["bossHP"],
                    "level": RANK_TO_LEVEL.get(b["rank"], 1),
                    "reward_gold": b["reward"]["gold"],
                    "reward_xp": b["reward"]["xp"],
                    "drop_item_id": b["uniqueItem"]
                }
            )
            if created:
                created_count += 1
                
        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {created_count} new Boss templates!"))
