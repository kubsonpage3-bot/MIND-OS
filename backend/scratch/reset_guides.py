import os
import sys
import django

# Set up Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from api.models import UserProfile

profile = UserProfile.objects.first()
if profile:
    profile.seen_guides = {}
    profile.save()
    print("Successfully reset seen_guides to {} for user:", profile.user.username)
else:
    print("No user profile found")
