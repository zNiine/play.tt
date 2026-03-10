# The Turing Test — Setup Guide

## Quick Start (Docker)

```bash
# 1. Clone and enter
cd TuringTest

# 2. Copy and configure env
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# 3. Start everything
docker-compose up -d

# 4. Run migrations
docker-compose exec backend flask db upgrade

# 5. Open the app
#   Frontend: http://localhost:3000
#   Backend API: http://localhost:5000
```

---

## Manual Development Setup

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env: set DATABASE_URL, REDIS_URL, SECRET_KEY, JWT_SECRET_KEY

# Run migrations
flask db upgrade

# Start backend
python run.py
# → http://localhost:5000

# Note: only run `flask db migrate -m "..."` when you've changed models
# and need to generate a new migration file. `flask db upgrade` applies
# existing migrations and is all that's needed on a fresh checkout.
```

### Background Workers

```bash
# In separate terminals (with venv activated):
celery -A celery_worker.celery worker --loglevel=info
celery -A celery_beat.celery beat --loglevel=info
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:5000

# Start dev server
npm run dev
# → http://localhost:3000
```

---

## First Admin User

After migrations, create your first admin directly in the DB:

```sql
-- After registering a user via the API:
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

Or via Flask shell:
```bash
flask shell
>>> from app.models import User
>>> from app.extensions import db
>>> u = User.query.filter_by(email='your@email.com').first()
>>> u.role = 'admin'
>>> db.session.commit()
```

---

## Seeding Sample Data

Use the Admin Panel at `/admin` (once you have an admin account) to:
1. Create Teams (e.g., HBG Harrisburg Senators, ALT Altoona Curve)
2. Create Players and assign to teams
3. Create Games between teams
4. Create a Slate for today with those game IDs
5. Add slate players with salaries
6. Create a BTS Day for today

---

## Architecture

```
TuringTest/
├── backend/           Flask API + Celery workers
│   ├── app/
│   │   ├── models/    SQLAlchemy models
│   │   ├── api/       Flask blueprints (REST endpoints)
│   │   ├── services/  Business logic (scoring, salary, leaderboard)
│   │   ├── stats/     StatsProvider abstraction + MockProvider
│   │   └── tasks/     Celery background jobs
│   ├── migrations/    Alembic migration scripts
│   └── requirements.txt
├── frontend/          Next.js 14 + Tailwind CSS
│   └── src/
│       ├── app/       App Router pages
│       ├── components/UI components
│       └── lib/       API client, Zustand store, utils
└── docker-compose.yml
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login |
| GET  | /api/auth/me | Current user |
| GET  | /api/slates/ | List slates |
| GET  | /api/slates/today | Today's slate |
| GET  | /api/slates/{id}/players | Player pool |
| POST | /api/slates/{id}/entry | Save lineup draft |
| POST | /api/slates/{id}/entry/submit | Submit lineup |
| GET  | /api/slates/{id}/leaderboard | Slate scores |
| GET  | /api/games/{id}/lineups | Game lineups |
| POST | /api/bts/entry | Submit BTS picks |
| GET  | /api/bts/me | My BTS state |
| GET  | /api/bts/leaderboard | BTS standings |
| GET  | /api/weeks/current | Current week |
| GET  | /api/weeks/{id}/leaderboard | Weekly standings |
| GET  | /api/users/{id}/profile | User profile |

## Scoring

### Batters
- Single: 3 pts | Double: 5 pts | Triple: 8 pts | HR: 10 pts
- BB: 2 pts | R: 2 pts | RBI: 2 pts | SB: 5 pts | CS: -2 pts

### Pitchers
- IP: 3 pts | K: 2 pts | ER: -2 pts | W: 5 pts
