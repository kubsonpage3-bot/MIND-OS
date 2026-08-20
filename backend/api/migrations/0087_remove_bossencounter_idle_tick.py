from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0086_recalculate_task_rewards"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="bossencounter",
            name="last_idle_tick_at",
        ),
    ]
