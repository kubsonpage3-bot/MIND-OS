const fs = require('fs');
const path = require('path');

const addTranslations = (file, translations) => {
    const filePath = path.join('C:/coder/mind-os-growth/frontend/src/locales', file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // merge translations
    Object.keys(translations).forEach(key => {
        data[key] = { ...data[key], ...translations[key] };
    });
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

const en = {
  guides: {
    description: "Replay any of the introductory guides for the various sections of MIND OS.",
    replayTutorial: "Replay Main Tutorial",
    start: "START",
    view: "VIEW",
    sections: {
      dashboard: "Cognitive Metrics",
      training: "Training",
      tasks: "Tasks",
      character: "Character",
      skill_tree: "Skill Tree",
      allies: "Allies",
      mutators: "Mutators",
      shop: "Shop",
      rival: "Rival",
      party: "Party"
    }
  },
  about: {
    header: "About",
    version: "Version:",
    build: "Build:",
    platform: "Platform:",
    description: "MIND OS is a gamified productivity system that combines cognitive training with RPG mechanics. Track habits, complete daily tasks, defeat bosses, and level up your character while improving your real-life cognitive abilities.",
    coreFeatures: "Core Features",
    features: {
      metrics: "Cognitive metric tracking (GF, GC, PS, VM)",
      tasks: "Task management (Habits, Dailies, To-Dos)",
      bosses: "Boss battles & rank progression",
      character: "Character customization & skill trees",
      allies: "Ally system & achievements",
      cloud: "Cloud sync across devices",
      pomodoro: "Pomodoro timer & calendar"
    },
    links: {
      documentation: "Documentation",
      feedback: "Feedback & Bug Report",
      privacy: "Privacy Policy",
      terms: "Terms of Service"
    },
    support1: "Want to support the developer?",
    support2: "You can send a donation via PayPal to: kubsonpage3@gmail.com",
    builtWith: "Built with ❤️ for MIND OS"
  }
};

const ru = {
  guides: {
    description: "Перепройдите любое обучающее руководство для различных разделов MIND OS.",
    replayTutorial: "Перепройти Главное Обучение",
    start: "СТАРТ",
    view: "ОТКРЫТЬ",
    sections: {
      dashboard: "Когнитивные Метрики",
      training: "Тренировки",
      tasks: "Задачи",
      character: "Персонаж",
      skill_tree: "Дерево Навыков",
      allies: "Союзники",
      mutators: "Мутаторы",
      shop: "Магазин",
      rival: "Соперник",
      party: "Группа"
    }
  },
  about: {
    header: "О программе",
    version: "Версия:",
    build: "Сборка:",
    platform: "Платформа:",
    description: "MIND OS — это геймифицированная система продуктивности, сочетающая когнитивные тренировки с RPG-механиками. Отслеживайте привычки, выполняйте ежедневные задачи, побеждайте боссов и прокачивайте персонажа, улучшая свои реальные когнитивные способности.",
    coreFeatures: "Ключевые Возможности",
    features: {
      metrics: "Отслеживание когнитивных метрик (GF, GC, PS, VM)",
      tasks: "Управление задачами (Привычки, Ежедневные, To-Do)",
      bosses: "Битвы с боссами и повышение ранга",
      character: "Кастомизация персонажа и дерево навыков",
      allies: "Система союзников и достижений",
      cloud: "Облачная синхронизация между устройствами",
      pomodoro: "Помодоро таймер и календарь"
    },
    links: {
      documentation: "Документация",
      feedback: "Отзывы и Сообщения об ошибках",
      privacy: "Политика Конфиденциальности",
      terms: "Пользовательское Соглашение"
    },
    support1: "Хотите поддержать разработчика?",
    support2: "Вы можете отправить пожертвование через PayPal на: kubsonpage3@gmail.com",
    builtWith: "Создано с ❤️ для MIND OS"
  }
};

addTranslations('en.json', en);
addTranslations('ru.json', ru);
console.log('Translations added successfully.');
