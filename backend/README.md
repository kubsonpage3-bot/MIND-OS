# MIND OS Backend — Руководство по запуску

## Структура проекта

```
backend/
├── manage.py                  # CLI Django
├── requirements.txt           # Python-зависимости
├── .env.example               # Шаблон переменных окружения
│
├── mindos/                    # Конфигурационный пакет Django
│   ├── __init__.py
│   ├── settings.py            # Настройки (БД, CORS, JWT)
│   ├── urls.py                # Главный маршрутизатор
│   └── wsgi.py                # WSGI для production
│
└── api/                       # Основное приложение
    ├── __init__.py
    ├── apps.py                # AppConfig
    ├── models.py              # UserProfile, Task
    ├── serializers.py         # DRF сериализаторы
    ├── views.py               # Views + ViewSets
    ├── urls.py                # API-маршруты
    └── admin.py               # Регистрация в админке
```

## 1. Установка зависимостей

```bash
cd backend

# Создаём виртуальное окружение
python -m venv venv

# Активируем его
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Устанавливаем пакеты
pip install -r requirements.txt
```

## 2. Настройка PostgreSQL

```sql
-- Выполнить в psql от суперпользователя
CREATE DATABASE mindos_db;
CREATE USER mindos_user WITH PASSWORD 'your_db_password';
GRANT ALL PRIVILEGES ON DATABASE mindos_db TO mindos_user;
-- PostgreSQL 15+: также нужно дать права на схему public
\c mindos_db
GRANT ALL ON SCHEMA public TO mindos_user;
```

## 3. Переменные окружения

```bash
# Создаём .env из шаблона
cp .env.example .env
# Редактируем .env (SECRET_KEY, DB_PASSWORD и т.д.)
```

## 4. Миграции и запуск

```bash
# Создаём миграции
python manage.py makemigrations api

# Применяем миграции
python manage.py migrate

# Создаём суперпользователя (для доступа в /admin/)
python manage.py createsuperuser

# Запускаем dev-сервер
python manage.py runserver
```

> Сервер запустится на http://127.0.0.1:8000

## 5. Карта API-эндпоинтов

| Метод | URL | Доступ | Описание |
|-------|-----|--------|----------|
| `POST` | `/api/auth/register/` | Открыто | Регистрация |
| `POST` | `/api/auth/token/` | Открыто | Логин → JWT токены |
| `POST` | `/api/auth/token/refresh/` | Открыто | Обновить access-токен |
| `POST` | `/api/auth/token/verify/` | Открыто | Проверить токен |
| `GET` | `/api/profile/` | JWT | Профиль персонажа |
| `PATCH` | `/api/profile/` | JWT | Обновить профиль |
| `GET` | `/api/tasks/` | JWT | Список задач |
| `POST` | `/api/tasks/` | JWT | Создать задачу |
| `GET` | `/api/tasks/{id}/` | JWT | Получить задачу |
| `PUT/PATCH` | `/api/tasks/{id}/` | JWT | Обновить задачу |
| `DELETE` | `/api/tasks/{id}/` | JWT | Удалить задачу |
| `POST` | `/api/tasks/{id}/complete/` | JWT | ✅ Выполнить задачу |
| `GET` | `/api/docs/swagger/` | - | Swagger UI (DEBUG) |

## 6. Пример использования из Tauri (JavaScript)

```javascript
// Логин и получение токена
const loginResponse = await fetch("http://127.0.0.1:8000/api/auth/token/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "user", password: "pass" }),
});
const { access, refresh } = await loginResponse.json();

// Запрос профиля с токеном
const profileResponse = await fetch("http://127.0.0.1:8000/api/profile/", {
  headers: { "Authorization": `Bearer ${access}` },
});
const profile = await profileResponse.json();

// Выполнить задачу
const completeResponse = await fetch(`http://127.0.0.1:8000/api/tasks/1/complete/`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${access}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ is_positive: true }),
});
const result = await completeResponse.json();
// result.leveled_up, result.rewards.xp, result.rewards.gold
```

## 7. Фильтрация задач

```
GET /api/tasks/?task_type=daily           → только дейлики
GET /api/tasks/?is_completed=false        → только невыполненные
GET /api/tasks/?difficulty=hard           → только сложные
GET /api/tasks/?search=тренировка        → поиск по названию
GET /api/tasks/?ordering=-created_at     → сначала новые
GET /api/tasks/?task_type=todo&difficulty=medium → комбо-фильтр
```
