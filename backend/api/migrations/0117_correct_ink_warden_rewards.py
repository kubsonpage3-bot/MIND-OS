from django.db import migrations
from django.db.models import Q


def correct_ink_warden_rewards(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserProfile = apps.get_model("api", "UserProfile")
    UserStats = apps.get_model("api", "UserStats")
    UserActivityLog = apps.get_model("api", "UserActivityLog")
    Boss = apps.get_model("api", "Boss")
    BossEncounter = apps.get_model("api", "BossEncounter")
    Item = apps.get_model("api", "Item")
    InventoryItem = apps.get_model("api", "InventoryItem")

    users = User.objects.filter(
        Q(username__iexact="KubsonMercer")
        | Q(username__iexact="kubsonmercer")
        | Q(username__icontains="kubson")
        | Q(email__icontains="kubson")
    )

    ink_boss = Boss.objects.filter(id_name="ink_warden").first()
    quill_item = Item.objects.filter(code="wardens_quill").first()

    for u in users:
        profile = UserProfile.objects.filter(user=u).first()
        stats, _ = UserStats.objects.get_or_create(user=u)

        if profile:
            # 1. Reset gold from artificial 1000G placeholder to accurate 295G (280 boss + 15 dailies)
            profile.gold = 295
            profile.skill_points = max(profile.skill_points, 5)
            profile.save(update_fields=["gold", "skill_points"])

            # 2. Remove mistakenly credited Herald's Fang
            InventoryItem.objects.filter(
                user_profile=profile, item__code__in=["heralds_fang", "jackal_glaive"]
            ).delete()

            # 3. Grant canonical Warden's Quill from Ink Mark
            if quill_item and not InventoryItem.objects.filter(user_profile=profile, item=quill_item).exists():
                InventoryItem.objects.create(
                    user_profile=profile,
                    item=quill_item,
                    quantity=1,
                    stat_bonuses={"pwr": 2, "spd": 1},
                )

        # 4. Remove fake Herald Jackal encounter and ensure Ink Mark is marked defeated
        BossEncounter.objects.filter(user=u, boss__id_name="herald_jackal").delete()
        if ink_boss:
            enc = BossEncounter.objects.filter(user=u, boss=ink_boss).first()
            if not enc:
                BossEncounter.objects.create(
                    user=u,
                    boss=ink_boss,
                    hp_current=0,
                    is_defeated=True,
                    reward_multiplier=1.0,
                )
            elif not enc.is_defeated:
                enc.is_defeated = True
                enc.hp_current = 0
                enc.save(update_fields=["is_defeated", "hp_current"])

        # 5. Clean up fake Jackal activity logs
        UserActivityLog.objects.filter(
            user=u,
            activity_type="boss_defeat",
            title__in=["Jackal's Howl", "Herald Jackal"],
        ).delete()

        # Ensure Ink Mark activity log exists
        if not UserActivityLog.objects.filter(user=u, activity_type="boss_defeat", title="Ink Mark").exists():
            UserActivityLog.objects.create(
                user=u,
                activity_type="boss_defeat",
                title="Ink Mark",
                xp_earned=45,
                gold_earned=280,
                metadata={"boss_level": 2, "sp_reward": 5, "item_dropped": "wardens_quill"},
            )

        # 6. Sync bosses_defeated count
        defeated_count = BossEncounter.objects.filter(user=u, is_defeated=True).count()
        if stats.bosses_defeated < defeated_count:
            stats.bosses_defeated = defeated_count
            stats.save(update_fields=["bosses_defeated"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0116_credit_boss_defeat_kubsonmercer"),
    ]

    operations = [
        migrations.RunPython(correct_ink_warden_rewards, migrations.RunPython.noop),
    ]
