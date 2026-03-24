-- Migration: 20240102000000_add_candidate_notes
-- Description: Adds the candidate_notes table for storing recruiter / hiring-manager
--              notes that are attached directly to a candidate (as opposed to the
--              per-application notes field on the applications table).

-- ---------------------------------------------------------------------------
-- Table: candidate_notes
-- ---------------------------------------------------------------------------

CREATE TABLE "candidate_notes" (
  "id"          TEXT         NOT NULL,
  "candidateId" TEXT         NOT NULL,
  "content"     TEXT         NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "candidate_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "candidate_notes_candidateId_fkey" FOREIGN KEY ("candidateId")
    REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "candidate_notes_candidate_idx" ON "candidate_notes"("candidateId");
