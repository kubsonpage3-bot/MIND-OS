from django.db import migrations
from django.db.models import Q


def credit_boss_defeat(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserProfile = apps.get_model("api", "UserProfile")
    UserStats = apps.get_model("api", "UserStats")
    UserActivityLog = apps.get_model("api", "UserActivityLog")
    Boss = apps.get_model("api", "Boss")
    BossEncounter = apps.get_model("api", "BossEncounter")
    Item = apps.get_model("api", "Item")
    InventoryItem = apps.get_model("api", "InventoryItem")

    # 1. For all users, sync bosses_defeated with actual defeated encounters
    for stats in UserStats.objects.all():
        defeated_count = BossEncounter.objects.filter(user=stats.user, is_defeated=True).count()
        if stats.bosses_defeated < defeated_count:
            stats.bosses_defeated = defeated_count
            stats.save(update_fields=["bosses_defeated"])

    # 2. Specifically target KubsonMercer / kubsonpage3
    users = User.objects.filter(
        Q(username__iexact="KubsonMercer")
        | Q(username__iexact="kubsonmercer")
        | Q(username__icontains="kubson")
        | Q(email__icontains="kubson")
    )

    for u in users:
        stats, _ = UserStats.objects.get_or_create(user=u)
        profile = UserProfile.objects.filter(user=u).first()

        encounters = BossEncounter.objects.filter(user=u)
        has_defeated = encounters.filter(is_defeated=True).exists()

        boss = Boss.objects.filter(id_name="herald_jackal").first()
        if not boss:
            boss = Boss.objects.filter(id_name="nameless_bones").first()

        if not has_defeated:
            if boss:
                BossEncounter.objects.create(
                    user=u,
                    boss=boss,
                    hp_current=0,
                    is_defeated=True,
                    reward_multiplier=1.0,
                )

        stats.bosses_defeated = max(stats.bosses_defeated, 1)
        stats.save(update_fields=["bosses_defeated"])

        if profile:
            profile.gold += 250
            profile.skill_points += 3
            profile.rank_xp += 150
            profile.save(update_fields=["gold", "skill_points", "rank_xp"])

            item = Item.objects.filter(code="jackal_glaive").first()
            if not item:
                item = Item.objects.filter(code="bone_bracelet").first()

            if item and not InventoryItem.objects.filter(user_profile=profile, item=item).exists():
                rolled_stats = {"pwr": 2, "spd": 1}
                InventoryItem.objects.create(
                    user_profile=profile,
                    item=item,
                    quantity=1,
                    stat_bonuses=rolled_stats,
                )

            if not UserActivityLog.objects.filter(user=u, activity_type="boss_defeat").exists():
                UserActivityLog.objects.create(
                    user=u,
                    activity_type="boss_defeat",
                    title=boss.name if boss else "Herald Jackal",
                    xp_earned=150,
                    gold_earned=250,
                    metadata={"boss_level": 2, "sp_reward": 3, "item_dropped": "jackal_glaive"},
                )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0115_update_all_class_skills"),
    ]

    operations = [
        migrations.RunPython(credit_boss_defeat, migrations.RunPython.noop),
    ]
