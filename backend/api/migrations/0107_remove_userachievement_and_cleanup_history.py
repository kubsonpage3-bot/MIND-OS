from django.db import migrations, models


def cleanup_achievements_history(apps, schema_editor):
    UserActivityLog = apps.get_model("api", "UserActivityLog")
    UserActivityLog.objects.filter(activity_type="achievement").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0106_userprofile_last_daily_checkin_at"),
    ]

    operations = [
        migrations.RunPython(
            cleanup_achievements_history,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.DeleteModel(
            name="UserAchievement",
        ),
        migrations.AlterField(
            model_name="useractivitylog",
            name="activity_type",
            field=models.CharField(
                choices=[
                    ("study", "Предмет / Учёба"),
                    ("habit_pos", "Привычка (+)"),
                    ("habit_neg", "Привычка (-)"),
                    ("daily", "Дейлик"),
                    ("daily_uncomplete", "Отмена дейлика"),
                    ("todo", "To-Do"),
                    ("todo_uncomplete", "Отмена To-Do"),
                    ("pomodoro", "Помодоро"),
                    ("boss_defeat", "Победа над боссом"),
                ],
                default="study",
                max_length=20,
                verbose_name="Тип активности",
            ),
        ),
    ]
