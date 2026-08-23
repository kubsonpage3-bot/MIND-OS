from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from api.models import (
    UserProfile,
    Item,
    InventoryItem,
    ActiveEffect,
    Boss,
    BossEncounter,
)
from api.services.inventory_service import consume_item
from api.services.daily_service import process_daily_login
from api.services.shop_service import buy_item
from api.services.mechanics import apply_boss_damage, get_passive_multipliers

User = get_user_model()


class ConsumablesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.profile = UserProfile.objects.get(user=self.user)
        self.profile.gold = 1000
        self.profile.hp = 10
        self.profile.save()

        # Get or create items
        self.small_heal, _ = Item.objects.get_or_create(
            code="small_heal",
            defaults={
                "name": "Small Heal",
                "item_type": "consumable",
                "hp_boost": 20,
                "cost": 10,
            },
        )
        self.xp_booster, _ = Item.objects.get_or_create(
            code="xp_booster",
            defaults={"name": "XP Booster", "item_type": "consumable", "cost": 50},
        )
        self.streak_shield, _ = Item.objects.get_or_create(
            code="streak_shield",
            defaults={"name": "Streak Shield", "item_type": "consumable", "cost": 100},
        )
        self.memory_patch, _ = Item.objects.get_or_create(
            code="memory_patch",
            defaults={"name": "Memory Patch", "item_type": "consumable", "cost": 35},
        )
        self.boss_damage_plus, _ = Item.objects.get_or_create(
            code="boss_damage_plus",
            defaults={"name": "Boss Damage+", "item_type": "consumable", "cost": 60},
        )

        InventoryItem.objects.create(
            user_profile=self.profile, item=self.small_heal, quantity=2
        )
        InventoryItem.objects.create(
            user_profile=self.profile, item=self.xp_booster, quantity=1
        )
        InventoryItem.objects.create(
            user_profile=self.profile, item=self.streak_shield, quantity=1
        )
        InventoryItem.objects.create(
            user_profile=self.profile, item=self.memory_patch, quantity=1
        )
        InventoryItem.objects.create(
            user_profile=self.profile, item=self.boss_damage_plus, quantity=1
        )

    def test_heal_item_capped_at_max(self):
        print(f"\n[test_heal_item] Before heal: HP={self.profile.hp}")
        success, msg, profile = consume_item(self.user, "small_heal")
        self.assertTrue(success)
        print(f"[test_heal_item] After heal: HP={profile.hp}")
        self.assertEqual(profile.hp, 30)

        # Second consume should cap at max
        self.profile.hp = 95
        self.profile.save()
        print(f"[test_heal_item] Before 2nd heal (near max): HP={self.profile.hp}")
        success, msg, profile = consume_item(self.user, "small_heal")
        print(f"[test_heal_item] After 2nd heal: HP={profile.hp} (capped)")
        self.assertEqual(profile.hp, 100)  # Assuming max_hp is 100

    def test_xp_booster(self):
        print("\n[test_xp_booster] Checking XP booster application")
        success, msg, profile = consume_item(self.user, "xp_booster")
        self.assertTrue(success)

        # Verify effect exists
        effect = ActiveEffect.objects.filter(
            user=self.user, skill_id="xp_booster"
        ).first()
        self.assertIsNotNone(effect)
        assert effect is not None
        self.assertIn("xpBoost", effect.data)

        # Verify get_passive_multipliers includes it
        effects_before = get_passive_multipliers(
            self.profile, {}
        )  # without active buff in DB it would be 1.0, but we consumed it so it's 1.5
        print(
            f"[test_xp_booster] Active XP Mult after buff: {effects_before['xp_mult']}"
        )
        self.assertEqual(effects_before["xp_mult"], 1.5)

    def test_streak_shield(self):
        # Set initial streak state
        self.profile.streak = 5
        self.profile.last_login_date = timezone.now().date() - timedelta(
            days=2
        )  # Missed a day
        self.profile.save()
        print(
            f"\n[test_streak_shield] Before daily cron: streak={self.profile.streak}, last_cron={self.profile.last_login_date}"
        )

        # Consume shield
        consume_item(self.user, "streak_shield")
        print("[test_streak_shield] Streak shield consumed. Running daily cron...")

        # Trigger daily login
        process_daily_login(self.user)

        # Fetch updated profile
        self.profile.refresh_from_db()

        # Should be 6 instead of resetting to 1
        print(
            f"[test_streak_shield] After daily cron: streak={self.profile.streak} (expected 6, not 1)"
        )
        self.assertEqual(self.profile.streak, 6)

        # Effect should be gone
        self.assertFalse(
            ActiveEffect.objects.filter(
                user=self.user, skill_id="streak_shield"
            ).exists()
        )

    def test_memory_patch(self):
        print("\n[test_memory_patch] Consuming memory patch...")
        gc_before = self.profile.gc
        consume_item(self.user, "memory_patch")
        self.profile.refresh_from_db()
        gc_after = self.profile.gc
        print(f"[test_memory_patch] Gc before: {gc_before}, after: {gc_after}")
        self.assertAlmostEqual(gc_after, gc_before + 0.2, places=2)

    def test_boss_damage_plus(self):
        consume_item(self.user, "boss_damage_plus")

        boss = Boss.objects.create(
            id_name="test_boss",
            name="Test Boss",
            hp_max=1000,
            reward_gold=10,
            reward_xp=10,
        )
        encounter = BossEncounter.objects.create(
            user=self.user, boss=boss, hp_current=1000
        )
        print(
            f"\n[test_boss_damage_plus] Before attack: boss HP={encounter.hp_current}, base damage=100"
        )

        # Base damage is 100. With +50% from buff, it should deal 150.
        apply_boss_damage(self.user, 100)

        encounter.refresh_from_db()
        print(
            f"[test_boss_damage_plus] After attack: boss HP={encounter.hp_current} (expected 850)"
        )
        self.assertEqual(encounter.hp_current, 850)  # 1000 - 150

    def test_buy_consumable_goes_to_inventory(self):
        # Update small_heal cost to 200 for clean test
        self.small_heal.cost = 200
        self.small_heal.save()
        self.profile.gold = 1000
        self.profile.rank_xp = 0  # Rank E
        self.profile.save()

        success, msg, profile = buy_item(self.user, "small_heal")
        self.assertTrue(success)
        self.assertEqual(profile.gold, 800)  # 1000 - 200 * 1.0

        # User already had 2 small_heals, should now have 3
        inv_item = InventoryItem.objects.get(
            user_profile=self.profile, item__code="small_heal"
        )
        self.assertEqual(inv_item.quantity, 3)

    def test_rank_price_scaling(self):
        self.small_heal.cost = 200
        self.small_heal.save()

        # Test on D-Rank (1.5x)
        self.profile.rank_xp = 250  # D-Rank is 200-599
        self.profile.gold = 1000
        self.profile.save()

        success, msg, profile = buy_item(self.user, "small_heal")
        self.assertTrue(success)
        # 200 * 1.5 = 300, 1000 - 300 = 700
        self.assertEqual(profile.gold, 700)

        # Test on SSS-Rank (17.09x)
        self.profile.rank_xp = 8500  # SSS-Rank is 8000+
        self.profile.gold = 5000
        self.profile.save()

        success, msg, profile = buy_item(self.user, "small_heal")
        self.assertTrue(success)
        # 200 * 17.09 = 3418, 5000 - 3418 = 1582
        self.assertEqual(profile.gold, 1582)

    def test_daily_gold_rush_rank_scaled(self):
        gold_token, _ = Item.objects.get_or_create(
            code="daily_gold_rush",
            defaults={
                "name": "Gold Rush Token",
                "item_type": "consumable",
                "cost": 600,
            },
        )
        InventoryItem.objects.create(
            user_profile=self.profile, item=gold_token, quantity=1
        )

        # On D-Rank (1.5x): 200 * 1.5 = 300 gold reward
        self.profile.rank_xp = 300
        self.profile.gold = 100
        self.profile.save()

        success, msg, profile = consume_item(self.user, "daily_gold_rush")
        self.assertTrue(success)
        self.assertEqual(profile.gold, 400)  # 100 + 300
