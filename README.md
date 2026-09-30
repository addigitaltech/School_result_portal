# School Results Portal

A web application for managing school results, built with React, TypeScript, and Vite on the frontend, and a Node/Express + PostgreSQL API on the backend (no Supabase — see `docs/backend-migration.md` for why and how this changed).

## Features

- Role-based authentication (Admin, Teacher, Student, Parent) via JWT
- Admin dashboard for managing students, teachers, classes, class arms, subjects, sessions, terms, and users
- Result entry with CA1/CA2/CA3 + Exam scoring, per-student subject offering toggle, and automatic grade calculation from configurable grade bands
- Affective/Psychomotor domain ratings per student per term
- Teacher and Principal remarks per student per term
- Third Term report cards automatically include a cumulative annual total/average across First, Second, and Third Term for each subject
- Student and parent portals for viewing published results
- Printable, formatted report cards (with class average/high/low/position and a performance chart), previewable by admins and teachers directly from the results list
- Student photo and school logo uploads stored in PostgreSQL
- Optional email password reset for admin and teacher accounts

## Architecture

- **Frontend:** `src/` — React + TypeScript + Vite, deployed as a static site
- **Backend:** `server/` — Node/Express API, deployed as a Render Web Service, talks to PostgreSQL via `DATABASE_URL`
- **Database:** PostgreSQL — apply `server/schema.sql` once against a fresh database to create all tables

## Local Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in real values:
   ```
   cp .env.example .env
   ```
   - `VITE_API_URL` — where the frontend expects the API (e.g. `http://localhost:10000/api` locally, or your deployed API's `https://.../api` in production)
   - `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, `PUBLIC_API_URL`, and optional `SMTP_*`/`APP_URL` — used by the `server/` API only, not the frontend build

3. Apply the schema to your PostgreSQL database:
   ```
   psql "$DATABASE_URL" -f server/schema.sql
   ```

4. Create your first admin login:
   ```
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword npm run server:seed-admin
   ```

5. Start the API and the frontend dev server (two terminals):
   ```
   npm run server:build && npm run server:start
   npm run dev
   ```

## Build

```
npm run build          # frontend -> dist/
npm run server:build   # backend  -> server/dist/
```

## Deployment

- **Frontend:** Render Static Site — build `npm install && npm run build`, publish directory `dist`, env var `VITE_API_URL` pointing at the deployed API's `/api` path.
- **Backend:** Render Web Service — build `npm install && npm run server:build`, start `npm run server:start`, env vars `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, and `PUBLIC_API_URL`; add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `APP_URL` to enable password-reset email.
- **Database:** Render PostgreSQL — see `server/schema.sql`.

See `docs/backend-migration.md` for the full endpoint list, per-role authorization rules, and migration history from the original Supabase-based version.
