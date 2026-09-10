from django.db import migrations


def clear_class_skill_cooldowns(apps, schema_editor):
    SkillCooldown = apps.get_model("api", "SkillCooldown")
    class_skill_ids = [
        "blueprint",
        "system_overload",
        "infinite_loop",
        "iron_fast",
        "meditation",
        "transcendence",
        "babel_mode",
        "polyglot_surge",
        "memetic_transfer",
        "battle_fury",
        "war_cry",
        "tactical_retreat",
    ]
    deleted_count, _ = SkillCooldown.objects.filter(skill_id__in=class_skill_ids).delete()
    print(f"Cleared {deleted_count} active class skill cooldowns from database.")


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0112_boss_reward_mp_and_sync_slots"),
    ]

    operations = [
        migrations.RunPython(
            clear_class_skill_cooldowns,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
