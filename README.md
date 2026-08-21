# School Results Portal

A web application for managing school results, built with React, TypeScript, Vite, and Supabase.

## Features

- Role-based authentication (Admin, Teacher, Student, Parent)
- Admin dashboard for managing students, teachers, classes, subjects, sessions, terms, and users
- Result entry with automatic grade and remark calculation
- Student and parent portals for viewing published results
- Printable result sheets

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```
   cp .env.example .env
   ```

3. Run the database migration in `supabase/migrations/` against your Supabase project.

4. Start the dev server:
   ```
   npm run dev
   ```

## Build

```
npm run build
```
