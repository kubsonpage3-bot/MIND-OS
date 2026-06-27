"""
WSGI-конфигурация для деплоя MIND OS бэкенда.
Используется Gunicorn / uWSGI в production.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")

application = get_wsgi_application()
