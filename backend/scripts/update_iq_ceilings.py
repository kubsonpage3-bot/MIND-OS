import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from api.models import UserProfile


def run():
    profiles = UserProfile.objects.all()
    count = profiles.count()
    print(f"Updating ceilings for {count} profiles...")

    updated_count = 0
    for profile in profiles:
        profile.gf_ceiling = 105.0
        profile.gc_ceiling = 105.0
        profile.ps_ceiling = 105.0
        profile.vm_ceiling = 105.0

        # We can also choose to clamp current stats to the ceiling if they exceed it:
        # profile.gf = min(profile.gf, 105.0)
        # profile.gc = min(profile.gc, 105.0)
        # profile.ps = min(profile.ps, 105.0)
        # profile.vm = min(profile.vm, 105.0)
        # However, the plan stated we will NOT clamp unless requested, so we just update ceilings.

        profile.save(
            update_fields=["gf_ceiling", "gc_ceiling", "ps_ceiling", "vm_ceiling"]
        )
        updated_count += 1

    print(
        f"Successfully updated {updated_count} profiles. New ceiling is 105.0 for all IQ metrics."
    )


if __name__ == "__main__":
    run()
