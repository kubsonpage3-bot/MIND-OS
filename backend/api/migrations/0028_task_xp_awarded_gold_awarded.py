from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0027_trainingsession'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='xp_awarded',
            field=models.IntegerField(default=0, verbose_name='XP выдано (для отмены)'),
        ),
        migrations.AddField(
            model_name='task',
            name='gold_awarded',
            field=models.IntegerField(default=0, verbose_name='Gold выдано (для отмены)'),
        ),
    ]
