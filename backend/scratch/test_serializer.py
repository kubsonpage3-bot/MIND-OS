import os
import sys
import django
import json

# Set up Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from api.models import UserProfile
from api.serializers.profile import UserProfileSerializer

profile = UserProfile.objects.first()
serializer = UserProfileSerializer(profile)
print(json.dumps(serializer.data, indent=2))
