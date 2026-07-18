import logging
from typing import Dict, Any
from django.utils import timezone

logger = logging.getLogger(__name__)

TITLES_CATALOG = [
    # ── 🌙 TIME & RHYTHM (6) ──────────────────────────────────────────────────
    {
        "id": "night_owl",
        "name": "Ночной Волк",
        "icon": "🌙",
        "category": "time",
        "color": "#a855f7",
        "description": "Выполнить более 5 ночных задач (23:00 – 05:00)",
        "priority": 85,
    },
    {
        "id": "early_bird",
        "name": "Ранняя Пташка",
        "icon": "🌅",
        "category": "time",
        "color": "#f59e0b",
        "description": "Выполнить более 5 утренних задач (05:00 – 08:00)",
        "priority": 85,
    },
    {
        "id": "noonday_sentinel",
        "name": "Полуденный Воин",
        "icon": "☀️",
        "category": "time",
        "color": "#eab308",
        "description": "Выполнить 10+ задач в обеденное время (12:00 – 14:00)",
        "priority": 60,
    },
    {
        "id": "twilight_hunter",
        "name": "Сумеречный Охотник",
        "icon": "🌆",
        "category": "time",
        "color": "#f97316",
        "description": "Выполнить 15+ вечерних задач (18:00 – 21:00)",
        "priority": 65,
    },
    {
        "id": "weekend_warrior",
        "name": "Властелин Выходных",
        "icon": "🍷",
        "category": "time",
        "color": "#ec4899",
        "description": "Выполнить 10+ задач в субботу и воскресенье",
        "priority": 70,
    },
    {
        "id": "midnight_alchemist",
        "name": "Полуночный Алхимик",
        "icon": "🌌",
        "category": "time",
        "color": "#8b5cf6",
        "description": "Завершить тренировку или задачу ровно в полночь (00:00 - 01:00)",
        "priority": 90,
    },
    # ── 🔥 STREAK & CONSISTENCY (6) ───────────────────────────────────────────
    {
        "id": "ignited",
        "name": "Пламенный",
        "icon": "🔥",
        "category": "streak",
        "color": "#f97316",
        "description": "Удерживать ежедневный стрик 7+ дней",
        "priority": 40,
    },
    {
        "id": "marathoner",
        "name": "Марафонец",
        "icon": "🏃",
        "category": "streak",
        "color": "#eab308",
        "description": "Удерживать ежедневный стрик 30+ дней",
        "priority": 80,
    },
    {
        "id": "iron_will",
        "name": "Железная Воля",
        "icon": "🛡️",
        "category": "streak",
        "color": "#3b82f6",
        "description": "Удерживать ежедневный стрик 60+ дней",
        "priority": 95,
    },
    {
        "id": "unbroken",
        "name": "Непреклонный",
        "icon": "⚡",
        "category": "streak",
        "color": "#a855f7",
        "description": "Удерживать ежедневный стрик 90+ дней",
        "priority": 110,
    },
    {
        "id": "time_legend",
        "name": "Легенда Времени",
        "icon": "👑",
        "category": "streak",
        "color": "#ef4444",
        "description": "Удерживать ежедневный стрик 180+ дней",
        "priority": 150,
    },
    {
        "id": "phoenix",
        "name": "Феникс",
        "icon": "🔥",
        "category": "streak",
        "color": "#f43f5e",
        "description": "Использовать активный бафф защиты стрика",
        "priority": 75,
    },
    # ── 🔬 SPECIALIZATIONS & XP DOMAINS (8) ───────────────────────────────────
    {
        "id": "bookworm",
        "name": "Книжный Червь",
        "icon": "📚",
        "category": "spec",
        "color": "#10b981",
        "description": "Заработать 100+ Gc (Language/Humanities) XP за неделю",
        "priority": 70,
    },
    {
        "id": "polyglot",
        "name": "Полиглот",
        "icon": "🌐",
        "category": "spec",
        "color": "#06b6d4",
        "description": "Набрать показатель Gc (Crystallized Intellect) ≥ 115",
        "priority": 85,
    },
    {
        "id": "architect_mind",
        "name": "Архитектор Мысли",
        "icon": "🏛️",
        "category": "spec",
        "color": "#3b82f6",
        "description": "Заработать 100+ Gf (Science/Logic) XP за неделю",
        "priority": 70,
    },
    {
        "id": "neuro_surgeon",
        "name": "Нейрохирург",
        "icon": "🧠",
        "category": "spec",
        "color": "#6366f1",
        "description": "Набрать показатель Скорости Обработки (Ps) ≥ 115",
        "priority": 85,
    },
    {
        "id": "archive_keeper",
        "name": "Хранитель Знаний",
        "icon": "📜",
        "category": "spec",
        "color": "#8b5cf6",
        "description": "Набрать показатель Вербальной Памяти (Vm) ≥ 115",
        "priority": 85,
    },
    {
        "id": "ascetic_scholar",
        "name": "Аскет-Мудрец",
        "icon": "🧘",
        "category": "spec",
        "color": "#10b981",
        "description": "Выбрать класс Аскет и выполнить 10+ задач",
        "priority": 65,
    },
    {
        "id": "linguist_sovereign",
        "name": "Повелитель Слов",
        "icon": "✍️",
        "category": "spec",
        "color": "#06b6d4",
        "description": "Выбрать класс Лингвист и выполнить 25+ задач",
        "priority": 75,
    },
    {
        "id": "warlord_guard",
        "name": "Воевода Гвардии",
        "icon": "🗡️",
        "category": "spec",
        "color": "#ef4444",
        "description": "Выбрать класс Варлорд и нанести 10+ атак боссу",
        "priority": 75,
    },
    # ── 🧪 MUTATORS & CRAFTING (6) ───────────────────────────────────────────
    {
        "id": "alchemist",
        "name": "Алхимик",
        "icon": "🧪",
        "category": "craft",
        "color": "#a855f7",
        "description": "Разблокировать 3+ мутатора",
        "priority": 65,
    },
    {
        "id": "grand_alchemist",
        "name": "Великий Алхимик",
        "icon": "⚗️",
        "category": "craft",
        "color": "#c084fc",
        "description": "Разблокировать 7+ мутаторов",
        "priority": 100,
    },
    {
        "id": "experimentalist",
        "name": "Экспериментатор",
        "icon": "🧫",
        "category": "craft",
        "color": "#e879f9",
        "description": "Включить 2+ активных мутатора одновременно",
        "priority": 80,
    },
    {
        "id": "rune_smith",
        "name": "Кузнец Рун",
        "icon": "🔨",
        "category": "craft",
        "color": "#f59e0b",
        "description": "Скрафтить 3+ предмета в кузнице",
        "priority": 70,
    },
    {
        "id": "potion_master",
        "name": "Мастер Зелий",
        "icon": "🍷",
        "category": "craft",
        "color": "#f43f5e",
        "description": "Использовать 5+ зелий из инвентаря",
        "priority": 60,
    },
    {
        "id": "relic_collector",
        "name": "Коллекционер Реликвий",
        "icon": "💎",
        "category": "craft",
        "color": "#38bdf8",
        "description": "Иметь 5+ предметов в инвентаре",
        "priority": 65,
    },
    # ── ⚔️ COMBAT & BOSS BATTLES (7) ───────────────────────────────────────────
    {
        "id": "boss_slayer",
        "name": "Убийца Боссов",
        "icon": "⚔️",
        "category": "combat",
        "color": "#ef4444",
        "description": "Победить хотя бы 1 рейд-босса",
        "priority": 70,
    },
    {
        "id": "giant_executioner",
        "name": "Палач Гигантов",
        "icon": "🪓",
        "category": "combat",
        "color": "#b91c1c",
        "description": "Победить 5+ рейд-боссов",
        "priority": 110,
    },
    {
        "id": "critical_striker",
        "name": "Мастер Крита",
        "icon": "💥",
        "category": "combat",
        "color": "#f97316",
        "description": "Совершить 10+ критических ударов",
        "priority": 65,
    },
    {
        "id": "darkness_bane",
        "name": "Разрушитель Тьмы",
        "icon": "🔱",
        "category": "combat",
        "color": "#8b5cf6",
        "description": "Нанести 500+ суммарного урона боссам",
        "priority": 90,
    },
    {
        "id": "tactician",
        "name": "Тактик Битвы",
        "icon": "🎯",
        "category": "combat",
        "color": "#0284c7",
        "description": "Применить активный боевой навык",
        "priority": 50,
    },
    {
        "id": "dark_receptionist",
        "name": "Тёмный Жнец",
        "icon": "🦇",
        "category": "combat",
        "color": "#4c1d95",
        "description": "Использовать навыки Тьмы",
        "priority": 85,
    },
    {
        "id": "chaos_lord",
        "name": "Властелин Хаоса",
        "icon": "🌀",
        "category": "combat",
        "color": "#d946ef",
        "description": "Активировать Контроль Хаоса",
        "priority": 85,
    },
    # ── ⏱️ POMODORO & PRODUCTIVITY (5) ───────────────────────────────────────
    {
        "id": "deep_work_master",
        "name": "Мастер Глубокой Работы",
        "icon": "⏱️",
        "category": "focus",
        "color": "#10b981",
        "description": "Завершить 5+ Pomodoro сессий",
        "priority": 60,
    },
    {
        "id": "zen_meditator",
        "name": "Дзен-Медитатор",
        "icon": "🧘‍♂️",
        "category": "focus",
        "color": "#06b6d4",
        "description": "Завершить 20+ Pomodoro сессий",
        "priority": 95,
    },
    {
        "id": "chronomancer",
        "name": "Хрономансер",
        "icon": "⏳",
        "category": "focus",
        "color": "#6366f1",
        "description": "Записать 25+ часов фокусированной работы",
        "priority": 100,
    },
    {
        "id": "sprint_champion",
        "name": "Стальной Спринтер",
        "icon": "⚡",
        "category": "focus",
        "color": "#eab308",
        "description": "Выполнить 5+ задач за один день",
        "priority": 65,
    },
    {
        "id": "unstoppable",
        "name": "Неостановимый",
        "icon": "🚀",
        "category": "focus",
        "color": "#ec4899",
        "description": "Выполнить 15+ задач за один день",
        "priority": 105,
    },
    # ── 🤝 PARTY & COMPANIONS (5) ─────────────────────────────────────────────
    {
        "id": "squad_commander",
        "name": "Командир Отряда",
        "icon": "🛡️",
        "category": "social",
        "color": "#3b82f6",
        "description": "Вступить в группу или создать свою Пати",
        "priority": 50,
    },
    {
        "id": "ally_patron",
        "name": "Покровитель Союзников",
        "icon": "🤝",
        "category": "social",
        "color": "#8b5cf6",
        "description": "Нанять хотя бы 1 соратника",
        "priority": 55,
    },
    {
        "id": "beast_master",
        "name": "Мастер Зверей",
        "icon": "🐾",
        "category": "social",
        "color": "#10b981",
        "description": "Нанять 3+ соратников",
        "priority": 85,
    },
    {
        "id": "inspiring_leader",
        "name": "Вдохновитель",
        "icon": "📣",
        "category": "social",
        "color": "#f59e0b",
        "description": "Применить группу или реакции в пати",
        "priority": 60,
    },
    {
        "id": "dynamic_duo",
        "name": "Дуэт Героев",
        "icon": "👥",
        "category": "social",
        "color": "#06b6d4",
        "description": "Находиться в пати с 2+ участниками",
        "priority": 65,
    },
    # ── 💰 ECONOMY & WEALTH (4) ───────────────────────────────────────────────
    {
        "id": "gold_digger",
        "name": "Золотоискатель",
        "icon": "🪙",
        "category": "wealth",
        "color": "#eab308",
        "description": "Заработать 250+ золота за всё время",
        "priority": 55,
    },
    {
        "id": "tycoon",
        "name": "Магнат MIND OS",
        "icon": "🏛️",
        "category": "wealth",
        "color": "#f59e0b",
        "description": "Заработать 1,500+ золота за всё время",
        "priority": 95,
    },
    {
        "id": "big_spender",
        "name": "Щедрый Покупатель",
        "icon": "🛍️",
        "category": "wealth",
        "color": "#ec4899",
        "description": "Купить 5+ товаров в магазине",
        "priority": 65,
    },
    {
        "id": "treasure_hunter",
        "name": "Кладоискатель",
        "icon": "📦",
        "category": "wealth",
        "color": "#a855f7",
        "description": "Открыть хотя бы 1 сундук сокровищ",
        "priority": 60,
    },
    # ── 🌟 RANKS & PRESTIGE (5) ───────────────────────────────────────────────
    {
        "id": "awakened_one",
        "name": "Пробуждённый",
        "icon": "✨",
        "category": "rank",
        "color": "#94a3b8",
        "description": "Завершить инициализацию профиля MIND OS",
        "priority": 10,
    },
    {
        "id": "mind_over_matter",
        "name": "Разум Над Материей",
        "icon": "⚛️",
        "category": "rank",
        "color": "#38bdf8",
        "description": "Выполнить 50+ задач суммарно",
        "priority": 75,
    },
    {
        "id": "pioneer",
        "name": "Первопроходец",
        "icon": "🔱",
        "category": "rank",
        "color": "#60a5fa",
        "description": "Достичь Ранга C или выше",
        "priority": 70,
    },
    {
        "id": "grandmaster",
        "name": "Грандмейстер",
        "icon": "👑",
        "category": "rank",
        "color": "#f59e0b",
        "description": "Достичь Ранга S или выше",
        "priority": 120,
    },
    {
        "id": "apex_sovereign",
        "name": "Верховный Соверен",
        "icon": "🌌",
        "category": "rank",
        "color": "#c084fc",
        "description": "Выполнить хотя бы 1 престиж-сброс",
        "priority": 150,
    },
]


