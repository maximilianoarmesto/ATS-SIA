-- Migration: 20240103000000_add_candidate_search_indexes
-- Description: Add GIN trigram indexes on candidate fields used for search
--              (firstName, lastName, linkedinUrl) so that ILIKE pattern-match
--              queries on large datasets stay sub-millisecond.
--
-- pg_trgm is enabled unconditionally in docker/init-db/01-init-extensions.sql
-- and is therefore available here without superuser rights.
-- ---------------------------------------------------------------------------

-- GIN index on firstName — accelerates ILIKE '%...%' searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS "candidates_first_name_trgm_idx"
  ON "candidates" USING GIN ("firstName" gin_trgm_ops);

-- GIN index on lastName — accelerates ILIKE '%...%' searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS "candidates_last_name_trgm_idx"
  ON "candidates" USING GIN ("lastName" gin_trgm_ops);

-- GIN index on linkedinUrl — accelerates ILIKE '%...%' searches
-- The column is nullable; GIN indexes naturally skip NULL values.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "candidates_linkedin_url_trgm_idx"
  ON "candidates" USING GIN ("linkedinUrl" gin_trgm_ops);
