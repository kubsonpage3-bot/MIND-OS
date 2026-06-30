with open(r"C:\coder\mind-os-growth\backend\api\views.py", "r", encoding="utf-8") as f:
    content = f.read()

old = """        boss_id = serializer.validated_data["boss_id"]
        cost = serializer.validated_data["cost"]

        from django.db import transaction
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)

            if profile.gold < cost:
                return Response({"detail": "Not enough gold."}, status=status.HTTP_400_BAD_REQUEST)  # noqa: E501

            # Check for active encounters
            active_encounter = BossEncounter.objects.filter(user=request.user, is_defeated=False).first()  # noqa: E501
            if active_encounter:
                return Response({"detail": f"You already have an active boss: {active_encounter.boss.name}"}, status=status.HTTP_400_BAD_REQUEST)  # noqa: E501

            try:
                boss = Boss.objects.get(id_name=boss_id)
            except Boss.DoesNotExist:
                return Response({"detail": "Boss template not found."}, status=status.HTTP_404_NOT_FOUND)  # noqa: E501

            profile.gold -= cost
            profile.save()"""

new = """        boss_id = serializer.validated_data["boss_id"]

        from django.db import transaction
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)

            try:
                boss = Boss.objects.get(id_name=boss_id)
            except Boss.DoesNotExist:
                return Response({"detail": "Boss template not found."}, status=status.HTTP_404_NOT_FOUND)  # noqa: E501

            # SSOT: cost from DB, not frontend
            summon_cost = boss.reward_gold // 2
            if profile.gold < summon_cost:
                return Response({"detail": f"Not enough gold. Need {summon_cost}G."}, status=status.HTTP_400_BAD_REQUEST)  # noqa: E501

            # Check for active encounters
            active_encounter = BossEncounter.objects.filter(user=request.user, is_defeated=False).first()  # noqa: E501
            if active_encounter:
                return Response({"detail": f"You already have an active boss: {active_encounter.boss.name}"}, status=status.HTTP_400_BAD_REQUEST)  # noqa: E501

            profile.gold -= summon_cost
            profile.save(update_fields=["gold"])"""

if old in content:
    content = content.replace(old, new)
    print("BossSummonView patched OK")
else:
    print("MISMATCH - dumping surrounding text:")
    idx = content.find('cost = serializer.validated_data["cost"]')
    print(repr(content[idx - 200 : idx + 400]))

with open(r"C:\coder\mind-os-growth\backend\api\views.py", "w", encoding="utf-8") as f:
    f.write(content)
print("File saved")
