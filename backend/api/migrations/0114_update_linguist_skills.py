from django.db import migrations


def purge_legacy_linguist_effects(apps, schema_editor):
    ActiveEffect = apps.get_model("api", "ActiveEffect")
    SkillCooldown = apps.get_model("api", "SkillCooldown")

    legacy_skills = ["babel_mode", "polyglot_surge", "memetic_transfer"]

    effects_deleted, _ = ActiveEffect.objects.filter(skill_id__in=legacy_skills).delete()
    cooldowns_deleted, _ = SkillCooldown.objects.filter(skill_id__in=legacy_skills).delete()

    print(
        f"Purged legacy linguist skills: {effects_deleted} ActiveEffects, {cooldowns_deleted} SkillCooldowns."
    )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0113_clear_class_skill_cooldowns"),
    ]

    operations = [
        migrations.RunPython(
            purge_legacy_linguist_effects,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
