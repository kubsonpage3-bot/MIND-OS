import os

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")

import django  # noqa: E402

django.setup()

from django.contrib.auth.models import User  # noqa: E402


def create_admin_user():
    username = "mindos_admin"
    password = os.environ.get("ADMIN_INITIAL_PASSWORD")

    if not password:
        print(
            "Skipping superuser creation: ADMIN_INITIAL_PASSWORD environment variable not set."
        )
        return

    if User.objects.filter(username=username).exists():
        print(f"Superuser '{username}' already exists. Skipping creation.")
        return

    print(f"Creating superuser '{username}'...")
    User.objects.create_superuser(
        username=username, email="admin@mindos.local", password=password
    )
    print(f"Superuser '{username}' successfully created.")


if __name__ == "__main__":
    create_admin_user()
