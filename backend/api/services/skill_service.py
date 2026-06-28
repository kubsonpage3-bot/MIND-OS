"""
MIND OS — Skill Service.
Вся логика активации и применения скиллов на стороне сервера.
"""
import math
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from api.models import UserProfile, ActiveEffect, SkillCooldown

# ─── Определения классов и скиллов (зеркало rpgSystem.js) ─────────────────

CLASS_DEFS = {
    "architect": {
        "name": "THE ARCHITECT", "color": "#00e5ff", "max_mana": 120,
        "skills": [
            {"id": "blueprint",       "name": "BLUEPRINT",       "mana": 40,  "cooldown_h": 24},
            {"id": "system_overload", "name": "SYSTEM OVERLOAD", "mana": 70,  "cooldown_h": 24},
            {"id": "infinite_loop",   "name": "INFINITE LOOP",   "mana": 100, "cooldown_h": 24},
        ],
    },
    "ascetic": {
        "name": "THE ASCETIC", "color": "#9944ff", "max_mana": 100,
        "skills": [
            {"id": "iron_fast",      "name": "IRON FAST",      "mana": 35,  "cooldown_h": 24},
            {"id": "contemplate",    "name": "CONTEMPLATE",    "mana": 60,  "cooldown_h": 24},
            {"id": "transcendence",  "name": "TRANSCENDENCE",  "mana": 90,  "cooldown_h": 24},
        ],
    },
    "linguist": {
        "name": "THE LINGUIST", "color": "#00cc88", "max_mana": 110,
        "skills": [
            {"id": "babel_mode",       "name": "BABEL MODE",       "mana": 40,  "cooldown_h": 24},
            {"id": "polyglot_surge",   "name": "POLYGLOT SURGE",   "mana": 65,  "cooldown_h": 24},
            {"id": "memetic_transfer", "name": "MEMETIC TRANSFER", "mana": 95,  "cooldown_h": 24},
        ],
    },
    "warlord": {
        "name": "THE WARLORD", "color": "#ff3355", "max_mana": 110,
        "skills": [
            {"id": "battle_fury",      "name": "BATTLE FURY",      "mana": 45,  "cooldown_h": 24},
            {"id": "war_cry",          "name": "WAR CRY",          "mana": 75,  "cooldown_h": 24},
            {"id": "tactical_retreat", "name": "TACTICAL RETREAT", "mana": 80,  "cooldown_h": 24},
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
    
    char_class = profile.character_class
    class_def = CLASS_DEFS.get(char_class)
    if not class_def:
        return False, f"Unknown class: {char_class}", None, None

    skill_def = next((s for s in class_def["skills"] if s["id"] == skill_id), None)
    if not skill_def:
        return False, f"Skill {skill_id} does not belong to class {char_class}", None, None

    # Проверка маны
    if profile.mana < skill_def["mana"]:
        return False, f"Not enough mana: requires {skill_def['mana']}, available {profile.mana}", None, None

    # Проверка кулдауна
    cd = SkillCooldown.objects.filter(user=profile.user, skill_id=skill_id).first()
    if cd and cd.cooldown_until > timezone.now():
        remaining = cd.cooldown_until - timezone.now()
        return False, f"Cooldown: {_fmt_td(remaining)} remaining", None, None

    # Списываем ману
    profile.mana -= skill_def["mana"]
    profile.save(update_fields=["mana"])

    # Ставим кулдаун
    cd_until = timezone.now() + timedelta(hours=skill_def["cooldown_h"])
    SkillCooldown.objects.update_or_create(
        user=profile.user, skill_id=skill_id,
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
            }
        )

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
            {"id": c.skill_id, "cooldownUntil": int(c.cooldown_until.timestamp() * 1000)}
            for c in cooldowns_qs
        ],
    }

    return True, f"{skill_def['name']} activated!", class_data, list(effects_qs)


