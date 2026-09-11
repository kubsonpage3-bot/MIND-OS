import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from django.contrib.auth import get_user_model
from api.models import UserProfile, BossEncounter, UserStats, UserActivityLog, InventoryItem, Item, Boss

User = get_user_model()

for uname in ["kubsonpage3", "KubsonMercer"]:
    u = User.objects.filter(username__iexact=uname).first()
    if u:
        p = u.profile
        p.gold = max(p.gold, 1000)
        p.skill_points = max(p.skill_points, 5)
        p.rank_xp = max(p.rank_xp, 300)
        p.save(update_fields=["gold", "skill_points", "rank_xp"])

        s, _ = UserStats.objects.get_or_create(user=u)
        s.bosses_defeated = max(s.bosses_defeated, 1)
        s.save(update_fields=["bosses_defeated"])

        boss = Boss.objects.filter(id_name="herald_jackal").first()
        if boss:
            enc, enc_created = BossEncounter.objects.get_or_create(
                user=u, boss=boss, defaults={"hp_current": 0, "is_defeated": True}
            )
            if not enc.is_defeated:
                enc.is_defeated = True
                enc.hp_current = 0
                enc.save()

        item = Item.objects.filter(code="heralds_fang").first()
        if item:
            inv_item, created = InventoryItem.objects.get_or_create(
                user_profile=p,
                item=item,
                defaults={"stat_bonuses": {"pwr": 2, "spd": 1}},
            )
            print(f"Item: {item.name}, created: {created} for user: {uname}")

        log, log_created = UserActivityLog.objects.get_or_create(
            user=u,
            activity_type="boss_defeat",
            defaults={
                "title": boss.name if boss else "Jackal's Howl",
                "xp_earned": 150,
                "gold_earned": 250,
                "metadata": {"boss_level": 2, "sp_reward": 3, "item_dropped": "heralds_fang"},
            },
        )

        print(f"User: {uname} | bosses_defeated: {s.bosses_defeated} | Gold: {p.gold} | SP: {p.skill_points} | Items: {[i.item.name for i in p.inventory_items.all()]} | Logs: {UserActivityLog.objects.filter(user=u, activity_type='boss_defeat').count()}")
