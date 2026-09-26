# Render API migration

The frontend now uses the Node/Express API under `/server` instead of Supabase. The API uses PostgreSQL through `DATABASE_URL`, JWT bearer tokens, bcrypt password hashes, and Cloudflare R2 for uploads.

## Endpoint list

Base URL: `https://<api-service>.onrender.com/api`

| Method | Path | Purpose | Access |
|---|---|---|---|
| `POST` | `/login` | Exchange email/password for a JWT and user profile | Public login endpoint |
| `GET` | `/me` | Return the current JWT user | Any authenticated user |
| `GET` | `/report-card/:studentId/:sessionId/:termId` | Return published report-card results; Third Term includes cumulative fields | Student/parent for linked student; authenticated staff |
| `POST` | `/uploads` | Upload a logo or student photo to Cloudflare R2 | Admin/teacher; path must begin `school-logos/` or `student-photos/` |
| `GET` | `/data/:table` | List/query a supported resource | Authenticated; role-scoped |
| `POST` | `/data/:table` | Insert a row or array of rows | Admin; teachers for results, affective ratings, and term remarks |
| `PUT` | `/data/:table` | Update rows using query filters | Admin; teachers for results, affective ratings, and term remarks |
| `DELETE` | `/data/:table` | Delete rows using query filters | Admin only |
| `OPTIONS` | Any API path | CORS preflight | Public |

Supported `:table` values:

`school_settings`, `app_users`, `academic_sessions`, `terms`, `teachers`, `classes`, `arms`, `class_arms`, `subjects`, `students`, `parents`, `results`, `grade_bands`, `affective_traits`, `affective_ratings`, and `term_remarks`.

The generic data endpoint supports the existing frontend query patterns: `select`, `eq`, `neq`, `is`, `in_field`/`in_values`, `order`, `limit`, `maybeSingle`, `single`, `count`, and `head`.

## Authorization translation

The old Supabase migrations used open `anon, authenticated` CRUD policies. That was appropriate only for the demo and left the database directly writable with an anon key. The API replacement keeps the same functional operations but adds server-side role checks:

- **Admin:** full CRUD on all resources.
- **Teacher:** read reference data; read/write results, affective ratings, and term remarks only for records assigned to that teacher; no account, student, settings, or structural deletes.
- **Student:** read their own student record, published results, affective ratings, term remarks, and read-only reference data; no writes.
- **Parent:** read their own parent record, linked student, published results, affective ratings, term remarks, and read-only reference data; no writes.

## Third-Term calculation

The report-card endpoint detects Third Term by the term name. For each published Third-Term subject result it loads saved published First-, Second-, and Third-Term results for the same student, subject, and academic session.

```text
cumulative_total = sum of the saved term total_score values
cumulative_average = cumulative_total / number of saved term results
```

A missing earlier term is excluded from both the sum and divisor. First- and Second-Term report cards remain term-only.

## Render API checklist

Create a separate Render Web Service for the API:

- **Root directory:** repository root
- **Build command:** `npm install && npm run server:build`
- **Start command:** `npm run server:start` (or `node server/dist/index.js`)
- **Health check path:** `/health`
- **Environment:** Node

Add these API-service environment variables:

- `DATABASE_URL` — connection string for the new empty PostgreSQL database
- `JWT_SECRET` — long random secret, different per environment
- `FRONTEND_ORIGIN` — the Render static-site URL, used for CORS
- `R2_ENDPOINT` — Cloudflare R2 S3-compatible endpoint
- `R2_BUCKET` — R2 bucket name
- `R2_ACCESS_KEY_ID` — R2 API token access key
- `R2_SECRET_ACCESS_KEY` — R2 API token secret
- `R2_PUBLIC_BASE_URL` — public custom-domain URL or R2 public bucket URL
- `PORT` — Render supplies this automatically; do not hard-code it in Render settings

For the existing Render static site:

- Keep build command `npm run build` and publish directory `dist`.
- Add `VITE_API_URL=https://<api-service>.onrender.com/api`.
- Remove the old `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` variables.

## Database initialization

Run [`server/schema.sql`](../server/schema.sql) once against the new PostgreSQL database before starting the API. The schema includes the final result-management tables, grade-band seed rows, affective-trait seed rows, indexes, and foreign keys. It intentionally has no Supabase RLS policies; API authorization is the enforcement layer.

The schema does not create demo user accounts because this is a new empty production database. Create the first administrator through a protected provisioning step or a one-time SQL insert using a bcrypt hash before attempting to log in.
