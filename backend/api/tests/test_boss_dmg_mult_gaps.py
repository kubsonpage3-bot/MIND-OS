"""
ember_gauntlet and the Void ally's boss-damage bonus were only wired into
get_passive_multipliers()["boss_dmg_mult"], which apply_boss_damage() (the
actual damage-application function) never read -- so both silently did
nothing. Fixed by adding them to apply_boss_damage()'s own direct
equipped-item/ally checks, matching frostbite_blade/scar_shard.

Follow-up audit: apex_predator, frostbite_blade, scar_shard, and
blade_final_dusk turned out to share the exact same dead
get_passive_multipliers()["boss_dmg_mult"] computation -- it was never read
anywhere (not even by apply_boss_damage(), which recomputes this bonus
independently from scratch). Removed that entire dead accumulator from
get_passive_multipliers() rather than wire it up a second time, since doing
so would have double-applied every one of these bonuses on top of
apply_boss_damage()'s own correct values.
"""
import pytest
from django.contrib.auth.models import User
from api.models import Boss, BossEncounter, RecruitedAlly, InventoryItem, Item
from api.services.mechanics import apply_boss_damage


@pytest.fixture
def user_with_boss():
    User.objects.filter(username="test_boss_dmg_gap_user").delete()
    user = User.objects.create(username="test_boss_dmg_gap_user")
    profile = user.profile  # type: ignore
    profile.active_allies = []
    profile.save()
    boss = Boss.objects.create(name="Gap Boss", level=1, hp_max=1000, reward_xp=10, reward_gold=5)
    BossEncounter.objects.create(user=user, boss=boss, hp_current=1000, is_defeated=False)
    return user, profile


@pytest.mark.django_db
def test_ember_gauntlet_boss_damage_now_applies(user_with_boss):
    user, profile = user_with_boss
    item, _ = Item.objects.get_or_create(
        code="ember_gauntlet",
        defaults={"name": "Ember Gauntlet", "item_type": Item.ItemType.EQUIPMENT},
    )
    InventoryItem.objects.create(user_profile=profile, item=item, is_equipped=True)

    result = apply_boss_damage(user, 100)
    assert result["damage_dealt"] == 106  # 100 * 1.06


@pytest.mark.django_db
def test_void_ally_boss_damage_now_applies(user_with_boss):
    user, profile = user_with_boss
    RecruitedAlly.objects.create(user_profile=profile, ally_code="void", level=3)
    profile.active_allies = ["void"]
    profile.save()

    result = apply_boss_damage(user, 100)
    assert result["damage_dealt"] == 110  # 100 * 1.10 (level < 5)


@pytest.mark.django_db
def test_void_ally_level_5_boss_damage(user_with_boss):
    user, profile = user_with_boss
    RecruitedAlly.objects.create(user_profile=profile, ally_code="void", level=5)
    profile.active_allies = ["void"]
    profile.save()

    result = apply_boss_damage(user, 100)
    assert result["damage_dealt"] == 150  # 100 * 1.50


@pytest.mark.django_db
def test_void_ally_inactive_gives_no_bonus(user_with_boss):
    user, profile = user_with_boss
    RecruitedAlly.objects.create(user_profile=profile, ally_code="void", level=5)
    profile.active_allies = []  # recruited but not activated
    profile.save()

    result = apply_boss_damage(user, 100)
    assert result["damage_dealt"] == 100


@pytest.mark.django_db
def test_apex_predator_boss_damage_applies(user_with_boss):
    """
    apex_predator's +30% boss damage has the same fix as ember_gauntlet/
    Void above: applied directly in apply_boss_damage(), not through the
    dead get_passive_multipliers()["boss_dmg_mult"] pipeline (which has
    since been removed entirely -- nothing else ever read it).
    """
    from api.models import UnlockedSkill

    user, profile = user_with_boss
    UnlockedSkill.objects.create(user_profile=profile, skill_code="apex_predator")

    result = apply_boss_damage(user, 100)
    assert result["damage_dealt"] == 130  # 100 * 1.30
