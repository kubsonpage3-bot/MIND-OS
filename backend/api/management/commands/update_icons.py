import os
from django.core.management.base import BaseCommand
from api.models import Item

class Command(BaseCommand):
    help = 'Updates icon_url for all items based on their code'

    def handle(self, *args, **options):
        items = Item.objects.all()
        updated_count = 0
        for item in items:
            expected_url = f'/static/items/{item.code}.webp'
            if item.icon_url != expected_url:
                item.icon_url = expected_url
                item.save(update_fields=['icon_url'])
                updated_count += 1
                self.stdout.write(self.style.SUCCESS(f'Updated {item.code} -> {expected_url}'))
        
        self.stdout.write(self.style.SUCCESS(f'Successfully updated {updated_count} items.'))
