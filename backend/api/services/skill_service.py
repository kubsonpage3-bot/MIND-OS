"""
MIND OS — Skill Service.
Вся логика активации и применения скиллов на стороне сервера.
"""

import math
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from api.models import UserProfile, ActiveEffect, SkillCooldown, UnlockedSkill
from typing import Any
from .mechanics import get_passive_multipliers, apply_boss_damage

# ─── Определения классов и скиллов (зеркало rpgSystem.js) ─────────────────

CLASS_DEFS = {
    "architect": {
        "name": "THE ARCHITECT",
        "color": "#00e5ff",
        "max_mana": 120,
        "skills": [
            {"id": "blueprint", "name": "BLUEPRINT", "mana": 40, "cooldown_h": 24},
            {
                "id": "system_overload",
                "name": "SYSTEM OVERLOAD",
                "mana": 70,
                "cooldown_h": 24,
            },
            {
                "id": "infinite_loop",
                "name": "INFINITE LOOP",
                "mana": 100,
                "cooldown_h": 24,
            },
        ],
    },
    "ascetic": {
        "name": "THE ASCETIC",
        "color": "#9944ff",
        "max_mana": 100,
        "skills": [
            {"id": "iron_fast", "name": "IRON FAST", "mana": 35, "cooldown_h": 24},
            {"id": "meditation", "name": "MEDITATION", "mana": 60, "cooldown_h": 24},
            {
                "id": "transcendence",
                "name": "TRANSCENDENCE",
                "mana": 90,
                "cooldown_h": 24,
            },
        ],
    },
    "linguist": {
        "name": "THE LINGUIST",
        "color": "#00cc88",
        "max_mana": 110,
        "skills": [
            {"id": "babel_mode", "name": "BABEL MODE", "mana": 40, "cooldown_h": 24},
            {
                "id": "polyglot_surge",
                "name": "POLYGLOT SURGE",
                "mana": 65,
                "cooldown_h": 24,
            },
            {
                "id": "memetic_transfer",
                "name": "MEMETIC TRANSFER",
                "mana": 95,
                "cooldown_h": 24,
            },
        ],
    },
    "warlord": {
        "name": "THE WARLORD",
        "color": "#ff3355",
        "max_mana": 110,
        "skills": [
            {"id": "battle_fury", "name": "BATTLE FURY", "mana": 45, "cooldown_h": 24},
            {"id": "war_cry", "name": "WAR CRY", "mana": 75, "cooldown_h": 24},
            {
                "id": "tactical_retreat",
                "name": "TACTICAL RETREAT",
                "mana": 80,
                "cooldown_h": 24,
            },
        ],
    },
}


def get_midnight():
    """Возвращает datetime следующей полуночи."""
    now = timezone.now()
    return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)


def _fmt_td(td):
    """Форматирует timedelta в читаемый вид."""
    total = int(td.total_seconds())
    h, m = divmod(total, 3600)
    m, s = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


# ─── Активация скилла ────────────────────────────────────────────────────


