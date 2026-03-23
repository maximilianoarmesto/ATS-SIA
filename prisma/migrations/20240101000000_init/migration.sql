-- Migration: 20240101000000_init
-- Description: Initial schema — candidates, roles, and applications with
--              full relations, constraints, and indices.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "UserRole" AS ENUM (
  'USER',
  'ADMIN',
  'RECRUITER',
  'HIRING_MANAGER'
);

CREATE TYPE "CandidateStatus" AS ENUM (
  'ACTIVE',
  'HIRED',
  'INACTIVE',
  'BLACKLISTED'
);

CREATE TYPE "RoleStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'CLOSED',
  'ARCHIVED'
);

CREATE TYPE "LocationType" AS ENUM (
  'ON_SITE',
  'REMOTE',
  'HYBRID'
);

CREATE TYPE "EmploymentType" AS ENUM (
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERNSHIP',
  'TEMPORARY'
);

CREATE TYPE "ApplicationStatus" AS ENUM (
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEWING',
  'OFFER_SENT',
  'HIRED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TYPE "ApplicationStage" AS ENUM (
  'APPLICATION',
  'SCREENING',
  'ASSESSMENT',
  'INTERVIEW_1',
  'INTERVIEW_2',
  'FINAL_ROUND',
  'OFFER',
  'CLOSED'
);

-- ---------------------------------------------------------------------------
-- Table: users
-- ---------------------------------------------------------------------------

CREATE TABLE "users" (
  "id"        TEXT        NOT NULL,
  "email"     TEXT        NOT NULL,
  "name"      TEXT,
  "role"      "UserRole"  NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx"        ON "users"("email");
CREATE INDEX "users_role_idx"         ON "users"("role");

-- ---------------------------------------------------------------------------
-- Table: candidates
-- ---------------------------------------------------------------------------

CREATE TABLE "candidates" (
  "id"           TEXT             NOT NULL,
  "email"        TEXT             NOT NULL,
  "firstName"    TEXT             NOT NULL,
  "lastName"     TEXT             NOT NULL,
  "phone"        TEXT,
  "linkedinUrl"  TEXT,
  "portfolioUrl" TEXT,
  "resumeUrl"    TEXT,
  "location"     TEXT,
  "summary"      TEXT,
  "status"       "CandidateStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidates_email_key"      ON "candidates"("email");
CREATE INDEX "candidates_email_idx"             ON "candidates"("email");
CREATE INDEX "candidates_status_idx"            ON "candidates"("status");
CREATE INDEX "candidates_last_first_name_idx"   ON "candidates"("lastName", "firstName");

-- ---------------------------------------------------------------------------
-- Table: roles
-- ---------------------------------------------------------------------------

CREATE TABLE "roles" (
  "id"             TEXT           NOT NULL,
  "title"          TEXT           NOT NULL,
  "description"    TEXT,
  "department"     TEXT,
  "company"        TEXT           NOT NULL,
  "location"       TEXT,
  "locationType"   "LocationType"   NOT NULL DEFAULT 'ON_SITE',
  "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
  "salaryMin"      INTEGER,
  "salaryMax"      INTEGER,
  "salaryCurrency" TEXT                     DEFAULT 'USD',
  "requirements"   TEXT,
  "benefits"       TEXT,
  "status"         "RoleStatus"   NOT NULL DEFAULT 'DRAFT',
  "postedById"     TEXT,
  "publishedAt"    TIMESTAMP(3),
  "closesAt"       TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)   NOT NULL,

  CONSTRAINT "roles_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "roles_postedById_fkey" FOREIGN KEY ("postedById")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "roles_status_idx"         ON "roles"("status");
CREATE INDEX "roles_department_idx"     ON "roles"("department");
CREATE INDEX "roles_company_idx"        ON "roles"("company");
CREATE INDEX "roles_location_type_idx"  ON "roles"("locationType");
CREATE INDEX "roles_employment_type_idx" ON "roles"("employmentType");
CREATE INDEX "roles_posted_by_idx"      ON "roles"("postedById");
CREATE INDEX "roles_published_at_idx"   ON "roles"("publishedAt");

-- ---------------------------------------------------------------------------
-- Table: applications
-- ---------------------------------------------------------------------------

CREATE TABLE "applications" (
  "id"          TEXT               NOT NULL,
  "candidateId" TEXT               NOT NULL,
  "roleId"      TEXT               NOT NULL,
  "status"      "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
  "stage"       "ApplicationStage"  NOT NULL DEFAULT 'APPLICATION',
  "resumeUrl"   TEXT,
  "coverLetter" TEXT,
  "notes"       TEXT,
  "rating"      INTEGER,
  "source"      TEXT,
  "appliedAt"   TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)       NOT NULL,

  CONSTRAINT "applications_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "applications_candidateId_fkey" FOREIGN KEY ("candidateId")
    REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "applications_roleId_fkey"   FOREIGN KEY ("roleId")
    REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One candidate can only apply to a given role once
CREATE UNIQUE INDEX "applications_candidateId_roleId_key"
  ON "applications"("candidateId", "roleId");

CREATE INDEX "applications_candidate_idx"  ON "applications"("candidateId");
CREATE INDEX "applications_role_idx"       ON "applications"("roleId");
CREATE INDEX "applications_status_idx"     ON "applications"("status");
CREATE INDEX "applications_stage_idx"      ON "applications"("stage");
CREATE INDEX "applications_applied_at_idx" ON "applications"("appliedAt");
