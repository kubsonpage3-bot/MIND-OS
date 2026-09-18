import pytest
from datetime import timedelta
from django.utils import timezone
from api.models import (
    UserProfile,
    UnlockedSkill,
    ActiveEffect,
    Item,
    InventoryItem,
    RecruitedAlly,
    Boss,
    BossEncounter,
)
from api.services.mechanics import get_passive_multipliers, apply_boss_damage
from api.services.profile_service import get_rank_info, get_humanities_rank_info
from api.services.daily_service import process_daily_login
from api.services.rival_service import compute_rival_data
from api.services.shop_service import sell_item
from django.contrib.auth.models import User
from api.constants import (
    SKILL_TREE_CONFIG,
    BASE_SELL_RATE,
    MARKET_KNOWLEDGE_SELL_RATE,
    RANK_THRESHOLDS,
    HUMANITIES_RANK_THRESHOLDS,
)


@pytest.fixture
def user():
    u = User.objects.create(username="skilluser", password="testpassword")
    return u


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.character_class = "architect"
    p.mana = 100
    p.hp = 100
    p.gold = 0
    p.save()
    return p


@pytest.mark.django_db
class TestAll30Skills:
    def test_config_completeness(self):
        """Ensure all 30 skills exist in SKILL_TREE_CONFIG with proper keys."""
        all_30_skills = [
            # MIND
            "sharp_focus", "deep_concentration", "flow_state", "neural_expansion", "cognitive_supremacy", "godmind",
            # BODY
            "iron_conditioning", "endurance_protocol", "combat_reflexes", "pain_threshold", "unbreakable", "apex_predator",
            # WEALTH
            "resource_awareness", "compound_returns", "loot_magnetism", "market_knowledge", "fortunes_favor", "golden_mind",
            # SPIRIT
            "inner_stillness", "resilience", "mindguard", "aura_of_focus", "transcendent_will", "void_clarity",
            # KNOWLEDGE
            "polymath", "cross_training", "encyclopedia", "master_of_arts", "living_library", "omniscience",
        ]
        assert len(all_30_skills) == 30
        for code in all_30_skills:
            assert code in SKILL_TREE_CONFIG, f"Missing config for {code}"
            cfg = SKILL_TREE_CONFIG[code]
            assert "sp" in cfg and "gold" in cfg

    def test_mind_branch_skills(self, user, profile):
        # 1. sharp_focus
        UnlockedSkill.objects.create(user_profile=profile, skill_code="sharp_focus")
        effects_low = get_passive_multipliers(profile, {"focus_rating": 7.0})
        effects_high = get_passive_multipliers(profile, {"focus_rating": 8.5})
        assert effects_low["xp_mult"] == 1.0
        assert effects_high["xp_mult"] == 1.10

        # 2. deep_concentration
        UnlockedSkill.objects.create(user_profile=profile, skill_code="deep_concentration")
        effects = get_passive_multipliers(profile, {})
        assert effects["min_focus"] == 7.0

        # 3. flow_state -- reduced from +50% to +20% (was wildly disproportionate
        # to its tier-3 peers in the other branches: +10% crit chance, +3%
        # drop chance, -15% mana cost, +20% Gc)
        UnlockedSkill.objects.create(user_profile=profile, skill_code="flow_state")
        profile.last_training_at = timezone.now().date() - timedelta(days=1)
        effects = get_passive_multipliers(profile, {"focus_rating": 8.0})
        # sharp_focus (0.10) + flow_state (0.20)
        assert round(effects["xp_mult"], 2) == 1.30

        # 4. neural_expansion -- "+5 Gf ceiling" is applied once, permanently,
        # at purchase (rpg_service.buy_skill_node's gf_ceiling_bonus). It
        # used to ALSO grant a live +5 gf_ceiling_flat passive on top,
        # silently doubling the promised bonus to +10 wherever
        # effective_gf_ceiling is read -- fixed to apply exactly once.
        from api.services.rpg_service import buy_skill_node

        # deep_concentration and flow_state (its requires-chain) were
        # already unlocked above as steps 2-3.
        profile.skill_points = 100
        profile.gold = 100000
        profile.save()
        ceiling_before = profile.gf_ceiling
        buy_skill_node(user, "neural_expansion")
        profile.refresh_from_db()
        assert profile.gf_ceiling == ceiling_before + 5.0
        effects = get_passive_multipliers(profile, {})
        assert effects["gf_ceiling_flat"] == 0.0

        # 5. cognitive_supremacy -- redesigned from a flat +20% to all 4
        # metrics into a permanent x2 (+100%) to Gf/Gc/Ps/Vm gains
        UnlockedSkill.objects.create(user_profile=profile, skill_code="cognitive_supremacy")
        effects = get_passive_multipliers(profile, {})
        assert effects["gf_mult"] == 2.0
        assert effects["gc_mult"] == 2.0
        assert effects["ps_mult"] == 2.0
        assert effects["vm_mult"] == 2.0

        # 6. godmind
        UnlockedSkill.objects.create(user_profile=profile, skill_code="godmind")
        effects = get_passive_multipliers(profile, {})
        assert effects["godmind_active"] is True

    def test_body_branch_skills(self, user, profile):
        # 7. iron_conditioning
        UnlockedSkill.objects.create(user_profile=profile, skill_code="iron_conditioning")
        eff_exercise = get_passive_multipliers(profile, {"is_exercise": True})
        eff_non_exercise = get_passive_multipliers(profile, {"is_exercise": False})
        assert eff_exercise["xp_mult"] == 1.15
        assert eff_non_exercise["xp_mult"] == 1.0

        # 8. endurance_protocol
        base_thresholds = RANK_THRESHOLDS[1]["min"]
        info_before = get_rank_info(profile)
        assert info_before["thresholds"][1]["min"] == base_thresholds

        UnlockedSkill.objects.create(user_profile=profile, skill_code="endurance_protocol")
        effects = get_passive_multipliers(profile, {})
        assert effects["running_threshold_reduction"] == 0.20
        info_after = get_rank_info(profile)
        assert info_after["thresholds"][1]["min"] == int(base_thresholds * 0.8)

        # 9. combat_reflexes
        UnlockedSkill.objects.create(user_profile=profile, skill_code="combat_reflexes")
        effects = get_passive_multipliers(profile, {})
        assert effects["crit_chance_bonus"] == 0.10

        # 10. pain_threshold -- redesigned "Second Wind": the +50% comeback
        # XP is set/consumed directly in task_service.py's Habit branch, not
        # through get_passive_multipliers; see test_skill_redesign_batch3.py
        # for the full behavioral test.
        UnlockedSkill.objects.create(user_profile=profile, skill_code="pain_threshold")
        effects = get_passive_multipliers(profile, {})
        assert effects["second_wind_active"] is True

        # 11. unbreakable -- redesigned "War Body": +1 max active mutator
        # slot, consumed in views.py's mutator-activation slot check; see
        # test_skill_redesign_batch3.py.
        UnlockedSkill.objects.create(user_profile=profile, skill_code="unbreakable")
        effects = get_passive_multipliers(profile, {})
        assert effects["war_body_slot"] is True

        # 12. apex_predator -- its +30% boss damage is applied directly in
        # apply_boss_damage(), not through get_passive_multipliers(); see
        # test_boss_dmg_mult_gaps.py for the real assertion.
        UnlockedSkill.objects.create(user_profile=profile, skill_code="apex_predator")

    def test_wealth_branch_skills(self, user, profile):
        # 12. resource_awareness
        UnlockedSkill.objects.create(user_profile=profile, skill_code="resource_awareness")
        effects = get_passive_multipliers(profile, {})
        assert effects["gold_mult"] == 1.10

        # 13. loot_magnetism -- redesigned "Windfall": 5% chance to double a
        # Gold reward, applied in calculate_task_outcome(); see
        # test_skill_redesign_batch3.py for the full behavioral test.
        UnlockedSkill.objects.create(user_profile=profile, skill_code="loot_magnetism")
        effects = get_passive_multipliers(profile, {})
        assert effects["windfall_chance"] == 0.05

        # 14. golden_mind
        UnlockedSkill.objects.create(user_profile=profile, skill_code="golden_mind")
        effects_short = get_passive_multipliers(profile, {"hours": 1.5})
        effects_long = get_passive_multipliers(profile, {"hours": 2.5})
        assert effects_short["guaranteed_loot_drop"] is False
        assert effects_long["guaranteed_loot_drop"] is True

        # 15. market_knowledge
        item = Item.objects.create(code="gold_sword", name="Gold Sword", cost=100)
        InventoryItem.objects.create(user_profile=profile, item=item, quantity=2)
        profile.gold = 0
        profile.save()

        # Without market_knowledge: sells for 30%
        ok, msg, p = sell_item(user, "gold_sword", 1)
        assert ok is True
        assert p.gold == int(100 * BASE_SELL_RATE)  # 30

        # With market_knowledge: sells for 60%
        UnlockedSkill.objects.create(user_profile=profile, skill_code="market_knowledge")
        ok2, msg2, p2 = sell_item(user, "gold_sword", 1)
        assert ok2 is True
        assert p2.gold == 30 + int(100 * MARKET_KNOWLEDGE_SELL_RATE)  # 30 + 60 = 90

        # 16. fortunes_favor in daily login (compound_returns is now a
        # passive Gold multiplier, covered in test_services.py, not a
        # daily-login flat bonus)
        UnlockedSkill.objects.create(user_profile=profile, skill_code="fortunes_favor")

        profile.streak = 6
        profile.last_login_date = timezone.now().date() - timedelta(days=1)
        profile.gold = 0
        profile.save()

        # Logging in advances streak to 7 -> triggers +100G (fortunes_favor)
        process_daily_login(user)
        profile.refresh_from_db()
        assert profile.streak == 7
        assert profile.gold == 100

    def test_spirit_branch_skills(self, user, profile):
        # 17. inner_stillness
        UnlockedSkill.objects.create(user_profile=profile, skill_code="inner_stillness")
        eff_prayer = get_passive_multipliers(profile, {"is_prayer": True})
        assert eff_prayer["xp_mult"] == 1.20

        # 18. resilience
        UnlockedSkill.objects.create(user_profile=profile, skill_code="resilience")
        effects = get_passive_multipliers(profile, {})
        assert effects["mana_regen_mult"] == 1.25

        # 19. mindguard -- the actual -15% mana cost is applied directly in
        # skill_service.activate_skill() (see test_skill_mana_cost_respects_mem_and_mindguard
        # in test_skill_mana_cost.py), not through get_passive_multipliers.
        UnlockedSkill.objects.create(user_profile=profile, skill_code="mindguard")
        assert SKILL_TREE_CONFIG["mindguard"]["mana_cost_reduction"] == 0.15

        # 20. aura_of_focus
        UnlockedSkill.objects.create(user_profile=profile, skill_code="aura_of_focus")
        effects = get_passive_multipliers(profile, {})
        assert effects["ally_stat_mult"] == 1.10

        # 20. transcendent_will -- redesigned "Sanctuary": a free once-a-day
        # streak shield, consumed directly in daily_service.py; see
        # test_skill_redesign_batch3.py for the full behavioral test.
        UnlockedSkill.objects.create(user_profile=profile, skill_code="transcendent_will")
        effects = get_passive_multipliers(profile, {})
        assert effects["sanctuary_active"] is True

        # 21. void_clarity
        UnlockedSkill.objects.create(user_profile=profile, skill_code="void_clarity")
        from api.services.skill_service import activate_skill
        profile.mana = 100
        profile.save()
        # void_clarity allows casting with 0 mana deducted
        success, msg, _, _ = activate_skill(user, "blueprint")
        assert success is True
        profile.refresh_from_db()
        assert profile.mana == 100  # 0 mana used
        assert profile.void_clarity_last_used is not None

    def test_knowledge_branch_skills(self, user, profile):
        # 22. polymath -- +20 flat XP once 3+ unique subjects are logged
        # today, scoped to Training/Pomodoro sessions only (not Habit/
        # Daily/Todo -- see test_skills_and_allies_multipliers in
        # test_services.py for the negative case).
        UnlockedSkill.objects.create(user_profile=profile, skill_code="polymath")
        from api.models import UserStats
        from django.utils import timezone as tz

        stats, _ = UserStats.objects.get_or_create(user=user)
        stats.unique_subjects_today = {
            "date": str(tz.now().date()),
            "subjects": ["Math", "Physics", "Chemistry"],
        }
        stats.save()

        effects = get_passive_multipliers(profile, {"task_type": "training"})
        assert effects["flat_xp"] == 20

        # 23. cross_training
        UnlockedSkill.objects.create(user_profile=profile, skill_code="cross_training")
        eff_lang = get_passive_multipliers(profile, {"is_language": True})
        assert eff_lang["humanities_xp_mult"] == 1.30
        assert eff_lang["gf_flat_bonus"] == 0.05

        # 24. encyclopedia
        UnlockedSkill.objects.create(user_profile=profile, skill_code="encyclopedia")
        effects = get_passive_multipliers(profile, {})
        assert effects["gc_mult"] == 1.20

        # 25. master_of_arts
        base_threshold = HUMANITIES_RANK_THRESHOLDS[1]["min"]
        info_before = get_humanities_rank_info(profile)
        assert info_before["thresholds"][1]["min"] == base_threshold

        UnlockedSkill.objects.create(user_profile=profile, skill_code="master_of_arts")
        effects = get_passive_multipliers(profile, {})
        assert effects["humanities_threshold_reduction"] == 0.15
        info_after = get_humanities_rank_info(profile)
        assert info_after["thresholds"][1]["min"] == int(base_threshold * 0.85)

        # 26. living_library -- redesigned "Cross-Reference": +15%
        # Gf/Gc/Ps/Vm gains on a training session once 2+ different
        # subjects were logged today; see test_skill_redesign_batch3.py for
        # the full behavioral test via calculate_cognitive_gains.
        UnlockedSkill.objects.create(user_profile=profile, skill_code="living_library")
        from api.models import UserStats
        from django.utils import timezone as tz2

        stats2, _ = UserStats.objects.get_or_create(user=user)
        stats2.unique_subjects_today = {
            "date": str(tz2.now().date()),
            "subjects": ["Math", "Physics"],
        }
        stats2.save()
        effects = get_passive_multipliers(profile, {"task_type": "training"})
        assert effects["gf_mult"] == 1.15

        # 27. omniscience -- redesigned: eases the growth soft-cap near a
        # cognitive stat's ceiling by 20%, instead of a boss-kill flat
        # bonus; see test_skill_redesign_batch3.py for the full behavioral
        # test via calculate_cognitive_gains.
        UnlockedSkill.objects.create(user_profile=profile, skill_code="omniscience")
        boss = Boss.objects.create(id_name="test_skill_boss", name="Skill Boss", level=1, hp_max=100, reward_gold=50, reward_xp=50)
        BossEncounter.objects.create(user=user, boss=boss, hp_current=100, is_defeated=False)
        combat = apply_boss_damage(user, 150)
        assert combat["boss_defeated"] is True