@transaction.atomic
def activate_skill(user, skill_id):
    """
    Активирует скилл для пользователя с использованием транзакции.
    Возвращает (success, message, class_data, effects).
    """
    # Блокируем профиль для защиты от гонки (race conditions)
    profile, _ = UserProfile.objects.select_for_update().get_or_create(user=user)

    active_mutators = profile.active_mutators or {}
    active_list = (
        active_mutators.get("active", []) if isinstance(active_mutators, dict) else []
    )
    active_ids = [m.get("id") if isinstance(m, dict) else m for m in active_list]

    if "silence" in active_ids:
        return False, "Silence mutator is active. Cannot use skills.", None, None

    char_class = profile.character_class
    from typing import Any

    class_def: Any = CLASS_DEFS.get(char_class)
    if not class_def:
        return False, f"Unknown class: {char_class}", None, None

    skill_def: Any = next((s for s in class_def["skills"] if s["id"] == skill_id), None)
    if not skill_def:
        return (
            False,
            f"Skill {skill_id} does not belong to class {char_class}",
            None,
            None,
        )

    # Passives checks
    has_void_clarity = UnlockedSkill.objects.filter(
        user_profile=profile, skill_code="void_clarity"
    ).exists()
    has_mindguard = UnlockedSkill.objects.filter(
        user_profile=profile, skill_code="mindguard"
    ).exists()

    print(
        f"[Skill Activation] User '{user.username}' is activating skill '{skill_id}'. Base mana cost: {skill_def['mana']}."
    )

    effective_mana_cost = skill_def["mana"]
    used_void_clarity = False

    # Meditation active effect: reduces mana cost of other skills by 50%
    has_meditation = ActiveEffect.objects.filter(
        user=profile.user, skill_id="meditation"
    ).exists()
    if has_meditation and skill_id != "meditation":
        effective_mana_cost = math.floor(effective_mana_cost * 0.5)
        print(
            f"[Skill Activation] Meditation active. Reducing mana cost by 50% to: {effective_mana_cost}."
        )

    if has_void_clarity:
        now = timezone.now()
        if (
            profile.void_clarity_last_used is None
            or (now - profile.void_clarity_last_used).days >= 7
        ):
            effective_mana_cost = 0
            used_void_clarity = True

    passive_effects = get_passive_multipliers(profile, {})
    effective_mana_cost -= passive_effects.get("skill_mana_cost_reduction", 0)
    effective_mana_cost = max(0, effective_mana_cost)

    used_hex_free_skill = False
    if passive_effects.get("daily_free_skill", False):
        hex_free_effect = ActiveEffect.objects.filter(
            user=profile.user, effect_id="hex_daily_free_skill_used"
        ).first()
        if not hex_free_effect:
            effective_mana_cost = 0
            used_hex_free_skill = True

    # Проверка ресурсов (Vivian Level 1 Blood Magic mana fallback to HP)
    hp_cost = 0
    mana_to_deduct = effective_mana_cost

    if (
        passive_effects.get("vivian_blood_magic", False)
        and profile.mana < effective_mana_cost
    ):
        missing_mana = effective_mana_cost - profile.mana
        hp_cost = math.ceil(missing_mana / 2.0)
        mana_to_deduct = profile.mana

    if profile.mana < mana_to_deduct or (hp_cost > 0 and profile.hp < hp_cost):
        return (
            False,
            f"Not enough mana: requires {effective_mana_cost} Mana (or equivalent HP)",
            None,
            None,
        )

    # Проверка кулдауна
    cd = SkillCooldown.objects.filter(user=profile.user, skill_id=skill_id).first()
    if cd and cd.cooldown_until > timezone.now():
        remaining = cd.cooldown_until - timezone.now()
        return False, f"Cooldown: {_fmt_td(remaining)} remaining", None, None

    # Списываем ресурсы
    if mana_to_deduct > 0:
        profile.mana -= mana_to_deduct

    if hp_cost > 0:
        profile.hp = max(0, profile.hp - hp_cost)
        from api.services.profile_service import check_death

        check_death(profile)
    save_fields = ["mana"]
    if hp_cost > 0:
        save_fields.append("hp")

    if used_void_clarity:
        profile.void_clarity_last_used = timezone.now()
        save_fields.append("void_clarity_last_used")

    profile.save(update_fields=save_fields)

    # Ставим кулдаун
    effective_cooldown_h = skill_def["cooldown_h"]
    if has_mindguard:
        effective_cooldown_h *= 0.85

    cooldown_reduction = passive_effects.get("cooldown_reduction", 0.0)
    if cooldown_reduction > 0:
        effective_cooldown_h *= 1.0 - cooldown_reduction

    cd_until = timezone.now() + timedelta(hours=effective_cooldown_h)
    SkillCooldown.objects.update_or_create(
        user=profile.user,
        skill_id=skill_id,
        defaults={"cooldown_until": cd_until},
    )

    # Создаём эффект
    effect_data = _create_effect(skill_id, profile)

    if effect_data:
        ActiveEffect.objects.update_or_create(
            user=profile.user,
            effect_id=effect_data["effect_id"],
            defaults={
                "skill_id": skill_id,
                "data": effect_data["data"],
                "expires_at": effect_data["expires_at"],
            },
        )

    if used_hex_free_skill:
        ActiveEffect.objects.update_or_create(
            user=profile.user,
            effect_id="hex_daily_free_skill_used",
            defaults={
                "skill_id": "hex_passive",
                "data": {},
                "expires_at": get_midnight(),
            },
        )

    # Bran Level 4: lose 1 HP for every skill activated
    if passive_effects.get("bran_overdrive", False):
        profile.hp = max(0, profile.hp - 1)
        from api.services.profile_service import check_death

        check_death(profile)
        profile.save(update_fields=["hp"])

    skill_boss_damage = passive_effects.get("skill_boss_damage", 0)
    if skill_boss_damage > 0:
        apply_boss_damage(profile.user, skill_boss_damage)

    # Собираем ответ
    effects_qs = ActiveEffect.objects.filter(user=profile.user).values(
        "effect_id", "skill_id", "data", "expires_at"
    )

    cooldowns_qs = SkillCooldown.objects.filter(user=profile.user)

    class_data = {
        "chosen": profile.character_class,
        "mana": profile.mana,
        "max_mana": class_def["max_mana"],
        "skills": [
            {
                "id": c.skill_id,
                "cooldownUntil": int(c.cooldown_until.timestamp() * 1000),
            }
            for c in cooldowns_qs
        ],
    }

    return True, f"{skill_def['name']} activated!", class_data, list(effects_qs)


