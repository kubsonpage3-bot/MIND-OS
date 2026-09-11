import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from django.contrib.auth import get_user_model
from api.models import UserProfile, BossEncounter, UserStats, UserActivityLog, InventoryItem, Item, Boss

User = get_user_model()

# Ink Mark (ink_warden, Level 2, Rank D):
# Real canonical rewards: Gold: +280 G, XP: +45, SP: +5, Unique drop: wardens_quill ("Warden's Quill")
# Today's completed habits: +15 G
# Accurate total gold = 295 G.

for uname in ["kubsonpage3", "KubsonMercer"]:
    users = User.objects.filter(username__iexact=uname)
    for u in users:
        p = getattr(u, "profile", None)
        if not p:
            continue

        # 1. Correct user gold to 295 G (instead of artificial 1000 G placeholder)
        p.gold = 295
        p.skill_points = max(p.skill_points, 5)
        p.save(update_fields=["gold", "skill_points"])

        # 2. Sync UserStats bosses_defeated
        s, _ = UserStats.objects.get_or_create(user=u)
        encounters = BossEncounter.objects.filter(user=u, is_defeated=True)
        s.bosses_defeated = max(s.bosses_defeated, encounters.count(), 1)
        s.save(update_fields=["bosses_defeated"])

        # 3. Clean up mistakenly created herald_jackal encounter and ensure ink_warden is defeated
        BossEncounter.objects.filter(user=u, boss__id_name="herald_jackal").delete()
        ink_boss = Boss.objects.filter(id_name="ink_warden").first()
        if ink_boss:
            enc, _ = BossEncounter.objects.get_or_create(
                user=u, boss=ink_boss, defaults={"hp_current": 0, "is_defeated": True}
            )
            if not enc.is_defeated:
                enc.is_defeated = True
                enc.hp_current = 0
                enc.save()

        # 4. Remove mistakenly granted heralds_fang / jackal_glaive and grant canonical wardens_quill
        InventoryItem.objects.filter(user_profile=p, item__code__in=["heralds_fang", "jackal_glaive"]).delete()

        quill_item = Item.objects.filter(code="wardens_quill").first()
        if quill_item:
            inv_item, created = InventoryItem.objects.get_or_create(
                user_profile=p,
                item=quill_item,
                defaults={"stat_bonuses": {"pwr": 2, "spd": 1}},
            )
            print(f"Granted {quill_item.name} to {u.username}, created: {created}")

        # 5. Clean up fake Jackal's Howl / Herald Jackal activity logs, keep / ensure Ink Mark log
        UserActivityLog.objects.filter(
            user=u,
            activity_type="boss_defeat",
            title__in=["Jackal's Howl", "Herald Jackal"]
        ).delete()

        if not UserActivityLog.objects.filter(user=u, activity_type="boss_defeat", title="Ink Mark").exists():
            UserActivityLog.objects.create(
                user=u,
                activity_type="boss_defeat",
                title="Ink Mark",
                xp_earned=45,
                gold_earned=280,
                metadata={"boss_level": 2, "sp_reward": 5, "item_dropped": "wardens_quill"},
            )

        print(f"Corrected {u.username}: gold={p.gold}, SP={p.skill_points}, items={[i.item.name for i in p.inventory_items.all()]}")