def _create_effect(skill_id, profile):
    """Создаёт данные эффекта в зависимости от skill_id."""
    now = timezone.now()

    base = {
        "blueprint":       ("blueprint_effect",       {"tasksRemaining": 3, "xpBoost": 0.5},                         get_midnight()),
        "system_overload": ("system_overload_effect", {"damageMultiplier": 3, "active": True},                      now + timedelta(hours=24)),
        "infinite_loop":   ("infinite_loop_effect",   {"cognitiveMetricsBoost": 2},                                 now + timedelta(hours=2)),
        "iron_fast":       ("iron_fast_effect",       {"healingPerTask": 5, "noDailyPenalty": True},                now + timedelta(hours=24)),
        "contemplate":     ("contemplate_effect",     {},                                                           None),  # мгновенный
        "transcendence":   ("transcendence_effect",   {"streakCannotBreak": True, "rivalXPFrozen": True},           now + timedelta(hours=48)),
        "babel_mode":      ("babel_mode_effect",      {"tripleSubjectCount": True},                                 get_midnight()),
        "polyglot_surge":  ("polyglot_surge_effect",  {"virtualHours": 2},                                          None),  # мгновенный
        "memetic_transfer":("memetic_transfer_effect",{"memoryTaskProgressBoost": 2, "mirrorGcVmToGf": True},       now + timedelta(hours=24)),
        "battle_fury":     ("battle_fury_effect",     {"physicalDamageBoost": 0.5, "manaRegenPenalty": 0.2},       now + timedelta(hours=1)),
        "war_cry":         ("war_cry_effect",         {"bossHPPercentReduction": 0.10, "stunBossFor": 3600},       now + timedelta(hours=1)),
        "tactical_retreat":("tactical_retreat_effect",{"manaRestored": True},                                       None),  # мгновенный
    }

    entry = base.get(skill_id)
    if not entry:
        return None

    effect_id, data, expires_at = entry

    # Мгновенные эффекты
    if skill_id == "contemplate":
        profile.gf = (profile.gf or 100.0) + 3
        profile.gc = (profile.gc or 100.0) + 3
        profile.ps = (profile.ps or 100.0) + 3
        profile.vm = (profile.vm or 100.0) + 3
        profile.save(update_fields=["gf", "gc", "ps", "vm"])
        return None

    if skill_id == "tactical_retreat":
        mana_restore = math.floor(profile.mana_max * 0.25)
        profile.mana = min(profile.mana_max, profile.mana + mana_restore)
        profile.save(update_fields=["mana"])
        return None

    return {"effect_id": effect_id, "data": data, "expires_at": expires_at}


# ─── Применение эффектов после выполнения задачи ─────────────────────────

def apply_effects_on_task_complete(profile, task):
    """
    Вызывается ПОСЛЕ начисления базовых наград.
    Возвращает { xp_bonus, hp_heal, effect_ids_consumed, notes }.
    """
    # Сначала удаляем протухшие
    ActiveEffect.objects.filter(user=profile.user, expires_at__lt=timezone.now()).delete()
    
    effects = ActiveEffect.objects.filter(user=profile.user)
    result = {"xp_bonus": 0, "hp_heal": 0, "effect_ids_consumed": [], "notes": []}

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
            profile.hp = min(profile.hp_max, profile.hp + heal)
            result["hp_heal"] += heal
            result["notes"].append(f"IRON FAST: +{heal} HP")

        # SYSTEM OVERLOAD: помечаем как готовый к потреблению
        if effect.skill_id == "system_overload" and effect.data.get("active"):
            result["notes"].append("SYSTEM OVERLOAD: 3x boss damage ready!")
            effect.data["active"] = False
            effect.save(update_fields=["data"])

        # MEMETIC TRANSFER: зеркалирование Gc/Vm → Gf
        if effect.skill_id == "memetic_transfer" and effect.data.get("mirrorGcVmToGf"):
            mirror_gain = (profile.gc or 100.0) * 0.005 + (profile.vm or 100.0) * 0.005
            profile.gf = (profile.gf or 100.0) + mirror_gain
            result["notes"].append(f"MEMETIC TRANSFER: +{mirror_gain:.2f} Gf")

    if result["hp_heal"] > 0:
        profile.save(update_fields=["hp"])

    # Чистим истекшие
    ActiveEffect.objects.filter(
        user=profile.user, expires_at__lt=timezone.now()
    ).delete()

    return result