def _create_effect(skill_id, profile):
    """Создаёт данные эффекта в зависимости от skill_id."""
    now = timezone.now()

    base = {
        "blueprint": (
            "blueprint_effect",
            {"tasksRemaining": 3, "xpBoost": 0.5},
            get_midnight(),
        ),
        "system_overload": (
            "system_overload_effect",
            {"damageMultiplier": 3, "active": True},
            now + timedelta(hours=24),
        ),
        "infinite_loop": (
            "infinite_loop_effect",
            {"cognitiveMetricsBoost": 2},
            now + timedelta(hours=2),
        ),
        "iron_fast": (
            "iron_fast_effect",
            {"healingPerTask": 5, "noDailyPenalty": True},
            now + timedelta(hours=24),
        ),
        "meditation": (
            "meditation_effect",
            {"sessionsRemaining": 3, "focusBoost": 0.3},
            now + timedelta(hours=12),
        ),
        "transcendence": (
            "transcendence_effect",
            {"streakCannotBreak": True, "rivalXPFrozen": True},
            now + timedelta(hours=48),
        ),
        "babel_mode": (
            "babel_mode_effect",
            {"tripleSubjectCount": True},
            get_midnight(),
        ),
        "polyglot_surge": (
            "polyglot_surge_effect",
            {"virtualHours": 2},
            None,
        ),  # мгновенный
        "memetic_transfer": (
            "memetic_transfer_effect",
            {"memoryTaskProgressBoost": 2, "mirrorGcVmToGf": True},
            now + timedelta(hours=24),
        ),
        "battle_fury": (
            "battle_fury_effect",
            {"physicalDamageBoost": 0.5, "manaRegenPenalty": 0.2},
            now + timedelta(hours=1),
        ),
        "war_cry": (
            "war_cry_effect",
            {"bossHPPercentReduction": 0.10, "stunBossFor": 3600},
            now + timedelta(hours=1),
        ),
        "tactical_retreat": (
            "tactical_retreat_effect",
            {"manaRestored": True},
            None,
        ),  # мгновенный
    }

    entry = base.get(skill_id)
    if not entry:
        return None

    effect_id, data, expires_at = entry

    from api.models import BossEncounter

    # Мгновенные эффекты

    if skill_id == "polyglot_surge":
        from api.services.mechanics import calculate_cognitive_gains

        gains = calculate_cognitive_gains("languages", 2, 1.0, profile)
        profile.gf = (profile.gf or 100.0) + gains.get("gf", 0)
        profile.gc = (profile.gc or 100.0) + gains.get("gc", 0)
        profile.ps = (profile.ps or 100.0) + gains.get("ps", 0)
        profile.vm = (profile.vm or 100.0) + gains.get("vm", 0)
        profile.save(update_fields=["gf", "gc", "ps", "vm"])
        return None

    if skill_id == "war_cry":
        encounter = BossEncounter.objects.filter(
            user=profile.user, is_defeated=False
        ).first()
        if encounter and encounter.boss:
            dmg = int(encounter.boss.hp_max * 0.10)
            encounter.hp_current = max(0, encounter.hp_current - dmg)
            # Ensure boss doesn't die instantly from war_cry (must be finished by a task or click)
            if encounter.hp_current <= 0:
                encounter.hp_current = 1
            encounter.save(update_fields=["hp_current"])
        # Return the effect for the stun duration
        return {"effect_id": effect_id, "data": data, "expires_at": expires_at}

    if skill_id == "tactical_retreat":
        mana_restore = math.floor(profile.max_mana * 0.25)
        profile.mana = min(profile.max_mana, profile.mana + mana_restore)
        profile.save(update_fields=["mana"])
        encounter = BossEncounter.objects.filter(
            user=profile.user, is_defeated=False
        ).first()
        if encounter and encounter.boss:
            encounter.hp_current = encounter.boss.hp_max
            encounter.save(update_fields=["hp_current"])
        return None

    return {"effect_id": effect_id, "data": data, "expires_at": expires_at}


