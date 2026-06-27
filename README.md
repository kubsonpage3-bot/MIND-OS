# MIND OS

MIND OS is a gamified productivity OS with Idle-RPG mechanics built using React, Tailwind CSS, and Framer Motion for the frontend, and Django with SQLite for the backend. It can run as a web app or as a desktop application powered by Tauri.

## Prerequisites

1. Clone the repository
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Set up the Python virtual environment and backend dependencies in the `backend/` folder.

## Running the App

### Frontend
To run the frontend in development mode:
```bash
npm run dev
```

### Backend
To run the Django server, navigate to `backend/`, activate the virtual environment, and run:
```bash
python manage.py runserver
```
By default, the backend uses a local SQLite database (`db.sqlite3`).
