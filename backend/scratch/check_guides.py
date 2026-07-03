import os
import sys
import django
import json

# Set up Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from api.models import UserProfile

for profile in UserProfile.objects.all():
    print(f"User: {profile.user.username}, seen_guides: {json.dumps(profile.seen_guides)}")