# ─── Применение эффектов после выполнения задачи ─────────────────────────


def apply_effects_on_task_complete(profile, task):
    """
    Вызывается ПОСЛЕ начисления базовых наград.
    Возвращает { xp_bonus, hp_heal, effect_ids_consumed, notes }.
    """
    # Сначала удаляем протухшие
    ActiveEffect.objects.filter(
        user=profile.user, expires_at__lt=timezone.now()
    ).delete()

    effects = ActiveEffect.objects.filter(user=profile.user)
    result: dict[str, Any] = {
        "xp_bonus": 0,
        "hp_heal": 0,
        "effect_ids_consumed": [],
        "notes": [],
        "system_overload_triggered": False,
    }

    for effect in effects:
        # BLUEPRINT: +50% XP за следующие 3 задачи
        if effect.skill_id == "blueprint" and effect.data.get("tasksRemaining", 0) > 0:
            bonus = math.floor(task.get_rewards()["xp"] * effect.data["xpBoost"])
            result["xp_bonus"] += bonus
            remaining = effect.data["tasksRemaining"] - 1
            if remaining <= 0:
                effect.delete()
                result["effect_ids_consumed"].append(effect.effect_id)
            else:
                effect.data["tasksRemaining"] = remaining
                effect.save(update_fields=["data"])
            result["notes"].append(f"BLUEPRINT: +{bonus} XP")

        # IRON FAST: +5 HP за задачу
        if effect.skill_id == "iron_fast":
            heal = effect.data.get("healingPerTask", 5)
            profile.hp = min(profile.max_hp, profile.hp + heal)
            result["hp_heal"] += heal
            result["notes"].append(f"IRON FAST: +{heal} HP")

        # SYSTEM OVERLOAD: помечаем как готовый к потреблению
        if effect.skill_id == "system_overload" and effect.data.get("active"):
            result["notes"].append("SYSTEM OVERLOAD: 3x boss damage ready!")
            result["system_overload_triggered"] = True
            effect.data["active"] = False
            effect.save(update_fields=["data"])

    if result["hp_heal"] > 0:
        profile.save(update_fields=["hp"])

    # Чистим истекшие
    ActiveEffect.objects.filter(
        user=profile.user, expires_at__lt=timezone.now()
    ).delete()

    return result
