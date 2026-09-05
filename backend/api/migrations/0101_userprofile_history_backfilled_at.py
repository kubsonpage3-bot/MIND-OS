from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0100_remove_memory_patch_forever"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="history_backfilled_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="Дата последнего backfill истории",
            ),
        ),
    ]