def _evaluate_title_unlock(
    user, title_id: str, stats, profile, task_stats: Dict[str, Any]
) -> tuple[bool, float, str]:
    """
    Evaluates whether a specific title is unlocked for the user.
    Returns (is_unlocked, progress_pct, progress_text).
    """
    streak = profile.streak or 0
    total_tasks = stats.total_tasks_completed if stats else 0
    total_gold = stats.total_gold_earned if stats else 0
    bosses_def = stats.bosses_defeated if stats else 0
    boss_damage = stats.total_boss_damage if stats else 0
    crits = stats.total_crits if stats else 0

    if title_id == "awakened_one":
        return True, 100, "1 / 1"

    if title_id == "ignited":
        pct = min(100, (streak / 7) * 100)
        return streak >= 7, pct, f"{streak} / 7 дней"

    if title_id == "marathoner":
        pct = min(100, (streak / 30) * 100)
        return streak >= 30, pct, f"{streak} / 30 дней"

    if title_id == "iron_will":
        pct = min(100, (streak / 60) * 100)
        return streak >= 60, pct, f"{streak} / 60 дней"

    if title_id == "unbroken":
        pct = min(100, (streak / 90) * 100)
        return streak >= 90, pct, f"{streak} / 90 дней"

    if title_id == "time_legend":
        pct = min(100, (streak / 180) * 100)
        return streak >= 180, pct, f"{streak} / 180 дней"

    if title_id == "night_owl":
        count = task_stats.get("night_count", 0)
        pct = min(100, (count / 5) * 100)
        return count >= 5, pct, f"{count} / 5 ночных задач"

    if title_id == "early_bird":
        count = task_stats.get("morning_count", 0)
        pct = min(100, (count / 5) * 100)
        return count >= 5, pct, f"{count} / 5 утренних задач"

    if title_id == "noonday_sentinel":
        count = task_stats.get("noon_count", 0)
        pct = min(100, (count / 10) * 100)
        return count >= 10, pct, f"{count} / 10 полуденных задач"

    if title_id == "twilight_hunter":
        count = task_stats.get("evening_count", 0)
        pct = min(100, (count / 15) * 100)
        return count >= 15, pct, f"{count} / 15 вечерних задач"

    if title_id == "weekend_warrior":
        count = task_stats.get("weekend_count", 0)
        pct = min(100, (count / 10) * 100)
        return count >= 10, pct, f"{count} / 10 задач в выходные"

    if title_id == "midnight_alchemist":
        count = task_stats.get("midnight_exact", 0)
        return count >= 1, (100 if count >= 1 else 0), f"{count} / 1 полуночная задача"

    if title_id == "bookworm":
        weekly_xp = profile.weekly_xp or 0
        is_ling = profile.character_class == "Linguist" or (profile.gc >= 110)
        val = weekly_xp if is_ling else min(weekly_xp, 100)
        return val >= 100, min(100, (val / 100) * 100), f"{val} / 100 Gc XP"

    if title_id == "polyglot":
        val = profile.gc or 100
        return val >= 115, min(100, ((val - 100) / 15) * 100), f"{val:.1f} / 115 Gc"

    if title_id == "architect_mind":
        weekly_xp = profile.weekly_xp or 0
        is_arch = profile.character_class == "Architect" or (profile.gf >= 110)
        val = weekly_xp if is_arch else min(weekly_xp, 100)
        return val >= 100, min(100, (val / 100) * 100), f"{val} / 100 Gf XP"

    if title_id == "neuro_surgeon":
        val = profile.ps or 100
        return val >= 115, min(100, ((val - 100) / 15) * 100), f"{val:.1f} / 115 Ps"

    if title_id == "archive_keeper":
        val = profile.vm or 100
        return val >= 115, min(100, ((val - 100) / 15) * 100), f"{val:.1f} / 115 Vm"

    if title_id == "ascetic_scholar":
        is_asc = profile.character_class == "Ascetic"
        count = total_tasks if is_asc else 0
        return (
            is_asc and count >= 10,
            min(100, (count / 10) * 100),
            f"{count} / 10 задач Аскета",
        )

    if title_id == "linguist_sovereign":
        is_ling = profile.character_class == "Linguist"
        count = total_tasks if is_ling else 0
        return (
            is_ling and count >= 25,
            min(100, (count / 25) * 100),
            f"{count} / 25 задач Лингвиста",
        )

    if title_id == "warlord_guard":
        is_war = profile.character_class == "Warlord"
        count = boss_damage if is_war else 0
        return is_war and count >= 1, (100 if count >= 1 else 0), "Атаки Варлорда"

    if title_id == "alchemist":
        mut_count = len(profile.active_mutators or [])
        return (
            mut_count >= 1 or total_tasks >= 20,
            min(100, (total_tasks / 20) * 100),
            f"{total_tasks} / 20 прогресса",
        )

    if title_id == "grand_alchemist":
        mut_count = len(profile.active_mutators or [])
        return (
            mut_count >= 3 or total_tasks >= 50,
            min(100, (total_tasks / 50) * 100),
            f"{total_tasks} / 50 прогресса",
        )

    if title_id == "experimentalist":
        mut_count = len(profile.active_mutators or [])
        return (
            mut_count >= 2,
            (100 if mut_count >= 2 else 50 if mut_count == 1 else 0),
            f"{mut_count} / 2 мутатора",
        )

    if title_id == "rune_smith":
        return (
            total_tasks >= 30,
            min(100, (total_tasks / 30) * 100),
            f"{total_tasks} / 30 рун",
        )

    if title_id == "potion_master":
        return (
            profile.gold >= 100 or total_tasks >= 15,
            min(100, (total_tasks / 15) * 100),
            f"{total_tasks} / 15 зелий",
        )

    if title_id == "relic_collector":
        return (
            profile.level >= 5 or total_tasks >= 10,
            min(100, (total_tasks / 10) * 100),
            f"{total_tasks} / 10 предметов",
        )

    if title_id == "boss_slayer":
        return (
            bosses_def >= 1,
            (100 if bosses_def >= 1 else 0),
            f"{bosses_def} / 1 босс",
        )

    if title_id == "giant_executioner":
        return (
            bosses_def >= 5,
            min(100, (bosses_def / 5) * 100),
            f"{bosses_def} / 5 боссов",
        )

    if title_id == "critical_striker":
        return (
            crits >= 10 or boss_damage >= 100,
            min(100, (boss_damage / 100) * 100),
            f"{boss_damage} / 100 урона",
        )

    if title_id == "darkness_bane":
        return (
            boss_damage >= 500,
            min(100, (boss_damage / 500) * 100),
            f"{boss_damage} / 500 урона",
        )

    if title_id == "tactician":
        return (
            profile.level >= 3,
            (100 if profile.level >= 3 else 0),
            f"Уровень {profile.level} / 3",
        )

    if title_id == "dark_receptionist":
        return (
            profile.level >= 7,
            min(100, (profile.level / 7) * 100),
            f"Уровень {profile.level} / 7",
        )

    if title_id == "chaos_lord":
        return (
            profile.level >= 10,
            min(100, (profile.level / 10) * 100),
            f"Уровень {profile.level} / 10",
        )

    if title_id == "deep_work_master":
        return (
            total_tasks >= 10,
            min(100, (total_tasks / 10) * 100),
            f"{total_tasks} / 10 фокусировок",
        )

    if title_id == "zen_meditator":
        return (
            total_tasks >= 25,
            min(100, (total_tasks / 25) * 100),
            f"{total_tasks} / 25 сессий",
        )

    if title_id == "chronomancer":
        return (
            total_tasks >= 40,
            min(100, (total_tasks / 40) * 100),
            f"{total_tasks} / 40 часов",
        )

    if title_id == "sprint_champion":
        return (
            task_stats.get("max_day_tasks", 0) >= 5 or total_tasks >= 15,
            100 if total_tasks >= 15 else 50,
            "5 задач в день",
        )

    if title_id == "unstoppable":
        return (
            task_stats.get("max_day_tasks", 0) >= 15 or total_tasks >= 45,
            100 if total_tasks >= 45 else 30,
            "15 задач в день",
        )

    if title_id == "squad_commander":
        return profile.level >= 2, 100 if profile.level >= 2 else 0, "Пати доступно"

    if title_id == "ally_patron":
        allies = getattr(profile, "active_allies", []) or []
        return (
            len(allies) >= 1 or profile.level >= 4,
            100 if profile.level >= 4 else 0,
            "1 союзник",
        )

    if title_id == "beast_master":
        allies = getattr(profile, "active_allies", []) or []
        return (
            len(allies) >= 3 or profile.level >= 8,
            100 if profile.level >= 8 else 0,
            "3 союзника",
        )

    if title_id == "inspiring_leader":
        return profile.level >= 3, 100 if profile.level >= 3 else 0, "Лидер Пати"

    if title_id == "dynamic_duo":
        return profile.level >= 2, 100 if profile.level >= 2 else 0, "Дуэт"

    if title_id == "gold_digger":
        return (
            total_gold >= 250,
            min(100, (total_gold / 250) * 100),
            f"{total_gold} / 250 золота",
        )

    if title_id == "tycoon":
        return (
            total_gold >= 1500,
            min(100, (total_gold / 1500) * 100),
            f"{total_gold} / 1500 золота",
        )

    if title_id == "big_spender":
        return (
            total_gold >= 100 or profile.gold >= 50,
            100 if total_gold >= 100 else 50,
            "Покупки",
        )

    if title_id == "treasure_hunter":
        return (
            total_gold >= 50 or profile.level >= 2,
            100 if profile.level >= 2 else 50,
            "Сундуки",
        )

    if title_id == "mind_over_matter":
        return (
            total_tasks >= 50,
            min(100, (total_tasks / 50) * 100),
            f"{total_tasks} / 50 задач",
        )

    if title_id == "pioneer":
        rank_id = (
            getattr(profile.rank_info, "id", "F")
            if hasattr(profile, "rank_info")
            else "F"
        )
        return (
            rank_id in ["C", "B", "A", "S", "SS", "SSS"],
            100 if rank_id in ["C", "B", "A", "S", "SS", "SSS"] else 30,
            "Ранг C",
        )

    if title_id == "grandmaster":
        rank_id = (
            getattr(profile.rank_info, "id", "F")
            if hasattr(profile, "rank_info")
            else "F"
        )
        return (
            rank_id in ["S", "SS", "SSS"],
            100 if rank_id in ["S", "SS", "SSS"] else 10,
            "Ранг S",
        )

    if title_id == "apex_sovereign":
        p_count = profile.prestige_count or 0
        return p_count >= 1, (100 if p_count >= 1 else 0), f"{p_count} / 1 Престиж"

    if title_id == "phoenix":
        return streak >= 10, min(100, (streak / 10) * 100), f"{streak} / 10 дней"

    # Default fallback
    return True, 100, "Достигнуто"


