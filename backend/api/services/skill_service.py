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
            {
                "id": "algorithmic_cascade",
                "name": "ALGORITHMIC CASCADE",
                "mana": 50,
                "cooldown_h": 0,
            },
            {
                "id": "quantum_optimization",
                "name": "QUANTUM OPTIMIZATION",
                "mana": 90,
                "cooldown_h": 0,
            },
            {
                "id": "deep_work_surge",
                "name": "DEEP WORK SURGE",
                "mana": 100,
                "cooldown_h": 0,
            },
        ],
    },
    "ascetic": {
        "name": "THE ASCETIC",
        "color": "#9944ff",
        "max_mana": 100,
        "skills": [
            {
                "id": "eye_of_the_storm",
                "name": "EYE OF THE STORM",
                "mana": 40,
                "cooldown_h": 0,
            },
            {
                "id": "inner_sanctuary",
                "name": "INNER SANCTUARY",
                "mana": 60,
                "cooldown_h": 0,
            },
            {
                "id": "enlightenment",
                "name": "ENLIGHTENMENT",
                "mana": 80,
                "cooldown_h": 0,
            },
        ],
    },
    "linguist": {
        "name": "THE LINGUIST",
        "color": "#00cc88",
        "max_mana": 110,
        "skills": [
            {
                "id": "rosetta_protocol",
                "name": "ROSETTA PROTOCOL",
                "mana": 40,
                "cooldown_h": 0,
            },
            {
                "id": "lexical_resonance",
                "name": "LEXICAL RESONANCE",
                "mana": 65,
                "cooldown_h": 0,
            },
            {
                "id": "cognitive_echo",
                "name": "COGNITIVE ECHO",
                "mana": 75,
                "cooldown_h": 0,
            },
        ],
    },
    "warlord": {
        "name": "THE WARLORD",
        "color": "#ff3355",
        "max_mana": 110,
        "skills": [
            {
                "id": "execution",
                "name": "EXECUTION",
                "mana": 65,
                "cooldown_h": 0,
            },
            {
                "id": "blood_harvest",
                "name": "BLOOD HARVEST",
                "mana": 50,
                "cooldown_h": 0,
            },
            {
                "id": "titans_roar",
                "name": "TITAN'S ROAR",
                "mana": 75,
                "cooldown_h": 0,
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



class SkillActivationResult(tuple):
    """
    Tuple subclass for backward-compatibility.
    Unpacks as 4 elements: (success, message, class_data, effects).
    Exposes .combat property: result.combat -> combat_result dictionary or None.
    """

    def __new__(cls, success, message, class_data, effects, combat=None):
        instance = super().__new__(cls, (success, message, class_data, effects))
        instance.combat = combat
        return instance


# ─── Активация скилла ────────────────────────────────────────────────────


SKILL_ALIASES = {
    # architect
    "blueprint": "algorithmic_cascade",
    "system_overload": "deep_work_surge",
    "infinite_loop": "quantum_optimization",
    # ascetic
    "iron_fast": "eye_of_the_storm",
    "meditation": "inner_sanctuary",
    "transcendence": "enlightenment",
    # linguist
    "babel_mode": "rosetta_protocol",
    "polyglot_surge": "lexical_resonance",
    "memetic_transfer": "cognitive_echo",
    # warlord
    "battle_fury": "execution",
    "war_cry": "titans_roar",
    "tactical_retreat": "blood_harvest",
}


@transaction.atomic
def activate_skill(user, skill_id):
    """
    Активирует скилл для пользователя с использованием транзакции.
    Возвращает (success, message, class_data, effects).
    """
    # Resolve skill ID aliases for backward-compatibility
    resolved_id = SKILL_ALIASES.get(skill_id, skill_id)

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

    skill_def: Any = next(
        (s for s in class_def["skills"] if s["id"] in [skill_id, resolved_id]), None
    )
    if not skill_def:
        return (
            False,
            f"Skill {skill_id} does not belong to class {char_class}",
            None,
            None,
        )

    # Use resolved canonical skill ID for mechanics
    canonical_id = skill_def["id"]


    # Ensure pure combat attack skills have a target before charging mana
    from api.models import BossEncounter

    if skill_id in ["lexical_resonance", "execution"]:
        has_active_boss = BossEncounter.objects.filter(
            user=profile.user, is_defeated=False
        ).exists()
        if not has_active_boss:
            return (
                False,
                "No active boss encounter to target! Summon a boss from Scrolls first.",
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

    # Mindguard: reduces mana cost of active skills by 15%
    if has_mindguard:
        effective_mana_cost = math.floor(effective_mana_cost * 0.85)

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

    # Проверка кулдауна (только если у скилла настроен кулдаун > 0)
    if skill_def.get("cooldown_h", 0) > 0:
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

    # Ставим кулдаун (только если кулдаун > 0)
    effective_cooldown_h = skill_def.get("cooldown_h", 0)
    if effective_cooldown_h > 0:
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
    effect_data, combat_result = _create_effect(canonical_id, profile)

    if effect_data:
        ActiveEffect.objects.update_or_create(
            user=profile.user,
            effect_id=effect_data["effect_id"],
            defaults={
                "skill_id": canonical_id,
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
        passive_combat = apply_boss_damage(profile.user, skill_boss_damage)
        if not combat_result:
            combat_result = passive_combat

    # Refresh profile if combat occurred so mana/gold/xp/sp are up to date
    if combat_result:
        profile.refresh_from_db()

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

    return SkillActivationResult(
        True, f"{skill_def['name']} activated!", class_data, list(effects_qs), combat=combat_result
    )


def _create_effect(skill_id, profile):
    """Создаёт данные эффекта в зависимости от skill_id."""
    now = timezone.now()

    base = {
        # Architect
        "algorithmic_cascade": (
            "algorithmic_cascade_effect",
            {"cascade_streak": 0},
            get_midnight(),
        ),
        "quantum_optimization": (
            "quantum_optimization_effect",
            {"tasksRemaining": 4, "goldBoost": 0.80, "manaPerTask": 15},
            get_midnight(),
        ),
        "deep_work_surge": (
            "deep_work_surge_effect",
            {"active": True},
            None,
        ),
        # Ascetic
        "eye_of_the_storm": (
            "eye_of_the_storm_effect",
            {"immune_to_penalties": True, "heal_per_task": 8, "mana_per_task": 4},
            get_midnight(),
        ),
        "inner_sanctuary": (
            "inner_sanctuary_effect",
            {"active": True},
            None,
        ),
        "enlightenment": (
            "enlightenment_effect",
            {"always_crit": True, "crit_damage_mult": 2.5},
            now + timedelta(hours=12),
        ),
        # Linguist
        "rosetta_protocol": (
            "rosetta_protocol_effect",
            {"rosetta_xp_boost": 0.35, "cognitiveBoost": 0.20},
            get_midnight(),
        ),
        "lexical_resonance": (
            "lexical_resonance_effect",
            {"active": True},
            None,
        ),  # мгновенный пси-урон
        "cognitive_echo": (
            "cognitive_echo_effect",
            {"active": True, "charges": 1},
            now + timedelta(hours=24),
        ),
        # Warlord
        "execution": (
            "execution_effect",
            {"active": True},
            None,
        ),  # мгновенное добивание
        "blood_harvest": (
            "blood_harvest_effect",
            {"boss_damage_boost": 0.40, "vampirism_ratio": 0.20},
            now + timedelta(hours=24),
        ),
        "titans_roar": (
            "titans_roar_effect",
            {"boss_stunned": True, "charges": 3, "damage_mult": 2.0},
            get_midnight(),
        ),
    }

    entry = base.get(skill_id)
    if not entry:
        return None, None

    effect_id, data, expires_at = entry

    from api.models import BossEncounter

    # Мгновенные эффекты

    if skill_id == "lexical_resonance":
        total_stats = (
            profile.total_stats
            if hasattr(profile, "total_stats") and isinstance(profile.total_stats, dict)
            else {}
        )
        mem = total_stats.get("mem", getattr(profile, "base_mem", 10) or 10)
        foc = total_stats.get("foc", getattr(profile, "base_foc", 10) or 10)
        direct_damage = max(50, int(mem * 8 + foc * 6))

        combat_result = apply_boss_damage(profile.user, direct_damage)
        return None, combat_result

    if skill_id == "deep_work_surge":
        import zoneinfo
        from django.db.models import Sum
        from api.models import TrainingSession
        from api.services.profile_service import gain_xp

        try:
            user_tz = zoneinfo.ZoneInfo(profile.timezone or "UTC")
        except Exception:
            user_tz = zoneinfo.ZoneInfo("UTC")
        local_today = timezone.now().astimezone(user_tz).date()

        total_hours = (
            TrainingSession.objects.filter(
                user_profile=profile, created_at__date=local_today
            ).aggregate(total=Sum("hours"))["total"]
            or 0.0
        )
        total_stats = (
            profile.total_stats
            if hasattr(profile, "total_stats") and isinstance(profile.total_stats, dict)
            else {}
        )
        foc = total_stats.get("foc", getattr(profile, "base_foc", 10) or 10)
        direct_damage = max(100, int(total_hours * 150 + foc * 10))
        bonus_xp = int(total_hours * 30)

        if bonus_xp > 0:
            gain_xp(profile, bonus_xp)
            profile.rank_xp = max(0, profile.rank_xp + bonus_xp)
            profile.save(update_fields=["rank_xp"])

        combat_result = apply_boss_damage(profile.user, direct_damage)
        return None, combat_result

    if skill_id == "inner_sanctuary":
        heal_amount = max(1, int(profile.max_hp * 0.50))
        profile.hp = min(profile.max_hp, profile.hp + heal_amount)
        profile.save(update_fields=["hp"])
        return None, None

    if skill_id == "execution":
        total_stats = (
            profile.total_stats
            if hasattr(profile, "total_stats") and isinstance(profile.total_stats, dict)
            else {}
        )
        pwr = total_stats.get("pwr", getattr(profile, "base_pwr", 10) or 10)

        encounter = BossEncounter.objects.filter(
            user=profile.user, is_defeated=False
        ).first()
        combat_result = None
        if encounter and encounter.boss:
            hp_max = max(1, encounter.boss.hp_max)
            hp_ratio = encounter.hp_current / hp_max
            is_execute = (hp_ratio <= 0.35)
            if is_execute:
                direct_damage = max(encounter.hp_current, int(pwr * 20))
            else:
                direct_damage = max(50, int(pwr * 8))

            combat_result = apply_boss_damage(profile.user, direct_damage, is_crit=is_execute)
        return None, combat_result

    if skill_id == "titans_roar":
        encounter = BossEncounter.objects.filter(
            user=profile.user, is_defeated=False
        ).first()
        combat_result = None
        if encounter and encounter.boss:
            dmg = int(encounter.boss.hp_max * 0.15)
            combat_result = apply_boss_damage(profile.user, dmg)
        return {"effect_id": effect_id, "data": data, "expires_at": expires_at}, combat_result

    return {"effect_id": effect_id, "data": data, "expires_at": expires_at}, None


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
        # ALGORITHMIC CASCADE: streak and reward bonuses
        if effect.skill_id == "algorithmic_cascade":
            streak = effect.data.get("cascade_streak", 0)
            bonus_pct = int(min(0.60, streak * 0.10) * 100)
            result["notes"].append(f"ALGORITHMIC CASCADE: streak {streak} (+{bonus_pct}% rewards)")

        # QUANTUM OPTIMIZATION: +80% Gold, +15 MP за задачу
        if effect.skill_id == "quantum_optimization" and effect.data.get("tasksRemaining", 0) > 0:
            mana_gain = effect.data.get("manaPerTask", 15)
            profile.mana = min(profile.max_mana, profile.mana + mana_gain)
            rem = effect.data["tasksRemaining"] - 1
            if rem <= 0:
                effect.delete()
                result["effect_ids_consumed"].append(effect.effect_id)
            else:
                effect.data["tasksRemaining"] = rem
                effect.save(update_fields=["data"])
            result["notes"].append(f"QUANTUM OPTIMIZATION: +80% Gold, +{mana_gain} MP ({rem} remaining)")

        # EYE OF THE STORM: +8 HP, +4 MP за задачу
        if effect.skill_id == "eye_of_the_storm":
            heal = effect.data.get("heal_per_task", 8)
            mana_gain = effect.data.get("mana_per_task", 4)
            profile.hp = min(profile.max_hp, profile.hp + heal)
            profile.mana = min(profile.max_mana, profile.mana + mana_gain)
            result["hp_heal"] += heal
            result["notes"].append(f"EYE OF THE STORM: +{heal} HP, +{mana_gain} MP")

        # TITAN'S ROAR: уменьшаем счетчик ударов с удвоенным уроном
        if effect.skill_id == "titans_roar" and effect.data.get("charges", 0) > 0:
            rem = effect.data["charges"] - 1
            result["notes"].append(f"TITAN'S ROAR: 2x Boss Damage dealt! ({rem} remaining)")
            if rem <= 0:
                effect.delete()
                result["effect_ids_consumed"].append(effect.effect_id)
            else:
                effect.data["charges"] = rem
                effect.save(update_fields=["data"])

        # BLOOD HARVEST: вампиризм
        if effect.skill_id == "blood_harvest":
            result["notes"].append("BLOOD HARVEST: +40% Boss DMG, 20% Vampiric HP Heal")

        # COGNITIVE ECHO: отмечаем удвоение
        if effect.skill_id == "cognitive_echo":
            result["notes"].append("COGNITIVE ECHO: 2x all rewards!")

    if result["hp_heal"] > 0:
        profile.save(update_fields=["hp"])

    # Чистим истекшие
    ActiveEffect.objects.filter(
        user=profile.user, expires_at__lt=timezone.now()
    ).delete()

    return result
