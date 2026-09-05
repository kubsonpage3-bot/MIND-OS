from django.db import migrations


def fix_stale_daily_completions(apps, schema_editor):
    Task = apps.get_model("api", "Task")
    from django.utils import timezone
    today = timezone.now().date()
    # Reset is_completed=False for any daily task where is_completed is True
    # but last_completed_at is None or before today
    Task.objects.filter(
        task_type="daily",
        is_completed=True,
    ).exclude(
        last_completed_at__date=today
    ).update(is_completed=False)


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0097_consumables_shop_cleanup"),
    ]

    operations = [
        migrations.RunPython(
            fix_stale_daily_completions,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
