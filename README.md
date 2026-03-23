# ATS – SIA

**Applicant Tracking System – Smart Interview Assistant**

A full-stack recruitment management platform built with Next.js 14, PostgreSQL, and Prisma. It lets recruitment teams manage candidates, open roles, and job applications through a single, cohesive web interface.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Set Up the Database](#4-set-up-the-database)
  - [5. Start the Development Server](#5-start-the-development-server)
- [Available Scripts](#available-scripts)
- [Application Routes](#application-routes)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Code Style & Linting](#code-style--linting)
- [Troubleshooting](#troubleshooting)

---

## Overview

ATS – SIA provides three core modules:

| Module | Description |
|---|---|
| **Candidates** | Track candidate profiles, résumés, contact details, and pipeline status |
| **Roles** | Manage job postings with salary ranges, employment type, and location details |
| **Applications** | Link candidates to roles, track pipeline stage, and update application status inline |

The public-facing **Jobs** page surfaces published roles to prospective applicants. The internal **Dashboard** gives recruiters a real-time overview of activity.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | [TypeScript 5](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Database | [PostgreSQL](https://www.postgresql.org/) |
| ORM | [Prisma 5](https://www.prisma.io/) |
| Linting | [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) |
| Runtime | [Node.js 18+](https://nodejs.org/) |

---

## Project Structure

```
.
├── prisma/
│   ├── migrations/          # SQL migration history
│   ├── schema.prisma        # Database schema (source of truth)
│   └── seed.ts              # Database seed script (sample data)
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # REST API route handlers
│   │   │   ├── applications/
│   │   │   ├── candidates/
│   │   │   └── roles/
│   │   ├── applications/    # Applications list page
│   │   ├── candidates/      # Candidates list + detail pages
│   │   ├── dashboard/       # Recruiter dashboard
│   │   ├── jobs/            # Public job board
│   │   ├── roles/           # Roles list + detail pages
│   │   ├── globals.css      # Global styles + Tailwind layers
│   │   ├── layout.tsx       # Root layout
│   │   ├── loading.tsx      # Global loading UI
│   │   ├── not-found.tsx    # 404 page
│   │   └── page.tsx         # Home / landing page
│   ├── components/          # Shared React components
│   │   ├── applications-list.tsx
│   │   ├── candidate-detail.tsx
│   │   ├── candidates-list.tsx
│   │   ├── hero.tsx
│   │   ├── jobs-list.tsx
│   │   ├── navbar.tsx
│   │   ├── role-detail.tsx
│   │   ├── roles-list.tsx
│   │   └── index.ts         # Barrel export
│   ├── lib/
│   │   ├── prisma.ts        # Prisma client singleton
│   │   ├── utils.ts         # Shared utility functions
│   │   └── validations/     # Input validation (no external library)
│   │       ├── application.ts
│   │       ├── candidate.ts
│   │       └── role.ts
│   ├── types/
│   │   └── index.ts         # TypeScript types & Prisma extensions
│   └── utils/
│       └── constants.ts     # Application-wide constants
├── .env.example             # Environment variable template
├── .eslintrc.json           # ESLint configuration
├── .gitignore
├── .prettierrc              # Prettier configuration
├── next.config.js           # Next.js configuration
├── package.json
├── postcss.config.js
├── tailwind.config.ts       # Tailwind CSS configuration
└── tsconfig.json            # TypeScript configuration
```

---

## Prerequisites

Make sure the following are installed on your machine before proceeding:

| Tool | Minimum Version | Check |
|---|---|---|
| Node.js | 18.0.0 | `node --version` |
| npm | 8.0.0 | `npm --version` |
| PostgreSQL | 14 | `psql --version` |

> **macOS / Linux** – PostgreSQL can be installed via Homebrew (`brew install postgresql@16`) or the official installer at [postgresql.org/download](https://www.postgresql.org/download/).  
> **Windows** – Use the EDB installer from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) or run PostgreSQL inside WSL2.

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ats-sia
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` in your editor and update the variables:

```env
# ─── Database ────────────────────────────────────────────────────────────────
# Replace <username>, <password>, <host>, <port>, and <database> with your
# local PostgreSQL credentials.
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/ats_sia_db"

# ─── Application ─────────────────────────────────────────────────────────────
NODE_ENV="development"
```

**Creating the database (if it doesn't exist yet):**

```bash
# Connect to PostgreSQL and create the database
psql -U postgres -c "CREATE DATABASE ats_sia_db;"
```

> If your PostgreSQL user is not `postgres`, replace it with your local superuser name.

### 4. Set Up the Database

Run the following commands in order:

```bash
# Generate the Prisma client from the schema
npm run db:generate

# Apply the schema to your database (creates all tables and indices)
npm run db:push

# (Optional) Seed the database with sample data
npm run db:seed
```

The seed script creates:
- **3 platform users** – admin, recruiter, and hiring manager accounts
- **3 candidates** – with varied profiles and statuses
- **3 roles** – senior engineer (hybrid), frontend developer (remote), product designer (on-site)
- **4 applications** – linking candidates to roles across different pipeline stages

> **Using migrations instead of `db:push`**  
> For a more controlled setup that matches production, use the migration runner:
> ```bash
> npm run db:migrate
> ```
> This applies all SQL files under `prisma/migrations/` in sequence.

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at **[http://localhost:3000](http://localhost:3000)**.

| Page | URL |
|---|---|
| Home / Job Board | http://localhost:3000 |
| Dashboard | http://localhost:3000/dashboard |
| Jobs (public) | http://localhost:3000/jobs |
| Roles | http://localhost:3000/roles |
| Candidates | http://localhost:3000/candidates |
| Applications | http://localhost:3000/applications |

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Next.js development server with hot reload |
| `npm run build` | Create an optimised production build |
| `npm run start` | Start the production server (requires `npm run build` first) |
| `npm run lint` | Run ESLint across `src/` and `prisma/` |
| `npm run lint:fix` | Run ESLint and auto-fix fixable violations |
| `npm run type-check` | Run the TypeScript compiler without emitting files |
| `npm run db:generate` | Regenerate the Prisma client after schema changes |
| `npm run db:push` | Push the Prisma schema to the database (dev / prototyping) |
| `npm run db:migrate` | Apply pending migrations (production-safe) |
| `npm run db:studio` | Open Prisma Studio in the browser for visual DB inspection |
| `npm run db:seed` | Seed the database with sample candidates, roles, and applications |

---

## Application Routes

### Pages

| Route | Description |
|---|---|
| `GET /` | Landing page with featured published roles |
| `GET /jobs` | Full public job board listing all published roles |
| `GET /dashboard` | Recruiter dashboard with stats and recent activity |
| `GET /roles` | Internal list of all roles with status and application counts |
| `GET /roles/[id]` | Role detail page including linked applications |
| `GET /candidates` | List of all candidates with status summary |
| `GET /candidates/[id]` | Candidate profile with résumé and application history |
| `GET /applications` | All applications with inline status update |

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/candidates` | List candidates (supports `status`, `search`, `page`, `pageSize`) |
| `POST` | `/api/candidates` | Create a candidate (`multipart/form-data` or JSON) |
| `GET` | `/api/candidates/[id]` | Get a single candidate with applications |
| `PUT` | `/api/candidates/[id]` | Partially update a candidate |
| `GET` | `/api/roles` | List roles (supports `status`, `locationType`, `employmentType`, `department`, `search`, `page`, `pageSize`) |
| `POST` | `/api/roles` | Create a role (JSON) |
| `GET` | `/api/roles/[id]` | Get a single role with applications |
| `PUT` | `/api/roles/[id]` | Partially update a role |
| `GET` | `/api/applications` | List applications (supports `candidateId`, `roleId`, `status`, `stage`, `page`, `pageSize`) |
| `POST` | `/api/applications` | Create an application (JSON) |
| `GET` | `/api/applications/[id]` | Get a single application with candidate and role |
| `PUT` | `/api/applications/[id]` | Update application status/stage |

---

## Database Schema

The schema is defined in [`prisma/schema.prisma`](prisma/schema.prisma) and managed by Prisma. The database has four tables:

```
users          – Platform accounts (admins, recruiters, hiring managers)
candidates     – People who apply to roles
roles          – Open positions / job postings
applications   – Join table linking candidates to roles; tracks pipeline progress
```

### Key relationships

- A **Role** optionally belongs to a **User** (the recruiter who posted it). Deleting a user sets this FK to `NULL`.
- An **Application** belongs to both a **Candidate** and a **Role**. Deleting either cascades the deletion of related applications.
- A candidate may only apply to any given role once (unique constraint on `[candidateId, roleId]`).

### Enums

| Enum | Values |
|---|---|
| `UserRole` | `USER`, `ADMIN`, `RECRUITER`, `HIRING_MANAGER` |
| `CandidateStatus` | `ACTIVE`, `HIRED`, `INACTIVE`, `BLACKLISTED` |
| `RoleStatus` | `DRAFT`, `PUBLISHED`, `PAUSED`, `CLOSED`, `ARCHIVED` |
| `LocationType` | `ON_SITE`, `REMOTE`, `HYBRID` |
| `EmploymentType` | `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERNSHIP`, `TEMPORARY` |
| `ApplicationStatus` | `APPLIED`, `UNDER_REVIEW`, `SHORTLISTED`, `INTERVIEWING`, `OFFER_SENT`, `HIRED`, `REJECTED`, `WITHDRAWN` |
| `ApplicationStage` | `APPLICATION`, `SCREENING`, `ASSESSMENT`, `INTERVIEW_1`, `INTERVIEW_2`, `FINAL_ROUND`, `OFFER`, `CLOSED` |

### After modifying the schema

```bash
# 1. Edit prisma/schema.prisma
# 2. Create a new migration (dev only — prompts for a migration name)
npm run db:migrate

# 3. Regenerate the Prisma client
npm run db:generate
```

---

## Code Style & Linting

The project enforces consistent style through ESLint and Prettier. Run both before committing:

```bash
npm run lint        # check for issues
npm run type-check  # ensure TypeScript is happy
```

Key conventions:

- **No semicolons** – Prettier is configured with `"semi": false`
- **Single quotes** – `"singleQuote": true`
- **2-space indentation**
- **Trailing commas** – ES5 style (`"trailingComma": "es5"`)
- **Tailwind class ordering** – enforced by `prettier-plugin-tailwindcss`
- **TypeScript strict mode** – `"strict": true` in `tsconfig.json`
- Path aliases: `@/*` → `src/*`, `@/components/*`, `@/lib/*`, `@/types/*`, `@/utils/*`

---

## Troubleshooting

### `Error: Can't reach database server`

- Confirm PostgreSQL is running: `pg_isready` (or `brew services list` on macOS).
- Double-check `DATABASE_URL` in `.env` — username, password, host, port, and database name must all be correct.
- Ensure the database exists: `psql -U postgres -c "\l"` to list databases.

### `PrismaClientInitializationError` on page load

- The Prisma client may not be generated yet. Run:
  ```bash
  npm run db:generate
  ```

### `Error: P1003 – Database does not exist`

- Create the database manually:
  ```bash
  psql -U postgres -c "CREATE DATABASE ats_sia_db;"
  ```
- Then re-run `npm run db:push` or `npm run db:migrate`.

### Pages show empty data but no errors

- The database is likely empty. Run the seed script:
  ```bash
  npm run db:seed
  ```
- Check the browser console and server terminal for any Prisma errors.

### Port 3000 is already in use

- Start the dev server on a different port:
  ```bash
  npx next dev -p 3001
  ```

### Prisma Studio won't open

- Run `npm run db:studio` and open [http://localhost:5555](http://localhost:5555) manually.

### Type errors after pulling new changes

- Regenerate the Prisma client then re-check types:
  ```bash
  npm run db:generate
  npm run type-check
  ```

---

## License

This project is private and proprietary.
