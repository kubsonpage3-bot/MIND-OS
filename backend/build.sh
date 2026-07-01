#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Seed data and sync boss drops post-migration
python manage.py seed_items
python manage.py seed_bosses
python manage.py sync_boss_drops
