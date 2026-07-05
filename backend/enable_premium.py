import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")

import django

django.setup()

from django.contrib.auth.models import User

try:
    user = User.objects.get(username="test123")
    profile = user.profile
    profile.is_premium = True
    profile.save(update_fields=["is_premium"])
    print(f"Successfully activated premium for {user.username}.")
except Exception as e:
    print(f"Error: {e}")
