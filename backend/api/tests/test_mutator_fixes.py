import pytest
from django.contrib.auth.models import User
from api.models import Item, UserStats, Task
from api.services.shop_service import buy_item
from api.services.task_service import complete_task


@pytest.fixture
def test_user_and_profile():
    # Use unique username to avoid conflicts
    user, _ = User.objects.get_or_create(username="test_mutator_user_fixed_2")
    profile = user.profile
    profile.gold = 1000
    profile.rank_xp = 0
    profile.active_mutators = {}
    profile.save()

    # Ensure stats exist and are empty
    stats, _ = UserStats.objects.get_or_create(user=user)
    stats.unique_subjects_today = {}
    stats.save()

    return user, profile, stats


@pytest.mark.django_db
def test_miser_mutator_discount(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    # Create shop item
    item, _ = Item.objects.get_or_create(
        code="test_scroll_miser",
        defaults={
            "name": "Miser Scroll",
            "cost": 100,
        },
    )

    # Verify cost without miser
    profile.active_mutators = {}
    profile.save()

    success, msg, p_after = buy_item(user, "test_scroll_miser")
    assert success
    assert p_after.gold == 900  # 1000 - 100

    # Verify cost with miser
    p_after.gold = 1000
    p_after.active_mutators = {"active": [{"id": "miser"}]}
    p_after.save()

    success, msg, p_after2 = buy_item(user, "test_scroll_miser")
    assert success
    assert p_after2.gold == 920  # 1000 - 80 (20% discount)


@pytest.mark.django_db
def test_tunnel_vision_xp_bonus(test_user_and_profile):
    user, profile, stats = test_user_and_profile
    import unittest.mock as mock

    with mock.patch("random.random", return_value=0.99):
        # Create tasks in different categories
        task_math = Task.objects.create(
            user=user,
            title="Math Homework",
            category="math",
            task_type=Task.TaskType.TODO,
        )

        task_coding = Task.objects.create(
            user=user,
            title="Coding Session",
            category="coding",
            task_type=Task.TaskType.TODO,
        )

        # First establish the baseline reward without tunnel_vision
        profile.active_mutators = {}
        profile.save()
        res_baseline = complete_task(user, task_math.id)
        baseline_xp = res_baseline["rewards"]["xp"]

        # Reset profile xp/stats for clean testing
        profile.rank_xp = 0
        profile.active_mutators = {"active": [{"id": "tunnel_vision"}]}
        profile.save()
        stats.unique_subjects_today = {}
        stats.save()

        # Reset math task completion status if needed (complete_task marks it completed)
        task_math.is_completed = False
        task_math.save()

        # Complete math task with tunnel_vision. Since unique subjects today is empty, it becomes 1 (math).
        # Tunnel vision gives +50% XP. Let's calculate expected:
        # baseline_xp has base_xp = 15. With tunnel vision, base_xp = int(15 * 1.5) = 22.
        # The difference in base_xp is +7 XP. So the final XP should be exactly baseline_xp + 7.
        res = complete_task(user, task_math.id)
        assert res["rewards"]["xp"] == baseline_xp + 7

        # Complete math task 2 (same category). Unique subjects today is still just ["math"] (size 1).
        # Tunnel vision still active. Expect baseline_xp + 7.
        task_math_2 = Task.objects.create(
            user=user,
            title="Math Homework 2",
            category="math",
            task_type=Task.TaskType.TODO,
        )
        res2 = complete_task(user, task_math_2.id)
        assert res2["rewards"]["xp"] == baseline_xp + 7

        # Complete coding task. Now unique subjects today has both ["math", "coding"] (size 2).
        # Tunnel vision bonus lost. Expect normal baseline_xp.
        res3 = complete_task(user, task_coding.id)
        assert res3["rewards"]["xp"] == baseline_xp
