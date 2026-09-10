from django.db import migrations


def purge_retired_class_skills(apps, schema_editor):
    ActiveEffect = apps.get_model("api", "ActiveEffect")
    SkillCooldown = apps.get_model("api", "SkillCooldown")

    retired_skills = [
        "blueprint",
        "system_overload",
        "infinite_loop",
        "iron_fast",
        "meditation",
        "transcendence",
        "battle_fury",
        "war_cry",
        "tactical_retreat",
    ]

    effects_deleted, _ = ActiveEffect.objects.filter(skill_id__in=retired_skills).delete()
    cooldowns_deleted, _ = SkillCooldown.objects.filter(skill_id__in=retired_skills).delete()

    print(
        f"Purged retired class skills: {effects_deleted} ActiveEffects, {cooldowns_deleted} SkillCooldowns."
    )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0114_update_linguist_skills"),
    ]

    operations = [
        migrations.RunPython(
            purge_retired_class_skills,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
