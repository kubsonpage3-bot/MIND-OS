import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")

import django

django.setup()

from django.contrib.auth.models import User
from api.serializers.profile import UserProfileSerializer

user = User.objects.get(username="test123")
serializer = UserProfileSerializer(user.profile)
print(serializer.data)
