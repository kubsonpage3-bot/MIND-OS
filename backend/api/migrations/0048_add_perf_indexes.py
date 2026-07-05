from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0047_userprofile_timezone"),
    ]

    operations = [
        # BossEncounter: fast lookup for active encounters per user
        migrations.AddIndex(
            model_name="bossencounter",
            index=models.Index(
                fields=["user", "is_defeated"], name="api_boss_user_defeated_idx"
            ),
        ),
        # ActiveEffect: fast lookup for skill effects per user
        migrations.AddIndex(
            model_name="activeeffect",
            index=models.Index(
                fields=["user", "skill_id"], name="api_activeeffect_user_skill_idx"
            ),
        ),
        # InventoryItem: fast lookup for equipped items per profile
        migrations.AddIndex(
            model_name="inventoryitem",
            index=models.Index(
                fields=["user_profile", "is_equipped"],
                name="api_inventoryitem_profile_equipped_idx",
            ),
        ),
        # TrainingSession: fast ordered fetch for training log
        migrations.AddIndex(
            model_name="trainingsession",
            index=models.Index(
                fields=["user_profile", "created_at"],
                name="api_trainingsession_profile_date_idx",
            ),
        ),
    ]
