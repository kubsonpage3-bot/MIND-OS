import time
from django.db import migrations
from django.db.models import Q


def regrant_mutators(apps, schema_editor):
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

    jackal_boss = Boss.objects.filter(id_name="herald_jackal").first()
    fang_item = Item.objects.filter(code="heralds_fang").first()
    now_ms = int(time.time() * 1000)

    for u in users:
        profile = UserProfile.objects.filter(user=u).first()
        stats, _ = UserStats.objects.get_or_create(user=u)

        if profile:
            # Grant bloodwork and chronomancer mutators
            current_mut = profile.active_mutators
            if not isinstance(current_mut, dict):
                current_mut = {"active": [], "purchased": []}

            purchased = list(current_mut.get("purchased", []))
            for mid in ["bloodwork", "chronomancer"]:
                if mid not in purchased:
                    purchased.append(mid)

            active = list(current_mut.get("active", []))
            active_ids = [m.get("id") if isinstance(m, dict) else m for m in active]
            if "chronomancer" not in active_ids and len(active) < 3:
                active.append(
                    {
                        "id": "chronomancer",
                        "activatedAt": now_ms,
                        "duration": None,
                    }
                )

            profile.active_mutators = {"active": active, "purchased": purchased}
            profile.save(update_fields=["active_mutators"])

            # Ensure Herald's Fang is in inventory
            if fang_item:
                inv_item, created = InventoryItem.objects.get_or_create(
                    user_profile=profile,
                    item=fang_item,
                    defaults={"stat_bonuses": {"pwr": 2, "spd": 1}},
                )
                if not created and not inv_item.stat_bonuses:
                    inv_item.stat_bonuses = {"pwr": 2, "spd": 1}
                    inv_item.save(update_fields=["stat_bonuses"])

        # Ensure Herald Jackal encounter is marked as defeated
        if jackal_boss:
            enc = BossEncounter.objects.filter(user=u, boss=jackal_boss).first()
            if not enc:
                BossEncounter.objects.create(
                    user=u,
                    boss=jackal_boss,
                    hp_current=0,
                    is_defeated=True,
                    reward_multiplier=1.0,
                )
            elif not enc.is_defeated:
                enc.is_defeated = True
                enc.hp_current = 0
                enc.save(update_fields=["is_defeated", "hp_current"])

        # Record activity log if missing
        if not UserActivityLog.objects.filter(
            user=u,
            activity_type="boss_defeat",
            title__in=["Jackal's Howl", "Herald Jackal"],
        ).exists():
            UserActivityLog.objects.create(
                user=u,
                activity_type="boss_defeat",
                title="Jackal's Howl",
                xp_earned=35,
                gold_earned=250,
                metadata={
                    "boss_level": 2,
                    "sp_reward": 5,
                    "item_dropped": "heralds_fang",
                    "item_name": "Herald's Fang",
                },
            )

        # Sync bosses_defeated count
        defeated_count = BossEncounter.objects.filter(user=u, is_defeated=True).count()
        if stats.bosses_defeated < defeated_count:
            stats.bosses_defeated = defeated_count
            stats.save(update_fields=["bosses_defeated"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0118_restore_kubsonmercer_mutators_and_jackal"),
    ]

    operations = [
        migrations.RunPython(regrant_mutators, migrations.RunPython.noop),
    ]
