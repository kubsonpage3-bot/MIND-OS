# flake8: noqa
import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")

import django

django.setup()

from django.contrib.auth.models import User  # noqa: E402
from api.models import UserProfile  # noqa: E402

username = "test12345"
password = "test123123"
email = "test12345@mindos.app"

try:
    user, created = User.objects.get_or_create(
        username=username, defaults={"email": email}
    )
    user.email = email
    user.set_password(password)
    user.save()

    profile, p_created = UserProfile.objects.get_or_create(user=user)
    profile.is_premium = True
    profile.save(update_fields=["is_premium"])

    action = "Created new" if created else "Updated existing"
    print(
        f"SUCCESS: {action} user '{username}' (email: {email}). Premium activated: {profile.is_premium}."
    )
except Exception as e:
    print(f"ERROR activating premium: {e}")
