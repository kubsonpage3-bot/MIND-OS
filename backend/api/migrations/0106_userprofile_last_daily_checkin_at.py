from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0105_rebalance_boss_xp_gold"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="last_daily_checkin_at",
            field=models.DateField(
                blank=True, null=True, verbose_name="Последний чекин дейликов"
            ),
        ),
    ]
