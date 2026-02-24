# BFP Sorsogon Attendance System (Rework)

A complete rework of the original [BFP Attendance System](https://github.com/mikieee25/BFPAttendance), migrated from a Flask monolith to a modern three-service architecture: **NestJS API**, **Next.js frontend**, and **Python face recognition service**.

## Architecture

| Service      | Tech                                     | Port   | Directory       |
| ------------ | ---------------------------------------- | ------ | --------------- |
| API          | NestJS 10, TypeORM, MySQL                | `3001` | `api/`          |
| Frontend     | Next.js 16 (Turbopack), React 19, MUI v7 | `3000` | `app/`          |
| Face Service | FastAPI, InsightFace (buffalo_l), OpenCV | `5001` | `face-service/` |

All three services share the same MySQL database (`bfp_sorsogon_attendance`).

## Tech Stack

- **API**: NestJS, TypeORM, MySQL2, Passport JWT (access + refresh tokens), class-validator, Swagger, ExcelJS (report exports), Helmet
- **Frontend**: Next.js 16.1.6 with Turbopack, React 19, MUI v7, TanStack React Query, Recharts, react-webcam, Axios
- **Face Service**: FastAPI, InsightFace (`buffalo_l` model), ONNX Runtime, OpenCV, aiomysql, NumPy
- **Database**: MySQL 8+

## Prerequisites

- Node.js 18+
- Python 3.10+
- MySQL 8+

## Setup

### 1. Database

Create the MySQL database:

```sql
CREATE DATABASE bfp_sorsogon_attendance;
```

### 2. API (`api/`)

```bash
cd api
cp .env.example .env   # edit DB credentials, JWT_SECRET, etc.
npm install
npm run migrate         # run TypeORM migrations
npm run seed            # seed stations + default accounts
npm run start:dev       # starts on :3001
```

Swagger docs available at `http://localhost:3001/api/docs`.

### 3. Face Service (`face-service/`)

```bash
cd face-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # edit DB credentials, set ANTISPOOF_ENABLED=false if needed
python main.py          # starts on :5001
```

> **Note**: The InsightFace `buffalo_l` model will auto-download on first run (~300 MB). Set `ANTISPOOF_ENABLED=false` in `.env` if you're getting false positive spoofing detections during development.

### 4. Frontend (`app/`)

```bash
cd app
npm install
npm run dev             # starts on :3000
```

## Environment Variables

### API (`api/.env`)

| Variable             | Default                   | Description                    |
| -------------------- | ------------------------- | ------------------------------ |
| `PORT`               | `3001`                    | API server port                |
| `DB_HOST`            | `localhost`               | MySQL host                     |
| `DB_PORT`            | `3306`                    | MySQL port                     |
| `DB_USER`            | `root`                    | MySQL username                 |
| `DB_PASS`            | _(empty)_                 | MySQL password                 |
| `DB_NAME`            | `bfp_sorsogon_attendance` | Database name                  |
| `JWT_SECRET`         | `dev-jwt-secret`          | Access token signing secret    |
| `JWT_REFRESH_SECRET` | `dev-jwt-refresh-secret`  | Refresh token signing secret   |
| `JWT_ACCESS_EXPIRY`  | `15m`                     | Access token lifetime          |
| `JWT_REFRESH_EXPIRY` | `7d`                      | Refresh token lifetime         |
| `FACE_SERVICE_URL`   | `http://localhost:5001`   | Python face service URL        |
| `ALLOWED_ORIGINS`    | `http://localhost:3000`   | CORS origins (comma-separated) |

### Face Service (`face-service/.env`)

| Variable                 | Default                   | Description                       |
| ------------------------ | ------------------------- | --------------------------------- |
| `PORT`                   | `5001`                    | Face service port                 |
| `DB_HOST`                | `localhost`               | MySQL host (shared DB)            |
| `DB_USER`                | `root`                    | MySQL username                    |
| `DB_PASS`                | _(empty)_                 | MySQL password                    |
| `DB_NAME`                | `bfp_sorsogon_attendance` | Database name                     |
| `INSIGHTFACE_MODEL_NAME` | `buffalo_l`               | InsightFace model pack            |
| `ANTISPOOF_ENABLED`      | `true`                    | Enable anti-spoofing checks       |
| `MIN_FACE_DET_SCORE`     | `0.5`                     | Minimum face detection confidence |

## Seeded Accounts

After running `npm run seed` in the API directory:

| Role              | Username          | Password      |
| ----------------- | ----------------- | ------------- |
| Admin             | `admin`           | `Admin123!`   |
| Station (Central) | `central_station` | `Station123!` |
| Station (Talisay) | `talisay_station` | `Station123!` |
| Station (Bacon)   | `bacon_station`   | `Station123!` |
| Station (Abuyog)  | `abuyog_station`  | `Station123!` |
| Kiosk (Central)   | `kiosk_central`   | `Kiosk123!`   |

All station/admin accounts have `mustChangePassword: true` on first login.

## Key Differences from Original

|                  | Original                | Rework                                                  |
| ---------------- | ----------------------- | ------------------------------------------------------- |
| Backend          | Flask (Python monolith) | NestJS (TypeScript) + separate Python face service      |
| Frontend         | Jinja2 templates        | Next.js 16 + React 19 + MUI v7 SPA                      |
| Face Recognition | Embedded in Flask app   | Standalone FastAPI microservice (InsightFace buffalo_l) |
| Auth             | Session-based           | JWT (access + refresh tokens, httpOnly cookies)         |
| Database         | SQLite / MySQL          | MySQL 8+ with TypeORM migrations                        |
| API Docs         | None                    | Swagger/OpenAPI auto-generated                          |

## Project Structure

```
├── api/                  # NestJS backend API
│   ├── src/
│   │   ├── attendance/   # Attendance capture & history
│   │   ├── auth/         # JWT authentication
│   │   ├── dashboard/    # Dashboard statistics
│   │   ├── database/     # Entities & migrations
│   │   ├── face/         # Face service HTTP client
│   │   ├── personnel/    # Personnel management
│   │   ├── reports/      # Report generation & export
│   │   ├── stations/     # Station management
│   │   └── users/        # User account management
│   └── package.json
├── app/                  # Next.js frontend
│   ├── src/
│   │   ├── app/          # Next.js app router pages
│   │   ├── components/   # React components (MUI)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # API client, utilities
│   │   └── types/        # TypeScript type definitions
│   └── package.json
├── face-service/         # Python face recognition microservice
│   ├── main.py           # FastAPI entry point
│   ├── face_recognizer.py
│   ├── face_detector.py
│   ├── anti_spoof.py
│   └── requirements.txt
└── README.md
```

## License

MIT
