# API - BFP Attendance (NestJS scaffold)

This directory contains the NestJS backend scaffold for the BFP Attendance system.
This README is a small entry-point that explains how to run the API locally and the minimal operational notes.

Important notes

- The face-recognition logic is intentionally kept in a separate Python microservice. The NestJS API calls that service (configurable via `FACE_SERVICE_URL`).
- The API exposes Swagger/OpenAPI at `/api/docs` when running.

Prerequisites

- Node 18+ (or the project's target Node version)
- npm or yarn
- MySQL (local or remote) for the main application database
- Python face-recognition service running separately (see face service notes)

Environment variables
Set these in a `.env` file at the `api/` directory root or export them in your environment:

- `PORT` - (optional) port for Nest app, default 5000
- `DB_HOST` - MySQL host (default: localhost)
- `DB_PORT` - MySQL port (default: 3306)
- `DB_USER` - MySQL username (default: root)
- `DB_PASS` - MySQL password (default: root)
- `DB_NAME` - MySQL database name (default: bfp_sorsogon_attendance)
- `JWT_SECRET` - secret for signing JWTs
- `FACE_SERVICE_URL` - URL of the Python face service (e.g., http://localhost:5001)
- `NODE_ENV` - environment (development|production)

Quick local run (development)

1. Install dependencies:
   npm install

2. Start the app:
   npm run start:dev

3. Open API docs (Swagger):
   http://localhost:5000/api/docs

Database and migrations

- The scaffold is configured to use TypeORM (see `TypeOrmModule` in `src/app.module.ts`).
- For safety `synchronize` is set to false. Use TypeORM migrations for schema changes.
- Ensure the MySQL instance is reachable with the env variables above.

Running migrations

- Migrations are placed in `src/migrations/`. To run migrations locally you can use the included helper script which initializes the DataSource and executes pending migrations.
  - Install dependencies: `npm install`
  - Run migrations directly (recommended for dev): `npx ts-node src/scripts/run-migrations.ts`
  - Or build and run: `npm run build` then `node dist/scripts/run-migrations.js`
- Before running migrations, ensure your `.env` is configured (DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME). The script will use those env vars to connect to the MySQL instance.

Face recognition microservice

- The NestJS API delegates recognition work to an external Python service.
- Configure its location with `FACE_SERVICE_URL`.
- The NestJS `FaceService` expects a `POST { main_image: "<base64>" }` to an endpoint such as `${FACE_SERVICE_URL}/recognize` (adjust in code if your Python service exposes a different path).
- Suggestions:
  - Keep the Python service as FastAPI (or Flask) with a small HTTP API; FastAPI gives automatic docs and async support.
  - Run face-recognition on a machine with the appropriate native libraries or GPU support if needed.
  - Consider an async queue (Redis + worker) if recognition latency or throughput becomes an issue.

Swagger / Testing

- After starting the API you can use Swagger UI at `/api/docs` to test endpoints.
- The controllers return a standardized envelope: `{ success: boolean, data?: any, message?: string }`.

Project layout (important files)

- `src/main.ts` — app bootstrap, global pipes/interceptors, Swagger setup
- `src/app.module.ts` — main module and TypeORM configuration
- `src/auth/` — authentication module (JWT)
- `src/personnel/` — personnel module, controller, DTOs
- `src/attendance/` — attendance capture controller/service, DTOs
- `src/face/` — HTTP client wrapper to call Python face service
- `src/health/` — health endpoint

Development guidelines

- Keep DTOs (class-validator + class-transformer) for all incoming payloads.
- Controllers should return the standardized envelope or let the global ResponseInterceptor wrap plain returns.
- Protect capture endpoints appropriately (consider JWT guard and rate limiting).
- Do not port heavy ML code to Node — prefer calling the Python microservice.

If you want, I can:

- Add a sample `.env.example` in this folder.
- Add TypeORM migration scripts and basic User/Personnel entities.
- Provide a small FastAPI template for the face-recognition microservice (recognize endpoint + expected request/response shape).

Contact / Next steps

- Tell me which next piece you want scaffolded:
  - Complete Auth (DB-backed users + cookie strategy)
  - Personnel entity + TypeORM migration
  - Attendance persistence + simple reports
  - Small FastAPI template for face-recognition