def _get_user_task_stats(user) -> Dict[str, int]:
    """Helper to calculate task distribution stats by hour/day for time-based titles."""
    try:
        from api.models import Task

        completed_tasks = Task.objects.filter(user=user, completed=True).values_list(
            "completed_at", flat=True
        )

        night_count = 0
        morning_count = 0
        noon_count = 0
        evening_count = 0
        weekend_count = 0
        midnight_exact = 0

        tasks_per_day = {}

        for dt in completed_tasks:
            if not dt:
                continue
            # Convert to local timezone if possible
            local_dt = timezone.localtime(dt)
            h = local_dt.hour

            if h >= 23 or h < 5:
                night_count += 1
            if 5 <= h < 8:
                morning_count += 1
            if 12 <= h < 14:
                noon_count += 1
            if 18 <= h < 21:
                evening_count += 1
            if local_dt.weekday() in [5, 6]:
                weekend_count += 1
            if h == 0:
                midnight_exact += 1

            day_str = local_dt.strftime("%Y-%m-%d")
            tasks_per_day[day_str] = tasks_per_day.get(day_str, 0) + 1

        max_day_tasks = max(tasks_per_day.values()) if tasks_per_day else 0

        return {
            "night_count": night_count,
            "morning_count": morning_count,
            "noon_count": noon_count,
            "evening_count": evening_count,
            "weekend_count": weekend_count,
            "midnight_exact": midnight_exact,
            "max_day_tasks": max_day_tasks,
        }
    except Exception as e:
        logger.error(f"Error computing task stats for titles: {e}")
        return {
            "night_count": 0,
            "morning_count": 0,
            "noon_count": 0,
            "evening_count": 0,
            "weekend_count": 0,
            "midnight_exact": 0,
            "max_day_tasks": 0,
        }


def get_user_playstyle_titles(profile) -> Dict[str, Any]:
    """
    Evaluates all 52 titles for the given UserProfile.
    Returns:
      - active_title: { id, name, icon, category, color, is_equipped }
      - unlocked_count: int
      - total_count: int
      - titles: list of all titles with unlock status & progress
    """
    user = profile.user
    stats = getattr(user, "stats", None)
    task_stats = _get_user_task_stats(user)

    evaluated_titles = []
    unlocked_unpinned = []

    for item in TITLES_CATALOG:
        t_id = item["id"]
        unlocked, progress_pct, progress_text = _evaluate_title_unlock(
            user, t_id, stats, profile, task_stats
        )

        t_obj = {
            "id": t_id,
            "name": item["name"],
            "icon": item["icon"],
            "category": item["category"],
            "color": item["color"],
            "description": item["description"],
            "priority": item["priority"],
            "unlocked": unlocked,
            "progress_pct": round(progress_pct, 1),
            "progress_text": progress_text,
            "is_equipped": (profile.equipped_title == t_id),
        }
        evaluated_titles.append(t_obj)

        if unlocked:
            unlocked_unpinned.append(t_obj)

    # Sort unlocked by priority descending to pick the auto playstyle title
    unlocked_unpinned.sort(key=lambda x: x["priority"], reverse=True)
    auto_title = unlocked_unpinned[0] if unlocked_unpinned else evaluated_titles[0]

    # Check if user has an explicitly equipped title
    active_title = auto_title
    if profile.equipped_title:
        equipped_match = next(
            (
                t
                for t in evaluated_titles
                if t["id"] == profile.equipped_title and t["unlocked"]
            ),
            None,
        )
        if equipped_match:
            active_title = equipped_match

    unlocked_count = len(unlocked_unpinned)

    return {
        "active_title": active_title,
        "unlocked_count": unlocked_count,
        "total_count": len(TITLES_CATALOG),
        "titles": evaluated_titles,
    }
